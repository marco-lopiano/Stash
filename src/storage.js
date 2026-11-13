// Client side of the SQLite persistence (see server/db.js).
// Writes are queued so they reach the server in order; the latest items
// snapshot replaces any not-yet-sent one.

const LEGACY = { items: 'linkgrid.items', cell: 'linkgrid.cell', theme: 'linkgrid.theme' };

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
// The database is the only copy: drop the pre-database localStorage data so
// it can never be copied back into a new/empty database later.
const clearLegacy = () => {
  try { for (const k of Object.values(LEGACY)) localStorage.removeItem(k); } catch {}
};

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

let chain = Promise.resolve();
let pendingItems = null;
let onError = (e) => console.error('[storage]', e);
const enqueue = (fn) => { chain = chain.then(fn).catch((e) => onError(e)); return chain; };

export function onStorageError(fn) { onError = fn; }

// Load state from the database. On first run, migrate whatever the old
// localStorage version of the app had saved, then delete it from the browser.
export async function loadState() {
  const state = await request('GET', '/api/state');
  const settings = { ...state.settings };
  let items = state.items;
  if (items === null) {
    try { items = JSON.parse(lsGet(LEGACY.items)) || []; } catch { items = []; }
    await request('PUT', '/api/items', items);
    for (const key of ['cell', 'theme']) {
      const v = lsGet(LEGACY[key]);
      if (v != null && settings[key] == null) {
        settings[key] = v;
        await request('PUT', `/api/settings/${key}`, { value: v });
      }
    }
  }
  // Runs only after every write above succeeded (any failure throws first).
  // Also clears browsers that were migrated before this clean-up existed.
  clearLegacy();
  return { items, settings };
}

export function saveItems(items) {
  const first = pendingItems === null;
  pendingItems = JSON.parse(JSON.stringify(items)); // snapshot now
  if (first) enqueue(() => { const body = pendingItems; pendingItems = null; return request('PUT', '/api/items', body); });
}

export function saveSetting(key, value) {
  enqueue(() => request('PUT', `/api/settings/${key}`, { value }));
}

// Flush anything still queued if the tab is closing.
addEventListener('pagehide', () => {
  if (pendingItems === null) return;
  const body = JSON.stringify(pendingItems);
  if (body.length < 60000) fetch('/api/items', { method: 'PUT', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
});
