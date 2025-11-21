// controllers/ProductController.js

const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const multer = require("multer");
const path = require("path");

// =========================
// IMAGE UPLOAD
// =========================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/images/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// =========================
// *** IMPORTANT ***
// Protect admin routes
// =========================
function isAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.redirect("/login");
    }
    next();
}


// =========================
// LIST PRODUCTS + SEARCH + CATEGORY
// =========================
router.get("/", async (req, res) => {
    const category = req.query.category;
    const search = req.query.search;

    let products;

    if (search) {
        products = await Product.search(search);
    } else if (category && category !== "All") {
        products = await Product.getByCategory(category);
    } else {
        products = await Product.getAll();
    }

    res.render("shopping", {
        user: req.session.user,
        products,
        category,
        search
    });
});


// =========================
// ADD PRODUCT PAGE  (ADMIN)
// =========================
router.get("/admin/add", isAdmin, (req, res) => {
    res.render("addProduct", {
        user: req.session.user
    });
});


// =========================
// ADD PRODUCT (ADMIN)
// =========================
router.post("/admin/add", isAdmin, upload.single("image"), async (req, res) => {
    const { name, quantity, price, category } = req.body;
    const image = req.file ? req.file.filename : null;

    await Product.create(name, quantity, price, image, category);

    res.redirect("/products");
});


// =========================
// EDIT PRODUCT PAGE (ADMIN)
// =========================
router.get("/admin/edit/:id", isAdmin, async (req, res) => {
    const product = await Product.getById(req.params.id);

    res.render("updateProduct", {
        user: req.session.user,
        product
    });
});


// =========================
// EDIT PRODUCT SUBMIT (ADMIN)
// =========================
router.post("/admin/edit/:id", isAdmin, upload.single("image"), async (req, res) => {
    const { name, quantity, price, currentImage, category } = req.body;
    const newImage = req.file ? req.file.filename : currentImage;

    await Product.update(
        req.params.id,
        name,
        quantity,
        price,
        newImage,
        category
    );

    res.redirect("/products");
});


// =========================
// DELETE PRODUCT (ADMIN)
// =========================
router.get("/admin/delete/:id", isAdmin, async (req, res) => {
    await Product.delete(req.params.id);
    res.redirect("/products");
});


// =========================
// VIEW PRODUCT DETAILS
// (must be LAST to avoid route conflicts)
// =========================
router.get("/:id", async (req, res) => {
    const product = await Product.getById(req.params.id);

    if (!product) return res.status(404).send("Product not found");

    res.render("product", {
        user: req.session.user,
        product
    });
});


module.exports = router;
