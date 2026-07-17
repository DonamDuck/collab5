"use client";

// 홈 미리보기 — 실제 데모 소개서 2종(사진 있는/없는)을 폰 프레임으로 노출.
// 목적: 랜딩 순간 "결과물이 뭔지" 보여주기 + "사진 없어도 이 정도" 안심(사진 부재 이탈 대응).
// 이미지 = prod 실화면 스크린샷(과장·미화 없음). 갱신은 데모 소개서 재캡처로.
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const DEMOS = [
  {
    key: "photos",
    label: "사진과 함께",
    slug: "m-ofjghi",
    src: "/demo/preview-photos.png",
    alt: "사진이 있는 브랜드 소개서 예시 화면",
  },
  {
    key: "nophotos",
    label: "사진 없이도",
    slug: "m-ay6uve",
    src: "/demo/preview-nophotos.png",
    alt: "사진 없이 만든 브랜드 소개서 예시 화면",
  },
] as const;

export function PreviewPhones() {
  const [active, setActive] = useState<(typeof DEMOS)[number]["key"]>("photos");

  return (
    <div>
      {/* 모바일 — 토글로 1개 크게 */}
      <div className="sm:hidden">
        <div className="mb-5 flex justify-center gap-2">
          {DEMOS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setActive(d.key)}
              className={`inline-flex h-9 items-center rounded-pill border px-4 text-sm font-medium transition-colors ${
                active === d.key
                  ? "border-primary bg-primary-tint text-primary-on"
                  : "border-hairline bg-surface text-mute"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {DEMOS.map((d) => (
          <div key={d.key} className={active === d.key ? "flex justify-center" : "hidden"}>
            <Phone demo={d} className="w-[76%] max-w-[300px]" priorityLoad={d.key === "photos"} />
          </div>
        ))}
      </div>

      {/* 데스크탑 — 2개 나란히(대비가 메시지) */}
      <div className="hidden items-start justify-center gap-10 sm:flex">
        {DEMOS.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-3">
            <Phone demo={d} className="w-[250px]" priorityLoad={d.key === "photos"} />
            <span className="inline-flex h-8 items-center rounded-pill bg-primary-pale px-3.5 text-sm font-medium text-primary-on">
              {d.label}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-sm text-mute">폰을 누르면 실제 소개서를 구경할 수 있어요.</p>
    </div>
  );
}

// 폰 프레임 — 디자인 토큰으로 그린 미니멀 베젤(실화면 픽셀 보존). 클릭 시 실제 데모 소개서로.
function Phone({
  demo,
  className,
  priorityLoad,
}: {
  demo: (typeof DEMOS)[number];
  className?: string;
  priorityLoad?: boolean;
}) {
  return (
    <Link
      href={`/m/${demo.slug}`}
      aria-label={`${demo.label} 예시 소개서 보기`}
      className={`block shrink-0 rounded-[2.2rem] bg-ink p-[9px] shadow-e2 transition-transform hover:-translate-y-1 ${className ?? ""}`}
    >
      <div className="overflow-hidden rounded-[1.7rem] bg-surface">
        <Image
          src={demo.src}
          alt={demo.alt}
          width={1000}
          height={2166}
          priority={priorityLoad}
          sizes="(max-width: 640px) 76vw, 250px"
          className="h-auto w-full"
        />
      </div>
    </Link>
  );
}
