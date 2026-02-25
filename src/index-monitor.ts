/**
 * Monitor-only entry point (sleuth).
 * Only runs the trade monitor: fetches target traders' activity and positions, writes to DB.
 * No CLOB client, no order execution. Use with a separate executor process for production.
 */

import connectDB, { closeDB } from './config/db';
import { ENV } from './config/env';
import tradeMonitor, { stopTradeMonitor } from './services/tradeMonitor';
import Logger from './utils/logger';

const USER_ADDRESSES = ENV.USER_ADDRESSES;

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
        process.exit(1);
    }
    isShuttingDown = true;
    Logger.separator();
    Logger.info(`[Monitor] Received ${signal}, shutting down...`);
    stopTradeMonitor();
    await new Promise((r) => setTimeout(r, 1500));
    await closeDB();
    Logger.success('Monitor shutdown complete');
    process.exit(0);
};

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    Logger.error(`Unhandled Rejection: ${reason}`);
});
process.on('uncaughtException', (err: Error) => {
    Logger.error(`Uncaught Exception: ${err.message}`);
    gracefulShutdown('uncaughtException').catch(() => process.exit(1));
});
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const main = async () => {
    await connectDB();
    Logger.separator();
    Logger.info('🔍 Running in MONITOR-ONLY mode (sleuth)');
    Logger.info(`   Watching ${USER_ADDRESSES.length} trader(s). No orders will be sent.`);
    Logger.separator();
    await tradeMonitor();
};

main().catch((err) => {
    Logger.error(`Fatal: ${err}`);
    process.exit(1);
});
