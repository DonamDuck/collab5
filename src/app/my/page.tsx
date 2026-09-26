// 내 소개서 / 찜한 콜라보 / 콜라보 리포트 — 로그인 필수. 목록을 서버에서 병렬 조회해 탭으로 즉시 전환.
import { redirect } from "next/navigation";
import { getSessionUser, isDevSession } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { ConnectMaker } from "./ConnectMaker";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { ChangePasswordButton } from "./ChangePasswordButton";
import { LinkedAccounts } from "./LinkedAccounts";
import { MakerRow } from "./MakerRow";
import { SavedMakerRow } from "./SavedMakerRow";
import { ReportArchiveCard } from "./ReportArchiveCard";
import { BriefCard } from "./BriefCard";
import { MyTabs } from "./MyTabs";
import { StickyTabs } from "@/components/StickyTabs";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";
import { CollabRecorder } from "./CollabRecorder";
import { EmptyState } from "@/components/EmptyState";
import { isMyBrandEditedSince } from "@/lib/collab-report";
import type { CollabReportListItem } from "@/lib/types";
import { BRIEFS } from "@/lib/brief-samples/registry";
import { listBriefsByOwner } from "@/lib/briefs";
import { DEV_OWNED_SLUGS } from "@/lib/dev-session";
import { listBookingsForGuest, listBookingsForHost, listSpacesByOwner } from "@/lib/spaces";
import { groupGuestBookings, groupHostBookings } from "@/lib/rent-groups";

// 🚨 로그인 사용자별 화면이라 절대 프리렌더되면 안 된다.
// 쿠키 접근으로 자동 dynamic이 되긴 하지만, 그 판정이 "빌드 시점에 auth env가 있느냐"에 달려 있어
// env 없는 빌드에선 정적(○)으로 잡힌다(실측). 명시 선언으로 고정. (1팀 /search 사례와 동일 함정)
export const dynamic = "force-dynamic";

export default async function MyPage({ searchParams }: { searchParams: Promise<{ tab?: string; area?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=%2Fmy"); // 로그인 후 원래 가려던 /my로 복귀
  const { tab, area: areaParam } = await searchParams;
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
  // 🆕 [다시 분석하기]를 띄울 쌍 — **내 소개서가 리포트 뒤에 바뀐 것만**(08-31 대표). 유료 콜 0(전부 읽기).
  const editedPairs = await findEditedPairs(reports);
  const displayName = profile?.brandName || user.email?.split("@")[0] || "내 브랜드";

  // 🏠09-18 대표 코멘트 — 「하루 팝업 영역이 너무 하단이라 서브 메뉴처럼 느껴진다. 소개서&콜라보 | 하루 팝업을 같은 위계로」.
  //   ⭐목록은 `/rent/my` 한 곳에만 그린다(두 곳에 그리면 한쪽만 고쳐지는 날이 온다). 여기는 숫자와 입구만.
  const [rentSpaces, rentHostBookings, rentGuestBookings] = profile
    ? await Promise.all([listSpacesByOwner(profile.id), listBookingsForHost(profile.id), listBookingsForGuest(profile.id)])
    : [[], [], []];
  // 🔢숫자는 `/rent/my`와 같은 판정 한 벌(`lib/rent-groups`)로 센다(09-18 밤 QA SC-14).
  //   🩸전엔 여기서 따로 적어서 「다가오는 예약」에 답할 새 요청까지 들어갔고(목 host-full 3 vs 2),
  //   「빌린 예약」은 이어서 결제할 수 있는 신청을 빼서 `/rent/my`의 «예약 완료» 칸과 달랐다(guest-full 3 vs 4).
  const rentHost = groupHostBookings(rentHostBookings);
  const rentToAnswer = rentHost.toAnswer.length;
  const rentUpcoming = rentHost.upcoming.length;
  // 「빌린 예약」 = `/rent/my?tab=guest`가 처음 여는 «예약 완료» 칸의 수.
  const rentMyTrips = groupGuestBookings(rentGuestBookings, (b) => b).upcoming.length;
  // 큰 칸의 기본: 답할 새 요청이 있으면 하루 팝업, 아니면 소개서·콜라보. 주소(`?area=`)가 있으면 그게 이긴다.
  //   소개서 안쪽 탭(`?tab=`)으로 들어온 주소는 소개서 칸을 연다.
  const area: "brand" | "rent" =
    areaParam === "rent" || areaParam === "brand" ? areaParam : tab ? "brand" : rentToAnswer > 0 ? "rent" : "brand";

  // 📄 내 요약 보고서 = **`brand_briefs`에서 나에게 «연결된» 것**(대표가 손으로 연결한다).
  //    ⚠️표가 없으면 빈 목록이다 — 연결이라는 개념이 표에만 있어서, 코드 안 목록으로 흉내 내면 거짓이 된다.
  //    🔒로컬만 예외 — 가짜 세션엔 프로필이 없어 이 절을 영영 못 본다. 그래서 «입력»만 보탠다.
  //       운영에선 `isDevSession()`이 false라 아래 한 줄이 죽고, 진짜 연결만 남는다.
  const myBriefs = isDevSession()
    ? BRIEFS.filter((b) => DEV_OWNED_SLUGS.includes(b.slug))
    : profile
      ? await listBriefsByOwner(profile.id)
      : [];

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
            canRefresh={editedPairs.has(`${r.fromSlug}:${r.toSlug}`)}
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
        title="소개서를 등록해주세요."
        desc={
          <>
            콜라보를 기록하려면 먼저 <b className="font-medium text-body">내 소개서</b>가 필요해요.
            <br />
            소개서를 만든 뒤, 함께한 콜라보를 하나씩 기록해보세요.
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
              함께하기로 한 콜라보를 하나씩 남겨보세요.
              <br />
              추가한 콜라보는 내 소개서에 자동으로 추가돼요.
            </>
          }
        >
          <CollabRecorder myBrands={makers.map((m) => ({ id: m.id, name: m.name }))} />
        </EmptyState>
      </div>
    ) : (
      <div>
        {/* 목록이 있을 때의 안내 — 08-15 대표 지적으로 교체. 전엔 "몇 건이 성사됐는지 세는 유일한 기록이에요"였는데
            그건 **우리 북극성 지표**지 사장님 이득이 아니다(빈 상태·얼럿에서 같은 이유로 이미 걷어냈다).
            ⭐이미 기록이 있는 사람에게 필요한 건 '남겨두세요'라는 권유가 아니라, **눈에 안 보이는 동작 하나**다
              — 여기 쌓은 게 소개서로도 나간다는 것. 그래서 한 줄로 줄이고 `items-center`로 버튼과 높이를 맞춘다. */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] leading-relaxed text-mute">
            추가한 콜라보는 내 소개서에도 함께 올라가요.
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
                  {/* ⚠️입력 얼럿의 선택지와 **글자까지 똑같이** 둔다. 전엔 「제품 경유」였는데, 사용자가 고를 땐
                      「collab5 보고 연락」이라 **같은 것에 두 이름**이 붙어 있었다(내부 지표 용어가 화면으로 샌 것,
                      07-29 QA #22). 한쪽만 고치면 다시 갈라지므로 바꿀 땐 얼럿의 `origin` 선택지와 함께 바꿀 것. */}
                  {c.origin === "product" ? "collab5 보고 연락" : "직접 소개"}
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

      {/* 🗂09-18 큰 칸 두 개 — 「소개서·콜라보 | 하루 팝업」. `/rent/my`의 「빌려준 공간 | 빌린 공간」과 같은 알약 모양이라
          큰 칸 → 작은 칸의 두 단계로 읽힌다. 주소(`?area=`)로 나눠 새로고침·메일 링크에서도 같은 칸이 열린다. */}
      {/* 🔁09-18 대표 코멘트 — 「플로팅 처럼 보이긴 하는데… 중앙 플로팅이면 어떨까?」 → 떠 있는 알약은 「안 이쁘다」로 한 번 더 바뀌어 폭을 채운 밑줄 탭(`StickyTabs`). */}
      <StickyTabs
        className="mt-6"
        label="내 페이지 나누기"
        active={area}
        items={[
          { key: "brand", label: "소개서·콜라보", href: "/my?area=brand" },
          { key: "rent", label: "하루 팝업", href: "/my?area=rent", dot: rentToAnswer > 0 },
        ]}
      />

      {area === "brand" && (
        <>
      <section className="mt-6">
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

      {/* 📄 요약 보고서 — 소개서를 만들며 드린 브리프. 없으면 이 절 자체를 안 그린다.
          ⭐**이 카드가 브리프 페이지의 존재 이유다** — 지금은 DM 링크 한 번이 전부라
             고객이 다시 읽으려면 카톡을 뒤져야 한다(기획서 §이 기능의 존재 이유). */}
      {myBriefs.length > 0 && (
        <section className="mt-10 border-t border-hairline pt-8">
          <h2 className="text-[17px] font-bold text-ink">요약 보고서</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-mute">
            소개서를 만들며 읽은 글을 세어 정리한 리포트예요.
          </p>
          <div className="mt-4 space-y-2.5">
            {myBriefs.map((b) => (
              <BriefCard key={b.slug} brief={b} />
            ))}
          </div>
        </section>
      )}

        </>
      )}

      {area === "rent" && (
        <section className="mt-6">
          {/* 숫자 세 칸 — `/rent/my`의 숫자와 같은 판정 한 벌(`lib/rent-groups`)이다. 새 요청·다가오는 예약은 빌려준 공간 칸, 빌린 예약은 빌린 공간 칸의 «예약 완료». */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { href: "/rent/my?tab=host", n: rentToAnswer, label: "새 요청", hot: rentToAnswer > 0 },
              { href: "/rent/my?tab=host", n: rentUpcoming, label: "다가오는 예약", hot: false },
              // 🔗09-27 대표 D2 — 「내 예약」은 손님 전용 `/rent/requests`로(메뉴 바와 같은 곳). 숫자는 그 화면의 「예약 완료」 절과 같은 판정이다.
              { href: "/rent/requests", n: rentMyTrips, label: "내 예약", hot: false },
            ].map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="rounded-lg border border-hairline bg-surface px-3 py-3.5 transition-colors hover:bg-surface-soft sm:px-5 sm:py-4"
              >
                <span className={`block text-[24px] font-bold leading-none tabular-nums ${c.hot ? "text-lemon-on" : "text-ink"}`}>
                  {c.n}
                </span>
                <span className="mt-2 block text-[14px] leading-snug break-keep text-mute sm:text-[15px]">{c.label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {[
              {
                href: "/rent/my?tab=host",
                title: "빌려준 공간 보기",
                desc:
                  rentSpaces.length > 0
                    ? `올린 공간 ${rentSpaces.length}곳과 들어온 요청을 봐요`
                    : "아직 올린 공간이 없어요",
              },
              {
                href: "/rent/my?tab=guest",
                title: "빌린 공간 보기",
                // 🔢09-18 밤 QA(G-28) — 바로 위 칸이 「빌린 예약 3」인데 이 줄은 「신청한 예약 16건」이었다.
                //   한 화면에 같은 것을 세는 숫자 둘이 다르면 어느 쪽이 내 예약인지 알 수 없다.
                //   ⭐숫자는 «예약 완료» 한 판정(`rentMyTrips`)만 쓰고, 나머지는 세지 말고 무엇이 있는지만 말한다.
                desc:
                  rentMyTrips > 0
                    ? `내 예약 ${rentMyTrips}건을 봐요`
                    : rentGuestBookings.length > 0
                      ? "지난 예약과 취소한 예약을 봐요"
                      : "아직 빌린 공간이 없어요",
              },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="flex items-center gap-3 rounded-lg border border-hairline bg-surface px-4 py-4 transition-colors hover:bg-surface-soft sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-medium text-ink">{c.title}</p>
                  <p className="mt-0.5 text-[15px] break-keep text-mute">{c.desc}</p>
                </div>
                <span aria-hidden className="text-[17px] text-faint">→</span>
              </Link>
            ))}
          </div>

          {rentSpaces.length === 0 && (
            <p className="mt-5 text-[15px] leading-relaxed break-keep text-mute">
              쉬는 날이나 비는 시간에 가게를 빌려주고 싶으신가요?{" "}
              <Link href="/rent/new" className="text-body underline underline-offset-2">
                내 공간 올리기
              </Link>
            </p>
          )}
        </section>
      )}

      {/* 계정 설정 */}
      <section className="mt-10 border-t border-hairline pt-6">
        <LinkedAccounts />
        <div className="mt-8">
          <ChangePasswordButton email={user.email ?? ""} />
        </div>
      </section>
    </main>
  );
}

/** 저장본 목록에서 «내 소개서가 그새 바뀐» 쌍을 골라 `fromSlug:toSlug` 키 집합으로 돌려준다.
 *
 *  ⭐**유료 콜 0** — 전부 읽기다. DNA가 없거나 지문이 없는 구버전이면 그냥 안 들어간다
 *  (`isMyBrandEditedSince`가 "모르면 false"). 없는 걸 만들어내지 않는다.
 *
 *  🪤**`listMakersByOwner`의 결과를 여기 쓰면 안 된다**(08-09 /m 페이지에서 같은 함정을 밟았다).
 *     그건 카드용 경량 투영이라 `description`·`story`·`activities`가 비어 있는데, 판정은
 *     **소개서 본문 전체의 지문**을 비교한다 — 빈 필드로 지문을 내면 영원히 "바뀌었다"가 되고
 *     [다시 분석하기]가 모든 카드에 뜬다(그리고 누를 때마다 유료 콜이 나간다).
 *     → 리포트에 실제로 등장하는 **내 소개서 slug만** 골라 전문을 다시 읽는다(보통 1~3건).
 *  ⚠️ 저장본이 없는 쌍은 애초에 목록에 없으므로 "다시"의 대상이 아니다. */
async function findEditedPairs(reports: CollabReportListItem[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (reports.length === 0) return out;
  const fromSlugs = [...new Set(reports.map((r) => r.fromSlug))];
  const loaded = await Promise.all(
    fromSlugs.map(async (slug) => {
      const from = await repo.getMakerBySlug(slug);
      if (!from) return null;
      const dna = await repo.getBrandDna(from.id);
      return [slug, { from, dna }] as const;
    }),
  );
  const bySlug = new Map(loaded.filter((e): e is NonNullable<typeof e> => e !== null));
  for (const r of reports) {
    const hit = bySlug.get(r.fromSlug);
    if (!hit) continue; // 소유권이 떠난 브랜드 등 — 보관본이라 재생성 자체가 안 된다
    if (isMyBrandEditedSince({ createdAt: r.createdAt }, hit.dna, hit.from)) {
      out.add(`${r.fromSlug}:${r.toSlug}`);
    }
  }
  return out;
}
