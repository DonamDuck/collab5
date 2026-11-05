// 언어별 문안의 모양. 화면(view.tsx)과 메타데이터가 같은 문안을 읽는다.
import type { ChannelId } from "../channels";

/** 주 후원 버튼 하나. 창구 주소는 ../channels.ts에서 `id`로 찾는다. */
export type ChannelButton = { id: ChannelId; label: string; sub: string };

export type Copy = {
  /** 맨 위 「뒤로」 링크 글자(사적인 프로젝트 목록으로 간다). 빵부스러기 이름도 이걸 쓴다. */
  eyebrow: string;
  title: string;
  /** 히어로 문장. 화면에선 문장마다 줄을 새로 시작한다. */
  lead: string;
  channelsTitle: string;
  /** 주 버튼들 — 한국어는 카카오페이, 영어는 Buy Me a Coffee. */
  buttons: ChannelButton[];
  /** 주 버튼 아래 작은 줄(한국어만): 「해외 카드로는 Buy Me a Coffee」. 없으면 안 그린다. */
  overseas?: { text: string; link: string; id: ChannelId };
  /** 창구 주소가 비어 있을 때 버튼에 붙는 글자 */
  soon: string;
  note: string;
  appsTitle: string;
  footer: string;
};
