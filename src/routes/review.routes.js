// src/routes/review.routes.js
const express = require("express");
const router = express.Router();
const { addReview, getReviews, deleteReview } = require("../controllers/review.controller");
const { authenticate, adminOnly } = require("../middleware/auth.middleware");

router.get("/:contractorId", getReviews);
router.post("/:contractorId", authenticate, addReview);
router.delete("/:id", authenticate, adminOnly, deleteReview);

module.exports = router;
