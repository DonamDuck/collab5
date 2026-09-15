"use client";

// 하루 가게 — 신청 폼 (2026-09-13)
//
// 🚨**결제가 신청보다 «먼저»다**(대표 09-13 확정). 호스트와 미리 연결되면 둘 다 수수료를 안 내는 쪽이
//   이득이라, 만나기만 하면 다음 거래부터 우리가 필요 없어진다(설계 §이탈). 그래서 이 버튼 하나가
//   「결제 + 신청」을 같이 끝낸다. 「신청해두고 나중에 결제」로 쪼개지 말 것.
//
// 💳**결제 UI는 토스가 그린다**(대표 09-13: *"최대한 토스 UI 쓰는 방향, 우리 개발 줄이공"*).
//   카드 번호·할부·인증·약관을 우리가 만들지 않는다. 우리가 하는 일은 셋뿐이다 —
//   ①서버에 자리를 잡고(`startBookingAction`) ②토스 **결제위젯**을 이 페이지 안에 그리고
//   ③돌아온 값으로 승인한다(`/rent/pay/success`).
//   🩸09-13 실측: 처음엔 `payment()`(새 창)로 짰는데 `NOT_SUPPORTED_WIDGET_KEY`가 났다.
//     대표가 받은 「주문서형·결제창형 연동 키」(`test_gck_…`)는 **위젯 전용**이고 `payment()`는
//     「API 개별 연동 키」(`test_ck_…`)를 요구한다. 키를 바꾸는 대신 위젯으로 맞췄다 —
//     결제수단·약관이 우리 페이지 안에 토스 모양 그대로 뜨니 대표 의도에 더 가깝다.
//
// ⭐**금액을 이 화면이 정하지 않는다.** 아래 `total`은 «보여주기»용이고, 실제 청구액은 서버가
//   공간 행에서 다시 계산해 `pending` 행에 적어 둔 값이다. 여기 숫자를 고쳐도 청구액은 안 바뀐다.
//
// 🚧클라이언트 키가 없으면 **결제창을 건너뛰고 모의 승인**으로 간다(`lib/rent-payment.ts`).
//   🚨키 없이 운영에 나가면 돈을 안 받고 예약이 확정된다. 배포 전 반드시 확인할 것.
//
// 🎨09-13 재작업 — 회색 상자를 걷고 지면에 바로 세웠다(소개서 폼 사다리: 라벨 16 medium ·
//   입력 48px/16px · 도움말 15 faint). 금액 표는 **한 문장**으로. 버튼은 화면 유일 키위 52px이고,
//   모바일에선 `MakerActionBar`처럼 **하단 고정 바**에 금액과 같이 앉는다(폼이 길어서 버튼이
//   화면 밖에 있으면 「어디서 내지」가 된다).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startBookingAction, confirmBookingAction } from "@/lib/rent-actions";
import type { SpaceUseType } from "@/lib/types";
import { dateLabel, primaryBtnCls, RentSelect, rentInputCls, rentTextareaCls, won } from "../ui";
import { ConfirmDialog } from "../ConfirmDialog";
import { PickDateCalendar } from "./PickDateCalendar";
import { MentorOptions } from "./MentorOption";

const labelCls = "mb-2 block text-[16px] font-medium text-body";
const hintCls = "mt-2 text-[15px] leading-relaxed break-keep text-faint";
/** 못 넘어간 칸 바로 아래에 붙는 한 줄. 힌트와 같은 자리에 같은 크기로 서고 색만 다르다. */
const errCls = "mt-2 text-[15px] leading-relaxed break-keep text-danger";

/** 화면 아래 고정 바 — 금액 + 이 화면의 키위 버튼. 어느 폭에서나 이 하나가 유일한 결제 버튼이다.
 *  하단 여백은 `max()`다(MakerActionBar 08-09 실측): 홈 인디케이터가 있는 기기는 안전영역만, 없는 기기는 12px. */
function PayBar({
  amount,
  label,
  disabled,
  onClick,
}: {
  amount: number;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto w-full max-w-[640px] rounded-t-2xl border border-b-0 border-hairline bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-e2">
        {/* 🔻09-15 대표 — *「(폰이) 이렇게 나오는 거 좋은데, 데스크탑도 동일 UX로 적용 필요해」*.
            전엔 폰은 팝업 안에서, 데스크톱은 이 바 «안»에서 옵션을 골랐다. 두 화면이 서로 다른 물건이었다.
            ⭐이제 **옵션을 고르는 자리는 확인 팝업 한 곳뿐이다.** 바는 어느 폭에서나 금액과 버튼만 든다. */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {/* 🔁09-14 「지금 내실 돈」 → **「대여 비용」**(대표). 「지금 내실」은 재촉으로 읽히고
                무엇에 대한 돈인지는 말해 주지 않는다. */}
            <p className="text-[13px] text-faint">대여 비용</p>
            <p className="truncate text-[17px] font-medium text-ink">{won(amount)}</p>
          </div>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${primaryBtnCls} h-[52px] shrink-0 px-5`}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}


export function BookingForm({
  spaceId,
  spaceSlug,
  openDates,
  priceDay,
  mentorMinutes,
  mentorPrice,
  capacity,
  hours,
  useType,
  myBrands,
  spaceName,
}: {
  spaceId: number;
  spaceSlug: string;
  /** 확인 팝업 문장(「{공간}을 신청할까요」)에 쓴다. */
  spaceName: string;
  openDates: string[];
  priceDay: number;
  mentorMinutes: number;
  mentorPrice: number;
  capacity?: number;
  hours: string;
  /** 「몇 분이나」는 대관(`open`·`both`)에서만 묻는다. 원래 목적대로(`as_is`) 쓰는 자리엔 인원이 정보가 아니다. */
  useType: SpaceUseType;
  myBrands: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const [useDate, setUseDate] = useState(openDates[0] ?? "");
  const [headcount, setHeadcount] = useState("");
  const [plan, setPlan] = useState("");
  const [withMentor, setWithMentor] = useState(false);
  const [brandSlug, setBrandSlug] = useState("");
  /** 결제 직전 확인 팝업(대표 09-14: 의사 확인은 팝업으로). 열린 채로 `submit`이 돌지 않게 닫고 시작한다. */
  const [confirming, setConfirming] = useState(false);
  /** 🚨**못 넘어간 이유를 «그 칸 옆»에 둔다**(대표 09-15 [2][3]).
   *  전엔 오류 한 줄이 폼 맨 아래 결제 버튼 위에만 떴다. 그런데 버튼은 화면 아래 고정 바에 있어서
   *  **누른 자리에서 3,000px 떨어진 곳에 글자가 생겼다.** 화면에는 아무 변화도 없고 팝업도 안 열리니
   *  「버튼이 죽었다」로 읽힌다. 실제로 대표가 그렇게 읽었다.
   *  ⭐그래서 둘을 같이 한다 — 문구는 그 칸 아래에 놓고, 화면을 그 칸으로 끌어올린다. */
  const [badField, setBadField] = useState<"date" | "plan" | "">("");
  const dateRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLTextAreaElement>(null);

  const mentorAmount = withMentor && mentorMinutes > 0 ? mentorPrice : 0;
  const total = priceDay + mentorAmount;
  // ⚠️열 글자는 서버(`confirmBookingAction`)가 강제하는 값이다. 여기서 먼저 막는 건 왕복을 아끼려는 것이지
  //   이게 관문이라서가 아니다 — 관문은 늘 서버 쪽이다.
  const planShort = plan.trim().length < 10;

  /** 버튼이 부르는 건 이것 — 싼 검사만 하고 팝업을 연다. 서버 왕복은 팝업에서 [신청하기]를 누른 뒤다. */
  /** 위에서부터 첫 번째로 비어 있는 칸으로 데려간다. 두 칸이 다 비어도 «위엣것» 하나만 말한다 —
   *  한 번에 둘을 고치라고 하면 어디부터 볼지 또 고민하게 된다. */
  const stopAt = (f: "date" | "plan") => {
    setBadField(f);
    const el = f === "date" ? dateRef.current : planRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // 글 칸은 커서까지 넣어 준다. 날짜는 격자라 커서가 갈 곳이 없다.
    if (f === "plan") planRef.current?.focus({ preventScroll: true });
  };

  const askConfirm = () => {
    setErr("");
    setBadField("");
    if (!useDate) { stopAt("date"); return; }
    if (planShort) { stopAt("plan"); return; }
    setConfirming(true);
  };

  const submit = () =>
    start(async () => {
      setConfirming(false);
      setErr("");

      // ① 서버가 검사하고 자리를 잡는다. 주문번호와 청구액도 여기서 «서버가» 정해 돌려준다.
      const r = await startBookingAction({
        spaceSlug,
        useDate,
        hours: "",          // 빈 값이면 서버가 공간의 이용 시간을 그대로 쓴다
        plan: plan.trim(),
        headcount: headcount ? Number(headcount) : undefined,
        withMentor,
        guestBrandSlug: brandSlug,
      });
      if (!r.ok || !r.orderId || !r.amount) { setErr(r.message || "신청을 시작하지 못했어요."); return; }

      // ② 키가 없으면 위젯을 건너뛰고 모의 승인으로 간다(로컬에서 흐름을 막지 않으려고).
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        const done = await confirmBookingAction("", r.orderId);
        if (!done.ok) { setErr(done.message); return; }
        router.push(done.bookingId ? `/rent/done/${done.bookingId}` : "/rent/my");
        router.refresh();
        return;
      }
      // ③ 결제 화면으로. 🔁09-15 대표 — 전엔 이 화면 안에서 폼을 위젯으로 갈아끼웠다.
      //   주소가 그대로라 브라우저 뒤로가기가 「신청 내용 고치기」로 안 가고 목록으로 나가 버렸다.
      //   이제 `/rent/pay/<주문번호>`로 «이동»한다 — 뒤로가기가 제자리로 돌아온다.
      // 🚨**`router.push`가 아니라 문서를 새로 연다.** 토스 결제수단 위젯은 «한 문서에 하나»만 허용해서,
      //   화면 안 이동으로 결제 화면에 두 번째로 들어가면 `PAYMENT_METHODS_WIDGET_ALREADY_RENDERED`로 죽는다.
      //   🪤화면엔 에러가 안 뜬다 — 결제 칸이 통째로 비고 버튼이 「불러오는 중」에서 안 풀린다(09-15 실측).
      //   고치러 돌아갔다 다시 오는 길이 바로 그 경우라, 대표가 요청한 바로 그 동선에서 터진다.
      window.location.assign(`/rent/pay/${r.orderId}`);
    });

  return (
    <div className="space-y-7">
      <div ref={dateRef}>
        <p className={labelCls}>신청 날짜를 선택해주세요.</p>
        {/* 🔁09-14 `<select>` → 달력(대표). 못 고르는 날이 흐리게 «보이는» 것이 오히려 정보다 —
            「이 공간은 화요일만 열린다」가 격자에서 한눈에 읽힌다. 목록은 그 규칙을 안 보여준다. */}
        <PickDateCalendar
          openDates={openDates}
          value={useDate}
          onChange={(d) => { setUseDate(d); setBadField((f) => (f === "date" ? "" : f)); }}
        />
        {badField === "date" && <p className={errCls}>어느 날 쓰실지 골라 주세요.</p>}
        {hours && <p className={hintCls}>이용 시간은 {hours}예요.</p>}
      </div>

      {useType !== "as_is" && (
        <div>
          <label htmlFor="rent-head" className={labelCls}>
            예상 참여 인원을 알려주세요. <span className="ml-1 text-[15px] font-normal text-faint">(선택)</span>
          </label>
          {/* 🔁09-14 대표 — 「input이 이렇게 길지 않아도 될 거 같은데」. 숫자 두세 자리를 받는 칸이
              화면 폭을 다 쓰면 **긴 글을 기대하는 칸처럼** 보인다. 폭이 곧 기대 길이다.
              그리고 단위 「명」을 칸 «안»에 박아 둔다 — 밖에 두면 좁은 화면에서 줄이 바뀌어 떨어진다. */}
          {/* 📐폭 200px — 대표가 「이렇게 길지 않아도」라 했지만 **너무 좁히면 플레이스홀더가 잘린다**
              140px에선 「숫자를 입력…」, 200px에서도 한 글자가 끊겼다. **재서 240px**로 잡았다
              (글자 자리 ~196 + 「명」 자리 44). 전체 폭 380의 63%라 여전히 「짧은 칸」으로 읽힌다.
              ⭐폭은 기대 길이를 말하는 장치지 최소화할 값이 아니다 — 문구가 잘리면 그 장치가 거짓말을 한다. */}
          <div className="relative w-[240px]">
            <input
              id="rent-head"
              type="number"
              inputMode="numeric"
              min={1}
              max={capacity}
              className={`${rentInputCls} pr-11`}
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              placeholder="숫자를 입력해주세요"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[16px] text-mute"
            >
              명
            </span>
          </div>
          {capacity ? <p className={hintCls}>최대 {capacity}명까지 들어가요.</p> : null}
        </div>
      )}

      <div>
        <label htmlFor="rent-plan" className={labelCls}>
          그날 무엇을 하실 건가요
        </label>
        {/* ⭐이 칸이 사장님이 수락을 정하는 유일한 근거다. 「대관 문의드립니다」로는 아무것도 못 정한다.
            그래서 placeholder에 **답의 모양**을 보여준다 — 무엇을·누구와·몇 시간. */}
        <textarea
          id="rent-plan"
          ref={planRef}
          rows={4}
          className={`${rentTextareaCls} resize-y`}
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            if (e.target.value.trim().length >= 10) setBadField((f) => (f === "plan" ? "" : f));
          }}
          placeholder="예) 직접 만든 도자기 그릇 20점으로 하루 팝업을 열려고 해요. 친구 한 명과 둘이 오고, 오후에 손님을 받을 계획이에요."
        />
        {badField === "plan" && <p className={errCls}>그날 무엇을 하실지 열 글자 이상 적어 주세요.</p>}
        <p className={hintCls}>사장님이 이 글만 보고 정하세요. 열 글자면 충분해요.</p>
      </div>

      {/* 🔻09-14 「사장님께 잠깐 배워보기」 체크박스 삭제 — 대표 [3][5].
          설명은 상세 본문의 «정보 절»로 올라갔고, 고르는 일은 결제 단계(아래 옵션)로 내려왔다.
          ⭐**설명하는 자리와 고르는 자리를 갈랐다.** 한 줄 체크박스는 둘 다 하려다 둘 다 못 했다. */}
      {myBrands.length > 0 && (
        <div>
          <label htmlFor="rent-brand" className={labelCls}>
            내 소개서도 같이 보여드릴까요 <span className="ml-1 text-[15px] font-normal text-faint">· 선택</span>
          </label>
          <RentSelect
            id="rent-brand"
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
          >
            <option value="">안 보여드릴래요</option>
            {myBrands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </RentSelect>
          <p className={hintCls}>사장님이 어떤 분인지 알면 수락이 훨씬 빨라져요.</p>
        </div>
      )}

      {/* ── 금액 ── 낼 돈을 버튼 «위»에 적는다. 누른 뒤에 금액을 처음 보면 그건 함정이다.
          표 대신 한 문장 — 항목이 둘뿐이라 표를 그리면 영수증이 된다. */}
      <p className="border-t border-hairline pt-6 text-[17px] leading-relaxed break-keep text-body">
        대여 비용 <span className="font-medium text-ink">{won(total)}</span>
        {mentorAmount > 0 && <span className="text-mute"> (사장님 시간 포함)</span>} · 사장님이 거절하시면
        전액 돌려드려요. 수락하시면 그때 주소와 연락처가 열려요.
      </p>

      {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}

      {/* 🔻09-14 데스크톱 인라인 버튼 삭제 — 하단 고정 바가 이제 모든 폭에서 뜬다(대표 지시).
          같은 버튼이 화면에 둘이면 어느 쪽이 진짜인지 고민하게 된다. */}
      <p className="text-[14px] text-faint">지금은 시험 결제예요.</p>

      <PayBar
        amount={total}
        label={pending ? "신청하는 중…" : "결제하고 신청하기"}
        disabled={pending}
        onClick={askConfirm}
      />

      <ConfirmDialog
        open={confirming}
        title="이대로 신청할까요"
        confirmLabel="신청하기"
        busy={pending}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      >
        {/* 🔁09-15 `sm:hidden` 제거 — 어느 폭에서나 여기서 고른다(대표 「데스크탑도 동일 UX」).
            바에서 옵션을 뺐으니 고르개가 둘로 보일 걱정도 없다. */}
        {mentorMinutes > 0 && (
          <MentorOptions minutes={mentorMinutes} price={mentorPrice} value={withMentor} onChange={setWithMentor} />
        )}
        <p>
          {dateLabel(useDate)}에 <span className="font-medium text-ink">{spaceName}</span>을{" "}
          <span className="font-medium text-ink">{won(total)}</span>에 신청할까요?
        </p>
        <p className="text-mute">사장님이 거절하시면 전액 돌려드려요.</p>
      </ConfirmDialog>
    </div>
  );
}
