import { canvasTexture } from '../helpers.js';

const CODE = [
  "import { useState } from 'react';",
  '',
  'export function Portfolio() {',
  "  const [mode, setMode] = useState('desk');",
  '  const projects = usePinnedRepos();',
  '',
  '  return (',
  '    <Scene camera={cozyAngle}>',
  '      <Desk>',
  '        <Avatar lookAt={cursor} />',
  '        <Monitor>{projects.map(Card)}</Monitor>',
  '      </Desk>',
  '    </Scene>',
  '  );',
  '}',
];
const LINE_COLORS = ['#ff6b6f', '#e6edf7', '#7fb4ff', '#9aa6b8'];
const TOTAL = CODE.join('\n').length + 40;   // a short pause on the finished file, then it starts over

/** The code editor on his monitor. Each key he presses types one more character. */
export function createCodeScreen() {
  const { ctx, texture } = canvasTexture(1024, 576);
  let typed = 0;

  function draw() {
    ctx.fillStyle = '#0f131c'; ctx.fillRect(0, 0, 1024, 576);
    ctx.fillStyle = '#171c27'; ctx.fillRect(0, 0, 1024, 40);
    ['#ff5a5f', '#f5c76a', '#6fcf97'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(24 + i * 22, 20, 7, 0, 7); ctx.fill(); });
    ctx.font = '24px Menlo, ui-monospace, monospace';
    let left = typed, y = 84, cursorX = 40, cursorY = 84;
    CODE.forEach((line, i) => {
      if (left < 0) return;
      const shown = line.slice(0, Math.max(0, left));
      ctx.fillStyle = '#4a5468'; ctx.fillText(String(i + 1).padStart(2, ' '), 14, y);
      ctx.fillStyle = LINE_COLORS[i % 4]; ctx.fillText(shown, 62, y);
      cursorX = 62 + ctx.measureText(shown).width; cursorY = y;
      left -= line.length + 1; y += 32;
    });
    if (Math.floor(performance.now() / 500) % 2) { ctx.fillStyle = '#ff5a5f'; ctx.fillRect(cursorX + 2, cursorY - 20, 12, 26); }
    texture.needsUpdate = true;
  }

  return {
    texture,
    typeChar() { typed = (typed + 1) % TOTAL; },
    draw,
  };
}
