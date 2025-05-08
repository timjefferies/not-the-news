// www/js/database.js
import { openDB } from 'idb';

// Initialize IndexedDB with 'items' and 'meta' stores
export const dbPromise = openDB('not-the-news-db', 3, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('items', { keyPath: 'guid' });
    }
    if (oldVersion < 2) {
      const meta = db.createObjectStore('meta', { keyPath: 'key' });
      // Seed lastSync = epoch
      meta.put({ key: 'lastSync', value: new Date(0).toISOString() });
    }
    if (oldVersion < 3) {
      // store for starred/hidden/filter/theme/etc.
      db.createObjectStore('userState', { keyPath: 'key' });
    }
  }
});

/**
 * Perform diff‐based sync using /changes and /items endpoints.
 */
export async function performSync() {
    const db = await dbPromise;
  
    // 1) fetch serverTime and compute cutoff
    const { time: serverTimeStr } = await fetch('/time').then(r => r.json());
    const serverTime = Date.parse(serverTimeStr);
    const staleCutoff = serverTime - 30 * 86400 * 1000;
  
    // 2) fetch full GUID list
    const serverGuids = await fetch('/guids').then(r => r.json());

  
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
  
    // 5) fetch missing items in GET‑50‑GUID batches
    const missing = serverGuids.filter(g => !localGuids.has(g));
    const BATCH   = 50;
    const txUp    = db.transaction('items', 'readwrite');
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const res   = await fetch(`/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guids: batch })
        });

      const data  = await res.json();
      batch.forEach(guid => {
        const item = data[guid];
        item.lastSync = serverTime;
        txUp.objectStore('items').put(item);
      });
    }
  
    // 6) batch‑update lastSync on all surviving items
    const survivors = serverGuids.filter(g => localGuids.has(g));
    for (let i = 0; i < survivors.length; i += BATCH) {
      const batch = survivors.slice(i, i + BATCH);
      const store = txUp.objectStore('items');
      for (let guid of batch) {
        const it = await store.get(guid);
        if (it) {
          it.lastSync = serverTime;
          store.put(it);
        }
      }
    }
    await txUp.done;
  }