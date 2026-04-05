const express = require('express');
const router = express.Router();

const UserController = require('../controller/UserController');

const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error', 'Login first');
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/user/dashboard', checkAuth, UserController.userDashboard);

router.get('/user/orders/add', checkAuth, UserController.displayAddForm);
router.post('/user/orders/create', checkAuth, UserController.addOrder);

router.get('/user/orders/list', checkAuth, UserController.listOrders);

router.get('/user/orders/edit/:id', checkAuth, UserController.displayEditForm);
router.post('/user/orders/update/:id', checkAuth, UserController.editOrder);

router.get('/user/orders/delete/:id', checkAuth, UserController.removeOrder);

router.get('/user/orders/pause/:id', checkAuth, UserController.pauseJob);
router.get('/user/orders/resume/:id', checkAuth, UserController.startJob);

router.get('/user/orders/:id/executions', checkAuth, UserController.getHistory);

module.exports = router;
