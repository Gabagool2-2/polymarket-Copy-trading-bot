/**
 * Order validation module.
 * This module provides validation logic for trades before execution.
 */

import { UserPositionInterface } from '../interfaces/User';
import { UserActivityInterface } from '../interfaces/User';
import { ENV } from '../config/env';
import fetchData from '../utils/fetchData';
import getMyBalance from '../utils/getMyBalance';
import { ErrorHandler } from '../utils/errorHandler';
import { CircuitBreakerRegistry } from '../utils/circuitBreaker';
import { ValidationError } from '../errors';

/** Wallet to validate (follower). Defaults to primary proxy wallet. */
const defaultProxyWallet = () => ENV.PROXY_WALLET;

/**
 * Interface for trade validation results.
 * @interface ValidationResult
 */
interface ValidationResult {
    isValid: boolean;
    reason?: string;
    myPosition?: UserPositionInterface;
    userPosition?: UserPositionInterface;
    myBalance?: number;
    userBalance?: number;
}

/**
 * Validates whether a trade can be executed based on current positions and balances.
 * @param trade - The trade activity to validate.
 * @param userAddress - The address of the user (trader) whose trade is being validated.
 * @param proxyWallet - Optional follower wallet address; if not set, uses ENV.PROXY_WALLET.
 */
const validateTrade = async (
    trade: UserActivityInterface,
    userAddress: string,
    proxyWallet?: string
): Promise<ValidationResult> => {
    const myWallet = proxyWallet ?? defaultProxyWallet();
    const positionsBreaker = CircuitBreakerRegistry.getBreaker('polymarket-validation-positions', 3, 30000);
    const balanceBreaker = CircuitBreakerRegistry.getBreaker('polymarket-validation-balance', 3, 30000);

    try {
        const myPositionsUrl = `https://data-api.polymarket.com/positions?user=${myWallet}`;
        const userPositionsUrl = `https://data-api.polymarket.com/positions?user=${userAddress}`;

        const [my_positions, user_positions] = await Promise.all([
            positionsBreaker.execute(() => fetchData(myPositionsUrl)),
            positionsBreaker.execute(() => fetchData(userPositionsUrl))
        ]);

        if (!Array.isArray(my_positions) || !Array.isArray(user_positions)) {
            throw new ValidationError('Invalid positions data received from API');
        }

        const my_position = my_positions.find(
            (position: UserPositionInterface) => position.conditionId === trade.conditionId
        );
        const user_position = user_positions.find(
            (position: UserPositionInterface) => position.conditionId === trade.conditionId
        );

        const my_balance = await balanceBreaker.execute(() => getMyBalance(myWallet));

        // Calculate trader's total portfolio value from positions
        const user_balance = user_positions.reduce((total, pos) => {
            return total + (pos.currentValue || 0);
        }, 0);

        // Basic validation: ensure we have balance for buy orders
        if (trade.side === 'BUY' && my_balance < trade.usdcSize) {
            return {
                isValid: false,
                reason: `Insufficient balance: $${my_balance.toFixed(2)} < $${trade.usdcSize.toFixed(2)}`,
            };
        }

        return {
            isValid: true,
            myPosition: my_position,
            userPosition: user_position,
            myBalance: my_balance,
            userBalance: user_balance,
        };
    } catch (error) {
        ErrorHandler.handle(error, `Trade validation for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
        return {
            isValid: false,
            reason: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
};

export { ValidationResult, validateTrade };
