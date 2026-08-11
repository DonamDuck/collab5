import type { MagazineDoc, MagazineNode } from "./types";

// 마크다운 → Tiptap JSON (2026-08-10)
//
// ⭐**이게 없으면 편집 화면이 실사용에서 바로 막힌다.** 대표는 초안을 마크다운으로 들고 온다
//   (Cowork·옵시디언에서 씀). 그냥 붙여넣으면 `###`·`>`·`**`가 **평문 그대로** 들어가서
//   소제목·인용을 전부 손으로 다시 잡아야 한다. 지시서 §2-2가 못 박은 요구사항.
//
// ⚠️범용 마크다운 파서를 붙이지 않았다. 우리가 지원하는 블록은 8종뿐이고(MAGAZINE_NODES),
//   파서를 넣으면 우리가 안 그리는 노드(표·코드블록·이미지 문법 등)가 섞여 들어와
//   **저장은 되는데 화면엔 안 보이는** 상태가 생긴다. 지원 범위와 파싱 범위를 같게 유지한다.

/** `**굵게**` `*기울임*` `~~취소선~~` `[텍스트](url)` 인라인 파싱. */
function inline(text: string): MagazineNode[] {
  const out: MagazineNode[] = [];
  // 순서 주의: `**`를 `*`보다 먼저 잡아야 굵게가 기울임 둘로 쪼개지지 않는다.
  const re = /(\*\*(.+?)\*\*)|(~~(.+?)~~)|(\*(.+?)\*)|(\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[2]) out.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    else if (m[4]) out.push({ type: "text", text: m[4], marks: [{ type: "strike" }] });
    else if (m[6]) out.push({ type: "text", text: m[6], marks: [{ type: "italic" }] });
    else if (m[8]) {
      out.push({
        type: "text",
        text: m[8],
        marks: [{ type: "link", attrs: { href: m[9] } }],
      });
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out.length ? out : [{ type: "text", text }];
}

const para = (t: string): MagazineNode => ({ type: "paragraph", content: inline(t) });
const listItem = (t: string): MagazineNode => ({
  type: "listItem",
  content: [para(t)],
});

/** 마크다운 텍스트를 Tiptap 문서로. 지원 = 소제목·인용·강조박스·목록 2종·구분선·문단. */
export function markdownToDoc(md: string): MagazineDoc {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const content: MagazineNode[] = [];
  let i = 0;

  const flushList = (ordered: boolean) => {
    const items: MagazineNode[] = [];
    const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
    while (i < lines.length) {
      const m = lines[i].match(re);
      if (!m) break;
      items.push(listItem(m[1]));
      i++;
    }
    content.push({ type: ordered ? "orderedList" : "bulletList", content: items });
  };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { i++; continue; }                       // 빈 줄은 문단 구분으로만 쓰고 노드로 안 남긴다

    if (/^(---|___|\*\*\*)$/.test(t)) {              // 구분선
      content.push({ type: "horizontalRule" }); i++; continue;
    }

    const h = t.match(/^(#{1,6})\s+(.*)$/);          // 소제목 — 레벨과 무관하게 h3로 통일
    if (h) {
      // ⚠️`#`이 하나든 넷이든 전부 level 3이다. 본문 안에서 h1·h2가 나오면 페이지의
      //    제목 구조(h1=아티클 제목)가 깨져 SEO·접근성 양쪽에서 손해다.
      content.push({ type: "heading", attrs: { level: 3 }, content: inline(h[2]) });
      i++; continue;
    }

    if (t.startsWith(">")) {                          // 인용문 — 연속된 `>` 줄을 한 덩어리로
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      content.push({
        type: "blockquote",
        content: buf.filter(Boolean).map(para),
      });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) { flushList(true); continue; }
    if (/^\s*[-*+]\s+/.test(line)) { flushList(false); continue; }

    // 그 밖은 문단. 연속된 줄은 한 문단으로 합치지 않는다 —
    // 대표 글은 줄바꿈이 곧 호흡이라, 합치면 원문의 리듬이 사라진다.
    content.push(para(t));
    i++;
  }

  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** 붙여넣은 텍스트가 마크다운처럼 보이는가 — 자동 변환을 걸지 말지 판단용. */
export function looksLikeMarkdown(text: string): boolean {
  return /^#{1,6}\s|\n#{1,6}\s|^>\s|\n>\s|\*\*.+?\*\*|^\s*[-*+]\s|\n\s*[-*+]\s/.test(text);
}
