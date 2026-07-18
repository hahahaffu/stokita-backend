const rateLimit = require("express-rate-limit");

module.exports = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 1000,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message: "Terlalu banyak request, coba lagi nanti."
  }

});