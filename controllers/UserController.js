const express = require("express");
const router = express.Router();
const db = require("../db");

// LOGIN PAGE
router.get("/login", (req, res) => {
    res.render("login", { error: null });
});

// REGISTER PAGE
router.get("/register", (req, res) => {
    res.render("register");
});

// REGISTER
router.post("/register", (req, res) => {
    const { username, email, password, address, contact } = req.body;

    db.query(
        "INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, 'user')",
        [username, email, password, address, contact],
        (err) => {
            if (err) throw err;
            res.redirect("/users/login");
        }
    );
});

// LOGIN
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE email = ? AND password = SHA1(?)",
        [email, password],
        (err, result) => {
            if (err) throw err;

            if (result.length === 1) {
                req.session.user = result[0];
                res.redirect("/products");
            } else {
                res.render("login", { error: "Invalid email or password" });
            }
        }
    );
});

// LOGOUT
router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/users/login");
});

module.exports = router;