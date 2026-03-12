'use client';

import { useMemo, useState, useEffect } from 'react';
import { useActiveStaff, useSuggestions } from '@superplus/db/hooks';
import type { Profile, Task, Suggestion } from '@superplus/db';
import { format, subDays } from 'date-fns';
import { StatusBadge, getStatusVariant } from '@superplus/ui';
import { RoleGate, useAuth, useSupabase } from '@superplus/auth';
import { DashboardShell } from '../components/dashboard-shell';

const roleColors: Record<string, 'primary' | 'info' | 'warning' | 'success'> = {
  owner: 'primary',
  manager: 'info',
  supervisor: 'warning',
  staff: 'success',
};

export default function PeoplePage() {
  const supabase = useSupabase();
  const { data: staff, loading } = useActiveStaff();
  const { data: suggestions } = useSuggestions({ status: 'new' });
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [staffTasks, setStaffTasks] = useState<Record<string, { total: number; completed: number }>>({});

  // Fetch task stats per user
  useEffect(() => {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    supabase
      .from('tasks')
      .select('assigned_to_user_id, status')
      .gte('shift_date', thirtyDaysAgo)
      .then(({ data }) => {
        if (!data) return;
        const stats: Record<string, { total: number; completed: number }> = {};
        (data as Pick<Task, 'assigned_to_user_id' | 'status'>[]).forEach((t) => {
          const uid = t.assigned_to_user_id;
          if (!uid) return;
          if (!stats[uid]) stats[uid] = { total: 0, completed: 0 };
          stats[uid].total++;
          if (t.status === 'done') stats[uid].completed++;
        });
        setStaffTasks(stats);
      });
  }, []);

  const filteredStaff = useMemo(() => {
    if (!staff) return [];
    if (!roleFilter) return staff;
    return staff.filter((s) => s.role === roleFilter);
  }, [staff, roleFilter]);

  return (
    <DashboardShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">People</h1>
          <p className="text-sm text-text-secondary mt-1">
            {staff?.length ?? 0} active staff members
          </p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        >
          <option value="">All Roles</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="supervisor">Supervisor</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staff List */}
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-card border border-gray-100">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-6 w-6 border-2 border-brand-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-12 text-text-secondary text-sm">
                No staff members found
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredStaff.map((person) => {
                  const taskStats = staffTasks[person.user_id];
                  const completionRate = taskStats && taskStats.total > 0
                    ? Math.round((taskStats.completed / taskStats.total) * 100)
                    : null;

                  return (
                    <div
                      key={person.id}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-secondary/10 text-brand-secondary text-sm font-bold flex-shrink-0">
                        {person.full_name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text-primary">{person.full_name}</p>
                          <StatusBadge
                            label={person.role}
                            variant={roleColors[person.role] ?? 'neutral'}
                            size="sm"
                          />
                        </div>
                        {person.phone && (
                          <p className="text-xs text-text-secondary mt-0.5">{person.phone}</p>
                        )}
                      </div>

                      {/* Task Stats */}
                      <div className="text-right flex-shrink-0">
                        {completionRate !== null ? (
                          <>
                            <p className={`text-sm font-semibold ${completionRate >= 80 ? 'text-success' : completionRate >= 50 ? 'text-warning' : 'text-danger'}`}>
                              {completionRate}%
                            </p>
                            <p className="text-xs text-text-secondary">
                              {taskStats!.completed}/{taskStats!.total} tasks
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-text-secondary">No tasks</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Suggestion Box Review Queue */}
        <div>
          <div className="bg-surface rounded-card border border-gray-100 p-6">
            <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
              Suggestion Box
              {suggestions && suggestions.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary text-white text-xs">
                  {suggestions.length}
                </span>
              )}
            </h2>
            <RoleGate requiredRole="manager">
              {!suggestions || suggestions.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-8">
                  No new suggestions to review
                </p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-3 bg-background rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge
                          label={suggestion.category.replace('_', ' ')}
                          variant={getStatusVariant(suggestion.status)}
                          size="sm"
                        />
                        {suggestion.is_anonymous && (
                          <span className="text-xs text-text-secondary italic">Anonymous</span>
                        )}
                      </div>
                      <p className="text-sm text-text-primary mt-1">{suggestion.message}</p>
                      <p className="text-xs text-text-secondary mt-2">
                        {format(new Date(suggestion.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </RoleGate>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
