import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FLAGS } from './config.js';

/** Renderer, scene, camera, lights and floor: the empty stage Kairo's room is built on. */
export function createStage() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: FLAGS.capture });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d111b');
  scene.fog = new THREE.Fog('#0d111b', 5, 12);

  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enabled = false; // the debug panel's "Free camera" turns this on

  scene.add(new THREE.HemisphereLight('#9fb4dc', '#1a1d29', 0.9));

  const moon = new THREE.DirectionalLight('#cfe0ff', 1.5);   // cool moonlight from the window side
  moon.position.set(2.5, 3, -1.5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
  moon.shadow.bias = -0.0005;
  scene.add(moon);

  const rim = new THREE.DirectionalLight('#ff5a5f', 0.9);    // red accent rim, matches his eyes
  rim.position.set(-1.5, 2.2, -2.5);
  scene.add(rim);

  const fill = new THREE.DirectionalLight('#ffd9b8', 0.55);  // warm fill on his face from the camera side
  fill.position.set(-2.5, 1.8, 1.5);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ color: '#1b1f2b', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return { renderer, scene, camera, controls };
}
