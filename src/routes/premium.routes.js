// src/routes/premium.routes.js
const express = require("express");
const router = express.Router();
const {
  requestPremium,
  getPlans,
  getPremiumStatus,
  approvePremium,
  rejectPremium,
  getAllRequests,
} = require("../controllers/premium.controller");
const { authenticate, adminOnly } = require("../middleware/auth.middleware");

// Public
router.get("/plans", getPlans);
router.get("/status/:phone", getPremiumStatus);
router.post("/request", requestPremium);

// Admin only
router.get("/requests", authenticate, adminOnly, getAllRequests);
router.put("/approve/:requestId", authenticate, adminOnly, approvePremium);
router.put("/reject/:requestId", authenticate, adminOnly, rejectPremium);

module.exports = router;
