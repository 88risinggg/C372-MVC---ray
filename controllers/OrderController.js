const express = require("express");
const router = express.Router();
const db = require("../db");

// CHECKOUT PAGE
router.get("/checkout", (req, res) => {
    if (!req.session.user) return res.redirect("/users/login");
    res.render("checkout");
});

// SUBMIT CHECKOUT
router.post("/checkout", (req, res) => {
    const userId = req.session.user.id;

    // 1. Get cart items
    db.query(
        `SELECT cart.*, products.price 
         FROM cart
         JOIN products ON cart.product_id = products.id
         WHERE cart.user_id = ?`,
        [userId],
        (err, items) => {
            if (err) throw err;

            // Calculate total
            let total = 0;
            items.forEach(i => total += i.price * i.quantity);

            // 2. Create order
            db.query(
                "INSERT INTO orders (user_id, total) VALUES (?, ?)",
                [userId, total],
                (err, result) => {
                    if (err) throw err;

                    const orderId = result.insertId;

                    // 3. Insert items into order_items
                    items.forEach(item => {
                        db.query(
                            "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
                            [orderId, item.product_id, item.quantity, item.price]
                        );
                    });

                    // 4. Clear cart
                    db.query("DELETE FROM cart WHERE user_id = ?", [userId]);

                    // 5. Show success page
                    res.render("paymentSuccess", { orderId });
                }
            );
        }
    );
});

// ORDER HISTORY
router.get("/history", (req, res) => {
    if (!req.session.user) return res.redirect("/users/login");

    db.query(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
        [req.session.user.id],
        (err, orders) => {
            if (err) throw err;
            res.render("orderHistory", { orders });
        }
    );
});

// ORDER DETAILS
router.get("/view/:orderId", (req, res) => {
    db.query(
        `SELECT order_items.*, products.productName, products.image 
         FROM order_items
         JOIN products ON order_items.product_id = products.id
         WHERE order_items.order_id = ?`,
        [req.params.orderId],
        (err, items) => {
            if (err) throw err;
            res.render("orderDetails", {
                items,
                orderId: req.params.orderId
            });
        }
    );
});

module.exports = router;
