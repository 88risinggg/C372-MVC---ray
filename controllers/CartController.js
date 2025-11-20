const express = require("express");
const router = express.Router();
const db = require("../db");

// VIEW CART
router.get("/", (req, res) => {
    if (!req.session.user) return res.redirect("/users/login");

    db.query(
        `SELECT cart.id AS cartId, products.productName, products.image, products.price, 
                cart.quantity
         FROM cart
         JOIN products ON cart.product_id = products.id
         WHERE cart.user_id = ?`,
        [req.session.user.id],
        (err, items) => {
            if (err) throw err;
            res.render("cart", { items });
        }
    );
});

// ADD TO CART
router.post("/add/:productId", (req, res) => {
    if (!req.session.user) return res.redirect("/users/login");

    db.query(
        "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, 1)",
        [req.session.user.id, req.params.productId],
        (err) => {
            if (err) throw err;
            res.redirect("/cart");
        }
    );
});

// REMOVE FROM CART
router.get("/remove/:cartId", (req, res) => {
    db.query("DELETE FROM cart WHERE id = ?", [req.params.cartId], (err) => {
        if (err) throw err;
        res.redirect("/cart");
    });
});

module.exports = router;
