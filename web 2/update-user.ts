const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const phone = "13959777439";
  try {
    const user = await prisma.user.update({
      where: { phone: phone },
      data: { freeUsage: 99999 },
    });
    console.log(`成功！用户 ${user.phone} 的额度已更新为: ${user.freeUsage}`);
  } catch (e) {
    console.error("更新失败，可能是用户不存在:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

