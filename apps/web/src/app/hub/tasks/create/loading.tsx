import { PageHeader, PageSkeleton } from '@superplus/ui';

export default function LoadingCreateTaskPage() {
  return (
    <div className="px-5 py-6">
      <PageHeader title="New Task" subtitle="Preparing the form..." backHref="/hub/tasks?tab=mine" backLabel="Back to Tasks" />
      <PageSkeleton variant="task-detail" />
    </div>
  );
}
