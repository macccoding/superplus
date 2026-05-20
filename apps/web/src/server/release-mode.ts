import { DEFAULT_RELEASE_MODE, normalizeReleaseMode, type ReleaseMode } from '@superplus/config';

export const RELEASE_MODE_SETTING_KEY = 'releaseMode';

type ReleaseModeDb = {
  appSetting?: {
    findUnique(args: { where: { key: string } }): Promise<{ value: string } | null>;
  };
};

export async function getReleaseMode(db: ReleaseModeDb): Promise<ReleaseMode> {
  const setting = await db.appSetting?.findUnique({ where: { key: RELEASE_MODE_SETTING_KEY } });
  return normalizeReleaseMode(setting?.value ?? DEFAULT_RELEASE_MODE);
}
