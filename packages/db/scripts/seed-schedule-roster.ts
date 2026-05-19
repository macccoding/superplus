import { AbsenceType, JobLane, PrismaClient, Role, ScheduleStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const WEEK_START = dateOnly('2026-05-17');
const STORE_NAME = 'SuperPlus Schedule Test';
const TEST_PIN = '1234';

type RosterEmployee = {
  key: string;
  name: string;
  lane: JobLane;
  role: Role;
  phone: string;
};

type RosterShift = {
  key: string;
  day: number;
  start: string;
  end: string;
};

const employees: RosterEmployee[] = [
  { key: 'aleer-supervisor', name: 'ALEER', lane: JobLane.SUPERVISOR, role: Role.SUPERVISOR, phone: '+18769998101' },
  { key: 'annmarie-supervisor', name: 'ANNMARIE', lane: JobLane.SUPERVISOR, role: Role.SUPERVISOR, phone: '+18769998102' },
  { key: 'stacy-supervisor', name: 'STACY', lane: JobLane.SUPERVISOR, role: Role.SUPERVISOR, phone: '+18769998103' },
  { key: 'tamara-supervisor', name: 'TAMARA', lane: JobLane.SUPERVISOR, role: Role.SUPERVISOR, phone: '+18769998104' },
  { key: 'tyrone-pricing', name: 'TYRONE', lane: JobLane.PRICING_CLERK, role: Role.STAFF, phone: '+18769998201' },
  { key: 'antonette-cashier', name: 'ANTONETTE', lane: JobLane.CASHIER, role: Role.STAFF, phone: '+18769998301' },
  { key: 'jhavene-cashier', name: 'JHAVENE', lane: JobLane.CASHIER, role: Role.STAFF, phone: '+18769998302' },
  { key: 'kevoniesha-cashier', name: 'KEVONIESHA', lane: JobLane.CASHIER, role: Role.STAFF, phone: '+18769998303' },
  { key: 'nathania-cashier', name: 'NATHANIA', lane: JobLane.CASHIER, role: Role.STAFF, phone: '+18769998304' },
  { key: 'nicketh-cashier', name: 'NICKETH', lane: JobLane.CASHIER, role: Role.STAFF, phone: '+18769998305' },
  { key: 'paula-cashier', name: 'PAULA', lane: JobLane.CASHIER, role: Role.STAFF, phone: '+18769998306' },
  { key: 'soyan-produce', name: 'SOYAN', lane: JobLane.PRODUCE_MEAT, role: Role.STAFF, phone: '+18769998401' },
  { key: 'karen-merch', name: 'KAREN', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998501' },
  { key: 'nicola-merch', name: 'NICOLA', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998502' },
  { key: 'sadie-merch', name: 'SADIE', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998503' },
  { key: 'stacy-merch', name: 'STACY', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998504' },
  { key: 'tellecia-merch', name: 'TELLECIA', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998505' },
  { key: 'adrian-merch', name: 'ADRIAN', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998506' },
  { key: 'devin-merch', name: 'DEVIN', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998507' },
  { key: 'melton-merch', name: 'MELTON', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998508' },
  { key: 'miguel-merch', name: 'MIGUEL', lane: JobLane.MERCHANDISER, role: Role.STAFF, phone: '+18769998509' },
];

const shifts: RosterShift[] = [
  shift('aleer-supervisor', 1, '08:00', '18:00'),
  shift('aleer-supervisor', 2, '11:00', '21:00'),
  shift('aleer-supervisor', 4, '08:00', '18:00'),
  shift('aleer-supervisor', 5, '11:00', '21:00'),
  shift('annmarie-supervisor', 1, '11:00', '21:00'),
  shift('annmarie-supervisor', 3, '06:00', '21:00'),
  shift('annmarie-supervisor', 6, '06:00', '21:00'),
  shift('stacy-supervisor', 1, '06:00', '21:00'),
  shift('stacy-supervisor', 2, '06:00', '16:00'),
  shift('stacy-supervisor', 5, '06:00', '21:00'),
  shift('tamara-supervisor', 0, '06:00', '21:00'),
  shift('tamara-supervisor', 2, '11:00', '21:00'),
  shift('tamara-supervisor', 4, '06:00', '21:00'),
  shift('tyrone-pricing', 1, '08:00', '18:00'),
  shift('tyrone-pricing', 2, '08:00', '18:00'),
  shift('tyrone-pricing', 3, '08:00', '18:00'),
  shift('tyrone-pricing', 5, '08:00', '18:00'),
  shift('antonette-cashier', 0, '06:00', '21:00'),
  shift('antonette-cashier', 2, '06:00', '16:00'),
  shift('antonette-cashier', 6, '06:00', '21:00'),
  shift('jhavene-cashier', 2, '06:00', '21:00'),
  shift('jhavene-cashier', 4, '06:00', '16:00'),
  shift('jhavene-cashier', 6, '06:00', '21:00'),
  shift('kevoniesha-cashier', 1, '06:00', '21:00'),
  shift('kevoniesha-cashier', 3, '06:00', '21:00'),
  shift('kevoniesha-cashier', 5, '06:00', '21:00'),
  shift('nathania-cashier', 0, '06:00', '21:00'),
  shift('nathania-cashier', 4, '06:00', '21:00'),
  shift('nathania-cashier', 6, '11:00', '21:00'),
  shift('nicketh-cashier', 1, '06:00', '21:00'),
  shift('nicketh-cashier', 3, '06:00', '16:00'),
  shift('nicketh-cashier', 5, '06:00', '21:00'),
  shift('soyan-produce', 1, '09:00', '19:00'),
  shift('soyan-produce', 3, '09:00', '19:00'),
  shift('soyan-produce', 5, '07:00', '17:00'),
  shift('soyan-produce', 6, '09:00', '19:00'),
  shift('karen-merch', 1, '07:00', '17:00'),
  shift('karen-merch', 2, '07:00', '17:00'),
  shift('karen-merch', 4, '07:00', '17:00'),
  shift('karen-merch', 5, '07:00', '17:00'),
  shift('nicola-merch', 2, '06:00', '21:00'),
  shift('nicola-merch', 5, '06:00', '16:00'),
  shift('nicola-merch', 6, '06:00', '21:00'),
  shift('sadie-merch', 0, '08:00', '18:00'),
  shift('sadie-merch', 2, '09:00', '19:00'),
  shift('sadie-merch', 3, '07:00', '17:00'),
  shift('sadie-merch', 5, '09:00', '19:00'),
  shift('stacy-merch', 1, '09:00', '19:00'),
  shift('stacy-merch', 2, '09:00', '19:00'),
  shift('stacy-merch', 4, '09:00', '19:00'),
  shift('stacy-merch', 5, '09:00', '19:00'),
  shift('tellecia-merch', 1, '09:00', '19:00'),
  shift('tellecia-merch', 3, '09:00', '19:00'),
  shift('tellecia-merch', 4, '09:00', '19:00'),
  shift('tellecia-merch', 6, '09:00', '19:00'),
  shift('adrian-merch', 0, '09:00', '19:00'),
  shift('adrian-merch', 6, '06:00', '21:00'),
  shift('devin-merch', 2, '06:00', '21:00'),
  shift('devin-merch', 4, '06:00', '21:00'),
  shift('devin-merch', 5, '11:00', '21:00'),
  shift('melton-merch', 0, '11:00', '21:00'),
  shift('melton-merch', 2, '06:00', '21:00'),
  shift('melton-merch', 5, '06:00', '21:00'),
  shift('miguel-merch', 1, '06:00', '21:00'),
  shift('miguel-merch', 3, '06:00', '21:00'),
];

async function main() {
  const pinHash = await hash(TEST_PIN, 10);
  const store = await getOrCreateStore();
  const manager = await upsertUser({
    storeId: store.id,
    fullName: 'SCHEDULE MANAGER',
    phone: '+18769998000',
    pinHash,
    role: Role.MANAGER,
    jobLane: JobLane.SUPERVISOR,
  });

  const usersByKey = new Map<string, string>();
  for (const employee of employees) {
    const user = await upsertUser({
      storeId: store.id,
      fullName: employee.name,
      phone: employee.phone,
      pinHash,
      role: employee.role,
      jobLane: employee.lane,
    });
    usersByKey.set(employee.key, user.id);
    await upsertAvailability(user.id);
  }

  await prisma.staffAbsence.deleteMany({
    where: {
      storeId: store.id,
      userId: { in: Array.from(usersByKey.values()) },
      startDate: { lte: addDays(WEEK_START, 6) },
      endDate: { gte: WEEK_START },
    },
  });

  await prisma.staffAbsence.create({
    data: {
      storeId: store.id,
      userId: requiredUser(usersByKey, 'paula-cashier'),
      startDate: WEEK_START,
      endDate: addDays(WEEK_START, 6),
      type: AbsenceType.OTHER,
      note: 'Blank row in source roster for 17/05/2026 week',
      createdById: manager.id,
    },
  });

  const schedule = await prisma.shiftSchedule.upsert({
    where: { storeId_weekStart: { storeId: store.id, weekStart: WEEK_START } },
    update: {
      status: ScheduleStatus.DRAFT,
      generatedBy: 'SEEDED_FROM_ROSTER_SCREENSHOT',
      aiPrompt: 'Seeded from SuperPlus schedule screenshot for 17/05/2026 - 23/05/2026.',
      aiResponse: JSON.stringify({ source: 'Schedule4.jpeg', shifts: shifts.length }),
      publishedAt: null,
      publishedById: null,
      slots: { deleteMany: {} },
    },
    create: {
      storeId: store.id,
      weekStart: WEEK_START,
      status: ScheduleStatus.DRAFT,
      generatedBy: 'SEEDED_FROM_ROSTER_SCREENSHOT',
      aiPrompt: 'Seeded from SuperPlus schedule screenshot for 17/05/2026 - 23/05/2026.',
      aiResponse: JSON.stringify({ source: 'Schedule4.jpeg', shifts: shifts.length }),
    },
  });

  await prisma.shiftSlot.createMany({
    data: shifts.map(item => ({
      scheduleId: schedule.id,
      userId: requiredUser(usersByKey, item.key),
      date: addDays(WEEK_START, item.day),
      startTime: item.start,
      endTime: item.end,
      role: employees.find(employee => employee.key === item.key)?.lane ?? JobLane.CASHIER,
    })),
  });

  console.log(
    JSON.stringify(
      {
        storeId: store.id,
        managerPhone: '+18769998000',
        pin: TEST_PIN,
        weekStart: formatDate(WEEK_START),
        employees: employees.length,
        shifts: shifts.length,
        scheduleId: schedule.id,
      },
      null,
      2,
    ),
  );
}

async function getOrCreateStore() {
  const existing = await prisma.store.findFirst({ where: { name: STORE_NAME } });
  if (existing) {
    return prisma.store.update({
      where: { id: existing.id },
      data: {
        parish: 'Manchester',
        address: 'Schedule test roster seeded from SuperPlus screenshots',
        phone: '+18769998099',
        openTime: '06:00',
        closeTime: '21:00',
        openDays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
        isActive: true,
      },
    });
  }

  return prisma.store.create({
    data: {
      name: STORE_NAME,
      parish: 'Manchester',
      address: 'Schedule test roster seeded from SuperPlus screenshots',
      phone: '+18769998099',
      openTime: '06:00',
      closeTime: '21:00',
      openDays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
    },
  });
}

async function upsertUser(input: {
  storeId: string;
  fullName: string;
  phone: string;
  pinHash: string;
  role: Role;
  jobLane: JobLane;
}) {
  return prisma.user.upsert({
    where: { phone: input.phone },
    update: {
      storeId: input.storeId,
      fullName: input.fullName,
      pinHash: input.pinHash,
      role: input.role,
      jobLane: input.jobLane,
      isActive: true,
    },
    create: input,
  });
}

async function upsertAvailability(userId: string) {
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    await prisma.staffAvailability.upsert({
      where: { userId_dayOfWeek: { userId, dayOfWeek } },
      update: { available: true, note: null },
      create: { userId, dayOfWeek, available: true, note: null },
    });
  }
}

function shift(key: string, day: number, start: string, end: string): RosterShift {
  return { key, day, start, end };
}

function requiredUser(usersByKey: Map<string, string>, key: string) {
  const userId = usersByKey.get(key);
  if (!userId) throw new Error(`Missing seeded user: ${key}`);
  return userId;
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
