"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createMakerAction,
  getAnalysisPartnerAction,
  setMakerPasswordAction,
  getAuthStateAction,
  updateMakerAction,
  getEditDataAction,
  getPreviewDemoNoneAction,
  lookupPlaceAction,
  clearOwnerNoteAction,
} from "@/lib/actions";
import { MakerArticle } from "../m/[slug]/MakerArticle";
import type { CollabType, Block, Maker, Enrichment } from "@/lib/types";
import { deriveRegion } from "@/lib/region";
import { isRichIntro } from "@/lib/completeness";
import { MAX_ACTIVITIES, MAX_COLLABS } from "@/lib/limits";
import { uploadPhoto, uploadPdf } from "@/lib/upload";
import { mapLinkLabel, instagramSlug, parseLatLngFromMapUrl } from "@/lib/links";
import { MapCard } from "@/components/MapCard";
import { useDismissable } from "@/components/useDismissable";
import { EnrichIntroSheet } from "./EnrichIntroSheet";
import { PasswordInput } from "@/components/PasswordInput";
import { track } from "@/lib/track";
import type { ActivityHint, CollabHint, EnrichField } from "@/lib/enrich";
import { blendDescriptions, canRegenDesc, noteRegenDesc } from "@/lib/enrichBlend";
import { useDraftAutosave, draftKey, agoLabel } from "./useDraftAutosave";
import { EnrichWizard, type WizardFill } from "./EnrichWizard";
import { SortableCard, emptyDnd, type DndState } from "./SortableCard";
import { BlockEditor, emptyBlock } from "./BlockEditor";
import { PhotoGrid } from "./PhotoGrid";
import { StubSection } from "./StubSection";

// 배열 내 순서 이동 (드래그 재정렬용)
function reorder<T>(arr: T[], from: number, to: number): T[] {
  const c = [...arr];
  const [x] = c.splice(from, 1);
  c.splice(to, 0, x);
  return c;
}

// unknown → 문자열 배열(공백 제거) — enrich 응답 파싱 공용
function toStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && !!s.trim()) : [];
}

// 짝 없는 따옴표 정리 — 크롤 제목에 열림 없이 닫힘만 남는 경우가 있어(예: 「레이지오터" 기사」)
// 홀수 개(=짝 안 맞음)면 해당 종류 따옴표를 모두 제거. 스마트 따옴표는 열림/닫힘 수가 다르면 제거.
function balanceQuotes(s: string): string {
  let out = s;
  for (const q of ['"', "'"]) {
    if ((out.split(q).length - 1) % 2 === 1) out = out.split(q).join("");
  }
  if ((out.match(/[“]/g) || []).length !== (out.match(/[”]/g) || []).length) out = out.replace(/[“”]/g, "");
  if ((out.match(/[‘]/g) || []).length !== (out.match(/[’]/g) || []).length) out = out.replace(/[‘’]/g, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

// 폼이 들고 있는 사진 한 장. 선택 즉시 Storage 업로드 → 제출 시 URL만 전송.
//   uploading = 올리는 중(objectURL 프리뷰)  /  failed = 실패 사유(타일에 그대로 보여줄 짧은 말)
//   file      = 재시도용 원본 핸들. 실패해도 파일을 다시 고르지 않게.
// ⚠️ `failed`인 항목의 url은 **blob:** 이다 — 제출·임시저장에 절대 섞이면 안 된다(`uploadedUrls`·`keepPhotos`).
type Ph = { url: string; uploading?: boolean; failed?: string; file?: File };
const uploadedUrls = (ps: Ph[]) => ps.filter((p) => !p.uploading && !p.failed).map((p) => p.url);

// 편집 중 콜라보 이력 — 활동(activities)과 동일한 인라인 카드 패턴.
// typeInput·typeInputOpen은 UI 로컬 상태(전송 제외).
type HistItem = {
  partner: string;
  types: string[];
  desc: string;
  year: string;
  photos: Ph[];
  link: string; // 관련 링크(블로그·후기 등, 선택)
  typeInput: string;
  typeInputOpen: boolean; // '+ 유형 직접 추가' 토글(입력창 노출 여부)
};
const emptyHist = (): HistItem => ({
  partner: "",
  types: [],
  desc: "",
  year: "",
  photos: [],
  link: "",
  typeInput: "",
  typeInputOpen: false,
});

const COLLAB_TYPES: CollabType[] = [
  "제품콜라보",
  "팝업",
  "워크숍",
  "공동굿즈",
  "공동콘텐츠",
  "행사참여",
  "공간대여",
];

// 브랜드 표현 어휘 — 4카테고리(감성·가치·스타일·성격). 직접 추가 가능, 최대 10개 선택.
const VIBE_CATEGORIES: { label: string; words: string[] }[] = [
  { label: "브랜드 감성", words: ["따뜻함", "감성", "정성", "손맛", "핸드메이드", "큐레이션"] },
  { label: "브랜드 가치", words: ["지속가능", "친환경", "로컬", "윤리적", "사회적 가치", "공정무역"] },
  { label: "브랜드 스타일", words: ["미니멀", "클래식", "빈티지", "모던", "실험적", "프리미엄"] },
  { label: "브랜드 성격", words: ["위트", "대담함", "유쾌함", "진정성", "감각적", "섬세함"] },
];
const ALL_VIBES = VIBE_CATEGORIES.flatMap((c) => c.words);
const MAX_VIBES = 10;

// 타겟 고객 추천 어휘 — 분위기칩과 동일 패턴. 직접 추가 가능.
const SUGGESTED_AUDIENCE = [
  "20-30대 여성",
  "20-30대 남성",
  "30-40대",
  "로컬 주민",
  "직장인",
  "학생",
  "가족 단위",
  "여행자",
  "감성 소비층",
  "친환경 관심층",
  "반려인",
  "비건",
];

// 콜라보 이력 년도 선택지 — 1991~2030 (최신순 정렬)
const HISTORY_YEARS = Array.from({ length: 2030 - 1991 + 1 }, (_, i) => String(2030 - i));

// 접힘/펼침 가능한 옵션 섹션 키 — openSections(Set)로 어떤 섹션이 펼쳐져 있는지 단일 관리.
type SectionKey = "story" | "activities" | "collabs" | "keywords" | "customers" | "offersNote" | "seeks";

// 데모 프리필(캔버스가든) — `/register?demo=1`로 열면 텍스트가 채워진 상태로 시작(사진은 직접 첨부).
const DEMO_PREFILL = {
  name: "캔버스가든",
  oneLiner: "쓰던 옷이 새 가방으로, 새로운 시작을 선물해요.",
  description:
    '캔버스가든은 버려지는 천과 구제 의류를 새 생명으로 불어넣는 업사이클링 브랜드예요. "저거 참 예쁜데, 저거 참 비싸네."라는 생각에서 시작해, "저거 참 아까운데."라는 마음으로 쓰레기가 될 소재에 디자인을 입히고 있어요. 당신만의 특별함을 더할 수 있도록 돕는 것이 저희의 가장 큰 기쁨이에요.',
  story:
    "회사를 그만두고 손으로 무언가를 만들기 시작할 때, 가장 눈에 들어온 건 버려지는 천들이었어요. 누군가 오래 입던 옷, 쓸모를 다했다고 여겨진 조각들이요. 그걸 모아 수선하다 보니, 무언가를 새롭게 이야기에 입히는 일이 제일 저다웠습니다. 그렇게 캔버스가든이 시작됐어요.",
  values: ["감성", "사회적 가치", "업사이클링", "지속 가능성", "자기표현"],
  activities: [
    {
      title: "헌옷의 재발견, 조각 프로젝트",
      desc: "5주간 진행되는 헌옷을 활용한 나만의 엽서 만들기, 나만의 가방 만들기 워크숍",
    },
    { title: "온라인 가방 샵", desc: "업사이클링 원단을 활용한 가방 제작" },
  ],
  offersNote:
    "1. 제품으로는 다른 브랜드와 함께 업사이클링 가방·소품을 만드는 콜라보를 할 수 있어요.\n2. 의미로는 플리마켓에 참여하여 캔버스가든의 의미를 함께 전하는 콜라보들을 할 수 있을 것 같아요.",
  offers: ["제품콜라보", "팝업", "워크숍", "공동굿즈"] as CollabType[],
  seeksNote: "지속가능한 가치, 유니크한 매력, 상생과 관련한 초기·중기 브랜드 모두 환영해요!",
  seeks: ["제품콜라보", "워크숍", "공동콘텐츠"] as CollabType[],
  targetAudience: ["20-30대 여성", "30-40대", "독립적·자립적 가치관을 중시하는 여성층"],
  address: "서울특별시 성북구 보문로 56 5층",
  instagram: "@canvasgarden_official",
  homepage: "https://canvasgarden.shop",
  history: { partner: "비오드", types: ["제품콜라보"], year: "2025" },
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[60vh] w-full max-w-[640px] flex-col items-center justify-center px-4 text-center">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParam = searchParams.get("edit");
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [offers, setOffers] = useState<CollabType[]>([]);
  const [seeks, setSeeks] = useState<CollabType[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [customVibe, setCustomVibe] = useState("");
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState("");
  const [collabHistory, setCollabHistory] = useState<HistItem[]>([emptyHist()]);
  const [searchVisible, setSearchVisible] = useState(true); // [콜라보 찾기에 보이기](기본 on)
  const [collabPaused, setCollabPaused] = useState(false); // [콜라보 요청 잠시 안받기](기본 off — 아무도 갑자기 잠기지 않게)
  const [instagram, setInstagram] = useState("");
  const [homepage, setHomepage] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [mapUrlEditing, setMapUrlEditing] = useState(false);
  // 지도 필드 미리보기용 핀 — 링크 문자열에서 그냥 꺼낸다(콜 0). 못 뽑으면 null → 지도 안 그림.
  const mapPin = parseLatLngFromMapUrl(mapUrl);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [photos, setPhotos] = useState<Ph[]>([]);
  // ── 소개서 개편 신규 필드 ──
  const [story, setStory] = useState("");
  const [activities, setActivities] = useState<
    { title: string; desc: string; photos: Ph[]; link: string }[]
  >([{ title: "", desc: "", photos: [], link: "" }]);
  // 카드 순서변경(드래그·↑↓) 상태 — 활동·콜라보 각각.
  const [actDnd, setActDnd] = useState<DndState>(emptyDnd);
  const [colDnd, setColDnd] = useState<DndState>(emptyDnd);
  const [offersNote, setOffersNote] = useState("");
  const [seeksNote, setSeeksNote] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [enrichment, setEnrichment] = useState<Enrichment | undefined>(undefined);
  const [blocksUploading, setBlocksUploading] = useState(false);
  const [introFileUrl, setIntroFileUrl] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const region = deriveRegion(address); // 주소에서 자동 추출 (별도 입력 없음)
  // 네이버 주소 자동 채움 — 채워졌음을 알리고 되돌릴 수 있게(대표 지시 07-31: 버튼 없이 바로 채우기).
  const [addrAuto, setAddrAuto] = useState<{ prev: string } | null>(null);
  const lookedUpRef = useRef(""); // 같은 (상호|지도링크)로 두 번 조회하지 않기 위한 키

  // 네이버 지역검색으로 상세주소 자동 채움 (대표 지시 07-31 — 버튼 없이 결과 있으면 바로)
  //
  // 트리거 2개, 덮어쓰기 정책이 서로 다르다:
  //   ⓐ 주소가 **비어 있을 때** → 채운다. (덮어쓸 게 없으니 안전)
  //   ⓑ **지도 링크가 새로 들어왔을 때** → 수기로 쓴 주소가 있어도 **덮어쓴다**(대표 확정).
  //      사장님이 주소를 먼저 손으로 쓰고 나중에 지도 링크를 붙여넣는 흐름이 흔한데,
  //      이때 네이버가 준 도로명 주소가 더 정확하다(상세주소·층수까지 온다).
  //
  // ⚠️ 덮어쓰기를 **지도 링크가 바뀌는 순간에만** 한정한 이유:
  //    매 입력마다 덮으면 자동으로 채워진 주소를 **사장님이 영영 고칠 수 없다**(고치는 즉시 되돌아감).
  //    링크가 바뀔 때만 덮으므로, 그 뒤 수정은 그대로 남는다.
  // ⚠️ 조회는 **상호명**으로 한다 — 붙여넣은 지도 URL은 주소로 바꿀 수 없다(place ID→주소 공식 API
  //    없음, 스크래핑 403/429). 근거 = lib/naver-local.ts 상단.
  useEffect(() => {
    const brand = name.trim();
    if (brand.length < 2) return;
    const hasMap = !!mapLinkLabel(mapUrl);
    const addrEmpty = !address.trim();
    if (!hasMap && !addrEmpty) return; // 채울 이유도, 덮을 계기도 없음
    // 링크가 바뀌면 키가 바뀌어 다시 조회된다(= 덮어쓰기 계기). 상호만 같으면 재조회 안 함.
    const key = `${brand}|${hasMap ? mapUrl.trim() : ""}`;
    if (lookedUpRef.current === key) return;
    lookedUpRef.current = key;

    let alive = true;
    const t = window.setTimeout(async () => {
      const r = await lookupPlaceAction(brand, region || undefined);
      if (!alive || !r.address) return;
      setAddress((prev) => {
        if (prev.trim() === r.address!.trim()) return prev; // 같으면 안내도 띄우지 않는다
        // 덮어쓰는 경우에만 '되돌리기'를 준다. 빈 칸을 채운 건 되돌릴 게 없다.
        if (prev.trim()) setAddrAuto({ prev });
        return r.address!;
      });
      // 지도 링크가 아직 없으면 좌표로 만든 링크도 함께 채운다(사장님이 URL을 찾아 붙일 필요가 없어짐)
      if (r.mapUrl && !mapLinkLabel(mapUrl)) setMapUrl(r.mapUrl);
    }, 600); // 타이핑 중 매 글자 조회 방지
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // region은 address에서 파생 — 의존성에 넣으면 채운 직후 다시 돌아 루프가 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, mapUrl, address]);

  // ── 섹션 펼침 상태 (스텁·시트 섹션 공용 단일 상태) ──
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set());
  const openSection = (k: SectionKey) =>
    setOpenSections((s) => new Set(s).add(k));
  const closeSection = (k: SectionKey) =>
    setOpenSections((s) => { const n = new Set(s); n.delete(k); return n; });
  // 시트 '브랜드 이야기' 그룹에서 추가 → 정본 위치에 펼치고 스크롤(블록 add 앵커 패턴 재사용)
  const addStorySection = (k: SectionKey) => {
    openSection(k);
    setTimeout(() => {
      document.getElementById(`sec-${k}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  // 데이터 존재 판정 — 제출 payload 단일 관문·완성도·스텁 hasData 공용.
  const hasStory = !!story.trim();
  const hasActivities = activities.some(
    (a) => a.title.trim() || a.desc.trim() || a.photos.length > 0 || a.link.trim()
  );
  // types(콜라보 유형 칩)·link까지 봐야 함 — 아래 filledHist 필터와 조건이 어긋나면
  // 그 신호만 있는 카드가 filledHist엔 남는데 이 게이트에서 걸려 전체가 []로 저장됨(유실).
  const hasCollabs = collabHistory.some(
    (h) => h.partner.trim() || h.types.length > 0 || h.desc.trim() || h.photos.length > 0 || h.link.trim()
  );
  const hasKeywords = values.length > 0;
  const hasCustomers = targetAudience.length > 0;
  const hasOffersNote = !!offersNote.trim();
  const hasSeeks = !!seeksNote.trim(); // 구 seeks 칩 은퇴(2026-07-22 통합) — 파트너상 서술만 남음

  // ── enrich(딸깍 자동완성) 상태 ──
  const [query, setQuery] = useState(""); // 불러오기 검색어(업체명만)
  const [wizardOpen, setWizardOpen] = useState(false); // 딸깍 자동완성 위저드
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set()); // AI가 채운 필드
  const [missing, setMissing] = useState<EnrichField[]>([]); // 못 찾은 필드(직접 입력 노티)
  const [reviewMode, setReviewMode] = useState(false); // 검수 게이트 배너
  // 크롤이 발견한 활동·콜라보 힌트(참고용, 세션 한정 — 저장 안 함)
  const [actHints, setActHints] = useState<ActivityHint[]>([]);
  const [collabHints, setCollabHints] = useState<CollabHint[]>([]);
  const [usedActHints, setUsedActHints] = useState<Set<number>>(new Set());
  const [usedCollabHints, setUsedCollabHints] = useState<Set<number>>(new Set());

  // ── 초안받기 상태 ──
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false); // AI 초안을 한 번이라도 생성했나(버튼 분기 기준)
  const [draftRound, setDraftRound] = useState(0); // 다시 받기마다 다른 각도로 변주
  const [descChoices, setDescChoices] = useState<string[]>([]); // 자세히 소개 후보(각 항목 직접 수정 가능)
  const [descSel, setDescSel] = useState(0); // 선택한 후보 인덱스 (-1 = 직접 입력)
  const [descModalOpen, setDescModalOpen] = useState(false); // 초안받기 2스텝 모달
  const [draftStep, setDraftStep] = useState<1 | 2>(1); // 1=한 줄 소개, 2=자세히 소개
  const [olChoices, setOlChoices] = useState<string[]>([]); // 한 줄 소개 후보
  const [olSel, setOlSel] = useState(0); // 선택한 한 줄 후보 인덱스 (-1 = 직접 입력)
  const [olCustom, setOlCustom] = useState(""); // 한 줄 소개 직접 입력값
  const [descCustom, setDescCustom] = useState(""); // 자세히 소개 직접 입력값
  // ── 한 줄 선택 → 자세히 유기적 반영(트리거 1) 상태 ──
  const [olOriginal, setOlOriginal] = useState<string[]>([]); // AI 생성 원본 한 줄(수정 감지용)
  const [descOriginal, setDescOriginal] = useState<string[]>([]); // 사전 생성 자세히 풀(블렌드 '자유 M' 소스)
  const [draftResearchMemo, setDraftResearchMemo] = useState(""); // draft2가 쓴 조사메모 캐시(재생성 재사용→재크롤 방지)
  const [descRegenBusy, setDescRegenBusy] = useState(false); // 자세히 재생성 로딩(스텝2)
  const [lastRegenOl, setLastRegenOl] = useState(""); // 마지막으로 재생성한 한 줄(같은 한줄 재요청 시 캐시 재사용)
  // 세션 재생성 상한은 모듈 공유 카운터(canRegenDesc/noteRegenDesc) — 모달·위저드 합산

  // 데모 프리필: `/register?demo=1` 진입 시 캔버스가든 예시로 텍스트를 채워 시작(사진은 직접).
  // URL 파라미터 기반 1회성 초기화 — 지연 초기값을 쓰면 SSR(window 부재)과 하이드레이션 불일치가 나므로 effect로 처리.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("demo") !== "1") return;
    const d = DEMO_PREFILL;
    setName(d.name);
    setOneLiner(d.oneLiner);
    setDescription(d.description);
    setStory(d.story);
    setValues(d.values);
    setActivities(d.activities.map((a) => ({ title: a.title, desc: a.desc, photos: [], link: "" })));
    setOffersNote(d.offersNote);
    setOffers([...new Set([...d.offers, ...d.seeks])] as CollabType[]); // 구 seeks 칩 흡수(통합)
    setSeeksNote(d.seeksNote);
    setSeeks([]);
    setTargetAudience(d.targetAudience);
    setAddress(d.address);
    setInstagram(d.instagram);
    setHomepage(d.homepage);
    setCollabHistory([
      { partner: d.history.partner, types: d.history.types, desc: "", year: d.history.year, photos: [], link: "", typeInput: "", typeInputOpen: false },
    ]);
    setBlocks([
      { type: "metrics", uid: crypto.randomUUID(), photos: [], links: [], items: [{ label: "인스타 팔로워", value: "1.2만" }, { label: "누적 워크숍", value: "48회" }] },
    ]);
    setAiFilled(new Set([
      "name", "oneLiner", "description", "values", "address", "instagram", "homepage",
      // 섹션 헤더 배지용 — 데모가 채우는 섹션들
      "keywords", "story", "activities", "seeks", "collabs", "customers",
    ]));
    setDraftGenerated(true);
    // 데모 = 대표 시연 도구 — 데모가 채우는 섹션 전부 펼쳐진 채 시작(안 보이는 채 제출되는 상태 방지)
    setOpenSections(
      new Set<SectionKey>(["story", "activities", "collabs", "keywords", "customers", "offersNote", "seeks"])
    );
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = (
    list: CollabType[],
    setList: (v: CollabType[]) => void,
    t: CollabType
  ) => setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);

  const toggleVibe = (v: string) =>
    setValues((p) =>
      p.includes(v) ? p.filter((x) => x !== v) : p.length >= MAX_VIBES ? p : [...p, v]
    );

  const addCustomVibe = () => {
    const v = customVibe.trim();
    if (v && !values.includes(v) && values.length < MAX_VIBES) setValues((p) => [...p, v]);
    setCustomVibe("");
  };

  // ── 타겟 고객 (분위기칩과 동일 패턴) ──
  const toggleAudience = (a: string) =>
    setTargetAudience((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const addCustomAudience = () => {
    const a = customAudience.trim();
    if (a && !targetAudience.includes(a)) setTargetAudience((p) => [...p, a]);
    setCustomAudience("");
  };

  // ── 콜라보 이력 (활동과 동일한 인라인 카드 패턴, 상한 = MAX_COLLABS) ──
  // 카드 순서변경(↑↓·드래그) 후 이동한 자리로 부드럽게 스크롤 — 수동 스크롤 불필요.
  // id는 위치 기반(`${idBase}-${to}`)이라 재정렬 후 그 자리에 이동한 카드가 있음.
  const scrollCardTo = (idBase: string, to: number) => {
    setTimeout(() => {
      document
        .getElementById(`${idBase}-${to}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 30);
  };
  const addCollab = () =>
    setCollabHistory((p) => (p.length >= MAX_COLLABS ? p : [...p, emptyHist()]));
  const moveCollab = (from: number, to: number) => {
    setCollabHistory((p) => reorder(p, from, to));
    scrollCardTo("col-card", to);
  };
  const removeCollab = (i: number) =>
    setCollabHistory((p) => p.filter((_, j) => j !== i));
  const setHist = (i: number, patch: Partial<HistItem>) =>
    setCollabHistory((p) => p.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const toggleHistType = (i: number, t: string) =>
    setCollabHistory((p) =>
      p.map((h, j) =>
        j === i
          ? { ...h, types: h.types.includes(t) ? h.types.filter((x) => x !== t) : [...h.types, t] }
          : h
      )
    );
  const addHistCustomType = (i: number) =>
    setCollabHistory((p) =>
      p.map((h, j) => {
        if (j !== i) return h;
        const t = h.typeInput.trim();
        return t && !h.types.includes(t)
          ? { ...h, types: [...h.types, t], typeInput: "" }
          : { ...h, typeInput: "" };
      })
    );
  // 선택 즉시 업로드: objectURL 프리뷰+스피너 → 완료 시 publicUrl로 교체, 실패 시 **실패 타일로 남긴다**.
  //
  // ⚠️ 전엔 실패하면 타일을 지우고 알럿만 띄웠다 — 여러 장을 한꺼번에 올리면
  //    "몇 번째 사진이 실패했는지"를 알 길이 없고, 사용자는 다시 파일 고르기부터 해야 했다.
  //    이제 그 자리에 실패 타일이 남고 [다시 올리기]로 그 파일만 재시도한다(파일 핸들 보관).
  const uploadInto = (
    files: FileList | null,
    room: number,
    maxDim: number,
    update: (f: (p: Ph[]) => Ph[]) => void
  ) => {
    Array.from(files ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, room))
      .forEach((f) => {
        const preview = URL.createObjectURL(f);
        update((p) => [...p, { url: preview, uploading: true, file: f }]);
        runUpload(f, preview, maxDim, update);
      });
  };
  // 한 장 올리기 — 최초 업로드와 '다시 올리기'가 같은 경로를 탄다.
  const runUpload = (
    file: File,
    preview: string,
    maxDim: number,
    update: (f: (p: Ph[]) => Ph[]) => void
  ) => {
    uploadPhoto(file, maxDim)
      // 사용자가 먼저 ✕로 지웠으면 이 map은 찾을 항목이 없어 아무 일도 안 한다(안전)
      .then((url) => update((p) => p.map((x) => (x.url === preview ? { url } : x))))
      .catch((e: unknown) => {
        const msg = String((e as Error)?.message ?? "");
        // ⭐어느 단계에서 멈췄는지 콘솔에 남긴다(timeout:sign|resize|upload).
        //   다음에 또 멈추면 이 한 줄이 원인 특정의 출발점이다 — 지금은 트리거를 모른다.
        console.warn("[photo-upload]", msg, file.name, file.size, file.type);
        update((p) =>
          p.map((x) =>
            x.url === preview
              ? {
                  ...x,
                  uploading: false,
                  // 왜 실패했는지 타일에 적는다 — "실패"만으론 같은 상황이 반복된다
                  failed: msg.startsWith("timeout") ? "시간 초과" : "업로드 실패",
                }
              : x
          )
        );
      });
  };
  // 실패 타일 재시도 — 보관해둔 File로 같은 자리에서 다시 올린다.
  const retryPhoto = (ps: Ph[], i: number, maxDim: number, update: (f: (p: Ph[]) => Ph[]) => void) => {
    const it = ps[i];
    if (!it?.file) return;
    update((p) => p.map((x, j) => (j === i ? { ...x, uploading: true, failed: undefined } : x)));
    runUpload(it.file, it.url, maxDim, update);
  };

  const addHistPhotos = (i: number, files: FileList | null) =>
    uploadInto(files, 5 - (collabHistory[i]?.photos.length ?? 0), 800, (f) =>
      setCollabHistory((p) => p.map((h, j) => (j === i ? { ...h, photos: f(h.photos) } : h)))
    );
  const removeHistPhoto = (i: number, k: number) =>
    setCollabHistory((p) =>
      p.map((h, j) => (j === i ? { ...h, photos: h.photos.filter((_, x) => x !== k) } : h))
    );
  const moveHistPhoto = (i: number, from: number, to: number) =>
    setCollabHistory((p) =>
      p.map((h, j) => (j === i ? { ...h, photos: reorder(h.photos, from, to) } : h))
    );
  const retryHistPhoto = (i: number, k: number) =>
    retryPhoto(collabHistory[i]?.photos ?? [], k, 800, (f) =>
      setCollabHistory((p) => p.map((h, j) => (j === i ? { ...h, photos: f(h.photos) } : h)))
    );

  // ── 대표 활동 (상한 = MAX_ACTIVITIES) ──
  const addActivity = () =>
    setActivities((p) =>
      p.length >= MAX_ACTIVITIES ? p : [...p, { title: "", desc: "", photos: [], link: "" }]
    );
  const moveActivity = (from: number, to: number) => {
    setActivities((p) => reorder(p, from, to));
    scrollCardTo("act-card", to);
  };
  const setAct = (i: number, patch: Partial<{ title: string; desc: string; link: string }>) =>
    setActivities((p) => p.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const addActPhotos = (i: number, files: FileList | null) =>
    uploadInto(files, 5 - (activities[i]?.photos.length ?? 0), 800, (f) =>
      setActivities((p) => p.map((a, j) => (j === i ? { ...a, photos: f(a.photos) } : a)))
    );
  const removeActPhoto = (i: number, k: number) =>
    setActivities((p) =>
      p.map((a, j) => (j === i ? { ...a, photos: a.photos.filter((_, x) => x !== k) } : a))
    );
  const moveActPhoto = (i: number, from: number, to: number) =>
    setActivities((p) =>
      p.map((a, j) => (j === i ? { ...a, photos: reorder(a.photos, from, to) } : a))
    );
  const retryActPhoto = (i: number, k: number) =>
    retryPhoto(activities[i]?.photos ?? [], k, 800, (f) =>
      setActivities((p) => p.map((a, j) => (j === i ? { ...a, photos: f(a.photos) } : a)))
    );
  const removeActivity = (i: number) =>
    setActivities((p) => p.filter((_, j) => j !== i));

  const onPhotos = (files: FileList | null) =>
    uploadInto(files, 10 - photos.length, 1000, setPhotos);

  // 소개자료 PDF 첨부 (선택 · 10MB 이하)
  const onIntroPdf = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setPdfUploading(true);
    try {
      setIntroFileUrl(await uploadPdf(f));
    } catch (e) {
      alert(
        e instanceof Error && e.message === "too-large"
          ? "10MB 이하 PDF만 담을 수 있어요."
          : "업로드에 실패했어요. 다시 시도해주세요."
      );
    } finally {
      setPdfUploading(false);
    }
  };

  // 규칙 기반 소개 초안 폴백 텍스트 (AI 실패 시 — 입력값 조합)
  const ruleDraftText = () => {
    const parts: string[] = [];
    if (oneLiner.trim()) parts.push(oneLiner.trim().replace(/[.\s]*$/, "."));
    if (values.length)
      parts.push(`${values.slice(0, 3).join(", ")} — 우리를 잘 보여주는 말이에요.`);
    if (name.trim()) parts.push(`${name.trim()}의 이야기를 카드에 담았어요.`);
    return parts.join(" ");
  };

  // 초안 다시 받기: AI 크롤(enrichment)한 소개서 전용(대표 정책 2026-07-22 — 버튼 노출도 enrichment 게이트).
  // 모달 즉시 오픈(로딩) → 한 줄/자세히 후보 병렬 생성 → 2스텝 선택. round 증가 = 다른 각도 변주.
  // 재료 = 위저드 생성과 동일 규칙 미러: 씨앗(주소 파생 region·seed.businessType) + 칩(사실 게이트 통과분).
  const draftDescription = async () => {
    if (!name.trim() || draftBusy) return;
    setDraftBusy(true);
    setDraftStep(1);
    setDescModalOpen(true);
    // 칩 매핑 — 위저드 generate()와 동일: factual인데 미확인이면 제외, 별표→starred, 별표+직접쓴 칩→verbatim
    const usableChips = (enrichment?.chips ?? []).filter((c) => !c.factual || c.confirmed);
    const starredChips = usableChips.filter((c) => c.starred).map((c) => c.text);
    const payload = {
      name: name.trim(),
      // 크롤 씨앗 — 주소가 폼에 있으면 그 파생 region 우선, 없으면 생성 때 저장한 seed.region
      region: deriveRegion(address) || enrichment?.seed.region || undefined,
      businessType: enrichment?.seed.businessType || undefined,
      oneLiner,
      values,
      offers,
      targetAudience,
      focusKeywords: usableChips.map((c) => c.text),
      starredKeywords: starredChips,
      verbatimKeywords: usableChips
        .filter((c) => c.starred && c.section === "직접")
        .map((c) => c.text),
      // 특장점(B35) — 스냅샷에서 재전달해 다시 받아도 유지. 지우려면 다시 받기 옆 [지우기](보이지 않는 재주입 방지).
      ownerNote: enrichment?.ownerNote || undefined,
      // 폼에 적힌 홈페이지 → 서버가 직접 읽어 초안에 반영(딥리드). URL만 보낸다.
      homepage: homepage.trim() || undefined,
      // 폼에 적힌 인스타 핸들 → 서버가 바이오·캡션을 직접 읽는다(사장님 글 딥리드).
      instagram: instagram.trim() || undefined,
      round: draftRound,
    };
    const strs = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === "string" && !!s.trim())
        : [];
    try {
      // draft2 = 한 줄 3개 + 자세히 5개를 크롤 1회로 한 번에(이중 크롤 제거)
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "draft2", ...payload }),
      })
        .then((r) => r.json())
        .catch(() => ({}));
      const ols = strs(res.oneLiners);
      let descs = strs(res.descriptions);
      if (!descs.length) {
        const fallback = ruleDraftText(); // AI 실패 → 규칙 기반 폴백 후보 1개
        if (fallback) descs = [fallback];
      }
      setOlChoices(ols);
      setOlOriginal(ols); // 수정 감지 기준(원본 스냅샷)
      setOlSel(ols.length ? 0 : -1);
      setOlCustom("");
      setDescChoices(descs);
      setDescOriginal(descs); // 블렌드 '자유 M'의 원본 풀(사전 생성분)
      setDescSel(descs.length ? 0 : -1);
      setDescCustom("");
      // 새 초안이 도착했으니 자세히 재생성 캐시 리셋(세션 횟수 카운터는 유지 = 상한 규율)
      setDraftResearchMemo(typeof res.researchMemo === "string" ? res.researchMemo : "");
      setLastRegenOl("");
    } finally {
      setDraftGenerated(true);
      setDraftRound((r) => r + 1);
      setDraftBusy(false);
    }
  };
  // 스텝1 '다음' — 한 줄을 '수정'/'직접입력'으로 바꿨으면 그 한 줄을 관통 주제로 자세히 5개 재생성(+1 콜).
  // 사전 후보 중 다른 번호만 고른 경우는 재생성 안 함. 비용 가드: 같은 한줄 캐시·세션 상한.
  const goToDescStep = async () => {
    const chosen = (olSel === -1 ? olCustom : olChoices[olSel] ?? "").trim();
    const isCustom = olSel === -1 && !!chosen; // 맨 아래 직접입력
    const isEdited = olSel >= 0 && !!chosen && chosen !== (olOriginal[olSel] ?? "").trim(); // '수정'으로 원본과 달라짐
    const shouldRegen =
      (isCustom || isEdited) &&
      chosen !== lastRegenOl && // 같은 한줄로 다시 오면 캐시 재사용(재콜 X)
      canRegenDesc(); // 세션 전역 상한(모달·위저드 공유)
    setDraftStep(2);
    if (!shouldRegen) return;
    setDescRegenBusy(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "descFromOneLiner",
          name: name.trim(),
          chosenOneLiner: chosen,
          researchMemo: draftResearchMemo || undefined,
          ownerNote: enrichment?.ownerNote || undefined, // 특장점(B35) — 한 줄 바꿔도 유지
          values,
          homepage: homepage.trim() || undefined,
          instagram: instagram.trim() || undefined,
        }),
      })
        .then((r) => r.json())
        .catch(() => ({}));
      const anchors = toStrArr(res.anchors);
      if (anchors.length) {
        // 앵커 N + 사전 생성 풀에서 자유 M 블렌드(비율은 enrichBlend 상수가 결정)
        setDescChoices(blendDescriptions(anchors, descOriginal));
        setDescSel(0);
        setDescCustom("");
        setLastRegenOl(chosen);
        noteRegenDesc();
      }
      // anchors 비면 기존 자세히 후보 그대로 유지(조용한 저하)
    } finally {
      setDescRegenBusy(false);
    }
  };
  const editDescChoice = (i: number, v: string) =>
    setDescChoices((p) => p.map((x, j) => (j === i ? v : x)));
  const editOlChoice = (i: number, v: string) =>
    setOlChoices((p) => p.map((x, j) => (j === i ? v : x)));
  // [확인] — 한 줄·자세히 선택값을 둘 다 채움. 빈 선택이면 해당 필드는 유지(덮지 않음).
  const applyDraft = () => {
    const ol = (olSel === -1 ? olCustom : olChoices[olSel] ?? "").trim();
    const d = (descSel === -1 ? descCustom : descChoices[descSel] ?? "").trim();
    if (ol) setOneLiner(ol);
    if (d) setDescription(d);
    if (ol || d)
      setAiFilled((s) => {
        const n = new Set(s);
        if (ol) n.add("oneLiner");
        if (d) n.add("description");
        return n;
      });
    setDescModalOpen(false);
  };

  // ── enrich: 업체명 → 위저드 오픈(불러오기) ──
  // ⭐AI 플로우의 **첫 관문**이라 disabled로 막으면 진입 자체가 봉쇄된다 — 눌리게 두고 왜 안 되는지 말해준다(QA #17).
  const [queryErr, setQueryErr] = useState("");
  const openWizard = () => {
    if (!query.trim()) {
      setQueryErr("브랜드 이름을 알려주세요.");
      return;
    }
    setQueryErr("");
    setWizardOpen(true);
  };

  // 힌트 '이 내용으로 시작하기' — 빈 카드 우선 채움, 없으면 새 카드(최대 5), 꽉 차면 불가.
  // inject* = 힌트 값 직접 주입: 위저드 ⑤스텝 즉시 적용은 setActHints 직후라 state 힌트를
  // 못 읽는 타이밍이므로 값 기반으로 분리(functional setState라 연속 주입도 안전).
  const injectActHint = (h: ActivityHint) => {
    setActivities((p) => {
      const empty = p.findIndex((a) => !a.title.trim() && !a.desc.trim() && !a.photos.length);
      if (empty >= 0)
        return p.map((a, j) => (j === empty ? { ...a, title: h.title, desc: h.desc } : a));
      if (p.length < MAX_ACTIVITIES)
        return [...p, { title: h.title, desc: h.desc, photos: [], link: "" }];
      return p;
    });
  };
  const applyActHint = (i: number) => {
    const h = actHints[i];
    if (!h) return;
    injectActHint(h);
    setUsedActHints((s) => new Set(s).add(i));
  };
  const canApplyActHint =
    activities.some((a) => !a.title.trim() && !a.desc.trim() && !a.photos.length) ||
    activities.length < MAX_ACTIVITIES;
  const injectCollabHint = (h: CollabHint) => {
    setCollabHistory((p) => {
      const empty = p.findIndex(
        (c) => !c.partner.trim() && !c.desc.trim() && !c.types.length && !c.photos.length
      );
      // 🆕`year`도 같이 싣는다(08-10) — 안 실으면 크롤이 애써 뽑은 연도가 폼에서 증발하고,
      //   소개서엔 연도가 안 뜨며 "최신순"이 사장님 눈에 근거 없는 순서로 보인다.
      //   ⚠️`h.year`가 없으면 `undefined`라 기존 값을 덮지 않는다(빈칸 채움만).
      if (empty >= 0)
        return p.map((c, j) =>
          j === empty ? { ...c, partner: h.partner, desc: h.desc, year: h.year ?? c.year } : c
        );
      if (p.length < MAX_COLLABS)
        return [...p, { ...emptyHist(), partner: h.partner, desc: h.desc, year: h.year ?? "" }];
      return p;
    });
  };
  const applyCollabHint = (i: number) => {
    const h = collabHints[i];
    if (!h) return;
    injectCollabHint(h);
    setUsedCollabHints((s) => new Set(s).add(i));
  };
  const canApplyCollabHint =
    collabHistory.some(
      (c) => !c.partner.trim() && !c.desc.trim() && !c.types.length && !c.photos.length
    ) || collabHistory.length < MAX_COLLABS; // 상한은 lib/limits.ts 한 곳에서만 — 숫자를 여기 쓰지 말 것

  // 위저드가 고른 항목만 폼에 반영(검수 게이트). AI는 '초안'만 — 사용자가 확인·수정 후 저장.
  // ⑤스텝(찾은 이야기)에서 체크한 힌트(fill.selectedHints)는 즉시 적용 — never-overwrite:
  // 사용자가 이미 만진 필드는 덮지 않는다. 미선택 활동·콜라보 힌트는 actHints/collabHints에
  // 남아 섹션 안 인라인 힌트로 재등장하고, 미선택 seeks·블록 힌트는 적용 없이 소멸.
  const applyWizard = (fill: WizardFill) => {
    setEnrichment(fill.enrichment);
    const filled = new Set<string>();
    if (fill.name !== undefined) {
      setName(fill.name);
      filled.add("name");
    }
    if (fill.oneLiner !== undefined) {
      setOneLiner(fill.oneLiner);
      filled.add("oneLiner");
    }
    if (fill.address !== undefined) {
      setAddress(fill.address);
      filled.add("address");
    }
    if (fill.instagram !== undefined) {
      setInstagram(fill.instagram);
      filled.add("instagram");
    }
    if (fill.mapUrl !== undefined) setMapUrl(fill.mapUrl);
    if (fill.homepage !== undefined) {
      setHomepage(fill.homepage);
      filled.add("homepage");
    }
    if (fill.values !== undefined) {
      setValues(fill.values);
      filled.add("values");
      filled.add("keywords"); // 키워드 섹션 헤더 배지용
      // 위저드에서 '우리를 표현하는 키워드'를 선택했을 때만 옴 → 섹션 펼쳐 노출(자동 채움 + 보이게)
      if (fill.values.length) openSection("keywords");
    }
    if (fill.description !== undefined) {
      setDescription(fill.description);
      filled.add("description");
      setDraftGenerated(true); // 위저드가 이미 소개 초안을 채움 → 버튼은 '다시 받기'로
    }
    // '제공할 수 있는' 협업 초안 — 필수 offers 칩 + 제공 콜라보 텍스트 프리필 (2026-07-21 성역 해제).
    // never-overwrite: 사용자가 이미 만진 필드는 덮지 않는다.
    if (fill.offersHint) {
      const types = fill.offersHint.types.filter((t): t is CollabType =>
        (COLLAB_TYPES as string[]).includes(t)
      );
      if (!offers.length && types.length) {
        setOffers(types);
        filled.add("offers");
      }
      if (!offersNote.trim() && fill.offersHint.note.trim()) {
        setOffersNote(fill.offersHint.note);
        openSection("offersNote");
        filled.add("offersNote");
      }
    }
    // 힌트는 전체 보관(인라인 힌트 영속) — 선택돼 즉시 적용된 인덱스는 used 처리해 중복 노출 방지
    if (fill.activityHints?.length) {
      setActHints(fill.activityHints);
      setUsedActHints(new Set(fill.selectedHints?.activities ?? []));
    }
    if (fill.collabHints?.length) {
      setCollabHints(fill.collabHints);
      setUsedCollabHints(new Set(fill.selectedHints?.collabs ?? []));
    }

    // ── ⑤스텝 체크 결과 즉시 적용 ──
    const sel = fill.selectedHints;
    if (sel) {
      if (sel.activities.length) {
        sel.activities.forEach((i) => {
          const h = fill.activityHints?.[i];
          if (h) injectActHint(h);
        });
        openSection("activities");
        filled.add("activities");
      }
      if (sel.collabs.length) {
        sel.collabs.forEach((i) => {
          const h = fill.collabHints?.[i];
          if (h) injectCollabHint(h);
        });
        openSection("collabs");
        filled.add("collabs");
      }
      if (sel.seeks && fill.seeksHint) {
        const types = fill.seeksHint.types.filter((t): t is CollabType =>
          (COLLAB_TYPES as string[]).includes(t)
        );
        // 구 seeks 칩 은퇴(통합) — 유형은 통합 칩(offers)에 합집합으로 흡수
        if (types.length) setOffers((p) => [...new Set([...p, ...types])] as CollabType[]);
        if (!seeksNote.trim() && fill.seeksHint.note.trim()) setSeeksNote(fill.seeksHint.note);
        // ⚠️`openSection("seeks")`는 08-12부터 무의미 — 그 섹션은 접히지 않는 상시 노출로 승격됐다.
        //   (`filled`는 살려둔다 — ✨배지가 "AI가 채운 칸"임을 알리는 데 여전히 쓰인다.)
        filled.add("seeks");
      }
      (fill.blockHints ?? [])
        .filter((b) => sel.blocks.includes(b.type))
        .forEach((h) => {
          setBlocks((p) => {
            if (p.some((b) => b.type === h.type)) return p; // 이미 담긴 블록은 덮지 않음
            const nb = emptyBlock(h.type);
            // metrics·press는 힌트 items를 밑그림으로 주입(빈 밑그림이면 빈 블록 그대로)
            if (nb.type === "metrics") {
              const items = (h.items ?? [])
                .filter((it) => it.label.trim())
                .map((it) => ({ label: it.label, value: it.value ?? "" }));
              if (items.length) nb.items = items;
            }
            if (nb.type === "press") {
              const items = (h.items ?? [])
                .filter((it) => it.label.trim())
                .map((it) => ({
                  title: balanceQuotes(it.label), // 짝 없는 따옴표 정리(#1)
                  year: it.year || undefined,
                  desc: it.desc?.trim() ? balanceQuotes(it.desc) : undefined, // 매체별 소개 요약(#2)
                  link: it.url || undefined, // 기사 원문 링크 프리필(1팀 캡처·sanitizeHttpUrl 검증됨 — actions.ts에서 저장 시 재검증)
                }));
              if (items.length) nb.items = items;
            }
            if (nb.type === "space" && h.desc?.trim()) {
              nb.desc = h.desc.trim(); // 공간 소개 밑그림 주입 — 없으면 빈 블록이 저장 시 탈락(#3)
            }
            return [...p, nb];
          });
        });
    }

    setAiFilled(filled);
    setMissing([]);
    setReviewMode(true);
    setWizardOpen(false);
    // 초본이 폼에 채워지는 순간 = 축하+사진유도 얼럿(AI 크롤 경로 한정, 세션 1회).
    if (!draftDoneShownRef.current) {
      draftDoneShownRef.current = true;
      setShowDraftDone(true);
    }
  };

  // 라벨 옆 표시: AI가 채운 필드면 ✨배지, 못 찾은 필드면 "직접 입력" 노티
  const hintFor = (key: string, miss?: EnrichField) => {
    if (aiFilled.has(key)) return <AiBadge />;
    if (miss && missing.includes(miss)) return <MissingNote />;
    return undefined;
  };

  // 필수 미입력 안내 토스트 (같은 메시지 재클릭 시에도 재표시되도록 타이머 리셋)
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  };
  // 첫 미입력 필수 항목 — 앵커 + **무엇이 빠졌는지 이름을 부르는 문구**를 같이 준다(QA #18).
  // "필수 정보 작성이 필요해요"만 2.5초 띄우면 토스트가 사라진 뒤엔 이유가 아무 데도 안 남는다.
  const firstMissingRequired = (): { anchor: string; msg: string } | null => {
    if (!name.trim()) return { anchor: "name-field", msg: "브랜드 이름을 알려주세요." };
    if (!offers.length)
      return { anchor: "offers-chips", msg: "함께하고 싶은 콜라보를 하나 이상 골라주세요." };
    // 브랜드 사진 1장 — **신규 등록에서만** 필수(대표 확정 08-05). 상세 사유는 사진 섹션 주석 참조.
    // ⚠️ `editSlug`는 편집 데이터를 불러온 뒤에 세팅되므로 **`editParam`도 같이** 본다 —
    //    editSlug만 보면 부팅 중(editBooting) 한순간 신규로 오인해 기존 주인에게 사진을 요구한다.
    if (!editParam && !editSlug && !photos.length)
      return { anchor: "photos-field", msg: "브랜드 사진을 한 장 이상 올려주세요." };
    return null;
  };
  // 스크롤이 멈춘 그 자리에 표시를 남긴다 — 토스트는 사라져도 이건 고칠 때까지 남는다.
  const [errField, setErrField] = useState<{ anchor: string; msg: string } | null>(null);

  // 채우는 즉시 빨간 표시를 거둔다 — 고쳤는데도 계속 빨가면 그게 더 혼란스럽다.
  useEffect(() => {
    if (!errField) return;
    if (errField.anchor === "name-field" && name.trim()) setErrField(null);
    if (errField.anchor === "offers-chips" && offers.length) setErrField(null);
    if (errField.anchor === "photos-field" && photos.length) setErrField(null);
  }, [errField, name, offers.length, photos.length]);

  // ── 초본 완성 얼럿(AI 크롤 직후 사진 유도 · 세션 1회) ──
  const draftDoneShownRef = useRef(false); // '다시 받기'로 applyWizard 재호출돼도 처음 1번만
  const [showDraftDone, setShowDraftDone] = useState(false);

  // ── 제출 인터셉트 추천 모달(등록 직전 1회) ──
  const [nudgeShown, setNudgeShown] = useState(false); // 한 번 뜨면 다음 등록엔 안 뜸
  const [showNudge, setShowNudge] = useState(false);

  // ── 등록 완료 얼럿(소개서 페이지로 이동) ──
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  // BlockEditor 카탈로그 시트 열림 여부(플로팅 버튼 숨김용) — BlockEditor가 알려줌.
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  // 소개서 미리보기 바텀시트(① 사진 섹션 링크) — 실제 텍스트 데모 소개서를 페이지처럼 렌더(폼 이탈 없음).
  const [previewOpen, setPreviewOpen] = useState(false);
  const [demoMaker, setDemoMaker] = useState<{ maker: Maker; logoUrl: string | null } | null>(null);
  // 시트 열 때 1회 지연 로딩(데모=고정 데이터라 캐시). 유료 콜 없음.
  const openPreview = () => {
    setPreviewOpen(true);
    if (!demoMaker) getPreviewDemoNoneAction().then((d) => d && setDemoMaker(d));
  };

  // ── 오버레이 공통 동작(ESC·딤·포커스 트랩·스크롤 잠금) ──
  // ⚠️ 훅이라 JSX 조건부 안이 아니라 여기 최상위에서 부른다. props만 아래 시트에 꽂는다.
  // 정책(대표 07-29): 내용이 날아갈 수 있는 창은 딤 클릭으로 닫지 않는다 → `overlayClose: false`.
  const nudgeDismiss = () => {
    setNudgeShown(true); // 딤·ESC·'다음에 하기' 전부 같은 경로 — 다시 뜨지 않게
    setShowNudge(false);
  };
  // 초안받기: 후보를 버리고 닫으면 다시 열 때 **유료 콜이 다시 나간다** → 딤 클릭 금지, 생성 중엔 ESC도 잠금.
  const draftDialog = useDismissable(descModalOpen, {
    onClose: () => setDescModalOpen(false),
    overlayClose: false,
    escClose: !draftBusy && !descRegenBusy,
  });
  const draftDoneDialog = useDismissable(showDraftDone, { onClose: () => setShowDraftDone(false), overlayClose: false });
  const nudgeDialog = useDismissable(showNudge, { onClose: nudgeDismiss });
  // 등록 완료 얼럿은 **탈출구를 열지 않는다** — 비회원은 여기서 관리 비밀번호를 정해야 하고,
  // 그냥 닫으면 저장된 소개서를 영영 수정하지 못한다(ESC·딤 둘 다 잠금, 포커스 트랩만 취함).
  const portfolioDialog = useDismissable(portfolioOpen, {
    onClose: () => setPortfolioOpen(false),
    overlayClose: false,
    escClose: false,
  });
  const previewDialog = useDismissable(previewOpen, { onClose: () => setPreviewOpen(false) });

  const [createdSlug, setCreatedSlug] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [userId, setUserId] = useState<number | undefined>(undefined); // 임시저장 키를 계정별로 가르는 용도
  // ⚠️ 인증 응답 전엔 임시저장을 켜지 않는다 — 로그인 유저가 그 사이에 타이핑하면 anon 키에 쓰이고,
  //    잠시 뒤 키가 u{id}로 바뀌며 "방금 쓰던 내용"이 복구 배너로 뜨는 기괴한 상황이 된다.
  const [authResolved, setAuthResolved] = useState(false);
  const [editPw, setEditPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editAuthPw, setEditAuthPw] = useState(""); // 수정 저장 재검증용(세션스토리지에서, 소유자는 빈 값)
  // ?edit로 진입 시 데이터 불러오는 동안 로딩 화면(빈 생성폼 깜빡임 방지)
  // useSearchParams는 서버·클라 첫 렌더 모두 URL을 정확히 반영 — window.location 기반 초기화는
  // 서버 렌더 시 window가 없어 항상 false로 시작해 빈 생성폼이 잠깐 보이는 원인이었다.
  const [editBooting, setEditBooting] = useState(!!editParam);

  useEffect(() => {
    getAuthStateAction()
      .then((s) => { setLoggedIn(s.loggedIn); setUserId(s.userId); })
      .catch(() => {})
      .finally(() => setAuthResolved(true));
  }, []);

  // ── 임시저장(localStorage) ── 대표 확정 A안(2026-07-29). 훅 = ./useDraftAutosave
  //    새로고침·뒤로가기·탭 닫기로 초안이 통째로 날아가던 걸 막는다. **자동 복구는 안 한다**(배너로 물음).
  //    사진은 이미 Storage에 올라가 URL만 남으므로 가볍다 — 단 data URL(로컬 mock)은 걸러야 5MB 쿼터를 안 터뜨린다.
  const keepPhotos = (ps: Ph[]) =>
    ps.filter((x) => !x.uploading && /^https?:\/\//.test(x.url)).map((x) => ({ url: x.url }));
  const draftSnapshot = {
    name, oneLiner, description, story, offersNote, seeksNote,
    offers, values, targetAudience, searchVisible, collabPaused,
    instagram, homepage, mapUrl, address, introFileUrl, blocks,
    photos: keepPhotos(photos),
    activities: activities.map((a) => ({ title: a.title, desc: a.desc, link: a.link, photos: keepPhotos(a.photos) })),
    collabHistory: collabHistory.map((h) => ({
      partner: h.partner, types: h.types, desc: h.desc, year: h.year, link: h.link, photos: keepPhotos(h.photos),
    })),
    openSections: [...openSections],
  };
  type DraftShape = typeof draftSnapshot;
  const hasDraftContent = !!(
    name.trim() || oneLiner.trim() || description.trim() || story.trim() ||
    offersNote.trim() || seeksNote.trim() || offers.length || values.length ||
    targetAudience.length || blocks.length || photos.length ||
    activities.some((a) => a.title.trim() || a.desc.trim() || a.photos.length) ||
    collabHistory.some((h) => h.partner.trim() || h.desc.trim() || h.types.length || h.photos.length)
  );
  const draft = useDraftAutosave<DraftShape>({
    key: editBooting || !authResolved ? null : draftKey(userId, editSlug),
    snapshot: draftSnapshot,
    hasContent: hasDraftContent,
  });
  /** 저장본을 폼에 얹는다 — 사용자가 배너의 주 버튼([저장 내용 불러오기]/[이어서 쓰기])을 눌렀을 때만.
   *  (위쪽 applyDraft는 AI 초안 적용용이라 이름을 나눈다) */
  const restoreDraft = (d: DraftShape) => {
    setName(d.name); setOneLiner(d.oneLiner); setDescription(d.description); setStory(d.story);
    setOffersNote(d.offersNote); setSeeksNote(d.seeksNote);
    setOffers(d.offers); setValues(d.values); setTargetAudience(d.targetAudience);
    setSearchVisible(d.searchVisible);
    setCollabPaused(d.collabPaused ?? false); // 옛 임시저장엔 이 키가 없다 → 받는 중으로
    setInstagram(d.instagram); setHomepage(d.homepage); setMapUrl(d.mapUrl); setAddress(d.address);
    setIntroFileUrl(d.introFileUrl); setBlocks(d.blocks); setPhotos(d.photos);
    setActivities(d.activities.map((a) => ({ title: a.title, desc: a.desc, link: a.link ?? "", photos: a.photos })));
    setCollabHistory(
      (d.collabHistory.length ? d.collabHistory : [emptyHist()]).map((h) => ({
        partner: h.partner, types: h.types, desc: h.desc, year: h.year, link: h.link ?? "",
        photos: h.photos, typeInput: "", typeInputOpen: false,
      }))
    );
    setOpenSections(new Set(d.openSections));
    draft.dismiss();
  };

  useEffect(() => {
    const slug = editParam;
    if (!slug) return;
    getEditDataAction(slug).then((m) => {
      if (!m) {
        setEditBooting(false);
        return; // 소개서 없음 — 일반 생성 폼으로 남음
      }
      setEditSlug(slug);
      try {
        setEditAuthPw(sessionStorage.getItem(`edit_pw_${slug}`) ?? "");
      } catch {}
      setName(m.name);
      setOneLiner(m.oneLiner);
      setDescription(m.description ?? "");
      setStory(m.story ?? "");
      setValues(m.keywords ?? []);
      setActivities(
        (m.activities.length ? m.activities : [{ title: "", desc: "", photos: [] }]).map((a) => ({
          title: a.title, desc: a.desc, photos: a.photos.map((u) => ({ url: u })), link: a.link ?? "",
        }))
      );
      // 통합 마이그레이션(2026-07-22): 기존 소개서의 seeks 칩을 offers에 흡수해 로드 → 저장 시 자연 수렴
      setOffers([...new Set([...m.offers, ...m.seeks])] as CollabType[]);
      setSeeks([]);
      setOffersNote(m.offersDescription ?? "");
      setSeeksNote(m.seeksDescription ?? "");
      setTargetAudience(m.targetAudience ?? []);
      setCollabHistory(
        (m.collabHistory.length
          ? m.collabHistory
          : [{ partner: "", types: [], desc: "", year: "", photos: [] }]
        ).map((h) => ({
          partner: h.partner, types: h.types, desc: h.desc ?? "", year: h.year ?? "",
          photos: h.photos.map((u) => ({ url: u })), link: h.link ?? "", typeInput: "", typeInputOpen: false,
        }))
      );
      setInstagram(m.trust.instagram ?? "");
      setHomepage(m.trust.homepage ?? "");
      setMapUrl(m.trust.mapUrl ?? "");
      setAddress(m.trust.address ?? "");
      setSearchVisible(m.searchVisible ?? true);
      setCollabPaused(m.collabPaused ?? false);
      setPhotos(m.photos.map((u) => ({ url: u })));
      setBlocks((m.showcases ?? []).map((b) => ({ ...b, uid: crypto.randomUUID() })));
      setIntroFileUrl(m.introFileUrl ?? "");
      // 생성 때 저장한 크롤 스냅샷 → 다시받기 재료·버튼 게이트(크롤한 소개서만 노출)
      setEnrichment(m.enrichment);
      // 수정모드 규칙: 데이터 있는 섹션은 펼쳐진 채 복귀(빈 섹션은 접힌 스텁/시트 잔류)
      const open = new Set<SectionKey>();
      if ((m.story ?? "").trim()) open.add("story");
      if (m.activities.length) open.add("activities");
      if (m.collabHistory.length) open.add("collabs");
      if ((m.keywords ?? []).length) open.add("keywords");
      if ((m.targetAudience ?? []).length) open.add("customers");
      if ((m.offersDescription ?? "").trim()) open.add("offersNote");
      // (seeks는 상시 노출이라 펼칠 필요가 없다 — 08-12)
      setOpenSections(open);
      setEditBooting(false);
    }).catch(() => setEditBooting(false));
  }, []);

  const submit = () => {
    // 1) 필수(상호·협업칩) 미입력 → 토스트 + 첫 미입력 항목으로 스크롤. 버튼은 항상 활성.
    const missing = firstMissingRequired();
    if (missing) {
      setErrField(missing);
      showToast(missing.msg);
      const el = document.getElementById(missing.anchor);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      // 상호처럼 입력칸이면 커서까지 데려간다 — 스크롤만 하면 "여기서 뭘 하라는 건지"가 한 박자 늦다.
      if (el instanceof HTMLInputElement) setTimeout(() => el.focus({ preventScroll: true }), 320);
      return;
    }
    // 2) 등록 직전 1회 인터셉트 — 소개가 얇으면 추천 모달로 이야기 더하기 제안
    const p = { required: !!name.trim() && offers.length > 0, story: hasStory, activities: hasActivities, collabs: hasCollabs, keywords: hasKeywords, customers: hasCustomers, offersNote: hasOffersNote, seeks: hasSeeks, blocks: blocks.length };
    if (!nudgeShown && !isRichIntro(p)) { setShowNudge(true); return; }
    // 3) 실제 등록
    doSubmit();
  };

  const doSubmit = () => {
    startTransition(async () => {
      // 사진은 선택 즉시 Storage 업로드됨 → 여기선 URL만 수집(업로드중 항목 제외)
      // 내용이 있는 카드만(빈 카드는 제외) — 활동과 동일 규칙
      const filledHist = collabHistory.filter(
        (h) => h.partner.trim() || h.types.length || h.desc.trim() || h.photos.length || h.link.trim()
      );
      const photoUrls = uploadedUrls(photos);
      const activityOut = activities
        .filter((a) => a.title.trim() || a.desc.trim() || a.photos.length || a.link.trim())
        .map((a) => ({
          title: a.title.trim(),
          desc: a.desc.trim(),
          photos: uploadedUrls(a.photos),
          link: a.link.trim() || undefined,
        }));
      const historyOut = filledHist.map((h) => ({
        partner: h.partner.trim(),
        types: h.types,
        desc: h.desc.trim(),
        year: h.year || undefined,
        photos: uploadedUrls(h.photos),
        link: h.link.trim() || undefined,
      }));
      // 사진 base64는 배열에 문자열로 담으면 React Flight 배열 한도(1e6)에 걸린다.
      // → {u} 객체로 감싸 전송(actions.ts에서 되풂). @see PhotoWire
      const wrap = (arr: string[]) => arr.map((u) => ({ u }));
      // 빈 섹션 강제 차단 — has*가 false인 섹션은 빈 값으로 전송(단일 관문, 레드팀 CONFIRMED).
      // 펼쳤지만 빈 채로 둔 섹션이 저장·노출되지 않는 유일한 보증 지점. (블록은 서버 sanitizeBlocks가 담당)
      const payload = {
        name,
        oneLiner,
        offers,
        seeks: [], // 구 seeks 칩 은퇴(통합) — 유형은 offers 1세트가 정본. 저장 시 항상 비워 자연 수렴
        keywords: hasKeywords ? values : [],
        targetAudience: hasCustomers ? targetAudience : [],
        collabHistory: hasCollabs ? historyOut.map((h) => ({ ...h, photos: wrap(h.photos) })) : [],
        story: hasStory ? story.trim() : "",
        activities: hasActivities ? activityOut.map((a) => ({ ...a, photos: wrap(a.photos) })) : [],
        offersDescription: hasOffersNote ? offersNote : "",
        seeksDescription: hasSeeks ? seeksNote : "",
        showcases: blocks,
        introFileUrl: introFileUrl || undefined,
        photos: wrap(photoUrls),
        searchVisible,
        collabPaused,
        enrichment,
        instagram,
        homepage,
        mapUrl,
        address,
        description,
      };
      if (editSlug) {
        const r = await updateMakerAction(editSlug, payload, editAuthPw || undefined);
        if (r.error) {
          alert(r.error);
          return;
        }
        try {
          sessionStorage.removeItem(`edit_pw_${editSlug}`);
        } catch {}
        draft.finish(); // 저장본 삭제 + 이탈 경고 해제 — 안 하면 이동하다 경고창이 뜬다
        router.push(`/m/${editSlug}`);
        return;
      }
      const { slug } = await createMakerAction(payload);
      draft.finish();
      setCreatedSlug(slug);
      setPortfolioOpen(true); // redirect 대신 소개서 얼럿
    });
  };
  // 소개서 페이지는 서버에서 데이터를 불러오는 동안 잠깐 멈춰 보임 → 버튼 로딩 표시.
  const [goingToPage, setGoingToPage] = useState(false);
  // 완료 얼럿 분석 파트너(본인 제외 최신 1곳) — 홈이 "소개서 만들면 분석 받아요"라 약속한 것의 이행 지점.
  // ⚠️ 로그인 유저 전용 — 리포트는 로그인+내 소개서가 필요하고, 비회원 얼럿은 비번 저장 전
  //    탈출구를 열면 안 된다(이탈 시 소개서 영영 수정 불가). 스펙: [[홈-콜라보-프레임-개편]] P1c
  const [analysisPartner, setAnalysisPartner] = useState<{ slug: string; name: string } | null>(null);
  useEffect(() => {
    if (!portfolioOpen || !loggedIn || !createdSlug) return;
    getAnalysisPartnerAction(createdSlug)
      .then(setAnalysisPartner)
      .catch(() => setAnalysisPartner(null)); // 후보 조회 실패는 조용히 — 버튼만 안 뜬다
  }, [portfolioOpen, loggedIn, createdSlug]);
  const goToPage = async () => {
    if (!loggedIn) {
      if (!editPw.trim()) return;
      setSavingPw(true);
      setPwErr("");
      // 실패를 삼키면 안 됨 — 비번이 안 걸린 채 넘어가면 나중에 본인 소개서를 영영 수정 못 한다.
      const r = await setMakerPasswordAction(createdSlug, editPw.trim()).catch(() => ({
        error: "비밀번호 저장에 실패했어요. 잠시 후 다시 시도해주세요.",
      }));
      setSavingPw(false);
      if (r?.error) {
        setPwErr(r.error);
        return;
      }
    }
    setGoingToPage(true);
    router.push(`/m/${createdSlug}`);
  };

  // 어떤 레이어(위저드·모달·얼럿·넛지·블록시트·미리보기시트)라도 열려 있으면 플로팅 버튼 숨김.
  const layerOpen =
    wizardOpen ||
    descModalOpen ||
    showDraftDone ||
    showNudge ||
    portfolioOpen ||
    blockSheetOpen ||
    previewOpen;

  if (editBooting) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-[640px] flex-col items-center justify-center px-4 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="mt-4 text-[15px] text-mute">소개서를 불러오는 중이에요…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-28 pt-8 sm:px-6">
      {/* 진입 시트 — **새로 작성**하러 온 사람에게만 1초 뒤 올라온다(수정 모드는 제외).
          "혼자 다 채우지 않아도 된다"를 먼저 알려 작성 부담으로 인한 이탈을 막는다. 상세는 EnrichIntroSheet.tsx */}
      <EnrichIntroSheet enabled={!editParam && !editSlug} />

      {editSlug ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.025em] text-ink sm:text-[32px]">
              소개서 수정
            </h1>
            <button
              type="button"
              onClick={() => router.push(`/m/${editSlug}`)}
              className="mt-1.5 shrink-0 text-[13px] font-medium text-mute hover:text-ink"
            >
              취소
            </button>
          </div>
          <p className="mt-2 text-[17px] leading-relaxed text-body">
            내용을 고치고 맨 아래 ‘수정 완료’를 누르면 소개서에 바로 반영돼요.
          </p>
        </>
      ) : (
        <>
      <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.025em] text-ink sm:text-[32px]">
        브랜드 소개서, 생각보다 금방 완성돼요.
      </h1>
      <p className="mt-2 text-[17px] leading-relaxed text-body">
        브랜드 이름 입력하면 AI가 소개서 초안을 준비해드려요. 확인하고 다듬으면 1~3분 안에 완성할 수 있어요.
      </p>

      {/* ✨ 딸깍 자동완성 — 이름만 알려주면 채워드릴게요 */}
      <div className="mt-10 rounded-xl border border-primary bg-primary-pale px-5 py-5">
        <p className="text-[17px] font-bold text-ink">
          ✨ 브랜드 이름을 알려주세요. 나머지는 AI가 준비해드릴게요.
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-mute">
          웹, SNS에서 찾은 정보를 기준으로 소개 초안을 준비해드려요. 찾아온 정보는 언제든 자유롭게 수정할 수 있어요.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                openWizard();
              }
            }}
            placeholder="예: 캔버스가든"
            className="h-11 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
          <button
            type="button"
            onClick={openWizard}
            className="h-11 shrink-0 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-on"
          >
            ✨ 시작하기
          </button>
        </div>
        {queryErr && <p className="mt-2 text-[13px] text-danger">{queryErr}</p>}
      </div>

      {/* AI 불러오기(위) ↔ 직접 입력(아래) 구분 소제목 */}
      <div className="mt-10 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline" />
        <span className="shrink-0 text-[13px] font-medium text-mute">
          또는 아래에 직접 입력할 수 있어요.
        </span>
        <div className="h-px flex-1 bg-hairline" />
      </div>
        </>
      )}

      <div className="mt-8 space-y-12">
        {/* 이어서 쓰기 배너 — **자동 복구는 절대 하지 않는다.**
            낡은 초안을 덜컥 얹으면 서버에 잘 저장해둔 내용을 되돌려버린다. 그래서 항상 물어본다.

            대표 확정(2026-07-31): **주 버튼 = 복원**으로 위계를 뒤집는다.
            문구·라벨은 대표가 직접 쓴 문장이라 글자 그대로 쓴다(다듬지 말 것).
            - 주(초록) [저장 내용 불러오기] = restoreDraft — 초안을 폼에 얹는다.
            - 부       [저장 내용 무시하기] = draft.clear — 배너를 닫고 **저장본까지 지운다.**
              ⚠️ '닫기만' 하면(dismiss) 바로 위 설명문이 약속한 "새로 시작하면 저장된 내용은
              삭제됩니다"를 화면이 스스로 어긴다. 그래서 dismiss가 아니라 clear다.
              clear는 저장본만 지우고 자동저장을 끄지 않는다(finished 플래그는 제출 때만) —
              그 뒤 폼을 고치면 다시 저장되는 게 정상이다.

            ⭐ 08-02 대표 지시로 **생성/수정 분기를 없앴다**(전엔 문구·라벨이 모드마다 달랐다).
               통일 기준을 수정 모드로 잡은 이유 = 생성 모드 문구엔 **결정적 정보가 빠져 있었다**:
               [새로 시작]이 실제로는 `draft.clear`라 **저장본을 지우는데**, "이어서 쓰거나,
               새로 시작할 수 있어요"는 그 말을 안 한다 — 되돌릴 수 없는 행동을 예고 없이 시킨 셈.
               수정 모드 문장은 "새로 시작하면 저장된 내용은 삭제됩니다"까지 말한다.
            ⚠️ 대신 생성 모드가 갖고 있던 **저장 시각은 버리지 않았다.** 대표 문장의 막연한
               "**이전에** 작성하던 내용이" 자리에 `agoLabel`을 끼워 "14시간 전에 작성하던
               내용이"로 채운다 — 문장 구조는 그대로 두고 부사만 정확해진다.
               (초안이 오래됐는지 = 이어쓸지 말지의 판단 근거라 빼면 안 되는 정보다) */}
        {draft.found && (
          <div className="rounded-lg border border-border-strong bg-surface px-4 py-3 shadow-e1">
            <p className="text-[15px] font-medium text-ink">작성 중이던 내용을 발견했어요.</p>
            <p className="mt-0.5 text-[13px] text-mute">
              {agoLabel(draft.found.savedAt)} 작성하던 내용이 저장되어 있어요. 이어서 작성할 수
              있으며, 새로 시작하면 저장된 내용은 삭제됩니다.
            </p>
            <div className="mt-3 flex gap-2">
              {/* 주 = 복원. 부 = 삭제. */}
              <button
                type="button"
                onClick={() => draft.found && restoreDraft(draft.found.data)}
                className="h-10 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-on"
              >
                저장 내용 불러오기
              </button>
              <button
                type="button"
                onClick={draft.clear}
                className="h-10 rounded-md border border-border-strong bg-surface px-4 text-[14px] font-medium text-mute"
              >
                저장 내용 무시하기
              </button>
            </div>
          </div>
        )}

        {/* 검수 게이트 배너 — AI가 채운 직후 */}
        {reviewMode && (
          <div className="rounded-lg border border-primary bg-surface px-4 py-3 shadow-e1">
            <p className="text-[15px] font-medium text-ink">
              ✨ 온라인 정보와 SNS를 참고해서 브랜드를 분석해봤어요.
            </p>
            <p className="mt-0.5 text-[13px] text-mute">
              맞는지 확인하고 자유롭게 고쳐주세요. 못 찾은 곳은 직접 채우면 돼요.
            </p>
          </div>
        )}

        {/* ── ① 브랜드를 소개해주세요 (초안 다시 받기 = 그룹 헤더 우측) ──
            AI 크롤(enrichment) 게이트: 크롤한 소개서만 노출(대표 정책 2026-07-22).
            크롤 안 한 집단의 초안 니즈는 별도 백로그([[다시받기-크롤연동]])에서 다르게 다룸. */}
        <GroupHeader
          n="①"
          title="브랜드를 소개해주세요."
          action={
            enrichment ? (
              <button
                type="button"
                onClick={draftDescription}
                disabled={draftBusy}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-pill border border-primary bg-primary-pale px-3 text-[14px] font-medium text-primary-on disabled:opacity-40"
              >
                {draftBusy ? "쓰는 중…" : "✨ 초안 다시 받기"}
              </button>
            ) : undefined
          }
        />
        {/* 특장점 표시 + [지우기](B35 스펙 4-4) — 보이지 않는 재주입 방지: 저장된 특장점이 '다시 받기'마다
            몰래 들어가면 잘못 쓴 문장이 "왜 자꾸 이상하게 나오지"의 보이지 않는 원인이 된다. 수정 UI는 스코프 밖(지우고 새로 받기). */}
        {enrichment?.ownerNote && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-hairline bg-surface-soft px-3 py-2.5">
            <p className="text-[13px] leading-relaxed text-mute">
              💬 초안에 담는 특장점: <span className="text-body">“{enrichment.ownerNote}”</span>
            </p>
            <button
              type="button"
              onClick={async () => {
                setEnrichment((e) => {
                  if (!e) return e;
                  const { ownerNote: _drop, ...rest } = e;
                  return rest as Enrichment;
                });
                // 저장된 소개서면 스냅샷에서도 지운다 — 다음 편집 세션에 되살아나지 않게. 실패해도 로컬은 이미 제거됨.
                if (editSlug) void clearOwnerNoteAction(editSlug);
              }}
              className="shrink-0 text-[13px] text-faint underline underline-offset-2 hover:text-mute"
            >
              지우기
            </button>
          </div>
        )}
        <div className="space-y-8">
          <Field label="상호 *" hint={hintFor("name")}>
            <input
              id="name-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 캔버스가든"
              aria-invalid={errField?.anchor === "name-field" || undefined}
              className={`h-11 w-full scroll-mt-20 rounded-sm border bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus ${
                errField?.anchor === "name-field" ? "border-danger" : "border-hairline"
              }`}
            />
            {errField?.anchor === "name-field" && (
              <p className="mt-1.5 text-[13px] text-danger">{errField.msg}</p>
            )}
          </Field>
          <Field label="한두 문장 소개 (선택)" hint={hintFor("oneLiner")}>
            {/* 한두 문장이라 멀티라인 — 한 줄 input이면 두 번째 문장이 가로로 밀려 안 보임. 길이 제한 없음(대표 확정) */}
            <textarea
              value={oneLiner}
              onChange={(e) => setOneLiner(e.target.value)}
              rows={2}
              placeholder="헌옷의 재발견, 나다움을 표현하는 직물 워크숍을 열고 있어요."
              className="m-0 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>

          {/* 자세히 소개 — 브랜드를 소개해주세요 (초안 받기 버튼은 ① 상호 옆으로 이사) */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-[16px] font-medium text-body">
              <span>자세히 소개 (선택)</span>
              {aiFilled.has("description") && <AiBadge />}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="헌옷과 다양한 소재를 활용한 죠각 워크숍을 열고 있어요. 참가자들은 버려질 뻔한 옷을 작은 소품과 가방, 액자로 다시 만들어가며, 잊고 지냈던 자신만의 취향과 표현을 발견합니다. 때로는 양말이나 비닐봉투처럼 예상하지 못한 소재를 통해, 문자 대신 손으로 자신을 표현하는 즐거움을 함께 나누고 있습니다."
              className="w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            {/* 안내도 버튼과 같은 게이트 — 크롤 안 한 소개서엔 버튼이 없으니 문구도 숨김 */}
            {enrichment && (
              <p className="mt-1.5 text-[13px] text-mute">
                ‘초안 다시 받기’를 누르면 다른 느낌의 소개로 새로 써드려요.
              </p>
            )}
          </div>

          {/* 브랜드 사진 — **신규 등록 시 최소 1장 필수**(대표 확정 08-05).
              왜 필수가 됐나: 사진 0장 소개서는 사장님이 **남에게 링크를 못 보낸다.** 안 보내면 P2·P3가 시작을 안 한다.
              M0의 「간편하게 + 그럴싸하게」는 짝이라 하나만으론 성립하지 않는다([[미션-문제정의]]).
              ⚠️ **수정 저장에는 적용하지 않는다** — 기존 텍스트형 소개서(08-01 기준 9곳 중 4곳) 주인이
                 오타 하나 고치려다 자기 페이지에 갇힌다. 그쪽은 배너·보강 신청으로 채운다.
              ⚠️ AI 크롤은 사진을 못 가져온다 → 모든 신규 사용자가 여기서 한 번 멈춘다.
                 그래서 문구가 "왜 필요한지"까지 말해야 한다(요구만 하면 이탈한다). */}
          <div id="photos-field" className="scroll-mt-28">
            <label className="mb-1 block text-[16px] font-medium text-body">
              브랜드 사진{" "}
              {!editParam && !editSlug ? (
                <span className={errField?.anchor === "photos-field" ? "text-danger" : "text-primary-on"}>
                  (필수 · 최소 1장)
                </span>
              ) : (
                <span className="text-mute">(선택)</span>
              )}
              <span className="text-mute"> · 최대 10장</span>
            </label>
            <p className="mb-2.5 text-[14px] leading-relaxed text-body">
              한 장이면 충분해요. 가게·작업물·만든 것 아무거나 괜찮아요.{" "}
              <button
                type="button"
                onClick={openPreview}
                className="text-primary-on underline underline-offset-2"
              >
                소개서 예시 보기
              </button>
              {/* ⚠️ 여기서 보강 서비스로 나가는 **링크를 달지 않는다** — 폼 작성 중에 밖으로 내보내면
                  소개서가 미완성으로 남고, 그러면 정작 보강해줄 대상이 사라진다(08-02 판단).
                  안심만 주고, 실제 신청은 저장 후 소개서 페이지의 배너에서 받는다. */}
            </p>
            {errField?.anchor === "photos-field" && (
              <p className="mb-2.5 text-[13.5px] font-medium leading-relaxed text-danger">
                {errField.msg}
              </p>
            )}
            <PhotoGrid
              items={photos}
              max={10}
              // 신규 등록에서만 필수라, 수정 모드에선 타일도 "(선택)"으로 둔다(요구하지 않는 걸 요구하는 것처럼 보이지 않게).
              addLabel={!editParam && !editSlug ? "사진(필수)" : "사진(선택)"}
              onAdd={onPhotos}
              onRemove={(i) => setPhotos((ps) => ps.filter((_, j) => j !== i))}
              onReorder={(from, to) => setPhotos((ps) => reorder(ps, from, to))}
              onRetry={(i) => retryPhoto(photos, i, 1000, setPhotos)}
            />
          </div>

          {/* 소개자료 PDF 첨부 (선택) — 구⑨에서 ① 브랜드 사진 아래로 이사 */}
          <div>
            <label className="mb-2 block text-[16px] font-medium text-body">
              이미 소개서가 있나요? (선택)
            </label>
            <div className="flex items-center gap-3">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border-strong bg-surface px-3 text-[14px] font-medium text-ink">
                {pdfUploading ? "올리는 중…" : "파일 업로드"}
                <input
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => onIntroPdf(e.target.files)}
                />
              </label>
              {introFileUrl && (
                <>
                  <span className="text-[14px] text-body">소개 자료 담김</span>
                  <button
                    type="button"
                    onClick={() => setIntroFileUrl("")}
                    className="text-[13px] text-faint hover:text-ink"
                  >
                    지우기
                  </button>
                </>
              )}
            </div>
          </div>

        </div>

        {/* ── 이런 콜라보를 찾고 있어요 (08-12 신설 — 소개서 섹션과 한 덩어리로 맞춤) ──
            ⭐**소개서에서 한 섹션인 것은 폼에서도 한 섹션이어야 한다.** 전엔 유형 칩이 ①(필수 영역)
              안에 있고 조건 서술은 한참 아래 시트 섹션이라, 사장님이 둘을 **다른 질문으로** 여겼다.
            🚨**StubSection으로 만들면 안 된다** — 칩은 필수인데 스텁은 접히고(`hiddenWhenCollapsed`면
              값 없을 때 아예 안 보임) 삭제도 된다. **필수 항목이 화면에서 사라지면 등록 자체가 막힌다.**
              그래서 번호 없는 GroupHeader로 세운 상시 노출 섹션이다.
            🆕**조건 서술이 이제 항상 보인다** — 전엔 시트에서 "추가"를 눌러야 나타나서, 안 누른 사장님은
              그런 칸이 있는 줄도 몰랐다(계단뿌셔클럽 조건이 안 적힌 층이 하나 더 있었던 셈).
            ⚠️`id="sec-seeks"`를 유지할 것 — 완성도 칩이 이 id로 스크롤한다. */}
        <section id="sec-seeks" className="scroll-mt-4">
          <GroupHeader title="이런 콜라보를 찾고 있어요." />
          <div className="space-y-8">
            {/* 협업 유형 칩 — 공급·수요 통합 1세트 (2026-07-22 대표 확정 — 검색이 이미 offers∪seeks OR라 구분에 실체 없음).
                구 seeks 칩은 은퇴, 저장 시 합집합이 offers로 들어간다.
                ⭐칩을 서술보다 **먼저** 둔다(소개서는 반대다). 폼은 읽는 곳이 아니라 쓰는 곳이라,
                  ①필수를 먼저 만나야 하고 ②칩을 골라 워밍업이 돼야 그다음 글이 써진다. */}
            <div id="offers-chips" className="scroll-mt-4">
              <Field label="콜라보 유형을 골라주세요. *" hint={aiFilled.has("offers") ? <AiBadge /> : null}>
                <ChipRow
                  options={COLLAB_TYPES}
                  selected={offers}
                  onToggle={(t) => toggle(offers, setOffers, t)}
                />
                {errField?.anchor === "offers-chips" && (
                  <p className="mt-2 text-[13px] text-danger">{errField.msg}</p>
                )}
              </Field>
            </div>

            {/* ⭐**라벨이 답을 정한다** — 「이런 파트너를 찾고 있어요」라고 물으니 답이 전부 *누구*로 나왔고,
                정작 걸고 싶던 *조건*(계단뿌셔클럽: 10명 이상 기업 워크숍만)은 물어본 적이 없어 안 적혔다. */}
            <Field
              label="어떤 콜라보/파트너를 찾고 있으신가요? (선택)"
              hint={aiFilled.has("seeks") ? <AiBadge /> : null}
            >
              {/* 🚨**이 줄을 placeholder로 옮기지 말 것** — AI 초안이 칸을 채우면 placeholder는 사라져,
                  조건을 물어보는 말이 정작 **AI 초안이 있는 소개서에서만 안 보이게** 된다(08-12).
                  예시는 빈 칸에서만 필요하니 placeholder로 가도 되지만, **묻는 말은 여기 남는다.** */}
              <p className="mb-2 text-[13px] leading-relaxed text-mute">
                (혹시, 콜라보 제안에 특별한 조건이 있다면 알려주세요.)
              </p>
              <textarea
                value={seeksNote}
                onChange={(e) => setSeeksNote(e.target.value)}
                rows={4}
                placeholder="예) 수선의 철학에 공감하는 다양한 브랜드, 작가님들과 열린 주제로 콜라보를 논의해보고 싶어요, 10명 이상 기업 워크숍 콜라보만 진행하고 있어요. 등"
                className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
              />
            </Field>
          </div>
        </section>

        {/* ── 시트 출신 — 우리 브랜드를 표현하는 키워드 (구③ · 정본 위치 = ① 뒤) ── */}
        <StubSection
          id="sec-keywords"
          badge={aiFilled.has("keywords") ? <AiBadge /> : null}
          label="우리 브랜드를 표현하는 키워드를 골라주세요."
          hiddenWhenCollapsed
          expanded={openSections.has("keywords")}
          hasData={hasKeywords}
          onExpand={() => openSection("keywords")}
          onCollapse={() => closeSection("keywords")}
          onDelete={() => {
            setValues([]);
            closeSection("keywords");
          }}
        >
        <div className="space-y-8">
          {/* 분위기칩 — 우리를 표현하는 말 */}
          <div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-[15px] text-mute">직접 추가도 가능해요. 최대 10개</p>
              <span className="shrink-0 text-[12px] text-mute">
                {values.length} / {MAX_VIBES}
              </span>
            </div>
            {/* 선택·직접추가한 칩 — 최상단(선택한 게 위에 보이게) */}
            {values.some((v) => !ALL_VIBES.includes(v)) && (
              <div className="mb-4 flex flex-wrap gap-2">
                {values
                  .filter((v) => !ALL_VIBES.includes(v))
                  .map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleVibe(v)}
                      className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-[14px] text-primary-on"
                    >
                      {v} ✕
                    </button>
                  ))}
              </div>
            )}
            <div className="space-y-4">
              {VIBE_CATEGORIES.map((cat, i) => (
                <div
                  key={cat.label}
                  className={i > 0 ? "border-t border-hairline pt-4" : ""}
                >
                  <p className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold text-body">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                    {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cat.words.map((v) => {
                      const on = values.includes(v);
                      const full = !on && values.length >= MAX_VIBES;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleVibe(v)}
                          disabled={full}
                          className={`inline-flex h-8 items-center rounded-pill border px-3 text-[14px] transition-colors ${
                            on
                              ? "border-primary bg-primary-tint text-primary-on"
                              : "border-hairline bg-surface text-mute"
                          } ${full ? "cursor-not-allowed opacity-40" : ""}`}
                        >
                          {v}
                          {on ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={customVibe}
                onChange={(e) => setCustomVibe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addCustomVibe();
                  }
                }}
                placeholder="직접 더하기 (예: 아날로그)"
                disabled={values.length >= MAX_VIBES}
                className="h-10 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus disabled:opacity-40"
              />
              <button
                type="button"
                onClick={addCustomVibe}
                disabled={values.length >= MAX_VIBES}
                className="h-10 shrink-0 whitespace-nowrap rounded-sm border border-border-strong bg-surface px-4 text-[14px] font-medium text-ink disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </div>

        </div>
        </StubSection>

        {/* ── 스텁 A — 왜 이 브랜드를 시작하셨나요 (구②) ── */}
        <StubSection
          id="sec-story"
          badge={aiFilled.has("story") ? <AiBadge /> : null}
          label="왜 이 브랜드를 시작하셨나요?"
          sub="시작하게 된 계기를 편하게 적어주세요."
          hiddenWhenCollapsed
          expanded={openSections.has("story")}
          hasData={hasStory}
          onExpand={() => openSection("story")}
          onCollapse={() => closeSection("story")}
        >
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={5}
            placeholder="예: 좋은 소재가 버려지는 게 늘 아쉬웠어요. 이미 있는 것의 가치를 다시 발견하는 일이 더 의미 있다고 믿어요."
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </StubSection>

        {/* ── 스텁 B — 주로 어떤 활동을 하나요 (구④) ──
             🆕08-10 `sub`에서 "최대 5가지"를 지웠다 — 상한을 30으로 열어놓고 문구가 5라고 하면
             사장님은 5에서 멈춘다. 새 숫자(30)를 박지도 않는다: "30개나 써야 하나"라는 부담이 된다.
             개수는 문구가 아니라 [＋활동 추가] 버튼이 알려준다(상한에 닿으면 버튼이 사라짐). */}
        <StubSection
          id="sec-activities"
          badge={aiFilled.has("activities") ? <AiBadge /> : null}
          label="주로 어떤 활동을 하나요?"
          sub="우리가 하고 있는 일을 소개해주세요. 사진도 담을 수 있어요."
          hiddenWhenCollapsed
          expanded={openSections.has("activities")}
          hasData={hasActivities}
          onExpand={() => openSection("activities")}
          onCollapse={() => closeSection("activities")}
        >
          {/* [비활성] 미선택 활동 힌트 재노출 배너 — AI 플로우에서 사용자가 안 고른 추천은
              부정확할 수 있어 굳이 다시 띄우지 않음(대표 지시). 데이터(actHints/usedActHints)는
              보관 중이라, '선택한 것만·정확도 판단해 재노출' 고도화 시 여기 복원. → 백로그 [[위저드-힌트배너-재노출]] */}
          <div className="space-y-4">
          {activities.map((act, i) => (
            <SortableCard
              key={i}
              index={i}
              count={activities.length}
              label={`활동 ${i + 1}`}
              onMove={moveActivity}
              onRemove={i > 0 ? () => removeActivity(i) : undefined}
              dnd={actDnd}
              setDnd={setActDnd}
              idBase="act-card"
            >
              <input
                value={act.title}
                onChange={(e) => setAct(i, { title: e.target.value })}
                placeholder="예: 조형수선 워크숍"
                className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <textarea
                value={act.desc}
                onChange={(e) => setAct(i, { desc: e.target.value })}
                rows={4}
                placeholder="예: 이야기가 깃든 옷을 수선하고 업사이클링하는 워크숍을 진행해요."
                className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              {/* 사진·링크 접힘 버튼 — press와 동일하게 한 줄 인라인(space-y-2로 그룹) */}
              <div className="space-y-2">
                <CollapsedPhotos photoCount={act.photos.length}>
                  <p className="mb-1.5 text-[13px] text-mute">사진 (선택 · 최대 5장)</p>
                  <PhotoGrid
                    items={act.photos}
                    max={5}
                    onAdd={(files) => addActPhotos(i, files)}
                    onRemove={(k) => removeActPhoto(i, k)}
                    onReorder={(from, to) => moveActPhoto(i, from, to)}
                    onRetry={(k) => retryActPhoto(i, k)}
                  />
                </CollapsedPhotos>
                <CollapsedLink hasLink={!!act.link.trim()}>
                  <input
                    value={act.link}
                    onChange={(e) => setAct(i, { link: e.target.value })}
                    placeholder="소개 링크 https:// (블로그·후기 등)"
                    className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                  />
                </CollapsedLink>
              </div>
            </SortableCard>
          ))}
          {activities.length < MAX_ACTIVITIES && (
            <button
              type="button"
              onClick={addActivity}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-primary-tint bg-primary-pale py-2.5 text-[14px] font-medium text-primary-on transition-colors hover:bg-primary-tint"
            >
              ＋활동 추가
            </button>
          )}
          </div>
        </StubSection>

        {/* ── 스텁 C — 이런 콜라보 경험이 있어요 (구⑦) ── */}
        <StubSection
          id="sec-collabs"
          badge={aiFilled.has("collabs") ? <AiBadge /> : null}
          label="이런 콜라보 경험이 있어요."
          sub="선택 · 지난 콜라보를 더할수록 “검증된 파트너”라는 신호가 돼요."
          hiddenWhenCollapsed
          expanded={openSections.has("collabs")}
          hasData={hasCollabs}
          onExpand={() => openSection("collabs")}
          onCollapse={() => closeSection("collabs")}
        >
          <div>

            {/* [비활성] 미선택 콜라보 힌트 재노출 배너 — AI 플로우에서 안 고른 추천은 부정확할 수
                있어 재노출 안 함(대표 지시). 데이터(collabHints/usedCollabHints) 보관 중.
                → 백로그 [[위저드-힌트배너-재노출]] */}
            <div className="space-y-4">
              {collabHistory.map((h, i) => (
                <SortableCard
                  key={i}
                  index={i}
                  count={collabHistory.length}
                  label={`콜라보 ${i + 1}`}
                  onMove={moveCollab}
                  onRemove={collabHistory.length > 1 ? () => removeCollab(i) : undefined}
                  dnd={colDnd}
                  setDnd={setColDnd}
                  className="space-y-5"
                  idBase="col-card"
                >
                  {/* 타이틀 + 시기 — 한 행(타이틀 몇년, 어떤 콜라보 타입? 순서로 읽히게) */}
                  <div className="flex gap-2">
                    <input
                      value={h.partner}
                      onChange={(e) => setHist(i, { partner: e.target.value })}
                      placeholder="함께한 곳 (예: 오월의숲)"
                      className="h-10 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                    <div className="relative w-28 shrink-0">
                      <select
                        value={h.year}
                        onChange={(e) => setHist(i, { year: e.target.value })}
                        className="h-10 w-full appearance-none rounded-sm border border-hairline bg-surface py-2 pl-3 pr-8 text-base text-ink outline-none focus:border-focus"
                      >
                        <option value="">시기</option>
                        {HISTORY_YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <svg
                        viewBox="0 0 20 20"
                        className="pointer-events-none absolute right-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-faint"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[13px] text-mute">어떤 타입의 콜라보였나요?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COLLAB_TYPES.map((t) => {
                        const on = h.types.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleHistType(i, t)}
                            className={`inline-flex h-7 items-center rounded-pill border px-2.5 text-[14px] transition-colors ${
                              on
                                ? "border-primary bg-primary-tint text-primary-on"
                                : "border-hairline bg-surface text-mute"
                            }`}
                          >
                            {t}
                            {on ? " ✓" : ""}
                          </button>
                        );
                      })}
                      {h.types
                        .filter((t) => !COLLAB_TYPES.includes(t as CollabType))
                        .map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleHistType(i, t)}
                            className="inline-flex h-7 items-center rounded-pill border border-primary bg-primary-tint px-2.5 text-[14px] text-primary-on"
                          >
                            {t} ✕
                          </button>
                        ))}
                    </div>
                    {h.typeInputOpen ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          autoFocus
                          value={h.typeInput}
                          onChange={(e) => setHist(i, { typeInput: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              addHistCustomType(i);
                            }
                          }}
                          placeholder="유형 직접 더하기"
                          className="h-9 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                        />
                        <button
                          type="button"
                          onClick={() => addHistCustomType(i)}
                          className="h-9 shrink-0 whitespace-nowrap rounded-sm border border-border-strong bg-surface px-4 text-[14px] font-medium text-ink"
                        >
                          추가
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setHist(i, { typeInputOpen: true })}
                        className="mt-2 text-[13px] font-medium text-mute hover:text-ink"
                      >
                        + 유형 직접 추가
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="mb-1.5 text-[13px] text-mute">콜라보 내용을 간단히 알려주세요.</p>
                    <textarea
                      value={h.desc}
                      onChange={(e) => setHist(i, { desc: e.target.value })}
                      rows={4}
                      placeholder="예: 업사이클링 파우치를 함께 만들어 팝업에서 선보였어요."
                      className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                  </div>
                  {/* 사진·링크 접힘 버튼 — 카드 최하단, press와 동일하게 한 줄 인라인(space-y-2로 그룹) */}
                  <div className="space-y-2">
                    <CollapsedPhotos photoCount={h.photos.length}>
                      <p className="mb-1.5 text-[13px] text-mute">사진 (선택 · 최대 5장)</p>
                      <PhotoGrid
                        items={h.photos}
                        max={5}
                        onAdd={(files) => addHistPhotos(i, files)}
                        onRemove={(k) => removeHistPhoto(i, k)}
                        onReorder={(from, to) => moveHistPhoto(i, from, to)}
                        onRetry={(k) => retryHistPhoto(i, k)}
                      />
                    </CollapsedPhotos>
                    <CollapsedLink hasLink={!!h.link.trim()}>
                      <input
                        value={h.link}
                        onChange={(e) => setHist(i, { link: e.target.value })}
                        placeholder="소개 링크 https:// (블로그·후기 등)"
                        className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                      />
                    </CollapsedLink>
                  </div>
                </SortableCard>
              ))}
              {collabHistory.length < MAX_COLLABS && (
                <button
                  type="button"
                  onClick={addCollab}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-primary-tint bg-primary-pale py-2.5 text-[14px] font-medium text-primary-on transition-colors hover:bg-primary-tint"
                >
                  ＋콜라보 추가
                </button>
              )}
            </div>
          </div>
        </StubSection>

        {/* ── 이런 콜라보를 제공할 수 있어요 (08-12 이사 — 소개서와 같은 자리) ──
            "이런 걸 해왔고 → 이런 걸 해드릴 수 있어요"라 콜라보 이력 바로 뒤가 맞다.
            ⭐**위 「찾고 있어요」와 방향이 반대다**(문 vs 제안) — 그래서 붙이지 않고 멀리 떼어 둔다.
            🆕**위계를 올렸다** — 전엔 필수 칩 안에 13px 회색 소제목으로 얹혀 있어서, 소개서에선 독립
              섹션인데 폼에선 곁다리로 보였다. 이제 다른 섹션과 같은 18px 제목이다(대표 지적 08-12). */}
        <StubSection
          id="sec-offersNote"
          badge={aiFilled.has("offersNote") ? <AiBadge /> : null}
          label="이런 콜라보를 제공할 수 있어요."
          sub="우리 쪽에서 내어줄 수 있는 것 — 공간·재료·인력·채널처럼 구체적일수록 제안이 들어와요."
          /* ⚠️`hiddenWhenCollapsed`를 붙이지 않는다(옆 스텁들과 다른 점). 이 칸은 원래 ① 안에
             **항상 보이던** 칸이라, 시트 뒤로 숨기면 위계는 올라가는데 노출은 떨어져 요청과 반대가 된다.
             그래서 빈 상태에서도 점선 스텁으로 남는다 — 대신 추가 시트 목록에서 뺐다(진입점 하나로). */
          expanded={openSections.has("offersNote")}
          hasData={hasOffersNote}
          onExpand={() => openSection("offersNote")}
          onCollapse={() => closeSection("offersNote")}
        >
          <textarea
            value={offersNote}
            onChange={(e) => setOffersNote(e.target.value)}
            rows={4}
            placeholder="매력적인 분들과의 제품 콜라보, 서로의 매력을 담은 원데이 워크숍, 공동 굿즈 등 다양한 콜라보를 기대해요!"
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </StubSection>

        {/* ── 선택 블록(코어 ⑦과 ⑧ 사이) ── */}
        <BlockEditor
          blocks={blocks}
          onChange={setBlocks}
          onUploadingChange={setBlocksUploading}
          onSheetOpenChange={setBlockSheetOpen}
          suppressFab={layerOpen}
          storyItems={[
            { key: "activities", label: "주로 어떤 활동을 하나요?", hint: "대표 활동을 소개해주세요.", added: openSections.has("activities") || hasActivities, onAdd: () => addStorySection("activities"), group: "recommend" },
            { key: "collabs", label: "이런 콜라보 경험이 있어요.", hint: "지난 콜라보를 더하면 검증된 파트너 신호가 돼요.", added: openSections.has("collabs") || hasCollabs, onAdd: () => addStorySection("collabs"), group: "recommend" },
            /* 🆕이 시트에서 빠진 둘(08-12): `seeks`는 상시 노출 섹션으로 승격됐고, `offersNote`는
               원래부터 상시 노출(구 ① 칩 하단)이라 **진입점이 둘이면 오히려 헷갈린다.**
               ⚠️둘 다 폼에 자리가 이미 있으니 "추가하기"로 또 부르지 않는다. */
            { key: "customers", label: "저희는 주로 이런 고객과 함께하고 있어요.", hint: "주요 고객을 알려주세요.", added: openSections.has("customers") || hasCustomers, onAdd: () => addStorySection("customers"), group: "recommend" },
            { key: "story", label: "왜 이 브랜드를 시작하셨나요?", hint: "시작하게 된 계기를 편하게 적어주세요.", added: openSections.has("story") || hasStory, onAdd: () => addStorySection("story"), group: "story" },
            { key: "keywords", label: "우리 브랜드를 표현하는 키워드를 골라주세요.", hint: "분위기를 칩으로 골라요.", added: openSections.has("keywords") || hasKeywords, onAdd: () => addStorySection("keywords"), group: "story" },
          ]}
        />

        {/* ── 시트 출신 — 저희는 주로 이런 고객과 함께하고 있어요 (구⑧) ── */}
        <StubSection
          id="sec-customers"
          badge={aiFilled.has("customers") ? <AiBadge /> : null}
          label="저희는 주로 이런 고객과 함께하고 있어요."
          hiddenWhenCollapsed
          expanded={openSections.has("customers")}
          hasData={hasCustomers}
          onExpand={() => openSection("customers")}
          onCollapse={() => closeSection("customers")}
        >
        <div className="space-y-8">
          {/* 이런 분들과 만나요 (타겟 고객) */}
          <div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_AUDIENCE.map((a) => {
                const on = targetAudience.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAudience(a)}
                    className={`inline-flex h-8 items-center rounded-pill border px-3 text-[14px] transition-colors ${
                      on
                        ? "border-primary bg-primary-tint text-primary-on"
                        : "border-hairline bg-surface text-mute"
                    }`}
                  >
                    {a}
                    {on ? " ✓" : ""}
                  </button>
                );
              })}
              {targetAudience
                .filter((a) => !SUGGESTED_AUDIENCE.includes(a))
                .map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAudience(a)}
                    className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-[14px] text-primary-on"
                  >
                    {a} ✕
                  </button>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addCustomAudience();
                  }
                }}
                placeholder="직접 더하기 (예: 신혼부부)"
                className="h-10 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <button
                type="button"
                onClick={addCustomAudience}
                className="h-10 shrink-0 whitespace-nowrap rounded-sm border border-border-strong bg-surface px-4 text-[14px] font-medium text-ink"
              >
                추가
              </button>
            </div>
          </div>
        </div>
        </StubSection>

        {/* ── ② 브랜드 정보를 입력해주세요 (구⑨ — 번호 섹션은 ①·②만 남음) ── */}
        <GroupHeader n="②" title="브랜드 정보를 입력해주세요." />
        <div className="space-y-8">
          <Field label="상세주소 (선택)" hint={hintFor("address", "address")}>
            <input
              id="detail-address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setAddrAuto(null); // 직접 고치기 시작하면 '되돌리기' 안내는 사라진다
              }}
              placeholder="서울 성북구 보문로 56, 5층"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            {/* 덮어쓴 사실을 숨기지 않는다 — 사장님이 쓴 값을 말없이 바꾸면 "내가 쓴 게 어디 갔지"가 된다.
                되돌리기를 함께 줘서, 네이버가 틀렸을 때 원래 값으로 즉시 복구할 수 있게. */}
            {addrAuto && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-mute">
                <span>📍 네이버 지도에서 주소를 가져왔어요.</span>
                <button
                  type="button"
                  onClick={() => {
                    setAddress(addrAuto.prev);
                    setAddrAuto(null);
                  }}
                  className="text-primary-on underline underline-offset-2 hover:text-ink"
                >
                  직접 쓴 주소로 되돌리기
                </button>
              </p>
            )}
            {region && (
              <p className="mt-1 text-[13px] text-mute">
                지역 자동 인식: <span className="text-body">{region}</span>
              </p>
            )}
          </Field>
          <Field label="인스타그램 (선택)" hint={hintFor("instagram", "instagram")}>
            {/* '@' 고정 접두어 — 입력창 밖에 표시해 사용자가 넣거나 빠뜨리는 표기 편차 제거(대표 지시 07-20) */}
            {/* 포커스 링은 래퍼가 소유 — globals.css의 전역 :focus-visible 규칙이 레이어 밖이라
                Tailwind outline-none보다 우선한다. 안쪽 input은 `!`로 눌러 링 겹침을 막는다. */}
            <div className="flex h-11 w-full items-center rounded-sm border border-hairline bg-surface px-3 focus-within:[outline:2px_solid_var(--focus)] focus-within:[outline-offset:2px]">
              <span className="shrink-0 text-base text-mute">@</span>
              <input
                value={instagram.replace(/^@+/, "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  // 프로필 URL을 붙여넣은 경우에만 핸들로 정리 — 평소 타이핑은 그대로 둬야 방해가 없다
                  const v = /instagram\.com|^https?:\/\//i.test(raw)
                    ? instagramSlug(raw)
                    : raw.replace(/^@+/, "");
                  setInstagram(v ? `@${v}` : "");
                }}
                placeholder="handle"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none! placeholder:text-faint"
              />
            </div>
          </Field>
          <Field label="대표 URL (선택)" hint={hintFor("homepage", "homepage")}>
            <input
              value={homepage}
              onChange={(e) => setHomepage(e.target.value)}
              placeholder="홈페이지·카카오톡 채널·링크트리 등"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>
          {/* 지도 링크 — 홈페이지 없는 가게가 대다수라, 주소·시간·전화·사진이 한 번에 딸려오는
              지도 링크가 사실상 홈페이지 역할을 한다. 지도 앱 '공유'의 축약 링크를 그대로 붙여넣으면 됨. */}
          <Field label="지도 링크 (선택)">
            {/* 지도 URL은 좌표·한글이 퍼센트 인코딩돼 흉물스럽다 — 확인되면 서비스명만 보여주고
                원문은 [변경]을 눌렀을 때만 편집. 잘못 넣은 값은 그대로 입력창에 남겨 고치게 한다. */}
            {mapLinkLabel(mapUrl) && !mapUrlEditing ? (
              <div className="flex h-11 items-center gap-2 rounded-sm border border-hairline bg-surface px-3">
                <span className="text-base text-ink">📍 {mapLinkLabel(mapUrl)}</span>
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-[14px] text-primary-on underline underline-offset-2"
                >
                  열어보기 ↗
                </a>
                <button
                  type="button"
                  onClick={() => setMapUrlEditing(true)}
                  className="ml-auto text-[13px] text-mute hover:text-ink"
                >
                  변경
                </button>
              </div>
            ) : (
              <input
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                onBlur={() => mapLinkLabel(mapUrl) && setMapUrlEditing(false)}
                placeholder="네이버 지도·카카오맵 공유 링크"
                className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
              />
            )}
            {/* ⭐ 지도 한 컷(08-02, 대표 지시) — 링크만 보여주면 **맞게 넣었는지 확인할 방법이
                [열어보기 ↗]로 나가는 것뿐**이었다. 저장하면 소개서에 이 지도가 그대로 실리니,
                작성 화면에서 미리 같은 그림을 보는 게 맞다(작성 = 결과의 예고여야 한다).
                ⚠️ 좌표를 못 뽑으면(place 공유 링크 등) 안 그린다 — 위 링크 행이 그대로 폴백.
                   그런 건은 저장 시 상호명 재조회로 좌표가 채워져 소개서엔 지도가 뜬다. */}
            {mapPin && (
              <div className="mt-2">
                <MapCard {...mapPin} address={name.trim() || "우리 브랜드"} mapUrl={mapUrl} compact />
              </div>
            )}
            {mapUrl.trim() && !mapLinkLabel(mapUrl) && (
              <p className="mt-1 text-[13px] text-mute">
                네이버 지도·카카오맵·구글 지도 링크만 넣을 수 있어요. 지도 앱의 공유 버튼에서 복사해 주세요.
              </p>
            )}
          </Field>
        </div>

        {/* 공개·수신 설정 — **두 토글은 서로 다른 축이다.** 헷갈리면 사장님이 엉뚱한 걸 끈다.
              · [콜라보 찾기에 보이기] = 사이트 안 목록에 뜨나(웹 검색은 이 토글과 무관, 08-07 개명)
              · [콜라보 요청 잠시 안받기] = 지금 제안을 받나
            07-31엔 앞 토글 하나가 뒤 역할까지 겸했는데(구 `collab_open` 폐지), 08-07에 앞 토글의 뜻을
            목록으로 좁히면서 "요청을 안 받는다"를 말할 자리가 사라졌다 → 08-12 재분리(대표 지시). */}
        <div className="space-y-2">
          <SettingToggle
            label="콜라보 찾기에 보이기"
            desc="켜두면 다른 브랜드가 [콜라보 찾기]에서 나를 발견해 콜라보를 제안할 수 있어요. 꺼두면 목록에 안 뜨고, 링크로는 계속 공유할 수 있어요."
            on={searchVisible}
            onToggle={() => setSearchVisible((v) => !v)}
          />
          <SettingToggle
            label="콜라보 요청 잠시 안받기"
            desc="켜두면 소개서에 [잠시 콜라보를 쉬고 있어요]가 표시되고 제안 버튼이 잠겨요. 소개서는 그대로 보이고, 찜·콜라보 추천은 계속 받을 수 있어요."
            on={collabPaused}
            onToggle={() => setCollabPaused((v) => !v)}
          />
        </div>

      </div>

      {/* ── 플로팅 제출 바 (브랜드 소개서 등록하기 / 수정 완료) — 레이어 열리면 아래로 사라짐 ── */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 transition-all duration-300 ease-out ${
          layerOpen ? "pointer-events-none translate-y-28 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          className="mx-auto max-w-[640px] bg-canvas px-4 pt-3 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]"
        >
          <button
            onClick={submit}
            disabled={
              pending ||
              blocksUploading ||
              pdfUploading ||
              [...photos, ...activities.flatMap((a) => a.photos), ...collabHistory.flatMap((h) => h.photos)].some(
                (p) => p.uploading
              )
            }
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-medium text-primary-on shadow-e2 disabled:opacity-40"
          >
            {pending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-on border-t-transparent" />
            )}
            {editSlug
              ? pending
                ? "수정 중…"
                : "수정 완료"
              : pending
                ? "만드는 중…"
                : "브랜드 소개서 등록하기"}
          </button>
        </div>
      </div>

      {/* 필수 미입력 토스트 — 화면 하단 중앙, 2.5초 후 자동 사라짐 */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          {/* assertive — 제출이 막혔다는 건 지금 당장 알아야 하는 말이다(polite면 읽던 걸 다 읽고 나서야 온다) */}
          <div
            role="alert"
            aria-live="assertive"
            className="max-w-[90%] rounded-pill bg-ink px-4 py-2.5 text-center text-[14px] font-medium text-on-dark shadow-e2"
          >
            {toast}
          </div>
        </div>
      )}

      {/* 딸깍 자동완성 위저드 — 가중 키워드 → 백그라운드 크롤 → 한줄/소개 5지선다 */}
      {wizardOpen && (
        <EnrichWizard
          query={query.trim()}
          onClose={() => setWizardOpen(false)}
          onApply={applyWizard}
        />
      )}

      {/* 초안받기 2스텝 모달 — 스텝1 한 줄 소개 → 스텝2 자세히 소개 → [확인] 시 둘 다 채움 */}
      {descModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" {...draftDialog.overlayProps}>
          <div
            {...draftDialog.panelProps}
            className="slim-scrollbar relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-hairline bg-surface p-5 shadow-e2"
          >
            <button
              type="button"
              onClick={() => setDescModalOpen(false)}
              aria-label="닫기"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-[18px] text-mute hover:bg-surface-soft hover:text-ink"
            >
              ✕
            </button>
            {draftBusy ? (
              /* 로딩 — 기존 초안받기 로딩 문구·스피너 그대로 */
              <div className="flex min-h-[180px] items-center justify-center">
                <p className="flex items-center gap-2 text-[14px] font-medium text-primary-on">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  온라인 정보를 살펴 소개를 쓰고 있어요…
                </p>
              </div>
            ) : draftStep === 1 ? (
              <>
                <p className="pr-8 text-[17px] font-bold text-ink">
                  마음에 드는 소개를 골라주세요{" "}
                  <span className="text-[13px] font-medium text-mute">1/2</span>
                </p>
                <p className="mt-1 text-[13px] text-mute">
                  ‘수정’으로 다듬어도 되고, 맨 아래에 직접 입력해도 좋아요.
                </p>
                <div className="mt-4 max-h-[52vh] overflow-y-auto slim-scrollbar pr-0.5">
                  <DescPicker
                    list={olChoices}
                    sel={olSel}
                    onSelect={setOlSel}
                    onEdit={editOlChoice}
                    rows={2}
                    custom={olCustom}
                    onCustom={(v) => {
                      setOlCustom(v);
                      setOlSel(-1);
                    }}
                    customRows={2}
                  />
                </div>
                <button
                  type="button"
                  onClick={goToDescStep}
                  className="mt-4 h-11 w-full rounded-md bg-primary text-[14px] font-medium text-primary-on"
                >
                  다음
                </button>
              </>
            ) : descRegenBusy ? (
              /* 자세히 재생성 로딩 — 고른 한 줄을 관통 주제로 다시 쓰는 중 */
              <div className="flex min-h-[180px] items-center justify-center">
                <p className="flex items-center gap-2 text-[14px] font-medium text-primary-on">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  고르신 소개에 맞춰 자세히 소개를 다시 쓰고 있어요…
                </p>
              </div>
            ) : (
              <>
                <p className="pr-8 text-[17px] font-bold text-ink">
                  마음에 드는 자세히 소개를 골라주세요{" "}
                  <span className="text-[13px] font-medium text-mute">2/2</span>
                </p>
                <p className="mt-1 text-[13px] text-mute">
                  ‘수정’으로 다듬어도 되고, 맨 아래에 직접 입력해도 좋아요.
                </p>
                <div className="mt-4 max-h-[52vh] overflow-y-auto slim-scrollbar pr-0.5">
                  <DescPicker
                    list={descChoices}
                    sel={descSel}
                    onSelect={setDescSel}
                    onEdit={editDescChoice}
                    custom={descCustom}
                    onCustom={(v) => {
                      setDescCustom(v);
                      setDescSel(-1);
                    }}
                    customRows={4}
                  />
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftStep(1)}
                    className="h-11 shrink-0 rounded-md border border-border-strong bg-surface px-4 text-[14px] font-medium text-ink"
                  >
                    ← 뒤로
                  </button>
                  <button
                    type="button"
                    onClick={applyDraft}
                    className="h-11 flex-1 rounded-md bg-primary text-[14px] font-medium text-primary-on"
                  >
                    확인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 제출 인터셉트 추천 모달 — 소개가 얇을 때 이야기 더하기 제안(바텀시트 스타일 재활용) */}
      {/* 초본 완성 얼럿 — AI 크롤이 폼을 채운 직후 1회. 톤=보상(🎉), 사진은 '관문' 아닌 '초본 후 업그레이드'. */}
      {showDraftDone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          {...draftDoneDialog.overlayProps}
        >
          <div
            {...draftDoneDialog.panelProps}
            className="slim-scrollbar relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2"
          >
            <div className="text-4xl leading-none" aria-hidden="true">🎉</div>
            <p className="mt-3 text-[18px] font-bold text-ink">소개서 초안이 준비됐어요!</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-body">
              작성된 내용을 확인하고 완성해주세요.
            </p>
            <div className="mt-4 rounded-md bg-primary-pale px-4 py-3 text-center">
              <p className="text-[14px] leading-relaxed text-primary-on">
                💡 작성된 소개서에 사진을 더해 소개서를 더 눈에 띄게 만들어보세요. 지금 사진이 없다면 나중에 언제든 추가할 수 있어요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDraftDone(false)}
              className="mt-5 h-11 w-full rounded-md bg-primary text-[14px] font-semibold text-primary-on"
            >
              소개서 완성하러 가기
            </button>
          </div>
        </div>
      )}

      {showNudge && (() => {
        const dismissNudge = nudgeDismiss;
        const items = ([
          ["activities", "주로 어떤 활동을 하나요?", "대표 활동을 소개해주세요.", hasActivities],
          ["collabs", "이런 콜라보 경험이 있어요.", "지난 콜라보를 더하면 검증된 파트너 신호가 돼요.", hasCollabs],
          ["offersNote", "이런 콜라보를 제공할 수 있어요.", "우리 쪽에서 내어줄 수 있는 것을 알려주세요.", hasOffersNote],
          ["customers", "저희는 주로 이런 고객과 함께하고 있어요.", "주요 고객을 알려주세요.", hasCustomers],
        ] as const).filter(([key, , , has]) => !has && !openSections.has(key));
        return (
          <div className="fixed inset-0 z-50 bg-ink/40" {...nudgeDialog.overlayProps}>
            <div
              {...nudgeDialog.panelProps}
              className="absolute inset-x-0 bottom-0 mx-auto max-w-[640px] overflow-hidden rounded-t-2xl bg-surface shadow-xl"
            >
              <div
                style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
                className="max-h-[60vh] overflow-y-auto slim-scrollbar p-4 sm:max-h-[70vh]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="pr-8">
                    <p className="text-[17px] font-bold text-ink">잠깐, 이런 소개를 더해보는 건 어때요?</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-mute">이야기를 조금만 더하면 훨씬 단단한 소개서가 돼요.</p>
                  </div>
                  <button
                    type="button"
                    onClick={dismissNudge}
                    aria-label="닫기"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-mute hover:bg-surface-soft hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map(([key, label, hint]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        openSection(key);
                        setShowNudge(false);
                        setTimeout(() => document.getElementById("sec-" + key)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
                      }}
                      className="w-full rounded-md border border-hairline px-3.5 py-3 text-left hover:bg-surface-soft"
                    >
                      <p className="text-[15px] font-semibold text-ink">{label}</p>
                      <p className="mt-0.5 text-[13px] text-mute">{hint}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={dismissNudge}
                    className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-[14px] font-medium text-ink"
                  >
                    다음에 하기
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNudgeShown(true); setShowNudge(false); doSubmit(); }}
                    className="h-11 flex-1 rounded-md bg-primary text-[14px] font-medium text-primary-on"
                  >
                    브랜드 소개서 등록하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 등록 완료 → 브랜드 소개서 얼럿 (소개서 페이지에서 확인·링크 공유) */}
      {portfolioOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" {...portfolioDialog.overlayProps}>
          <div
            {...portfolioDialog.panelProps}
            className="slim-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2"
          >
            <p className="text-[18px] font-bold text-ink">✨ 브랜드 소개서가 완성됐어요!</p>
            {loggedIn ? (
              <>
                <p className="mt-3 text-[15px] leading-relaxed text-body">
                  브랜드 소개서 페이지에서 내용을 확인해보세요.
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-body">
                  이제, 링크를 복사해 협업을 제안할 수 있어요.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-[15px] leading-relaxed text-body">
                  이제 링크를 복사해 협업을 제안해 볼 수 있어요! 비회원 상태라 관리용 비밀번호를 입력해주세요.
                </p>
                <div className="mt-7 text-left">
                  <label className="mb-1.5 block text-[16px] font-medium text-body">
                    소개서 관리 비밀번호 <span className="text-red-500">*</span>{" "}
                    <span className="font-normal text-faint">(입력 규칙 없음)</span>
                  </label>
                  <PasswordInput
                    value={editPw}
                    onChange={(e) => setEditPw(e.target.value)}
                    placeholder="비밀번호를 입력해주세요"
                    className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                  />
                  {pwErr && <p className="mt-2 text-[13px] text-red-600">{pwErr}</p>}
                  <p className="mt-2 text-[13px] leading-relaxed text-faint">
                    잊어버리면 고객센터를 통해서만 찾을 수 있으니 기억해주세요.
                  </p>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={goToPage}
              disabled={goingToPage || savingPw || (!loggedIn && !editPw.trim())}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
            >
              {goingToPage || savingPw ? "이동 중…" : "소개서 확인하러 가기"}
            </button>
            {/* ⭐ 콜라보 분석 진입(P1c) — 홈 ③의 약속("소개서 만들면 분석 받아요")의 이행 지점.
                로그인 유저만(비회원은 비번 흐름 보호 + 리포트 자체가 로그인 필요).
                딥링크 = /m/{파트너}?report={내slug} — MakerActionBar의 아카이브 딥링크 배선 재사용(0신규). */}
            {loggedIn && analysisPartner && (
              <button
                type="button"
                onClick={() => {
                  track("report_start_from_publish");
                  setGoingToPage(true);
                  router.push(`/m/${analysisPartner.slug}?report=${createdSlug}`);
                }}
                disabled={goingToPage}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink disabled:opacity-50"
              >
                {analysisPartner.name}님과 콜라보 추천받기
              </button>
            )}
            <p className="mt-3 text-[13px] text-faint">언제든 ‘내 소개서’에서 수정할 수 있어요.</p>
          </div>
        </div>
      )}

      {/* 소개서 미리보기 바텀시트 — ① 사진 섹션 링크에서 열림. 정적 이미지 2장(사진 없는 버전 먼저),
          외부 이동 링크 없음(폼 이탈 방지). 오버레이만 — 폼 상태·스크롤 비파괴. */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40" {...previewDialog.overlayProps}>
          <div
            {...previewDialog.panelProps}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-[640px] overflow-hidden rounded-t-2xl bg-surface shadow-xl"
          >
            <div
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
              className="max-h-[85vh] overflow-y-auto slim-scrollbar p-4 sm:max-h-[85vh]"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="pr-8">
                  <p className="text-[18px] font-bold text-ink">소개서 미리보기</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
                    사진은 나중에 언제든 더할 수 있어요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="닫기"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-mute hover:bg-surface-soft hover:text-ink"
                >
                  ✕
                </button>
              </div>
              {/* 실제 텍스트 데모 소개서를 페이지처럼 렌더(스크롤 전체) — 링크복사 플로팅 없음(MakerArticle엔 미포함) */}
              {demoMaker ? (
                <MakerArticle maker={demoMaker.maker} isOwner={false} logoUrl={demoMaker.logoUrl ?? undefined} />
              ) : (
                <p className="py-10 text-center text-[13px] text-mute">불러오는 중이에요…</p>
              )}
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="mt-6 h-11 w-full rounded-md bg-primary text-[14px] font-medium text-primary-on"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// 브랜드 소개 5지선다 — 각 후보를 그 자리에서 수정 가능(controlled). 다듬으며 비교 → 하나 선택.
function DescPicker({
  list,
  sel,
  onSelect,
  onEdit,
  rows = 5,
  custom,
  onCustom,
  customRows = 4,
}: {
  list: string[];
  sel: number; // -1 = 직접 입력
  onSelect: (i: number) => void;
  onEdit: (i: number, v: string) => void;
  rows?: number; // 후보 인라인 수정 textarea 높이
  custom?: string; // 직접 입력값 — onCustom과 함께 주면 최하단에 직접 입력 옵션 렌더
  onCustom?: (v: string) => void;
  customRows?: number;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {list.map((it, i) => {
        const on = sel === i;
        const isEditing = editing === i;
        return (
          <div
            key={i}
            className={`rounded-md border transition-colors ${
              on ? "border-primary bg-primary-pale" : "border-hairline bg-surface"
            }`}
          >
            <div className="flex items-start gap-2.5 px-3 py-3">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-label="이 소개 선택"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border text-[10px] font-bold ${
                  on ? "border-primary bg-primary text-primary-on" : "border-border-strong text-transparent"
                }`}
              >
                ✓
              </button>
              {isEditing ? (
                <textarea
                  value={it}
                  onChange={(e) => onEdit(i, e.target.value)}
                  autoFocus
                  rows={rows}
                  className="flex-1 rounded-sm border border-hairline bg-surface px-2.5 py-2 text-[15px] leading-relaxed text-ink outline-none focus:border-focus"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className={`flex-1 text-left text-[15px] leading-relaxed ${on ? "text-ink" : "text-body"}`}
                >
                  {it}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(isEditing ? null : i)}
                className="shrink-0 text-[13px] font-medium text-primary-on underline-offset-2 hover:underline"
              >
                {isEditing ? "완료" : "수정"}
              </button>
            </div>
          </div>
        );
      })}
      {onCustom !== undefined && (
        /* 최하단 직접 입력 옵션 — 선택(sel=-1) + 텍스트 입력 */
        <div
          className={`rounded-md border transition-colors ${
            sel === -1 ? "border-primary bg-primary-pale" : "border-hairline bg-surface"
          }`}
        >
          <div className="flex items-start gap-2.5 px-3 py-3">
            <button
              type="button"
              onClick={() => onSelect(-1)}
              aria-label="직접 입력 선택"
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border text-[10px] font-bold ${
                sel === -1
                  ? "border-primary bg-primary text-primary-on"
                  : "border-border-strong text-transparent"
              }`}
            >
              ✓
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-medium ${sel === -1 ? "text-ink" : "text-mute"}`}>
                직접 입력
              </p>
              <textarea
                value={custom ?? ""}
                onChange={(e) => onCustom(e.target.value)}
                onFocus={() => onSelect(-1)}
                rows={customRows}
                placeholder="원하는 소개를 직접 써주세요."
                className="mt-1.5 w-full rounded-sm border border-hairline bg-surface px-2.5 py-2 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupHeader({
  n,
  title,
  sub,
  action,
}: {
  /** 번호(①②). **없어도 된다** — 번호 없는 섹션 제목으로도 쓴다(펼친 StubSection 헤더와 같은 얼굴).
   *  ⚠️번호를 붙이는 건 "순서대로 채우는 곳"이라는 뜻이라 아무 데나 달지 말 것. */
  n?: string;
  title: string;
  sub?: string;
  action?: React.ReactNode; // 제목 행 우측 액션(예: ✨ 초안 받기)
}) {
  return (
    <div className="mb-[23px] border-b border-hairline pb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          {n && (
            <span className="rounded-pill bg-primary-tint px-2 py-0.5 text-[14px] font-bold text-primary-on">
              {n}
            </span>
          )}
          {/* 섹션 헤더 18 — 필드 라벨을 16으로 올리면서 함께 올린다(대표 확정 07-31).
              헤더를 17로 두면 라벨(16)과 1px 차이가 되어 위계가 굵기 하나에만 의존한다.
              2px + 굵기 두 겹으로 갈라져 있어야 "섹션 제목 / 필드 이름"이 다른 급으로 읽힌다. */}
          <span className="text-[18px] font-bold text-ink">{title}</span>
        </div>
        {action}
      </div>
      {sub && <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{sub}</p>}
    </div>
  );
}

function Field({
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  action?: React.ReactNode; // 라벨 행 우측 액션 (예: ✨ 초안 받기)
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[16px] font-medium text-body">
          <span>{label}</span>
          {hint}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

// AI가 채운 필드 표시 (✓검증마크 아님 — '초안' 표시)
function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-pill bg-primary-tint px-1.5 py-0.5 text-[10px] font-medium text-primary-on">
      ✨ 미리 채웠어요
    </span>
  );
}

// 못 찾은 검증가능 필드 — 직접 입력 노티
function MissingNote() {
  return <span className="text-[11px] font-normal text-mute">· 직접 입력이 필요해요</span>;
}

// 접힌 사진 첨부 — 사진 있으면 펼침 시작(기존 데이터 은닉 금지), 없으면 텍스트 버튼만.
// [Gate3 NIT-3] 자동 펼침은 0→n 전이에서만 — 사용자가 일부러 접은 상태와 싸우지 않는다.
function CollapsedPhotos({ children, photoCount }: { children: React.ReactNode; photoCount: number }) {
  const [open, setOpen] = useState(photoCount > 0);
  const prev = useRef(photoCount);
  useEffect(() => {
    if (prev.current === 0 && photoCount > 0) setOpen(true); // 위저드 주입·수정 로드(0→n)만
    prev.current = photoCount;
  }, [photoCount]);
  if (!open)
    return (
      // press의 텍스트 버튼과 동일 스타일 — 두 버튼(사진·링크)이 한 줄에 인라인, mr-4로 간격
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mr-4 text-[14px] text-mute underline underline-offset-2"
      >
        ＋사진 추가 (선택)
      </button>
    );
  return <>{children}</>;
}

// 콜라보·활동 카드의 링크 필드 — 기본 접힘, 값 있으면(수정 로드) 자동 펼침. CollapsedPhotos와 동일 패턴.
function CollapsedLink({ children, hasLink }: { children: React.ReactNode; hasLink: boolean }) {
  const [open, setOpen] = useState(hasLink);
  const prev = useRef(hasLink);
  useEffect(() => {
    if (!prev.current && hasLink) setOpen(true);
    prev.current = hasLink;
  }, [hasLink]);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mr-4 text-[14px] text-mute underline underline-offset-2"
      >
        ＋링크 추가 (선택)
      </button>
    );
  return <>{children}</>;
}

function ChipRow({
  options,
  selected,
  onToggle,
}: {
  options: CollabType[];
  selected: CollabType[];
  onToggle: (t: CollabType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => {
        const on = selected.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            className={`inline-flex h-8 items-center rounded-pill border px-3 text-[14px] transition-colors ${
              on
                ? "border-primary bg-primary-tint text-primary-on"
                : "border-hairline bg-surface text-mute"
            }`}
          >
            {t}
            {on ? " ✓" : ""}
          </button>
        );
      })}
    </div>
  );
}

/** 공개·수신 설정 토글 한 줄 — 라벨 + 설명 + 스위치.
 *  ⭐두 개 이상이 나란히 서게 되면서 컴포넌트로 뺐다. 같은 모양이어야 **둘이 같은 종류의 결정**
 *    (내 소개서를 어떻게 열어둘까)으로 읽힌다. */
function SettingToggle({
  label, desc, on, onToggle,
}: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3">
      <div>
        <p className="text-[15px] font-medium text-ink">{label}</p>
        <p className="text-[13px] leading-relaxed break-keep text-mute">{desc}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`flex h-[26px] w-11 shrink-0 items-center rounded-pill p-[2px] transition-colors ${
          on ? "bg-primary" : "bg-border-strong"
        }`}
      >
        <span
          className={`h-[22px] w-[22px] rounded-pill bg-white transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
