"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { PullQuote, CaptionedImage } from "./MagazineEditorNodes";
import { markdownToDoc, looksLikeMarkdown } from "@/lib/magazine-markdown";
import { uploadPhoto } from "@/lib/upload";
import { MAGAZINE_IMAGE_MAX_DIM, MAGAZINE_STORAGE_PREFIX } from "@/lib/limits";
import type { MagazineDoc } from "@/lib/types";

// 매거진 본문 에디터 (2026-08-10) — 지시서 §2-2의 블록만. **더 늘리지 말 것.**
// 저장 포맷은 Tiptap JSON(HTML 아님) — 이유는 lib/types.ts MagazineNode 주석.

function Btn({
  on, active, disabled, label, title,
}: { on: () => void; active?: boolean; disabled?: boolean; label: string; title: string }) {
  return (
    <button
      type="button"
      onClick={on}
      disabled={disabled}
      title={title}
      // ⚠️`onMouseDown` preventDefault가 없으면 버튼을 누를 때 에디터 선택이 풀려
      //   "굵게를 눌렀는데 아무 일도 안 일어나는" 현상이 난다.
      onMouseDown={(e) => e.preventDefault()}
      className={`h-8 shrink-0 rounded-sm px-2 text-[13px] font-medium transition-colors disabled:opacity-40 ${
        active ? "bg-primary text-primary-on" : "text-mute hover:bg-surface-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

/** 사진 고르기 버튼 — 파일 입력을 숨기고 버튼이 대신 연다.
 *
 *  🚨**`<label>`로 감싸지 마라.** 08-14에 대표가 "한 번 누르면 아무 반응이 없고 **더블클릭하면
 *    창이 뜬다**"고 제보해 잡힌 버그다. 원인은 두 요구가 부딪힌 것:
 *      ① 누르는 순간 사진 선택(NodeSelection)이 풀리면 안 된다 → `onMouseDown` preventDefault 필요
 *      ② `<label>`이 안쪽 `<input type=file>`에게 클릭을 넘겨주는 건 **그 기본 동작**이다
 *    ①이 ②를 같이 죽인다. 그래서 첫 클릭은 먹히지 않고, 더블클릭의 두 번째 클릭에서야 열렸다.
 *  → 라벨을 버리고 **버튼 + 숨은 input(ref)** 으로 바꿔 `input.click()`을 직접 부른다.
 *    preventDefault는 그대로 두므로 선택도 지키고, 창도 한 번에 열린다.
 *
 *  🪤이 버그가 오래 안 잡힌 이유 — 툴바의 「사진」 넣기도 **같은 라벨 구조라 같이 아팠는데**,
 *    사진 넣기는 커서만 있으면 되는 일이라 두 번 눌러도 아무도 이상하게 여기지 않았다.
 *    "저쪽은 되는데 이쪽만 안 된다"로 읽고 그 구조를 용의선상에서 뺐던 게 오진의 출발점이었다.
 *    ⭐**"저쪽은 된다"는 것도 직접 눌러 확인하기 전엔 증거가 아니다.** */
function PhotoPickerButton({
  label,
  title,
  busy,
  onPick,
  className,
}: {
  label: string;
  title?: string;
  busy: boolean;
  onPick: (f: File) => void;
  className: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        title={title}
        disabled={busy}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => ref.current?.click()}
        className={className}
      >
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = ""; // 같은 파일을 다시 골라도 change가 뜨게
        }}
      />
    </>
  );
}

function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage: (f: File) => void; uploading: boolean }) {
  const addLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 주소", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-hairline bg-surface px-2 py-1.5">
      <Btn on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })} label="소제목" title="소제목" />
      <span className="mx-1 h-4 w-px bg-hairline" />
      <Btn on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} label="굵게" title="굵게" />
      <Btn on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} label="기울임" title="기울임" />
      <Btn on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} label="밑줄" title="밑줄" />
      <Btn on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} label="취소선" title="취소선" />
      <span className="mx-1 h-4 w-px bg-hairline" />
      <Btn on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} label="인용" title="인용문 — 남의 말을 옮길 때" />
      <Btn
        on={() => {
          // 강조 박스 토글 — 이미 강조면 문단으로 되돌린다.
          if (editor.isActive("pullQuote")) editor.chain().focus().setNode("paragraph").run();
          else editor.chain().focus().setNode("pullQuote").run();
        }}
        active={editor.isActive("pullQuote")} label="강조" title="강조 박스 — 우리 문장을 크게 띄울 때" />
      <span className="mx-1 h-4 w-px bg-hairline" />
      <Btn on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} label="• 목록" title="순서 없는 목록" />
      <Btn on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} label="1. 목록" title="순서 있는 목록" />
      <span className="mx-1 h-4 w-px bg-hairline" />
      <Btn on={addLink} active={editor.isActive("link")} label="링크" title="링크" />
      <Btn on={() => editor.chain().focus().setHorizontalRule().run()} label="구분선" title="구분선" />
      {/* 사진 — 업로드가 끝나면 커서 자리에 들어간다. 캡션은 삽입된 사진 아래 칸에서 입력. */}
      <PhotoPickerButton
        title="사진 넣기"
        busy={uploading}
        label={uploading ? "올리는 중…" : "사진"}
        onPick={onImage}
        className={`inline-flex h-8 shrink-0 cursor-pointer items-center rounded-sm px-2 text-[13px] font-medium transition-colors ${
          uploading ? "text-faint" : "text-mute hover:bg-surface-soft hover:text-ink"
        }`}
      />
      <Btn on={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} label="서식 지우기" title="서식 지우기" />
    </div>
  );
}

/** 가로폭 직접 입력 칸.
 *  🪤**입력 문자열을 따로 들고 있는 이유** — 노드의 `width`에 값을 바로 묶으면(`value={width}`)
 *    "480"을 치는 도중 첫 글자 `4`가 최소값(80) 미만이라 width가 `null`이 되고, 그 `null`이
 *    곧바로 칸을 비워버린다. 즉 **한 글자도 못 넣는다**(08-12 실측). 그래서 타이핑 중에는
 *    화면 값만 두고, **쓸 수 있는 값이 됐을 때만** 노드에 반영한다. */
function WidthField({ width, onCommit }: { width: number | null; onCommit: (w: number | null) => void }) {
  const [text, setText] = useState(width ? String(width) : "");
  // 프리셋을 누르면 바깥에서 값이 바뀐다 → 칸도 따라간다.
  // (타이핑으로 반영된 경우엔 문자열이 같아 화면이 흔들리지 않는다.)
  useEffect(() => {
    setText(width ? String(width) : "");
  }, [width]);

  return (
    <input
      type="number"
      min={80}
      step={20}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (!t.trim()) { onCommit(null); return; } // 비우면 = 꽉 차게
        const n = Number(t);
        if (Number.isFinite(n) && n >= 80) onCommit(n);
      }}
      placeholder="직접"
      className="h-8 w-20 rounded-sm border border-hairline bg-surface px-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-focus"
    />
  );
}

/** 캡션 입력칸.
 *  🚨**한글이 안 써지던 자리다(08-14 대표 제보).** 원인은 「값을 밖에서 되받아 오는 입력칸」이다 —
 *    전엔 `value={노드의 caption}`이라 한 글자 칠 때마다 **에디터 → React 리렌더 → value 덮어쓰기**가
 *    한 바퀴 돌았다. 영문·숫자는 글자가 즉시 확정돼 티가 안 나지만, **한글은 조합 중(ㅌ→토→토우)**이라
 *    그 사이 value가 바뀌면 브라우저가 **조합을 취소**한다. 그래서 크기(숫자·버튼)는 26장 전부
 *    저장됐는데 캡션(한글)만 0건이었다.
 *  ⭐고침 = **화면 값은 이 컴포넌트가 갖고**, 노드에는 흘려보내기만 한다(되받지 않는다).
 *    다른 사진을 고르면 `key`가 바뀌며 새로 마운트돼 값이 갈아끼워진다(아래 ImageBar 참조).
 *  ⛔`value`를 다시 노드 속성에 묶지 말 것 — 같은 사고가 그대로 재현된다. */
function CaptionField({ initial, onChange }: { initial: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
      placeholder="사진 아래 들어갈 설명 (선택)"
      className="w-full rounded-sm border border-hairline bg-surface px-2.5 py-1.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-focus"
    />
  );
}

/** 선택한 사진의 캡션·크기 칸.
 *  ⭐사진을 클릭했을 때만 나타난다 — 캡션을 본문 문단으로 두지 않고 **이미지 노드의 속성**으로 두기 때문에
 *  (그래야 이미지를 지우면 캡션도 같이 사라진다), 그 값을 고칠 자리가 따로 필요하다.
 *
 *  🚨**이 칸은 툴바와 함께 화면 위에 붙어 있어야 한다**(아래 sticky 래퍼). 예전엔 에디터 **맨 아래**에
 *    있었는데, 본문이 길어지면 사진을 눌러도 칸이 화면 밖(수천 px 아래)이라 **"클릭은 되는데 입력칸이
 *    안 보인다"**가 된다(08-12 대표 보고). 자리를 옮길 땐 "본문이 A4 열 장일 때도 보이나"를 먼저 물을 것. */
function ImageBar({
  editor,
  onReplace,
  replacing,
}: {
  editor: Editor;
  onReplace: (f: File) => void;
  replacing: boolean;
}) {
  const caption = (editor.getAttributes("image").caption as string) ?? "";
  if (!editor.isActive("image")) return null;

  const width = (editor.getAttributes("image").width as number | null) ?? null;
  // 🚨**`.focus()`를 붙이지 마라.** 붙이면 값을 바꿀 때마다 DOM 포커스가 에디터로 끌려가
  //    **입력칸이 한 글자 만에 풀린다**(캡션도 px 칸도 첫 글자에서 끊긴다, 08-12).
  //    포커스 없이도 동작하는 이유 = 사진 선택(NodeSelection)은 에디터가 blur돼도 살아 있다.
  const setWidth = (w: number | null) =>
    editor.chain().updateAttributes("image", { width: w }).run();

  return (
    <div className="space-y-2 border-b border-hairline bg-surface-soft px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[13px] font-medium text-mute">캡션</span>
        {/* ⭐`key`가 이 칸의 생명줄이다 — 선택 위치가 바뀌면(=다른 사진을 고르면) 새로 마운트돼
            그 사진의 캡션으로 갈아끼워진다. key가 없으면 앞 사진의 글이 그대로 남는다.
            같은 사진을 편집하는 동안엔 key가 그대로라 **타이핑 중 값이 덮이지 않는다**(한글 조합 보호). */}
        <CaptionField
          key={editor.state.selection.from}
          initial={caption}
          onChange={(v) => editor.chain().updateAttributes("image", { caption: v }).run()}
        />
      </div>
      {/* 크기 — 드래그 핸들 대신 프리셋 + 직접 입력.
          ⭐드래그를 안 쓴 이유: 모바일에서 손가락으로 핸들을 잡기가 어렵다(대표가 짚은 지점).
            프리셋이면 폰에서도 한 번 탭으로 끝나고, 정확한 값이 필요하면 옆 칸에 숫자를 넣는다. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-10 shrink-0 text-[13px] font-medium text-mute">크기</span>
        {[
          // ⚠️「크게」가 640이면 **「꽉 차게」와 구분이 안 된다**(편집 칸 638px·상세 본문 ~648px).
          //   버튼 넷 중 둘이 같은 결과를 내면 UI가 거짓말을 하는 셈이라 560으로 낮췄다(08-12).
          { label: "작게", v: 320 },
          { label: "보통", v: 440 },
          { label: "크게", v: 560 },
          { label: "꽉 차게", v: null },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setWidth(p.v)}
            className={`h-8 rounded-sm px-2.5 text-[13px] font-medium transition-colors ${
              width === p.v ? "bg-primary text-primary-on" : "bg-surface text-mute hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-1 inline-flex items-center gap-1">
          <WidthField width={width} onCommit={setWidth} />
          <span className="text-[13px] text-faint">px</span>
        </span>
      </div>
      {/* 사진 바꾸기 — 지우고 다시 넣지 않아도 되게(대표 지시 08-14).
          ⭐**캡션·크기는 그대로 두고 사진만 갈아끼운다** — `src`만 바꾸므로 나머지 속성은 살아 있다.
            지우고 새로 넣으면 캡션을 다시 쓰고 크기를 다시 눌러야 한다. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-10 shrink-0 text-[13px] font-medium text-mute">사진</span>
        {/* 누르는 순간 사진 선택(NodeSelection)이 풀리면 업로드가 끝나도 어느 사진을 바꿀지 모르게
            된다 — 그래서 `onMouseDown` preventDefault가 필요하고, 그것 때문에 라벨을 못 쓴다.
            상세는 `PhotoPickerButton` 주석(08-14 더블클릭 버그). */}
        <PhotoPickerButton
          busy={replacing}
          label={replacing ? "바꾸는 중…" : "다른 사진으로 바꾸기"}
          onPick={onReplace}
          className={`inline-flex h-8 cursor-pointer items-center rounded-sm border border-border-strong bg-surface px-2.5 text-[13px] font-medium transition-colors ${
            replacing ? "text-faint" : "text-ink hover:bg-surface-soft"
          }`}
        />
      </div>
      <p className="text-[12px] leading-relaxed text-faint">
        폰처럼 화면이 좁으면 이 값과 상관없이 화면 폭에 맞춰 들어가요.
      </p>
    </div>
  );
}

/** 🚨**Tiptap이 준 JSON을 서버 액션에 그대로 넘기면 `attrs`가 통째로 사라진다**(08-13 사고).
 *
 *  왜: ProseMirror는 노드의 `attrs`를 `Object.create(null)`로 만든다(프로토타입이 없는 객체).
 *  그런데 서버 액션 인자 직렬화기는 **프로토타입 없는 객체를 "일반 객체가 아니다"로 보고 통과시키지
 *  않는다** — Next가 넘겨주는 temporaryReferences 덕분에 에러조차 안 나고 **조용히 빠진다.**
 *  결과: 사진의 `src`, 소제목의 `level`, 링크의 `href`가 저장 순간 전부 증발한다.
 *  (실제 피해: 08-13 창간호 초안의 본문 사진 5장이 `{"type":"image"}`만 남았다.)
 *
 *  ⭐한 번 JSON을 왕복시키면 평범한 객체가 되어 그대로 건너간다. **여기가 유일한 진입점이므로
 *    여기서 막는다** — 이 함수를 걷어내면 같은 사고가 그대로 재현된다.
 *  ⚠️`structuredClone`으로 바꾸지 말 것(프로토타입 없는 객체를 그대로 복제한다). */
const toPlainDoc = (doc: unknown): MagazineDoc => JSON.parse(JSON.stringify(doc)) as MagazineDoc;

export function BodyEditor({
  initial,
  onChange,
}: {
  initial: MagazineDoc;
  onChange: (doc: MagazineDoc) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [imgErr, setImgErr] = useState("");
  /** 성공 신호. 없으면 **바뀌었는지 아닌지를 사람이 알 수 없다** — 비슷한 사진으로 갈아끼우면
   *  화면이 거의 그대로라 "아무 반응 없음"과 구분이 안 된다(대표 제보 08-14의 절반이 이것일 수 있다). */
  const [imgOk, setImgOk] = useState("");

  // 붙여넣기 핸들러가 editor를 참조해야 하는데, 그 시점엔 useEditor가 아직 값을 안 돌려줬다 → ref로 잇는다.
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    // ⚠️Next SSR에서 필수 — 없으면 서버·클라 렌더가 달라 하이드레이션 경고가 뜬다.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] }, // h3만 — 본문에서 h1·h2가 나오면 페이지 제목 구조가 깨진다
      }),
      // ⚠️v2 StarterKit엔 Link가 없어서 따로 넣는다(v3부터 포함이라 버전 올릴 때 중복 주의).
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      PullQuote,
      CaptionedImage,
      Placeholder.configure({ placeholder: "본문을 쓰거나, 마크다운 초안을 붙여넣어 주세요." }),
    ],
    content: initial?.content?.length ? initial : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class:
          "min-h-[420px] px-4 py-4 text-[16px] leading-[1.85] text-body outline-none [&_h3]:mt-6 [&_h3]:text-[19px] [&_h3]:font-bold [&_h3]:text-ink [&_blockquote]:border-l-[3px] [&_blockquote]:border-primary-tint [&_blockquote]:pl-3 [&_blockquote]:text-mute [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:my-4 [&_hr]:border-hairline [&_a]:text-primary-on [&_a]:underline [&_img]:mx-auto [&_img]:rounded-md [&_img.ProseMirror-selectednode]:outline [&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-[var(--color-primary)]",
      },
      // ⭐마크다운 붙여넣기 — 지시서가 못 박은 요구사항.
      //   대표 초안이 마크다운이라, 이게 없으면 `###`·`>`가 평문으로 들어가 전부 손으로 다시 잡아야 한다.
      //   ⚠️`insertContent`를 쓰려면 editor 인스턴스가 필요한데 여기선 아직 만들어지는 중이다 → ref 경유.
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData("text/plain");
        if (!text || !looksLikeMarkdown(text)) return false; // 평범한 텍스트는 기본 동작에 맡긴다
        const nodes = markdownToDoc(text).content ?? [];
        const ed = editorRef.current;
        if (!nodes.length || !ed) return false;
        ed.commands.insertContent(nodes);
        return true; // true = "내가 처리했다" — 기본 붙여넣기가 안 돈다
      },
    },
    onUpdate({ editor }) {
      onChange(toPlainDoc(editor.getJSON()));
    },
  });

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  const insertImage = async (file: File) => {
    setImgErr("");
    setImgOk("");
    setUploading(true);
    try {
      const src = await uploadPhoto(file, MAGAZINE_IMAGE_MAX_DIM, MAGAZINE_STORAGE_PREFIX);
      // caption은 빈 문자열로 넣고, 아래 캡션 칸에서 채운다(노드 attrs라 이미지와 함께 움직인다).
      editorRef.current?.chain().focus().setImage({ src, alt: "" }).run();
    } catch (e) {
      setImgErr(
        e instanceof Error && e.message.startsWith("timeout:")
          ? "업로드가 오래 걸려 멈췄어요. 다시 시도해주세요."
          : "사진 업로드에 실패했어요."
      );
    } finally {
      setUploading(false);
    }
  };

  /** 선택한 사진만 갈아끼운다. 캡션·크기는 건드리지 않는다.
   *  🚨**바꿀 자리를 미리 적어둔다**(`pos`) — 파일 고르는 창이 뜨는 동안 에디터는 손을 떠나 있고,
   *    업로드는 수 초가 걸린다. 그 사이 선택이 풀리면 `updateAttributes`가 **엉뚱한 곳**에 꽂히거나
   *    아무 일도 안 일어난다. 끝난 뒤 그 자리를 다시 집어(`setNodeSelection`) 주소만 바꾼다. */
  const replaceImage = async (file: File) => {
    if (!editor) return;
    setImgErr("");
    setImgOk("");
    const pos = editor.state.selection.from;

    // 🚨**단계마다 결과를 말한다**(08-14 대표 제보 "아무런 반응이 없다" 이후).
    //    예전엔 세 갈래(자리 잃음 / 업로드 실패 / 반영 실패)가 전부 조용히 끝나거나,
    //    에디터 상자 **맨 아래**에만 에러가 떠서 — 버튼은 화면 위에 붙어 있는데 —
    //    쓰는 사람 눈에는 어느 쪽이든 똑같이 "아무 일도 안 일어남"으로 보였다.
    //    ⭐증상이 하나여도 원인이 여럿이면, 먼저 할 일은 고치는 게 아니라 **가르는 것**이다.
    // ⚠️`pos`가 사진 노드를 가리키지 **않을 수도** 있다. 그때도 포기하지 않는다 —
    //   캡션·크기 칸이 쓰는 `updateAttributes`(선택을 손대지 않는 경로)는 이미 잘 동작하는 게
    //   확인돼 있으므로, 그쪽으로 넘긴다. **되던 길을 막는 가드는 가드가 아니라 새 버그다.**
    const posIsImage = () => editor.state.doc.nodeAt(pos)?.type.name === "image";
    if (!posIsImage() && !editor.isActive("image")) {
      setImgErr("바꿀 사진을 다시 한 번 눌러주세요.");
      return; // 업로드를 아예 시작하지 않는다 — 꽂을 자리가 없는데 올릴 이유가 없다
    }

    setReplacing(true);
    try {
      const src = await uploadPhoto(file, MAGAZINE_IMAGE_MAX_DIM, MAGAZINE_STORAGE_PREFIX);
      // `.run()`은 명령이 실제로 적용됐는지를 boolean으로 돌려준다 — 이 값을 버리면
      // "조용히 아무 일도 안 일어나는" 경로가 그대로 남는다.
      // 업로드는 수 초가 걸린다. 그 사이 본문이 바뀌어 자리가 밀렸을 수 있으니 **다시** 확인한다.
      const applied = posIsImage()
        ? editor.chain().setNodeSelection(pos).updateAttributes("image", { src }).run()
        : editor.isActive("image")
          ? editor.chain().updateAttributes("image", { src }).run() // 캡션·크기와 같은 경로
          : false;
      if (!applied) {
        setImgErr("바꿀 자리를 잃었어요. 사진을 다시 누르고 시도해주세요.");
        return;
      }
      setImgOk("사진을 바꿨어요.");
    } catch (e) {
      setImgErr(
        e instanceof Error && e.message.startsWith("timeout:")
          ? "업로드가 오래 걸려 멈췄어요. 다시 시도해주세요."
          : "사진을 바꾸지 못했어요. 다시 시도해주세요."
      );
    } finally {
      setReplacing(false);
    }
  };

  if (!editor) {
    return <div className="min-h-[480px] rounded-md border border-hairline bg-surface-soft" />;
  }

  return (
    // ⚠️`overflow-hidden`을 다시 넣지 말 것 — 그게 있으면 이 상자가 스크롤 컨테이너가 돼
    //   **안쪽 sticky가 통째로 죽는다**(툴바도 안 붙어 있었다). 모서리 둥글림은 sticky 머리와
    //   맨 아랫줄이 각자 `rounded-t/b`로 처리한다.
    <div className="rounded-md border border-hairline bg-surface">
      {/* 툴바 + 사진 칸을 한 덩어리로 화면 위에 붙인다. `top-14` = 사이트 헤더(h-14) 아래. */}
      <div className="sticky top-14 z-10 rounded-t-md bg-surface">
        <Toolbar editor={editor} onImage={(f) => void insertImage(f)} uploading={uploading} />
        <ImageBar editor={editor} onReplace={(f) => void replaceImage(f)} replacing={replacing} />
        {/* 🚨결과 알림은 **버튼 바로 밑**이어야 한다(08-14 수정).
            전엔 이게 `EditorContent` **아래**, 즉 에디터 상자 맨 끝에 있었다. 버튼은 sticky라 늘
            화면 위에 붙어 있는데 알림은 본문 길이만큼 아래 — 긴 글이면 수천 px 떨어진 자리다.
            **에러가 떠 있어도 쓰는 사람은 평생 못 본다.** 알림은 그 일이 일어난 곳 옆에 둔다. */}
        {imgErr && (
          <p role="alert" className="border-t border-hairline px-4 py-2 text-[13px] text-red-600">
            {imgErr}
          </p>
        )}
        {imgOk && (
          <p role="status" className="border-t border-hairline px-4 py-2 text-[13px] text-primary-on">
            {imgOk}
          </p>
        )}
      </div>
      <EditorContent editor={editor} />
      <p className="rounded-b-md border-t border-hairline px-4 py-2 text-[13px] text-faint">
        사진을 클릭하면 위쪽에 캡션·크기 칸이 나와요.
      </p>
    </div>
  );
}
