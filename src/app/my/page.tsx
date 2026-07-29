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
import { CollabRecorder } from "./CollabRecorder";
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
  // 성사된 콜라보 — 내 소개서가 한쪽이라도 낀 건. makers를 알아야 해서 위 병렬 뒤에 따로 조회.
  const collabs = makers.length ? await repo.listCollabsForBrands(makers.map((m) => m.id)) : [];
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

      {/* ⭐성사된 콜라보 = 북극성. 탭이 아니라 별도 섹션인 이유:
          지금은 사실상 대표 운영 도구라 탭 하나를 차지할 만큼 자주 쓰지 않는다.
          채팅이 붙어 자동 기록되기 시작하면 그때 탭으로 승격 검토. 스펙 = [[성사-기록-계측]] */}
      {makers.length > 0 && (
        <section className="mt-10 border-t border-hairline pt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">
              성사된 콜라보
              {collabs.length > 0 && <span className="ml-1.5 text-mute">{collabs.length}</span>}
            </h2>
            <CollabRecorder myBrands={makers.map((m) => ({ id: m.id, name: m.name }))} />
          </div>
          {collabs.length === 0 ? (
            <p className="mt-3 text-[13px] leading-relaxed text-mute">
              아직 기록된 콜라보가 없어요.
              <br />
              실제로 하기로 한 콜라보가 생기면 남겨두세요 — 몇 건이 성사됐는지 세는 유일한 기록이에요.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {collabs.map((c) => (
                <li key={c.id} className="rounded-md border border-hairline px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-ink">
                      {c.brandAName} <span className="text-faint">×</span> {c.brandBName}
                    </span>
                    {/* origin 배지 — 지표 순도 규칙이 눈에 보이게. 컨시어지만 쌓이면 바로 티가 난다 */}
                    <span
                      className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] ${
                        c.origin === "product" ? "bg-primary-pale text-primary-on" : "bg-surface-soft text-mute"
                      }`}
                    >
                      {c.origin === "product" ? "제품 경유" : "직접 소개"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[14px] text-body">{c.title}</p>
                  <p className="mt-0.5 text-[12px] text-faint">
                    {c.happenedOn ? c.happenedOn : "날짜 미정 (하기로 함)"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 계정 설정 */}
      <section className="mt-10 border-t border-hairline pt-6">
        <ChangePasswordButton email={user.email ?? ""} />
      </section>
    </main>
  );
}
