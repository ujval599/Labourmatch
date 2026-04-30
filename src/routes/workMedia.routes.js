// labourmatch-backend/src/routes/workMedia.routes.js

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { getWorkMedia, uploadWorkMedia, deleteWorkMedia } = require("../controllers/workMedia.controller");

// Multer config — uploads folder mein save karo
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    // Spaces hata do filename se
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|mp4|mov|avi/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Sirf image aur video files allowed hain"));
  },
});

// Routes
router.get("/:contractorId", getWorkMedia);
router.post("/:contractorId", upload.single("file"), uploadWorkMedia);
router.delete("/:id", deleteWorkMedia);

module.exports = router;