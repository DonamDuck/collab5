import Image from "next/image";

// 하루 가게 — 위치 지도 (2026-09-14 신설 · 2026-09-16 정확한 핀으로 전환)
//
// 대표: *「지도 UI 하나 있어야 할 거 같아. 사장님이 당연히 주소 입력해서 등록해야 하고」* (아워플레이스 참고)
//
// 🔁**09-16에 방향이 뒤집혔다.** 09-13엔 핀을 안 찍고 낮은 줌 + 원형으로 「이 동네 어딘가」까지만 말했다.
//   확정 전에 가게가 특정되면 우리 없이 직거래로 샐까 봐였다. 09-16에 대표가 정확한 핀을 요청하며
//   *「이미 공간 이름이 있어서 (감추는 게) 무의미할 것 같아」*로 정리했다. 맞는 말이다 — 이름과 사진이
//   이미 그 가게를 특정한다. 거기에 좌표만 뭉개 봐야 손님만 불편하다.
// ⚖️법도 같은 쪽으로 민다 — 전자상거래법 제20조②는 호스트의 주소·전화번호를 **청약 전에** 주도록 한다.
// 📌이탈을 막는 건 이제 주소가 아니라 **결제가 먼저라는 순서**다. 그 설계는 그대로다.
//
// 🖼이미지는 `/api/staticmap` 프록시를 탄다(NCP Secret이 클라로 새지 않게).
const W = 640;
const H = 240;
/** 줌 16 ≈ 건물이 짚히는 눈금. 길 찾아갈 사람에게 필요한 배율이다. */
const LEVEL = 16;

export function AreaMap({
  lat,
  lng,
  address,
  placeName,
}: {
  lat: number;
  lng: number;
  address: string;
  /** 🏪09-18 대표 — 네이버 지역검색의 가게와 «일치한다고 판정된» 공간만 넘어온다(`lib/place-match.ts`).
   *  있으면 핀 위에 상호 라벨, 링크는 상호+주소 검색. 없으면 09-17 모습 그대로(주소 핀 · 주소 검색). */
  placeName?: string;
}) {
  // 🔁09-17 QA — 누르면 구글 지도가 열렸다. 한국에선 구글 지도로 길찾기가 거의 안 되고, 위 이미지도 네이버 지도라
  //   누른 뒤 딴 지도가 뜨는 셈이었다. 네이버 지도 검색으로 보낸다(폰에선 앱이 있으면 앱이 받는다).
  // 🏪주소만으로 검색하면 네이버는 «그 건물»을 연다. 상호를 앞에 붙이면 «그 가게» 장소 화면이 열려 영업시간·리뷰까지 이어진다.
  const q = encodeURIComponent(placeName ? `${placeName} ${address}` : address);
  const href = `https://map.naver.com/p/search/${q}`;
  return (
    <div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="relative block overflow-hidden rounded-lg border border-hairline"
      >
        <Image
          src={`/api/staticmap?lat=${lat}&lng=${lng}&w=${W}&h=${H}&level=${LEVEL}`}
          alt={`${placeName ? `${placeName} · ` : ""}${address} 지도`}
          width={W}
          height={H}
          unoptimized
          className="h-auto w-full"
        />
        {placeName && (
          // 🏷핀 라벨 — 지도 이미지(공용 프록시 `/api/staticmap`, 소개서도 쓴다)는 안 건드리고 위에 글자를 얹는다.
          //   지도는 좌표를 가운데 두고 그리므로 핀 끝이 정가운데다. 핀 머리 위로 띄운다. 긴 상호는 한 줄로 자른다.
          //   📐띄우는 높이는 px가 아니라 «지도 높이의 %»다. 핀은 이미지에 구워져 있어 화면 폭에 따라 같이 줄어든다
          //     (09-18 실측: 1568 화면 핀 약 37px, 375 화면 약 22px → 둘 다 지도 높이의 16~19%).
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[70%] left-1/2 max-w-[70%] -translate-x-1/2 truncate rounded-pill bg-surface px-3 py-1 text-[14px] font-medium text-ink shadow-e1"
          >
            {placeName}
          </span>
        )}
      </a>
      {placeName && <p className="mt-2 text-[16px] font-medium leading-snug break-keep text-ink">{placeName}</p>}
      <p className={`${placeName ? "mt-0.5" : "mt-2"} text-[15px] leading-relaxed break-keep text-body`}>{address}</p>
      {placeName ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block py-[12px] text-[15px] text-mute underline underline-offset-2"
        >
          네이버 지도에서 보기
        </a>
      ) : (
        <p className="mt-0.5 text-[15px] text-faint">지도를 누르면 네이버 지도에서 길을 찾을 수 있어요.</p>
      )}
    </div>
  );
}
