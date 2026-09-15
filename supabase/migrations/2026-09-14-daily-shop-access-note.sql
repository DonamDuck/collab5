-- 하루 가게 — 「들어오는 법」 칸 추가 (2026-09-14)
-- 🚨 Supabase SQL Editor에 이 파일만 붙여넣어 실행. 추가만 하고 여러 번 돌려도 안전하다.
--
-- 왜 — 사장님이 자리를 비우는 구조라 도어락 번호·열쇠 위치·불 켜는 법이 없으면 당일 아침에 전화가 온다(대표 09-14).
-- 🚨 주소와 같은 급의 비밀이다. 확정된 예약의 게스트에게만 열린다(`toPublic`이 떼어 낸다).
alter table spaces add column if not exists access_note text not null default '';
