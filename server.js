'use strict';
require('dotenv').config();
const express = require('express');
const app = express();
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const passport = require('passport');
const http = require('http').createServer(app); // Create HTTP server
const io = require('socket.io')(http);
const bcrypt = require('bcrypt'); // Add this to require bcrypt
const myDB = require('./connection.js');
const routes = require('./routes.js');
const { ObjectID } = require('mongodb');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const passportSocketIo = require('passport.socketio');
const cookieParser = require('cookie-parser');

const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });

fccTesting(app);
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());

app.set('view engine', 'pug');
app.set('views', './views/pug');

app.route('/').get((req, res) => {
  res.render('index', {
    title: 'Connected to Database',
    message: 'Please login',
    showLogin: true,
    showRegistration: true
  });
});

const LocalStrategy = require('passport-local');
const auth = require('./auth.js');

let currentUsers = 0;

myDB(async (client) => {
  const myDataBase = await client.db('test');

  function onAuthorizeSuccess(data, accept) {
    console.log('successful connection to socket.io');

    accept(null, true);
  }

  function onAuthorizeFail(data, message, error, accept) {
    if (error) throw new Error(message);
    console.log('failed connection to socket.io:', message);
    accept(null, false);
  }

  auth(app, myDataBase);
  routes(app, (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
  });

  io.on('connection', socket => {
    console.log('A user has connected');
    console.log('user ' + socket.request.user.username + ' connected'); // Log the connected user's username

    ++currentUsers; // Increment user count

    io.emit('user', {
      username: socket.request.user.username,
      currentUsers,
      connected: true
    });

    socket.on('chat message', (message) => {
      // Emit the 'chat message' event to all clients with username and message
      io.emit('chat message', {
        username: socket.request.user.username,
        message: message
      });
    });

    // Listen for disconnect event
    socket.on('disconnect', () => {
      console.log('A user has disconnected');
      --currentUsers; // Decrease user count
      io.emit('user count', currentUsers); // Emit the updated user count to all clients
    });
  });

  io.use(
    passportSocketIo.authorize({
      cookieParser: cookieParser, // Use cookieParser for reading cookies
      key: 'express.sid', // The name of the session cookie
      secret: process.env.SESSION_SECRET, // Session secret for signing cookies
      store: store, // Use MongoStore session store
      success: onAuthorizeSuccess, // Success callback
      fail: onAuthorizeFail // Failure callback
    })
  );

  app.use(session({
    secret: process.env.SESSION_SECRET, // Use your session secret here
    resave: false, // Don't resave sessions if not modified
    saveUninitialized: false, // Don't save uninitialized sessions
    store: store, // Use MongoStore session store
    cookie: { secure: process.env.NODE_ENV === 'production' } // Use secure cookies in production
  }));
}).catch(e => {
  console.error('Database connection failed:', e);
  app.route('/').get((req, res) => {
    res.render('index', { title: e.message, message: 'Unable to connect to database' });
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});