"use client";

// 사진 출처 입력 팝업 — 이 사진 묶음의 사진들을 한 줄씩 보여주고 출처를 **수기로** 받는다.
// ⛔자동 채움은 넣지 않는다(대표 판단 08-20): 인스타 계정에서 가져온 사진이라도 그 계정 주인이
//   권리자라는 보장이 없다(지인이 찍어준 사진일 수 있다). 틀린 출처를 박느니 비워두는 게 낫다.
// 값은 **사진 주소를 열쇠로 하는 표**에 담긴다 — 같은 사진을 활동·콜라보 양쪽에 썼으면 한 번만 적으면 된다.
import { useState } from "react";
import { useDismissable } from "@/components/useDismissable";

export function PhotoSourceDialog({
  photos,
  sources,
  onSave,
  onClose,
}: {
  /** 이 묶음의 사진 주소들(업로드 끝난 것만 넘어온다) */
  photos: string[];
  /** 소개서 전체의 「주소 → 출처」 표 */
  sources: Record<string, string>;
  /** 이 묶음 몫만 반영한 새 표를 돌려준다 */
  onSave: (next: Record<string, string>) => void;
  onClose: () => void;
}) {
  // ⚠️딤 클릭으로 닫지 않는다 — 쓰던 출처가 한 번에 날아간다(대표 정책 07-29, 작성 중 오버레이 공통).
  //   ESC는 열어둔다: 키보드·스크린리더 사용자에겐 사실상 유일한 탈출구다.
  const dialog = useDismissable(true, {
    onClose,
    overlayClose: false,
    labelledBy: "photo-source-title",
  });
  // 편집 중 값은 따로 들고 있다가 [저장]에서만 반영 — 닫으면 없던 일이 된다.
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(photos.map((p) => [p, sources[p] ?? ""])),
  );

  // 열쇠가 draft에 아직 없으면 저장본 값으로 읽는다.
  // ⚠️전엔 effect에서 draft를 맞춰줬는데, **effect 안의 동기 setState는 렌더를 연쇄시킨다**(lint 지적).
  //    읽을 때 한 겹 떨어뜨리면 effect 자체가 필요 없다.
  const valueOf = (url: string) => draft[url] ?? sources[url] ?? "";

  const save = () => {
    const next = { ...sources };
    for (const p of photos) {
      const v = valueOf(p).trim();
      // ⚠️빈 값은 **지운다.** 남겨두면 소개서에 빈 캡션 줄이 생기고, 저장본에 쓰레기가 쌓인다.
      if (v) next[p] = v;
      else delete next[p];
    }
    onSave(next);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      {...dialog.overlayProps}
    >
      <div
        {...dialog.panelProps}
        className="max-h-[80vh] w-full max-w-[440px] overflow-y-auto rounded-lg bg-surface p-5 shadow-e2"
      >
        <h3 id="photo-source-title" className="text-[17px] font-semibold text-ink">
          사진 출처 추가
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
          출처를 적은 사진만 소개서에 함께 표시돼요. 비워두면 지금처럼 사진만 보여요.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {photos.map((url, i) => (
            <div key={url} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-[13px] text-faint">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-md border border-hairline object-cover"
              />
              <input
                type="text"
                value={valueOf(url)}
                onChange={(e) => setDraft((d) => ({ ...d, [url]: e.target.value }))}
                placeholder="예) 사진 김OO"
                className="h-11 w-full min-w-0 rounded-md border border-hairline bg-surface px-3 text-[15px] text-ink placeholder:text-faint focus:border-border-strong focus:outline-none"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-[15px] font-medium text-ink"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            className="h-11 flex-1 rounded-md bg-primary text-[15px] font-medium text-primary-on"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
