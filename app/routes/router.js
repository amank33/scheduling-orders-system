const express = require('express');
const router = express.Router();

const HomeController = require('../controller/HomeController');

// home page route
router.get('/', HomeController.displayHome);

module.exports = router;
