import Link from "next/link";
import { repo } from "@/lib/repo";
import { getProfile } from "@/lib/profiles";
import { MakerArticle } from "../m/[slug]/MakerArticle";
import { DEMO_SLUG_PHOTO, DEMO_SLUG_NONE } from "@/lib/demo";

// 소개서 미리보기 — 데모 소개서 2종(사진 有/無)을 탭으로 보여주는 공개 페이지.
// 서버 컴포넌트 + Link 기반 탭(?tab=) — 클라이언트 상태 없음.
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = tab === "none" ? "none" : "photo";
  const maker = await repo.getMakerBySlug(active === "none" ? DEMO_SLUG_NONE : DEMO_SLUG_PHOTO);
  const logoUrl = maker?.ownerUserId ? (await getProfile(maker.ownerUserId))?.profileImage || undefined : undefined;
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">소개서 미리보기</h1>
      <p className="mt-2 text-base text-mute">사진이 있는 버전과 없는 버전, 둘 다 살펴보세요.</p>
      <div className="mt-5 flex gap-2">{/* 탭 = Link, active면 primary 톤 */}
        <Tab href="/preview?tab=photo" active={active === "photo"}>사진 있는 소개서</Tab>
        <Tab href="/preview?tab=none" active={active === "none"}>사진 없는 소개서</Tab>
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
function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`flex h-10 items-center rounded-pill border px-4 text-[15px] font-medium ${active ? "border-primary bg-primary-pale text-primary-on" : "border-hairline bg-surface text-body"}`}>{children}</Link>;
}
