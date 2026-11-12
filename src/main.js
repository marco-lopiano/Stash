const KEY = 'linkgrid.items', ZOOM = 'linkgrid.cell';
const $ = (id) => document.getElementById(id);
const grid = $('grid'), pinned = $('pinned'), dlg = $('dlg'), menu = $('menu'), zoom = $('zoom');
const folder = $('folder'), folderGrid = $('folder-grid'), folderTitle = $('folder-title');

let items = [];
try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
const save = () => localStorage.setItem(KEY, JSON.stringify(items));

// Each item needs a stable id and a type; migrate any legacy entries once.
let _seq = 0;
const uid = () => Date.now().toString(36) + (_seq++).toString(36) + Math.random().toString(36).slice(2, 6);
(() => {
  let changed = false;
  for (const it of items) {
    if (!it.id) { it.id = uid(); changed = true; }
    if (!it.type) { it.type = 'link'; changed = true; }
  }
  if (changed) save();
})();

const childrenOf = (id) => items.filter((i) => i.parent === id);
const topLevel = () => items.filter((i) => !i.parent);
// True if `it` lives anywhere inside the subtree rooted at `rootId` (guards against cycles).
function inSubtree(it, rootId) {
  const seen = new Set();
  let cur = it;
  while (cur && !seen.has(cur.id)) {
    if (cur.id === rootId) return true;
    seen.add(cur.id);
    cur = items.find((i) => i.id === cur.parent);
  }
  return false;
}

// ---- Global icon size ----
const setCell = (v) => document.documentElement.style.setProperty('--cell', v + 'px');
zoom.value = localStorage.getItem(ZOOM) || 140;
setCell(zoom.value);
zoom.oninput = () => { setCell(zoom.value); localStorage.setItem(ZOOM, zoom.value); };

// ---- Theme ----
const THEME = 'linkgrid.theme';
const settingsBtn = $('settings-btn'), settings = $('settings'), themeSeg = $('theme');
function applyTheme(t) {
  // 'system' = defer to prefers-color-scheme (no attribute); otherwise force it.
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  for (const b of themeSeg.children) b.classList.toggle('on', b.dataset.theme === t);
}
applyTheme(localStorage.getItem(THEME) || 'system');
themeSeg.onclick = (e) => {
  const t = e.target.dataset.theme; if (!t) return;
  localStorage.setItem(THEME, t); applyTheme(t);
};
settingsBtn.onclick = () => { settings.hidden = !settings.hidden; };
addEventListener('pointerdown', (e) => {
  if (!settings.hidden && !settings.contains(e.target) && e.target !== settingsBtn) settings.hidden = true;
});

// ---- Rendering ----
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const normalize = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u;

function wireTile(el, it) {
  el._item = it;
  el.draggable = false;
  if (drag && drag.it === it) el.classList.add('dragging');
  el.onpointerdown = (e) => startHold(e, el, it);
  el.oncontextmenu = (e) => {
    e.preventDefault();
    if (!drag) openMenu(e.clientX, e.clientY, it);
  };
}

function linkTile(it) {
  const a = document.createElement('a');
  a.className = 'tile' + (it.image ? '' : ' noimg');
  a.href = it.url; a.target = '_blank'; a.rel = 'noopener';
  if (it.image) a.style.backgroundImage = `url(${it.image})`;
  else {
    const i = document.createElement('span');
    i.className = 'initial'; i.textContent = (it.name || it.url)[0].toUpperCase();
    a.append(i);
  }
  const label = document.createElement('span');
  label.className = 'label'; label.textContent = it.name || hostOf(it.url);
  a.append(label);
  wireTile(a, it);
  return a;
}

// A small thumbnail used inside a group's preview grid.
function miniIcon(it) {
  const m = document.createElement('span');
  m.className = 'mini';
  if (it.type === 'group') { m.classList.add('mini-folder'); m.textContent = '📁'; }
  else if (it.image) m.style.backgroundImage = `url(${it.image})`;
  else { m.classList.add('mini-init'); m.textContent = (it.name || it.url || '?')[0].toUpperCase(); }
  return m;
}

// iPhone-style folder: up to 3 mini previews, then `···` when there are more.
function groupTile(it) {
  const el = document.createElement('div');
  el.className = 'tile group noimg';
  el.tabIndex = 0;
  const prev = document.createElement('div');
  prev.className = 'folder-preview';
  const kids = childrenOf(it.id);
  for (const k of kids.slice(0, 3)) prev.append(miniIcon(k));
  if (kids.length > 3) {
    const more = document.createElement('span');
    more.className = 'mini more'; more.textContent = '···';
    prev.append(more);
  }
  el.append(prev);
  const label = document.createElement('span');
  label.className = 'label'; label.textContent = it.name || 'Group';
  el.append(label);
  wireTile(el, it);
  el.onclick = () => { if (!drag && !suppressClick) openGroup(it); };
  el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGroup(it); } };
  return el;
}

const tile = (it) => it.type === 'group' ? groupTile(it) : linkTile(it);

function addButton(parentId) {
  const add = document.createElement('button');
  add.className = 'add'; add.textContent = '+'; add.title = 'Add link or group';
  add.onclick = () => openDialog(null, parentId);
  return add;
}

function render() {
  const top = topLevel();
  const pins = top.filter((i) => i.pinned);
  pinned.hidden = !pins.length;
  pinned.replaceChildren(...pins.map(tile));

  grid.replaceChildren(addButton(null), ...top.filter((i) => !i.pinned).map(tile));
  renderFolder();
}

// ---- Group folder overlay ----
let openGroupId = null;
function openGroup(it) { openGroupId = it.id; render(); }
function closeFolder() { openGroupId = null; render(); }

function renderFolder() {
  if (openGroupId == null) { folder.hidden = true; return; }
  const g = items.find((i) => i.id === openGroupId && i.type === 'group');
  if (!g) { openGroupId = null; folder.hidden = true; return; }
  folder.hidden = false;
  folderTitle.textContent = g.name || 'Group';
  folderGrid.replaceChildren(addButton(g.id), ...childrenOf(g.id).map(tile));
}

$('folder-close').onclick = closeFolder;
folder.addEventListener('pointerdown', (e) => {
  // Click on the dimmed backdrop (outside the panel) closes the folder.
  if (e.target === folder && !drag) closeFolder();
});

// ---- Right-click menu ----
let target = null, menuMode = 'main', menuPos = { x: 0, y: 0 };

// Groups an item can be sent into: every group except itself, its current
// parent (no-op), and its own descendants (which would create a cycle).
function moveTargets(it) {
  return items.filter((g) => g.type === 'group'
    && g.id !== it.id
    && g.id !== it.parent
    && !(it.type === 'group' && inSubtree(g, it.id)));
}

function mkItem(label, data, cls) {
  const b = document.createElement('button');
  b.setAttribute('role', 'menuitem');
  b.textContent = label;
  if (cls) b.className = cls;
  for (const k in data) if (data[k] != null) b.dataset[k] = data[k];
  return b;
}

function openMenu(x, y, it) {
  target = it; menuMode = 'main'; menuPos = { x, y };
  renderMenu();
}

function renderMenu() {
  const it = target;
  const kids = [];
  if (menuMode === 'main') {
    kids.push(mkItem('Edit', { act: 'edit' }));
    kids.push(mkItem(it.pinned ? 'Unpin' : 'Pin', { act: 'pin' }));
    if (moveTargets(it).length || it.parent != null) kids.push(mkItem('Move to…', { act: 'move' }));
    kids.push(mkItem('Delete', { act: 'delete' }, 'danger'));
  } else {
    kids.push(mkItem('‹ Back', { act: 'back' }, 'quiet'));
    if (it.parent != null) kids.push(mkItem('🏠 Home', { act: 'home' }));
    for (const g of moveTargets(it)) kids.push(mkItem('📁 ' + (g.name || 'Group'), { group: g.id }));
  }
  menu.replaceChildren(...kids);
  menu.hidden = false;
  const { offsetWidth: w, offsetHeight: h } = menu;
  menu.style.left = Math.min(menuPos.x, innerWidth - w - 8) + 'px';
  menu.style.top = Math.min(menuPos.y, innerHeight - h - 8) + 'px';
  menu.querySelector('button').focus();
}
const closeMenu = () => { menu.hidden = true; };

// Re-home an item (parentId null = top level) and append it to its new container.
function moveInto(it, parentId) {
  it.parent = parentId;
  if (parentId != null) it.pinned = false;
  items.splice(items.indexOf(it), 1);
  items.push(it);
  save(); render();
}

// Remove an item and everything nested inside it.
function removeSubtree(root) {
  const dead = new Set([root.id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const i of items) {
      if (i.parent != null && dead.has(i.parent) && !dead.has(i.id)) { dead.add(i.id); grew = true; }
    }
  }
  items = items.filter((i) => !dead.has(i.id));
  if (dead.has(openGroupId)) openGroupId = null;
}

menu.onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const { act, group } = b.dataset;
  const it = target;
  if (act === 'move') { menuMode = 'move'; renderMenu(); return; }
  if (act === 'back') { menuMode = 'main'; renderMenu(); return; }
  closeMenu();
  if (group != null) moveInto(it, group);
  else if (act === 'home') moveInto(it, null);
  else if (act === 'edit') openDialog(it);
  else if (act === 'pin') { it.pinned = !it.pinned; save(); render(); }
  else if (act === 'delete') { removeSubtree(it); save(); render(); }
};
addEventListener('pointerdown', (e) => { if (!menu.contains(e.target)) closeMenu(); });
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!settings.hidden) settings.hidden = true;
  else if (!menu.hidden) closeMenu();
  else if (openGroupId != null && (dlg.open ? false : true)) closeFolder();
});
addEventListener('scroll', closeMenu, true);
addEventListener('resize', closeMenu);

// ---- Add / edit dialog ----
let editing = null, draft = {}, draftType = 'link';
const typeSeg = $('type');

function setType(t) {
  draftType = t;
  for (const b of typeSeg.children) b.classList.toggle('on', b.dataset.type === t);
  const grp = t === 'group';
  $('url').hidden = grp;
  $('imgrow').hidden = grp;
  $('url').required = !grp;
  $('name').placeholder = grp ? 'Group name' : 'Name';
}
typeSeg.onclick = (e) => { const t = e.target.dataset.type; if (t) setType(t); };

function openDialog(item, parentId) {
  editing = item;
  draft = item
    ? { ...item }
    : { id: uid(), type: 'link', name: '', url: '', image: '', parent: parentId ?? null };
  typeSeg.hidden = !!item;                 // type is fixed once created
  setType(item ? (item.type || 'link') : 'link');
  $('name').value = draft.name || '';
  $('url').value = draft.url || '';
  dlg.showModal();
  (draftType === 'group' ? $('name') : $('url')).focus();
}

// Crop the chosen image to a 400x400 square so storage stays small.
$('file').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 400;
    const m = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 400, 400);
    draft.image = c.toDataURL('image/jpeg', 0.82);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f);
  e.target.value = '';
};
$('clear').onclick = () => { draft.image = ''; };
$('cancel').onclick = () => dlg.close();
$('form').onsubmit = () => {
  draft.name = $('name').value.trim();
  if (draftType === 'group') {
    draft.type = 'group';
  } else {
    draft.type = 'link';
    draft.url = normalize($('url').value.trim());
  }
  if (editing) Object.assign(editing, draft); else items.push(draft);
  save(); render();
};
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

// ---- Click and hold to drag ----
const HOLD_MS = 250, MOVE_TOLERANCE = 6;
let hold = null, drag = null, suppressClick = false, dropTarget = null;

function setDrop(el, it) {
  if (dropTarget && dropTarget.el === el) return;
  clearDrop();
  dropTarget = { el, it };
  el.classList.add('drop');
}
function clearDrop() {
  if (dropTarget) { dropTarget.el.classList.remove('drop'); dropTarget = null; }
}

function startHold(e, el, it) {
  if (e.button !== 0) return;
  clearTimeout(hold?.timer);
  hold = { el, it, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
           timer: setTimeout(beginDrag, HOLD_MS) };
}

function beginDrag() {
  const { el, it, x, y } = hold;
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.classList.add('ghost');
  Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px' });
  document.body.append(ghost);
  drag = { it, ghost, ox: x - r.left, oy: y - r.top };
  hold = null;
  closeMenu();
  document.body.classList.add('dragging');
  moveGhost(x, y);
  render();
}

function moveGhost(x, y) {
  drag.ghost.style.left = x - drag.ox + 'px';
  drag.ghost.style.top = y - drag.oy + 'px';
}

// Decide where the dragged tile goes as the pointer moves.
function reorder(x, y) {
  const el = document.elementFromPoint(x, y);
  const tileEl = el?.closest('.tile');
  const other = tileEl?._item;

  // Hovering the centre of a group (that isn't itself or a descendant) = drop inside it.
  if (other && other !== drag.it && other.type === 'group' &&
      !(drag.it.type === 'group' && inSubtree(other, drag.it.id))) {
    const r = tileEl.getBoundingClientRect();
    const cx = (x - r.left) / r.width, cy = (y - r.top) / r.height;
    if (cx > 0.22 && cx < 0.78 && cy > 0.22 && cy < 0.78) { setDrop(tileEl, other); return; }
  }
  clearDrop();

  if (!other) {
    // Released over the folder backdrop → pop the item back out to the home screen.
    if (!folder.hidden && el && el.closest('#folder') && !el.closest('#folder-panel')) {
      if (drag.it.parent != null) {
        drag.it.parent = null; drag.it.pinned = false;
        items.splice(items.indexOf(drag.it), 1); items.push(drag.it);
        render();
      }
      return;
    }
    // Drag a pinned item onto the open grid to unpin it.
    if (drag.it.pinned && el?.closest('#grid')) {
      items.splice(items.indexOf(drag.it), 1);
      items.push(drag.it);
      drag.it.pinned = false;
      render();
    }
    return;
  }

  if (other === drag.it) return;
  // Take the slot of whichever tile the pointer is over, adopting its container.
  const from = items.indexOf(drag.it);
  const to = items.indexOf(other);
  items.splice(from, 1);
  items.splice(to, 0, drag.it);
  drag.it.parent = other.parent ?? null;
  drag.it.pinned = !!other.pinned;
  render();
}

addEventListener('pointermove', (e) => {
  if (drag) { moveGhost(e.clientX, e.clientY); reorder(e.clientX, e.clientY); return; }
  if (!hold) return;
  if (Math.hypot(e.clientX - hold.sx, e.clientY - hold.sy) > MOVE_TOLERANCE) {
    clearTimeout(hold.timer); hold = null;
  }
});

function endDrag() {
  if (hold) { clearTimeout(hold.timer); hold = null; }
  if (!drag) return;
  const dt = dropTarget; clearDrop();
  const it = drag.it;
  drag.ghost.remove(); drag = null;
  document.body.classList.remove('dragging');
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 50);
  // Finalise a drop into a group.
  if (dt && dt.it !== it && !(it.type === 'group' && inSubtree(dt.it, it.id))) {
    it.parent = dt.it.id;
    it.pinned = false;
    items.splice(items.indexOf(it), 1); items.push(it);
  }
  save(); render();
}
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', endDrag);
addEventListener('click', (e) => {
  if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
}, true);
// Stop touch scrolling once a drag has started.
addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });

render();
