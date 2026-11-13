import * as THREE from 'three';
import { mat, box, addMesh } from '../helpers.js';

const MONITOR_TURN = 0.6;   // ~35° toward the camera, so visitors can see the code he types

/**
 * Desk, keyboard, mouse, lamp and monitor, placed around his hands.
 * @returns the monitor's world position (he looks there while working)
 */
export function buildDesk(scene, layout, { keycaps, screen }) {
  const wood = mat('#3a3330', 0.7), soft = mat('#2a2e38', 0.85), dark = mat('#14171f', 0.45), pole = mat('#5d6371', 0.35);
  const top = layout.deskTop, front = layout.deskFront, cx = layout.centerX, depth = 0.72, w = 1.5;

  // desk
  box(scene, w, 0.035, depth, wood, cx, top - 0.0175, front + depth / 2);
  for (const sx of [-1, 1]) box(scene, 0.04, top - 0.035, depth - 0.06, wood, cx + sx * (w / 2 - 0.04), (top - 0.035) / 2, front + depth / 2);
  box(scene, w - 0.1, 0.25, 0.02, wood, cx, top - 0.16, front + depth - 0.04);

  // keyboard with lit keycaps, mouse, desk mat
  const kb = mat('#2c3240', 0.45);
  box(scene, 0.44, 0.02, 0.15, kb, layout.kbX, top + 0.01, layout.kbZ);
  const caps = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13),
    new THREE.MeshStandardMaterial({ map: keycaps.texture, emissiveMap: keycaps.texture, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.6 }));
  caps.rotation.x = -Math.PI / 2;
  caps.position.set(layout.kbX, top + 0.0205, layout.kbZ);
  scene.add(caps);
  const underglow = new THREE.PointLight('#ff6b6f', 0.35, 0.35);   // soft red glow on his fingers
  underglow.position.set(layout.kbX, top + 0.06, layout.kbZ);
  scene.add(underglow);
  box(scene, 0.06, 0.02, 0.1, kb, layout.kbX + 0.33, top + 0.01, layout.kbZ + 0.02);
  box(scene, 0.62, 0.003, 0.36, mat('#12151d', 0.95), layout.kbX + 0.08, top + 0.0015, layout.kbZ + 0.02);

  // desk lamp: warm pool of light. No shadow: three-vrm 3.1's toon shader fails to compile with spotlight shadows on three r169.
  const lampX = cx + 0.58, lampZ = front + 0.5;
  box(scene, 0.12, 0.015, 0.12, dark, lampX, top + 0.008, lampZ);
  box(scene, 0.015, 0.42, 0.015, pole, lampX, top + 0.21, lampZ).rotation.z = 0.25;
  const shade = addMesh(scene, new THREE.ConeGeometry(0.07, 0.1, 24, 1, true), mat('#2b2f3a', 0.6), lampX - 0.1, top + 0.42, lampZ - 0.02);
  shade.rotation.z = 0.6;
  const lamp = new THREE.SpotLight('#ffb978', 3.2, 2.2, 0.75, 0.6, 1.5);
  lamp.position.copy(shade.position);
  lamp.target.position.set(cx + 0.05, top, front + 0.2);
  scene.add(lamp, lamp.target);

  // monitor, angled toward the camera
  const mz = front + 0.52, my = top + 0.33;
  const mon = new THREE.Group();
  mon.position.set(cx, top, mz + 0.03);
  mon.rotation.y = MONITOR_TURN;
  scene.add(mon);
  box(mon, 0.06, 0.2, 0.04, soft, 0, 0.1, 0);
  box(mon, 0.24, 0.01, 0.16, soft, 0, 0.005, 0);
  box(mon, 0.74, 0.44, 0.03, dark, 0, my - top, -0.03);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.394), new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false }));
  display.position.set(0, my - top, -0.0455);
  display.rotation.y = Math.PI;
  mon.add(display);
  mon.updateMatrixWorld(true);
  const monitorCenter = display.getWorldPosition(new THREE.Vector3());

  const glow = new THREE.PointLight('#9cc4ff', 1.4, 1.8);   // monitor light on his face
  glow.position.copy(monitorCenter).add(new THREE.Vector3(0, 0, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), MONITOR_TURN));
  scene.add(glow);

  return monitorCenter;
}
