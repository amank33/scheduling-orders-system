const mongoose = require('mongoose');
const { Schema } = mongoose;

const scheduledOrderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productName: {
      type: String,
      default: 'Standard Order Item',
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    description: {
      type: String,
    },
    scheduledTime: {
      type: Date,
      required: true,
    },
    recurrenceType: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly'],
      default: 'once',
    },
    recurrencePattern: {
      daysOfWeek: [Number],
      dayOfMonth: Number,
      endDate: Date,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active',
    },
    lastExecutedAt: Date,
    nextExecutionAt: Date,
    totalExecutions: {
      type: Number,
      default: 0,
    },
    failedExecutions: {
      type: Number,
      default: 0,
    },
    notes: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScheduledOrder', scheduledOrderSchema);
