const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 9999999999 ka role USER karo
  const user = await prisma.user.update({
    where: { phone: '9999999999' },
    data: { role: 'USER' }
  });
  console.log('✅ Done:', user.phone, user.role);
  await prisma.$disconnect();
}

main().catch(e => { console.log('User not found ya already done'); process.exit(0); });