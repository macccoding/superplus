import { router } from './init';
import { tasksRouter } from './routers/tasks';
import { threadsRouter } from './routers/threads';
import { logbookRouter } from './routers/logbook';
import { announcementsRouter } from './routers/announcements';
import { usersRouter } from './routers/users';
import { storesRouter } from './routers/stores';
import { activityRouter } from './routers/activity';
import { productsRouter } from './routers/products';
import { categoriesRouter } from './routers/categories';
import { checklistsRouter } from './routers/checklists';
import { expiryAlertsRouter } from './routers/expiryAlerts';
import { stockOutsRouter } from './routers/stockOuts';
import { incidentsRouter } from './routers/incidents';
import { reportsRouter } from './routers/reports';
import { schedulesRouter } from './routers/schedules';
import { availabilityRouter } from './routers/availability';
import { suppliersRouter } from './routers/suppliers';
import { ordersRouter } from './routers/orders';
import { promotionsRouter } from './routers/promotions';
import { trainingRouter } from './routers/training';
import { suggestionsRouter } from './routers/suggestions';
import { notificationsRouter } from './routers/notifications';
import { settingsRouter } from './routers/settings';
import { adminRouter } from './routers/admin';

export const appRouter = router({
  admin: adminRouter,
  settings: settingsRouter,
  tasks: tasksRouter,
  threads: threadsRouter,
  logbook: logbookRouter,
  announcements: announcementsRouter,
  users: usersRouter,
  stores: storesRouter,
  activity: activityRouter,
  products: productsRouter,
  categories: categoriesRouter,
  checklists: checklistsRouter,
  expiryAlerts: expiryAlertsRouter,
  stockOuts: stockOutsRouter,
  incidents: incidentsRouter,
  reports: reportsRouter,
  schedules: schedulesRouter,
  availability: availabilityRouter,
  suppliers: suppliersRouter,
  orders: ordersRouter,
  promotions: promotionsRouter,
  training: trainingRouter,
  suggestions: suggestionsRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
