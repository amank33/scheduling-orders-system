const express = require('express');
const router = express.Router();

const AuthController = require('../controller/AuthController');

router.get('/auth/login', AuthController.displayLogin);
router.post('/auth/login', AuthController.loginUser);

router.get('/auth/register', AuthController.displayRegister);
router.post('/auth/register', AuthController.registerUser);

router.get('/auth/logout', AuthController.logoutUser);

module.exports = router;
