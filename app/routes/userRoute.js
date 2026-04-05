const express = require('express');
const router = express.Router();

const UserController = require('../controller/UserController');

// middleware to check if user is logged in
const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error', 'Login first');
    return res.redirect('/auth/login');
  }
  next();
};

// user dashboard
router.get('/user/dashboard', checkAuth, UserController.userDashboard);

// create order
router.get('/user/orders/add', checkAuth, UserController.displayAddForm);
router.post('/user/orders/create', checkAuth, UserController.addOrder);

// list orders
router.get('/user/orders/list', checkAuth, UserController.listOrders);

// edit order
router.get('/user/orders/edit/:id', checkAuth, UserController.displayEditForm);
router.post('/user/orders/update/:id', checkAuth, UserController.editOrder);

// delete/cancel
router.get('/user/orders/delete/:id', checkAuth, UserController.removeOrder);

// pause and resume
router.get('/user/orders/pause/:id', checkAuth, UserController.pauseJob);
router.get('/user/orders/resume/:id', checkAuth, UserController.startJob);

// view execution history
router.get('/user/orders/:id/executions', checkAuth, UserController.getHistory);

module.exports = router;
