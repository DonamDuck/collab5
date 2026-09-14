// 브리프 문서 — 타입 + 마크다운 파서 (2026-09-14)
//
// ⭐**왜 매거진 것을 안 쓰고 새로 만드나.** 매거진(`magazine-markdown.ts`)은 표를 안 그린다.
//   `MAGAZINE_NODES` 11종에 `table`이 없고, 그 파일 머리말이 못 박았다 —
//   *"안 그리는 노드가 섞여 들어오면 저장은 되는데 화면엔 안 보이는 상태가 생긴다."*
//   그런데 **브리프는 표가 뼈대다.** 확정 브리프 7건 실측(09-14) = 표 **34개**, 브리프당 4.9개.
//   맨 위 「이분은 이런 분」 카드도, 「숫자로 옮겨보면」도 표다.
//   → 매거진에 얹으면 문서의 절반이 조용히 사라진다. 그래서 그릇을 따로 판다.
//
// ⭕**대신 방법론은 그대로 빌렸다.** 범용 마크다운 파서를 붙이지 않고, **우리가 그리는 것만 판다.**
//   지원 범위와 파싱 범위를 같게 유지한다(매거진이 정한 규율).
//
// 📏**표 스펙은 실측으로 정했다** (확정 브리프 7건 · 표 34개):
//   - 열 수 = 2열 14 · 3열 16 · 4열 4  → **2~4열**만 지원하면 된다
//   - 행 수 = 중앙값 5 · 최대 19       → **가로 스크롤 컨테이너**가 필요하다
//   - 머리글 = `항목/내용` 6회(카드 표) · `(빈칸)/무엇/숫자` 6회(숫자 표) · 나머지 22종은 각 1회
//   → ⭐**표 「종류」를 여러 개 만들 이유가 없다.** 한 컴포넌트 + 셀 단위 정렬이면 전부 덮인다.
//   ⛔셀 병합·중첩 표는 **34개 중 0건**이라 만들지 않는다.

export interface BriefNode {
  type: string;
  /** heading `{level}` · tableCell `{header, align}` · link 마크 `{href}` */
  attrs?: Record<string, unknown>;
  content?: BriefNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface BriefDoc {
  type?: "doc";
  content?: BriefNode[];
}

/** 지원 노드 — **이 목록 밖은 만들지 않는다.** 파싱 범위 = 렌더 범위. */
export const BRIEF_NODES = [
  "doc", "paragraph", "text", "hardBreak",
  "heading", // level 2 = 절 제목 / level 3 = ✨ 마무리 줄
  "blockquote", // 인용 — 브리프에선 «축자 인용»이라 형태를 지킨다
  "bulletList", "orderedList", "listItem",
  "horizontalRule",
  "table", "tableRow", "tableCell",
] as const;

/* ───────────────────────── 인라인 ───────────────────────── */

/** `**굵게**` `*기울임*` `[텍스트](url)` 파싱.
 *  ⚠️순서 주의 — `**`를 `*`보다 먼저 잡아야 굵게가 기울임 둘로 쪼개지지 않는다(매거진과 같은 함정). */
function inlineOne(text: string): BriefNode[] {
  const out: BriefNode[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[2]) out.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    else if (m[4]) out.push({ type: "text", text: m[4], marks: [{ type: "italic" }] });
    else if (m[6]) {
      out.push({ type: "text", text: m[6], marks: [{ type: "link", attrs: { href: m[7] } }] });
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out.length ? out : [{ type: "text", text }];
}

/** 🩸**노션이 «표 안 줄바꿈»을 `<br>` 태그로 내보낸다** (09-14 라파의 숲에서 실측).
 *  그냥 파싱하면 카드 표의 「collab5가 읽은 글」 칸에 `<br>`이 **글자 그대로** 찍힌다.
 *  ⚠️여기서만 HTML을 인정한다 — 범용 HTML 파서를 붙이지 않는다(파싱 범위 = 렌더 범위). */
function inline(text: string): BriefNode[] {
  const parts = text.split(/<br\s*\/?>/i);
  if (parts.length === 1) return inlineOne(text);
  const out: BriefNode[] = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push({ type: "hardBreak" });
    const trimmed = p.trim();
    if (trimmed) out.push(...inlineOne(trimmed));
  });
  return out;
}

const para = (t: string): BriefNode => ({ type: "paragraph", content: inline(t) });
const listItem = (t: string): BriefNode => ({ type: "listItem", content: [para(t)] });

/* ───────────────────────── 표 ───────────────────────── */

const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
/** 구분선 — `|---|---:|`. 정렬은 여기서 «열 단위»로 읽어 셀에 새긴다. */
const TABLE_SEP = /^\s*\|[\s:|-]+\|\s*$/;

function splitRow(line: string): string[] {
  const m = line.match(TABLE_ROW);
  if (!m) return [];
  return m[1].split("|").map((c) => c.trim());
}

/** 구분선에서 열별 정렬을 읽는다. `---:` = 오른쪽, 나머지는 왼쪽.
 *  ⚠️가운데(`:---:`)는 만들지 않는다 — 34개 중 0건이고, 숫자는 오른쪽이 읽기 쉽다. */
function readAligns(sep: string): ("left" | "right")[] {
  return splitRow(sep).map((c) => (c.endsWith(":") && !c.startsWith(":") ? "right" : "left"));
}

function cell(text: string, header: boolean, align: "left" | "right"): BriefNode {
  return {
    type: "tableCell",
    attrs: { header, align },
    content: [para(text)],
  };
}

/* ───────────────────────── 본체 ───────────────────────── */

/** 마크다운 → 브리프 문서.
 *  지원 = 절 제목(`##`) · ✨ 줄(`###`) · 표 · 인용 · 목록 2종 · 구분선 · 문단. */
export function markdownToBriefDoc(md: string): BriefDoc {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const content: BriefNode[] = [];
  let i = 0;

  const flushList = (ordered: boolean) => {
    const items: BriefNode[] = [];
    const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
    while (i < lines.length) {
      const m = lines[i].match(re);
      if (!m) break;
      items.push(listItem(m[1]));
      i++;
    }
    content.push({ type: ordered ? "orderedList" : "bulletList", content: items });
  };

  /** 인용 — 연속한 `>` 줄을 한 덩어리로.
   *  ⭐브리프의 인용은 «축자»다(참여자 후기·본인 글). 안에 `- `가 오면 목록으로 살린다 —
   *    09-14 라파의 숲 확정본이 후기 넷을 그렇게 담았다. */
  const flushQuote = () => {
    const raw: string[] = [];
    while (i < lines.length && /^\s*>/.test(lines[i])) {
      raw.push(lines[i].replace(/^\s*>\s?/, ""));
      i++;
    }
    const body: BriefNode[] = [];
    let j = 0;
    while (j < raw.length) {
      const t = raw[j];
      if (/^\s*[-*+]\s+/.test(t)) {
        const items: BriefNode[] = [];
        while (j < raw.length && /^\s*[-*+]\s+/.test(raw[j])) {
          items.push(listItem(raw[j].replace(/^\s*[-*+]\s+/, "")));
          j++;
        }
        body.push({ type: "bulletList", content: items });
      } else {
        if (t.trim()) body.push(para(t));
        j++;
      }
    }
    if (body.length) content.push({ type: "blockquote", content: body });
  };

  const flushTable = () => {
    const head = splitRow(lines[i]);
    const aligns = readAligns(lines[i + 1]);
    i += 2;
    const rows: BriefNode[] = [
      {
        type: "tableRow",
        content: head.map((c, n) => cell(c, true, aligns[n] ?? "left")),
      },
    ];
    while (i < lines.length && TABLE_ROW.test(lines[i]) && !TABLE_SEP.test(lines[i])) {
      const cells = splitRow(lines[i]);
      rows.push({
        type: "tableRow",
        content: cells.map((c, n) => cell(c, false, aligns[n] ?? "left")),
      });
      i++;
    }
    content.push({ type: "table", content: rows });
  };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { i++; continue; }

    // 표 — 머리글 줄 + 구분선이 «짝»으로 와야 표다(본문에 우연히 든 `|`를 표로 읽지 않는다)
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flushTable();
      continue;
    }
    if (/^\s*>/.test(line)) { flushQuote(); continue; }
    if (/^\s*[-*+]\s+/.test(line)) { flushList(false); continue; }
    if (/^\s*\d+\.\s+/.test(line)) { flushList(true); continue; }

    // 구분선 — `---`. 표 구분선과 헷갈리지 않게 `|`가 없을 때만.
    if (/^\s*-{3,}\s*$/.test(t)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      // h1은 페이지 제목이 맡는다 → 본문에 오면 절 제목(2)으로 내린다
      const level = Math.min(Math.max(h[1].length, 2), 3);
      content.push({
        type: "heading",
        attrs: { level },
        content: inline(h[2]),
      });
      i++;
      continue;
    }

    content.push(para(t));
    i++;
  }

  return { type: "doc", content };
}
