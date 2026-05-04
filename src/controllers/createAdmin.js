const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('labourmatchadmin@2004', 10);
  const u = await p.user.upsert({
    where: { phone: '8128860779' },
    update: { password: hash, role: 'ADMIN', name: 'Admin' },
    create: { name: 'Admin', phone: '8128860779', password: hash, role: 'ADMIN' }
  });
  console.log('✅ Admin ready:', u.name, u.role);
  await p.$disconnect();
}

main().catch(e => { console.error('❌ Error:', e.message); p.$disconnect(); });