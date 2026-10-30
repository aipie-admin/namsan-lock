// 자물쇠 상인 / 상점 설정 (data-driven).
// 상인을 추가하려면 MERCHANTS 배열에 객체 하나를 추가하세요:
//  - id: 고유 문자열, name: 머리 위/대화창 이름, greeting: 인사말, awning: 차양 색
//  - 위치: x, z (월드 좌표, 미터). 상점 광장(LAYOUT.plaza)은 x -7~7, z 46~78.
//          y는 자동(지면 높이). face: 노점 정면이 바라볼 [x, z] 지점 (생략하면 광장 중앙 통로 x=0)
//          원형 펜스 광장(반지름 24 안쪽)에 두려면 angle + radius(타워 중심 극좌표)도 가능.
//  - model: (선택) 상인 3D 모델 GLB 경로 (public/ 기준, 예: 'models/merchant_grandma.glb'). scale, rotY(라디안)로 보정. 생략하면 임시 기본 캐릭터
//  - props: (선택) 상인 옆 소품 GLB 목록 [{ model, x, z, rotY, scale }] (상인 기준 로컬 좌표, 바닥에 자동 정렬)
//  - stall: false 면 노점(테이블/차양) 없이 상인만
//  - inventory: 판매하는 자물쇠 종류 키 배열 (main.js TYPES 키 = DB lock_type check 제약). 비우면([]) 대화만 하는 상점
// 새 자물쇠 종류를 팔려면 TYPES(main.js)와 Supabase namsan_locks.lock_type check 제약 둘 다에 추가하세요.

// 직선 동선 (z가 클수록 아래쪽). 주차장 → 직선 계단 → 상점 광장 → 직선 계단 → 원형 펜스 광장
export const LAYOUT = {
  park: { x: 22, z0: 92, z1: 116, y: -22 },
  stairs1: { w: 3.6, z0: 78, z1: 92, y0: -12, y1: -22 },
  plaza: { x: 7, z0: 46, z1: 78, y: -12 },
  stairs2: { w: 3.6, z0: 24.6, z1: 46, y0: 0, y1: -12 },
  ring: { r: 24, fenceH: 12 },
  spawnZ: 98,
};
export const ZONES = [ // 지역 이름 토스트 (판정 순서대로)
  { name: '펜스', test: (x, z) => Math.hypot(x, z) < 24.6 },
  { name: '계단', test: (x, z) => z < 46 },
  { name: '상점가', test: (x, z) => z < 78 },
  { name: '계단', test: (x, z) => z < 92 },
  { name: '주차장', test: () => true },
];

export const MERCHANTS = [ // 계단 위(상점 광장 입구) 양옆
  { id: 'lock-grandma', name: '자물쇠 할머니', x: -4.2, z: 74, face: [0, 72], model: null, scale: 1, rotY: 0, props: [{ model: 'models/chair.glb', x: 0.9, z: -0.4, rotY: 0 }],
    greeting: '어서 와요~ 남산에 왔으면 자물쇠 하나는 걸어야지! 마음에 드는 걸로 골라봐요.',
    inventory: ['heart-red', 'heart-pink', 'classic-gold', 'classic-silver', 'round-blue', 'round-green', 'star-purple', 'key-black'], awning: '#e2475f' },
  { id: 'dokkaebi-yut', name: '돗가비 윷놀이', x: 4.2, z: 74, face: [0, 72], model: null, scale: 1, rotY: 0, props: [{ model: 'models/chair.glb', x: 0.9, z: -0.4, rotY: 0 }],
    greeting: '안녕하세요! 돗가비 윷놀이 홍보 중이에요~ 친구들이랑 윷 한 판 어때요? 🎲', inventory: [], awning: '#2f8f6b' },
];
