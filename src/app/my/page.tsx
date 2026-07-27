// 내 소개서 / 찜한 콜라보 / 콜라보 리포트 — 로그인 필수. 목록을 서버에서 병렬 조회해 탭으로 즉시 전환.
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
import { EmptyState } from "@/components/EmptyState";

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
      <EmptyState
        title="아직 내 소개서가 없어요"
        desc={
          <>
            브랜드 소개서를 만들거나,
            <br />
            이미 만든 소개서를 계정에 연결해보세요.
          </>
        }
        ctaLabel="소개서 만들기"
        ctaHref="/register"
      >
        <ConnectMaker />
      </EmptyState>
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
      <EmptyState
        title="아직 찜한 브랜드가 없어요"
        desc="마음에 드는 브랜드 소개서를 찜해보세요."
        ctaLabel="브랜드 소개서 둘러보기"
        ctaHref="/search"
      />
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
      <EmptyState
        title="아직 콜라보 리포트가 없어요"
        desc={
          <>
            콜라보하고 싶은 브랜드를 찾아
            <br />
            콜라보 분석 리포트를 만들어보세요.
          </>
        }
        ctaLabel="브랜드 소개서 둘러보기"
        ctaHref="/search"
      />
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
