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
  status:      "ready" | "masked";
  maskFile?:   File;
  dimensions?: { width: number; height: number };
  hasRetry:    boolean;
}

export interface StoredOrder {
  invId:  number;
  mode:   "auto" | "manual";
  photos: StoredPhoto[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "invId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function saveOrder(order: StoredOrder): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(order);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function loadOrder(invId: number): Promise<StoredOrder | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(invId);
    req.onsuccess = () => { db.close(); resolve((req.result as StoredOrder) ?? null); };
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
  });
}
