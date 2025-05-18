const express = require('express');
const router = express.Router();
const db = require('../db');

// READ
router.get('/', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) throw err;
    res.render('users/list', { users: results });
  });
});

// FORM ADD
router.get('/add', (req, res) => {
  res.render('users/add');
});

// ADD
router.post('/add', (req, res) => {
  const { name, email } = req.body;
  db.query('INSERT INTO users SET ?', { name, email }, err => {
    if (err) throw err;
    res.redirect('/users');
  });
});

// FORM EDIT
router.get('/edit/:id', (req, res) => {
  db.query('SELECT * FROM users WHERE id = ?', [req.params.id], (err, result) => {
    if (err) throw err;
    res.render('users/edit', { user: result[0] });
  });
});

// UPDATE
router.post('/edit/:id', (req, res) => {
  const { name, email } = req.body;
  db.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.params.id], err => {
    if (err) throw err;
    res.redirect('/users');
  });
});

// DELETE
router.get('/delete/:id', (req, res) => {
  db.query('DELETE FROM users WHERE id = ?', [req.params.id], err => {
    if (err) throw err;
    res.redirect('/users');
  });
});

module.exports = router;
