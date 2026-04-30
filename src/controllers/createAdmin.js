const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('labourmatchadmin@2004', 10);
  
  // New admin banao ya update karo
  const admin = await prisma.user.upsert({
    where: { phone: '8128860779' },
    update: { password: hash, role: 'ADMIN', name: 'Admin' },
    create: { name: 'Admin', phone: '8128860779', password: hash, role: 'ADMIN' }
  });
  console.log('✅ Admin ready:', admin.phone, admin.role);

  // Purana admin USER bana do
  try {
    await prisma.user.update({
      where: { phone: '9999999999' },
      data: { role: 'USER' }
    });
    console.log('✅ Old admin changed to USER');
  } catch { console.log('ℹ️ Old admin not found'); }

  await prisma.$disconnect();
}

main().catch(console.error);