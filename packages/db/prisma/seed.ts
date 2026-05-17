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

  // Phase 2: Categories
  const grocery = await prisma.category.create({
    data: { storeId: store.id, name: 'Grocery', defaultMarkupPercent: 25, sortOrder: 0 },
  });
  const beverages = await prisma.category.create({
    data: { storeId: store.id, name: 'Beverages', defaultMarkupPercent: 35, sortOrder: 1 },
  });
  const household = await prisma.category.create({
    data: { storeId: store.id, name: 'Household', defaultMarkupPercent: 20, sortOrder: 2 },
  });
  const produce = await prisma.category.create({
    data: { storeId: store.id, name: 'Produce', defaultMarkupPercent: 40, sortOrder: 3 },
  });

  // Phase 2: Sample products
  await prisma.product.createMany({
    data: [
      { storeId: store.id, categoryId: grocery.id, name: 'Grace Corned Beef 340g', barcode: '5012345678901', costPrice: 450, retailPrice: 563, markupPercent: 25, location: 'Aisle 2, Shelf A' },
      { storeId: store.id, categoryId: grocery.id, name: 'National Flour 2kg', barcode: '5012345678902', costPrice: 380, retailPrice: 475, markupPercent: 25, location: 'Aisle 2, Shelf C' },
      { storeId: store.id, categoryId: beverages.id, name: 'Pepsi 2L', barcode: '5012345678903', costPrice: 200, retailPrice: 270, markupPercent: 35, location: 'Aisle 1, Shelf B' },
      { storeId: store.id, categoryId: beverages.id, name: 'Wata Water 1.5L', barcode: '5012345678904', costPrice: 80, retailPrice: 108, markupPercent: 35, location: 'Aisle 1, Shelf A' },
      { storeId: store.id, categoryId: household.id, name: 'Breeze Detergent 900g', barcode: '5012345678905', costPrice: 520, retailPrice: 624, markupPercent: 20, location: 'Aisle 4, Shelf B' },
      { storeId: store.id, categoryId: produce.id, name: 'Scotch Bonnet Pepper (per lb)', costPrice: 300, retailPrice: 420, markupPercent: 40, location: 'Produce Section', stockStatus: 'LOW' },
    ],
  });

  // Phase 2: Checklist template
  const closingTemplate = await prisma.checklistTemplate.create({
    data: {
      storeId: store.id,
      name: 'Nightly Closing',
      items: {
        create: [
          { label: 'Count all registers and secure cash', sortOrder: 0 },
          { label: 'Check all freezer temperatures and log readings', sortOrder: 1 },
          { label: 'Sweep and mop all aisles', sortOrder: 2 },
          { label: 'Restock front-end displays', sortOrder: 3 },
          { label: 'Lock back receiving door', sortOrder: 4 },
          { label: 'Arm security system', sortOrder: 5 },
          { label: 'Turn off non-essential lights', sortOrder: 6 },
          { label: 'Check produce section for spoilage', sortOrder: 7, isRequired: false },
        ],
      },
    },
  });

  // Phase 4: Store config
  await prisma.store.update({
    where: { id: store.id },
    data: { openTime: '07:00', closeTime: '21:00', openDays: 'Mon,Tue,Wed,Thu,Fri,Sat' },
  });

  // Phase 4: Staff availability (sample)
  const users = await prisma.user.findMany({ where: { storeId: store.id } });
  for (const u of users) {
    for (let day = 0; day < 7; day++) {
      await prisma.staffAvailability.create({
        data: {
          userId: u.id,
          dayOfWeek: day,
          available: day !== 0, // Everyone unavailable Sunday
          note: day === 0 ? 'Day off' : null,
        },
      });
    }
  }

  console.log('Seed complete: 1 store, 4 users (PIN: 1234), 4 categories, 6 products, 1 checklist template, store hours, 28 availability records');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
