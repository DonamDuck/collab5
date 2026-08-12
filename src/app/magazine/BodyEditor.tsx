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
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-hairline bg-surface px-2 py-1.5">
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
      <label
        className={`inline-flex h-8 shrink-0 cursor-pointer items-center rounded-sm px-2 text-[13px] font-medium transition-colors ${
          uploading ? "text-faint" : "text-mute hover:bg-surface-soft hover:text-ink"
        }`}
        title="사진 넣기"
        onMouseDown={(e) => e.preventDefault()}
      >
        {uploading ? "올리는 중…" : "사진"}
        <input type="file" accept="image/*" className="hidden" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImage(f); e.target.value = ""; }} />
      </label>
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

/** 선택한 이미지의 캡션 입력 칸.
 *  ⭐사진을 클릭했을 때만 나타난다 — 캡션을 본문 문단으로 두지 않고 **이미지 노드의 속성**으로 두기 때문에
 *  (그래야 이미지를 지우면 캡션도 같이 사라진다), 그 값을 고칠 자리가 따로 필요하다. */
function CaptionBar({ editor }: { editor: Editor }) {
  const active = editor.isActive("image");
  const caption = (editor.getAttributes("image").caption as string) ?? "";
  if (!active) {
    return (
      <p className="border-t border-hairline px-4 py-2 text-[13px] text-faint">
        사진을 클릭하면 여기에 캡션을 넣을 수 있어요.
      </p>
    );
  }
  const width = (editor.getAttributes("image").width as number | null) ?? null;
  const setWidth = (w: number | null) =>
    editor.chain().focus().updateAttributes("image", { width: w }).run();

  return (
    <div className="space-y-2 border-t border-hairline bg-surface-soft px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[13px] font-medium text-mute">캡션</span>
        <input
          value={caption}
          onChange={(e) => editor.chain().focus().updateAttributes("image", { caption: e.target.value }).run()}
          placeholder="사진 아래 들어갈 설명 (선택)"
          className="w-full rounded-sm border border-hairline bg-surface px-2.5 py-1.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-focus"
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
      <p className="text-[12px] leading-relaxed text-faint">
        폰처럼 화면이 좁으면 이 값과 상관없이 화면 폭에 맞춰 들어가요.
      </p>
    </div>
  );
}

export function BodyEditor({
  initial,
  onChange,
}: {
  initial: MagazineDoc;
  onChange: (doc: MagazineDoc) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [imgErr, setImgErr] = useState("");

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
      onChange(editor.getJSON() as MagazineDoc);
    },
  });

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  const insertImage = async (file: File) => {
    setImgErr("");
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

  if (!editor) {
    return <div className="min-h-[480px] rounded-md border border-hairline bg-surface-soft" />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface">
      <Toolbar editor={editor} onImage={(f) => void insertImage(f)} uploading={uploading} />
      <EditorContent editor={editor} />
      {imgErr && <p className="border-t border-hairline px-4 py-2 text-[13px] text-red-600">{imgErr}</p>}
      <CaptionBar editor={editor} />
    </div>
  );
}
