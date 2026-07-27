// 내 소개서 / 찜한 콜라보 / 콜라보 리포트 — 로그인 필수. 목록을 서버에서 병렬 조회해 탭으로 즉시 전환.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { ConnectMaker } from "./ConnectMaker";
import { LogoutButton } from "./LogoutButton";
import { ChangePasswordButton } from "./ChangePasswordButton";
import { MakerRow } from "./MakerRow";
import { SavedMakerRow } from "./SavedMakerRow";
import { ReportArchiveCard } from "./ReportArchiveCard";
import { MyTabs } from "./MyTabs";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";

// 🚨 로그인 사용자별 화면이라 절대 프리렌더되면 안 된다.
// 쿠키 접근으로 자동 dynamic이 되긴 하지만, 그 판정이 "빌드 시점에 auth env가 있느냐"에 달려 있어
// env 없는 빌드에선 정적(○)으로 잡힌다(실측). 명시 선언으로 고정. (1팀 /search 사례와 동일 함정)
export const dynamic = "force-dynamic";

export default async function MyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=%2Fmy"); // 로그인 후 원래 가려던 /my로 복귀
  const { tab } = await searchParams;
  const initialTab = tab === "saved" ? "saved" : tab === "reports" ? "reports" : "mine";

  // 프로필·내 소개서·찜 목록은 서로 독립 조회 — 병렬로 가져와 왕복 단축
  // 소유·찜 조회는 정수 profiles.user_id 기준(07-25 전환) — 프로필을 먼저 풀고 목록을 병렬 조회.
  const profile = await getProfile(user.id);
  const [makers, saved, reports] = await Promise.all([
    profile ? repo.listMakersByOwner(profile.id) : Promise.resolve([]),
    profile ? repo.listSavedMakers(profile.id) : Promise.resolve([]),
    profile ? repo.listCollabReportsByUser(profile.id) : Promise.resolve([]),
  ]);
  const displayName = profile?.brandName || user.email?.split("@")[0] || "내 브랜드";

  // 내 소개서 탭 콘텐츠
  const mine =
    makers.length === 0 ? (
      <div className="rounded-md border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
        <p className="text-[15px] text-mute">아직 연결된 소개서가 없어요.</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-on"
          >
            소개서 만들기
          </Link>
          <ConnectMaker />
        </div>
      </div>
    ) : (
      <div className="space-y-2">
        {makers.map((m) => (
          <MakerRow
            key={m.slug}
            slug={m.slug}
            name={m.name}
            oneLiner={m.oneLiner}
            collabOpen={m.collabOpen}
            searchVisible={m.searchVisible}
          />
        ))}
        <div className="flex justify-center pt-2">
          <ConnectMaker label="+ 소개서 추가 연결" />
        </div>
      </div>
    );

  // 찜한 콜라보 탭 콘텐츠
  const savedList =
    saved.length === 0 ? (
      <div className="rounded-md border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
        <p className="text-[15px] text-mute">아직 찜한 곳이 없어요.</p>
        <p className="mt-1.5 text-sm text-faint">
          마음에 드는 소개서에서 하트를 누르면 여기에 모여요.
        </p>
        <Link
          href="/search"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-sm font-medium text-ink"
        >
          둘러보기
        </Link>
      </div>
    ) : (
      <div className="space-y-2">
        {saved.map((m) => (
          <SavedMakerRow key={m.slug} makerId={m.id} slug={m.slug} name={m.name} oneLiner={m.oneLiner} />
        ))}
      </div>
    );

  // 콜라보 리포트 탭 콘텐츠 — 카드 = /m 딥링크(리포트는 자기 집에서 렌더, 캐시면 즉시·0콜)
  const reportList =
    reports.length === 0 ? (
      <div className="flex flex-col items-center rounded-2xl bg-surface-soft px-6 py-14 text-center">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-faint" aria-hidden="true">
          <ellipse cx="28" cy="28" rx="23" ry="9" stroke="currentColor" strokeWidth="2" opacity="0.45" transform="rotate(28 28 28)" />
          <ellipse cx="28" cy="28" rx="23" ry="9" stroke="currentColor" strokeWidth="2" opacity="0.45" transform="rotate(-28 28 28)" />
          <circle cx="28" cy="28" r="6" fill="#98ff5c" />
          <circle cx="6.5" cy="32" r="2.4" fill="currentColor" opacity="0.55" />
          <circle cx="49.5" cy="24" r="2.4" fill="currentColor" opacity="0.55" />
          <circle cx="33" cy="6.5" r="2.2" fill="currentColor" opacity="0.55" />
        </svg>
        <p className="mt-5 text-[17px] font-bold break-keep text-ink">아직 콜라보 리포트가 없어요</p>
        <p className="mt-2 text-[14px] leading-relaxed break-keep text-mute">
          콜라보하고 싶은 브랜드를 찾아
          <br />
          콜라보 분석 리포트를 만들어보세요.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-on"
        >
          브랜드 소개서 둘러보기
        </Link>
      </div>
    ) : (
      <div className="space-y-2">
        {reports.map((r) => (
          <ReportArchiveCard key={`${r.fromSlug}:${r.toSlug}`} item={r} />
        ))}
      </div>
    );

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <ProfileAvatarEditor image={profile?.profileImage || undefined} name={displayName} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">{displayName}</h1>
          <p className="truncate text-sm text-mute">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="mt-9 border-t border-hairline pt-8">
        <MyTabs initialTab={initialTab} mine={mine} saved={savedList} savedCount={saved.length} reports={reportList} reportCount={reports.length} />
      </section>

      {/* 계정 설정 */}
      <section className="mt-10 border-t border-hairline pt-6">
        <ChangePasswordButton email={user.email ?? ""} />
      </section>
    </main>
  );
}
