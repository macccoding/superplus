import type { AdminScope } from './admin-scope';

function scopeLabel(scope: AdminScope | string) {
  return typeof scope === 'string' ? scope : scope.isAllStores ? 'ALL' : scope.storeIds[0];
}

export async function logAdminAction(
  db: any,
  actorId: string,
  scope: AdminScope | string,
  input: {
    action: string;
    storeId?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) {
  const model = db.adminActionLog;
  if (!model?.create) return null;
  return model.create({
    data: {
      actorId,
      action: input.action,
      storeId: input.storeId ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      scope: scopeLabel(scope),
      note: input.note ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
