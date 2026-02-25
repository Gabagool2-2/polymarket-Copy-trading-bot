/**
 * Trade executor service module.
 * This module manages the execution of trades, supporting both immediate and aggregated execution modes.
 * Supports multi-wallet: one ClobClient per follower; each trade is executed for every follower.
 */

import { ClobClient } from '@polymarket/clob-client';
import { UserActivityInterface } from '../interfaces/User';
import { ENV, FollowerWallet } from '../config/env';
import { getUserActivityModel } from '../models/userHistory';
import { getCopyExecutionModel } from '../models/copyExecution';
import Logger from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import {
    TradeWithUser,
    addToAggregationBuffer,
    getReadyAggregatedTrades,
    getAggregationBufferSize,
} from './TradeAggregator';

const TRADE_AGGREGATION_MIN_TOTAL_USD = 1.0; // Polymarket minimum
import { executeTrade, executeAggregatedTrades } from './ExecutionEngine';

const USER_ADDRESSES = ENV.USER_ADDRESSES;
const TRADE_AGGREGATION_ENABLED = ENV.TRADE_AGGREGATION_ENABLED;
const TRADE_AGGREGATION_WINDOW_SECONDS = ENV.TRADE_AGGREGATION_WINDOW_SECONDS;
const FOLLOWER_WALLETS = ENV.FOLLOWER_WALLETS;

// Create activity models for each user
const userActivityModels = USER_ADDRESSES.map((address) => ({
    address,
    model: getUserActivityModel(address),
}));

/**
 * Read pending trades from all users.
 * @function readTempTrades
 * @returns {Promise<TradeWithUser[]>} Array of pending trades.
 */
const readTempTrades = async (): Promise<TradeWithUser[]> => {
    const allTrades: TradeWithUser[] = [];

    for (const { address, model } of userActivityModels) {
        try {
            // Only get trades that haven't been processed yet (bot: false AND botExcutedTime: 0)
            // This prevents processing the same trade multiple times
            const trades = await ErrorHandler.withErrorHandling(
                () => model
                    .find({
                        $and: [{ type: 'TRADE' }, { bot: false }, { botExcutedTime: 0 }],
                    })
                    .exec(),
                `Database query for pending trades of ${address.slice(0, 6)}...${address.slice(-4)}`,
                'find pending trades'
            );

            if (trades && trades.length > 0) {
                const tradesWithUser = trades.map((trade) => ({
                    ...(trade.toObject() as UserActivityInterface),
                    userAddress: address,
                }));
                allTrades.push(...tradesWithUser);
            }
        } catch (error) {
            ErrorHandler.handle(error, `Reading pending trades for ${address.slice(0, 6)}...${address.slice(-4)}`);
            // Continue with other users
        }
    }

    return allTrades;
};

/** Returns indices of followers that have not yet had a copy execution for this trade. */
const getPendingFollowerIndices = async (
    traderAddress: string,
    activityId: unknown,
    followers: FollowerWallet[]
): Promise<number[]> => {
    const CopyExecution = getCopyExecutionModel();
    const existing = await CopyExecution.find({
        traderAddress,
        activityId,
    })
        .select('followerWallet')
        .lean()
        .exec();
    const doneSet = new Set((existing || []).map((r: { followerWallet: string }) => r.followerWallet.toLowerCase()));
    return followers
        .map((f, i) => (doneSet.has(f.address.toLowerCase()) ? -1 : i))
        .filter((i) => i >= 0);
};

/** Mark activity as fully processed when all followers have been attempted. */
const markActivityFullyProcessedIfDone = async (
    traderAddress: string,
    activityId: unknown,
    totalFollowers: number
): Promise<void> => {
    const CopyExecution = getCopyExecutionModel();
    const count = await CopyExecution.countDocuments({ traderAddress, activityId }).exec();
    if (count >= totalFollowers) {
        const UserActivity = getUserActivityModel(traderAddress);
        await UserActivity.updateOne(
            { _id: activityId },
            { $set: { bot: true, botExcutedTime: 1 } }
        ).exec();
    }
};

// Track if executor should continue running
let isRunning = true;

/**
 * Stop the trade executor gracefully.
 * @function stopTradeExecutor
 */
export const stopTradeExecutor = () => {
    isRunning = false;
    Logger.info('Trade executor shutdown requested...');
};

/**
 * Starts the trade execution service. Accepts one or more ClobClients (one per follower wallet).
 * Each pending trade is executed for every follower that has not yet been processed.
 */
const tradeExecutor = async (clobClients: ClobClient[]) => {
    const clobClient = clobClients[0]; // primary for aggregation
    const followers = FOLLOWER_WALLETS;
    if (clobClients.length !== followers.length) {
        Logger.warning(
            `ClobClients count (${clobClients.length}) != FOLLOWER_WALLETS count (${followers.length}); using first ${clobClients.length} follower(s).`
        );
    }

    Logger.success(
        `Trade executor ready for ${USER_ADDRESSES.length} trader(s), ${Math.min(clobClients.length, followers.length)} wallet(s)`
    );
    if (TRADE_AGGREGATION_ENABLED) {
        Logger.info(
            `Trade aggregation enabled: ${TRADE_AGGREGATION_WINDOW_SECONDS}s window, $${TRADE_AGGREGATION_MIN_TOTAL_USD} minimum`
        );
    }

    let lastCheck = Date.now();
    while (isRunning) {
        try {
            const trades = await readTempTrades();

            if (TRADE_AGGREGATION_ENABLED) {
                if (trades.length > 0) {
                    Logger.clearLine();
                    Logger.info(
                        `📥 ${trades.length} new trade${trades.length > 1 ? 's' : ''} detected`
                    );

                    for (const trade of trades) {
                        try {
                            if (trade.side === 'BUY' && trade.usdcSize < TRADE_AGGREGATION_MIN_TOTAL_USD) {
                                Logger.info(
                                    `Adding $${trade.usdcSize.toFixed(2)} ${trade.side} trade to aggregation buffer for ${trade.slug || trade.asset}`
                                );
                                addToAggregationBuffer(trade);
                            } else {
                                Logger.clearLine();
                                Logger.header(`⚡ IMMEDIATE TRADE (above threshold)`);
                                const pendingIndices = await getPendingFollowerIndices(
                                    trade.userAddress,
                                    trade._id,
                                    followers
                                );
                                for (const i of pendingIndices) {
                                    await ErrorHandler.withErrorHandling(
                                        () =>
                                            executeTrade(
                                                clobClients[i],
                                                trade,
                                                trade.userAddress,
                                                followers[i].address
                                            ),
                                        `Executing immediate trade for ${trade.userAddress.slice(0, 6)}...`,
                                        'execute immediate trade'
                                    );
                                }
                                await markActivityFullyProcessedIfDone(
                                    trade.userAddress,
                                    trade._id,
                                    followers.length
                                );
                            }
                        } catch (error) {
                            ErrorHandler.handle(error, `Processing trade for ${trade.userAddress.slice(0, 6)}...`);
                        }
                    }
                    lastCheck = Date.now();
                }

                const readyAggregations = await getReadyAggregatedTrades();
                if (readyAggregations.length > 0) {
                    Logger.clearLine();
                    Logger.header(
                        `⚡ ${readyAggregations.length} AGGREGATED TRADE${readyAggregations.length > 1 ? 'S' : ''} READY`
                    );
                    await ErrorHandler.withErrorHandling(
                        () => executeAggregatedTrades(clobClient, readyAggregations),
                        'Executing aggregated trades',
                        'execute aggregated trades'
                    );
                    lastCheck = Date.now();
                }

                if (trades.length === 0 && readyAggregations.length === 0) {
                    if (Date.now() - lastCheck > 300) {
                        const bufferedCount = getAggregationBufferSize();
                        if (bufferedCount > 0) {
                            Logger.waiting(
                                USER_ADDRESSES.length,
                                `${bufferedCount} trade group(s) pending`
                            );
                        } else {
                            Logger.waiting(USER_ADDRESSES.length);
                        }
                        lastCheck = Date.now();
                    }
                }
            } else {
                if (trades.length > 0) {
                    Logger.clearLine();
                    Logger.header(
                        `⚡ ${trades.length} NEW TRADE${trades.length > 1 ? 'S' : ''} TO COPY`
                    );
                    for (const trade of trades) {
                        const pendingIndices = await getPendingFollowerIndices(
                            trade.userAddress,
                            trade._id,
                            followers
                        );
                        for (const i of pendingIndices) {
                            await ErrorHandler.withErrorHandling(
                                () =>
                                    executeTrade(
                                        clobClients[i],
                                        trade,
                                        trade.userAddress,
                                        followers[i].address
                                    ),
                                `Executing trade for ${trade.userAddress.slice(0, 6)}...${trade.userAddress.slice(-4)}`,
                                'execute trade'
                            );
                        }
                        await markActivityFullyProcessedIfDone(
                            trade.userAddress,
                            trade._id,
                            followers.length
                        );
                    }
                    lastCheck = Date.now();
                } else {
                    if (Date.now() - lastCheck > 300) {
                        Logger.waiting(USER_ADDRESSES.length);
                        lastCheck = Date.now();
                    }
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, 'Trade executor main loop');
        }

        if (!isRunning) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
    }

    Logger.info('Trade executor stopped');
};

export default tradeExecutor;
