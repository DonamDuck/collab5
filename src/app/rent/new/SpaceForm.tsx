"use client";

// 하루 가게 — 공간 올리기 폼 (2026-09-13)
//
// 칸 구성은 `SpaceFormInput`(lib/rent-actions.ts)을 그대로 따른다. 화면이 필드를 더 만들거나 빼면
// 서버가 받는 모양과 어긋나는데, 타입이 옵셔널을 허용하는 자리는 **컴파일러가 안 잡아 준다.**
//
// 🎨09-13 재작업 — register 폼 규칙으로. 섹션 제목 21 bold → 첫 입력 23px, 섹션 사이 `space-y-12`,
//   라벨 16 medium, 입력 48px/16px. 고르는 것(쓰임새·설비·예시)은 전부 pill, 읽는 것은 글자.
//   ⛔「우리 집 규칙」 민트 상자 · 「사장님께 가는 돈」 회색 표 · 쓰임새 라디오 카드 셋을 뺐다 —
//     상자 안에 상자가 겹쳐 행정 서식처럼 보였고, 그 안의 정보는 pill 하나·문장 한 줄로 충분했다.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSpaceAction } from "@/lib/rent-actions";
import { uploadPhoto } from "@/lib/upload";
import type { SpaceUseType } from "@/lib/types";
import {
  dateLabel,
  primaryBtnCls,
  rentInputCls,
  rentTextareaCls,
  secondaryBtnCls,
  todayKst,
  won,
} from "../ui";

/** 사장님이 처음부터 다 적게 하지 않으려고 미리 깔아 두는 설비 후보.
 *  ⚠️여기 없는 게 훨씬 많다(가마·재봉틀·오븐·암실…). 그래서 **직접 적는 칸이 주고 칩은 보조**다 —
 *    목록을 관문으로 만들면 우리가 상상한 업종만 올라온다. */
const FACILITY_HINTS = [
  "와이파이", "주차", "엘리베이터", "화장실", "냉난방", "테이블·의자",
  "빔프로젝터", "음향", "조명", "싱크대", "창고", "작업대",
];

/** 규칙 칸 예시 — 설계가 「예시를 여러 개 보여 준다」를 명시한 자리다.
 *  ⭐셋 다 **다른 종류**를 고른 게 핵심이다(예의 / 설비 다루기 / 이웃).
 *    비슷한 예시만 주면 사장님이 그 한 종류만 적는다. */
const RULE_EXAMPLES = [
  "신발은 벗고 들어와 주세요",
  "재봉틀은 제가 먼저 알려드린 뒤에 써 주세요",
  "밤 10시 이후 음악은 꺼 주세요",
  "쓰신 그릇은 설거지까지 부탁드려요",
];

const USE_OPTIONS: { v: SpaceUseType; label: string; desc: string }[] = [
  { v: "as_is", label: "원래 목적대로", desc: "제가 하던 그대로 써 주셨으면 해요." },
  { v: "open", label: "대관", desc: "제 규칙 안에서 무엇을 하실지는 빌리는 분이 정하세요." },
  { v: "both", label: "둘 다 좋아요", desc: "어느 쪽이든 이야기해 보고 정할게요." },
];

/** 고르는 pill — 고른 것은 키위 틴트, 아닌 것은 흰 면 + hairline. 44px 터치 타깃. */
const pickCls = (on: boolean) =>
  `inline-flex h-[44px] items-center rounded-pill px-4 text-[15px] font-medium transition-colors ${
    on ? "bg-primary-tint text-primary-on" : "border border-hairline bg-surface text-body hover:bg-surface-soft"
  }`;

type Photo = { url: string; uploading?: boolean };

export function SpaceForm({
  myBrands,
  feeRate,
}: {
  myBrands: { slug: string; name: string }[];
  feeRate: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [useType, setUseType] = useState<SpaceUseType>("both");
  const [facilities, setFacilities] = useState<string[]>([]);
  const [facilityInput, setFacilityInput] = useState("");
  const [capacity, setCapacity] = useState("");
  const [hours, setHours] = useState("");
  const [rules, setRules] = useState("");
  const [priceDay, setPriceDay] = useState("");
  const [mentorMinutes, setMentorMinutes] = useState("");
  const [mentorPrice, setMentorPrice] = useState("");
  const [openDates, setOpenDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");
  const [servesFood, setServesFood] = useState(false);
  const [subleaseOk, setSubleaseOk] = useState(false);
  const [brandSlug, setBrandSlug] = useState("");

  const priceNum = Number(priceDay) || 0;
  // ⚠️`payout()`을 import하지 않고 식을 옮겨 적었다 — 그 함수는 `lib/spaces.ts`에 있고, 그 파일은
  //   supabase 클라이언트를 끌고 온다. 클라이언트 번들에 데이터 계층 한 벌이 통째로 실린다.
  //   ⭐대신 **요율은 서버에서 받는다**(props). 바뀔 수 있는 값이 한 군데에만 있으면 어긋날 자리가 없다.
  //     식(내림)이 바뀌면 여기도 같이 고칠 것 — 그런 일은 요율 변경보다 훨씬 드물다.
  const payoutNum = Math.floor(priceNum * (1 - feeRate));
  const uploading = photos.some((p) => p.uploading);

  const addFacility = () => {
    const v = facilityInput.trim();
    if (!v || facilities.includes(v)) {
      setFacilityInput("");
      return;
    }
    setFacilities((p) => [...p, v]);
    setFacilityInput("");
  };

  const addDate = (d: string) => {
    if (!d || openDates.includes(d)) return;
    // 정렬해서 담는다 — 사장님이 띄엄띄엄 고른 날이 화면에서 뒤섞여 보이면 빠뜨린 날을 못 찾는다.
    setOpenDates((p) => [...p, d].sort());
    setDateInput("");
  };

  const pickPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    // 올라가는 중인 자리를 먼저 만들어 둔다 — 빈 화면에서 몇 초를 기다리면 「안 먹었나」 싶어 또 누른다.
    setPhotos((p) => [...p, ...list.map(() => ({ url: "", uploading: true }))]);
    for (const f of list) {
      try {
        const url = await uploadPhoto(f, 1200, "rent");
        setPhotos((p) => {
          const i = p.findIndex((x) => x.uploading);
          if (i === -1) return p;
          return p.map((x, j) => (j === i ? { url } : x));
        });
      } catch {
        // 실패한 자리는 조용히 걷어낸다. 실패한 채로 남겨 두면 그 blob 주소가 제출에 섞인다.
        setPhotos((p) => {
          const i = p.findIndex((x) => x.uploading);
          return i === -1 ? p : p.filter((_, j) => j !== i);
        });
        setErr("사진 한 장을 올리지 못했어요. 다시 골라 주세요.");
      }
    }
  };

  const submit = () =>
    start(async () => {
      setErr("");
      // 🚨음식·음료는 화면에서 «먼저» 막는다. 액션도 막지만, 다 적고 나서 거절당하면
      //   그 시간이 통째로 버려진다(설계 §법 — 식품위생법 제37조 ④).
      if (servesFood) {
        setErr("음식이나 음료를 파는 공간은 아직 받지 못해요. 법이 정리되는 대로 열겠습니다.");
        return;
      }
      if (!subleaseOk) {
        setErr("내 소유이거나 임대인 동의를 받았는지 확인해 주세요.");
        return;
      }
      if (rules.trim().length < 10) {
        setErr("우리 집 규칙을 열 글자 이상 적어 주세요. 이 칸이 사장님을 지켜 줍니다.");
        return;
      }
      if (openDates.length === 0) {
        setErr("빌려줄 수 있는 날을 하루 이상 골라 주세요.");
        return;
      }
      const r = await saveSpaceAction({
        name,
        tagline,
        body,
        photos: photos.filter((p) => !p.uploading && p.url).map((p) => p.url),
        area,
        address,
        useType,
        facilities,
        capacity: capacity ? Number(capacity) : undefined,
        hours,
        rules,
        priceDay: priceNum,
        mentorMinutes: Number(mentorMinutes) || 0,
        mentorPrice: Number(mentorPrice) || 0,
        openDates,
        servesFood,
        subleaseOk,
        brandSlug,
      });
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      // 검토 대기라 `/rent/{slug}`는 아직 남에게 안 보인다. 자기 것이 어디 있는지 보이는 화면으로 보낸다.
      router.push("/rent/my");
      router.refresh();
    });

  // 설비 pill 한 벌 — 고른 것(직접 적은 것 포함)이 앞, 아직 안 고른 후보가 뒤. 같은 덩어리에 pill은 이 한 종류.
  const facilityPool = [...facilities, ...FACILITY_HINTS.filter((h) => !facilities.includes(h))];

  return (
    <div className="mt-10 space-y-12">
      {/* ── 어떤 공간인가 ── */}
      <Group title="어떤 공간인가요">
        <L label="공간 이름" htmlFor="sp-name">
          <input
            id="sp-name"
            className={rentInputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 을지로 2층 작업실"
          />
        </L>
        <L label="한 줄로 말하면" htmlFor="sp-tagline" optional>
          <input
            id="sp-tagline"
            className={rentInputCls}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="예) 재봉틀 두 대가 있는 조용한 작업실이에요"
          />
        </L>
        <L label="공간 이야기" htmlFor="sp-body" optional hint="빈칸이어도 괜찮아요. 저희가 같이 써 드릴게요.">
          <textarea
            id="sp-body"
            rows={5}
            className={`${rentTextareaCls} resize-y`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="어떤 사람들이 여기서 무엇을 했는지, 어떤 날에 제일 예쁜지 같은 이야기를 적어 주세요."
          />
        </L>
        <L label="사진" optional hint="첫 장이 목록 카드에 쓰여요.">
          {/* 파일 고르기 버튼은 보조 버튼 얼굴로. 브라우저 기본 회색 버튼은 이 사이트 어디에도 없다. */}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              void pickPhotos(e.target.files);
              e.target.value = "";
            }}
            className="block w-full text-[15px] text-mute file:mr-3 file:h-[44px] file:cursor-pointer file:rounded-md file:border file:border-solid file:border-border-strong file:bg-surface file:px-4 file:text-[15px] file:font-medium file:text-ink"
          />
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-surface-soft">
                  {p.uploading ? (
                    <div className="flex h-full w-full items-center justify-center text-[13px] text-faint">
                      올리는 중…
                    </div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                      {/* 흰 pill로 — 검정 면은 안 쓴다. 사진 위라 흰 면이 오히려 잘 보인다. */}
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute right-1.5 top-1.5 h-[32px] rounded-pill bg-surface/90 px-3 text-[13px] font-medium text-ink"
                      >
                        빼기
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </L>
      </Group>

      {/* ── 어디에 있나 ── */}
      <Group title="어디에 있나요">
        <L label="동네" htmlFor="sp-area" hint="여기까지만 모두에게 보여요.">
          <input
            id="sp-area"
            className={rentInputCls}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="예) 중구 을지로3가"
          />
        </L>
        <L
          label="전체 주소"
          htmlFor="sp-address"
          hint="예약이 확정된 분에게만 열려요. 그 전에는 아무에게도 안 보여요."
        >
          <input
            id="sp-address"
            className={rentInputCls}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="예) 서울 중구 을지로 100, 2층"
          />
        </L>
      </Group>

      {/* ── 어떻게 쓰나 ── */}
      <Group title="어떻게 쓰면 될까요">
        <L label="쓰임새">
          {/* 라디오 카드 셋 대신 pill 셋 — 고른 것 하나만 설명 한 줄을 아래에 단다. */}
          <div className="flex flex-wrap gap-2">
            {USE_OPTIONS.map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={useType === o.v}
                onClick={() => setUseType(o.v)}
                className={pickCls(useType === o.v)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[15px] leading-relaxed break-keep text-mute">
            {USE_OPTIONS.find((o) => o.v === useType)?.desc}
          </p>
        </L>

        <L label="여기 있는 것들" optional hint="빌리는 분이 이걸 보고 고르세요. 누르면 담겨요.">
          <div className="flex flex-wrap gap-2">
            {facilityPool.map((f) => {
              const on = facilities.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setFacilities((p) => (on ? p.filter((x) => x !== f) : [...p, f]))
                  }
                  className={pickCls(on)}
                >
                  {f}
                  {on && <span className="ml-1.5 text-primary-on/60">×</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className={`${rentInputCls} min-w-0`}
              value={facilityInput}
              onChange={(e) => setFacilityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // 폼 제출로 새지 않게 막는다 — 이 화면의 제출은 맨 아래 버튼 하나뿐이다.
                  e.preventDefault();
                  addFacility();
                }
              }}
              placeholder="목록에 없으면 직접 적어 주세요"
              aria-label="설비 직접 적기"
            />
            <button type="button" onClick={addFacility} className={`${secondaryBtnCls} h-[48px] shrink-0`}>
              담기
            </button>
          </div>
        </L>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <L label="최대 몇 명까지" htmlFor="sp-cap" optional>
            <input
              id="sp-cap"
              type="number"
              inputMode="numeric"
              min={1}
              className={rentInputCls}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="예) 12"
            />
          </L>
          <L label="이용 시간" htmlFor="sp-hours" optional>
            <input
              id="sp-hours"
              className={rentInputCls}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="예) 10:00~22:00"
            />
          </L>
        </div>
      </Group>

      {/* ── 우리 집 규칙 ── ⭐이 서비스에서 제일 중요한 칸. 다른 섹션과 같은 옷을 입되
           설명 한 줄과 예시 pill로 무게를 준다(민트 상자로 감싸던 것을 걷어냈다 — 상자는 고르는 것에만). */}
      <Group title="우리 집 규칙" sub="열쇠를 넘기는 일이라 이 칸이 사장님을 지켜 줘요. 사소해 보여도 다 적어 주세요.">
        {/* 예시를 「누르면 들어가는 pill」로 둔다 — 읽고 나서 자기 말로 옮겨 적게 하는 것보다,
            한 줄 넣어 두고 고치게 하는 쪽이 빈칸으로 넘어갈 확률을 훨씬 낮춘다. */}
        <div>
          <div className="flex flex-wrap gap-2">
            {RULE_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setRules((p) => (p.trim() ? `${p.replace(/\n+$/, "")}\n${ex}` : ex))}
                className="inline-flex min-h-[44px] items-center rounded-pill bg-surface-soft px-4 py-2 text-left text-[15px] leading-snug break-keep text-body transition-colors hover:bg-primary-pale"
              >
                + {ex}
              </button>
            ))}
          </div>
          <textarea
            id="sp-rules"
            rows={5}
            className={`${rentTextareaCls} mt-3 resize-y`}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="한 줄에 하나씩 적어 주세요."
            aria-label="우리 집 규칙"
          />
          <p className="mt-2 text-[15px] text-faint">
            {rules.trim().length < 10
              ? "열 글자 이상 적어 주셔야 올릴 수 있어요."
              : `${rules.trim().length}자 적으셨어요.`}
          </p>
        </div>
      </Group>

      {/* ── 값 ── */}
      <Group title="얼마에 빌려주실까요">
        <L label="하루 값" htmlFor="sp-price">
          <input
            id="sp-price"
            type="number"
            inputMode="numeric"
            min={0}
            className={rentInputCls}
            value={priceDay}
            onChange={(e) => setPriceDay(e.target.value)}
            placeholder="예) 80000"
          />
          {/* ⭐정직하게 적는다. 「수수료 15%」만 적어 두면 사장님은 늘 손에 쥐는 금액을 직접 계산해야 하고,
              그 계산을 화면이 안 해 주면 첫 정산 때 「듣던 것과 다르다」가 된다. 표 대신 한 줄. */}
          {priceNum > 0 && (
            <p className="mt-2 text-[15px] text-mute">
              사장님께 {won(payoutNum)}이 가요 · 수수료 {Math.round(feeRate * 100)}%
            </p>
          )}
        </L>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <L label="사장님이 알려주는 시간" htmlFor="sp-mm" optional hint="비워 두면 안 파는 거예요.">
            <input
              id="sp-mm"
              type="number"
              inputMode="numeric"
              min={0}
              className={rentInputCls}
              value={mentorMinutes}
              onChange={(e) => setMentorMinutes(e.target.value)}
              placeholder="예) 60 (분)"
            />
          </L>
          <L label="그 값" htmlFor="sp-mp" optional>
            <input
              id="sp-mp"
              type="number"
              inputMode="numeric"
              min={0}
              className={rentInputCls}
              value={mentorPrice}
              onChange={(e) => setMentorPrice(e.target.value)}
              placeholder="예) 50000"
            />
          </L>
        </div>
      </Group>

      {/* ── 비는 날 ── 실사에서 이 데이터를 가진 곳이 23곳 중 0곳이었다(설계 §조사 ②).
           달력 라이브러리를 안 쓰는 이유 — 고르는 날이 보통 서너 개고, 달력은 그 서너 개를 위해
           한 달치 격자를 그린다. 날짜 칸 하나 + 담은 목록이면 같은 일을 한다. */}
      <Group title="어느 날 빌려주실 수 있나요">
        <div>
          <div className="flex gap-2">
            <input
              type="date"
              className={`${rentInputCls} min-w-0`}
              value={dateInput}
              min={todayKst()}
              onChange={(e) => setDateInput(e.target.value)}
              aria-label="빌려줄 날짜"
            />
            <button
              type="button"
              onClick={() => addDate(dateInput)}
              className={`${secondaryBtnCls} h-[48px] shrink-0`}
            >
              담기
            </button>
          </div>
          {openDates.length === 0 ? (
            <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
              하루 이상 담아 주세요. 이게 없으면 아무도 신청할 수 없어요.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {openDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setOpenDates((p) => p.filter((x) => x !== d))}
                  aria-label={`${dateLabel(d)} 빼기`}
                  className={pickCls(true)}
                >
                  {dateLabel(d)} <span className="ml-1.5 text-primary-on/60">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Group>

      {/* ── 확인 ── */}
      <Group title="마지막으로 확인할게요">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-[3px] size-[18px] shrink-0 accent-primary"
              checked={servesFood}
              onChange={(e) => setServesFood(e.target.checked)}
            />
            <span className="min-w-0 text-[16px] leading-relaxed break-keep text-body">
              여기서 음식이나 음료를 팔아요
            </span>
          </label>
          {/* 체크하는 «순간» 알려준다. 제출 버튼까지 가서 알려주면 그 사이에 적은 것이 다 헛일이 된다.
              노란 상자 대신 문장 하나 — 막는 말은 조용할수록 덜 억울하다. */}
          {servesFood && (
            <p className="text-[15px] leading-relaxed break-keep text-mute">
              음식·음료를 파는 공간은 아직 받지 못해요. 남의 영업신고 시설에서 다른 분이 파시면 무신고
              영업이 되어 사장님께 책임이 가요. 법이 정리되는 대로 꼭 열게요.
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-[3px] size-[18px] shrink-0 accent-primary"
              checked={subleaseOk}
              onChange={(e) => setSubleaseOk(e.target.checked)}
            />
            <span className="min-w-0 text-[16px] leading-relaxed break-keep text-body">
              내 소유이거나, 임대인 동의를 받았어요
            </span>
          </label>
        </div>

        {myBrands.length > 0 && (
          <L label="소개서 붙이기" htmlFor="sp-brand" optional hint="이름만 보여드려요. 연락처는 안 나가요.">
            <select
              id="sp-brand"
              className={rentInputCls}
              value={brandSlug}
              onChange={(e) => setBrandSlug(e.target.value)}
            >
              <option value="">안 붙일래요</option>
              {myBrands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </L>
        )}
      </Group>

      <div>
        {err && (
          <p className="mb-4 text-[15px] leading-relaxed break-keep text-danger">{err}</p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || uploading || servesFood}
          className={`${primaryBtnCls} h-[52px] w-full`}
        >
          {pending ? "올리는 중이에요…" : uploading ? "사진을 올리는 중이에요…" : "올리기"}
        </button>
        <p className="mt-3 text-center text-[15px] leading-relaxed break-keep text-faint">
          올려 주시면 한 번 읽어보고 공개해 드려요.
        </p>
      </div>
    </div>
  );
}

/** 묶음 제목 + 칸들. 한 화면에 칸이 스무 개라 구역이 없으면 어디까지 적었는지 놓친다.
 *  제목 → 첫 입력 23px(register `GroupHeader` 규칙). 칸 사이 24px. */
function Group({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-[23px]">
        <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">{title}</h2>
        {sub && <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">{sub}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** 라벨 한 벌.
 *  ⚠️`@/components/Field`를 안 쓴 이유 — 그건 인증 4화면이 「같은 얼굴」이려고 공유하는 것이고,
 *    여기엔 안내문(hint) 자리가 더 필요하다. 공용 컴포넌트에 칸을 더하면 저쪽 4화면이 같이 흔들린다. */
function L({
  label,
  htmlFor,
  optional,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-[16px] font-medium text-body">
        {label}
        {optional && <span className="ml-1 text-[15px] font-normal text-faint">· 선택</span>}
      </label>
      {hint && <p className="-mt-0.5 mb-2 text-[15px] leading-relaxed break-keep text-faint">{hint}</p>}
      {children}
    </div>
  );
}
