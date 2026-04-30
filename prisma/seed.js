// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { phone: "9999999999" },
    update: {},
    create: {
      name: "Admin",
      phone: "9999999999",
      email: "admin@labourmatch.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  // Test user
  const userPassword = await bcrypt.hash("user123", 10);
  const testUser = await prisma.user.upsert({
    where: { phone: "9876543210" },
    update: {},
    create: {
      name: "Amit Desai",
      phone: "9876543210",
      email: "amit@example.com",
      password: userPassword,
      role: "USER",
    },
  });

  // Contractors
  const contractors = [
    {
      name: "Rajesh Kumar & Team",
      phone: "9876501001",
      location: "Andheri, Mumbai",
      city: "Mumbai",
      category: "CONSTRUCTION",
      workers: 25,
      priceMin: 600,
      priceMax: 800,
      verified: true,
      experienceYrs: 8,
      description: "Professional construction team with 8+ years experience. Specializing in residential and commercial projects.",
      imageUrl: "https://images.unsplash.com/photo-1759984738054-cbdb13ec3fda?w=800",
    },
    {
      name: "Sharma Construction Services",
      phone: "9876501002",
      location: "Bandra, Mumbai",
      city: "Mumbai",
      category: "CONSTRUCTION",
      workers: 18,
      priceMin: 550,
      priceMax: 750,
      verified: true,
      experienceYrs: 5,
      description: "Reliable construction crew available for short and long-term projects.",
      imageUrl: "https://images.unsplash.com/photo-1694522362256-6c907336af43?w=800",
    },
    {
      name: "Mumbai Movers & Packers",
      phone: "9876501003",
      location: "Goregaon, Mumbai",
      city: "Mumbai",
      category: "SHIFTING",
      workers: 30,
      priceMin: 700,
      priceMax: 900,
      verified: true,
      experienceYrs: 10,
      description: "Expert shifting and moving team. Handles office and home relocation with care.",
      imageUrl: "https://images.unsplash.com/photo-1583737077382-3f51318d6074?w=800",
    },
    {
      name: "Patel Labour Contractors",
      phone: "9876501004",
      location: "Malad, Mumbai",
      city: "Mumbai",
      category: "LOADING_UNLOADING",
      workers: 20,
      priceMin: 500,
      priceMax: 700,
      verified: false,
      experienceYrs: 3,
      description: "Affordable loading and unloading services for warehouses and factories.",
      imageUrl: "https://images.unsplash.com/photo-1764116858281-d5933bb2ad4a?w=800",
    },
    {
      name: "Singh Helpers & Associates",
      phone: "9876501005",
      location: "Powai, Mumbai",
      city: "Mumbai",
      category: "HELPERS",
      workers: 15,
      priceMin: 450,
      priceMax: 600,
      verified: true,
      experienceYrs: 4,
      description: "Daily helpers available for all types of manual work.",
      imageUrl: "https://images.unsplash.com/photo-1615724320397-9d4db10ec2a5?w=800",
    },
    {
      name: "Ahmedabad Build Crew",
      phone: "9876501006",
      location: "Navrangpura, Ahmedabad",
      city: "Ahmedabad",
      category: "CONSTRUCTION",
      workers: 22,
      priceMin: 500,
      priceMax: 700,
      verified: true,
      experienceYrs: 6,
      description: "Top construction team in Ahmedabad. Available for residential projects.",
      imageUrl: "https://images.unsplash.com/photo-1759984738054-cbdb13ec3fda?w=800",
    },
  ];

  for (const c of contractors) {
    await prisma.contractor.upsert({
      where: { phone: c.phone },
      update: {},
      create: c,
    });
  }

  // Add some reviews
  const allContractors = await prisma.contractor.findMany({ take: 3 });
  for (const contractor of allContractors) {
    await prisma.review.upsert({
      where: { contractorId_userId: { contractorId: contractor.id, userId: testUser.id } },
      update: {},
      create: {
        contractorId: contractor.id,
        userId: testUser.id,
        rating: 5,
        comment: "Excellent service! Professional and on time.",
      },
    });

    // Update contractor rating
    await prisma.contractor.update({
      where: { id: contractor.id },
      data: { rating: 4.8, reviewCount: 1 },
    });
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
