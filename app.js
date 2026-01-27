let express, mysql, session, multer, fs, path, axios, dotenv, netsQr, paypal, stripePayments;
try {
    express = require("express");
    mysql = require("mysql2");
    session = require("express-session");
    multer = require("multer");
    fs = require("fs");
    path = require("path");
    axios = require("axios");
    dotenv = require("dotenv");
    netsQr = require("./services/nets");
    paypal = require("./services/paypal");
    stripePayments = require("./services/stripe");
} catch (err) {
    console.error("A required dependency is missing:", err.message);
    console.error("Install dependencies with:");
    console.error("  npm install express mysql2 express-session multer ejs axios dotenv");
    process.exit(1);
}

const format = require("util").format;
const app = express();
dotenv.config();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "public", "images");
fs.mkdirSync(uploadDir, { recursive: true });

// Multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        cb(null, `${Date.now()}-${safe}`);
    }
});
const upload = multer({ storage });

// MySQL connection
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Republic_C207",
    database: "c372_supermarketdb"
});

connection.connect(err => {
    if (err) return console.error("MySQL Connection Error:", err);
    console.log("Connected to MySQL");
});

// View Engine
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session
app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use((req, res, next) => {
    req.flash = (type, msg, ...args) => {
        if (req.session === undefined) {
            throw new Error("req.flash() requires sessions");
        }
        const msgs = req.session.flash || (req.session.flash = {});
        if (type && msg) {
            if (args.length && format) {
                msg = format(msg, ...args);
            } else if (Array.isArray(msg)) {
                msg.forEach(val => {
                    (msgs[type] = msgs[type] || []).push(val);
                });
                return msgs[type].length;
            }
            return (msgs[type] = msgs[type] || []).push(msg);
        } else if (type) {
            const arr = msgs[type];
            delete msgs[type];
            return arr || [];
        }
        req.session.flash = {};
        return msgs;
    };
    next();
});

// Expose user and cart count to all views
app.use((req, res, next) => {
    res.locals.user = req.session?.user || null;
    res.locals.cartCount = (req.session?.cart || []).reduce((sum, item) => {
        return sum + (parseInt(item.quantity) || 0);
    }, 0);
    next();
});

// Authentication Middleware
const checkAuthenticated = (req, res, next) => {
    if (req.session?.user) return next();
    req.flash("error", "Please log in to continue.");
    res.redirect("/login");
};

const checkAdmin = (req, res, next) => {
    if (req.session?.user?.role === "admin") return next();
    req.flash("error", "Access denied. Admin only.");
    res.redirect("/shopping");
};

// Validation for registration
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;
    if (!username || !email || !password || !address || !contact || !role) {
        req.flash("error", "All fields are required.");
        req.flash("formData", req.body);
        return res.redirect("/register");
    }
    if (password.length < 6) {
        req.flash("error", "Password must be at least 6 characters.");
        req.flash("formData", req.body);
        return res.redirect("/register");
    }
    next();
};

// HOME
app.get('/', (req, res) => {
    connection.query("SELECT * FROM products LIMIT 8", (err, results) => {
        if (err) throw err;
        res.render("index", {
            user: req.session.user,
            products: results
        });
    });
});


// REGISTER PAGE
app.get("/register", (req, res) => {
    res.render("register", {
        messages: req.flash("error"),
        formData: req.flash("formData")[0]
    });
});

// REGISTER SUBMIT
app.post("/register", validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    const sql = "INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)";
    connection.query(sql, [username, email, password, address, contact, role], err => {
        if (err) throw err;

        req.flash("success", "Registration successful! Please log in.");
        res.redirect("/login");
    });
});

// LOGIN PAGE
app.get("/login", (req, res) => {
    res.render("login", {
        messages: req.flash("success"),
        errors: req.flash("error")
    });
});

// LOGIN SUBMIT
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash("error", "All fields are required.");
        return res.redirect("/login");
    }

    connection.query(
        "SELECT * FROM users WHERE email = ? AND password = SHA1(?)",
        [email, password],
        (err, results) => {
            if (err) throw err;

            if (results.length > 0) {
                req.session.user = results[0];
                if (results[0].role === "admin") return res.redirect("/inventory");
                return res.redirect("/shopping");
            }

            req.flash("error", "Invalid email or password.");
            res.redirect("/login");
        }
    );
});

// LOGOUT
app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error:", err);
            req.flash("error", "Could not log you out. Please try again.");
            return res.redirect("/shopping");
        }
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

// Helper to safely expose the logged-in user (or null) to views
const attachUser = (req, res, next) => {
    res.locals.user = req.session?.user || null;
    res.locals.cartCount = (req.session?.cart || []).reduce((sum, item) => {
        return sum + (parseInt(item.quantity) || 0);
    }, 0);
    next();
};

// Helper to calculate totals with GST and delivery
const calculateTotals = (items = []) => {
    const subtotal = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 0), 0);
    const deliveryFee = subtotal > 50 ? 0 : 2;
    const taxable = subtotal + deliveryFee;
    const gst = Math.round(taxable * 0.09 * 100) / 100; // 9% GST rounded to cents
    const total = Math.round((taxable + gst) * 100) / 100;
    return { subtotal, deliveryFee, gst, total };
};

const getWalletBalance = (userId) => {
    return new Promise((resolve, reject) => {
        connection.query(
            "SELECT wallet_balance FROM users WHERE id = ?",
            [userId],
            (err, rows) => {
                if (err) return reject(err);
                const balance = Number(rows[0]?.wallet_balance || 0);
                resolve(balance);
            }
        );
    });
};

const adjustWalletBalance = (userId, amountDelta) => {
    return new Promise((resolve, reject) => {
        connection.query(
            "UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?",
            [amountDelta, userId],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
};

const normalizePaymentMethod = (value) => {
    const raw = (value || "").trim();
    const allowed = [
        "Stripe",
        "Wallet",
        "PayPal",
        "NETS QR",
        "PayNow",
        "GrabPay",
        "Cash on Delivery"
    ];
    if (allowed.includes(raw)) return raw;
    return raw ? "Other" : "Unknown";
};

const validateStock = (cart = []) => {
    const stockChecks = cart.map(item => {
        return new Promise((resolve, reject) => {
            connection.query(
                "SELECT quantity FROM products WHERE id = ?",
                [item.id],
                (err, rows) => {
                    if (err) return reject(err);
                    const available = rows[0]?.quantity ?? 0;
                    if (available < item.quantity) {
                        return reject(`${item.productName} only has ${available} left in stock.`);
                    }
                    resolve();
                }
            );
        });
    });
    return Promise.all(stockChecks);
};

const createOrderFromCart = (userId, cart = [], paymentMethod) => {
    return new Promise((resolve, reject) => {
        const totals = calculateTotals(cart);
        const method = normalizePaymentMethod(paymentMethod);
        connection.query(
            "INSERT INTO orders (user_id, total, payment_method, orderStatus) VALUES (?, ?, ?, ?)",
            [userId, totals.total, method, "Preparing"],
            (err, orderResult) => {
                if (err) return reject(err);

                const orderId = orderResult.insertId;
                const tasks = cart.map(item => {
                    return new Promise((resolveItem, rejectItem) => {
                        connection.query(
                            "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
                            [orderId, item.id, item.quantity, item.price],
                            (err1) => {
                                if (err1) return rejectItem(err1);

                                connection.query(
                                    "UPDATE products SET quantity = quantity - ? WHERE id = ?",
                                    [item.quantity, item.id],
                                    (err2) => {
                                        if (err2) return rejectItem(err2);
                                        resolveItem();
                                    }
                                );
                            }
                        );
                    });
                });

                Promise.all(tasks)
                    .then(() => resolve({ orderId, totals }))
                    .catch(reject);
            }
        );
    });
};

// INVENTORY (admin only)
app.get("/inventory", checkAuthenticated, checkAdmin, (req, res) => {
    const search = req.query.search;
    const success = req.flash("success");

    let sql = "SELECT * FROM products";
    let params = [];

    if (search) {
        sql += " WHERE productName LIKE ?";
        params.push(`%${search}%`);
    }

    connection.query(sql, params, (err, results) => {
        if (err) throw err;

        const outOfStock = results.filter(p => p.quantity <= 0);

        res.render("inventory", {
            products: results,
            user: req.session.user,
            search,
            success,
            outOfStock
        });
    });
});


// SHOPPING PAGE (supports optional search and category filters)
app.get("/shopping", attachUser, (req, res) => {
    const { search = "", category = "All" } = req.query;

    // Build SQL with optional filters
    let sql = "SELECT * FROM products";
    const params = [];
    if (category && category !== "All") {
        sql += " WHERE category = ?";
        params.push(category);
    }
    if (search) {
        sql += params.length ? " AND" : " WHERE";
        sql += " productName LIKE ?";
        params.push(`%${search}%`);
    }

    connection.query(sql, params, (err, results) => {
        if (err) throw err;

        // Allow guests to browse; user stays null until login
        const user = res.locals.user || { username: "Guest", role: "guest" };

        res.render("shopping", { products: results, user, search, category });
    });
});

// ADMIN: Add product page
app.get("/products/admin/add", checkAuthenticated, checkAdmin, (req, res) => {
    const success = req.flash("success");
    res.render("addProduct", { user: req.session.user, success });
});

// ADMIN: Handle product creation (stores image via multer)
app.post("/products/admin/add", checkAuthenticated, checkAdmin, upload.single("image"), (req, res) => {
    const { name, quantity, price, category, discount = 0 } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = "INSERT INTO products (productName, quantity, price, image, category, discount) VALUES (?, ?, ?, ?, ?, ?)";
    connection.query(sql, [name, quantity, price, image, category, discount], err => {
        if (err) throw err;
        req.flash("success", "Product added successfully!");
        res.redirect("/inventory");
    });
});

// UPDATE PRODUCT PAGE
app.get("/products/admin/edit/:id", checkAuthenticated, checkAdmin, (req, res) => {
    connection.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, results) => {
        if (err) throw err;
        res.render("updateProduct", { product: results[0], user: req.session.user });
    });
});

// UPDATE PRODUCT SUBMIT
app.post("/products/admin/edit/:id", checkAuthenticated, checkAdmin, upload.single("image"), (req, res) => {
    const productId = req.params.id;
    const { name, quantity, price, category, discount = 0 } = req.body;
    let image = req.body.currentImage;

    if (req.file) image = req.file.filename;

    connection.query(
        "UPDATE products SET productName=?, quantity=?, price=?, image=?, category=?, discount=? WHERE id=?",
        [name, quantity, price, image, category, discount, productId],
        err => {
            if (err) throw err;
            req.flash("success", "Product updated successfully!");
            res.redirect("/inventory");
        }
    );
});

// ADMIN — VIEW ALL ORDERS
app.get("/admin/orders", checkAuthenticated, checkAdmin, (req, res) => {
    const sql = `
        SELECT orders.*, users.username 
        FROM orders 
        JOIN users ON orders.user_id = users.id
        ORDER BY orders.created_at DESC
    `;

    connection.query(sql, (err, results) => {
        if (err) throw err;

        res.render("adminOrders", {
            user: req.session.user,
            orders: results
        });
    });
});

// ADMIN — VIEW ORDER DETAILS
app.get("/admin/orders/:id", checkAuthenticated, checkAdmin, (req, res) => {
    const orderId = req.params.id;

    connection.query(
        `SELECT orders.*, users.username, users.email 
         FROM orders 
         JOIN users ON orders.user_id = users.id
         WHERE orders.id = ?`,
        [orderId],
        (err, rows) => {
            if (err) throw err;
            if (rows.length === 0) return res.redirect("/admin/orders");

            const order = rows[0];

            connection.query(
                `SELECT oi.*, p.productName, p.image 
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`,
                [orderId],
                (err2, items) => {
                    if (err2) throw err2;

                    res.render("adminOrderDetails", {
                        order,
                        items,
                        user: req.session.user
                    });
                }
            );
        }
    );
});

// ADMIN: Update order status
app.post("/admin/orders/:id/status", checkAuthenticated, checkAdmin, (req, res) => {
    const rawStatus = (req.body.orderStatus || "").trim();
    const mappedStatus = rawStatus === "Delivering" ? "Out for delivery" : rawStatus;
    const allowedStatuses = ["Preparing", "Out for delivery", "Completed"];

    if (!allowedStatuses.includes(mappedStatus)) {
        return res.redirect(`/admin/orders/${req.params.id}`);
    }

    connection.query(
        "UPDATE orders SET orderStatus = ? WHERE id = ?",
        [mappedStatus, req.params.id],
        (err) => {
            if (err) throw err;
            res.redirect(`/admin/orders/${req.params.id}`);
        }
    );
});

// ADMIN: Delete product
app.get("/products/admin/delete/:id", checkAuthenticated, checkAdmin, (req, res) => {
    connection.query(
        "DELETE FROM products WHERE id = ?",
        [req.params.id],
        err => {
            if (err) throw err;
            req.flash("success", "Product deleted successfully!");
            res.redirect("/inventory");
        }
    );
});

// PRODUCT DETAILS
app.get("/product/:id", checkAuthenticated, (req, res) => {
    connection.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, results) => {
        if (err) throw err;
        res.render("product", { product: results[0], user: req.session.user });
    });
});

// CART PAGE
app.get('/cart', checkAuthenticated, (req, res) => {
    const items = req.session.cart || [];
    res.render('cart', { items, user: req.session.user });
});

// ADMIN: Refund order (wallet only credits; others mark refunded)
app.post("/admin/orders/:id/refund", checkAuthenticated, checkAdmin, (req, res) => {
    const orderId = req.params.id;
    connection.query(
        `SELECT orders.id, orders.total, orders.payment_method, orders.refund_status, orders.user_id
         FROM orders
         WHERE orders.id = ?`,
        [orderId],
        (err, rows) => {
            if (err) throw err;
            const order = rows[0];
            if (!order) return res.redirect("/admin/orders");
            if (order.refund_status === "Refunded") {
                return res.redirect(`/admin/orders/${orderId}`);
            }

            const total = Number(order.total || 0);
            const finalizeRefund = () => {
                connection.query(
                    "UPDATE orders SET refund_status = ?, refunded_at = NOW() WHERE id = ?",
                    ["Refunded", orderId],
                    (err2) => {
                        if (err2) throw err2;
                        res.redirect(`/admin/orders/${orderId}`);
                    }
                );
            };

            if (order.payment_method === "Wallet") {
                adjustWalletBalance(order.user_id, total)
                    .then(finalizeRefund)
                    .catch(err3 => {
                        console.error("Wallet refund error:", err3);
                        res.redirect(`/admin/orders/${orderId}`);
                    });
            } else {
                finalizeRefund();
            }
        }
    );
});

// Wallet page
app.get("/wallet", checkAuthenticated, (req, res) => {
    getWalletBalance(req.session.user.id)
        .then(balance => {
            req.session.user.wallet_balance = balance;
            res.render("wallet", {
                user: req.session.user,
                balance,
                success: req.flash("success"),
                errors: req.flash("error")
            });
        })
        .catch(err => {
            console.error("Wallet fetch error:", err);
            req.flash("error", "Could not load wallet balance.");
            res.redirect("/shopping");
        });
});

// Wallet top-up
app.post("/wallet/topup", checkAuthenticated, (req, res) => {
    const amount = Number(req.body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
        req.flash("error", "Please enter a valid top-up amount.");
        return res.redirect("/wallet");
    }

    adjustWalletBalance(req.session.user.id, amount)
        .then(() => getWalletBalance(req.session.user.id))
        .then(balance => {
            req.session.user.wallet_balance = balance;
            req.flash("success", `Wallet topped up by $${amount.toFixed(2)}.`);
            res.redirect("/wallet");
        })
        .catch(err => {
            console.error("Wallet top-up error:", err);
            req.flash("error", "Top-up failed. Please try again.");
            res.redirect("/wallet");
        });
});


// ADD TO CART
app.post("/add-to-cart/:id", checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1;

    connection.query("SELECT * FROM products WHERE id = ?", [productId], (err, results) => {
        if (err) throw err;

        if (!req.session.cart) req.session.cart = [];

        const productRow = results[0];
        const basePrice = parseFloat(productRow.price) || 0;
        const discount = parseFloat(productRow.discount) || 0;
        const discountedPrice = Math.max(0, basePrice * (1 - discount / 100));

        const existing = req.session.cart.find(i => i.id === productId);
        if (existing) {
            existing.quantity += quantity;
        } else {
            req.session.cart.push({
                id: productRow.id,
                productName: productRow.productName,
                price: discountedPrice,
                quantity,
                image: productRow.image
            });
        }

        res.redirect("/cart");
    });
});

// Remove from cart
app.post("/cart/remove/:id", checkAuthenticated, (req, res) => {
    req.session.cart = (req.session.cart || []).filter(i => i.id !== parseInt(req.params.id));
    res.redirect("/cart");
});

// Update cart item
app.post("/cart/update/:id", checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    const item = cart.find(i => i.id === parseInt(req.params.id));
    if (item) item.quantity = Math.max(1, parseInt(req.body.quantity));
    res.redirect("/cart");
});

// Checkout page
app.get("/checkout", checkAuthenticated, (req, res) => {
    const items = req.session.cart || [];

    if (!items.length) {
        req.flash("error", "Your cart is empty.");
        return res.redirect("/shopping");
    }

    const totals = calculateTotals(items);

    getWalletBalance(req.session.user.id)
        .then(balance => {
            req.session.user.wallet_balance = balance;
            res.render("checkout", {
                items,         // <<< FIXED
                subtotal: totals.subtotal,
                deliveryFee: totals.deliveryFee,
                gst: totals.gst,
                total: totals.total,
                walletBalance: balance,
                user: req.session.user,
                errors: req.flash("error")
            });
        })
        .catch(err => {
            console.error("Wallet fetch error:", err);
            res.render("checkout", {
                items,
                subtotal: totals.subtotal,
                deliveryFee: totals.deliveryFee,
                gst: totals.gst,
                total: totals.total,
                walletBalance: 0,
                user: req.session.user,
                errors: req.flash("error")
            });
        });
});

// Submit checkout
app.post("/checkout", checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    const paymentMethod = (req.body.paymentMethod || "").trim();
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const userId = req.session.user.id;

    if (!cart.length) {
        req.flash("error", "Your cart is empty.");
        return res.redirect("/shopping");
    }

    if (paymentMethod === "Wallet") {
        const totals = calculateTotals(cart);
        let deducted = false;
        return validateStock(cart)
            .then(() => getWalletBalance(userId))
            .then(balance => {
                if (balance < totals.total) {
                    throw new Error("Insufficient wallet balance.");
                }
                return adjustWalletBalance(userId, -totals.total).then(() => {
                    deducted = true;
                    req.session.user.wallet_balance = balance - totals.total;
                });
            })
            .then(() => createOrderFromCart(userId, cart, normalizedPaymentMethod))
            .then(({ orderId, totals: createdTotals }) => {
                req.session.cart = [];
                res.render("paymentSuccess", {
                    orderId,
                    total: createdTotals.total,
                    user: req.session.user
                });
            })
            .catch(err => {
                if (deducted) {
                    adjustWalletBalance(userId, totals.total).catch(() => {});
                }
                console.log("Wallet payment error:", err);
                req.flash("error", err.message || "Wallet payment failed. Please try again.");
                return res.redirect("/checkout");
            });
    }

    if (paymentMethod === "Stripe") {
        return validateStock(cart)
            .then(() => {
                const totals = calculateTotals(cart);
                const baseUrl = `${req.protocol}://${req.get("host")}`;
                req.session.pendingOrder = {
                    provider: "stripe",
                    cart: cart.map(item => ({ ...item })),
                    totals,
                    paymentMethod: normalizedPaymentMethod
                };
                return stripePayments.createCheckoutSession({
                    items: cart,
                    totals,
                    baseUrl,
                    customerEmail: req.session.user?.email
                });
            })
            .then(session => {
                req.session.pendingOrder.sessionId = session.id;
                return res.redirect(session.url);
            })
            .catch(err => {
                console.log("Stripe error:", err);
                req.flash("error", "Stripe setup failed. Please try again.");
                return res.redirect("/checkout");
            });
    }

    if (paymentMethod === "PayPal") {
        return validateStock(cart)
            .then(() => {
                const totals = calculateTotals(cart);
                const baseUrl = `${req.protocol}://${req.get("host")}`;
                req.session.pendingOrder = {
                    provider: "paypal",
                    cart: cart.map(item => ({ ...item })),
                    totals,
                    paymentMethod: normalizedPaymentMethod
                };
                return paypal.createOrder(
                    totals.total,
                    `${baseUrl}/paypal/success`,
                    `${baseUrl}/paypal/cancel`
                );
            })
            .then(({ approvalUrl }) => res.redirect(approvalUrl))
            .catch(err => {
                console.log("PayPal error:", err);
                req.flash("error", "PayPal setup failed. Please try again.");
                return res.redirect("/checkout");
            });
    }

    if (paymentMethod === "NETS QR") {
        return validateStock(cart)
            .then(() => {
                const totals = calculateTotals(cart);
                req.session.pendingOrder = {
                    provider: "nets",
                    cart: cart.map(item => ({ ...item })),
                    totals,
                    paymentMethod: normalizedPaymentMethod
                };
                return netsQr.generateQrCode(req, res, totals.total);
            })
            .catch(err => {
                req.flash("error", err);
                return res.redirect("/checkout");
            });
    }

    validateStock(cart)
        .then(() => createOrderFromCart(req.session.user.id, cart, normalizedPaymentMethod))
        .then(({ orderId, totals }) => {
            req.session.cart = [];
            res.render("paymentSuccess", {
                orderId,
                total: totals.total,
                user: req.session.user
            });
        })
        .catch(err => {
            console.log("Stock or insert error:", err);
            req.flash("error", "Order failed: " + err);
            res.redirect("/checkout");
        });
});

app.get("/paypal/success", checkAuthenticated, (req, res) => {
    const pending = req.session.pendingOrder;
    const orderId = req.query.token;

    if (!pending?.cart?.length || pending.provider !== "paypal") {
        req.flash("error", "No pending PayPal order found.");
        return res.redirect("/checkout");
    }

    if (!orderId) {
        req.flash("error", "Missing PayPal order ID.");
        return res.redirect("/checkout");
    }

    paypal.captureOrder(orderId)
        .then(capture => {
            if (capture?.status !== "COMPLETED") {
                throw new Error("PayPal capture not completed.");
            }
            return createOrderFromCart(req.session.user.id, pending.cart, pending.paymentMethod);
        })
        .then(({ orderId: internalOrderId, totals }) => {
            req.session.cart = [];
            req.session.pendingOrder = null;
            res.render("paymentSuccess", {
                orderId: internalOrderId,
                total: totals.total,
                user: req.session.user
            });
        })
        .catch(err => {
            console.log("PayPal capture error:", err);
            req.flash("error", "PayPal capture failed. Please try again.");
            res.redirect("/checkout");
        });
});

app.get("/paypal/cancel", checkAuthenticated, (req, res) => {
    req.session.pendingOrder = null;
    res.render("paypalFail", {
        message: "PayPal payment was cancelled.",
        user: req.session.user
    });
});

app.get("/stripe/success", checkAuthenticated, async (req, res) => {
    const pending = req.session.pendingOrder;
    const sessionId = req.query.session_id;

    if (!pending?.cart?.length || pending.provider !== "stripe") {
        req.flash("error", "No pending Stripe order found.");
        return res.redirect("/checkout");
    }

    if (!sessionId) {
        req.flash("error", "Missing Stripe session ID.");
        return res.redirect("/checkout");
    }

    try {
        if (pending.sessionId && pending.sessionId !== sessionId) {
            throw new Error("Stripe session mismatch.");
        }
        const session = await stripePayments.retrieveSession(sessionId);
        if (session?.payment_status !== "paid") {
            throw new Error("Stripe payment not completed.");
        }

        const { orderId, totals } = await createOrderFromCart(req.session.user.id, pending.cart, pending.paymentMethod);
        req.session.cart = [];
        req.session.pendingOrder = null;
        res.render("paymentSuccess", {
            orderId,
            total: totals.total,
            user: req.session.user
        });
    } catch (err) {
        console.log("Stripe capture error:", err);
        req.flash("error", "Stripe payment failed. Please try again.");
        res.redirect("/checkout");
    }
});

app.get("/stripe/cancel", checkAuthenticated, (req, res) => {
    req.session.pendingOrder = null;
    res.render("paypalFail", {
        message: "Stripe payment was cancelled.",
        user: req.session.user
    });
});

app.get("/nets-qr/success", checkAuthenticated, (req, res) => {
    const pending = req.session.pendingOrder;
    if (!pending?.cart?.length || pending.provider !== "nets") {
        req.flash("error", "No pending NETS order found.");
        return res.redirect("/checkout");
    }

    createOrderFromCart(req.session.user.id, pending.cart, pending.paymentMethod)
        .then(({ orderId, totals }) => {
            req.session.cart = [];
            req.session.pendingOrder = null;
            res.render("paymentSuccess", {
                orderId,
                total: totals.total,
                user: req.session.user
            });
        })
        .catch(err => {
            console.log("NETS order error:", err);
            req.flash("error", "Order failed: " + err);
            res.redirect("/checkout");
        });
});

app.get("/nets-qr/fail", checkAuthenticated, (req, res) => {
    req.session.pendingOrder = null;
    res.render("netsTxnFailStatus", {
        message: "Transaction failed. Please try again.",
        user: req.session.user
    });
});

app.get("/sse/payment-status/:txnRetrievalRef", async (req, res) => {
    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });

    if (!process.env.API_KEY || !process.env.PROJECT_ID) {
        res.write(`data: ${JSON.stringify({ error: "NETS API keys missing." })}\n\n`);
        return res.end();
    }

    const txnRetrievalRef = req.params.txnRetrievalRef;
    let pollCount = 0;
    const maxPolls = 60;
    let frontendTimeoutStatus = 0;

    const interval = setInterval(async () => {
        pollCount++;

        try {
            const response = await axios.post(
                "https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/query",
                { txn_retrieval_ref: txnRetrievalRef, frontend_timeout_status: frontendTimeoutStatus },
                {
                    headers: {
                        "api-key": process.env.API_KEY,
                        "project-id": process.env.PROJECT_ID,
                        "Content-Type": "application/json"
                    }
                }
            );

            res.write(`data: ${JSON.stringify(response.data)}\n\n`);

            const resData = response.data?.result?.data || {};
            if (resData.response_code === "00" && resData.txn_status === 1) {
                res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
                clearInterval(interval);
                res.end();
            } else if (frontendTimeoutStatus === 1 && (resData.response_code !== "00" || resData.txn_status === 2)) {
                res.write(`data: ${JSON.stringify({ fail: true, ...resData })}\n\n`);
                clearInterval(interval);
                res.end();
            }
        } catch (err) {
            clearInterval(interval);
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }

        if (pollCount >= maxPolls) {
            clearInterval(interval);
            frontendTimeoutStatus = 1;
            res.write(`data: ${JSON.stringify({ fail: true, error: "Timeout" })}\n\n`);
            res.end();
        }
    }, 5000);

    req.on("close", () => {
        clearInterval(interval);
    });
});

// View orders
app.get("/orders", checkAuthenticated, (req, res) => {
    connection.query(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
        [req.session.user.id],
        (err, rows) => {
            if (err) throw err;
            res.render("orderHistory", {
                orders: rows,
                user: req.session.user,
                errors: req.flash("error")
            });
        }
    );
});

// Order details
app.get("/orders/:id", checkAuthenticated, (req, res) => {
    connection.query(
        "SELECT * FROM orders WHERE id = ? AND user_id = ?",
        [req.params.id, req.session.user.id],
        (err, rows) => {
            if (err) throw err;
            if (!rows.length) {
                req.flash("error", "Order not found.");
                return res.redirect("/orders");
            }

            const order = rows[0];

            connection.query(
                `SELECT order_items.*, products.productName, products.image
                 FROM order_items
                 JOIN products ON order_items.product_id = products.id
                 WHERE order_items.order_id = ?`,
                [req.params.id],
                (err2, items) => {
                    if (err2) throw err2;

                    res.render("orderDetails", {
                        order,
                        items,
                        user: req.session.user,
                        errors: req.flash("error")
                    });
                }
            );
        }
    );
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
