import Link from "next/link";
import type { SpacePublic } from "@/lib/types";
import { withJosa } from "@/lib/rent-copy";
import { lowestPrice, productPrice, sellableProducts } from "@/lib/rent-products";
import { CoverPlaceholder, won } from "./ui";

// 🎫소개서에 붙는 「○○가 빌려주는 공간」 (2026-09-19 대표 [H])
//
// 공간 상세에서 소개서로 가는 길(`HostBrandCard`)은 있는데 반대 길이 없었다. 소개서를 보고 온 사람은
//   그 브랜드가 공간을 빌려준다는 것을 알 방법이 없었다.
// ⭐소개서는 1팀 화면이라 거기엔 한 줄(이 컴포넌트를 부르는 자리)만 두고 나머지는 여기서 한다. 공간이 없으면 아무것도 안 그린다.
// 🎨카드 한 장 = 사진 · 이름 · 동네 · 시간당 값. 목록(`/rent`)의 카드보다 작게 둔다. 여기선 소개서가 주인공이고 이건 딸린 길이다.
//   제목 크기(21px)와 위 구분선은 소개서 본문 절(`MakerArticle`의 Section)과 같은 값이라 한 문서의 절로 읽힌다.
export function BrandSpaces({ brandName, spaces }: { brandName: string; spaces: SpacePublic[] }) {
  if (spaces.length === 0) return null;
  return (
    <section aria-labelledby="brand-spaces-title" className="mt-9 border-t border-hairline pt-8 print:hidden">
      <h2 id="brand-spaces-title" className="text-[21px] font-bold leading-snug tracking-tight break-keep text-ink">
        {withJosa(brandName, "이/가")} 빌려주는 공간
      </h2>
      <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">하루 팝업에서 필요한 시간만큼 빌릴 수 있어요.</p>
      <ul className="mt-4 space-y-3">
        {spaces.map((sp) => {
          const cover = sp.photos[0];
          const price = lowestPrice(sp) || sp.priceHour;
          const varies = new Set(sellableProducts(sp).map((p) => productPrice(sp, p))).size > 1;
          return (
            <li key={sp.slug}>
              <Link
                href={`/rent/${sp.slug}`}
                className="flex items-center gap-3.5 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:border-border-strong"
              >
                <span className="block h-[72px] w-[96px] shrink-0 overflow-hidden rounded-md">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <CoverPlaceholder />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[16px] font-bold leading-snug break-keep text-ink">{sp.name}</span>
                  {sp.area && <span className="mt-0.5 block truncate text-[14px] text-mute">{sp.area}</span>}
                  {price > 0 && (
                    <span className="mt-1 block text-[15px] text-ink">
                      <span className="font-medium tabular-nums">{won(price)}</span>
                      <span className="text-mute"> {varies ? "부터 / 시간" : "/ 시간"}</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
