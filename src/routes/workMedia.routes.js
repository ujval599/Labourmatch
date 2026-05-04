// labourmatch-backend/src/routes/workMedia.routes.js

const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const { getWorkMedia, uploadWorkMedia, deleteWorkMedia } = require("../controllers/workMedia.controller");

// ✅ FIX: Cloudinary configure karo
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ FIX: Cloudinary storage — local disk nahi
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: "labourmatch/work-media",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "avi"],
      transformation: isVideo
        ? [{ width: 1280, height: 720, crop: "limit" }]
        : [{ width: 1200, height: 1200, crop: "limit" }],
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

// Routes
router.get("/:contractorId", getWorkMedia);
router.post("/:contractorId", upload.single("file"), uploadWorkMedia);
router.delete("/:id", deleteWorkMedia);

module.exports = router;