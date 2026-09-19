-- 하루 가게 — 검토 «보완 요청»(반려)과 바뀌기 전 이름·주소 (2026-09-19 저녁 대표)
--
-- 대표 원문: 「주소 비교는 어드민에서 확인하고 사업자 거절(사람이 하되 너랑 같이 할 거야)되면 반려 처리되고,
--   보완해 달라는 이메일과, 사장님 입장에서 보완해서 재제출할 수 있는 환경을 만들어 주자!」
--
-- ⭐상태 칸(`status`)엔 값을 더하지 않는다. check 제약(`draft·pending·open·paused`, 2026-09-13-daily-shop.sql)을 고치려면
--   제약을 지웠다 다시 거는 수밖에 없어서, «확장만» 하는 이 파일의 규율과 안 맞는다.
--   «보완 필요» = `status = 'pending'` + `review_rejected_at`이 있음. 목록은 `open`만 읽으니 반려된 공간은 그대로 빠진다.
--
-- 칸 넷
--   · review_note          관리자가 남긴 보완 사유. 사장님 메일·내 하루 가게·고치기 화면에 그대로 나간다.
--                          사장님이 고쳐 다시 보내도 남는다(검토 화면의 「지난 요청」). 공개하면 지운다.
--   · review_rejected_at   보완을 요청한 시각. 사장님이 고쳐 저장하면 지운다(다시 검토 대기).
--   · review_prev_name     이름·주소가 바뀌어 검토로 내려오기 «전» 값 = 관리자가 마지막으로 본 값.
--   · review_prev_address  검토 화면이 「주소 바뀜: 이전 → 새」로 보여 준다. 공개하면 지운다.
--
-- ⭐추가만 한다. 두 번 돌려도 된다(if not exists). 대표가 직접 돌린다.
-- ⭐코드는 이 SQL «전»에도 돈다.
--   · 읽기: 칸이 없으면 빈 값으로 읽는다(보완 요청 없음 · 바뀐 주소 모름).
--   · 저장: 이 칸들만 빼고 저장한다(`spaces.ts` saveSpace). 그 사이 바뀐 주소의 «이전» 값은 안 남는다.
--   · 보완 요청: 칸이 없으면 검토 화면의 [보완 요청]이 잠기고 관리자에게만 「SQL을 먼저 돌려 주세요」가 보인다.
alter table spaces
  add column if not exists review_note         text not null default '',
  add column if not exists review_rejected_at  timestamptz,
  add column if not exists review_prev_name    text not null default '',
  add column if not exists review_prev_address text not null default '';
