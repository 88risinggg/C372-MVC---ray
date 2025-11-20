const db = require("../db");

class User {

    static findByEmail(email) {
        return new Promise((resolve, reject) => {
            db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
                if (err) reject(err);
                else resolve(result[0]);
            });
        });
    }

    static create(username, email, password, address, contact) {
        return new Promise((resolve, reject) => {
            db.query(
                "INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, 'user')",
                [username, email, password, address, contact],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result.insertId);
                }
            );
        });
    }
}

module.exports = User;