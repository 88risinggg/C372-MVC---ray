const express = require("express");
const router = express.Router();
const db = require("../db");

// LIST PRODUCTS
router.get("/", (req, res) => {
    db.query("SELECT * FROM products", (err, products) => {
        if (err) throw err;
        res.render("index", { products });
    });
});

// SHOW ONE PRODUCT
router.get("/view/:id", (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, rows) => {
        if (err) throw err;
        res.render("product", { product: rows[0] });
    });
});

// ADD PRODUCT PAGE
router.get("/admin/add", (req, res) => {
    res.render("addProduct");
});

// ADD PRODUCT
router.post("/admin/add", (req, res) => {
    const { productName, quantity, price, image } = req.body;

    db.query(
        "INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)",
        [productName, quantity, price, image],
        (err) => {
            if (err) throw err;
            res.redirect("/products");
        }
    );
});

// EDIT PRODUCT PAGE
router.get("/admin/edit/:id", (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, rows) => {
        if (err) throw err;
        res.render("editProduct", { product: rows[0] });
    });
});

// EDIT PRODUCT
router.post("/admin/edit/:id", (req, res) => {
    const { productName, quantity, price, image } = req.body;

    db.query(
        "UPDATE products SET productName=?, quantity=?, price=?, image=? WHERE id=?",
        [productName, quantity, price, image, req.params.id],
        (err) => {
            if (err) throw err;
            res.redirect("/products");
        }
    );
});

// DELETE PRODUCT
router.get("/admin/delete/:id", (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
        if (err) throw err;
        res.redirect("/products");
    });
});

module.exports = router;