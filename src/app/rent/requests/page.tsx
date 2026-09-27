import type { Metadata } from "next";
import Link from "next/link";
import { sweepBookings } from "@/lib/spaces";
import { getSessionUserId } from "@/lib/profiles";
import { defaultGuestTab, parseGuestTab, type GuestTabKey } from "@/lib/rent-groups";
import { GuestBookingRow, guestTabViews, loadGuestBookings } from "../GuestBookingRow";
import { primaryBtnCls } from "../ui";
import { KAKAO_CHAT_URL } from "@/lib/site";
import { StickyTabs } from "@/components/StickyTabs";
import { HashFocus } from "./HashFocus";

// 하루 팝업 — 손님이 보낸 신청만 모아 보는 화면 (2026-09-16 · 백로그 B81)
//
// 🩸전엔 손님이 자기 신청을 보려면 `/rent/my`로 갔다. 거기는 사장님 화면이라 내가 올린 공간과 받은 신청
//   두 덩이를 지나야 자기 것이 나왔다. 대표: *「신청 내역 정리 페이지 만들어서 그쪽으로 보내자」*.
// ⭐줄은 `/rent/my`와 **같은 한 벌**(`../GuestBookingRow`)을 쓴다. 이 화면이 새로 정하는 건 순서와 나눔뿐이다.
// 🗂나눔의 판정도 `/rent/my` 빌린 공간 칸과 한 벌이다(`lib/rent-groups`, 09-18 밤 QA SC-14). 그쪽 «예약 완료»가 여기도 「예약 완료」이고,
//   나머지(지난 예약·취소·환불)를 「지난 예약」으로 묶는다. (🔁09-27 대표 B5 — 「앞으로 갈 곳」·「지난 신청」에서 이름을 바꿨다.)
// 🔗09-27 대표 D2 — 메뉴 바·마이페이지의 「내 예약」이 여기로 온다. 완료 화면에서 오면 `#b-<예약번호>`로 그 줄을 짚는다(`HashFocus`).
//   🩸전엔 여기서 따로 적어서, 이용 시각이 이미 시작된 결제 전 신청이 이 화면엔 「앞으로 갈 곳」, `/rent/my`엔 「취소·환불」로 섰다.
// 🗂09-27 대표 코멘트 #162 — 「메뉴 탭을 만들어서 관리하자 한 화면에 모두 스크롤로 넣지말고!」. 절 둘(+ 접힌 칸)을 탭 넷으로 바꿨다.
//   탭 이름·나눔은 `lib/rent-groups`의 `GUEST_TABS` 한 벌이고 `/rent/my` 빌린 공간 칸과 같다. 탭은 주소(`?g=`)에 남는다.
//   🔻결제창만 열고 떠난 신청(접혀 있던 「결제 안 한 신청」)은 목록에서 뺐다(대표 09-27, `loadGuestBookings`).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 예약 — collab5",
  // 로그인해야 보이는 화면이라 검색에 걸릴 이유가 없다.
  robots: { index: false },
  // 🔎09-18 밤 QA SC-18 — 대표 주소를 안 두면 루트의 `canonical: "/"`가 상속돼 «이 화면은 홈의 사본»이라고 말하게 된다. 자기 주소로.
  alternates: { canonical: "/rent/requests" },
};

export default async function RentRequestsPage({ searchParams }: { searchParams?: Promise<{ g?: string | string[] }> } = {}) {
  const sp = searchParams ? await searchParams : {};
  const asked = parseGuestTab(typeof sp.g === "string" ? sp.g : null);
  const uid = await getSessionUserId();
  if (!uid) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
        <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">내 예약</h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          로그인하시면 보내신 신청과 사장님 답을 같이 보실 수 있어요.
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent("/rent/requests")}`}
          className={`${primaryBtnCls} mt-8 h-[48px]`}
        >
          로그인
        </Link>
      </main>
    );
  }

  // ⏹읽기 «전에» 끝난 확정 예약을 「다녀왔어요」로 넘긴다. `/rent/my`와 같은 자리, 같은 이유다.
  await sweepBookings();

  const all = await loadGuestBookings(uid);
  // 탭마다의 줄과 순서는 `guestTabViews` 한 벌(`/rent/my` 빌린 공간 칸과 같다). 주소에 탭이 없으면 줄이 있는 첫 탭을 연다.
  const tabs = guestTabViews(all);
  const cur: GuestTabKey = asked ?? defaultGuestTab(Object.fromEntries(tabs.map((t) => [t.key, t.list])) as Record<GuestTabKey, unknown[]>);
  const curTab = tabs.find((t) => t.key === cur)!;
  // 🔗해시(`#b-<번호>`)가 다른 탭의 줄을 짚으면 `HashFocus`가 그 탭으로 옮겨 간다. 어느 줄이 어느 탭인지를 넘긴다.
  const where = Object.fromEntries(all.map((v) => [v.booking.id, v.tab]));

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header>
        <Link href="/rent" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 하루 팝업
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">내 예약</h1>
        {/* 💬09-16 phase 1 — 채팅이 없으니 막히면 갈 곳이 여기다. 사장님과 연락이 안 닿는 일도 우리가 받는다. */}
        <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
          사장님과 연락이 닿지 않거나 예약에 문제가 생기면{" "}
          <a href={KAKAO_CHAT_URL} target="_blank" rel="noreferrer" className="text-body underline underline-offset-2">
            카카오톡으로 알려 주세요
          </a>
          .
        </p>
      </header>

      {/* 🔑탭이 바뀌면 다시 붙어서(`key`) 새 탭에서 해시를 한 번 더 본다. */}
      <HashFocus key={cur} active={cur} where={where} />
      {/* ✍️09-27 대표 B5·B6 — 빈 줄은 「예약」으로 부르고 둘러보러 가는 링크는 「공간 둘러보기」 한 이름으로. */}
      {all.length === 0 ? (
        // 한 건도 없을 땐 탭을 세우지 않는다. 빈 탭 넷이 서면 비어 있다는 말을 네 번 하게 된다.
        <p className="mt-8 text-[15px] leading-relaxed break-keep text-faint">
          아직 신청하신 예약이 없어요.{" "}
          <Link href="/rent" className="underline underline-offset-2">
            공간 둘러보기
          </Link>
        </p>
      ) : (
        <>
          {/* 🗂09-27 대표 #162 — 탭 모양은 `/rent/my` 위 칸(빌린 공간 · 빌려준 공간)과 같은 `StickyTabs`. 헤더 밑에 붙어 따라온다. */}
          <StickyTabs
            className="mt-8"
            label="내 예약 나누기"
            active={cur}
            items={tabs.map((t) => ({ key: t.key, label: t.label, href: `/rent/requests?g=${t.key}` }))}
          />
          {curTab.list.length === 0 ? (
            <p className="mt-6 text-[15px] leading-relaxed break-keep text-faint">
              {curTab.empty}
              {curTab.ahead && (
                <>
                  {" "}
                  <Link href="/rent" className="underline underline-offset-2">
                    공간 둘러보기
                  </Link>
                </>
              )}
            </p>
          ) : (
            <ul className="mt-5">
              {curTab.list.map((v) => (
                <GuestBookingRow key={v.booking.id} view={v} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
