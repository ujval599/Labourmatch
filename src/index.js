require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const rateLimit = require("express-rate-limit");
const path = require("path");
const prisma = require("./utils/prisma");
const { generateToken } = require("./utils/jwt");

const app = express();
const PORT = process.env.PORT || 5000;

// 📦 ROUTES
const authRoutes = require("./routes/auth.routes");
const contractorRoutes = require("./routes/contractor.routes");
const reviewRoutes = require("./routes/review.routes");
const bookingRoutes = require("./routes/booking.routes");
const contactRoutes = require("./routes/contact.routes");
const premiumRoutes = require("./routes/premium.routes");
const workMediaRoutes = require("./routes/workMedia.routes");
const chatRoutes = require("./routes/chat.routes");
const supportRoutes = require('./routes/Support.routes')

// 🔐 SESSION
app.use(session({
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true },
}));

// 🔐 PASSPORT
app.use(passport.initialize());
app.use(passport.session());

// 🌐 CORS
app.use(cors({
  origin: [
    "https://labourmatch.com",
    "https://www.labourmatch.com",
    "http://localhost:5173"
  ],
  credentials: true
}));
// 🧠 BODY PARSER
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📁 STATIC UPLOADS
const uploadPath = path.join(__dirname, "../uploads");
console.log("UPLOAD PATH:", uploadPath);
app.use("/uploads", express.static(uploadPath));

// 🚫 RATE LIMIT
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api", limiter);

const otpLimiter = rateLimit({ windowMs: 60 * 1000, max: 3 });

// 🔥 GOOGLE STRATEGY — User DB mein save karo
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      const googleId = profile.id;

      if (!email) return done(null, false);

      // ✅ User dhundo ya banao
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Naya user banao
        user = await prisma.user.create({
          data: {
            name,
            email,
            phone: `google_${googleId}`, // phone required hai schema mein
            role: "USER",
          },
        });
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// 🔐 SESSION STORE
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// 📦 ROUTES USE
app.use("/api/auth", otpLimiter, authRoutes);
app.use("/api/contractors", contractorRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/premium", premiumRoutes);
app.use("/api/work-media", workMediaRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/support", supportRoutes);

// 🔐 GOOGLE LOGIN
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// ✅ GOOGLE CALLBACK — Token generate karo aur frontend pe bhejo
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth?error=google_failed` }),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/auth?error=no_user`);
      }

      // ✅ JWT token generate karo
      const token = generateToken({ id: user.id, role: user.role });

      const userData = encodeURIComponent(JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      }));

      // ✅ Frontend pe redirect karo token aur user data ke saath
      // Role selection page pe bhejo
      const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${FRONTEND}/auth/google/success?token=${token}&user=${userData}`);

    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/auth?error=server_error`);
    }
  }
);

// ✅ DEFAULT
app.get("/", (req, res) => {
  res.json({ success: true, message: "LabourMatch API running 🚀" });
});

// ❌ 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ⚠️ ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error" });
});

// 🚀 START
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});