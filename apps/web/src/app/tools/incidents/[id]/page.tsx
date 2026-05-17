'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import { useState } from 'react';

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: incident, isLoading, isError } = trpc.incidents.getById.useQuery({ id });
  const [resolution, setResolution] = useState('');

  const isManager = session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER';

  const resolve = trpc.incidents.resolve.useMutation({ onSuccess: () => utils.incidents.invalidate() });
  const close = trpc.incidents.close.useMutation({ onSuccess: () => { utils.incidents.invalidate(); router.push('/tools/incidents'); } });

  if (isLoading) return <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span></div>;
  if (isError || !incident) return (
    <div className="px-[--spacing-container] py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
      </button>
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-[48px] text-outline mb-3">error</span>
        <p className="text-on-surface-variant">Incident not found</p>
      </div>
    </div>
  );

  const severityColors: Record<string, string> = { CRITICAL: 'text-error', HIGH: 'text-tertiary', MEDIUM: 'text-on-surface-variant', LOW: 'text-outline' };

  return (
    <div className="px-[--spacing-container] py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
      </button>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-bold uppercase ${severityColors[incident.severity]}`}>{incident.severity}</span>
          <span className="text-xs text-outline">·</span>
          <span className="text-xs text-outline">{incident.category}</span>
          <span className="text-xs text-outline">·</span>
          <span className={`text-xs font-bold ${incident.status === 'OPEN' ? 'text-error' : incident.status === 'RESOLVED' ? 'text-success' : 'text-on-surface-variant'}`}>{incident.status}</span>
        </div>

        <h2 className="text-xl font-bold text-on-surface mb-2">{incident.title}</h2>
        <p className="text-on-surface-variant leading-relaxed">{incident.description}</p>

        {incident.photoUrl && (
          <img src={incident.photoUrl} alt="Incident photo" className="mt-4 rounded-xl max-h-64 w-full object-cover" />
        )}

        <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center gap-2 text-sm text-outline">
          <span className="material-symbols-outlined text-[16px]">person</span>
          {incident.reportedBy.fullName} · {new Date(incident.createdAt as any).toLocaleDateString()}
        </div>

        {incident.resolution && (
          <div className="mt-4 bg-success/5 rounded-xl p-4">
            <p className="text-xs font-bold text-success mb-1">Resolution</p>
            <p className="text-sm text-on-surface">{incident.resolution}</p>
            {incident.resolvedBy && <p className="text-xs text-outline mt-2">— {incident.resolvedBy.fullName}</p>}
          </div>
        )}

        {/* Manager actions */}
        {isManager && (incident.status === 'OPEN' || incident.status === 'IN_PROGRESS') && (
          <div className="mt-6 space-y-3">
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution notes..." rows={2} className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline resize-none transition-colors" />
            <button
              onClick={() => resolve.mutate({ id, resolution })}
              disabled={!resolution.trim() || resolve.isPending}
              className="w-full h-14 bg-success text-white font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">check_circle</span>Resolve
            </button>
          </div>
        )}
        {isManager && incident.status === 'RESOLVED' && (
          <button onClick={() => close.mutate({ id })} className="mt-6 w-full h-14 bg-outline text-white font-bold rounded-xl active:scale-95 transition-all">Close Incident</button>
        )}
      </div>
    </div>
  );
}
