import {
  getBlockedStaffModule,
  getStaffModulesByPlacement,
  getVisibleStaffModules,
  normalizeReleaseMode,
  SIMPLIFIED_STAFF_MODULE_IDS,
} from './modules';

function assertEqual(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertOk(value: unknown) {
  if (!value) throw new Error(`Expected truthy value, got ${String(value)}`);
}

assertEqual(SIMPLIFIED_STAFF_MODULE_IDS, ['tasks', 'threads', 'logbook', 'tools']);

assertEqual(
  getVisibleStaffModules('SIMPLIFIED').map((module) => module.id),
  ['tasks', 'threads', 'logbook', 'tools']
);

assertEqual(
  getStaffModulesByPlacement('SIMPLIFIED', 'main').map((module) => module.id),
  ['tasks', 'threads', 'logbook', 'tools']
);

assertOk(getVisibleStaffModules('FULL').some((module) => module.id === 'schedule'));
assertOk(getVisibleStaffModules('FULL').some((module) => module.id === 'announcements'));

assertEqual(getBlockedStaffModule('/hub/schedule', 'SIMPLIFIED')?.id, 'schedule');
assertEqual(getBlockedStaffModule('/hub/training/guide-1', 'SIMPLIFIED')?.id, 'training');
assertEqual(getBlockedStaffModule('/tools/stock-out', 'SIMPLIFIED'), null);
assertEqual(getBlockedStaffModule('/hub/tasks', 'SIMPLIFIED'), null);
assertEqual(getBlockedStaffModule('/hub/schedule', 'FULL'), null);

assertEqual(normalizeReleaseMode('FULL'), 'FULL');
assertEqual(normalizeReleaseMode('SIMPLIFIED'), 'SIMPLIFIED');
assertEqual(normalizeReleaseMode('anything-else'), 'SIMPLIFIED');
