/**
 * Copy-trading PnL service: compute and optionally store PnL from positions API.
 */

import fetchData from '../utils/fetchData';
import { getCopyPnlModel } from '../models/copyPnl';
import Logger from '../utils/logger';

export interface CopyPnlSummary {
    followerWallet: string;
    totalValueUsd: number;
    totalInitialUsd: number;
    unrealizedPnlUsd: number;
    unrealizedPnlPercent: number;
    realizedPnlUsd: number;
    positionCount: number;
    timestamp: Date;
}

/**
 * Fetches positions for a wallet from Polymarket API and computes PnL summary.
 */
export const getCopyPnlForWallet = async (
    followerWallet: string
): Promise<CopyPnlSummary | null> => {
    try {
        const url = `https://data-api.polymarket.com/positions?user=${followerWallet}`;
        const positions = await fetchData(url);
        if (!Array.isArray(positions) || positions.length === 0) {
            return {
                followerWallet,
                totalValueUsd: 0,
                totalInitialUsd: 0,
                unrealizedPnlUsd: 0,
                unrealizedPnlPercent: 0,
                realizedPnlUsd: 0,
                positionCount: 0,
                timestamp: new Date(),
            };
        }
        let totalValue = 0;
        let totalInitial = 0;
        let realizedPnl = 0;
        for (const p of positions) {
            totalValue += p.currentValue ?? 0;
            totalInitial += p.initialValue ?? 0;
            realizedPnl += p.realizedPnl ?? 0;
        }
        const unrealizedPnlUsd = totalValue - totalInitial;
        const unrealizedPnlPercent =
            totalInitial > 0 ? (unrealizedPnlUsd / totalInitial) * 100 : 0;
        const realizedPnlPercent =
            totalInitial > 0 ? (realizedPnl / totalInitial) * 100 : 0;
        return {
            followerWallet,
            totalValueUsd: totalValue,
            totalInitialUsd: totalInitial,
            unrealizedPnlUsd,
            unrealizedPnlPercent,
            realizedPnlUsd: realizedPnl,
            positionCount: positions.length,
            timestamp: new Date(),
        };
    } catch (err) {
        Logger.error(`PnL fetch failed for ${followerWallet.slice(0, 8)}...: ${err}`);
        return null;
    }
};

/**
 * Saves a PnL snapshot to the database (for history/charts).
 */
export const saveCopyPnlSnapshot = async (
    summary: CopyPnlSummary
): Promise<void> => {
    const CopyPnl = getCopyPnlModel();
    await CopyPnl.create({
        followerWallet: summary.followerWallet,
        timestamp: summary.timestamp,
        totalValueUsd: summary.totalValueUsd,
        totalInitialUsd: summary.totalInitialUsd,
        unrealizedPnlUsd: summary.unrealizedPnlUsd,
        unrealizedPnlPercent: summary.unrealizedPnlPercent,
        realizedPnlUsd: summary.realizedPnlUsd,
        realizedPnlPercent:
            summary.totalInitialUsd > 0
                ? (summary.realizedPnlUsd / summary.totalInitialUsd) * 100
                : 0,
        positionCount: summary.positionCount,
    });
};

/**
 * Logs PnL summary for one or all follower wallets.
 */
export const logCopyPnl = async (
    followerWallets?: string[]
): Promise<CopyPnlSummary[]> => {
    const wallets =
        followerWallets && followerWallets.length > 0
            ? followerWallets
            : (await import('../config/env')).ENV.FOLLOWER_WALLETS.map(
                  (f) => f.address
              );
    const results: CopyPnlSummary[] = [];
    for (const w of wallets) {
        const summary = await getCopyPnlForWallet(w);
        if (summary) {
            results.push(summary);
            const short = `${w.slice(0, 8)}...${w.slice(-4)}`;
            Logger.info(
                `[PnL] ${short} | Value: $${summary.totalValueUsd.toFixed(2)} | ` +
                    `Initial: $${summary.totalInitialUsd.toFixed(2)} | ` +
                    `Unrealized: $${summary.unrealizedPnlUsd.toFixed(2)} (${summary.unrealizedPnlPercent.toFixed(1)}%) | ` +
                    `Realized: $${summary.realizedPnlUsd.toFixed(2)} | Positions: ${summary.positionCount}`
            );
        }
    }
    return results;
};
