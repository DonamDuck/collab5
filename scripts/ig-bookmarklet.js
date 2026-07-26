// 인스타 게시물의 사진 URL을 한 번에 긁어 클립보드로 복사하는 북마클릿 (소스).
//
// 설치: `npx tsx scripts/ig-save.ts --bookmarklet` 실행 → 출력된 javascript: 한 줄을
//       크롬 북마크의 URL 칸에 붙여넣기(이름은 "인스타 사진 긁기" 등 아무거나).
// 사용: 인스타 게시물 페이지에서 북마크 클릭 → 캐러셀을 자동으로 넘기며 전부 수집 → 클립보드 복사
//       → 터미널에서 `npx tsx scripts/ig-save.ts "두더지요가원" "토우 워크숍"`
//
// ⚠️ 왜 브라우저에서 URL만 긁고 다운로드는 터미널에서 하나:
//    ① 인스타 CDN은 교차출처라 <a download>가 무시된다(저장이 아니라 새 탭 열림).
//    ② 브라우저 다운로드는 폴더를 매번 고르거나 기본 폴더로만 떨어진다 — 대표가 원한 건
//       "업체 폴더에 이름 붙여서" 저장이라, 그건 파일시스템을 만질 수 있는 터미널 쪽이 맞다.
(async () => {
  const SEL_IMG = 'img[src*="cdninstagram"], img[srcset*="cdninstagram"]';
  const found = new Map(); // url(파라미터 제거 키) → 최대해상도 원본 url

  /** srcset에서 가장 큰 후보를 고른다(없으면 src) */
  const bestFrom = (img) => {
    const set = (img.getAttribute("srcset") || "").trim();
    if (!set) return img.src;
    let best = img.src, bestW = 0;
    for (const part of set.split(",")) {
      const [u, w] = part.trim().split(/\s+/);
      const width = parseInt(w || "0", 10);
      if (u && width >= bestW) { best = u; bestW = width; }
    }
    return best;
  };

  const collect = () => {
    for (const img of document.querySelectorAll(SEL_IMG)) {
      // 프로필 사진·아바타 제외(작은 정사각형)
      if (img.naturalWidth && img.naturalWidth < 320) continue;
      const url = bestFrom(img);
      if (!url || !url.includes("cdninstagram")) continue;
      // 같은 사진의 다른 리사이즈본이 중복되지 않게 경로만으로 키를 잡는다
      const key = url.split("?")[0];
      if (!found.has(key)) found.set(key, url);
    }
  };

  const nextBtn = () =>
    document.querySelector('button[aria-label="다음"], button[aria-label="Next"]') ||
    [...document.querySelectorAll('[role="button"]')].find(
      (b) => /다음|Next/.test(b.getAttribute("aria-label") || "")
    );

  // 캐러셀 자동 순회 — 다음 버튼이 사라질 때까지(최대 20장) 넘기며 수집
  collect();
  for (let i = 0; i < 20; i++) {
    const btn = nextBtn();
    if (!btn) break;
    btn.click();
    await new Promise((r) => setTimeout(r, 700)); // 로드 대기
    collect();
  }

  const urls = [...found.values()];
  const toast = (msg, ok) => {
    const d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText =
      "position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:2147483647;" +
      "padding:12px 18px;border-radius:999px;font:600 14px/1.4 -apple-system,sans-serif;" +
      "box-shadow:0 6px 24px rgba(0,0,0,.2);color:#fff;background:" + (ok ? "#1f5c00" : "#b00020");
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3500);
  };

  if (!urls.length) return toast("사진을 못 찾았어요 — 게시물 페이지에서 눌러주세요", false);
  try {
    await navigator.clipboard.writeText(urls.join("\n"));
    toast(`사진 ${urls.length}장 복사됨 — 터미널에서 ig-save 실행`, true);
  } catch {
    // 클립보드 권한이 막힌 경우: 콘솔에 뿌려서 수동 복사
    console.log(urls.join("\n"));
    toast(`사진 ${urls.length}장 — 콘솔에 출력했어요(복사해서 쓰세요)`, false);
  }
})();
