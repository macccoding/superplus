'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc-client';

const roleColors: Record<string, string> = {
  OWNER: 'bg-brand/10 text-brand',
  MANAGER: 'bg-navy/10 text-navy',
  SUPERVISOR: 'bg-tertiary/10 text-warning',
  STAFF: 'bg-surface-cream text-on-surface-secondary',
};

const jobLaneLabels: Record<string, string> = {
  SUPERVISOR: 'Supervisor',
  PRICING_CLERK: 'Pricing Clerk',
  CASHIER: 'Cashier',
  PRODUCE_MEAT: 'Produce/Meat',
  MERCHANDISER: 'Merchandiser',
};

const jobLaneOptions = Object.entries(jobLaneLabels);

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function PeoplePage() {
  const utils = trpc.useUtils();
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState('ALL');
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [toggleTarget, setToggleTarget] = useState<any | null>(null);
  const [newPin, setNewPin] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', phone: '', pin: '', role: 'STAFF', jobLane: 'CASHIER', storeId: '' });

  const listInput = {
    scope: activeScope,
    role: roleFilter === 'ALL' ? undefined : roleFilter as any,
    isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
    search: search.trim() || undefined,
  };

  const { data: users, isLoading } = trpc.users.list.useQuery(listInput);
  const { data: ops } = trpc.users.staffOperations.useQuery({ scope: activeScope });
  const staffById = useMemo(() => new Map((ops?.staff ?? []).map((user: any) => [user.id, user])), [ops]);

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      utils.admin.invalidate();
      setShowAdd(false);
      setNewUser({ fullName: '', phone: '', pin: '', role: 'STAFF', jobLane: 'CASHIER', storeId: '' });
    },
  });

  const updateJobLane = trpc.users.updateJobLane.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      utils.admin.invalidate();
    },
  });

  const toggleActive = trpc.users.toggleActive.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      utils.admin.invalidate();
      setToggleTarget(null);
    },
  });

  const resetPin = trpc.users.resetPin.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      utils.admin.invalidate();
      setResetDone(true);
    },
  });

  const summary = ops?.summary ?? { active: 0, inactive: 0, managers: 0, supervisors: 0, unassigned: 0, overloaded: 0 };
  const selectedStoreId = activeScope === 'ALL' ? newUser.storeId : activeScope;
  const canCreate = newUser.fullName.trim() && newUser.phone.trim() && newUser.pin.length === 4 && selectedStoreId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">People</h1>
          <p className="text-on-surface-secondary mt-1">Staff access, workload, and account actions</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Add Staff
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          ['Active', summary.active, 'groups', 'text-success'],
          ['Inactive', summary.inactive, 'person_off', 'text-error'],
          ['Leads', summary.managers + summary.supervisors, 'supervisor_account', 'text-navy'],
          ['Unassigned', summary.unassigned, 'assignment_late', 'text-warning'],
          ['Overloaded', summary.overloaded, 'priority_high', 'text-brand'],
          ['Shown', users?.length ?? 0, 'filter_list', 'text-on-surface-secondary'],
        ].map(([label, value, icon, color]) => (
          <div key={label as string} className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm min-h-[96px]">
            <div className="flex items-center justify-between">
              <span className={`material-symbols-outlined ${color as string}`}>{icon}</span>
              <span className="text-2xl font-extrabold text-on-surface">{value as number}</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary mt-3">{label as string}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[180px_160px_160px_1fr]">
          <select
            value={activeScope ?? ''}
            onChange={(e) => setScope(e.target.value)}
            className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface"
            aria-label="Store scope"
          >
            {canUseAllStores && <option value="ALL">All Stores</option>}
            {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface"
            aria-label="Role filter"
          >
            <option value="ALL">All Roles</option>
            <option value="MANAGER">Managers</option>
            <option value="SUPERVISOR">Supervisors</option>
            <option value="STAFF">Staff</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface"
            aria-label="Status filter"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ALL">All Statuses</option>
          </select>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-secondary">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone"
              className="w-full h-12 pl-12 pr-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
        </div>
      ) : (
        <>
          <div className="lg:hidden space-y-3">
            {users?.map((user: any) => {
              const workload = staffById.get(user.id)?.workload ?? { active: 0, overdue: 0, help: 0 };
              return (
                <div key={user.id} className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-extrabold text-navy">{initials(user.fullName)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="font-extrabold text-on-surface">{user.fullName}</h2>
                          <p className="text-xs text-on-surface-secondary">{user.store?.name} · {user.phone}</p>
                          <p className="text-xs font-bold text-navy mt-1">{jobLaneLabels[user.jobLane] ?? user.jobLane}</p>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${roleColors[user.role] || roleColors.STAFF}`}>{user.role}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <Metric label="Active" value={workload.active} />
                        <Metric label="Late" value={workload.overdue} urgent={workload.overdue > 0} />
                        <Metric label="Help" value={workload.help} urgent={workload.help > 0} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button onClick={() => { setResetTarget(user); setNewPin(''); setResetDone(false); }} className="h-12 rounded-[--radius-lg] bg-surface-cream text-sm font-bold text-on-surface-secondary">Reset PIN</button>
                        <button onClick={() => user.isActive && workload.active > 0 ? setToggleTarget({ ...user, workload }) : toggleActive.mutate({ id: user.id })} className={`h-12 rounded-[--radius-lg] text-sm font-bold ${user.isActive ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden lg:block bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-outline/30">
                  <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Name</th>
                  <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Store</th>
                  <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Role</th>
                  <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Job Lane</th>
                  <th className="text-center px-5 py-4 text-sm font-medium text-on-surface-secondary">Workload</th>
                  <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Status</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user: any) => {
                  const workload = staffById.get(user.id)?.workload ?? { active: 0, overdue: 0, help: 0 };
                  return (
                    <tr key={user.id} className="border-b border-outline/10 hover:bg-surface transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-navy">{initials(user.fullName)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{user.fullName}</p>
                            <p className="text-xs text-on-surface-secondary">{user.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface-secondary">{user.store?.name}</td>
                      <td className="px-5 py-4"><span className={`text-xs font-bold px-3 py-1 rounded-full ${roleColors[user.role] || roleColors.STAFF}`}>{user.role}</span></td>
                      <td className="px-5 py-4">
                        <select
                          value={user.jobLane}
                          onChange={(e) => updateJobLane.mutate({ id: user.id, jobLane: e.target.value as any })}
                          className="h-10 px-3 bg-surface border-2 border-outline rounded-[--radius-md] text-xs font-bold text-on-surface"
                          aria-label={`Job lane for ${user.fullName}`}
                        >
                          {jobLaneOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-2">
                          <Badge label={`${workload.active} active`} />
                          {workload.overdue > 0 && <Badge label={`${workload.overdue} late`} tone="danger" />}
                          {workload.help > 0 && <Badge label={`${workload.help} help`} tone="warning" />}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold ${user.isActive ? 'text-success' : 'text-error'}`}>{user.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setResetTarget(user); setNewPin(''); setResetDone(false); }} className="h-10 px-3 rounded-[--radius-md] bg-surface-cream text-xs font-bold text-on-surface-secondary">Reset PIN</button>
                          <button onClick={() => user.isActive && workload.active > 0 ? setToggleTarget({ ...user, workload }) : toggleActive.mutate({ id: user.id })} className={`h-10 px-3 rounded-[--radius-md] text-xs font-bold ${user.isActive ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isLoading && users?.length === 0 && (
        <div className="bg-surface-white rounded-[--radius-lg] p-10 text-center shadow-sm">
          <span className="material-symbols-outlined text-[44px] text-on-surface-secondary">person_search</span>
          <p className="font-bold text-on-surface mt-3">No staff match these filters</p>
          <p className="text-sm text-on-surface-secondary mt-1">Clear a filter or choose another store.</p>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-surface-white rounded-[--radius-lg] p-6 w-full max-w-md space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">Add Staff Member</h2>
            {activeScope === 'ALL' && (
              <select value={newUser.storeId} onChange={(e) => setNewUser({ ...newUser, storeId: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] text-on-surface">
                <option value="">Choose store</option>
                {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            )}
            <input value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Full name" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
            <input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="Phone (+1876...)" type="tel" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
            <input value={newUser.pin} onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="4-digit PIN" type="password" inputMode="numeric" maxLength={4} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] text-on-surface">
              <option value="STAFF">Staff</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="MANAGER">Manager</option>
            </select>
            <select value={newUser.jobLane} onChange={(e) => setNewUser({ ...newUser, jobLane: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] text-on-surface">
              {jobLaneOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {createUser.error && <p className="text-sm font-bold text-error">{createUser.error.message}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold">Cancel</button>
              <button onClick={() => createUser.mutate({ ...newUser, role: newUser.role as any, jobLane: newUser.jobLane as any, storeId: selectedStoreId || undefined })} disabled={!canCreate || createUser.isPending} className="flex-1 h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40">Add</button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setResetTarget(null)}>
          <div className="bg-surface-white rounded-[--radius-lg] p-6 w-full max-w-sm space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">Reset PIN</h2>
            <p className="text-sm text-on-surface-secondary">Set a new 4-digit PIN for <span className="font-bold text-on-surface">{resetTarget.fullName}</span>.</p>
            <input value={newPin} onChange={(e) => { setResetDone(false); setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4)); }} placeholder="New PIN" type="password" inputMode="numeric" maxLength={4} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] text-on-surface" />
            {resetDone && <p className="text-sm font-bold text-success">PIN reset logged.</p>}
            {resetPin.error && <p className="text-sm font-bold text-error">{resetPin.error.message}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setResetTarget(null)} className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold">Close</button>
              <button onClick={() => resetPin.mutate({ id: resetTarget.id, newPin })} disabled={newPin.length !== 4 || resetPin.isPending} className="flex-1 h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40">Reset</button>
            </div>
          </div>
        </div>
      )}

      {toggleTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setToggleTarget(null)}>
          <div className="bg-surface-white rounded-[--radius-lg] p-6 w-full max-w-md space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-[32px]">warning</span>
              <div>
                <h2 className="text-xl font-bold text-on-surface">Deactivate staff member?</h2>
                <p className="text-sm text-on-surface-secondary mt-1">{toggleTarget.fullName} has {toggleTarget.workload.active} active task(s). Reassign their work before removing access if needed.</p>
              </div>
            </div>
            {toggleActive.error && <p className="text-sm font-bold text-error">{toggleActive.error.message}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setToggleTarget(null)} className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold">Cancel</button>
              <button onClick={() => toggleActive.mutate({ id: toggleTarget.id })} className="flex-1 h-14 bg-error text-white font-bold rounded-[--radius-lg]">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, urgent }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div className={`rounded-[--radius-md] px-2 py-2 text-center ${urgent ? 'bg-warning/15' : 'bg-surface'}`}>
      <p className={`text-sm font-extrabold ${urgent ? 'text-warning' : 'text-on-surface'}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase text-on-surface-secondary">{label}</p>
    </div>
  );
}

function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'danger' | 'warning' }) {
  const styles = tone === 'danger' ? 'bg-error/10 text-error' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-surface-cream text-on-surface-secondary';
  return <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${styles}`}>{label}</span>;
}
