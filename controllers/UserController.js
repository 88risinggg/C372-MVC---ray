// controllers/UserController.js

const express = require("express");
const router = express.Router();
const db = require("../db");

// ==============================
// LOGIN PAGE
// ==============================
router.get("/login", (req, res) => {
    res.render("login", { 
        errors: [], 
        messages: [] 
    });
});

// ==============================
// REGISTER PAGE
// ==============================
router.get("/register", (req, res) => {
    res.render("register", { 
        messages: [], 
        formData: {} 
    });
});

// ==============================
// REGISTER USER
// ==============================
router.post("/register", (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    const formData = { username, email, address, contact, role };

    // Check if email already exists
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, rows) => {
        if (err) throw err;

        if (rows.length > 0) {
            return res.render("register", {
                messages: ["Email already registered"],
                formData
            });
        }

        // Insert new user
        db.query(
            "INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)",
            [username, email, password, address, contact, role],
            (err) => {
                if (err) throw err;

                res.redirect("/login");
            }
        );
    });
});

// ==============================
// LOGIN USER
// ==============================
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE email=? AND password=SHA1(?)",
        [email, password],
        (err, result) => {
            if (err) throw err;

            if (result.length === 1) {
                req.session.user = result[0];
                res.redirect("/products");
            } else {
                res.render("login", { 
                    errors: ["Invalid email or password"], 
                    messages: [] 
                });
            }
        }
    );
});

// ==============================
// LOGOUT
// ==============================
router.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

module.exports = router;
