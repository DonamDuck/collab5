import { createHash } from "crypto";
// 수정 비밀번호 해시 (규칙 없음, 단방향). 서버 전용.
export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
