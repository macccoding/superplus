import { z } from 'zod';
import { normalizeReleaseMode, type ReleaseMode } from '@superplus/config';
import { router, ownerProcedure, protectedProcedure } from '../init';
import { getReleaseMode, RELEASE_MODE_SETTING_KEY } from '../../release-mode';

const releaseModeInput = z.object({
  mode: z.enum(['SIMPLIFIED', 'FULL']),
});

export const settingsRouter = router({
  getReleaseMode: protectedProcedure.query(async ({ ctx }) => {
    const mode = await getReleaseMode(ctx.db);

    return {
      mode,
      canUpdate: ctx.user.role === 'OWNER',
    };
  }),

  updateReleaseMode: ownerProcedure
    .input(releaseModeInput)
    .mutation(async ({ ctx, input }) => {
      const mode: ReleaseMode = normalizeReleaseMode(input.mode);

      await ctx.db.appSetting.upsert({
        where: { key: RELEASE_MODE_SETTING_KEY },
        create: {
          key: RELEASE_MODE_SETTING_KEY,
          value: mode,
          updatedById: ctx.user.id,
        },
        update: {
          value: mode,
          updatedById: ctx.user.id,
        },
      });

      return { mode };
    }),
});
