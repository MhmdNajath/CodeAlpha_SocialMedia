const mysql = require('mysql2/promise');
const passwords = ['', 'root', 'password', 'admin', '123456', 'mysql', 'root123', 'pass123', 'deat99p'];
async function test() {
    for (const p of passwords) {
        try {
            const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: p });
            console.log('SUCCESS with password:', p === '' ? '<empty>' : p);
            await conn.end();
            return;
        } catch(e) {}
    }
    console.log('None worked');
}
test();
