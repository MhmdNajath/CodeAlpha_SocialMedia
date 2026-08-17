const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool;

async function initDb() {
    try {
        // Connect to create database if not exists
        const initConn = await mysql.createConnection({
            host: 'localhost',
            port: 4306,
            user: 'root',
            password: ''
        });

        await initConn.query('CREATE DATABASE IF NOT EXISTS codealpha_socialmedia');
        await initConn.end();

        // Create the connection pool
        pool = mysql.createPool({
          host: "localhost",
          port: 4306,
          user: "root",
          password: "",
          database: "codealpha_socialmedia",
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
        });

        console.log('Connected to MySQL database.');

        await createSchema();
        await seedDemoData();

        return pool;
    } catch (err) {
        console.error('MySQL database connection failed:', err);
        throw err;
    }
}

async function createSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            display_name VARCHAR(255) DEFAULT '',
            bio TEXT,
            avatar VARCHAR(255) DEFAULT '/uploads/default-avatar.png',
            cover_image VARCHAR(255) DEFAULT '',
            location VARCHAR(255) DEFAULT '',
            website VARCHAR(255) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            content TEXT NOT NULL,
            image VARCHAR(255) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            post_id INT NOT NULL,
            user_id INT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS likes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            post_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_like (post_id, user_id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS followers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            follower_id INT NOT NULL,
            following_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_follow (follower_id, following_id)
        )
    `);
}

async function seedDemoData() {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
        console.log('Seeding demo data...');
        const pass = await bcrypt.hash('password123', 10);

        const [u1] = await pool.query('INSERT INTO users (username, email, password, display_name, bio, location) VALUES (?, ?, ?, ?, ?, ?)',
            ['john_doe', 'john@example.com', pass, 'John Doe', 'Full-stack developer passionate about building cool things 🚀', 'San Francisco, CA']);
        const [u2] = await pool.query('INSERT INTO users (username, email, password, display_name, bio, location) VALUES (?, ?, ?, ?, ?, ?)',
            ['jane_smith', 'jane@example.com', pass, 'Jane Smith', 'Designer & photographer. Creating beautiful things ✨', 'New York, NY']);
        const [u3] = await pool.query('INSERT INTO users (username, email, password, display_name, bio, location) VALUES (?, ?, ?, ?, ?, ?)',
            ['alex_dev', 'alex@example.com', pass, 'Alex Developer', 'Open source enthusiast. Coffee addict ☕', 'London, UK']);

        const id1 = u1.insertId;
        const id2 = u2.insertId;
        const id3 = u3.insertId;

        const [p1] = await pool.query('INSERT INTO posts (user_id, content) VALUES (?, ?)', [id1, 'Just launched my new portfolio website! Check it out and let me know what you think. 🎉 #webdev #coding']);
        const [p2] = await pool.query('INSERT INTO posts (user_id, content) VALUES (?, ?)', [id2, 'Beautiful sunset photography session today. Nature never disappoints! 🌅 #photography #nature']);
        const [p3] = await pool.query('INSERT INTO posts (user_id, content) VALUES (?, ?)', [id3, 'Just contributed to my 100th open source project! The community is amazing. 💻 #opensource #milestone']);
        const [p4] = await pool.query('INSERT INTO posts (user_id, content) VALUES (?, ?)', [id1, 'Learning TypeScript has been a game changer for my projects. Strongly recommend it! 📚 #typescript #learning']);
        const [p5] = await pool.query('INSERT INTO posts (user_id, content) VALUES (?, ?)', [id2, 'New design system coming together nicely. Clean, minimal, and accessible. ♿ #design #ui #ux']);

        const pid1 = p1.insertId;
        const pid2 = p2.insertId;
        const pid3 = p3.insertId;
        const pid4 = p4.insertId;
        const pid5 = p5.insertId;

        await pool.query('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [id1, id2]);
        await pool.query('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [id1, id3]);
        await pool.query('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [id2, id1]);
        await pool.query('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [id3, id1]);
        await pool.query('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [id3, id2]);

        await pool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [pid1, id2]);
        await pool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [pid1, id3]);
        await pool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [pid2, id1]);
        await pool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [pid3, id1]);
        await pool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [pid3, id2]);
        await pool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [pid4, id3]);
        await pool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [pid5, id1]);

        await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [pid1, id2, 'Looks amazing! Great work! 🔥']);
        await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [pid1, id3, 'Super clean design, love it!']);
        await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [pid2, id1, 'Stunning photo! Where was this taken?']);
        await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [pid3, id1, "Congratulations! That's an incredible milestone! 🎉"]);
        await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [pid3, id2, 'So inspiring! Keep it up!']);

        console.log('✅ Demo data seeded successfully');
    }
}

module.exports = { initDb, getPool: () => pool };
