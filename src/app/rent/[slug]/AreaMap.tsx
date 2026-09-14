import Image from "next/image";

// 하루 가게 — 「이 근처예요」 지도 (2026-09-14)
//
// 대표: *「지도 UI 하나 있어야 할 거 같아. 사장님이 당연히 주소 입력해서 등록해야 하고」* (아워플레이스 참고)
//
// 🚨**핀을 안 찍는다.** 예약이 확정되기 전엔 정확한 주소를 주지 않는 게 이 서비스의 규칙이다
//   (09-13 대표 — 미리 연결되면 우리 없이 직거래로 샌다). 핀은 건물을 짚어 버리므로,
//   대신 **낮은 줌 + 원형 표시**로 「이 동네 어딘가」까지만 말한다. 아워플레이스도 같은 모양이다.
//
// ⭐**막는 층이 둘이다.** 화면(낮은 줌 + 원)만으로는 부족하다 — 주소창의 좌표를 그대로 읽으면
//   건물이 나온다. 그래서 **서버가 내보내는 좌표 자체를 뭉갠다**(`toPublic`, 소수 셋째 자리 ≈ 110m).
//   🔑정밀도를 낮추는 것과 위치를 «옮기는» 것은 다르다. 옮기면 확정 뒤에 「아까 지도랑 다른데요」가
//     되지만, 뭉개는 건 처음부터 「이 정도까지만 말한다」는 뜻이라 나중에 어긋나지 않는다.
//
// 🖼이미지는 `/api/staticmap` 프록시를 탄다(NCP Secret이 클라로 새지 않게).
const W = 640;
const H = 240;
/** 줌 14 ≈ 동네 한 덩어리. 16(건물 식별)에서 두 단 내렸다. */
const LEVEL = 14;

export function AreaMap({ lat, lng, area }: { lat: number; lng: number; area: string }) {
  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-hairline">
        <Image
          src={`/api/staticmap?lat=${lat}&lng=${lng}&w=${W}&h=${H}&pin=0&level=${LEVEL}`}
          alt={`${area} 근처 지도`}
          width={W}
          height={H}
          unoptimized
          className="h-auto w-full"
        />
        {/* 범위 원 — 지도 한가운데. `pointer-events-none`이라 지도를 가리기만 하고 클릭은 안 먹는다.
            키위 계열로 칠하면 「선택됨」으로 읽히므로 중립 잉크를 옅게 쓴다. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-[112px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink/25 bg-ink/10"
        />
      </div>
      <p className="mt-2 text-[15px] text-mute">
        {area} 근처예요. <span className="text-faint">정확한 주소는 사장님이 수락하시면 열려요.</span>
      </p>
    </div>
  );
}
