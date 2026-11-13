import { canvasTexture } from '../helpers.js';

/** Keycaps drawn on a canvas. A pressed key flashes red and fades. */
export function createKeycaps() {
  const { ctx, texture } = canvasTexture(840, 260);
  const keys = [];
  const kw = 56, kh = 46, gap = 4, x0 = 12, y0 = 12;
  [14, 14, 13, 12].forEach((count, row) => {
    for (let i = 0; i < count; i++) keys.push({ x: x0 + row * 10 + i * (kw + gap), y: y0 + row * (kh + gap), w: kw, h: kh, glow: 0 });
  });
  keys.push({ x: x0 + 3.5 * (kw + gap), y: y0 + 4 * (kh + gap), w: 6.5 * (kw + gap) - gap, h: kh, glow: 0 }); // space bar

  function draw() {
    ctx.fillStyle = '#1b1f29'; ctx.fillRect(0, 0, 840, 260);
    for (const k of keys) {
      const g = k.glow;
      ctx.fillStyle = g > 0.02 ? `rgb(${Math.round(70 + 185 * g)},${Math.round(76 + 14 * g)},${Math.round(92 - 3 * g)})` : '#464c5c';
      ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(k.x + 5, k.y + 4, k.w - 10, 3);  // keycap highlight
    }
    texture.needsUpdate = true;
  }
  draw();

  return {
    texture,
    flash() { keys[Math.floor(Math.random() * keys.length)].glow = 1; },
    update(dt) {
      let lit = false;
      for (const k of keys) if (k.glow > 0) { k.glow = Math.max(0, k.glow - dt * 4); lit = true; }
      if (lit) draw();
    },
  };
}
