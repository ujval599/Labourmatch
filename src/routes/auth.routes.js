// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const {
  sendOTPHandler, verifyOTPHandler,
  forgotPassword, resetPassword,
  register, login, getMe, updateProfile,
} = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");

// OTP Auth
router.post("/send-otp", sendOTPHandler);
router.post("/verify-otp", verifyOTPHandler);

// Forgot Password
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Email/Password Auth
router.post("/register", register);
router.post("/login", login);

// Protected
router.get("/me", authenticate, getMe);
router.put("/profile", authenticate, updateProfile);

module.exports = router;