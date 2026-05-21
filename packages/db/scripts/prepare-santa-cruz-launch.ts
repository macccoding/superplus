import { PrismaClient, JobLane, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findFirstOrThrow({
    where: { name: 'SuperPlus Santa Cruz', isActive: true },
    select: { id: true, name: true },
  });
  const pinHash = await hash('1234', 10);
  const camille = await prisma.user.updateMany({
    where: {
      storeId: store.id,
      OR: [
        { fullName: 'SCHEDULE MANAGER' },
        { fullName: 'Camille Meyler' },
        { phone: '8763992676' },
      ],
    },
    data: {
      fullName: 'Camille Meyler',
      phone: '8763992676',
      role: Role.MANAGER,
      jobLane: JobLane.SUPERVISOR,
      isActive: true,
    },
  });
  const michael = await prisma.user.upsert({
    where: { phone: '8763828177' },
    update: {
      storeId: store.id,
      fullName: 'Michael',
      role: Role.OWNER,
      jobLane: JobLane.SUPERVISOR,
      isActive: true,
    },
    create: {
      storeId: store.id,
      fullName: 'Michael',
      phone: '8763828177',
      pinHash,
      role: Role.OWNER,
      jobLane: JobLane.SUPERVISOR,
      isActive: true,
    },
  });
  const charles = await prisma.user.upsert({
    where: { phone: '8763828178' },
    update: {
      storeId: store.id,
      fullName: 'Charles Chen',
      role: Role.MANAGER,
      jobLane: JobLane.SUPERVISOR,
      isActive: true,
    },
    create: {
      storeId: store.id,
      fullName: 'Charles Chen',
      phone: '8763828178',
      pinHash,
      role: Role.MANAGER,
      jobLane: JobLane.SUPERVISOR,
      isActive: true,
    },
  });
  const users = await prisma.user.updateMany({
    where: { storeId: store.id, isActive: true },
    data: {
      pinHash,
      mustChangePin: true,
      pinChangedAt: null,
      onboardedAt: null,
      onboardingVersion: 0,
    },
  });
  await prisma.store.update({
    where: { id: store.id },
    data: {
      launchEnabled: true,
      launchedAt: new Date(),
      launchNotes: 'Santa Cruz V1 launch prepared with shared temporary PIN.',
    },
  });
  console.log(JSON.stringify({
    store: store.name,
    camilleUpdated: camille.count,
    michael: michael.fullName,
    charles: charles.fullName,
    activeUsersReset: users.count,
    temporaryPin: '1234',
  }, null, 2));
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
