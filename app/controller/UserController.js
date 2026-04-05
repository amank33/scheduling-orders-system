const ScheduledOrder = require('../model/scheduledOrder');
const OrderExecution = require('../model/orderExecution');
const User = require('../model/user');
const Joi = require('joi');
const { scheduleOrderJob, cancelJob, calculateNextExecution } = require('../jobs/scheduleQueue');
const { sendConfirmation } = require('../helper/emailNotification');

// validation schema for orders
const orderValidation = Joi.object({
  productName: Joi.string().max(100).optional(),
  quantity: Joi.number().min(1).required(),
  description: Joi.string().max(500).optional(),
  scheduledTime: Joi.date().iso().required(),
  recurrenceType: Joi.string().valid('once', 'daily', 'weekly', 'monthly').required(),
  notes: Joi.string().max(500).optional(),
});

class UserController {
  async userDashboard(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const ordrs = await ScheduledOrder.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
      const stts = {
        total: ordrs.length,
        active: ordrs.filter(o => o.status === 'active').length,
        completed: ordrs.filter(o => o.status === 'completed').length,
        paused: ordrs.filter(o => o.status === 'paused').length,
      };

      res.render('user/dashboard', { orders: ordrs, stats: stts, user: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading dashboard');
      res.redirect('/');
    }
  }

  async displayAddForm(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      res.render('user/orders/add', { errors: null, old: {}, user: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading form');
      res.redirect('/user/dashboard');
    }
  }

  async addOrder(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const { error } = orderValidation.validate(req.body, { abortEarly: false });

      if (error) {
        const errs = {};
        error.details.forEach(err => {
          errs[err.context.key] = err.message;
        });
        return res.render('user/orders/add', { errors: errs, old: req.body, user: req.session.user });
      }

      // check scheduled time is not in past
      const schTime = new Date(req.body.scheduledTime);
      if (schTime <= new Date()) {
        return res.render('user/orders/add', { 
          errors: { scheduledTime: 'Cannot schedule in the past' },
          old: req.body,
          user: req.session.user
        });
      }

      const { productName, quantity, description, scheduledTime, recurrenceType, notes } = req.body;

      const newOrdr = await ScheduledOrder.create({
        userId: req.session.user.id,
        productName: productName || 'Standard Item',
        quantity: parseInt(quantity),
        description,
        scheduledTime,
        recurrenceType,
        status: 'active',
        nextExecutionAt: scheduledTime,
        notes,
      });

      // schedule the job
      await scheduleOrderJob(newOrdr);

      // try to send email
      const usrData = await User.findById(req.session.user.id);
      try {
        await sendConfirmation(usrData.email, newOrdr);
      } catch (mailErr) {
        console.log('Mail error:', mailErr.message);
      }

      req.flash('success', 'Order scheduled successfully!');
      res.redirect('/user/orders/list');

    } catch (err) {
      console.log(err);
      req.flash('error', 'Error creating order');
      res.redirect('/user/orders/add');
    }
  }

  async listOrders(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const orders = await ScheduledOrder.find({ userId: req.session.user.id })
        .sort({ createdAt: -1 });

      res.render('user/orders/list', { orders, user: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading orders');
      res.redirect('/user/dashboard');
    }
  }

  async displayEditForm(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const order = await ScheduledOrder.findOne({ 
        _id: req.params.id,
        userId: req.session.user.id 
      });

      if (!order) {
        req.flash('error', 'Order not found');
        return res.redirect('/user/orders/list');
      }

      res.render('user/orders/edit', { order, errors: null, old: {}, user: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading order');
      res.redirect('/user/orders/list');
    }
  }

  async editOrder(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const { error } = orderValidation.validate(req.body, { abortEarly: false });

      if (error) {
        const ord = await ScheduledOrder.findById(req.params.id);
        const errMap = {};
        error.details.forEach(err => {
          errMap[err.context.key] = err.message;
        });
        return res.render('user/orders/edit', { order: ord, errors: errMap, old: req.body, user: req.session.user });
      }

      const ordrData = await ScheduledOrder.findOne({ 
        _id: req.params.id,
        userId: req.session.user.id 
      });

      if (!ordrData) {
        req.flash('error', 'Order not found');
        return res.redirect('/user/orders/list');
      }

      const { productName, quantity, description, scheduledTime, recurrenceType, notes } = req.body;

      ordrData.productName = productName || ordrData.productName;
      ordrData.quantity = parseInt(quantity);
      ordrData.description = description;
      ordrData.scheduledTime = scheduledTime;
      ordrData.recurrenceType = recurrenceType;
      ordrData.nextExecutionAt = scheduledTime;
      ordrData.notes = notes;
      ordrData.updatedAt = new Date();

      await ordrData.save();

      // reschedule job
      await cancelJob(ordrData._id);
      await scheduleOrderJob(ordrData);

      req.flash('success', 'Order updated successfully');
      res.redirect('/user/orders/list');

    } catch (err) {
      console.log(err);
      req.flash('error', 'Error updating order');
      res.redirect('/user/orders/list');
    }
  }

  async removeOrder(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const o = await ScheduledOrder.findOne({ 
        _id: req.params.id,
        userId: req.session.user.id 
      });

      if (!o) {
        req.flash('error', 'Order not found');
        return res.redirect('/user/orders/list');
      }

      // cancel the job
      await cancelJob(o._id);

      // mark as cancelled
      o.status = 'cancelled';
      await o.save();

      req.flash('success', 'Order cancelled successfully');
      res.redirect('/user/orders/list');

    } catch (err) {
      console.log(err);
      req.flash('error', 'Error cancelling order');
      res.redirect('/user/orders/list');
    }
  }

  async pauseJob(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const o = await ScheduledOrder.findOne({ 
        _id: req.params.id,
        userId: req.session.user.id 
      });

      if (!o) {
        req.flash('error', 'Order not found');
        return res.redirect('/user/orders/list');
      }

      o.status = 'paused';
      await o.save();
      await cancelJob(o._id);

      req.flash('success', 'Order paused');
      res.redirect('/user/orders/list');

    } catch (err) {
      console.log(err);
      req.flash('error', 'Error pausing order');
      res.redirect('/user/orders/list');
    }
  }

  async startJob(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const o = await ScheduledOrder.findOne({ 
        _id: req.params.id,
        userId: req.session.user.id 
      });

      if (!o) {
        req.flash('error', 'Order not found');
        return res.redirect('/user/orders/list');
      }

      o.status = 'active';
      const nxtTime = o.nextExecutionAt || o.scheduledTime;
      
      if (new Date(nxtTime) > new Date()) {
        await o.save();
        await scheduleOrderJob(o);
        req.flash('success', 'Order resumed');
      } else {
        req.flash('error', 'Cannot resume - time passed already');
      }

      res.redirect('/user/orders/list');

    } catch (err) {
      console.log(err);
      req.flash('error', 'Error resuming order');
      res.redirect('/user/orders/list');
    }
  }

  async getHistory(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const orderId = req.params.id;
      const executions = await OrderExecution.find({ scheduledOrderId: orderId })
        .sort({ executedAt: -1 });
      
      const order = await ScheduledOrder.findById(orderId);

      res.render('user/orders/executions', { 
        executions, 
        order,
        user: req.session.user 
      });

    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading execution history');
      res.redirect('/user/orders/list');
    }
  }
}

module.exports = new UserController();
