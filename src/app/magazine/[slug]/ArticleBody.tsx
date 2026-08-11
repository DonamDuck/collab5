import Link from "next/link";
import { sanitizeHttpUrl } from "@/lib/enrich";
import type { MagazineDoc, MagazineNode } from "@/lib/types";

// 매거진 본문 렌더러 — Tiptap JSON을 순회해 React로 그린다. (2026-08-10)
//
// ⭐**서버 컴포넌트다.** 본문이 SSR 돼야 검색엔진이 글을 읽는다 — 매거진을 만드는 이유의 절반이 SEO다.
// ⛔`dangerouslySetInnerHTML`을 쓰지 않는다. 본문은 에디터가 만든 값이고, HTML을 그대로 주입하면
//    거기에 스크립트를 넣을 수 있게 된다. 노드를 하나씩 우리가 그리면 그 표면이 아예 없다.
//
// 🚨**이 파일은 `lib/types.ts`의 MAGAZINE_NODES와 짝이다.** PR2 에디터가 만드는 노드 이름과
//    여기서 받는 이름이 어긋나면 **그 블록이 화면에서 조용히 사라진다.** 노드를 늘릴 땐 양쪽을 같이 고칠 것.

/** 링크 마크에서 안전한 href만 꺼낸다. `javascript:` 같은 스킴을 여기서 끊는다. */
function linkHref(node: MagazineNode): string | undefined {
  const mark = node.marks?.find((m) => m.type === "link");
  const raw = mark?.attrs?.href;
  return typeof raw === "string" ? sanitizeHttpUrl(raw) : undefined;
}

/** 인라인 텍스트 — 굵게·기울임·밑줄·취소선·링크. 마크는 겹칠 수 있어 안쪽부터 감싼다. */
function Inline({ node, k }: { node: MagazineNode; k: number }) {
  if (node.type === "hardBreak") return <br />;
  if (node.type !== "text" || !node.text) return null;

  let el: React.ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") el = <strong className="font-semibold text-ink">{el}</strong>;
    else if (mark.type === "italic") el = <em>{el}</em>;
    else if (mark.type === "underline") el = <u>{el}</u>;
    else if (mark.type === "strike") el = <s className="text-mute">{el}</s>;
  }
  const href = linkHref(node);
  if (href) {
    // 외부 링크 기본값 = 새 탭 + nofollow (소개서의 아티클 링크와 같은 규칙).
    el = (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow"
        className="font-medium text-primary-on underline underline-offset-2">
        {el}
      </a>
    );
  }
  return <span key={k}>{el}</span>;
}

function inlines(nodes?: MagazineNode[]) {
  return (nodes ?? []).map((n, i) => <Inline key={i} node={n} k={i} />);
}

/** 자식에서 글자만 훑어 모은다 — 알 수 없는 노드를 문단으로 살릴 때 쓴다. */
function plainText(node: MagazineNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(plainText).join("");
}

function Block({ node }: { node: MagazineNode }) {
  switch (node.type) {
    case "paragraph":
      // 빈 문단 = 사용자가 의도적으로 넣은 여백. 지우지 않고 높이만 준다.
      if (!node.content?.length) return <p className="h-4" aria-hidden="true" />;
      return <p className="text-[17px] leading-[1.85] text-body">{inlines(node.content)}</p>;

    case "heading":
      // level은 3만 쓴다(문서 구조상 h1=제목·h2=섹션). 다른 값이 와도 h3로 그린다 —
      // 본문 안에서 h2가 튀어나오면 페이지 목차 구조가 깨진다.
      return (
        <h3 className="mt-10 text-[20px] font-bold leading-snug text-ink first:mt-0">
          {inlines(node.content)}
        </h3>
      );

    case "blockquote":
      return (
        <blockquote className="border-l-[3px] border-primary-tint pl-4 text-[16px] leading-relaxed text-mute">
          {(node.content ?? []).map((child, i) => <Block key={i} node={child} />)}
        </blockquote>
      );

    case "pullQuote":
      // 강조 박스 — Tiptap 기본에 없어 PR2에서 커스텀 확장으로 만든다.
      // ⚠️자식이 블록(paragraph)이 아니라 **인라인 텍스트**다(blockquote와 다른 점).
      return (
        <p className="my-2 text-center text-[19px] font-semibold leading-relaxed text-balance break-keep text-ink">
          {inlines(node.content)}
        </p>
      );

    case "bulletList":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-[17px] leading-relaxed text-body marker:text-faint">
          {(node.content ?? []).map((li, i) => <Block key={i} node={li} />)}
        </ul>
      );
    case "orderedList":
      return (
        <ol className="list-decimal space-y-1.5 pl-5 text-[17px] leading-relaxed text-body marker:text-faint">
          {(node.content ?? []).map((li, i) => <Block key={i} node={li} />)}
        </ol>
      );
    case "listItem":
      // 항목 안의 문단은 <p> 없이 흘려보낸다 — 안 그러면 글머리표와 글자가 줄바꿈으로 갈린다.
      return <li>{(node.content ?? []).flatMap((c) => inlines(c.content))}</li>;

    case "horizontalRule":
      return <hr className="my-4 border-hairline" />;

    case "image": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      if (!src) return null;
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption : "";
      const w = Number(node.attrs?.width);
      const width = Number.isFinite(w) && w > 0 ? w : null;
      return (
        // ⭐폭은 `max-width`로 준다 — **고정폭이 아니라 상한이다.**
        //   그래야 대표가 정한 크기를 지키면서도, 화면이 그보다 좁으면(모바일) 화면에 맞춰 줄어든다.
        //   `width`로 주면 폰에서 사진이 화면 밖으로 삐져나가 가로 스크롤이 생긴다(대표 지시 08-10).
        //   ⚠️figure를 가운데 정렬해야 좁힌 사진이 왼쪽에 붙지 않는다.
        <figure className="my-2 mx-auto" style={width ? { maxWidth: width } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || caption}
            loading="lazy"
            className="w-full rounded-md bg-surface-soft"
          />
          {caption && (
            <figcaption className="mt-2 text-center text-[14px] leading-relaxed text-faint">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    }

    default: {
      // 🛟**모르는 노드를 버리지 않는다.** 나중에 에디터에 블록을 추가하고 여기를 안 고치면
      //   글이 조용히 사라지는데, 그게 제일 늦게 발견되는 고장이다. 글자만이라도 살려서 티가 나게 한다.
      const text = plainText(node);
      if (!text) return null;
      return <p className="text-[17px] leading-[1.85] text-body">{text}</p>;
    }
  }
}

export function ArticleBody({ doc }: { doc: MagazineDoc }) {
  const blocks = doc?.content ?? [];
  if (blocks.length === 0) {
    return <p className="text-[16px] text-faint">본문이 아직 비어 있어요.</p>;
  }
  // space-y로 블록 간격을 한 곳에서 준다 — 블록마다 margin을 달면 서로 상쇄돼 간격이 들쭉날쭉해진다.
  return (
    <div className="space-y-5">
      {blocks.map((node, i) => <Block key={i} node={node} />)}
    </div>
  );
}

/** 아티클 하단 — 연결된 소개서로 보내는 카드. **매거진과 소개서를 잇는 핵심 동선이다.** */
export function BrandLinkCards({ links }: { links: { slug: string; name: string; tagline: string }[] }) {
  if (links.length === 0) return null;
  return (
    <div className="space-y-2">
      {links.map((b) => (
        <Link
          key={b.slug}
          href={`/m/${b.slug}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3.5 transition-colors hover:bg-primary-pale"
        >
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold text-ink">{b.name}</span>
            {b.tagline && (
              <span className="mt-0.5 block truncate text-[14px] text-mute">{b.tagline}</span>
            )}
          </span>
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
