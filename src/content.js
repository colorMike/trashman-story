// Runs on every page but only acts inside the Trashman tab.
(() => {
  if (window.top !== window) return;
  const api = typeof browser !== 'undefined' ? browser : chrome;

  function send(msg) {
    return new Promise(resolve => {
      try { api.runtime.sendMessage(msg, r => resolve(r)); } catch { resolve(null); }
    });
  }

  function collectLinks() {
    const hrefs = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (h && !h.startsWith('#') && !h.startsWith('javascript:')) hrefs.push(a.href);
    });
    return hrefs;
  }

  function overlay(info) {
    if (document.getElementById('trashman-overlay')) return;
    const box = document.createElement('div');
    box.id = 'trashman-overlay';
    const sack = document.createElement('img');
    sack.src = api.runtime.getURL('images/icon/sack.png');
    sack.alt = '';
    const txt = document.createElement('div');
    txt.className = 'trashman-text';
    txt.innerHTML = '<strong>TRASHMAN STORY</strong><span>is feeding the datakraken on this tab</span>' +
      (info.keyword ? `<em>${escapeHtml(info.keyword)}</em>` : '');
    box.append(sack, txt);
    (document.body || document.documentElement).append(box);
    document.title = 'TRASHMAN STORY – ' + document.title;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // A few lazy scrolls so the page looks "read" and lazy-loaded trackers fire.
  function simulateReading() {
    const steps = 3 + Math.floor(Math.random() * 5);
    let i = 0;
    const step = () => {
      if (i++ >= steps) return;
      window.scrollBy({ top: 200 + Math.random() * 500, behavior: 'smooth' });
      setTimeout(step, 800 + Math.random() * 2500);
    };
    setTimeout(step, 1200 + Math.random() * 1500);
  }

  async function harvest() {
    const links = collectLinks();
    await send({ type: 'linksHarvested', links, pageUrl: location.href });
  }

  async function main() {
    const r = await send({ type: 'isTrashmanTab' });
    if (!r || !r.yes) return;
    overlay(r);
    simulateReading();
    setTimeout(harvest, 1500);
    setTimeout(harvest, 6000);   // second pass catches AJAX-loaded results
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
