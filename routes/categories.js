const express = require('express');
const router = express.Router();
const db = require('../db');
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// ================= GET =================
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, image FROM categories WHERE deleted_at IS NULL'
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= CREATE =================
router.post('/', auth, isAdmin, upload.single('image'), async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Nama kategori wajib diisi' });
  }

  try {
    const imageUrl = req.file?.path || null;

    const [result] = await db.query(
      'INSERT INTO categories (name, image) VALUES (?, ?)',
      [name, imageUrl]
    );

    res.json({
      message: 'Kategori berhasil ditambahkan',
      id: result.insertId,
      image: imageUrl
    });

  } catch (err) {
    console.error('INSERT CATEGORY ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= UPDATE =================
router.put('/:id', auth, isAdmin, upload.single('image'), async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;

  try {
    // Ambil data lama dulu
    const [rows] = await db.query(
      'SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    }

    const updatedName  = name || rows[0].name;
    const updatedImage = req.file?.path || rows[0].image; // kalau tidak upload gambar baru, pakai yang lama

    await db.query(
      'UPDATE categories SET name = ?, image = ? WHERE id = ?',
      [updatedName, updatedImage, id]
    );

    res.json({
      message: 'Kategori berhasil diperbarui',
      id,
      name: updatedName,
      image: updatedImage,
    });

  } catch (err) {
    console.error('UPDATE CATEGORY ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= DELETE =================
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    await db.query(
      'UPDATE categories SET deleted_at = NOW() WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Kategori dihapus (soft delete)' });
  } catch (err) {
    console.error('DELETE CATEGORY ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;