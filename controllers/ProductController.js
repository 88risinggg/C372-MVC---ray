// controllers/ProductController.js

const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");

// =========================
// IMAGE UPLOAD SETTINGS
// =========================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/images/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// =========================
// LIST PRODUCTS (SHOP)
// =========================
router.get("/", (req, res) => {
    db.query("SELECT * FROM products", (err, products) => {
        if (err) throw err;

        res.render("shopping", {
            user: req.session.user,
            products
        });
    });
});

// =========================
// VIEW ONE PRODUCT
// =========================
router.get("/:id", (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, rows) => {
        if (err) throw err;

        res.render("product", {
            user: req.session.user,
            product: rows[0]
        });
    });
});

// =========================
// ADD PRODUCT PAGE (ADMIN)
// =========================
router.get("/admin/add", (req, res) => {
    res.render("addProduct", { user: req.session.user });
});

// =========================
// ADD PRODUCT (ADMIN)
// =========================
router.post("/admin/add", upload.single("image"), (req, res) => {
    const { name, quantity, price } = req.body;
    const image = req.file ? req.file.filename : null;

    db.query(
        "INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)",
        [name, quantity, price, image],
        (err) => {
            if (err) throw err;
            res.redirect("/products");
        }
    );
});

// =========================
// EDIT PRODUCT PAGE (ADMIN)
// =========================
router.get("/admin/edit/:id", (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, rows) => {
        if (err) throw err;

        res.render("updateProduct", {
            user: req.session.user,
            product: rows[0]
        });
    });
});

// =========================
// EDIT PRODUCT (ADMIN)
// =========================
router.post("/admin/edit/:id", upload.single("image"), (req, res) => {
    const { name, quantity, price, currentImage } = req.body;

    // Use new image if uploaded
    const image = req.file ? req.file.filename : currentImage;

    db.query(
        "UPDATE products SET productName=?, quantity=?, price=?, image=? WHERE id=?",
        [name, quantity, price, image, req.params.id],
        (err) => {
            if (err) throw err;
            res.redirect("/products");
        }
    );
});

// =========================
// DELETE PRODUCT (ADMIN)
// =========================
router.get("/admin/delete/:id", (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
        if (err) throw err;
        res.redirect("/products");
    });
});

module.exports = router;
