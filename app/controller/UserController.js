const ScheduledOrder = require('../model/scheduledOrder');
const OrderExecution = require('../model/orderExecution');
const User = require('../model/user');
const Joi = require('joi');
const { scheduleOrderJob, cancelJob, calculateNextExecution } = require('../jobs/scheduleQueue');
const { sendConfirmation } = require('../helper/emailNotification');

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

      const all_orders = await ScheduledOrder.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
      const dashboard_stats = {
        total: all_orders.length,
        active: all_orders.filter(x => x.status === 'active').length,
        done: all_orders.filter(x => x.status === 'completed').length,
        paused: all_orders.filter(x => x.status === 'paused').length,
      };

      res.render('user/dashboard', { orders: all_orders, stats: dashboard_stats, user: req.session.user });
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
        const err_list = {};
        error.details.forEach(er => {
          err_list[er.context.key] = er.message;
        });
        return res.render('user/orders/add', { errors: err_list, old: req.body, user: req.session.user });
      }

      const schedTime = new Date(req.body.scheduledTime);
      if (schedTime <= new Date()) {
        return res.render('user/orders/add', { 
          errors: { scheduledTime: 'Cannot schedule in the past' },
          old: req.body,
          user: req.session.user
        });
      }

      const { productName, quantity, description, scheduledTime, recurrenceType, notes } = req.body;

      const new_order = await ScheduledOrder.create({
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

      await scheduleOrderJob(new_order);

      const curr_user = await User.findById(req.session.user.id);
      try {
        await sendConfirmation(curr_user.email, new_order);
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
        const order_found = await ScheduledOrder.findById(req.params.id);
        const edit_errors = {};
        error.details.forEach(err => {
          edit_errors[err.context.key] = err.message;
        });
        return res.render('user/orders/edit', { order: order_found, errors: edit_errors, old: req.body, user: req.session.user });
      }

      const ordr = await ScheduledOrder.findOne({ 
        _id: req.params.id,
        userId: req.session.user.id 
      });

      if (!ordr) {
        req.flash('error', 'Order not found');
        return res.redirect('/user/orders/list');
      }

      const { productName, quantity, description, scheduledTime, recurrenceType, notes } = req.body;

      ordr.productName = productName || ordr.productName;
      ordr.quantity = parseInt(quantity);
      ordr.description = description;
      ordr.scheduledTime = scheduledTime;
      ordr.recurrenceType = recurrenceType;
      ordr.nextExecutionAt = scheduledTime;
      ordr.notes = notes;
      ordr.updatedAt = new Date();

      await ordr.save();

      await cancelJob(ordr._id);
      await scheduleOrderJob(ordr);

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

const found_order = await ScheduledOrder.findOne({
        _id: req.params.id,
        userId: req.session.user.id
      });

      if (!found_order) {
        req.flash('error', 'Order not found bruh');
        return res.redirect('/user/orders/list');
      }

      await cancelJob(found_order._id);

      found_order.status = 'cancelled';
      await found_order.save();

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

      const paused_order = await ScheduledOrder.findOne({
        _id: req.params.id,
        userId: req.session.user.id
      });

      if (!paused_order) {
        req.flash('error', 'Order not found');
        return res.redirect('/user/orders/list');
      }

      paused_order.status = 'paused';
      await paused_order.save();
      await cancelJob(paused_order._id);

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

      const resume_order = await ScheduledOrder.findOne({
        _id: req.params.id,
        userId: req.session.user.id
      });

      if (!resume_order) {
        req.flash('error', 'Order not found');
        return res.redirect('/user/orders/list');
      }

      resume_order.status = 'active';
      const nxt_time = resume_order.nextExecutionAt || resume_order.scheduledTime;
      
      if (new Date(nxt_time) > new Date()) {
        await resume_order.save();
        await scheduleOrderJob(resume_order);
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

      const ord_id = req.params.id;
      const exec_history = await OrderExecution.find({ scheduledOrderId: ord_id })
        .sort({ executedAt: -1 });
      
      const order_data = await ScheduledOrder.findById(ord_id);

      res.render('user/orders/executions', { 
        executions: exec_history, 
        order: order_data,
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
