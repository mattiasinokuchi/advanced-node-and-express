// Import authentication middleware
const passport = require('passport');

// Import module for authentication with local strategy (username and password) 
const LocalStrategy = require('passport-local');

// Import module for authentication with GitHub strategy
const GitHubStrategy = require('passport-github').Strategy;

// Import module for comparing hashed passwords
const bcrypt = require('bcrypt');

// Define constructor for user id
const ObjectID = require('mongodb').ObjectID;

// Export module for authentication
module.exports = function (app, myDataBase) {

  // Define how to authenticate someone locally (at login or register)...
  passport.use(new LocalStrategy(
    function (username, password, done) {
      // ...try to find the user in the database...
      console.log('passport.use =>');
      myDataBase.findOne({ username: username }, function (err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false); }
        // ...compare the passwords...
        if (!bcrypt.compareSync(password, user.password)) {
          // ...don't pass if the password don't match...
          return done(null, false);
        }
        // ...or pass the user through passport.serializeUser if the password match
        return done(null, user);
      });
    }
  ));

  // Define how to authenticate someone using GitHub (at login or register)...
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: 'https://advanced-node-and-express-1.mattiasinokuchi.repl.co/auth/github/callback'
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    // Search for an object and update it
    myDataBase.findOneAndUpdate(
      { id: profile.id },
      {
        $setOnInsert: {
          id: profile.id,
          name: profile.displayName || 'John Doe',
          photo: profile.photos[0].value || '',
          email: Array.isArray(profile.emails)
            ? profile.emails[0].value
            : 'No public email',
          created_on: new Date(),
          provider: profile.provider || ''
        },
        $set: {
          last_login: new Date()
        },
        $inc: {
          login_count: 1
        }
      },
      { upsert: true, new: true },
      (err, doc) => {
        return cb(null, doc.value);
      }
    );
  })
);

  // Saves _id from the user object in the session (at register or login)...
  passport.serializeUser((user, done) => {
    // ...then passes back to passport.authenticate (at register) or passport.session finds _id in the session (request is authenticated) and invokes passport.deserializeUser below (at login)...
    console.log('passport.serializeUser =>');
    done(null, user._id);
  });

  // ...user object for _id saved in the session is attached to the request on every request (register, login or logout)...
  passport.deserializeUser((id, done) => {
    console.log('passport.deserializeUser =>');
    myDataBase.findOne({ _id: new ObjectID(id) }, (err, doc) => {
      if (err) return console.error(err);
      // ...redirects to profile page through ensureAuthenticated (at register or login) or straight to the home page (at logout)
      done(null, doc);
    });
  });
}