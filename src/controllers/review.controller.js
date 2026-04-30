// src/controllers/review.controller.js
const prisma = require("../utils/prisma");

// POST /api/reviews/:contractorId  (login required)
async function addReview(req, res) {
  try {
    const { contractorId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating 1 se 5 ke beech honi chahiye" });
    }

    // Contractor exists?
    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) {
      return res.status(404).json({ success: false, message: "Contractor nahi mila" });
    }

    // ✅ Apne aap ko review nahi de sakte
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && contractor.phone === user.phone) {
      return res.status(403).json({ success: false, message: "Aap apne aap ko review nahi de sakte" });
    }

    // Already reviewed?
    const existing = await prisma.review.findUnique({
      where: { contractorId_userId: { contractorId, userId } },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "Aapne is contractor ko already review diya hai" });
    }

    const review = await prisma.review.create({
      data: { contractorId, userId, rating: parseInt(rating), comment: comment || null },
      include: { user: { select: { id: true, name: true } } },
    });

    // Update contractor's average rating
    const allReviews = await prisma.review.findMany({
      where: { contractorId },
      select: { rating: true },
    });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: allReviews.length,
      },
    });

    return res.status(201).json({ success: true, message: "Review add ho gaya!", data: review });
  } catch (error) {
    console.error("addReview error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/reviews/:contractorId
async function getReviews(req, res) {
  try {
    const { contractorId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { contractorId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.review.count({ where: { contractorId } }),
    ]);

    return res.json({
      success: true,
      data: reviews,
      pagination: { page: parseInt(page), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// DELETE /api/reviews/:id  (Admin only)
async function deleteReview(req, res) {
  try {
    const { id } = req.params;
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return res.status(404).json({ success: false, message: "Review nahi mila" });

    await prisma.review.delete({ where: { id } });

    const allReviews = await prisma.review.findMany({
      where: { contractorId: review.contractorId },
      select: { rating: true },
    });
    const avgRating = allReviews.length
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

    await prisma.contractor.update({
      where: { id: review.contractorId },
      data: { rating: Math.round(avgRating * 10) / 10, reviewCount: allReviews.length },
    });

    return res.json({ success: true, message: "Review delete ho gaya" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { addReview, getReviews, deleteReview };