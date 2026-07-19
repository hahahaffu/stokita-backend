const express = require("express");
const router = express.Router();
const db = require("../db");

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../utils/cloudinary");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const auditLog = require("../utils/auditLog");

const transporter =
  require("../utils/mailer");

const {
  verifyEmailTemplate
} = require("../utils/emailTemplate");

/* ================= GET PROFILE ================= */
router.get("/", auth, async (req, res) => {
  try {
    const [user] = await db.query(
      `
  SELECT
  id,
  name,
  email,
  phone,
  photo,
  role,
  email_verified
  FROM users
  WHERE id=?
  `,
      [req.user.id]
    );

    res.json(user[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= UPDATE PROFILE ================= */
router.put(
  "/account",
  auth,
  async (req, res) => {

    const {

      name,
      email

    } = req.body;

    try {

      const userId =
        req.user.id;

      const [rows] =
        await db.query(

          `
SELECT *
FROM users
WHERE id=?
`,

          [userId]

        );

      const oldUser =
        rows[0];

      const cleanEmail =
        email.trim().toLowerCase();

      let emailChanged = false;

      if (
        cleanEmail !== oldUser.email
      ) {

        emailChanged = true;

        const [exist] =
          await db.query(

            `
SELECT id
FROM users
WHERE email=?
AND id<>?
`,

            [
              cleanEmail,
              userId
            ]

          );

        if (exist.length) {

          return res.status(400).json({

            message:
              "Email sudah digunakan."

          });

        }

      }

      if (emailChanged) {

        const token =
          crypto
            .randomBytes(32)
            .toString("hex");

        const expired =
          new Date(
            Date.now() +
            24 * 60 * 60 * 1000
          );

        const [oldUserRows] = await db.query('SELECT email, email_verified FROM users WHERE id=?', [userId]);
        const oldEmail = oldUserRows[0].email;
        const oldEmailVerified = oldUserRows[0].email_verified;

        await db.query(
          `
UPDATE users

SET

name=?,
email=?,
email_verified=0,
verification_token=?,
verification_expired=?

WHERE id=?

`,

          [
            name,
            cleanEmail,
            token,
            expired,
            userId
          ]

        );

        const link =

          `${process.env.APP_URL}/auth/verify-email?token=${token}`;

        try {
          await transporter.sendMail({
            from: process.env.MAIL_FROM || process.env.MAIL_USER,
            to: cleanEmail,
            subject: "Verifikasi Email Baru",
            html: verifyEmailTemplate(name, link)
          });
        } catch (mailErr) {
          // Rollback email change
          await db.query(
            `UPDATE users SET email=?, email_verified=?, verification_token=NULL, verification_expired=NULL WHERE id=?`,
            [oldEmail, oldEmailVerified, userId]
          );
          throw new Error("Gagal mengirim email verifikasi. Pastikan konfigurasi SMTP di server Anda benar.");
        }

        return res.json({

          success: true,

          verifyEmail: true,

          message:
            "Email berhasil diubah. Silakan verifikasi email baru Anda."

        });

      }

      await db.query(

        `
UPDATE users

SET

name=?

WHERE id=?

`,

        [
          name,
          userId
        ]

      );

      await auditLog({
        user_id: userId,
        action: 'UPDATE_PROFILE',
        table: 'users',
        role: req.user.role,
        record_id: userId
      });

      res.json({

        success: true,

        message:
          "Profil berhasil diperbarui."

      });

    } catch (err) {

      console.log(err);

      res.status(500).json({

        message:
          err.message || "Server Error"

      });

    }

  });

/* ================= CHANGE PASSWORD ================= */

router.put(
  "/change-password",
  auth,
  async (req, res) => {

    try {

      const {
        oldPassword,
        newPassword
      } = req.body;

      if (
        !oldPassword ||
        !newPassword
      ) {

        return res.status(400).json({
          message:
            "Lengkapi semua field"
        });

      }

      if (
        newPassword.length < 8
      ) {

        return res.status(400).json({
          message:
            "Password minimal 8 karakter"
        });

      }

      const [[user]] =
        await db.query(
          `
SELECT password
FROM users
WHERE id=?
`,
          [req.user.id]
        );

      const match =
        await bcrypt.compare(
          oldPassword,
          user.password
        );

      if (!match) {

        return res.status(400).json({
          message:
            "Password lama salah"
        });

      }

      const hashedPassword =
        await bcrypt.hash(
          newPassword,
          10
        );

      await db.query(
        `
UPDATE users
SET password=?
WHERE id=?
`,
        [
          hashedPassword,
          req.user.id
        ]
      );

      res.json({
        message:
          "Password berhasil diperbarui"
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Server error"
      });

    }

  }
);

/* ================= UPLOAD FOTO ================= */
router.post(
  "/upload",
  auth,
  upload.single("photo"),
  async (req, res) => {
    try {
      const photo = req.file.path;
      const public_id = req.file.filename;

      // ambil user lama
      const [userData] = await db.query(
        "SELECT photo_public_id FROM users WHERE id = ?",
        [req.user.id]
      );

      // 🔥 hapus foto lama di cloudinary
      if (userData[0]?.photo_public_id) {
        await cloudinary.uploader.destroy(
          userData[0].photo_public_id
        );
      }

      // 🔥 update DB
      await db.query(
        "UPDATE users SET photo = ?, photo_public_id = ? WHERE id = ?",
        [photo, public_id, req.user.id]
      );

      res.json({
        message: "Foto berhasil diupload",
        photo,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;