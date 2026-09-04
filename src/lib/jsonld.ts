// 🤖 기계용 요약(JSON-LD) — 검색엔진과 AI가 읽는 층. 사람 눈엔 안 보인다.
//
// ⭐**왜 필요한가**(백로그 B73 → [[저절로-도는-기계]] 41·89): 소개서 본문은 서버 HTML에 다 들어
//   있는데 **기계가 「이게 무엇인지」 알아볼 요약이 0개**였다(09-01 실측). 그래서 검색·AI가
//   우리 페이지를 «글 덩어리»로만 본다. 이 파일이 그 요약을 만든다.
//
// 📐**타입 선택** — `LocalBusiness`가 아니라 **`Organization`**을 기본으로 쓴다.
//   ⚠️LocalBusiness는 «찾아갈 수 있는 점포»라는 뜻이라 주소·영업시간이 사실상 필수다. 그런데
//     우리 브랜드 상당수가 **공간이 없다**(무아솔=이동식 바리스타, 방혜리=프리랜서).
//     주소 없는 LocalBusiness를 내보내면 기계가 「불완전한 점포」로 읽는다 — 안 내보내느니만 못하다.
//   ⭕**주소가 있는 곳만** `LocalBusiness`로 올린다(`hasSpace`가 아니라 «주소 유무»로 가른다 —
//     주소는 사실이고 hasSpace는 사장님 판단이라 비어 있을 수 있다).
//
// 🚨**XSS** — Next 문서가 명시한 방어를 그대로 쓴다: `JSON.stringify` 결과에서 `<`를 `<`로.
//   소개서 문안은 «사장님이 쓴 값»이라 `</script>`가 들어갈 수 있고, 그러면 스크립트가 거기서 끊긴다.
//   정본 = `node_modules/next/dist/docs/01-app/02-guides/json-ld.md`
import type { Maker } from "./types";
import { SITE_URL } from "./site";
import { normalizeUrl } from "./links";

/** 소개서 한 곳 → 기계용 요약 객체. 값이 없는 칸은 **아예 넣지 않는다**(빈 문자열보다 없는 게 낫다). */
export function makerJsonLd(maker: Maker): Record<string, unknown> {
  const url = `${SITE_URL}/m/${maker.slug}`;
  const address = maker.trust?.address?.trim();

  // 🔗`sameAs` = 「같은 주체의 다른 주소」. 기계가 인스타 계정과 이 페이지를 **한 사람으로** 묶는다.
  //   ⚠️인스타 핸들이 `@a, @b`처럼 여러 개인 소개서가 실재한다(무아솔) → 쉼표로 갈라 전부 넣는다.
  const sameAs = [
    ...(maker.trust?.instagram ?? "")
      .split(",")
      .map((h) => h.trim().replace(/^@/, ""))
      .filter(Boolean)
      .map((h) => `https://instagram.com/${h}`),
    ...(maker.trust?.homepage ? [normalizeUrl(maker.trust.homepage)] : []),
  ];

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    // 주소가 있으면 점포, 없으면 그냥 「단체」. 위 📐 주석 참조.
    "@type": address ? "LocalBusiness" : "Organization",
    "@id": url,
    name: maker.name,
    url,
  };

  if (maker.oneLiner) base.description = maker.oneLiner;
  // 사진은 **절대 주소**여야 기계가 가져간다. data URL·상대경로는 넣지 않는다.
  const photo = maker.photos?.find((p) => p.startsWith("http"));
  if (photo) base.image = photo;
  if (sameAs.length) base.sameAs = sameAs;
  if (address) base.address = { "@type": "PostalAddress", streetAddress: address, addressCountry: "KR" };
  // `areaServed` = 활동 지역. 주소가 없어도 「어디서 활동하나」는 말할 수 있다.
  if (maker.region) base.areaServed = maker.region;

  return base;
}

/** `<script type="application/ld+json">`에 넣을 문자열. **XSS 방어가 여기 한 곳에 있다.** */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
