// 지도 미리보기 카드 — 소개서(/m 상세주소) + **소개서 작성 폼·AI 위저드**(08-02 확대).
//
// ⚠️ 좌표가 없으면 이 컴포넌트는 **아무것도 렌더하지 않는다**(호출부에서 조건 분기).
//    사장님이 네이버 '공유'로 붙여넣은 place 링크는 좌표가 없을 수 있다 —
//    그 경우 이전처럼 "네이버 지도에서 보기" 텍스트 링크만 보인다(각 호출부 폴백).
//
// 이미지 = /api/staticmap 프록시(NCP Secret을 클라에 노출하지 않으려고 거기서 막는다).
// 인터랙티브 지도(SDK)가 아니라 **정적 이미지**로 간다 — 필요한 건 "여기 있구나" 한 컷이지,
// 우리 안에서 길찾기를 만드는 게 아니다(길찾기는 탭해서 네이버로).
//
// ⭐ 폼에서 쓰는 값은 특히 크다(08-02, 대표 지시): 위저드가 *"이 장소가 맞나요?"* 라고 묻는데
//    지금까진 확인하려면 **새 탭으로 나갔다 와야** 했다. 지도 한 컷이면 그 자리에서 판단된다.
import Image from "next/image";

// 🗺️ w/h는 **지도에 담기는 지역 범위**를 정한다(픽셀 해상도가 아니다 — 08-01에 헷갈려서 한 번 틀렸다).
//    Retina 대응이라며 928×406으로 키웠더니 같은 줌에서 더 넓은 지역이 담겨 **축소된 것처럼** 보였다.
//    선명도는 lib/ncp-map.ts의 `scale=2`가 담당한다(같은 범위, 픽셀 밀도만 2배 → 실제 1280×560 수신).
//    그러니 이 값은 "얼마나 넓게 보여줄까"로만 생각하고 건드릴 것. 640×280 = 대표가 좋다고 한 초기 프레이밍.
const W = 640;
const H = 280;
// 폼용 낮은 높이 — 확인용 한 컷이라 소개서만큼 넓게 담을 필요가 없고, 위저드는 시트 안이라
// 세로를 덜 먹는 게 더 중요하다. ⚠️ **가로(=범위)를 그대로 두는 게 핵심** — W를 줄이면
// 같은 줌에서 담기는 지역이 좁아져 축척이 달라진다(08-01에 배운 것).
const H_COMPACT = 180;

export function MapCard({
  lat,
  lng,
  address,
  mapUrl,
  compact,
}: {
  lat: number;
  lng: number;
  address: string;
  mapUrl?: string;
  /** 폼(작성 페이지·위저드)용 낮은 버전 — 높이만 낮추고 가로 범위는 유지 */
  compact?: boolean;
}) {
  const h = compact ? H_COMPACT : H;
  const src = `/api/staticmap?lat=${lat}&lng=${lng}&w=${W}&h=${h}`;
  const img = (
    <div className="overflow-hidden rounded-lg border border-hairline">
      <Image
        src={src}
        alt={`${address} 위치 지도`}
        width={W}
        height={h}
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
