// 자물쇠 상인 / 상점 설정 (data-driven).
// 상인을 추가하려면 MERCHANTS 배열에 객체 하나를 추가하세요:
//  - id: 고유 문자열, name: 머리 위/대화창 이름, greeting: 인사말, awning: 차양 색
//  - 위치: x, z (월드 좌표, 미터). 상점 광장(LAYOUT.plaza)은 x -22~22, z 62~110.
//          y는 자동(지면 높이). face: 노점 정면이 바라볼 [x, z] 지점 (생략하면 광장 중앙 통로 x=0)
//          원형 펜스 광장(반지름 24 안쪽)에 두려면 angle + radius(타워 중심 극좌표)도 가능.
//  - inventory: 판매하는 자물쇠 종류 키 배열 (main.js TYPES 키 = DB lock_type check 제약). 비우면([]) 대화만 하는 상점
// 새 자물쇠 종류를 팔려면 TYPES(main.js)와 Supabase namsan_locks.lock_type check 제약 둘 다에 추가하세요.

// 직선 동선 (z가 클수록 아래쪽). 주차장 → 직선 계단 → 상점 광장 → 직선 계단 → 원형 펜스 광장
export const LAYOUT = {
  park: { x: 22, z0: 140, z1: 180, y: -22 },
  stairs1: { w: 3.6, z0: 110, z1: 140, y0: -12, y1: -22 },
  plaza: { x: 22, z0: 62, z1: 110, y: -12 },
  stairs2: { w: 3.6, z0: 24.6, z1: 62, y0: 0, y1: -12 },
  ring: { r: 24, fenceH: 12 },
  spawnZ: 160,
};
export const ZONES = [ // 지역 이름 토스트 (판정 순서대로)
  { name: '펜스', test: (x, z) => Math.hypot(x, z) < 24.6 },
  { name: '계단', test: (x, z) => z < 62 },
  { name: '상점가', test: (x, z) => z < 110 },
  { name: '계단', test: (x, z) => z < 140 },
  { name: '주차장', test: () => true },
];

export const MERCHANTS = [
  { id: 'tteok', name: '남산 떡볶이', x: 13, z: 100, greeting: '떡볶이 한 접시 어때요? (준비 중이에요!)', inventory: [], awning: '#ff8a3d' },
  { id: 'souvenir', name: '기념품 가게', x: -13, z: 100, greeting: 'N서울타워 열쇠고리 구경하고 가요~', inventory: [], awning: '#3d8bff' },
  { id: 'cafe', name: '타워 카페', x: 13, z: 86, greeting: '올라가기 전에 커피 한 잔!', inventory: [], awning: '#6b4b3a' },
  { id: 'lock-street', name: '자물쇠 아저씨', x: -13, z: 86, greeting: '하트, 별, 원형… 우리 가게가 제일 예뻐요!', inventory: ['heart-red', 'heart-pink', 'star-purple', 'round-blue'], awning: '#c43df0' },
  { id: 'flower', name: '꽃집', x: 13, z: 72, greeting: '자물쇠랑 꽃 한 송이 같이 어때요?', inventory: [], awning: '#3dbf6b' },
  { id: 'snack', name: '호떡 노점', x: -13, z: 72, greeting: '따끈한 호떡 있어요~ (준비 중!)', inventory: [], awning: '#ffb13d' },
  { id: 'gate-merchant', name: '자물쇠 할머니', angle: Math.PI / 2 + 0.22, radius: 20.5,
    greeting: '어서 와요~ 남산에 왔으면 자물쇠 하나는 걸어야지! 마음에 드는 걸로 골라봐요.',
    inventory: ['heart-red', 'heart-pink', 'classic-gold', 'classic-silver', 'round-blue', 'round-green', 'star-purple', 'key-black'], awning: '#e2475f' },
];
