// 서버(테마) 목록 — data-driven. 서버를 추가하려면 항목을 하나 추가하세요.
//  - id: 정수 1~100 (DB check 제약), 한 번 정하면 바꾸지 마세요 (자물쇠가 id로 저장됨)
//  - name: 표시 이름, desc: 설명, emoji: 아이콘, placeholder: 메시지 입력 예시
// 1인당 서버마다 자물쇠 1개.
export const SERVERS = [
  { id: 1, emoji: '💭', name: '그리울때', desc: '보고 싶은 사람에게 마음을 전해요', placeholder: '많이 보고 싶어. 잘 지내지?' },
  { id: 2, emoji: '🔎', name: '사람찾기', desc: '다시 만나고 싶은 누군가를 찾아요', placeholder: '2019년 여름 남산에서 만난 너를 찾아요' },
  { id: 3, emoji: '🙏', name: '기원하기', desc: '소원과 바람을 담아 걸어요', placeholder: '우리 가족 모두 건강하게 해주세요' },
  { id: 4, emoji: '💌', name: '고백하기', desc: '말하지 못한 마음을 고백해요', placeholder: '사실 처음 본 날부터 좋아했어' },
  { id: 5, emoji: '✉️', name: '내가나에게', desc: '미래의 나에게 편지를 남겨요', placeholder: '1년 뒤의 나, 지금보다 더 웃고 있길' },
];
