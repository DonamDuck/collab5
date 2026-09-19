"use client";

// 하루 팝업 — 공간 올리기·고치기 폼 (2026-09-13 · 09-14 재작업)
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
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSpaceAction } from "@/lib/rent-actions";
import { uploadBizCert, uploadPhoto } from "@/lib/upload";
import { PhotoGrid } from "@/app/register/PhotoGrid";
import type { Space, SpaceUseType, SpaceCategory, OpenSlot, AccessHow, RepeatRule, BizCertFields, BizCertRead } from "@/lib/types";
import { durationLabel, expandRepeat, minutesBetween, RENT_MIN_MINUTES, stripRepeat, todayKst } from "@/lib/rent-time";
import { payoutAmount } from "@/lib/rent-money";
import { coffeeChatFree } from "@/lib/rent-products";
import { CONTACT_PHONE_MAX, storePhoneOk } from "@/lib/rent-limits";
import {
  addressMoved,
  BIZ_CERT_MAX_BYTES, BIZ_CERT_TYPES, BIZ_MISMATCH_LINE, bizCertPathOk, bizDigits, bizNumberProblem, formatBizNumber, fromOpenDate,
  hasAnyBiz, needsBizInfo, openDateProblem, spaceListed, testBizHint, toOpenDate,
} from "@/lib/bizcheck";
import { pausedChangeProblem, spaceSaveReview } from "@/lib/rent-review";
import {
  COFFEE_CHAT_FREE, COFFEE_CHAT_WHEN_HOST, HOST_REQUEST_STEPS, hostFeeLine, PRODUCT_HINT_HOST, PRODUCT_LABEL, PRODUCT_NOTE_PLACEHOLDER, withJosa,
} from "@/lib/rent-copy";
import { CATEGORY_OPTIONS, dateLabel, primaryBtnCls, RentSelect, rentInputCls, rentTextareaCls, secondaryBtnCls, won } from "../ui";
import { AddressField } from "./AddressField";
import { OpenSlotsCalendar } from "./OpenSlotsCalendar";

/** 사장님이 처음부터 다 적게 하지 않으려고 미리 깔아 두는 설비 후보.
 *  ⚠️여기 없는 게 훨씬 많다(가마·재봉틀·오븐·암실…). 그래서 **직접 적는 칸이 주고 칩은 보조**다 —
 *    목록을 관문으로 만들면 우리가 상상한 업종만 올라온다. */
/** 📂업종은 `../ui`의 `CATEGORY_OPTIONS` 한 벌을 쓴다 (2026-09-16).
 *  🩸여기 같은 목록을 따로 들고 있었는데, 목록 거르개도 업종 축으로 바뀌면서 **두 벌이 세 벌이 될 뻔했다.**
 *    고르개와 거르개가 다른 목록을 보면 올릴 수는 있는데 걸리지는 않는 업종이 생긴다. */

/** 🔻09-18 「어디까지 빌려드릴까요」(범위 라디오 `SCOPES`)를 지웠다 — 「무엇을 파실까요」의 상품 카드 셋이 맡는다.
 *  대표: 「대관만, 공간 전체(대관·시설), 커피챗 이렇게 3개 상품을 설정할 수 있게 하고 가격도 각각」.
 *  ⭐범위는 «하나를 고르는» 축이었고 상품은 «여럿을 켜는» 축이다. 카페 사장님은 자리만도, 머신까지도 팔 수 있다.
 *  옛 `scope`는 DB에 남고 서버가 켠 상품에서 호환 값을 만든다(`compatScopePrice`). */

/** 📨이용 안내 방식. 🚨내용(비밀번호 등)은 우리가 안 가진다 — 방식만 고른다(대표 09-16). */
const ACCESS_OPTIONS: [AccessHow, string][] = [
  // 🔁09-18 대표 코멘트 — 「문자나 전화로 보내드릴게요」·「둘 다 진행할게요」. 값(`sms`)은 그대로, 말만 넓혔다.
  ["sms", "문자나 전화로 보내 드릴게요"],
  // 🔁09-19 대표 코멘트 #77 — 만나야 한다는 걸 손님이 미리 알게 「(방문 필요)」를 붙였다(맞춤법: 「알려 드리고」).
  ["onsite", "일정 전에 미리 만나서 알려 드리고 싶어요 (방문 필요)"],
  ["both", "둘 다 진행할게요"],
];

/** 🔁09-19 대표 코멘트 #78·#79 — 싱크대를 둘째, 테이블·의자를 셋째로(자주 고르는 것이 앞). */
const FACILITY_HINTS = [
  "와이파이", "싱크대", "테이블·의자", "주차", "엘리베이터", "화장실", "냉난방",
  "빔프로젝터", "음향", "조명", "창고", "작업대",
];

/** 규칙 칸 예시 — 설계가 「예시를 여러 개 보여 준다」를 명시한 자리다.
 *  ⭐넷 다 **다른 종류**를 고른 게 핵심이다(예의 / 설비 다루기 / 이웃 / 뒷정리).
 *    비슷한 예시만 주면 사장님이 그 한 종류만 적는다. */
const RULE_EXAMPLES = [
  "신발은 벗고 들어와 주세요",
  "재봉틀은 제가 먼저 알려드린 뒤에 써 주세요",
  "밤 10시 이후 음악은 꺼 주세요",
  "쓰신 그릇은 설거지까지 부탁드려요",
  // ⏱09-18 대표 코멘트 — 시간을 넘길 때의 추가 비용을 사장님이 미리 적게 한다. 안 적혀 있으면 그날 현장에서 다툰다.
  "예약한 시간을 넘기면 30분마다 추가 비용이 있어요",
];


/** 🔻09-16 공통 이용 시간(`TIMES`)이 없어졌다 — 시간대는 이제 날짜마다 붙고 그 목록은 `OpenSlotsCalendar`가 쥔다.
 *  ⏱커피챗 길이. 30분 단위(대표 09-14 · 09-17 결정 1).
 *  🔁09-17 QA — 30분~8시간 열여섯 개였다. 커피챗을 8시간 하는 사장님은 없고, 폰에선 목록이 길어 스크롤해야 했다.
 *    두 시간까지로 줄였다. ⚠️그보다 길게 저장해 둔 옛 공간은 그 값을 목록에 덧붙여 보여 준다(`chatChoices`) —
 *    목록에 없으면 select가 첫 값(30분)을 보여 줘서, 안 고쳤는데 고친 것처럼 저장된다. */
const MENTOR_CHOICES = [30, 60, 90, 120];

/** 90 → 「1시간 30분」. 분만 남으면 「30분」, 딱 떨어지면 「2시간」.
 *  🔁09-19 길이 표시는 `rent-time`의 `durationLabel` 한 벌로 합쳤다(신청 폼·메일과 같은 글). */
const minutesLabel = durationLabel;

/** 🔻09-19 대표 코멘트 #88 — 「최소 몇 시간부터 빌려드릴까요」 고르개(`MIN_HOUR_CHOICES`, 30분 눈금 1~8시간)를 지웠다.
 *  대표: 「하단 달력 하위에 대여 시간을 선택할 거니까 그걸로 대체하되 대여 시간의 최소 범위는 1시간 이상으로」.
 *  모든 공간이 1시간이다(`RENT_MIN_MINUTES`). 달력의 요일·날짜별 시간이 그 대신이다. */

/** 🔻09-14 폐기 — 한 시간 고정이 30분 단위 고르기로 바뀌었다. 아래 설명은 그때의 판단 기록.
 *  「알려드려요」 토글은 한 시간으로 고정한다. 분 단위 칸이 있던 09-13 폼에서 그 칸을 채운 값이
 *  전부 60이었고, 30분·90분 상품은 사장님도 값을 못 정했다. */

/** 저장된 주소 `"서울 중구 을지로 100, 2층"` → 도로명 / 상세. 첫 쉼표에서 가른다 —
 *  우편번호 서비스가 주는 도로명 주소엔 쉼표가 없고, 상세는 우리가 쉼표로 붙였다. */
function splitAddress(s: string): [string, string] {
  const i = s.indexOf(", ");
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i + 2)];
}

/** 다 올라간 사진 주소만. 올라가는 중인 자리(빈 주소)는 초안에 안 담는다. */
const readyPhotosOf = (ps: Photo[]) => ps.filter((p) => !p.uploading && p.url).map((p) => p.url);

/** 고르는 pill — 고른 것은 키위 틴트, 아닌 것은 흰 면 + hairline. 44px 터치 타깃. */
const pickCls = (on: boolean) =>
  `inline-flex h-[44px] items-center rounded-pill px-4 text-[15px] font-medium transition-colors ${
    on ? "bg-primary-tint text-primary-on" : "border border-hairline bg-surface text-body hover:bg-surface-soft"
  }`;

type Photo = { url: string; uploading?: boolean };

/** 🧾등록증 글자 읽기가 채우는 네 칸(09-20). 주소는 따로 — 자동으로 안 넣고 버튼으로만 쓴다. */
const CERT_FILL_KEYS = ["bizName", "bizNumber", "bizOwnerName", "bizOpenDate"] as const;
type CertFillKey = (typeof CERT_FILL_KEYS)[number];

/** 등록증의 사업장 소재지 → 폼의 두 칸(도로명 · 층·호). 끝의 참고항목 「(성수동2가)」는 떼고, 쉼표 뒤는 상세 주소로. */
function certAddressParts(addr: string): [string, string] {
  return splitAddress(addr.replace(/\s*\([^()]*\)\s*$/, "").trim());
}

// 💾새로 올리기 임시 저장 (2026-09-17 대표 「오늘 다 구현」)
//   칸이 스무 개 가까이라 한 번에 못 끝내는 사장님이 많다. 나갔다 오면 처음부터였다.
//   ⭐새로 올리기에서만 한다. 고치기는 이미 DB에 있고, 낡은 초안을 얹으면 저장된 값을 되돌린다.
//   🔑키에 사용자 id를 넣는다. 안 넣으면 같은 기기에서 다른 계정으로 들어온 사람에게 남의 초안이 뜬다.
//   ✋약관 동의는 안 담는다. 다시 눌러야 동의다.
// 🔁09-18 v2 — 범위(`scope`)·시간당 값 하나(`priceHour`)가 상품 두 벌로 바뀌었다. v1 초안은 읽을 때 옮긴다(`draftFromV1`).
const DRAFT_VERSION = 2;
const DRAFT_DEBOUNCE_MS = 700;
const draftKeyOf = (uid: number) => `collab5:rent-new-draft:u${uid}`;

interface SpaceDraft {
  name: string; category: SpaceCategory; body: string; photos: string[];
  addrBase: string; addrDetail: string; contactPhone: string; accessHow: AccessHow;
  facilities: string[]; facilitiesNote: string; capacity: string; rules: string;
  spaceOn: boolean; spacePrice: number; spaceNote: string;
  fullOn: boolean; fullPrice: number; fullNote: string;
  chatOn: boolean; chatMin: string; chatPrice: number; chatTopics: string;
  /** ☕무료 커피챗(09-19 #93). 옛 초안엔 없는 칸이라 빈 모습(`false`)으로 메워진다. */
  chatFree: boolean;
  openSlots: OpenSlot[]; repeatWeekly: RepeatRule[];
  brandOn: boolean; brandPick: string;
  /** 🧾09-18 사업자 정보. 개업일은 날짜 칸 모양(`YYYY-MM-DD`)으로 담는다. 등록증은 올린 경로(파일 자체가 아니다). */
  bizNumber: string; bizOwnerName: string; bizOpenDate: string; bizCertPath: string;
}

export function SpaceForm({
  myBrands,
  feeRate,
  initial,
  defaultName = "",
  defaultPhone = "",
  defaultBrandSlug = "",
  userId,
  noEmail = false,
  mySpaceCount = 0,
  certPrefill,
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
  /** 💾새로 올리기 임시 저장의 키. 고치기 모드에선 안 넘긴다(넘겨도 `initial`이 있으면 안 쓴다). */
  userId?: number;
  /** 📮가입 이메일이 없는 계정인가(09-18 밤 QA H-11). 요청 알림이 이메일로만 나가서, 이대로 올리면 못 받는다. */
  noEmail?: boolean;
  /** 🏠이미 올린 공간 수(09-18 밤 QA H-16). 새로 올리기 폼에서만 쓴다. */
  mySpaceCount?: number;
  /** 🧾등록증을 읽어 사업자 칸 값을 돌려주는 함수(09-19 대표 #110 → 09-20 「OCR 가로 고고」). 올리기 페이지와 고치기 페이지가
   *  `readBizCertAction`을 그대로 넘긴다. 등록증을 올린 직후 «올린 경로»로 부르고, 돌려준 값으로 «비어 있는 칸만» 채운다(`fillEmptyBiz`). */
  certPrefill?: (path: string) => Promise<BizCertRead>;
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
  // 🛍09-18 상품 셋. 고치기면 저장된 상품을 그대로(SQL 전 옛 공간은 `toSpace`가 옛 범위에서 만들어 준다).
  const [spaceOn, setSpaceOn] = useState(initial?.rentSpaceOn ?? false);
  const [spacePrice, setSpacePrice] = useState<number>(initial?.rentSpacePrice ?? 0);
  const [spaceNote, setSpaceNote] = useState(initial?.rentSpaceNote ?? "");
  const [fullOn, setFullOn] = useState(initial?.rentFullOn ?? false);
  const [fullPrice, setFullPrice] = useState<number>(initial?.rentFullPrice ?? 0);
  const [fullNote, setFullNote] = useState(initial?.rentFullNote ?? "");
  const [chatOn, setChatOn] = useState(initial?.coffeeChat ?? false);
  /** 🔁09-14 한 시간 «고정»에서 **30분 단위 고르기**로(대표). 기본은 60분 — 제일 흔한 답을 미리 얹어 둔다. */
  const [chatMin, setChatMin] = useState(String(initial?.coffeeChatMinutes || 60));
  const [chatPrice, setChatPrice] = useState<number>(initial?.coffeeChatPrice ?? 0);
  /** ☕「무료로 제공할게요」(대표 09-19 #93). 저장 칸을 따로 두지 않는다 — 켜진 커피챗의 값 0이 곧 무료다(`coffeeChatFree`).
   *  켜 두는 동안 적어 둔 값(`chatPrice`)은 그대로 둔다. 끄면 원래 값이 돌아온다. 보낼 때만 0으로 보낸다. */
  const [chatFree, setChatFree] = useState(initial ? coffeeChatFree(initial) : false);
  const [chatTopics, setChatTopics] = useState(initial?.coffeeChatTopics ?? "");
  // 🔁09-17 — `initial.openSlots`는 규칙을 펼친 값이다(`toSpace`). 폼은 «직접 연 날»만 들고 규칙은 따로 든다.
  //   펼친 날을 직접 연 날로 받아 두면, 규칙을 꺼도 그 날들이 직접 연 날로 남아 저장된다.
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>(() =>
    initial ? stripRepeat(initial.openSlots, initial.repeatWeekly ?? []) : [],
  );
  const [repeatWeekly, setRepeatWeekly] = useState<RepeatRule[]>(initial?.repeatWeekly ?? []);
  const [termsOk, setTermsOk] = useState(!!initial?.hostTermsAt);
  // 📎소개서 보여주기 토글(대표 09-16). 끄면 저장값은 빈 문자열이지만 고른 소개서는 기억해 둬서, 다시 켜면 그대로 돌아온다.
  const [brandOn, setBrandOn] = useState(initial ? !!initial.brandSlug : !!defaultBrandSlug);
  const [brandPick, setBrandPick] = useState(initial?.brandSlug || defaultBrandSlug || myBrands[0]?.slug || "");
  const brandSlug = brandOn ? brandPick : "";

  // ─── 🧾사업자 정보 (09-18 대표: 공간 등록에 사업자 확인 필수) ───
  //   규칙은 서버와 같은 함수(`lib/bizcheck`)다. 화면이 먼저 막는 건 왕복을 아끼려는 것이고 관문은 `saveSpaceAction`이다.
  const [bizNumber, setBizNumber] = useState(initial?.bizNumber ?? "");
  /** 🏷09-19 대표 [J] 상호 — 판매자 정보 화면에 그대로 나간다. 새 공간(초안 포함)은 필수, 옛 공간은 선택(서버와 같은 판정).
   *  임시 저장엔 안 담는다. 사업자 칸 셋과 같이 매번 새로 적는다(H-34와 같은 칸 묶음). */
  const [bizName, setBizName] = useState(initial?.bizName ?? "");
  const bizNameNeeded = !initial || initial.status === "draft";
  const [bizOwnerName, setBizOwnerName] = useState(initial?.bizOwnerName ?? "");
  /** 날짜 칸 모양 `YYYY-MM-DD`. 보낼 때 국세청 모양 `YYYYMMDD`로 바꾼다. */
  const [bizOpenDate, setBizOpenDate] = useState(fromOpenDate(initial?.bizOpenDate ?? ""));
  const [bizCertPath, setBizCertPath] = useState(initial?.bizCertPath ?? "");
  const [certName, setCertName] = useState("");
  const [certUploading, setCertUploading] = useState(false);
  const [certErr, setCertErr] = useState("");
  /** 🧾등록증 읽기(09-20) — reading 읽는 중 · filled 빈 칸을 채움 · none 못 읽음(「직접 적어 주세요」) · "" 아무 말 안 함. */
  const [certRead, setCertRead] = useState<"" | "reading" | "filled" | "none">("");
  /** 등록증에서 읽은 사업장 주소. 공간 주소 칸이 비어 있을 때만 「등록증 주소로 채우기」로 제안한다. */
  const [certAddr, setCertAddr] = useState("");
  /** 파일을 연달아 바꾸면 앞 파일의 답이 늦게 와서 뒤 파일의 칸을 채울 수 있다. 마지막 파일의 답만 받는다. */
  const certSeq = useRef(0);
  /** 서버가 사업자 칸에 돌려준 말(국세청 기록과 다름·휴업·폐업)과 «그때의 세 칸». 칸을 고치면 말이 내려간다.
   *  고치기 화면을 국세청 불일치 공간으로 열면 처음부터 그 말이 서 있다(새로 올리다 불일치면 저장 뒤 이 화면으로 온다). */
  const bizKey = `${bizDigits(bizNumber)}|${bizOwnerName.trim()}|${bizOpenDate}`;
  const [bizServer, setBizServer] = useState<{ msg: string; key: string } | null>(() =>
    initial?.bizCheckStatus === "mismatch"
      ? { msg: BIZ_MISMATCH_LINE, key: `${initial.bizNumber}|${initial.bizOwnerName.trim()}|${fromOpenDate(initial.bizOpenDate)}` }
      : null,
  );
  const bizServerMsg = bizServer && bizServer.key === bizKey ? bizServer.msg : "";
  /** 넷 다 필수인가 — 서버(`saveSpaceAction`)와 «같은 함수»(`needsBizInfo`)로 판정한다(대표 09-19 오후: 화면과 서버가 같은 규칙).
   *  🩸09-19 오후까지 여기는 따로 적은 식이라 두 갈래가 빠져 있었다. 초안(서버는 필수)과 옛 공간이 이름·주소를 바꿀 때(서버는 필수)
   *    화면은 통과시키고 서버가 막았다. 사장님은 다 적은 줄 알고 눌렀다가 서버 말을 보게 된다. */
  const bizNeeded = needsBizInfo(initial ?? null, {
    name, address: [addrBase.trim(), addrDetail.trim()].filter(Boolean).join(", "),
    bizNumber, bizOwnerName, bizOpenDate, bizCertPath,
  });
  /** 저장 뒤 사업자 칸만 남았을 때의 한 줄(나머지는 저장됐다는 것). */
  const [savedNote, setSavedNote] = useState("");

  // 🔁09-18 밤 QA(H-09) — 이름이나 주소를 바꾸면 이 공간이 «다시 검토»로 내려가 목록에서 빠진다(`saveSpaceAction`).
  //   그런데 그 사실은 폼 맨 아래 버튼 밑에 «늘 같은 문장»으로 서 있었다. 늘 떠 있는 문장은 안 읽힌다.
  //   ⭐값이 실제로 바뀐 그 칸 옆에서, 바뀐 순간에만 말한다. 버튼 이름도 그때만 바꿔서 누르기 전에 한 번 더 보이게.
  //   ⚠️검토로 내려가는 조건은 `saveSpaceAction`이 정본이다. 여기 두 줄은 그 규칙을 화면에서 미리 비추는 것뿐이다.
  const addressNow = [addrBase.trim(), addrDetail.trim()].filter(Boolean).join(", ");
  const renamedNow = !!initial && initial.name.trim() !== name.trim();
  const movedNow = addressMoved(initial ?? null, addressNow);
  /** 🧾09-19 저녁 — 저장하면 어느 상태로 가나. 서버(`saveSpaceAction`)와 같은 함수(`spaceSaveReview`)다.
   *  번호가 비어 있던 공간이 처음 채우면 이름·주소가 그대로여도 한 번 더 읽는다(`biz-first`). */
  const reviewNow = spaceSaveReview(initial ?? null, { name, address: addressNow, bizNumber: bizDigits(bizNumber) });
  const reviewAgain = renamedNow || movedNow || (!!initial && initial.status !== "draft" && reviewNow.why === "biz-first");
  /** 🔁09-19 저녁 보완 요청을 받은 공간을 고치는 중인가 — 버튼 이름이 「고쳐서 다시 보내기」가 된다. */
  const fixing = reviewNow.why === "resubmit";
  /** ⏸쉬는 중엔 못 하는 저장(이름·주소 바꾸기, 번호 처음 채우기). 서버와 같은 함수라 문장도 같다. */
  const pausedLine = pausedChangeProblem(initial ?? null, { name, address: addressNow, bizNumber: bizDigits(bizNumber) });
  /** 지금 손님에게 보이는 공간인가 — 그럴 때만 「목록에서 잠시 빠져요」가 참이다.
   *  🚪09-19 오후 — 사업자등록번호가 빈 공간은 공개 중이어도 목록에 없다(`spaceListed`). */
  const listedNow = !!initial && spaceListed(initial);

  // ─── 💾임시 저장 (새로 올리기만) ───
  const draftKey = !initial && userId ? draftKeyOf(userId) : null;
  /** 아무것도 안 쓴 첫 모습. 지금 폼이 이것과 같으면 초안을 안 남긴다(열어만 봤는데 「불러왔어요」가 뜨면 이상하다). */
  const [blank] = useState<SpaceDraft>(() => ({
    name: defaultName, category: "", body: "", photos: [],
    addrBase: "", addrDetail: "", contactPhone: defaultPhone, accessHow: "sms",
    facilities: [], facilitiesNote: "", capacity: "", rules: "",
    spaceOn: false, spacePrice: 0, spaceNote: "", fullOn: false, fullPrice: 0, fullNote: "",
    chatOn: false, chatMin: "60", chatPrice: 0, chatTopics: "", chatFree: false,
    openSlots: [], repeatWeekly: [],
    brandOn: !!defaultBrandSlug, brandPick: defaultBrandSlug || myBrands[0]?.slug || "",
    bizNumber: "", bizOwnerName: "", bizOpenDate: "", bizCertPath: "",
  }));
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [restored, setRestored] = useState(false);
  /** 저장이 끝난 뒤엔 초안을 다시 쓰지 않는다 — 떠나기 직전에 남은 타이머가 지운 초안을 되살린다. */
  const draftDone = useRef(false);

  const applyDraft = (d: SpaceDraft) => {
    setName(d.name); setCategory(d.category); setBody(d.body);
    setPhotos(d.photos.map((url) => ({ url })));
    setAddrBase(d.addrBase); setAddrDetail(d.addrDetail); setContactPhone(d.contactPhone); setAccessHow(d.accessHow);
    setFacilities(d.facilities); setFacilitiesNote(d.facilitiesNote); setCapacity(d.capacity); setRules(d.rules);
    setSpaceOn(!!d.spaceOn); setSpacePrice(Number(d.spacePrice) || 0); setSpaceNote(d.spaceNote ?? "");
    setFullOn(!!d.fullOn); setFullPrice(Number(d.fullPrice) || 0); setFullNote(d.fullNote ?? "");
    setChatOn(d.chatOn); setChatMin(d.chatMin); setChatPrice(d.chatPrice); setChatTopics(d.chatTopics); setChatFree(!!d.chatFree);
    setOpenSlots(d.openSlots); setRepeatWeekly(d.repeatWeekly);
    setBrandOn(d.brandOn);
    // 그새 소개서를 지웠으면 옛 slug를 붙들지 않는다.
    setBrandPick(myBrands.some((b) => b.slug === d.brandPick) ? d.brandPick : blank.brandPick);
    setBizNumber(d.bizNumber); setBizOwnerName(d.bizOwnerName); setBizOpenDate(d.bizOpenDate); setBizCertPath(d.bizCertPath);
    setCertName(""); setCertErr(""); setCertRead(""); setCertAddr("");
  };

  // 열 때 한 번 읽는다. ⚠️useState 초기값에서 읽으면 서버 렌더와 모양이 달라 하이드레이션이 깨진다.
  //   그래서 effect 안에서 값을 얹는다 — 브라우저 저장소는 «바깥 시스템»이라 이 규칙의 예외 자리다(`register/page.tsx`와 같은 처리).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      const env = raw ? (JSON.parse(raw) as { v?: number; data?: Partial<SpaceDraft> & DraftV1Extra }) : null;
      if ((env?.v === DRAFT_VERSION || env?.v === 1) && env.data && typeof env.data === "object") {
        // 모양이 어긋난 칸은 빈 모습으로 메운다. 초안 하나 때문에 폼이 안 뜨면 안 된다.
        const d = { ...blank, ...(env.v === 1 ? draftFromV1(env.data) : env.data) } as SpaceDraft;
        if (!Array.isArray(d.photos)) d.photos = [];
        d.photos = d.photos.filter((u) => typeof u === "string" && /^https?:\/\//.test(u));
        if (!Array.isArray(d.facilities)) d.facilities = [];
        if (!Array.isArray(d.openSlots)) d.openSlots = [];
        if (!Array.isArray(d.repeatWeekly)) d.repeatWeekly = [];
        // 🧾사업자 칸 — 모양이 틀리면 비운다. 등록증 경로는 «이 계정 폴더»일 때만 되살린다(같은 기기의 다른 계정 초안이 섞이지 않게).
        // 🔒09-18 밤 QA(H-34) — 이제 안 담는 칸이다. 09-18 전에 남은 초안이 있으면 여기서 버린다.
        d.bizNumber = "";
        d.bizOwnerName = "";
        d.bizOpenDate = "";
        d.bizCertPath = typeof d.bizCertPath === "string" && userId && bizCertPathOk(d.bizCertPath, userId) ? d.bizCertPath : "";
        applyDraft(d);
        setRestored(true);
      }
    } catch {
      /* 저장소를 못 쓰는 브라우저(시크릿·정책)거나 깨진 값 — 없는 것으로 친다 */
    }
    setDraftLoaded(true);
    // 여는 순간 한 번만. 의존성을 채우면 입력마다 초안을 다시 얹는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const draftSnap: SpaceDraft = {
    // 주소가 http(s)인 사진만. 저장소 없는 로컬에선 사진이 data URL로 와서 한 장이 저장소 한도를 넘긴다.
    name, category, body, photos: readyPhotosOf(photos).filter((u) => /^https?:\/\//.test(u)),
    addrBase, addrDetail, contactPhone, accessHow,
    facilities, facilitiesNote, capacity, rules,
    spaceOn, spacePrice, spaceNote, fullOn, fullPrice, fullNote,
    chatOn, chatMin, chatPrice, chatTopics, chatFree,
    openSlots, repeatWeekly,
    brandOn, brandPick,
    // 🔒09-18 밤 QA(H-34) — 사업자등록번호·대표자 이름·개업일을 브라우저 저장소에 남기지 않는다.
    //   가게 컴퓨터는 대개 공용이고, 이 셋이 모이면 국세청 조회가 그대로 되는 신원 한 벌이다.
    //   ⭐임시 저장은 «다시 쓰기 귀찮은 것»을 위한 것이지 신원을 맡아 두는 곳이 아니다. 세 칸은 매번 새로 적는다.
    //   ⚠️등록증 «경로»는 남긴다 — 파일 자체가 아니고, 읽을 때 이 계정 폴더인지 다시 본다(`bizCertPathOk`).
    bizNumber: "", bizOwnerName: "", bizOpenDate: "", bizCertPath,
  };
  const draftJson = JSON.stringify(draftSnap);
  useEffect(() => {
    if (!draftKey || !draftLoaded || draftDone.current) return;
    const tm = setTimeout(() => {
      if (draftDone.current) return;
      try {
        if (draftJson === JSON.stringify(blank)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ v: DRAFT_VERSION, savedAt: new Date().toISOString(), data: JSON.parse(draftJson) }));
      } catch {
        /* 용량이 넘치거나 저장소가 막혔다 — 임시 저장은 못 해도 쓰는 건 막지 않는다 */
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(tm);
  }, [draftKey, draftLoaded, draftJson, blank]);

  const clearDraft = () => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* 지울 수 없으면 지울 것도 못 읽은 것이다 */
    }
  };
  /** 「처음부터 쓰기」 — 초안을 지우고 폼을 첫 모습으로. */
  const startOver = () => {
    clearDraft();
    applyDraft(blank);
    setTermsOk(false);
    setTried(false);
    setErr("");
    setRestored(false);
  };

  // ⚠️`payout()`(`lib/spaces.ts`)을 import하지 않는다 — 그 파일은 supabase 클라이언트를 끌고 와서
  //   클라이언트 번들에 데이터 계층 한 벌이 통째로 실린다.
  //   ⭐대신 **요율은 서버에서 받는다**(props). 바뀔 수 있는 값이 한 군데에만 있으면 어긋날 자리가 없다.
  // 🔢시간당 값으로 바뀌면서 정산액도 «한 시간치»로 보여 준다(대표 09-16). 09-18부터 상품마다 따로.
  // 🔢09-18 밤 QA(SEC-03) — 식을 옮겨 적던 것을 `payout()`과 같은 정수 계산 함수(`rent-money`)로 바꿨다. 그 파일은 DB를 안 부른다.
  const payoutOf = (price: number) => payoutAmount(price, feeRate);
  const uploading = photos.some((p) => p.uploading) || certUploading;
  const readyPhotos = photos.filter((p) => !p.uploading && p.url);

  // 🔻09-16 「동네」 칸이 통째로 없어졌다(대표: 「주소면 충분」). 주소 찾기는 주소만 채운다.
  const onPickAddress = useCallback((base: string) => setAddrBase(base), []);


  /** 저장은 그대로 «줄바꿈 문자열»이다(DB·상세 화면을 안 건드린다). 화면에서만 목록으로 다룬다. */
  const ruleList = rules.split(/\n+/).map((r) => r.trim()).filter(Boolean);
  /** 담기 전 칸의 글 → 줄 목록에 더한 결과. 🔁09-19 대표 #84 — 칸이 여러 줄 입력이 되면서 한 번에 두 줄 이상이 올 수 있다.
   *  저장 형식이 «줄바꿈 = 한 항목»이라 줄마다 한 항목으로 나눠 담는다(목록을 붙여 넣어도 그대로 번호가 붙는다). 같은 줄은 한 번만. */
  const withTyped = (list: string[], typed: string) => {
    const out = [...list];
    for (const line of typed.split(/\n+/).map((r) => r.trim()).filter(Boolean)) if (!out.includes(line)) out.push(line);
    return out;
  };
  const addRule = () => {
    setRules(withTyped(ruleList, ruleInput).join("\n"));
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

  /** 🧾등록증에서 읽은 값으로 «빈 칸만» 채운다(09-19 #110 자리 → 09-20 연결). 사장님이 이미 적은 값을 덮으면
   *  읽기 오류가 그대로 국세청 조회로 가고, 사장님은 자기가 적은 값이 바뀐 줄 모른다. 개업일은 `YYYYMMDD`로 받는다.
   *  돌려주는 건 «실제로 채운» 칸. 비었는지는 지금 화면 값(`bizNow`)으로 보고, 쓰기는 그래도 갱신 함수로 한 번 더 지킨다. */
  //   ⚠️렌더 중엔 ref를 못 쓴다(react-hooks/refs). 그림이 끝난 뒤 옮겨 둔다 — 읽기 답은 늘 그보다 늦게 온다.
  const bizNow = useRef({ bizName, bizNumber, bizOwnerName, bizOpenDate });
  useEffect(() => {
    bizNow.current = { bizName, bizNumber, bizOwnerName, bizOpenDate };
  }, [bizName, bizNumber, bizOwnerName, bizOpenDate]);
  const fillEmptyBiz = (v: BizCertFields): CertFillKey[] => {
    const now = bizNow.current;
    const filled: CertFillKey[] = [];
    if (v.bizName?.trim() && !now.bizName.trim()) {
      setBizName((cur) => cur.trim() ? cur : v.bizName!.trim());
      filled.push("bizName");
    }
    if (v.bizNumber && !bizDigits(now.bizNumber)) {
      setBizNumber((cur) => bizDigits(cur) ? cur : bizDigits(v.bizNumber!).slice(0, 10));
      filled.push("bizNumber");
    }
    if (v.bizOwnerName?.trim() && !now.bizOwnerName.trim()) {
      setBizOwnerName((cur) => cur.trim() ? cur : v.bizOwnerName!.trim());
      filled.push("bizOwnerName");
    }
    if (v.bizOpenDate && fromOpenDate(v.bizOpenDate) && !now.bizOpenDate) {
      setBizOpenDate((cur) => cur || fromOpenDate(v.bizOpenDate!));
      filled.push("bizOpenDate");
    }
    return filled;
  };

  /** 등록증 주소로 채우기 — 누를 때만. 층·호 칸은 비어 있을 때만 채운다. */
  const fillCertAddress = () => {
    const [base, detail] = certAddressParts(certAddr);
    if (!base) return;
    setAddrBase(base);
    if (detail) setAddrDetail((cur) => cur.trim() ? cur : detail);
  };

  /** 🧾사업자등록증 한 장. 형식은 파일의 MIME으로 보고, 비어 오면(일부 브라우저의 HEIC) 확장자로 보충한다. */
  const pickCert = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ""; // 같은 파일을 다시 골라도 onChange가 돌게
    if (!file) return;
    setCertErr("");
    // 새 파일을 고르면 앞 파일에서 읽은 말·주소 제안은 내린다(그 파일의 이야기라서).
    const seq = ++certSeq.current;
    setCertRead("");
    setCertAddr("");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = file.type || ({ heic: "image/heic", heif: "image/heif", pdf: "application/pdf" } as Record<string, string>)[ext] || "";
    if (!BIZ_CERT_TYPES[mime]) return setCertErr("사진(JPG·PNG·HEIC)이나 PDF 파일로 올려 주세요.");
    if (file.size > BIZ_CERT_MAX_BYTES) return setCertErr("10MB가 넘는 파일은 못 올려요. 사진으로 찍어 올려 주셔도 돼요.");
    setCertUploading(true);
    let path = "";
    try {
      path = await uploadBizCert(file, mime);
      setBizCertPath(path);
      setCertName(file.name);
    } catch (e) {
      setCertErr(e instanceof Error && e.message ? e.message : "파일을 올리지 못했어요. 다시 골라 주세요.");
      return;
    } finally {
      setCertUploading(false);
    }
    // 🧾등록증 → 사업자 칸 미리 채우기(09-19 #110 → 09-20 대표 「OCR 가로 고고」). 올리기는 이미 끝났다 —
    //   읽기가 실패해도 파일은 그대로고, 사장님은 한 줄(「직접 적어 주세요」)만 본다. 제출도 막지 않는다.
    if (!certPrefill) return;
    setCertRead("reading");
    let read: BizCertRead;
    try {
      read = await certPrefill(path);
    } catch {
      read = { ok: false, reason: "error" };
    }
    if (seq !== certSeq.current) return; // 그새 다른 파일을 골랐다
    const readAny = read.ok && CERT_FILL_KEYS.some((k) => read.ok && read.fields[k]);
    if (!read.ok || !readAny) {
      setCertRead("none");
      return;
    }
    const filled = fillEmptyBiz(read.fields);
    setCertRead(filled.length > 0 ? "filled" : "");
    setCertAddr(read.fields.bizAddress ?? "");
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
  // 📍09-17 QA — 이유와 함께 **어느 칸인지**(`f-<칸>`)를 돌려준다. 위쪽 칸이 비어도 말은 맨 아래 버튼 위에만 떠서
  //   스크롤을 올려 찾아야 했다. 누르면 그 칸으로 올라가고 칸 바로 밑에도 같은 말을 적는다.
  // 📝09-18 밤 QA(H-14) — 막힘 검사도 «보낼 값»으로 한다. 칸에 적어만 두고 [담기]를 안 누른 유의 사항은
  //   제출 직전에 합쳐지는데(아래 `submit`), 검사가 합치기 «전» 값을 보면 다 적은 사장님에게 「열 글자 넘게 담아 주세요」가 뜬다.
  const blocker = (rulesV: string = rules): [string, string] | null => {
    if (!name.trim()) return ["name", "검색에 노출할 공간명을 적어 주세요."];
    if (!category) return ["category", "공간 타입을 골라 주세요."];
    if (readyPhotos.length === 0) return ["photos", "사진을 한 장 이상 올려 주세요. 사진 없는 공간은 아무도 안 빌려요."];
    if (!addrBase.trim()) return ["address", "주소를 찾아 주세요."];
    if (!contactPhone.trim()) return ["phone", "전화번호가 비어 있어요."];
    // ✂️09-18 밤 QA(SEC-07) — 서버(`saveSpaceAction`)와 같은 함수. 숫자만 세어 전화번호 모양인지 본다.
    if (!storePhoneOk(contactPhone)) return ["phone", "전화번호를 다시 봐 주세요. 예) 02-1234-5678"];
    if (rulesV.trim().length < 10) return ["rules", "유의 사항을 열 글자 넘게 담아 주셔야 올릴 수 있어요."];
    // 🛍09-18 — 공간 상품 하나 이상, 켠 상품은 값과 설명. 서버(`saveSpaceAction`)가 같은 규칙으로 다시 본다.
    if (!spaceOn && !fullOn) return ["products", `파실 상품을 하나는 켜 주세요. ${PRODUCT_LABEL.space}이나 ${PRODUCT_LABEL.full} 중에서요.`];
    if (spaceOn && spacePrice <= 0) return ["spacePrice", "한 시간 값이 비어 있어요."];
    if (spaceOn && spaceNote.trim().length < 10) return ["spaceNote", "손님이 무엇을 쓰고 할 수 있는지 열 글자는 넘게 담아 주세요."];
    if (fullOn && fullPrice <= 0) return ["fullPrice", "한 시간 값이 비어 있어요."];
    if (fullOn && fullNote.trim().length < 10) return ["fullNote", "어떤 시설까지 쓰는지 조금 더 적어 주세요. 열 글자면 돼요."];
    // 🔁09-18 밤 QA(H-21) — 커피챗 값 검사가 달력 «뒤»에 있었다. 화면에선 커피챗이 「무엇을 파실까요」 절 안이고
    //   달력은 그다음 절이라, 둘 다 비면 화면을 지나쳐 내려갔다가 다시 올라오게 된다. 막는 순서는 화면 순서여야 한다.
    // ☕09-19 대표 #93 — 「무료로 제공할게요」를 고르면 값이 없어도 된다(서버도 같은 규칙).
    if (chatOn && !chatFree && chatPrice <= 0) return ["chatPrice", "커피챗 값이 비어 있어요. 무료로 하시려면 「무료로 제공할게요」를 눌러 주세요."];
    // 🔁09-17 — 매주 계속 여는 요일이 있으면 그걸로 하루 이상이 찬다. 시간 검사도 규칙이 연 날까지 본다.
    if (openSlots.length === 0 && repeatWeekly.length === 0) return ["slots", "빌려줄 날을 달력에서 하루 이상 골라 주세요."];
    const expanded = expandRepeat(openSlots, repeatWeekly);
    // 🩸09-18 밤 QA(H-20) — 닫는 시각을 여는 시각보다 앞에 두면 「최소 2시간을 못 채워요」가 떴다. 시간을 늘리라는 말인데
    //   늘릴 데가 없다(거꾸로라 길이가 음수다). 서버(`saveSpaceAction`)는 이미 「거꾸로예요」라고 말한다 — 화면도 같은 말로.
    const reversed = expanded.find((sl) => minutesBetween(sl.start, sl.end) <= 0);
    if (reversed) return ["slots", `${dateLabel(reversed.date)}은 끝나는 시각이 여는 시각보다 앞이에요. 두 시각을 바꿔 주세요.`];
    // ⏱🔒모든 공간 1시간(09-19 #88). 서버(`saveSpaceAction`)와 같은 상수.
    const badSlot = expanded.find((sl) => minutesBetween(sl.start, sl.end) < RENT_MIN_MINUTES);
    if (badSlot) return ["slots", `${dateLabel(badSlot.date)}은 최소 ${durationLabel(RENT_MIN_MINUTES)}을 못 채워요. 시간을 늘리거나 그날을 빼 주세요.`];
    // 🧾09-18 사업자 정보 — 폼 순서대로. 서버(`saveSpaceAction`)가 같은 함수로 다시 본다.
    //   🔁09-19 #110 등록증이 절 맨 위로 올라가서 막는 순서도 등록증 → 상호 → 번호 → 대표자 → 개업일(화면 순서, H-21과 같은 이유).
    if (bizNeeded && !bizCertPath) return ["bizCert", "사업자등록증 파일을 올려 주세요."];
    if (bizNameNeeded && !bizName.trim()) return ["bizName", "상호를 사업자등록증에 적힌 그대로 적어 주세요."];
    if (bizNeeded) {
      const numberProblem = bizNumberProblem(bizNumber);
      if (numberProblem) return ["bizNumber", numberProblem];
      if (!bizOwnerName.trim()) return ["bizOwner", "대표자 이름을 사업자등록증 그대로 적어 주세요."];
      const dateProblem = openDateProblem(toOpenDate(bizOpenDate), todayKst());
      if (dateProblem) return ["bizOpenDate", dateProblem];
    }
    if (pausedLine) return [pausedLine.field === "biz" ? "bizNumber" : pausedLine.field, pausedLine.message];
    if (!termsOk) return ["terms", "공간 제공자 약관에 동의해 주세요."];
    return null;
  };
  const blockedPair = blocker();
  const blocked = blockedPair?.[1] ?? "";
  /** 이 칸이 지금 막고 있는 칸이면 그 말을, 아니면 빈 문자열. 한 번 눌러 본 뒤에만 말한다(`tried`). */
  const fieldErr = (key: string) => (tried && !err && blockedPair?.[0] === key ? blockedPair[1] : "");

  /** 커피챗 길이 선택지 — 옛 저장값이 목록 밖이면 그 값도 끼워 준다(위 `MENTOR_CHOICES` 주석). */
  const chatChoices = MENTOR_CHOICES.includes(Number(chatMin))
    ? MENTOR_CHOICES
    : [...MENTOR_CHOICES, Number(chatMin)].sort((a, b) => a - b);

  const submit = () =>
    start(async () => {
      setErr("");
      setSavedNote("");
      setTried(true);

      // 📝09-18 밤 QA(H-14) — 유의 사항·설비 칸에 적어 두고 [담기]를 «안 누른» 글이 제출 때 말없이 사라졌다.
      //   사장님 눈엔 적어 둔 줄이 칸에 그대로 보이니 담긴 줄 안다. 저장하고 목록에 돌아와서야 빠진 걸 안다.
      //   ⭐[담기]는 «여러 줄을 나누는 방법»이지 관문이 아니다. 보내기 직전에 남은 한 줄을 같이 담는다.
      const leftoverRule = ruleInput.trim();
      const rulesFinal = withTyped(ruleList, leftoverRule).join("\n");
      const leftoverFacility = facilityInput.trim();
      const facilitiesFinal =
        leftoverFacility && !facilities.includes(leftoverFacility) ? [...facilities, leftoverFacility] : facilities;
      // 화면도 같이 바꿔 둔다 — 저장에만 담기고 칸에 남아 있으면 「또 담아야 하나」가 된다.
      if (rulesFinal !== rules) setRules(rulesFinal);
      if (leftoverRule) setRuleInput("");
      if (facilitiesFinal !== facilities) setFacilities(facilitiesFinal);
      if (leftoverFacility) setFacilityInput("");

      const bad = blocker(rulesFinal);
      if (bad) {
        // 빨간 말은 칸 밑에만 둔다(`fieldErr`). 버튼 위엔 같은 말이 옅은 글씨로 남아, 아래에서 다시 봐도 이유가 보인다.
        document.getElementById(`f-${bad[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        useType,
        facilities: facilitiesFinal,
        facilitiesNote,
        capacity: capacity ? Number(capacity) : undefined,
        rules: rulesFinal,
        rentSpaceOn: spaceOn,
        rentSpacePrice: spaceOn ? spacePrice : 0,
        rentSpaceNote: spaceOn ? spaceNote : "",
        rentFullOn: fullOn,
        rentFullPrice: fullOn ? fullPrice : 0,
        rentFullNote: fullOn ? fullNote : "",
        openSlots,
        repeatWeekly,
        coffeeChat: chatOn,
        coffeeChatMinutes: chatOn ? Number(chatMin) : 0,
        coffeeChatPrice: chatOn && !chatFree ? chatPrice : 0,
        coffeeChatFree: chatOn && chatFree,
        coffeeChatTopics: chatOn ? chatTopics : "",
        accessHow,
        contactPhone,
        hostTermsOk: termsOk,
        brandSlug,
        bizName: bizName.trim(),
        bizNumber: bizDigits(bizNumber),
        bizOwnerName: bizOwnerName.trim(),
        bizOpenDate: toOpenDate(bizOpenDate),
        bizCertPath,
      });
      const toBiz = () => document.getElementById("f-biz")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!r.ok) {
        // 🧾사업자 칸의 말(휴업·폐업 등)은 그 칸 밑에 둔다. 버튼 위엔 옅게 한 번 더(다른 칸의 막힘과 같은 처리).
        if (r.field === "biz") {
          setBizServer({ msg: r.message, key: bizKey });
          toBiz();
          return;
        }
        setErr(r.message);
        return;
      }
      // 💾올라갔으니 초안은 끝이다. 떠나기 전에 남은 타이머가 되살리지 않게 먼저 막는다.
      draftDone.current = true;
      clearDraft();
      // 🧾국세청 기록과 다름 — 저장은 됐다(관리자가 등록증과 같이 본다). 사장님은 사업자 칸만 고치면 되니 그 칸으로 보낸다.
      //   새로 올리기였으면 이제 행이 있으니 고치기 화면으로 간다. 여기 남아 다시 누르면 공간이 하나 더 생긴다.
      if (r.bizStatus === "mismatch" && r.slug) {
        if (!initial) {
          router.push(`/rent/${r.slug}/edit#f-biz`);
          return;
        }
        setBizServer({ msg: r.message, key: bizKey });
        setSavedNote("다른 내용은 저장해 뒀어요. 사업자 정보만 고쳐서 한 번 더 올려 주세요.");
        router.refresh();
        toBiz();
        return;
      }
      // 검토 대기라 `/rent/{slug}`는 아직 남에게 안 보인다. 자기 것이 어디 있는지 보이는 화면으로 보낸다.
      // 💬09-17 QA — 말없이 목록으로 떨어져서 「된 건가?」 했다. `saved`로 무슨 일이 났는지 한 줄 띄운다.
      //   ⚠️검토로 내려가는 조건은 `saveSpaceAction`과 같은 규칙이다(이름·주소가 바뀌면). 거기를 바꾸면 여기도.
      // 🧾09-19 저녁 — 서버와 같은 함수(`spaceSaveReview`)로 가른다. 초안은 올리면 검토로 가니 「올리셨어요」다.
      const rv = spaceSaveReview(initial ?? null, { name, address, bizNumber: bizDigits(bizNumber) });
      const saved = !initial || rv.why === "draft"
        ? "new"
        : rv.why === "resubmit"
          ? "fixed"
          : initial.status === "pending"
          ? "pending"
          : rv.why === "renamed" || rv.why === "moved"
            ? "review"
            : rv.why === "biz-first"
              ? "biz"
              : initial.status === "open"
                ? "ok"
                : "kept";
      router.push(`/rent/my?tab=host&saved=${saved}`);
      router.refresh();
    });

  // 설비 pill 한 벌 — 고른 것(직접 적은 것 포함)이 앞, 아직 안 고른 후보가 뒤. 같은 덩어리에 pill은 이 한 종류.
  const facilityPool = [...facilities, ...FACILITY_HINTS.filter((h) => !facilities.includes(h))];

  return (
    <div className="mt-10 space-y-12">
      <StepNav />
      {/* 📮09-18 밤 QA(H-11) — 요청 알림은 이메일로만 나간다. 소셜로 가입해 이메일이 없는 계정은 손님이 신청해도 모른다.
          ⚠️저장은 막지 않는다(대표 추천안) — 공급을 막을 만한 일이 아니고, 요청은 이 화면에서도 볼 수 있다. */}
      {noEmail && (
        <p className="rounded-md bg-lemon-pale px-4 py-3 text-[15px] leading-relaxed break-keep text-lemon-on">
          이 계정엔 이메일이 없어서 요청이 들어와도 알려 드릴 곳이 없어요. 올리신 뒤에는 내 하루 팝업에서 직접 확인해 주세요.
        </p>
      )}
      {/* 🏠09-18 밤 QA(H-16) — 공간 넷을 올린 사장님에게도 「내 공간 등록」이 빈 폼으로 열렸다. 고치러 온 분이
          모르고 올리면 같은 가게가 둘이 된다. 이미 올리신 것이 있으면 그리로 가는 길을 폼 머리에 둔다. */}
      {!editing && mySpaceCount > 0 && (
        <p className="text-[15px] leading-relaxed break-keep text-mute">
          이미 올리신 공간이 {mySpaceCount}곳 있어요.{" "}
          <Link href="/rent/my?tab=host" className="text-body underline underline-offset-2">
            내 하루 팝업에서 보기
          </Link>
        </p>
      )}
      {/* 💾09-17 — 불러온 걸 먼저 말한다. 모르고 이어 쓰다 옛 사진이 올라가면 안 된다. */}
      {restored && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface-soft px-4 py-2">
          <p className="min-w-0 flex-1 text-[15px] leading-relaxed break-keep text-body">쓰시던 내용을 불러왔어요.</p>
          <button
            type="button"
            onClick={startOver}
            className="h-[44px] shrink-0 text-[15px] text-mute underline underline-offset-2"
          >
            처음부터 쓰기
          </button>
        </div>
      )}
      {/* ── 어떤 공간인가 ── */}
      <Group title="어떤 공간인가요">
        {/* 🔁09-19 대표 코멘트 #106(#73을 대체) — 이 이름이 목록·검색에 그대로 걸린다는 걸 라벨에서 말한다. */}
        <L label="검색에 노출할 공간명을 작성해 주세요" htmlFor="sp-name" anchor="name" error={fieldErr("name")}>
          <input
            id="sp-name"
            className={rentInputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 을지로 2층 작업실"
          />
          {renamedNow && <ReviewAgainNote what="이름" listed={listedNow} />}
        </L>
        {/* 🔻09-16 「한 줄로 말하면」을 빼고 그 자리에 **업종**을 넣었다(대표) — 검색하고 거를 수 있어야 한다.
            ⭐**두 축**으로 가른 이유는 조합이 폭발해서다. 카페 공간만 / 카페 + 머신 / 국밥집 화구까지 /
              예쁜 식당을 라운지로… 를 한 목록으로 만들면 끝이 없는데, 업종 × 범위면 두 칸으로 끝난다.
            🔁09-18 범위 축은 아래 「무엇을 파실까요」의 상품 카드로 옮겼다. */}
        {/* 🔁09-17 QA — 빈 선택지가 「고르지 않음」이라 안 골라도 되는 칸처럼 보였다. 업종은 필수다(폼·서버 둘 다 막는다). */}
        {/* 🔁09-19 대표 코멘트 #74 — 「업종」 → 「공간 타입」. 값(`category`)과 목록 거르개는 그대로다. */}
        <L label="공간 타입" htmlFor="sp-category" anchor="category" error={fieldErr("category")}>
          <RentSelect id="sp-category" value={category} onChange={(e) => setCategory(e.target.value as SpaceCategory)}>
            <option value="" disabled>
              공간 타입을 골라 주세요
            </option>
            {CATEGORY_OPTIONS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </RentSelect>
        </L>
        <L
          label="공간 소개"
          htmlFor="sp-body"
          hint="자세히 남겨 주실수록 손님이 마음을 정하기 쉬워요."
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
        {/* 📸09-17 QA — 몇 장·어떤 사진이 좋은지 힌트가 없어 사장님은 예쁜 창가만 올렸다. 손님이 정할 때 보는 건 자리와 화장실이다. */}
        <L
          label="사진"
          anchor="photos"
          error={fieldErr("photos")}
          // 🔁09-19 대표 코멘트 #75 — 몇 장부터인지 끝에 붙였다(검사는 전부터 한 장 이상).
          hint="전경, 작업할 자리, 화장실 순으로 올려 두시면 손님이 고르기 쉬워요. 첫 장이 대표 사진이 돼요. (최소 1장)"
        >
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
          anchor="address"
          error={fieldErr("address")}
          // 🏠09-19 오후 대표 — 「주소는 사업자등록증과 비교할 수 있는 주소를 작성해 달라고 등록 폼에 넣자!」
          hint="사업자등록증에 적힌 사업장 주소와 같게 적어 주세요. 등록증과 대조해서 확인하고, 손님께는 지도와 함께 보여드려요."
        >
          <AddressField
            base={addrBase}
            detail={addrDetail}
            onPick={onPickAddress}
            onBase={setAddrBase}
            onDetail={setAddrDetail}
          />
          {/* 🔻09-19 저녁 대표 — 「주소를 바꾸면 등록증을 새로」 줄을 뺐다. 주소와 등록증은 관리자가 검토 화면에서 눈으로 견준다. */}
          {movedNow && <ReviewAgainNote what="주소" listed={listedNow} />}
        </L>
        {/* 🔻09-14 「동네」 칸 삭제 — 대표: *「주소를 필수로 하고, 동네 섹션 삭제해도 될 거 같아」*.
            ⭐주소를 받으면 동네는 «거기서 나온다». 같은 것을 두 번 묻는 칸이었고, 둘이 어긋나면
              어느 쪽이 맞는지 아무도 모른다. 이제 `area`는 주소에서 뽑아 조용히 채운다. */}
        {/* ☎️09-16 신설. 🚨**빈칸으로 못 넘어간다** — 전자상거래법 제20조②(시행 2026-07-21)는
            중개자가 사업자 호스트의 성명·주소·전화번호를 확인해 **신청 «전»에** 손님에게 보여 주도록 한다.
            안 하면 제20조의2②로 우리가 연대 책임을 진다. 프로필 번호를 미리 채우고 여기서 고칠 수 있다. */}
        <L
          // 🔁09-19 대표 코멘트 #76 — 이 번호가 무엇에 쓰이는지를 라벨이 말한다.
          label="예약자와의 소통을 위한 전화번호"
          htmlFor="sp-phone"
          anchor="phone"
          error={fieldErr("phone")}
          // 🔁09-17 QA — 「법에 따라」가 처음 듣는 사장님께 위협조로 읽혔다. 근거는 위 주석에 남기고 화면엔 결과만.
          // 🩸09-18 밤 QA(H-06) — 이 칸은 가입하실 때 쓰신 «휴대폰» 번호로 미리 채워지는데, 안내는
          //   「사장님 휴대폰 번호는 결제를 마친 손님께만」이라고 했다. 지금 칸에 들어 있는 그 번호가 공개된다는 뜻이라
          //   사실과 반대로 읽힌다. ⭐«이 칸에 적은 것»은 공개, «프로필 번호»는 결제 뒤 — 둘을 갈라 말한다.
          //   (미리 채우기를 뺄지는 대표 판단이라 그대로 둔다.)
          // 🔁09-19 대표 [J] — 공간 화면 본문에서 빼고 «판매자 정보» 화면으로 옮겼다. 여전히 결제 전에 누구나 볼 수 있다.
          hint="여기 적으신 번호는 공간 화면의 판매자 정보에서 누구나 볼 수 있어요. 프로필의 휴대폰 번호는 결제를 마친 손님께만 따로 열려요."
        >
          <input
            id="sp-phone"
            type="tel"
            inputMode="tel"
            maxLength={CONTACT_PHONE_MAX}
            className={rentInputCls}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="예) 02-1234-5678"
          />
        </L>

        {/* 🔻09-16 「들어오는 법」 칸 삭제. 대표: *「비밀번호 이런 건 문자나 현장에서 당일에 안내하는 걸로」*.
            ⭐**우리는 그 내용을 안 가진다.** 담을 칸이 없으면 샐 일도 없다 — 방식만 고른다. */}
        {/* 🔁09-17 QA — 라벨에 «무엇을» 안내하는지가 없어서 힌트까지 읽어야 알았다. */}
        <L
          // 🔁09-18 대표 코멘트 — 라벨·힌트 대표 문안(맞춤법만: 「전해주시겠나요」→「전해 주시겠어요」).
          label="출입문 비밀번호, 공간 사용법, 안내 사항 등은 어떻게 전해 주시겠어요?"
          // ✍️09-18 밤 QA(H-30) — 사장님 화면에서 손님을 부르는 말이 셋(손님·빌리는 분·신청하는 분)이었고,
          //   같은 일을 「예약을 확정하면」과 「수락」 두 이름으로 불렀다. 사장님 쪽은 «수락»·«손님» 한 벌로 모은다.
          hint="수락하신 뒤 여기서 고르신 방식으로 손님께 연락해 주세요. (수락하고 2일 안에)"
        >
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
      {/* 🔁09-19 대표 코멘트 #81 — 「공간 안내」 → 묻는 말로(다른 절 제목들과 같은 결). */}
      <Group title="공간에 대해 알려 주세요">
        {/* 🔻09-16 대표 — 「쓰임새」(원래 목적대로 / 대관) 칸 삭제. *「위에 대관, 대관+시설이 있는 거 같아
            이건 제거해도 될 듯, 중복처럼 보여」*. 맞다 — 09-16에 만든 «범위» 축이 같은 것을 더 정확히 말한다.
            ⚠️`useType`은 DB와 타입에 남아 있고 저장할 때 기존 값을 그대로 넘긴다(옛 데이터가 안 깨지게). */}
        <L label="쓸 수 있는 시설" optional hint="손님이 이걸 보고 고르세요. 누르면 담겨요.">
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

        {/* 🔁09-17 QA — 「수용이 가능한가요」「숫자를 입력해주세요」가 이 폼에서 드문 행정어였고, 자리글은 폰에서 잘렸다. */}
        {/* 🔁09-19 대표 코멘트 #80 */}
        <L label="공간에 몇 명까지 들어올 수 있나요?" htmlFor="sp-cap" optional>
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
              placeholder="예) 8"
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
             설명은 「공간 사용시 유의 사항을 적어주세요.」로.
           🔁09-17 QA — 설명이 제목을 그대로 되풀이했고 「사용시」 띄어쓰기도 틀렸다. 누구를 위한 칸인지를 말한다. */}
      {/* 🔁09-19 대표 코멘트 #82·#83·#85 — 제목을 묻는 말로, 설명은 「한 문장씩 추가」(담기 방식과 같은 말). */}
      <Group
        title="사용 시 유의 사항을 알려 주세요"
        sub="손님이 지켜야 하는 규칙이나 지켜 줬으면 하는 내용을 한 문장씩 추가해 주세요."
        anchor="rules"
        error={fieldErr("rules")}
      >
        {/* 🔁09-14 여러 줄 textarea → **한 줄 입력 + 담기**(대표: *「한 줄에 하나씩 말고 하나 쓰고 우측에
            입력 버튼, 추가하면 하단에 +규칙 추가 이런 식으로」*).
            ⭐줄바꿈으로 나누라는 건 «규칙»이 아니라 «약속»이었다 — 지키는 사람이 없으면 한 덩어리로 저장되고
              상세 화면의 번호 매기기가 통째로 무너진다. 한 줄씩 담게 하면 그 약속이 필요 없어진다.
            🔗저장 형식은 그대로 줄바꿈 문자열이다(상세 화면·DB를 안 건드린다). 바뀐 건 넣는 방법뿐.
            🔁09-19 대표 코멘트 #84 — 「multitext로, 그냥 줄글 많이 쓸 수 있게」. 칸만 여러 줄 입력으로 바꿨다. 담기 방식은 그대로다.
              Enter는 줄바꿈이고(긴 문장을 편하게), 담는 건 [담기] 버튼이다. 여러 줄을 담으면 줄마다 한 항목이 된다(`withTyped`).
              담기를 안 눌러도 제출 때 같이 담긴다(09-18 밤 H-14, `submit`). */}
        <div>
          <div className="flex items-end gap-2">
            <textarea
              id="sp-rules"
              rows={2}
              className={`${rentTextareaCls} min-w-0 flex-1 resize-y`}
              value={ruleInput}
              onChange={(e) => setRuleInput(e.target.value)}
              placeholder="예) 신발은 벗고 들어와 주세요"
              aria-label="사용 시 유의 사항"
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

          {/* ⏱09-18 대표 코멘트 — 「시간이 오버되는 경우 추가 비용 안내를 공급자가 인지할 수 있게」. */}
          <p className="mt-3 text-[15px] leading-relaxed break-keep text-mute">
            손님이 예약한 시간을 넘길 때 추가 비용이 있다면 얼마인지 꼭 적어 주세요. 적혀 있지 않으면 그날 따로 받기 어려워요.
          </p>
          <p className="mt-2 text-[15px] text-faint">
            {rules.trim().length < 10
              ? "열 글자 이상 적어 주셔야 올릴 수 있어요."
              : `${ruleList.length}가지 적으셨어요.`}
          </p>
        </div>
      </Group>

      {/* ── 파는 것 ── 🛍09-18 대표 결정.
           「공급자 섹션에서 바로 해야 하는 것 같아. 즉 대관만, 공간 전체(대관, 시설), 커피챗 이렇게 3개 상품을 설정할 수 있게 하고
            가격도 각각 설정하게 하고, 고객은 신청할 때 이걸 선택할 수 있게 하자.」
           ⭐앞선 코멘트: 「카페를 일일카페로 하고 싶은 사람도, 카페가 예뻐서 대관만 하고 싶은 사람도 딱 보고 알 수 있게」.
             그래서 상품마다 «무엇을 쓰고 할 수 있는지» 설명 칸이 필수다. 이름과 값만으로는 둘의 차이가 안 읽힌다.
           🔁09-16 하루 값 → **시간당 값**(대표). 눈금은 1시간이고 «최소 대여 시간»이 30분의 필요를 덮는다(두 상품 공통 하나).
           🔻09-19 #88 — 그 «최소 대여 시간» 칸은 지웠다. 모든 공간 1시간(`RENT_MIN_MINUTES`). */}
      <Group
        // 🔁09-19 대표 코멘트 #86 — 「무엇을 파실까요」 → 「대여 타입을 선택해 주세요」.
        title="대여 타입을 선택해 주세요"
        sub="파실 것을 켜고 값을 정해 주세요. 손님은 켜 두신 것 중에서 골라 신청해요."
        anchor="products"
        error={fieldErr("products")}
      >
        <ProductCard
          title={PRODUCT_LABEL.space}
          hint={PRODUCT_HINT_HOST.space}
          on={spaceOn}
          onToggle={() => setSpaceOn((v) => !v)}
        >
          <ProductFields
            idPrefix="sp-space"
            price={spacePrice}
            onPrice={setSpacePrice}
            note={spaceNote}
            onNote={setSpaceNote}
            notePlaceholder={PRODUCT_NOTE_PLACEHOLDER.space}
            noteLabel="무엇을 쓰고, 무엇을 할 수 있나요"
            noteHint="손님은 이 글을 읽고 어느 쪽을 빌릴지 정해요. 못 쓰는 것도 적어 두시면 그날 서로 편해요."
            feeRate={feeRate}
            payout={payoutOf(spacePrice)}
            priceErr={fieldErr("spacePrice")}
            noteErr={fieldErr("spaceNote")}
            priceAnchor="spacePrice"
            noteAnchor="spaceNote"
          />
        </ProductCard>
        <ProductCard
          // 🔁09-19 대표 코멘트 #87 — 「공간 전체(시설 및 공간)」. 09-20부터 손님 화면·메일도 같은 이름이다(`PRODUCT_LABEL` 한 벌).
          title={PRODUCT_LABEL.full}
          hint={PRODUCT_HINT_HOST.full}
          on={fullOn}
          onToggle={() => setFullOn((v) => !v)}
        >
          <ProductFields
            idPrefix="sp-full"
            price={fullPrice}
            onPrice={setFullPrice}
            note={fullNote}
            onNote={setFullNote}
            notePlaceholder={PRODUCT_NOTE_PLACEHOLDER.full}
            noteLabel="어떤 시설까지 쓰고, 무엇을 할 수 있나요"
            noteHint="기계 쓰는 법을 알려 주시는지, 손님이 챙겨 올 재료가 있는지도 같이 담아 주세요."
            feeRate={feeRate}
            payout={payoutOf(fullPrice)}
            priceErr={fieldErr("fullPrice")}
            noteErr={fieldErr("fullNote")}
            priceAnchor="fullPrice"
            noteAnchor="fullNote"
          />
        </ProductCard>

        {/* ☕09-16 「알려주기 여부」 → **커피챗**(대표). 이름이 무슨 말인지 안 통했고, 파는 물건도 애매했다.
            ⭐대표 정리: *「선배한테 현업 이야기 듣기, 현업을 들여다보기 같은 자리를 부가 상품으로」*.
              레시피나 비법이 아니다 — 하루가 어떻게 돌아가는지, 재료는 어디서 떼는지, 언제 몰리고 언제 비는지.
              사장님이 안 내놓을 것은 빼고도 들려줄 수 있고, 창업을 생각하는 사람에겐 그쪽이 값어치다.
            🔻설비 사용법 같은 «필수» 안내는 여기 없다. 그건 상품이 아니라 인수인계라 위 「안내 방식」이 맡는다.
            🔁09-17 QA — 「현업에서의」「제공하실」 행정어를 카페 사장님이 쓰는 말(「가게를 열려는 분」)로 풀었다.
            🔁09-18 아니요/예 두 알약 → 위 두 상품과 같은 켜기 카드(세 상품이 한 얼굴). 커피챗은 공간 예약에 «더하는» 상품이다. */}
        {/* 🔁09-19 대표 코멘트 #89~#97 — 카드 제목 하나를 묻는 말로(「업계 선배님으로서…」), 알약은 「부가 유료 서비스」
            (무료로 고르면 「부가 서비스」), 설명·라벨·도움말·자리표시는 대표 문안(맞춤법만). 값 칸 밑에 「무료로 제공할게요」. */}
        <ProductCard
          title="업계 선배님으로서 가게에 관한 커피챗을 제공하실 수 있나요?"
          hint="가게를 열고 싶은 분에게 실제 가게의 하루가 어떻게 돌아가는지 들려주세요. 레시피나 거래처처럼 영업에 직접 연결되는 정보를 공유하는 것이 아니라, 가게를 운영하며 쌓은 업계의 경험과 시설 이용, 운영, 영업 등에 대한 노하우를 나눠 주시면 됩니다. 가게를 먼저 열어 본 선배로서, 후배들에게 도움이 될 만한 이야기를 편하게 들려주세요."
          on={chatOn}
          onToggle={() => setChatOn((v) => !v)}
          addon={chatFree ? "부가 서비스" : "부가 유료 서비스"}
        >
          {/* ☕「언제」는 `rent-copy` 한 줄만 쓴다(대표 09-17 결정 1). 손님 쪽 화면·메일이 같은 말을 한다. */}
          <p className="text-[15px] leading-relaxed break-keep text-body">{COFFEE_CHAT_WHEN_HOST}</p>
          <L label="얼마나 이야기 나누실까요" htmlFor="sp-cm">
            <RentSelect
              id="sp-cm"
              wrapClassName="w-full sm:max-w-[240px]"
              value={chatMin}
              onChange={(e) => setChatMin(e.target.value)}
            >
              {chatChoices.map((m) => (
                <option key={m} value={m}>
                  {minutesLabel(m)}
                </option>
              ))}
            </RentSelect>
          </L>
          <L label="커피챗 비용" htmlFor="sp-cp" anchor="chatPrice" error={fieldErr("chatPrice")}>
            {/* 무료면 칸을 잠그고 「무료」를 보인다. 적어 둔 값은 지우지 않는다(다시 끄면 돌아온다). */}
            <WonInput
              id="sp-cp"
              value={chatFree ? 0 : chatPrice}
              onChange={setChatPrice}
              placeholder={chatFree ? COFFEE_CHAT_FREE : "예) 20,000"}
              disabled={chatFree}
            />
            {/* 👆44px 줄(약관 체크와 같은 처리) — 체크 상자 18px만 누름 자리면 손끝이 빗나간다. */}
            <label className="mt-2 flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-[18px] shrink-0 accent-primary"
                checked={chatFree}
                onChange={(e) => setChatFree(e.target.checked)}
              />
              <span className="text-[16px] text-body">무료로 제공할게요</span>
            </label>
            {!chatFree && chatPrice > 0 && (
              <p className="mt-1 text-[15px] text-mute">
                수수료를 빼고 <span className="font-medium text-ink">{won(payoutOf(chatPrice))}</span>이 사장님께 가요.
              </p>
            )}
          </L>
          <L
            label="커피챗에서 어떤 이야기를 들려주실 수 있을까요?"
            htmlFor="sp-ct"
            optional
            hint="예약하시는 분이 내용을 확인한 뒤 커피챗을 진행할지 결정하게 돼요."
          >
            {/* 🔁09-19 대표 코멘트 #96·#97 — 옛 예시(「재료를 어디서 얼마에 떼는지」)가 대표 말로 「좀 별로」였다.
                몰리는 시간·업계 이야기·연차별로 한 일·질문 받기 — 레시피·거래처가 아닌 쪽으로 넷. */}
            <textarea
              id="sp-ct"
              rows={4}
              className={`${rentTextareaCls} resize-y`}
              value={chatTopics}
              onChange={(e) => setChatTopics(e.target.value)}
              placeholder={"예) 손님이 몰리는 시간과 한가한 시간\n업계에서 요즘 오가는 이야기\n연차별로 했던 일\n궁금하신 점이 있으면 편하게 들어 드려요"}
            />
          </L>
        </ProductCard>
      </Group>

      {/* ── 여는 날·시간 ── 실사에서 이 데이터를 가진 곳이 23곳 중 0곳이었다(설계 §조사 ②). */}
      <Group
        // 🔁09-19 대표 코멘트 #98·#99 — 제목·설명을 대표 문안으로(맞춤법만: 「정해주세요」→「정해 주세요」).
        title="대여할 날짜와 시간을 정해 주세요"
        sub="날짜와 요일별 대여 가능 시간을 정해 주세요. 설정한 시간에 맞춰 손님이 대여를 신청할 수 있어요."
        anchor="slots"
        error={fieldErr("slots")}
      >
        <OpenSlotsCalendar
          value={openSlots}
          onChange={setOpenSlots}
          repeat={repeatWeekly}
          onRepeatChange={setRepeatWeekly}
        />
      </Group>

      {/* ── 🧾사업자 정보 ── 09-18 대표: 「개인까지 받으면 너무 무방비 범죄가 일어날 것 같다. 개인 수요는 추후 검증 과정을 거쳐서」.
           사업자등록증 + 국세청 자동 조회 + 저희 검토. 왜 받는지를 먼저 말하고(손님이 믿고 빌리게), 파일을 누가 보는지 같이 말한다. */}
      <Group
        // 🔁09-19 대표 코멘트 #105·#107 — 제목은 「등록해 주세요」로 부드럽게, 설명은 대표 문안(맞춤법만).
        title="사업자 정보를 등록해 주세요"
        sub="사업자등록증과 사업자 정보를 확인한 뒤 collab5에 노출돼요. 검토를 위해 정확한 사업자 정보를 입력해 주세요."
        anchor="biz"
      >
        {editing && !hasAnyBiz(initial) && (
          // 09-18 전에 올린 공간(초안 포함). 🔁09-19 오후 대표 — 번호가 빈 공간은 손님 목록·상세에서 빠진다(`spaceListed`).
          //   그래서 «표시를 붙여 드려요»(있으면 좋은 것)가 아니라 «채우셔야 보여요»(할 일)로 말한다.
          <p className="rounded-md bg-surface-soft px-4 py-3 text-[15px] leading-relaxed break-keep text-body">
            {initial?.status === "draft"
              ? "아직 사업자 정보가 없어요. 넷 다 채워 주셔야 올릴 수 있어요."
              : "아직 사업자 정보가 없어요. 채워 주셔야 손님께 다시 보여요."}
          </p>
        )}
        {editing && !!initial?.bizApprovedAt && (
          // 🔁09-19 오후 대표 — 상호만 고치는 건 그대로 둔다(표시도 안 내려간다). 무엇을 바꾸면 내려가는지 칸 이름으로 말한다.
          <p className="text-[15px] leading-relaxed break-keep text-mute">
            사업자등록번호·대표자 이름·개업일이나 등록증을 바꾸시면 확인 표시가 잠시 내려가요. 저희가 다시 확인하고 붙여
            드려요. 상호만 고치시면 그대로예요.
          </p>
        )}
        {/* 🔝09-19 대표 코멘트 #110 — 사업자등록증 올리기를 절 맨 위로(상태 안내 줄 바로 밑). 등록증을 먼저 올리고
            그걸 보며 아래 칸을 채우는 순서다. 🧾09-20 대표 「OCR 가로 고고」 — 올리면 글자를 읽어 «빈 칸만» 채운다
            (`certPrefill` = `readBizCertAction`, `pickCert`). 채운 칸 위에 「맞는지 확인해 주세요」 한 줄. */}
        <L
          label="사업자등록증"
          anchor="bizCert"
          // 🩸09-18 밤 QA(H-04) — 한 번 제출한 뒤엔 `fieldErr`가 늘 「사업자등록증 파일을 올려 주세요」를 들고 있어서,
          //   10MB 초과·형식 불일치·올리기 실패 같은 **진짜 이유**(`certErr`)가 그 일반 문구에 가려졌다.
          //   사장님은 파일을 골랐는데 「올려 주세요」만 반복해서 보게 된다. 방금 일어난 일이 먼저다.
          error={certErr || fieldErr("bizCert")}
          // 🏠09-19 오후 대표 — 등록증의 사업장 주소와 위 「전체 주소」를 대조한다. 같은 뜻을 이 칸에서도 한 줄.
          hint="사업장 주소가 위에 적으신 주소와 같은 등록증으로 올려 주세요. 사진이나 PDF, 10MB까지 돼요."
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label
              className={`${secondaryBtnCls} cursor-pointer text-[15px] ${certUploading || certRead === "reading" ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif,.pdf"
                className="sr-only"
                disabled={certUploading || certRead === "reading"}
                onChange={(e) => void pickCert(e.currentTarget)}
              />
              {certUploading ? "올리는 중이에요…" : bizCertPath ? "다른 파일로 바꾸기" : "파일 고르기"}
            </label>
            {bizCertPath && !certUploading && (
              <p className="flex min-w-0 items-center gap-1.5 text-[15px] break-all text-body">
                <CheckIcon />
                {certName || "올려 두신 파일이 있어요"}
              </p>
            )}
          </div>
        </L>
        {/* 🧾09-20 등록증 읽기의 말 — 읽는 중 · 채움 · 못 읽음. 채운 칸(상호부터) «위»에 선다. 화면 낭독기도 바뀔 때 읽는다. */}
        <div aria-live="polite" className="empty:hidden">
          {certRead === "reading" && (
            <p className="text-[15px] leading-relaxed break-keep text-mute">등록증을 읽고 있어요…</p>
          )}
          {certRead === "filled" && (
            <p className="rounded-md bg-primary-tint px-4 py-3 text-[15px] leading-relaxed break-keep text-primary-on">
              등록증에서 읽었어요. 맞는지 한 번 확인해 주세요.
            </p>
          )}
          {certRead === "none" && (
            <p className="text-[15px] leading-relaxed break-keep text-mute">등록증을 읽지 못했어요. 아래 칸은 직접 적어 주세요.</p>
          )}
        </div>
        {/* 🏠사업장 주소는 자동으로 안 넣는다. 공간 주소 칸이 비어 있을 때만 제안하고, 누르면 위 주소 칸에 들어간다(대표 09-20). */}
        {certAddr && !addrBase.trim() && (
          <div className="rounded-md bg-surface-soft px-4 py-3">
            <p className="text-[15px] leading-relaxed break-keep text-mute">위 공간 주소가 비어 있어요. 등록증에 적힌 사업장 주소로 채울 수 있어요.</p>
            <p className="mt-1 text-[15px] leading-relaxed break-keep text-ink">{certAddr}</p>
            <button type="button" onClick={fillCertAddress} className={`${secondaryBtnCls} mt-3`}>
              등록증 주소로 채우기
            </button>
          </div>
        )}
        {/* 🏷09-19 대표 [J] — 판매자 정보(상호·대표자·사업자번호·주소·가게 전화)를 손님이 결제 전에 보는 화면이 생겼다.
            상호 칸이 없어서 새로 받는다. 국세청 조회엔 안 넣는다(번호·대표자·개업일만 묻는 조회라서). */}
        <L
          label="상호(사업자등록증에 적힌 이름)"
          htmlFor="sp-biz-name"
          anchor="bizName"
          error={fieldErr("bizName")}
          // 🔻09-19 대표 코멘트 #108 — 「손님이 결제 전에 보는 판매자 정보에 이 이름이 나가요」는 뺐다(대표: 불필요).
          //   상호가 빈 옛 공간을 고칠 때의 안내 한 줄만 남긴다(비우면 공간 이름이 대신 나간다는 사실).
          hint={
            editing && !initial?.bizName && !bizName.trim()
              ? "비워 두시면 손님이 보는 판매자 정보에 공간 이름이 대신 나가요. 등록증의 상호로 채워 주세요."
              : undefined
          }
        >
          <input
            id="sp-biz-name"
            autoComplete="organization"
            maxLength={100}
            className={`${rentInputCls} sm:max-w-[360px]`}
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="예) 느린오후 로스터리"
          />
        </L>
        {/* 🧪09-19 저녁 대표 — 개발 서버에서만 테스트 번호 한 줄(`testBizHint`). 운영 빌드에선 빈 글자라 안내가 안 선다. */}
        <L label="사업자등록번호" htmlFor="sp-biz-no" anchor="bizNumber" error={fieldErr("bizNumber")} hint={testBizHint() || undefined}>
          <input
            id="sp-biz-no"
            inputMode="numeric"
            autoComplete="off"
            className={`${rentInputCls} sm:max-w-[260px]`}
            value={formatBizNumber(bizNumber)}
            onChange={(e) => setBizNumber(bizDigits(e.target.value).slice(0, 10))}
            placeholder="예) 123-45-67890"
          />
        </L>
        <L label="대표자 이름" htmlFor="sp-biz-owner" anchor="bizOwner" error={fieldErr("bizOwner")} hint="사업자등록증에 적힌 이름 그대로 적어 주세요.">
          <input
            id="sp-biz-owner"
            autoComplete="off"
            className={`${rentInputCls} sm:max-w-[260px]`}
            value={bizOwnerName}
            onChange={(e) => setBizOwnerName(e.target.value)}
            placeholder="예) 김하루"
          />
        </L>
        <L label="개업일" htmlFor="sp-biz-open" anchor="bizOpenDate" error={fieldErr("bizOpenDate")}>
          <input
            id="sp-biz-open"
            type="date"
            max={todayKst()}
            className={`${rentInputCls} sm:max-w-[260px]`}
            value={bizOpenDate}
            onChange={(e) => setBizOpenDate(e.target.value)}
          />
        </L>
        {/* 국세청 기록과 다를 때의 말 — 세 칸에 걸친 말이라 세 칸 바로 밑에 둔다. 칸을 고치면 내려간다. */}
        {bizServerMsg && (
          <p role="alert" className="-mt-2 text-[15px] leading-relaxed break-keep text-danger">
            {bizServerMsg}
          </p>
        )}
      </Group>

      {/* ── 확인 ── */}
      <Group title="마지막으로 확인해 주세요">
        {/* 🔻09-16 대표 — 음식 여부·임대인 동의 «체크박스» 둘 다 삭제.
            ⭐전대 확인은 없앤 게 아니라 **약관 한 줄로 옮겼다.** 체크박스는 읽지 않고 누르지만
              약관은 동의 시각이 남아 계약의 근거가 된다(약관규제법 제3조③④).
            ⚖️조사(09-16)로 확인한 것 — 아워플레이스·에어비앤비 둘 다 호스트 편을 따로 두고,
              우리 기존 약관엔 호스트 의무가 한 줄도 없었다. 수수료·정산·구상을 주장할 근거가 없었다. */}
        {/* 🏠09-17 대표 결정 6 — 임대인 동의 «체크»는 다시 넣지 않는다. 대신 동의 바로 위에 한 줄로 먼저 생각하게 한다.
            임차 가게 사장님은 여기서 처음 떠올린다(QA). */}
        {/* 🔁09-18 대표 코멘트 — 문안(「제약 사항은 없는지」) + 불렛. */}
        <ul className="space-y-1.5">
          <li className="flex gap-2 text-[15px] leading-relaxed break-keep text-body">
            <span aria-hidden="true" className="text-mute">·</span>
            <span className="min-w-0 flex-1">
              공간을 빌려주는 데 제약 사항은 없는지 미리 살펴봐 주세요. 임대차 계약이나 건물 관리 규약에 제한이 있을 수
              있어요.
            </span>
          </li>
        </ul>
        <div id="f-terms" className="space-y-4">
          {/* 👆09-18 밤 QA(H-28) — 체크박스가 18px이었다. 글자까지가 누름 상자라 실제로는 넓지만, 한 줄로 끝나는 화면에선
              줄 높이(28px)가 곧 누름 높이였다. 위아래 여백으로 줄 자체를 44px 이상으로 만든다(음수 여백으로 자리는 그대로). */}
          <label className="-my-2 flex min-h-[44px] cursor-pointer items-start gap-3 py-2">
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
          {/* 🔁09-18 대표 코멘트 — 한 문단 → 불렛. 「제3자 정보 제공」 질문에 맞춰, 예약이 잡히면 연락처가 손님께 간다는 줄을 더했다
              (계약 이행에 필요한 제공이라 따로 동의 체크는 두지 않고, 개인정보처리방침 «거래 상대방 제공»에 적어 두었다 · 09-17). */}
          <ul className="space-y-1.5">
            {[
              // ✍️09-18 밤 QA(H-30) — 이 줄만 1인칭(「내 소유」)이라 옆 줄들과 화자가 달랐다. 사장님께 말하는 결로 맞춘다.
              `약관에는 사장님 소유이거나 임대인 동의를 받으셨다는 것, 수수료 ${Math.round(feeRate * 100)}%와 정산 방법, 환불 규정이 담겨 있어요.`,
              // 🔻09-19 대표 코멘트 #112·#113·#114 — 판매자 정보 공개 · 이름·주소를 바꾸면 등록증과 다시 견줌 · 결제 뒤 연락처 전달,
              //   세 줄을 폼에서 뺐다. 같은 내용은 호스트 약관 본문(`/terms/host` 제2조·제6조·제7조)에 그대로 있다.
            ].map((line) => (
              <li key={line} className="flex gap-2 text-[15px] leading-relaxed break-keep text-mute">
                <span aria-hidden="true">·</span>
                <span className="min-w-0 flex-1">{line}</span>
              </li>
            ))}
          </ul>
          {fieldErr("terms") && <p className="text-[15px] leading-relaxed break-keep text-danger">{fieldErr("terms")}</p>}
        </div>

        {/* 📎09-16 대표 — 소개서가 있는 사장님은 손님에게 보여줄지 «고른다». 켜면 공간 화면엔 브랜드 이름만,
            결제를 마친 손님의 예약 내역엔 소개서 링크까지 열린다(연락처가 같이 열리는 시점이라 새는 게 없다). */}
        {/* 📝09-17 QA — 소개서 없는 사장님에겐 이 자리가 통째로 비어 있었다. 소개서 서비스인데 그 문이 닫혀 있던 셈이라
            같은 자리에 만드는 길 한 줄을 둔다. 새 탭 — 여기까지 채운 폼 값이 날아가지 않게. */}
        {/* 🔻09-19 대표 코멘트 #115 — 「소개서가 있는 경우만 노출」. 소개서 없는 사장님께 보이던 「소개서 만들기」 줄(09-17 QA)을 뺐다. */}
        {myBrands.length > 0 && (
          <div>
            {/* 🔁09-19 #115 제목 — 대표 문안(맞춤법만: 「확인 하실」→「확인하실」, 「노출 할까요」→「노출할까요」). */}
            <p className="text-[16px] font-medium leading-relaxed break-keep text-body">
              등록한 소개서가 있으시네요. 대여할 분이 확인하실 수 있도록 소개서도 노출할까요?
            </p>
            {/* 🔁09-17 대표 결정 3 — 공간 화면에서 소개서 링크를 연다. 옛 설명(「이름만 나가요 · 결제한 손님께만 링크」)은 더 이상 맞지 않는다. */}
            <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">
              켜 두시면 공간 화면에 소개서 링크가 같이 보여요. 손님이 빌리기 전에 사장님 이야기를 읽어 볼 수 있어요.
            </p>
            <div role="radiogroup" aria-label="소개서 보여주기" className="mt-3 flex gap-2">
              {[
                { v: false, label: "안 보여요" },
                { v: true, label: "보여요" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={brandOn === o.v}
                  onClick={() => setBrandOn(o.v)}
                  className={`inline-flex h-[44px] min-w-[88px] items-center justify-center rounded-pill px-5 text-[15px] font-medium transition-colors ${
                    brandOn === o.v
                      ? "bg-primary-tint text-primary-on"
                      : "border-[0.5px] border-[#DFDFE3] bg-surface text-body hover:bg-surface-soft"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {/* 소개서가 둘 이상일 때만 고르게 한다. 하나면 고를 것이 없다. */}
            {brandOn && myBrands.length > 1 && (
              <div className="mt-4">
                <L label="어떤 소개서를 보여줄까요" htmlFor="sp-brand">
                  <RentSelect id="sp-brand" value={brandPick} onChange={(e) => setBrandPick(e.target.value)}>
                    {myBrands.map((b) => (
                      <option key={b.slug} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </RentSelect>
                </L>
              </div>
            )}
          </div>
        )}
      </Group>

      {/* 🧭등록 전 확인(대표 09-19 코멘트 #67·#111) — 원래 폼 머리의 「요청이 들어오면 이렇게 해요」였다. 대표: 「하단 어딘가로 내리자,
          마지막이면 좋겠다」. 등록 버튼 바로 위에서 요청 뒤 할 일과 수수료를 한 번에 읽고 누르게 한다.
          번호는 장식이 아니라 순서라 붙였다. 문장 정본은 `rent-copy`의 `HOST_REQUEST_STEPS`(공간 공개 메일과 같은 약속).
          💰수수료 줄은 서버가 넘긴 요율(`feeRate`)로 쓴다(`hostFeeLine`). 고치기 화면엔 전에도 없던 절이라 새로 올리기만. */}
      {!editing && (
        <section className="rounded-md bg-surface-soft px-5 py-5">
          <h2 className="text-[17px] font-bold leading-snug tracking-tight text-ink">등록 전 확인해 주세요</h2>
          <ol className="mt-3 space-y-2.5">
            {[...HOST_REQUEST_STEPS, hostFeeLine(feeRate)].map((t, i) => (
              <li key={t} className="flex gap-3 text-[15px] leading-relaxed break-keep text-body">
                <span className="w-[16px] shrink-0 text-right tabular-nums text-mute">{i + 1}</span>
                <span className="min-w-0 flex-1">{t}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 📌등록 바(대표 09-19 코멘트 #68: 「플로팅으로 고정으로 따라다니게」). 폰·데스크톱 둘 다 화면 아래에 붙어 따라온다.
          ⭐`fixed`가 아니라 `sticky`다. 폼 «안»에서만 따라다니다가 폼이 끝나면 제자리(마지막 절 밑)에 내려앉는다.
            그래서 맨 아래까지 내리면 마지막 칸과 푸터를 가리지 않는다. `fixed`면 푸터 위에 늘 떠 있어서 여백을 따로 벌려야 했다.
          ⚠️이 바는 폼 뿌리(`space-y-12`)의 «직계 자식»이어야 한다. 한 겹 더 감싸면 그 겹 안에서만 붙어 있다가 같이 사라진다.
          📐모양은 신청 폼의 결제 바(`BookingForm`의 `PayBar`)와 같다 — 위만 둥근 면 + hairline + e2, 아래 여백은 안전 영역과 12px 중 큰 쪽.
            양옆은 `main`의 여백(px-4 · sm:px-6)만큼 밖으로 빼서 폰에선 화면 끝까지 닿는다.
            `mb-3`은 뿌리의 칸 사이 48px을 줄인다(버튼 밑 한 줄이 버튼에 붙어 읽히게). */}
      <div className="sticky bottom-0 z-30 -mx-4 mb-3 rounded-t-2xl border border-b-0 border-hairline bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-e2 sm:-mx-6 sm:px-6">
        {(err || (tried && blocked) || bizServerMsg) && (
          // 서버가 돌려준 말이 있으면 그것을, 없으면 지금 막고 있는 이유를. 둘이 같이 뜨면 잔소리가 된다.
          // 🧾사업자 칸의 서버 말은 칸 밑이 빨갛고 여기선 옅게 한 번 더(칸 막힘과 같은 처리).
          <p className={`mb-2 text-[15px] leading-relaxed break-keep ${err ? "text-danger" : "text-faint"}`}>
            {err || (tried && blocked) || bizServerMsg}
          </p>
        )}
        {savedNote && <p role="status" className="mb-2 text-[15px] leading-relaxed break-keep text-mute">{savedNote}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={pending || uploading}
          className={`${primaryBtnCls} h-[52px] w-full`}
        >
          {pending
            ? "올리는 중이에요…"
            : uploading
              ? certUploading ? "파일을 올리는 중이에요…" : "사진을 올리는 중이에요…"
              : editing
                ? fixing
                  ? "고쳐서 다시 보내기"
                  : reviewAgain
                    ? "고친 내용 올리고 다시 검토 받기"
                    : "고친 내용 올리기"
                : "등록 신청하기"}
        </button>
      </div>
      <p className="text-center text-[15px] leading-relaxed break-keep text-faint">
        {/* 🔁09-17 QA — 「승인이 완료되는 대로 노출이 시작돼요」 명사화 둘, 고치기 쪽은 머리글과 같은 말 + 「반영됩니다」 피동.
            검토 기한은 아직 대표가 안 정해서 적지 않는다. */}
        {/* 🔁09-18 밤 QA(H-09) — 이름·주소를 «이미 바꾼» 사장님에겐 위 칸 옆 안내가 말했으니 여기선 되풀이하지 않는다. */}
        {/* 🔁09-19 대표 코멘트 #69 — 새로 올리기 줄은 대표 문안 그대로(관리자 승인 뒤 노출). */}
        {!editing
          ? "등록 요청 시 관리자 승인 후 하루 팝업에 노출됩니다."
          : fixing
            ? "보내 주시면 부탁드린 부분을 확인하고 목록에 열어 드려요."
            : initial?.status === "pending"
            ? "고친 내용은 지금 하는 검토에 같이 담겨요."
            : reviewAgain
              ? "고친 내용을 읽어 보고 다시 열어 드릴게요."
              : "가게 이름이나 주소를 바꾸시면 한 번 더 읽어 볼게요. 그동안 목록에서 잠시 빠져요."}
      </p>
    </div>
  );
}

/** 🔁이름·주소를 바꿨을 때 그 칸 밑에 서는 한 줄(09-18 밤 QA H-09).
 *  ⚠️레몬(기다리는 것의 색)이다 — 빨강은 「못 넘어간다」는 뜻이라 여기 쓰면 고치기를 멈추게 한다. 이건 막는 말이 아니다. */
function ReviewAgainNote({ what, listed }: { what: string; listed: boolean }) {
  return (
    <p className="mt-2 text-[15px] leading-relaxed break-keep text-lemon-on">
      {withJosa(what, "을/를")} 바꾸셨네요. 올리시면 저희가 한 번 더 읽어 봐요.
      {listed ? " 그동안 이 공간은 목록에서 잠시 빠져요." : ""}
    </p>
  );
}

/** 금액 칸 — 표시는 `50,000`, 상태는 숫자. 오른쪽에 「원」.
 *  `type="number"`를 안 쓰는 이유 — 콤마를 못 넣고, 스크롤 휠에 값이 바뀌고, iOS 자판에 콤마가 없다. */
function WonInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  /** 무료 커피챗처럼 값을 안 받는 때(09-19). 잠근 칸은 옅은 면으로 보인다. */
  disabled?: boolean;
}) {
  return (
    <div className="relative sm:max-w-[260px]">
      <input
        id={id}
        inputMode="numeric"
        disabled={disabled}
        className={`${rentInputCls} pr-11 disabled:bg-surface-soft disabled:placeholder:text-body`}
        value={value > 0 ? value.toLocaleString("ko-KR") : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        placeholder={placeholder}
      />
      {/* 잠근 칸(무료)엔 「원」을 안 붙인다 — 「무료 원」으로 읽힌다. */}
      {!disabled && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[16px] text-mute">
          원
        </span>
      )}
    </div>
  );
}

/** 🛍상품 카드 한 장(09-18) — 이름·한 줄 설명·켜기 스위치. 켜면 그 상품의 칸이 열린다.
 *  ⭐카드 머리 전체가 스위치다. 폰에서 작은 토글만 누르게 하면 손가락이 빗나간다.
 *  `addon` = 공간 예약에 «더하는» 상품(커피챗)의 알약 글자. 머리에 작게 표시한다(09-19 #90: 「부가 유료 서비스」). */
function ProductCard({
  title,
  hint,
  on,
  onToggle,
  addon,
  children,
}: {
  title: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  addon?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border transition-colors ${on ? "border-primary-strong bg-surface" : "border-hairline bg-surface"}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[17px] font-bold break-keep text-ink">{title}</span>
            {addon && (
              <span className="rounded-pill bg-surface-soft px-2 py-0.5 text-[13px] text-mute">{addon}</span>
            )}
          </span>
          <span className="mt-1 block text-[15px] leading-relaxed break-keep text-mute">{hint}</span>
        </span>
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-[26px] w-11 shrink-0 items-center rounded-pill p-[2px] transition-colors ${
            on ? "bg-primary" : "bg-border-strong"
          }`}
        >
          <span
            className={`h-[22px] w-[22px] rounded-pill bg-white transition-transform ${on ? "translate-x-[18px]" : "translate-x-0"}`}
          />
        </span>
      </button>
      {on && <div className="space-y-6 border-t border-hairline px-4 pt-5 pb-5">{children}</div>}
    </div>
  );
}

/** 공간 상품 하나의 칸 — 시간당 값(수수료 뺀 금액) + «무엇을 쓰고 할 수 있는지» 설명. 대관만·공간 전체가 같이 쓴다. */
function ProductFields({
  idPrefix,
  price,
  onPrice,
  note,
  onNote,
  notePlaceholder,
  noteLabel,
  noteHint,
  feeRate,
  payout,
  priceErr,
  noteErr,
  priceAnchor,
  noteAnchor,
}: {
  idPrefix: string;
  price: number;
  onPrice: (n: number) => void;
  note: string;
  onNote: (s: string) => void;
  notePlaceholder: string;
  noteLabel: string;
  noteHint: string;
  feeRate: number;
  payout: number;
  priceErr: string;
  noteErr: string;
  priceAnchor: string;
  noteAnchor: string;
}) {
  return (
    <>
      <L label="한 시간에 얼마인가요" htmlFor={`${idPrefix}-price`} anchor={priceAnchor} error={priceErr}>
        <WonInput id={`${idPrefix}-price`} value={price} onChange={onPrice} placeholder="예) 15,000" />
        {/* ⭐정직하게 적는다. 「수수료 15%」만 적어 두면 사장님은 손에 쥐는 금액을 직접 계산해야 한다(09-16).
            💰값을 적는 «그 순간»이 수수료를 알아야 하는 순간이라 상품마다 붙인다. */}
        {price > 0 ? (
          <p className="mt-2 text-[15px] text-mute">
            수수료 {Math.round(feeRate * 100)}%를 뺀 <span className="font-medium text-ink">{won(payout)}</span>이 한 시간마다
            사장님께 가요.
          </p>
        ) : (
          <p className="mt-2 text-[15px] text-faint">
            {/* ✍️09-18 밤 QA(H-30) — 「성사된 금액」은 행정어다. 사장님이 쓰는 말로. */}
            빌려주고 받으신 금액에서 수수료 {Math.round(feeRate * 100)}%를 뺀 나머지를 사장님께 드려요.
          </p>
        )}
      </L>
      <L
        label={noteLabel}
        htmlFor={`${idPrefix}-note`}
        anchor={noteAnchor}
        error={noteErr}
        hint={noteHint}
      >
        <textarea
          id={`${idPrefix}-note`}
          rows={3}
          className={`${rentTextareaCls} resize-y`}
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={notePlaceholder}
        />
      </L>
    </>
  );
}

/** 💾v1 초안(09-17)의 옛 칸 둘. 읽을 때만 쓴다. */
interface DraftV1Extra {
  scope?: string;
  priceHour?: number;
}

/** v1 → v2. 범위가 «공간만»이면 대관만, 그 밖이면 공간 전체를 켜고 옛 값을 옮긴다(SQL의 채우기 규칙과 같다). */
function draftFromV1(d: Partial<SpaceDraft> & DraftV1Extra): Partial<SpaceDraft> {
  const { scope, priceHour, ...rest } = d;
  const price = Number(priceHour) || 0;
  const full = !!scope && scope !== "space_only";
  return {
    ...rest,
    spaceOn: price > 0 && !full, spacePrice: full ? 0 : price, spaceNote: "",
    fullOn: price > 0 && full, fullPrice: full ? price : 0, fullNote: "",
  };
}

/** 🧭09-17 디자인팀 — 폼의 단계. **`Group`의 `title`과 글자가 같아야 번호가 붙는다**(제목을 바꾸면 여기도).
 *  폰에서 이 폼은 여덟 화면을 내려간다. 절 제목 위 「3 / 7」과 넓은 화면의 오른쪽 목차가 «지금 어디쯤인지»를 말한다. */
const FORM_STEPS = [
  "어떤 공간인가요",
  "어디에 있나요",
  // 🔁09-19 대표 코멘트 #81·#82·#86
  "공간에 대해 알려 주세요",
  "사용 시 유의 사항을 알려 주세요",
  // 🔁09-18 「얼마에 빌려주실까요」 → 상품 셋(대표).
  "대여 타입을 선택해 주세요",
  // 🔁09-19 대표 코멘트 #98
  "대여할 날짜와 시간을 정해 주세요",
  // 🧾09-18 대표 — 공간 등록에 사업자 확인 필수. 🔁09-19 #105
  "사업자 정보를 등록해 주세요",
  "마지막으로 확인해 주세요",
];

/** 조용한 체크 — 올린 파일 이름 앞. 초록 배지 대신 글자색과 같은 선 하나(공간 상세의 확인 표시와 같은 얼굴). */
function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[16px] shrink-0 text-mute">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

/** 넓은 화면(xl)에서만 폼 오른쪽에 붙는 목차. 누르면 그 절로 가고, 읽고 있는 절이 진하게 선다.
 *  📐폼 폭 560의 오른쪽 끝(50%+280)에서 40 띄운 자리. `/rent/new`·`/rent/[slug]/edit` 두 화면의 폭과 한 쌍이다. */
function StepNav() {
  const [active, setActive] = useState(1);
  useEffect(() => {
    const marks = Array.from(document.querySelectorAll<HTMLElement>("[data-form-step]"));
    if (marks.length === 0) return;
    // 화면 위쪽 35% 선을 지난 마지막 표지가 «지금 읽는 절»이다.
    const onScroll = () => {
      const line = window.innerHeight * 0.35;
      let cur = 1;
      for (const m of marks) if (m.getBoundingClientRect().top <= line) cur = Number(m.dataset.formStep);
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      aria-label="등록 단계"
      className="fixed top-[140px] left-[calc(50%+320px)] hidden w-[200px] xl:block"
    >
      <ol className="space-y-1 border-l border-hairline">
        {FORM_STEPS.map((t, i) => {
          const on = active === i + 1;
          return (
            <li key={t}>
              <a
                href={`#step-${i + 1}`}
                aria-current={on ? "step" : undefined}
                className={`-ml-px block border-l-2 py-1.5 pl-4 text-[15px] leading-snug break-keep transition-colors ${
                  on ? "border-ink font-medium text-ink" : "border-transparent text-mute hover:text-body"
                }`}
              >
                {t}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** 묶음 제목 + 칸들. 한 화면에 칸이 스무 개라 구역이 없으면 어디까지 적었는지 놓친다.
 *  제목 → 첫 입력 23px(register `GroupHeader` 규칙). 칸 사이 24px. */
function Group({
  title,
  sub,
  anchor,
  error,
  children,
}: {
  title: string;
  sub?: string;
  /** 막힌 칸으로 스크롤할 때 찾는 이름(`f-<anchor>`). */
  anchor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const step = FORM_STEPS.indexOf(title) + 1;
  return (
    // 📐09-18 밤 QA(H-18) — `#f-biz`로 들어오면 「사업자 정보」 제목이 고정 헤더(3.5rem) 밑에 깔렸다.
    //   저장 뒤 국세청 불일치로 여기까지 데려오는 길이라, 도착한 사장님이 무슨 절인지부터 못 봤다.
    <section id={anchor ? `f-${anchor}` : undefined} className="scroll-mt-24">
      {/* 🧭단계 표지. id는 `f-<anchor>`(막힌 칸 스크롤)와 겹치지 않게 제목 묶음에 따로 단다. */}
      <div className="mb-[23px] scroll-mt-24" id={step ? `step-${step}` : undefined} data-form-step={step || undefined}>
        {step > 0 && (
          <p className="mb-1.5 text-[14px] font-medium tabular-nums text-faint">
            {step} / {FORM_STEPS.length}
          </p>
        )}
        <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">{title}</h2>
        {sub && <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">{sub}</p>}
      </div>
      <div className="space-y-6">{children}</div>
      {error && <p className="mt-3 text-[15px] leading-relaxed break-keep text-danger">{error}</p>}
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
  anchor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: string;
  /** 막힌 칸으로 스크롤할 때 찾는 이름(`f-<anchor>`). */
  anchor?: string;
  /** 🙋칸 바로 밑에 뜨는 말 — 한 번 눌러 본 뒤, 이 칸이 막고 있을 때만(09-17). */
  error?: string;
  children: React.ReactNode;
}) {
  return (
    // 📐09-18 밤 QA(H-18) — 막힌 칸으로 데려갈 때도 라벨이 헤더 밑에 깔린다. 절과 같은 값으로 비켜 둔다.
    <div id={anchor ? `f-${anchor}` : undefined} className="scroll-mt-24">
      {/* 🏷09-18 밤 QA(H-28) — 칸이 «하나의 입력»이 아닌 자리(사진 격자·설비 알약·안내 방식·등록증 고르기)에서도
          이 머리를 `<label>`로 그렸다. 가리키는 것이 없는 라벨은 낭독기에서 빈 이름으로 읽히고, 눌러도 아무 데도 안 간다.
          ⭐가리킬 칸이 있을 때만 라벨이다. 없으면 그냥 제목(`<p>`)이다 — 보이는 모양은 같다. */}
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-2 block text-[16px] font-medium text-body">
          {label}
          {optional && <span className="ml-1 text-[15px] font-normal text-faint">· 선택</span>}
        </label>
      ) : (
        <p className="mb-2 block text-[16px] font-medium text-body">
          {label}
          {optional && <span className="ml-1 text-[15px] font-normal text-faint">· 선택</span>}
        </p>
      )}
      {hint && <p className="-mt-0.5 mb-2 text-[15px] leading-relaxed break-keep text-faint">{hint}</p>}
      {children}
      {error && <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{error}</p>}
    </div>
  );
}
