"use client";

// 소개서 작성 임시저장 — 새로고침·뒤로가기·탭 닫기로 초안이 통째로 날아가던 것 방어.
// 대표 확정(2026-07-29, A안): **로그인·비로그인 똑같이 localStorage.** 서버 저장은 안 한다.
//
// 왜 서버를 안 쓰나: 로컬(5분 전)과 서버(1시간 전) 중 뭐가 최신이냐를 푸는 로직이 v1에 들어갈 값이 없고,
//   무엇보다 **비로그인 사용자는 계정이 없어 유실 시 복구 경로가 0**인데 서버 저장은 그 집단을 못 돕는다.
//   기기 간 이어쓰기는 별개 문제라 백로그.
//
// 이 훅이 지키는 세 가지 규칙:
//   ① **자동 복구 금지** — 항상 배너로 묻는다. 수정 모드에서 낡은 초안을 덜컥 얹으면
//      서버에 잘 저장해둔 내용을 되돌려버린다(가장 위험한 시나리오).
//   ② **계정별 키** — 안 가르면 A 로그아웃 → B 로그인 시 B의 폼에 A의 초안이 복구된다.
//   ③ **용량 방어** — 사진이 data URL이면(Storage 미설정 로컬) 5MB 쿼터를 즉시 터뜨린다.
//      http(s) URL만 저장하고, 그래도 넘치면 조용히 포기한다(저장 실패로 작성을 막지 않는다).
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "collab5:draft";
const VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7일 — 그보다 오래된 초안은 되레 혼란
const DEBOUNCE_MS = 800;

/** 계정·대상별 저장 키. 비로그인은 anon, 생성은 new, 수정은 slug. */
export function draftKey(userId: number | undefined, slug?: string | null): string {
  return `${PREFIX}:${userId ? `u${userId}` : "anon"}:${slug || "new"}`;
}

/** 로그아웃 시 이 계정의 초안을 지운다(공용 PC 대비). LogoutButton에서 호출. */
export function clearDraftsForUser(userId?: number): void {
  if (typeof window === "undefined") return;
  const who = `${PREFIX}:${userId ? `u${userId}` : "anon"}:`;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(who)) localStorage.removeItem(k);
  } catch {
    /* 저장소 접근 불가(시크릿·정책) — 지울 게 없는 것과 같다 */
  }
}

interface Envelope<T> {
  v: number;
  savedAt: string; // ISO
  data: T;
}

function read<T>(key: string): Envelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (env?.v !== VERSION || !env.savedAt) return null;
    if (Date.now() - new Date(env.savedAt).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return env;
  } catch {
    return null; // 깨진 JSON은 없는 것으로 — 여기서 던지면 폼 자체가 안 뜬다
  }
}

export interface DraftAutosave<T> {
  /** 복구 후보(자동 적용 안 함 — 배너로 물을 것). */
  found: { data: T; savedAt: string } | null;
  /** 배너 닫기 — 이번 세션에서만 숨긴다(저장본은 남겨 둔다). */
  dismiss: () => void;
  /** 저장본 삭제 — '새로 시작' / 제출 성공 시. */
  clear: () => void;
  /** 제출 직전 호출 — 저장 중단 + 이탈 경고 해제(제출 후 이동에서 경고가 뜨면 안 된다). */
  finish: () => void;
}

export function useDraftAutosave<T>(opts: {
  /** null이면 비활성(부팅 중·키 미정). */
  key: string | null;
  /** 지금 폼 내용. 매 렌더 새 객체여도 되지만 직렬화 비용을 아끼려 안에서 문자열 비교한다. */
  snapshot: T;
  /** 빈 폼이면 저장하지 않는다 — 아무것도 안 쓴 사람에게 복구 배너가 뜨면 이상하다. */
  hasContent: boolean;
}): DraftAutosave<T> {
  const { key, snapshot, hasContent } = opts;
  const [found, setFound] = useState<{ data: T; savedAt: string } | null>(null);
  const finished = useRef(false);
  const lastWritten = useRef<string>("");
  const loadedFor = useRef<string | null>(null);
  const quotaWarned = useRef(false);

  // ── 마운트(또는 키 확정) 시 1회 읽기. 비로그인으로 쓰다 로그인한 경우를 위해 anon 키도 승계한다.
  useEffect(() => {
    if (!key || loadedFor.current === key) return;
    loadedFor.current = key;
    let env = read<T>(key);
    if (!env && key.includes(":u")) {
      // "저장하려고 로그인했더니 쓰던 게 사라짐"을 막는다 — anon 초안을 이 계정 것으로 승계.
      const anon = key.replace(/:u\d+:/, ":anon:");
      env = read<T>(anon);
      if (env) {
        try {
          localStorage.setItem(key, JSON.stringify(env));
          localStorage.removeItem(anon);
        } catch {
          /* 승계 실패해도 배너는 띄운다 — 사용자에겐 보이는 게 중요 */
        }
      }
    }
    if (env) setFound({ data: env.data, savedAt: env.savedAt });
  }, [key]);

  // ── 디바운스 저장
  useEffect(() => {
    if (!key || finished.current || !hasContent) return;
    const t = setTimeout(() => {
      let json: string;
      try {
        json = JSON.stringify(snapshot);
      } catch {
        return; // 순환참조 등 — 저장 못 해도 작성은 계속돼야 한다
      }
      if (json === lastWritten.current) return; // 내용이 그대로면 쓰지 않는다
      try {
        localStorage.setItem(key, JSON.stringify({ v: VERSION, savedAt: new Date().toISOString(), data: snapshot }));
        lastWritten.current = json;
      } catch (e) {
        // QuotaExceededError 등 — **삼킨다.** 임시저장은 부가 기능이라 이걸로 작성을 막으면 안 된다.
        if (!quotaWarned.current) {
          quotaWarned.current = true;
          console.warn("[draft] 저장 실패(용량·정책)", (e as Error)?.name);
        }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [key, snapshot, hasContent]);

  // ── 이탈 경고 — 내용이 있고 아직 제출 안 했을 때만.
  //    ⚠️ 저장이 되고 있어도 띄운다: 사용자는 임시저장을 모르고, 다른 기기·브라우저에선 복구가 안 되니까.
  useEffect(() => {
    if (!hasContent) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (finished.current) return; // 제출 후 이동에서 뜨면 안 된다
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasContent]);

  const dismiss = useCallback(() => setFound(null), []);
  const clear = useCallback(() => {
    setFound(null);
    lastWritten.current = "";
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* 지울 수 없으면 만료(7일)에 맡긴다 */
      }
    }
  }, [key]);
  const finish = useCallback(() => {
    finished.current = true;
    clear();
  }, [clear]);

  return { found, dismiss, clear, finish };
}

/** "3분 전에" 같은 사람 말 — 배너에서 **언제 쓰던 것인지**를 반드시 보여줘야 복구 판단이 선다.
 *  ⚠️ 조사까지 포함해 돌려준다 — 문장에서 "…에"를 붙이면 "방금에"가 되어 어색하다(실제로 그렇게 나왔다). */
export function agoLabel(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전에`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전에`;
  return `${Math.floor(hr / 24)}일 전에`;
}
