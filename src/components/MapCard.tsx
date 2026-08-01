// 소개서 상세 주소 아래 지도 미리보기 카드(07-31 지도 핀 UI).
//
// ⚠️ 좌표(trust.lat/lng)가 없으면 이 컴포넌트는 **아무것도 렌더하지 않는다**(호출부에서 조건 분기).
//    기존 소개서(사장님이 place 링크를 직접 붙여넣은 경우)는 좌표가 없을 수 있다 —
//    그 경우 이전처럼 "네이버 지도에서 보기" 텍스트 링크만 보인다(MakerArticle 폴백).
//
// 이미지 = /api/staticmap 프록시(NCP Secret을 클라에 노출하지 않으려고 거기서 막는다).
// 인터랙티브 지도(SDK)가 아니라 **정적 이미지**로 간다 — 소개서에서 필요한 건
// "여기 있구나" 한 컷이지, 우리 안에서 길찾기를 만드는 게 아니다(길찾기는 탭해서 네이버로).
import Image from "next/image";

// 🗺️ w/h는 **지도에 담기는 지역 범위**를 정한다(픽셀 해상도가 아니다 — 08-01에 헷갈려서 한 번 틀렸다).
//    Retina 대응이라며 928×406으로 키웠더니 같은 줌에서 더 넓은 지역이 담겨 **축소된 것처럼** 보였다.
//    선명도는 lib/ncp-map.ts의 `scale=2`가 담당한다(같은 범위, 픽셀 밀도만 2배 → 실제 1280×560 수신).
//    그러니 이 값은 "얼마나 넓게 보여줄까"로만 생각하고 건드릴 것. 640×280 = 대표가 좋다고 한 초기 프레이밍.
const W = 640;
const H = 280;

export function MapCard({
  lat,
  lng,
  address,
  mapUrl,
}: {
  lat: number;
  lng: number;
  address: string;
  mapUrl?: string;
}) {
  const src = `/api/staticmap?lat=${lat}&lng=${lng}&w=${W}&h=${H}`;
  const img = (
    <div className="overflow-hidden rounded-lg border border-hairline">
      <Image
        src={src}
        alt={`${address} 위치 지도`}
        width={W}
        height={H}
        unoptimized // 우리 프록시가 이미 최종 이미지 바이트를 주므로 Next 이미지 최적화 파이프라인 불필요
        className="h-auto w-full"
      />
    </div>
  );
  if (!mapUrl) return img;
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="block transition-opacity hover:opacity-90"
      aria-label={`${address} — 네이버 지도에서 보기`}
    >
      {img}
    </a>
  );
}
