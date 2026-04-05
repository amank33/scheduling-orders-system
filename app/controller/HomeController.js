class HomeController {
  // display home page
  async displayHome(req, res) {
    try {
      const current_user = req.session.user;
      if (current_user) {
        return res.redirect('/user/dashboard');
      }
      // show home page
      res.render('index');
    } catch (err) {
      console.log('homepage error:', err);
      req.flash('error', 'Error on homepage');
      res.render('index');
    }
  }
}

module.exports = new HomeController();
