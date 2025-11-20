const db = require("../db");

class OrderItem {

    static addItem(orderId, productId, quantity, price) {
        return new Promise((resolve, reject) => {
            db.query(
                "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
                [orderId, productId, quantity, price],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    static getItemsByOrder(orderId) {
        return new Promise((resolve, reject) => {
            db.query(
                `SELECT order_items.*, products.productName, products.image
                 FROM order_items
                 JOIN products ON order_items.product_id = products.id
                 WHERE order_id = ?`,
                [orderId],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
    }
}

module.exports = OrderItem;
