import { TRPCError } from '@trpc/server';

type AdminScopeContext = {
  user: { role?: string | null };
  storeId: string;
  db: {
    store: {
      findMany: (args: any) => Promise<Array<{ id: string; name: string; isActive?: boolean }>>;
      findFirst: (args: any) => Promise<{ id: string; name: string; isActive?: boolean } | null>;
    };
  };
};

export type AdminScope = {
  requested: string;
  storeIds: string[];
  isAllStores: boolean;
  label: string;
};

export function adminStoreWhere(scope: AdminScope) {
  return scope.isAllStores ? { storeId: { in: scope.storeIds } } : { storeId: scope.storeIds[0] };
}

export function adminStoreIdWhere(scope: AdminScope) {
  return scope.isAllStores ? { in: scope.storeIds } : scope.storeIds[0];
}

export function requireSingleAdminStore(scope: AdminScope, message = 'Choose one store for this action') {
  if (scope.isAllStores || scope.storeIds.length !== 1) {
    throw new TRPCError({ code: 'BAD_REQUEST', message });
  }
  return scope.storeIds[0];
}

export async function resolveAdminScope(ctx: AdminScopeContext, requestedScope?: string): Promise<AdminScope> {
  if (ctx.user.role !== 'OWNER') {
    return {
      requested: requestedScope || ctx.storeId,
      storeIds: [ctx.storeId],
      isAllStores: false,
      label: 'My Store',
    };
  }

  if (!requestedScope || requestedScope === 'ALL') {
    const stores = await ctx.db.store.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    return {
      requested: 'ALL',
      storeIds: stores.map((store) => store.id),
      isAllStores: true,
      label: 'All Stores',
    };
  }

  const store = await ctx.db.store.findFirst({
    where: { id: requestedScope, isActive: true },
    select: { id: true, name: true, isActive: true },
  });
  if (!store) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Store not found' });
  }

  return {
    requested: requestedScope,
    storeIds: [store.id],
    isAllStores: false,
    label: store.name,
  };
}
