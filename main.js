import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, VRMSpringBoneCollider, VRMSpringBoneColliderShapePlane } from '@pixiv/three-vrm';

const MODEL_URL = './model/kairo.vrm';
const PROFILE = await fetch('./kairo.json').then(r => r.json());
const DEG = Math.PI / 180;

/* ---------- renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d111b');
scene.fog = new THREE.Fog('#0d111b', 5, 12);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false;

scene.add(new THREE.HemisphereLight('#9fb4dc', '#1a1d29', 0.9));
const key = new THREE.DirectionalLight('#cfe0ff', 1.5);   // cool moonlight from the window side
key.position.set(2.5, 3, -1.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2; key.shadow.camera.bottom = -2;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight('#ff5a5f', 0.9);   // red accent rim, matches his eyes and drawstrings
rim.position.set(-1.5, 2.2, -2.5);
scene.add(rim);
const fill = new THREE.DirectionalLight('#ffd9b8', 0.55); // soft warm fill on the face from the camera side
fill.position.set(-2.5, 1.8, 1.5);
scene.add(fill);

const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ color: '#1b1f2b', roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* ---------- helpers ---------- */
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const worldQ = o => o.getWorldQuaternion(new THREE.Quaternion());
const worldP = o => o.getWorldPosition(new THREE.Vector3());

let vrm, B;
const restWorld = new Map();
const baseLocal = new Map();

function setWorldQ(bone, desired) {
  vrm.scene.updateMatrixWorld(true);
  bone.quaternion.copy(worldQ(bone.parent).invert().multiply(desired));
  bone.updateMatrixWorld(true);
}
/* Point a bone (given its T-pose direction in world space) along a world direction. */
function aim(name, restDir, target) {
  const b = B(name); if (!b) return null;
  const arc = new THREE.Quaternion().setFromUnitVectors(restDir.clone().normalize(), target.clone().normalize());
  setWorldQ(b, arc.clone().multiply(restWorld.get(name)));
  return arc;
}
/* Rotate a bone around a world axis, on top of its current pose. */
function rotWorld(name, axis, angle) {
  const b = B(name); if (!b) return;
  vrm.scene.updateMatrixWorld(true);
  setWorldQ(b, new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(worldQ(b)));
}
/* Precompute a world axis expressed in the bone's base local frame, for cheap per-frame deltas. */
function localAxis(name, axisWorld) {
  const b = B(name); if (!b) return null;
  vrm.scene.updateMatrixWorld(true);
  return axisWorld.clone().applyQuaternion(worldQ(b).invert()).normalize();
}
const _dq = new THREE.Quaternion();
function addDelta(name, axLocal, angle) {
  const b = B(name); if (!b || !axLocal) return;
  b.quaternion.multiply(_dq.setFromAxisAngle(axLocal, angle));
}

/* ---------- seated typing pose ----------
   World frame after rotateVRM0: she faces +Z, her left is +X. */
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
const SEG = ['Proximal', 'Intermediate', 'Distal'];
const curlAxis = {};

function buildPose() {
  vrm.humanoid.resetNormalizedPose();
  vrm.scene.updateMatrixWorld(true);
  for (const name of Object.keys(vrm.humanoid.humanBones)) {
    const b = B(name); if (b) restWorld.set(name, worldQ(b));
  }

  aim('spine', v3(0, 1, 0), v3(0, 1, 0.06));
  aim('chest', v3(0, 1, 0), v3(0, 1, 0.1));

  for (const s of [1, -1]) {
    const L = s === 1 ? 'left' : 'right';
    aim(`${L}UpperLeg`, v3(0, -1, 0), v3(0.07 * s, -0.08, 1));
    aim(`${L}LowerLeg`, v3(0, -1, 0), v3(0.02 * s, -1, 0.06));
    aim(`${L}Foot`, v3(0, -0.3, 1), v3(0, -0.25, 1));

    aim(`${L}Shoulder`, v3(s, 0, 0), v3(s, -0.08, 0.05));
    aim(`${L}UpperArm`, v3(s, 0, 0), v3(0.2 * s, -0.78, 0.5));
    aim(`${L}LowerArm`, v3(s, 0, 0), v3(-0.3 * s, 0.02, 1));
    const handArc = aim(`${L}Hand`, v3(s, 0, 0), v3(-0.14 * s, -0.22, 1));

    const handDir = v3(-0.14 * s, -0.22, 1).normalize();
    const palm = v3(0, -1, 0).applyQuaternion(handArc);
    const axis = new THREE.Vector3().crossVectors(handDir, palm).normalize();
    curlAxis[L] = axis;
    FINGERS.forEach((f, i) => SEG.forEach((g, j) => rotWorld(`${L}${f}${g}`, axis, [0.22, 0.3, 0.2][j] + i * 0.05)));
    rotWorld(`${L}ThumbProximal`, axis, 0.15);
    rotWorld(`${L}ThumbIntermediate`, axis, 0.25);
  }
  vrm.scene.updateMatrixWorld(true);
}

/* ---------- desk set ---------- */
const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
function box(w, h, d, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o;
}

const codeCanvas = document.createElement('canvas');
codeCanvas.width = 1024; codeCanvas.height = 576;
const cctx = codeCanvas.getContext('2d');
const screenTex = new THREE.CanvasTexture(codeCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
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
let typed = 0;
const COLORS = ['#ff6b6f', '#e6edf7', '#7fb4ff', '#9aa6b8'];
function drawCode() {
  cctx.fillStyle = '#0f131c'; cctx.fillRect(0, 0, 1024, 576);
  cctx.fillStyle = '#171c27'; cctx.fillRect(0, 0, 1024, 40);
  ['#ff5a5f', '#f5c76a', '#6fcf97'].forEach((c, i) => { cctx.fillStyle = c; cctx.beginPath(); cctx.arc(24 + i * 22, 20, 7, 0, 7); cctx.fill(); });
  cctx.font = '24px Menlo, ui-monospace, monospace';
  let left = typed, y = 84, lastX = 40, lastY = 84;
  CODE.forEach((line, i) => {
    if (left < 0) return;
    const shown = line.slice(0, Math.max(0, left));
    cctx.fillStyle = '#4a5468'; cctx.fillText(String(i + 1).padStart(2, ' '), 14, y);
    cctx.fillStyle = COLORS[i % 4]; cctx.fillText(shown, 62, y);
    lastX = 62 + cctx.measureText(shown).width; lastY = y;
    left -= line.length + 1; y += 32;
  });
  if (Math.floor(performance.now() / 500) % 2) { cctx.fillStyle = '#ff5a5f'; cctx.fillRect(lastX + 2, lastY - 20, 12, 26); }
  screenTex.needsUpdate = true;
}

let monitorCenter = new THREE.Vector3();
const windowCenter = new THREE.Vector3();
function buildDesk(m) {
  const wood = mat('#3a3330', 0.7), soft = mat('#2a2e38', 0.85), dark = mat('#14171f', 0.45), pole = mat('#5d6371', 0.35);
  const top = m.deskTop, front = m.deskFront, cx = m.centerX, depth = 0.72, w = 1.5;
  box(w, 0.035, depth, wood, cx, top - 0.0175, front + depth / 2);
  for (const sx of [-1, 1]) box(0.04, top - 0.035, depth - 0.06, wood, cx + sx * (w / 2 - 0.04), (top - 0.035) / 2, front + depth / 2);
  box(w - 0.1, 0.25, 0.02, wood, cx, top - 0.16, front + depth - 0.04);

  // keyboard + mouse
  box(0.42, 0.02, 0.14, mat('#1d212b', 0.5), m.kbX, top + 0.01, m.kbZ);
  const keyGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), new THREE.MeshBasicMaterial({ color: '#ff5a5f', transparent: true, opacity: 0.18 }));
  keyGlow.rotation.x = -Math.PI / 2; keyGlow.position.set(m.kbX, top + 0.021, m.kbZ); scene.add(keyGlow);
  box(0.06, 0.02, 0.1, mat('#1d212b', 0.5), m.kbX + 0.33, top + 0.01, m.kbZ + 0.02);
  box(0.62, 0.003, 0.36, mat('#12151d', 0.95), m.kbX + 0.08, top + 0.0015, m.kbZ + 0.02); // desk mat

  // desk lamp: warm pool of light on the desk
  const lampX = cx + 0.58, lampZ = front + 0.5;
  box(0.12, 0.015, 0.12, dark, lampX, top + 0.008, lampZ);
  const arm = box(0.015, 0.42, 0.015, pole, lampX, top + 0.21, lampZ); arm.rotation.z = 0.25;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 24, 1, true), mat('#2b2f3a', 0.6));
  shade.position.set(lampX - 0.1, top + 0.42, lampZ - 0.02); shade.rotation.z = 0.6; scene.add(shade);
  const lamp = new THREE.SpotLight('#ffb978', 3.2, 2.2, 0.75, 0.6, 1.5);
  lamp.position.copy(shade.position); lamp.target.position.set(cx + 0.05, top, front + 0.2);
  // No shadow on the spotlight: three-vrm 3.1's MToon shader fails to compile with spot-light shadows on three r169.
  scene.add(lamp, lamp.target);

  // monitor
  const mz = front + 0.52, my = top + 0.33;
  box(0.06, 0.2, 0.04, soft, cx, top + 0.1, mz + 0.03);
  box(0.24, 0.01, 0.16, soft, cx, top + 0.005, mz + 0.03);
  box(0.74, 0.44, 0.03, dark, cx, my, mz);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.394), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(cx, my, mz - 0.0155); screen.rotation.y = Math.PI; scene.add(screen);
  monitorCenter.set(cx, my, mz);
  const glow = new THREE.PointLight('#9cc4ff', 1.4, 1.8);   // monitor light on his face
  glow.position.set(cx, my, mz - 0.3); scene.add(glow);

  // mug
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 24), mat('#e9edf3', 0.5));
  mug.position.set(cx - 0.5, top + 0.05, front + 0.25); mug.castShadow = true; scene.add(mug);

  buildRoom(m);

  // chair
  const sy = m.seatY;
  box(0.5, 0.06, 0.48, soft, m.hipX, sy - 0.03, m.hipZ - 0.04);
  box(0.46, 0.55, 0.06, soft, m.hipX, sy + 0.36, m.hipZ - 0.33);
  box(0.05, sy - 0.1, 0.05, pole, m.hipX, (sy - 0.06) / 2 + 0.04, m.hipZ - 0.04);
  for (let i = 0; i < 5; i++) {
    const leg = box(0.3, 0.025, 0.035, pole, m.hipX, 0.06, m.hipZ - 0.04);
    leg.rotation.y = i * (Math.PI * 2 / 5);
    leg.position.x += Math.cos(-i * Math.PI * 2 / 5) * 0.15;
    leg.position.z += Math.sin(-i * Math.PI * 2 / 5) * 0.15;
  }
}

/* ---------- room: back wall with a snowy night-city window ---------- */
const winCanvas = document.createElement('canvas');
winCanvas.width = 1024; winCanvas.height = 640;
const wctx = winCanvas.getContext('2d');
const winTex = new THREE.CanvasTexture(winCanvas);
winTex.colorSpace = THREE.SRGBColorSpace;
const skyline = document.createElement('canvas');
skyline.width = 1024; skyline.height = 640;
(function paintSkyline() {
  const c = skyline.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 640);
  g.addColorStop(0, '#1a2236'); g.addColorStop(0.6, '#2b3550'); g.addColorStop(1, '#4a4f66');
  c.fillStyle = g; c.fillRect(0, 0, 1024, 640);
  const layers = [['#232b40', 0.55, 0.55], ['#171d2d', 0.35, 0.8]];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [col, minH, lit] of layers) {
    let x = -20;
    while (x < 1040) {
      const w = 50 + rnd() * 90, h = 640 * (minH * 0.5 + rnd() * minH * 0.7);
      c.fillStyle = col; c.fillRect(x, 640 - h, w, h);
      for (let wy = 640 - h + 12; wy < 630; wy += 16) for (let wx = x + 8; wx < x + w - 8; wx += 14) {
        if (rnd() < 0.28 * lit) { c.fillStyle = rnd() < 0.85 ? 'rgba(255,214,150,.75)' : 'rgba(255,90,95,.8)'; c.fillRect(wx, wy, 6, 8); }
      }
      c.fillStyle = 'rgba(235,242,255,.85)'; c.fillRect(x, 640 - h - 3, w, 4); // snow on rooftops
      x += w + 6;
    }
  }
  c.fillStyle = 'rgba(235,242,255,.9)'; c.fillRect(0, 610, 1024, 30);
})();
const flakes = Array.from({ length: 220 }, () => ({ x: Math.random() * 1024, y: Math.random() * 640, r: 0.8 + Math.random() * 2.6, s: 18 + Math.random() * 45, d: Math.random() * 6 }));
function drawWindow(dt, t) {
  wctx.drawImage(skyline, 0, 0);
  wctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const f of flakes) {
    f.y += f.s * dt * (f.r / 2); f.x += Math.sin(t * 0.8 + f.d) * 0.3;
    if (f.y > 645) { f.y = -5; f.x = Math.random() * 1024; }
    wctx.globalAlpha = 0.35 + f.r / 4; wctx.beginPath(); wctx.arc(f.x, f.y, f.r, 0, 7); wctx.fill();
  }
  wctx.globalAlpha = 1;
  winTex.needsUpdate = true;
}

function buildRoom(m) {
  const wallMat = mat('#161b27', 0.95);
  const wx = m.hipX + 1.7;                       // wall behind him in the camera's view
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), wallMat);
  wall.position.set(wx, 1.6, m.hipZ); wall.rotation.y = -Math.PI / 2; wall.receiveShadow = true; scene.add(wall);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), wallMat);
  back.position.set(m.hipX, 1.6, m.hipZ - 1.4); back.receiveShadow = true; scene.add(back);

  const winW = 1.5, winH = 0.94, wy = m.deskTop + 0.75;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false }));
  win.position.set(wx - 0.01, wy, m.hipZ + 0.25); win.rotation.y = -Math.PI / 2; scene.add(win);
  windowCenter.copy(win.position);
  const frame = mat('#2a303d', 0.6);
  for (const [w, h, dy, dz] of [[0.05, winH + 0.1, 0, -winW / 2], [0.05, winH + 0.1, 0, winW / 2], [0.05, winH + 0.1, 0, 0]]) {
    box(0.04, h, w, frame, wx - 0.02, wy + dy, m.hipZ + 0.25 + dz);
  }
  box(0.04, 0.05, winW + 0.1, frame, wx - 0.02, wy + winH / 2 + 0.02, m.hipZ + 0.25);
  box(0.12, 0.04, winW + 0.16, frame, wx - 0.06, wy - winH / 2 - 0.02, m.hipZ + 0.25);
  const winLight = new THREE.PointLight('#a9c4ff', 0.9, 3);
  winLight.position.set(wx - 0.4, wy, m.hipZ + 0.25); scene.add(winLight);

  // small shelf with a plant silhouette and books, for depth
  box(0.5, 0.02, 0.18, frame, wx - 0.1, wy + 0.85, m.hipZ - 0.75).rotation.y = Math.PI / 2;
  const bookCols = ['#c9404a', '#3b4357', '#5e6a82', '#2a2f3c'];
  bookCols.forEach((c, i) => box(0.12, 0.16 + (i % 2) * 0.04, 0.03, mat(c, 0.8), wx - 0.1, wy + 0.94 + (i % 2) * 0.02, m.hipZ - 0.92 + i * 0.04));
}

/* Hair and sleeves rest on the seat and in front of the backrest instead of passing through. */
function addChairColliders(m) {
  const planes = [
    { offset: v3(m.hipX, m.seatY + 0.015, m.hipZ), normal: v3(0, 1, 0) },
    { offset: v3(m.hipX, m.seatY + 0.36, m.hipZ - 0.33 + 0.045), normal: v3(0, 0, 1) },
  ];
  const colliders = planes.map(p => {
    const c = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapePlane(p));
    scene.add(c); c.updateMatrixWorld(true); return c;
  });
  const group = { colliders };
  const seen = new Set();
  for (const joint of vrm.springBoneManager?.joints ?? []) {
    if (seen.has(joint.colliderGroups)) continue;
    seen.add(joint.colliderGroups);
    joint.colliderGroups.push(group);
  }
}

/* ---------- load ---------- */
const status = document.getElementById('status');
const loader = new GLTFLoader();
loader.register(p => new VRMLoaderPlugin(p));
const lookTarget = new THREE.Object3D();
scene.add(lookTarget);

let axes = {}, headPos = new THREE.Vector3();

loader.load(MODEL_URL, gltf => {
  vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices?.(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
  scene.add(vrm.scene);
  B = n => vrm.humanoid.getNormalizedBoneNode(n);

  buildPose();
  vrm.update(0);
  vrm.scene.updateMatrixWorld(true);

  // drop her so her feet rest on the floor; the seat height follows from her own leg length
  const footY = Math.min(worldP(B('leftFoot')).y, worldP(B('rightFoot')).y);
  vrm.scene.position.y += 0.075 - footY;
  vrm.scene.updateMatrixWorld(true);

  const hips = worldP(B('hips'));
  const lh = worldP(B('leftMiddleIntermediate')), rh = worldP(B('rightMiddleIntermediate'));
  const knee = worldP(B('leftLowerLeg'));
  const handY = (lh.y + rh.y) / 2, handZ = (lh.z + rh.z) / 2, handX = (lh.x + rh.x) / 2;
  const thighTop = knee.y + 0.08;
  let deskTop = handY - 0.035;
  if (deskTop - 0.04 < thighTop) console.warn('Desk would hit thighs; raising it', { deskTop, thighTop });
  deskTop = Math.max(deskTop, thighTop + 0.05);
  const m = { deskTop, deskFront: handZ - 0.12, centerX: handX, kbX: handX, kbZ: handZ + 0.01,
              seatY: hips.y - 0.06, hipX: hips.x, hipZ: hips.z };
  buildDesk(m);
  addChairColliders(m);

  // camera: in front of her right side, so the monitor doesn't block her face
  headPos = worldP(B('head'));
  camera.position.set(hips.x - 1.85, headPos.y + 0.2, hips.z + 1.0);
  controls.target.set(hips.x + 0.15, headPos.y - 0.16, hips.z + 0.3);   // leaves headroom for the name tag
  camera.lookAt(controls.target);
  controls.update();

  // eye range: the file ships 8–12° over a 90° input, which barely moves; widen it
  const ap = vrm.lookAt?.applier;
  if (ap?.rangeMapHorizontalInner) {
    ap.rangeMapHorizontalInner.inputMaxValue = 35; ap.rangeMapHorizontalInner.outputScale = 14;
    ap.rangeMapHorizontalOuter.inputMaxValue = 35; ap.rangeMapHorizontalOuter.outputScale = 16;
    ap.rangeMapVerticalDown.inputMaxValue = 30;  ap.rangeMapVerticalDown.outputScale = 11;
    ap.rangeMapVerticalUp.inputMaxValue = 30;    ap.rangeMapVerticalUp.outputScale = 9;
  }
  vrm.lookAt.target = lookTarget;

  // remember the base pose and per-bone axes for per-frame deltas
  for (const name of Object.keys(vrm.humanoid.humanBones)) { const b = B(name); if (b) baseLocal.set(b, b.quaternion.clone()); }
  const X = v3(1, 0, 0), Y = v3(0, 1, 0);
  axes = {
    neckY: localAxis('neck', Y), neckX: localAxis('neck', X),
    headY: localAxis('head', Y), headX: localAxis('head', X), headZ: localAxis('head', v3(0, 0, 1)),
    spineX: localAxis('spine', X), chestX: localAxis('upperChest', X) || localAxis('chest', X),
    lShoulder: localAxis('leftShoulder', v3(0, 0, 1)), rShoulder: localAxis('rightShoulder', v3(0, 0, 1)),
    lUpperArmX: localAxis('leftUpperArm', X), rUpperArmX: localAxis('rightUpperArm', X),
    spineZ: localAxis('spine', v3(0, 0, 1)), chestZ: localAxis('upperChest', v3(0, 0, 1)) || localAxis('chest', v3(0, 0, 1)),
    neckZ: localAxis('neck', v3(0, 0, 1)),
    lLowerArmX: localAxis('leftLowerArm', X), rLowerArmX: localAxis('rightLowerArm', X),
  };
  for (const L of ['left', 'right']) {
    for (const f of ['Index', 'Middle', 'Ring']) axes[`${L}${f}`] = localAxis(`${L}${f}Proximal`, curlAxis[L]);
    axes[`${L}Hand`] = localAxis(`${L}Hand`, curlAxis[L]);
    axes[`${L}HandYaw`] = localAxis(`${L}Hand`, Y);
  }

  status.remove();
  start();
}, p => { if (p.total) status.textContent = `Loading model… ${Math.round(p.loaded / p.total * 100)}%`; },
   err => { status.textContent = 'Could not load model.vrm. Serve this folder over http (see README).'; console.error(err); });

/* ---------- interaction ---------- */
let gaze = 'cursor', expr = 'auto', typingOn = true, lastMove = -10;
const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
let hasPointer = false;
addEventListener('pointermove', e => {
  pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  hasPointer = true; lastMove = clock.elapsedTime;
});
document.addEventListener('pointerleave', () => { hasPointer = false; });

function group(id, cb) {
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    cb(b.dataset.v);
  });
}
group('gaze', v => { gaze = v; });
group('expr', v => { expr = v; });
const tBtn = document.getElementById('typing');
tBtn.onclick = () => { typingOn = !typingOn; tBtn.setAttribute('aria-pressed', String(typingOn)); };
const oBtn = document.getElementById('orbit');
oBtn.onclick = () => { controls.enabled = !controls.enabled; oBtn.setAttribute('aria-pressed', String(controls.enabled)); };

// Debug panel: hidden for visitors. Show it with ?debug in the URL, or toggle with the D key.
const hud = document.querySelector('.hud');
hud.hidden = !new URLSearchParams(location.search).has('debug');
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'd' || e.key === 'D') hud.hidden = !hud.hidden;
  // debug shortcuts while the panel is open: S = stretch now, W = look out the window now
  if (!hud.hidden && (e.key === 's' || e.key === 'w')) {
    breakKind = e.key === 's' ? 'stretch' : 'window';
    breakStart = clock.elapsedTime; breakDur = breakKind === 'stretch' ? STRETCH_DUR : 4.6;
    lastMove = -10;
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- Kairo: name tag + greeting ---------- */
const tagEl = document.getElementById('tag'), bubbleEl = document.getElementById('bubble');
const LINES = PROFILE.greetings;
const REACT = { surprised: "Whoa! Easy there, I'm in the middle of a commit.", ...(PROFILE.reactions || {}) };
let lineIdx = 0, greetUntil = -1, talkUntil = -1;
let happyUntil = -1, surpriseUntil = -1, laughUntil = -1;
let lastClick = -10, burst = 0, reactingUntil = -1;
function say(text, secs = 5.5) {
  const t = clock.elapsedTime;
  bubbleEl.textContent = text;
  bubbleEl.classList.add('show');
  greetUntil = t + secs;
  talkUntil = t + Math.min(secs - 0.5, 0.6 + text.length * 0.045);   // lips move for about as long as the line
  endBreak();
}
function greet(i) {
  say(LINES[i ?? lineIdx]);
  lineIdx = ((i ?? lineIdx) + 1) % LINES.length;
}
renderer.domElement.addEventListener('click', e => {
  if (!vrm || controls.enabled) return;
  const p = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(p, camera);
  if (!ray.intersectObject(vrm.scene, true).length) return;
  const t = clock.elapsedTime;
  if (t < reactingUntil) return;                // mid-surprise: ignore clicks until he's done
  burst = t - lastClick < 1.2 ? burst + 1 : 1;  // quick clicks in a row count as one "poke" burst
  lastClick = t;
  if (burst === 1) {                            // a normal click: one line
    happyUntil = t + 1.6;
    greet();
  } else if (burst >= 3) {                      // third quick click: startled, then laughs it off
    burst = 0;
    surpriseUntil = t + 1.1; laughUntil = t + 3.4;
    say(REACT.surprised, 3.8);
    reactingUntil = t + 3.8;
  }
  // second quick click: nothing new, he keeps saying the current line
});

/* ---------- idle breaks: stretch, or gaze out the window ---------- */
const STRETCH_DUR = 5.6;
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
// 0→1 between a and b seconds, easing in over `fi` and out over `fo`
const phase = (s, a, b, fi, fo) => smooth((s - a) / fi) * (1 - smooth((s - (b - fo)) / fo));
let breakKind = null, breakStart = 0, breakDur = 0, nextBreak = 12 + Math.random() * 6;   // first break 12–18 s after load
function endBreak() {
  if (!breakKind) return;
  breakKind = null;
  nextBreak = clock.elapsedTime + 15 + Math.random() * 10;   // then every 15–25 s
}
const _tagP = new THREE.Vector3();
function placeOverlay(t) {
  const head = B('head');
  _tagP.copy(worldP(head)); _tagP.y += 0.22;
  _tagP.project(camera);
  const x = (_tagP.x + 1) / 2 * innerWidth, y = (1 - _tagP.y) / 2 * innerHeight;
  tagEl.style.left = x + 'px'; tagEl.style.top = y + 'px';
  tagEl.style.opacity = _tagP.z < 1 ? '1' : '0';
  _tagP.copy(worldP(head)); _tagP.y += 0.06; _tagP.project(camera);
  bubbleEl.style.left = ((_tagP.x + 1) / 2 * innerWidth + 40) + 'px';
  bubbleEl.style.top = ((1 - _tagP.y) / 2 * innerHeight) + 'px';
  if (greetUntil > 0 && t > greetUntil) {
    bubbleEl.classList.remove('show'); greetUntil = -1;
  }
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
const eyeGoal = new THREE.Vector3(), eyeCur = new THREE.Vector3(), headCur = new THREE.Vector3();
let nextBlink = 2, blinkT = -1, yawS = 0, pitchS = 0;
const exprNames = ['relaxed', 'happy', 'Surprised'];
const exprW = { relaxed: 0, happy: 0, Surprised: 0 };
const readEl = document.getElementById('read');
const presses = { leftIndex: 0, leftMiddle: 0, leftRing: 0, rightIndex: 0, rightMiddle: 0, rightRing: 0 };
let nextKey = 0, typeTimer = 0;

function start() {
  eyeCur.copy(camera.position); headCur.copy(camera.position);
  renderer.setAnimationLoop(tick);
  setTimeout(() => greet(0), 1200);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  controls.update();

  for (const [b, q] of baseLocal) b.quaternion.copy(q);

  // breathing
  const br = Math.sin(t * 1.7);
  addDelta('spine', axes.spineX, br * 0.012);
  addDelta(B('upperChest') ? 'upperChest' : 'chest', axes.chestX, br * 0.015);
  addDelta('leftShoulder', axes.lShoulder, br * 0.02);
  addDelta('rightShoulder', axes.rShoulder, -br * 0.02);

  // moods run on their own: decide whether he takes a short break
  const visitorActive = hasPointer && t - lastMove < 2.5;
  const talking = greetUntil > 0;
  if (!breakKind && t > nextBreak && !talking && !visitorActive && typingOn && expr === 'auto' && gaze === 'cursor') {
    breakKind = Math.random() < 0.5 ? 'stretch' : 'window';
    breakStart = t; breakDur = breakKind === 'stretch' ? STRETCH_DUR : 4.6;
  }
  if (breakKind && (t - breakStart > breakDur || visitorActive)) endBreak();
  const bp = breakKind ? (t - breakStart) / breakDur : 0;
  // the stretch is a little sequence: shrug → reach up + yawn → lean side to side → neck roll → settle
  const ss = breakKind === 'stretch' ? t - breakStart : -1;
  const reach  = ss < 0 ? 0 : phase(ss, 0.2, 3.9, 0.9, 0.9);
  const shrug  = ss < 0 ? 0 : phase(ss, 0.3, 2.4, 0.6, 0.6);
  const yawnE  = ss < 0 ? 0 : phase(ss, 0.7, 2.3, 0.5, 0.6);
  const side   = ss < 0 ? 0 : phase(ss, 2.1, 3.7, 0.35, 0.35) * Math.sin((ss - 2.1) / 1.6 * Math.PI * 2);
  const neck   = ss < 0 ? 0 : phase(ss, 3.7, 5.1, 0.3, 0.3) * Math.sin((ss - 3.7) / 1.4 * Math.PI * 2);
  const settle = ss < 0 ? 0 : phase(ss, 4.6, STRETCH_DUR, 0.3, 0.5);
  const typingActive = typingOn && !breakKind && !talking;

  if (ss >= 0) {
    const chest = B('upperChest') ? 'upperChest' : 'chest';
    addDelta('spine', axes.spineX, -0.14 * reach);              // lean back (~17° total)
    addDelta(chest, axes.chestX, -0.16 * reach);
    addDelta('spine', axes.spineZ, 0.14 * side);                  // side bend, left then right
    addDelta(chest, axes.chestZ, 0.12 * side);
    addDelta('leftShoulder', axes.lShoulder, 0.14 * shrug);      // shoulders up
    addDelta('rightShoulder', axes.rShoulder, -0.14 * shrug);
    addDelta('leftUpperArm', axes.lUpperArmX, -1.15 * reach);    // arms forward and up
    addDelta('rightUpperArm', axes.rUpperArmX, -1.15 * reach);
    addDelta('leftLowerArm', axes.lLowerArmX, -0.35 * reach);
    addDelta('rightLowerArm', axes.rLowerArmX, -0.35 * reach);
    for (const L of ['left', 'right']) {
      addDelta(`${L}Hand`, axes[`${L}Hand`], -0.55 * reach);     // wrists bend back
      for (const f of ['Index', 'Middle', 'Ring']) addDelta(`${L}${f}Proximal`, axes[`${L}${f}`], -0.45 * reach); // fingers spread straight
    }
    addDelta('neck', axes.neckZ, 0.18 * neck);                   // neck roll
    addDelta('head', axes.headZ, 0.3 * neck);
  }

  // typing: random key presses on index/middle/ring, small hand drift
  if (typingActive) {
    typeTimer -= dt;
    if (typeTimer <= 0) {
      const keys = Object.keys(presses);
      presses[keys[Math.floor(Math.random() * keys.length)]] = 1;
      typeTimer = 0.07 + Math.random() * 0.14;
      typed = (typed + 1) % (CODE.join('\n').length + 40);
    }
  }
  for (const k in presses) {
    presses[k] = Math.max(0, presses[k] - dt * 9);
    const L = k.startsWith('left') ? 'left' : 'right', f = k.replace(L, '');
    addDelta(`${L}${f}Proximal`, axes[k], presses[k] * 0.32);
  }
  for (const L of ['left', 'right']) {
    const s = L === 'left' ? 1 : -1;
    addDelta(`${L}Hand`, axes[`${L}Hand`], typingActive ? Math.sin(t * 6.3 + s) * 0.03 : 0);
    addDelta(`${L}Hand`, axes[`${L}HandYaw`], typingActive ? Math.sin(t * 0.9 + s * 2) * 0.05 : 0);
  }

  // gaze target
  const idle = t - lastMove > 4;
  const greeting = talking;
  if (breakKind === 'window') {
    eyeGoal.copy(windowCenter);
  } else if (breakKind === 'stretch') {
    // looks up while reaching, then back toward the screen for the neck roll and settle
    eyeGoal.set(headPos.x - 0.1, headPos.y + 0.45 * reach + 0.05, headPos.z + 0.9).lerp(monitorCenter, 1 - reach);
  } else if (greeting && (!hasPointer || idle)) {
    eyeGoal.copy(camera.position);            // look at the visitor while talking
  } else if (gaze === 'screen' || (gaze === 'cursor' && (idle || !hasPointer))) {
    eyeGoal.copy(monitorCenter);
  } else {
    ray.setFromCamera(pointer, camera);
    ray.ray.at(camera.position.distanceTo(headPos) * 0.55, eyeGoal);
  }
  eyeCur.lerp(eyeGoal, 1 - Math.exp(-dt * 14));
  headCur.lerp(eyeGoal, 1 - Math.exp(-dt * 3.2));
  lookTarget.position.copy(eyeCur);

  // head + neck follow (eyes lead, head lags); body faces +Z
  const d = headCur.clone().sub(headPos);
  const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -60 * DEG, 60 * DEG);
  const pitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -30 * DEG, 25 * DEG);
  yawS = yaw; pitchS = pitch;
  addDelta('neck', axes.neckY, yaw * 0.4); addDelta('neck', axes.neckX, -pitch * 0.4);
  addDelta('head', axes.headY, yaw * 0.6); addDelta('head', axes.headX, -pitch * 0.6);
  addDelta('head', axes.headZ, -yaw * 0.12); // slight curious tilt toward the gaze side

  // expressions: automatic mood, unless the debug panel picks one
  const goalW = { relaxed: 0, happy: 0, Surprised: 0 };
  let mood;
  if (expr !== 'auto') {
    mood = expr;
    if (expr in goalW) goalW[expr] = expr === 'happy' ? 0.8 : expr === 'relaxed' ? 0.45 : 0.7;
  } else if (t < surpriseUntil) { mood = 'surprised'; goalW.Surprised = 0.85; }
  else if (t < laughUntil)      { mood = 'laughing';  goalW.happy = 0.75; }
  else if (t < happyUntil)      { mood = 'happy';     goalW.happy = 0.55; }
  else if (greeting)            { mood = 'talking';   goalW.relaxed = 0.8; }
  else if (breakKind === 'stretch' && settle > 0.3) { mood = 'stretch: settling'; goalW.relaxed = 0.85; }
  else if (breakKind)           { mood = breakKind;   goalW.relaxed = 0.35; }
  else if (visitorActive)       { mood = 'watching';  goalW.relaxed = 0.4; }
  else                          { mood = 'focused';   goalW.relaxed = 0.1; }
  for (const n of exprNames) {
    exprW[n] += (goalW[n] - exprW[n]) * (1 - Math.exp(-dt * 8));
    vrm.expressionManager?.setValue(n, exprW[n]);
  }
  // lips while he talks, and a small yawn during the stretch
  const talkMouth = t < talkUntil ? (0.25 + 0.25 * Math.sin(t * 17) + 0.15 * Math.sin(t * 29)) : 0;
  vrm.expressionManager?.setValue('aa', Math.max(0, talkMouth) + yawnE * 0.65);

  // blink (skipped while Joy closes her eyes)
  if (t > nextBlink && blinkT < 0) blinkT = 0;
  let blink = 0;
  if (blinkT >= 0) {
    blinkT += dt;
    blink = Math.sin(Math.min(blinkT / 0.16, 1) * Math.PI);
    if (blinkT > 0.16) { blinkT = -1; nextBlink = t + 2 + Math.random() * 4; }
  }
  vrm.expressionManager?.setValue('blink', exprW.happy > 0.4 ? 0 : Math.max(blink, yawnE * 0.85, neck !== 0 ? 0.35 : 0));

  vrm.update(dt);
  if (Math.floor(t * 10) % 2 === 0) drawCode();
  drawWindow(dt, t);

  if (!hud.hidden) readEl.textContent = `mood: ${mood}${ss >= 0 ? ' ' + ss.toFixed(1) + 's' : ''} · head yaw ${(yawS / DEG).toFixed(0)}° · next break ${breakKind ? 'now' : Math.max(0, nextBreak - t).toFixed(0) + 's'}`;
  placeOverlay(t);
  renderer.render(scene, camera);
}
