import { MOCK_IDS } from "@/lib/rent-mock-data";
import type { Group, Popup } from "./types";

// 🗺사이트 화면 지도 · 하루 가게 밖 묶음 (2026-09-18)
// ⭐케이스·주소는 코드의 실제 분기(`searchParams`·로그인·주인·편집자·빈 목록)를 읽고 골랐다.
//   화면을 새로 만들거나 상태를 늘리면 여기에도 줄을 더한다. 안 더하면 지도에서 조용히 빠진다.
// 소개서 주소는 `site-mock-data.ts`의 가상 브랜드다. 사람은 하루 가게와 같다(느린오후 9001 · 밀가루 일기 9002).

const M = {
  full: "mock-slow-afternoon", flour: MOCK_IDS.maker.guest, needle: "mock-needle-forest", text: "mock-low-desk",
  hidden: "mock-slow-afternoon-beans", claimable: "mock-green-watering-can", film: "mock-one-roll-film",
  stress: MOCK_IDS.maker.stress, minimal: "mock-minimal-brand",
};

export const SITE_GROUPS: Group[] = [
  {
    id: "home",
    title: "공통 · 홈",
    screens: [
      {
        title: "홈",
        path: "/",
        note: "새로 온 브랜드 칸은 만든 지 30일 안의 소개서만 모여요. 매거진 배너는 가장 최근 글 하나예요.",
        rows: [
          { desc: "브랜드 여럿, 매거진 배너, 새로 온 브랜드", c: "anon", to: "/" },
          { desc: "소개서 있는 회원으로 볼 때", c: "member-full", to: "/" },
          { desc: "소개서 없는 새 회원으로 볼 때", c: "member-new", to: "/" },
          { desc: "브랜드도 글도 하나 없을 때", c: "guest-empty", to: "/" },
          { desc: "긴 이름 브랜드와 긴 제목 글", c: "stress-host", to: "/" },
        ],
      },
      {
        title: "없는 주소",
        path: "not-found",
        rows: [{ desc: "없는 소개서 주소 (404 화면)", c: "anon", to: "/m/mock-no-such-brand" }],
      },
    ],
  },
  {
    id: "brandpage",
    title: "소개서",
    screens: [
      {
        title: "소개서",
        path: "/m/[slug]",
        note: "보는 사람이 주인이면 수정 버튼이, 다른 브랜드 회원이면 찜과 콜라보 제안이 떠요. 사진이 5장보다 적은 내 소개서엔 보강 배너가 붙어요.",
        rows: [
          { desc: "모든 칸이 찬 소개서를 로그인 안 하고", c: "anon", to: `/m/${M.full}` },
          { desc: "같은 소개서를 주인이 볼 때", c: "member-full", to: `/m/${M.full}` },
          { desc: "같은 소개서를 다른 브랜드 회원이 볼 때 (찜한 상태, 리포트 저장본 있음)", c: "guest-full", to: `/m/${M.full}` },
          { desc: "같은 소개서를 소개서 없는 새 회원이 볼 때", c: "member-new", to: `/m/${M.full}` },
          { desc: "리포트 시트를 열어 둔 채로 (저장본이라 바로 뜸)", c: "guest-full", to: `/m/${M.full}?report=${M.flour}` },
          { desc: "콜라보 제안 시트를 열어 둔 채로", c: "guest-full", to: `/m/${M.full}?propose=1` },
          { desc: "요청을 잠시 안 받는 소개서", c: "member-full", to: `/m/${M.needle}` },
          { desc: "사진 없이 글만 있는 소개서", c: "anon", to: `/m/${M.text}` },
          { desc: "사진이 적은 내 소개서 (보강 배너)", c: "guest-full", to: `/m/${M.flour}` },
          { desc: "보강 배너 시안 A · B 강제로 보기", c: "anon", to: `/m/${M.full}?banner=b` },
          { desc: "계정 없이 만들어 비밀번호로 연결할 수 있는 소개서", c: "member-full", to: `/m/${M.claimable}?connect=1` },
          { desc: "콜라보 찾기에서 숨긴 내 소개서", c: "member-full", to: `/m/${M.hidden}` },
          { desc: "하루 가게에서 넘어온 소개서 (돌아가기 버튼)", c: "guest-full", to: `/m/${M.full}?back=/rent/${MOCK_IDS.space.full}` },
          { desc: "촬영용 화면 (수정·하단 바 숨김)", c: "member-full", to: `/m/${M.full}?film=1` },
          { desc: "긴 글 (활동 5, 콜라보 12, 사진 10, 긴 링크)", c: "stress-host", to: `/m/${M.stress}` },
          { desc: "이름만 있는 소개서", c: "minimal-host", to: `/m/${M.minimal}` },
        ],
      },
      {
        title: "콜라보 카드 만들기",
        path: "/m/[slug]/card",
        rows: [
          { desc: "사진이 여럿인 소개서로", c: "member-full", to: `/m/${M.full}/card` },
          { desc: "사진 없는 소개서로", c: "member-full", to: `/m/${M.text}/card` },
        ],
      },
      {
        title: "받은 콜라보 카드",
        path: "/c/[slug]",
        note: "카드를 열면 조회 기록을 남기는 버튼이 원래 돌지만, 목 데이터에선 아무것도 적지 않아요.",
        rows: [
          { desc: "보통 카드", c: "anon", to: "/c/mock-slow-afternoon-card" },
          { desc: "긴 글 카드", c: "stress-guest", to: "/c/mock-long-kitchen-card" },
          { desc: "빈 칸만 있는 카드", c: "minimal-guest", to: "/c/mock-minimal-card" },
        ],
      },
      {
        title: "소개서 둘러보기",
        path: "/preview",
        rows: [
          { desc: "사진 있는 예시 탭", c: "anon", to: "/preview" },
          { desc: "글만 있는 예시 탭", c: "anon", to: "/preview?tab=none" },
          { desc: "예시가 없을 때", c: "guest-empty", to: "/preview" },
        ],
      },
      {
        title: "요약 리포트",
        path: "/brief/[slug]",
        note: "주인이 연결된 리포트는 주인만 열려요. 다른 사람이 열면 404예요.",
        rows: [
          { desc: "내 리포트를 주인이 볼 때", c: "member-full", to: `/brief/${M.full}` },
          { desc: "같은 리포트를 남이 열 때 (404)", c: "guest-full", to: `/brief/${M.full}` },
          { desc: "주인이 아직 없는 리포트 (링크 아는 사람 누구나)", c: "anon", to: `/brief/${M.flour}` },
          { desc: "긴 글", c: "stress-host", to: `/brief/${M.stress}` },
        ],
      },
    ],
  },
  {
    id: "search",
    title: "콜라보 찾기",
    screens: [
      {
        title: "콜라보 찾기",
        path: "/search",
        note: "순서는 날마다 한 번 섞여요. 콜라보 찾기에서 숨긴 소개서는 목록에 없어요.",
        rows: [
          { desc: "브랜드 여럿", c: "anon", to: "/search" },
          { desc: "유형으로 좁혀 들어왔을 때", c: "anon", to: "/search?type=팝업" },
          { desc: "홈의 아이디어 버튼으로 들어왔을 때 (안내 시트)", c: "member-full", to: "/search?guide=idea" },
          { desc: "브랜드가 한 곳도 없을 때", c: "guest-empty", to: "/search" },
          { desc: "긴 이름 카드", c: "stress-host", to: "/search" },
          { desc: "이름만 있는 카드", c: "minimal-host", to: "/search" },
        ],
      },
    ],
  },
  {
    id: "magazine",
    title: "매거진",
    screens: [
      {
        title: "매거진 목록",
        path: "/magazine",
        rows: [
          { desc: "발행한 글 둘 (커버 있는 글, 빈 칸 많은 글)", c: "anon", to: "/magazine" },
          { desc: "편집자가 볼 때 (초안까지, 새 글 버튼)", c: "editor", to: "/magazine" },
          { desc: "글이 하나도 없을 때", c: "guest-empty", to: "/magazine" },
          { desc: "긴 제목", c: "stress-host", to: "/magazine" },
        ],
      },
      {
        title: "글",
        path: "/magazine/[slug]",
        note: "댓글은 다섯 개씩 보이고 「댓글 더보기」로 늘어나요. 긴 글 케이스에 열세 개 있어요.",
        rows: [
          { desc: "본문 노드가 전부 있는 글, 로그인 안 하고", c: "anon", to: "/magazine/mock-bread-and-coffee" },
          { desc: "같은 글을 하트 누른 회원이 볼 때 (내 댓글 있음)", c: "member-full", to: "/magazine/mock-bread-and-coffee" },
          { desc: "같은 글을 편집자가 볼 때 (수정 줄)", c: "editor", to: "/magazine/mock-bread-and-coffee" },
          { desc: "커버·요약·정보 카드·브랜드 링크가 빈 글", c: "anon", to: "/magazine/mock-needle-apron" },
          { desc: "초안을 편집자가 열 때", c: "editor", to: "/magazine/mock-draft-pottery" },
          { desc: "초안을 편집자 아닌 사람이 열면 404", c: "member-full", to: "/magazine/mock-draft-pottery" },
          { desc: "긴 글 (세로 커버, 정보 9줄, 댓글 13개)", c: "stress-host", to: "/magazine/mock-long-market" },
          { desc: "제목만 있는 글", c: "minimal-host", to: "/magazine/mock-minimal-article" },
        ],
      },
      {
        title: "새 글 · 고치기",
        path: "/magazine/new · /magazine/[slug]/edit",
        note: "편집자가 아니면 둘 다 404예요. 저장·발행을 눌러도 저장하지 않아요.",
        rows: [
          { desc: "새 글 빈 폼", c: "editor", to: "/magazine/new" },
          { desc: "발행한 글 고치기", c: "editor", to: "/magazine/mock-bread-and-coffee/edit" },
          { desc: "초안 고치기", c: "editor", to: "/magazine/mock-draft-pottery/edit" },
          { desc: "긴 글 고치기", c: "stress-editor", to: "/magazine/mock-long-market/edit" },
          { desc: "편집자 아닌 회원이 새 글을 열면 404", c: "member-full", to: "/magazine/new" },
        ],
      },
    ],
  },
  {
    id: "auth",
    title: "가입 · 로그인",
    screens: [
      {
        title: "로그인 · 가입",
        path: "/login · /signup",
        note: "폼은 목 데이터와 상관없이 떠요. 로그인·가입 버튼은 목 데이터 보기 중엔 멈추고 안내 줄을 띄워요. 구글·카카오 버튼은 진짜 로그인 창으로 넘어가니 누르지 마세요.",
        rows: [
          { desc: "로그인", c: "anon", to: "/login" },
          { desc: "가입을 마치고 돌아온 로그인 (환영 줄)", c: "anon", to: "/login?welcome=1" },
          { desc: "로그인이 필요한 화면에서 넘어왔을 때", c: "anon", to: "/login?redirect=%2Fmy" },
          { desc: "가입", c: "anon", to: "/signup" },
        ],
      },
      {
        title: "소셜 가입 뒤 정보 채우기",
        path: "/welcome",
        note: "이 화면은 브라우저에 진짜 로그인이 있어야 폼이 열려요. 로그인 안 한 브라우저에선 바로 로그인 화면으로 가요. 로그인한 브라우저라면 폼 칸은 케이스의 사람으로 채워져요.",
        rows: [
          { desc: "브랜드명·번호가 빈 새 회원", c: "member-new", to: "/welcome" },
          { desc: "이미 다 채운 회원 (홈으로 넘어감)", c: "member-full", to: "/welcome" },
        ],
      },
      {
        title: "비밀번호 찾기",
        path: "/reset-password · /reset-password/update",
        note: "새 비밀번호 화면의 저장 버튼은 브라우저에 로그인된 진짜 계정의 비밀번호를 바꿔요. 화면만 보고 누르지 마세요.",
        rows: [
          { desc: "메일 받기 폼 (보내기는 막혀 있어요)", c: "anon", to: "/reset-password" },
          { desc: "새 비밀번호 폼", c: "anon", to: "/reset-password/update" },
        ],
      },
      {
        title: "소개서 만들기 · 고치기",
        path: "/register",
        note: "사진은 저장소에 안 올라가고 브라우저 안에서만 보여요. AI 초안 받기는 목 데이터 보기 중엔 멈춰요. 발행을 눌러도 저장하지 않아요. 임시 저장 복원은 칸을 몇 개 적고 새로고침하면 떠요.",
        rows: [
          { desc: "빈 폼, 로그인 안 하고", c: "anon", to: "/register" },
          { desc: "빈 폼, 소개서 없는 새 회원", c: "member-new", to: "/register" },
          { desc: "모든 칸이 찬 소개서 고치기 (주인)", c: "member-full", to: `/register?edit=${M.full}` },
          { desc: "남의 소개서를 고치러 들어왔을 때 (비밀번호 묻기)", c: "guest-full", to: `/register?edit=${M.full}` },
          { desc: "긴 글 소개서 고치기", c: "stress-host", to: `/register?edit=${M.stress}` },
          { desc: "이름만 있는 소개서 고치기", c: "minimal-host", to: `/register?edit=${M.minimal}` },
        ],
      },
    ],
  },
  {
    id: "my",
    title: "내 페이지",
    screens: [
      {
        title: "내 페이지",
        path: "/my",
        note: "리포트 탭의 「원두 구독 × 오후 세 시 도자기」 카드는 리포트 뒤에 소개서를 고친 경우라, 열면 시트에 다시 분석하기가 떠요. 연결된 계정·비밀번호 변경 칸은 브라우저의 진짜 로그인을 읽어요.",
        rows: [
          { desc: "큰 칸 「하루 가게」 — 새 요청이 있어 처음부터 이 칸이 열림 (숫자 세 칸·빌려준/빌린 공간 입구)", c: "host-full", to: "/my" },
          { desc: "큰 칸 「하루 가게」 — 공간 없이 빌리기만 한 회원 (내 공간 올리기 한 줄)", c: "guest-full", to: "/my?area=rent" },
          { desc: "큰 칸 「하루 가게」 — 아무것도 없는 새 회원", c: "member-new", to: "/my?area=rent" },
          { desc: "내 소개서 탭 (소개서 셋, 하나는 숨김)", c: "member-full", to: "/my?area=brand" },
          { desc: "찜한 브랜드 탭", c: "member-full", to: "/my?tab=saved" },
          { desc: "콜라보 리포트 탭", c: "member-full", to: "/my?tab=reports" },
          { desc: "성사 기록 탭", c: "member-full", to: "/my?tab=collabs" },
          { desc: "소개서 하나, 찜 하나, 리포트 하나인 회원", c: "guest-full", to: "/my" },
          { desc: "새 회원 (전부 빈 탭, 브랜드명 없음)", c: "member-new", to: "/my" },
          { desc: "빈 리포트 탭", c: "member-new", to: "/my?tab=reports" },
          { desc: "긴 글 회원", c: "stress-host", to: "/my" },
          { desc: "로그인 안 했을 때 (로그인으로 넘어감)", c: "anon", to: "/my" },
        ],
      },
    ],
  },
  {
    id: "legal",
    title: "약관 · 고객센터",
    screens: [
      {
        title: "정적 화면",
        path: "",
        rows: [
          { desc: "고객센터", c: "anon", to: "/help" },
          { desc: "이용약관", c: "anon", to: "/terms" },
          { desc: "호스트 약관", c: "anon", to: "/terms/host" },
          { desc: "개인정보처리방침", c: "anon", to: "/privacy" },
          { desc: "매거진 RSS (목 데이터 글)", c: "anon", to: "/rss.xml" },
          { desc: "사이트맵 (목 데이터 소개서)", c: "anon", to: "/sitemap.xml" },
        ],
      },
    ],
  },
];

export const SITE_POPUPS: Popup[] = [
  { where: { desc: "홈", c: "anon", to: "/" }, button: "「콜라보 아이디어 추천 받기」", title: "로그인이 필요해요" },
  { where: { desc: "홈", c: "member-new", to: "/" }, button: "「콜라보 아이디어 추천 받기」", title: "소개서를 먼저 만들어주세요" },
  { where: { desc: "소개서", c: "anon", to: `/m/${M.full}` }, button: "하단 바의 찜 하트", title: "찜하려면 로그인이 필요해요" },
  { where: { desc: "소개서", c: "guest-full", to: `/m/${M.full}` }, button: "하단 바의 「콜라보 미리 그려보기」", title: "저장해 둔 리포트 시트 (바로 뜸)" },
  { where: { desc: "소개서", c: "member-full", to: "/m/mock-wave-records" }, button: "하단 바의 「콜라보 미리 그려보기」", title: "리포트 시트의 실패 안내 (저장본이 없고 목 데이터에선 새로 안 만들어요)" },
  { where: { desc: "소개서", c: "guest-full", to: `/m/${M.full}` }, button: "하단 바의 「콜라보 제안 시작하기」", title: "제안 시트" },
  { where: { desc: "내 페이지", c: "member-full", to: "/my" }, button: "소개서 줄의 삭제 아이콘", title: "소개서를 삭제할까요?" },
  { where: { desc: "내 페이지", c: "member-full", to: "/my?tab=collabs" }, button: "「+ 기록 추가」", title: "성사 기록 폼" },
  { where: { desc: "가입", c: "anon", to: "/signup" }, button: "이메일 칸에 slow.afternoon@example.com을 적기", title: "이미 이 이메일로 가입한 계정이 있어요." },
  { where: { desc: "로그인", c: "anon", to: "/login" }, button: "아무 이메일·비밀번호로 로그인 버튼", title: "목 데이터 보기 중이라 저장하지 않았어요" },
  { where: { desc: "매거진 글", c: "member-full", to: "/magazine/mock-bread-and-coffee" }, button: "내 댓글의 「삭제」", title: "이 댓글을 지울까요?" },
];
