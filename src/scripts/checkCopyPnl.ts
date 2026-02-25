/**
 * Script: Log copy-trading PnL for all follower wallets (from positions API).
 * Usage: npm run check-copy-pnl
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { logCopyPnl } from '../services/copyPnlService';

async function main() {
    console.log('\n📊 Copy-trading PnL (from Polymarket positions API)\n');
    await logCopyPnl();
    console.log('');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
