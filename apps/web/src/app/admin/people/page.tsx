'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

export default function PeoplePage() {
  const utils = trpc.useUtils();
  const { data: users } = trpc.users.list.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', phone: '', pin: '', role: 'STAFF' as const });

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      setShowAdd(false);
      setNewUser({ fullName: '', phone: '', pin: '', role: 'STAFF' });
    },
  });

  const toggleActive = trpc.users.toggleActive.useMutation({
    onSuccess: () => utils.users.invalidate(),
  });

  const roleColors: Record<string, string> = {
    OWNER: 'bg-brand/10 text-brand',
    MANAGER: 'bg-navy/10 text-navy',
    SUPERVISOR: 'bg-tertiary/10 text-warning',
    STAFF: 'bg-surface-cream text-on-surface-secondary',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">People</h1>
          <p className="text-on-surface-secondary mt-1">{users?.length || 0} staff members</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Add Staff
        </button>
      </div>

      <div className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-outline/30">
              <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Name</th>
              <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Phone</th>
              <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Role</th>
              <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Status</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-outline/10 hover:bg-surface transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-navy">
                        {user.fullName.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-on-surface">{user.fullName}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-on-surface-secondary">{user.phone}</td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${roleColors[user.role] || roleColors.STAFF}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-success' : 'bg-error'}`} />
                    <span className={`text-xs font-medium ${user.isActive ? 'text-success' : 'text-error'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => toggleActive.mutate({ id: user.id })}
                    className="text-xs text-on-surface-secondary hover:text-on-surface font-medium px-3 py-1.5 rounded-lg hover:bg-surface-cream transition-all"
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add staff modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-surface-white rounded-[--radius-lg] p-6 w-full max-w-md space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">Add Staff Member</h2>

            <input
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              placeholder="Full name"
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors"
            />
            <input
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              placeholder="Phone (+1876...)"
              type="tel"
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors"
            />
            <input
              value={newUser.pin}
              onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="4-digit PIN"
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors"
            >
              <option value="STAFF">Staff</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="MANAGER">Manager</option>
            </select>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => createUser.mutate(newUser)}
                disabled={!newUser.fullName || !newUser.phone || newUser.pin.length !== 4}
                className="flex-1 h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
