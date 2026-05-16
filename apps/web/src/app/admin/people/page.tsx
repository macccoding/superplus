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
    OWNER: 'bg-primary/10 text-primary',
    MANAGER: 'bg-secondary/10 text-secondary',
    SUPERVISOR: 'bg-tertiary/10 text-on-tertiary-container',
    STAFF: 'bg-surface-container-high text-on-surface-variant',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-on-surface">People</h1>
          <p className="text-on-surface-variant mt-1">{users?.length || 0} staff members</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="h-12 px-5 bg-primary text-on-primary font-bold rounded-xl flex items-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Add Staff
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant/30">
              <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-variant">Name</th>
              <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-variant">Phone</th>
              <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-variant">Role</th>
              <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-variant">Status</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center">
                      <span className="text-xs font-bold text-on-secondary-container">
                        {user.fullName.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-on-surface">{user.fullName}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-on-surface-variant">{user.phone}</td>
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
                    className="text-xs text-on-surface-variant hover:text-on-surface font-medium px-3 py-1.5 rounded-lg hover:bg-surface-container-high transition-all"
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add staff modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">Add Staff Member</h2>

            <input
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              placeholder="Full name"
              className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline transition-colors"
            />
            <input
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              placeholder="Phone (+1876...)"
              type="tel"
              className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline transition-colors"
            />
            <input
              value={newUser.pin}
              onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="4-digit PIN"
              inputMode="numeric"
              maxLength={4}
              className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline transition-colors"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
              className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors"
            >
              <option value="STAFF">Staff</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="MANAGER">Manager</option>
            </select>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 h-14 border-2 border-outline-variant rounded-xl text-on-surface-variant font-bold active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => createUser.mutate(newUser)}
                disabled={!newUser.fullName || !newUser.phone || newUser.pin.length !== 4}
                className="flex-1 h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
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
