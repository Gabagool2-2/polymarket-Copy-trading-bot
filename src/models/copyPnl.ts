/**
 * PnL snapshot for copy-trading performance (optional periodic storage).
 */

import mongoose, { Schema } from 'mongoose';

const copyPnlSchema = new Schema(
    {
        followerWallet: { type: String, required: true, index: true },
        timestamp: { type: Date, default: Date.now },
        totalValueUsd: { type: Number, required: true },
        totalInitialUsd: { type: Number, required: true },
        unrealizedPnlUsd: { type: Number, required: true },
        unrealizedPnlPercent: { type: Number },
        realizedPnlUsd: { type: Number, default: 0 },
        realizedPnlPercent: { type: Number },
        positionCount: { type: Number, default: 0 },
    },
    { collection: 'copy_pnl_snapshots' }
);

copyPnlSchema.index({ followerWallet: 1, timestamp: -1 });

const CopyPnlModel =
    mongoose.models?.CopyPnl ?? mongoose.model('CopyPnl', copyPnlSchema);

export const getCopyPnlModel = () => CopyPnlModel;
export default CopyPnlModel;
