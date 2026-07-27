// /preview·홈 목업 슬라이드 재캡처 — 데모 소개서(prod)를 모바일 폭으로 찍어 public/preview/slides/ 갱신.
// 실행: npx tsx scripts/capture-preview-slides.ts            (전체)
//       npx tsx scripts/capture-preview-slides.ts photo      (한쪽만)
//
// 왜 스크립트인가: 슬라이드는 "실화면 스크린샷"이 원칙이라(과장·미화 없음) 데모를 다시 뜰 때마다
//   같은 프레이밍으로 다시 찍어야 한다. 손으로 찍으면 스크롤 위치·크롬 노출이 매번 달라진다.
//
// ⭐대표 지시(07-28): 목업엔 **소개서 본문만** 나온다 — 사이트 헤더·하단 액션바·링크복사/하트·
//   '수정' 버튼·푸터는 전부 숨긴다. 폰 프레임 안에 서비스 크롬이 겹쳐 보이면 목업이 지저분해진다.
//
// 구현: puppeteer 없이 **Chrome DevTools Protocol 직접 호출**(node 내장 fetch+WebSocket).
//   의존성 0 — 저장소 방침(라이브러리 최소)에 맞춘다.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const OUT_DIR = "public/preview/slides";
const BASE = process.env.CAPTURE_BASE ?? "https://collab5.co.kr";

// 모바일 기준 — 슬라이드 원본이 375x812(iPhone 계열)이고 2배 해상도로 찍어 선명하게.
const WIDTH = 375;
const HEIGHT = 812;
const SCALE = 2;

/** 목업에서 걷어낼 서비스 크롬. 선택자가 바뀌면 여기만 고친다. */
const HIDE_CSS = `
  header, footer { display: none !important; }
  .fixed.inset-x-0.bottom-0 { display: none !important; }  /* 하단 콜라보 액션바 */
  [data-capture-hide] { display: none !important; }
  main { padding-top: 0 !important; }
`;
/** 텍스트로만 잡히는 버튼들 — 클래스가 유동적이라 런타임에 표시해 둔다. */
const MARK_JS = `
  (() => {
    const hide = (el) => el && el.setAttribute('data-capture-hide', '');
    document.querySelectorAll('button').forEach((b) => {
      const t = (b.textContent || '').trim();
      const a = b.getAttribute('aria-label') || '';
      if (t === '수정' || /링크 복사/.test(t) || /찜|하트|저장/.test(a)) hide(b.closest('div[class*="flex"]')?.children.length === 2 ? b : b);
    });
    // 링크복사+하트는 같은 줄에 있다 — 줄째로 지워야 빈 공간이 안 남는다
    const copy = [...document.querySelectorAll('button')].find((b) => /링크 복사/.test(b.textContent || ''));
    if (copy) hide(copy.parentElement);
    return document.querySelectorAll('[data-capture-hide]').length;
  })()
`;

type Shot = { file: string; anchor: string | null; offset?: number };
const PLANS: Record<string, { slug: string; shots: Shot[] }> = {
  photo: {
    slug: "m-demo-photo",
    shots: [
      { file: "photo-1.jpg", anchor: null }, // 상단: 브랜드 카드 + 대표 사진
      { file: "photo-2.jpg", anchor: "우리는 이런 일을 하고 있어요" },
      { file: "photo-3.jpg", anchor: "함께한 콜라보" },
      { file: "photo-4.jpg", anchor: "이런 곳에 소개됐어요" },
    ],
  },
  none: {
    slug: "m-demo-none",
    shots: [
      { file: "none-1.jpg", anchor: null },
      { file: "none-2.jpg", anchor: "우리는 이런 일을 하고 있어요" },
      { file: "none-3.jpg", anchor: "이런 콜라보를 기대하고 있어요" },
    ],
  },
};

// ── CDP 최소 클라이언트 ──────────────────────────────────────
let nextId = 1;
function connect(wsUrl: string) {
  const ws = new WebSocket(wsUrl);
  const waiters = new Map<number, (v: Record<string, unknown>) => void>();
  const ready = new Promise<void>((res) => (ws.onopen = () => res()));
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data));
    const w = waiters.get(msg.id);
    if (w) { waiters.delete(msg.id); w(msg.result ?? {}); }
  };
  const send = async (method: string, params: Record<string, unknown> = {}) => {
    await ready;
    const id = nextId++;
    const p = new Promise<Record<string, unknown>>((res) => waiters.set(id, res));
    ws.send(JSON.stringify({ id, method, params }));
    return p;
  };
  return { send, close: () => ws.close() };
}

async function main() {
  const only = process.argv[2];
  mkdirSync(OUT_DIR, { recursive: true });

  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--user-data-dir=/tmp/collab5-capture",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    // 디버깅 포트가 열릴 때까지 대기
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      try {
        const list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
        target = list.find((t) => t.type === "page");
      } catch { /* 아직 안 뜸 */ }
    }
    if (!target) throw new Error("Chrome 디버깅 포트가 안 열렸어요(9333). 다른 Chrome 인스턴스가 점유 중일 수 있어요.");

    const cdp = connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: true,
    });

    for (const [key, plan] of Object.entries(PLANS)) {
      if (only && only !== key) continue;
      const url = `${BASE}/m/${plan.slug}`;
      console.log(`\n▶ ${url}`);
      await cdp.send("Page.navigate", { url });
      await sleep(3500); // 폰트·이미지 로드 여유

      await cdp.send("Runtime.evaluate", {
        expression: `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(HIDE_CSS)}; document.head.appendChild(s); })()`,
      });
      const marked = await cdp.send("Runtime.evaluate", { expression: MARK_JS, returnByValue: true });
      console.log(`   크롬 숨김 ${(marked.result as { value?: number })?.value ?? 0}개 + header/footer/액션바`);

      for (const shot of plan.shots) {
        const scrollJs = shot.anchor
          ? `(() => { const h = [...document.querySelectorAll('h2')].find(e => e.textContent.trim() === ${JSON.stringify(shot.anchor)}); if (!h) return -1; const y = h.getBoundingClientRect().top + scrollY - 24; scrollTo(0, y); return Math.round(y); })()`
          : `(() => { scrollTo(0, 0); return 0; })()`;
        const r = await cdp.send("Runtime.evaluate", { expression: scrollJs, returnByValue: true });
        const y = (r.result as { value?: number })?.value ?? -1;
        if (y < 0) { console.log(`   ⚠️ ${shot.file} — 앵커 '${shot.anchor}' 못 찾음, 건너뜀`); continue; }
        await sleep(700); // 스크롤 후 lazy 이미지 로드
        const cap = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 88 });
        writeFileSync(`${OUT_DIR}/${shot.file}`, Buffer.from(String((cap as { data: string }).data), "base64"));
        console.log(`   📸 ${shot.file}  (y=${y})`);
      }
    }
    cdp.close();
    console.log(`\n🎉 완료 — ${OUT_DIR}/ 확인 후 홈·/preview 에서 눈으로 보세요.`);
  } finally {
    chrome.kill();
  }
}

main().catch((e) => {
  console.error(`\n❌ 실패: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
