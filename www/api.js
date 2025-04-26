// api.js

/**
 * Save current localStorage contents to a JSON file on the server.
 * @param {string} filename - Name of the file to save (e.g. "appState.json").
 */
export function saveStateToFile(filename) {
  const appState = JSON.stringify(Object.fromEntries(
    Object.entries(localStorage)
  ), null, 2);

  return fetch(`/save-state?filename=${filename}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: appState
  }).then(response => {
    if (!response.ok) throw new Error("Failed to save state");
  });
}

/**
 * Load app state JSON from the server and restore into localStorage.
 * @param {string} filename - Name of the file to load (e.g. "appState.json").
 */
export async function restoreStateFromFile(filename) {
  const response = await fetch(`/load-state?filename=${filename}`);
  if (!response.ok) throw new Error("Failed to load state");

  const appState = await response.json();
  Object.entries(appState).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
}
