// 공용 입력 검증·포맷 — 클라·서버 공유 (plain module, "use server" 아님)

// 허용 특수문자: !@#$%^&*()_+-=[]{};':"\|,.<>/?
const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/**
 * 비밀번호 규칙 — 8자 이상 + 특수문자 1개 이상.
 * (영문·숫자·대소문자 등 다른 조건 없음)
 * 통과 시 null, 실패 시 안내 메시지.
 */
export function validatePassword(pw: string): string | null {
  if (pw.length < 8 || !SPECIAL.test(pw)) {
    return "비밀번호는 8자 이상, 특수문자 1개 이상 포함해야 해요.";
  }
  return null;
}

/**
 * 휴대폰번호 자동 하이픈 — 숫자만 입력받아 010-1234-5678 형태로.
 * 입력한 하이픈·문자는 무시(숫자만 남김), 최대 11자리.
 */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
