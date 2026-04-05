const mongoose = require('mongoose');
const { Schema } = mongoose;

const executionSchema = new Schema(
  {
    scheduledOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledOrder',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending', 'retry'],
      default: 'pending',
    },
    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0,
    },
    executionDetails: {
      orderId: String,
      amount: Number,
      items: Number,
      externalRef: String,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    notificationStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    logs: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('OrderExecution', executionSchema);
