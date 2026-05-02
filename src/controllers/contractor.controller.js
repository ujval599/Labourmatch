const path = require("path");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const prisma = require("../utils/prisma");

// ─── GET /api/contractors — Public (sirf verified) ───────────────
async function getAllContractors(req, res) {
  try {
    const { city, category, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where = { available: true, verified: true };

    if (city) where.city = { contains: city };
    if (category) where.category = category.toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { location: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const [contractors, total] = await Promise.all([
      prisma.contractor.findMany({
        where,
        orderBy: [{ isPremium: "desc" }, { rating: "desc" }],
        skip,
        take: limitNum,
        select: {
          id: true, name: true, location: true, city: true, category: true,
          workers: true, priceMin: true, priceMax: true, verified: true,
          imageUrl: true, rating: true, reviewCount: true, available: true,
          experienceYrs: true, isPremium: true, premiumPlan: true, premiumEndDate: true,
        },
      }),
      prisma.contractor.count({ where }),
    ]);

    const now = new Date();
    for (const c of contractors) {
      if (c.isPremium && c.premiumEndDate && new Date(c.premiumEndDate) < now) {
        await prisma.contractor.update({ where: { id: c.id }, data: { isPremium: false, premiumPlan: null } });
        c.isPremium = false;
      }
    }

    const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
    const data = contractors.map((c) => ({
      ...c,
      imageUrl: c.imageUrl
        ? c.imageUrl.startsWith("http") ? c.imageUrl : `${BASE_URL}/uploads/${path.basename(c.imageUrl)}`
        : null,
    }));

    return res.json({
      success: true, data,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getAllContractors error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GET /api/contractors/admin/all — Admin only ─────────────────
async function getAllContractorsAdmin(req, res) {
  try {
    const { verified } = req.query;
    const where = {};
    if (verified === "true") where.verified = true;
    if (verified === "false") where.verified = false;

    const contractors = await prisma.contractor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, phone: true, email: true,
        city: true, category: true, workers: true,
        priceMin: true, priceMax: true, verified: true,
        imageUrl: true, createdAt: true,
      },
    });

    const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
    const data = contractors.map((c) => ({
      ...c,
      imageUrl: c.imageUrl
        ? c.imageUrl.startsWith("http") ? c.imageUrl : `${BASE_URL}/uploads/${path.basename(c.imageUrl)}`
        : null,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error("getAllContractorsAdmin error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GET /api/contractors/:id ─────────────────────────────────────
async function getContractorById(req, res) {
  try {
    const { id } = req.params;
    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: {
        reviews: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
    if (!contractor) return res.status(404).json({ success: false, message: "Contractor not found" });

    const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
    const imageUrl = contractor.imageUrl
      ? contractor.imageUrl.startsWith("http") ? contractor.imageUrl : `${BASE_URL}/uploads/${path.basename(contractor.imageUrl)}`
      : null;

    return res.json({
      success: true,
      data: { ...contractor, imageUrl, priceRange: `₹${contractor.priceMin}-${contractor.priceMax}/day` },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── POST /api/contractors/register ──────────────────────────────
async function registerContractor(req, res) {
  try {
    const {
      name, phone, email,
      location, city, workers, workType,
      priceRange, experience, description
    } = req.body;

    if (!name || !phone || !location) {
      return res.status(400).json({ success: false, message: "Name, phone aur location required hain" });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Valid 10 digit phone number do" });
    }

    const existing = await prisma.contractor.findUnique({ where: { phone } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Yeh phone number already registered hai" });
    }

    // ✅ Price range parse karo
    let priceMin = 500, priceMax = 700;
    if (priceRange) {
      const parts = priceRange.replace(/[₹\s]/g, "").split("-");
      if (parts.length === 2) {
        priceMin = parseInt(parts[0]) || 500;
        priceMax = parseInt(parts[1]) || 700;
      }
    }

    // ✅ Image URL
    const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
    let imageUrl = null;
    if (req.file) {
      if (req.file.path && req.file.path.startsWith("http")) {
        imageUrl = req.file.path;
      } else {
        imageUrl = `${BASE_URL}/uploads/${path.basename(req.file.path)}`;
      }
    }

    // ✅ Category map
    const categoryMap = {
      construction: "CONSTRUCTION", CONSTRUCTION: "CONSTRUCTION",
      shifting: "SHIFTING", SHIFTING: "SHIFTING",
      loading: "LOADING_UNLOADING", LOADING_UNLOADING: "LOADING_UNLOADING",
      helpers: "HELPERS", HELPERS: "HELPERS",
      plumbing: "PLUMBING", PLUMBING: "PLUMBING",
      electrical: "ELECTRICAL", ELECTRICAL: "ELECTRICAL",
      painting: "PAINTING", PAINTING: "PAINTING",
      carpentry: "CARPENTRY", CARPENTRY: "CARPENTRY",
      cleaning: "CLEANING", CLEANING: "CLEANING",
      multiple: "MULTIPLE", MULTIPLE: "MULTIPLE",
    };

    // ✅ Password field nahi — production DB mein column nahi hai
    const contractor = await prisma.contractor.create({
      data: {
        name,
        phone,
        email: email || null,
        location,
        city: city || location.split(",").pop()?.trim() || "Unknown",
        category: categoryMap[workType] || "MULTIPLE",
        workers: parseInt(workers) || 5,
        priceMin,
        priceMax,
        experienceYrs: parseInt(experience) || 1,
        description: description || null,
        imageUrl,
        verified: false,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful! Your profile will be reviewed and activated within 24-48 hours.",
      data: { id: contractor.id, name: contractor.name },
    });

  } catch (error) {
    console.error("registerContractor error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── PUT /api/contractors/:id/verify — Admin only ────────────────
async function verifyContractor(req, res) {
  try {
    const contractor = await prisma.contractor.update({
      where: { id: req.params.id },
      data: { verified: true },
    });

    if (contractor.email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
        });

        await transporter.sendMail({
          from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
          to: contractor.email,
          subject: `🎉 Aapki Profile Live Ho Gayi! - LabourMatch`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0d9488, #f59e0b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">🎉 Congratulations!</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Aapki LabourMatch profile verify ho gayi!</p>
              </div>
              <div style="background: white; padding: 28px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; color: #374151;">Hello <strong>${contractor.name}</strong>,</p>
                <p style="color: #374151;">Hamari team ne aapki profile verify kar di hai. Ab aapki profile <strong>LabourMatch pe LIVE</strong> hai!</p>
                <div style="text-align: center; margin-top: 24px;">
                  <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/contractor/${contractor.id}"
                    style="background: linear-gradient(135deg, #0d9488, #f59e0b); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold;">
                    Apni Profile Dekho →
                  </a>
                </div>
              </div>
            </div>
          `,
        });
        console.log(`✅ Verification email sent to: ${contractor.email}`);
      } catch (emailErr) {
        console.error("❌ Verification email failed:", emailErr.message);
      }
    }

    return res.json({ success: true, message: "Contractor verified!", data: contractor });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── DELETE /api/contractors/:id — Admin only ────────────────────
async function deleteContractor(req, res) {
  try {
    await prisma.contractor.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: "Contractor deleted!" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GET /api/contractors/cities ─────────────────────────────────
async function getCities(req, res) {
  try {
    const cities = await prisma.contractor.findMany({
      select: { city: true },
      distinct: ["city"],
      where: { verified: true },
      orderBy: { city: "asc" },
    });
    return res.json({ success: true, data: cities.map((c) => c.city) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── PUT /api/contractors/:id/update ─────────────────────────────
async function updateContractorProfile(req, res) {
  try {
    const { id } = req.params;
    const { description, available } = req.body;

    if (req.user.id !== id && req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const updated = await prisma.contractor.update({
      where: { id },
      data: {
        description: description !== undefined ? description : undefined,
        available: available !== undefined ? Boolean(available) : undefined,
      },
    });

    return res.json({ success: true, message: "Profile updated!", data: updated });
  } catch (error) {
    console.error("updateContractorProfile error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── PUT /api/contractors/:id/photo ──────────────────────────────
async function updateContractorPhoto(req, res) {
  try {
    const { id } = req.params;

    if (req.user.id !== id && req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
    let imageUrl;
    if (req.file.path && req.file.path.startsWith("http")) {
      imageUrl = req.file.path;
    } else {
      imageUrl = `${BASE_URL}/uploads/${path.basename(req.file.path)}`;
    }

    const updated = await prisma.contractor.update({
      where: { id },
      data: { imageUrl },
    });

    return res.json({ success: true, message: "Photo updated!", data: { imageUrl: updated.imageUrl } });
  } catch (error) {
    console.error("updateContractorPhoto error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  getAllContractors, getAllContractorsAdmin,
  getContractorById, registerContractor,
  verifyContractor, deleteContractor, getCities,
  updateContractorProfile, updateContractorPhoto,
};