import { PageHeader, PageSkeleton } from '@superplus/ui';

export default function LoadingTasksPage() {
  return (
    <div className="px-5 pt-6 pb-24">
      <PageHeader title="Tasks" subtitle="Loading your work..." />
      <div className="mb-5 h-12 animate-pulse rounded-[--radius-lg] bg-surface-cream" />
      <PageSkeleton variant="task-list" />
    </div>
  );
}
