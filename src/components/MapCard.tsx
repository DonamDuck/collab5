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

// 🖥️ 928×406(16:7 비율 유지) — 640×280이던 걸 08-01에 올렸다.
//    표시 폭은 카드 wrapper가 max-w-[460px]로 잡는데, Retina(2배 밀도) 화면에서 선명하려면
//    **물리 픽셀로 460×2=920**이 필요하다. 640 그대로면 브라우저가 부족분을 늘려 그려서
//    흐릿하게 보인다(대표 실측 08-01, 맥 Retina 디스플레이). NCP Static Map 상한이 1024px라
//    928(=16×58)까지 올려도 여유가 있다 — 16:7 비율은 640×280과 동일해 화면 레이아웃은 안 바뀐다.
const W = 928;
const H = 406;

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
