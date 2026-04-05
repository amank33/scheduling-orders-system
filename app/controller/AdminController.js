const User = require('../model/user');
const ScheduledOrder = require('../model/scheduledOrder');
const OrderExecution = require('../model/orderExecution');

class AdminController {
  async adminDashboard(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const totalUsers = await User.countDocuments();
      const total_orders = await ScheduledOrder.countDocuments();
      const totalExec = await OrderExecution.countDocuments();
      const successExec = await OrderExecution.countDocuments({ status: 'success' });
      const failedExec = await OrderExecution.countDocuments({ status: 'failed' });

      const recentRuns = await OrderExecution.find()
        .populate('userId', 'username email')
        .populate('scheduledOrderId', 'productName')
        .sort({ executedAt: -1 })
        .limit(10);

      const stats = {
        total_users: totalUsers,
        total_orders,
        totalExecs: totalExec,
        success: successExec,
        failed: failedExec,
        rate: totalExec > 0 ? ((successExec / totalExec) * 100).toFixed(2) : 0,
      };

      res.render('admin/dashboard', { stats, recentExecutions: recentRuns, user: req.session.user });
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

      const allOrders = await ScheduledOrder.find()
        .populate('userId', 'username email')
        .sort({ createdAt: -1 });

      res.render('admin/orders/list', { orders: allOrders, user: req.session.user });
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

      const pageNum = parseInt(req.query.page) || 1;
      const itemsPerPage = 20;
      const skip = (pageNum - 1) * itemsPerPage;

      const exec_list = await OrderExecution.find()
        .populate('userId', 'username email')
        .populate('scheduledOrderId', 'productName')
        .sort({ executedAt: -1 })
        .skip(skip)
        .limit(itemsPerPage);

      const countAll = await OrderExecution.countDocuments();
      const maxPages = Math.ceil(countAll / itemsPerPage);

      res.render('admin/executions/list', { 
        executions: exec_list, 
        page: pageNum, 
        pages: maxPages,
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

      const allUsers = await User.find().sort({ createdAt: -1 });

      res.render('admin/users/list', { users: allUsers, user: req.session.user });
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

      const userData = await User.findById(req.params.id);
      if (!userData) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/users/list');
      }

      const user_orders = await ScheduledOrder.find({ userId: userData._id }).sort({ createdAt: -1 });
      const user_execs = await OrderExecution.find({ userId: userData._id }).sort({ executedAt: -1 });

      res.render('admin/users/orders', { user: userData, orders: user_orders, executions: user_execs, sessionUser: req.session.user });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading user orders');
      res.redirect('/admin/users/list');
    }
  }
}

module.exports = new AdminController();
