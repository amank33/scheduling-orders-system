const express = require('express');
const router = express.Router();

const AdminController = require('../controller/AdminController');

const authMiddleware = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error', 'Please login first');
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/admin/dashboard', authMiddleware, AdminController.adminDashboard);

router.get('/admin/orders/list', authMiddleware, AdminController.viewOrders);

router.get('/admin/executions/list', authMiddleware, AdminController.viewExecutions);

router.get('/admin/users/list', authMiddleware, AdminController.viewUsers);
router.get('/admin/users/:id/orders', authMiddleware, AdminController.getUserOrders);

module.exports = router;
