'use client';

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'superplus-offline';
const DB_VERSION = 1;

interface OfflineProduct {
  id: string;
  name: string;
  barcode: string | null;
  selling_price: number;
  shelf_location: string | null;
  category_id: string | null;
  unit_of_measure: string;
}

interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update';
  data: Record<string, any>;
  created_at: string;
  retries: number;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Product cache store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('by_name', 'name');
        productStore.createIndex('by_barcode', 'barcode');
      }

      // Sync queue for offline writes
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('by_created', 'created_at');
      }

      // Metadata (last sync time, etc.)
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    },
  });
}

// === Product Cache ===

export async function cacheProducts(products: OfflineProduct[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('products', 'readwrite');
  await tx.store.clear();
  for (const product of products) {
    await tx.store.put(product);
  }
  await tx.done;

  // Update last sync timestamp
  const metaTx = db.transaction('metadata', 'readwrite');
  await metaTx.store.put({ key: 'products_last_sync', value: Date.now() });
  await metaTx.done;
}

export async function getCachedProducts(): Promise<OfflineProduct[]> {
  const db = await getDB();
  return db.getAll('products');
}

export async function searchCachedProducts(query: string): Promise<OfflineProduct[]> {
  const db = await getDB();
  const allProducts = await db.getAll('products');
  const lowerQuery = query.toLowerCase();
  return allProducts
    .filter(
      (p: OfflineProduct) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.barcode && p.barcode.includes(query))
    )
    .slice(0, 20);
}

export async function getCachedProductByBarcode(barcode: string): Promise<OfflineProduct | undefined> {
  const db = await getDB();
  const index = db.transaction('products').store.index('by_barcode');
  return index.get(barcode);
}

export async function getProductCacheAge(): Promise<number | null> {
  const db = await getDB();
  const meta = await db.get('metadata', 'products_last_sync');
  if (!meta) return null;
  return Date.now() - meta.value;
}

// === Sync Queue ===

export async function addToSyncQueue(
  table: string,
  operation: 'insert' | 'update',
  data: Record<string, any>
): Promise<void> {
  const db = await getDB();
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    table,
    operation,
    data,
    created_at: new Date().toISOString(),
    retries: 0,
  };
  await db.put('sync_queue', item);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync_queue', 'by_created');
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('sync_queue', id);
  if (item) {
    item.retries += 1;
    await db.put('sync_queue', item);
  }
}

export async function processSyncQueue(
  supabase: any,
  onError?: (item: SyncQueueItem, error: Error) => void
): Promise<{ synced: number; failed: number }> {
  const queue = await getSyncQueue();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    if (item.retries >= 5) {
      failed++;
      continue;
    }

    try {
      if (item.operation === 'insert') {
        const { error } = await supabase.from(item.table).insert(item.data);
        if (error) throw error;
      } else {
        const { id: rowId, ...updateData } = item.data;
        const { error } = await supabase.from(item.table).update(updateData).eq('id', rowId);
        if (error) throw error;
      }
      await removeSyncQueueItem(item.id);
      synced++;
    } catch (err) {
      await incrementRetry(item.id);
      failed++;
      onError?.(item, err as Error);
    }
  }

  return { synced, failed };
}

// === Online Status Hook ===
export function useOnlineStatus(): boolean {
  if (typeof window === 'undefined') return true;

  const { useState, useEffect } = require('react');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
