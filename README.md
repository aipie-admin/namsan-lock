# 남산 사랑의 자물쇠 (Namsan Love Lock)

Three.js 3인칭 웹 게임. 남산공원 주차장에서 출발해 산책로(약 1분)를 걸어 올라가, 입구의 자물쇠 상인에게 자물쇠를 받고, N서울타워 펜스에 메시지와 함께 겁니다.

- `npm i && npm run dev` / `npm run build`
- 백엔드: Supabase 테이블 `public.namsan_locks` + RPC `namsan_hang`, `namsan_mine` (기기 ID 기반, 서버당 1인 1개, 수정/삭제 불가 트리거, 욕설 필터는 Postgres 함수 `namsan_is_profane`)
- 그래픽: PBR, ACES 톤매핑, 블룸, 그림자, Sky 기반 환경광, 안개. 우측 상단에서 고품질/저사양 전환.
- 캐릭터: three.js 예제 Soldier.glb (텍스처 webp 변환)

## 상인 추가하는 법
`src/merchants.js`의 `MERCHANTS` 배열에 객체 하나 추가: `id`, `name`, `greeting`, `awning`, `inventory`(자물쇠 종류 키, 비우면 대화만),
위치는 `x`,`z`(상점 광장은 x -22~22, z 62~110, 선택 `face:[x,z]`) 또는 원형 광장 안 `angle`+`radius`.
새 자물쇠 종류는 `main.js`의 `TYPES`와 DB `lock_type` check 제약 둘 다에 추가.

## 동선 (직선 레이아웃)
`LAYOUT`(merchants.js): 넓은 주차장(z 92~116, 스폰 z 98) → 직선 계단 1(z 78~92) → 넓은 상점 광장(z 46~78) → 직선 계단 2(z 24.6~46) → 원형 광장(반지름 24) + 높이 12m 링 펜스. 약 74m ≈ 30초.
지역 토스트는 `ZONES`(판정 함수), 해질녘→밤은 동선 진행도(`routeT`)로 자동. 이동 가능 영역은 `main.js`의 `walkable()` — 구역을 바꾸면 계단과 광장 경계가 겹치게(±1.5m) 유지하세요.
조작: WASD/방향키(카메라 기준), Shift 달리기, 클릭=걷기, 더블클릭=달리기, 드래그=시점.

## 펜스 슬롯
slot = row*360 + col, row 0~26 = 높이 0.6~11.0m (0.4m 간격) → 9720칸 (DB 제한 0~9999). 걸기 창의 "걸 높이" 슬라이더로 행을 고름.

## 서버(테마) 추가하는 법
`src/servers.js`의 `SERVERS`에 `{ id, emoji, name, desc, placeholder }`를 추가 (id 1~100, 변경 금지). 서버마다 1인 1자물쇠.

## 캐릭터 / 프로필
첫 접속 시 프로필(이름 ≤10자, 서버 욕설 필터 `namsan_is_profane` 확인 + 남자/여자) → localStorage(`namsan_name`, `namsan_char`). 서버 선택 화면의 "프로필 변경"으로 수정.
모델: `public/models/char_m.glb`(12.6k tris), `char_f.glb`(14.1k tris), LOD `char_*_lo.glb`(~3.1k tris). 사용자 FBX(UV+텍스처 있음, 애니메이션 없음)를 meshopt+webp(1024) GLB로 변환. 애니메이션은 숨겨진 Soldier 리그의 Idle/Walk/Run을 실시간 리타깃.
원경: `public/models/pano.webp` (서울 야경 파노라마를 좌우 미러 타일링, 360° 원통, fog 없음).

## 멀티플레이 (Supabase Realtime)
서버마다 채널 `namsan-srv-<id>`: presence(이름/성별), broadcast `p`(위치·방향·애니, 10Hz, 보간). 세션 id는 랜덤(기기 비밀 id는 전송 안 함).
가까운 15명·35m 이내는 고해상도, 그 외 LOD, 200m 밖 숨김. 나가면 presence에서 빠져 제거.
