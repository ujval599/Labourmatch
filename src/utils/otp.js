// src/utils/otp.js
const nodemailer = require("nodemailer");

const otpStore = new Map(); // { identifier: { otp, expiresAt } }

// ── Generate 6-digit OTP ──────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Store OTP ─────────────────────────────────────────────────────
function storeOTP(identifier, otp) {
  const expiry = parseInt(process.env.OTP_EXPIRY_SECONDS) || 300;
  otpStore.set(identifier, {
    otp,
    expiresAt: Date.now() + expiry * 1000,
  });
}

// ── Verify OTP ────────────────────────────────────────────────────
function verifyOTP(identifier, otp) {
  const stored = otpStore.get(identifier);
  if (!stored) return { valid: false, reason: "OTP expired ya galat number" };
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(identifier);
    return { valid: false, reason: "OTP expired ho gaya. Dobara bhejo." };
  }
  if (stored.otp !== otp) return { valid: false, reason: "Galat OTP" };
  otpStore.delete(identifier);
  return { valid: true };
}

// ── Create Gmail Transporter ──────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });
}

// ── Send OTP Email ────────────────────────────────────────────────
async function sendOTPEmail(email, otp, type = "login") {
  const transporter = createTransporter();

  const subject = type === "forgot"
    ? "LabourMatch — Password Reset OTP"
    : "LabourMatch — Your Login OTP";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f9f9f9; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #0d9488, #f59e0b); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">LM</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">LabourMatch</p>
      </div>
      <div style="padding: 32px; background: white;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">${type === "forgot" ? "Password Reset" : "Your OTP"}</h2>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">
          ${type === "forgot"
            ? "Aapne password reset request ki hai. Neeche diya OTP use karo:"
            : "Aapka LabourMatch login OTP neeche hai:"}
        </p>
        <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="font-size: 42px; font-weight: bold; color: #0d9488; letter-spacing: 12px; margin: 0;">${otp}</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">Valid for 5 minutes</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          ⚠️ Yeh OTP kisi ke saath share mat karo. LabourMatch kabhi OTP nahi maangta.
        </p>
      </div>
      <div style="padding: 16px 32px; background: #f9f9f9; text-align: center;">
        <p style="color: #9ca3af; font-size: 11px; margin: 0;">© 2026 LabourMatch. All rights reserved.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
    to: email,
    subject,
    html,
  });
}

// ── Main sendOTP function ─────────────────────────────────────────
async function sendOTP(identifier, type = "login") {
  const otp = generateOTP();
  storeOTP(identifier, otp);

  const isEmail = identifier.includes("@");

  if (isEmail && process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
    try {
      await sendOTPEmail(identifier, otp, type);
      console.log(`✅ OTP email sent to ${identifier}: ${otp}`);
      return { success: true, dev: false };
    } catch (err) {
      console.error("❌ Email send failed:", err.message);
      // Fallback — dev mode mein console pe dikhao
      console.log(`\n📧 OTP for ${identifier}: ${otp}\n`);
      return { success: true, dev: true, otp };
    }
  }

  // Phone OTP — console pe dikhao (SMS integration ke liye)
  console.log(`\n📱 OTP for ${identifier}: ${otp}\n`);
  return { success: true, dev: true, otp };
}

module.exports = { sendOTP, verifyOTP, generateOTP };