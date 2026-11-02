import prisma from '../src/config/db.js';

async function test() {
  const products = await prisma.product.findMany({
    take: 5,
    select: { id: true, name: true, sku: true, supplierId: true, companyId: true },
  });
  console.log('Sample products:', JSON.stringify(products, null, 2));

  const suppliers = await prisma.user.findMany({
    where: { role: 'SUPPLIER' },
    select: { id: true, name: true, email: true, company: true },
    take: 5,
  });
  console.log('Sample suppliers:', JSON.stringify(suppliers, null, 2));
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
