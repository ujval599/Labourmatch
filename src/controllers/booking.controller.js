// src/controllers/booking.controller.js
const prisma = require("../utils/prisma");
const nodemailer = require("nodemailer");

// ── Email transporter ─────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });
}

// ── Send booking notification emails ─────────────────────────────
async function sendBookingEmails(booking, contractor, user) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) return;

  const transporter = createTransporter();
  const bookingDate = new Date(booking.startDate).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric"
  });

  // ── 1. Admin ko email ──
  try {
    await transporter.sendMail({
      from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: `🔔 New Booking Request — ${contractor.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0d9488, #f59e0b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🔔 New Booking Request</h1>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; width: 40%;">Contractor:</td><td style="padding: 8px 0; font-weight: bold;">${contractor.name} (${contractor.phone})</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">User:</td><td style="padding: 8px 0; font-weight: bold;">${user.name} (${user.phone})</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Work Type:</td><td style="padding: 8px 0;">${booking.workType || "Not specified"}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Workers Needed:</td><td style="padding: 8px 0;">${booking.workersNeeded}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Start Date:</td><td style="padding: 8px 0;">${bookingDate}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Location:</td><td style="padding: 8px 0;">${booking.location || "Not specified"}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Message:</td><td style="padding: 8px 0;">${booking.message || "No message"}</td></tr>
            </table>
            <div style="margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 13px; color: #92400e;">💰 Commission opportunity — Follow up with contractor for commission details.</p>
            </div>
          </div>
        </div>
      `,
    });
    console.log("✅ Admin booking email sent");
  } catch (err) {
    console.error("❌ Admin email failed:", err.message);
  }

  // ── 2. Contractor ko email (agar email hai) ──
  if (contractor.email) {
    try {
      await transporter.sendMail({
        from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
        to: contractor.email,
        subject: `🎉 New Booking Request — LabourMatch`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0d9488, #f59e0b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">🎉 New Booking Request!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Someone wants to hire you via LabourMatch</p>
            </div>
            <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <p style="color: #374151;">Hello <strong>${contractor.name}</strong>,</p>
              <p style="color: #6b7280;">You have received a new booking request on LabourMatch!</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px 0; color: #6b7280; width: 40%;">Client Name:</td><td style="padding: 8px 0; font-weight: bold;">${user.name}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Client Phone:</td><td style="padding: 8px 0; font-weight: bold; color: #0d9488;">${user.phone}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Work Type:</td><td style="padding: 8px 0;">${booking.workType || "Not specified"}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Workers Needed:</td><td style="padding: 8px 0;">${booking.workersNeeded}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Start Date:</td><td style="padding: 8px 0;">${bookingDate}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Location:</td><td style="padding: 8px 0;">${booking.location || "Not specified"}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Message:</td><td style="padding: 8px 0;">${booking.message || "No message"}</td></tr>
              </table>
              <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; border-left: 4px solid #22c55e;">
                <p style="margin: 0; color: #166534; font-weight: bold;">📞 Contact the client directly: ${user.phone}</p>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">This booking was received via LabourMatch platform.</p>
            </div>
          </div>
        `,
      });
      console.log("✅ Contractor booking email sent");
    } catch (err) {
      console.error("❌ Contractor email failed:", err.message);
    }
  }

  // ── 3. User ko confirmation email ──
  if (user.email) {
    try {
      await transporter.sendMail({
        from: `"LabourMatch" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `✅ Booking Request Sent — LabourMatch`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0d9488, #f59e0b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">✅ Booking Request Sent!</h1>
            </div>
            <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <p style="color: #374151;">Hello <strong>${user.name}</strong>,</p>
              <p style="color: #6b7280;">Your booking request has been sent to <strong>${contractor.name}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px 0; color: #6b7280; width: 40%;">Contractor:</td><td style="padding: 8px 0; font-weight: bold;">${contractor.name}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Contractor Phone:</td><td style="padding: 8px 0; font-weight: bold; color: #0d9488;">${contractor.phone}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Start Date:</td><td style="padding: 8px 0;">${bookingDate}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Workers Needed:</td><td style="padding: 8px 0;">${booking.workersNeeded}</td></tr>
              </table>
              <div style="background: #eff6ff; border-radius: 8px; padding: 16px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; color: #1e40af;">The contractor will contact you soon on your registered phone number.</p>
              </div>
            </div>
          </div>
        `,
      });
      console.log("✅ User confirmation email sent");
    } catch (err) {
      console.error("❌ User email failed:", err.message);
    }
  }
}

// ── POST /api/bookings ────────────────────────────────────────────
async function createBooking(req, res) {
  try {
    const { contractorId, workersNeeded, startDate, endDate, message, workType, location } = req.body;
    const userId = req.user.id;

    if (!contractorId || !workersNeeded || !startDate) {
      return res.status(400).json({ success: false, message: "ContractorId, workers aur start date required hain" });
    }

    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) return res.status(404).json({ success: false, message: "Contractor nahi mila" });
    if (!contractor.available) return res.status(400).json({ success: false, message: "Contractor abhi available nahi hai" });

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const booking = await prisma.bookingRequest.create({
      data: {
        contractorId,
        userId,
        workersNeeded: parseInt(workersNeeded),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        message: message || null,
        workType: workType || null,
        location: location || null,
        status: "PENDING",
      },
      include: {
        contractor: { select: { id: true, name: true, phone: true, email: true } },
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    // ✅ Emails bhejo — async (response wait nahi karega)
    sendBookingEmails(booking, contractor, user).catch(console.error);

    return res.status(201).json({
      success: true,
      message: "Booking request bhej diya gaya! Contractor jaldi contact karega.",
      data: booking,
    });
  } catch (error) {
    console.error("createBooking error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET /api/bookings/my ──────────────────────────────────────────
async function getMyBookings(req, res) {
  try {
    const bookings = await prisma.bookingRequest.findMany({
      where: { userId: req.user.id },
      include: {
        contractor: { select: { id: true, name: true, location: true, phone: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── PUT /api/bookings/:id/status — Admin only ─────────────────────
async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const booking = await prisma.bookingRequest.update({
      where: { id },
      data: { status },
      include: {
        contractor: { select: { name: true, phone: true } },
        user: { select: { name: true, phone: true } },
      },
    });

    return res.json({ success: true, message: "Status update ho gaya", data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET /api/bookings — Admin only ───────────────────────────────
async function getAllBookings(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status } : {};

    const [bookings, total] = await Promise.all([
      prisma.bookingRequest.findMany({
        where,
        include: {
          contractor: { select: { id: true, name: true, phone: true, city: true, category: true } },
          user: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.bookingRequest.count({ where }),
    ]);

    return res.json({ success: true, data: bookings, pagination: { page: parseInt(page), total } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { createBooking, getMyBookings, updateBookingStatus, getAllBookings };