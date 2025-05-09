// www/js/database.js
import { openDB } from "../../libs/idb.js";
window.openDB = openDB;
export const bufferedChanges = [];

// Initialize IndexedDB with 'items' and 'meta' stores
export const dbPromise = openDB('not-the-news-db', 2, {
  upgrade(db, oldVersion) {
    // v1: create items store + index on lastSync
    if (oldVersion < 1) {
      const store = db.createObjectStore('items', { keyPath: 'guid' });
      store.createIndex('by-lastSync', 'lastSync');
    }
    // v2: create userState store
    if (oldVersion < 2) {
      db.createObjectStore('userState', { keyPath: 'key' });
    }
    // removed orphaned 'meta' store
  }
});
// helper: retry fetch with exponential backoff
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
  }

/**
 * Perform diff‐based sync using /items endpoints.
 */
export async function performSync() {
    const db = await dbPromise;
  
    // 1) fetch serverTime and compute cutoff
    const { time: serverTimeStr } = await fetchWithRetry('/time').then(r => r.json());

    const serverTime = Date.parse(serverTimeStr);
    const staleCutoff = serverTime - 30 * 86400 * 1000;
  
    // 2) fetch full GUID list
    const serverGuids = await fetchWithRetry('/guids').then(r => r.json());
  
    // 3) load local items
    const txRead     = db.transaction('items', 'readonly');
    const localItems = await txRead.objectStore('items').getAll();
    const localGuids = new Set(localItems.map(it => it.guid));
  
    // 4) delete any items no longer on server AND older than 30d
    const toDelete = localItems
      .filter(it => !serverGuids.includes(it.guid) && it.lastSync < staleCutoff)
      .map(it => it.guid);
    if (toDelete.length) {
      const txDel = db.transaction('items', 'readwrite');
      await Promise.all(toDelete.map(g => txDel.objectStore('items').delete(g)));
      await txDel.done;
    }
  
    // 5) fetch missing items in batches (break up TXs to avoid locks)
    const missing = serverGuids.filter(g => !localGuids.has(g));
    const BATCH = 50;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const res   = await fetchWithRetry(`/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guids: batch })
        });
    const data = await res.json();
    const txUp = db.transaction('items', 'readwrite');
    batch.forEach(guid => {
      const item = data[guid];
      item.lastSync = serverTime;
      txUp.objectStore('items').put(item);
    });
    await txUp.done;
    }
    // 6) update lastSync on survivors in separate TXs
    const survivors = serverGuids.filter(g => localGuids.has(g));
    for (let i = 0; i < survivors.length; i += BATCH) {
      const batch = survivors.slice(i, i + BATCH);
      const txUp2 = db.transaction('items', 'readwrite');
      const store = txUp2.objectStore('items');
      for (let guid of batch) {
        const it = await store.get(guid);
        if (it) {
          it.lastSync = serverTime;
          store.put(it);
        }
      }
      await txUp2.done;
    }
    return serverTime;  
  }
  
  // ─── Delta‐based user‐state sync ───────────────────────────────────────────
  /** Fetch only the keys changed since lastStateSync */
  export async function pullUserState(db) {
    const meta = await db.get('userState','lastStateSync') || { value: null };
    const since = meta.value;
    const headers = {};
    if (since) headers['If-None-Match'] = since;
    const res = await fetch('/user-state?since=' + encodeURIComponent(since || ''), { headers });
    if (res.status === 304) return meta.value;
    const { changes, serverTime } = await res.json();
    const tx = db.transaction('userState','readwrite');
    for (let [key,val] of Object.entries(changes)) {
      tx.objectStore('userState').put({ key, value: JSON.stringify(val) });
    }
    tx.objectStore('userState').put({ key: 'lastStateSync', value: serverTime });
    await tx.done;
    return serverTime;
  }
  
  /** Push local buffered mutations */
  export async function pushUserState(db, buffered = bufferedChanges) {
    if (buffered.length === 0) return;
    const body = { changes: {} };
    for (let { key, value } of buffered) {
      body.changes[key] = value;
    }
    const res = await fetch('/user-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const { serverTime } = await res.json();
    const tx = db.transaction('userState','readwrite');
    tx.objectStore('userState').put({ key: 'lastStateSync', value: serverTime });
    await tx.done;
  }
  
  // Integrate into your sync driver
  export async function performFullSync() {
    const db = await dbPromise;
    const feedTime  = await performSync();
    const stateTime = await pullUserState(db);
    await pushUserState(db);
    return { feedTime, stateTime };
  }
