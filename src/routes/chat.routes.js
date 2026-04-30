// src/routes/chat.routes.js
const express = require("express");
const router = express.Router();
const {
  getMessages,
  getMessagesAsContractor,
  sendMessage,
  replyAsContractor,
  clearChat,
} = require("../controllers/chat.controller");
const { authenticate } = require("../middleware/auth.middleware");

// ── Contractor routes — PEHLE rakho ──
router.get("/contractor/:userId", authenticate, getMessagesAsContractor);
router.post("/contractor/:userId/reply", authenticate, replyAsContractor);

// ── User routes ──
router.get("/:contractorId", authenticate, getMessages);
router.post("/:contractorId", authenticate, sendMessage);
router.delete("/:contractorId", authenticate, clearChat);

module.exports = router;