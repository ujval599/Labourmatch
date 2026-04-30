// src/controllers/contact.controller.js
const prisma = require("../utils/prisma");
const nodemailer = require("nodemailer");

async function sendContactMessage(req, res) {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Name, email aur message required hain" });
    }

    // Save to DB
    await prisma.contactMessage.create({
      data: { name, email, phone: phone || null, message },
    });

    // Optionally email notify karo
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_USER,
        subject: `New Contact Message from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "N/A"}\n\nMessage:\n${message}`,
      }).catch((err) => console.error("Email send failed:", err.message));
    }

    return res.json({ success: true, message: "Message bhej diya gaya! Hum jaldi contact karenge." });
  } catch (error) {
    console.error("contact error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { sendContactMessage };
