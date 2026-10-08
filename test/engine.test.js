import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, DEFAULT_STATE, nextDelayMs, pickKeyword, buildSeedUrl, pickEngine,
  sanitizeLink, unwrapRedirect, filterLinks, decideNext, mergeQueue, recordVisit, dailyLimitReached, todayKey,
} from '../src/lib/engine.js';
import { AVATARS } from '../src/data/avatars.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('every avatar has keywords and a sprite animation', () => {
  for (const a of AVATARS) {
    assert.ok(a.keywords.length >= 3, `${a.id} has only ${a.keywords.length} keywords`);
    assert.ok(a.idle.length > 0, `${a.id} has no idle animation`);
    for (const w of a.keywords) assert.ok(!/[�]/.test(w), `${a.id}: broken encoding in "${w}"`);
  }
});

test('nextDelayMs stays inside the configured window', () => {
  const s = { ...DEFAULT_SETTINGS, minDelaySec: 10, maxDelaySec: 100 };
  for (let i = 0; i < 500; i++) {
    const ms = nextDelayMs(s);
    assert.ok(ms >= 10000 && ms <= 100000, `delay ${ms} out of range`);
  }
  assert.equal(nextDelayMs(s, () => 0), 10000);
  assert.equal(nextDelayMs(s, () => 1), 100000);
});

test('pickKeyword only draws from the selected avatars', () => {
  for (let i = 0; i < 200; i++) {
    const { avatar, keyword } = pickKeyword(['Nerd', 'Cook']);
    assert.ok(['Nerd', 'Cook'].includes(avatar));
    assert.ok(AVATARS.find(a => a.id === avatar).keywords.includes(keyword));
  }
  assert.deepEqual(pickKeyword([]), { avatar: 'Base', keyword: 'trashmanstory' });
  assert.deepEqual(pickKeyword(['DoesNotExist']), { avatar: 'Base', keyword: 'trashmanstory' });
});

test('seed urls are encoded and engines respect settings', () => {
  assert.equal(buildSeedUrl('google', 'lederhosen kaufen'), 'https://www.google.com/search?q=lederhosen%20kaufen');
  assert.equal(buildSeedUrl('amazon', 'dirndl & co'), 'https://www.amazon.de/s?k=dirndl%20%26%20co');
  assert.equal(buildSeedUrl('nope', 'x'), 'https://www.google.com/search?q=x');
  for (let i = 0; i < 50; i++) assert.equal(pickEngine({ engines: ['ebay'] }), 'ebay');
  assert.ok(pickEngine({ engines: ['bogus'] }));
});

test('sanitizeLink rejects dangerous or useless links', () => {
  const base = 'https://example.com/page';
  assert.equal(sanitizeLink('/shop/lederhosen', base), 'https://example.com/shop/lederhosen');
  assert.equal(sanitizeLink('https://example.com/a#frag', base), 'https://example.com/a');
  assert.equal(sanitizeLink('mailto:x@y.z', base), null);
  assert.equal(sanitizeLink('javascript:void(0)', base), null);
  assert.equal(sanitizeLink('https://example.com/logout', base), null);
  assert.equal(sanitizeLink('https://example.com/warenkorb', base), null);
  assert.equal(sanitizeLink('https://example.com/checkout?x=1', base), null);
  assert.equal(sanitizeLink('https://example.com/img.jpg', base), null);
  assert.equal(sanitizeLink('https://example.com/file.pdf?x', base), null);
  assert.equal(sanitizeLink('https://www.google.com/search?q=a', base), null);
  assert.equal(sanitizeLink('https://accounts.google.com/x', base), null);
  assert.equal(sanitizeLink('https://facebook.com/x', base), null);
  assert.equal(sanitizeLink('http://localhost:3000/', base), null);
  assert.equal(sanitizeLink('http://192.168.0.1/', base), null);
  assert.equal(sanitizeLink('http://intranet/', base), null);
  assert.equal(sanitizeLink('https://user:pw@example.com/', base), null);
  assert.equal(sanitizeLink('https://www.ebay.com/', base), null);
  assert.equal(sanitizeLink('https://go.microsoft.com/fwlink/?linkid=1', base), null);
  assert.equal(sanitizeLink('https://shop.de/?q=x', base), 'https://shop.de/?q=x');
});

test('unwrapRedirect decodes search engine redirects', () => {
  assert.equal(unwrapRedirect('https://www.google.com/url?q=https://shop.de/a&sa=U'), 'https://shop.de/a');
  assert.equal(unwrapRedirect('https://duckduckgo.com/l/?uddg=https%3A%2F%2Fshop.de%2Fb&rut=1'), 'https://shop.de/b');
  const b64 = Buffer.from('https://shop.de/c').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(unwrapRedirect('https://www.bing.com/ck/a?u=a1' + b64), 'https://shop.de/c');
  assert.equal(unwrapRedirect('https://shop.de/d'), 'https://shop.de/d');
});

test('filterLinks dedupes, drops the page itself and respects the limit', () => {
  const base = 'https://example.com/';
  const links = ['https://example.com/', '/a', '/a', '/b', 'https://other.org/c', '/logout', 'https://other.org/'];
  assert.deepEqual(filterLinks(links, base), ['https://example.com/a', 'https://example.com/b', 'https://other.org/c']);
  assert.equal(filterLinks(links, base, 2).length, 2);
});

test('decideNext seeds a search when the queue is empty', () => {
  const state = { ...DEFAULT_STATE, avatars: ['Bavaria'], queue: [] };
  const r = decideNext(state, DEFAULT_SETTINGS, () => 0.5);
  assert.equal(r.next.kind, 'seed');
  assert.equal(r.next.avatar, 'Bavaria');
  assert.ok(r.next.url.includes(encodeURIComponent(r.next.keyword)));
  assert.deepEqual(r.queue, []);
});

test('decideNext follows links and counts hops per domain', () => {
  const state = { ...DEFAULT_STATE, queue: ['https://a.de/1', 'https://a.de/2'], domainHops: { host: 'a.de', count: 1 } };
  const r = decideNext(state, DEFAULT_SETTINGS, seq(0.9, 0));   // 0.9 => no seed, 0 => first candidate
  assert.equal(r.next.kind, 'link');
  assert.equal(r.next.url, 'https://a.de/1');
  assert.deepEqual(r.domainHops, { host: 'a.de', count: 2 });
  assert.deepEqual(r.queue, ['https://a.de/2']);
});

test('decideNext prefers leaving a domain after maxHopsPerDomain', () => {
  const state = { ...DEFAULT_STATE, queue: ['https://a.de/1', 'https://a.de/2', 'https://b.de/1'], domainHops: { host: 'a.de', count: 3 } };
  for (let i = 0; i < 20; i++) {
    const r = decideNext(state, DEFAULT_SETTINGS, seq(0.9, Math.random()));
    assert.equal(r.next.url, 'https://b.de/1');
  }
});

test('mergeQueue keeps the newest links within the limit', () => {
  assert.deepEqual(mergeQueue(['a', 'b'], ['b', 'c'], 10), ['a', 'b', 'c']);
  assert.deepEqual(mergeQueue(['a', 'b'], ['c', 'd'], 3), ['b', 'c', 'd']);
});

test('recordVisit counts per day, per avatar and keeps 5 recent', () => {
  let s = DEFAULT_STATE.stats;
  const d1 = new Date(2026, 9, 8, 10);
  for (let i = 0; i < 7; i++) s = recordVisit(s, { url: 'https://x.de/' + i, avatar: 'Nerd', keyword: 'k', engine: 'google' }, d1);
  assert.equal(s.total, 7); assert.equal(s.today, 7); assert.equal(s.perAvatar.Nerd, 7); assert.equal(s.perEngine.google, 7);
  assert.equal(s.recent.length, 5); assert.equal(s.recent[0].url, 'https://x.de/6');
  const d2 = new Date(2026, 9, 9, 10);
  s = recordVisit(s, { url: 'https://y.de', avatar: 'Cook' }, d2);
  assert.equal(s.total, 8); assert.equal(s.today, 1); assert.equal(s.dateKey, todayKey(d2));
  assert.ok(dailyLimitReached({ ...s, today: 800 }, DEFAULT_SETTINGS, d2));
  assert.ok(!dailyLimitReached({ ...s, today: 800 }, DEFAULT_SETTINGS, new Date(2026, 9, 10)));
});
