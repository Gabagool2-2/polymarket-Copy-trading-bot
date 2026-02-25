/**
 * Executor-only entry point.
 * Only runs the trade executor: reads pending trades from DB and executes orders.
 * Requires CLOB client(s). Use with a separate monitor process that fills the DB.
 */

import connectDB, { closeDB } from './config/db';
import { ENV } from './config/env';
import { getClobClients } from './services/createClobClient';
import tradeExecutor, { stopTradeExecutor } from './services/tradeExecutor';
import Logger from './utils/logger';
import { performHealthCheck, logHealthCheck } from './utils/healthCheck';

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
        process.exit(1);
    }
    isShuttingDown = true;
    Logger.separator();
    Logger.info(`[Executor] Received ${signal}, shutting down...`);
    stopTradeExecutor();
    await new Promise((r) => setTimeout(r, 2000));
    await closeDB();
    Logger.success('Executor shutdown complete');
    process.exit(0);
};

process.on('unhandledRejection', (reason: unknown) => {
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
    const followers = ENV.FOLLOWER_WALLETS;
    Logger.startup(ENV.USER_ADDRESSES, followers[0].address);
    if (followers.length > 1) {
        Logger.info(`Multi-wallet: ${followers.length} follower wallet(s)`);
    }

    Logger.info('Performing health check...');
    const healthResult = await performHealthCheck();
    logHealthCheck(healthResult);
    if (!healthResult.healthy) {
        Logger.warning('Health check had issues; continuing...');
    }

    Logger.info('Initializing CLOB client(s)...');
    const clobClients = await getClobClients();
    Logger.success(`CLOB ready for ${clobClients.length} wallet(s)`);

    if (ENV.PREVIEW_MODE) {
        Logger.warning('⚠️  PREVIEW_MODE is ON: no real orders will be sent.');
    }

    Logger.separator();
    Logger.info('Starting trade executor only (no monitor).');
    await tradeExecutor(clobClients);
};

main().catch((err) => {
    Logger.error(`Fatal: ${err}`);
    process.exit(1);
});
