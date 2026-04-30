const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fix() {
  const list = await prisma.contractor.findMany({
    select: { id: true, name: true, imageUrl: true },
  });

  for (const c of list) {
    if (c.imageUrl && c.imageUrl.includes("/uploads/")) {
      // Sirf "uploads/filename.jpg" part nikalo
      const fileName = c.imageUrl.split("/uploads/").pop();
      const fixedUrl = `http://localhost:5000/uploads/${fileName}`;

      await prisma.contractor.update({
        where: { id: c.id },
        data: { imageUrl: fixedUrl },
      });
      console.log(`✅ Fixed: ${c.name} → ${fixedUrl}`);
    }
  }

  console.log("Done!");
  await prisma.$disconnect();
}

fix().catch(console.error);