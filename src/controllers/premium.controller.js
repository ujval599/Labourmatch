// src/controllers/premium.controller.js
const prisma = require("../utils/prisma");

// ✅ 3 plans — frontend ke IDs se match karte hain
const PLANS = {
  "basic":    { label: "Basic",    duration: 30,  amount: 699  },
  "standard": { label: "Standard", duration: 90,  amount: 1499 },
  "premium":  { label: "Premium",  duration: 365, amount: 4999 },
};

// POST /api/premium/request
async function requestPremium(req, res) {
  try {
    const { contractorPhone, plan } = req.body;

    if (!contractorPhone || !plan) {
      return res.status(400).json({ success: false, message: "Phone aur plan required hain" });
    }

    if (!PLANS[plan]) {
      return res.status(400).json({ success: false, message: "Invalid plan. Choose basic, standard ya premium" });
    }

    const contractor = await prisma.contractor.findUnique({ where: { phone: contractorPhone } });
    if (!contractor) {
      return res.status(404).json({ success: false, message: "Contractor nahi mila. Pehle register karo." });
    }

    // Already pending request?
    const existing = await prisma.premiumRequest.findFirst({
      where: { contractorId: contractor.id, status: "PENDING" },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "Aapki ek request already pending hai. Admin approve karega jaldi." });
    }

    const planInfo = PLANS[plan];
    const request = await prisma.premiumRequest.create({
      data: {
        contractorId: contractor.id,
        plan: planInfo.label,
        duration: plan,
        amount: planInfo.amount,
        status: "PENDING",
      },
    });

    return res.status(201).json({
      success: true,
      message: `Premium request submit ho gayi! ₹${planInfo.amount} ka payment karo aur admin approve karega.`,
      data: {
        requestId: request.id,
        plan: planInfo.label,
        amount: planInfo.amount,
        paymentInfo: {
          note: `Premium - ${contractor.name} - ${planInfo.label}`,
        },
      },
    });
  } catch (error) {
    console.error("requestPremium error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/premium/plans
async function getPlans(req, res) {
  return res.json({
    success: true,
    data: [
      {
        id: "basic",
        label: "Basic",
        duration: "1 Month",
        amount: 699,
        features: [
          "Profile listed at top for 1 month",
          "Priority in search results",
          "Premium badge on profile",
          "More visibility to users",
        ],
        popular: false,
      },
      {
        id: "standard",
        label: "Standard",
        duration: "3 Months",
        amount: 1499,
        features: [
          "Profile listed at top for 3 months",
          "Priority in search results",
          "Premium badge on profile",
          "More visibility to users",
          "Save ₹597 vs monthly",
        ],
        popular: true,
      },
      {
        id: "premium",
        label: "Premium",
        duration: "1 Year",
        amount: 4999,
        features: [
          "Profile listed at top for 1 year",
          "Highest priority in search results",
          "Premium badge on profile",
          "Maximum visibility to users",
          "Save ₹3395 vs monthly",
          "Featured contractor status",
        ],
        popular: false,
      },
    ],
  });
}

// GET /api/premium/status/:phone
async function getPremiumStatus(req, res) {
  try {
    const { phone } = req.params;
    const contractor = await prisma.contractor.findUnique({
      where: { phone },
      select: {
        id: true, name: true, isPremium: true,
        premiumPlan: true, premiumEndDate: true,
        premiumRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!contractor) {
      return res.status(404).json({ success: false, message: "Contractor nahi mila" });
    }

    const isExpired = contractor.premiumEndDate && new Date() > new Date(contractor.premiumEndDate);
    if (isExpired && contractor.isPremium) {
      await prisma.contractor.update({
        where: { id: contractor.id },
        data: { isPremium: false, premiumPlan: null },
      });
    }

    return res.json({
      success: true,
      data: {
        isPremium: contractor.isPremium && !isExpired,
        premiumPlan: contractor.premiumPlan,
        premiumEndDate: contractor.premiumEndDate,
        latestRequest: contractor.premiumRequests[0] || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// PUT /api/premium/approve/:requestId  (Admin only)
async function approvePremium(req, res) {
  try {
    const { requestId } = req.params;
    const { adminNote } = req.body;

    const request = await prisma.premiumRequest.findUnique({
      where: { id: requestId },
      include: { contractor: true },
    });

    if (!request) {
      return res.status(404).json({ success: false, message: "Request nahi mili" });
    }

    // Duration plan ke hisaab se
    const planDays = PLANS[request.duration]?.duration
      || (request.duration === "1year" ? 365 : request.duration === "3months" ? 90 : 30);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planDays);

    await prisma.premiumRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", adminNote: adminNote || "Approved" },
    });

    // ✅ Premium activate + isPremium true + verified true (first mein dikhega)
    await prisma.contractor.update({
      where: { id: request.contractorId },
      data: {
        isPremium: true,
        premiumPlan: request.plan,
        premiumStartDate: startDate,
        premiumEndDate: endDate,
        verified: true, // ✅ Profile live bhi ho jaye
      },
    });

    return res.json({
      success: true,
      message: `Premium activate ho gaya! ${request.contractor.name} ab ${request.plan} pe hai.`,
      data: { endDate },
    });
  } catch (error) {
    console.error("approvePremium error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// PUT /api/premium/reject/:requestId  (Admin only)
async function rejectPremium(req, res) {
  try {
    const { requestId } = req.params;
    const { adminNote } = req.body;

    await prisma.premiumRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", adminNote: adminNote || "Rejected" },
    });

    return res.json({ success: true, message: "Request reject ho gayi" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// GET /api/premium/requests  (Admin only)
async function getAllRequests(req, res) {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};

    const requests = await prisma.premiumRequest.findMany({
      where,
      include: {
        contractor: {
          select: { id: true, name: true, phone: true, location: true, city: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, data: requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { requestPremium, getPlans, getPremiumStatus, approvePremium, rejectPremium, getAllRequests };