import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();
const weekStart = new Date('2026-05-17T00:00:00.000Z');

const oldRosterPhones = [
  '+18769998101',
  '+18769998102',
  '+18769998103',
  '+18769998104',
  '+18769998201',
  '+18769998301',
  '+18769998302',
  '+18769998303',
  '+18769998304',
  '+18769998305',
  '+18769998306',
  '+18769998401',
  '+18769998501',
  '+18769998502',
  '+18769998503',
  '+18769998504',
  '+18769998505',
  '+18769998506',
  '+18769998507',
  '+18769998508',
  '+18769998509',
  '+187699986101',
  '+187699986102',
  '+187699986103',
  '+187699986104',
  '+187699986201',
  '+187699986301',
  '+187699986302',
  '+187699986303',
  '+187699986304',
  '+187699986305',
  '+187699986306',
  '+187699986401',
  '+187699986501',
  '+187699986502',
  '+187699986503',
  '+187699986504',
  '+187699986505',
  '+187699986506',
  '+187699986507',
  '+187699986508',
  '+187699986509',
];

async function main() {
  const santaCruz = await prisma.store.findFirstOrThrow({ where: { name: 'SuperPlus Santa Cruz' } });
  const oldUsers = await prisma.user.findMany({
    where: { phone: { in: oldRosterPhones } },
    select: { id: true },
  });
  const oldUserIds = oldUsers.map(user => user.id);

  const scheduleTestStore = await prisma.store.findFirst({
    where: { name: 'SuperPlus Schedule Test' },
    select: { id: true },
  });
  const mandeville = await prisma.store.findFirst({
    where: { name: 'SuperPlus Mandeville' },
    select: { id: true },
  });

  const oldScheduleIds = (
    await prisma.shiftSchedule.findMany({
      where: {
        OR: [
          scheduleTestStore ? { storeId: scheduleTestStore.id } : { id: '__none__' },
          mandeville
            ? { storeId: mandeville.id, weekStart, generatedBy: 'SEEDED_FROM_ROSTER_SCREENSHOT' }
            : { id: '__none__' },
        ],
      },
      select: { id: true },
    })
  ).map(schedule => schedule.id);

  await prisma.shiftSlot.deleteMany({
    where: {
      OR: [
        { scheduleId: { in: oldScheduleIds } },
        { userId: { in: oldUserIds } },
      ],
    },
  });
  await prisma.shiftSchedule.deleteMany({ where: { id: { in: oldScheduleIds } } });
  await prisma.staffAbsence.deleteMany({
    where: {
      OR: [
        { userId: { in: oldUserIds } },
        scheduleTestStore ? { storeId: scheduleTestStore.id } : { id: '__none__' },
      ],
    },
  });
  await prisma.staffAvailability.deleteMany({ where: { userId: { in: oldUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: oldUserIds } } });

  if (scheduleTestStore) {
    await prisma.store.delete({ where: { id: scheduleTestStore.id } });
  }

  const stores = await prisma.store.findMany({
    select: {
      name: true,
      users: {
        where: { isActive: true },
        select: { fullName: true, phone: true, role: true, jobLane: true },
        orderBy: [{ jobLane: 'asc' }, { fullName: 'asc' }],
      },
      shiftSchedules: {
        select: { id: true, weekStart: true, status: true, _count: { select: { slots: true } } },
        orderBy: { weekStart: 'desc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(
    JSON.stringify(
      {
        santaCruzStoreId: santaCruz.id,
        deletedOldRosterUsers: oldUserIds.length,
        deletedOldSchedules: oldScheduleIds.length,
        stores,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
