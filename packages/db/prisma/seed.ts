import { AbsenceType, JobLane, PrismaClient, Priority, Role, TaskStatus, TaskUpdateType } from '@prisma/client';
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

  const owner = await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Michael',
      phone: '8763828177',
      pinHash,
      role: Role.OWNER,
      jobLane: JobLane.SUPERVISOR,
    },
  });

  const manager = await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Store Manager',
      phone: '+18760000002',
      pinHash,
      role: Role.MANAGER,
      jobLane: JobLane.SUPERVISOR,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Floor Supervisor',
      phone: '+18760000003',
      pinHash,
      role: Role.SUPERVISOR,
      jobLane: JobLane.SUPERVISOR,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Cashier Staff',
      phone: '+18760000004',
      pinHash,
      role: Role.STAFF,
      jobLane: JobLane.CASHIER,
    },
  });

  const stockClerk = await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Stock Clerk',
      phone: '+18760000005',
      pinHash,
      role: Role.STAFF,
      jobLane: JobLane.MERCHANDISER,
    },
  });

  const maintenance = await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Maintenance Lead',
      phone: '+18760000006',
      pinHash,
      role: Role.SUPERVISOR,
      jobLane: JobLane.SUPERVISOR,
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
    data: { openTime: '06:00', closeTime: '21:00', openDays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat' },
  });

  // Phase 4: Staff availability (sample)
  const users = await prisma.user.findMany({ where: { storeId: store.id } });
  for (const u of users) {
    for (let day = 0; day < 7; day++) {
      await prisma.staffAvailability.create({
        data: {
          userId: u.id,
          dayOfWeek: day,
          available: true,
          note: null,
        },
      });
    }
  }

  const absenceStart = new Date();
  absenceStart.setDate(absenceStart.getDate() + 10);
  absenceStart.setHours(0, 0, 0, 0);
  const absenceEnd = new Date(absenceStart);
  absenceEnd.setDate(absenceEnd.getDate() + 2);
  await prisma.staffAbsence.create({
    data: {
      storeId: store.id,
      userId: stockClerk.id,
      startDate: absenceStart,
      endDate: absenceEnd,
      type: AbsenceType.VACATION_LEAVE,
      note: 'Sample vacation block for schedule testing',
      createdById: manager.id,
    },
  });

  const today = new Date();
  today.setHours(17, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const cleaningTask = await prisma.task.create({
    data: {
      storeId: store.id,
      title: 'Mop front entrance before lunch rush',
      description: 'Wet floor signs first, then mop from doors toward register 1.',
      category: 'Cleaning',
      workArea: 'Front',
      priority: Priority.NORMAL,
      status: TaskStatus.OPEN,
      createdById: supervisor.id,
      dueDate: today,
      checklistItems: {
        create: [
          { label: 'Place wet floor signs', sortOrder: 0 },
          { label: 'Mop entrance tiles', sortOrder: 1 },
          { label: 'Remove signs after dry', sortOrder: 2 },
        ],
      },
      updates: {
        create: [{ authorId: supervisor.id, type: TaskUpdateType.CREATED, body: 'Task created from morning walk-through', toStatus: TaskStatus.OPEN }],
      },
    },
  });

  await prisma.task.create({
    data: {
      storeId: store.id,
      title: 'Restock Pepsi 2L display',
      description: 'Bring 8 cases from back store and face the display.',
      category: 'Stock',
      workArea: 'Aisle 1',
      assetLabel: 'Front drinks display',
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      createdById: manager.id,
      assignedToId: stockClerk.id,
      dueDate: today,
      updates: {
        create: [
          { authorId: manager.id, type: TaskUpdateType.CREATED, body: 'Task created for afternoon restock', toStatus: TaskStatus.OPEN },
          { authorId: stockClerk.id, type: TaskUpdateType.REASSIGNED, body: 'Stock Clerk started this task', fromStatus: TaskStatus.OPEN, toStatus: TaskStatus.IN_PROGRESS },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      storeId: store.id,
      title: 'Check freezer noise',
      description: 'Freezer by meats is making a loud rattle. Check fan cover and report back.',
      category: 'Maintenance',
      workArea: 'Chill Room',
      assetLabel: 'Meat freezer',
      priority: Priority.URGENT,
      status: TaskStatus.NEEDS_HELP,
      createdById: manager.id,
      assignedToId: maintenance.id,
      dueDate: yesterday,
      helpRequestedAt: new Date(),
      checklistItems: {
        create: [
          { label: 'Inspect fan guard', sortOrder: 0 },
          { label: 'Check temperature reading', sortOrder: 1 },
          { label: 'Add repair note', sortOrder: 2 },
        ],
      },
      updates: {
        create: [
          { authorId: manager.id, type: TaskUpdateType.CREATED, body: 'Urgent freezer check created', toStatus: TaskStatus.OPEN },
          { authorId: maintenance.id, type: TaskUpdateType.HELP_REQUESTED, body: 'Need ladder and second person to open top cover safely.', fromStatus: TaskStatus.IN_PROGRESS, toStatus: TaskStatus.NEEDS_HELP },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      storeId: store.id,
      title: 'Truck 2 morning inspection',
      description: 'Complete pre-trip inspection before supplier pickup.',
      category: 'Delivery',
      workArea: 'Truck',
      assetLabel: 'Truck 2',
      priority: Priority.HIGH,
      status: TaskStatus.IN_REVIEW,
      createdById: owner.id,
      assignedToId: maintenance.id,
      dueDate: today,
      reviewRequired: true,
      requireCompletionNote: true,
      submittedForReviewAt: new Date(),
      completionNote: 'Oil, tires, lights, and brake check complete.',
      checklistItems: {
        create: [
          { label: 'Check oil and coolant', sortOrder: 0, isDone: true, completedById: maintenance.id, completedAt: new Date() },
          { label: 'Check tire pressure', sortOrder: 1, isDone: true, completedById: maintenance.id, completedAt: new Date() },
          { label: 'Check lights and brakes', sortOrder: 2, isDone: true, completedById: maintenance.id, completedAt: new Date() },
        ],
      },
      updates: {
        create: [
          { authorId: owner.id, type: TaskUpdateType.CREATED, body: 'Truck inspection assigned', toStatus: TaskStatus.OPEN },
          { authorId: maintenance.id, type: TaskUpdateType.SUBMITTED_REVIEW, body: 'Inspection complete, waiting on supervisor review.', fromStatus: TaskStatus.IN_PROGRESS, toStatus: TaskStatus.IN_REVIEW },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      storeId: store.id,
      title: 'Count register 2 float',
      description: 'Confirm starting float and write any shortage in logbook.',
      category: 'Office',
      workArea: 'Front',
      priority: Priority.NORMAL,
      status: TaskStatus.DONE,
      createdById: supervisor.id,
      assignedToId: cashier.id,
      dueDate: yesterday,
      completedAt: new Date(),
      completionNote: 'Float counted and matches register sheet.',
      updates: {
        create: [
          { authorId: supervisor.id, type: TaskUpdateType.CREATED, body: 'Opening cash task created', toStatus: TaskStatus.OPEN },
          { authorId: cashier.id, type: TaskUpdateType.COMPLETION, body: 'Float counted and matches register sheet.', fromStatus: TaskStatus.IN_PROGRESS, toStatus: TaskStatus.DONE },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      storeId: store.id,
      title: 'Review weekly promotion signs',
      description: 'Make sure shelf signs match current deals before Friday.',
      category: 'Promotions',
      workArea: 'Aisles',
      priority: Priority.LOW,
      status: TaskStatus.OPEN,
      createdById: manager.id,
      dueDate: nextWeek,
      links: { create: [{ type: 'CHECKLIST', entityId: closingTemplate.id, label: 'Nightly Closing checklist' }] },
      updates: { create: [{ authorId: manager.id, type: TaskUpdateType.CREATED, body: 'Task created for upcoming deals', toStatus: TaskStatus.OPEN }] },
    },
  });

  await prisma.taskTemplate.create({
    data: {
      storeId: store.id,
      title: 'Weekly freezer check',
      description: 'Check temperature, clear ice buildup, and note issues.',
      category: 'Maintenance',
      defaultWorkArea: 'Chill Room',
      priority: Priority.HIGH,
      recurrenceRule: 'weekly',
      reviewRequired: true,
      requireCompletionNote: true,
      createdById: manager.id,
      items: {
        create: [
          { label: 'Record temperature', sortOrder: 0 },
          { label: 'Check door seal', sortOrder: 1 },
          { label: 'Note any ice buildup', sortOrder: 2, isRequired: false },
        ],
      },
    },
  });

  console.log(`Seed complete: 1 store, 6 users (PIN: 1234), 4 categories, 6 products, 1 checklist template, ${await prisma.task.count({ where: { storeId: store.id } })} tasks, 1 task template, store hours, ${users.length * 7} availability records`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
