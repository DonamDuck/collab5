import { getSessionUser } from "./supabase/server";
import { getProfile } from "./profiles";
import { getRentMock } from "./rent-mock";

// 매거진 편집 권한 (2026-08-10) — 스펙 = Obsidian [[매거진-기능-개발지시]] §5
//
// ⚠️`lib/staff.ts`의 `isStaffUser`를 쓰지 않는다. 그 파일 주석이 명시한다 —
//    *"소유·권한 판정에는 쓰지 마라 — 이건 UI·비용 예외용이고, 남의 데이터 접근 권한이 아니다."*
//    편집 권한은 **남의 데이터를 고칠 수 있느냐**의 문제라 성격이 다르다. 그래서 별도 파일.
//
// ⚠️판정 기준을 **user_id 숫자가 아니라 이메일**로 잡은 이유: 나중에 편집자를 늘릴 때
//    그 사람의 내부 id를 조회해 코드에 박는 대신 환경변수에 이메일만 추가하면 되게.

/** 편집자 이메일 목록 — 환경변수(콤마 구분) 우선, 없으면 대표 계정 폴백.
 *  ⚠️`NEXT_PUBLIC_`을 붙이지 않는다 — 클라이언트로 새어나가면 편집자 명단이 공개된다. */
function editorEmails(): string[] {
  const raw = process.env.MAGAZINE_EDITOR_EMAILS ?? "dudejrthd@gmail.com";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** 지금 로그인한 사람이 편집자인가 — **서버에서만 부른다.**
 *
 *  🚨클라이언트의 버튼 숨김은 UX일 뿐 보안이 아니다. 작성·수정·삭제·초안 조회의
 *    **모든 서버 진입점**에서 이 함수를 통과시켜야 한다(지시서 §5).
 *    `/magazine/new`에 직접 주소를 치고 들어오는 경로가 실제로 열려 있다는 걸 잊지 말 것 —
 *    08-06에 소개서 편집에서 똑같은 구멍(`/register?edit=`로 화면 분기를 건너뜀)이 났다.
 */
export async function isMagazineEditor(): Promise<boolean> {
  // 🧪09-18 목 데이터(개발 빌드 전용) — 케이스가 편집자라고 적었을 때만. 편집자 명단 이메일을 목 세계에 넣지 않으려고.
  const mock = await getRentMock();
  if (mock) return !!mock.viewer.editor;
  const user = await getSessionUser();
  if (!user) return false;
  // 🔒09-18 밤 — 판정은 «로그인 수단이 확인해 준 이메일»로 한다.
  //   `users.email`만 보던 때는 구멍이 있었다. 카카오가 이메일을 안 주면 /welcome에서 손님이 이메일을 «직접» 치는데,
  //   그 값이 중복 검사 없이 프로필에 굳어서 대표 이메일을 적으면 누구나 편집자가 됐다.
  //   세션 이메일이 확인됐고 명단에 있을 때만 통과시킨다.
  const authEmail = user.email?.trim().toLowerCase();
  if (!authEmail || !user.email_confirmed_at) return false;
  if (!editorEmails().includes(authEmail)) return false;
  // 세션만 믿지 않고 DB(`users`)도 다시 읽는다 — 프로필이 지워졌거나 계정이 바뀐 경우를 세션만으로는 알 수 없다.
  const profile = await getProfile(user.id);
  return profile?.email?.trim().toLowerCase() === authEmail;
}
