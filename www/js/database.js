// www/js/database.js
import { openDB } from 'idb';

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
 * Perform diff‐based sync using /changes and /items endpoints.
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