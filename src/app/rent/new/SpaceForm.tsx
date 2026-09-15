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
//   ② 비는 날 = 달력 격자(09-16에 시간대 달력 `OpenSlotsCalendar`로 바뀌었다)
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
import { PhotoGrid } from "@/app/register/PhotoGrid";
import type { Space, SpaceUseType, SpaceCategory, SpaceScope, OpenSlot, AccessHow } from "@/lib/types";
import { hoursBetween } from "@/lib/rent-time";
import { CATEGORY_OPTIONS, dateLabel, primaryBtnCls, RentSelect, rentInputCls, rentTextareaCls, secondaryBtnCls, won } from "../ui";
import { AddressField } from "./AddressField";
import { OpenSlotsCalendar } from "./OpenSlotsCalendar";

/** 사장님이 처음부터 다 적게 하지 않으려고 미리 깔아 두는 설비 후보.
 *  ⚠️여기 없는 게 훨씬 많다(가마·재봉틀·오븐·암실…). 그래서 **직접 적는 칸이 주고 칩은 보조**다 —
 *    목록을 관문으로 만들면 우리가 상상한 업종만 올라온다. */
/** 📂업종은 `../ui`의 `CATEGORY_OPTIONS` 한 벌을 쓴다 (2026-09-16).
 *  🩸여기 같은 목록을 따로 들고 있었는데, 목록 거르개도 업종 축으로 바뀌면서 **두 벌이 세 벌이 될 뻔했다.**
 *    고르개와 거르개가 다른 목록을 보면 올릴 수는 있는데 걸리지는 않는 업종이 생긴다. */

/** 📂빌려드리는 범위 — 값의 근거가 되는 축. 대표가 말한 네 경우가 여기 다 들어간다
 *  (카페 공간만 / 카페 + 머신 / 국밥집 화구까지 / 예쁜 식당을 라운지로). */
const SCOPES: [SpaceScope, string, string][] = [
  ["space_only", "공간만 빌려드려요", "장비는 안 쓰고 자리만 써요. 모임·촬영·라운지 대관 같은 것들이요."],
  ["with_gear", "공간과 장비까지", "커피 머신·화구·재봉틀을 쓰실 수 있어요. 내 식으로 하루를 돌려 보는 자리예요."],
  // 🔻09-16 대표 — 「가게 그대로」 제거. 간판·메뉴까지 넘기는 건 무신고 영업 문제가 정리돼야 열 수 있고,
  //   지금 단계에서 고르게 두면 사장님이 무심코 골랐다가 법에 걸린다. `SpaceScope` 타입엔 남겨 둔다.
];

/** 📨이용 안내 방식. 🚨내용(비밀번호 등)은 우리가 안 가진다 — 방식만 고른다(대표 09-16). */
const ACCESS_OPTIONS: [AccessHow, string][] = [
  ["sms", "문자로 미리 보내드려요"],
  ["onsite", "일정 전에 미리 만나서 알려드릴게요"],
  ["both", "둘 다 해요"],
];

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


/** 🔻09-16 공통 이용 시간(`TIMES`)이 없어졌다 — 시간대는 이제 날짜마다 붙고 그 목록은 `OpenSlotsCalendar`가 쥔다.
 *  ⏱커피챗 길이. 30분 단위, 최대 8시간(=하루). 대표 09-14. */
const MENTOR_CHOICES = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);

/** 90 → 「1시간 30분」. 분만 남으면 「30분」, 딱 떨어지면 「2시간」. */
function minutesLabel(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}분`;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}

/** 🔻09-14 폐기 — 한 시간 고정이 30분 단위 고르기로 바뀌었다. 아래 설명은 그때의 판단 기록.
 *  「알려드려요」 토글은 한 시간으로 고정한다. 분 단위 칸이 있던 09-13 폼에서 그 칸을 채운 값이
 *  전부 60이었고, 30분·90분 상품은 사장님도 값을 못 정했다. */

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
  defaultName = "",
  defaultPhone = "",
  defaultBrandSlug = "",
}: {
  myBrands: { slug: string; name: string }[];
  feeRate: number;
  /** 고치기 모드 — 기존 값. 없으면 새로 올리기. */
  initial?: Space;
  /** 가입할 때 적은 브랜드명. 새로 올릴 때 공간 이름 자리를 미리 채운다(대표 09-16). */
  defaultName?: string;
  /** 프로필 전화번호. 매장 전화 자리의 기본값이고 여기서 고칠 수 있다(대표 09-16). */
  defaultPhone?: string;
  /** 소개서가 하나라도 있으면 그걸 기본으로 연결한다. 없으면 그 칸 자체가 안 뜬다. */
  defaultBrandSlug?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  /** 🚨**한 번 눌러 보기 전엔 지적하지 않는다** (대표 09-16: *「엥 이건 뭐지 갑자기!」*).
   *  전엔 화면을 열자마자 「어떤 업종인지 골라 주세요」가 아래에 떠 있었다 — 아직 아무것도 안 했는데
   *  틀렸다는 말부터 듣는 셈이라, 대표가 그 줄을 보고 무슨 일이 난 줄 알았다.
   *  ⭐**막는 것과 지적하는 것은 다르다.** 버튼은 처음부터 잠가 두되(못 넘어가는 건 사실이니),
   *    이유는 누른 «뒤»에 말한다. 그때는 듣고 싶어서 누른 것이다. */
  const [tried, setTried] = useState(false);
  const editing = !!initial;

  // 🆕09-16 등록 항목 개편 — 대표가 아티팩트 「항목 판」에서 항목마다 남김·뺌·바꿈을 적어 준 결과다.
  //   🔻뺀 것: 한 줄 소개 · 동네 · 들어오는 법 · 이용 가능 시간 · 음식 여부 · 임대인 동의 체크
  //   🆕넣은 것: 업종/범위 · 시간당 값 · 최소 대여 시간 · 시간대 달력 · 커피챗 · 안내 방식 · 매장 전화 · 호스트 약관
  const [name, setName] = useState(initial?.name ?? defaultName);
  const [category, setCategory] = useState<SpaceCategory>(initial?.category ?? "");
  const [scope, setScope] = useState<SpaceScope>(initial?.scope ?? "space_only");
  const [body, setBody] = useState(initial?.body ?? "");
  const [photos, setPhotos] = useState<Photo[]>((initial?.photos ?? []).map((url) => ({ url })));
  const [addrBase, setAddrBase] = useState(() => splitAddress(initial?.address ?? "")[0]);
  const [addrDetail, setAddrDetail] = useState(() => splitAddress(initial?.address ?? "")[1]);
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? defaultPhone);
  const [accessHow, setAccessHow] = useState<AccessHow>(initial?.accessHow ?? "sms");
  // 🔻09-16 화면에서 안 묻는다(범위 축과 중복). 저장할 때 기존 값을 그대로 넘겨 옛 데이터를 지킨다.
  const useType: SpaceUseType = initial?.useType ?? "both";
  const [facilities, setFacilities] = useState<string[]>(initial?.facilities ?? []);
  const [facilitiesNote, setFacilitiesNote] = useState(initial?.facilitiesNote ?? "");
  const [facilityInput, setFacilityInput] = useState("");
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : "");
  const [rules, setRules] = useState(initial?.rules ?? "");
  const [ruleInput, setRuleInput] = useState("");
  const [priceHour, setPriceHour] = useState<number>(initial?.priceHour ?? 0);
  const [minHours, setMinHours] = useState(String(initial?.minHours || 2));
  const [chatOn, setChatOn] = useState(initial?.coffeeChat ?? false);
  /** 🔁09-14 한 시간 «고정»에서 **30분 단위 고르기**로(대표). 기본은 60분 — 제일 흔한 답을 미리 얹어 둔다. */
  const [chatMin, setChatMin] = useState(String(initial?.coffeeChatMinutes || 60));
  const [chatPrice, setChatPrice] = useState<number>(initial?.coffeeChatPrice ?? 0);
  const [chatTopics, setChatTopics] = useState(initial?.coffeeChatTopics ?? "");
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>(initial?.openSlots ?? []);
  const [termsOk, setTermsOk] = useState(!!initial?.hostTermsAt);
  const [brandSlug, setBrandSlug] = useState(initial?.brandSlug ?? defaultBrandSlug);

  // ⚠️`payout()`을 import하지 않고 식을 옮겨 적었다 — 그 함수는 `lib/spaces.ts`에 있고, 그 파일은
  //   supabase 클라이언트를 끌고 온다. 클라이언트 번들에 데이터 계층 한 벌이 통째로 실린다.
  //   ⭐대신 **요율은 서버에서 받는다**(props). 바뀔 수 있는 값이 한 군데에만 있으면 어긋날 자리가 없다.
  // 🔢시간당 값으로 바뀌면서 정산액도 «한 시간치»로 보여 준다(대표 09-16).
  const payoutNum = Math.floor(priceHour * (1 - feeRate));
  const uploading = photos.some((p) => p.uploading);
  const readyPhotos = photos.filter((p) => !p.uploading && p.url);

  // 🔻09-16 「동네」 칸이 통째로 없어졌다(대표: 「주소면 충분」). 주소 찾기는 주소만 채운다.
  const onPickAddress = useCallback((base: string) => setAddrBase(base), []);


  /** 저장은 그대로 «줄바꿈 문자열»이다(DB·상세 화면을 안 건드린다). 화면에서만 목록으로 다룬다. */
  const ruleList = rules.split(/\n+/).map((r) => r.trim()).filter(Boolean);
  const addRule = () => {
    const v = ruleInput.trim();
    if (!v || ruleList.includes(v)) {
      setRuleInput("");
      return;
    }
    setRules([...ruleList, v].join("\n"));
    setRuleInput("");
  };

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

  /** 격자 안에서 자리 바꾸기(끌기 · ← →). 첫 장이 대표 사진이라 순서가 곧 정보다. */
  const movePhoto = (from: number, to: number) =>
    setPhotos((p) => {
      if (to < 0 || to >= p.length || from === to) return p;
      const next = [...p];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });

  // 화면에서 먼저 막는 이유는 왕복을 아끼려는 것이지 이게 관문이라서가 아니다 — 관문은 늘 서버다.
  const blocker = (): string => {
    if (!name.trim()) return "공간 이름을 적어 주세요.";
    if (!category) return "어떤 업종인지 골라 주세요.";
    if (readyPhotos.length === 0) return "사진을 한 장 이상 올려 주세요. 사진 없는 공간은 아무도 안 빌려요.";
    if (!addrBase.trim()) return "주소를 찾아 주세요.";
    if (!contactPhone.trim()) return "매장 전화번호를 적어 주세요.";
    if (rules.trim().length < 10) return "사용 시 유의 사항을 열 글자 이상 적어 주세요.";
    if (priceHour <= 0) return "시간당 대여 비용을 적어 주세요.";
    if (openSlots.length === 0) return "빌려줄 수 있는 날과 시간을 하나 이상 정해 주세요.";
    const badSlot = openSlots.find((sl) => hoursBetween(sl.start, sl.end) < Number(minHours));
    if (badSlot) return `${dateLabel(badSlot.date)}은 최소 ${minHours}시간을 못 채워요. 시간을 늘리거나 그날을 빼 주세요.`;
    if (chatOn && chatPrice <= 0) return "커피챗 비용을 적어 주세요.";
    if (!termsOk) return "공간 제공자 약관에 동의해 주세요.";
    return "";
  };
  const blocked = blocker();

  const submit = () =>
    start(async () => {
      setErr("");
      setTried(true);
      if (blocked) {
        setErr(blocked);
        return;
      }
      const address = [addrBase.trim(), addrDetail.trim()].filter(Boolean).join(", ");
      const r = await saveSpaceAction({
        slug: initial?.slug,
        name,
        body,
        photos: readyPhotos.map((p) => p.url),
        address,
        category,
        scope,
        useType,
        facilities,
        facilitiesNote,
        capacity: capacity ? Number(capacity) : undefined,
        rules,
        priceHour,
        minHours: Number(minHours) || 1,
        openSlots,
        coffeeChat: chatOn,
        coffeeChatMinutes: chatOn ? Number(chatMin) : 0,
        coffeeChatPrice: chatOn ? chatPrice : 0,
        coffeeChatTopics: chatOn ? chatTopics : "",
        accessHow,
        contactPhone,
        hostTermsOk: termsOk,
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
        {/* 🔻09-16 「한 줄로 말하면」을 빼고 그 자리에 **업종**을 넣었다(대표) — 검색하고 거를 수 있어야 한다.
            ⭐**두 축**으로 가른 이유는 조합이 폭발해서다. 카페 공간만 / 카페 + 머신 / 국밥집 화구까지 /
              예쁜 식당을 라운지로… 를 한 목록으로 만들면 끝이 없는데, 업종 × 범위면 두 칸으로 끝난다. */}
        <L label="업종" htmlFor="sp-category">
          <RentSelect id="sp-category" value={category} onChange={(e) => setCategory(e.target.value as SpaceCategory)}>
            <option value="">고르지 않음</option>
            {CATEGORY_OPTIONS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </RentSelect>
        </L>
        <L label="어디까지 빌려드릴까요" hint="값을 정하는 근거가 돼요. 신청하는 분도 이걸 보고 고릅니다.">
          <div role="radiogroup" aria-label="빌려드리는 범위" className="space-y-2">
            {SCOPES.map(([v, t, d]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={scope === v}
                onClick={() => setScope(v)}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors ${
                  scope === v ? "border-primary-tint bg-primary-pale" : "border-hairline bg-surface hover:bg-surface-soft"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${
                    scope === v ? "border-primary-on" : "border-border-strong"
                  }`}
                >
                  {scope === v && <span className="size-[8px] rounded-full bg-primary-on" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium text-ink">{t}</span>
                  <span className="mt-0.5 block text-[14px] leading-snug break-keep text-mute">{d}</span>
                </span>
              </button>
            ))}
          </div>
        </L>
        <L
          label="공간 소개"
          htmlFor="sp-body"
          hint="자세히 남겨 주실수록 신청하는 분이 마음을 정하기 쉬워요. 빈칸이면 저희가 같이 써 드릴게요."
        >
          <textarea
            id="sp-body"
            rows={5}
            className={`${rentTextareaCls} resize-y`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="어떤 사람들이 여기서 무엇을 했는지, 어떤 날에 제일 예쁜지 같은 이야기를 적어 주세요."
          />
        </L>
        <L label="사진" hint="한 장 이상 올려 주세요. 첫 장이 대표 사진이 돼요.">
          {/* 🔁09-16 소개서 사진 격자(`register/PhotoGrid`)를 그대로 쓴다 — 대표: *「전반적으로 AI가 빠르게 만든
              티가 남, 특히 입력폼」*에서 마지막까지 남아 있던 칸이 여기였다(브라우저 기본 「파일 선택」 버튼).
              ⭐한 사이트에서 사진을 올리는 자리는 한 얼굴이어야 한다. 점선 ＋ 타일(드롭존 어피던스는 점선 예외),
                끌어서 순서 바꾸기, 폰용 ← → 버튼, 「대표」 배지, 올리는 중 ✕ — 소개서에서 이미 검증된 것들이다.
              ⚠️`sources`는 안 넘긴다 — 공간 사진에 출처 표시는 없다. 안 넘기면 그 버튼은 아예 안 생긴다. */}
          <PhotoGrid
            items={photos}
            max={10}
            addLabel="사진(필수)"
            onAdd={(files) => void pickPhotos(files)}
            onRemove={(i) => setPhotos((prev) => prev.filter((_, j) => j !== i))}
            onReorder={movePhoto}
          />
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
        {/* 🔻09-14 「동네」 칸 삭제 — 대표: *「주소를 필수로 하고, 동네 섹션 삭제해도 될 거 같아」*.
            ⭐주소를 받으면 동네는 «거기서 나온다». 같은 것을 두 번 묻는 칸이었고, 둘이 어긋나면
              어느 쪽이 맞는지 아무도 모른다. 이제 `area`는 주소에서 뽑아 조용히 채운다. */}
        {/* ☎️09-16 신설. 🚨**빈칸으로 못 넘어간다** — 전자상거래법 제20조②(시행 2026-07-21)는
            중개자가 사업자 호스트의 성명·주소·전화번호를 확인해 **신청 «전»에** 손님에게 보여 주도록 한다.
            안 하면 제20조의2②로 우리가 연대 책임을 진다. 프로필 번호를 미리 채우고 여기서 고칠 수 있다. */}
        <L
          label="매장 전화번호"
          htmlFor="sp-phone"
          hint="법에 따라 신청 전에 손님께 보여드려요. 사장님 개인 번호는 예약이 확정된 뒤에만 열립니다."
        >
          <input
            id="sp-phone"
            type="tel"
            inputMode="tel"
            className={rentInputCls}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="예) 02-1234-5678"
          />
        </L>

        {/* 🔻09-16 「들어오는 법」 칸 삭제. 대표: *「비밀번호 이런 건 문자나 현장에서 당일에 안내하는 걸로」*.
            ⭐**우리는 그 내용을 안 가진다.** 담을 칸이 없으면 샐 일도 없다 — 방식만 고른다. */}
        <L label="이용 안내는 어떻게 해드릴까요" hint="예약이 확정된 분께 사장님이 직접 전하시는 방법이에요. 출입 비밀번호 같은 건 collab5가 갖고 있지 않아요.">
          <div className="flex flex-wrap gap-2">
            {ACCESS_OPTIONS.map(([v, t]) => (
              <button
                key={v}
                type="button"
                aria-pressed={accessHow === v}
                onClick={() => setAccessHow(v)}
                className={`inline-flex h-[44px] items-center rounded-pill border px-4 text-[15px] transition-colors ${
                  accessHow === v
                    ? "border-primary-tint bg-primary-tint font-medium text-primary-on"
                    : "border-border-strong bg-surface text-body hover:bg-surface-soft"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </L>
      </Group>

      {/* ── 어떻게 쓰나 ── */}
      <Group title="공간 안내">
        {/* 🔻09-16 대표 — 「쓰임새」(원래 목적대로 / 대관) 칸 삭제. *「위에 대관, 대관+시설이 있는 거 같아
            이건 제거해도 될 듯, 중복처럼 보여」*. 맞다 — 09-16에 만든 «범위» 축이 같은 것을 더 정확히 말한다.
            ⚠️`useType`은 DB와 타입에 남아 있고 저장할 때 기존 값을 그대로 넘긴다(옛 데이터가 안 깨지게). */}
        <L label="쓸 수 있는 시설" optional hint="빌리는 분이 이걸 보고 고르세요. 누르면 담겨요.">
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

        {/* 📝줄글 = **읽는 것**. 대표 09-14: *「줄글은 시설 안내, multi text input으로 등록할 때 등록하게」*.
            ⭐태그로는 「빔프로젝터 있음」까지만 말할 수 있고 「HDMI 케이블은 없어서 가져오셔야 해요」는
              여기라야 한다. 둘은 대체재가 아니라 층이 다르다. */}
        <L
          label="시설 안내"
          htmlFor="sp-facnote"
          optional
          hint="태그로 못 담는 말을 적어 주세요. 쓰는 법, 조심할 것, 없는 것 같은 것들이요."
        >
          <textarea
            id="sp-facnote"
            className={`${rentTextareaCls} min-h-[110px]`}
            value={facilitiesNote}
            onChange={(e) => setFacilitiesNote(e.target.value)}
            placeholder="예) 빔프로젝터는 있는데 HDMI 케이블은 없어요. 음향은 블루투스로 연결하시면 돼요."
          />
        </L>

        <L label="최대 몇 명까지 수용이 가능한가요?" htmlFor="sp-cap" optional>
          {/* 🔁09-14 대표 — *「숫자 input으로 바꾸고 input 옆에 「명」으로 default로 넣어주라」*.
              단위를 칸 «안»에 박는다. 밖에 두면 좁은 화면에서 줄이 바뀌어 떨어진다(신청 폼과 같은 처리). */}
          <div className="relative w-[200px]">
            <input
              id="sp-cap"
              type="number"
              inputMode="numeric"
              min={1}
              className={`${rentInputCls} pr-11`}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="숫자를 입력해주세요"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[16px] text-mute"
            >
              명
            </span>
          </div>
        </L>

        {/* 🔻09-16 「이용 가능 시간」(공간 전체에 한 줄) 삭제.
            ⭐시간 단위로 바뀌면서 **날마다 다른 시간**을 열 수 있어야 한다 — 그건 아래 「어느 날·몇 시」
              달력이 맡는다. 한 줄짜리 공통 시간은 날마다 다른 가게를 표현하지 못했다. */}
      </Group>

      {/* ── 사용 유의 사항 ── ⭐이 서비스에서 제일 중요한 칸.
           🔁09-14 대표 — 제목 「우리 집 규칙」 → **「사용 유의 사항」**(중간에 「공간 사용 규칙」을 거쳐 확정),
             설명은 「공간 사용시 유의 사항을 적어주세요.」로. */}
      <Group title="사용 유의 사항" sub="공간 사용시 유의 사항을 적어주세요.">
        {/* 🔁09-14 여러 줄 textarea → **한 줄 입력 + 담기**(대표: *「한 줄에 하나씩 말고 하나 쓰고 우측에
            입력 버튼, 추가하면 하단에 +규칙 추가 이런 식으로」*).
            ⭐줄바꿈으로 나누라는 건 «규칙»이 아니라 «약속»이었다 — 지키는 사람이 없으면 한 덩어리로 저장되고
              상세 화면의 번호 매기기가 통째로 무너진다. 한 줄씩 담게 하면 그 약속이 필요 없어진다.
            🔗저장 형식은 그대로 줄바꿈 문자열이다(상세 화면·DB를 안 건드린다). 바뀐 건 넣는 방법뿐. */}
        <div>
          <div className="flex gap-2">
            <input
              id="sp-rules"
              className={`${rentInputCls} min-w-0`}
              value={ruleInput}
              onChange={(e) => setRuleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // 폼 제출로 새지 않게 막는다 — 이 화면의 제출은 맨 아래 버튼 하나뿐이다.
                  e.preventDefault();
                  addRule();
                }
              }}
              placeholder="예) 신발은 벗고 들어와 주세요"
              aria-label="사용 유의 사항"
            />
            <button type="button" onClick={addRule} className={`${secondaryBtnCls} h-[48px] shrink-0`}>
              담기
            </button>
          </div>

          {/* 담은 것 — 번호를 붙인다. 상세 화면에서도 번호로 보이니 넣을 때부터 같은 모양이어야
              「몇 개를 적었나」가 여기서 이미 읽힌다. */}
          {ruleList.length > 0 && (
            <ol className="mt-3 space-y-2">
              {ruleList.map((r, i) => (
                <li
                  key={`${r}-${i}`}
                  className="flex items-start gap-2.5 rounded-md bg-surface-soft px-4 py-3"
                >
                  <span className="shrink-0 pt-[2px] text-[15px] font-medium tabular-nums text-mute">{i + 1}.</span>
                  <span className="min-w-0 flex-1 text-[16px] leading-relaxed break-keep text-ink">{r}</span>
                  <button
                    type="button"
                    onClick={() => setRules(ruleList.filter((_, j) => j !== i).join("\n"))}
                    aria-label={`${i + 1}번 지우기`}
                    className="-my-2 -mr-2 flex size-[44px] shrink-0 items-center justify-center text-[17px] text-faint transition-colors hover:text-danger"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}

          {/* 예시 — 누르면 그대로 담긴다. 읽고 자기 말로 옮겨 적게 하는 것보다 빈칸으로 넘어갈 확률이 낮다. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {RULE_EXAMPLES.filter((ex) => !ruleList.includes(ex)).map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setRules([...ruleList, ex].join("\n"))}
                className="inline-flex min-h-[44px] items-center rounded-pill bg-surface-soft px-4 py-2 text-left text-[15px] leading-snug break-keep text-body transition-colors hover:bg-primary-pale"
              >
                + {ex}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[15px] text-faint">
            {rules.trim().length < 10
              ? "열 글자 이상 적어 주셔야 올릴 수 있어요."
              : `${ruleList.length}가지 적으셨어요.`}
          </p>
        </div>
      </Group>

      {/* ── 값 ── */}
      <Group title="얼마에 빌려주실까요">
        {/* 🔁09-16 하루 값 → **시간당 값**(대표). 사장님마다 열 수 있는 시간이 다르고, 빌리는 쪽도
            하루 통째보다 「오후 세 시간」이 현실적이다. 눈금은 1시간 — 30분은 가게가 그렇게 생각하지 않고
            달력·요금·겹침이 두 배로 복잡해진다. 그 대신 «최소 대여 시간»이 30분의 필요를 덮는다. */}
        <L
          label="대여 비용"
          htmlFor="sp-price"
          hint="한 시간에 얼마를 받으실지 적어 주세요. 대여하시는 분은 1시간 단위로 선택할 수 있어요."
        >
          <WonInput id="sp-price" value={priceHour} onChange={setPriceHour} placeholder="예) 15,000" />
          {/* ⭐정직하게 적는다. 「수수료 15%」만 적어 두면 사장님은 손에 쥐는 금액을 직접 계산해야 하고,
              그 계산을 화면이 안 해 주면 첫 정산 때 「듣던 것과 다르다」가 된다. */}
          {/* 💰09-16 대표 — *「수수료는 여기에만 쓰면 잘 못 본 것 같기도 한데, 상단에 좀 더 써 주면 어떨까」*.
              ⭐값을 적는 «그 순간»이 수수료를 알아야 하는 순간이다. 맨 아래 약관 줄에만 있으면
                값을 다 정하고 나서야 본다. 금액을 안 적었을 때도 요율은 먼저 말해 둔다. */}
          {priceHour > 0 ? (
            <p className="mt-2 text-[15px] text-mute">
              수수료 {Math.round(feeRate * 100)}%를 뺀{" "}
              <span className="font-medium text-ink">{won(payoutNum)}</span>이 한 시간마다 사장님께 가요.
            </p>
          ) : (
            <p className="mt-2 text-[15px] text-faint">
              성사된 금액에서 수수료 {Math.round(feeRate * 100)}%를 뺀 나머지를 사장님께 드려요.
            </p>
          )}
        </L>

        <L label="최소 몇 시간부터 빌려드릴까요" htmlFor="sp-minh" hint="이보다 짧게는 신청이 안 들어와요.">
          <RentSelect id="sp-minh" className="sm:max-w-[240px]" value={minHours} onChange={(e) => setMinHours(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 8].map((h) => (
              <option key={h} value={String(h)}>
                {h}시간부터
              </option>
            ))}
          </RentSelect>
        </L>

        {/* ☕09-16 「알려주기 여부」 → **커피챗**(대표). 이름이 무슨 말인지 안 통했고, 파는 물건도 애매했다.
            ⭐대표 정리: *「선배한테 현업 이야기 듣기, 현업을 들여다보기 같은 자리를 부가 상품으로」*.
              레시피나 비법이 아니다 — 하루가 어떻게 돌아가는지, 재료는 어디서 떼는지, 언제 몰리고 언제 비는지.
              사장님이 안 내놓을 것은 빼고도 들려줄 수 있고, 창업을 생각하는 사람에겐 그쪽이 값어치다.
            🔻설비 사용법 같은 «필수» 안내는 여기 없다. 그건 상품이 아니라 인수인계라 위 「안내 방식」이 맡는다. */}
        <div>
          <p className="text-[16px] font-medium leading-[28px] text-body">
            커피챗(유료)
          </p>
          <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">
            레시피나 비법이 아니라, 현업에서의 하루가 어떻게 돌아가는지를 들려주실 수 있나요? 현업 진출을 고민하시는
            분들을 위해 제공하실 내용이 있다면 골라 주세요.
          </p>

          {/* 아니요가 먼저이자 기본 — 대부분의 사장님에게 「안 해도 된다」가 먼저 보여야 부담이 없다. */}
          <div role="radiogroup" aria-label="커피챗 제공 여부" className="mt-3 flex gap-2">
            {[
              { v: false, label: "아니요" },
              { v: true, label: "예" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                role="radio"
                aria-checked={chatOn === o.v}
                onClick={() => setChatOn(o.v)}
                className={`inline-flex h-[44px] min-w-[88px] items-center justify-center rounded-pill px-5 text-[15px] font-medium transition-colors ${
                  chatOn === o.v
                    ? "bg-primary-tint text-primary-on"
                    : "border-[0.5px] border-[#DFDFE3] bg-surface text-body hover:bg-surface-soft"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {chatOn && (
            <div className="mt-5 space-y-6">
              <L label="얼마나 이야기 나누실까요" htmlFor="sp-cm">
                <RentSelect
                  id="sp-cm"
                  className="sm:max-w-[240px]"
                  value={chatMin}
                  onChange={(e) => setChatMin(e.target.value)}
                >
                  {MENTOR_CHOICES.map((m) => (
                    <option key={m} value={m}>
                      {minutesLabel(m)}
                    </option>
                  ))}
                </RentSelect>
              </L>
              <L label="커피챗 비용" htmlFor="sp-cp">
                <WonInput id="sp-cp" value={chatPrice} onChange={setChatPrice} placeholder="예) 20,000" />
              </L>
              <L
                label="어떤 이야기를 들려주실 수 있나요"
                htmlFor="sp-ct"
                optional
                hint="적어 두시면 신청하는 분이 무엇을 사는지 알고 고릅니다."
              >
                <textarea
                  id="sp-ct"
                  rows={4}
                  className={`${rentTextareaCls} resize-y`}
                  value={chatTopics}
                  onChange={(e) => setChatTopics(e.target.value)}
                  placeholder={"예) 재료를 어디서 얼마에 떼는지\n손님이 몰리는 시간과 비는 시간\n처음 1년에 제일 크게 틀렸던 것"}
                />
              </L>
            </div>
          )}
        </div>
      </Group>

      {/* ── 여는 날·시간 ── 실사에서 이 데이터를 가진 곳이 23곳 중 0곳이었다(설계 §조사 ②). */}
      <Group
        title="대여 가능한 날짜 선택"
        sub="요일마다 여는 시간을 정하고 달력에서 날짜를 누르세요. 대여하시는 분에게 선택한 날짜가 노출됩니다."
      >
        <OpenSlotsCalendar value={openSlots} onChange={setOpenSlots} minHours={Number(minHours) || 1} />
      </Group>

      {/* ── 확인 ── */}
      <Group title="마지막으로 확인할게요">
        {/* 🔻09-16 대표 — 음식 여부·임대인 동의 «체크박스» 둘 다 삭제.
            ⭐전대 확인은 없앤 게 아니라 **약관 한 줄로 옮겼다.** 체크박스는 읽지 않고 누르지만
              약관은 동의 시각이 남아 계약의 근거가 된다(약관규제법 제3조③④).
            ⚖️조사(09-16)로 확인한 것 — 아워플레이스·에어비앤비 둘 다 호스트 편을 따로 두고,
              우리 기존 약관엔 호스트 의무가 한 줄도 없었다. 수수료·정산·구상을 주장할 근거가 없었다. */}
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-[3px] size-[18px] shrink-0 accent-primary"
              checked={termsOk}
              onChange={(e) => setTermsOk(e.target.checked)}
            />
            <span className="min-w-0 text-[16px] leading-relaxed break-keep text-body">
              <a href="/terms/host" target="_blank" rel="noreferrer" className="underline underline-offset-4">
                공간 제공자 약관
              </a>
              에 동의해요
            </span>
          </label>
          <p className="text-[15px] leading-relaxed break-keep text-mute">
            내 소유이거나 임대인 동의를 받았다는 것, 수수료 {Math.round(feeRate * 100)}%와 정산 방법,
            환불 규정이 담겨 있어요. 신청하는 분께는 매장 이름·주소·전화번호가 신청 전에 보입니다.
          </p>
        </div>

        {myBrands.length > 0 && (
          <L label="소개서 붙이기" htmlFor="sp-brand" optional hint="이름만 보여드려요. 연락처는 안 나가요.">
            <RentSelect
              id="sp-brand"
              value={brandSlug}
              onChange={(e) => setBrandSlug(e.target.value)}
            >
              <option value="">안 붙일래요</option>
              {myBrands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </RentSelect>
          </L>
        )}
      </Group>

      <div>
        {(err || (tried && blocked)) && (
          // 서버가 돌려준 말이 있으면 그것을, 없으면 지금 막고 있는 이유를. 둘이 같이 뜨면 잔소리가 된다.
          <p className={`mb-4 text-[15px] leading-relaxed break-keep ${err ? "text-danger" : "text-faint"}`}>
            {err || blocked}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || uploading}
          className={`${primaryBtnCls} h-[52px] w-full`}
        >
          {pending
            ? "올리는 중이에요…"
            : uploading
              ? "사진을 올리는 중이에요…"
              : editing
                ? "고친 내용 올리기"
                : "등록하기"}
        </button>
        <p className="mt-3 text-center text-[15px] leading-relaxed break-keep text-faint">
          {editing
            ? "주소나 매장 이름을 고치신 경우에만 다시 한 번 읽어봐요. 나머지는 바로 반영됩니다."
            : "등록 요청하시면 collab5 검토 후 승인이 완료되는 대로 하루 가게에 노출이 시작돼요."}
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
