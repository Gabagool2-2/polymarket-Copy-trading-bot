/**
 * Tracks copy-trade execution per follower wallet (for multi-wallet support).
 * Ensures each (trader trade, follower) is executed at most once.
 */

import mongoose, { Schema } from 'mongoose';

const copyExecutionSchema = new Schema(
    {
        traderAddress: { type: String, required: true, index: true },
        activityId: { type: Schema.Types.ObjectId, required: true, index: true },
        followerWallet: { type: String, required: true, index: true },
        status: { type: String, enum: ['success', 'failed'], required: true },
        executedAt: { type: Date, default: Date.now },
        myBoughtSize: { type: Number },
        preview: { type: Boolean, default: false },
    },
    { collection: 'copy_executions' }
);

copyExecutionSchema.index({ traderAddress: 1, activityId: 1, followerWallet: 1 }, { unique: true });

const CopyExecutionModel =
    mongoose.models?.CopyExecution ?? mongoose.model('CopyExecution', copyExecutionSchema);

export const getCopyExecutionModel = () => CopyExecutionModel;

export default CopyExecutionModel;
