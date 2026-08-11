"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { PullQuote, CaptionedImage } from "./MagazineEditorNodes";
import { markdownToDoc, looksLikeMarkdown } from "@/lib/magazine-markdown";
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

function Toolbar({ editor }: { editor: Editor }) {
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
      <Btn on={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} label="서식 지우기" title="서식 지우기" />
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
          "min-h-[420px] px-4 py-4 text-[16px] leading-[1.85] text-body outline-none [&_h3]:mt-6 [&_h3]:text-[19px] [&_h3]:font-bold [&_h3]:text-ink [&_blockquote]:border-l-[3px] [&_blockquote]:border-primary-tint [&_blockquote]:pl-3 [&_blockquote]:text-mute [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:my-4 [&_hr]:border-hairline [&_a]:text-primary-on [&_a]:underline",
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

  if (!editor) {
    return <div className="min-h-[480px] rounded-md border border-hairline bg-surface-soft" />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
