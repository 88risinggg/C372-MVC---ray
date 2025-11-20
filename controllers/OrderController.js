// controllers/OrderController.js

const express = require("express");
const router = express.Router();
const db = require("../db");

// ==========================
// SHOW CHECKOUT PAGE
// ==========================
router.get("/checkout", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const userId = req.session.user.id;

    // Get cart items
    db.query(
        `SELECT cart.*, products.productName, products.image, products.price
         FROM cart
         JOIN products ON cart.productId = products.id
         WHERE cart.userId = ?`,
        [userId],
        (err, cart) => {
            if (err) throw err;

            let total = 0;
            cart.forEach(i => total += i.price * i.quantity);

            res.render("checkout", {
                user: req.session.user,
                cart,
                total
            });
        }
    );
});

// ==========================
// PROCESS CHECKOUT
// ==========================
router.post("/checkout", (req, res) => {
    const userId = req.session.user.id;

    db.query(
        `SELECT cart.*, products.price, products.productName
         FROM cart
         JOIN products ON cart.productId = products.id
         WHERE cart.userId = ?`,
        [userId],
        (err, items) => {
            if (err) throw err;

            let total = 0;
            items.forEach(i => total += i.price * i.quantity);

            // Create order
            db.query(
                "INSERT INTO orders (userId, total) VALUES (?, ?)",
                [userId, total],
                (err, result) => {
                    if (err) throw err;

                    const orderId = result.insertId;

                    // Insert order items
                    items.forEach(item => {
                        db.query(
                            "INSERT INTO order_items (orderId, productId, quantity, price) VALUES (?, ?, ?, ?)",
                            [orderId, item.productId, item.quantity, item.price]
                        );
                    });

                    // Clear cart
                    db.query("DELETE FROM cart WHERE userId = ?", [userId]);

                    // Render success page
                    res.render("paymentSuccess", {
                        user: req.session.user,
                        orderId,
                        total
                    });
                }
            );
        }
    );
});

// ==========================
// ORDER HISTORY
// ==========================
router.get("/history", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    db.query(
        "SELECT * FROM orders WHERE userId = ? ORDER BY created_at DESC",
        [req.session.user.id],
        (err, orders) => {
            if (err) throw err;

            res.render("orderHistory", {
                user: req.session.user,
                orders
            });
        }
    );
});

// ==========================
// ORDER DETAILS
// ==========================
router.get("/:orderId", (req, res) => {
    const orderId = req.params.orderId;

    // Get order itself
    db.query(
        "SELECT * FROM orders WHERE id = ?",
        [orderId],
        (err, orderRows) => {
            if (err) throw err;

            const order = orderRows[0];

            // Get items
            db.query(
                `SELECT order_items.*, products.productName, products.image
                 FROM order_items
                 JOIN products ON order_items.productId = products.id
                 WHERE order_items.orderId = ?`,
                [orderId],
                (err, items) => {
                    if (err) throw err;

                    res.render("orderDetails", {
                        user: req.session.user,
                        order,
                        items
                    });
                }
            );
        }
    );
});

module.exports = router;
