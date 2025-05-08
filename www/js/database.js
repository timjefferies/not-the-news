// www/js/database.js
import { openDB } from 'idb';

// Initialize IndexedDB with 'items' and 'meta' stores
export const dbPromise = openDB('rss-feed-db', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('items', { keyPath: 'guid' });
    }
    if (oldVersion < 2) {
      const meta = db.createObjectStore('meta', { keyPath: 'key' });
      // Seed lastSync = epoch
      meta.put({ key: 'lastSync', value: new Date(0).toISOString() });
    }
  }
});

/**
 * Perform diff‐based sync using /changes and /items endpoints.
 */
export async function performSync() {
  const db = await dbPromise;

  // 1. Read lastSync from meta store
  const lastSyncEntry = await db
    .transaction('meta', 'readonly')
    .objectStore('meta')
    .get('lastSync');
  const since = lastSyncEntry?.value || new Date(0).toISOString();

  // 2. Fetch delta from server
  const res = await fetch(`/changes?since=${since}`);
  if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
  const { added = [], removed = [], updated = [], serverTime } = await res.json();

  // 3. Atomic batch update
  const tx = db.transaction(['items', 'meta'], 'readwrite');
  const store = tx.objectStore('items');

  // 3a. Delete removed GUIDs
  removed.forEach(guid => store.delete(guid));

  // 3b. Upsert added & updated GUIDs
  for (let guid of [...added, ...updated]) {
    const itemRes = await fetch(`/items?guids=${guid}`);
    const data   = await itemRes.json().then(j => j[guid]);
    data.lastSync = Date.parse(serverTime);
    store.put(data);
  }

  // 3c. Update lastSync in meta
  tx.objectStore('meta').put({ key: 'lastSync', value: serverTime });
  await tx.done;
}
