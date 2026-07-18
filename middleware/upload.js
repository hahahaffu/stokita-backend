const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "stokita/profile",

      allowed_formats: ["jpg", "png", "jpeg"],

      public_id: `user_${req.user.id}_${Date.now()}`,

      transformation: [
        {
          width: 300,
          height: 300,
          crop: "fill",
        },
        {
          quality: "auto",
          fetch_format: "auto",
        },
      ],
    };
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Format harus JPG / PNG"));
    }

    cb(null, true);
  },
});

module.exports = upload;