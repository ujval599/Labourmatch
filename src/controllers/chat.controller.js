// src/controllers/chat.controller.js
const prisma = require("../utils/prisma");
const nodemailer = require("nodemailer");

// ─── Email Notification to Contractor ───────────────────────────
async function sendEmailNotification(to, contractorName, userName, message) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) return;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
    });
    await transporter.sendMail({
      from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
      to,
      subject: `New Message from ${userName} - LabourMatch`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #f59e0b); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h2 style="color: white; margin: 0;">LabourMatch</h2>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">New Message Received</p>
          </div>
          <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 15px;">Hello <strong>${contractorName}</strong>,</p>
            <p style="color: #374151;">You have received a new message from <strong>${userName}</strong>:</p>
            <div style="background: white; border-left: 4px solid #f97316; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #1f2937; font-size: 15px; margin: 0;">"${message}"</p>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Login to LabourMatch to reply to this message.</p>
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}"
                style="background: linear-gradient(135deg, #f97316, #f59e0b); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View Message
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`✅ Notification email sent to: ${to}`);
  } catch (err) {
    console.error("❌ Email notification failed:", err.message);
  }
}

// ─── Email Notification to User ──────────────────────────────────
async function sendUserEmailNotification(to, userName, contractorName, message) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) return;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
    });
    await transporter.sendMail({
      from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
      to,
      subject: `New Reply from ${contractorName} - LabourMatch`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #f59e0b); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h2 style="color: white; margin: 0;">LabourMatch</h2>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">New Reply from Your Contractor</p>
          </div>
          <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 15px;">Hello <strong>${userName}</strong>,</p>
            <p style="color: #374151;"><strong>${contractorName}</strong> ne tumhara message dekha aur reply kiya hai:</p>
            <div style="background: white; border-left: 4px solid #f97316; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #1f2937; font-size: 15px; margin: 0;">"${message}"</p>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Login to LabourMatch to continue the conversation.</p>
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}"
                style="background: linear-gradient(135deg, #f97316, #f59e0b); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View Reply
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`✅ Reply notification email sent to: ${to}`);
  } catch (err) {
    console.error("❌ User email notification failed:", err.message);
  }
}

// ✅ FIX: User ID se Contractor dhundo (phone ke zariye)
async function getContractorByUserId(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return prisma.contractor.findUnique({ where: { phone: user.phone } });
}

// ─── GET /api/chat/:contractorId — User messages fetch ───────────
async function getMessages(req, res) {
  try {
    const { contractorId } = req.params;
    const userId = req.user.id;

    const messages = await prisma.message.findMany({
      where: { contractorId, userId },
      orderBy: { createdAt: "asc" },
    });

    await prisma.message.updateMany({
      where: { contractorId, userId, senderRole: "contractor", isRead: false },
      data: { isRead: true },
    });

    return res.json({ success: true, data: messages });
  } catch (error) {
    console.error("getMessages error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GET /api/chat/contractor/:userId — Contractor messages fetch ─
async function getMessagesAsContractor(req, res) {
  try {
    const { userId } = req.params;

    // ✅ FIX: req.user.id (User ID) se phone ke zariye Contractor dhundo
    const contractor = await getContractorByUserId(req.user.id);
    if (!contractor) {
      return res.status(404).json({ success: false, message: "Contractor profile nahi mila" });
    }

    const contractorId = contractor.id;

    const messages = await prisma.message.findMany({
      where: { contractorId, userId },
      orderBy: { createdAt: "asc" },
    });

    await prisma.message.updateMany({
      where: { contractorId, userId, senderRole: "user", isRead: false },
      data: { isRead: true },
    });

    return res.json({ success: true, data: messages });
  } catch (error) {
    console.error("getMessagesAsContractor error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── POST /api/chat/:contractorId — User sends message ───────────
async function sendMessage(req, res) {
  try {
    const { contractorId } = req.params;
    const userId = req.user.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }

    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) {
      return res.status(404).json({ success: false, message: "Contractor not found" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const message = await prisma.message.create({
      data: { contractorId, userId, text: text.trim(), senderRole: "user" },
    });

    if (contractor.email) {
      await sendEmailNotification(
        contractor.email, contractor.name,
        user?.name || "A user", text.trim()
      );
    }

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── POST /api/chat/contractor/:userId/reply — Contractor replies ─
async function replyAsContractor(req, res) {
  try {
    const { userId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }

    // ✅ FIX: req.user.id se phone ke zariye Contractor dhundo
    const contractor = await getContractorByUserId(req.user.id);
    if (!contractor) {
      return res.status(404).json({ success: false, message: "Contractor profile nahi mila. Pehle register karo." });
    }

    const contractorId = contractor.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const message = await prisma.message.create({
      data: {
        contractorId,
        userId,
        text: text.trim(),
        senderRole: "contractor",
        isRead: false,
      },
    });

    if (user.email) {
      await sendUserEmailNotification(
        user.email, user.name || "there",
        contractor.name, text.trim()
      );
    }

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("replyAsContractor error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── DELETE /api/chat/:contractorId — Clear chat ─────────────────
async function clearChat(req, res) {
  try {
    const { contractorId } = req.params;
    const userId = req.user.id;

    await prisma.message.deleteMany({ where: { contractorId, userId } });

    return res.json({ success: true, message: "Chat cleared" });
  } catch (error) {
    console.error("clearChat error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { getMessages, getMessagesAsContractor, sendMessage, replyAsContractor, clearChat };