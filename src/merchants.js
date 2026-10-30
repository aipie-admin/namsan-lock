// 자물쇠 상인 설정 (data-driven).
// 상인을 추가하려면 이 배열에 객체 하나를 추가하세요:
//  - id: 고유 문자열
//  - name: 머리 위/대화창에 표시될 이름
//  - angle, radius: 타워 중심 기준 극좌표 위치 (라디안, 미터). 광장 안은 radius 8~25
//  - greeting: 대화창 인사말
//  - inventory: 판매하는 자물쇠 종류 키 배열 (main.js의 TYPES 키, DB check 제약과 동일해야 함)
//  - awning: 노점 차양 색
// 새 자물쇠 종류를 팔려면 TYPES(main.js)와 Supabase namsan_locks.lock_type check 제약 둘 다에 추가해야 합니다.
export const GATE_ANGLE = Math.PI * 3 / 4; // 펜스 입구 방향

export const MERCHANTS = [
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
