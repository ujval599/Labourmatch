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
const supportRoutes = require('./routes/Support.routes');

// 🔐 SESSION
app.use(session({
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true },
}));

// 🔐 PASSPORT
app.use(passport.initialize());
app.use(passport.session());

// ✅ FIX: CORS — production + local dono allow
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://labourmatch.com",
      "https://www.labourmatch.com",
      "http://localhost:5173",
      "http://localhost:3000",
    ];
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// 🧠 BODY PARSER
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📁 STATIC UPLOADS
const uploadPath = path.join(__dirname, "../uploads");
console.log("UPLOAD PATH:", uploadPath);
app.use("/uploads", express.static(uploadPath));

// ✅ FIX: Rate limit — thoda zyada allow karo
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 100 se 200 kiya
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api", limiter);

// ✅ FIX: OTP limiter — 3 se 10 kiya
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: "Too many attempts. Please wait a minute." },
});

// 🔥 GOOGLE STRATEGY
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

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name,
            email,
            phone: `google_${googleId}`,
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

// ✅ GOOGLE CALLBACK
app.get("/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth?error=google_failed`
  }),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/auth?error=no_user`);
      }

      const token = generateToken({ id: user.id, role: user.role });

      const userData = encodeURIComponent(JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      }));

      const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${FRONTEND}/auth/google/success?token=${token}&user=${userData}`);

    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/auth?error=server_error`);
    }
  }
);

// ✅ HEALTH CHECK
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