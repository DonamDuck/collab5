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

export function AreaMap({ lat, lng, address }: { lat: number; lng: number; address: string }) {
  // 🔁09-17 QA — 누르면 구글 지도가 열렸다. 한국에선 구글 지도로 길찾기가 거의 안 되고, 위 이미지도 네이버 지도라
  //   누른 뒤 딴 지도가 뜨는 셈이었다. 네이버 지도 검색으로 보낸다(폰에선 앱이 있으면 앱이 받는다).
  const q = encodeURIComponent(address);
  return (
    <div>
      <a
        href={`https://map.naver.com/p/search/${q}`}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-lg border border-hairline"
      >
        <Image
          src={`/api/staticmap?lat=${lat}&lng=${lng}&w=${W}&h=${H}&level=${LEVEL}`}
          alt={`${address} 지도`}
          width={W}
          height={H}
          unoptimized
          className="h-auto w-full"
        />
      </a>
      <p className="mt-2 text-[15px] leading-relaxed break-keep text-body">{address}</p>
      <p className="mt-0.5 text-[15px] text-faint">지도를 누르면 네이버 지도에서 길을 찾을 수 있어요.</p>
    </div>
  );
}
