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

export const appRouter = router({
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
});

export type AppRouter = typeof appRouter;
