// SQLite-backed persistence for The Stash.
// Uses Node's built-in `node:sqlite` (no native deps). The database lives on
// disk, so it survives reboots and browser cache/cookie clean-ups.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDb(file = process.env.STASH_DB || resolve(process.cwd(), 'data/stash.db')) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS items (
      id       TEXT PRIMARY KEY,
      position INTEGER NOT NULL,
      data     TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const qItems = db.prepare('SELECT data FROM items ORDER BY position');
  const qSettings = db.prepare('SELECT key, value FROM settings');
  const qDelItems = db.prepare('DELETE FROM items');
  const qInsItem = db.prepare('INSERT INTO items (id, position, data) VALUES (?, ?, ?)');
  const qSet = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  return {
    file,
    // `items` is null until the first save, so the client knows to migrate
    // anything left over in localStorage.
    getState() {
      const settings = Object.fromEntries(qSettings.all().map((r) => [r.key, r.value]));
      const initialized = settings['meta.initialized'] === '1';
      delete settings['meta.initialized'];
      return {
        items: initialized ? qItems.all().map((r) => JSON.parse(r.data)) : null,
        settings,
      };
    },
    saveItems(items) {
      tx(() => {
        qDelItems.run();
        items.forEach((it, i) => qInsItem.run(String(it.id), i, JSON.stringify(it)));
        qSet.run('meta.initialized', '1');
      });
    },
    setSetting(key, value) { qSet.run(key, String(value)); },
    close() { db.close(); },
  };
}
