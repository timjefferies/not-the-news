// api.js

/**
 * Load app state JSON from the server and restore into localStorage.
 * @param {string} filename - Name of the file to load (e.g. "appState.json").
 */
export async function restoreStateFromFile(filename) {
  const res = await fetch(`/load-state?filename=${filename}`);
  if (!res.ok) throw new Error(`Failed to load state: ${res.status}`);
  const appState = await res.json();
  // Compare remote vs. local timestamps (stored under "appStateTS"):
  const remoteTS = parseInt(appState.appStateTS || '0', 10);                  // convert to integer safely :contentReference[oaicite:7]{index=7}
  const localTS  = parseInt(localStorage.getItem('appStateTS') || '0', 10);  // existing local timestamp :contentReference[oaicite:8]{index=8}

  if (remoteTS > localTS) {                                                   // only restore if remote is newer
    Object.entries(appState).forEach(([k, v]) =>
      localStorage.setItem(k, v)                                              // persist each key/value :contentReference[oaicite:5]{index=5}
    );
  }
}

/**
 * Save current localStorage contents to a JSON file on the server.
 * @param {string} filename - Name of the file to save (e.g. "appState.json").
 */
// api.js
export async function saveStateToFile(filename) {
  // 1. Read the old local timestamp
  const localOldTS = parseInt(localStorage.getItem('appStateTS') || '0', 10);    // :contentReference[oaicite:6]{index=6}

  // 2. Fetch the remote state to compare timestamps
  const loadRes = await fetch(`/load-state?filename=${filename}`);               // :contentReference[oaicite:7]{index=7}
  if (!loadRes.ok) throw new Error(`Failed to fetch remote state: ${loadRes.status}`);
  const remoteState = await loadRes.json();
  const remoteTS = parseInt(remoteState.appStateTS || '0', 10);                   // :contentReference[oaicite:8]{index=8}

  // 3. Skip if local isn’t strictly newer
  if (localOldTS < remoteTS) {
    console.log('Skipping save: local state is older or equal to remote.');
    return;  // no-op :contentReference[oaicite:9]{index=9}
  }

  // 4. Stamp a fresh timestamp now that we know we’ll save
  const ts = Date.now().toString();                                                // :contentReference[oaicite:10]{index=10}
  localStorage.setItem('appStateTS', ts);                                           // :contentReference[oaicite:11]{index=11}

  // 5. Serialize everything and POST
  const snapshot = JSON.stringify(
    Object.fromEntries(Object.entries(localStorage)),                               // :contentReference[oaicite:12]{index=12}
    null, 2
  );                                                                               // :contentReference[oaicite:13]{index=13}
  const saveRes = await fetch(`/save-state?filename=${filename}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: snapshot
  });                                                                              // :contentReference[oaicite:14]{index=14}
  if (!saveRes.ok) throw new Error(`Save failed: ${saveRes.statusText}`);
}
