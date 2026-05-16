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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">People</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-[#E31837] text-white font-medium rounded-[8px]"
        >
          Add Staff
        </button>
      </div>

      <div className="bg-white rounded-[12px] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-[#6B7280]">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[#6B7280]">Phone</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[#6B7280]">Role</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[#6B7280]">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E]">{user.fullName}</td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">{user.phone}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">{user.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${user.isActive ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive.mutate({ id: user.id })}
                    className="text-xs text-[#6B7280] hover:text-[#1A1A2E]"
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-[#1A1A2E]">Add Staff Member</h2>

            <input
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              placeholder="Full name"
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none"
            />
            <input
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              placeholder="Phone (+1876...)"
              type="tel"
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none"
            />
            <input
              value={newUser.pin}
              onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="4-digit PIN"
              inputMode="numeric"
              maxLength={4}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none"
            >
              <option value="STAFF">Staff</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="MANAGER">Manager</option>
            </select>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 h-12 border-2 border-gray-200 rounded-[8px] text-[#6B7280] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => createUser.mutate(newUser)}
                disabled={!newUser.fullName || !newUser.phone || newUser.pin.length !== 4}
                className="flex-1 h-12 bg-[#E31837] text-white font-semibold rounded-[8px] disabled:opacity-40"
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
