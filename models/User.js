const db = require('../db');

const Student = {
  getAll(callback) {
    const sql = 'SELECT studentId, name, dob, contact, image FROM students';
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },

  getById(id, callback) {
    const sql = 'SELECT studentId, name, dob, contact, image FROM students WHERE studentId = ?';
    db.query(sql, [id], (err, results) => {
      if (err) return callback(err);
      callback(null, results[0] || null);
    });
  },

  create(student, callback) {
    const sql = 'INSERT INTO students (name, dob, contact, image) VALUES (?, ?, ?, ?)';
    const params = [student.name, student.dob, student.contact, student.image];
    db.query(sql, params, (err, result) => {
      if (err) return callback(err);
      callback(null, { insertId: result.insertId });
    });
  },

  update(id, student, callback) {
    const sql = 'UPDATE students SET name = ?, dob = ?, contact = ?, image = ? WHERE studentId = ?';
    const params = [student.name, student.dob, student.contact, student.image, id];
    db.query(sql, params, (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  },

  delete(id, callback) {
    const sql = 'DELETE FROM students WHERE studentId = ?';
    db.query(sql, [id], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  }
};

module.exports = Student;