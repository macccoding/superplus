'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSupabase } from '@superplus/auth';
import { useActiveStaff } from '@superplus/db/hooks';
import type { Task } from '@superplus/db';
import { format, subDays } from 'date-fns';
import { BarChartWidget } from '../../components/charts/bar-chart';
import { PieChartWidget } from '../../components/charts/pie-chart';

export default function TasksPage() {
  const supabase = useSupabase();
  const { data: staff } = useActiveStaff();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    supabase
      .from('tasks')
      .select('*')
      .gte('shift_date', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setTasks(data as Task[]);
      });
  }, []);

  const staffMap = useMemo(() => {
    const map: Record<string, string> = {};
    staff?.forEach((s) => {
      map[s.user_id] = s.full_name;
    });
    return map;
  }, [staff]);

  // Completion rate by shift date (last 14 days)
  const completionByShift = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayTasks = tasks.filter((t) => t.shift_date === dateStr);
      const done = dayTasks.filter((t) => t.status === 'done').length;
      return {
        date: format(date, 'MMM d'),
        completed: done,
        total: dayTasks.length,
        rate: dayTasks.length > 0 ? Math.round((done / dayTasks.length) * 100) : 0,
      };
    });
  }, [tasks]);

  // Average tasks per shift
  const avgTasksPerShift = useMemo(() => {
    const shiftDates = new Set(tasks.map((t) => t.shift_date));
    return shiftDates.size > 0 ? Math.round(tasks.length / shiftDates.size) : 0;
  }, [tasks]);

  // Task types distribution
  const taskTypeDistribution = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    tasks.forEach((t) => {
      const cat = t.category ?? 'General';
      typeCounts[cat] = (typeCounts[cat] ?? 0) + 1;
    });
    return Object.entries(typeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  // Frequently incomplete tasks
  const incompletePatterns = useMemo(() => {
    const incompleteCounts: Record<string, number> = {};
    tasks
      .filter((t) => t.status !== 'done')
      .forEach((t) => {
        incompleteCounts[t.title] = (incompleteCounts[t.title] ?? 0) + 1;
      });
    return Object.entries(incompleteCounts)
      .map(([title, count]) => ({ title: title.slice(0, 30), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [tasks]);

  const overallCompletionRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100);
  }, [tasks]);

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Total Tasks (30d)</p>
          <p className="text-2xl font-heading font-bold text-text-primary mt-1">{tasks.length}</p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Completion Rate</p>
          <p className="text-2xl font-heading font-bold text-success mt-1">
            {overallCompletionRate}%
          </p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Avg Tasks/Shift</p>
          <p className="text-2xl font-heading font-bold text-text-primary mt-1">
            {avgTasksPerShift}
          </p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">High Priority</p>
          <p className="text-2xl font-heading font-bold text-danger mt-1">
            {tasks.filter((t) => t.priority === 'high' && t.status !== 'done').length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion by Shift */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Task Completion by Shift (Last 14 Days)
          </h2>
          <BarChartWidget
            data={completionByShift}
            dataKey="rate"
            labelKey="date"
            color="#2ECC71"
            height={280}
          />
        </div>

        {/* Task Type Distribution */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Most Common Task Types
          </h2>
          {taskTypeDistribution.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">No task data available</p>
          ) : (
            <PieChartWidget
              data={taskTypeDistribution}
              dataKey="value"
              nameKey="name"
              height={280}
            />
          )}
        </div>

        {/* Frequently Incomplete */}
        <div className="bg-surface rounded-card border border-gray-100 p-6 lg:col-span-2">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Tasks Frequently Incomplete
          </h2>
          {incompletePatterns.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">
              All tasks are being completed regularly
            </p>
          ) : (
            <BarChartWidget
              data={incompletePatterns}
              dataKey="count"
              labelKey="title"
              color="#E74C3C"
              height={250}
            />
          )}
        </div>
      </div>
    </div>
  );
}
