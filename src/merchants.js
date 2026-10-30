// 자물쇠 상인 설정 (data-driven).
// 상인을 추가하려면 이 배열에 객체 하나를 추가하세요:
//  - id: 고유 문자열
//  - name: 머리 위/대화창에 표시될 이름
//  - 위치는 둘 중 하나:
//      pathT + side : 산책로 길이 비율(0=주차장, 1=펜스 입구)과 길 왼쪽(-1)/오른쪽(1). 상점가 구간은 pathT 0.38~0.68
//      angle + radius: 타워 중심 기준 극좌표 (라디안, 미터). 광장 안은 radius 8~25
//  - inventory: 비우면([]) 대화만 하는 일반 상점
//  - greeting: 대화창 인사말
//  - inventory: 판매하는 자물쇠 종류 키 배열 (main.js의 TYPES 키, DB check 제약과 동일해야 함)
//  - awning: 노점 차양 색
// 새 자물쇠 종류를 팔려면 TYPES(main.js)와 Supabase namsan_locks.lock_type check 제약 둘 다에 추가해야 합니다.
export const GATE_ANGLE = Math.PI * 3 / 4; // 펜스 입구 방향

// 경로 구간 (pathT 비율). 순서: 주차장 → 계단 → 상점가 → 계단 → 펜스
export const ZONES = [
  { name: '주차장', from: 0, to: 0.08 },
  { name: '계단', from: 0.08, to: 0.36, stairs: true },
  { name: '상점가', from: 0.36, to: 0.7, shops: true },
  { name: '계단', from: 0.7, to: 0.95, stairs: true },
  { name: '펜스', from: 0.95, to: 1.01 },
];

export const MERCHANTS = [
  { id: 'tteok', name: '남산 떡볶이', pathT: 0.4, side: 1, greeting: '떡볶이 한 접시 어때요? (준비 중이에요!)', inventory: [], awning: '#ff8a3d' },
  { id: 'souvenir', name: '기념품 가게', pathT: 0.46, side: -1, greeting: 'N서울타워 열쇠고리 구경하고 가요~', inventory: [], awning: '#3d8bff' },
  { id: 'cafe', name: '타워 카페', pathT: 0.52, side: 1, greeting: '올라가기 전에 커피 한 잔!', inventory: [], awning: '#6b4b3a' },
  { id: 'lock-street', name: '자물쇠 아저씨', pathT: 0.58, side: -1, greeting: '하트, 별, 원형… 우리 가게가 제일 예뻐요!', inventory: ['heart-red', 'heart-pink', 'star-purple', 'round-blue'], awning: '#c43df0' },
  { id: 'flower', name: '꽃집', pathT: 0.64, side: 1, greeting: '자물쇠랑 꽃 한 송이 같이 어때요?', inventory: [], awning: '#3dbf6b' },
  {
    id: 'gate-merchant',
    name: '자물쇠 할머니',
    angle: GATE_ANGLE + 0.13,
    radius: 24.2,
    greeting: '어서 와요~ 남산에 왔으면 자물쇠 하나는 걸어야지! 마음에 드는 걸로 골라봐요.',
    inventory: ['heart-red', 'heart-pink', 'classic-gold', 'classic-silver', 'round-blue', 'round-green', 'star-purple', 'key-black'],
    awning: '#e2475f',
  },
];
