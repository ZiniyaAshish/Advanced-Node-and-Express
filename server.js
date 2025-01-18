'use strict';
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const myDB = require('./connection.js');
const { ObjectID } = require('mongodb');
const fccTesting = require('./freeCodeCamp/fcctesting.js');

const app = express();

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

app.set('view engine', 'pug');
app.set('views', './views/pug');

const LocalStrategy = require('passport-local');

myDB(async (client) => {
  const myDataBase = await client.db('test');

  passport.use(new LocalStrategy((username, password, done) => {
    myDataBase.findOne({ username: username }, (err, user) => {
      console.log(`User ${username} attempted to log in.`);
      if (err) return done(err);
      if (!user) return done(null, false);
      if (password !== user.password) return done(null, false);
      return done(null, user);
    });
  }));

  app.route('/').get((req, res) => {
    res.render('index', {
      title: 'Connected to Database',
      message: 'Please login'
    });
  });

  // Serialization and deserialization here...
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser((id, done) => {
    myDataBase.collection('users').findOne({ _id: new ObjectID(id) }, (err, doc) => {
      if (err) {
        console.error(err);
        return done(err, null);
      }
      done(null, doc);
    });
  });
}).catch(e => {
  console.error('Database connection failed:', e);
  app.route('/').get((req, res) => {
    res.render('index', { title: e.message, message: 'Unable to connect to database' });
  });
});

app.route('/').get((req, res) => {
  res.render('index', {
    title: 'Connected to Database',
    message: 'Please login',
    showLogin: true
  });
});

app.route('/login').post(
  passport.authenticate('local', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/profile');
  }
);

// Middleware to ensure authentication
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Protected profile route
app.get('/profile', (req, res) => {
  if (req.isAuthenticated()) {
      res.render('profile', { username: req.user.username });
  } else {
      res.redirect('/');
  }
});

// Ensure this route is only used if no other routes are matched
app.use('/public', (req, res, next) => {
  console.log(`Static file requested: ${req.url}`);
  next();
}, express.static(process.cwd() + '/public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});
