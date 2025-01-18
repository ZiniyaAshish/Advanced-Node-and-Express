'use strict';
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const bcrypt = require('bcrypt'); // Add this to require bcrypt
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
      // Compare password with the hashed password
      if (!bcrypt.compareSync(password, user.password)) {
        return done(null, false);
      }
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
    showLogin: true,
    showRegistration: true
  });
});

app.route('/login').post(
  passport.authenticate('local', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/profile');
  }
);

// Protected profile route
app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', { username: req.user.username });
});

app.route('/logout')
  .get((req, res) => {
    req.logout();
    res.redirect('/');
  });

app.route('/register')
  .post((req, res, next) => {
    myDataBase.collection('users').findOne({ username: req.body.username }, (err, user) => {
      if (err) {
        console.error("Error finding user:", err);
        return next(err);
      }
      if (user) {
        // User already exists
        console.log("User already exists:", req.body.username);
        return res.redirect('/');
      }

      // Hash the password before saving
      const hash = bcrypt.hashSync(req.body.password, 12);

      // User does not exist, insert new user with hashed password
      myDataBase.collection('users').insertOne({
        username: req.body.username,
        password: hash, // Save hashed password
      }, (err, result) => {
        if (err) {
          console.error("Error inserting user:", err);
          return next(err);
        }

        // Pass the new user document to next middleware
        console.log("User registered successfully:", result.ops[0]);
        return next(null, result.ops[0]);
      });
    });
  },
  passport.authenticate('local', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/profile');
  }
);

app.use((req, res, next) => {
  res.status(404)
    .type('text')
    .send('Not Found');
});

// Middleware to ensure authentication
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Ensure this route is only used if no other routes are matched
app.use('/public', (req, res, next) => {
  console.log(`Static file requested: ${req.url}`);
  next();
}, express.static(process.cwd() + '/public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});