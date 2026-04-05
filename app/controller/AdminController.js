const User = require('../model/user');
const ScheduledOrder = require('../model/scheduledOrder');
const OrderExecution = require('../model/orderExecution');

class AdminController {
  async adminDashboard(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const totUsr = await User.countDocuments();
      const totOrds = await ScheduledOrder.countDocuments();
      const totExec = await OrderExecution.countDocuments();
      const sucExec = await OrderExecution.countDocuments({ status: 'success' });
      const failExec = await OrderExecution.countDocuments({ status: 'failed' });

      const recentExecs = await OrderExecution.find()
        .populate('userId', 'username email')
        .populate('scheduledOrderId', 'productName')
        .sort({ executedAt: -1 })
        .limit(10);

      const stats = {
        totalUsers: totUsr,
        totalOrders: totOrds,
        totalExecutions: totExec,
        successfulExecutions: sucExec,
        failedExecutions: failExec,
        successRate: totExec > 0 ? ((sucExec / totExec) * 100).toFixed(2) : 0,
      };

      res.render('admin/dashboard', { stats, recentExecutions: recentExecs, user: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Dashboard error');
      res.redirect('/');
    }
  }

  async viewOrders(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const ordrs = await ScheduledOrder.find()
        .populate('userId', 'username email')
        .sort({ createdAt: -1 });

      res.render('admin/orders/list', { orders: ordrs, user: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading orders');
      res.redirect('/admin/dashboard');
    }
  }

  async viewExecutions(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const pg = parseInt(req.query.page) || 1;
      const lmt = 20;
      const skip = (pg - 1) * lmt;

      const excs = await OrderExecution.find()
        .populate('userId', 'username email')
        .populate('scheduledOrderId', 'productName')
        .sort({ executedAt: -1 })
        .skip(skip)
        .limit(lmt);

      const tot = await OrderExecution.countDocuments();
      const pgs = Math.ceil(tot / lmt);

      res.render('admin/executions/list', { 
        executions: excs, 
        page: pg, 
        pages: pgs,
        user: req.session.user 
      });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading executions');
      res.redirect('/admin/dashboard');
    }
  }

  async viewUsers(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const usrs = await User.find().sort({ createdAt: -1 });

      res.render('admin/users/list', { users: usrs, user: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading users');
      res.redirect('/admin/dashboard');
    }
  }

  async getUserOrders(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const usr = await User.findById(req.params.id);
      if (!usr) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/users/list');
      }

      const ordrs = await ScheduledOrder.find({ userId: usr._id }).sort({ createdAt: -1 });
      const execs = await OrderExecution.find({ userId: usr._id }).sort({ executedAt: -1 });

      res.render('admin/users/orders', { user: usr, orders: ordrs, executions: execs, sessionUser: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading user orders');
      res.redirect('/admin/users/list');
    }
  }
}

module.exports = new AdminController();
