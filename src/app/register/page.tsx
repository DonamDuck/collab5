"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createMakerAction,
  setMakerPasswordAction,
  getAuthStateAction,
  updateMakerAction,
  getEditDataAction,
} from "@/lib/actions";
import type { CollabType, Block } from "@/lib/types";
import { deriveRegion } from "@/lib/region";
import { isRichIntro } from "@/lib/completeness";
import { uploadPhoto, uploadPdf } from "@/lib/upload";
import { ScrollLock } from "@/components/ScrollLock";
import type { ActivityHint, CollabHint, EnrichField } from "@/lib/enrich";
import { EnrichWizard, type WizardFill } from "./EnrichWizard";
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

// 편집 중 콜라보 이력 — 활동(activities)과 동일한 인라인 카드 패턴.
// photos는 {url,uploading?} — 선택 즉시 Storage 업로드, 제출 시 URL만 전송. typeInput은 커스텀 유형 입력(전송 제외).
type HistItem = {
  partner: string;
  types: string[];
  desc: string;
  year: string;
  photos: { url: string; uploading?: boolean }[];
  typeInput: string;
};
const emptyHist = (): HistItem => ({
  partner: "",
  types: [],
  desc: "",
  year: "",
  photos: [],
  typeInput: "",
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
  const [collabOpen, setCollabOpen] = useState(true);
  const [instagram, setInstagram] = useState("");
  const [homepage, setHomepage] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [photos, setPhotos] = useState<{ url: string; uploading?: boolean }[]>([]);
  // ── 소개서 개편 신규 필드 ──
  const [story, setStory] = useState("");
  const [activities, setActivities] = useState<
    { title: string; desc: string; photos: { url: string; uploading?: boolean }[] }[]
  >([{ title: "", desc: "", photos: [] }]);
  const [offersNote, setOffersNote] = useState("");
  const [seeksNote, setSeeksNote] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocksUploading, setBlocksUploading] = useState(false);
  const [introFileUrl, setIntroFileUrl] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const region = deriveRegion(address); // 주소에서 자동 추출 (별도 입력 없음)

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
  const hasActivities = activities.some((a) => a.title.trim() || a.desc.trim() || a.photos.length > 0);
  const hasCollabs = collabHistory.some((h) => h.partner.trim() || h.desc.trim() || h.photos.length > 0);
  const hasKeywords = values.length > 0;
  const hasCustomers = targetAudience.length > 0;
  const hasOffersNote = !!offersNote.trim();
  const hasSeeks = seeks.length > 0 || !!seeksNote.trim();

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
    setActivities(d.activities.map((a) => ({ title: a.title, desc: a.desc, photos: [] })));
    setOffersNote(d.offersNote);
    setOffers(d.offers);
    setSeeksNote(d.seeksNote);
    setSeeks(d.seeks);
    setTargetAudience(d.targetAudience);
    setAddress(d.address);
    setInstagram(d.instagram);
    setHomepage(d.homepage);
    setCollabHistory([
      { partner: d.history.partner, types: d.history.types, desc: "", year: d.history.year, photos: [], typeInput: "" },
    ]);
    setBlocks([
      { type: "metrics", uid: crypto.randomUUID(), photos: [], links: [], items: [{ label: "인스타 팔로워", value: "1.2만" }, { label: "누적 워크숍", value: "48회" }] },
    ]);
    setAiFilled(new Set(["name", "oneLiner", "description", "values", "address", "instagram", "homepage"]));
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

  // ── 콜라보 이력 (활동과 동일한 인라인 카드 패턴, 최대 3세트) ──
  const addCollab = () =>
    setCollabHistory((p) => (p.length >= 3 ? p : [...p, emptyHist()]));
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
  // 선택 즉시 업로드: objectURL 프리뷰+스피너 → 완료 시 publicUrl로 교체, 실패 시 제거
  type Ph = { url: string; uploading?: boolean };
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
        update((p) => [...p, { url: preview, uploading: true }]);
        uploadPhoto(f, maxDim)
          .then((url) => update((p) => p.map((x) => (x.url === preview ? { url } : x))))
          .catch(() => {
            update((p) => p.filter((x) => x.url !== preview));
            alert("사진 업로드에 실패했어요. 다시 시도해주세요.");
          });
      });
  };

  const addHistPhotos = (i: number, files: FileList | null) =>
    uploadInto(files, 3 - (collabHistory[i]?.photos.length ?? 0), 800, (f) =>
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

  // ── 대표 활동 (최대 3세트) ──
  const addActivity = () =>
    setActivities((p) => (p.length >= 3 ? p : [...p, { title: "", desc: "", photos: [] }]));
  const setAct = (i: number, patch: Partial<{ title: string; desc: string }>) =>
    setActivities((p) => p.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const addActPhotos = (i: number, files: FileList | null) =>
    uploadInto(files, 3 - (activities[i]?.photos.length ?? 0), 800, (f) =>
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

  // 초안받기: 상호 옆 버튼 → 모달 즉시 오픈(로딩) → 한 줄/자세히 후보 병렬 생성 → 2스텝 선택.
  // 첫 클릭='초안 받기', 이후='초안 다시 받기'(round 증가 → 다른 각도의 후보들).
  const draftDescription = async () => {
    if (!name.trim() || draftBusy) return;
    setDraftBusy(true);
    setDraftStep(1);
    setDescModalOpen(true);
    const payload = {
      name: name.trim(),
      oneLiner,
      values,
      offers,
      targetAudience,
      round: draftRound,
    };
    const post = (mode: "oneLiners" | "draft") =>
      fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...payload }),
      }).then((r) => r.json());
    const strs = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === "string" && !!s.trim())
        : [];
    try {
      const [ol, dr] = await Promise.allSettled([post("oneLiners"), post("draft")]);
      const ols = ol.status === "fulfilled" ? strs(ol.value.oneLiners) : [];
      let descs = dr.status === "fulfilled" ? strs(dr.value.descriptions) : [];
      if (!descs.length) {
        const fallback = ruleDraftText(); // AI 실패 → 규칙 기반 폴백 후보 1개
        if (fallback) descs = [fallback];
      }
      setOlChoices(ols);
      setOlSel(ols.length ? 0 : -1);
      setOlCustom("");
      setDescChoices(descs);
      setDescSel(descs.length ? 0 : -1);
      setDescCustom("");
    } finally {
      setDraftGenerated(true);
      setDraftRound((r) => r + 1);
      setDraftBusy(false);
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
  const openWizard = () => {
    if (!query.trim()) return;
    setWizardOpen(true);
  };

  // 힌트 '이 내용으로 시작하기' — 빈 카드 우선 채움, 없으면 새 카드(최대 3), 꽉 차면 불가.
  // inject* = 힌트 값 직접 주입: 위저드 ⑤스텝 즉시 적용은 setActHints 직후라 state 힌트를
  // 못 읽는 타이밍이므로 값 기반으로 분리(functional setState라 연속 주입도 안전).
  const injectActHint = (h: ActivityHint) => {
    setActivities((p) => {
      const empty = p.findIndex((a) => !a.title.trim() && !a.desc.trim() && !a.photos.length);
      if (empty >= 0)
        return p.map((a, j) => (j === empty ? { ...a, title: h.title, desc: h.desc } : a));
      if (p.length < 3) return [...p, { title: h.title, desc: h.desc, photos: [] }];
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
    activities.length < 3;
  const injectCollabHint = (h: CollabHint) => {
    setCollabHistory((p) => {
      const empty = p.findIndex(
        (c) => !c.partner.trim() && !c.desc.trim() && !c.types.length && !c.photos.length
      );
      if (empty >= 0)
        return p.map((c, j) => (j === empty ? { ...c, partner: h.partner, desc: h.desc } : c));
      if (p.length < 3) return [...p, { ...emptyHist(), partner: h.partner, desc: h.desc }];
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
    ) || collabHistory.length < 3;

  // 위저드가 고른 항목만 폼에 반영(검수 게이트). AI는 '초안'만 — 사용자가 확인·수정 후 저장.
  // ⑤스텝(찾은 이야기)에서 체크한 힌트(fill.selectedHints)는 즉시 적용 — never-overwrite:
  // 사용자가 이미 만진 필드는 덮지 않는다. 미선택 활동·콜라보 힌트는 actHints/collabHints에
  // 남아 섹션 안 인라인 힌트로 재등장하고, 미선택 seeks·블록 힌트는 적용 없이 소멸.
  const applyWizard = (fill: WizardFill) => {
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
    if (fill.homepage !== undefined) {
      setHomepage(fill.homepage);
      filled.add("homepage");
    }
    if (fill.values !== undefined) {
      setValues(fill.values);
      filled.add("values");
    }
    if (fill.description !== undefined) {
      setDescription(fill.description);
      filled.add("description");
      setDraftGenerated(true); // 위저드가 이미 소개 초안을 채움 → 버튼은 '다시 받기'로
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
      }
      if (sel.collabs.length) {
        sel.collabs.forEach((i) => {
          const h = fill.collabHints?.[i];
          if (h) injectCollabHint(h);
        });
        openSection("collabs");
      }
      if (sel.seeks && fill.seeksHint) {
        const types = fill.seeksHint.types.filter((t): t is CollabType =>
          (COLLAB_TYPES as string[]).includes(t)
        );
        if (!seeks.length && types.length) setSeeks(types);
        if (!seeksNote.trim() && fill.seeksHint.note.trim()) setSeeksNote(fill.seeksHint.note);
        openSection("seeks");
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
                .map((it) => ({ title: it.label, year: it.year || undefined }));
              if (items.length) nb.items = items;
            }
            return [...p, nb];
          });
        });
    }

    setAiFilled(filled);
    setMissing([]);
    setReviewMode(true);
    setWizardOpen(false);
  };

  // 라벨 옆 표시: AI가 채운 필드면 ✨배지, 못 찾은 필드면 "직접 입력" 노티
  const hintFor = (key: string, miss?: EnrichField) => {
    if (aiFilled.has(key)) return <AiBadge />;
    if (miss && missing.includes(miss)) return <MissingNote />;
    return undefined;
  };

  const canSubmit = name.trim().length > 0 && !pending;

  // ── 제출 인터셉트 추천 모달(등록 직전 1회) ──
  const [nudgeShown, setNudgeShown] = useState(false); // 한 번 뜨면 다음 등록엔 안 뜸
  const [showNudge, setShowNudge] = useState(false);

  // ── 등록 완료 얼럿(소개서 페이지로 이동) ──
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [createdSlug, setCreatedSlug] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [editPw, setEditPw] = useState("");
  const [showEditPw, setShowEditPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editAuthPw, setEditAuthPw] = useState(""); // 수정 저장 재검증용(세션스토리지에서, 소유자는 빈 값)
  // ?edit로 진입 시 데이터 불러오는 동안 로딩 화면(빈 생성폼 깜빡임 방지)
  // useSearchParams는 서버·클라 첫 렌더 모두 URL을 정확히 반영 — window.location 기반 초기화는
  // 서버 렌더 시 window가 없어 항상 false로 시작해 빈 생성폼이 잠깐 보이는 원인이었다.
  const [editBooting, setEditBooting] = useState(!!editParam);

  useEffect(() => {
    getAuthStateAction().then((s) => setLoggedIn(s.loggedIn)).catch(() => {});
  }, []);

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
      setDescription(m.trust.description ?? "");
      setStory(m.story ?? "");
      setValues(m.soul.values ?? []);
      setActivities(
        (m.activities.length ? m.activities : [{ title: "", desc: "", photos: [] }]).map((a) => ({
          title: a.title, desc: a.desc, photos: a.photos.map((u) => ({ url: u })),
        }))
      );
      setOffers(m.offers);
      setSeeks(m.seeks);
      setOffersNote(m.offersNote ?? "");
      setSeeksNote(m.seeksNote ?? "");
      setTargetAudience(m.targetAudience ?? []);
      setCollabHistory(
        (m.collabHistory.length
          ? m.collabHistory
          : [{ partner: "", types: [], desc: "", year: "", photos: [] }]
        ).map((h) => ({
          partner: h.partner, types: h.types, desc: h.desc ?? "", year: h.year ?? "",
          photos: h.photos.map((u) => ({ url: u })), typeInput: "",
        }))
      );
      setInstagram(m.trust.instagram ?? "");
      setHomepage(m.trust.homepage ?? "");
      setAddress(m.trust.address ?? "");
      setCollabOpen(m.collabOpen);
      setPhotos(m.photos.map((u) => ({ url: u })));
      setBlocks((m.blocks ?? []).map((b) => ({ ...b, uid: crypto.randomUUID() })));
      setIntroFileUrl(m.introFileUrl ?? "");
      // 수정모드 규칙: 데이터 있는 섹션은 펼쳐진 채 복귀(빈 섹션은 접힌 스텁/시트 잔류)
      const open = new Set<SectionKey>();
      if ((m.story ?? "").trim()) open.add("story");
      if (m.activities.length) open.add("activities");
      if (m.collabHistory.length) open.add("collabs");
      if ((m.soul.values ?? []).length) open.add("keywords");
      if ((m.targetAudience ?? []).length) open.add("customers");
      if ((m.offersNote ?? "").trim()) open.add("offersNote");
      if (m.seeks.length || (m.seeksNote ?? "").trim()) open.add("seeks");
      setOpenSections(open);
      setEditBooting(false);
    }).catch(() => setEditBooting(false));
  }, []);

  // 제출 전 클라이언트 검증 — 에러 문구 반환(통과 시 null)
  const validate = (): string | null => {
    if (!offers.length) return "제공할 수 있는 협업을 1개 이상 골라주세요.";
    return null;
  };

  const submit = () => {
    const err = validate();
    if (err) {
      alert(err);
      // 실패 항목으로 스크롤 — 협업 칩(미선택)만 남음
      document.getElementById("offers-chips")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // 등록 직전 1회 인터셉트 — 소개가 얇으면 추천 모달로 이야기 더하기 제안
    const p = { required: !!name.trim() && offers.length > 0, story: hasStory, activities: hasActivities, collabs: hasCollabs, keywords: hasKeywords, customers: hasCustomers, offersNote: hasOffersNote, seeks: hasSeeks, blocks: blocks.length };
    if (!nudgeShown && !isRichIntro(p)) { setShowNudge(true); return; }
    doSubmit();
  };

  const doSubmit = () => {
    startTransition(async () => {
      // 사진은 선택 즉시 Storage 업로드됨 → 여기선 URL만 수집(업로드중 항목 제외)
      // 내용이 있는 카드만(빈 카드는 제외) — 활동과 동일 규칙
      const filledHist = collabHistory.filter(
        (h) => h.partner.trim() || h.types.length || h.desc.trim() || h.photos.length
      );
      const photoUrls = photos.filter((p) => !p.uploading).map((p) => p.url);
      const activityOut = activities
        .filter((a) => a.title.trim() || a.desc.trim() || a.photos.length)
        .map((a) => ({
          title: a.title.trim(),
          desc: a.desc.trim(),
          photos: a.photos.filter((p) => !p.uploading).map((p) => p.url),
        }));
      const historyOut = filledHist.map((h) => ({
        partner: h.partner.trim(),
        types: h.types,
        desc: h.desc.trim(),
        year: h.year || undefined,
        photos: h.photos.filter((p) => !p.uploading).map((p) => p.url),
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
        seeks: hasSeeks ? seeks : [],
        values: hasKeywords ? values : [],
        targetAudience: hasCustomers ? targetAudience : [],
        collabHistory: hasCollabs ? historyOut.map((h) => ({ ...h, photos: wrap(h.photos) })) : [],
        story: hasStory ? story.trim() : "",
        activities: hasActivities ? activityOut.map((a) => ({ ...a, photos: wrap(a.photos) })) : [],
        offersNote: hasOffersNote ? offersNote : "",
        seeksNote: hasSeeks ? seeksNote : "",
        blocks,
        introFileUrl: introFileUrl || undefined,
        photos: wrap(photoUrls),
        collabOpen,
        instagram,
        homepage,
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
        router.push(`/m/${editSlug}`);
        return;
      }
      const { slug } = await createMakerAction(payload);
      setCreatedSlug(slug);
      setPortfolioOpen(true); // redirect 대신 소개서 얼럿
    });
  };
  // 소개서 페이지는 서버에서 데이터를 불러오는 동안 잠깐 멈춰 보임 → 버튼 로딩 표시.
  const [goingToPage, setGoingToPage] = useState(false);
  const goToPage = async () => {
    if (!loggedIn) {
      if (!editPw.trim()) return;
      setSavingPw(true);
      await setMakerPasswordAction(createdSlug, editPw.trim()).catch(() => {});
      setSavingPw(false);
    }
    setGoingToPage(true);
    router.push(`/m/${createdSlug}`);
  };

  if (editBooting) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-[640px] flex-col items-center justify-center px-4 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="mt-4 text-[15px] text-mute">소개서를 불러오는 중이에요…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6">
      {editSlug ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">
              소개서 수정
            </h1>
            <button
              type="button"
              onClick={() => router.push(`/m/${editSlug}`)}
              className="mt-1.5 shrink-0 text-sm font-medium text-mute hover:text-ink"
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
      <h1 className="text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">
        브랜드 소개서, 생각보다 금방 완성돼요.
      </h1>
      <p className="mt-2 text-[17px] leading-relaxed text-body">
        브랜드 이름 입력하면 AI가 소개서 초안을 준비해드려요. 확인하고 다듬으면 1~3분 안에 완성할 수 있어요.
      </p>

      {/* ✨ 딸깍 자동완성 — 이름만 알려주면 채워드릴게요 */}
      <div className="mt-10 rounded-xl border border-primary bg-primary-pale px-5 py-5">
        <p className="text-base font-bold text-ink">
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
            disabled={!query.trim()}
            className="h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-on disabled:opacity-40"
          >
            ✨ 불러오기
          </button>
        </div>
      </div>

      {/* AI 불러오기(위) ↔ 직접 입력(아래) 구분 소제목 */}
      <div className="mt-10 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline" />
        <span className="shrink-0 text-sm font-medium text-mute">
          또는 아래에 직접 입력 할 수 있어요.
        </span>
        <div className="h-px flex-1 bg-hairline" />
      </div>
        </>
      )}

      <div className="mt-8 space-y-12">
        {/* 검수 게이트 배너 — AI가 채운 직후 */}
        {reviewMode && (
          <div className="rounded-lg border border-primary bg-surface px-4 py-3 shadow-e1">
            <p className="text-[15px] font-medium text-ink">
              ✨ 온라인 정보와 SNS를 참고해서 브랜드를 분석해봤어요.
            </p>
            <p className="mt-0.5 text-sm text-mute">
              맞는지 확인하고 자유롭게 고쳐주세요. 못 찾은 곳은 직접 채우면 돼요.
            </p>
          </div>
        )}

        {/* ── ① 브랜드를 소개해주세요 ── */}
        <GroupHeader n="①" title="브랜드를 소개해주세요." />
        <div className="space-y-8">
          <Field
            label="상호 *"
            hint={hintFor("name")}
            action={
              <button
                type="button"
                onClick={draftDescription}
                disabled={!name.trim() || draftBusy}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-pill border border-primary bg-primary-pale px-2.5 text-sm font-medium text-primary-on disabled:opacity-40"
              >
                {draftBusy
                  ? "쓰는 중…"
                  : draftGenerated
                    ? "✨ 초안 다시 받기"
                    : "✨ 초안 받기"}
              </button>
            }
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 캔버스가든"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>
          <Field label="한 줄 소개" hint={hintFor("oneLiner")}>
            <input
              value={oneLiner}
              onChange={(e) => setOneLiner(e.target.value)}
              placeholder="예: 패브릭으로 짓는 친환경 가방과 조각 워크숍"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>

          {/* 자세히 소개 — 브랜드를 소개해주세요 (초안 받기 버튼은 ① 상호 옆으로 이사) */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-base font-medium text-body">
              <span>자세히 소개</span>
              {aiFilled.has("description") && <AiBadge />}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="버려지는 천에 새 이야기를 입히는 패브릭 브랜드."
              className="w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            <p className="mt-1.5 text-sm text-mute">
              {draftGenerated
                ? "‘초안 다시 받기’를 누르면 다른 느낌의 소개로 새로 써드려요."
                : "‘초안 받기’를 누르면 입력한 정보로 소개를 대신 써드려요. 그대로 써도, 더 다듬어도 좋아요."}
            </p>
          </div>

          {/* 브랜드 사진 (선택) */}
          <div>
            <label className="mb-1 block text-base font-medium text-body">
              브랜드 사진 (선택)
            </label>
            <p className="mb-2.5 text-[15px] text-mute">
              콜라보 카드에 담을 사진을 올려주세요. 최대 10장
            </p>
            <PhotoGrid
              items={photos}
              max={10}
              onAdd={onPhotos}
              onRemove={(i) => setPhotos((ps) => ps.filter((_, j) => j !== i))}
              onReorder={(from, to) => setPhotos((ps) => reorder(ps, from, to))}
            />
          </div>

          {/* 소개자료 PDF 첨부 (선택) — 구⑨에서 ① 브랜드 사진 아래로 이사 */}
          <div>
            <label className="mb-2 block text-base font-medium text-body">
              이미 소개서가 있나요? (선택)
            </label>
            <div className="flex items-center gap-3">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink">
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
                  <span className="text-sm text-body">소개 자료 담김</span>
                  <button
                    type="button"
                    onClick={() => setIntroFileUrl("")}
                    className="text-sm text-faint hover:text-ink"
                  >
                    지우기
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 협업 유형 칩 — 구⑤에서 ①로 이사(필수 유지, 검색·매칭 하드축). 라벨은 구⑤ 제목 승계 */}
          <div id="offers-chips" className="scroll-mt-4">
            <Field label="어떤 협업을 할 수 있나요? *">
              <ChipRow
                options={COLLAB_TYPES}
                selected={offers}
                onToggle={(t) => toggle(offers, setOffers, t)}
              />
              {/* 구 sec-offersNote(시트) → ① 칩 하단 상시 노출로 이사. 칩과 한 세트 */}
              <div className="mt-4">
                <p className="mb-1.5 text-sm text-mute">콜라보를 조금 더 소개해주세요.</p>
                <textarea
                  value={offersNote}
                  onChange={(e) => setOffersNote(e.target.value)}
                  rows={3}
                  placeholder="예: 친환경 가방을 만들어요. 브랜드 제품 콜라보, 굿즈 제작을 기대하고 있어요."
                  className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
                />
              </div>
            </Field>
          </div>

        </div>

        {/* ── 시트 출신 — 우리 브랜드를 표현하는 키워드 (구③ · 정본 위치 = ① 뒤) ── */}
        <StubSection
          id="sec-keywords"
          label="우리 브랜드를 표현하는 키워드를 골라주세요."
          hiddenWhenCollapsed
          expanded={openSections.has("keywords")}
          hasData={hasKeywords}
          onExpand={() => openSection("keywords")}
          onCollapse={() => closeSection("keywords")}
        >
        <div className="space-y-8">
          {/* 분위기칩 — 우리를 표현하는 말 */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-base font-medium text-body">
              <span>브랜드와 어울리는 단어를 선택해주세요.</span>
              {aiFilled.has("values") && <AiBadge />}
              <span className="ml-auto text-xs font-normal text-mute">
                {values.length} / {MAX_VIBES}
              </span>
            </label>
            <p className="mb-4 text-[15px] text-mute">
              직접 추가도 가능해요. 최대 10개
            </p>
            <div className="space-y-4">
              {VIBE_CATEGORIES.map((cat, i) => (
                <div
                  key={cat.label}
                  className={i > 0 ? "border-t border-hairline pt-4" : ""}
                >
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-body">
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
                          className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
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
            {/* 직접 추가한 칩 (추천 목록에 없는 것) */}
            {values.some((v) => !ALL_VIBES.includes(v)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {values
                  .filter((v) => !ALL_VIBES.includes(v))
                  .map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleVibe(v)}
                      className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-sm text-primary-on"
                    >
                      {v} ✕
                    </button>
                  ))}
              </div>
            )}
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
                className="h-10 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus disabled:opacity-40"
              />
              <button
                type="button"
                onClick={addCustomVibe}
                disabled={values.length >= MAX_VIBES}
                className="h-10 shrink-0 whitespace-nowrap rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink disabled:opacity-40"
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
          label="왜 이 브랜드를 시작하셨나요?"
          hiddenWhenCollapsed
          expanded={openSections.has("story")}
          hasData={hasStory}
          onExpand={() => openSection("story")}
          onCollapse={() => closeSection("story")}
        >
          <p className="mb-4 -mt-4 text-sm text-mute">시작하게 된 계기를 편하게 적어주세요.</p>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            placeholder="예: 좋은 소재가 버려지는 게 늘 아쉬웠어요. 이미 있는 것의 가치를 다시 발견하는 일이 더 의미 있다고 믿어요."
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </StubSection>

        {/* ── 스텁 B — 주로 어떤 활동을 하나요 (구④) ── */}
        <StubSection
          id="sec-activities"
          label="주로 어떤 활동을 하나요?"
          hiddenWhenCollapsed
          expanded={openSections.has("activities")}
          hasData={hasActivities}
          onExpand={() => openSection("activities")}
          onCollapse={() => closeSection("activities")}
        >
          <p className="mb-4 -mt-4 text-sm text-mute">대표 활동을 최대 3가지 소개해주세요. 사진도 담을 수 있어요.</p>
          {/* 리빌에서 건너뛴(미사용) 힌트 — 섹션 안 소형 인라인 힌트로 영속(구 HintBanner 은퇴) */}
          {actHints.some((_, i) => !usedActHints.has(i)) && (
            <div className="mb-6 space-y-2">
              {actHints.map((h, i) =>
                usedActHints.has(i) ? null : (
                  <div key={i} className="rounded-md bg-primary-pale/60 px-3 py-2.5">
                    <p className="text-sm text-mute">
                      웹에서 찾은 내용이에요 — <span className="font-medium text-ink">{h.title}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => applyActHint(i)}
                      disabled={!canApplyActHint}
                      className="mt-1 text-[13px] font-medium text-primary-on underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
                    >
                      이 내용으로 시작하기
                    </button>
                  </div>
                )
              )}
            </div>
          )}
          <div className="space-y-4">
          {activities.map((act, i) => (
            <div
              key={i}
              className="space-y-3 rounded-md border border-hairline bg-surface p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-body">활동 {i + 1}</span>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => removeActivity(i)}
                    className="text-sm text-faint hover:text-ink"
                  >
                    삭제
                  </button>
                )}
              </div>
              <input
                value={act.title}
                onChange={(e) => setAct(i, { title: e.target.value })}
                placeholder="예: 조형수선 워크숍"
                className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <textarea
                value={act.desc}
                onChange={(e) => setAct(i, { desc: e.target.value })}
                rows={3}
                placeholder="예: 이야기가 깃든 옷을 수선하고 업사이클링하는 워크숍을 진행해요."
                className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <PhotoGrid
                items={act.photos}
                max={3}
                onAdd={(files) => addActPhotos(i, files)}
                onRemove={(k) => removeActPhoto(i, k)}
                onReorder={(from, to) => moveActPhoto(i, from, to)}
              />
            </div>
          ))}
          {activities.length < 3 && (
            <button
              type="button"
              onClick={addActivity}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface py-2.5 text-sm text-mute"
            >
              ＋ 활동 추가
            </button>
          )}
          </div>
        </StubSection>

        {/* ── 시트 출신 — 이런 파트너를 찾고 있어요 (구⑥ 칩+서술) ── */}
        <StubSection
          id="sec-seeks"
          label="이런 파트너를 찾고 있어요."
          hiddenWhenCollapsed
          expanded={openSections.has("seeks")}
          hasData={hasSeeks}
          onExpand={() => openSection("seeks")}
          onCollapse={() => closeSection("seeks")}
        >
          <div className="space-y-8">
            <textarea
              value={seeksNote}
              onChange={(e) => setSeeksNote(e.target.value)}
              rows={3}
              placeholder="예: 지속가능성을 이야기하는 브랜드, 라이프스타일 브랜드, 카페와 함께하고 싶어요."
              className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            <Field label="이런 콜라보를 찾고 있어요">
              <ChipRow
                options={COLLAB_TYPES}
                selected={seeks}
                onToggle={(t) => toggle(seeks, setSeeks, t)}
              />
            </Field>
          </div>
        </StubSection>

        {/* ── 스텁 C — 이런 콜라보 경험이 있어요 (구⑦) ── */}
        <StubSection
          id="sec-collabs"
          label="이런 콜라보 경험이 있어요."
          hiddenWhenCollapsed
          expanded={openSections.has("collabs")}
          hasData={hasCollabs}
          onExpand={() => openSection("collabs")}
          onCollapse={() => closeSection("collabs")}
        >
          <p className="mb-4 -mt-4 text-sm text-mute">선택 · 최대 3개 · 지난 콜라보를 더하면 “검증된 파트너”라는 신호가 돼요.</p>
          <div>

            {/* 리빌에서 건너뛴(미사용) 힌트 — 섹션 안 소형 인라인 힌트로 영속(구 HintBanner 은퇴) */}
            {collabHints.some((_, i) => !usedCollabHints.has(i)) && (
              <div className="mb-3 space-y-2">
                {collabHints.map((h, i) =>
                  usedCollabHints.has(i) ? null : (
                    <div key={i} className="rounded-md bg-primary-pale/60 px-3 py-2.5">
                      <p className="text-sm text-mute">
                        웹에서 찾은 내용이에요 — <span className="font-medium text-ink">{h.partner}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => applyCollabHint(i)}
                        disabled={!canApplyCollabHint}
                        className="mt-1 text-[13px] font-medium text-primary-on underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
                      >
                        이 내용으로 시작하기
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="space-y-4">
              {collabHistory.map((h, i) => (
                <div
                  key={i}
                  className="space-y-5 rounded-md border border-hairline bg-surface p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-body">콜라보 {i + 1}</span>
                    {collabHistory.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCollab(i)}
                        className="text-sm text-faint hover:text-ink"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <input
                    value={h.partner}
                    onChange={(e) => setHist(i, { partner: e.target.value })}
                    placeholder="함께한 곳 (예: 오월의숲)"
                    className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                  />
                  <div>
                    <p className="mb-1.5 text-sm text-mute">어떤 타입의 콜라보였나요?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COLLAB_TYPES.map((t) => {
                        const on = h.types.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleHistType(i, t)}
                            className={`inline-flex h-7 items-center rounded-pill border px-2.5 text-sm transition-colors ${
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
                            className="inline-flex h-7 items-center rounded-pill border border-primary bg-primary-tint px-2.5 text-sm text-primary-on"
                          >
                            {t} ✕
                          </button>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={h.typeInput}
                        onChange={(e) => setHist(i, { typeInput: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            addHistCustomType(i);
                          }
                        }}
                        placeholder="유형 직접 더하기"
                        className="h-9 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
                      />
                      <button
                        type="button"
                        onClick={() => addHistCustomType(i)}
                        className="h-9 shrink-0 whitespace-nowrap rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm text-mute">사진 (선택 · 최대 3장)</p>
                    <PhotoGrid
                      items={h.photos}
                      max={3}
                      onAdd={(files) => addHistPhotos(i, files)}
                      onRemove={(k) => removeHistPhoto(i, k)}
                      onReorder={(from, to) => moveHistPhoto(i, from, to)}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm text-mute">콜라보 내용을 간단히 알려주세요.</p>
                    <textarea
                      value={h.desc}
                      onChange={(e) => setHist(i, { desc: e.target.value })}
                      rows={3}
                      placeholder="예: 업사이클링 파우치를 함께 만들어 팝업에서 선보였어요."
                      className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm text-mute">시기</p>
                    <select
                      value={h.year}
                      onChange={(e) => setHist(i, { year: e.target.value })}
                      className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-focus"
                    >
                      <option value="">시기 (선택)</option>
                      {HISTORY_YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {collabHistory.length < 3 && (
                <button
                  type="button"
                  onClick={addCollab}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface py-2.5 text-sm text-mute"
                >
                  ＋ 콜라보 경험 추가
                </button>
              )}
            </div>
          </div>
        </StubSection>

        {/* ── 선택 블록(코어 ⑦과 ⑧ 사이) ── */}
        <BlockEditor
          blocks={blocks}
          onChange={setBlocks}
          onUploadingChange={setBlocksUploading}
          storyItems={[
            { key: "activities", label: "주로 어떤 활동을 하나요?", hint: "대표 활동을 소개해주세요.", added: openSections.has("activities") || hasActivities, onAdd: () => addStorySection("activities"), group: "recommend" },
            { key: "seeks", label: "이런 파트너를 찾고 있어요.", hint: "파트너와 꿈꾸는 협업 유형을 알려주세요.", added: openSections.has("seeks") || hasSeeks, onAdd: () => addStorySection("seeks"), group: "recommend" },
            { key: "collabs", label: "이런 콜라보 경험이 있어요.", hint: "지난 콜라보를 더하면 검증된 파트너 신호가 돼요.", added: openSections.has("collabs") || hasCollabs, onAdd: () => addStorySection("collabs"), group: "recommend" },
            { key: "customers", label: "저희는 주로 이런 고객과 함께하고 있어요.", hint: "주요 고객을 알려주세요.", added: openSections.has("customers") || hasCustomers, onAdd: () => addStorySection("customers"), group: "recommend" },
            { key: "story", label: "왜 이 브랜드를 시작하셨나요?", hint: "시작하게 된 계기를 편하게 적어주세요.", added: openSections.has("story") || hasStory, onAdd: () => addStorySection("story"), group: "story" },
            { key: "keywords", label: "우리 브랜드를 표현하는 키워드를 골라주세요.", hint: "분위기를 칩으로 골라요.", added: openSections.has("keywords") || hasKeywords, onAdd: () => addStorySection("keywords"), group: "story" },
          ]}
        />

        {/* ── 시트 출신 — 저희는 주로 이런 고객과 함께하고 있어요 (구⑧) ── */}
        <StubSection
          id="sec-customers"
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
                    className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
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
                    className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-sm text-primary-on"
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
                className="h-10 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <button
                type="button"
                onClick={addCustomAudience}
                className="h-10 shrink-0 whitespace-nowrap rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
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
              onChange={(e) => setAddress(e.target.value)}
              placeholder="서울 성북구 보문로 56, 5층"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            {region && (
              <p className="mt-1 text-sm text-mute">
                지역 자동 인식: <span className="text-body">{region}</span>
              </p>
            )}
          </Field>
          <Field label="인스타그램 (선택)" hint={hintFor("instagram", "instagram")}>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@handle"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>
          <Field label="홈페이지 (선택)" hint={hintFor("homepage", "homepage")}>
            <input
              value={homepage}
              onChange={(e) => setHomepage(e.target.value)}
              placeholder="https://"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>
        </div>

        {/* 콜라보 열림/닫힘 */}
        <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3">
          <div>
            <p className="text-base font-medium text-ink">콜라보 받는 중</p>
            <p className="text-sm text-mute">
              켜두면 다른 메이커가 먼저 콜라보를 제안할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollabOpen((v) => !v)}
            role="switch"
            aria-checked={collabOpen}
            aria-label="콜라보 받는 중"
            className={`flex h-[26px] w-11 shrink-0 items-center rounded-pill p-[2px] transition-colors ${
              collabOpen ? "bg-primary" : "bg-border-strong"
            }`}
          >
            <span
              className={`h-[22px] w-[22px] rounded-pill bg-white transition-transform ${
                collabOpen ? "translate-x-[18px]" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={submit}
            disabled={
              !canSubmit ||
              blocksUploading ||
              pdfUploading ||
              [...photos, ...activities.flatMap((a) => a.photos), ...collabHistory.flatMap((h) => h.photos)].some(
                (p) => p.uploading
              )
            }
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-40"
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
                : "콜라보 카드 등록하기"}
          </button>
          {!editSlug && (
            <p className="text-center text-sm text-mute">
              등록 후에는 언제든 콜라보 카드를 공유할 수 있어요.
            </p>
          )}
        </div>
      </div>

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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => !draftBusy && setDescModalOpen(false)}
        >
          <ScrollLock />
          <div
            className="relative w-full max-w-md rounded-lg border border-hairline bg-surface p-5 shadow-e2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDescModalOpen(false)}
              aria-label="닫기"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-lg text-mute hover:bg-surface-soft hover:text-ink"
            >
              ✕
            </button>
            {draftBusy ? (
              /* 로딩 — 기존 초안받기 로딩 문구·스피너 그대로 */
              <div className="flex min-h-[180px] items-center justify-center">
                <p className="flex items-center gap-2 text-sm font-medium text-primary-on">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  온라인 정보를 살펴 소개를 쓰고 있어요…
                </p>
              </div>
            ) : draftStep === 1 ? (
              <>
                <p className="pr-8 text-base font-bold text-ink">
                  마음에 드는 한 줄 소개를 골라주세요{" "}
                  <span className="text-sm font-medium text-mute">1/2</span>
                </p>
                <p className="mt-1 text-sm text-mute">
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
                  onClick={() => setDraftStep(2)}
                  className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
                >
                  다음
                </button>
              </>
            ) : (
              <>
                <p className="pr-8 text-base font-bold text-ink">
                  마음에 드는 자세히 소개를 골라주세요{" "}
                  <span className="text-sm font-medium text-mute">2/2</span>
                </p>
                <p className="mt-1 text-sm text-mute">
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
                    className="h-11 shrink-0 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
                  >
                    ← 뒤로
                  </button>
                  <button
                    type="button"
                    onClick={applyDraft}
                    className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on"
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
      {showNudge && (() => {
        const dismissNudge = () => { setNudgeShown(true); setShowNudge(false); };
        const items = ([
          ["activities", "주로 어떤 활동을 하나요?", "대표 활동을 소개해주세요.", hasActivities],
          ["seeks", "이런 파트너를 찾고 있어요.", "파트너와 꿈꾸는 협업 유형을 알려주세요.", hasSeeks],
          ["collabs", "이런 콜라보 경험이 있어요.", "지난 콜라보를 더하면 검증된 파트너 신호가 돼요.", hasCollabs],
          ["customers", "저희는 주로 이런 고객과 함께하고 있어요.", "주요 고객을 알려주세요.", hasCustomers],
        ] as const).filter(([key, , , has]) => !has && !openSections.has(key));
        return (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
            <ScrollLock />
            <div className="absolute inset-0 bg-ink/40" onClick={dismissNudge} />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[640px] overflow-hidden rounded-t-2xl bg-surface shadow-xl">
              <div
                style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
                className="max-h-[60vh] overflow-y-auto slim-scrollbar p-4 sm:max-h-[70vh]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="pr-8">
                    <p className="text-[16px] font-bold text-ink">잠깐, 이런 소개를 더해보는 건 어때요?</p>
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
                    className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
                  >
                    다음에 하기
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNudgeShown(true); setShowNudge(false); doSubmit(); }}
                    className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on"
                  >
                    콜라보 카드 등록하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 등록 완료 → 브랜드 소개서 얼럿 (소개서 페이지에서 확인·링크 공유) */}
      {portfolioOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <ScrollLock />
          <div className="w-full max-w-md rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            <p className="text-lg font-bold text-ink">✨ 브랜드 소개서가 완성됐어요!</p>
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
                  <label className="mb-1.5 block text-sm font-medium text-body">
                    소개서 관리 비밀번호 <span className="text-red-500">*</span>{" "}
                    <span className="font-normal text-faint">(입력 규칙 없음)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showEditPw ? "text" : "password"}
                      value={editPw}
                      onChange={(e) => setEditPw(e.target.value)}
                      placeholder="비밀번호를 입력해주세요"
                      className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 pr-11 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPw((v) => !v)}
                      aria-label={showEditPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-faint hover:text-body"
                    >
                      {showEditPw ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
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
            <p className="mt-3 text-[13px] text-faint">언제든 ‘내 소개서’에서 수정할 수 있어요.</p>
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

function GroupHeader({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-[23px] border-b border-hairline pb-2">
      <div className="flex items-baseline gap-2">
        <span className="rounded-pill bg-primary-tint px-2 py-0.5 text-sm font-bold text-primary-on">
          {n}
        </span>
        <span className="text-[17px] font-bold text-ink">{title}</span>
      </div>
      {sub && <p className="mt-1.5 text-sm leading-relaxed text-mute">{sub}</p>}
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
        <label className="flex items-center gap-2 text-base font-medium text-body">
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
            className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
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
