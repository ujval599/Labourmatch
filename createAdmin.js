const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('labourmatchadmin@2004', 10);
  const user = await prisma.user.upsert({
    where: { phone: '8128860779' },
    update: { password: hash, role: 'ADMIN' },
    create: { name: 'Admin', phone: '8128860779', password: hash, role: 'ADMIN' }
  });
  console.log('Admin created:', user.phone, user.role);
  await prisma.$disconnect();
}

main().catch(console.error);