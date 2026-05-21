'use client';

import { useSession } from 'next-auth/react';
import { IconGrid } from '@superplus/ui';

const staffToolItems = [
  { label: 'Lookup', icon: 'search', href: '/tools/product-lookup', color: '#2e7d32' },
  { label: 'Expiry', icon: 'event_busy', href: '/tools/expiry-tracker', color: '#845500' },
  { label: 'Stock-Out', icon: 'remove_shopping_cart', href: '/tools/stock-out', color: '#a73b21' },
  { label: 'Report', icon: 'shield', href: '/tools/report', color: '#1B3A5C' },
];

const supervisorToolItems = [
  { label: 'Pricing', icon: 'calculate', href: '/tools/pricing', color: '#446185' },
  ...staffToolItems,
  { label: 'Checklist', icon: 'checklist', href: '/tools/closing-checklist', color: '#c00029' },
  { label: 'Incidents', icon: 'report_problem', href: '/tools/incidents', color: '#5c1f5c' },
];

export default function ToolsPage() {
  const { data: session } = useSession();
  const canUseSupervisorTools =
    session?.user?.role === 'OWNER' ||
    session?.user?.role === 'MANAGER' ||
    session?.user?.role === 'SUPERVISOR';
  const toolItems = canUseSupervisorTools ? supervisorToolItems : staffToolItems;

  return (
    <div>
      <section className="px-5 pt-6 pb-2">
        <h2 className="text-2xl font-bold text-on-surface">Tools</h2>
        <p className="text-sm text-on-surface-secondary mt-1">Quick-access store tools</p>
      </section>

      <IconGrid items={toolItems} />
    </div>
  );
}
