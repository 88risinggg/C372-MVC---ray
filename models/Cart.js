const db = require("../db");

class Cart {

    static getUserCart(userId) {
        return new Promise((resolve, reject) => {
            db.query(
                `SELECT cart.id AS cartId, products.productName, products.image, 
                        products.price, cart.quantity
                 FROM cart
                 JOIN products ON cart.product_id = products.id
                 WHERE cart.user_id = ?`,
                [userId],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
    }

    static addItem(userId, productId) {
        return new Promise((resolve, reject) => {
            db.query(
                "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, 1)",
                [userId, productId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    static removeItem(cartId) {
        return new Promise((resolve, reject) => {
            db.query("DELETE FROM cart WHERE id=?", [cartId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static clearUserCart(userId) {
        return new Promise((resolve, reject) => {
            db.query("DELETE FROM cart WHERE user_id=?", [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = Cart;
