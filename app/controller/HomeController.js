class HomeController {
  async displayHome(req, res) {
    try {
      const usr = req.session.user;
      if (usr) {
        return res.redirect('/user/dashboard');
      }
      res.render('index');
    } catch (e) {
      console.log('error:', e);
      req.flash('error', 'Home page error');
      res.render('index');
    }
  }
}

module.exports = new HomeController();
