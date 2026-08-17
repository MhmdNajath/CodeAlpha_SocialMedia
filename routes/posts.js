const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../db/database');

// Multer config for post images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'posts');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
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

// GET /feed
router.get('/feed', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const pool = getPool();

        // Get posts from people the user follows + own posts
        const [posts] = await pool.query(`
            SELECT p.*, u.username, u.display_name, u.avatar,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
              OR p.user_id IN (SELECT following_id FROM followers WHERE follower_id = ?)
            ORDER BY p.created_at DESC
            LIMIT 50
        `, [userId, userId, userId]);

        // Suggested users (not followed and not self)
        const [suggestedUsers] = await pool.query(`
            SELECT u.*, 
              (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as follower_count
            FROM users u
            WHERE u.id != ?
              AND u.id NOT IN (SELECT following_id FROM followers WHERE follower_id = ?)
            ORDER BY follower_count DESC
            LIMIT 5
        `, [userId, userId]);

        res.render('feed', { title: 'Feed', posts, suggestedUsers });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST /posts - Create new post
router.post('/posts', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.session.userId;
        const pool = getPool();

        if (!content || content.trim().length === 0) {
            req.session.flash = { type: 'error', message: 'Post content cannot be empty' };
            return res.redirect('/feed');
        }

        const image = req.file ? `/uploads/posts/${req.file.filename}` : '';
        await pool.query('INSERT INTO posts (user_id, content, image) VALUES (?, ?, ?)', [userId, content.trim(), image]);

        req.session.flash = { type: 'success', message: 'Post created!' };
        req.session.save(() => {
            res.redirect('/feed');
        });
    } catch (err) {
        console.error(err);
        req.session.flash = { type: 'error', message: 'Failed to create post' };
        res.redirect('/feed');
    }
});

// POST /posts/:id/like - Toggle like
router.post('/posts/:id/like', requireAuth, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const userId = req.session.userId;
        const pool = getPool();

        const [existingLike] = await pool.query('SELECT id FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId]);

        if (existingLike.length > 0) {
            await pool.query('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
        } else {
            await pool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
        }

        const [lC] = await pool.query('SELECT COUNT(*) as count FROM likes WHERE post_id = ?', [postId]);
        const likeCount = lC[0].count;
        const isLiked = existingLike.length === 0 ? 1 : 0;

        res.json({ success: true, likeCount, isLiked });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /posts/:id/comments - Add comment
router.post('/posts/:id/comments', requireAuth, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const userId = req.session.userId;
        const { content } = req.body;
        const pool = getPool();

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }

        await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [postId, userId, content.trim()]);

        const [users] = await pool.query('SELECT username, display_name, avatar FROM users WHERE id = ?', [userId]);
        const user = users[0];

        const [cC] = await pool.query('SELECT COUNT(*) as count FROM comments WHERE post_id = ?', [postId]);
        const commentCount = cC[0].count;

        res.json({
            success: true,
            commentCount,
            comment: {
                content: content.trim(),
                username: user.username,
                display_name: user.display_name,
                avatar: user.avatar,
                created_at: 'Just now'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /posts/:id/comments - Get comments for a post
router.get('/posts/:id/comments', requireAuth, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const pool = getPool();
        const [comments] = await pool.query(`
            SELECT c.*, u.username, u.display_name, u.avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `, [postId]);

        res.json({ success: true, comments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// DELETE /posts/:id
router.delete('/posts/:id', requireAuth, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const userId = req.session.userId;
        const pool = getPool();

        const [posts] = await pool.query('SELECT * FROM posts WHERE id = ? AND user_id = ?', [postId, userId]);
        if (posts.length === 0) return res.status(403).json({ error: 'Not authorized' });

        const post = posts[0];
        // Delete image if exists
        if (post.image) {
            const imagePath = path.join(__dirname, '..', post.image);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }

        await pool.query('DELETE FROM posts WHERE id = ?', [postId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /explore - All posts
router.get('/explore', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const pool = getPool();

        const [posts] = await pool.query(`
            SELECT p.*, u.username, u.display_name, u.avatar,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 50
        `, [userId]);

        res.render('explore', { title: 'Explore', posts });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
