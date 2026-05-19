import assert from 'node:assert/strict';
import {
  canResolveLogEntry,
  isOpenHandover,
  logbookStatusWhere,
  sortLogbookEntries,
} from './logbook-policy';

const staff = { role: 'STAFF' };
const supervisor = { role: 'SUPERVISOR' };
const manager = { role: 'MANAGER' };

assert.equal(canResolveLogEntry(staff), false);
assert.equal(canResolveLogEntry(supervisor), true);
assert.equal(canResolveLogEntry(manager), true);

assert.deepEqual(logbookStatusWhere('all'), {});
assert.deepEqual(logbookStatusWhere('flagged'), { isFlagged: true });
assert.deepEqual(logbookStatusWhere('open'), { isFlagged: true, resolvedAt: null });
assert.deepEqual(logbookStatusWhere('resolved'), { resolvedAt: { not: null } });

assert.equal(isOpenHandover({ isFlagged: true, resolvedAt: null }), true);
assert.equal(isOpenHandover({ isFlagged: true, resolvedAt: new Date() }), false);
assert.equal(isOpenHandover({ isFlagged: false, resolvedAt: null }), false);

const sorted = sortLogbookEntries([
  { id: 'normal-new', isFlagged: false, resolvedAt: null, createdAt: new Date('2026-05-19T13:00:00Z') },
  { id: 'open-old', isFlagged: true, resolvedAt: null, createdAt: new Date('2026-05-19T10:00:00Z') },
  { id: 'resolved-new', isFlagged: true, resolvedAt: new Date('2026-05-19T12:00:00Z'), createdAt: new Date('2026-05-19T12:00:00Z') },
  { id: 'open-new', isFlagged: true, resolvedAt: null, createdAt: new Date('2026-05-19T11:00:00Z') },
]);

assert.deepEqual(sorted.map((entry) => entry.id), ['open-new', 'open-old', 'normal-new', 'resolved-new']);

console.log('Logbook policy tests passed');
