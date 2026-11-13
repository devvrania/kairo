import * as THREE from 'three';
import { mat, box, canvasTexture } from '../helpers.js';

/**
 * Walls, a shelf, and a window onto a snowy night city.
 * @returns the window's world position and an updater for the falling snow
 */
export function buildRoom(scene, layout) {
  const wallMat = mat('#161b27', 0.95);
  const wx = layout.hipX + 1.7;   // the wall behind him in the camera's view
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), wallMat);
  wall.position.set(wx, 1.6, layout.hipZ);
  wall.rotation.y = -Math.PI / 2;
  wall.receiveShadow = true;
  scene.add(wall);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), wallMat);
  back.position.set(layout.hipX, 1.6, layout.hipZ - 1.4);
  back.receiveShadow = true;
  scene.add(back);

  // window
  const view = createCityView();
  const winW = 1.5, winH = 0.94, wy = layout.deskTop + 0.75, wz = layout.hipZ + 0.25;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshBasicMaterial({ map: view.texture, toneMapped: false }));
  win.position.set(wx - 0.01, wy, wz);
  win.rotation.y = -Math.PI / 2;
  scene.add(win);

  const frame = mat('#2a303d', 0.6);
  for (const dz of [-winW / 2, 0, winW / 2]) box(scene, 0.04, winH + 0.1, 0.05, frame, wx - 0.02, wy, wz + dz);
  box(scene, 0.04, 0.05, winW + 0.1, frame, wx - 0.02, wy + winH / 2 + 0.02, wz);
  box(scene, 0.12, 0.04, winW + 0.16, frame, wx - 0.06, wy - winH / 2 - 0.02, wz);   // sill
  const moonlight = new THREE.PointLight('#a9c4ff', 0.9, 3);
  moonlight.position.set(wx - 0.4, wy, wz);
  scene.add(moonlight);

  // shelf with books, for depth
  box(scene, 0.5, 0.02, 0.18, frame, wx - 0.1, wy + 0.85, layout.hipZ - 0.75).rotation.y = Math.PI / 2;
  ['#c9404a', '#3b4357', '#5e6a82', '#2a2f3c'].forEach((c, i) =>
    box(scene, 0.12, 0.16 + (i % 2) * 0.04, 0.03, mat(c, 0.8), wx - 0.1, wy + 0.94 + (i % 2) * 0.02, layout.hipZ - 0.92 + i * 0.04));

  return { windowCenter: win.position.clone(), update: view.update };
}

/** Skyline painted once, with snow drawn over it every frame. */
function createCityView() {
  const { ctx, texture } = canvasTexture(1024, 640);
  const skyline = paintSkyline();
  const flakes = Array.from({ length: 220 }, () => ({
    x: Math.random() * 1024, y: Math.random() * 640, r: 0.8 + Math.random() * 2.6, s: 18 + Math.random() * 45, d: Math.random() * 6,
  }));

  return {
    texture,
    update(dt, t) {
      ctx.drawImage(skyline, 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (const f of flakes) {
        f.y += f.s * dt * (f.r / 2);
        f.x += Math.sin(t * 0.8 + f.d) * 0.3;
        if (f.y > 645) { f.y = -5; f.x = Math.random() * 1024; }
        ctx.globalAlpha = 0.35 + f.r / 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      texture.needsUpdate = true;
    },
  };
}

function paintSkyline() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 640;
  const c = canvas.getContext('2d');
  const sky = c.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, '#1a2236'); sky.addColorStop(0.6, '#2b3550'); sky.addColorStop(1, '#4a4f66');
  c.fillStyle = sky; c.fillRect(0, 0, 1024, 640);

  let seed = 7;   // fixed seed: the same skyline every time
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [color, minH, lit] of [['#232b40', 0.55, 0.55], ['#171d2d', 0.35, 0.8]]) {
    let x = -20;
    while (x < 1040) {
      const w = 50 + rnd() * 90, h = 640 * (minH * 0.5 + rnd() * minH * 0.7);
      c.fillStyle = color; c.fillRect(x, 640 - h, w, h);
      for (let wy = 640 - h + 12; wy < 630; wy += 16) for (let wx = x + 8; wx < x + w - 8; wx += 14) {
        if (rnd() < 0.28 * lit) { c.fillStyle = rnd() < 0.85 ? 'rgba(255,214,150,.75)' : 'rgba(255,90,95,.8)'; c.fillRect(wx, wy, 6, 8); }
      }
      c.fillStyle = 'rgba(235,242,255,.85)'; c.fillRect(x, 640 - h - 3, w, 4);   // snow on the rooftops
      x += w + 6;
    }
  }
  c.fillStyle = 'rgba(235,242,255,.9)'; c.fillRect(0, 610, 1024, 30);
  return canvas;
}
