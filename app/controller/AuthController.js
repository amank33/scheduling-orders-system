const User = require('../model/user');
const Joi = require('joi');

// registration validation schema
const regSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().allow('').max(100).optional(),
  phone: Joi.string().allow('').optional(),
});

// login validation schema
const logSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

class AuthController {
  // show login page
  async displayLogin(req, res) {
    try {
      res.render('auth/login', { errors: null });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading login page');
      res.redirect('/');
    }
  }

  // handle user login
  async loginUser(req, res) {
    try {
      const { username, password } = req.body;
      const { error } = logSchema.validate({ username, password }, { abortEarly: false });

      if (error) {
        const errs = {};
        error.details.forEach(e => {
          errs[e.context.key] = e.message;
        });
        return res.render('auth/login', { errors: errs });
      }

      // find user by username or email
      const usr = await User.findOne({ 
        $or: [{ username }, { email: username }] 
      });

      if (!usr || usr.password !== password) {
        return res.render('auth/login', { 
          errors: { password: 'Wrong Credentials' }
        });
      }

      if (!usr.isActive) {
        return res.render('auth/login', { 
          errors: { username: 'Account is disabled' }
        });
      }

      req.session.user = {
        id: usr._id,
        username: usr.username,
        email: usr.email,
        fullName: usr.fullName,
      };

      req.flash('success', `Welcome back ${usr.username}!`);
      res.redirect('/user/dashboard');

    } catch (err) {
      console.log(err);
      req.flash('error', 'Login error');
      res.redirect('/auth/login');
    }
  }

  // show registration page
  async displayRegister(req, res) {
    try {
      res.render('auth/register', { errors: null, old: {} });
    } catch (err) {
      console.log(err);
      req.flash('error', 'Error loading register page');
      res.redirect('/');
    }
  }

  // handle user registration
  async registerUser(req, res) {
    try {
      const { username, email, password, fullName, phone } = req.body;
      const { error } = regSchema.validate(req.body, { abortEarly: false });

      if (error) {
        const validateErrs = {};
        error.details.forEach(err => {
          validateErrs[err.context.key] = err.message;
        });
        return res.render('auth/register', { errors: validateErrs, old: req.body });
      }

      // check if user already exists
      const existUser = await User.findOne({ 
        $or: [{ username }, { email }] 
      });

      if (existUser) {
        const dupErr = {};
        if (existUser.username === username) {
          dupErr.username = 'Username already taken';
        }
        if (existUser.email === email) {
          dupErr.email = 'Email already in use';
        }
        return res.render('auth/register', { errors: dupErr, old: req.body });
      }

      const newUsr = await User.create({
        username,
        email,
        password,
        fullName: fullName || username,
        phone: phone || '',
      });

      req.session.user = {
        id: newUsr._id,
        username: newUsr.username,
        email: newUsr.email,
        fullName: newUsr.fullName,
      };

      req.flash('success', 'Username created successfully');
      res.redirect('/user/dashboard');

    } catch (err) {
      console.log(err);
      req.flash('error', 'Registration error');
      res.redirect('/auth/register');
    }
  }

  // logout user
  async logoutUser(req, res) {
    try {
      req.session.destroy((err) => {
        if (err) {
          return res.redirect('/user/dashboard');
        }
        // user logged out
        res.redirect('/');
      });
    } catch (err) {
      console.log('logout error:', err);
      res.redirect('/');
    }
  }
}

module.exports = new AuthController();
