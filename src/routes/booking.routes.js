// src/routes/booking.routes.js
const express = require("express");
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  updateBookingStatus,
  getAllBookings,
} = require("../controllers/booking.controller");
const { authenticate, adminOnly } = require("../middleware/auth.middleware");

router.post("/", authenticate, createBooking);
router.get("/my", authenticate, getMyBookings);
router.get("/", authenticate, adminOnly, getAllBookings);
router.put("/:id/status", authenticate, adminOnly, updateBookingStatus);

module.exports = router;
