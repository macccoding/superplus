export const RELEASE_MODES = ['SIMPLIFIED', 'FULL'] as const;
export type ReleaseMode = (typeof RELEASE_MODES)[number];

export const DEFAULT_RELEASE_MODE: ReleaseMode = 'SIMPLIFIED';

export type StaffModuleId =
  | 'tasks'
  | 'threads'
  | 'logbook'
  | 'tools'
  | 'schedule'
  | 'promotions'
  | 'announcements'
  | 'training'
  | 'suggestions';

export type StaffModulePlacement = 'main' | 'more';

export interface StaffModule {
  id: StaffModuleId;
  label: string;
  shortLabel?: string;
  icon: string;
  href: string;
  color: string;
  placement: StaffModulePlacement;
  simplified: boolean;
}

export const STAFF_MODULES: StaffModule[] = [
  { id: 'tasks', label: 'Tasks', icon: 'assignment', href: '/hub/tasks', color: '#446185', placement: 'main', simplified: true },
  { id: 'threads', label: 'Threads', icon: 'forum', href: '/hub/threads', color: '#2e7d32', placement: 'main', simplified: true },
  { id: 'logbook', label: 'Logbook', shortLabel: 'Log', icon: 'history', href: '/hub/logbook', color: '#845500', placement: 'main', simplified: true },
  { id: 'tools', label: 'Tools', icon: 'build', href: '/tools', color: '#673ab7', placement: 'main', simplified: true },
  { id: 'schedule', label: 'Schedule', icon: 'calendar_month', href: '/hub/schedule', color: '#1565c0', placement: 'main', simplified: false },
  { id: 'promotions', label: 'Deals', icon: 'sell', href: '/hub/promotions', color: '#c00029', placement: 'main', simplified: false },
  { id: 'announcements', label: 'Announce', icon: 'campaign', href: '/hub/announcements', color: '#a73b21', placement: 'more', simplified: false },
  { id: 'training', label: 'Learn', icon: 'school', href: '/hub/training', color: '#845500', placement: 'more', simplified: false },
  { id: 'suggestions', label: 'Suggest', icon: 'lightbulb', href: '/hub/suggestions', color: '#5c1f5c', placement: 'more', simplified: false },
];

export const SIMPLIFIED_STAFF_MODULE_IDS = STAFF_MODULES
  .filter((module) => module.simplified)
  .map((module) => module.id);

export function normalizeReleaseMode(value: unknown): ReleaseMode {
  return value === 'FULL' ? 'FULL' : DEFAULT_RELEASE_MODE;
}

export function getVisibleStaffModules(releaseMode: ReleaseMode) {
  return STAFF_MODULES.filter((module) => releaseMode === 'FULL' || module.simplified);
}

export function getStaffModulesByPlacement(releaseMode: ReleaseMode, placement: StaffModulePlacement) {
  return getVisibleStaffModules(releaseMode).filter((module) => module.placement === placement);
}

export function getStaffBottomNavItems(releaseMode: ReleaseMode) {
  return getVisibleStaffModules(releaseMode)
    .filter((module) => module.simplified)
    .map((module) => ({
      label: module.shortLabel ?? module.label,
      icon: module.icon,
      href: module.href,
    }));
}

export function getBlockedStaffModule(pathname: string, releaseMode: ReleaseMode) {
  if (releaseMode === 'FULL') return null;

  return STAFF_MODULES.find((module) => (
    !module.simplified
    && (pathname === module.href || pathname.startsWith(`${module.href}/`))
  )) ?? null;
}
