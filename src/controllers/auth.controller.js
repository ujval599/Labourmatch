// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");
const { generateToken } = require("../utils/jwt");
const { sendOTP, verifyOTP } = require("../utils/otp");

// ─── OTP Auth ────────────────────────────────────────────────────

async function sendOTPHandler(req, res) {
  try {
    const { phone, email } = req.body;

    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: "Valid email address do" });
      }
      const result = await sendOTP(email, "login");
      if (!result.success) return res.status(500).json({ success: false, message: result.error });
      const response = { success: true, message: "OTP email pe bhej diya gaya" };
      if (result.dev) response.otp = result.otp;
      return res.json(response);
    }

    if (phone) {
      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ success: false, message: "Valid 10 digit phone number do" });
      }
      const result = await sendOTP(phone, "login");
      if (!result.success) return res.status(500).json({ success: false, message: result.error });
      const response = { success: true, message: "OTP bhej diya gaya" };
      if (result.dev) response.otp = result.otp;
      return res.json(response);
    }

    return res.status(400).json({ success: false, message: "Phone ya email required hai" });
  } catch (error) {
    console.error("sendOTP error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function verifyOTPHandler(req, res) {
  try {
    const { phone, email, otp, name } = req.body;
    const identifier = email || phone;

    if (!identifier || !otp) {
      return res.status(400).json({ success: false, message: "Phone/Email aur OTP dono required hain" });
    }

    const result = verifyOTP(identifier, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    let user;
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    } else {
      user = await prisma.user.findUnique({ where: { phone } });
    }

    const isNewUser = !user;

    if (!user) {
      const userData = {
        name: name || "LabourMatch User",
        phone: phone || `email_${Date.now()}`,
        role: "USER",
      };
      if (email) userData.email = email;
      if (phone) userData.phone = phone;
      user = await prisma.user.create({ data: userData });
    }

    const token = generateToken({ id: user.id, role: user.role });

    return res.json({
      success: true,
      message: isNewUser ? "Account ban gaya!" : "Login successful!",
      isNewUser,
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("verifyOTP error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── Forgot Password ─────────────────────────────────────────────

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required hai" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Valid email address do" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ success: true, message: "Agar yeh email registered hai to OTP bhej diya gaya" });
    }

    if (!user.password) {
      return res.status(400).json({ success: false, message: "Aapne Google se login kiya tha. Password set nahi hai." });
    }

    const result = await sendOTP(email, "forgot");
    if (!result.success) {
      return res.status(500).json({ success: false, message: "Email bhejne mein error. Dobara try karo." });
    }

    const response = { success: true, message: "Password reset OTP aapke email pe bhej diya gaya" };
    if (result.dev) response.otp = result.otp;
    return res.json(response);

  } catch (error) {
    console.error("forgotPassword error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, OTP aur new password required hain" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password kam se kam 6 characters ka hona chahiye" });
    }

    const result = verifyOTP(email, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User nahi mila" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    return res.json({ success: true, message: "Password successfully reset ho gaya! Ab login karo." });

  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── Register ────────────────────────────────────────────────────

async function register(req, res) {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: "Name, phone aur password required hain" });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Valid 10 digit phone number do" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password kam se kam 6 characters ka hona chahiye" });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.phone === phone
          ? "Yeh phone number already registered hai"
          : "Yeh email already registered hai",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, phone, email: email || null, password: hashedPassword, role: "USER" },
    });

    const token = generateToken({ id: user.id, role: user.role });

    return res.status(201).json({
      success: true,
      message: "Registration successful!",
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("register error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── Login — Contractor PEHLE check karo, phir User ──────────────

async function login(req, res) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "Phone aur password required hain" });
    }

    // ✅ STEP 1: Pehle Contractor table mein check karo
    const contractor = await prisma.contractor.findUnique({ where: { phone } });

    if (contractor && contractor.password) {
      const isValid = await bcrypt.compare(password, contractor.password);

      if (isValid) {
        // ✅ Contractor login successful
        const token = generateToken({
          id: contractor.id,
          role: "CONTRACTOR",
          isContractor: true,
        });

        return res.json({
          success: true,
          message: "Contractor login successful!",
          token,
          user: {
            id: contractor.id,
            name: contractor.name,
            phone: contractor.phone,
            email: contractor.email,
            role: "CONTRACTOR",
            isContractor: true,
            contractorId: contractor.id,
          },
        });
      }
    }

    // ✅ STEP 2: Phir User table mein check karo
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: "Phone ya password galat hai" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: "Phone ya password galat hai" });
    }

    const token = generateToken({ id: user.id, role: user.role });

    return res.json({
      success: true,
      message: "Login successful!",
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isContractor: false,
      },
    });

  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────────

async function getMe(req, res) {
  try {
    // ✅ Contractor hai to contractor data return karo
    if (req.user.isContractor) {
      const contractor = await prisma.contractor.findUnique({
        where: { id: req.user.id },
      });
      if (contractor) {
        return res.json({
          success: true,
          user: {
            id: contractor.id,
            name: contractor.name,
            phone: contractor.phone,
            email: contractor.email,
            role: "CONTRACTOR",
            isContractor: true,
            contractorId: contractor.id,
          },
        });
      }
    }

    // ✅ Normal user
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
        role: req.user.role,
        isContractor: false,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── PUT /api/auth/profile ────────────────────────────────────────

async function updateProfile(req, res) {
  try {
    const { name, email } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name || req.user.name, email: email || req.user.email },
    });

    return res.json({
      success: true,
      message: "Profile update ho gaya",
      user: { id: updated.id, name: updated.name, phone: updated.phone, email: updated.email },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  sendOTPHandler, verifyOTPHandler,
  forgotPassword, resetPassword,
  register, login, getMe, updateProfile,
};