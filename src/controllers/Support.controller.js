// src/controllers/support.controller.js
const prisma = require("../utils/prisma");
const nodemailer = require("nodemailer");

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });
}

// ── GET /api/support — User apne messages dekhe ──────────────────
async function getMySupport(req, res) {
  try {
    const messages = await prisma.supportMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "asc" },
    });

    // Mark admin messages as read
    await prisma.supportMessage.updateMany({
      where: { userId: req.user.id, senderRole: "admin", isRead: false },
      data: { isRead: true },
    });

    return res.json({ success: true, data: messages });
  } catch (error) {
    console.error("getMySupport error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── POST /api/support — User message bheje ───────────────────────
async function sendSupportMessage(req, res) {
  try {
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message empty nahi ho sakta" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const message = await prisma.supportMessage.create({
      data: {
        userId,
        text: text.trim(),
        senderRole: "user",
      },
    });

    // ✅ Admin ko email notification
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"LabourMatch Support" <${process.env.GMAIL_USER}>`,
          to: process.env.GMAIL_USER,
          subject: `💬 New Support Message from ${user?.name || "User"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0d9488, #f59e0b); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h2 style="color: white; margin: 0;">💬 New Support Message</h2>
              </div>
              <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                <p><strong>From:</strong> ${user?.name} (${user?.phone})</p>
                <p><strong>Email:</strong> ${user?.email || "N/A"}</p>
                <div style="background: #f9fafb; border-left: 4px solid #0d9488; padding: 12px; border-radius: 4px; margin-top: 12px;">
                  <p style="margin: 0;">"${text.trim()}"</p>
                </div>
                <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">Admin panel se reply karo.</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Support email failed:", emailErr.message);
      }
    }

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("sendSupportMessage error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET /api/support/admin/all — Admin sabke messages dekhe ──────
async function getAllSupportChats(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    // Har user ka latest message aur unread count
    const users = await prisma.user.findMany({
      where: {
        supportMessages: { some: {} },
      },
      include: {
        supportMessages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            supportMessages: {
              where: { senderRole: "user", isRead: false },
            },
          },
        },
      },
    });

    return res.json({ success: true, data: users });
  } catch (error) {
    console.error("getAllSupportChats error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET /api/support/admin/:userId — Admin ek user ka chat dekhe ─
async function getUserSupportChat(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const { userId } = req.params;

    const messages = await prisma.supportMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    // Mark user messages as read
    await prisma.supportMessage.updateMany({
      where: { userId, senderRole: "user", isRead: false },
      data: { isRead: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, email: true },
    });

    return res.json({ success: true, data: messages, user });
  } catch (error) {
    console.error("getUserSupportChat error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── POST /api/support/admin/:userId — Admin reply kare ───────────
async function adminReply(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const { userId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message empty nahi ho sakta" });
    }

    const message = await prisma.supportMessage.create({
      data: {
        userId,
        text: text.trim(),
        senderRole: "admin",
      },
    });

    // ✅ User ko email notification
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"LabourMatch Support" <${process.env.GMAIL_USER}>`,
          to: user.email,
          subject: `✅ LabourMatch Support Reply`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0d9488, #f59e0b); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h2 style="color: white; margin: 0;">Support Reply</h2>
              </div>
              <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                <p>Hello <strong>${user.name}</strong>,</p>
                <p>LabourMatch support team ne aapke message ka jawab diya hai:</p>
                <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px; border-radius: 4px; margin: 12px 0;">
                  <p style="margin: 0;">"${text.trim()}"</p>
                </div>
                <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/contact"
                  style="display: inline-block; background: #0d9488; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 12px;">
                  Chat Dekho
                </a>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Reply email failed:", emailErr.message);
      }
    }

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("adminReply error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  getMySupport,
  sendSupportMessage,
  getAllSupportChats,
  getUserSupportChat,
  adminReply,
};