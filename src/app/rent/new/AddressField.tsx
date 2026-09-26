"use client";

// 하루 팝업 — 주소 칸 (2026-09-14)
//
// 카카오(다음) 우편번호 서비스를 «버튼을 누를 때» 불러온다. 파일 머리에서 <script>를 걸면
// 주소를 안 고치는 방문(수정 화면 대부분)에도 그 무게가 실린다.
// 레이어는 팝업 창 대신 폼 안 컨테이너에 «embed»한다 — 모바일 인앱 브라우저는 새 창을 막는 일이 잦다.
//
// 자동 채움 규칙: `roadAddress`(없으면 `jibunAddress`) → 전체 주소, `sigungu + bname` → 동네.
// 동네 칸은 채운 뒤에도 고칠 수 있게 남긴다 — 「을지로3가」보다 「을지로」로 불리는 동네가 있다.
import { useCallback, useEffect, useRef, useState } from "react";
import { useDismissable } from "@/components/useDismissable";
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
        /** 열릴 때 검색창에 포커스를 줄지(서비스 기본 참). */
        focusInput?: boolean;
        /** 열릴 때 서비스 화면(iframe)에 포커스를 줄지(서비스 기본 참). */
        focusContent?: boolean;
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
  // 🪟09-18 밤 QA(H-27) — 이 레이어만 ESC로 안 닫히고, 열려 있는 동안 **뒤 화면이 그대로 스크롤**됐다.
  //   폰에서 주소 목록을 넘기다 손가락이 레이어 밖으로 나가면 등록 폼이 뒤에서 움직여, 닫고 나면 딴 데 와 있다.
  //   ⭐확인 팝업(`ConfirmDialog`)이 쓰는 훅을 그대로 쓴다. 자리마다 따로 붙이면 언젠가 또 하나가 빠진다(07-29 시트 19곳).
  //   ⚠️`overlayClose`는 그대로 참 — 여기선 딤 클릭이 「안 고를래요」라 잃을 입력이 없다(전에도 그렇게 닫혔다).
  // 🩸09-27 — 그날 훅을 붙여 스크롤 잠금은 됐지만 ESC는 여전히 안 먹었다. 훅은 우리 문서(`document`)에서 키를 듣는데,
  //   우편번호 서비스가 뜨자마자 자기 검색창으로 포커스를 가져가서 ESC가 우리 문서까지 안 왔다. 그 검색창은
  //   `postcode.map.kakao.com`에서 온 iframe 안에 있어서, 거기서 난 키는 우리 쪽 리스너가 못 듣는다.
  //   실측: 연 직후 `activeElement`가 IFRAME이었고 ESC를 눌러도 레이어가 그대로였다.
  //   ✅대표 결정 — 검색창 자동 포커스를 포기한다. 아래 embed에 `focusInput`·`focusContent`를 끄면 포커스가 훅이 준 패널에 남아 ESC가 먹는다.
  //   ⚠️검색창을 눌러 들어간 뒤엔 ESC가 여전히 안 온다. 그때 ESC는 서비스가 받아서 검색어를 지운다(09-27 실측).
  //     서비스가 우리에게 보내는 신호는 검색·크기·선택 완료 셋뿐이라 키를 받아 올 길이 없다. 그때는 ×·닫기·딤 클릭으로 닫는다.
  const closeLayer = useCallback(() => setOpen(false), []);
  const layer = useDismissable(open, { onClose: closeLayer, overlayClose: true });

  // 컨테이너가 DOM에 생긴 «뒤에» embed해야 한다. 열기 버튼 핸들러 안에서 하면 아직 div가 없다.
  useEffect(() => {
    if (!open || !boxRef.current || !window.daum?.Postcode) return;
    boxRef.current.innerHTML = "";
    new window.daum.Postcode({
      width: "100%",
      height: "100%",
      // 포커스를 iframe으로 안 가져가게 한다. 그래야 ESC가 우리 문서에 온다(위 09-27 주석).
      focusInput: false,
      focusContent: false,
      oncomplete: (d) => {
        const road = (d.roadAddress || d.jibunAddress || "").trim();
        const area = [d.sigungu, d.bname].filter(Boolean).join(" ").trim();
        onPick(road, area);
        setOpen(false);
      },
    }).embed(boxRef.current);
  }, [open, onPick]);

  const find = async () => {
    if (busy) return;
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
          // ⌨️`disabled` 대신 `aria-disabled`(09-27). 여는 동안 버튼을 `disabled`로 바꾸면 브라우저가 그 버튼의 포커스를 빼서
          //   레이어가 «돌아갈 자리»로 body를 기억했다. ESC로 닫으면 포커스가 페이지 맨 위로 튀었다. 두 번 누름은 `find` 첫 줄이 막는다.
          <button
            type="button"
            onClick={find}
            aria-disabled={busy}
            className={`${secondaryBtnCls} h-[48px] shrink-0 aria-disabled:opacity-60`}
          >
            {busy ? "여는 중…" : "주소 찾기"}
          </button>
        )}
      </div>

      {manual && (
        <p className="text-[15px] leading-relaxed break-keep text-faint">
          주소 찾기를 불러오지 못했어요. 도로명 주소를 직접 적어 주세요.
        </p>
      )}

      {/* 🪟09-14 대표 — *「주소 찾기 누르면 이거 팝업으로 나오게 못하나? 모바일의 경우도 뭔가 레이어가
          잠깐 하나 나오고(바텀으로 쭉 올라오거나)」*.
          🔻전엔 폼 «안»에 그대로 펼쳐졌다. 그러면 아래 칸들이 440px씩 밀려 내려가서, 고르고 나면
            내가 어디에 있었는지 잃는다. 레이어는 지면을 안 밀고 닫으면 원래 자리로 돌아온다.
          📱`items-end sm:items-center` — 폰은 바닥에서 올라오고 데스크톱은 가운데. `ConfirmDialog`와 같은 문법이다. */}
      {open && (
        <div
          {...layer.overlayProps}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/55 backdrop-blur-[2px] sm:items-center sm:p-4"
        >
          <div
            // 🚨훅이 안쪽 클릭을 멈춰 준다 — 부모로 올라가면 주소를 고르는 순간 닫힌다.
            {...layer.panelProps}
            aria-label="주소 찾기"
            className="w-full max-w-[480px] overflow-hidden rounded-t-lg bg-surface shadow-e3 sm:rounded-lg"
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <p className="text-[17px] font-medium text-ink">주소 찾기</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="-mr-2 flex size-[44px] items-center justify-center text-[20px] text-mute"
              >
                ×
              </button>
            </div>
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
