# LabourMatch — Complete Setup Guide
## Tumhara poora project — Backend + Frontend API Integration

---

## 📁 Folder Structure

```
labourmatch-backend/          ← Backend server (yeh folder)
  src/
    index.js                  ← Main server entry point
    routes/                   ← API routes
    controllers/              ← Business logic
    middleware/               ← Auth middleware
    utils/                    ← Prisma, Redis, OTP, JWT, Cloudinary
  prisma/
    schema.prisma             ← Database schema
    seed.js                   ← Sample data
  .env.example                ← Environment variables template

frontend-api-integration/     ← Yeh files apne frontend mein copy karo
  src/
    services/                 ← API service files
    context/AuthContext.tsx   ← Auth state management
    app/pages/                ← Updated pages (Auth, Listing, Register)
```

---

## 🚀 Step 1: Backend Setup

```bash
cd labourmatch-backend

# Dependencies install karo
npm install

# .env file banao
cp .env.example .env
# Ab .env file kholo aur values bharo (database URL, etc.)
```

---

## 🗄️ Step 2: Database Setup (Supabase — Free)

1. **https://supabase.com** par jao → New Project banao
2. Project create hone ke baad:
   - Left sidebar → **Settings** → **Database**
   - **Connection string** copy karo (URI format)
   - Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
3. Is string ko `.env` mein `DATABASE_URL` mein paste karo

```bash
# Database tables banao
npx prisma migrate dev --name init

# Prisma client generate karo
npx prisma generate

# Sample data dalo (optional — testing ke liye)
node prisma/seed.js
```

---

## 🔴 Step 3: Redis Setup (Upstash — Free)

OTP store karne ke liye Redis chahiye.

1. **https://upstash.com** par jao → Create Database
2. Region: **Mumbai (ap-south-1)** select karo
3. Dashboard mein **REDIS_URL** copy karo
4. `.env` mein paste karo

---

## 📱 Step 4: OTP Setup

### Option A — MSG91 (India, Recommended)
1. **https://msg91.com** par account banao
2. SMS → OTP Template banao
   - Template mein `##OTP##` likho
3. Auth Key aur Template ID copy karo → `.env` mein paste karo

### Option B — Development Testing
- OTP SMS setup nahi hai to bhi koi baat nahi!
- `NODE_ENV=development` hone par OTP server console mein print hota hai
- Frontend pe bhi auto-fill ho jata hai

---

## 🌤️ Step 5: Cloudinary Setup (Optional — Photos ke liye)

1. **https://cloudinary.com** → Free account banao
2. Dashboard → Cloud Name, API Key, API Secret copy karo
3. `.env` mein paste karo

---

## ▶️ Step 6: Server Start Karo

```bash
# Development mode (auto-restart on changes)
npm run dev

# Server chalega: http://localhost:5000
# Test karo: http://localhost:5000  → "LabourMatch API is running 🚀"
```

---

## 🔌 Step 7: Frontend Connect Karo

### 7a. Files Copy Karo
Tumhare existing frontend project mein yeh files copy karo:

```
frontend-api-integration/src/services/     →  tumhara-frontend/src/services/
frontend-api-integration/src/context/      →  tumhara-frontend/src/context/
frontend-api-integration/src/app/pages/   →  (sirf Auth.tsx, ContractorListing.tsx, RegisterContractor.tsx replace karo)
```

### 7b. axios Install Karo
```bash
cd tumhara-frontend
npm install axios
```

### 7c. .env File Banao (Frontend)
```bash
# Frontend root mein .env.local file banao
VITE_API_URL=http://localhost:5000/api
```

### 7d. AuthProvider Wrap Karo
`src/app/Root.tsx` ya `src/main.tsx` mein AuthProvider add karo:

```tsx
import { AuthProvider } from "../context/AuthContext";

// Root component mein:
export default function Root() {
  return (
    <AuthProvider>
      {/* tumhara existing JSX */}
    </AuthProvider>
  );
}
```

---

## 🔑 Test Accounts (Seed Data)

| Role  | Phone      | Password |
|-------|-----------|----------|
| Admin | 9999999999 | admin123 |
| User  | 9876543210 | user123  |

---

## 🌐 API Endpoints Summary

| Method | Endpoint                      | Description              | Auth?    |
|--------|-------------------------------|--------------------------|----------|
| GET    | /api/contractors              | Sab contractors          | No       |
| GET    | /api/contractors/:id          | Ek contractor detail     | No       |
| POST   | /api/contractors/register     | Naya contractor register | No       |
| GET    | /api/contractors/cities       | Cities list              | No       |
| POST   | /api/auth/send-otp            | OTP bhejo                | No       |
| POST   | /api/auth/verify-otp          | OTP verify + login       | No       |
| POST   | /api/auth/login               | Password login           | No       |
| POST   | /api/auth/register            | Account banao            | No       |
| GET    | /api/auth/me                  | Profile dekho            | Yes      |
| POST   | /api/reviews/:contractorId    | Review likho             | Yes      |
| POST   | /api/bookings                 | Booking request          | Yes      |
| GET    | /api/bookings/my              | Meri bookings            | Yes      |
| PUT    | /api/contractors/:id/verify   | Verify contractor        | Admin    |

---

## 🚢 Deployment (Free) — Baad Mein

| Service   | Platform              | Free Tier     |
|-----------|----------------------|---------------|
| Backend   | Railway.app          | $5/month free credit |
| Database  | Supabase             | 500MB free    |
| Redis     | Upstash              | 10K req/day free |
| Frontend  | Vercel               | Unlimited free |
| Photos    | Cloudinary           | 25GB free     |

### Railway Deploy:
```bash
# railway.app par project connect karo GitHub se
# Environment variables add karo (same as .env)
# Auto deploy hota hai
```

### Vercel Deploy (Frontend):
```bash
# vercel.com par import karo GitHub se
# VITE_API_URL=https://tumhara-railway-url.up.railway.app/api add karo
```

---

## ❓ Common Issues

**"Cannot connect to database"**
→ DATABASE_URL check karo, Supabase mein IP allow karo (Settings → Database → Connection Pooling)

**"Redis connection failed"**
→ REDIS_URL check karo ya Redis locally install karo: `brew install redis` (Mac) ya `sudo apt install redis` (Linux)

**"OTP nahi aaya"**
→ Development mein console check karo — OTP wahan print hota hai

**"CORS error"**
→ `.env` mein `FRONTEND_URL` check karo — exact URL hona chahiye (http://localhost:5173)
