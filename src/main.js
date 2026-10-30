import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createClient } from '@supabase/supabase-js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { MERCHANTS, LAYOUT, ZONES } from './merchants.js';

const SB = createClient('https://qcugwkkgmvpbaglgento.supabase.co', 'sb_publishable_dKwXKOiKrqsE4C4D5cUgpQ_4ig3YFqC', { auth: { persistSession: false } });
const COLS = ['id', 'server_id', 'lock_type', 'message', 'nickname', 'slot', 'created_at'].join(',');
import { SERVERS } from './servers.js';
const $ = (id) => document.getElementById(id);
let device = localStorage.getItem('namsan_device');
if (!device) { device = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''); localStorage.setItem('namsan_device', device); }

// ---------- renderer / scene ----------
let quality = localStorage.getItem('namsan_q') || (matchMedia('(pointer:coarse)').matches ? 'low' : 'high');
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const FOG = new THREE.Color('#b77a86');
scene.fog = new THREE.FogExp2(FOG, 0.0032);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 6000);

// sky + environment
const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(89), THREE.MathUtils.degToRad(-120));
function makeSky() { const s = new Sky(); s.scale.setScalar(4500); const u = s.material.uniforms; u.turbidity.value = 9; u.rayleigh.value = 2.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.86; u.sunPosition.value.copy(sun); return s; }
const skyMain = makeSky(); scene.add(skyMain);
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); envScene.add(makeSky());
scene.environment = pmrem.fromScene(envScene, 0.02).texture; scene.environmentIntensity = 0.7;

const hemi = new THREE.HemisphereLight('#a796d6', '#4a3238', 1.1); scene.add(hemi);
const sunLight = new THREE.DirectionalLight('#ffad74', 3.2);
sunLight.position.copy(sun).multiplyScalar(80).setY(30);
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 200 });
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.03; sunLight.shadow.radius = 4;
scene.add(sunLight, sunLight.target);

// ---------- canvas textures (generated at runtime, no image files) ----------
function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
const tileTex = canvasTex(512, 512, (g, w) => { g.fillStyle = '#9a8f88'; g.fillRect(0, 0, w, w); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 130 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v - 8},${v - 14})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); } }, [14, 14]);
const winTex = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#0c0d16'; g.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 10) for (let x = 4; x < w; x += 10) { if (Math.random() < 0.42) { const c = ['#ffd9a0', '#fff1c9', '#a8d4ff', '#ffbf7a'][Math.random() * 4 | 0]; g.fillStyle = c; g.fillRect(x, y, 6, 6); } } });

let skylineMat, stringMats = [];
// ---------- layout (straight route, see merchants.js LAYOUT) ----------
const { park: PK, stairs1: S1, plaza: PZ, stairs2: S2, ring: RG } = LAYOUT;
const FR = RG.r, FH = RG.fenceH, GATE_HALF = 2.0;
const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const hillY = (r) => r < FR + 1 ? 0 : -16 - 46 * THREE.MathUtils.smoothstep(r, FR + 1, 230);
const N1 = 40, N2 = 48; // step counts
function stairY(S, n, z) { const t = clamp((S.z1 - z) / (S.z1 - S.z0), 0, 1); return S.y1 + Math.min(n, Math.ceil(t * n - 1e-6)) * (S.y0 - S.y1) / n; }
function groundY(x, z) {
  if (Math.hypot(x, z) < FR + 0.6) return 0;
  if (z >= S1.z1) return PK.y;
  if (z >= S1.z0) return stairY(S1, N1, z);
  if (z >= PZ.z0) return PZ.y;
  return stairY(S2, N2, z);
}
const routeT = (x, z) => Math.hypot(x, z) < FR + 0.6 ? 1 : clamp((LAYOUT.spawnZ - z) / (LAYOUT.spawnZ - FR), 0, 1);
function walkable(x, z) {
  const r = Math.hypot(x, z);
  if (r < FR - 0.55) return r > 7.6;
  if (z > 0 && Math.abs(x) < GATE_HALF - 0.35 && r < FR + 1.2) return true; // gate
  if (z > PK.z0 - 0.6 && z < PK.z1 - 0.6 && Math.abs(x) < PK.x - 0.6) return true;
  if (z > PZ.z0 + 0.4 && z < PZ.z1 - 0.4 && Math.abs(x) < PZ.x - 0.6) return true;
  if (z >= S1.z0 - 1.5 && z <= S1.z1 + 1.5 && Math.abs(x) < S1.w / 2 - 0.35) return true; // overlaps plaza/parking edges
  if (z >= S2.z0 - 1 && z <= S2.z1 + 1.5 && Math.abs(x) < S2.w / 2 - 0.35) return true;
  return false;
}
function uvScale(g, sx, sy) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * (sy ?? sx)); return g; }
const rep = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const groundMeshes = [];
{
  const pts = []; for (let r = 0; r <= 240; r += 3) pts.push(new THREE.Vector2(r, hillY(r) - 3));
  const hill = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 96), new THREE.MeshStandardMaterial({ color: '#2f4a2c', roughness: 0.95 }));
  hill.material.side = THREE.DoubleSide; hill.receiveShadow = true; scene.add(hill);
  const city = new THREE.Mesh(new THREE.CircleGeometry(2500, 64), new THREE.MeshStandardMaterial({ color: '#1a1820', roughness: 1 }));
  city.rotation.x = -Math.PI / 2; city.position.y = -62; scene.add(city);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(3000, 90), new THREE.MeshStandardMaterial({ color: '#2a3550', roughness: 0.08, metalness: 1 }));
  river.rotation.x = -Math.PI / 2; river.position.set(0, -61.8, 420); river.rotation.z = 0.25; scene.add(river);
}
// trees on the slope, away from the built route
{
  const n = quality === 'high' ? 900 : 450;
  const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 5, 7), new THREE.MeshStandardMaterial({ color: '#2d5a32', roughness: 0.9 }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) { let r, a, x, z; do { r = 30 + Math.random() * 190; a = Math.random() * Math.PI * 2; x = Math.cos(a) * r; z = Math.sin(a) * r; } while (Math.abs(x) < 27 && z > 18 && z < 186); const k = 0.7 + Math.random() * 1.1; const col = new THREE.Color().setHSL(0.28 + Math.random() * 0.08, 0.45, 0.18 + Math.random() * 0.12); s.set(k, k * (0.8 + Math.random() * 0.6), k); m.compose(new THREE.Vector3(x, hillY(r) - 1 + 2.3 * s.y, z), q, s); cone.setMatrixAt(i, m); cone.setColorAt(i, col); }
  cone.castShadow = true; cone.receiveShadow = true; scene.add(cone);
}

// skyline
{
  const n = quality === 'high' ? 1400 : 700;
  const mat = skylineMat = new THREE.MeshStandardMaterial({ color: '#2c2d3a', roughness: 0.6, metalness: 0.3, emissive: '#ffffff', emissiveMap: winTex, emissiveIntensity: 2.2 });
  const b = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const r = 200 + Math.pow(Math.random(), 0.7) * 850, a = Math.random() * Math.PI * 2; const h = 12 + Math.pow(Math.random(), 3) * 110 * (r < 500 ? 1 : 0.7); const w = 10 + Math.random() * 18; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 3); m.compose(new THREE.Vector3(Math.cos(a) * r, -62, Math.sin(a) * r), q, new THREE.Vector3(w, h, w * (0.6 + Math.random() * 0.8))); b.setMatrixAt(i, m); }
  scene.add(b);
  // landmark super-tall (Lotte World Tower-ish)
  const lt = new THREE.Mesh(new THREE.CylinderGeometry(2, 14, 260, 4, 1), mat); lt.position.set(620, 68, -380); lt.rotation.y = 0.4; scene.add(lt);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(2.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4, 3) })); tip.position.set(620, 200, -380); scene.add(tip);
}

const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0').multiplyScalar(6) });
// ---------- built route: parking lot, straight stairs, shop plaza, circular plaza ----------
const pathLights = [];
{
  const wallMat = new THREE.MeshStandardMaterial({ map: rep(canvasTex(256, 256, (c, w) => { c.fillStyle = '#6f675f'; c.fillRect(0, 0, w, w); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const v = 90 + Math.random() * 40 | 0; c.fillStyle = `rgb(${v},${v - 6},${v - 14})`; c.fillRect(x * 64 + (y % 2) * 32 - 32 + 2, y * 32 + 2, 60, 28); c.fillRect(x * 64 + (y % 2) * 32 + 32 + 2, y * 32 + 2, 60, 28); } })), roughness: 0.9 });
  const asphalt = new THREE.MeshStandardMaterial({ roughness: 0.85, map: canvasTex(1024, 1024, (c, w) => { c.fillStyle = '#2b2b31'; c.fillRect(0, 0, w, w); for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 30 | 0; c.fillStyle = `rgb(${v},${v},${v + 4})`; c.fillRect(Math.random() * w, Math.random() * w, 2, 2); } c.strokeStyle = '#e8e8e0'; c.lineWidth = 5; const sx = w / 44, sz = w / 40; for (const zr of [[2, 8], [24, 30]]) for (let x = -20; x <= 20; x += 2.6) { if (Math.abs(x) < 5) continue; c.beginPath(); c.moveTo((x + 22) * sx, zr[0] * sz); c.lineTo((x + 22) * sx, zr[1] * sz); c.stroke(); } c.setLineDash([30, 30]); c.strokeStyle = '#f0c040'; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, w); c.stroke(); }) });
  const tile = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.7, metalness: 0.05 });
  const slab = (w, top, z0, z1, topMat, us) => { const h = top + 72; const g = new THREE.BoxGeometry(w, h, z1 - z0); const mats = [wallMat, wallMat, topMat, wallMat, wallMat, wallMat]; if (us) uvScale(g, us); const me = new THREE.Mesh(g, mats); me.position.set(0, top - h / 2, (z0 + z1) / 2); me.receiveShadow = true; scene.add(me); groundMeshes.push(me); return me; };
  slab(PK.x * 2, PK.y, PK.z0, PK.z1, asphalt);
  // the asphalt texture shouldn't repeat on the walls -> walls get repeat via separate uv scale
  slab(PZ.x * 2, PZ.y, PZ.z0, PZ.z1, tile);
  wallMat.map.repeat.set(10, 10);
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(6, 6);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(FR + 0.6, FR + 0.6, 72, 96), [wallMat, tile, wallMat]); disc.position.y = -36; disc.receiveShadow = true; scene.add(disc); groundMeshes.push(disc);
  // straight stairs (each step is a tall box down to the hillside)
  const stepMat = new THREE.MeshStandardMaterial({ color: '#a49688', roughness: 0.8 });
  const steps = [], rails = [], iron = new THREE.MeshStandardMaterial({ color: '#2b2b30', metalness: 0.85, roughness: 0.4 });
  const bulbGeo = new THREE.SphereGeometry(0.22, 12, 8);
  for (const [S, n] of [[S1, N1], [S2, N2]]) {
    const d = (S.z1 - S.z0) / n, rise = (S.y0 - S.y1) / n;
    for (let i = 0; i < n; i++) { const top = S.y1 + (i + 1) * rise, h = top + 72; steps.push(new THREE.BoxGeometry(S.w, h, d + 0.02).translate(0, top - h / 2, S.z1 - (i + 0.5) * d).toNonIndexed()); }
    const len = Math.hypot(S.z1 - S.z0, S.y0 - S.y1), ang = Math.atan2(S.y0 - S.y1, S.z1 - S.z0);
    for (const sx of [-1, 1]) {
      const wall = new THREE.BoxGeometry(0.35, 1.8, len); wall.rotateX(ang); wall.translate(sx * (S.w / 2 + 0.17), (S.y0 + S.y1) / 2 + 0.55, (S.z0 + S.z1) / 2); steps.push(wall.toNonIndexed());
      const rail = new THREE.CylinderGeometry(0.04, 0.04, len, 6); rail.rotateX(Math.PI / 2 + ang); rail.translate(sx * (S.w / 2 + 0.17), (S.y0 + S.y1) / 2 + 1.55, (S.z0 + S.z1) / 2); rails.push(rail.toNonIndexed());
      for (let z = S.z0 + 3; z < S.z1; z += 7.5) { const y = stairY(S, n, z); rails.push(new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8).translate(sx * (S.w / 2 + 0.17), y + 1.8 + 0.4, z).toNonIndexed()); const b = new THREE.Mesh(bulbGeo, lampMat); b.position.set(sx * (S.w / 2 + 0.17), y + 4.3, z); scene.add(b); if (pathLights.length < 6 && sx > 0 && Math.round(z) % 2) { const pl = new THREE.PointLight('#ffc98a', 12, 14, 2); pl.position.copy(b.position); scene.add(pl); pathLights.push(pl); } }
    }
  }
  const sm = new THREE.Mesh(mergeGeometries(steps.map(g => { g.clearGroups(); return g; })), stepMat); sm.receiveShadow = sm.castShadow = true; scene.add(sm); groundMeshes.push(sm);
  // plaza + parking lot lamps
  for (const [x, z, y] of [[-20, 64, PZ.y], [20, 64, PZ.y], [-20, 108, PZ.y], [20, 108, PZ.y], [-6, 79, PZ.y], [6, 93, PZ.y], [-20, 142, PK.y], [20, 142, PK.y], [-20, 178, PK.y], [20, 178, PK.y], [5, 160, PK.y]]) { rails.push(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 8).translate(x, y + 2.1, z).toNonIndexed()); const b = new THREE.Mesh(bulbGeo, lampMat); b.position.set(x, y + 4.3, z); scene.add(b); }
  // perimeter railings for the two wide areas
  for (const [A, y] of [[PZ, PZ.y], [PK, PK.y]]) for (const sx of [-1, 1]) { const len = A.z1 - A.z0; const r = new THREE.CylinderGeometry(0.04, 0.04, len, 6); r.rotateX(Math.PI / 2); r.translate(sx * (A.x - 0.1), y + 1.0, (A.z0 + A.z1) / 2); rails.push(r.toNonIndexed()); for (let z = A.z0; z <= A.z1; z += 2) rails.push(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6).translate(sx * (A.x - 0.1), y + 0.5, z).toNonIndexed()); }
  for (const [A, y, zEdge] of [[PZ, PZ.y, PZ.z0], [PZ, PZ.y, PZ.z1], [PK, PK.y, PK.z0], [PK, PK.y, PK.z1]]) for (const sx of [-1, 1]) { const len = A.x - S1.w / 2 - 0.4; const r = new THREE.CylinderGeometry(0.04, 0.04, len, 6); r.rotateZ(Math.PI / 2); r.translate(sx * (S1.w / 2 + 0.4 + len / 2), y + 1.0, zEdge + (zEdge === A.z0 ? 0.1 : -0.1)); rails.push(r.toNonIndexed()); }
  const rm = new THREE.Mesh(mergeGeometries(rails.map(g => { g.clearGroups(); return g; })), iron); rm.castShadow = true; scene.add(rm);
  // string lights over the shop plaza
  const bulbG = new THREE.SphereGeometry(0.07, 8, 6); stringMats = ['#ff7eb6', '#ffd27a', '#8fd0ff', '#b6ff8f'].map(c => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2) }); m.userData.base = new THREE.Color(c); return m; });
  const bulbs = stringMats.map(() => []);
  for (let z = 66; z <= 106; z += 5) for (let x = -11; x <= 11; x += 0.9) { const y = PZ.y + 4.6 - (1 - (x / 11) ** 2) * 0.8; bulbs[Math.abs(Math.round(x * 10 + z)) % 4].push(new THREE.Vector3(x, y, z)); }
  bulbs.forEach((list, i) => { const im = new THREE.InstancedMesh(bulbG, stringMats[i], list.length); list.forEach((p, j) => im.setMatrixAt(j, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); scene.add(im); });
  for (let z = 66; z <= 106; z += 5) for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.8, 6), iron); p.position.set(sx * 11.2, PZ.y + 2.4, z); scene.add(p); }
  // parked cars
  const carCols = ['#c0392b', '#ecf0f1', '#2c3e50', '#f1c40f', '#7f8c8d', '#16a085', '#8e44ad'];
  let ci = 0; for (const zc of [145, 167]) for (let x = -18.7; x <= 18.7; x += 2.6) { if (Math.abs(x) < 5 || Math.random() < 0.3) continue; const car = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4), new THREE.MeshStandardMaterial({ color: carCols[ci++ % carCols.length], metalness: 0.7, roughness: 0.25 })); body.position.y = 0.55; const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.1), new THREE.MeshStandardMaterial({ color: '#1b2430', metalness: 0.9, roughness: 0.1 })); top.position.set(0, 1.15, -0.2); car.add(body, top); car.traverse(o => o.castShadow = true); car.position.set(x, PK.y, zc + 3); scene.add(car); }
  // bus stop
  const bus = new THREE.Group(); const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 1.6), iron); roof.position.y = 2.5; const back = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.06), new THREE.MeshStandardMaterial({ color: '#9fc6e0', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.45 })); back.position.set(0, 1.3, -0.75); const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: '#8a5a3a' })); bench.position.set(0, 0.5, -0.4);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, (g2, w, h) => { g2.fillStyle = '#0f6a3a'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#fff'; g2.font = 'bold 30px sans-serif'; g2.textAlign = 'center'; g2.fillText('남산공원 주차장', w / 2, 52); g2.font = '22px sans-serif'; g2.fillText('🚌 01A · N서울타워 ↑', w / 2, 96); }) }));
  sign.position.set(0, 2.1, -0.71); bus.add(roof, back, bench, sign); bus.traverse(o => o.castShadow = true);
  bus.position.set(9, PK.y, 176); bus.rotation.y = Math.PI; scene.add(bus);
}

// ---------- N Seoul Tower ----------
const towerLights = [];
{
  const concrete = new THREE.MeshStandardMaterial({ color: '#d9d4cf', roughness: 0.55, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: '#202838', roughness: 0.05, metalness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c9c9c9', roughness: 0.3, metalness: 0.9 });
  const g = new THREE.Group();
  const add = (geo, mat, y) => { const me = new THREE.Mesh(geo, mat); me.position.y = y; me.castShadow = me.receiveShadow = true; g.add(me); return me; };
  add(new THREE.CylinderGeometry(6, 7, 6, 32), concrete, 3);
  add(new THREE.CylinderGeometry(2.6, 3.4, 62, 32), concrete, 36);
  add(new THREE.CylinderGeometry(7.5, 5, 3, 40), concrete, 66);
  add(new THREE.CylinderGeometry(8, 8, 5, 40), glass, 70);
  add(new THREE.CylinderGeometry(8.6, 8, 1, 40), concrete, 73);
  add(new THREE.CylinderGeometry(7, 7, 4, 40), glass, 75.5);
  add(new THREE.CylinderGeometry(4, 7.4, 3, 40), concrete, 79);
  add(new THREE.CylinderGeometry(1.8, 2.4, 12, 16), steel, 86);
  add(new THREE.CylinderGeometry(0.7, 1.4, 30, 12), new THREE.MeshStandardMaterial({ color: '#c8352f', roughness: 0.4, metalness: 0.4 }), 106);
  for (const [y, r, c] of [[68.6, 8.05, '#ff6fa8'], [72.6, 8.05, '#8fb9ff'], [77.6, 7.05, '#ffd27a'], [121, 0.8, '#ff3030']]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 80), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(5), fog: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); towerLights.push(ring);
  }
  scene.add(g);
}
// lamps inside the circular plaza
const pointLights = [];
for (let i = 0; i < 8; i++) {
  const a = i / 8 * Math.PI * 2 + 0.2, r = 15;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4, 8), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.8, roughness: 0.35 }));
  pole.position.set(Math.cos(a) * r, 2, Math.sin(a) * r); pole.castShadow = true; scene.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), lampMat); bulb.position.set(pole.position.x, 4.1, pole.position.z); scene.add(bulb);
  if (i % 2 === 0) { const pl = new THREE.PointLight('#ffc98a', 18, 16, 2); pl.position.copy(bulb.position); scene.add(pl); pointLights.push(pl); }
}

// ---------- the tall ring fence ----------
// slot = row * NCOL + col  (row 0 = 0.6 m … row 26 = 11.0 m). 27*360 = 9720 slots (< DB check 10000)
const ROWS = [...Array(27)].map((_, i) => 0.6 + i * 0.4);
const NCOL = 360, SLOTS = ROWS.length * NCOL, REACH_ROW = 2;
const GATE_A = Math.PI / 2, GATE_HALF_A = GATE_HALF / FR;
const colAngle = (c) => (c + 0.5) / NCOL * Math.PI * 2;
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const isGateCol = (c) => angDiff(colAngle(c), GATE_A) < GATE_HALF_A + 0.015;
function slotInfo(slot) {
  const row = Math.floor(slot / NCOL), col = slot % NCOL, a = colAngle(col), rr = FR - 0.05;
  return { pos: new THREE.Vector3(Math.cos(a) * rr, (ROWS[row] ?? 1) - 0.1, Math.sin(a) * rr), yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), row, col };
}
let fenceGlow;
{
  const metal = new THREE.MeshStandardMaterial({ color: '#3a3a40', metalness: 0.9, roughness: 0.35 });
  const parts = []; const arc = Math.PI * 2 - GATE_HALF_A * 2, start = GATE_A + GATE_HALF_A;
  const ring = (h, tube, seg = 256) => { const g = new THREE.TorusGeometry(FR, tube, 5, seg, arc); g.rotateX(Math.PI / 2); g.rotateY(-start); g.translate(0, h, 0); return g.toNonIndexed(); };
  for (const h of ROWS) parts.push(ring(h, 0.012));
  for (const h of [0.15, 4.2, 8.2, FH]) parts.push(ring(h, 0.06));
  for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; if (angDiff(a, GATE_A) < GATE_HALF_A + 0.02) continue; parts.push(new THREE.CylinderGeometry(0.06, 0.07, FH, 8).translate(Math.cos(a) * FR, FH / 2, Math.sin(a) * FR).toNonIndexed()); }
  for (const s of [-1, 1]) { const a = GATE_A + s * GATE_HALF_A; parts.push(new THREE.CylinderGeometry(0.2, 0.24, FH + 1, 16).translate(Math.cos(a) * FR, (FH + 1) / 2, Math.sin(a) * FR).toNonIndexed()); }
  const fence = new THREE.Mesh(mergeGeometries(parts.map(g => { g.clearGroups(); return g; })), metal); fence.castShadow = true; fence.receiveShadow = true; scene.add(fence);
  // LED crown + gate sign
  fenceGlow = new THREE.Mesh(new THREE.TorusGeometry(FR, 0.05, 6, 256, arc).rotateX(Math.PI / 2).rotateY(-start).translate(0, FH + 0.12, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7eb6').multiplyScalar(3) })); scene.add(fenceGlow);
  const gs = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.0), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: canvasTex(512, 116, (c, w, h) => { c.fillStyle = '#2a1030'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd1e0'; c.font = 'bold 56px sans-serif'; c.textAlign = 'center'; c.fillText('💗 사랑의 자물쇠', w / 2, 78); }) }));
  gs.position.set(0, FH - 0.4, FR + 0.05); scene.add(gs);
}

// ---------- lock models ----------
const TYPES = {
  'heart-red': { name: '빨강 하트', color: '#d81e45', shape: 'heart' },
  'heart-pink': { name: '분홍 하트', color: '#ff7eb6', shape: 'heart' },
  'classic-gold': { name: '골드', color: '#e5b84b', shape: 'classic' },
  'classic-silver': { name: '실버', color: '#cfd4da', shape: 'classic' },
  'round-blue': { name: '파랑 원형', color: '#3c7fe0', shape: 'round' },
  'round-green': { name: '초록 원형', color: '#35b56f', shape: 'round' },
  'star-purple': { name: '보라 별', color: '#9a5ee0', shape: 'star' },
  'key-black': { name: '블랙 키', color: '#2a2a2e', shape: 'key' },
};
function lockGeometry(shape) {
  const S = 0.13; let body;
  const ext = (sh, d) => new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 16 }).translate(0, 0, -d / 2);
  if (shape === 'heart') { const h = new THREE.Shape(); h.moveTo(0, -0.06); h.bezierCurveTo(-0.09, 0.0, -0.075, 0.07, -0.035, 0.065); h.bezierCurveTo(-0.01, 0.06, 0, 0.04, 0, 0.035); h.bezierCurveTo(0, 0.04, 0.01, 0.06, 0.035, 0.065); h.bezierCurveTo(0.075, 0.07, 0.09, 0, 0, -0.06); body = ext(h, 0.025); }
  else if (shape === 'star') { const h = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.03 : 0.07, a = i / 10 * Math.PI * 2 + Math.PI / 2; i ? h.lineTo(Math.cos(a) * r, Math.sin(a) * r) : h.moveTo(Math.cos(a) * r, Math.sin(a) * r); } body = ext(h, 0.025); }
  else if (shape === 'round') { body = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 32).rotateX(Math.PI / 2); }
  else { const h = new THREE.Shape(); const w = shape === 'key' ? 0.045 : 0.05, hh = 0.055, r = 0.012; h.moveTo(-w + r, -hh); h.lineTo(w - r, -hh); h.quadraticCurveTo(w, -hh, w, -hh + r); h.lineTo(w, hh - r); h.quadraticCurveTo(w, hh, w - r, hh); h.lineTo(-w + r, hh); h.quadraticCurveTo(-w, hh, -w, hh - r); h.lineTo(-w, -hh + r); h.quadraticCurveTo(-w, -hh, -w + r, -hh); body = ext(h, 0.03); }
  const shackle = new THREE.TorusGeometry(0.032, 0.007, 10, 24, Math.PI).translate(0, 0.06, 0);
  const legs = [-1, 1].map(s => new THREE.CylinderGeometry(0.007, 0.007, 0.03, 8).translate(s * 0.032, 0.05, 0));
  const g = mergeGeometries([body, shackle, ...legs].map(x => (x.index ? x.toNonIndexed() : x)).map(x => { x.clearGroups(); return x; }));
  g.scale(S / 0.13 * 1.25, S / 0.13 * 1.25, S / 0.13 * 1.25); g.computeVertexNormals(); return g;
}
const geoCache = {}; const getGeo = (s) => geoCache[s] ||= lockGeometry(s);
const lockMat = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.4 });
const realMeshes = {}, decorMeshes = {};
const REAL_CAP = 3000; const DECOR_PER = quality === 'high' ? 650 : 350;
for (const [k, t] of Object.entries(TYPES)) {
  const real = new THREE.InstancedMesh(getGeo(t.shape), lockMat(t.color), REAL_CAP); real.count = 0; real.userData.type = k; real.castShadow = true; real.frustumCulled = false; scene.add(real); realMeshes[k] = real;
  const dm = new THREE.InstancedMesh(getGeo(t.shape), lockMat(t.color), DECOR_PER); dm.castShadow = true; scene.add(dm); decorMeshes[k] = dm;
}
// decorative "older" locks all over the tall fence (seeded per server), denser near the bottom
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function buildDecor(serverId) {
  const rnd = seeded(serverId * 9973 + 7); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const k of Object.keys(TYPES)) { const dm = decorMeshes[k];
    for (let i = 0; i < DECOR_PER; i++) { const col = rnd() * NCOL | 0, row = Math.min(ROWS.length - 1, Math.pow(rnd(), 1.5) * ROWS.length | 0); if (isGateCol(col)) { dm.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); rnd(); rnd(); rnd(); rnd(); rnd(); continue; }
      const a = colAngle(col) + (rnd() - 0.5) * (Math.PI * 2 / NCOL) * 0.8, rr = FR - 0.04 + rnd() * 0.03;
      const p = new THREE.Vector3(Math.cos(a) * rr, ROWS[row] - 0.1 - rnd() * 0.02, Math.sin(a) * rr);
      e.set((rnd() - 0.5) * 0.5, Math.atan2(-Math.cos(a), -Math.sin(a)) + (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.6); q.setFromEuler(e);
      const s = 0.8 + rnd() * 0.4; m.compose(p, q, new THREE.Vector3(s, s, s)); dm.setMatrixAt(i, m); }
    dm.instanceMatrix.needsUpdate = true; dm.computeBoundingSphere(); }
}

// ---------- merchants (data-driven, see merchants.js) ----------
const merchantObjs = MERCHANTS.map(cfg => {
  const g = new THREE.Group();
  if (cfg.x != null) { const y = groundY(cfg.x, cfg.z); g.position.set(cfg.x, y, cfg.z); const f = cfg.face || [0, cfg.z]; g.lookAt(f[0], y, f[1]); }
  else { g.position.set(Math.cos(cfg.angle) * cfg.radius, 0, Math.sin(cfg.angle) * cfg.radius); g.lookAt(0, 0, 0); }

  const wood = new THREE.MeshStandardMaterial({ color: '#7a4b2a', roughness: 0.7 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.9), wood); table.position.set(0, 0.45, 0.9);
  const awn = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.8, 16, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: cfg.awning, roughness: 0.6, side: THREE.DoubleSide }));
  awn.rotation.z = Math.PI / 2; awn.scale.set(1, 1, 0.5); awn.position.set(0, 2.5, 0.5);
  const poles = [-1.3, 1.3].flatMap(x => [0.2, 1.3].map(z => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5), wood); m.position.set(x, 1.25, z); return m; }));
  g.add(table, awn, ...poles);
  // display locks on the table
  cfg.inventory.forEach((k, i) => { const t = TYPES[k]; if (!t) return; const m = new THREE.Mesh(getGeo(t.shape), lockMat(t.color)); m.position.set(-1 + i * (2 / Math.max(1, cfg.inventory.length - 1)), 0.98, 1.05); m.scale.setScalar(1.6); g.add(m); });
  const plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(512, 128, (c, w, h) => { c.fillStyle = 'rgba(30,15,40,.85)'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 30); c.fill(); c.fillStyle = '#ffd1e0'; c.font = 'bold 52px sans-serif'; c.textAlign = 'center'; c.fillText('🔒 ' + cfg.name, w / 2, 84); }), depthWrite: false }));
  plate.scale.set(2.4, 0.6, 1); plate.position.set(0, 3.4, 0.5); g.add(plate);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g);
  g.updateMatrixWorld(); return { cfg, group: g, pos: g.localToWorld(new THREE.Vector3(0, 0, 0.9)), mixer: null };
});
let heldType = null, curZone = null;

// ---------- character ----------
const player = new THREE.Group(); scene.add(player); player.position.set(0, PK.y, LAYOUT.spawnZ);
let mixer, actions = {}, current;
const myMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7eb6').multiplyScalar(6) })); myMarker.visible = false; scene.add(myMarker);

// ---------- post processing / quality ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.5, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
function applyQuality() {
  const hi = quality === 'high';
  renderer.setPixelRatio(Math.min(devicePixelRatio, hi ? 2 : 1));
  renderer.shadowMap.enabled = true; sunLight.castShadow = hi; sunLight.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
  pointLights.forEach(p => p.visible = hi); pathLights.forEach(p => p.visible = hi);
  $('qualityBtn').textContent = hi ? '그래픽: 고품질' : '그래픽: 저사양';
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  resize();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
$('qualityBtn').onclick = () => { quality = quality === 'high' ? 'low' : 'high'; localStorage.setItem('namsan_q', quality); applyQuality(); };

// ---------- game state ----------
let serverId = null, locks = [], bySlot = new Map(), mine = {}, pendingSlot = null, selType = 'heart-red', inGame = false;
function rebuildLocks() {
  for (const mesh of Object.values(realMeshes)) { mesh.count = 0; mesh.userData.ids = []; }
  bySlot.clear(); const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const L of locks) { const mesh = realMeshes[L.lock_type]; if (!mesh) continue; const info = slotInfo(L.slot); const r = seeded(L.id + 11); q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, info.yaw, (r() - 0.5) * 0.4)); m.compose(info.pos, q, new THREE.Vector3(1.15, 1.15, 1.15)); mesh.setMatrixAt(mesh.count, m); mesh.userData.ids[mesh.count++] = L; bySlot.set(L.slot, L); }
  for (const mesh of Object.values(realMeshes)) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  const my = mine[serverId] && locks.find(l => l.id === mine[serverId]);
  myMarker.visible = !!my; if (my) myMarker.position.copy(slotInfo(my.slot).pos).setY(slotInfo(my.slot).pos.y + 0.22);
  $('lockCount').textContent = `🔒 ${locks.length}개`;
  $('status').textContent = mine[serverId] ? '💗 이 서버에 이미 자물쇠를 걸었어요 (분홍 표시)' : (heldType ? '펜스 가까이 가서 E를 눌러 자물쇠를 걸어보세요' : '계단 위 상점 광장에서 자물쇠 상인을 찾아가세요 · 클릭=걷기, 더블클릭=달리기');
}
async function loadLocks() { const { data, error } = await SB.from('namsan_locks').select(COLS).eq('server_id', serverId).order('id').limit(2000); if (!error) { locks = data; rebuildLocks(); } }
async function loadMine() { const { data } = await SB.rpc('namsan_mine', { p_device: device }); mine = {}; (data || []).forEach(r => mine[r.server_id] = r.id); }
async function showServers() {
  inGame = false; $('hud').classList.add('hidden'); $('servers').classList.remove('hidden');
  await loadMine();
  const list = $('serverList'); list.innerHTML = '';
  for (const s of SERVERS) {
    const { count } = await SB.from('namsan_locks').select('id', { count: 'exact', head: true }).eq('server_id', s.id);
    const b = document.createElement('button'); b.className = 'srv';
    b.innerHTML = `<span>${s.emoji} <b>${s.name}</b><br><small>${s.desc}</small></span><small>자물쇠 ${count ?? 0}개${mine[s.id] ? ' · 💗 내 자물쇠 있음' : ''}</small>`;
    b.onclick = () => enter(s); list.appendChild(b);
  }
}
async function enter(s) { serverId = s.id; $('srvName').textContent = s.emoji + ' ' + s.name; $('msg').placeholder = s.placeholder + ' (최대 60자)'; buildDecor(s.id); $('servers').classList.add('hidden'); $('hud').classList.remove('hidden'); inGame = true; curZone = null; dayK = 0; await loadLocks(); }
$('exitBtn').onclick = showServers;
setInterval(() => inGame && loadLocks(), 15000);

// lock type picker
for (const [k, t] of Object.entries(TYPES)) { const d = document.createElement('div'); d.className = 'type' + (k === selType ? ' sel' : ''); d.dataset.k = k; d.innerHTML = `<div class="sw" style="background:radial-gradient(circle at 30% 30%,#fff8,${t.color} 45%,#0006)"></div>${t.name}`; d.onclick = () => { selType = k; document.querySelectorAll('.type').forEach(x => x.classList.remove('sel')); d.classList.add('sel'); }; $('types').appendChild(d); }
let shopMerchant = null;
function openShop(m) { shopMerchant = m; $('shopName').textContent = '🔒 ' + m.cfg.name; $('shopGreet').textContent = mine[serverId] ? '이 서버에는 벌써 자물쇠를 걸었구먼! 또 와요~' : m.cfg.greeting; document.querySelectorAll('.type').forEach(d => d.style.display = m.cfg.inventory.includes(d.dataset.k) ? '' : 'none'); if (m.cfg.inventory.length && !m.cfg.inventory.includes(selType)) selType = m.cfg.inventory[0]; document.querySelectorAll('.type').forEach(d => d.classList.toggle('sel', d.dataset.k === selType)); const sells = m.cfg.inventory.length > 0; $('types').style.display = sells ? '' : 'none'; $('buyBtn').style.display = sells ? '' : 'none'; $('buyBtn').disabled = !!mine[serverId]; $('shop').classList.remove('hidden'); }
$('shopClose').onclick = () => $('shop').classList.add('hidden');
$('buyBtn').onclick = () => { heldType = selType; $('shop').classList.add('hidden'); flash(`${TYPES[heldType].name} 자물쇠를 받았어요! 펜스에 가서 걸어보세요.`); };
const ERR = { PROFANITY: '욕설이나 비속어가 포함되어 있어 걸 수 없어요.', ALREADY_HUNG: '이 서버에는 이미 자물쇠를 걸었어요. (1인 1개)', SLOT_TAKEN: '그 자리는 방금 다른 사람이 걸었어요. 옆자리로 가보세요.' };
function openModal() { if (mine[serverId]) return flash('이 서버에는 이미 자물쇠를 걸었어요. 수정·삭제는 할 수 없어요.'); if (pendingSlot == null) return; if (!heldType) return flash('먼저 상점가나 펜스 입구의 자물쇠 상인에게 자물쇠를 받으세요.'); selType = heldType; $('heldLock').textContent = '들고 있는 자물쇠: ' + TYPES[heldType].name; $('err').textContent = ''; $('hgt').max = ROWS.length - 1; $('hgt').value = REACH_ROW; updH(); $('modal').classList.remove('hidden'); $('msg').focus(); }
function updH() { const v = +$('hgt').value; $('hgtLbl').textContent = `${ROWS[v].toFixed(1)}m` + (v > 3 ? ' 🪜 사다리로 높이 걸기' : ' (눈높이)'); }
$('hgt').oninput = updH;
$('cancelBtn').onclick = () => $('modal').classList.add('hidden');
$('hangBtn').onclick = async () => {
  const msg = $('msg').value.trim(); if (!msg) { $('err').textContent = '메시지를 입력해주세요.'; return; }
  const slot = nearestFreeSlot(+$('hgt').value); if (slot == null) { $('err').textContent = '이 근처 그 높이에는 빈자리가 없어요. 옆으로 조금 이동해보세요.'; return; }
  $('hangBtn').disabled = true; $('err').textContent = '';
  const { data, error } = await SB.rpc('namsan_hang', { p_device: device, p_server: serverId, p_type: selType, p_message: msg, p_nickname: $('nick').value.trim(), p_slot: slot });
  $('hangBtn').disabled = false;
  if (error) { const key = Object.keys(ERR).find(k => error.message.includes(k)); $('err').textContent = ERR[key] || ('오류: ' + error.message); if (key === 'SLOT_TAKEN' || key === 'ALREADY_HUNG') { await loadMine(); loadLocks(); } return; }
  mine[serverId] = data; $('modal').classList.add('hidden'); $('msg').value = ''; await loadLocks(); flash('💗 자물쇠를 걸었어요! 영원히 남아요.');
};
let flashT; function flash(t) { const p = $('status'); p.textContent = t; clearTimeout(flashT); flashT = setTimeout(rebuildLocks, 5000); }
const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function showLock(L) { $('viewBody').innerHTML = `<div style="font-size:13px;opacity:.7">${esc(TYPES[L.lock_type]?.name || '')} · ${new Date(L.created_at).toLocaleDateString('ko-KR')}</div><div style="font-size:20px;margin:8px 0">“${esc(L.message)}”</div><div>— ${esc(L.nickname)}${L.id === mine[serverId] ? ' (나)' : ''}</div>`; $('view').classList.remove('hidden'); }
$('viewClose').onclick = () => $('view').classList.add('hidden');

// ---------- input ----------
const keys = {}; const modalOpen = () => !$('shop').classList.contains('hidden') || !$('modal').classList.contains('hidden') || !$('view').classList.contains('hidden');
addEventListener('keydown', e => { if (modalOpen() || !inGame) return; keys[e.code] = true; if (e.code === 'KeyE') interact(); });
addEventListener('keyup', e => keys[e.code] = false);
let yaw = 0, pitch = 0.25, dist = 5.5; const drag = new Map(); let moveTo = null;
const cv = $('c'); const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
cv.addEventListener('pointerdown', e => { drag.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { const d = drag.get(e.pointerId); if (!d) return hover(e); yaw -= (e.clientX - d.x) * 0.005; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - d.y) * 0.004, -0.75, 1.2); d.x = e.clientX; d.y = e.clientY; });
cv.addEventListener('pointerup', e => { const d = drag.get(e.pointerId); drag.delete(e.pointerId); if (d && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6 && inGame && !modalOpen()) { const L = pick(e); if (L) return showLock(L); const g = pickGround(e); if (g) moveTo = { x: g.x, z: g.z, run: performance.now() - lastClick < 350 }; lastClick = performance.now(); } });
let lastClick = 0; const clickMark = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9ec8').multiplyScalar(2), transparent: true, opacity: 0.85, depthWrite: false })); clickMark.visible = false; scene.add(clickMark);
function pickGround(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(groundMeshes, false).find(h => h.face && h.face.normal.y > 0.5 || h.object.isMesh && h.point.y > -60); if (!hit) return null; const { x, z } = hit.point; return walkable(x, z) ? { x, z } : null; }
cv.addEventListener('wheel', e => { dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.004, 2.2, 14); }, { passive: true });
function pick(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(Object.values(realMeshes), false)[0]; return hit && hit.object.userData.ids[hit.instanceId]; }
function hover(e) { if (!inGame) return; const L = pick(e); cv.style.cursor = L ? 'pointer' : ''; }
// joystick
const joy = { x: 0, y: 0, id: null }; const J = $('joy'), K = $('knob');
J.addEventListener('pointerdown', e => { joy.id = e.pointerId; J.setPointerCapture(e.pointerId); moveJoy(e); });
J.addEventListener('pointermove', e => e.pointerId === joy.id && moveJoy(e));
J.addEventListener('pointerup', () => { joy.id = null; joy.x = joy.y = 0; K.style.transform = ''; });
function moveJoy(e) { const r = J.getBoundingClientRect(); let x = (e.clientX - r.left - 60) / 50, y = (e.clientY - r.top - 60) / 50; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy.x = x; joy.y = y; K.style.transform = `translate(${x * 35}px,${y * 35}px)`; }
let nearMerchant = null; function interact() { nearMerchant ? openShop(nearMerchant) : openModal(); }
$('actBtn').onclick = interact;

// ---------- loop ----------
const clock = new THREE.Clock(); const tmp = new THREE.Vector3(); let facing = 0;
function nearestFreeSlot(prefRow = REACH_ROW) {
  const p = player.position; const r = Math.hypot(p.x, p.z); if (r < FR - 2.4 || r > FR + 0.2) return null;
  const a = Math.atan2(p.z, p.x); const c0 = Math.round(((a / (Math.PI * 2)) % 1 + 1) % 1 * NCOL - 0.5);
  let best = null, bd = 1e9;
  for (let dc = -6; dc <= 6; dc++) { const col = ((c0 + dc) % NCOL + NCOL) % NCOL; if (isGateCol(col)) continue;
    for (let dr = -2; dr <= 2; dr++) { const row = prefRow + dr; if (row < 0 || row >= ROWS.length) continue; const s = row * NCOL + col; if (bySlot.has(s)) continue; const d = Math.abs(dc) + Math.abs(dr) * 3; if (d < bd) { bd = d; best = s; } } }
  return best;
}
function nearestLock() { let best = null, bd = 2.0; for (const L of locks) { const d = slotInfo(L.slot).pos.distanceTo(tmp.copy(player.position).setY(1)); if (d < bd) { bd = d; best = L; } } return best; }
let retarget = null;
function bindRots(root) { const out = {}; root.updateMatrixWorld(true); const ri = new THREE.Quaternion(); root.matrixWorld.decompose(new THREE.Vector3(), ri, new THREE.Vector3()); ri.invert(); root.traverse(o => { if (o.isBone) { const q = new THREE.Quaternion(); o.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); out[o.name] = q.premultiply(ri); } }); return out; }
const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), FLIP_INV = FLIP.clone().invert(); // user model faces +Z, Soldier faces -Z
function makeRetarget(src, tgt, ref) {
  // Soldier's node rest pose isn't a T-pose but its skin bind pose is: snap it to bind pose (skeleton.pose()) and read rotations.
  const tb = bindRots(tgt); ref.traverse(o => o.isSkinnedMesh && o.skeleton.pose()); const sb = bindRots(ref); const sBones = {}; src.traverse(o => o.isBone && (sBones[o.name] = o));
  const list = []; tgt.traverse(o => { if (o.isBone && sBones[o.name] && sb[o.name] && tb[o.name]) list.push({ t: o, s: sBones[o.name], sInv: sb[o.name].clone().invert(), tr: tb[o.name] }); });
  const qs = new THREE.Quaternion(), rootQ = new THREE.Quaternion(), pq = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), want = new THREE.Quaternion();
  return () => {
    src.updateMatrixWorld(true); src.matrixWorld.decompose(tmpV, rootQ, tmpS); rootQ.invert();
    tgt.updateMatrixWorld(true); const tRootInv = new THREE.Quaternion(); tgt.matrixWorld.decompose(tmpV, tRootInv, tmpS); tRootInv.invert();
    for (const e of list) { // parent-first order (traverse)
      e.s.matrixWorld.decompose(tmpV, qs, tmpS); qs.premultiply(rootQ); want.copy(qs).multiply(e.sInv).premultiply(FLIP).multiply(FLIP_INV).multiply(e.tr); // delta from rest, mirrored into target's facing frame
      e.t.parent.updateMatrixWorld(); e.t.parent.matrixWorld.decompose(tmpV, pq, tmpS); pq.premultiply(tRootInv);
      e.t.quaternion.copy(pq.invert().multiply(want)); e.t.updateMatrixWorld(true);
    }
  };
}
let dayK = 0; const C_SUN = new THREE.Color('#ffad74'), C_MOON = new THREE.Color('#7f8fff'), C_HEMI = new THREE.Color('#a796d6'), C_HEMI_N = new THREE.Color('#3a4580'), FOG_N = new THREE.Color('#141a30'), C_LAMP = new THREE.Color('#ffd7a0');
function setAction(name) { if (!actions[name] || current === actions[name]) return; actions[name].reset().fadeIn(0.25).play(); current?.fadeOut(0.25); current = actions[name]; }
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (inGame && !modalOpen()) {
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
    const l = Math.hypot(ix, iz); let run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > 0.9;
    let dx = 0, dz = 0; const P = player.position;
    if (l > 0.1) { moveTo = null; ix /= Math.max(l, 1); iz /= Math.max(l, 1);
      const sp = run ? 5.2 : 2.2; const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      dx = (fx * -iz + -fz * ix) * sp * dt; dz = (fz * -iz + fx * ix) * sp * dt; // right = forward × up
    } else if (moveTo) { // click-to-move (click = walk, double-click = run)
      run = moveTo.run; const vx = moveTo.x - P.x, vz = moveTo.z - P.z, dd = Math.hypot(vx, vz);
      if (dd < 0.2) moveTo = null; else { const st = Math.min(dd, (run ? 5.2 : 2.2) * dt); dx = vx / dd * st; dz = vz / dd * st; }
    }
    clickMark.visible = !!moveTo; if (moveTo) { clickMark.position.set(moveTo.x, groundY(moveTo.x, moveTo.z) + 0.05, moveTo.z); clickMark.scale.setScalar(1 + Math.sin(t * 6) * 0.15); }
    if (dx || dz) { facing = Math.atan2(dx, dz); const ox = P.x, oz = P.z;
      if (walkable(P.x + dx, P.z + dz)) { P.x += dx; P.z += dz; } else if (walkable(P.x + dx, P.z)) P.x += dx; else if (walkable(P.x, P.z + dz)) P.z += dz;
      if (merchantObjs.some(m => Math.hypot(P.x - m.pos.x, P.z - m.pos.z) < 1.1)) { P.x = ox; P.z = oz; }
      if (moveTo && P.x === ox && P.z === oz) moveTo = null; // blocked
      setAction(run ? 'Run' : 'Walk'); } else setAction('Idle');
    if (player.children[0]) { const cur = player.children[0].rotation.y; let d = facing - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); player.children[0].rotation.y = cur + d * Math.min(1, dt * 10); }
    { const P = player.position, r = Math.hypot(P.x, P.z); const zn = ZONES.find(z => z.test(P.x, P.z)).name; if (zn !== curZone) { curZone = zn; const zt = $('zone'); zt.textContent = zn; zt.classList.remove('show'); void zt.offsetWidth; zt.classList.add('show'); } }
    pendingSlot = mine[serverId] ? null : nearestFreeSlot();
    const pr = $('prompt'); const nl = nearestLock();
    nearMerchant = merchantObjs.find(m => Math.hypot(player.position.x - m.pos.x, player.position.z - m.pos.z) < 2.8) || null;
    const touch = matchMedia('(pointer:coarse)').matches;
    if (nearMerchant) { pr.textContent = (touch ? '버튼' : 'E 키') + `: ${nearMerchant.cfg.name}와 대화하기`; pr.classList.remove('hidden'); }
    else if (pendingSlot != null) { pr.textContent = heldType ? (touch ? '🔒 버튼을 눌러 자물쇠 걸기' : 'E 키를 눌러 자물쇠 걸기') : '자물쇠가 없어요 · 자물쇠 상인에게 먼저 가보세요'; pr.classList.remove('hidden'); } else pr.classList.add('hidden');
    $('actBtn').classList.toggle('hidden', !nearMerchant && pendingSlot == null); $('actBtn').textContent = nearMerchant ? '💬' : '🔒';
    const tip = $('tip'); if (nl) { const sp = slotInfo(nl.slot).pos.clone().project(camera); tip.style.left = (sp.x + 1) / 2 * innerWidth + 'px'; tip.style.top = (1 - sp.y) / 2 * innerHeight + 'px'; tip.innerHTML = `“${esc(nl.message)}”<br><small>— ${esc(nl.nickname)}</small>`; tip.classList.remove('hidden'); } else tip.classList.add('hidden');
  } else { $('tip').classList.add('hidden'); if (!inGame) yaw += dt * 0.05; }
  { const P = player.position, gy = groundY(P.x, P.z) + 0.02; P.y = Math.abs(gy - P.y) > 2 ? gy : P.y + (gy - P.y) * Math.min(1, dt * 14); }
  mixer?.update(dt); retarget?.(); merchantObjs.forEach(m => m.mixer?.update(dt));
  const target = tmp.copy(player.position).add(new THREE.Vector3(0, 1.5, 0));
  const cd = inGame ? dist : 30; const cp = inGame ? pitch : 0.18;
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(cp) * cd, target.y + Math.sin(cp) * cd, target.z + Math.cos(yaw) * Math.cos(cp) * cd);
  camera.position.y = Math.max(camera.position.y, (walkable(camera.position.x, camera.position.z) ? groundY(camera.position.x, camera.position.z) : -70) + 0.4); camera.lookAt(inGame ? target : new THREE.Vector3(0, 25, 0));
  sunLight.target.position.copy(player.position); sunLight.position.copy(player.position).add(new THREE.Vector3(sun.x, 0.35, sun.z).normalize().multiplyScalar(80));
  // ---- time of day tied to route progress (0 = parking lot sunset, 1 = fence night) ----
  { const P = player.position; const target = !inGame ? 0.55 : routeT(P.x, P.z); dayK += (target - dayK) * Math.min(1, dt * 1.5); }
  const k = dayK, L = THREE.MathUtils.lerp, ss = THREE.MathUtils.smoothstep;
  sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(L(85.5, 97, k)), THREE.MathUtils.degToRad(-120));
  const su = skyMain.material.uniforms; su.sunPosition.value.copy(sun); su.rayleigh.value = L(2.6, 0.6, k); su.turbidity.value = L(9, 2, k);
  sunLight.intensity = L(3.2, 0.35, ss(k, 0, 0.8)); sunLight.color.lerpColors(C_SUN, C_MOON, ss(k, 0.2, 0.9));
  hemi.intensity = L(1.1, 0.4, k); hemi.color.lerpColors(C_HEMI, C_HEMI_N, k);
  scene.fog.color.lerpColors(FOG, FOG_N, ss(k, 0, 0.9)); scene.environmentIntensity = L(0.7, 0.18, k);
  renderer.toneMappingExposure = L(0.85, 1.0, k); bloom.strength = L(0.35, 0.85, k);
  const glow = L(1, 3, ss(k, 0.1, 1));
  skylineMat.emissiveIntensity = 1.2 * glow; lampMat.color.copy(C_LAMP).multiplyScalar(2.2 * glow); stringMats.forEach(m => m.color.copy(m.userData.base).multiplyScalar(1.2 * glow));
  pointLights.concat(pathLights).forEach(pl => pl.intensity = (pl.userData.base ??= pl.intensity) * L(0.5, 1.6, k));
  fenceGlow.material.color.setHSL((t * 0.03) % 1, 0.7, 0.6).multiplyScalar(1.5 * glow);
  towerLights.forEach((r, i) => r.material.color.setHSL((t * 0.05 + i * 0.25) % 1, 0.8, 0.6).multiplyScalar(2.5 * glow));
  myMarker.rotation.y = t * 2;
  quality === 'high' ? composer.render() : renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ---------- boot ----------
applyQuality();
const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loadGLB = (f) => new Promise((res, rej) => gl.load(import.meta.env.BASE_URL + 'models/' + f, res, (p) => { $('loadmsg').textContent = `캐릭터 불러오는 중… ${p.total ? Math.round(p.loaded / p.total * 100) : ''}%`; }, rej));
Promise.all([loadGLB('character.glb'), loadGLB('soldier.glb')]).then(([c, g]) => {
  const m = c.scene; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  facing = Math.PI; m.rotation.y = facing; player.add(m);
  // user character has no animations -> drive it from a hidden Soldier rig (same mixamorig bone names),
  // retargeted in world space using each rig's bind pose so differing rest orientations don't break it.
  const src = skClone(g.scene); src.visible = false; scene.add(src);
  mixer = new THREE.AnimationMixer(src); for (const clip of g.animations) actions[clip.name] = mixer.clipAction(clip);
  const ref = skClone(g.scene); retarget = makeRetarget(src, m, ref);
  setAction('Idle');
  for (const mo of merchantObjs) { const npc = skClone(g.scene); npc.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#e8b9c9'); } }); npc.position.set(0, 0, -0.1); npc.rotation.y = Math.PI; mo.group.add(npc); mo.mixer = new THREE.AnimationMixer(npc); const idle = g.animations.find(c => c.name === 'Idle'); idle && mo.mixer.clipAction(idle).play(); }
  $('loading').classList.add('hidden'); showServers();
}).catch((e) => { console.error(e); $('loading').classList.add('hidden'); showServers(); });
tick();
window.__game = { player, camera, setYaw: (v) => yaw = v, setPitch: (v) => pitch = v, groundY, walkable, LAYOUT, walkTo: (x, z, run) => moveTo = { x, z, run } };
