// 매거진 글 주소(slug) 규칙 — **클라(폼 미리보기)와 서버(저장)가 같은 함수를 쓴다.**
// 두 곳이 갈라지면 "화면엔 이렇게 나온다고 했는데 저장하니 다른 주소"가 된다.
// ⚠️그래서 이 파일엔 서버 전용 코드를 넣지 말 것("use server" 금지, DB 접근 금지).

/** 주소로 쓸 수 있는 형태로 다듬는다. 여기서 **한글은 빠진다.**
 *  이유: 주소에 한글이 들어가면 브라우저가 퍼센트 인코딩해
 *  `%EA%B7%80%EC%97%AC...`처럼 길고 안 읽히는 문자열이 된다 — 카톡으로 옮겨 붙이면 더 심하다. */
export function normalizeSlug(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** 라우팅과 부딪히는 주소 — `/magazine/new`는 새 글 쓰기 화면이라 정적 경로가 이긴다.
 *  즉 slug를 `new`로 두면 **그 글은 영원히 안 열린다.** */
const RESERVED = ["new"];

export const SLUG_MIN = 3;

/** 저장해도 되는 주소인가. 통과하면 null, 아니면 사람이 읽을 수 있는 이유. */
export function slugError(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `주소는 영문·숫자로 ${SLUG_MIN}자 이상 적어주세요.`;
  if (RESERVED.includes(slug)) return `'${slug}'은 시스템이 쓰는 주소라 쓸 수 없어요.`;
  return null;
}

/** 제목에서 주소를 제안한다. 한글만 있는 제목이면 뽑을 글자가 없어 빈 문자열이 나온다
 *  — 그때는 부르는 쪽이 "직접 적어주세요"로 안내한다(예전엔 `article-mf3k2p`를 자동으로 붙였는데,
 *  대표가 "임의로 저장되는 것 같다"고 느낀 자리가 정확히 여기다, 08-13). */
export function suggestSlug(title: string): string {
  return normalizeSlug(title);
}
