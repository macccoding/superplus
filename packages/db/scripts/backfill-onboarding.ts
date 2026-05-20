import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { isActive: true, onboardedAt: null },
    data: { onboardedAt: new Date(), onboardingVersion: 1 },
  });
  console.log(`Backfilled ${result.count} users with onboardedAt + onboardingVersion=1`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
