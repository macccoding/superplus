import { IconGrid } from '@superplus/ui';

const toolItems = [
  { label: 'Calculator', icon: 'calculate', href: '/tools/calculator', color: '#446185' },
  { label: 'Lookup', icon: 'search', href: '/tools/product-lookup', color: '#2e7d32' },
  { label: 'Markup', icon: 'price_change', href: '/tools/markup', color: '#845500' },
  { label: 'Checklist', icon: 'checklist', href: '/tools/closing-checklist', color: '#c00029' },
];

export default function ToolsPage() {
  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-2">
        <h2 className="text-2xl font-bold text-on-surface">Tools</h2>
        <p className="text-sm text-on-surface-variant mt-1">Quick-access store tools</p>
      </section>

      <IconGrid items={toolItems} />

      <p className="text-center text-xs text-outline mt-4 px-[--spacing-container]">
        More tools coming soon
      </p>
    </div>
  );
}
