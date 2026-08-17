const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getPool } = require('../db/database');

// GET /login
router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/feed');
    res.render('login', { title: 'Login' });
});

// GET /register
router.get('/register', (req, res) => {
    if (req.session.userId) return res.redirect('/feed');
    res.render('register', { title: 'Register' });
});

// POST /register
router.post('/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
        req.session.flash = { type: 'error', message: 'All fields are required' };
        return res.redirect('/register');
    }

    if (password !== confirmPassword) {
        req.session.flash = { type: 'error', message: 'Passwords do not match' };
        return res.redirect('/register');
    }

    if (password.length < 6) {
        req.session.flash = { type: 'error', message: 'Password must be at least 6 characters' };
        return res.redirect('/register');
    }

    if (username.length < 3 || username.length > 20) {
        req.session.flash = { type: 'error', message: 'Username must be 3-20 characters' };
        return res.redirect('/register');
    }

    try {
        const pool = getPool();

        // Check existing user
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username.toLowerCase(), email.toLowerCase()]
        );

        if (existing.length > 0) {
            req.session.flash = { type: 'error', message: 'Username or email already exists' };
            return res.redirect('/register');
        }

        // Create user
        const hashedPassword = bcrypt.hashSync(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)',
            [username.toLowerCase(), email.toLowerCase(), hashedPassword, username]
        );

        req.session.userId = result.insertId;
        req.session.flash = { type: 'success', message: 'Welcome to the community!' };
        req.session.save(() => {
            res.redirect('/feed');
        });
    } catch (err) {
        console.error('Registration error:', err);
        req.session.flash = { type: 'error', message: 'Something went wrong' };
        res.redirect('/register');
    }
});

// POST /login
router.post('/login', async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        req.session.flash = { type: 'error', message: 'All fields are required' };
        return res.redirect('/login');
    }

    try {
        const pool = getPool();
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [login.toLowerCase(), login.toLowerCase()]
        );

        const user = users[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            req.session.flash = { type: 'error', message: 'Invalid credentials' };
            return res.redirect('/login');
        }

        req.session.userId = user.id;
        req.session.flash = { type: 'success', message: `Welcome back, ${user.display_name || user.username}!` };
        req.session.save(() => {
            res.redirect('/feed');
        });
    } catch (err) {
        console.error('Login error:', err);
        req.session.flash = { type: 'error', message: 'Something went wrong' };
        res.redirect('/login');
    }
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

module.exports = router;
