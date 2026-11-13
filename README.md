# The Stash

Stash your links easily and sleep better at night.

## Requirements

- Node.js 22.5 or newer

## Getting started

**macOS / Linux**

```bash
./run.sh      # installs deps, builds if needed, starts the server in the background
./stop.sh     # stops it
./update.sh   # adds remote origin to this repo if not present and git pulls it
```

**Windows**

```bat
run.bat       :: installs deps, builds if needed, starts the server with a tray icon
stop.bat      :: stops it
update.bat    :: adds remote origin to this repo if not present and git pulls it
```

Then open http://localhost:5173.

**Development**

```bash
npm install
npm run dev
```

## Data

Everything is saved to `data/stash.db`. Set the `STASH_DB` environment variable to use a different path. Back up that file to keep your stash.

## Project structure

```
index.html        App shell
src/main.js       UI: tiles, groups, menus, drag and drop
src/storage.js    Client-side persistence (talks to the API)
src/style.css     Styles and themes
server/api.js     Vite plugin exposing a small JSON API
server/db.js      SQLite storage
```
