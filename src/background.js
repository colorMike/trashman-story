// Trashman Story – background service worker (Chrome) / event page (Firefox).
// All state lives in chrome.storage.local so it survives worker restarts.
// Every write goes through mutate(), which serialises read-modify-write cycles,
// so concurrent messages and ticks can never overwrite each other's changes.

import {
  DEFAULT_SETTINGS, DEFAULT_STATE, decideNext, mergeQueue, nextDelayMs,
  recordVisit, dailyLimitReached, filterLinks,
} from './lib/engine.js';

const TICK_ALARM = 'trashman-tick';
const TICK_MINUTES = 0.5;            // smallest reliable alarm period
const FAST_TICK_MS = 5000;           // polling while the worker is alive
const PAGE_LOAD_TIMEOUT_MS = 25000;

// ------------------------------------------------------------- storage helpers

async function readStore() {
  const raw = await chrome.storage.local.get(['state', 'settings']);
  const settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  const state = {
    ...DEFAULT_STATE, ...(raw.state || {}),
    stats: { ...DEFAULT_STATE.stats, ...(raw.state?.stats || {}) },
  };
  return { state, settings };
}

let chain = Promise.resolve();
/** Serialised read-modify-write. `fn` may be async and may return a value. */
function mutate(fn) {
  const run = async () => {
    const { state, settings } = await readStore();
    const result = await fn(state, settings);
    await chrome.storage.local.set({ state });
    broadcast({ type: 'stateChanged', state });
    return result;
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => { /* no popup or options page open */ });
}

// ------------------------------------------------------------- tab handling

async function tabExists(tabId) {
  if (tabId == null) return false;
  try { await chrome.tabs.get(tabId); return true; } catch { return false; }
}

/** Returns the id of the Trashman tab, creating it if needed. */
async function ensureTab() {
  const { state } = await readStore();
  if (await tabExists(state.tabId)) return state.tabId;
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('popup/landing.html'), active: false, pinned: true });
  try { await chrome.tabs.update(tab.id, { muted: true }); } catch { /* firefox may refuse */ }
  await mutate(s => { s.tabId = tab.id; });
  return tab.id;
}

function navigate(tabId, url) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.update(tabId, { url }).catch(finish);
    setTimeout(finish, PAGE_LOAD_TIMEOUT_MS);
  });
}

// ------------------------------------------------------------- the loop

let ticking = false;

async function tick(force = false) {
  if (ticking) return;
  ticking = true;
  try {
    const { state, settings } = await readStore();
    if (!state.active) return;
    if (!force && Date.now() < state.nextVisitAt) return;

    if (dailyLimitReached(state.stats, settings)) {
      await mutate(s => { s.nextVisitAt = Date.now() + 10 * 60 * 1000; });
      return;
    }

    if (settings.onlyWhenActive) {
      const idle = await new Promise(r => chrome.idle.queryState(120, r));
      if (idle !== 'active') {
        await mutate(s => { s.nextVisitAt = Date.now() + 60 * 1000; });
        return;
      }
    }

    const tabId = await ensureTab();
    const visit = await mutate((s, cfg) => {
      if (!s.active) return null;
      const { next, queue, domainHops } = decideNext(s, cfg);
      s.queue = queue;
      s.domainHops = domainHops;
      s.nextVisitAt = Date.now() + nextDelayMs(cfg);
      s.stats = recordVisit(s.stats, next);
      return next;
    });
    if (visit) await navigate(tabId, visit.url);
  } catch (err) {
    console.warn('[trashman] tick failed', err);
  } finally {
    ticking = false;
  }
}

async function setActive(on) {
  if (on) {
    await mutate(s => {
      s.active = true;
      s.nextVisitAt = 0;
      s.stats.startedAt = s.stats.startedAt || Date.now();
    });
    await chrome.alarms.create(TICK_ALARM, { periodInMinutes: TICK_MINUTES });
    scheduleFastTicks();
    tick(true);
  } else {
    await chrome.alarms.clear(TICK_ALARM);
    const tabId = await mutate(s => { const id = s.tabId; s.active = false; s.tabId = null; s.queue = []; return id; });
    if (await tabExists(tabId)) { try { await chrome.tabs.remove(tabId); } catch { /* ignore */ } }
  }
}

// Alarms fire at most every 30 s. While the worker is alive we also poll faster so short pauses work.
let fastTimer = null;
function scheduleFastTicks() {
  if (fastTimer) return;
  fastTimer = setInterval(async () => {
    const { state } = await readStore();
    if (!state.active) { clearInterval(fastTimer); fastTimer = null; return; }
    tick();
  }, FAST_TICK_MS);
}

// ------------------------------------------------------------- events

chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === TICK_ALARM) { tick(); scheduleFastTicks(); } });

chrome.runtime.onStartup.addListener(async () => {
  const active = await mutate(s => { s.tabId = null; return s.active; });   // tabs do not survive a restart
  if (active) { await chrome.alarms.create(TICK_ALARM, { periodInMinutes: TICK_MINUTES }); scheduleFastTicks(); }
});

chrome.runtime.onInstalled.addListener(async details => {
  const { state, settings } = await readStore();
  await chrome.storage.local.set({ settings });
  if (state.active) await chrome.alarms.create(TICK_ALARM, { periodInMinutes: TICK_MINUTES });
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('popup/landing.html') });
});

chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  const { state } = await readStore();
  if (tabId !== state.tabId) return;
  await mutate(s => {
    if (s.tabId !== tabId) return;
    s.tabId = null;
    if (!info.isWindowClosing) s.active = false;   // the user closed the Trashman tab on purpose
  });
  const { state: after } = await readStore();
  if (!after.active) await chrome.alarms.clear(TICK_ALARM);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case 'getState':
        sendResponse(await readStore());
        break;
      case 'setActive':
        await setActive(!!msg.active);
        sendResponse({ ok: true });
        break;
      case 'setAvatars':
        await mutate(s => { s.avatars = (msg.avatars || []).slice(0, 3); s.queue = []; });
        sendResponse({ ok: true });
        break;
      case 'setSettings': {
        const { settings } = await readStore();
        const merged = { ...settings, ...(msg.settings || {}) };
        await chrome.storage.local.set({ settings: merged });
        sendResponse({ ok: true, settings: merged });
        break;
      }
      case 'isTrashmanTab': {
        const { state } = await readStore();
        sendResponse({ yes: sender.tab?.id != null && sender.tab.id === state.tabId, avatar: state.stats.lastAvatar, keyword: state.stats.lastKeyword });
        break;
      }
      case 'linksHarvested': {
        const queued = await mutate((s, cfg) => {
          if (sender.tab?.id !== s.tabId) return -1;
          s.queue = mergeQueue(s.queue, filterLinks(msg.links, msg.pageUrl, cfg.queueLimit), cfg.queueLimit);
          return s.queue.length;
        });
        sendResponse({ ok: queued >= 0, queued });
        break;
      }
      case 'visitNow':
        await mutate(s => { s.nextVisitAt = 0; });
        tick(true);
        sendResponse({ ok: true });
        break;
      case 'resetStats':
        await mutate(s => { s.stats = { ...DEFAULT_STATE.stats }; });
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false });
    }
  })();
  return true; // keep the channel open for the async sendResponse
});
