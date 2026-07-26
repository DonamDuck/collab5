// 인스타 게시물의 사진 URL을 한 번에 긁어 클립보드로 복사하는 북마클릿 (소스).
//
// 설치: `npm run ig:setup` → 출력된 javascript: 한 줄을 크롬 북마크의 URL 칸에 붙여넣기
// 사용: 인스타 게시물에서 북마크 클릭 → 패널의 [복사하기] → 터미널에서 `npm run ig`
//
// ⚠️ 왜 자동 복사가 아니라 버튼을 한 번 누르게 하나 (2026-07-26 실패에서 배움):
//    브라우저는 clipboard.writeText를 "클릭 직후 몇 초"(transient user activation) 안에서만 허용한다.
//    캐러셀을 넘기며 0.7초씩 기다리면 그 시간이 만료돼 **조용히 실패**한다.
//    패널의 버튼 클릭이 새 activation을 주므로 이 방식은 항상 성공한다.
//    (textarea도 미리 선택해둬서 ⌘C로도 복사된다 — 이중 안전장치)
//
// ⚠️ 다운로드를 브라우저가 아니라 터미널에서 하는 이유: 인스타 CDN은 교차출처라
//    <a download>가 무시되고(새 탭 열림), 브라우저는 폴더를 매번 고르게 한다.
(async () => {
  const SEL_IMG = 'img[src*="cdninstagram"], img[srcset*="cdninstagram"]';
  const found = new Map();

  // ⚠️ 범위를 게시물로 좁힌다 — 인스타는 프로필에서 게시물을 누르면 **모달(레이어)로 뜨고
  //    뒤에 그리드 썸네일이 그대로 남아 있다**. document 전체를 훑으면 뒤쪽 남의 사진까지
  //    전부 끌려온다(2026-07-26 실제 사고). 게시물 페이지로 직접 들어온 경우엔 모달이 없으므로
  //    article로 폴백하고, 그것도 없으면 그때만 document.
  const scope = () =>
    document.querySelector('div[role="dialog"] article') ||
    document.querySelector('div[role="dialog"]') ||
    document.querySelector("article") ||
    document;

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
    for (const img of scope().querySelectorAll(SEL_IMG)) {
      if (img.naturalWidth && img.naturalWidth < 320) continue;
      const url = bestFrom(img);
      if (!url || !url.includes("cdninstagram")) continue;
      const key = url.split("?")[0];
      if (!found.has(key)) found.set(key, url);
    }
  };

  // '다음' 버튼도 게시물 범위 안에서만 — 뒤쪽 그리드의 버튼을 누르면 엉뚱한 게시물로 넘어간다
  const nextBtn = () => {
    const root = scope();
    return (
      root.querySelector('button[aria-label="다음"], button[aria-label="Next"]') ||
      [...root.querySelectorAll('[role="button"]')].find(
        (b) => /다음|Next/.test(b.getAttribute("aria-label") || "")
      )
    );
  };

  collect();
  for (let i = 0; i < 20; i++) {
    const btn = nextBtn();
    if (!btn) break;
    btn.click();
    await new Promise((r) => setTimeout(r, 700));
    collect();
  }

  const urls = [...found.values()];
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;inset:auto 16px 16px auto;z-index:2147483647;width:340px;padding:16px;" +
    "border-radius:14px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.28);" +
    "font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;color:#222";

  if (!urls.length) {
    box.innerHTML =
      '<b style="font-size:15px">사진을 못 찾았어요</b>' +
      '<p style="margin:8px 0 0;color:#666">게시물을 연 상태에서 눌러주세요. ' +
      "프로필 그리드만 보이는 화면에서는 원본이 안 잡혀요.</p>";
    const c = document.createElement("button");
    c.textContent = "닫기";
    c.style.cssText =
      "margin-top:12px;width:100%;height:38px;border:0;border-radius:9px;background:#eee;cursor:pointer;font-weight:600";
    c.onclick = () => box.remove();
    box.appendChild(c);
    document.body.appendChild(box);
    return;
  }

  const text = urls.join("\n");
  box.innerHTML =
    '<b style="font-size:15px">사진 ' + urls.length + "장 찾았어요</b>" +
    '<p style="margin:6px 0 8px;color:#666">받을 사진이 맞는지 확인하고 복사하세요</p>';

  // 썸네일 미리보기 — 범위를 잘못 잡아 남의 사진이 섞여도 **복사 전에 눈으로 걸러진다**.
  // 스코프 로직은 인스타 DOM이 바뀌면 깨질 수 있으니, 마지막 방어선은 사람 눈이어야 한다.
  const grid = document.createElement("div");
  grid.style.cssText =
    "display:flex;flex-wrap:wrap;gap:4px;max-height:132px;overflow-y:auto;margin-bottom:10px";
  for (const u of urls) {
    const im = document.createElement("img");
    im.src = u;
    im.style.cssText = "width:62px;height:62px;object-fit:cover;border-radius:6px;background:#f0f0f0";
    grid.appendChild(im);
  }
  box.appendChild(grid);

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.readOnly = true;
  ta.style.cssText =
    "width:100%;height:64px;font:11px/1.4 ui-monospace,monospace;color:#888;" +
    "border:1px solid #ddd;border-radius:8px;padding:6px;resize:none;box-sizing:border-box";
  box.appendChild(ta);

  const btn = document.createElement("button");
  btn.textContent = "복사하기";
  btn.style.cssText =
    "margin-top:10px;width:100%;height:42px;border:0;border-radius:9px;background:#1f5c00;" +
    "color:#fff;font-weight:700;font-size:15px;cursor:pointer";
  // 이 클릭이 새 user activation → 여기서의 클립보드 쓰기는 만료되지 않는다
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ta.select();               // 폴백 ①: 구식 execCommand
      document.execCommand("copy");
    }
    btn.textContent = "✓ 복사됐어요 — 터미널에서 npm run ig";
    btn.style.background = "#0b3d00";
    setTimeout(() => box.remove(), 1800);
  };
  box.appendChild(btn);

  const close = document.createElement("button");
  close.textContent = "닫기";
  close.style.cssText =
    "margin-top:6px;width:100%;height:32px;border:0;border-radius:9px;background:transparent;color:#888;cursor:pointer";
  close.onclick = () => box.remove();
  box.appendChild(close);

  document.body.appendChild(box);
  ta.select();                   // 폴백 ②: 패널이 뜨자마자 ⌘C로도 복사 가능
})();
