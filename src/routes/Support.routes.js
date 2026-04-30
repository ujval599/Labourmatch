// src/routes/support.routes.js
const express = require("express");
const router = express.Router();
const {
  getMySupport,
  sendSupportMessage,
  getAllSupportChats,
  getUserSupportChat,
  adminReply,
} = require("../controllers/Support.controller");
const { authenticate } = require("../middleware/auth.middleware");

// ── User routes ──
router.get("/", authenticate, getMySupport);
router.post("/", authenticate, sendSupportMessage);

// ── Admin routes ──
router.get("/admin/all", authenticate, getAllSupportChats);
router.get("/admin/:userId", authenticate, getUserSupportChat);
router.post("/admin/:userId", authenticate, adminReply);

module.exports = router;