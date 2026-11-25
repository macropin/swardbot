// Renders the whole mower from several angles, in colour, for the README and
// docs: media/views/<view>.png.
//
//   node scripts/render-views.mjs            # every view
//   node scripts/render-views.mjs side top   # just these
//
// The mower is built from src/assemblies/mower.brep.ts, its bodies grouped by
// material (mowerGroups), meshed with the OCCT kernel, and drawn by three.js
// in headless Chrome: a studio light with soft shadows on the ground, and each
// body's real edges outlined. Each view is drawn at twice its size and scaled
// down, for clean edges.

import './ts-hooks.mjs';

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as brep from 'brepjs';
import { OcctKernel } from 'occt-wasm';
import puppeteer from 'puppeteer';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'media/views');
const WIDTH = 1600;
const HEIGHT = 1000;
/** Drawn at this multiple, then scaled down. */
const SUPERSAMPLE = 2;

brep.registerKernel('occt-wasm', brep.OcctWasmAdapter.fromKernel(await OcctKernel.init()));
const { layout } = await import(pathToFileURL(resolve(root, 'src/layout.ts')).href);
const { mowerGroups } = await import(pathToFileURL(resolve(root, 'src/assemblies/mower.brep.ts')).href);
const { frontBeam } = await import(pathToFileURL(resolve(root, 'src/front-beam.ts')).href);

const l = layout();
const fb = frontBeam(l);

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
//
// az: the camera's bearing from the mower, in degrees from straight ahead (+X)
// toward its left (+Y); el: its height, in degrees above the ground. `region`
// frames part of the mower instead of all of it. `roll` turns the front beam
// on its pivot, in degrees, left side up.

const { wheelbase: front, railZ, frameOuterY } = l;
const e = l.electronics;
const views = [
  { name: 'front-left', az: 35, el: 20 },
  { name: 'rear-right', az: -140, el: 24 },
  { name: 'side', az: 90, el: 2, fov: 12 },
  { name: 'front', az: 0, el: 2, fov: 12 },
  { name: 'top', az: 0, el: 90, fov: 12 },
  { name: 'underside', az: 30, el: -30, ground: false },
  { name: 'front-roll', az: 0, el: 6, fov: 12, roll: l.params.rollLimit, ground: false },
  {
    name: 'front-beam',
    az: 32,
    el: 22,
    region: { min: [front - 130, -fb.pad.yOut - l.castor.y - 10, 0], max: [front + 110, fb.pad.yOut + l.castor.y + 10, railZ + 40] },
  },
  {
    name: 'rear-wheel',
    az: 140,
    el: 16,
    region: { min: [-170, frameOuterY - 180, 0], max: [250, l.wheel.y + l.params.wheelWidth / 2 + 10, l.params.apexHeight + 40] },
  },
  {
    name: 'top-bar',
    az: -150,
    el: 26,
    region: { min: [-150, -360, e.min[2] - 60], max: [e.max[0] + 40, 360, l.antennas[0][2] + 60] },
  },
];

const wanted = process.argv.slice(2);
const chosen = wanted.length ? views.filter((v) => wanted.includes(v.name)) : views;
if (wanted.length && chosen.length !== wanted.length) {
  console.error(`unknown view; views: ${views.map((v) => v.name).join(', ')}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Meshing: one triangle mesh and one set of edge lines per group
// ---------------------------------------------------------------------------

const ROLLS = new Set(['front beam', 'front beam printed', 'pivot pin', 'castors', 'castor wheels']);
const chunks = [];
let offset = 0;
const push = (array) => {
  const at = offset;
  chunks.push(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  offset += array.byteLength;
  return { at, length: array.length };
};

const manifest = { pivotZ: fb.B, castorX: l.castor.contactX, groups: [] };
for (const group of mowerGroups(l)) {
  const positions = [];
  const normals = [];
  const indices = [];
  const edges = [];
  let base = 0;
  for (const body of group.bodies) {
    const m = brep.mesh(body, { tolerance: 0.08, angularTolerance: 0.15, cache: false });
    positions.push(m.vertices);
    normals.push(m.normals);
    indices.push(m.triangles.map((i) => i + base));
    base += m.vertices.length / 3;
    edges.push(brep.meshEdges(body, { tolerance: 0.08, angularTolerance: 0.15, cache: false }).lines);
  }
  const join = (parts, Type) => {
    const out = new Type(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  };
  manifest.groups.push({
    name: group.name,
    material: group.material,
    rolls: ROLLS.has(group.name),
    positions: push(join(positions, Float32Array)),
    normals: push(join(normals, Float32Array)),
    indices: push(join(indices, Uint32Array)),
    edges: push(join(edges, Float32Array)),
  });
}
const scene = Buffer.concat(chunks);
console.log(`meshed ${manifest.groups.length} groups, ${(scene.length / 1e6).toFixed(1)} MB`);

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const page = /* html */ `<!doctype html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#eceef1;overflow:hidden}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body>
<script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const MATERIALS = {
  aluminium: { color: '#b3b8bf', metalness: 0.6, roughness: 0.4 },
  printed: { color: '#ee7a1e', metalness: 0, roughness: 0.55 },
  steel: { color: '#8a9098', metalness: 0.8, roughness: 0.3 },
  stainless: { color: '#d7dbe0', metalness: 0.85, roughness: 0.22 },
  rubber: { color: '#2a2b2e', metalness: 0, roughness: 0.85 },
  hub: { color: '#6d737b', metalness: 0.6, roughness: 0.4 },
  castor: { color: '#5b6066', metalness: 0.35, roughness: 0.5 },
  battery: { color: '#2f5f8d', metalness: 0, roughness: 0.8 },
  motor: { color: '#2a2c31', metalness: 0.45, roughness: 0.45 },
  enclosure: { color: '#c9cccd', metalness: 0, roughness: 0.75 },
  antenna: { color: '#f3f3f0', metalness: 0, roughness: 0.5 },
  button: { color: '#d4252a', metalness: 0, roughness: 0.4 },
};

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#eceef1');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const manifest = await (await fetch('/scene.json')).json();
const bin = await (await fetch('/scene.bin')).arrayBuffer();
const view = (Type, r) => new Type(bin, r.at, r.length);

const fixed = new THREE.Group();
// The front beam's parts turn about the pivot pin, along X at pivotZ.
const pivot = new THREE.Group();
pivot.position.set(0, 0, manifest.pivotZ);
const rolling = new THREE.Group();
rolling.position.set(0, 0, -manifest.pivotZ);
pivot.add(rolling);
scene.add(fixed, pivot);

const meshes = [];
for (const g of manifest.groups) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(view(Float32Array, g.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(view(Float32Array, g.normals), 3));
  geometry.setIndex(new THREE.BufferAttribute(view(Uint32Array, g.indices), 1));
  const spec = MATERIALS[g.material];
  const material = new THREE.MeshStandardMaterial({
    ...spec,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.BufferAttribute(view(Float32Array, g.edges), 3));
  const edgeColor = new THREE.Color(spec.color).multiplyScalar(0.42);
  const outline = new THREE.LineSegments(
    lines,
    new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.6 }),
  );
  (g.rolls ? rolling : fixed).add(mesh, outline);
  meshes.push(mesh);
}

const box = new THREE.Box3();
for (const m of meshes) box.expandByObject(m);
const centre = box.getCenter(new THREE.Vector3());

const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.ShadowMaterial({ opacity: 0.2 }));
ground.receiveShadow = true;
scene.add(ground);

// For the roll view, a strip of ground under each axle: level under the drive
// wheels, and turned with the beam under the castors, so they still touch it.
const turf = new THREE.MeshStandardMaterial({ color: '#9db58a', roughness: 0.9 });
const strip = (x, length) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(length, 1400, 8), turf);
  m.position.set(x, 0, -4);
  m.receiveShadow = true;
  return m;
};
const strips = [strip(0, 360), strip(manifest.castorX, 260)];
fixed.add(strips[0]);
rolling.add(strips[1]);

const sun = new THREE.DirectionalLight('#ffffff', 2.4);
sun.position.set(centre.x + 700, centre.y + 900, 1800);
sun.target.position.copy(centre);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const s = sun.shadow.camera;
s.left = s.bottom = -1100;
s.right = s.top = 1100;
s.near = 100;
s.far = 4000;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.8;
sun.shadow.radius = 4;
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 10, 50000);
// A soft light from the camera, so faces turned from the sun still read.
const fill = new THREE.DirectionalLight('#ffffff', 0.7);
scene.add(camera, fill, fill.target);

/** Points to frame: every few vertices, as drawn, inside the region if there is one. */
function samples(region) {
  const out = [];
  const p = new THREE.Vector3();
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const a = m.geometry.attributes.position;
    for (let i = 0; i < a.count; i += 3) {
      p.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld);
      if (region && (p.x < region.min[0] || p.x > region.max[0] || p.y < region.min[1] || p.y > region.max[1] || p.z < region.min[2] || p.z > region.max[2])) continue;
      out.push(p.clone());
    }
  }
  return out;
}

/** Aim the camera from (az, el) and move it until the points fill the frame, less a margin. */
function frame(points, az, el, fov, margin) {
  camera.fov = fov;
  camera.updateProjectionMatrix();
  const a = (az * Math.PI) / 180;
  const b = (Math.min(el, 89.9) * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b));
  // Looking straight down, the mower's front is up the picture.
  camera.up.set(0, 0, 1);
  if (el >= 89) camera.up.set(1, 0, 0);
  const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  let distance = 4000;
  const half = Math.tan((fov * Math.PI) / 360);
  for (let i = 0; i < 12; i++) {
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const q = new THREE.Vector3();
    for (const p of points) {
      q.copy(p).project(camera);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, ((x0 + x1) / 2) * distance * half * camera.aspect);
    target.addScaledVector(up, ((y0 + y1) / 2) * distance * half);
    const size = Math.max((x1 - x0) / 2, (y1 - y0) / 2) / margin;
    distance *= 0.35 + 0.65 * size;
  }
  camera.position.copy(target).addScaledVector(dir, distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

window.render = async (v) => {
  pivot.rotation.x = ((v.roll ?? 0) * Math.PI) / 180;
  pivot.updateMatrixWorld(true);
  ground.visible = v.ground !== false;
  for (const s of strips) s.visible = v.roll !== undefined;
  frame(samples(v.region), v.az, v.el, v.fov ?? 28, v.region ? 0.92 : 0.88);
  fill.position.copy(camera.position);
  fill.target.position.copy(centre);
  fill.intensity = v.el < 0 ? 1.6 : 0.7;
  renderer.render(scene, camera);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
};
window.ready = true;
</script></body></html>`;

// ---------------------------------------------------------------------------
// Serve the page, the scene and three.js; shoot each view
// ---------------------------------------------------------------------------

const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/favicon.ico') return res.writeHead(204).end();
  if (url.pathname === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(page);
  if (url.pathname === '/scene.json') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(manifest));
  if (url.pathname === '/scene.bin') return res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(scene);
  if (url.pathname.startsWith('/three/')) {
    const file = resolve(root, 'node_modules', url.pathname.slice(1));
    if (file.startsWith(resolve(root, 'node_modules/three'))) {
      try {
        return res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
      } catch {}
    }
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const tab = await browser.newPage();
  tab.on('console', (m) => (m.type() === 'error' ? console.error(`page: ${m.text()}`) : undefined));
  tab.on('pageerror', (err) => console.error(`page: ${err.message}`));
  await tab.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SUPERSAMPLE });
  await tab.goto(`http://127.0.0.1:${port}/`);
  await tab.waitForFunction('window.ready === true', { timeout: 120000 });
  mkdirSync(OUT, { recursive: true });
  for (const v of chosen) {
    await tab.evaluate((spec) => window.render(spec), v);
    const raw = resolve(OUT, `${v.name}.raw.png`);
    const png = resolve(OUT, `${v.name}.png`);
    await tab.screenshot({ path: raw, type: 'png' });
    execFileSync('magick', [
      raw,
      '-filter', 'Lanczos',
      '-resize', `${WIDTH}x${HEIGHT}`,
      '-strip',
      '-define', 'png:exclude-chunks=date,time',
      png,
    ]);
    rmSync(raw);
    console.log(`view -> ${png.slice(root.length + 1)}`);
  }
} finally {
  await browser.close();
  server.close();
}
