import Link from "next/link";
import { repo } from "@/lib/repo";
import { getProfile } from "@/lib/profiles";
import { MakerArticle } from "../m/[slug]/MakerArticle";
import { DEMO_SLUG_PHOTO, DEMO_SLUG_NONE } from "@/lib/demo";

// 브랜드 소개서 둘러보기 — 데모 소개서 2종(사진 有/無)을 탭으로 보여주는 공개 페이지.
// 서버 컴포넌트 + Link 기반 탭(?tab=) — 클라이언트 상태 없음.
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = tab === "none" ? "none" : "photo";
  const maker = await repo.getMakerBySlug(active === "none" ? DEMO_SLUG_NONE : DEMO_SLUG_PHOTO);
  const logoUrl = maker?.ownerUserId ? (await getProfile(maker.ownerUserId))?.profileImage || undefined : undefined;
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">브랜드 소개서 둘러보기</h1>
      <p className="mt-2 text-base text-mute">브랜드 소개서는 이렇게 완성돼요. 사진 유무에 따른 차이도 함께 둘러보세요.</p>
      <div className="mt-5 flex gap-7 border-b border-hairline">{/* 언더라인 탭 — active 밑줄 + 전체 베이스라인 */}
        <Tab href="/preview?tab=photo" active={active === "photo"}>사진이 담긴 소개서</Tab>
        <Tab href="/preview?tab=none" active={active === "none"}>사진 없이 작성한 소개서 (기본)</Tab>
      </div>
      <div className="mt-6">
        {maker
          ? <MakerArticle maker={maker} isOwner={false} logoUrl={logoUrl} />
          : <p className="rounded-md border border-hairline bg-surface-soft p-6 text-base text-mute">미리보기를 준비하고 있어요. 잠시 후 다시 봐주세요.</p>}
      </div>
      <div className="mt-12 text-center">
        <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-7 text-base font-medium text-primary-on">내 소개서 만들기</Link>
      </div>
    </main>
  );
}
// 언더라인 탭 — 선택 시 하단 라이닝(primary) + 볼드, 컨테이너 하단 베이스라인과 -mb-px로 겹침.
function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`-mb-px flex h-11 items-center border-b-2 text-[15px] transition-colors ${
        active ? "border-primary font-bold text-ink" : "border-transparent font-medium text-mute hover:text-body"
      }`}
    >
      {children}
    </Link>
  );
}
