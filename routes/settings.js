const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const upload = require('../middleware/upload');

// GET — publik, tidak perlu auth (dipanggil di LoginScreen)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT `key`, value FROM app_settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT logo — hanya admin
router.put('/logo', auth, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const imageUrl = req.file?.path;
    if (!imageUrl) return res.status(400).json({ message: 'Gambar wajib diupload' });

    await db.query(
      'UPDATE app_settings SET value = ? WHERE `key` = ?',
      [imageUrl, 'app_logo']
    );

    res.json({ message: 'Logo berhasil diperbarui', logo: imageUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT logo kedua — hanya admin
router.put('/logo-2', auth, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const imageUrl = req.file?.path;
    if (!imageUrl) return res.status(400).json({ message: 'Gambar wajib diupload' });

    await db.query(
      'UPDATE app_settings SET value = ? WHERE `key` = ?',
      [imageUrl, 'app_logo_2']
    );

    res.json({ message: 'Logo 2 berhasil diperbarui', logo: imageUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;