// 🚧 임시 시안 페이지 (2026-07-29, 대표 요청 — 홈 폰 목업 개선 샘플)
//    확정되면 **이 폴더를 통째로 삭제**하고 PreviewPhones.tsx에만 반영한다.
//    어디에도 링크하지 않고 색인도 막는다(직접 주소로만 접근).
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const SHOT = "/preview/slides/photo-1.jpg";
const W = 200; // 시안 비교용 폰 폭

/** 스크린 — 폰 비율(9:19.5)로 잘라 위쪽만 보여준다(전체 길이는 비교에 방해) */
function Screen({ radius }: { radius: number }) {
  return (
    <div
      className="relative overflow-hidden bg-white"
      style={{ borderRadius: radius, aspectRatio: "9 / 19.5" }}
    >
      <Image src={SHOT} alt="" width={750} height={1624} className="absolute inset-x-0 top-0 w-full" priority />
    </div>
  );
}

/** A — 화이트 프레임 (얇은 베젤) */
function VariantA() {
  return (
    <div
      className="rounded-[36px] bg-white p-[7px]"
      style={{ width: W,
        boxShadow:
          "0 1px 2px rgba(24,24,22,.05), 0 10px 24px -8px rgba(24,24,22,.14), 0 32px 64px -20px rgba(24,24,22,.16)",
      }}
    >
      <div className="overflow-hidden rounded-[28px] ring-1 ring-black/[.07]">
        <Screen radius={28} />
      </div>
    </div>
  );
}

/** B — 화이트 프레임 + 사이드 버튼 (두꺼운 베젤) */
function VariantB() {
  return (
    <div className="relative" style={{ width: W }}>
      {/* 사이드 버튼 — 볼륨(좌) / 전원(우) */}
      <span className="absolute -left-[2px] top-[110px] h-[26px] w-[3px] rounded-l-sm bg-[#dcdad3]" />
      <span className="absolute -left-[2px] top-[148px] h-[26px] w-[3px] rounded-l-sm bg-[#dcdad3]" />
      <span className="absolute -right-[2px] top-[132px] h-[44px] w-[3px] rounded-r-sm bg-[#dcdad3]" />
      <div
        className="rounded-[38px] bg-white p-[10px] ring-1 ring-black/[.06]"
        style={{
          boxShadow:
            "0 2px 4px rgba(24,24,22,.06), 0 14px 30px -10px rgba(24,24,22,.16), 0 44px 80px -24px rgba(24,24,22,.20)",
        }}
      >
        <div className="overflow-hidden rounded-[26px] ring-1 ring-black/[.08]">
          <Screen radius={26} />
        </div>
      </div>
    </div>
  );
}

/** C — 다크 프레임 개선판 (지금 것 + 입체감) */
function VariantC() {
  return (
    <div
      className="rounded-[36px] p-[8px]"
      style={{ width: W,
        background: "linear-gradient(160deg, #4a4a45 0%, #222220 38%, #1a1a19 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.22), 0 2px 4px rgba(24,24,22,.10), 0 16px 34px -10px rgba(24,24,22,.30), 0 44px 80px -24px rgba(24,24,22,.28)",
      }}
    >
      <div className="overflow-hidden rounded-[27px] bg-white">
        <Screen radius={27} />
      </div>
    </div>
  );
}

/** D — 프레임 없이 화면만 (가장 가벼움) */
function VariantD() {
  return (
    <div
      className="overflow-hidden rounded-[26px] bg-white ring-1 ring-black/[.08]"
      style={{ width: W,
        boxShadow:
          "0 1px 2px rgba(24,24,22,.05), 0 12px 28px -10px rgba(24,24,22,.16), 0 36px 70px -22px rgba(24,24,22,.18)",
      }}
    >
      <Screen radius={26} />
    </div>
  );
}

/** 현재 — 비교용 */
function Current() {
  return (
    <div className="rounded-[2.4rem] bg-ink p-1 shadow-e3" style={{ width: W }}>
      <div className="overflow-hidden rounded-[2.2rem] bg-surface">
        <Screen radius={35} />
      </div>
    </div>
  );
}

const ITEMS = [
  { label: "지금", node: <Current /> },
  { label: "A · 화이트 얇은 베젤", node: <VariantA /> },
  { label: "B · 화이트 + 사이드 버튼", node: <VariantB /> },
  { label: "C · 다크 개선판", node: <VariantC /> },
  { label: "D · 프레임 없이 화면만", node: <VariantD /> },
];

export default function PhoneSamplePage() {
  return (
    <main className="px-8 py-10">
      {/* 흰 배경 */}
      <section className="rounded-lg bg-white px-6 py-8">
        <p className="mb-6 text-sm font-semibold text-mute">흰 배경 (#ffffff)</p>
        <div className="flex flex-wrap items-start gap-10">
          {ITEMS.map((it) => (
            <div key={it.label}>
              {it.node}
              <p className="mt-4 text-center text-[13px] font-medium text-mute">{it.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 실제 홈 배경 */}
      <section className="mt-8 rounded-lg bg-canvas px-6 py-8">
        <p className="mb-6 text-sm font-semibold text-mute">홈 배경 (--canvas #fbfaf6)</p>
        <div className="flex flex-wrap items-start gap-10">
          {ITEMS.map((it) => (
            <div key={"c" + it.label}>
              {it.node}
              <p className="mt-4 text-center text-[13px] font-medium text-mute">{it.label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
