import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpaceFull } from "@/lib/spaces";
import { formatBizNumber, spaceListed } from "@/lib/bizcheck";
import { telHref } from "@/lib/rent-copy";
import { spaceShareImage } from "../share-image";

// 하루 팝업 — 판매자 정보 (2026-09-19 대표 [J])
//
// 대표 원문: *「매장 전화번호는 공개 상세에서 빼자! 미리 노출하는 건 최대한 빼는 게 맞을 거 같아.」*
//   이어서 *「여기어때, 스마트스토어 들어가 보니깐 별도 '판매자 정보' 버튼? 섹션을 만들어서 클릭하면 별도 페이지에서도
//   보여 주네. depth를 페이지와 별개로 한 depth를 나눈 거지. 괜찮아 보여! 우리도 이렇게 결제 전에 노출하는 걸로
//   (약간은 찾기 힘들게 하는 거지!) 고고!」*
// ⚖️전자상거래법 제20조②는 판매자가 사업자면 상호·대표자·주소·전화·사업자번호를 «청약 전까지» 주라고 한다. 이 화면이 그 자리다.
//   들어오는 길은 둘이다. 공간 상세 아래(환불 규정 끝)의 작은 링크, 그리고 결제 직전 확인 팝업의 한 줄(새 탭).
// 🔒원본(`getSpaceFull`)을 읽는다. 사업자 칸은 공개 투영(`toPublic`)에서 빠져 있어서다. 대신 이 화면은 아래 다섯 칸만 꺼낸다.
//   「들어오는 법」·등록증 경로·개업일·국세청 조회 원문은 읽기만 하고 그리지 않는다.
// 🙈검색엔 안 올린다(`noindex`, 사이트맵에도 없음). 사람이 공간을 보다가 찾아 들어오는 화면이다.
// 🚪공개 중인 공간만 연다. 검토 대기·쉬는 중·초안이면 없는 공간과 똑같이 404(상세 `SEC-05`와 같은 이유).
//   🔁09-19 오후 대표 — 사업자등록번호가 빈 공간도 404다(`spaceListed`). 그래서 「아직 등록 전이에요」 갈래를 걷었다.
//   번호가 있으면 대표자·개업일·등록증도 같이 있다(저장이 넷을 한꺼번에 요구한다, `needsBizInfo`). 주소·가게 전화는 등록 폼이 필수로 받는다.
export const dynamic = "force-dynamic";

const loadSpace = cache((slug: string) => getSpaceFull(slug));

/** 없는 공간의 메타. 공개 전 공간도 이것과 똑같이 준다(«있지만 못 보는 공간»을 가려내지 못하게). */
const NOT_FOUND_META: Metadata = { title: "공간을 찾을 수 없어요 — collab5", robots: { index: false } };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const sp = await loadSpace(slug);
  if (!sp || !spaceListed(sp)) return NOT_FOUND_META;
  const url = `/rent/${sp.slug}/seller`;
  // 🔗09-27 QA — 설명과 링크 카드가 없어서 루트 것(소개서 안내 문장·사이트 슬로건·홈 주소)을 물려받았다.
  //   검색엔 안 올려도 주소는 남에게 건넬 수 있다. 붙이면 이 공간의 판매자 정보라고 말하게 한다.
  //   ⚠️`openGraph`는 루트와 합쳐지지 않고 통째로 갈린다(상세 화면 SC-06과 같다). 그림도 상세와 같은 규칙이다.
  //   설명엔 칸 이름만 적고 값(번호·주소·전화)은 옮기지 않는다.
  const cardTitle = `판매자 정보 · ${sp.name}`;
  const description = `${sp.name}의 판매자 정보예요. 상호·대표자·사업자등록번호·사업장 주소·가게 전화를 담았어요.`;
  const image = spaceShareImage(sp.photos);
  return {
    title: `${cardTitle} — 하루 팝업`,
    description,
    robots: { index: false, follow: false },
    // 루트의 `canonical: "/"`를 물려받으면 «홈의 사본»이라고 말하게 된다. 자기 주소로.
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "collab5", locale: "ko_KR", url, title: cardTitle, description, images: [image] },
    twitter: { card: "summary_large_image", title: cardTitle, description, images: [image.url] },
  };
}

/** 한 줄. 라벨 폭은 가장 긴 「사업자등록번호」(15px 일곱 자)가 한 줄에 들어가는 값이다. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-hairline py-3.5 text-[16px] leading-relaxed break-keep last:border-b-0">
      <dt className="w-[112px] shrink-0 text-[15px] text-mute">{label}</dt>
      <dd className="min-w-0 flex-1 text-body [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export default async function SellerInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sp = await loadSpace(slug);
  if (!sp || !spaceListed(sp)) notFound();

  const bizName = sp.bizName.trim();
  const phone = sp.contactPhone.trim();
  const tel = telHref(phone);

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pt-6 pb-14 sm:px-6 sm:pt-10">
      <Link href={`/rent/${sp.slug}`} className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
        ← {sp.name}
      </Link>
      <h1 className="mt-3 text-[24px] font-bold leading-tight tracking-tight text-ink">판매자 정보</h1>
      <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">이 공간을 빌려주시는 사장님의 사업자 정보예요.</p>

      <dl className="mt-6 border-t border-hairline">
        <Row label="상호">
          {bizName || (
            // 🏷상호 칸이 생기기 전(09-19)에 올린 공간. 공간 이름을 대신 쓰되 상호가 아니라는 걸 붙여 둔다.
            <>
              {sp.name} <span className="text-mute">(공간 이름)</span>
            </>
          )}
        </Row>
        <Row label="대표자">{sp.bizOwnerName.trim()}</Row>
        <Row label="사업자등록번호">
          <span className="tabular-nums">{formatBizNumber(sp.bizNumber)}</span>
        </Row>
        <Row label="사업장 주소">{sp.address.trim()}</Row>
        <Row label="가게 전화">
          {tel ? (
            // ☎️메모가 섞인 번호 칸에서 `tel:`이 틀어지지 않게 번호 뽑기는 한 벌(`telHref`)을 쓴다(09-18 밤 QA G-19).
            <a href={`tel:${tel}`} className="underline underline-offset-2">
              {phone}
            </a>
          ) : (
            phone
          )}
        </Row>
      </dl>

      <p className="mt-6 text-[15px] leading-relaxed break-keep text-mute">
        collab5는 통신판매중개자로 거래 당사자가 아니에요.
      </p>
    </main>
  );
}
