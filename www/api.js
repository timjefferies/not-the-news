// api.js

/**
 * Load app state JSON from the server and restore into localStorage.
 * @param {string} filename - Name of the file to load (e.g. "appState.json").
 */
export async function restoreStateFromFile(filename) {
  const res = await fetch(`/load-state?filename=${filename}`);
  if (!res.ok) throw new Error(`Failed to load state: ${res.status}`);
  const appState = await res.json();
  Object.entries(appState).forEach(([k, v]) => 
    localStorage.setItem(k, v)
  );
}

/**
 * Save current localStorage contents to a JSON file on the server.
 * @param {string} filename - Name of the file to save (e.g. "appState.json").
 */
// api.js
export function saveStateToFile(filename) {
  const appState = JSON.stringify(
    Object.fromEntries(Object.entries(localStorage)), 
    null, 2
  );
  return fetch(`/save-state?filename=${filename}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: appState
  }).then(r => { if (!r.ok) throw new Error(r.statusText); });
}

