const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();

const app = express();

// connect database
const dbCon = require('./app/config/db');
dbCon();

// initialize job queue for scheduled orders
const { initQueue } = require('./app/jobs/scheduleQueue');
initQueue();

// middlewares setup
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/', express.static('./public/'));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// session and flash message setup
app.use(session({ 
  secret: process.env.SESSION_SECRET || 'sos_secret', 
  resave: false, 
  saveUninitialized: false 
}));

app.use(flash());

// middleware to add session user and messages to all views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// import routes
const routes = require('./app/routes/router');
const authRoute = require('./app/routes/authRoute');
const userRoute = require('./app/routes/userRoute');
const adminRoute = require('./app/routes/adminRoute');

// use routes
app.use(routes);
app.use(authRoute);
app.use(userRoute);
app.use(adminRoute);

const PORT = process.env.PORT || 4007;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
