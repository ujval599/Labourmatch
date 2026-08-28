// src/routes/contractor.routes.js
const express = require("express");
const router = express.Router();
const {
  getAllContractors,
  getAllContractorsAdmin,
  getContractorById,
  registerContractor,
  verifyContractor,
  deleteContractor,
  getCities,
  updateContractorProfile,
  updateContractorPhoto,
} = require("../controllers/contractor.controller");
const { authenticate, adminOnly } = require("../middleware/auth.middleware");
const { upload } = require("../utils/cloudinary");
const prisma = require("../utils/prisma");
const path = require("path");

// ── Public routes ──
router.get("/", getAllContractors);
router.get("/cities", getCities);
router.post("/register", upload.single("image"), registerContractor);

// ── Phone check ──
router.get("/check", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.json({ isContractor: false });
    const contractor = await prisma.contractor.findUnique({ where: { phone: String(phone) } });
    return res.json({ isContractor: !!contractor, contractorId: contractor?.id || null });
  } catch {
    return res.json({ isContractor: false });
  }
});

// ✅ FIXED: Contractor apna full profile dekhe
router.get("/my-profile", authenticate, async (req, res) => {
  try {
    let contractorPhone;

    // ✅ Contractor token hai toh directly phone use karo
    if (req.user.isContractor) {
      contractorPhone = req.user.phone;
    } else {
      // Normal user hai toh user table se phone lo
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return res.status(404).json({ success: false, message: "User nahi mila" });
      contractorPhone = user.phone;
    }

    const contractor = await prisma.contractor.findUnique({
      where: { phone: contractorPhone },
      include: {
        reviews: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        bookings: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, phone: true } } },
        },
        workMedia: { orderBy: { createdAt: "desc" } },
        receivedMessages: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, phone: true } } },
        },
      },
    });

    if (!contractor) return res.status(404).json({ success: false, message: "Contractor profile nahi mila. Pehle register karo." });

    const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
    const imageUrl = contractor.imageUrl
      ? contractor.imageUrl.startsWith("http") ? contractor.imageUrl : `${BASE_URL}/uploads/${path.basename(contractor.imageUrl)}`
      : null;

    // ✅ Group messages by user
    const messagesByUser = {};
    contractor.receivedMessages.forEach(msg => {
      const uid = msg.userId;
      if (!messagesByUser[uid]) {
        messagesByUser[uid] = {
          user: msg.user,
          messages: [],
          unreadCount: 0,
          lastMessage: null,
        };
      }
      messagesByUser[uid].messages.push(msg);
      if (!msg.isRead && msg.senderRole === "user") messagesByUser[uid].unreadCount++;
      if (!messagesByUser[uid].lastMessage || new Date(msg.createdAt) > new Date(messagesByUser[uid].lastMessage.createdAt)) {
        messagesByUser[uid].lastMessage = msg;
      }
    });

    return res.json({
      success: true,
      data: {
        ...contractor,
        imageUrl,
        chatUsers: Object.values(messagesByUser),
      }
    });
  } catch (error) {
    console.error("my-profile error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── Admin routes ──
router.get("/admin/all", authenticate, adminOnly, getAllContractorsAdmin);
router.put("/:id/verify", authenticate, adminOnly, verifyContractor);
router.delete("/:id", authenticate, adminOnly, deleteContractor);

// ✅ Contractor profile update
router.put("/:id/update", authenticate, updateContractorProfile);

// ✅ Contractor photo update
router.put("/:id/photo", authenticate, upload.single("image"), updateContractorPhoto);

// ── Public — last mein rakho ──
router.get("/:id", getContractorById);

module.exports = router;