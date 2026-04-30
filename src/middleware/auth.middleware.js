// src/middleware/auth.middleware.js
const { verifyToken } = require("../utils/jwt");
const prisma = require("../utils/prisma");

// ✅ Login required — User + Contractor dono support
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Login karein pehle" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    // ✅ Contractor token hai to Contractor table check karo
    if (decoded.isContractor) {
      const contractor = await prisma.contractor.findUnique({
        where: { id: decoded.id },
      });

      if (!contractor) {
        return res.status(401).json({ success: false, message: "Contractor nahi mila" });
      }

      req.user = {
        id: contractor.id,
        name: contractor.name,
        phone: contractor.phone,
        email: contractor.email,
        role: "CONTRACTOR",
        isContractor: true,
        contractorId: contractor.id,
      };
      return next();
    }

    // ✅ Normal user token — User table check karo
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ success: false, message: "User nahi mila" });
    }

    req.user = {
      ...user,
      isContractor: false,
    };
    next();

  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid ya expired token" });
  }
}

// ✅ Admin only
function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

// ✅ Optional auth
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);

      if (decoded.isContractor) {
        const contractor = await prisma.contractor.findUnique({
          where: { id: decoded.id },
        });
        if (contractor) {
          req.user = {
            id: contractor.id,
            name: contractor.name,
            phone: contractor.phone,
            email: contractor.email,
            role: "CONTRACTOR",
            isContractor: true,
            contractorId: contractor.id,
          };
        }
      } else {
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (user) req.user = { ...user, isContractor: false };
      }
    }
  } catch {}
  next();
}

module.exports = { authenticate, adminOnly, optionalAuth };