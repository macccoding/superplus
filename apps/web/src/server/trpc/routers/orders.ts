import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, managerProcedure } from '../init';
import { POStatus } from '@superplus/db';
import { adminStoreWhere, resolveAdminScope, requireSingleAdminStore } from './admin-scope';
import { logAdminAction } from './admin-audit';

export const ordersRouter = router({
  list: managerProcedure
    .input(z.object({ scope: z.string().optional(), status: z.nativeEnum(POStatus).optional(), supplierId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const where: any = adminStoreWhere(scope);
      if (input?.status) where.status = input.status;
      if (input?.supplierId) where.supplierId = input.supplierId;
      return ctx.db.purchaseOrder.findMany({ where, include: { store: { select: { id: true, name: true } }, supplier: true, createdBy: { select: { id: true, fullName: true, role: true } }, _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    }),
  getById: managerProcedure
    .input(z.object({ id: z.string(), scope: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      return ctx.db.purchaseOrder.findFirstOrThrow({ where: { ...adminStoreWhere(scope), id: input.id }, include: { store: { select: { id: true, name: true } }, supplier: true, createdBy: { select: { id: true, fullName: true, role: true } }, items: true } });
    }),
  create: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      supplierId: z.string(),
      items: z.array(z.object({ productName: z.string().min(1), quantity: z.number().int().min(1), unitCost: z.number().min(0) })).min(1),
      notes: z.string().max(500).optional(),
      expectedAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const storeId = requireSingleAdminStore(scope);
      await ctx.db.supplier.findFirstOrThrow({ where: { id: input.supplierId, storeId, isActive: true } });
      const count = await ctx.db.purchaseOrder.count({ where: { storeId } });
      const orderNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
      const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
      const data = {
        storeId, supplierId: input.supplierId, orderNumber, totalAmount, notes: input.notes, expectedAt: input.expectedAt, createdById: ctx.user.id,
        items: { create: input.items },
      };
      let order;
      try {
        order = await ctx.db.purchaseOrder.create({ data, include: { items: true } });
      } catch (err: any) {
        if (err.code === 'P2002') {
          const retryNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
          order = await ctx.db.purchaseOrder.create({ data: { ...data, orderNumber: retryNumber }, include: { items: true } });
        } else {
          throw err;
        }
      }
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'ORDER_CREATED',
        storeId,
        sourceType: 'PURCHASE_ORDER',
        sourceId: order.id,
        note: order.orderNumber,
        metadata: { itemCount: input.items.length, totalAmount },
      });
      return order;
    }),
  updateStatus: managerProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(POStatus), notes: z.string().optional(), scope: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const current = await ctx.db.purchaseOrder.findFirstOrThrow({ where: { ...adminStoreWhere(scope), id: input.id } });
      const data: any = { status: input.status, notes: input.notes };
      if (input.status === POStatus.ORDERED) data.orderedAt = new Date();
      if (input.status === POStatus.RECEIVED) data.receivedAt = new Date();
      const order = await ctx.db.purchaseOrder.update({ where: { id: input.id }, data });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'ORDER_STATUS_UPDATED',
        storeId: current.storeId,
        sourceType: 'PURCHASE_ORDER',
        sourceId: order.id,
        note: order.orderNumber,
        metadata: { status: input.status },
      });
      return order;
    }),
  receiveItems: managerProcedure
    .input(z.object({ orderId: z.string(), scope: z.string().optional(), items: z.array(z.object({ itemId: z.string(), receivedQty: z.number().int().min(0) })) }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const current = await ctx.db.purchaseOrder.findFirstOrThrow({ where: { ...adminStoreWhere(scope), id: input.orderId } });
      const result = await ctx.db.$transaction(async (tx) => {
        const existingItems = await tx.purchaseOrderItem.findMany({ where: { orderId: input.orderId } });
        const itemById = new Map(existingItems.map((item) => [item.id, item]));
        for (const item of input.items) {
          const currentItem = itemById.get(item.itemId);
          if (!currentItem) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Received item is not on this purchase order' });
          }
          if (item.receivedQty > currentItem.quantity) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Received quantity cannot exceed ordered quantity' });
          }
          await tx.purchaseOrderItem.update({ where: { id: item.itemId }, data: { receivedQty: item.receivedQty } });
        }
        const allItems = await tx.purchaseOrderItem.findMany({ where: { orderId: input.orderId } });
        const allReceived = allItems.every(i => i.receivedQty !== null && i.receivedQty >= i.quantity);
        const someReceived = allItems.some(i => i.receivedQty !== null && i.receivedQty > 0);
        const status = allReceived ? POStatus.RECEIVED : someReceived ? POStatus.PARTIALLY_RECEIVED : undefined;
        if (status) {
          await tx.purchaseOrder.update({ where: { id: input.orderId }, data: { status, ...(status === POStatus.RECEIVED ? { receivedAt: new Date() } : {}) } });
        }
        return tx.purchaseOrder.findUniqueOrThrow({ where: { id: input.orderId }, include: { items: true } });
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'ORDER_ITEMS_RECEIVED',
        storeId: current.storeId,
        sourceType: 'PURCHASE_ORDER',
        sourceId: result.id,
        note: result.orderNumber,
        metadata: { status: result.status, itemCount: input.items.length },
      });
      return result;
    }),
});
