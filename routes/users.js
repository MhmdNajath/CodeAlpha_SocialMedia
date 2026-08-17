const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../db/database');

// Multer for profile uploads
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadDir;
        if (file.fieldname === 'cover_image') {
            uploadDir = path.join(__dirname, '..', 'uploads', 'covers');
        } else {
            uploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
        }
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const prefix = file.fieldname === 'cover_image' ? 'cover-' : 'avatar-';
        cb(null, prefix + req.session.userId + '-' + Date.now() + path.extname(file.originalname));
    }
});
const uploadProfile = multer({
    storage: profileStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
        cb(new Error('Only image files are allowed'));
    }
});

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        req.session.flash = { type: 'error', message: 'Please login to continue' };
        return res.redirect('/login');
    }
    next();
}

// GET /profile/:username
router.get('/profile/:username', requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.userId;
        const pool = getPool();
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [req.params.username]);

        if (users.length === 0) {
            return res.status(404).render('404', { title: 'User Not Found' });
        }

        const user = users[0];

        // Get user's posts
        const [posts] = await pool.query(`
            SELECT p.*, u.username, u.display_name, u.avatar,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
        `, [currentUserId, user.id]);

        // Stats
        const [fC] = await pool.query('SELECT COUNT(*) as count FROM followers WHERE following_id = ?', [user.id]);
        const followerCount = fC[0].count;

        const [fgC] = await pool.query('SELECT COUNT(*) as count FROM followers WHERE follower_id = ?', [user.id]);
        const followingCount = fgC[0].count;

        const [pC] = await pool.query('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [user.id]);
        const postCount = pC[0].count;

        // Check if current user follows this user
        const [isF] = await pool.query('SELECT id FROM followers WHERE follower_id = ? AND following_id = ?', [currentUserId, user.id]);
        const isFollowing = isF.length > 0;

        const isOwnProfile = currentUserId === user.id;

        // Don't send password to template
        delete user.password;

        res.render('profile', {
            title: `${user.display_name || user.username}'s Profile`,
            profileUser: user,
            posts,
            followerCount,
            followingCount,
            postCount,
            isFollowing,
            isOwnProfile
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST /follow/:id - Toggle follow
router.post('/follow/:id', requireAuth, async (req, res) => {
    try {
        const followingId = parseInt(req.params.id);
        const followerId = req.session.userId;
        const pool = getPool();

        if (followerId === followingId) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }

        const [existing] = await pool.query('SELECT id FROM followers WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);

        if (existing.length > 0) {
            await pool.query('DELETE FROM followers WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
        } else {
            await pool.query('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [followerId, followingId]);
        }

        const [fC] = await pool.query('SELECT COUNT(*) as count FROM followers WHERE following_id = ?', [followingId]);
        const followerCount = fC[0].count;
        const isFollowing = existing.length === 0;

        res.json({ success: true, followerCount, isFollowing });
    } catch (err) {
        console.error(err);
        res.json({ error: 'Failed' });
    }
});

// POST /profile/update - Edit profile
router.post('/profile/update', requireAuth, uploadProfile.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover_image', maxCount: 1 }]), async (req, res) => {
    try {
        const userId = req.session.userId;
        const { display_name, bio, location, website } = req.body;
        const pool = getPool();

        let avatarPath = undefined;
        let coverImagePath = undefined;

        if (req.files) {
            if (req.files.avatar && req.files.avatar.length > 0) {
                avatarPath = `/uploads/avatars/${req.files.avatar[0].filename}`;
            }
            if (req.files.cover_image && req.files.cover_image.length > 0) {
                coverImagePath = `/uploads/covers/${req.files.cover_image[0].filename}`;
            }
        }

        const updates = ['display_name = ?', 'bio = ?', 'location = ?', 'website = ?'];
        const values = [display_name || '', bio || '', location || '', website || ''];

        if (avatarPath) {
            updates.push('avatar = ?');
            values.push(avatarPath);
        }

        if (coverImagePath) {
            updates.push('cover_image = ?');
            values.push(coverImagePath);
        }

        values.push(userId); // for WHERE id = ?
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

        await pool.query(query, values);

        const [u] = await pool.query('SELECT username FROM users WHERE id = ?', [userId]);
        req.session.flash = { type: 'success', message: 'Profile updated!' };
        req.session.save(() => {
            res.redirect(`/profile/${u[0].username}`);
        });
    } catch (err) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Update failed' };
        res.redirect(`/feed`);
    }
});

// GET /profile/:username/followers
router.get('/profile/:username/followers', requireAuth, async (req, res) => {
    try {
        const pool = getPool();
        const [users] = await pool.query('SELECT id, username FROM users WHERE username = ?', [req.params.username]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const [followers] = await pool.query(`
            SELECT u.id, u.username, u.display_name, u.avatar, u.bio
            FROM followers f
            JOIN users u ON f.follower_id = u.id
            WHERE f.following_id = ?
        `, [users[0].id]);

        res.json({ success: true, followers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /profile/:username/following
router.get('/profile/:username/following', requireAuth, async (req, res) => {
    try {
        const pool = getPool();
        const [users] = await pool.query('SELECT id, username FROM users WHERE username = ?', [req.params.username]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const [following] = await pool.query(`
            SELECT u.id, u.username, u.display_name, u.avatar, u.bio
            FROM followers f
            JOIN users u ON f.following_id = u.id
            WHERE f.follower_id = ?
        `, [users[0].id]);

        res.json({ success: true, following });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
