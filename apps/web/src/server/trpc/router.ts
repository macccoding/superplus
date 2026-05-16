import { router } from './init';
import { tasksRouter } from './routers/tasks';
import { threadsRouter } from './routers/threads';
import { logbookRouter } from './routers/logbook';
import { announcementsRouter } from './routers/announcements';
import { usersRouter } from './routers/users';
import { storesRouter } from './routers/stores';

export const appRouter = router({
  tasks: tasksRouter,
  threads: threadsRouter,
  logbook: logbookRouter,
  announcements: announcementsRouter,
  users: usersRouter,
  stores: storesRouter,
});

export type AppRouter = typeof appRouter;
