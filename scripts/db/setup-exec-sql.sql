-- 운영 DB에 «SQL 실행 함수»를 한 번 만든다. (2026-09-19 대표 지시 — 「SQL 돌릴 권한을 추가하고 네가 돌리는 시스템으로」)
-- 어디서: Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여 넣고 Run. 딱 한 번.
-- 왜 이 방식인가: DB 비밀번호를 새로 받지 않아도 된다. 이미 있는 서비스 롤 키(1팀 .env.local)로 PostgREST rpc를 부르면 되고,
--   서비스 롤은 원래 RLS를 통째로 우회하니 권한이 «늘어나는» 게 아니라 «SQL 문법을 쓸 수 있게» 되는 것뿐이다.
-- 안전장치: anon·authenticated 는 실행 불가(revoke). 호출은 scripts/db/sql 만 쓴다(값 바꾸기 전엔 매번 대표 「고고」).

create or replace function public.exec_sql(q text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  n bigint;
  head text := lower(ltrim(q));
begin
  if head like 'select%' or head like 'with%' or head like 'explain%' or head like 'show%' or head like 'table%' then
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', rtrim(q, '; '))
      into r;
    return r;
  elsif head ~ '\yreturning\y' then
    -- 🩸09-20 실측: 공백으로 앞뒤를 감싸 찾던 옛 방식은 줄바꿈 앞의 절을 놓쳤다(여러 줄 SQL은
    --   개행 다음에 그 절이 오지, 공백 다음이 아니다). 단어 경계(\y)로 교체해 개행·탭도 잡는다.
    -- insert/update/delete에 RETURNING이 붙으면 → 데이터 변경 CTE로 감싸 «되받은 행»을 그대로 돌려준다
    execute format('with t as (%s) select coalesce(jsonb_agg(t), ''[]''::jsonb) from t', rtrim(q, '; '))
      into r;
    return r;
  else
    execute q;
    get diagnostics n = row_count;
    return jsonb_build_object('rows_affected', n);
  end if;
end
$$;

revoke all on function public.exec_sql(text) from public;
revoke all on function public.exec_sql(text) from anon;
revoke all on function public.exec_sql(text) from authenticated;
grant execute on function public.exec_sql(text) to service_role;

-- 확인용(같은 편집기에서 바로 돌려 봐도 된다):
-- select public.exec_sql('select slug, name from brands order by created_at desc limit 3');
