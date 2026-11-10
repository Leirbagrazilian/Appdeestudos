// IndexedDB mínimo com fallback em memória (testes / navegação privada).
const STORES = ['kv', 'done', 'reviews', 'errors', 'exams'];
let dbp;
const mem = Object.fromEntries(STORES.map((s) => [s, new Map()]));

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    if (typeof indexedDB === 'undefined') return res(null);
    const r = indexedDB.open('rumo', 1);
    r.onupgradeneeded = () => STORES.forEach((s) => r.result.createObjectStore(s));
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
  return dbp;
}
const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function get(store, key) {
  const db = await open(); if (!db) return mem[store].get(key);
  return wrap(db.transaction(store).objectStore(store).get(key));
}
export async function put(store, key, val) {
  const db = await open(); if (!db) { mem[store].set(key, val); return; }
  await wrap(db.transaction(store, 'readwrite').objectStore(store).put(val, key));
}
export async function del(store, key) {
  const db = await open(); if (!db) { mem[store].delete(key); return; }
  await wrap(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}
export async function all(store) {
  const db = await open();
  if (!db) return Object.fromEntries(mem[store]);
  const os = db.transaction(store).objectStore(store);
  const [keys, vals] = await Promise.all([wrap(os.getAllKeys()), wrap(os.getAll())]);
  return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
}
