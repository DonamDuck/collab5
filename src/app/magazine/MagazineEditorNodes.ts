import Image from "@tiptap/extension-image";
import { Node, mergeAttributes } from "@tiptap/core";

// 매거진 전용 Tiptap 커스텀 노드 (2026-08-10)
//
// 🚨**여기 노드 이름은 `lib/types.ts`의 MAGAZINE_NODES, 그리고 렌더러(`ArticleBody.tsx`)와 한 짝이다.**
//    셋 중 하나만 바꾸면 그 블록이 화면에서 조용히 사라진다 — 이름을 고칠 땐 셋을 같이 고칠 것.

/** 강조 박스(풀쿼트) — 본문 중간에 한 번 크게 띄우는 자리.
 *  ⚠️`blockquote`와 다르다: 인용문은 **남의 말**을 옮기는 것이고, 이건 **우리 문장을 키우는** 것이다.
 *  구조도 다르다 — blockquote는 안에 문단을 담지만 pullQuote는 인라인 텍스트를 직접 담는다
 *  (렌더러가 그 전제로 그린다). */
export const PullQuote = Node.create({
  name: "pullQuote",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: 'p[data-pull-quote="true"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        "data-pull-quote": "true",
        // 에디터 안에서도 결과와 비슷하게 보이도록 — 저장은 JSON이라 이 클래스는 화면에만 쓰인다.
        class: "my-2 text-center text-[19px] font-semibold leading-relaxed text-ink",
      }),
      0,
    ];
  },
});

/** 이미지 + 캡션 — 기본 Image엔 캡션 속성이 없어 확장한다.
 *  캡션을 별도 문단으로 두지 않고 **이미지 노드의 속성**으로 붙이는 이유: 문단이면 사용자가
 *  이미지만 지웠을 때 캡션이 고아로 남는다(그리고 그게 본문 사이에 떠 있으면 오타처럼 보인다). */
export const CaptionedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") ?? "",
        renderHTML: (attrs) =>
          attrs.caption ? { "data-caption": attrs.caption as string } : {},
      },
      /** 표시 가로폭(px). `null`이면 본문 폭에 꽉 채운다(기존 동작).
       *  ⚠️**높이는 저장하지 않는다** — 가로만 정하고 세로는 비율대로 따라가게 둔다.
       *  둘 다 저장하면 나중에 원본을 바꾸거나 본문 폭이 달라질 때 사진이 찌그러진다.
       *  ⚠️이 값은 **상한이지 고정폭이 아니다.** 렌더 쪽에서 `max-width`로 쓰므로,
       *  모바일처럼 화면이 더 좁으면 화면에 맞춰 줄어든다(대표 지시 08-10). */
      width: {
        default: null,
        parseHTML: (el) => {
          const w = Number(el.getAttribute("data-width"));
          return Number.isFinite(w) && w > 0 ? w : null;
        },
        // `style`을 같이 주는 이유 = **편집 화면에서도 바로 보이게.** data-width만 심으면
        // 저장 후 상세에서만 크기가 반영돼, 쓰는 사람은 결과를 못 보고 감으로 값을 넣게 된다.
        // (상세 렌더러는 이 style이 아니라 attrs.width를 직접 읽는다 — 그쪽이 정본.)
        //
        // 🚨**`min(…, 100%)`을 빼면 안 된다.** 이미지가 본문 폭에 맞춰 줄어드는 건
        //    Tailwind preflight의 `img { max-width: 100% }` 덕분인데, 여기서 `max-width`에
        //    px만 주면 **같은 속성이라 그 규칙을 덮어써 버린다.** 그러면 상한이 아니라 사실상
        //    고정폭이 돼, 폰(본문 폭 ~290px)에서 480px 사진이 칸 밖으로 삐져나간다.
        //    에디터 바깥 상자가 `overflow-hidden`이라 삐져나간 만큼 잘려서, 화면에는
        //    **"눌러도 크기가 그대로"로 보인다**(08-12 실측 — 대표가 본 증상이 이것).
        renderHTML: (attrs) =>
          attrs.width
            ? {
                "data-width": String(attrs.width),
                style: `max-width:min(${attrs.width}px, 100%)`,
              }
            : {},
      },
    };
  },

  /** 편집 화면에서도 **캡션이 사진 아래 보이게** 한다(대표 지시 08-14).
   *  전엔 캡션이 `data-caption` 속성으로만 들어가 발행된 글에서만 보였다 — 쓰는 사람은 결과를
   *  못 본 채 감으로 적어야 했고, 실제로 "캡션이 안 나온다"는 제보로 돌아왔다.
   *
   *  ⭐**캡션을 `<figcaption>` 텍스트로 넣지 않고 `data-caption` + CSS `::after`로 그린다.**
   *    텍스트 노드로 넣으면 에디터 안에서 사진을 복사·붙여넣을 때 그 글자가 **본문 문단으로 한 번 더**
   *    들어온다(붙여넣기는 DOM을 다시 파싱하므로). 가짜 텍스트는 클립보드에도 안 담기고 파서도 못 본다.
   *  ⚠️`data-caption`은 `<img>`에도 그대로 남긴다 — `parseHTML`이 img에서 읽는 계약이라
   *    figure에만 두면 복사·붙여넣기에서 캡션이 증발한다.
   *  ⚠️캡션이 없으면 예전처럼 `<img>` 하나만 낸다 — 빈 figure가 여백을 만들지 않게. */
  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
    const caption = attrs["data-caption"];
    if (!caption) return ["img", attrs];
    return ["figure", { class: "mag-figure", "data-caption": caption }, ["img", attrs]];
  },
});
