// Pure, browser-API-free logic of the Trashman engine.
// Everything here is unit-tested with node:test (see test/engine.test.js).

import { AVATAR_MAP } from '../data/avatars.js';

export const DEFAULT_SETTINGS = {
  minDelaySec: 25,          // shortest pause between two page visits
  maxDelaySec: 120,         // longest pause between two page visits
  onlyWhenActive: true,     // pause while the user is away from the computer
  dailyLimit: 800,          // hard cap of visits per day (traffic / sanity)
  maxHopsPerDomain: 3,      // leave a site after this many consecutive pages
  queueLimit: 150,          // how many harvested links we keep
  engines: ['google', 'bing', 'duckduckgo', 'amazon', 'ebay', 'idealo', 'wikipedia'],
};

export const DEFAULT_STATE = {
  active: false,
  avatars: ['Nerd', 'Cook', 'Tourist'],   // three "outfits", as in the original plugin
  tabId: null,
  queue: [],
  nextVisitAt: 0,
  domainHops: { host: null, count: 0 },
  stats: {
    total: 0,
    today: 0,
    dateKey: '',
    perAvatar: {},
    perEngine: {},
    recent: [],          // last 5 visited {url, keyword, avatar, at}
    lastKeyword: '',
    lastAvatar: '',
    startedAt: 0,
  },
};

// ---------------------------------------------------------------- random

export function randomInt(min, max, rnd = Math.random) {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

export function pick(list, rnd = Math.random) {
  if (!list || list.length === 0) return undefined;
  return list[Math.floor(rnd() * list.length)];
}

/** Jittered delay in ms. Human-ish: mostly short, sometimes long (log-uniform). */
export function nextDelayMs(settings, rnd = Math.random) {
  const min = Math.max(5, settings.minDelaySec);
  const max = Math.max(min + 1, settings.maxDelaySec);
  const u = rnd();
  const sec = Math.exp(Math.log(min) + u * (Math.log(max) - Math.log(min)));
  return Math.round(sec * 1000);
}

// ---------------------------------------------------------------- keywords

export function pickKeyword(avatarIds, rnd = Math.random) {
  const avatars = (avatarIds || []).map(id => AVATAR_MAP[id]).filter(a => a && a.keywords.length);
  const avatar = pick(avatars, rnd);
  if (!avatar) return { avatar: 'Base', keyword: 'trashmanstory' };
  return { avatar: avatar.id, keyword: pick(avatar.keywords, rnd) };
}

// ---------------------------------------------------------------- seed urls

export const ENGINES = {
  google:     { label: 'Google',     url: q => `https://www.google.com/search?q=${q}` },
  bing:       { label: 'Bing',       url: q => `https://www.bing.com/search?q=${q}` },
  duckduckgo: { label: 'DuckDuckGo', url: q => `https://duckduckgo.com/html/?q=${q}` },
  amazon:     { label: 'Amazon',     url: q => `https://www.amazon.de/s?k=${q}` },
  ebay:       { label: 'eBay',       url: q => `https://www.ebay.de/sch/i.html?_nkw=${q}` },
  idealo:     { label: 'idealo',     url: q => `https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${q}` },
  wikipedia:  { label: 'Wikipedia',  url: q => `https://de.wikipedia.org/w/index.php?search=${q}` },
};

export function buildSeedUrl(engineId, keyword) {
  const engine = ENGINES[engineId] || ENGINES.google;
  return engine.url(encodeURIComponent(keyword));
}

export function pickEngine(settings, rnd = Math.random) {
  const enabled = (settings.engines || []).filter(e => ENGINES[e]);
  return pick(enabled.length ? enabled : Object.keys(ENGINES), rnd);
}

// ---------------------------------------------------------------- link filter

const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]+|bing\.com|microsoft\.com|duckduckgo\.com|yahoo\.com|youtube\.com|blogger\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|linkedin\.com|accounts\.[a-z.]+)$/i;
const BAD_PATH = /(logout|log-out|signout|sign-out|abmelden|unsubscribe|delete|remove|checkout|warenkorb|cart|basket|kasse|login|signin|anmelden|register|registrieren|download|\.exe$|\.dmg$|\.apk$)/i;
const BAD_EXT = /\.(jpe?g|png|gif|webp|svg|pdf|zip|rar|7z|mp[34]|avi|mkv|exe|dmg|iso|css|js|xml|json)(\?|#|$)/i;

/** Normalises a candidate link found on `baseUrl`. Returns null if it must not be visited. */
export function sanitizeLink(href, baseUrl) {
  if (!href) return null;
  let url;
  try { url = new URL(href, baseUrl); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (SEARCH_HOSTS.test(url.hostname)) return null;
  if (BAD_EXT.test(url.pathname)) return null;
  if (BAD_PATH.test(url.pathname + url.search)) return null;
  if (/^(localhost|127\.|10\.|192\.168\.|\[)/.test(url.hostname) || !url.hostname.includes('.')) return null;
  if (url.pathname === '/' && !url.search) return null;   // bare homepages are navigation chrome, not content
  url.hash = '';
  return url.href;
}

/** Google / Bing / DDG wrap result links in redirect urls. Unwrap the common ones. */
export function unwrapRedirect(href) {
  try {
    const u = new URL(href);
    if (/(^|\.)google\./.test(u.hostname) && u.pathname === '/url') return u.searchParams.get('q') || u.searchParams.get('url') || href;
    if (u.hostname === 'duckduckgo.com' && u.pathname.startsWith('/l/')) return decodeURIComponent(u.searchParams.get('uddg') || href);
    if (u.hostname === 'www.bing.com' && u.pathname.startsWith('/ck/')) {
      const raw = u.searchParams.get('u') || '';
      if (raw.startsWith('a1')) {
        try { return atob(raw.slice(2).replace(/-/g, '+').replace(/_/g, '/')); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return href;
}

export function filterLinks(hrefs, baseUrl, limit = 150) {
  const out = new Set();
  for (const h of hrefs || []) {
    const clean = sanitizeLink(unwrapRedirect(h), baseUrl);
    if (clean && clean !== baseUrl) out.add(clean);
    if (out.size >= limit) break;
  }
  return [...out];
}

// ---------------------------------------------------------------- queue / hops

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/**
 * Decide where to go next.
 * Returns { kind: 'seed'|'link', url, engine?, keyword?, avatar? } and the updated queue/hops.
 */
export function decideNext(state, settings, rnd = Math.random) {
  const queue = [...(state.queue || [])];
  const hops = { ...(state.domainHops || { host: null, count: 0 }) };

  // Prefer links that leave the current site once we hopped around enough.
  let candidates = queue;
  if (hops.host && hops.count >= settings.maxHopsPerDomain) {
    const other = queue.filter(u => hostOf(u) !== hops.host);
    if (other.length) candidates = other;
  }

  // Occasionally start a fresh search even if links are available (keeps the profile "searchy").
  const wantSeed = !candidates.length || rnd() < 0.15;
  if (wantSeed) {
    const { avatar, keyword } = pickKeyword(state.avatars, rnd);
    const engine = pickEngine(settings, rnd);
    return {
      next: { kind: 'seed', url: buildSeedUrl(engine, keyword), engine, keyword, avatar },
      queue: [],                               // a new topic: forget old links
      domainHops: { host: null, count: 0 },
    };
  }

  const url = pick(candidates, rnd);
  const rest = queue.filter(u => u !== url);
  const host = hostOf(url);
  const nextHops = host === hops.host ? { host, count: hops.count + 1 } : { host, count: 1 };
  return { next: { kind: 'link', url }, queue: rest, domainHops: nextHops };
}

export function mergeQueue(queue, links, limit) {
  const set = new Set([...(queue || []), ...(links || [])]);
  const arr = [...set];
  return arr.length > limit ? arr.slice(arr.length - limit) : arr;
}

// ---------------------------------------------------------------- stats

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function recordVisit(stats, visit, now = new Date()) {
  const s = { ...DEFAULT_STATE.stats, ...(stats || {}), perAvatar: { ...(stats?.perAvatar || {}) }, perEngine: { ...(stats?.perEngine || {}) } };
  const key = todayKey(now);
  if (s.dateKey !== key) { s.dateKey = key; s.today = 0; }
  s.total += 1;
  s.today += 1;
  if (visit.avatar) { s.perAvatar[visit.avatar] = (s.perAvatar[visit.avatar] || 0) + 1; s.lastAvatar = visit.avatar; }
  if (visit.engine) s.perEngine[visit.engine] = (s.perEngine[visit.engine] || 0) + 1;
  if (visit.keyword) s.lastKeyword = visit.keyword;
  s.recent = [{ url: visit.url, keyword: visit.keyword || s.lastKeyword, avatar: visit.avatar || s.lastAvatar, at: now.getTime() }, ...(s.recent || [])].slice(0, 5);
  return s;
}

export function dailyLimitReached(stats, settings, now = new Date()) {
  if (!stats || stats.dateKey !== todayKey(now)) return false;
  return stats.today >= settings.dailyLimit;
}
