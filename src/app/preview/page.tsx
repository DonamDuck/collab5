import Link from "next/link";
import { repo } from "@/lib/repo";
import { getProfile } from "@/lib/profiles";
import { DEMO_SLUG_PHOTO, DEMO_SLUG_NONE } from "@/lib/demo";
import { PreviewTabs } from "./PreviewTabs";

// 브랜드 소개서 둘러보기 — 데모 소개서 2종(사진 有/無)을 탭으로 보여주는 공개 페이지.
// 두 데모를 서버에서 한 번에 병렬 조회 → 클라이언트(PreviewTabs)에서 순간 전환(탭마다 재조회 없음).
// 데모는 고정 데이터(재복제 스크립트로만 변경)라 캐싱 안전 — revalidate로 반복 방문도 가속.
export const revalidate = 300;

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = tab === "none" ? "none" : "photo";

  const [photoMaker, noneMaker] = await Promise.all([
    repo.getMakerBySlug(DEMO_SLUG_PHOTO),
    repo.getMakerBySlug(DEMO_SLUG_NONE),
  ]);
  const [photoLogo, noneLogo] = await Promise.all([
    photoMaker?.ownerUserId ? getProfile(photoMaker.ownerUserId).then((p) => p?.profileImage || undefined) : undefined,
    noneMaker?.ownerUserId ? getProfile(noneMaker.ownerUserId).then((p) => p?.profileImage || undefined) : undefined,
  ]);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">브랜드 소개서 둘러보기</h1>
      <p className="mt-2 text-base text-mute">브랜드 소개서는 이렇게 완성돼요. 사진 유무에 따른 차이도 함께 둘러보세요.</p>
      <div className="mt-5">
        <PreviewTabs
          initialTab={initialTab}
          photoMaker={photoMaker}
          photoLogo={photoLogo}
          noneMaker={noneMaker}
          noneLogo={noneLogo}
        />
      </div>
      <div className="mt-12 text-center">
        <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-7 text-base font-medium text-primary-on">내 소개서 만들기</Link>
      </div>
    </main>
  );
}
