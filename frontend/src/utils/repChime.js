/** Short ascending chime when a rep completes (Web Audio API). */

let sharedCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

export function playRepChime() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    const t0 = ctx.currentTime;
    o.frequency.setValueAtTime(392, t0);
    o.frequency.exponentialRampToValueAtTime(587.33, t0 + 0.07);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.start(t0);
    o.stop(t0 + 0.2);
  } catch {
    /* ignore */
  }
}
