import assert from 'node:assert/strict';
import { ThreadReactionType } from '@superplus/db';
import {
  allowedThreadReactions,
  canDeleteThreadMessage,
  canEditThreadMessage,
  canManageThread,
  shouldNotifyFollower,
  threadViews,
  uniqueRecipients,
  unreadCountForThread,
} from './threads-policy';
import { detectThreadOpsSuggestions } from '../../thread-ops-rules';

const staff = { id: 'staff-1', role: 'STAFF' as const };
const otherStaff = { id: 'staff-2', role: 'STAFF' as const };
const supervisor = { id: 'supervisor-1', role: 'SUPERVISOR' as const };

assert.equal(canManageThread(staff), false);
assert.equal(canManageThread(supervisor), true);

assert.equal(canEditThreadMessage(staff, { authorId: 'staff-1' }), true);
assert.equal(canEditThreadMessage(staff, { authorId: 'staff-2' }), false);
assert.equal(canEditThreadMessage(staff, { authorId: 'staff-1', deletedAt: new Date() }), false);

assert.equal(canDeleteThreadMessage(staff, { authorId: 'staff-1' }), true);
assert.equal(canDeleteThreadMessage(staff, { authorId: 'staff-2' }), false);
assert.equal(canDeleteThreadMessage(supervisor, { authorId: 'staff-2' }), true);
assert.equal(canDeleteThreadMessage(supervisor, { authorId: 'staff-2', deletedAt: new Date() }), false);

const base = new Date('2026-05-18T10:00:00Z');
assert.equal(
  unreadCountForThread(
    [
      { authorId: 'staff-2', createdAt: new Date('2026-05-18T09:00:00Z') },
      { authorId: 'staff-2', createdAt: new Date('2026-05-18T11:00:00Z') },
      { authorId: 'staff-1', createdAt: new Date('2026-05-18T12:00:00Z') },
      { authorId: 'staff-2', createdAt: new Date('2026-05-18T13:00:00Z'), deletedAt: new Date() },
    ],
    { lastReadAt: base },
    'staff-1'
  ),
  1
);
assert.equal(unreadCountForThread([{ authorId: 'staff-2', createdAt: base }], null, 'staff-1'), 1);

assert.deepEqual(uniqueRecipients('staff-1', ['staff-1', 'staff-2', 'staff-2', null, 'supervisor-1']), ['staff-2', 'supervisor-1']);
assert.equal(shouldNotifyFollower({ userId: otherStaff.id, isFollowing: true }), true);
assert.equal(shouldNotifyFollower({ userId: otherStaff.id, isFollowing: false }), false);
assert.equal(shouldNotifyFollower({ userId: otherStaff.id, isFollowing: true, mutedAt: new Date() }), false);
assert.deepEqual(allowedThreadReactions, [ThreadReactionType.ACK, ThreadReactionType.THANKS]);
assert.ok(threadViews.includes('URGENT'));
assert.ok(threadViews.includes('NO_REPLY'));
assert.ok(threadViews.includes('NEEDS_TASK'));
assert.ok(threadViews.includes('UNACKED'));

const stockSuggestions = detectThreadOpsSuggestions({
  title: 'Low stock on flour',
  body: 'Shelf is empty and we need restock',
  category: 'INVENTORY',
});
assert.equal(stockSuggestions[0].id, 'STOCK_OUT');
assert.equal(stockSuggestions[0].action, 'REPORT_STOCK_OUT');

const incidentSuggestions = detectThreadOpsSuggestions({
  title: 'Customer slip',
  body: 'Customer had a fall near aisle 3',
  category: 'URGENT',
});
assert.ok(incidentSuggestions.some((suggestion) => suggestion.id === 'INCIDENT'));

const quietSuggestions = detectThreadOpsSuggestions({
  title: 'Morning note',
  body: 'Bread display was cleaned and signed off',
  category: 'GENERAL',
});
assert.deepEqual(quietSuggestions, []);

console.log('Thread policy tests passed');
