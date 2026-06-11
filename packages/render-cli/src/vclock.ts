/**
 * Virtual clock shim, injected via page.addInitScript BEFORE any page script
 * runs. Replaces the browser's timing APIs so time only moves when the
 * capture harness calls __vclock.advanceTo(ms) — determinism applied from the
 * outside, to arbitrary page content (the Replit "browsers don't want to be
 * cameras" approach).
 *
 * Covers: Date.now, performance.now, requestAnimationFrame, setTimeout,
 * setInterval. Does NOT cover CSS animations/transitions (compositor clock) —
 * page content must drive all motion from JS.
 */

export const VCLOCK_SOURCE = String.raw`
(() => {
  let now = 0;
  let nextId = 1;
  let rafQueue = [];
  const timers = [];

  Date.now = () => now;
  performance.now = () => now;

  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    rafQueue.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    rafQueue = rafQueue.filter((r) => r.id !== id);
  };

  const addTimer = (cb, delay, args, interval) => {
    const id = nextId++;
    timers.push({
      id,
      cb: () => cb(...args),
      due: now + Math.max(Number(delay) || 0, 0),
      interval: interval ? Math.max(Number(delay) || 0, 1) : undefined,
    });
    return id;
  };
  const removeTimer = (id) => {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  };
  window.setTimeout = (cb, delay = 0, ...args) =>
    typeof cb === "function" ? addTimer(cb, delay, args, false) : 0;
  window.setInterval = (cb, delay = 0, ...args) =>
    typeof cb === "function" ? addTimer(cb, delay, args, true) : 0;
  window.clearTimeout = removeTimer;
  window.clearInterval = removeTimer;

  window.__vclock = {
    now: () => now,
    advanceTo(targetMs) {
      // Fire due timers in order, letting fired callbacks schedule new ones.
      for (;;) {
        timers.sort((a, b) => a.due - b.due);
        const next = timers[0];
        if (!next || next.due > targetMs) break;
        now = next.due;
        if (next.interval !== undefined) next.due += next.interval;
        else timers.shift();
        next.cb();
      }
      now = targetMs;
      // One rAF batch per frame; callbacks registered during the batch run
      // on the next advanceTo (matching real browser semantics).
      const batch = rafQueue;
      rafQueue = [];
      for (const { cb } of batch) cb(now);
    },
  };
})();
`;
