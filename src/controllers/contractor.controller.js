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

    let priceMin = 0, priceMax = 0;
    if (priceRange) {
      const cleaned = priceRange.replace(/[₹\s]/g, "");
      if (cleaned.includes("-")) {
        const parts = cleaned.split("-");
        priceMin = parseInt(parts[0]) || 0;
        priceMax = parseInt(parts[1]) || 0;
      } else {
        const val = parseInt(cleaned) || 0;
        priceMin = val; priceMax = val;
      }
    }

    const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path && req.file.path.startsWith("http")
        ? req.file.path
        : `${BASE_URL}/uploads/${path.basename(req.file.path)}`;
    }

    const categoryMap = {
      construction: "CONSTRUCTION", shifting: "SHIFTING",
      loading: "LOADING_UNLOADING", helpers: "HELPERS",
      plumbing: "PLUMBING", plumber: "PLUMBING",
      electrical: "ELECTRICAL", electrician: "ELECTRICAL",
      painting: "PAINTING", carpentry: "CARPENTRY", carpenter: "CARPENTRY",
      cleaning: "CLEANING", interior: "INTERIOR", interior_designer: "INTERIOR",
      multiple: "MULTIPLE",
    };

    // ✅ Contractor create karo
    const contractor = await prisma.contractor.create({
      data: {
        name, phone,
        email: email || null,
        location,
        city: city || location.split(",").pop()?.trim() || "Unknown",
        category: categoryMap[workType?.toLowerCase()] || "MULTIPLE",
        workers: parseInt(workers) || 5,
        priceMin, priceMax,
        experienceYrs: parseInt(experience) || 1,
        description: description || null,
        imageUrl,
        verified: false,
      },
    });

    // ✅ Work media save karo (jo registration form se aaya)
    const workMediaFiles = req.files?.workMedia || [];
    if (workMediaFiles.length > 0) {
      const mediaData = workMediaFiles.map((file, i) => {
        const fileUrl = file.path && file.path.startsWith("http")
          ? file.path
          : `${BASE_URL}/uploads/${path.basename(file.path)}`;

        const type = file.mimetype?.startsWith("video") ? "video" : "image";
        const caption = req.body[`workMediaCaption_${i}`] || "";

        return {
          contractorId: contractor.id,
          type,
          url: fileUrl,
          caption: caption || null,
        };
      });

      // Sab media ek saath save karo
      await prisma.workMedia.createMany({ data: mediaData });
      console.log(`✅ ${mediaData.length} work media saved for contractor ${contractor.id}`);
    }

    // ✅ Admin ko email notification bhejo
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com", port: 465, secure: true,
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
        });
        await transporter.sendMail({
          from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
          to: process.env.GMAIL_USER,
          subject: `🆕 New Contractor Registration - ${name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #16a34a, #0d9488); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h2 style="color: white; margin: 0;">New Contractor Registration</h2>
              </div>
              <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Email:</strong> ${email || "Not provided"}</p>
                <p><strong>City:</strong> ${city || location}</p>
                <p><strong>Work Type:</strong> ${workType}</p>
                <p><strong>Experience:</strong> ${experience} years</p>
                <p><strong>Workers:</strong> ${workers}</p>
                <p><strong>Work Media:</strong> ${workMediaFiles.length} files uploaded</p>
                <div style="text-align: center; margin-top: 20px;">
                  <a href="${process.env.FRONTEND_URL}/admin" style="background: linear-gradient(135deg, #16a34a, #0d9488); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    Review in Admin Dashboard
                  </a>
                </div>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Admin notification email failed:", emailErr.message);
      }
    }

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
          host: "smtp.gmail.com", port: 465, secure: true,
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
        });
        await transporter.sendMail({
          from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
          to: contractor.email,
          subject: `🎉 Aapki Profile Live Ho Gayi! - LabourMatch`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #16a34a, #0d9488); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;"><h1 style="color: white; margin: 0;">🎉 Congratulations!</h1></div><div style="background: white; padding: 28px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;"><p>Hello <strong>${contractor.name}</strong>, aapki profile ab LabourMatch pe LIVE hai!</p><div style="text-align: center; margin-top: 24px;"><a href="${process.env.FRONTEND_URL}/contractor/${contractor.id}" style="background: linear-gradient(135deg, #16a34a, #0d9488); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold;">Apni Profile Dekho</a></div></div></div>`,
        });
      } catch (emailErr) {
        console.error("Verification email failed:", emailErr.message);
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

    const contractor = await prisma.contractor.findUnique({ where: { id } });
    if (!contractor) return res.status(404).json({ success: false, message: "Contractor not found" });

    const isOwner = contractor.phone === req.user.phone;
    if (!isOwner && req.user.role !== "ADMIN") {
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

    const contractor = await prisma.contractor.findUnique({ where: { id } });
    if (!contractor) return res.status(404).json({ success: false, message: "Contractor not found" });

    const isOwner = contractor.phone === req.user.phone;
    if (!isOwner && req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    let imageUrl;
    if (req.file.path && req.file.path.startsWith("http")) {
      imageUrl = req.file.path;
    } else {
      const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
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