"use client";

// 브랜드 소개서(포트폴리오) — 등록 데이터 총합을 예쁜 한 장으로. 다운로드(PNG/PDF) 대상.
// ⚠️ 인라인 hex 스타일 사용: Tailwind v4의 oklch 색을 html-to-image가 못 읽어서 캡처가 깨짐 → 직접 hex.
// 디자인팀 소개서 시안(master-brain 멘션) 도착 시 이 레이아웃을 교체.
import { forwardRef } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

export type PortfolioData = {
  name: string;
  oneLiner: string;
  region: string;
  address: string;
  offers: string[];
  seeks: string[];
  values: string[];
  instagram: string;
  homepage: string;
  description: string;
  photos: { url: string }[];
};

const C = {
  canvas: "#FBFAF6",
  ink: "#222222",
  body: "#444444",
  mute: "#6B6B6B",
  faint: "#9A9A9A",
  kiwiOn: "#1F5C00",
  kiwiPale: "#EAFBE0",
  mintPale: "#E5F6EC",
  mintOn: "#2E7D5B",
  hair: "#ECEAE3",
  chipGray: "#F1F0EB",
};

const chip = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 600,
  color,
  background: bg,
  padding: "4px 10px",
  borderRadius: 999,
});

export const PortfolioCard = forwardRef<HTMLDivElement, { data: PortfolioData }>(
  function PortfolioCard({ data }, ref) {
    const initial = data.name.trim().charAt(0) || "?";
    return (
      <div
        ref={ref}
        style={{
          width: 440,
          background: C.canvas,
          padding: 36,
          fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif",
          color: C.ink,
          boxSizing: "border-box",
        }}
      >
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: C.kiwiPale,
              color: C.kiwiOn,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
              {data.name || "내 브랜드"}
            </div>
            {data.oneLiner && (
              <div style={{ fontSize: 14, color: C.mute, marginTop: 4 }}>{data.oneLiner}</div>
            )}
            {data.region && (
              <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{data.region}</div>
            )}
          </div>
        </div>

        {/* 사진 */}
        {data.photos.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: data.photos.length === 1 ? "1fr" : "1fr 1fr",
              gap: 8,
              marginTop: 20,
            }}
          >
            {data.photos.slice(0, 4).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.url}
                alt=""
                style={{
                  width: "100%",
                  height: 110,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: `1px solid ${C.hair}`,
                }}
              />
            ))}
          </div>
        )}

        {/* 소개 */}
        {data.description && (
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: C.body,
              marginTop: 20,
              whiteSpace: "pre-wrap",
            }}
          >
            {data.description}
          </p>
        )}

        {/* 분위기 */}
        {data.values.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.faint, marginBottom: 8 }}>
              분위기
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.values.map((v) => (
                <span key={v} style={chip(C.mintPale, C.mintOn)}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 콜라보 유형 — 통합 칩 1세트(offers∪seeks, 2026-07-22 통합) */}
        {(data.offers.length > 0 || data.seeks.length > 0) && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.faint, marginBottom: 8 }}>
              함께하고 싶은 콜라보
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...new Set([...data.offers, ...data.seeks])].map((o) => (
                <span key={o} style={chip(C.kiwiPale, C.kiwiOn)}>
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 링크 */}
        {(data.instagram || data.homepage || data.address) && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: `1px solid ${C.hair}`,
              fontSize: 12,
              color: C.mute,
              lineHeight: 1.9,
            }}
          >
            {data.instagram && <div>인스타그램 · {data.instagram}</div>}
            {data.homepage && <div>홈페이지 · {data.homepage}</div>}
            {data.address && <div>주소 · {data.address}</div>}
          </div>
        )}

        {/* 푸터 */}
        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 11,
            color: C.faint,
            letterSpacing: "0.04em",
          }}
        >
          collab5로 만들었어요
        </div>
      </div>
    );
  }
);

// ── 다운로드 유틸 ──
// 캡처: skipFonts + fontEmbedCSS:"" 로 외부 CDN 폰트 stylesheet 접근을 막는다(cross-origin cssRules 에러 회피).
// 폰트는 시스템 폴백(-apple-system 등)으로 렌더 — 한글 깨짐 없음.
async function capturePng(node: HTMLElement): Promise<string> {
  // cross-origin stylesheet(Pretendard CDN 등)는 html-to-image가 cssRules를 못 읽어 멈춤/에러 →
  // 캡처하는 동안 DOM에서 잠깐 제거(styleSheets 목록에서 빠져 순회 대상 제외)하고 끝나면 복원.
  // (소개서는 인라인 hex 스타일이라 외부 stylesheet 없어도 캡처 결과 동일)
  const removed: Array<[Element, Node, Node | null]> = [];
  document.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet]").forEach((el) => {
    let crossOrigin = false;
    const sheet = el.sheet;
    if (sheet) {
      try {
        void sheet.cssRules;
      } catch {
        crossOrigin = true;
      }
    } else if (el.href && !el.href.startsWith(window.location.origin)) {
      crossOrigin = true;
    }
    if (crossOrigin && el.parentNode) {
      removed.push([el, el.parentNode, el.nextSibling]);
      el.parentNode.removeChild(el);
    }
  });
  try {
    // 타임아웃 가드 — 일부 환경에서 toPng가 멈추는 경우 8초 후 중단(백로그: 캡처 라이브러리 교체 검토).
    return await Promise.race([
      toPng(node, { pixelRatio: 2, backgroundColor: C.canvas }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("소개서 캡처 시간 초과")), 8000)
      ),
    ]);
  } finally {
    removed.forEach(([el, parent, next]) => parent.insertBefore(el, next));
  }
}

function notifyFail() {
  if (typeof window !== "undefined") {
    window.alert("소개서 이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}

export async function downloadPortfolioPng(node: HTMLElement, filename: string) {
  try {
    const dataUrl = await capturePng(node);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${filename}.png`;
    a.click();
  } catch {
    notifyFail();
  }
}

export async function downloadPortfolioPdf(node: HTMLElement, filename: string) {
  try {
    const dataUrl = await capturePng(node);
    const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });
  const pdf = new jsPDF({
    unit: "px",
    format: [img.width, img.height],
    orientation: img.height >= img.width ? "portrait" : "landscape",
  });
    pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
    pdf.save(`${filename}.pdf`);
  } catch {
    notifyFail();
  }
}
