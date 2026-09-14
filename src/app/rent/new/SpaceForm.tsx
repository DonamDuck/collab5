"use client";

// 하루 가게 — 공간 올리기·고치기 폼 (2026-09-13 · 09-14 재작업)
//
// 칸 구성은 `SpaceFormInput`(lib/rent-actions.ts)을 그대로 따른다. 화면이 필드를 더 만들거나 빼면
// 서버가 받는 모양과 어긋나는데, 타입이 옵셔널을 허용하는 자리는 **컴파일러가 안 잡아 준다.**
//
// 🎨09-14 재작업 — 대표 평가 *「입력 UI가 불편하고, AI가 빠르게 만든 티가 난다. 정규 서비스처럼
//   안 보인다. 특히 입력폼.」* 티의 정체는 «입력 부품»이었다. 주소를 글자로 치게 하고, 날짜를 글자로
//   치게 하고, 값을 콤마 없이 치게 했다. 정규 서비스는 그 셋을 전부 «고르게» 한다.
//   ① 주소 = 카카오 우편번호 레이어(`AddressField`) → 동네까지 자동으로 채운다
//   ② 비는 날 = 달력 격자(`OpenDatesCalendar`)
//   ③ 값 = 천 단위 콤마 + 「원」 접미(`WonInput`) · 시각 = 30분 단위 select 둘
//   ④ 「사장님이 알려주는 시간(분)」+「값」 두 칸 → 토글 하나 + 값 한 칸(한 시간으로 고정)
//   더한 칸 = 「들어오는 법」(`accessNote`, 확정된 분에게만). 사진은 한 장 이상 필수.
//
//   같은 폼이 `/rent/new`와 `/rent/[slug]/edit`를 다 맡는다 — `initial`이 오면 고치기 모드.
//   저장은 둘 다 `saveSpaceAction`이고, slug가 실리면 그 행을 덮어쓴다(다시 검토 대기로 들어간다).
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSpaceAction } from "@/lib/rent-actions";
import { uploadPhoto } from "@/lib/upload";
import type { Space, SpaceUseType } from "@/lib/types";
import { primaryBtnCls, rentInputCls, rentTextareaCls, secondaryBtnCls, won } from "../ui";
import { AddressField } from "./AddressField";
import { OpenDatesCalendar } from "./OpenDatesCalendar";

/** 사장님이 처음부터 다 적게 하지 않으려고 미리 깔아 두는 설비 후보.
 *  ⚠️여기 없는 게 훨씬 많다(가마·재봉틀·오븐·암실…). 그래서 **직접 적는 칸이 주고 칩은 보조**다 —
 *    목록을 관문으로 만들면 우리가 상상한 업종만 올라온다. */
const FACILITY_HINTS = [
  "와이파이", "주차", "엘리베이터", "화장실", "냉난방", "테이블·의자",
  "빔프로젝터", "음향", "조명", "싱크대", "창고", "작업대",
];

/** 규칙 칸 예시 — 설계가 「예시를 여러 개 보여 준다」를 명시한 자리다.
 *  ⭐넷 다 **다른 종류**를 고른 게 핵심이다(예의 / 설비 다루기 / 이웃 / 뒷정리).
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

/** 06:00부터 24:00까지 30분 단위. 자정 넘는 영업은 1단계에서 안 받는다(그날 «하루»를 파는 상품이라). */
const TIMES: string[] = [];
for (let h = 6; h <= 24; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 24) TIMES.push(`${String(h).padStart(2, "0")}:30`);
}
const DEFAULT_START = "10:00";
const DEFAULT_END = "20:00";
/** 「알려드려요」 토글은 한 시간으로 고정한다. 분 단위 칸이 있던 09-13 폼에서 그 칸을 채운 값이
 *  전부 60이었고, 30분·90분 상품은 사장님도 값을 못 정했다. */
const MENTOR_MINUTES = 60;

/** `"10:00~20:00"` → 두 시각. 옛 자유 입력 값(「10시부터」 같은 것)은 기본값으로 떨어진다. */
function parseHours(s: string): [string, string] {
  const m = /^(\d{2}:\d{2})~(\d{2}:\d{2})$/.exec(s.trim());
  if (m && TIMES.includes(m[1]) && TIMES.includes(m[2])) return [m[1], m[2]];
  return [DEFAULT_START, DEFAULT_END];
}

/** 저장된 주소 `"서울 중구 을지로 100, 2층"` → 도로명 / 상세. 첫 쉼표에서 가른다 —
 *  우편번호 서비스가 주는 도로명 주소엔 쉼표가 없고, 상세는 우리가 쉼표로 붙였다. */
function splitAddress(s: string): [string, string] {
  const i = s.indexOf(", ");
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i + 2)];
}

/** 고르는 pill — 고른 것은 키위 틴트, 아닌 것은 흰 면 + hairline. 44px 터치 타깃. */
const pickCls = (on: boolean) =>
  `inline-flex h-[44px] items-center rounded-pill px-4 text-[15px] font-medium transition-colors ${
    on ? "bg-primary-tint text-primary-on" : "border border-hairline bg-surface text-body hover:bg-surface-soft"
  }`;

type Photo = { url: string; uploading?: boolean };

export function SpaceForm({
  myBrands,
  feeRate,
  initial,
}: {
  myBrands: { slug: string; name: string }[];
  feeRate: number;
  /** 고치기 모드 — 기존 값. 없으면 새로 올리기. */
  initial?: Space;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const editing = !!initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [photos, setPhotos] = useState<Photo[]>((initial?.photos ?? []).map((url) => ({ url })));
  const [area, setArea] = useState(initial?.area ?? "");
  const [addrBase, setAddrBase] = useState(() => splitAddress(initial?.address ?? "")[0]);
  const [addrDetail, setAddrDetail] = useState(() => splitAddress(initial?.address ?? "")[1]);
  const [accessNote, setAccessNote] = useState(initial?.accessNote ?? "");
  const [useType, setUseType] = useState<SpaceUseType>(initial?.useType ?? "both");
  const [facilities, setFacilities] = useState<string[]>(initial?.facilities ?? []);
  const [facilityInput, setFacilityInput] = useState("");
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : "");
  const [hourStart, setHourStart] = useState(() => parseHours(initial?.hours ?? "")[0]);
  const [hourEnd, setHourEnd] = useState(() => parseHours(initial?.hours ?? "")[1]);
  const [rules, setRules] = useState(initial?.rules ?? "");
  const [priceDay, setPriceDay] = useState<number>(initial?.priceDay ?? 0);
  const [mentorOn, setMentorOn] = useState((initial?.mentorMinutes ?? 0) > 0);
  const [mentorPrice, setMentorPrice] = useState<number>(initial?.mentorPrice ?? 0);
  const [openDates, setOpenDates] = useState<string[]>([...(initial?.openDates ?? [])].sort());
  const [servesFood, setServesFood] = useState(initial?.servesFood ?? false);
  const [subleaseOk, setSubleaseOk] = useState(initial?.subleaseOk ?? false);
  const [brandSlug, setBrandSlug] = useState(initial?.brandSlug ?? "");

  // ⚠️`payout()`을 import하지 않고 식을 옮겨 적었다 — 그 함수는 `lib/spaces.ts`에 있고, 그 파일은
  //   supabase 클라이언트를 끌고 온다. 클라이언트 번들에 데이터 계층 한 벌이 통째로 실린다.
  //   ⭐대신 **요율은 서버에서 받는다**(props). 바뀔 수 있는 값이 한 군데에만 있으면 어긋날 자리가 없다.
  const payoutNum = Math.floor(priceDay * (1 - feeRate));
  const uploading = photos.some((p) => p.uploading);
  const readyPhotos = photos.filter((p) => !p.uploading && p.url);
  const hoursBad = hourEnd <= hourStart;

  const onPickAddress = useCallback((base: string, picked: string) => {
    setAddrBase(base);
    // 동네는 비어 있을 때만 덮는다 — 사장님이 먼저 고쳐 둔 동네 이름을 주소 검색이 되돌리면 안 된다.
    setArea((cur) => (cur.trim() ? cur : picked));
  }, []);

  const addFacility = () => {
    const v = facilityInput.trim();
    if (!v || facilities.includes(v)) {
      setFacilityInput("");
      return;
    }
    setFacilities((p) => [...p, v]);
    setFacilityInput("");
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
        // 실패한 자리는 지운다. 남겨 두면 `uploading`이 영원히 true라 제출이 잠긴다.
        setPhotos((p) => {
          const i = p.findIndex((x) => x.uploading);
          return i === -1 ? p : p.filter((_, j) => j !== i);
        });
        setErr("사진 하나를 못 올렸어요. 다시 골라 주세요.");
      }
    }
  };

  // 화면에서 먼저 막는 이유는 왕복을 아끼려는 것이지 이게 관문이라서가 아니다 — 관문은 늘 서버다.
  const blocker = (): string => {
    if (!name.trim()) return "공간 이름을 적어 주세요.";
    if (readyPhotos.length === 0) return "사진을 한 장 이상 올려 주세요. 사진 없는 공간은 아무도 안 빌려요.";
    if (hoursBad) return "끝나는 시각이 시작보다 늦어야 해요.";
    if (rules.trim().length < 10) return "우리 집 규칙을 열 글자 이상 적어 주세요.";
    if (openDates.length === 0) return "빌려줄 수 있는 날을 하루 이상 골라 주세요.";
    if (!subleaseOk) return "내 소유이거나 임대인 동의를 받았는지 확인해 주세요.";
    return "";
  };
  const blocked = blocker();

  const submit = () =>
    start(async () => {
      setErr("");
      if (blocked) {
        setErr(blocked);
        return;
      }
      const address = [addrBase.trim(), addrDetail.trim()].filter(Boolean).join(", ");
      const r = await saveSpaceAction({
        slug: initial?.slug,
        name,
        tagline,
        body,
        photos: readyPhotos.map((p) => p.url),
        area,
        address,
        accessNote,
        useType,
        facilities,
        capacity: capacity ? Number(capacity) : undefined,
        hours: `${hourStart}~${hourEnd}`,
        rules,
        priceDay,
        mentorMinutes: mentorOn ? MENTOR_MINUTES : 0,
        mentorPrice: mentorOn ? mentorPrice : 0,
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
        <L label="사진" hint="한 장 이상 올려 주세요. 첫 장이 표지가 돼요.">
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
                      {i === 0 && (
                        <span className="absolute left-1.5 top-1.5 inline-flex h-[28px] items-center rounded-pill bg-surface/90 px-2.5 text-[13px] font-medium text-ink">
                          표지
                        </span>
                      )}
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
        <L
          label="전체 주소"
          htmlFor="sp-address"
          hint="예약이 확정된 분에게만 열려요. 그 전에는 아무에게도 안 보여요."
        >
          <AddressField
            base={addrBase}
            detail={addrDetail}
            onPick={onPickAddress}
            onBase={setAddrBase}
            onDetail={setAddrDetail}
          />
        </L>
        <L label="동네" htmlFor="sp-area" hint="여기까지만 모두에게 보여요. 주소를 찾으면 저절로 채워지고, 고치셔도 돼요.">
          <input
            id="sp-area"
            className={rentInputCls}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="예) 중구 을지로3가"
          />
        </L>
        <L
          label="들어오는 법"
          htmlFor="sp-access"
          hint="예약이 확정된 분에게만 보여요. 그 전엔 아무에게도 안 보입니다."
        >
          <textarea
            id="sp-access"
            rows={3}
            className={`${rentTextareaCls} resize-y`}
            value={accessNote}
            onChange={(e) => setAccessNote(e.target.value)}
            placeholder="예) 도어락 1234#, 열쇠는 화분 아래, 불은 들어와서 왼쪽 스위치"
          />
        </L>
      </Group>

      {/* ── 어떻게 쓰나 ── */}
      <Group title="어떻게 쓰면 될까요">
        <L label="쓰임새">
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
                  onClick={() => setFacilities((p) => (on ? p.filter((x) => x !== f) : [...p, f]))}
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

        <L label="최대 몇 명까지" htmlFor="sp-cap" optional>
          <input
            id="sp-cap"
            type="number"
            inputMode="numeric"
            min={1}
            className={`${rentInputCls} sm:max-w-[200px]`}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="예) 12"
          />
        </L>

        <L label="이용 시간" htmlFor="sp-hour-start">
          {/* 네이티브 select 둘 — iOS에서 휠이 뜨는 쪽이 커스텀 드롭다운보다 자연스럽다. */}
          <div className="flex items-center gap-2">
            <select
              id="sp-hour-start"
              className={`${rentInputCls} min-w-0`}
              value={hourStart}
              onChange={(e) => setHourStart(e.target.value)}
              aria-label="시작 시각"
            >
              {TIMES.filter((t) => t !== "24:00").map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-[16px] text-mute">부터</span>
            <select
              className={`${rentInputCls} min-w-0`}
              value={hourEnd}
              onChange={(e) => setHourEnd(e.target.value)}
              aria-label="끝나는 시각"
            >
              {TIMES.filter((t) => t !== "06:00").map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-[16px] text-mute">까지</span>
          </div>
          {hoursBad && (
            <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">
              끝나는 시각이 시작보다 늦어야 해요.
            </p>
          )}
        </L>
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
          <WonInput id="sp-price" value={priceDay} onChange={setPriceDay} placeholder="예) 80,000" />
          {/* ⭐정직하게 적는다. 「수수료 15%」만 적어 두면 사장님은 늘 손에 쥐는 금액을 직접 계산해야 하고,
              그 계산을 화면이 안 해 주면 첫 정산 때 「듣던 것과 다르다」가 된다. 표 대신 한 줄. */}
          {priceDay > 0 && (
            <p className="mt-2 text-[15px] text-mute">
              사장님께 {won(payoutNum)}이 가요 · 수수료 {Math.round(feeRate * 100)}%
            </p>
          )}
        </L>

        <div>
          <Toggle
            on={mentorOn}
            onChange={setMentorOn}
            label="한 시간 알려드려요"
            desc="빌리는 분이 원하면 사장님이 한 시간 같이 있어 주는 상품이에요. 따로 값을 받아요."
          />
          {mentorOn && (
            <div className="mt-4">
              <L label="그 한 시간 값" htmlFor="sp-mp">
                <WonInput id="sp-mp" value={mentorPrice} onChange={setMentorPrice} placeholder="예) 50,000" />
              </L>
            </div>
          )}
        </div>
      </Group>

      {/* ── 비는 날 ── 실사에서 이 데이터를 가진 곳이 23곳 중 0곳이었다(설계 §조사 ②). */}
      <Group title="어느 날 빌려주실 수 있나요" sub="여러 달을 넘기며 골라도 돼요. 다시 누르면 빠져요.">
        <OpenDatesCalendar value={openDates} onChange={setOpenDates} />
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
          {/* 체크하는 «순간» 알려준다. 제출 버튼까지 가서 알려주면 그 사이에 적은 것이 다 헛일이 된다. */}
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
        {(err || blocked) && (
          // 서버가 돌려준 말이 있으면 그것을, 없으면 지금 막고 있는 이유를. 둘이 같이 뜨면 잔소리가 된다.
          <p className={`mb-4 text-[15px] leading-relaxed break-keep ${err ? "text-danger" : "text-faint"}`}>
            {err || blocked}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || uploading || servesFood || !!blocked}
          className={`${primaryBtnCls} h-[52px] w-full`}
        >
          {pending
            ? "올리는 중이에요…"
            : uploading
              ? "사진을 올리는 중이에요…"
              : editing
                ? "고친 내용 올리기"
                : "올리기"}
        </button>
        <p className="mt-3 text-center text-[15px] leading-relaxed break-keep text-faint">
          {editing ? "고치면 한 번 더 읽어보고 다시 공개해 드려요." : "올려 주시면 한 번 읽어보고 공개해 드려요."}
        </p>
      </div>
    </div>
  );
}

/** 금액 칸 — 표시는 `50,000`, 상태는 숫자. 오른쪽에 「원」.
 *  `type="number"`를 안 쓰는 이유 — 콤마를 못 넣고, 스크롤 휠에 값이 바뀌고, iOS 자판에 콤마가 없다. */
function WonInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative sm:max-w-[260px]">
      <input
        id={id}
        inputMode="numeric"
        className={`${rentInputCls} pr-11`}
        value={value > 0 ? value.toLocaleString("ko-KR") : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        placeholder={placeholder}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[16px] text-mute">
        원
      </span>
    </div>
  );
}

/** 켜고 끄는 스위치 — 켜지면 키위(선택 상태는 키위가 맞다). 줄 전체가 44px 터치 타깃. */
function Toggle({
  on,
  onChange,
  label,
  desc,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-start gap-3 text-left"
    >
      <span
        className={`relative mt-[2px] inline-block h-[28px] w-[48px] shrink-0 rounded-pill transition-colors ${
          on ? "bg-primary" : "bg-border-strong"
        }`}
      >
        <span
          className={`absolute top-[3px] h-[22px] w-[22px] rounded-pill bg-surface shadow-e1 transition-transform ${
            on ? "translate-x-[23px]" : "translate-x-[3px]"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[16px] font-medium leading-[28px] text-body">{label}</span>
        {desc && <span className="mt-1 block text-[15px] leading-relaxed break-keep text-faint">{desc}</span>}
      </span>
    </button>
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
