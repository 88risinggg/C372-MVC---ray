const Student = require('../models/Student');

const StudentController = {
    // List all students (renders index view)
    list(req, res) {
        Student.getAll((err, students) => {
            if (err) return res.status(500).send('Database error');
            res.render('index', { students });
        });
    },

    // Get a single student by ID (renders student view)
    getById(req, res) {
        const id = req.params.id;
        Student.getById(id, (err, student) => {
            if (err) return res.status(500).send('Database error');
            if (!student) return res.status(404).send('Student not found');
            res.render('student', { student });
        });
    },

    // Render edit form for a student (fetches student and renders editStudent view)
    editForm(req, res) {
        const id = req.params.id;
        Student.getById(id, (err, student) => {
            if (err) return res.status(500).send('Database error');
            if (!student) return res.status(404).send('Student not found');
            res.render('editStudent', { student });
        });
    },

    // Add a new student (expects form data / file middleware for image)
    add(req, res) {
        const student = {
            name: req.body.name,
            dob: req.body.dob,
            contact: req.body.contact,
            image: (req.file && req.file.filename) || req.body.image || null
        };

        Student.create(student, (err, result) => {
            if (err) return res.status(500).send('Database error');
            res.redirect('/');
        });
    },

    // Update an existing student by ID
    update(req, res) {
        const id = req.params.id;
        const student = {
            name: req.body.name,
            dob: req.body.dob,
            contact: req.body.contact,
            image: (req.file && req.file.filename) || req.body.currentImage || null
        };

        Student.update(id, student, (err, result) => {
            if (err) return res.status(500).send('Database error');
            if (result && result.affectedRows === 0) return res.status(404).send('Student not found');
            // Redirect to the correct route (singular "student")
            res.redirect(`/student/${id}`);
        });
    },

    // Delete a student by ID
    delete(req, res) {
        const id = req.params.id;
        Student.delete(id, (err, result) => {
            if (err) return res.status(500).send('Database error');
            if (result && result.affectedRows === 0) return res.status(404).send('Student not found');
            res.redirect('/');
        });
    }
};

module.exports = StudentController;