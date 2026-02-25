/**
 * Trade execution engine module.
 * This module contains functions to execute individual and aggregated trades on Polymarket.
 */

import { ClobClient } from '@polymarket/clob-client';
import { UserActivityInterface } from '../interfaces/User';
import { getUserActivityModel } from '../models/userHistory';
import { getCopyExecutionModel } from '../models/copyExecution';
import postOrder from '../utils/postOrder';
import Logger from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { ENV } from '../config/env';
import { validateTrade, ValidationResult } from './OrderValidator';
import { AggregatedTrade } from './TradeAggregator';

const PREVIEW_MODE = ENV.PREVIEW_MODE;

/**
 * Executes a single trade for one follower wallet. Records CopyExecution for multi-wallet.
 * @param clobClient - CLOB client for this follower.
 * @param trade - Trade to copy.
 * @param userAddress - Trader address.
 * @param followerWallet - Follower wallet address (for multi-wallet and validation).
 */
const executeTrade = async (
    clobClient: ClobClient,
    trade: UserActivityInterface,
    userAddress: string,
    followerWallet?: string
): Promise<void> => {
    const UserActivity = getUserActivityModel(userAddress);
    const CopyExecution = getCopyExecutionModel();
    const isMultiWallet = typeof followerWallet === 'string' && followerWallet.length > 0;

    try {
        if (!isMultiWallet) {
            await ErrorHandler.withErrorHandling(
                () => UserActivity.updateOne({ _id: trade._id }, { $set: { botExcutedTime: 1 } }).exec(),
                `Marking trade as processing for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`,
                'mark trade processing'
            );
        }

        Logger.trade(userAddress, trade.side || 'UNKNOWN', {
            asset: trade.asset,
            side: trade.side,
            amount: trade.usdcSize,
            price: trade.price,
            slug: trade.slug,
            eventSlug: trade.eventSlug,
            transactionHash: trade.transactionHash,
            ...(followerWallet ? { follower: `${followerWallet.slice(0, 8)}...${followerWallet.slice(-4)}` } : {}),
        });

        const validation: ValidationResult = await validateTrade(
            trade,
            userAddress,
            followerWallet
        );

        if (!validation.isValid) {
            Logger.error(`Trade validation failed: ${validation.reason}`);
            if (isMultiWallet && followerWallet) {
                await CopyExecution.create({
                    traderAddress: userAddress,
                    activityId: trade._id,
                    followerWallet,
                    status: 'failed',
                });
            } else {
                await UserActivity.updateOne({ _id: trade._id }, { $set: { botExcutedTime: -1 } }).exec();
            }
            return;
        }

        Logger.balance(validation.myBalance!, validation.userBalance!, userAddress);

        if (PREVIEW_MODE) {
            Logger.info(`[PREVIEW] Would execute ${trade.side} $${trade.usdcSize?.toFixed(2) ?? '?'} for ${trade.slug || trade.asset}`);
            if (isMultiWallet && followerWallet) {
                await CopyExecution.create({
                    traderAddress: userAddress,
                    activityId: trade._id,
                    followerWallet,
                    status: 'success',
                    preview: true,
                });
            } else {
                await UserActivity.updateOne({ _id: trade._id }, { $set: { bot: true } }).exec();
            }
            Logger.separator();
            return;
        }

        await ErrorHandler.withErrorHandling(
            () => postOrder(
                clobClient,
                trade.side === 'BUY' ? 'buy' : 'sell',
                validation.myPosition,
                validation.userPosition,
                trade,
                validation.myBalance!,
                validation.userBalance!,
                userAddress,
                isMultiWallet
            ),
            `Executing ${trade.side} trade for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`,
            'execute trade order'
        );

        if (isMultiWallet && followerWallet) {
            const lastDoc = await UserActivity.findById(trade._id).select('myBoughtSize').lean().exec();
            await CopyExecution.create({
                traderAddress: userAddress,
                activityId: trade._id,
                followerWallet,
                status: 'success',
                myBoughtSize: (lastDoc as { myBoughtSize?: number })?.myBoughtSize,
            });
        }

        Logger.separator();
    } catch (error) {
        ErrorHandler.handle(error, `Trade execution for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
        if (isMultiWallet && followerWallet) {
            try {
                await CopyExecution.create({
                    traderAddress: userAddress,
                    activityId: trade._id,
                    followerWallet,
                    status: 'failed',
                });
            } catch (e) {
                ErrorHandler.handle(e, 'Record copy execution failed');
            }
        } else {
            try {
                await UserActivity.updateOne({ _id: trade._id }, { $set: { botExcutedTime: -1 } }).exec();
            } catch (markError) {
                ErrorHandler.handle(markError, 'Mark trade as failed');
            }
        }
    }
};

/**
 * Executes multiple aggregated trades that have met the aggregation criteria.
 * For each aggregated trade, validates the combined position, creates a synthetic trade object
 * with aggregated values, and executes the order. Marks all individual trades in the aggregation
 * as processed or failed based on the outcome.
 * @function executeAggregatedTrades
 * @param {ClobClient} clobClient - The configured ClobClient instance for API interactions.
 * @param {AggregatedTrade[]} aggregatedTrades - Array of aggregated trades ready for execution.
 * @returns {Promise<void>} A promise that resolves when all aggregated trades have been processed.
 * @throws {DatabaseError} If database operations fail.
 * @throws {Error} If order posting or validation fails.
 */
const executeAggregatedTrades = async (
    clobClient: ClobClient,
    aggregatedTrades: AggregatedTrade[]
): Promise<void> => {
    for (const agg of aggregatedTrades) {
        try {
            Logger.header(`📊 AGGREGATED TRADE (${agg.trades.length} trades combined)`);
            Logger.info(`Market: ${agg.slug || agg.asset}`);
            Logger.info(`Side: ${agg.side}`);
            Logger.info(`Total volume: $${agg.totalUsdcSize.toFixed(2)}`);
            Logger.info(`Average price: $${agg.averagePrice.toFixed(4)}`);

            // Mark all individual trades as being processed
            for (const trade of agg.trades) {
                try {
                    const UserActivity = getUserActivityModel(trade.userAddress);
                    await ErrorHandler.withErrorHandling(
                        () => UserActivity.updateOne({ _id: trade._id }, { $set: { botExcutedTime: 1 } }).exec(),
                        `Marking aggregated trade as processing for ${trade.userAddress.slice(0, 6)}...${trade.userAddress.slice(-4)}`,
                        'mark aggregated trade processing'
                    );
                } catch (error) {
                    ErrorHandler.handle(error, `Failed to mark aggregated trade ${trade._id} as processing`);
                    // Continue with other trades
                }
            }

            // Validate using the first trade as representative
            const validation: ValidationResult = await validateTrade(agg.trades[0], agg.userAddress);

            if (!validation.isValid) {
                Logger.error(`Aggregated trade validation failed: ${validation.reason}`);
                // Mark all trades as failed
                for (const trade of agg.trades) {
                    try {
                        const UserActivity = getUserActivityModel(trade.userAddress);
                        await UserActivity.updateOne({ _id: trade._id }, { $set: { botExcutedTime: -1 } }).exec();
                    } catch (error) {
                        ErrorHandler.handle(error, `Failed to mark aggregated trade ${trade._id} as failed`);
                    }
                }
                continue;
            }

            Logger.balance(validation.myBalance!, validation.userBalance!, agg.userAddress);

            // Create a synthetic trade object for postOrder using aggregated values
            const syntheticTrade: UserActivityInterface = {
                ...agg.trades[0], // Use first trade as template
                usdcSize: agg.totalUsdcSize,
                price: agg.averagePrice,
                side: agg.side as 'BUY' | 'SELL',
            };

            // Execute the aggregated trade
            await ErrorHandler.withErrorHandling(
                () => postOrder(
                    clobClient,
                    agg.side === 'BUY' ? 'buy' : 'sell',
                    validation.myPosition,
                    validation.userPosition,
                    syntheticTrade,
                    validation.myBalance!,
                    validation.userBalance!,
                    agg.userAddress
                ),
                `Executing aggregated ${agg.side} trade for ${agg.userAddress.slice(0, 6)}...${agg.userAddress.slice(-4)}`,
                'execute aggregated trade order'
            );

            Logger.separator();
        } catch (error) {
            ErrorHandler.handle(error, `Aggregated trade execution for ${agg.userAddress.slice(0, 6)}...${agg.userAddress.slice(-4)}`);
            // Mark all trades as failed
            for (const trade of agg.trades) {
                try {
                    const UserActivity = getUserActivityModel(trade.userAddress);
                    await UserActivity.updateOne({ _id: trade._id }, { $set: { botExcutedTime: -1 } }).exec();
                } catch (markError) {
                    ErrorHandler.handle(markError, `Failed to mark aggregated trade ${trade._id} as failed`);
                }
            }
        }
    }
};

export { executeTrade, executeAggregatedTrades };
