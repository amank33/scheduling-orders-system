const Queue = require('bull');
const redis = require('redis');
const OrderExecution = require('../model/orderExecution');
const ScheduledOrder = require('../model/scheduledOrder');
const { notifyOrderExecution } = require('../helper/emailNotification');

// initialize job queue for processing scheduled orders
const job_queue = new Queue('scheduled-orders', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false,
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  }
});

job_queue.on('error', (err) => {
  console.warn('Redis issue:', err.message.substring(0, 100));
});

job_queue.on('ready', () => {
  console.log('Job queue connected');
});

// process scheduled order jobs
job_queue.process(async (job) => {
  try {
    console.log(`Processing: ${job.id}`);
    
    const { scheduledOrderId, userId } = job.data;

    const order = await ScheduledOrder.findById(scheduledOrderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const executionDetails = {
      orderId: `ORD-${Date.now()}`,
      amount: 99.99,
      items: order.quantity,
      externalRef: `EXT-${scheduledOrderId}`,
    };

    const execution = await OrderExecution.create({
      scheduledOrderId,
      userId,
      status: 'success',
      executedAt: new Date(),
      executionDetails,
      retryCount: job.attemptsMade,
      logs: `Executed at ${new Date().toISOString()}`,
    });

    order.totalExecutions += 1;
    order.lastExecutedAt = new Date();
    
    if (order.recurrenceType === 'once') {
      order.status = 'completed';
    } else {
      order.nextExecutionAt = calculateNextRun(order);
    }

    await order.save();

    try {
      await notifyOrderExecution(userId, order, execution);
      execution.notificationSent = true;
      execution.notificationStatus = 'sent';
    } catch (err) {
      console.log('error sending notification:', err.message);
      execution.notificationStatus = 'failed';
    }
    
    await execution.save();

    console.log(`Job completed: ${execution._id}`);
    return { success: true, executionId: execution._id };

  } catch (error) {
    console.error(`Job failed: ${job.id}`, error.message);
    
    const { scheduledOrderId, userId } = job.data;
    const failedExecution = await OrderExecution.create({
      scheduledOrderId,
      userId,
      status: job.attemptsMade >= 3 ? 'failed' : 'retry',
      executedAt: new Date(),
      errorMessage: error.message,
      retryCount: job.attemptsMade,
      logs: `Failed: ${error.message}`,
    });

    const order = await ScheduledOrder.findById(scheduledOrderId);
    if (order) {
      order.failedExecutions += 1;
      await order.save();
    }

    throw error;
  }
});

jobQueue.on('completed', (job) => {
  console.log(`Done: ${job.id}`);
});

jobQueue.on('failed', (job, err) => {
  console.log(`Job failed: ${job.id}`);
});

// calculate next execution time based on recurrence
const calculateNextRun = (order) => {
  const current = new Date(order.lastExecutedAt || order.scheduledTime);
  let nextRun = new Date(current);

  if (order.recurrenceType === 'daily') {
    nextRun.setDate(nextRun.getDate() + 1);
  } else if (order.recurrenceType === 'weekly') {
    nextRun.setDate(nextRun.getDate() + 7);
  } else if (order.recurrenceType === 'monthly') {
    nextRun.setMonth(nextRun.getMonth() + 1);
  }

  if (order.recurrencePattern && order.recurrencePattern.endDate && nextRun > new Date(order.recurrencePattern.endDate)) {
    return null;
  }

  return nextRun;
};

const startQueue = async () => {
  try {
    await jobQueue.clean(0, 'wait');
    console.log('Job queue initialized');

    const activeOrders = await ScheduledOrder.find({ status: 'active' });
    for (const order of activeOrders) {
      const nextRun = order.nextExecutionAt || order.scheduledTime;
      if (nextRun && new Date(nextRun) > new Date()) {
        const waitTime = new Date(nextRun) - new Date();
        await jobQueue.add(
          { scheduledOrderId: order._id, userId: order.userId },
          {
            delay: Math.max(0, waitTime),
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: true,
            jobId: `${order._id}-${Date.now()}`,
          }
        );
      }
    }
  } catch (error) {
    console.error('Queue init error:', error.message);
  }
};

const scheduleOrderJob = async (order) => {
  try {
    const waitTime = new Date(order.scheduledTime) - new Date();
    console.log(`Schedule: ${order._id} in ${waitTime}ms`);

    await jobQueue.add(
      { scheduledOrderId: order._id, userId: order.userId },
      {
        delay: Math.max(0, waitTime),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        jobId: `${order._id}-${Date.now()}`,
      }
    );

    return true;
  } catch (error) {
    console.error('Scheduling error:', error.message);
    throw error;
  }
};

const cancelJob = async (orderId) => {
  try {
    const jobs = await jobQueue.getJobs('wait');
    const job = jobs_list.find(x => x.data.scheduledOrderId.toString() === orderId.toString());
    
    if (job) {
      await job.remove();
      console.log(`Job cancelled: ${orderId}`);
    }
  } catch (error) {
    console.error('Cancel error:', error.message);
  }
};

module.exports = {
  jobQueue,
  initQueue: startQueue,
  scheduleOrderJob,
  cancelJob,
  computeNextRun: calculateNextRun,
};
