// Tiny sprite animator for the 2-frame idle animations of the Trashman avatars.
import { AVATAR_MAP } from '../data/avatars.js';

const api = typeof browser !== 'undefined' ? browser : chrome;
const timers = new WeakMap();

export function spriteUrl(avatarId, slot) {
  return api.runtime.getURL(`images/avatars/${avatarId}/${slot}/sprites.png`);
}

export function showFrame(el, frame, size = 200) {
  el.style.backgroundPosition = `0 -${frame * size}px`;
}

export function animate(el, avatarId, slot = 0, size = 200) {
  stop(el);
  const avatar = AVATAR_MAP[avatarId];
  if (!avatar) return;
  el.style.backgroundImage = `url("${spriteUrl(avatarId, slot)}")`;
  el.style.backgroundSize = `${size}px auto`;
  const frames = avatar.idle && avatar.idle.length ? avatar.idle : [[0, 1000]];
  let i = 0;
  const step = () => {
    const [frame, duration] = frames[i % frames.length];
    showFrame(el, frame, size);
    i++;
    timers.set(el, setTimeout(step, duration));
  };
  step();
}

export function still(el, avatarId, slot = 0, size = 70) {
  stop(el);
  el.style.backgroundImage = `url("${spriteUrl(avatarId, slot)}")`;
  el.style.backgroundSize = `${size}px auto`;
  showFrame(el, 0, size);
}

export function stop(el) {
  const t = timers.get(el);
  if (t) clearTimeout(t);
  timers.delete(el);
}
