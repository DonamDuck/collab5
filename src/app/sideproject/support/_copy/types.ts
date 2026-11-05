// 언어별 문안의 모양. 화면(view.tsx)과 메타데이터가 같은 문안을 읽는다.
import type { ChannelId } from "../channels";

/** 창구 한 줄(산사 후원 창구처럼 왼쪽 이름 · 오른쪽 할 일). 주소는 ../channels.ts에서 `id`로 찾는다. */
export type ChannelRow = { id: ChannelId; label: string; action: string; sub?: string };

export type Copy = {
  /** 맨 위 「뒤로」 링크 글자(딴짓 목록으로 간다). 빵부스러기 이름도 이걸 쓴다. */
  eyebrow: string;
  title: string;
  /** 히어로 문장. 화면에선 문장마다 줄을 새로 시작한다. */
  lead: string;
  channelsTitle: string;
  /** 계좌 칸의 버튼 글자(한국어만). 없으면 계좌 칸을 안 그린다. */
  account?: { copy: string; copied: string };
  /** 계좌 아래 버튼 줄 — 한국어는 카카오페이·Buy Me a Coffee, 영어는 Buy Me a Coffee. 주소가 빈 줄은 숨는다. */
  rows: ChannelRow[];
  /** 보여 줄 창구가 하나도 없을 때 첫 줄을 잠그고 붙이는 글자 */
  soon: string;
  note: string;
  appsTitle: string;
  footer: string;
};
