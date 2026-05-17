import { IconGrid } from '@superplus/ui';

const toolItems = [
  { label: 'Pricing', icon: 'calculate', href: '/tools/pricing', color: '#446185' },
  { label: 'Lookup', icon: 'search', href: '/tools/product-lookup', color: '#2e7d32' },
  { label: 'Checklist', icon: 'checklist', href: '/tools/closing-checklist', color: '#c00029' },
  { label: 'Expiry', icon: 'event_busy', href: '/tools/expiry-tracker', color: '#845500' },
  { label: 'Stock-Out', icon: 'remove_shopping_cart', href: '/tools/stock-out', color: '#a73b21' },
  { label: 'Incidents', icon: 'report_problem', href: '/tools/incidents', color: '#446185' },
];

export default function ToolsPage() {
  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-2">
        <h2 className="text-2xl font-bold text-on-surface">Tools</h2>
        <p className="text-sm text-on-surface-variant mt-1">Quick-access store tools</p>
      </section>

      <IconGrid items={toolItems} />
    </div>
  );
}
