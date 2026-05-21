import assert from 'node:assert/strict';
import { usersRouter } from './users';

const stores = [
  { id: 'store-a', name: 'Cross Roads', isActive: true },
  { id: 'store-b', name: 'Half Way Tree', isActive: true },
];

function ctx(role: string, storeId = 'store-a', overrides: any = {}) {
  return {
    session: { user: { id: `${role.toLowerCase()}-1`, name: role, role, storeId } },
    db: {
      store: {
        findMany: async () => stores,
        findFirst: async ({ where }: any) => stores.find((store) => store.id === where.id && store.isActive === where.isActive) ?? null,
      },
      ...overrides,
    },
  };
}

async function main() {
  let updateData: any;
  const staffCaller = usersRouter.createCaller(ctx('STAFF', 'store-a', {
    user: {
      update: async ({ data, select }: any) => {
        updateData = data;
        return { id: 'staff-1', fullName: 'Maya Brown', ...data, profileUpdatedAt: new Date(), select };
      },
    },
  }) as any);

  await staffCaller.updateMyProfile({
    preferredName: ' Maya ',
    birthdayMonth: 2,
    birthdayDay: 29,
    favoriteColor: 'Blue',
    favoriteTreat: '',
    dreamGoal: 'Run my own shop',
    proudMoment: null,
    learningInterest: 'Supervisor skills',
    celebrationPreference: 'Quiet treat',
    showBirthday: true,
  });

  assert.equal(updateData.preferredName, 'Maya');
  assert.equal(updateData.favoriteTreat, null);
  assert.equal(updateData.birthdayDay, 29);
  assert.ok(updateData.profileUpdatedAt instanceof Date);

  await assert.rejects(
    () => staffCaller.updateMyProfile({ birthdayMonth: 2, birthdayDay: 31 }),
    /valid birthday/
  );

  const managerCaller = usersRouter.createCaller(ctx('MANAGER', 'store-a', {
    user: {
      findMany: async ({ where }: any) => {
        assert.equal(where.storeId, 'store-a');
        return [
          {
            id: 'u-1',
            fullName: 'Maya Brown',
            phone: '18765550123',
            role: 'STAFF',
            jobLane: 'CASHIER',
            storeId: 'store-a',
            isActive: true,
            createdAt: new Date(),
            preferredName: 'Maya',
            birthdayMonth: new Date().getMonth() + 1,
            birthdayDay: new Date().getDate(),
            favoriteColor: 'Blue',
            favoriteTreat: 'Fruit juice',
            dreamGoal: 'Open a shop',
            proudMoment: null,
            learningInterest: 'Pricing',
            celebrationPreference: 'Team shoutout',
            showBirthday: true,
            profileUpdatedAt: new Date(),
            store: stores[0],
          },
          {
            id: 'u-2',
            fullName: 'Andre King',
            phone: '18765550124',
            role: 'STAFF',
            jobLane: 'MERCHANDISER',
            storeId: 'store-a',
            isActive: true,
            createdAt: new Date(),
            preferredName: null,
            birthdayMonth: new Date().getMonth() + 1,
            birthdayDay: new Date().getDate(),
            favoriteColor: null,
            favoriteTreat: null,
            dreamGoal: null,
            proudMoment: null,
            learningInterest: null,
            celebrationPreference: null,
            showBirthday: false,
            profileUpdatedAt: null,
            store: stores[0],
          },
        ];
      },
    },
    task: { findMany: async () => [] },
    adminActionLog: { findMany: async () => [] },
  }) as any);

  const ops = await managerCaller.staffOperations({ scope: 'ALL' });
  assert.equal(ops.summary.profilesComplete, 1);
  assert.equal(ops.summary.upcomingBirthdays, 1);
  assert.equal(ops.upcomingBirthdays[0].favoriteTreat, 'Fruit juice');
  assert.equal(ops.staff.find((user: any) => user.id === 'u-2').birthdayMonth, null);

  console.log('Users profile tests passed');
}

main().catch((error) => {
  throw error;
});
