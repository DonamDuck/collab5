"use client";

// 하루 가게 — 주소 칸 (2026-09-14)
//
// 카카오(다음) 우편번호 서비스를 «버튼을 누를 때» 불러온다. 파일 머리에서 <script>를 걸면
// 주소를 안 고치는 방문(수정 화면 대부분)에도 그 무게가 실린다.
// 레이어는 팝업 창 대신 폼 안 컨테이너에 «embed»한다 — 모바일 인앱 브라우저는 새 창을 막는 일이 잦다.
//
// 자동 채움 규칙: `roadAddress`(없으면 `jibunAddress`) → 전체 주소, `sigungu + bname` → 동네.
// 동네 칸은 채운 뒤에도 고칠 수 있게 남긴다 — 「을지로3가」보다 「을지로」로 불리는 동네가 있다.
import { useEffect, useRef, useState } from "react";
import { rentInputCls, secondaryBtnCls } from "../ui";

const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type PostcodeResult = {
  roadAddress: string;
  jibunAddress: string;
  sigungu: string;
  bname: string;
  zonecode: string;
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (data: PostcodeResult) => void;
        width?: string | number;
        height?: string | number;
      }) => { embed: (el: HTMLElement) => void };
    };
  }
}

// 한 번만 붙인다. 버튼을 두 번 누르면 <script>가 둘이 되고, 두 번째는 첫 번째 로드를 기다리게 한다.
let loading: Promise<void> | null = null;
function loadPostcode(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null; // 다음 시도가 다시 붙일 수 있게
      s.remove();
      reject(new Error("postcode script failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function AddressField({
  base,
  detail,
  onPick,
  onBase,
  onDetail,
}: {
  /** 도로명(또는 지번) 주소. 상세(층·호)는 따로 받는다. */
  base: string;
  detail: string;
  /** 우편번호 서비스가 골라 준 결과 — 주소와 동네를 같이 돌려준다. */
  onPick: (base: string, area: string) => void;
  /** 스크립트를 못 불러왔을 때만 열리는 직접 입력. */
  onBase: (v: string) => void;
  onDetail: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 컨테이너가 DOM에 생긴 «뒤에» embed해야 한다. 열기 버튼 핸들러 안에서 하면 아직 div가 없다.
  useEffect(() => {
    if (!open || !boxRef.current || !window.daum?.Postcode) return;
    boxRef.current.innerHTML = "";
    new window.daum.Postcode({
      width: "100%",
      height: "100%",
      oncomplete: (d) => {
        const road = (d.roadAddress || d.jibunAddress || "").trim();
        const area = [d.sigungu, d.bname].filter(Boolean).join(" ").trim();
        onPick(road, area);
        setOpen(false);
      },
    }).embed(boxRef.current);
  }, [open, onPick]);

  const find = async () => {
    setBusy(true);
    try {
      await loadPostcode();
      setOpen(true);
    } catch {
      // 삼키지 않는다 — 직접 적을 수 있게 칸을 열고 이유를 한 줄 적는다.
      setManual(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          id="sp-address"
          className={`${rentInputCls} min-w-0 ${manual ? "" : "cursor-pointer"}`}
          value={base}
          readOnly={!manual}
          onClick={manual ? undefined : find}
          onChange={(e) => onBase(e.target.value)}
          placeholder={manual ? "예) 서울 중구 을지로 100" : "주소 찾기를 눌러 주세요"}
          aria-label="주소"
        />
        {!manual && (
          <button type="button" onClick={find} disabled={busy} className={`${secondaryBtnCls} h-[48px] shrink-0`}>
            {busy ? "여는 중…" : "주소 찾기"}
          </button>
        )}
      </div>

      {manual && (
        <p className="text-[15px] leading-relaxed break-keep text-faint">
          주소 찾기를 불러오지 못했어요. 도로명 주소를 직접 적어 주세요.
        </p>
      )}

      {open && (
        <div className="overflow-hidden rounded-md border border-border-strong">
          {/* 우편번호 서비스가 이 안을 채운다. 높이는 서비스 권장값(460px)에 가깝게. */}
          <div ref={boxRef} className="h-[440px] w-full" />
          <div className="flex justify-end border-t border-hairline px-2 py-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-[44px] px-3 text-[15px] text-mute underline underline-offset-2"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <input
        className={rentInputCls}
        value={detail}
        onChange={(e) => onDetail(e.target.value)}
        placeholder="층·호 (예: 2층, 201호)"
        aria-label="상세 주소"
      />
    </div>
  );
}
