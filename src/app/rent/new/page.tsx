import { RentMenuBar } from "../RentMenuBar";
import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUserId } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { FEE_RATE } from "@/lib/spaces";
import { SpaceForm } from "./SpaceForm";
import { primaryBtnCls } from "../ui";

// 하루 가게 — 공간 올리기 (2026-09-13)
//
// ⭐**이 화면이 이 기능의 병목이다.** 조사에서 등록 23곳 중 쉬는 날을 적어 둔 곳이 0곳이었고,
//   돌아오는 사람도 게스트가 아니라 매달 비는 날을 올리러 오는 호스트다(설계 §조사 ②④).
//   그래서 칸을 늘리기보다 **막는 자리**(음식·전대 동의·규칙·비는 날)를 분명히 하는 데 힘을 썼다.
//
// 🎨09-13 재작업 — 한 열 560px, 제목 28 · 한 줄 17, 섹션은 register 규칙(21px 제목 → 첫 입력 23px, 섹션 사이 12).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공간 올리기 — 하루 가게",
  description: "안 쓰는 날의 공간을 하루 단위로 빌려주세요. 규칙은 사장님이 정하세요.",
  alternates: { canonical: "/rent/new" },
};

export default async function NewSpacePage() {
  const uid = await getSessionUserId();

  if (!uid) {
    return (
      <>
      <RentMenuBar />
      <main className="mx-auto w-full max-w-[560px] px-4 pb-14 pt-6 sm:px-6">
        <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] break-keep text-ink">
          안 쓰는 날, 빌려주세요
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          쉬는 날 하루만 내주셔도 돼요. 먼저 로그인해 주세요.
        </p>
        {/* ⚠️복귀 키는 `redirect`다 — 로그인 화면이 읽는 이름이 그것이라 `next`로 적으면 홈으로 떨어진다. */}
        <Link href={`/login?redirect=${encodeURIComponent("/rent/new")}`} className={`${primaryBtnCls} mt-8 h-[48px]`}>
          로그인하고 올리기
        </Link>
      </main>
      </>
    );
  }

  // 소개서가 있으면 붙일 수 있게(선택). 없어도 올릴 수 있다 —
  // 이 기능은 소개서와 독립이고, 소개서를 요구하면 공급이 등록 업체 열두 곳으로 줄어든다(설계 §대상).
  const myBrands = (await repo.listMakersByOwner(uid)).map((m) => ({ slug: m.slug, name: m.name }));

  return (
    <>
    <RentMenuBar />
    <main className="mx-auto w-full max-w-[560px] px-4 pt-4 pb-16 sm:px-6 sm:pt-6">
      <header>
        <Link href="/rent" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 하루 가게
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] break-keep text-ink">
          안 쓰는 날, 빌려주세요
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          쉬는 날 하루만 내주셔도 돼요. 어떻게 써야 하는지는 사장님이 정하세요.
        </p>
      </header>

      {/* 수수료율을 서버에서 내려보낸다 — 클라가 숫자를 따로 들고 있으면 요율이 바뀌는 날
          화면만 옛 값을 말한다(그리고 그 어긋남은 아무 에러도 안 낸다). */}
      <SpaceForm myBrands={myBrands} feeRate={FEE_RATE} />
    </main>
    </>
  );
}
