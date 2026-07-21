const express = require("express");
const router = express.Router();

const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const validator = require("validator");
const crypto = require("crypto");
const auditLog = require("../utils/auditLog");

require("dotenv").config();

const SECRET_KEY =
  process.env.JWT_SECRET;

const sendVerificationEmail =
  require("../utils/brevoMailer");

const {
  verifyEmailTemplate
} = require("../utils/emailTemplate");


/* ================= REGISTER ================= */

router.post(
  "/register",
  async (req, res) => {

    const {
      name,
      email,
      phone,
      password
    } = req.body;

    const cleanEmail =
      email.trim().toLowerCase();

    if (!validator.isEmail(cleanEmail)) {

      return res.status(400).json({

        message:
          "Format email tidak valid"

      });

    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!passwordRegex.test(password)) {

      return res.status(400).json({

        message:
          "Password minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka."

      });

    }

    if (
      !name?.trim() ||
      !cleanEmail ||
      !password
    ) {

      return res.status(400)
        .json({
          message:
            "Data tidak lengkap"
        });

    }

    let newUserId;
    try {

      /* cek email */

      const [exist] =
        await db.query(
          `
SELECT id
FROM users
WHERE email=?
AND deleted_at IS NULL
`,
          [cleanEmail]
        );

      if (
        exist.length > 0
      ) {

        return res.status(400)
          .json({
            message:
              "Email sudah terdaftar"
          });

      }


      /* HASH PASSWORD */

      const hashedPassword =
        await bcrypt.hash(
          password.trim(),
          10
        );

      /* ================= VERIFICATION TOKEN ================= */

      const verificationToken =
        crypto.randomBytes(32).toString("hex");

      const verificationExpired =
        new Date(
          Date.now() + 24 * 60 * 60 * 1000
        );

      /* INSERT USER */

      const [result] = await db.query(
        `
INSERT INTO users
(
name,
email,
email_verified,
verification_token,
verification_expired,
password,
phone,
role,
fcm_token,
photo,
photo_public_id
)

VALUES
(
?,
?,
0,
?,
?,
?,
?,
'pelanggan',
NULL,
NULL,
NULL
)
`,
        [
          name,
          cleanEmail,
          verificationToken,
          verificationExpired,
          hashedPassword,
          phone || null
        ]
      );

      newUserId = result.insertId;

      await auditLog({
        user_id: newUserId,
        action: 'REGISTER',
        table: 'users',
        role: 'pelanggan',
        record_id: newUserId
      });

      const verifyLink =

        `${process.env.APP_URL}/auth/verify-email?token=${verificationToken}`;

      try {
        await sendVerificationEmail({

          to: cleanEmail,

          name,

          subject: "Verifikasi Email Stokita",

          html: verifyEmailTemplate(name, verifyLink),

        });
      } catch (mailErr) {
        console.error("SMTP ERROR:", mailErr);
        throw mailErr;
      }

      res.json({

        success: true,

        message:

          "Registrasi berhasil. Silakan cek email Anda untuk melakukan verifikasi akun."

      });

    } catch (err) {

      if (newUserId) {
        await db.query(
          `DELETE FROM users WHERE id=?`,
          [newUserId]
        );
      }

      console.log(
        "REGISTER ERROR:",
        err
      );

      res.status(500)
        .json({
          message: err.message || "Server error"
        });

    }

  });


router.get(
  "/verify-email",
  async (req, res) => {

    const {
      token
    } = req.query;

    if (!token) {

      return res
        .status(400)
        .send("Token tidak valid");

    }

    try {

      const [rows] =
        await db.query(

          `
SELECT id
FROM users
WHERE verification_token=?
AND verification_expired>NOW()
`,
          [token]

        );

      if (rows.length === 0) {

        return res
          .status(400)
          .send("Link verifikasi sudah tidak berlaku.");

      }

      await db.query(

        `
UPDATE users

SET

email_verified=1,

verification_token=NULL,

verification_expired=NULL

WHERE id=?
`,
        [
          rows[0].id
        ]

      );

      res.send(`

<h2>Email berhasil diverifikasi ✅</h2>

<p>

Sekarang Anda dapat login
ke aplikasi Stokita.

</p>

`);

    } catch (err) {

      console.log(err);

      res.status(500)
        .send("Server Error");

    }

  });


router.post(

  "/resend-verification",

  async (req, res) => {

    const {

      email

    } = req.body;

    const cleanEmail =
      email.trim().toLowerCase();

    const [rows] =
      await db.query(

        `
SELECT *
FROM users
WHERE email=?
`,
        [
          cleanEmail
        ]

      );

    if (rows.length === 0) {

      return res.status(404)
        .json({

          message:
            "Email tidak ditemukan"

        });

    }

    const user =
      rows[0];

    if (user.email_verified) {

      return res.status(400)
        .json({

          message:
            "Email sudah diverifikasi"

        });

    }

    const token =

      crypto.randomBytes(32)
        .toString("hex");

    const expired =

      new Date(
        Date.now() + 86400000
      );

    await db.query(

      `
UPDATE users

SET

verification_token=?,

verification_expired=?

WHERE id=?
`,

      [
        token,
        expired,
        user.id
      ]

    );

    const link =

      `${process.env.APP_URL}/auth/verify-email?token=${token}`;

    try {
      await sendVerificationEmail({
        to: cleanEmail,
        name: user.name,
        subject: "Verifikasi Email Stokita",
        html: verifyEmailTemplate(user.name, link),
      });
    } catch (mailErr) {
      console.error("SMTP ERROR:", mailErr);
      throw mailErr;
    }

    res.json({

      success: true,

      message:
        "Email berhasil dikirim."

    });

  });

/* ================= LOGIN ================= */

router.post(
  "/login",
  async (req, res) => {

    const {
      email,
      password
    } = req.body;

    const cleanEmail =
      email.trim().toLowerCase();

    if (
      !email ||
      !password
    ) {

      return res.status(400)
        .json({
          message:
            "Email dan password wajib diisi"
        });

    }

    try {

      const [rows] =
        await db.query(
          `
SELECT *
FROM users
WHERE email=?
AND deleted_at IS NULL
`,
          [cleanEmail]
        );

      if (
        rows.length === 0
      ) {

        return res.status(401)
          .json({
            message:
              "Email atau password salah"
          });

      }

      const user =
        rows[0];

      if (!user.email_verified) {

        return res
          .status(403)
          .json({

            message:

              "Email belum diverifikasi. Silakan cek email Anda."

          });

      }

      const match =
        await bcrypt.compare(
          password.trim(),
          user.password
        );

      if (!match) {

        return res.status(401)
          .json({
            message:
              "Email atau password salah"
          });

      }

      if (
        !SECRET_KEY
      ) {

        return res.status(500)
          .json({
            message:
              "JWT SECRET belum ada"
          });

      }

      const token =
        jwt.sign(

          {
            id: user.id,
            role: user.role
          },

          SECRET_KEY,

          {
            expiresIn: "1d"
          }

        );

      await auditLog({
        user_id: user.id,
        action: 'LOGIN',
        table: 'users',
        role: user.role,
        record_id: user.id
      });

      res.json({

        success: true,

        token,

        user: {

          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,

          latitude: user.latitude,
          longitude: user.longitude,

          role: user.role,
          photo: user.photo

        }

      });

    } catch (err) {

      console.log(
        "LOGIN ERROR:",
        err
      );

      res.status(500)
        .json({
          message:
            "Server error"
        });

    }

  });


/* ================= SAVE FCM TOKEN ================= */

router.post("/save-fcm", auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token FCM tidak valid" });

    await db.query(
      `UPDATE users SET fcm_token = ? WHERE id = ?`,
      [token, req.user.id]
    );
    
    res.json({ success: true, message: "FCM Token berhasil disimpan" });
  } catch (err) {
    console.error("SAVE FCM ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;