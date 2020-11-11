// Import authentication middleware
const passport = require('passport');

// Import module for hashing password
const bcrypt = require('bcrypt');

// Export module for routes
module.exports = function (app, myDataBase) {
  
  // Route for requests to home page
  app.route('/').get((req, res) => {
    console.log('app.route("/")');
    res.render('pug', {
      title: 'Connected to Database',
      message: 'Please login',
      showLogin: true,
      showRegistration: true,
      showSocialAuth: true
    });
  });

  // Route for request to authenticate on GitHub
  app.route('/auth/github').get(passport.authenticate('github'));

  // Route for callback from GitHub
  app.route('/auth/github/callback').get(passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
    req.session.user_id = req.user.id;
    // ...then redirects to profile page through ensureAuthenticated if successful
    res.redirect('/chat');
  });

  // Route for request to chat page
  app.route('/chat').get(ensureAuthenticated, (req, res) => {
    console.log('app.route("/chat") =>');
    res.render('pug/chat', { user: req.user });
  });

  // Route for request to login passes user through passport.use...
  app.route('/login').post(passport.authenticate('local', { failureRedirect: '/' }), (req, res) => {
    // ...then redirects to profile page through ensureAuthenticated if successful
    res.redirect('/profile');
  });

  // Route for request to profile page
  app.route('/profile').get(ensureAuthenticated, (req, res) => {
    console.log('app.route("/profile") =>');
    res.render('pug/profile', { username: req.user.username });
  });

  // Route for request to logout
  app.route('/logout').get((req, res) => {
    // ...redirects to home page (through passport.deserializeUser)
    console.log('app.route("/logout")');
    req.logout();
    res.redirect('/');
  });

  // Route for request to register...
  app.route('/register').post((req, res, next) => {
    console.log('app.route.("/register") =>');
    // ...salts and hashes the password...
    const hash = bcrypt.hashSync(req.body.password, 12);
    // ...search for the usernamn in the database...
    myDataBase.findOne({ username: req.body.username }, function (err, user) {
      if (err) {
        next(err);
      } else if (user) {
        // ...redirects to home page if username is already present...
        res.redirect('/');
      } else {
        // ...or inserts the username with the salted and hashed password...
        myDataBase.insertOne({ username: req.body.username, password: hash }, (err, doc) => {
          if (err) {
            res.redirect('/');
          } else {
            // ...then pass user down to passport.authenticate...
            next(null, doc.ops[0]);
          }
        });
      }
    });
  },
  // ...which will call req.login (a function attached to the request which will call passport.serializeUser) or redirect to home page...
  passport.authenticate('local', { failureRedirect: '/' }),
  (req, res, next) => {
    console.log('passport.authenticate =>');
    // ...I'm back from passport.serializeUser and success!...now I will get passed through passport.deserializeUser and ensureAuthenicated before I'm redirected to the profile page
    res.redirect('/profile');
  });

  // Displays error for missing routes
  app.use((req, res, next) => {
    res.status(404).type('text').send('Not Found');
  });
}

// Check if user is authenticated in the session...
function ensureAuthenticated(req, res, next) {
  console.log('ensureAuthenticated =>');
  if (req.isAuthenticated()) {
    // ...and pass authenticated user to the profile page...
    return next();
  }
  // ...or redirects to home page if user is not
  res.redirect('/');
}