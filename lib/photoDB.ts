/**
 * IndexedDB-хранилище для фотографий до момента оплаты.
 * Файлы (File objects) хранятся в браузере и переживают редирект на Робокассу.
 */

const DB_NAME    = "stagingai_db";
const DB_VERSION = 1;
const STORE      = "pending_orders";

export interface StoredPhoto {
  id:          number;
  file:        File;
  name:        string;
  status:      "ready" | "masked" | "done" | "error";
  maskFile?:   File;
  dimensions?: { width: number; height: number };
  hasRetry:    boolean;
  resultBlob?: Blob;
  error?: string;
}

export interface StoredOrder {
  invId:  number;
  mode:   "auto" | "manual";
  photos: StoredPhoto[];
  expiresAt?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "invId" });
    };
    req.onsuccess = () => {
      const db = req.result;
      const cleanup = db.transaction(STORE, "readwrite");
      const cursor = cleanup.objectStore(STORE).openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (!entry) return;
        const order = entry.value as StoredOrder;
        if (order.expiresAt && order.expiresAt <= Date.now()) entry.delete();
        entry.continue();
      };
      cleanup.oncomplete = () => resolve(db);
      cleanup.onerror = cleanup.onabort = () => { db.close(); reject(cleanup.error); };
    };
    req.onerror   = () => reject(req.error);
  });
}

export async function saveOrder(order: StoredOrder): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...order, expiresAt: order.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000 });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
    tx.onabort    = () => { db.close(); reject(tx.error ?? new Error("Storage transaction aborted")); };
  });
}

export async function loadOrder(invId: number): Promise<StoredOrder | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(invId);
    req.onsuccess = () => {
      db.close();
      const order = req.result as StoredOrder | undefined;
      if (order?.expiresAt && order.expiresAt <= Date.now()) {
        void deleteOrder(invId).catch(() => {});
        resolve(null);
      } else resolve(order ?? null);
    };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

export async function deleteOrder(invId: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(invId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
    tx.onabort    = () => { db.close(); reject(tx.error ?? new Error("Storage transaction aborted")); };
  });
}

/** Update one photo in a transaction so concurrent retries cannot overwrite each other. */
export async function updateStoredPhoto(invId: number, photoId: number, patch: Partial<StoredPhoto>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(invId);
    req.onsuccess = () => {
      const order = req.result as StoredOrder | undefined;
      if (order) store.put({
        ...order,
        expiresAt: patch.resultBlob ? Date.now() + 24 * 60 * 60 * 1000 : order.expiresAt,
        photos: order.photos.map((photo) => photo.id === photoId ? { ...photo, ...patch } : photo),
      });
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Storage transaction failed")); };
  });
}
