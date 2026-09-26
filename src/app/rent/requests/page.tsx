import type { Metadata } from "next";
import Link from "next/link";
import { sweepBookings } from "@/lib/spaces";
import { getSessionUserId } from "@/lib/profiles";
import { groupGuestBookings } from "@/lib/rent-groups";
import { GuestBookingRow, loadGuestBookings, type GuestBookingView } from "../GuestBookingRow";
import { primaryBtnCls } from "../ui";
import { KAKAO_CHAT_URL } from "@/lib/site";
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
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 예약 — collab5",
  // 로그인해야 보이는 화면이라 검색에 걸릴 이유가 없다.
  robots: { index: false },
  // 🔎09-18 밤 QA SC-18 — 대표 주소를 안 두면 루트의 `canonical: "/"`가 상속돼 «이 화면은 홈의 사본»이라고 말하게 된다. 자기 주소로.
  alternates: { canonical: "/rent/requests" },
};

const h2Cls = "text-[21px] font-bold leading-snug tracking-tight text-ink";

/** 정렬 열쇠 — 날짜 + 시작 시각. 둘 다 고정폭 글자라 문자열 비교로 순서가 맞다. */
const whenKey = (v: GuestBookingView) => `${v.booking.useDate} ${v.booking.startTime ?? ""}`;

export default async function RentRequestsPage() {
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
  // 다가오는 것은 가까운 날부터(다음에 챙길 것이 맨 위), 지난 것은 최근 것부터.
  //   거절·취소된 신청은 날이 남았어도 「지난 신청」이다(더 움직이지 않는다) — 판정은 `groupGuestBookings`가 한다.
  const { upcoming: ahead } = groupGuestBookings(all, (v) => v.booking);
  const past = all
    .filter((v) => !ahead.includes(v))
    .sort((a, b) => whenKey(b).localeCompare(whenKey(a)));
  const expired = past.filter((v) => v.booking.status === "expired");
  const pastKept = past.filter((v) => v.booking.status !== "expired");
  const upcoming = ahead.sort((a, b) => whenKey(a).localeCompare(whenKey(b)));

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

      <HashFocus />
      {/* ✍️09-27 대표 B5·B6 — 절 이름을 「예약 완료」·「지난 예약」으로(`/rent/my` 빌린 공간 칸의 칩과 같은 이름),
          빈 줄은 「예약」으로 부르고 둘러보러 가는 링크는 「공간 둘러보기」 한 이름으로. */}
      {all.length === 0 ? (
        // 한 건도 없을 땐 절을 세우지 않는다. 빈 제목 둘이 서면 비어 있다는 말을 두 번 하게 된다.
        <p className="mt-8 text-[15px] leading-relaxed break-keep text-faint">
          아직 신청하신 예약이 없어요.{" "}
          <Link href="/rent" className="underline underline-offset-2">
            공간 둘러보기
          </Link>
        </p>
      ) : (
        <>
          <section className="mt-12">
            <h2 className={h2Cls}>예약 완료</h2>
            {upcoming.length === 0 ? (
              <p className="mt-5 text-[15px] leading-relaxed break-keep text-faint">
                다가오는 예약이 없어요.{" "}
                <Link href="/rent" className="underline underline-offset-2">
                  공간 둘러보기
                </Link>
              </p>
            ) : (
              <ul className="mt-5">
                {upcoming.map((v) => (
                  <GuestBookingRow key={v.booking.id} view={v} />
                ))}
              </ul>
            )}
          </section>

          {/* 지난 예약이 없으면 절째로 안 그린다. 처음 신청한 분에게 빈 「지난 예약」은 알려 주는 게 없다. */}
          {past.length > 0 && (
            <section className="mt-12">
              <h2 className={h2Cls}>지난 예약</h2>
              {pastKept.length > 0 && (
                <ul className="mt-5">
                  {pastKept.map((v) => (
                    <GuestBookingRow key={v.booking.id} view={v} />
                  ))}
                </ul>
              )}
              {/* 🗂09-17 QA — 결제창만 열었다 닫은 흔적(expired)이 16줄 쌓여 진짜 지난 예약이 묻혔다.
                  기본은 접고 건수만 말한다. 다시 열 길이 없는 줄이라 펼쳐 볼 일은 드물다. */}
              {expired.length > 0 && (
                // 🔗09-27 D2 — 주소가 `#b-<번호>`로 이 안의 줄을 짚으면 크롬이 React보다 먼저 접힌 칸을 연다(조각 이동 때 details 자동 펼침).
                //   그러면 서버 HTML과 `open` 한 칸이 달라 하이드레이션 경고가 뜬다. 해가 없는 차이라 이 요소만 경고를 끈다.
                <details className="mt-5" suppressHydrationWarning>
                  <summary className="cursor-pointer py-[12px] text-[15px] text-mute underline underline-offset-2">
                    결제 안 한 신청 {expired.length}건
                  </summary>
                  <ul className="mt-2">
                    {expired.map((v) => (
                      <GuestBookingRow key={v.booking.id} view={v} />
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
