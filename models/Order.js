const db = require("../db");

class Order {

    static createOrder(userId, total) {
        return new Promise((resolve, reject) => {
            db.query(
                "INSERT INTO orders (user_id, total) VALUES (?, ?)",
                [userId, total],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result.insertId);
                }
            );
        });
    }

    static getUserOrders(userId) {
        return new Promise((resolve, reject) => {
            db.query(
                "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
                [userId],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
    }
}

module.exports = Order;
