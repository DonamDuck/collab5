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
//
// ⚠️ 저장 포맷은 우리가 못 고른다 — 인스타 CDN이 **URL에 포맷을 박아서** 준다
//    (`stp=dst-jpg_e35` vs `dst-webp_e35`). 그래서 배치에 따라 .jpg가 오기도 .webp가 오기도 한다.
//    collab5 업로드엔 무해(폼이 image/*를 받고 `lib/image.ts`가 jpeg로 재인코딩). 인쇄 입고용이면 변환 필요.
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

  // 같은 사진의 "다른 크기"를 한 장으로 묶는 키.
  // 인스타는 크기를 경로(/s640x640/)나 stp 쿼리(p480x600)로 표현하고 **파일명은 같다** →
  // 크기 세그먼트를 지운 경로가 곧 사진 하나의 정체성이다.
  const keyOf = (u) => {
    try {
      const url = new URL(u);
      // ⚠️ 슬래시는 `\/`가 아니라 `[/]`로 쓴다 — `\//`가 만들어지면 위 한 줄 압축기의
      //    주석 제거(`//` 뒤를 버림)에 잘려나가 북마클릿이 통째로 깨진다(실제로 겪음).
      // 확장자도 벗긴다 — 같은 사진이 .jpg와 .webp로 동시에 잡히면 중복으로 두 번 받게 된다.
      // 파일명 앞부분에 미디어 고유 id가 있어서, 확장자를 빼도 다른 사진끼리 뭉칠 일은 없다.
      return (
        url.origin +
        url.pathname.replace(/[/][sp]\d+x\d+[_a-z0-9]*[/]/gi, "/").replace(/[.](jpe?g|png|webp|heic)$/i, "")
      );
    } catch {
      return u.split("?")[0];
    }
  };

  // URL이 스스로 밝히는 크기 꼬리표(p480x600·s640x640)를 찾는다.
  // ⚠️ `?` 뒤 서명 문자열엔 우연히 비슷한 패턴이 있을 수 있어 **경로 + stp 값에서만** 본다.
  const sizeTag = (u) => {
    const stp = (u.match(/[?&]stp=([^&]*)/) || [])[1] || "";
    return (u.split("?")[0] + " " + decodeURIComponent(stp)).match(/[sp](\d{3,4})x\d{3,4}/i);
  };
  const urlWidth = (u) => { const m = sizeTag(u); return m ? parseInt(m[1], 10) : 0; };
  // ⭐꼬리표가 **없으면 원본**이다 — 07-28 실측: 게시물 사진은 `stp=dst-jpg_e35_tt6`처럼
  //   크기 없이 오고 1440×1920이었다(꼬리표 붙은 건 전부 리사이즈본). 그래서 폭을 몰라도
  //   원본은 리사이즈본을 언제나 이겨야 한다 — 안 그러면 **아직 안 뜬 원본(naturalWidth 0)이
  //   480 썸네일한테 밀려 다운그레이드된다.**
  const isOrig = (u) => !sizeTag(u);

  // 가장 큰 후보. 폭 출처 우선순위 = srcset 디스크립터 > naturalWidth > URL 꼬리표.
  const bestFrom = (img) => {
    let best = img.src, bestW = img.naturalWidth || 0;
    for (const part of (img.getAttribute("srcset") || "").split(",")) {
      const [u, d] = part.trim().split(/\s+/);
      const w = parseInt(d || "0", 10);
      if (u && w > bestW) { best = u; bestW = w; }
    }
    return { url: best, w: bestW || urlWidth(best), orig: isOrig(best) };
  };

  // 원본 > 리사이즈본, 같은 급이면 큰 쪽
  const better = (a, b) => (a.orig !== b.orig ? a.orig : a.w > b.w);

  // ⭐먼저 본 걸 고수하지 않고 **더 큰 걸로 교체**한다 (2026-07-28 수정).
  //    캐러셀에서 아직 안 뜬 슬라이드는 저해상 placeholder만 들고 있다. 예전 코드는 그걸 그대로
  //    확정해버려서 **9장 중 7장이 480×600으로 저장됐다**(원본 1080×1350). 슬라이드가 실제로
  //    떠서 고해상 srcset이 붙으면 다음 훑기에서 갈아끼워야 한다.
  const collect = () => {
    for (const img of scope().querySelectorAll(SEL_IMG)) {
      if (img.naturalWidth && img.naturalWidth < 320) continue;
      const pick = bestFrom(img);
      if (!pick.url || !pick.url.includes("cdninstagram")) continue;
      const k = keyOf(pick.url);
      const prev = found.get(k);
      if (!prev || better(pick, prev)) found.set(k, pick);
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
    await new Promise((r) => setTimeout(r, 900));   // 700→900: 고해상 교체가 늦게 붙는 슬라이드가 있다
    collect();
  }
  // 마지막 정착 훑기 — 끝 슬라이드는 클릭 직후 한 번밖에 못 봐서 저해상으로 굳기 쉽다
  await new Promise((r) => setTimeout(r, 1200));
  collect();

  const picks = [...found.values()];
  const urls = picks.map((p) => p.url);
  // 원본(꼬리표 없음)은 폭을 몰라도 작다고 보지 않는다 — 리사이즈본만 1000px 기준으로 센다
  const small = picks.filter((p) => !p.orig && p.w && p.w < 1000).length;
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

  // ⚠️ 저해상도 경고 — 크기는 조용히 작아지는 종류의 사고라 **복사 전에 말해줘야 한다**.
  //    (07-28: 9장 중 7장이 480px로 저장된 걸 나중에 파일 열어보고서야 알았다)
  if (small) {
    const warn = document.createElement("p");
    warn.style.cssText =
      "margin:0 0 8px;padding:8px 10px;border-radius:8px;background:#fff4e5;color:#8a5300;font-size:13px";
    warn.textContent =
      small + "장이 원본보다 작아요. 캐러셀을 손으로 끝까지 한 번 넘긴 뒤 다시 눌러보세요.";
    box.appendChild(warn);
  }

  // 썸네일 미리보기 — 범위를 잘못 잡아 남의 사진이 섞여도 **복사 전에 눈으로 걸러진다**.
  // 스코프 로직은 인스타 DOM이 바뀌면 깨질 수 있으니, 마지막 방어선은 사람 눈이어야 한다.
  const grid = document.createElement("div");
  grid.style.cssText =
    "display:flex;flex-wrap:wrap;gap:4px;max-height:150px;overflow-y:auto;margin-bottom:10px";
  for (const p of picks) {
    const cell = document.createElement("div");
    cell.style.cssText = "position:relative;width:62px";
    const im = document.createElement("img");
    im.src = p.url;
    im.style.cssText = "width:62px;height:62px;object-fit:cover;border-radius:6px;background:#f0f0f0";
    const tag = document.createElement("div");   // 장별 크기 — 어느 장이 작은지 눈으로 짚인다
    tag.textContent = p.w ? p.w + "px" : p.orig ? "원본" : "?";
    tag.style.cssText =
      "text-align:center;font-size:10px;line-height:14px;color:" +
      (!p.orig && p.w && p.w < 1000 ? "#c26a00;font-weight:700" : "#999");
    cell.appendChild(im);
    cell.appendChild(tag);
    grid.appendChild(cell);
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
