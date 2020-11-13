require('dotenv').config();

// Fix silent errors
'use strict';

// Import web app framework
const express = require('express');

// Import module for database connection
const myDB = require('./connection');

// Import module for FCC tests
const fccTesting = require('./freeCodeCamp/fcctesting.js');

// Import middleware (function for processing a request) for checking previous requests from clients using cookies
const session = require('express-session');

// Import authentication middleware
const passport = require('passport');

// Import and mount modules to obtain the user object from the cookie
const passportSocketIo = require('passport.socketio');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo')(session);
const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });

// Import module for handle requests
const routes = require('./routes.js')

// Import module for authentication
const auth = require('./auth.js')

// Create an Express application
const app = express();

// Import and mount server module
const http = require('http').createServer(app);

// Import and mount realtime framework
const io = require('socket.io')(http);

// Set template engine
app.set('view engine', 'pug');

// Call FCC test
fccTesting(app);

// Enable middleware for static files
app.use('/public', express.static(process.cwd() + '/public'));

// Enable middleware to parse request objects as JSON Object (inbuilt version of body-parser)
app.use(express.json());

// Enable middleware to parse request objects as strings or arrays
app.use(express.urlencoded({ extended: true }));

// Enable middleware for session (to keeps users logged in)
app.use(session({
  key: 'express.sid', 
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  store: store,
  cookie: { secure: false }
}));

// Enable middlewares for authentication
app.use(passport.initialize());
app.use(passport.session());

// Enable middleware for logging of connected users
io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: 'express.sid',
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
  })
);

// Connect app with database
myDB(async (client) => {
  const myDataBase = await client.db('database').collection('users');
  routes(app, myDataBase);
  auth(app, myDataBase);
  // Define variable to keep track of the users
  let currentUsers = 0;
  // Add listener for connections
  io.on('connection', socket => {
    // Increment users
    ++currentUsers;
    // Emit the event
    io.emit('user count', currentUsers);
    console.log('user ' + socket.request.user.name + ' connected');
    // Add listener for disconnections
    socket.on('disconnect', () => {
      // Decrement users
      --currentUsers;
      // Emit the event
      io.emit('user count', currentUsers);
      console.log('A user has disconnected');
    });
  });
}).catch((e) => {
  app.route('/').get((req, res) => {
    res.render('pug', { title: e, message: 'Unable to login' });
  });
});

// Define the success, and fail callback functions
function onAuthorizeSuccess(data, accept) {
  console.log('successful connection to socket.io');

  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept) {
  if (error) throw new Error(message);
  console.log('failed connection to socket.io:', message);
  accept(null, false);
}

http.listen(process.env.PORT || 3000, () => {
  console.log('Listening on port ' + process.env.PORT);
});