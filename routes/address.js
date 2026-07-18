const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");
const auditLog = require("../utils/auditLog");

router.get("/", auth, async (req, res) => {
    try {

        const [rows] = await db.query(
            `
      SELECT *
      FROM user_addresses
      WHERE user_id=?
      ORDER BY is_primary DESC,id DESC
      `,
            [req.user.id]
        );

        res.json(rows);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Server error"
        });

    }
});

router.post("/", auth, async (req, res) => {

    try {

        const {
            label,
            receiver_name,
            phone,
            address,
            latitude,
            longitude
        } = req.body;

        if (
            !receiver_name ||
            !phone ||
            !address
        ) {

            return res.status(400).json({
                message: "Data belum lengkap."
            });

        }

        const [[total]] = await db.query(
            `
      SELECT COUNT(*) total
      FROM user_addresses
      WHERE user_id=?
      `,
            [req.user.id]
        );

        const isPrimary =
            total.total === 0 ? 1 : 0;

        const [result] = await db.query(
            `
      INSERT INTO user_addresses
      (
        user_id,
        label,
        receiver_name,
        phone,
        address,
        latitude,
        longitude,
        is_primary
      )

      VALUES(?,?,?,?,?,?,?,?)
      `,
            [
                req.user.id,
                label || "Lainnya",
                receiver_name,
                phone,
                address,
                latitude,
                longitude,
                isPrimary
            ]
        );

        await auditLog({
            user_id: req.user.id,
            action: 'ADD_ADDRESS',
            table: 'user_addresses',
            role: req.user.role,
            record_id: result.insertId
        });

        res.json({

            success: true,

            message: "Alamat berhasil ditambahkan.",

            id: result.insertId

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Server error"
        });

    }

});

router.put("/:id", auth, async (req, res) => {

    try {

        const {
            label,
            receiver_name,
            phone,
            address,
            latitude,
            longitude
        } = req.body;

        await db.query(
            `
      UPDATE user_addresses

      SET

      label=?,
      receiver_name=?,
      phone=?,
      address=?,
      latitude=?,
      longitude=?

      WHERE id=?
      AND user_id=?
      `,
            [
                label,
                receiver_name,
                phone,
                address,
                latitude,
                longitude,
                req.params.id,
                req.user.id
            ]
        );

        await auditLog({
            user_id: req.user.id,
            action: 'UPDATE_ADDRESS',
            table: 'user_addresses',
            role: req.user.role,
            record_id: req.params.id
        });

        res.json({

            success: true,

            message: "Alamat berhasil diperbarui."

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Server error"
        });

    }

});

router.put("/:id/primary", auth, async (req, res) => {

    const conn = await db.getConnection();

    try {

        await conn.beginTransaction();

        await conn.query(
            `
      UPDATE user_addresses

      SET is_primary=0

      WHERE user_id=?
      `,
            [req.user.id]
        );

        await conn.query(
            `
      UPDATE user_addresses

      SET is_primary=1

      WHERE id=?
      AND user_id=?
      `,
            [
                req.params.id,
                req.user.id
            ]
        );

        await conn.commit();

        res.json({

            success: true,

            message: "Alamat utama berhasil diubah."

        });

    } catch (err) {

        await conn.rollback();

        console.log(err);

        res.status(500).json({
            message: "Server error"
        });

    } finally {

        conn.release();

    }

});

router.delete("/:id", auth, async (req, res) => {

    const conn = await db.getConnection();

    try {

        await conn.beginTransaction();

        const [[deleted]] =
            await conn.query(
                `
      SELECT *

      FROM user_addresses

      WHERE id=?
      AND user_id=?
      `,
                [
                    req.params.id,
                    req.user.id
                ]
            );

        if (!deleted) {

            return res.status(404).json({
                message: "Alamat tidak ditemukan."
            });

        }

        await conn.query(
            `
      DELETE FROM user_addresses
      WHERE id=?
      `,
            [req.params.id]
        );

        if (deleted.is_primary) {

            const [[next]] =
                await conn.query(
                    `
        SELECT id

        FROM user_addresses

        WHERE user_id=?

        LIMIT 1
        `,
                    [req.user.id]
                );

            if (next) {

                await conn.query(
                    `
          UPDATE user_addresses

          SET is_primary=1

          WHERE id=?
          `,
                    [next.id]
                );

            }

        }

        await conn.commit();

        res.json({

            success: true,

            message: "Alamat berhasil dihapus."

        });

    } catch (err) {

        await conn.rollback();

        console.log(err);

        res.status(500).json({
            message: "Server error"
        });

    } finally {

        conn.release();

    }

});

module.exports = router;