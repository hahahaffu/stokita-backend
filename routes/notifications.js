const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

/* ================= GET ALL ================= */
router.get("/", auth, async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC",
    [req.user.id]
  );

  res.json(rows);
});

/* ================= UNREAD COUNT ================= */
router.get("/unread-count", auth, async (req, res) => {
  const [rows] = await db.query(
    "SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=0",
    [req.user.id]
  );

  res.json({ count: rows[0].count });
});

/* ================= MARK ALL READ ================= */
router.put("/read-all", auth, async (req, res) => {
  await db.query(
    "UPDATE notifications SET is_read=1 WHERE user_id=?",
    [req.user.id]
  );

  res.json({ message: "All notifications marked as read" });
});

/* ================= MARK SINGLE READ ================= */
router.put("/:id/read", auth, async (req, res) => {
  await db.query(
    "UPDATE notifications SET is_read=1 WHERE id=?",
    [req.params.id]
  );

  res.json({ message: "Notification read" });
});

router.put(
"/clear-tab",
auth,
async(req,res)=>{

try{

const {tab}=req.body;

let type="";

if(tab==="stok"){
type="stock";
}

if(tab==="pesanan"){
type="order";
}

if(tab==="transaksi"){
type="transaction";
}

await db.query(
`
DELETE FROM notifications
WHERE user_id=?
AND type=?
`,
[
req.user.id,
type
]
);

res.json({
message:"Berhasil"
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});

module.exports = router;