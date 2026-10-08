import { ENGINES } from '../lib/engine.js';
import { AVATAR_MAP } from '../data/avatars.js';

const api = typeof browser !== 'undefined' ? browser : chrome;
const $ = s => document.querySelector(s);
const send = msg => new Promise(r => api.runtime.sendMessage(msg, r));
const NUM = ['minDelaySec', 'maxDelaySec', 'dailyLimit', 'maxHopsPerDomain'];

let settings;

function renderEngines() {
  const box = $('#engines');
  box.innerHTML = '';
  for (const [id, e] of Object.entries(ENGINES)) {
    const l = document.createElement('label');
    const c = document.createElement('input');
    c.type = 'checkbox'; c.value = id; c.checked = settings.engines.includes(id);
    c.addEventListener('change', save);
    l.append(c, document.createTextNode(' ' + e.label));
    box.append(l);
  }
}

function row(cells) {
  const tr = document.createElement('tr');
  for (const c of cells) { const td = document.createElement('td'); td.textContent = c; tr.append(td); }
  return tr;
}

function fill(table, obj, labelOf = k => k) {
  const rows = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  table.replaceChildren(...(rows.length ? rows.map(([k, v]) => row([labelOf(k), v])) : [row(['nothing yet', ''])]));
}

function renderStats(state) {
  const s = state.stats || {};
  $('#st-total').textContent = s.total || 0;
  $('#st-today').textContent = s.today || 0;
  $('#st-since').textContent = s.startedAt ? new Date(s.startedAt).toLocaleDateString() : '–';
  fill($('#st-avatars'), s.perAvatar, k => (AVATAR_MAP[k]?.name || k).toUpperCase());
  fill($('#st-engines'), s.perEngine, k => ENGINES[k]?.label || k);
  const items = (s.recent || []).map(v => {
    const li = document.createElement('li');
    const a = document.createElement('a'); a.href = v.url; a.target = '_blank'; a.textContent = v.url;
    const small = document.createElement('small'); small.textContent = ` (${v.avatar} · ${v.keyword})`;
    li.append(a, small);
    return li;
  });
  if (!items.length) { const li = document.createElement('li'); li.textContent = 'nothing yet'; items.push(li); }
  $('#st-recent').replaceChildren(...items);
}

async function load() {
  const r = await send({ type: 'getState' });
  settings = r.settings;
  for (const k of NUM) $('#' + k).value = settings[k];
  $('#onlyWhenActive').checked = !!settings.onlyWhenActive;
  renderEngines();
  renderStats(r.state);
}

async function save() {
  const next = {};
  for (const k of NUM) next[k] = Number($('#' + k).value) || settings[k];
  if (next.maxDelaySec <= next.minDelaySec) next.maxDelaySec = next.minDelaySec + 1;
  next.onlyWhenActive = $('#onlyWhenActive').checked;
  next.engines = [...document.querySelectorAll('#engines input:checked')].map(c => c.value);
  if (!next.engines.length) next.engines = ['google'];
  const r = await send({ type: 'setSettings', settings: next });
  settings = r.settings;
  for (const k of NUM) $('#' + k).value = settings[k];
  const saved = $('#saved'); saved.hidden = false; setTimeout(() => { saved.hidden = true; }, 1200);
}

for (const k of NUM) $('#' + k).addEventListener('change', save);
$('#onlyWhenActive').addEventListener('change', save);
$('#reset').addEventListener('click', async () => { await send({ type: 'resetStats' }); load(); });
api.runtime.onMessage.addListener(msg => { if (msg?.type === 'stateChanged') renderStats(msg.state); });

load();
