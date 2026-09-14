"use client";

// 🗒 화면 위에서 바로 남기는 코멘트 위젯 (2026-09-14)
//
// 대표 09-14: *「스샷 찍고 번호로 설명하지 말고 보면서 바로바로 코멘트 남기고 싶다」*.
// [코멘트] → 고치고 싶은 걸 클릭 → 한 줄. 어느 화면·어느 요소·화면 폭까지 같이 저장돼서
// 내가 «무엇을 말하는지 되묻지 않고» 바로 찾아간다.
//
// 🚨**개발 빌드에서만 붙는다**(layout.tsx의 게이트). `NODE_ENV`는 빌드 때 상수로 박혀 운영 번들에서 통째로 빠진다.
//
// 🎨스타일을 Tailwind가 아니라 **인라인**으로 쓴 이유 — 이 위젯은 «화면이 깨졌을 때» 쓰는 물건이다.
//   토큰이나 클래스가 잘못된 상황에서도 자기는 멀쩡히 떠야 해서 페이지 CSS에 기대지 않는다.
import { useCallback, useEffect, useRef, useState } from "react";

/** 🚨**4초 · 스물세 자. 둘 다 길어 보이지만 줄이면 안 된다.**
 *  이 문장을 읽어야 하는 사람은 «방금 화면에 무언가를 타이핑하던 대표»이고, 읽기 전에 사라지면
 *  **자기 타이핑이 왜 날아갔는지 영영 모른다.** 짧은 토스트는 놓쳐도 되지만 이건 아니다.
 *  📌인라인 숫자로 두면 나중에 누가 2000으로 바꾸면서 «결정을 내렸다는 자각조차 없이» 뒤집는다.
 *    이름을 붙이는 건 그래서다 — 선언 자리는 「왜 이 값인가」를 찾으러 오는 자리라 주석이 붙는다(2팀 09-14). */
const GO_TOAST = "보냈어요 · 이제 고칩니다. 화면이 저절로 새로고침돼요";
const GO_TOAST_MS = 4000;

/** 서버 재시작 감지 주기. 개발 빌드 전용이라 비용이 없고, 5초면 대표가 다음 코멘트를 쓰기 전에 갈린다. */
const BOOT_POLL_MS = 5000;

type Mode = "off" | "picking" | "writing";
type Target = { selector: string; text: string; rect: DOMRect | null; box: string; font: string; color: string };

/** 요소를 다시 찾아갈 수 있을 만큼의 경로. id를 만나면 거기서 끊는다(그 위는 볼 필요가 없다). */
function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node !== document.body && parts.length < 6) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`${part}#${node.id}`);
      break;
    }
    // ⚠️Tailwind 클래스를 다 붙이면 한 줄이 수백 자가 된다. 두 개까지만 — 사람이 알아볼 힌트면 충분하다.
    const cls = Array.from(node.classList).filter((c) => !c.startsWith("__")).slice(0, 2);
    if (cls.length) part += "." + cls.join(".");
    const parent: Element | null = node.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(" > ");
}

/** 눈에 보이는 배경색. 누른 요소 자신은 대개 투명이라 그 값을 적으면 늘 `rgba(0,0,0,0)`이 되고,
 *  「안 보여」를 판정하는 데 아무 쓸모가 없다. 투명이 아닌 첫 조상까지 올라가야 «대비»를 잴 수 있다. */
function effectiveBg(el: Element): string {
  let node: Element | null = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg)) return bg;
    node = node.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
}

export function DevComments() {
  const [mode, setMode] = useState<Mode>("off");
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [note, setNote] = useState("");
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  /** 이 탭이 처음 만난 서버의 부팅 시각. 이게 달라지면 서버가 재시작된 것 = 내 코드가 낡았다는 뜻. */
  const bootRef = useRef<string | null>(null);
  const [stale, setStale] = useState(false);

  const refreshCount = useCallback(() => {
    fetch("/api/dev-comment")
      .then((r) => r.json())
      .then((d) => {
        setCount(d.count ?? 0);
        if (!d.boot) return;
        if (bootRef.current === null) bootRef.current = d.boot;
        else if (bootRef.current !== d.boot) setStale(true);
      })
      .catch(() => {}); // 재시작 중엔 잠깐 안 닿는다 — 다음 차례에 잡힌다
  }, []);
  useEffect(refreshCount, [refreshCount]);

  // 🔁**서버 재시작 감시** (대표 09-14: *"로컬에서 작업하면 자동으로 새로고침 해줄 수 있어?"*).
  //   파일 수정은 Next가 알아서 바꿔치지만 **서버 재시작은 열린 탭이 못 알아챈다** — 그 탭은 옛 코드를
  //   든 채로 남고, 그 상태로 남긴 코멘트는 새 칸이 비어서 온다(09-14 1호 코멘트가 그랬다).
  //   ⚠️개발 빌드에서만 도는 5초 폴링이라 비용은 없다.
  useEffect(() => {
    const t = setInterval(refreshCount, BOOT_POLL_MS);
    return () => clearInterval(t);
  }, [refreshCount]);

  // 🚨**쓰던 글이 있으면 안 고친다.** 자동 새로고침이 대표가 타이핑하던 코멘트를 날리면
  //   이 위젯은 도우려다 손해를 끼치는 물건이 된다. 손이 비었을 때만 조용히 갈아끼운다.
  useEffect(() => {
    if (!stale) return;
    if (mode === "off" && !note.trim()) location.reload();
  }, [stale, mode, note]);

  /** 내 UI 안을 고르려다 실수하는 걸 막는다 — 위젯이 자기를 가리키면 아무 쓸모가 없다. */
  const isMine = useCallback((el: Element | null) => !!el && !!rootRef.current?.contains(el), []);

  useEffect(() => {
    if (mode !== "picking") return;
    const move = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      setHover(el && !isMine(el) ? el.getBoundingClientRect() : null);
    };
    const click = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || isMine(el)) return;
      // 🚨capture 단계에서 먹는다 — 안 그러면 링크를 고르는 순간 페이지가 넘어가 버린다.
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // 📐**잰 값을 같이 담는다** (디자인팀 제안 09-14). 「이 버튼 작아」가 숫자로 오면 그 화면을 다시
      //   만들어 보지 않고도 바로 고칠 수 있다. 크기는 터치 타깃 44px, 글자는 16px 하한을 재는 데 쓴다.
      setTarget({
        selector: cssPath(el),
        text: (el.textContent ?? "").trim().slice(0, 120),
        rect: r,
        box: `${Math.round(r.width)}x${Math.round(r.height)} @ ${Math.round(r.left)},${Math.round(r.top)}`,
        font: `${cs.fontSize} ${cs.fontWeight}`,
        // 🎨「안 보여」는 대비 문제다(디자인팀 09-14). 글자색과 «실제로 깔린» 배경색을 짝으로 담는다 —
        //   다크 모드나 hover 상태였다면 나중에 경로만으로는 절대 되살릴 수 없는 값이다.
        color: `${cs.color} on ${effectiveBg(el)}`,
      });
      setMode("writing");
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMode("off");
    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", esc, true);
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", esc, true);
      document.body.style.cursor = "";
      setHover(null);
    };
  }, [mode, isMine]);

  const save = async () => {
    if (!note.trim()) return;
    await fetch("/api/dev-comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: location.pathname + location.search,
        note,
        selector: target?.selector ?? "(화면 전체)",
        text: target?.text ?? "",
        box: target?.box ?? "",
        font: target?.font ?? "",
        color: target?.color ?? "",
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      }),
    }).catch(() => {});
    setNote("");
    setTarget(null);
    setMode("off");
    setToast("남겼어요");
    refreshCount();
    setTimeout(() => setToast(""), 1600);
  };

  /** 「다 남겼어요」 — 깃발을 세우면 담당 세션이 그걸 보고 바로 작업에 들어간다. */
  const go = async () => {
    await fetch("/api/dev-comment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "go", url: location.pathname + location.search }),
    }).catch(() => {});
    // 길이·유지시간을 손대기 전에 `GO_TOAST` 선언부의 주석을 읽을 것.
    setToast(GO_TOAST);
    setTimeout(() => setToast(""), GO_TOAST_MS);
  };

  const btn = (bg: string, fg: string): React.CSSProperties => ({
    height: 36, padding: "0 14px", borderRadius: 10, border: "none",
    background: bg, color: fg, fontSize: 13, fontWeight: 600, cursor: "pointer",
  });

  return (
    <div ref={rootRef} style={{ position: "fixed", zIndex: 2147483000, fontFamily: "Pretendard, sans-serif" }}>
      {/* 고르는 중 하이라이트 — pointer-events:none 이라야 그 아래 요소를 계속 집을 수 있다 */}
      {mode === "picking" && hover && (
        <div style={{
          position: "fixed", left: hover.left, top: hover.top, width: hover.width, height: hover.height,
          border: "2px solid #98ff5c", background: "rgba(152,255,92,.18)", borderRadius: 6,
          pointerEvents: "none", transition: "all .06s",
        }} />
      )}
      {mode === "writing" && target?.rect && (
        <div style={{
          position: "fixed", left: target.rect.left, top: target.rect.top, width: target.rect.width, height: target.rect.height,
          border: "2px solid #98ff5c", borderRadius: 6, pointerEvents: "none",
        }} />
      )}

      {/* 바닥 패널 — 왼쪽 아래는 Next 개발 표시가 쓰고 있어 오른쪽에 붙인다 */}
      <div style={{ position: "fixed", right: 16, bottom: 16, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {stale && (
          <button
            style={{ ...btn("#f2d81e", "#5c4a00"), boxShadow: "0 2px 10px rgba(0,0,0,.16)" }}
            onClick={() => location.reload()}
          >
            새 버전이 있어요 · 새로고침
          </button>
        )}
        {toast && (
          <div style={{ background: "#222", color: "#fff", fontSize: 13, padding: "8px 12px", borderRadius: 10 }}>{toast}</div>
        )}

        {mode === "writing" && (
          <div style={{
            width: 320, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.18)",
            padding: 14, display: "flex", flexDirection: "column", gap: 10,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#6b6b6b", wordBreak: "break-all" }}>
              {target?.text ? `「${target.text.slice(0, 40)}」` : target?.selector.split(" > ").pop()}
              {target?.box && <span style={{ color: "#9a9a9a" }}> · {target.box} · {target.font}</span>}
            </p>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
              placeholder="뭐가 아쉬운지 한 줄로 적어주세요"
              style={{ width: "100%", minHeight: 76, resize: "vertical", fontSize: 14, lineHeight: 1.5,
                padding: 10, borderRadius: 10, border: "1px solid #d7d7db", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btn("#f5f5f6", "#4a4a4a")} onClick={() => { setMode("off"); setNote(""); setTarget(null); }}>그만</button>
              <button style={btn("#98ff5c", "#1f5c00")} onClick={save}>남기기</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {mode === "off" && count > 0 && (
            <button style={{ ...btn("#222", "#fff"), boxShadow: "0 2px 10px rgba(0,0,0,.16)" }} onClick={go}>
              {count}건 보내고 작업 시작
            </button>
          )}
          {mode === "off" && (
            <button style={{ ...btn("#fff", "#222"), boxShadow: "0 2px 10px rgba(0,0,0,.16)" }}
              onClick={() => { setTarget(null); setMode("writing"); }}>이 화면</button>
          )}
          <button
            style={{ ...btn(mode === "picking" ? "#222" : "#98ff5c", mode === "picking" ? "#fff" : "#1f5c00"),
              boxShadow: "0 2px 10px rgba(0,0,0,.16)" }}
            onClick={() => setMode(mode === "picking" ? "off" : "picking")}
          >
            {mode === "picking" ? "고를 곳 클릭 (ESC 취소)" : "코멘트"}
          </button>
        </div>
      </div>
    </div>
  );
}
