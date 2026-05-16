import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pinHash = await hash('1234', 10);

  const store = await prisma.store.create({
    data: {
      name: 'SuperPlus Mandeville',
      parish: 'Manchester',
      address: '4 Manchester Road, Mandeville',
      phone: '+18769613897',
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Admin Owner',
      phone: '+18760000001',
      pinHash,
      role: Role.OWNER,
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Store Manager',
      phone: '+18760000002',
      pinHash,
      role: Role.MANAGER,
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Floor Supervisor',
      phone: '+18760000003',
      pinHash,
      role: Role.SUPERVISOR,
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Cashier Staff',
      phone: '+18760000004',
      pinHash,
      role: Role.STAFF,
    },
  });

  console.log('Seed complete: 1 store, 4 users (PIN: 1234 for all)');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
