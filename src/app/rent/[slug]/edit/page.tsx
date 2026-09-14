import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { FEE_RATE, getSpaceFull } from "@/lib/spaces";
import { SpaceForm } from "../../new/SpaceForm";

// 하루 가게 — 공간 고치기 (2026-09-14)
//
// 🚨`getSpaceFull`을 부른다 — 주소·「들어오는 법」이 폼에 실려야 하니까. 그래서 **주인 확인이 먼저**다.
//   주인이 아니면 그 공간의 공개 화면으로 돌려보낸다. 404가 아닌 이유 — 공간은 실재하고 그 사람도
//   볼 수 있는 화면이 있다. 없는 척하면 오히려 「주소를 잘못 쳤나」로 헤맨다.
//   저장은 새로 올리기와 같은 `saveSpaceAction`이고, 서버가 소유자를 «다시» 읽어 확인한다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공간 고치기 — 하루 가게",
  robots: { index: false },
};

export default async function EditSpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const uid = await getSessionUserId();
  // ⚠️복귀 키는 `redirect`다 — 로그인 화면이 읽는 이름이 그것이라 `next`로 적으면 홈으로 떨어진다.
  if (!uid) redirect(`/login?redirect=${encodeURIComponent(`/rent/${slug}/edit`)}`);

  const sp = await getSpaceFull(slug);
  if (!sp || sp.ownerUserId !== uid) redirect(`/rent/${slug}`);

  const myBrands = (await repo.listMakersByOwner(uid)).map((m) => ({ slug: m.slug, name: m.name }));

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header>
        <Link href="/rent/my" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 내 하루 가게
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] break-keep text-ink">
          공간 고치기
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          고친 내용은 한 번 더 읽어보고 다시 공개해 드려요. 그동안 공간은 잠시 안 보여요.
        </p>
      </header>

      <SpaceForm myBrands={myBrands} feeRate={FEE_RATE} initial={sp} />
    </main>
  );
}
