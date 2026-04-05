const Queue = require('bull');
const redis = require('redis');
const OrderExecution = require('../model/orderExecution');
const ScheduledOrder = require('../model/scheduledOrder');
const { notifyOrderExecution } = require('../helper/emailNotification');

// Create job queue
const jobQueue = new Queue('scheduled-orders', {
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

// Handle Redis connection errors gracefully
jobQueue.on('error', (err) => {
  console.warn('⚠️  Redis Connection Warning:', err.message.substring(0, 100));
});

jobQueue.on('ready', () => {
  console.log('✅ Job Queue connected to Redis');
});

jobQueue.process(async (job) => {
  try {
    console.log(`Processing job: ${job.id}`);
    
    const { scheduledOrderId, userId } = job.data;

    const ordr = await ScheduledOrder.findById(scheduledOrderId);
    if (!ordr) {
      throw new Error('Order not found');
    }

    // simulate execution
    const exDetails = {
      orderId: `ORD-${Date.now()}`,
      amount: 99.99,
      items: ordr.quantity,
      externalRef: `EXT-${scheduledOrderId}`,
    };

    // create execution record
    const exec = await OrderExecution.create({
      scheduledOrderId,
      userId,
      status: 'success',
      executedAt: new Date(),
      executionDetails: exDetails,
      retryCount: job.attemptsMade,
      logs: `Executed at ${new Date().toISOString()}`,
    });

    // update order
    ordr.totalExecutions += 1;
    ordr.lastExecutedAt = new Date();
    
    if (ordr.recurrenceType === 'once') {
      ordr.status = 'completed';
    } else {
      ordr.nextExecutionAt = computeNextRun(ordr);
    }

    await ordr.save();

    // send notification
    try {
      await notifyOrderExecution(userId, ordr, exec);
      exec.notificationSent = true;
      exec.notificationStatus = 'sent';
    } catch (err) {
      console.log('error sending notification:', err.message);
      exec.notificationStatus = 'failed';
    }
    
    await exec.save();

    console.log(`Job completed: ${exec._id}`);
    return { success: true, executionId: exec._id };

  } catch (error) {
    console.error(`Job failed: ${job.id}`, error.message);
    
    const { scheduledOrderId, userId } = job.data;
    const failExec = await OrderExecution.create({
      scheduledOrderId,
      userId,
      status: job.attemptsMade >= 3 ? 'failed' : 'retry',
      executedAt: new Date(),
      errorMessage: error.message,
      retryCount: job.attemptsMade,
      logs: `Failed: ${error.message}`,
    });

    const ord = await ScheduledOrder.findById(scheduledOrderId);
    if (ord) {
      ord.failedExecutions += 1;
      await ord.save();
    }

    throw error;
  }
});

jobQueue.on('completed', (job) => {
  console.log(`Completed: ${job.id}`);
});

jobQueue.on('failed', (job, err) => {
  console.log(`Job failed: ${job.id}`);
});

const calcNextRun = (ordr) => {
  const cur = new Date(ordr.lastExecutedAt || ordr.scheduledTime);
  let nxt = new Date(cur);

  if (ordr.recurrenceType === 'daily') {
    nxt.setDate(nxt.getDate() + 1);
  } else if (ordr.recurrenceType === 'weekly') {
    nxt.setDate(nxt.getDate() + 7);
  } else if (ordr.recurrenceType === 'monthly') {
    nxt.setMonth(nxt.getMonth() + 1);
  }

  if (ordr.recurrencePattern && ordr.recurrencePattern.endDate && nxt > new Date(ordr.recurrencePattern.endDate)) {
    return null;
  }

  return nxt;
};

const startQueue = async () => {
  try {
    // clear old jobs
    await jobQueue.clean(0, 'wait');
    console.log('Job queue initialized');

    // reschedule from db
    const acts = await ScheduledOrder.find({ status: 'active' });
    for (const o of acts) {
      const nxtRun = o.nextExecutionAt || o.scheduledTime;
      if (nxtRun && new Date(nxtRun) > new Date()) {
        const waitTime = new Date(nxtRun) - new Date();
        await jobQueue.add(
          { scheduledOrderId: o._id, userId: o.userId },
          {
            delay: Math.max(0, waitTime),
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: true,
            jobId: `${o._id}-${Date.now()}`,
          }
        );
      }
    }
  } catch (error) {
    console.error('Queue init error:', error.message);
  }
};

const addScheduleJob = async (ordr) => {
  try {
    const wait = new Date(ordr.scheduledTime) - new Date();
    console.log(`Schedule: ${ordr._id} in ${wait}ms`);

    await jobQueue.add(
      { scheduledOrderId: ordr._id, userId: ordr.userId },
      {
        delay: Math.max(0, wait),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        jobId: `${ordr._id}-${Date.now()}`,
      }
    );

    return true;
  } catch (error) {
    console.error('Scheduling error:', error.message);
    throw error;
  }
};

const stopJob = async (orderId) => {
  try {
    const jobs = await jobQueue.getJobs('wait');
    const j = jobs.find(x => x.data.scheduledOrderId.toString() === orderId.toString());
    
    if (j) {
      await j.remove();
      console.log(`Job cancelled: ${orderId}`);
    }
  } catch (error) {
    console.error('Cancel error:', error.message);
  }
};

module.exports = {
  jobQueue,
  initQueue: startQueue,
  scheduleOrderJob: addScheduleJob,
  cancelJob: stopJob,
  computeNextRun: calcNextRun,
};
