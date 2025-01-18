const passport = require('passport');
const LocalStrategy = require('passport-local');
const GitHubStrategy = require('passport-github').Strategy;
const bcrypt = require('bcrypt');
const { ObjectID } = require('mongodb');
require('dotenv').config();

module.exports = function (app, myDataBase) {
    // Local strategy
    passport.use(new LocalStrategy((username, password, done) => {
        myDataBase.findOne({ username: username }, (err, user) => {
            console.log(`User ${username} attempted to log in.`);
            if (err) return done(err);
            if (!user) return done(null, false);
            if (!bcrypt.compareSync(password, user.password)) {
                return done(null, false);
            }
            return done(null, user);
        });
    }));

    // GitHub strategy
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
    }, 
    (accessToken, refreshToken, profile, cb) => {
        console.log(profile); // Debugging to ensure profile is received

        // Find or create user
        myDataBase.findOneAndUpdate(
            { id: profile.id }, // Search by GitHub id
            {
                $setOnInsert: {
                    id: profile.id,
                    username: profile.username,
                    name: profile.displayName || 'John Doe',
                    photo: profile.photos?.[0]?.value || '',
                    email: Array.isArray(profile.emails) ? profile.emails[0].value : 'No public email',
                    created_on: new Date(),
                    provider: profile.provider || '',
                },
                $set: {
                    last_login: new Date(),
                },
                $inc: {
                    login_count: 1,
                },
            },
            { upsert: true, returnDocument: 'after' },
            (err, doc) => {
                if (err) {
                    console.error('Error during database operation:', err);
                    return cb(err, null);
                }
                return cb(null, doc.value); // Return the user object
            }
        );
    }));

    app.route('/').get((req, res) => {
        res.render('index', {
            title: 'Connected to Database',
            message: 'Please login'
        });
    });

    // Serialization and deserialization
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
};
