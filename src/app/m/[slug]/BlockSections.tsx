import { Fragment } from "react";
import type { Block } from "@/lib/types";
import { PhotoSlider } from "@/components/PhotoSlider";
import { normalizeUrl, prettyUrl } from "@/lib/links";

const TITLES: Record<Block["type"], string> = {
  metrics: "우리의 숫자 지표",
  reviews: "이런 이야기를 들었어요",
  team: "이런 사람들이 만들고 있어요",
  press: "이런 곳에 소개됐어요",
  space: "우리의 공간을 소개해요",
  custom: "",
};

export function BlockSections({
  blocks,
  Section,
}: {
  blocks: Block[];
  Section: React.ComponentType<{ title: string; children: React.ReactNode }>;
}) {
  return (
    <>
      {blocks.map((b, i) => {
        const title = b.type === "custom" ? b.title : TITLES[b.type];
        const content = (
          <>
            <BlockBody b={b} />
            {b.photos.length > 0 && (
              <div className="mt-3 max-w-[460px] print:mx-auto print:break-inside-avoid">
                <PhotoSlider photos={b.photos} />
              </div>
            )}
            {b.links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {b.links.map((l, k) => (
                  <a
                    key={k}
                    href={normalizeUrl(l.url)}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex h-9 max-w-full items-center gap-1 truncate rounded-sm bg-surface-soft px-3 text-[14px] font-medium text-body hover:bg-primary-pale hover:text-primary-on"
                  >
                    🔗 {l.label?.trim() || prettyUrl(l.url)}
                  </a>
                ))}
              </div>
            )}
          </>
        );
        // 제목 없는 커스텀 블록(본문/사진/링크만으로 생존)은 Section을 거치면 빈 <h2>가 그려지므로 감싸지 않는다.
        return title.trim() ? (
          <Section key={i} title={title}>
            {content}
          </Section>
        ) : (
          <Fragment key={i}>{content}</Fragment>
        );
      })}
    </>
  );
}

// 블록 타입별 본문 — 유니온을 type으로 좁힌 뒤 고유 필드 접근
function BlockBody({ b }: { b: Block }) {
  switch (b.type) {
    case "metrics":
      return (
        <div className="grid grid-cols-2 gap-3">
          {b.items.map((it, i) => (
            <div key={i}>
              {it.value && (
                <p className="text-[18px] font-bold leading-snug text-ink">{it.value}</p>
              )}
              <p className="mt-0.5 text-[14px] text-mute">{it.label}</p>
            </div>
          ))}
        </div>
      );
    case "reviews":
      return (
        <div className="space-y-3">
          {b.items.map((it, i) => (
            <div key={i} className="rounded-md bg-surface-soft p-4">
              <p className="text-[16px] leading-relaxed text-body">{it.quote}</p>
              {it.source && <p className="mt-1 text-[13px] text-faint">{it.source}</p>}
            </div>
          ))}
        </div>
      );
    case "press":
      return (
        <div className="space-y-3">
          {b.items.map((it, i) => (
            <div key={i} className="print:break-inside-avoid">
              <p className="text-[16px] text-body">
                <span className="font-medium text-ink">{it.title}</span>
                {it.year && <span className="text-mute"> · {it.year}</span>}
              </p>
              {it.desc && (
                <p className="mt-0.5 text-[15px] leading-relaxed text-mute">{it.desc}</p>
              )}
              {!!it.photos?.length && (
                <div className="mt-2 max-w-[460px] print:mx-auto">
                  <PhotoSlider photos={it.photos} />
                </div>
              )}
              {it.link && (
                <a
                  href={normalizeUrl(it.link)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-1 inline-block text-[14px] font-medium text-primary-on underline underline-offset-2"
                >
                  기사 보기
                </a>
              )}
            </div>
          ))}
        </div>
      );
    case "space":
      return (
        <>
          {b.desc && (
            <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">{b.desc}</p>
          )}
          {b.features.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {b.features.map((f) => (
                <span
                  key={f}
                  className="inline-flex h-9 items-center rounded-pill border border-hairline bg-surface px-3.5 text-[15px] text-body"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </>
      );
    case "team":
      return (
        b.intro && (
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">{b.intro}</p>
        )
      );
    case "custom":
      return (
        b.body && (
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">{b.body}</p>
        )
      );
  }
}
