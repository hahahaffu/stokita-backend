require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const favoriteRoutes = require("./routes/favorite");
const shoppingListRoutes = require("./routes/shoppingList");
const geocodeRoutes =
  require("./routes/geocode");
const addressRoutes = require("./routes/address");
const app = express();

/* ================= DB ================= */
const db = require("./db");

db.query("SELECT 1")
  .then(() => console.log("✅ Database connected"))
  .catch((err) => console.error("❌ DB Error:", err));

/* ================= MIDDLEWARE ================= */
const rateLimit = require("./middleware/rateLimit");

app.use(cors());
app.use(express.json());
app.use(rateLimit);

/* ================= SOCKET.IO ================= */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
  transports: ["websocket"],
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

/* ================= ROUTES ================= */
app.use("/settings", require("./routes/settings"));
app.use("/audit-logs", require("./routes/auditLogs"));
app.use("/auth", require("./routes/auth"));
app.use("/products", require("./routes/products"));
app.use("/stock", require("./routes/stock"));
app.use("/sales", require("./routes/sales"));
app.use("/orders", require("./routes/orders"));
app.use("/report", require("./routes/report"));
app.use("/dashboard", require("./routes/dashboard"));
app.use("/categories", require("./routes/categories"));
app.use("/notifications", require("./routes/notifications"));
app.use("/profile", require("./routes/profile"));
app.use("/uploads", express.static("uploads"));
app.use("/favorites", require("./routes/favorite"));
app.use("/cart", require("./routes/cart"));
app.use(
  "/shopping-list",
  shoppingListRoutes
);
app.use(
  "/api/geocode",
  geocodeRoutes
);
app.use("/address", addressRoutes);

/* ================= TEST ROUTE ================= */
app.get("/", (req, res) => {
  res.send("API Stokita running...");
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err);
  res.status(500).json({
    message: "Server error",
    error: err.message,
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});