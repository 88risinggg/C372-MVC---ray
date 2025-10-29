const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

let StudentController;
try {
	StudentController = require('./controllers/StudentController'); // function-based student controller
} catch (err) {
	console.warn('Warning: controllers/StudentController not found. Using fallback stub. Error:', err.message);
	// minimal fallback so app can run until you add the real controller
	StudentController = {
		list: (req, res) => res.send('StudentController.list: controller file missing'),
		getById: (req, res) => res.send(`StudentController.getById: id=${req.params.id}`),
		addForm: (req, res) => res.send('StudentController.addForm: controller file missing'),
		add: (req, res) => res.send('StudentController.add: controller file missing'),
		editForm: (req, res) => res.send(`StudentController.editForm: id=${req.params.id}`),
		update: (req, res) => res.send(`StudentController.update: id=${req.params.id}`),
		delete: (req, res) => res.send(`StudentController.delete: id=${req.params.id}`)
	};
}
// ensure StudentController is at least an object (handles case where require returned undefined)
StudentController = StudentController || {};

// --- NEW: warn about missing handlers at startup ---
const expectedHandlers = ['list','getById','addForm','add','editForm','update','delete'];
expectedHandlers.forEach((h) => {
	if (typeof StudentController[h] !== 'function') {
		console.warn(`Warning: StudentController.${h} is missing or not a function`);
	}
});

const app = express();

// ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'images');
fs.mkdirSync(uploadDir, { recursive: true });

// Set up multer for file uploads (use resolved path and safer filename)
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir); // Directory to save uploaded files
	},
	filename: (req, file, cb) => {
		// sanitize original name and prefix with timestamp to avoid overwriting files with same name
		const original = path.basename(file.originalname);
		const safe = original.replace(/[^a-zA-Z0-9.\-_]/g, '_'); // replace problematic chars
		cb(null, `${Date.now()}-${safe}`);
	}
});

// --- NEW: only accept common image mime types ---
function imageFileFilter (req, file, cb) {
	const allowed = ['image/png','image/jpeg','image/jpg','image/gif','image/webp'];
	if (allowed.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error('Only image files are allowed (png, jpg, jpeg, gif, webp).'), false);
	}
}

const upload = multer({ storage: storage, fileFilter: imageFileFilter });

// NOTE: direct MySQL connection and SQL queries removed from this file.
// Database access is handled in models via require('../db') and the controller.

// Set up view engine
app.set('view engine', 'ejs');
// set explicit views directory (optional but explicit)
app.set('views', path.join(__dirname, 'views'));

// enable static files (use absolute path)
app.use(express.static(path.join(__dirname, 'public')));
// enable form processing
app.use(express.urlencoded({
	extended: false
}));
// parse JSON bodies too
app.use(express.json());

// --- NEW: helper to ensure each route gets a function (avoids Express "requires a callback" error) ---
function getHandler(name) {
	return (req, res, next) => {
		const fn = StudentController[name];
		if (typeof fn === 'function') {
			try {
				return fn(req, res, next);
			} catch (err) {
				console.error(`Error in controller.${name}:`, err);
				return next(err);
			}
		}
		const msg = `Missing controller handler: ${name}`;
		console.warn(msg);
		res.status(500).send(msg);
	};
}

// Routes using student controller methods

// List all students
app.get('/', getHandler('list'));

// View single student
app.get('/student/:id', getHandler('getById'));

// Render add student form
app.get('/addStudent', getHandler('addForm'));

// Handle add student (file upload handled)
app.post('/addStudent', upload.single('image'), getHandler('add'));

// Render edit student form (controller will fetch student and render edit view)
app.get('/editStudent/:id', getHandler('editForm'));

// Handle edit student (file upload handled)
app.post('/editStudent/:id', upload.single('image'), getHandler('update'));

// Delete student
app.get('/deleteStudent/:id', getHandler('delete'));

// basic error handler
app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	// if multer fileFilter created the error, return 400
	if (err && err.message && err.message.includes('Only image files are allowed')) {
		return res.status(400).send(err.message);
	}
	res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// handle unhandled rejections so you see errors in the console
process.on('unhandledRejection', (reason) => {
	console.error('Unhandled Rejection:', reason);
});

// --- NEW: catch synchronous exceptions to avoid silent exits ---
process.on('uncaughtException', (err) => {
	console.error('Uncaught Exception:', err);
	// consider exiting in production: process.exit(1)
});
