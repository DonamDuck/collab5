-- 하루 가게 — 공간 등록 사업자 확인 + 네이버 상호 매칭 (2026-09-18)
--
-- 🧭대표 결정(09-17)
--   ① 공간 등록에 사업자 확인이 필수다. 「개인까지 받으면 너무 무방비 범죄가 일어날 것 같다. 개인 수요는 추후 검증 과정을 거쳐서」.
--      방식 = 사업자등록증 업로드 + 국세청 자동 조회 + 관리자 검토 뒤 공개. 승인된 공간 상세엔 「사업자 확인된 가게」.
--   ② 공간 상세 지도는 사장님이 적은 매장 이름과 네이버 지역검색의 가게가 일치할 때만 네이버 상호로 보인다.
--
-- 🚨실행 방법: Supabase 대시보드 > SQL Editor 에 **이 파일만** 붙여넣어 실행한다.
-- ⭐추가만 한다. 기존 행은 안 건드린다(테스트로 공개된 공간 넷은 그대로 공개, 확인 표시만 없다). 두 번 돌려도 된다.
-- ⚠️코드보다 먼저 돌린다. 이 칸들이 없는 DB에선 공간 저장이 통째로 실패한다(`saveSpace`가 칸을 조용히 빼지 않는다.
--    빼고 저장하면 사장님이 올린 등록증 경로가 말없이 사라진다).

-- ① 사업자 정보 — «공간마다» 둔다. 사장님 한 분이 가게 둘을 올릴 수 있고, 가게마다 사업자가 다를 수 있다.
alter table spaces
  add column if not exists biz_number       text not null default '',   -- 숫자 10자리(하이픈 없이)
  add column if not exists biz_owner_name   text not null default '',   -- 대표자 이름. 사업자등록증 그대로
  add column if not exists biz_open_date    text not null default '',   -- 개업일 YYYYMMDD(국세청 요청 형식 그대로)
  add column if not exists biz_cert_path    text not null default '',   -- 비공개 저장소 `host-docs`의 경로 `{user_id}/{uuid}.{ext}`. 공개 URL이 아니다
  add column if not exists biz_check_status text not null default 'none'
    check (biz_check_status in ('none', 'valid', 'mismatch', 'closed', 'error')),
  --   none     = 아직 조회 못 함(국세청 키가 아직 없음 등. 사유는 detail.reason)
  --   valid    = 번호·대표자·개업일이 국세청 기록과 맞고 계속사업자
  --   mismatch = 국세청 기록과 다름(진위확인 valid "02")
  --   closed   = 휴업(02)·폐업(03). 이 결과면 저장 자체를 막아서 행엔 거의 안 남는다
  --   error    = 조회가 실패함(네트워크·국세청 오류). 저장은 막지 않는다
  add column if not exists biz_check_detail jsonb,                      -- 조회 결과 요약(상태 코드·사유). 원문 응답 통째가 아니다
  add column if not exists biz_checked_at   timestamptz,
  add column if not exists biz_approved_at  timestamptz;                -- 관리자가 등록증을 보고 승인한 시각. 사업자 정보가 바뀌면 코드가 null로 되돌린다

-- ② 네이버 상호 매칭 — 이름 일치 AND 같은 건물일 때만 채운다. 아니면 전부 비어 있고 상세는 지금처럼 주소 핀만.
alter table spaces
  add column if not exists place_name       text not null default '',
  add column if not exists place_address    text not null default '',   -- 네이버가 준 도로명 주소. 관리자 검토 화면이 사장님 주소와 나란히 보여 준다
  add column if not exists place_lat        double precision,
  add column if not exists place_lng        double precision,
  add column if not exists place_matched_at timestamptz;

-- ③ 사업자등록증 비공개 저장소.
--    🔒public = false. 공개 URL이 없고, 열람은 서버가 관리자에게만 짧은 서명 URL(60초)을 발급해서 한다.
--    🔒정책(storage.objects RLS policy)을 «일부러» 만들지 않는다. 정책이 없으면 anon·로그인 사용자 모두 읽기·쓰기·목록이 막히고
--      service role(서버)만 닿는다. 올리기도 서버가 발급한 서명 업로드 URL로만 한다(사진 올리기와 같은 방식).
--      「본인 파일은 본인이 읽기」 같은 정책을 더하면 경로만 알면 남의 등록증을 여는 구멍이 생기기 쉽다. 필요해지면 그때 좁게 연다.
--    📏크기 10MB·형식(이미지·PDF)은 버킷이 한 번 더 막는다. 화면이 막아도 서명 URL로 직접 올리는 길은 열려 있어서다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'host-docs', 'host-docs', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;
