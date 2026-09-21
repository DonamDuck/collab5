import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpacePublic, listBookingsForGuest, listLiveBookingsIn } from "@/lib/spaces";
import { getProfileById, getSessionUserId } from "@/lib/profiles";
import { isRentAdmin } from "@/lib/rent-actions";
import { repo } from "@/lib/repo";
import { accessHowLine, COFFEE_CHAT_FREE, COFFEE_CHAT_WHEN_GUEST, CONTACT_RULE_GUEST, PRODUCT_HINT_GUEST, PRODUCT_LABEL } from "@/lib/rent-copy";
import { coffeeChatFree, lowestPrice, productNote, productPrice, sellableProducts } from "@/lib/rent-products";
import { durationLabel, futureSlots, rangeLabel, RENT_MIN_MINUTES } from "@/lib/rent-time";
import { bizMissingLine, bizVerified, spaceListed } from "@/lib/bizcheck";
import { OG_IMAGE } from "@/lib/site";
import { PhotoSlider } from "@/components/PhotoSlider";
import { BookingForm } from "./BookingForm";
import { categoryLabel, Chip, dateLabel, InfoList, InfoRow, won } from "../ui";
import { AreaMap } from "./AreaMap";
import { HostBrandCard } from "./HostBrandCard";
import { SectionNav } from "./SectionNav";

// 하루 팝업 — 공간 한 곳 + 신청 (2026-09-13)
//
// 🔁**09-13엔 주소도 소개서 링크도 가렸다.** 확정 전에 가게가 특정되면 결제 없이 직거래로 샐까 봐였다
//   (대표 09-13: *「사장님과 연결을 미리 해버리면 우리 결제 없이 그들끼리 거래로 해버릴 수도」*).
//   ✅09-16 대표 — 정확한 주소·핀을 연다(이름과 사진이 이미 가게를 특정하고, 전자상거래법 제20조②도
//     호스트 주소·전화를 청약 전에 보이라고 한다. `AreaMap` 머리말).
//   ✅09-17 대표 — 사장님이 「내 소개서 보여주기」를 켠 공간이면 소개서 링크도 연다(`/m/{slug}?back=…`).
//   📌이탈을 막는 건 이제 가리기가 아니라 **결제가 먼저라는 순서**다(`BookingForm` 머리말).
//   🔁09-19 대표 [J] — 가게 전화는 이 화면 본문에서 뺐다. 법이 청약 전에 주라는 값은 한 단계 안쪽 「판매자 정보」(`./seller`)가 든다.
// 🚨그래도 `getSpaceFull`은 부르지 않는다. `getSpacePublic`이 「들어오는 법」(옛 `accessNote`)을 런타임에서 지운다.
//
// 🎨09-13 재작업 — 소개서(`/m`)와 같은 옷. 위에 흰 카드 하나(이름 22 · 한 줄 17 · 동네 15 · 칩),
//   그 아래는 카드 밖 지면에 21px 섹션 제목 + 17px 본문(`MakerArticle`의 Section과 같은 자리).
//   ⛔「공간 정보」 키-값 회색 표를 뺐다 — 표는 행정 서류의 얼굴이고, 그 안의 값(인원·시간)은
//     상단 카드 메타 한 줄로, 값은 「값」 섹션으로 옮기니 표가 할 일이 없었다.
//   ⛔「우리 집 규칙」 민트 상자도 뺐다 — 상자는 고르는 것에만 쓴다(§카드 어휘). 규칙은 읽는 것이라
//     한 줄씩 구분선으로 세우고, 글자색을 ink로 올려 본문(body)보다 한 단 진하게 했다.
export const dynamic = "force-dynamic";

/** 신청 폼이 없는 화면에서 「빌릴 수 있는 날」에 까는 칩 수. 둘씩 세 줄(폰)을 넘기지 않는 값. */
const SLOT_PREVIEW = 6;

// ⚡09-18 밤 QA(SC-23) — 한 요청 안에서 한 번만 읽는다. `generateMetadata`와 본문이 같은 공간·같은 사람을 따로 물었고,
//   본문은 소개서 주인·사장님·나의 프로필을 따로 읽었다(대개 같은 사람이다). React `cache`는 요청 하나 동안만 기억한다.
const loadSpace = cache((slug: string) => getSpacePublic(slug));
const loadViewerId = cache(() => getSessionUserId());
const loadIsAdmin = cache(() => isRentAdmin());
const loadProfile = cache((id: number) => getProfileById(id));

/** 🔒없는 공간의 메타. 공개 전 공간을 남이 열 때도 «이것과 똑같이» 준다(09-18 밤 QA SEC-05). */
const NOT_FOUND_META: Metadata = { title: "공간을 찾을 수 없어요 — collab5", robots: { index: false } };

/** 공개 전(검토 대기·쉬는 중·초안) 공간을 볼 수 있는 사람 — 주인과 관리자. 본문과 메타가 같은 규칙을 쓴다. */
async function maySeeUnlisted(ownerUserId: number, uid: number | null): Promise<boolean> {
  return (!!uid && uid === ownerUserId) || (await loadIsAdmin());
}

/** 🎫**이 공간에 예약을 잡아 둔 손님**(09-18 밤 QA G-03).
 *  🩸사장님이 「잠시 쉬기」를 누르면 그 공간이 남에게 404가 됐다. 쉬기 팝업은 *「손님이 이미 결제한 예약은
 *    그대로라 그날 손님은 오세요」*라고 약속하는데, 정작 그 손님이 주소·유의 사항·사진을 다시 못 봤다.
 *    확정 메일의 링크도, 예약 목록의 공간 이름도 전부 404로 떨어졌다.
 *  ⭐그래서 **읽기는 열고 신청만 닫는다.** 새 신청이 안 들어오는 것이 「쉬기」의 뜻이지, 잡힌 예약을 감추는 게 아니다.
 *  🔒연 것은 이 사람의 예약이 살아 있는 동안뿐이다 — 취소·거절된 사람에겐 여전히 없는 공간이다. */
const loadMyBookings = cache((uid: number) => listBookingsForGuest(uid));
async function hasKeptBooking(spaceId: number, uid: number | null): Promise<boolean> {
  if (!uid) return false;
  const mine = await loadMyBookings(uid);
  return mine.some((b) => b.spaceId === spaceId && (b.status === "paid" || b.status === "confirmed" || b.status === "done"));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await loadSpace(slug);
  if (!sp) return NOT_FOUND_META;
  // 🔒09-18 밤 QA(SEC-05) — 공개 전 공간은 본문이 주인·관리자 말고는 404다. 메타도 같은 규칙으로 가린다.
  //   전엔 제목에 공간 이름, 설명에 동네, 정본 주소에 slug가 실려서 «있지만 못 보는 공간»과 «없는 공간»이 갈렸다.
  //   주소를 훑어 아직 안 열린 공간 목록을 만들 수 있었다는 뜻이다. 이제 남에게는 없는 공간과 똑같은 메타가 간다.
  // 🚪09-19 오후 대표 — 사업자등록번호가 빈 공간도 «공개 전»과 같다(`spaceListed`). 본문과 같은 판정이다.
  const listed = spaceListed(sp);
  if (!listed) {
    const who = await loadViewerId();
    // 🎫예약을 잡아 둔 손님에게도 연다(G-03). 본문과 메타가 갈리면 화면은 열리는데 탭 제목만 「찾을 수 없어요」가 된다.
    if (!(await maySeeUnlisted(sp.ownerUserId, who)) && !(await hasKeptBooking(sp.id, who))) return NOT_FOUND_META;
  }
  const url = `/rent/${sp.slug}`;
  // 링크 미리보기 설명은 한 줄 소개 또는 동네까지. 주소는 화면에서 열려 있지만(09-16) 카드엔 길 필요가 없다.
  // ⏱09-16 대표 — 시간 단위 대여. 「하루 빌려보세요」는 사실이 틀린 말이라 링크 카드에도 안 싣는다.
  const description = sp.tagline || `${sp.area}에서 필요한 시간만큼 빌릴 수 있는 공간이에요.`;
  const meta: Metadata = {
    title: `${sp.name} — 하루 팝업`,
    description,
    alternates: { canonical: url },
  };
  // 주인·관리자가 공개 전 공간을 볼 때도 검색엔진엔 안 올리고 링크 카드도 안 만든다.
  if (!listed) return { ...meta, robots: { index: false } };
  // 🔗09-18 밤 QA(SC-06) — 공개 공간의 링크 카드. 전엔 `openGraph`가 없어 루트 것을 물려받았다.
  //   카톡에 공간 링크를 붙이면 제목은 사이트 슬로건, 주소는 홈, 그림은 로고 카드로 떠서 «홈 링크»처럼 보였다.
  //   ⚠️`openGraph`는 루트와 합쳐지지 않고 통째로 갈린다. 사이트 이름·언어도 여기 다시 적는다.
  //   사진은 http 주소만 쓴다. 크롤러는 data URL을 못 읽는다(`/m` 소개서와 같은 규칙). 없으면 사이트 기본 썸네일.
  const cardTitle = `${sp.name} · 하루 팝업`;
  const image = sp.photos.find((p) => /^https?:\/\//.test(p)) ?? OG_IMAGE;
  return {
    ...meta,
    openGraph: { type: "website", siteName: "collab5", locale: "ko_KR", url, title: cardTitle, description, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title: cardTitle, description, images: [image] },
  };
}

/** 💸값 한 줄 — 굵은 시간당 값 + 「최소 N시간」·「최대 N명」 태그. 폰 헤더와 데스크톱 요약 카드가 같은 얼굴이다(09-18 대표).
 *  태그는 읽고 지나가는 것이라 설비 칩(`Chip`)보다 한 단 작은 회색 pill로 둔다. 값 옆에 같은 크기 칩이 서면 값이 묻힌다. */
/*  🛍09-18 상품 셋 — 값이 둘이면 낮은 값에 「부터」를 붙인다(대표 결정의 「가격도 각각」). 하나면 그 값 그대로. */
// ⏱🔒최소 시간은 모든 공간 1시간(대표 09-19 #88) — 공간 행의 값이 아니라 상수를 적는다.
function PriceLine({ priceHour, from, capacity }: { priceHour: number; from?: boolean; capacity?: number }) {
  const tags = [`최소 ${durationLabel(RENT_MIN_MINUTES)}`, capacity ? `최대 ${capacity}명` : ""].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <p className="text-ink">
        <span className="text-[24px] font-bold leading-none tracking-tight tabular-nums">{won(priceHour)}</span>
        <span className="ml-1 text-[15px] text-mute">{from ? "부터 / 시간" : "/ 시간"}</span>
      </p>
      <span className="flex gap-1.5">
        {tags.map((t) => (
          <span key={t} className="rounded-pill bg-surface-soft px-2.5 py-1 text-[13px] leading-none text-body">
            {t}
          </span>
        ))}
      </span>
    </div>
  );
}

/** 🧾🏪믿을 근거 줄(09-18 대표) — 「사업자 확인된 가게」·「네이버 지도에 등록된 가게」. 둘 다 없으면 안 그린다.
 *  ⭐초록 배지로 세우지 않는다. 값·제목보다 한 단 조용한 15px 글자에 체크 선 하나. 배지는 «고를 것»처럼 읽힌다.
 *  판정은 여기서 안 한다 — 사업자는 `bizVerified`(승인 && 국세청 일치), 네이버는 매칭 시각이 있을 때(`place-match` 판정을 통과한 것만 저장된다). */
function TrustMarks({ biz, naver, className = "" }: { biz: boolean; naver: boolean; className?: string }) {
  if (!biz && !naver) return null;
  const items = [biz ? "사업자 확인된 가게" : "", naver ? "네이버 지도에 등록된 가게" : ""].filter(Boolean);
  return (
    <ul aria-label="확인된 정보" className={`flex flex-wrap gap-x-4 gap-y-1.5 ${className}`}>
      {items.map((t) => (
        <li key={t} className="flex items-center gap-1.5 text-[15px] leading-snug text-body">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[16px] shrink-0 text-mint-on">
            <path d="m4.5 10.5 3.5 3.5 7.5-8" />
          </svg>
          {t}
        </li>
      ))}
    </ul>
  );
}

/** 소개서 본문 섹션과 같은 얼굴 — 상단 구분선 + 21px 제목 + 내용.
 *  🧭09-18 알약 줄(`SectionNav`)이 `data-nav-label`을 단 절을 DOM에서 모은다. 알약 이름은 `nav`, 없으면 제목 그대로.
 *  `scroll-margin-top` 7.25rem = 헤더 3.5 + 알약 줄 3.25 + 숨 0.5. 알약을 누르거나 `#apply`로 올 때 제목이 줄 밑에 안 깔린다. */
function Section({ title, nav, id, children }: { title: string; nav?: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} data-nav-label={nav ?? title} className="mt-9 scroll-mt-[7.25rem] border-t border-hairline pt-8">
      <h2 className="mb-4 text-[21px] font-bold leading-snug tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sp = await loadSpace(slug);
  if (!sp) notFound();

  const uid = await loadViewerId();
  const isOwner = !!uid && uid === sp.ownerUserId;
  // 검토 중·쉬는 중인 공간은 주인에게만 보인다. 남에게 404인 이유 —
  // 「있지만 못 본다」와 「없다」를 구분해 주면, 주소를 훑어 아직 안 열린 공간 목록을 만들 수 있다.
  // 🧾09-18 관리자도 연다 — 검토 화면(`/rent/review`)에서 공개 전 공간을 눈으로 봐야 한다. 판정은 `isRentAdmin` 한 벌.
  //   메타(`generateMetadata`)도 같은 함수(`maySeeUnlisted`)로 가린다.
  // 🎫예약을 잡아 둔 손님은 통과시킨다(09-18 밤 QA G-03). 폼은 아래에서 따로 닫는다.
  // 🚪09-19 오후 대표 — 사업자등록번호가 빈 공간은 공개 중이어도 남에겐 없는 공간이다(`spaceListed`). 문은 위 셋 그대로.
  const listed = spaceListed(sp);
  const keptBooking = !listed && !isOwner ? await hasKeptBooking(sp.id, uid) : false;
  if (!listed && !keptBooking && !(await maySeeUnlisted(sp.ownerUserId, uid))) notFound();

  // 🔁09-16 하루 단위 → 시간 단위. 날짜는 시간대 목록에서 뽑고, 그 날 이미 팔린 시간도 같이 읽는다.
  // ⏳지난 시간대는 여기서 걸러 낸다. 사장님이 열어 둔 날이 지나가도 목록에는 그대로 남아 있어서,
  //   안 거르면 달력에 지난주가 「빌릴 수 있는 날」로 서 있고 결제까지 통과한다.
  const openSlots = futureSlots(sp.openSlots).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const openDates = Array.from(new Set(openSlots.map((sl) => sl.date))).sort();

  // ⚡09-18 밤 QA(SC-23) — 아래 다섯 읽기는 서로를 기다릴 필요가 없다. 하나씩 기다리던 것을 한 번에 보낸다.
  //   소개서 로고만 소개서를 읽은 «뒤»라 그 안에서 잇는다. 읽는 값과 조건은 전과 같다.
  const [operatorProfile, brandCard, myBrands, myPhone, liveBookings] = await Promise.all([
    // 상호(운영하는 브랜드 이름). 사장님 실명(profiles에 따로 없다)은 안 읽는다.
    loadProfile(sp.ownerUserId),
    // 📎09-18 대표 결정 A — 소개서 줄이 카드가 되면서 이름에 더해 한 줄 소개와 로고도 꺼내 온다.
    //   로고는 `/m`과 같은 출처(소개서 주인 계정의 프로필 사진). Maker 객체는 카드에 넘기지 않고 글자 셋만 넘긴다.
    (async () => {
      const brand = sp.brandSlug ? await repo.getMakerBySlug(sp.brandSlug) : null;
      const logo = brand?.ownerUserId ? (await loadProfile(brand.ownerUserId))?.profileImage || undefined : undefined;
      return { name: brand?.name ?? "", oneLiner: brand?.oneLiner?.trim() ?? "", logo };
    })(),
    // 신청자가 자기 소개서를 붙일 수 있게 목록을 준다(선택). 없어도 신청은 된다 —
    // 이 기능은 소개서와 독립이라, 소개서를 요구하면 설계 전제가 깨진다(설계 §한 줄).
    uid && !isOwner
      ? repo.listMakersByOwner(uid).then((ms) => ms.map((m) => ({ slug: m.slug, name: m.name })))
      : Promise.resolve([] as { slug: string; name: string }[]),
    // ☎️09-17 — 신청 폼의 번호 칸을 프로필 번호로 미리 채운다. 로그인한 손님일 때만 읽는다.
    uid && !isOwner ? loadProfile(uid).then((p) => p?.phone?.trim() ?? "") : Promise.resolve(""),
    // ⚠️예약을 날짜마다 따로 부르면 열어 둔 날 수만큼 왕복이 는다. 한 번에 읽어 날짜별로 나눈다.
    openDates.length > 0 ? listLiveBookingsIn(sp.id, openDates) : Promise.resolve([]),
  ]);
  const operatorName = operatorProfile?.brandName?.trim() ?? "";
  const { name: brandName, oneLiner: brandOneLiner, logo: brandLogo } = brandCard;
  const brandHref = `/m/${encodeURIComponent(sp.brandSlug ?? "")}?back=${encodeURIComponent(`/rent/${sp.slug}`)}`;
  const takenByDate: Record<string, { start: string; end: string }[]> = {};
  for (const b of liveBookings) {
    (takenByDate[b.useDate] ??= []).push({ start: b.startTime, end: b.endTime });
  }
  // 규칙은 한 줄에 하나씩 적게 했다(`/rent/new`). 그 줄을 그대로 살려 한 줄씩 세운다.
  const ruleLines = sp.rules.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  // 신청 폼이 뜨는 조건 — 모바일 하단 고정 바가 본문을 가리지 않게 이때만 바닥 여백을 더 준다.
  // 🔒쉬는 중·검토 중인 공간엔 폼을 안 그린다(G-03). 서버(`startBookingAction`)도 `status !== "open"`을 막는다.
  // 🔑09-19 대표 [G] — 로그인 안 한 사람에게도 폼과 결제 바를 보인다. 바 버튼이 「로그인하고 신청하기」가 되어
  //   고른 값을 맡기고 로그인으로 보낸다(`BookingForm`의 `goLogin`). 서버 관문(`startBookingAction`의 로그인 검사)은 그대로다.
  const showForm = !isOwner && listed && openDates.length > 0;

  // 🧭09-17 디자인팀 — 데스크톱 오른쪽 기둥에 싣는 «가장 가까운 열린 시간».
  const nextSlot = openSlots[0];
  const eyebrow = [categoryLabel(sp.category), sp.area].filter(Boolean).join(" · ");
  // 🛍09-18 켜진 공간 상품. 값 줄은 낮은 값, 값이 서로 다르면 「부터」.
  const products = sellableProducts(sp);
  const fromPrice = lowestPrice(sp) || sp.priceHour;
  const priceVaries = new Set(products.map((p) => productPrice(sp, p))).size > 1;
  // 🧾🏪09-18 믿을 근거 둘. 네이버 매칭이 있으면 지도 핀도 네이버가 아는 그 가게 자리에 찍는다.
  const bizOk = bizVerified(sp);
  const onNaver = !!sp.placeMatchedAt && !!sp.placeName;
  const mapLat = onNaver && sp.placeLat != null ? sp.placeLat : sp.lat;
  const mapLng = onNaver && sp.placeLng != null ? sp.placeLng : sp.lng;

  return (
    <main
      className={`mx-auto w-full max-w-[720px] px-4 sm:px-6 sm:pt-10 lg:max-w-[1120px] sm:pb-16 ${
        sp.photos.length > 0 ? "pt-0" : "pt-8"
      } ${showForm ? "pb-[120px] lg:pb-12" : "pb-12"}`}
    >
      {/* 🎨09-17 디자인팀 재구성 (3팀 요청 · 아워플레이스·에어비앤비 참고)
          ① **사진이 먼저다.** 전엔 제목 카드 → 폭 460 사진이라 1440 화면에서 사진이 왼쪽 구석에 작게 붙고
             오른쪽이 비었다. 공간을 빌리는 사람이 제일 먼저 확인하는 건 «어떻게 생겼나»다.
             폰에선 화면 끝까지 붙여(`-mx-4`) 첫 화면의 절반을 사진이 맡는다.
          ② 제목 카드의 테두리를 걷었다. 사진 바로 아래 테두리 상자가 또 서면 덩어리가 둘로 읽힌다.
          ③ lg부터 **두 기둥**. 왼쪽은 읽는 것, 오른쪽은 «얼마 · 언제 · 누구» 요약이 따라 내려온다.
             ⛔오른쪽에 키위 버튼을 두지 않는다 — 결제 버튼은 하단 고정 바 하나뿐이다(09-14 대표). */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-14">
        <div className="min-w-0">
          {/* 🧭09-18 알약 줄 — 높이 0짜리 sticky 자리라 여기 둬도 흐름이 안 밀린다. 사진(없으면 제목 머리)을 지나면 내려온다. */}
          <SectionNav afterId={sp.photos.length > 0 ? "space-photos" : "space-head"} />
          {sp.photos.length > 0 && (
            <div id="space-photos" className="-mx-4 sm:mx-0">
              <PhotoSlider photos={sp.photos} rounded="rounded-none sm:rounded-lg" />
            </div>
          )}

          {/* 🔻09-14 「← 하루 팝업」 삭제 — 대표: *「앱이 아닌 경우 다들 모바일 기기의 뒤로 가기 버튼을
              잘 쓸 거 같은데, 일단 뒤로 가기 버튼은 지워도 될 거 같아」*. */}
          <header id="space-head" className={sp.photos.length > 0 ? "mt-5 sm:mt-7" : ""}>
            {eyebrow && <p className="text-[15px] text-mute">{eyebrow}</p>}
            <h1 className="mt-1.5 text-[24px] font-bold leading-tight tracking-tight break-keep text-ink sm:text-[28px]">
              {sp.name}
            </h1>
            {/* 🧾🏪폰에선 제목 바로 밑. lg에선 오른쪽 요약 카드가 같은 줄을 든다. */}
            <TrustMarks biz={bizOk} naver={onNaver} className="mt-2.5 lg:hidden" />
            {sp.tagline && (
              <p className="mt-3 text-[17px] leading-relaxed break-keep text-body">{sp.tagline}</p>
            )}
            {/* 💸09-18 대표 — *「금액은 이쁘게 넣어볼 수 있으면 넣는 방향으로」*. 09-14엔 금액 줄을 「비용」 절로 내렸는데,
                그땐 흐린 메타 줄 끝의 글자였다. 이제 제목 아래 굵은 값 + 최소 시간·인원 태그로 세운다(아워플레이스 상세).
                lg에선 오른쪽 요약 카드가 같은 줄을 들어서 여기선 숨긴다. 세부(커피챗 값 등)는 아래 「비용」 절이 맡는다. */}
            <div className="mt-4 lg:hidden">
              <PriceLine priceHour={fromPrice} from={priceVaries} capacity={sp.capacity} />
            </div>
            {/* 칩 줄 — 쓰임새 하나 + 설비 몇 개, 전부 같은 pill. 설비 전체는 아래 섹션에서 본다. */}
            <div className="mt-4 flex flex-wrap gap-2">
              {/* 🛍09-18 옛 범위 칩(`scopeLabel`) → 켜진 상품 이름. 둘 다 파는 공간에 「공간만」이 서면 틀린 말이다. */}
              {products.map((p) => (
                <Chip key={p}>{PRODUCT_LABEL[p]}</Chip>
              ))}
              {sp.facilities.slice(0, 4).map((f) => (
                <Chip key={f}>{f}</Chip>
              ))}
            </div>
            {brandName && sp.brandSlug && (
              // 📎09-17 대표 — 소개서 링크를 연다. `back`을 달아 소개서 화면에서 이 공간으로 돌아올 수 있게 한다.
              // 🔁09-18 대표 결정 A — 흐린 글자 한 줄 → 카드(`HostBrandCard` 머리말). lg에선 오른쪽 요약 카드 안으로 옮긴다.
              <HostBrandCard
                href={brandHref}
                name={brandName}
                oneLiner={brandOneLiner}
                logoUrl={brandLogo}
                className="mt-5 lg:hidden"
              />
            )}
            {isOwner && !listed && sp.status !== "draft" && !sp.bizOnFile ? (
              // 🚪09-19 오후 대표 — 사업자등록번호가 빈 공간. 공개 중이어도 손님에겐 404다. 왜인지와 할 일을 같이.
              <p className="mt-4 text-[15px] leading-relaxed break-keep text-lemon-on">
                {bizMissingLine(sp.status)} 그동안 손님에겐 안 보여요.{" "}
                <Link
                  href={`/rent/${sp.slug}/edit#f-biz`}
                  className="-my-[13px] inline-block py-[13px] underline underline-offset-2"
                >
                  고치러 가기
                </Link>
              </p>
            ) : isOwner && !listed ? (
              // ⏸09-17 잠시 쉬기 — 쉬는 공간에 「저희가 확인하고 열어 드릴게요」가 뜨면 검토에 걸린 줄 안다.
              <p className="mt-4 text-[15px] leading-relaxed break-keep text-mute">
                {sp.status === "paused"
                  ? "쉬는 중이라 손님에겐 안 보여요. 내 하루 팝업에서 다시 열 수 있어요."
                  : "아직 공개 전이라 사장님에게만 보이는 화면이에요. 저희가 확인하고 열어 드릴게요."}
              </p>
            ) : null}
          </header>

          {sp.body && (
            <Section title="공간 소개" nav="소개">
              <p className="whitespace-pre-line text-[17px] leading-relaxed break-keep text-body">
                {sp.body}
              </p>
            </Section>
          )}


          {/* 🔁09-14 「이런 것들이 있어요」 → **「공간·시설 안내」**(대표 지시).
              ⭐그리고 **태그와 줄글을 같이 싣는다** — 대표: *「여기는 태그도 좋은데, 줄글도 쓸 수 있는
                구조로 짜야 할 거 같아」*. 태그는 훑어서 고르는 것이고, 줄글은 「HDMI 케이블은 없어요」처럼
                태그로 못 담는 단서다. 둘 중 하나만 있어도 그 절은 뜬다. */}
          {(sp.facilities.length > 0 || sp.facilitiesNote) && (
            <Section title="공간·시설 안내" nav="시설">
              {sp.facilities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sp.facilities.map((f) => (
                    <Chip key={f}>{f}</Chip>
                  ))}
                </div>
              )}
              {sp.facilitiesNote && (
                <p className={`whitespace-pre-line text-[17px] leading-relaxed break-keep text-body ${sp.facilities.length > 0 ? "mt-4" : ""}`}>
                  {sp.facilitiesNote}
                </p>
              )}
            </Section>
          )}

          {/* 🔁09-18 대표 코멘트 — 「공간·시설 안내 하단으로, 좀 더 위로」. 무엇이 있는지 본 바로 다음에 무엇을 빌릴지 읽는다.
              🛍09-18 「비용」 → 「빌릴 수 있는 것」(대표: 「대관만, 공간 전체, 커피챗 … 고객은 신청할 때 이걸 선택」).
              앞선 코멘트 — 「일일카페로 하고 싶은 사람도, 예뻐서 대관만 하고 싶은 사람도 딱 보고 알 수 있게」.
              ⭐그래서 값만 적지 않고 사장님이 적은 «무엇을 쓰고 할 수 있는지»를 상품마다 같이 싣는다.
              상품 이름 밑 한 줄(`PRODUCT_HINT_GUEST`)은 우리 말, 그 아래 글은 사장님 말이다. */}
          <Section title="빌릴 수 있는 것" nav="상품">
            <div className="space-y-3">
              {products.map((p) => (
                <div key={p} className="rounded-lg border border-hairline bg-surface px-4 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-[17px] font-bold text-ink">{PRODUCT_LABEL[p]}</p>
                    <p className="text-[16px] text-ink">
                      <span className="font-medium tabular-nums">{won(productPrice(sp, p))}</span>
                      <span className="ml-1 text-[15px] text-mute">/ 시간</span>
                    </p>
                  </div>
                  <p className="mt-0.5 text-[15px] text-mute">{PRODUCT_HINT_GUEST[p]}</p>
                  {productNote(sp, p) && (
                    <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed break-keep text-body">
                      {productNote(sp, p)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[15px] text-mute">
              {products.length > 1 ? "신청할 때 둘 중 하나를 골라요. " : ""}최소 {durationLabel(RENT_MIN_MINUTES)}부터 빌릴 수 있어요.
            </p>
            {sp.coffeeChat && sp.coffeeChatMinutes > 0 && (
              // 🔁09-18 밤 QA(G-17) — 「어느 쪽에든」은 상품이 둘일 때만 맞는 말이다. 하나뿐인 공간에선 고를 쪽이 없다.
              // ☕09-19 무료 커피챗(대표 #93)도 같은 줄에 선다. 값 자리에 「무료」.
              <p className="mt-1.5 text-[15px] text-mute">
                커피챗 {sp.coffeeChatMinutes}분({coffeeChatFree(sp) ? COFFEE_CHAT_FREE : won(sp.coffeeChatPrice)})은{" "}
                {products.length > 1 ? "어느 쪽에든 더할 수 있어요." : "신청하실 때 같이 담을 수 있어요."}
              </p>
            )}
          </Section>

          {/* 📍09-14 신설 — 대표 지시(아워플레이스 참고). 좌표는 사장님이 주소를 넣을 때 한 번 재서
              `spaces.lat/lng`에 굳혀 둔다(`lib/geocode.ts`). 좌표가 없으면 주소만 적는다.
              🔁09-16 — 정확한 핀·정확한 주소로(위 `AreaMap` 머리말). */}
          <Section title="위치">
            {/* 🏪09-18 대표 — 네이버 지도의 가게와 일치한다고 판정된 공간만 상호 라벨·상호 검색 링크. 아니면 지금처럼 주소 핀만. */}
            {mapLat != null && mapLng != null ? (
              <AreaMap lat={mapLat} lng={mapLng} address={sp.address} placeName={onNaver ? sp.placeName : undefined} />
            ) : (
              <p className="text-[17px] leading-relaxed break-keep text-body">{sp.address}</p>
            )}
            {/* ☎️09-16엔 여기 가게 전화를 걸었다(전자상거래법 제20조② — 호스트의 상호·주소·전화를 청약 전에).
                🔁09-19 대표 [J] — *「매장 전화번호는 공개 상세에서 빼자! 미리 노출하는 건 최대한 빼는 게 맞을 거 같아.」*
                  법이 요구하는 값(상호·대표자·주소·전화·사업자번호)은 별도 화면 「판매자 정보」(`./seller`)로 옮겼다.
                  여기어때·스마트스토어처럼 한 단계 안쪽이다. 들어가는 길은 아래 환불 규정 끝의 작은 링크와 결제 직전 팝업.
                ⭐결제를 마친 손님은 예약 화면·확정 메일에서 가게 전화를 그대로 본다(`ContactBlock`·`hostContactLine`). */}
            {/* 🏷운영 = 가입할 때 받는 «브랜드 이름»이다(08-15 「상호」 → 「브랜드 이름」). 09-16 대표: 상호는 보이고
                사장님 실명은 안 보인다. 공간 이름은 사장님이 「을지로 2층 작업실」처럼 바꿀 수 있어서 따로 한 줄 둔다. */}
            {operatorName && (
              <p className="mt-3 text-[15px] leading-relaxed break-keep text-mute">
                운영 <span className="text-body">{operatorName}</span>
              </p>
            )}
          </Section>

          {/* 🔻09-17 디자인팀 — 신청 폼이 뜨는 화면에선 이 절을 뺀다. 바로 아래 달력이 같은 날을 격자로 보여 주는데,
              여기서 열린 시간 30개를 칩으로 다 깔면 폰에서 한 화면 반이 칩 벽이 됐다(모든 칸이 찬 공간 기준).
              폼이 없는 화면(사장님 본인 · 09-19부터 로그인 전엔 폼이 뜬다)에선 가까운 여섯 개만 보이고 나머지는 개수로 말한다. */}
          {!showForm && (
            <Section title="빌릴 수 있는 날" nav="날짜">
              {openDates.length === 0 ? (
                // ✍️09-18 밤 QA(G-26) — 「곧 새 날짜가 올라올 거예요」는 우리가 지킬 수 없는 약속이다.
                //   새 날을 여는 건 사장님이고, 영영 안 열 수도 있다. 사실만 남긴다.
                <p className="text-[17px] leading-relaxed text-body">지금은 열린 시간이 없어요.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {openSlots.slice(0, SLOT_PREVIEW).map((sl) => (
                      <Chip key={`${sl.date}-${sl.start}`}>{`${dateLabel(sl.date)} ${sl.start}~${sl.end}`}</Chip>
                    ))}
                  </div>
                  {openSlots.length > SLOT_PREVIEW && (
                    <p className="mt-3 text-[15px] text-mute">그 뒤로도 {openSlots.length - SLOT_PREVIEW}번 더 열려 있어요.</p>
                  )}
                </>
              )}
            </Section>
          )}

          {/* 📚09-14 신설 — 대표: *「이거 체크박스 빼고 여기 정보 영역으로 하고 (선택 사항)으로.
              「사장님께 잠깐 배워 볼 수 있어요」로 정규 타이틀로 섹션으로 다루자」*.
              ⭐설명하는 자리와 고르는 자리를 갈랐다. 고르는 일은 결제 단계의 옵션이 맡는다. */}
          {sp.coffeeChat && sp.coffeeChatMinutes > 0 && (
            <Section title="사장님과 커피챗 (선택)" nav="커피챗">
              {/* ☕09-16 대표 — 「사장님께 잠깐 배워보기」를 커피챗으로 다시 잡았다. 파는 것은 «현업 이야기»다.
                  🔁09-17 — 「언제」는 `COFFEE_CHAT_WHEN_GUEST` 한 줄만 쓴다(대표: 시간은 사장님이 정한다).
                    전엔 「사장님과 협의한 날짜에」라 메일의 「그날」과 말이 갈렸다.
                  🔻09-17 QA — 주제가 비었을 때 넣던 기본 예시(「재료는 어디서 떼는지…」)를 뺐다. 요가원·공방에도
                    같은 문장이 붙어 업종과 안 맞았고, 공간 셋을 이어 보면 같은 틀로 읽혔다. 비면 짧게 둔다. */}
              {/* ☕09-21 대표 코멘트 — 「좀만 타이틀 쪽으로 올리고 (선택)인 점을 노티」. 값 줄을 절 맨 끝에서 제목 바로 밑으로,
                  제목엔 「(선택)」. 안 담아도 공간은 빌릴 수 있다는 게 먼저 읽힌다. */}
              <p className="-mt-1 mb-3 text-[15px] text-mute">
                <span className="font-medium text-ink">{coffeeChatFree(sp) ? COFFEE_CHAT_FREE : `+${won(sp.coffeeChatPrice)}`}</span> · 원하시면 신청할 때 함께 담을 수 있어요
              </p>
              <p className="text-[17px] leading-relaxed break-keep text-body">
                {sp.coffeeChatMinutes}분 동안 사장님께 현업 이야기를 들을 수 있어요. {COFFEE_CHAT_WHEN_GUEST}
              </p>
              {/* ☕09-18 대표 코멘트 — 「사장님이 설정한 커피챗에서 제공할 수 있는 내용들이 여기 들어가야」.
                  사장님이 적은 주제를 줄마다 한 점으로 세운다. 한 문단이면 무엇을 들을 수 있는지가 안 세어진다. */}
              {sp.coffeeChatTopics.trim() && (
                <div className="mt-4">
                  <p className="text-[15px] font-medium text-body">이런 이야기를 나눌 수 있어요</p>
                  <ul className="mt-2 space-y-1.5">
                    {sp.coffeeChatTopics
                      .split("\n")
                      .map((l) => l.replace(/^[\s\-•·*]+/, "").trim())
                      .filter(Boolean)
                      .map((l, i) => (
                        <li key={i} className="flex gap-2 text-[16px] leading-relaxed break-keep text-body">
                          <span aria-hidden="true" className="text-mute">·</span>
                          <span className="min-w-0 flex-1">{l}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </Section>
          )}


          {/* 💸09-15 대표 — *「환불 규정 섹션 하나 만들고 환불 규정 넣자. 일단 제너럴하게 우리가 정한 환불규정으로」*.
              ⭐숫자는 `guestCancelRefundRate`(`lib/rent-payment.ts`)가 실제로 계산하는 값 그대로다.
                🚨문장으로 옮겨 적은 표가 코드와 어긋나면, 손님은 화면을 믿고 우리는 코드대로 돌려준다.
                그러니 여기 값을 고칠 일이 생기면 **그 함수부터 고치고 이 절을 맞춘다.**
              📌공간마다 다르게 두지 않는다. 사장님이 각자 정하면 손님이 매번 다시 읽어야 하고,
                분쟁이 났을 때 기준이 공간 수만큼 생긴다. */}
          {/* 📨09-16 — 비밀번호 같은 건 우리가 안 가진다. 「어떻게 받게 되는지」만 미리 말해 준다. */}
          <Section title="이용 안내">
            {/* 같은 문장이 확정 메일에도 나간다 — 정본은 `lib/rent-copy`다. */}
            <p className="text-[17px] leading-relaxed break-keep text-body">{accessHowLine(sp.accessHow)}</p>
            {/* ✍️09-17 QA — 「저장하지 않아요 / 전해 드립니다」로 한 절 안에서 격이 갈렸고, 앞 문장은 우리 입장이었다.
                손님에게 달라지는 것(누가 알려 주나)을 앞에 둔다. */}
            {/* ⏱09-17 대표 — 확정 뒤 2일 안에 사장님이 연락하는 규칙을 신청 전에 알린다. 문장 정본은 `rent-copy`. */}
            <p className="mt-2 text-[16px] leading-relaxed break-keep text-body">{CONTACT_RULE_GUEST}</p>
            <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
              출입 비밀번호 같은 건 사장님이 직접 알려 드려요. collab5는 따로 갖고 있지 않아요. 연락이 없으면 카카오톡으로
              알려 주세요.
            </p>
          </Section>

          {/* 🔁09-18 대표 코멘트 — 「유의사항 영역은 이용 안내 하단으로 빼자」. 소개·시설·위치로 공간을 먼저 보고,
              빌리기로 마음이 기운 뒤에 지킬 것을 읽는 순서다.
              ⭐⭐「사용 유의 사항」이 이 화면에서 제일 눈에 띄어야 한다(설계 §공간 카드).
              열쇠를 넘기는 두려움이 실제로 풀리는 자리다. 면색 대신 **한 줄씩 세운 구분선**과 ink 글자로
              무게를 준다 — 줄로 세우면 세 줄이 세 가지 약속으로 읽히고, 문단이면 한 덩어리로 넘어간다. */}
          <Section title="사용 유의 사항" nav="유의 사항">
            {/* 🔁09-14 구분선 → **번호**(대표: *「여기 라인을 빼주고, 불렛이나 1, 2, 3 식으로 하는 거 어떨까.
                규칙이니 마크다운 형태로 보여도 이쁠 거 같음」*).
                ⭐선은 「여기까지가 한 덩어리」만 말하고, 번호는 **몇 개인지와 몇 번째인지**를 같이 말한다.
                  약속은 세어지는 편이 낫다 — 「셋 중 둘째」가 「가운데 줄」보다 분명하다. */}
            <ol className="space-y-2.5">
              {ruleLines.map((line, i) => (
                <li key={i} className="flex gap-2.5 text-[17px] leading-relaxed break-keep text-ink">
                  {/* 번호는 본문보다 한 단 물러난 색·크기 — 세는 표지지 내용이 아니다.
                      `tabular-nums`로 폭을 고정해 두 자리가 와도 글줄 시작점이 안 흔들린다. */}
                  <span className="shrink-0 pt-[3px] text-[15px] font-medium tabular-nums text-mute">{i + 1}.</span>
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="환불 규정" nav="환불">
            <p className="text-[17px] leading-relaxed break-keep text-body">
              사장님이 거절하시면 <span className="font-medium text-ink">전액</span> 돌려드려요.
            </p>
            {/* 🆕09-19 오후 대표 — *「수락 전 취소는 당연히 전액 취소」*. 수락 뒤 한 시간 창과 같은 전액이라 한 문단에 둔다.
                숫자는 `guestCancelRefundPercent`의 두 갈래(`CancelStage`) 그대로다. */}
            <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">
              사장님이 <span className="font-medium text-ink">수락하시기 전</span>에 취소하셔도 전액이에요. 수락하신 뒤에도{" "}
              <span className="font-medium text-ink">한 시간 안</span>이면 남은 날과 상관없이 전액 돌려드려요.
            </p>
            {/* ✍️09-17 QA — 「남은 기간으로 정해져요」 피동·행정어. 경계가 날짜 기준이라는 것도 같이 말한다(`kstDaysUntil`). */}
            <p className="mt-3 text-[16px] leading-relaxed break-keep text-mute">
              수락하고 한 시간이 지나면 이용일까지 며칠 남았는지에 따라 달라져요. 몇 시에 취소하든 달력 날짜로 세요.
            </p>
            <dl className="mt-3 space-y-2 text-[16px]">
              {[
                ["7일 전까지", "전액 (100%)"],
                ["3일 전까지", "70%"],
                ["1일 전까지", "50%"],
                ["당일", "환불 없음"],
              ].map(([when, rate]) => (
                <div key={when} className="flex gap-3 leading-relaxed break-keep">
                  <dt className="w-[104px] shrink-0 text-mute">{when}</dt>
                  <dd className="min-w-0 flex-1 text-body">{rate}</dd>
                </div>
              ))}
            </dl>
            {/* 📜09-17 QA — 「이 규정은 collab5 규정을 따릅니다」는 동어반복이었고 원문으로 가는 길이 없었다.
                하루 팝업 조항은 `/terms#rent`에 있다(본 세션이 넣는다). */}
            <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
              돌려드리는 돈은 결제하신 수단으로 들어가요. 자세한 내용은{" "}
              <Link href="/terms#rent" className="underline underline-offset-2">
                이용약관
              </Link>
              에 있어요.
            </p>
            {/* ⚖️09-19 대표 [J] 판매자 정보 — 결제 전에 볼 수 있어야 하지만 «약간은 찾기 힘들게». 절 끝에 흐린 작은 링크 하나. */}
            <p className="mt-2 text-[14px] text-faint">
              <Link href={`/rent/${sp.slug}/seller`} className="underline underline-offset-2">
                판매자 정보
              </Link>
            </p>
          </Section>

          {/* ── 신청 ── */}
          <Section title="신청하기" nav="신청" id="apply">
            {isOwner ? (
              <p className="text-[17px] leading-relaxed break-keep text-body">
                사장님 공간이라 신청은 못 하세요. 받은 신청은{" "}
                <Link href="/rent/my?tab=host" className="underline underline-offset-4">
                  내 하루 팝업
                </Link>
                에서 보실 수 있어요.
              </p>
            ) : !listed ? (
              // 🎫09-18 밤 QA(G-03) — 쉬는 중·검토 중인 공간. 잡아 둔 예약이 있어 여기까지 온 손님에게
              //   「없는 공간」 대신 사실을 말한다. 쉬기 팝업이 사장님께 약속한 문장과 같은 뜻이다.
              <p className="text-[17px] leading-relaxed break-keep text-body">
                지금은 새 신청을 받지 않는 공간이에요. 잡아 두신 예약은 그대로예요.
              </p>
            ) : openDates.length === 0 ? (
              // 🔁09-17 QA — 열린 시간이 없는데 비로그인 손님에게 「로그인하고 신청하기」가 섰다. 로그인하고 오면
              //   이 문장을 본다(헛걸음). 열린 시간 검사를 로그인 검사보다 먼저 한다.
              <p className="text-[17px] leading-relaxed break-keep text-body">
                사장님이 새 시간을 열어 두시면 여기서 신청할 수 있어요.
              </p>
            ) : (
              <BookingForm
                spaceId={sp.id}
                spaceSlug={sp.slug}
                spaceName={sp.name}
                openSlots={openSlots}
                takenByDate={takenByDate}
                products={{
                  rentSpaceOn: sp.rentSpaceOn, rentSpacePrice: sp.rentSpacePrice, rentSpaceNote: sp.rentSpaceNote,
                  rentFullOn: sp.rentFullOn, rentFullPrice: sp.rentFullPrice, rentFullNote: sp.rentFullNote,
                }}
                coffeeChat={sp.coffeeChat}
                coffeeChatMinutes={sp.coffeeChatMinutes}
                coffeeChatPrice={sp.coffeeChatPrice}
                capacity={sp.capacity}
                useType={sp.useType}
                myBrands={myBrands}
                initialPhone={myPhone}
                signedIn={!!uid}
              />
            )}
          </Section>
        </div>

        {/* ── 데스크톱 오른쪽 기둥 — «얼마 · 언제 · 누구»를 스크롤 내내 들고 간다 ──
            아워플레이스 상세가 같은 자리에 호스트·시간당 값·예약 버튼을 세운다. 우리는 버튼 대신 «신청 절로 가는 길»만 둔다.
            ⛔폰에선 안 그린다 — 폰은 위 메타 한 줄과 하단 고정 바가 같은 일을 한다. */}
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          {/* 메타 줄·소개서 줄은 lg에서 위 헤더에서 숨기고 여기로 모인다. 같은 값이 한 화면에 두 번 서지 않게. */}
          <div className="rounded-lg border border-hairline bg-surface p-6 shadow-e1">
            <PriceLine priceHour={fromPrice} from={priceVaries} capacity={sp.capacity} />
            <TrustMarks biz={bizOk} naver={onNaver} className="mt-4 flex-col" />
            <InfoList className="mt-5 border-t border-hairline pt-5">
              {/* 🛍09-18 켜진 상품 이름 — 「부터」가 무엇 중 낮은 값인지 요약 카드에서도 읽히게. */}
              {products.length > 0 && (
                <InfoRow
                  label="상품"
                  value={
                    // 한 줄에 둘을 이으면 340 카드에서 「공간 전체 / 30,000원」이 꺾였다(09-18 실측). 상품마다 한 줄.
                    <>
                      {products.map((p) => (
                        <span key={p} className="block">
                          {PRODUCT_LABEL[p]} <span className="tabular-nums">{won(productPrice(sp, p))}</span>
                        </span>
                      ))}
                    </>
                  }
                />
              )}
              <InfoRow
                label="가까운 날"
                value={
                  nextSlot ? (
                    <>
                      {/* ⏱09-19 30분 단위 — 자투리(09:30~12:00)가 몇 시간인지 셈하지 않게 길이를 붙인다(`rangeLabel`). */}
                      {dateLabel(nextSlot.date)} {rangeLabel(nextSlot.start, nextSlot.end)}
                      {openSlots.length > 1 && (
                        <span className="block text-[15px] text-mute">그 밖에 {openSlots.length - 1}번 더</span>
                      )}
                    </>
                  ) : (
                    <span className="text-mute">아직 없어요</span>
                  )
                }
              />
              {sp.coffeeChat && sp.coffeeChatMinutes > 0 && (
                <InfoRow label="커피챗" value={`${sp.coffeeChatMinutes}분 ${coffeeChatFree(sp) ? COFFEE_CHAT_FREE : `+${won(sp.coffeeChatPrice)}`}`} />
              )}
              {operatorName && <InfoRow label="운영" value={operatorName} />}
            </InfoList>
            {/* 🔁09-18 대표 결정 A — 「소개서」 키-값 줄 → 폰과 같은 카드. 표 한 칸의 밑줄 글자는 누를 곳으로 안 읽혔다. */}
            {brandName && sp.brandSlug && (
              <HostBrandCard
                href={brandHref}
                name={brandName}
                oneLiner={brandOneLiner}
                logoUrl={brandLogo}
                className="mt-5"
              />
            )}
            {/* 🔑09-19 [G] 로그인 전에도 아래 결제 바가 뜬다. 바가 이 카드의 버튼 노릇을 해서 「신청하러 가기」 길은 뺐다.
                🧱09-21 대표 — lg에선 그 바가 이 카드 안으로 들어온다(`BookingForm`의 `PayBar`가 여기로 포털). 폼이 없는 공간이면 빈 자리. */}
            <div id="rent-side-pay" />
          </div>
        </aside>
      </div>
    </main>
  );
}
