const KEY = 'linkgrid.items', ZOOM = 'linkgrid.cell';
const $ = (id) => document.getElementById(id);
const grid = $('grid'), pinned = $('pinned'), dlg = $('dlg'), menu = $('menu'), zoom = $('zoom');

let items = [];
try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
const save = () => localStorage.setItem(KEY, JSON.stringify(items));

// ---- Global icon size ----
const setCell = (v) => document.documentElement.style.setProperty('--cell', v + 'px');
zoom.value = localStorage.getItem(ZOOM) || 140;
setCell(zoom.value);
zoom.oninput = () => { setCell(zoom.value); localStorage.setItem(ZOOM, zoom.value); };

// ---- Rendering ----
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const normalize = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u;

function tile(it) {
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
  a._item = it;
  a.draggable = false;
  if (drag && drag.it === it) a.classList.add('dragging');
  a.onpointerdown = (e) => startHold(e, a, it);
  a.oncontextmenu = (e) => {
    e.preventDefault();
    if (!drag) openMenu(e.clientX, e.clientY, it);
  };
  return a;
}

function render() {
  const pins = items.filter((i) => i.pinned);
  pinned.hidden = !pins.length;
  pinned.replaceChildren(...pins.map(tile));

  const add = document.createElement('button');
  add.className = 'add'; add.textContent = '+'; add.title = 'Add link';
  add.onclick = () => openDialog(null);
  grid.replaceChildren(add, ...items.filter((i) => !i.pinned).map(tile));
}

// ---- Right-click menu ----
let target = null;
function openMenu(x, y, it) {
  target = it;
  menu.querySelector('[data-act=pin]').textContent = it.pinned ? 'Unpin' : 'Pin';
  menu.hidden = false;
  const { offsetWidth: w, offsetHeight: h } = menu;
  menu.style.left = Math.min(x, innerWidth - w - 8) + 'px';
  menu.style.top = Math.min(y, innerHeight - h - 8) + 'px';
  menu.querySelector('button').focus();
}
const closeMenu = () => { menu.hidden = true; };
menu.onclick = (e) => {
  const act = e.target.dataset.act; if (!act) return;
  const it = target; closeMenu();
  if (act === 'edit') openDialog(it);
  if (act === 'pin') { it.pinned = !it.pinned; save(); render(); }
  if (act === 'delete') { items = items.filter((i) => i !== it); save(); render(); }
};
addEventListener('pointerdown', (e) => { if (!menu.contains(e.target)) closeMenu(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
addEventListener('scroll', closeMenu, true);
addEventListener('resize', closeMenu);

// ---- Add / edit dialog ----
let editing = null, draft = {};
function openDialog(item) {
  editing = item;
  draft = item ? { ...item } : { name: '', url: '', image: '' };
  $('name').value = draft.name;
  $('url').value = draft.url;
  dlg.showModal();
  $('url').focus();
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
  draft.url = normalize($('url').value.trim());
  if (editing) Object.assign(editing, draft); else items.push(draft);
  save(); render();
};
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

// ---- Click and hold to drag ----
const HOLD_MS = 250, MOVE_TOLERANCE = 6;
let hold = null, drag = null, suppressClick = false;

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

// Dragged icon takes the slot of whichever icon the pointer is over.
function reorder(x, y) {
  const over = document.elementFromPoint(x, y)?.closest('.tile');
  const other = over?._item;
  if (!other || other === drag.it) return;
  items.splice(items.indexOf(drag.it), 1);
  items.splice(items.indexOf(other), 0, drag.it);
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
  drag.ghost.remove(); drag = null;
  document.body.classList.remove('dragging');
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 50);
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
