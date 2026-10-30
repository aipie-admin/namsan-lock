import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createClient } from '@supabase/supabase-js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { MERCHANTS, GATE_ANGLE, ZONES } from './merchants.js';

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
// ---------- terrain ----------
const PLAZA = 30;
const hillY = (r) => r < PLAZA ? 0 : r < 112 ? -22 * THREE.MathUtils.smoothstep(r, PLAZA, 112) : r < 122 ? -22 : -22 - 40 * THREE.MathUtils.smoothstep(r, 122, 178);
// winding uphill path: parking lot (bottom) -> plaza gate
const PATH = [];
for (let k = 0; k <= 80; k++) { const u = k / 80; const th = GATE_ANGLE + 1.5 * (1 - u) + Math.sin(u * 9) * 0.06 * (1 - u); const r = 31 + 77 * Math.pow(1 - u, 1.15) + Math.sin(u * 14) * 2.5 * (1 - u); PATH.push(new THREE.Vector2(Math.cos(th) * r, Math.sin(th) * r)); }
PATH.push(new THREE.Vector2(Math.cos(GATE_ANGLE) * 26, Math.sin(GATE_ANGLE) * 26));
let PATH_LEN = 0; const CUM = [0]; for (let i = 1; i < PATH.length; i++) { PATH_LEN += PATH[i].distanceTo(PATH[i - 1]); CUM.push(PATH_LEN); }
function pathAt(t) { const L = t * PATH_LEN; let i = 1; while (i < PATH.length - 1 && CUM[i] < L) i++; const a = PATH[i - 1], b = PATH[i]; const f = (L - CUM[i - 1]) / (CUM[i] - CUM[i - 1] || 1); const dir = b.clone().sub(a).normalize(); return { pos: a.clone().lerp(b, THREE.MathUtils.clamp(f, 0, 1)), dir, n: new THREE.Vector2(-dir.y, dir.x) }; }
function pathT(x, z) { let best = 1e9, bt = 0; const p = new THREE.Vector2(x, z); for (let i = 1; i < PATH.length; i++) { const a = PATH[i - 1], ab = PATH[i].clone().sub(a); const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); const d = a.clone().addScaledVector(ab, t).distanceTo(p); if (d < best) { best = d; bt = (CUM[i - 1] + t * ab.length()) / PATH_LEN; } } return bt; }
console.info('path length m', PATH_LEN.toFixed(1), '≈', (PATH_LEN / 2.2).toFixed(0), 's walk');
function distToPath(x, z) { let best = 1e9; const p = new THREE.Vector2(x, z), ab = new THREE.Vector2(), ap = new THREE.Vector2(); for (let i = 1; i < PATH.length; i++) { const a = PATH[i - 1]; ab.subVectors(PATH[i], a); ap.subVectors(p, a); const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1); best = Math.min(best, ap.sub(ab.multiplyScalar(t)).length()); } return best; }
{
  const pts = []; for (let r = 0; r <= 180; r += 2) pts.push(new THREE.Vector2(r, hillY(r)));
  const hill = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 96), new THREE.MeshStandardMaterial({ color: '#2f4a2c', roughness: 0.95 }));
  hill.material.side = THREE.DoubleSide; hill.receiveShadow = true; scene.add(hill);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA, 96), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.7, metalness: 0.05 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true; scene.add(plaza);
  const city = new THREE.Mesh(new THREE.CircleGeometry(2500, 64), new THREE.MeshStandardMaterial({ color: '#1a1820', roughness: 1 }));
  city.rotation.x = -Math.PI / 2; city.position.y = -62; scene.add(city);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(3000, 90), new THREE.MeshStandardMaterial({ color: '#2a3550', roughness: 0.08, metalness: 1 }));
  river.rotation.x = -Math.PI / 2; river.position.set(0, -61.8, 420); river.rotation.z = 0.25; scene.add(river);
}

// trees on slope
{
  const n = quality === 'high' ? 900 : 450;
  const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 5, 7), new THREE.MeshStandardMaterial({ color: '#2d5a32', roughness: 0.9 }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) { let r, a; do { r = 33 + Math.random() * 140; a = Math.random() * Math.PI * 2; } while (distToPath(Math.cos(a) * r, Math.sin(a) * r) < 4.5 || (r > 104 && r < 124 && Math.abs(Math.atan2(Math.sin(a - PATH[0].angle()), Math.cos(a - PATH[0].angle()))) < 0.25)); const k = 0.6 + Math.random() * 0.9; const col = new THREE.Color().setHSL(0.28 + Math.random() * 0.08, 0.45, 0.18 + Math.random() * 0.12); s.set(k, k * (0.8 + Math.random() * 0.6), k); m.compose(new THREE.Vector3(Math.cos(a) * r, hillY(r) + 2.3 * s.y, Math.sin(a) * r), q, s); cone.setMatrixAt(i, m); cone.setColorAt(i, col); }
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
// ---------- path, lamps, railings, parking lot ----------
const pathLights = [];
{
  const W = 1.7, pos = [], idx = [], uv = []; let acc = 0;
  for (let i = 0; i < PATH.length; i++) { const p = PATH[i], q = PATH[Math.min(i + 1, PATH.length - 1)], o = PATH[Math.max(i - 1, 0)]; const d = new THREE.Vector2().subVectors(q, o).normalize(); const n = new THREE.Vector2(-d.y, d.x); if (i) acc += p.distanceTo(PATH[i - 1]);
    for (const sgn of [-1, 1]) { const x = p.x + n.x * W * sgn, z = p.y + n.y * W * sgn; pos.push(x, hillY(Math.hypot(x, z)) + 0.06, z); uv.push(sgn < 0 ? 0 : 1, acc / 3.4); }
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const stone = canvasTex(256, 256, (c, w) => { c.fillStyle = '#7a6d60'; c.fillRect(0, 0, w, w); for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) { const v = 110 + Math.random() * 40 | 0; c.fillStyle = `rgb(${v},${v - 10},${v - 22})`; c.fillRect(x * 128 + (y % 2) * 64 - 64 + 3, y * 64 + 3, 122, 58); c.fillRect(x * 128 + (y % 2) * 64 + 64 + 3, y * 64 + 3, 122, 58); } }); stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
  const road = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: stone, roughness: 0.85, side: THREE.DoubleSide })); road.receiveShadow = true; scene.add(road);
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2b30', metalness: 0.85, roughness: 0.4 });
  const rails = [], poles = []; const bulbGeo = new THREE.SphereGeometry(0.22, 12, 8); let lastPost = null, dAcc = 0, lampAcc = 0, side = 1;
  for (let i = 1; i < PATH.length - 3; i++) { const shopZ = ZONES.find(z => z.shops); const fr = CUM[i] / PATH_LEN; if (fr > shopZ.from && fr < shopZ.to) { lastPost = null; continue; } const p = PATH[i], d = new THREE.Vector2().subVectors(PATH[i + 1], PATH[i - 1]).normalize(), n = new THREE.Vector2(-d.y, d.x);
    const outward = n.dot(p) > 0 ? n : n.clone().negate(); const rx = p.x + outward.x * 2.05, rz = p.y + outward.y * 2.05, ry = hillY(Math.hypot(rx, rz));
    poles.push(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6).translate(rx, ry + 0.5, rz));
    const cur = new THREE.Vector3(rx, ry + 0.95, rz); if (lastPost) { const len = cur.distanceTo(lastPost); const r = new THREE.CylinderGeometry(0.035, 0.035, len, 6); r.translate(0, len / 2, 0); r.applyMatrix4(new THREE.Matrix4().lookAt(new THREE.Vector3(), cur.clone().sub(lastPost), new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))); r.translate(lastPost.x, lastPost.y, lastPost.z); rails.push(r); } lastPost = cur;
    lampAcc += p.distanceTo(PATH[i - 1]); if (lampAcc > 11) { lampAcc = 0; side *= -1; const lx = p.x + n.x * 2.4 * side, lz = p.y + n.y * 2.4 * side, ly = hillY(Math.hypot(lx, lz));
      poles.push(new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8).translate(lx, ly + 1.8, lz)); const b = new THREE.Mesh(bulbGeo, lampMat); b.position.set(lx, ly + 3.7, lz); scene.add(b);
      if (pathLights.length < 6 && i % 2) { const pl = new THREE.PointLight('#ffc98a', 10, 12, 2); pl.position.copy(b.position); scene.add(pl); pathLights.push(pl); } } }
  const rm = new THREE.Mesh(mergeGeometries([...poles, ...rails].map(x => x.toNonIndexed())), iron); rm.castShadow = true; scene.add(rm);
  // parking lot + bus stop at the bottom
  const P0 = PATH[0], ang = P0.angle(); const c = new THREE.Vector2(Math.cos(ang) * 117, Math.sin(ang) * 117);
  const lot = new THREE.Mesh(new THREE.CircleGeometry(11, 40), new THREE.MeshStandardMaterial({ color: '#2d2d33', roughness: 0.9 })); lot.rotation.x = -Math.PI / 2; lot.position.set(c.x, -21.95, c.y); lot.receiveShadow = true; scene.add(lot);
  const carCols = ['#c0392b', '#ecf0f1', '#2c3e50', '#f1c40f', '#7f8c8d'];
  for (let i = 0; i < 5; i++) { const a = ang + Math.PI / 2 + (i - 2) * 0.33; const x = c.x + Math.cos(a) * 7, z = c.y + Math.sin(a) * 7; const car = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4), new THREE.MeshStandardMaterial({ color: carCols[i], metalness: 0.7, roughness: 0.25 })); body.position.y = 0.55; const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.1), new THREE.MeshStandardMaterial({ color: '#1b2430', metalness: 0.9, roughness: 0.1 })); top.position.set(0, 1.15, -0.2); car.add(body, top); car.traverse(o => o.castShadow = true); car.position.set(x, -22, z); car.rotation.y = -a; scene.add(car); }
  const bus = new THREE.Group(); const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 1.6), iron); roof.position.y = 2.5; const back = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.06), new THREE.MeshStandardMaterial({ color: '#9fc6e0', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.45 })); back.position.set(0, 1.3, -0.75); const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: '#8a5a3a' })); bench.position.set(0, 0.5, -0.4);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, (g2, w, h) => { g2.fillStyle = '#0f6a3a'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#fff'; g2.font = 'bold 30px sans-serif'; g2.textAlign = 'center'; g2.fillText('남산공원 주차장', w / 2, 52); g2.font = '22px sans-serif'; g2.fillText('🚌 01A · N서울타워 ↑', w / 2, 96); }) }));
  sign.position.set(0, 2.1, -0.71); bus.add(roof, back, bench, sign); bus.traverse(o => o.castShadow = true);
  const ba = ang - 0.09; bus.position.set(Math.cos(ba) * 112, -22, Math.sin(ba) * 112); bus.lookAt(0, -22, 0); scene.add(bus);
}

// ---------- stairs steps & shopping street ----------
{
  const stepMat = new THREE.MeshStandardMaterial({ color: '#9b8f84', roughness: 0.8 });
  const steps = [];
  for (const z of ZONES.filter(z => z.stairs)) { for (let t = z.from; t < z.to; t += 0.35 / PATH_LEN) { const { pos, dir } = pathAt(t); const y = hillY(Math.max(0, pos.length() - 1.8)); const g = new THREE.BoxGeometry(3.5, 0.24, 0.36); g.rotateY(Math.atan2(dir.x, dir.y)); g.translate(pos.x, y + 0.0, pos.y); steps.push(g.toNonIndexed()); } }
  const sm = new THREE.Mesh(mergeGeometries(steps), stepMat); sm.receiveShadow = true; sm.castShadow = true; scene.add(sm);
  // shopping street: string lights over the path
  const sz = ZONES.find(z => z.shops); const bulbG = new THREE.SphereGeometry(0.07, 8, 6); const cols = stringMats = ['#ff7eb6', '#ffd27a', '#8fd0ff', '#b6ff8f'].map(c => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2) }); m.userData.base = new THREE.Color(c); return m; });
  for (let t = sz.from; t < sz.to; t += 1.2 / PATH_LEN) { const { pos, n } = pathAt(t); const y = hillY(pos.length()) + 3.3 + Math.sin(t * 900) * 0.15; for (const s of [-1, 0, 1]) { const b = new THREE.Mesh(bulbG, cols[(Math.round(t * 1000) + s + 1) % 4]); b.position.set(pos.x + n.x * s * 1.2, y - Math.abs(s) * 0.2, pos.y + n.y * s * 1.2); scene.add(b); } }
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

// lamps + benches
const pointLights = [];
for (let i = 0; i < 8; i++) {
  const a = i / 8 * Math.PI * 2 + 0.2, r = 15;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4, 8), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.8, roughness: 0.35 }));
  pole.position.set(Math.cos(a) * r, 2, Math.sin(a) * r); pole.castShadow = true; scene.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), lampMat); bulb.position.set(pole.position.x, 4.1, pole.position.z); scene.add(bulb);
  if (i % 2 === 0) { const pl = new THREE.PointLight('#ffc98a', 18, 16, 2); pl.position.copy(bulb.position); scene.add(pl); pointLights.push(pl); }
}

// ---------- fence ----------
const FR = 28, SEG = 8, NCOL = 40, ROWS = [0.62, 0.88, 1.14];
const verts = [...Array(SEG)].map((_, i) => { const a = i / SEG * Math.PI * 2 + Math.PI / SEG; return new THREE.Vector3(Math.cos(a) * FR, 0, Math.sin(a) * FR); });
const SLOTS = SEG * ROWS.length * NCOL;
const GATE_SEG = Math.round(GATE_ANGLE / (Math.PI * 2 / SEG)) - 1; const GATE_HALF = 1.8;
const SEG_LEN = verts[0].distanceTo(verts[1]);
const isGate = (seg, t) => seg === GATE_SEG && Math.abs(t - 0.5) * SEG_LEN < GATE_HALF + 0.2;
function slotInfo(slot) {
  const seg = Math.floor(slot / (ROWS.length * NCOL)), rem = slot % (ROWS.length * NCOL), row = Math.floor(rem / NCOL), col = rem % NCOL;
  const a = verts[seg], b = verts[(seg + 1) % SEG]; const t = (col + 0.5) / NCOL;
  const p = a.clone().lerp(b, t); const inward = p.clone().setY(0).normalize().negate();
  p.addScaledVector(inward, 0.05); p.y = ROWS[row] - 0.1;
  return { pos: p, yaw: Math.atan2(inward.x, inward.z), seg, row, col };
}
{
  const metal = new THREE.MeshStandardMaterial({ color: '#3a3a40', metalness: 0.9, roughness: 0.35 });
  const posts = [], wires = [];
  for (let i = 0; i < SEG; i++) {
    const a = verts[i], b = verts[(i + 1) % SEG], len = a.distanceTo(b), dir = b.clone().sub(a).normalize(), yaw = Math.atan2(dir.x, dir.z);
    for (let k = 0; k <= 10; k++) { if (isGate(i, k / 10)) continue; const p = a.clone().lerp(b, k / 10); posts.push(new THREE.CylinderGeometry(0.06, 0.06, 1.35, 8).translate(p.x, 0.675, p.z)); }
    const spans = i === GATE_SEG ? [[0, 0.5 - GATE_HALF / len], [0.5 + GATE_HALF / len, 1]] : [[0, 1]];
    if (i === GATE_SEG) for (const t0 of [0.5 - GATE_HALF / len, 0.5 + GATE_HALF / len]) { const p = a.clone().lerp(b, t0); posts.push(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 12).translate(p.x, 1.3, p.z)); }
    for (const [t0, t1] of spans) for (const h of [...ROWS, 1.32]) { const sl = len * (t1 - t0); const w = new THREE.CylinderGeometry(h === 1.32 ? 0.05 : 0.012, h === 1.32 ? 0.05 : 0.012, sl, 6); w.rotateX(Math.PI / 2); w.rotateY(yaw); const m = a.clone().lerp(b, (t0 + t1) / 2); w.translate(m.x, h, m.z); wires.push(w); }
  }
  const fence = new THREE.Mesh(mergeGeometries([...posts, ...wires].map(g => g.toNonIndexed())), metal);
  fence.castShadow = true; fence.receiveShadow = true; scene.add(fence);
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
const DECOR_PER = 170;
for (const [k, t] of Object.entries(TYPES)) {
  const real = new THREE.InstancedMesh(getGeo(t.shape), lockMat(t.color), SLOTS); real.count = 0; real.userData.type = k; real.castShadow = true; real.frustumCulled = false; scene.add(real); realMeshes[k] = real;
  const dm = new THREE.InstancedMesh(getGeo(t.shape), lockMat(t.color), DECOR_PER); dm.castShadow = true; scene.add(dm); decorMeshes[k] = dm;
}
// decorative "older" locks all over the fence (seeded per server)
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function buildDecor(serverId) {
  const rnd = seeded(serverId * 9973 + 7); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const k of Object.keys(TYPES)) { const dm = decorMeshes[k];
    for (let i = 0; i < DECOR_PER; i++) { const seg = rnd() * SEG | 0, t = rnd(), row = rnd() * (ROWS.length) | 0; if (isGate(seg, t)) { dm.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); continue; }
      const a = verts[seg], b = verts[(seg + 1) % SEG]; const p = a.clone().lerp(b, t); const inward = p.clone().normalize().negate();
      p.addScaledVector(inward, -0.02 + rnd() * 0.03); p.y = ROWS[row] - 0.1 - rnd() * 0.02;
      e.set((rnd() - 0.5) * 0.5, Math.atan2(inward.x, inward.z) + (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.6); q.setFromEuler(e);
      const s = 0.8 + rnd() * 0.4; m.compose(p, q, new THREE.Vector3(s, s, s)); dm.setMatrixAt(i, m); }
    dm.instanceMatrix.needsUpdate = true; }
}

// ---------- merchants (data-driven, see merchants.js) ----------
const merchantObjs = MERCHANTS.map(cfg => {
  const g = new THREE.Group();
  if (cfg.pathT != null) { const { pos: pp, n } = pathAt(cfg.pathT); const x = pp.x + n.x * cfg.side * 3.6, z = pp.y + n.y * cfg.side * 3.6; g.position.set(x, hillY(Math.hypot(x, z)), z); g.lookAt(pp.x, g.position.y, pp.y); }
  else { g.position.set(Math.cos(cfg.angle) * cfg.radius, 0, Math.sin(cfg.angle) * cfg.radius); g.lookAt(0, 0, 0); g.rotateY(Math.PI); }
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
const player = new THREE.Group(); scene.add(player); const SPAWN = PATH[0]; player.position.set(SPAWN.x, hillY(SPAWN.length()), SPAWN.y);
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
  $('status').textContent = mine[serverId] ? '💗 이 서버에 이미 자물쇠를 걸었어요 (분홍 표시)' : (heldType ? '펜스 가까이 가서 E를 눌러 자물쇠를 걸어보세요' : '계단과 상점가를 지나 올라가며 자물쇠 상인을 찾아가세요');
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
function openModal() { if (mine[serverId]) return flash('이 서버에는 이미 자물쇠를 걸었어요. 수정·삭제는 할 수 없어요.'); if (pendingSlot == null) return; if (!heldType) return flash('먼저 상점가나 펜스 입구의 자물쇠 상인에게 자물쇠를 받으세요.'); selType = heldType; $('heldLock').textContent = '들고 있는 자물쇠: ' + TYPES[heldType].name; $('err').textContent = ''; $('modal').classList.remove('hidden'); $('msg').focus(); }
$('cancelBtn').onclick = () => $('modal').classList.add('hidden');
$('hangBtn').onclick = async () => {
  const msg = $('msg').value.trim(); if (!msg) { $('err').textContent = '메시지를 입력해주세요.'; return; }
  $('hangBtn').disabled = true; $('err').textContent = '';
  const { data, error } = await SB.rpc('namsan_hang', { p_device: device, p_server: serverId, p_type: selType, p_message: msg, p_nickname: $('nick').value.trim(), p_slot: pendingSlot });
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
const SDIR = PATH[4].clone().sub(PATH[0]); let yaw = Math.atan2(-SDIR.x, -SDIR.y), pitch = 0.25, dist = 5.5; const drag = new Map();
const cv = $('c'); const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
cv.addEventListener('pointerdown', e => { drag.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { const d = drag.get(e.pointerId); if (!d) return hover(e); yaw -= (e.clientX - d.x) * 0.005; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - d.y) * 0.004, -0.2, 1.2); d.x = e.clientX; d.y = e.clientY; });
cv.addEventListener('pointerup', e => { const d = drag.get(e.pointerId); drag.delete(e.pointerId); if (d && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6 && inGame) { const L = pick(e); if (L) showLock(L); } });
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
function nearestFreeSlot() {
  const p = player.position; const r = Math.hypot(p.x, p.z); if (r < FR - 2.2) return null;
  let best = null, bd = 1e9;
  for (let seg = 0; seg < SEG; seg++) { const a = verts[seg], b = verts[(seg + 1) % SEG]; const ab = b.clone().sub(a); const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); const c0 = Math.round(t * NCOL - 0.5);
    for (let dc = -3; dc <= 3; dc++) { const col = c0 + dc; if (col < 0 || col >= NCOL || isGate(seg, (col + 0.5) / NCOL)) continue; for (const row of [1, 2, 0]) { const s = seg * ROWS.length * NCOL + row * NCOL + col; if (bySlot.has(s)) continue; const d = slotInfo(s).pos.distanceTo(tmp.set(p.x, ROWS[row], p.z)) + Math.abs(row - 1) * 0.05; if (d < bd) { bd = d; best = s; } } } }
  return bd < 2.4 ? best : null;
}
function nearestLock() { let best = null, bd = 2.0; for (const L of locks) { const d = slotInfo(L.slot).pos.distanceTo(tmp.copy(player.position).setY(1)); if (d < bd) { bd = d; best = L; } } return best; }
let dayK = 0; const C_SUN = new THREE.Color('#ffad74'), C_MOON = new THREE.Color('#7f8fff'), C_HEMI = new THREE.Color('#a796d6'), C_HEMI_N = new THREE.Color('#3a4580'), FOG_N = new THREE.Color('#141a30'), C_LAMP = new THREE.Color('#ffd7a0');
function walkable(x, z) { const r = Math.hypot(x, z); if (r > 7.6 && r < FR * Math.cos(Math.PI / SEG) - 0.45) return true; const da = Math.abs(Math.atan2(Math.sin(Math.atan2(z, x) - GATE_ANGLE), Math.cos(Math.atan2(z, x) - GATE_ANGLE))); if (r < 31 && r > 20 && da * r < GATE_HALF - 0.35) return true; if (r > 29 && distToPath(x, z) < 1.75) return true; const c = PATH[0].clone().setLength(117); return Math.hypot(x - c.x, z - c.y) < 10.5; }
function setAction(name) { if (!actions[name] || current === actions[name]) return; actions[name].reset().fadeIn(0.25).play(); current?.fadeOut(0.25); current = actions[name]; }
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (inGame && !modalOpen()) {
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
    const l = Math.hypot(ix, iz); const run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > 0.9;
    if (l > 0.1) { ix /= Math.max(l, 1); iz /= Math.max(l, 1);
      const sp = run ? 5.2 : 2.2; const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const dx = (fx * -iz + -fz * ix) * sp * dt, dz = (fz * -iz + fx * ix) * sp * dt; // right = forward × up
      const P = player.position; facing = Math.atan2(dx, dz);
      if (walkable(P.x + dx, P.z + dz)) { P.x += dx; P.z += dz; } else if (walkable(P.x + dx, P.z)) P.x += dx; else if (walkable(P.x, P.z + dz)) P.z += dz;
      if (merchantObjs.some(m => Math.hypot(P.x - m.pos.x, P.z - m.pos.z) < 1.1)) { P.x -= dx; P.z -= dz; }
      setAction(run ? 'Run' : 'Walk'); } else setAction('Idle');
    if (player.children[0]) { const cur = player.children[0].rotation.y; let d = facing + Math.PI - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); player.children[0].rotation.y = cur + d * Math.min(1, dt * 10); }
    { const P = player.position, r = Math.hypot(P.x, P.z); const zn = r < 29 ? '펜스' : (ZONES.find(z => { const t = pathT(P.x, P.z); return t >= z.from && t < z.to; }) || ZONES[0]).name; if (zn !== curZone) { curZone = zn; const zt = $('zone'); zt.textContent = zn; zt.classList.remove('show'); void zt.offsetWidth; zt.classList.add('show'); } }
    pendingSlot = mine[serverId] ? null : nearestFreeSlot();
    const pr = $('prompt'); const nl = nearestLock();
    nearMerchant = merchantObjs.find(m => Math.hypot(player.position.x - m.pos.x, player.position.z - m.pos.z) < 2.8) || null;
    const touch = matchMedia('(pointer:coarse)').matches;
    if (nearMerchant) { pr.textContent = (touch ? '버튼' : 'E 키') + `: ${nearMerchant.cfg.name}와 대화하기`; pr.classList.remove('hidden'); }
    else if (pendingSlot != null) { pr.textContent = heldType ? (touch ? '🔒 버튼을 눌러 자물쇠 걸기' : 'E 키를 눌러 자물쇠 걸기') : '자물쇠가 없어요 · 자물쇠 상인에게 먼저 가보세요'; pr.classList.remove('hidden'); } else pr.classList.add('hidden');
    $('actBtn').classList.toggle('hidden', !nearMerchant && pendingSlot == null); $('actBtn').textContent = nearMerchant ? '💬' : '🔒';
    const tip = $('tip'); if (nl) { const sp = slotInfo(nl.slot).pos.clone().project(camera); tip.style.left = (sp.x + 1) / 2 * innerWidth + 'px'; tip.style.top = (1 - sp.y) / 2 * innerHeight + 'px'; tip.innerHTML = `“${esc(nl.message)}”<br><small>— ${esc(nl.nickname)}</small>`; tip.classList.remove('hidden'); } else tip.classList.add('hidden');
  } else { $('tip').classList.add('hidden'); if (!inGame) yaw += dt * 0.05; }
  player.position.y = hillY(Math.hypot(player.position.x, player.position.z)); mixer?.update(dt); merchantObjs.forEach(m => m.mixer?.update(dt));
  const target = tmp.copy(player.position).add(new THREE.Vector3(0, 1.5, 0));
  const cd = inGame ? dist : 30; const cp = inGame ? pitch : 0.18;
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(cp) * cd, target.y + Math.sin(cp) * cd, target.z + Math.cos(yaw) * Math.cos(cp) * cd);
  camera.position.y = Math.max(camera.position.y, hillY(Math.hypot(camera.position.x, camera.position.z)) + 0.4); camera.lookAt(inGame ? target : new THREE.Vector3(0, 25, 0));
  sunLight.target.position.copy(player.position); sunLight.position.copy(player.position).add(new THREE.Vector3(sun.x, 0.35, sun.z).normalize().multiplyScalar(80));
  // ---- time of day tied to route progress (0 = parking lot sunset, 1 = fence night) ----
  { const P = player.position; const target = !inGame ? 0.55 : Math.hypot(P.x, P.z) < 29 ? 1 : pathT(P.x, P.z); dayK += (target - dayK) * Math.min(1, dt * 1.5); }
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
  towerLights.forEach((r, i) => r.material.color.setHSL((t * 0.05 + i * 0.25) % 1, 0.8, 0.6).multiplyScalar(2.5 * glow));
  myMarker.rotation.y = t * 2;
  quality === 'high' ? composer.render() : renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ---------- boot ----------
applyQuality();
new GLTFLoader().load(import.meta.env.BASE_URL + 'models/soldier.glb', (g) => {
  const m = g.scene; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); facing = Math.atan2(SDIR.x, SDIR.y); m.rotation.y = facing + Math.PI; player.add(m);
  mixer = new THREE.AnimationMixer(m); for (const c of g.animations) actions[c.name] = mixer.clipAction(c); setAction('Idle');
  for (const mo of merchantObjs) { const npc = skClone(m); npc.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#e8b9c9'); } }); npc.position.set(0, 0, -0.1); npc.rotation.y = Math.PI; mo.group.add(npc); mo.mixer = new THREE.AnimationMixer(npc); const idle = g.animations.find(c => c.name === 'Idle'); idle && mo.mixer.clipAction(idle).play(); }
  $('loading').classList.add('hidden'); showServers();
}, (p) => { $('loadmsg').textContent = `캐릭터 불러오는 중… ${p.total ? Math.round(p.loaded / p.total * 100) : ''}%`; }, () => { $('loading').classList.add('hidden'); showServers(); });
tick();
window.__game = { player, camera, setYaw: (v) => yaw = v, pathAt };
