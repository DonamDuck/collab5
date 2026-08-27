"use client";

// 업종 선택 — 검색 + 분류 훑어보기. 목록·검색 함수의 정본은 `lib/industry.ts`.
//
// ⭐**세 갈래를 다 두는 이유**(08-26 설계) — 고르는 사람이 두 종류라서다.
//   · **자기 업종 이름을 아는 사람**(카페·미용실·여행사) → 검색이 제일 빠르다. 두 글자면 끝난다.
//   · **자기를 뭐라 불러야 할지 모르는 사람** → 빈 검색창 앞에서 막힌다.
//     ⚠️이게 소수가 아니다. 우리 활성 13곳 중 파랑~·캔버스가든·계단뿌셔클럽이 그랬다.
//     그런 분에겐 **분류를 훑어보는 뒷문**이 있어야 한다.
//   → 그래서 `검색`과 `분류로 찾아보기`를 나란히 둔다. 둘 중 하나만 두면 반드시 누군가 막힌다.
//
// ⛔**자유 입력 칸을 만들지 마라**(대표 확정 08-26). 카카오맵은 자유 입력 뒤 검수자가 정규화하는데,
//   우리가 그러면 **그 정리가 곧 대표 일이 된다**(*「내가 일일이 검수하는 건 헬이야」*).
//   목록 안에서만 고르게 하면 값이 항상 정해진 것 중 하나라 뒤처리가 생기지 않는다.
//   못 찾는 업종이 나오면 **자유 입력을 여는 게 아니라 `industry.ts`의 `CUSTOM_INDUSTRIES`에 칸을 더한다.**
//
// 🪤한글 조합 주의 — 검색칸은 입력값을 **가공하지 않고 그대로** 담는다.
//   값을 다듬어 되돌려 넣으면 조합 중인 글자가 취소된다(「숫자는 되는데 한글만 안 됨」이 그 신호다).
import { useMemo, useState } from "react";
import { INDUSTRY_GROUPS, findIndustry, groupShort, searchIndustries } from "@/lib/industry";

export function IndustryPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (code: string | undefined) => void;
}) {
  const [q, setQ] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null); // null = 훑어보기 닫힘
  const picked = findIndustry(value);
  const results = useMemo(() => searchIndustries(q), [q]);

  // 고르면 검색어·훑어보기를 접는다 — 고른 뒤에도 목록이 펼쳐져 있으면 "덜 끝난 느낌"이 남는다.
  const pick = (code: string) => {
    onChange(code);
    setQ("");
    setOpenGroup(null);
  };

  if (picked) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-pill bg-primary-tint px-3 py-1.5 text-[15px] text-ink">
          {picked.name}
          {/* 대분류를 옆에 흐리게 — 「카페」가 여럿일 때 어느 갈래를 골랐는지 알려준다 */}
          <span className="text-[13px] text-mute">{picked.group}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-[14px] text-mute underline underline-offset-2 hover:text-ink"
        >
          다시 고르기
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="업종을 검색해보세요 (예: 카페, 요가, 공방)"
        className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-[17px] text-ink outline-none placeholder:text-faint focus:border-focus"
      />

      {q && (
        <div className="mt-2 max-h-[240px] overflow-y-auto rounded-sm border border-hairline">
          {results.length === 0 ? (
            // ⭐빈손으로 두지 않는다 — 여기서 막히면 폼 전체가 멈춘다. 뒷문으로 안내한다.
            <p className="px-3 py-3 text-[15px] text-mute">
              찾는 업종이 없어요. 아래 <b className="text-body">분류로 찾아보기</b>에서 골라보세요.
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={() => pick(r.code)}
                // 📐가로가 아니라 «세로»로 쌓는다 — 업종명·대분류명이 둘 다 길 수 있어
                //   한 줄에 나란히 두면 좁은 화면에서 서로를 밀어 두 줄씩 깨진다(08-26 실측).
                className="block w-full px-3 py-2.5 text-left hover:bg-primary-tint"
              >
                <span className="block text-[16px] leading-snug text-ink">{r.name}</span>
                <span className="block text-[12px] text-mute">{r.group}</span>
              </button>
            ))
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpenGroup(openGroup === null ? "" : null)}
        className="mt-2 text-[14px] text-mute underline underline-offset-2 hover:text-ink"
      >
        {openGroup === null ? "분류로 찾아보기" : "분류 닫기"}
      </button>

      {openGroup !== null && (
        <div className="mt-2 rounded-sm border border-hairline p-2">
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRY_GROUPS.map((g) => (
              <button
                key={g.code}
                type="button"
                onClick={() => setOpenGroup(openGroup === g.code ? "" : g.code)}
                className={`rounded-pill px-3 py-1.5 text-[14px] ${
                  openGroup === g.code ? "bg-primary text-primary-on" : "bg-surface-soft text-body hover:bg-primary-tint"
                }`}
              >
                {/* 📐훑어보기 칸은 «짧은 이름»으로 — 정부 원본을 그대로 쓰면 칩 11개가 6줄을 먹어
                    한눈에 훑는다는 목적 자체가 사라진다(08-26 실측). 정확한 이름은 고른 뒤 칩에 뜬다. */}
                {groupShort(g.code, g.name)}
              </button>
            ))}
          </div>
          {openGroup !== "" && (
            <div className="mt-2 max-h-[240px] overflow-y-auto border-t border-hairline pt-2">
              {INDUSTRY_GROUPS.find((g) => g.code === openGroup)?.items.map(([c, n]) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => pick(c)}
                  className="block w-full px-2 py-2 text-left text-[16px] text-ink hover:bg-primary-tint"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
