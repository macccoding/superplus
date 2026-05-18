import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, managerProcedure } from '../init';
import { POStatus } from '@superplus/db';

export const ordersRouter = router({
  list: managerProcedure
    .input(z.object({ status: z.nativeEnum(POStatus).optional(), supplierId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { storeId: ctx.storeId };
      if (input?.status) where.status = input.status;
      if (input?.supplierId) where.supplierId = input.supplierId;
      return ctx.db.purchaseOrder.findMany({ where, include: { supplier: true, createdBy: true, _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    }),
  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.purchaseOrder.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId }, include: { supplier: true, createdBy: true, items: true } });
    }),
  create: managerProcedure
    .input(z.object({
      supplierId: z.string(),
      items: z.array(z.object({ productName: z.string().min(1), quantity: z.number().int().min(1), unitCost: z.number().min(0) })).min(1),
      notes: z.string().max(500).optional(),
      expectedAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.purchaseOrder.count({ where: { storeId: ctx.storeId } });
      const orderNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
      const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
      const data = {
        storeId: ctx.storeId, supplierId: input.supplierId, orderNumber, totalAmount, notes: input.notes, expectedAt: input.expectedAt, createdById: ctx.user.id,
        items: { create: input.items },
      };
      try {
        return await ctx.db.purchaseOrder.create({ data, include: { items: true } });
      } catch (err: any) {
        if (err.code === 'P2002') {
          const retryCount = await ctx.db.purchaseOrder.count({ where: { storeId: ctx.storeId } });
          const retryNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(retryCount + 2).padStart(4, '0')}`;
          return ctx.db.purchaseOrder.create({ data: { ...data, orderNumber: retryNumber }, include: { items: true } });
        }
        throw err;
      }
    }),
  updateStatus: managerProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(POStatus), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { status: input.status, notes: input.notes };
      if (input.status === POStatus.ORDERED) data.orderedAt = new Date();
      if (input.status === POStatus.RECEIVED) data.receivedAt = new Date();
      return ctx.db.purchaseOrder.update({ where: { id: input.id, storeId: ctx.storeId }, data });
    }),
  receiveItems: managerProcedure
    .input(z.object({ orderId: z.string(), items: z.array(z.object({ itemId: z.string(), receivedQty: z.number().int().min(0) })) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.purchaseOrder.findFirstOrThrow({ where: { id: input.orderId, storeId: ctx.storeId } });
      for (const item of input.items) {
        await ctx.db.purchaseOrderItem.update({ where: { id: item.itemId, orderId: input.orderId }, data: { receivedQty: item.receivedQty } });
      }
      const allItems = await ctx.db.purchaseOrderItem.findMany({ where: { orderId: input.orderId } });
      const allReceived = allItems.every(i => i.receivedQty !== null && i.receivedQty >= i.quantity);
      const someReceived = allItems.some(i => i.receivedQty !== null && i.receivedQty > 0);
      const status = allReceived ? POStatus.RECEIVED : someReceived ? POStatus.PARTIALLY_RECEIVED : undefined;
      if (status) {
        await ctx.db.purchaseOrder.update({ where: { id: input.orderId }, data: { status, ...(status === POStatus.RECEIVED ? { receivedAt: new Date() } : {}) } });
      }
      return ctx.db.purchaseOrder.findUniqueOrThrow({ where: { id: input.orderId }, include: { items: true } });
    }),
});
