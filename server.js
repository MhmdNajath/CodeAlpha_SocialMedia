const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const { initDb, getPool } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session
const sessionStore = new MySQLStore({
    host: "localhost",
    port: 4306,
    user: "root",
    password: "",
    database: "codealpha_socialmedia",
});

app.use(session({
    store: sessionStore,
    secret: 'social-media-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Make user available in all templates
app.use(async (req, res, next) => {
    res.locals.currentUser = null;
    if (req.session.userId) {
        try {
            const pool = getPool();
            const [rows] = await pool.query('SELECT id, username, display_name, avatar FROM users WHERE id = ?', [req.session.userId]);
            if (rows.length > 0) {
                res.locals.currentUser = rows[0];
            }
        } catch (err) {
            console.error('Session user fetch error:', err);
        }
    }
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    next();
});

// Routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');

app.use('/', authRoutes);
app.use('/', postRoutes);
app.use('/', userRoutes);

// Home redirect
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/feed');
    }
    res.redirect('/login');
});

// 404
app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

// Generic Error Handler (Catches Multer errors & others)
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        req.session.flash = { type: 'error', message: 'File is too large! Maximum allowed size is 50MB.' };
        return req.session.save(() => {
            const referer = req.get('Referrer') || '/feed';
            res.redirect(referer);
        });
    }

    if (err.message === 'Only image files are allowed') {
        req.session.flash = { type: 'error', message: 'Please select a valid image file type.' };
        return req.session.save(() => {
            const referer = req.get('Referrer') || '/feed';
            res.redirect(referer);
        });
    }

    console.error('Unhandled Error:', err);
    res.status(500).send('Internal Server Error');
});

// Initialize database then start server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Social Media Platform connecting to MySQL at http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
});
