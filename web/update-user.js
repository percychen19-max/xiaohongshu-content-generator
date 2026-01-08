const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const phone = '13959777439';
  
  try {
    const user = await prisma.user.update({
      where: { phone: phone },
      data: { freeUsage: 99999 },
    });
    console.log(`成功！用户 ${user.phone} 的额度已修改为 ${user.freeUsage}`);
  } catch (e) {
    console.error('修改失败:', e.message);
    // 如果用户不存在，尝试创建
    if (e.code === 'P2025') {
       console.log('用户不存在，正在创建...');
       const newUser = await prisma.user.create({
         data: { phone: phone, freeUsage: 99999 }
       });
       console.log(`创建成功！额度: ${newUser.freeUsage}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();

