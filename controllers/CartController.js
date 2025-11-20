// controllers/CartController.js

const express = require("express");
const router = express.Router();
const db = require("../db");

// ==========================
// VIEW CART
// ==========================
router.get("/", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const userId = req.session.user.id;

    db.query(
        `SELECT cart.id AS cartId, cart.productId, cart.quantity,
                products.productName, products.image, products.price
         FROM cart
         JOIN products ON cart.productId = products.id
         WHERE cart.userId = ?`,
        [userId],
        (err, cart) => {
            if (err) throw err;

            let total = 0;
            cart.forEach(i => total += i.price * i.quantity);

            res.render("cart", {
                user: req.session.user,
                cart,
                total
            });
        }
    );
});

// ==========================
// ADD TO CART
// ==========================
router.post("/add/:productId", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const userId = req.session.user.id;
    const productId = req.params.productId;
    const quantity = Number(req.body.quantity || 1);

    // Check if item already in cart
    db.query(
        "SELECT * FROM cart WHERE userId = ? AND productId = ?",
        [userId, productId],
        (err, rows) => {
            if (err) throw err;

            if (rows.length > 0) {
                // Update quantity if exists
                db.query(
                    "UPDATE cart SET quantity = quantity + ? WHERE id = ?",
                    [quantity, rows[0].id],
                    () => res.redirect("/cart")
                );
            } else {
                // Insert new cart item
                db.query(
                    "INSERT INTO cart (userId, productId, quantity) VALUES (?, ?, ?)",
                    [userId, productId, quantity],
                    () => res.redirect("/cart")
                );
            }
        }
    );
});

// ==========================
// UPDATE CART QUANTITY
// ==========================
router.post("/update/:cartId", (req, res) => {
    const cartId = req.params.cartId;
    const newQty = Number(req.body.quantity);

    db.query(
        "UPDATE cart SET quantity = ? WHERE id = ?",
        [newQty, cartId],
        () => res.redirect("/cart")
    );
});

// ==========================
// REMOVE ITEM FROM CART
// ==========================
router.post("/remove/:cartId", (req, res) => {
    db.query(
        "DELETE FROM cart WHERE id = ?",
        [req.params.cartId],
        () => res.redirect("/cart")
    );
});

module.exports = router;
