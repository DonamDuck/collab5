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
  const initialTab = tab === "saved" ? "saved" : tab === "reports" ? "reports" : tab === "collabs" ? "collabs" : "mine";

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
            searchVisible={m.searchVisible}
            collabPaused={m.collabPaused}
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
            콜라보 추천 리포트를 만들어보세요.
          </>
        }
        ctaLabel="브랜드 소개서 둘러보기"
        ctaHref="/search"
      />
    ) : (
      <div className="space-y-2">
        {reports.map((r) => (
          <ReportArchiveCard
            key={`${r.fromSlug}:${r.toSlug}`}
            item={r}
            // 시트가 제자리(/my)에서 뜨므로 "다른 소개서로 분석"에 쓸 내 소개서 목록이 필요하다.
            // Maker 통째로 넘기면 클라이언트 번들에 사진·본문까지 실린다 — 시트가 쓰는 3개만.
            myBrands={makers.map((m) => ({ id: m.id, slug: m.slug, name: m.name }))}
          />
        ))}
      </div>
    );

  // ⭐성사된 콜라보 탭 = 북극성. 스펙 = [[성사-기록-계측]]
  //
  // 빈 상태가 두 갈래다(디자인팀 QA #15):
  //   ① 소개서가 아예 없다 → 기록 자체가 불가능(A는 반드시 내 소개서). 전엔 지시문만 남고 버튼이
  //      조용히 사라져 **아무것도 할 수 없는 화면**이 됐다 → 왜 안 되는지 + 나가는 길을 준다.
  //   ② 소개서는 있는데 기록만 없다 → 다른 3탭과 같은 격의 EmptyState로.
  const collabList =
    makers.length === 0 ? (
      <EmptyState
        title="소개서를 먼저 만들어주세요"
        desc={
          <>
            콜라보는 <b className="font-medium text-body">내 소개서</b>와 상대 브랜드를 짝지어 기록해요.
            <br />
            소개서가 있어야 기록을 남길 수 있어요.
          </>
        }
        ctaLabel="소개서 만들기"
        ctaHref="/register"
      >
        <ConnectMaker />
      </EmptyState>
    ) : collabs.length === 0 ? (
      <div>
        <EmptyState
          title="아직 기록된 콜라보가 없어요"
          desc={
            <>
              실제로 하기로 한 콜라보를 남겨두세요.
              <br />몇 건이 성사됐는지 세는 유일한 기록이에요.
            </>
          }
        >
          <CollabRecorder myBrands={makers.map((m) => ({ id: m.id, name: m.name }))} />
        </EmptyState>
      </div>
    ) : (
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] leading-relaxed text-mute">
            실제로 하기로 한 콜라보를 남겨두세요.
            <br />
            몇 건이 성사됐는지 세는 유일한 기록이에요.
          </p>
          <CollabRecorder myBrands={makers.map((m) => ({ id: m.id, name: m.name }))} />
        </div>
        <ul className="mt-4 space-y-2">
          {collabs.map((c) => (
            // bg-surface — 이 카드만 면색이 없어 다크에서 캔버스가 비쳤다. px도 혼자 3.5였다(QA #31)
            <li key={c.id} className="rounded-md border border-hairline bg-surface px-4 py-3">
              <div className="flex items-center gap-2">
                {/* 이 행의 주인공 = 콜라보 쌍. 다른 탭의 행 제목(17)과 같은 단으로 맞춘다 */}
                <span className="truncate text-[17px] font-bold text-ink">
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
              {c.title && <p className="mt-1 truncate text-[14px] text-body">{c.title}</p>}
              {c.description && <p className="mt-0.5 line-clamp-2 text-[13px] text-mute">{c.description}</p>}
              <p className="mt-0.5 text-[12px] text-faint">
                {c.year ? `${c.year}년` : "연도 미정 (하기로 함)"}
                {c.photos.length > 0 && ` · 사진 ${c.photos.length}장`}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <ProfileAvatarEditor image={profile?.profileImage || undefined} name={displayName} />
        <div className="min-w-0">
          {/* 22 = /m 브랜드명과 같은 단(사내 기준 사다리). text-[24px](25.5px)은 루트 17px 때문에
              생긴 분수 픽셀이었고, 아래 이메일(14.875)과의 간격만 크고 본문 단들은 평평했다. */}
          <h1 className="truncate text-[26px] font-bold leading-[1.25] tracking-[-0.025em] text-ink">{displayName}</h1>
          <p className="truncate text-[13px] text-mute">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="mt-9 border-t border-hairline pt-8">
        <MyTabs
          initialTab={initialTab}
          mine={mine}
          mineCount={makers.length}
          saved={savedList}
          savedCount={saved.length}
          reports={reportList}
          reportCount={reports.length}
          collabs={collabList}
          collabCount={collabs.length}
        />
      </section>

      {/* 계정 설정 */}
      <section className="mt-10 border-t border-hairline pt-6">
        <ChangePasswordButton email={user.email ?? ""} />
      </section>
    </main>
  );
}
