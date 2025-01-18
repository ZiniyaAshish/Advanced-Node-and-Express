const express = require('express'); // Add this line
const passport = require('passport');
const bcrypt = require('bcrypt');

module.exports = function (app, myDataBase) {
    app.route('/login').post(
        passport.authenticate('local', { failureRedirect: '/' }),
        (req, res) => {
            res.redirect('/profile');
        }
    );

    app.get('/chat', ensureAuthenticated, (req, res) => {
        res.render('chat.pug', { user: req.user });
    });

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

    app.route('/auth/github').get(
        passport.authenticate('github')
    );

    app.route('/auth/github/callback').get(
        passport.authenticate('github', { failureRedirect: '/' }),
        (req, res) => {
            res.redirect('/profile');
        }
    );
}