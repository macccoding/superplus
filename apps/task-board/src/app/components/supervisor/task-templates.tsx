'use client';

import { getTaskTemplates } from '@superplus/db/queries/tasks';
import type { TaskPriority } from '@superplus/config';

interface TaskTemplatesProps {
  onSelect: (template: {
    title: string;
    description: string;
    category: string;
    priority: TaskPriority;
  }) => void;
}

const TEMPLATES = getTaskTemplates();

export function TaskTemplates({ onSelect }: TaskTemplatesProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">
        Quick Templates
      </label>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {TEMPLATES.map((template) => (
          <button
            key={template.title}
            onClick={() => onSelect(template)}
            className="flex-shrink-0 px-4 py-2 bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 rounded-full text-sm font-medium hover:bg-brand-secondary/20 active:bg-brand-secondary/30 transition-colors whitespace-nowrap"
          >
            {template.title}
          </button>
        ))}
      </div>
    </div>
  );
}
