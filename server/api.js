// Vite plugin exposing a tiny JSON API over the SQLite database, mounted on
// both `vite` (dev) and `vite preview` (what run.sh / tray.ps1 use).
//   GET /api/state            -> { items: [...] | null, settings: {...} }
//   PUT /api/items            <- [...items]
//   PUT /api/settings/:key    <- { value }
import { openDb } from './db.js';

const MAX_BODY = 64 * 1024 * 1024; // images are stored inline as data URLs

function readJson(req) {
  return new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { fail(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { fail(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', fail);
  });
}

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body === undefined ? '' : JSON.stringify(body));
};

export default function stashApi() {
  let db;
  const middleware = async (req, res, next) => {
    const url = (req.url || '').split('?')[0];
    if (!url.startsWith('/api/')) return next();
    try {
      db ??= openDb();
      if (req.method === 'GET' && url === '/api/state') return send(res, 200, db.getState());
      if (req.method === 'PUT' && url === '/api/items') {
        const items = await readJson(req);
        if (!Array.isArray(items)) return send(res, 400, { error: 'Expected an array' });
        db.saveItems(items);
        return send(res, 204);
      }
      const m = url.match(/^\/api\/settings\/([\w.-]+)$/);
      if (req.method === 'PUT' && m) {
        const { value } = await readJson(req);
        db.setSetting(m[1], value);
        return send(res, 204);
      }
      send(res, 404, { error: 'Not found' });
    } catch (e) {
      console.error('[stash-api]', e);
      send(res, e.status || 500, { error: e.message });
    }
  };
  return {
    name: 'stash-api',
    configureServer(server) {
      db ??= openDb(); // create the file right away, not on first request
      server.middlewares.use(middleware);
      server.httpServer?.once('close', () => db?.close());
    },
    configurePreviewServer(server) {
      db ??= openDb();
      console.log(`  Stash database: ${db.file}`);
      server.middlewares.use(middleware);
      server.httpServer?.once('close', () => db?.close());
    },
  };
}
