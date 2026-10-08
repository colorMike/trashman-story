import { AVATARS, AVATAR_MAP, CATEGORIES } from '../data/avatars.js';
import { animate, still } from './sprite.js';

const api = typeof browser !== 'undefined' ? browser : chrome;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let state = null;
let settings = null;
let pickerSlot = 0;

function send(msg) {
  return new Promise(resolve => api.runtime.sendMessage(msg, r => resolve(r)));
}

function render() {
  const stage = $('#stage');
  stage.classList.toggle('active', !!state.active);

  const s = state.stats || {};
  $('#status-text').textContent = state.active
    ? (s.lastKeyword ? `Trashmen are surfing for "${s.lastKeyword}"` : 'Trashmen are warming up …')
    : 'Trashmen are sleeping. Flip the switch!';
  $('#status-today').textContent = s.today || 0;
  $('#status-total').textContent = s.total || 0;
  $('#status-keyword').textContent = s.lastKeyword || '–';

  const items = $$('#recent li a');
  items.forEach((a, i) => {
    const v = (s.recent || [])[i];
    if (v) { a.textContent = v.url.replace(/^https?:\/\/(www\.)?/, ''); a.href = v.url; a.title = `${v.avatar} · ${v.keyword}`; }
    else { a.textContent = ''; a.removeAttribute('href'); }
  });

  state.avatars.forEach((id, slot) => {
    const el = document.getElementById(`avatar-${slot}`);
    if (el.dataset.avatar !== id) { animate(el, id, slot); el.dataset.avatar = id; }
    const name = AVATAR_MAP[id]?.name || id;
    $(`#names .name[data-slot="${slot}"] .label`).textContent = name;
  });
}

async function refresh() {
  const r = await send({ type: 'getState' });
  if (!r) return;
  state = r.state; settings = r.settings;
  while (state.avatars.length < 3) state.avatars.push('Base');
  render();
}

// --- picker
function openPicker(slot) {
  pickerSlot = slot;
  $('#picker-slot').textContent = slot + 1;
  const grid = $('#picker-grid');
  grid.innerHTML = '';
  for (const cat of CATEGORIES) {
    const list = AVATARS.filter(a => a.category === cat);
    if (!list.length) continue;
    const h = document.createElement('h3'); h.textContent = cat.toUpperCase(); grid.append(h);
    const wrap = document.createElement('div'); wrap.className = 'cat';
    for (const a of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt'; b.dataset.id = a.id; b.title = `${a.keywords.length} keywords`;
      const takenElsewhere = state.avatars.includes(a.id) && state.avatars[slot] !== a.id;
      if (state.avatars[slot] === a.id) b.classList.add('selected');
      if (takenElsewhere) b.classList.add('taken');
      const sp = document.createElement('div'); sp.className = 'sprite small'; still(sp, a.id, slot, 70);
      const label = document.createElement('span'); label.textContent = a.name;
      b.append(sp, label);
      if (!takenElsewhere) b.addEventListener('click', () => chooseAvatar(a.id));
      wrap.append(b);
    }
    grid.append(wrap);
  }
  $('#picker').hidden = false;
}

async function chooseAvatar(id) {
  const avatars = [...state.avatars];
  avatars[pickerSlot] = id;
  await send({ type: 'setAvatars', avatars });
  $('#picker').hidden = true;
  refresh();
}

// --- wiring
$('#switch').addEventListener('click', async () => {
  await send({ type: 'setActive', active: !state.active });
  refresh();
});
$('#visit-now').addEventListener('click', async () => {
  if (!state.active) await send({ type: 'setActive', active: true });
  else await send({ type: 'visitNow' });
  setTimeout(refresh, 800);
});
$$('#slots .slot, #names .name').forEach(el => el.addEventListener('click', () => openPicker(Number(el.dataset.slot))));
$('#picker-close').addEventListener('click', () => { $('#picker').hidden = true; });
$('#open-options').addEventListener('click', e => { e.preventDefault(); api.runtime.openOptionsPage(); });

api.runtime.onMessage.addListener(msg => { if (msg?.type === 'stateChanged') { state = { ...state, ...msg.state }; render(); } });

refresh();
