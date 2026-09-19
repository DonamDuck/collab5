import type { ReactNode } from "react";
import type { SlackBlock, SlackPayload, SlackText } from "@/lib/admin-notify";

// 📣슬랙 글 미리보기 (2026-09-19) · 개발 빌드 전용
// 대표 알림이 슬랙으로 가면서 «보이는 모양»을 볼 자리가 필요했다. 보내는 함수(`buildSlackPayload`)가 만든 블록을
//   그대로 받아 슬랙과 비슷하게 그린다. 슬랙의 실제 모양과 픽셀까지 같진 않다. 무엇이 어느 칸에 서는지를 본다.
// ⚠️글은 React 노드로만 만든다(`dangerouslySetInnerHTML` 없이). mrkdwn의 링크·굵게·줄바꿈 셋만 옮긴다.

function unescape(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** mrkdwn 한 줄 → 노드. `<주소|글자>`는 링크, `*글자*`는 굵게. */
function line(src: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /<([^|>]+)\|([^>]+)>|\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(unescape(src.slice(last, m.index)));
    if (m[1]) {
      out.push(
        <a key={`${key}-${i++}`} href={m[1]} target="_blank" rel="noreferrer" className="text-[#1264a3] underline-offset-2 hover:underline">
          {unescape(m[2])}
        </a>,
      );
    } else {
      out.push(<strong key={`${key}-${i++}`}>{unescape(m[3])}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < src.length) out.push(unescape(src.slice(last)));
  return out;
}

function Text({ t, k }: { t: SlackText; k: string }) {
  const lines = t.text.split("\n");
  return (
    <>
      {lines.map((l, i) => (
        <span key={`${k}-${i}`}>
          {t.type === "mrkdwn" ? line(l, `${k}-${i}`) : l}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function Block({ b, k }: { b: SlackBlock; k: string }) {
  if (b.type === "header") {
    return <p className="text-[18px] font-bold leading-snug break-keep text-[#1d1c1d]"><Text t={b.text} k={k} /></p>;
  }
  if (b.type === "context") {
    return (
      <p className="text-[13px] leading-relaxed break-keep text-[#616061]">
        {b.elements.map((e, i) => <Text key={`${k}-${i}`} t={e} k={`${k}-${i}`} />)}
      </p>
    );
  }
  if (b.type === "divider") return <hr className="border-[#e8e8e8]" />;
  return (
    <div className="space-y-2">
      {b.text && <p className="text-[15px] leading-relaxed break-keep text-[#1d1c1d]"><Text t={b.text} k={`${k}-t`} /></p>}
      {b.fields && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {b.fields.map((f, i) => (
            <p key={`${k}-f${i}`} className="min-w-0 text-[15px] leading-relaxed break-keep text-[#1d1c1d] [overflow-wrap:anywhere]">
              <Text t={f} k={`${k}-f${i}`} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function SlackPreview({ payload }: { payload: SlackPayload }) {
  return (
    <section className="mt-3">
      <p className="text-[13px] text-mute">슬랙 채널에 뜨는 모양 · 알림 미리보기 글: {payload.text}</p>
      <div className="mt-2 flex gap-3 rounded-xl border border-hairline bg-white p-4 sm:p-5">
        <div aria-hidden="true" className="size-9 shrink-0 rounded-lg bg-[#98FF5C]" />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[15px] font-bold text-[#1d1c1d]">
            collab5 알림 <span className="ml-1 rounded bg-[#e8e8e8] px-1 text-[11px] font-semibold text-[#616061]">앱</span>
          </p>
          {payload.blocks.map((b, i) => <Block key={i} b={b} k={`b${i}`} />)}
        </div>
      </div>
      <details className="mt-2 text-[13px] text-body">
        <summary className="cursor-pointer py-2">웹훅으로 보내는 JSON</summary>
        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(payload, null, 2)}</pre>
      </details>
    </section>
  );
}
