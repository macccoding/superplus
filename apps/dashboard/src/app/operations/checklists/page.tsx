'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSupabase } from '@superplus/auth';
import { useChecklistHistory, useActiveStaff } from '@superplus/db/hooks';
import type { Checklist, ChecklistItem, Profile } from '@superplus/db';
import { format, subDays } from 'date-fns';
import { BarChartWidget } from '../../components/charts/bar-chart';

export default function ChecklistsPage() {
  const supabase = useSupabase();
  const { data: checklists } = useChecklistHistory(100);
  const { data: staff } = useActiveStaff();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  // Fetch checklist items for analysis
  useEffect(() => {
    supabase
      .from('checklist_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setChecklistItems(data as ChecklistItem[]);
      });
  }, []);

  const staffMap = useMemo(() => {
    const map: Record<string, string> = {};
    staff?.forEach((s) => {
      map[s.user_id] = s.full_name;
    });
    return map;
  }, [staff]);

  // Completion rates by supervisor
  const completionBySupervisor = useMemo(() => {
    if (!checklists || !staff) return [];

    const supervisorStats: Record<string, { name: string; completed: number; total: number }> = {};

    checklists.forEach((cl) => {
      const userId = cl.completed_by_user_id;
      const name = staffMap[userId] ?? 'Unknown';

      if (!supervisorStats[userId]) {
        supervisorStats[userId] = { name, completed: 0, total: 0 };
      }
      supervisorStats[userId].total++;
      if (cl.status === 'completed') {
        supervisorStats[userId].completed++;
      }
    });

    return Object.values(supervisorStats)
      .map((s) => ({
        name: s.name.split(' ')[0],
        rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        total: s.total,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [checklists, staff, staffMap]);

  // Average completion time
  const avgCompletionTime = useMemo(() => {
    if (!checklists) return 0;
    const completedOnes = checklists.filter(
      (c) => c.status === 'completed' && c.completed_at && c.started_at
    );
    if (completedOnes.length === 0) return 0;

    const totalMinutes = completedOnes.reduce((sum, c) => {
      const start = new Date(c.started_at).getTime();
      const end = new Date(c.completed_at!).getTime();
      return sum + (end - start) / 1000 / 60;
    }, 0);

    return Math.round(totalMinutes / completedOnes.length);
  }, [checklists]);

  // Critical item miss patterns
  const missedCriticalItems = useMemo(() => {
    const missed = checklistItems.filter((item) => item.is_critical && !item.is_completed);
    const taskCounts: Record<string, number> = {};
    missed.forEach((item) => {
      taskCounts[item.task_text] = (taskCounts[item.task_text] ?? 0) + 1;
    });
    return Object.entries(taskCounts)
      .map(([task, count]) => ({ task: task.slice(0, 30), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [checklistItems]);

  // Completion rates over last 14 days
  const completionOverTime = useMemo(() => {
    if (!checklists) return [];
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayChecklists = checklists.filter((c) => c.shift_date === dateStr);
      const completed = dayChecklists.filter((c) => c.status === 'completed').length;
      return {
        date: format(date, 'MMM d'),
        completed,
        total: dayChecklists.length,
      };
    });
    return last14;
  }, [checklists]);

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Total Checklists</p>
          <p className="text-2xl font-heading font-bold text-text-primary mt-1">
            {checklists?.length ?? 0}
          </p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Completion Rate</p>
          <p className="text-2xl font-heading font-bold text-success mt-1">
            {checklists && checklists.length > 0
              ? Math.round(
                  (checklists.filter((c) => c.status === 'completed').length / checklists.length) *
                    100
                )
              : 0}
            %
          </p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Avg. Completion Time</p>
          <p className="text-2xl font-heading font-bold text-text-primary mt-1">
            {avgCompletionTime} min
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion by Supervisor */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Completion Rate by Supervisor
          </h2>
          <BarChartWidget
            data={completionBySupervisor}
            dataKey="rate"
            labelKey="name"
            color="#2ECC71"
            height={280}
          />
        </div>

        {/* Missed Critical Items */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Frequently Missed Critical Items
          </h2>
          {missedCriticalItems.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">No missed critical items found</p>
          ) : (
            <BarChartWidget
              data={missedCriticalItems}
              dataKey="count"
              labelKey="task"
              layout="vertical"
              color="#E74C3C"
              height={280}
            />
          )}
        </div>
      </div>
    </div>
  );
}
