const db = require("../db");

class Product {

    static getAll() {
        return new Promise((resolve, reject) => {
            db.query("SELECT * FROM products", (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    static getById(id) {
        return new Promise((resolve, reject) => {
            db.query("SELECT * FROM products WHERE id = ?", [id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });
    }

    static create(productName, quantity, price, image) {
        return new Promise((resolve, reject) => {
            db.query(
                "INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)",
                [productName, quantity, price, image],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result.insertId);
                }
            );
        });
    }

    static update(id, productName, quantity, price, image) {
        return new Promise((resolve, reject) => {
            db.query(
                "UPDATE products SET productName=?, quantity=?, price=?, image=? WHERE id=?",
                [productName, quantity, price, image, id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    static delete(id) {
        return new Promise((resolve, reject) => {
            db.query("DELETE FROM products WHERE id=?", [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = Product;
