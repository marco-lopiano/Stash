# The Stash

A small, self-hosted start page for your favourite links. Save sites as image tiles, organise them into groups, and keep everything in a local SQLite database that survives browser cache clean-ups and reboots.

## Features

- **Link tiles** with a custom image and name
- **Groups** (folders), which can be nested
- **Pin** items to a row at the top
- **Notes** attached to any tile
- **Drag and drop**: hold a tile to reorder it, or drop it onto a group to move it inside
- **Right-click menu** to edit, add notes, pin, move or delete
- Adjustable **icon size** and a **light, dark or system** theme
- Data stored on disk in `data/stash.db`

## Requirements

- Node.js 22.5 or newer (uses the built-in `node:sqlite` module)

## Getting started

**macOS / Linux**

```bash
./run.sh    # installs deps, builds if needed, starts the server in the background
./stop.sh   # stops it
```

**Windows**

```bat
run.bat     :: installs deps, builds if needed, starts the server with a tray icon
stop.bat    :: stops it
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
