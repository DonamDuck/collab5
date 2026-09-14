import { Fragment } from "react";
import Link from "next/link";
import type { BriefDoc, BriefNode } from "@/lib/brief-doc";

// 브리프 본문 렌더러 (2026-09-14)
//
// 🎨**디자인은 매거진 사다리를 그대로 따른다** (대표 지시 09-14: *"디자인 시스템은 잘 따라야해"*).
//    본문 17/1.85 · 소제목 굵게 · 인용은 좌측 3px 라인 + primary-tint · 폭 680 · 색은 전부 토큰.
// 🪤**단 타이포는 «명시 px»로 쓴다.** 루트가 `font-size:17px`이라 Tailwind rem 유틸이
//    전부 6.25% 부풀어 나온다(볼트 [[디자인-시스템]] §함정1). `text-lg` 같은 걸 쓰면 사다리가 어긋난다.
//
// ⭐**표가 이 렌더러의 존재 이유다.** 매거진이 못 그리는 유일한 블록이고, 브리프는 그게 뼈대다.

function marks(node: BriefNode): React.ReactNode {
  // 노션 표의 칸 안 줄바꿈(`<br>`)이 여기로 온다 — 파서가 hardBreak으로 바꿔 둔다.
  if (node.type === "hardBreak") return <br />;
  let el: React.ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") el = <strong className="font-semibold text-ink">{el}</strong>;
    else if (mark.type === "italic") el = <em>{el}</em>;
    else if (mark.type === "link") {
      const href = String(mark.attrs?.href ?? "#");
      const external = /^https?:\/\//.test(href);
      el = external ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary-on underline underline-offset-2">
          {el}
        </a>
      ) : (
        <Link href={href} className="font-medium text-primary-on underline underline-offset-2">
          {el}
        </Link>
      );
    }
  }
  return el;
}

/** 🪤**`<span>`으로 감싸지 않는다.** React가 배열에 key를 요구해서 처음엔 span을 둘렀는데,
 *  그러면 **DOM에 의미 없는 껍데기가 글자마다 생긴다.** 09-14에 코멘트 위젯으로 표 머리글을
 *  찍어 보니 선택자가 `… > th > span`으로 잡히고 크기가 셀(120x38)이 아니라 껍데기(23x16)로 왔다.
 *  Fragment는 key를 받으면서 DOM 노드를 안 만든다 — 클릭한 자리가 «진짜 그 자리»로 잡힌다. */
function inlines(nodes?: BriefNode[]): React.ReactNode {
  return (nodes ?? []).map((n, i) => <Fragment key={i}>{marks(n)}</Fragment>);
}

/** 셀 안의 문단을 인라인으로 편다 — 셀은 한 문단만 담는다(표 34개 실측: 여러 문단 0건). */
function cellInlines(node: BriefNode): React.ReactNode {
  const first = node.content?.[0];
  return inlines(first?.content);
}

/* ───────────────────────── 표 ───────────────────────── */

function Table({ node }: { node: BriefNode }) {
  const rows = node.content ?? [];
  if (!rows.length) return null;
  const [head, ...body] = rows;

  return (
    // 🪤**가로 스크롤 컨테이너가 꼭 필요하다** — 실측 최대 19행·4열이라 모바일에서 넘친다.
    //    페이지 본문이 옆으로 밀리지 않게 표 «자기» 안에서만 스크롤한다.
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {/* min-w는 «읽을 수 있는 바닥»이지 목표 폭이 아니다. 420으로 뒀더니 375 화면에서
          43px만 넘쳐 표 넷이 전부 스크롤됐다 — 그 정도면 스크롤을 만드는 것보다 들어가게 하는 게 낫다.
          320 = 한글 두 칸이 읽히는 하한. 그 아래로는 안 줄인다. */}
      <table className="w-full min-w-[320px] border-separate border-spacing-0 overflow-hidden rounded-lg border border-hairline text-left">
        <thead>
          <tr>
            {(head.content ?? []).map((c, i) => (
              <th
                key={i}
                scope="col"
                className={[
                  "bg-surface-soft px-4 py-2.5 align-bottom",
                  "text-[13px] font-semibold tracking-[0.01em] text-mute",
                  // 🪤**숫자 열은 «내용만큼만» 차지하게 한다.** 안 그러면 2열 표에서 반반으로 나뉘어
                  //    값이 저 멀리 오른쪽 끝에 붙고, 머리글과 숫자가 딴 데를 본다(09-14 관찰 넷에서 나왔다).
                  //    `w-px`가 그 신호다 — 표 레이아웃이 최소 너비로 줄여 준다.
                  c.attrs?.align === "right"
                    ? "w-px text-right whitespace-nowrap"
                    : "text-left",
                  i > 0 ? "border-l border-hairline" : "",
                ].join(" ")}>
                {cellInlines(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {(row.content ?? []).map((c, i) => {
                const right = c.attrs?.align === "right";
                return (
                  <td
                    key={i}
                    className={[
                      "border-t border-hairline px-4 py-3 align-top",
                      "text-[15px] leading-[1.6] break-keep",
                      i > 0 ? "border-l border-hairline" : "",
                      // 숫자 열 — 자릿수를 맞추고 무게를 올린다. 숫자 표의 「숫자」 칸이 이 자리다.
                      right
                        ? "w-px text-right font-semibold whitespace-nowrap tabular-nums text-ink"
                        : "text-left text-body",
                    ].join(" ")}>
                    {cellInlines(c)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── 블록 ───────────────────────── */

function block(node: BriefNode, key: number): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="text-[17px] leading-[1.85] break-keep text-body">
          {inlines(node.content)}
        </p>
      );

    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      if (level === 2) {
        return (
          <h2
            key={key}
            className="mt-14 text-[22px] font-bold leading-snug text-balance break-keep text-ink first:mt-0">
            {inlines(node.content)}
          </h2>
        );
      }
      // ⭐`### ✨ …` = 관찰의 «마무리 한 줄». 스킬이 형식째 고정한 장치라
      //   본문에 묻히지 않게 카드로 띄운다(09-14 대표 판: 「먹을 걸 자주자주 준다니.. 이 숲 너무 좋잖아..?」).
      return (
        <p
          key={key}
          className="rounded-lg border border-primary-tint bg-primary-pale px-5 py-4 text-[17px] font-semibold leading-relaxed text-balance break-keep text-ink">
          {inlines(node.content)}
        </p>
      );
    }

    case "blockquote":
      return (
        <blockquote
          key={key}
          className="space-y-2 border-l-[3px] border-primary-tint pl-4 text-[16px] leading-relaxed break-keep text-mute">
          {(node.content ?? []).map((c, i) => block(c, i))}
        </blockquote>
      );

    case "bulletList":
      return (
        <ul
          key={key}
          className="list-disc space-y-1.5 pl-5 text-[17px] leading-relaxed break-keep text-body marker:text-faint">
          {(node.content ?? []).map((li, i) => (
            <li key={i}>{inlines(li.content?.[0]?.content)}</li>
          ))}
        </ul>
      );

    case "orderedList":
      return (
        <ol
          key={key}
          className="list-decimal space-y-1.5 pl-5 text-[17px] leading-relaxed break-keep text-body marker:text-faint">
          {(node.content ?? []).map((li, i) => (
            <li key={i}>{inlines(li.content?.[0]?.content)}</li>
          ))}
        </ol>
      );

    case "horizontalRule":
      return <hr key={key} className="border-hairline" />;

    case "table":
      return <Table key={key} node={node} />;

    default:
      return null;
  }
}

export function BriefBody({ doc }: { doc: BriefDoc }) {
  const content = doc.content ?? [];
  if (!content.length) {
    return <p className="text-[16px] text-faint">본문이 아직 비어 있어요.</p>;
  }
  return <div className="space-y-5">{content.map((n, i) => block(n, i))}</div>;
}
