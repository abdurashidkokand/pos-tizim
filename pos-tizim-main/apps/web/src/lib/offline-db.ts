// Native IndexedDB wrapper — no external deps so it works without an npm install.
// Stores products for offline barcode/lookup, and sales made while offline until synced.

const DB_NAME = 'pos-offline';
const DB_VERSION = 1;
const STORE_PENDING_SALES = 'pendingSales';
const STORE_PRODUCTS = 'productsCache';

export interface CachedProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: { quantity: number } | null;
  barcodes: { code: string }[];
  images?: { url: string }[];
}

export interface PendingSale {
  clientTxnId: string;
  body: Record<string, unknown>;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB mavjud emas'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PENDING_SALES)) {
        db.createObjectStore(STORE_PENDING_SALES, { keyPath: 'clientTxnId' });
      }
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queuePendingSale(sale: PendingSale): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_SALES, 'readwrite');
    tx.objectStore(STORE_PENDING_SALES).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_SALES, 'readonly');
    const req = tx.objectStore(STORE_PENDING_SALES).getAll();
    req.onsuccess = () => resolve(req.result as PendingSale[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingSale(clientTxnId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_SALES, 'readwrite');
    tx.objectStore(STORE_PENDING_SALES).delete(clientTxnId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheProducts(products: CachedProduct[]): Promise<void> {
  if (products.length === 0) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    for (const p of products) store.put(p);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedProductByBarcode(code: string): Promise<CachedProduct | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const req = tx.objectStore(STORE_PRODUCTS).getAll();
    req.onsuccess = () => {
      const all = req.result as CachedProduct[];
      resolve(all.find((p) => p.barcodes?.some((b) => b.code === code)) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

// Locally decrements cached stock right after an offline sale is queued, so a second
// offline sale in the same session doesn't oversell the same item before syncing.
export async function decrementCachedStock(items: { productId: string; qty: number }[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    for (const item of items) {
      const req = store.get(item.productId);
      req.onsuccess = () => {
        const p = req.result as CachedProduct | undefined;
        if (p?.stock) {
          p.stock.quantity = Math.max(0, p.stock.quantity - item.qty);
          store.put(p);
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
