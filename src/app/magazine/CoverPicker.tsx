"use client";

import { useState } from "react";
import { uploadPhoto } from "@/lib/upload";
import { MAGAZINE_IMAGE_MAX_DIM, MAGAZINE_STORAGE_PREFIX } from "@/lib/limits";

// 커버 이미지 선택 (2026-08-10, PR3) — 목록 썸네일 + 링크 미리보기(OG) 겸용.
// 주소를 직접 붙여넣는 입력칸도 남겨둔다(이미 어딘가 올려둔 사진을 쓸 때).

export function CoverPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pick = async (file?: File | null) => {
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const url = await uploadPhoto(file, MAGAZINE_IMAGE_MAX_DIM, MAGAZINE_STORAGE_PREFIX);
      onChange(url);
    } catch (e) {
      // ⚠️실패를 삼키지 않는다 — 조용히 아무 일도 안 일어나면 사용자는 계속 다시 누른다.
      const msg = e instanceof Error && e.message.startsWith("timeout:")
        ? "업로드가 오래 걸려 멈췄어요. 사진 크기를 줄이거나 다시 시도해주세요."
        : "업로드에 실패했어요. 다시 시도해주세요.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {value && (
        <div className="mb-2 overflow-hidden rounded-md border border-hairline bg-surface-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="커버 미리보기" className="w-full" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-primary-tint bg-primary-pale px-4 text-[14px] font-medium text-primary-on">
          {busy ? "올리는 중…" : value ? "다른 사진으로" : "사진 올리기"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = ""; // 같은 파일을 다시 고를 수 있게 비운다
            }}
          />
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")}
            className="h-10 rounded-md border border-border-strong bg-surface px-3 text-[14px] text-ink">
            비우기
          </button>
        )}
      </div>
      <input
        className="mt-2 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-[14px] text-mute outline-none placeholder:text-faint focus:border-focus"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="또는 사진 주소를 직접 붙여넣기 (https://...)"
      />
      {/* 권장 사이즈 안내 — 대표가 물어본 자리(08-13). 화면에 적어두면 다음 편집자도 안 묻는다.
          ⚠️숫자를 바꿀 땐 실제 코드와 같이 고칠 것: 긴 변 축소는 `MAGAZINE_IMAGE_MAX_DIM`,
          목록 카드 잘림 비율은 `app/magazine/page.tsx`의 `aspect-[16/9]`. */}
      <p className="mt-2 text-[13px] leading-relaxed text-faint">
        가로로 찍은 <b className="font-medium text-mute">3:2 사진(1600×1067)</b>을 권해요. 목록 카드와
        카톡·검색 미리보기는 <b className="font-medium text-mute">가운데를 16:9로 잘라</b> 쓰거든요.
        세로 사진도 글 안에서는 통째로 보이지만, 목록에선 가운데 띠만 보이니 중요한 게 한가운데 오게
        골라주세요. 용량은 올릴 때 알아서 줄여요.
      </p>
      {err && <p className="mt-1.5 text-[13px] text-red-600">{err}</p>}
    </div>
  );
}
