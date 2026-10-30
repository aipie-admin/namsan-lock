# 남산 사랑의 자물쇠 (Namsan Love Lock)

Three.js 3인칭 웹 게임. 남산공원 주차장에서 출발해 산책로(약 1분)를 걸어 올라가, 입구의 자물쇠 상인에게 자물쇠를 받고, N서울타워 펜스에 메시지와 함께 겁니다.

- `npm i && npm run dev` / `npm run build`
- 백엔드: Supabase 테이블 `public.namsan_locks` + RPC `namsan_hang`, `namsan_mine` (기기 ID 기반, 서버당 1인 1개, 수정/삭제 불가 트리거, 욕설 필터는 Postgres 함수 `namsan_is_profane`)
- 그래픽: PBR, ACES 톤매핑, 블룸, 그림자, Sky 기반 환경광, 안개. 우측 상단에서 고품질/저사양 전환.
- 캐릭터: three.js 예제 Soldier.glb (텍스처 webp 변환)

## 상인 추가하는 법
`src/merchants.js`의 `MERCHANTS` 배열에 항목을 추가하세요 (id, name, angle, radius, greeting, inventory, awning).
새 자물쇠 종류를 팔려면 `src/main.js`의 `TYPES`와 DB의 `lock_type` check 제약에 같이 추가해야 합니다.
