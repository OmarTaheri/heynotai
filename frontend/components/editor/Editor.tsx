"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useImperativeHandle, forwardRef } from "react";
import {
  AiFlagExtension,
  setAiFlags,
  setSelectedFlag,
} from "./AiFlagExtension";
import type { AiFlag } from "@/lib/detection-types";

export interface EditorHandle {
  /** Scroll the editor so a given flag span is centered, then select it. */
  focusFlag: (flag: AiFlag) => void;
}

interface Props {
  initialText: string;
  flags: AiFlag[];
  selectedId: string | null;
  onFlagClick: (id: string) => void;
}

/**
 * Tiptap-backed document for the /editor page. Owns nothing about
 * scanning or flag generation — those flow in via props. The custom
 * AiFlagExtension paints the flagged ranges as ProseMirror decorations
 * so they survive arbitrary edits.
 */
export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { initialText, flags, selectedId, onFlagClick },
  ref,
) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Paste or write something to scan…",
      }),
      AiFlagExtension.configure({ onFlagClick }),
    ],
    content: textToDoc(initialText),
    editorProps: {
      attributes: {
        class: "editor-prose",
        spellcheck: "false",
      },
    },
  });

  // Push flag updates into the plugin state.
  useEffect(() => {
    if (!editor) return;
    setAiFlags(editor.view, flags);
  }, [editor, flags]);

  useEffect(() => {
    if (!editor) return;
    setSelectedFlag(editor.view, selectedId);
  }, [editor, selectedId]);

  useImperativeHandle(
    ref,
    () => ({
      focusFlag(flag) {
        if (!editor) return;
        const view = editor.view;
        const { state } = view;
        const docSize = state.doc.content.size;
        const from = Math.max(0, Math.min(docSize, flag.from));
        const to = Math.max(from, Math.min(docSize, flag.to));
        editor.commands.setTextSelection({ from, to });
        editor.commands.focus();
        // Scroll the flagged DOM node into view.
        const dom = view.dom.querySelector(`[data-flag-id="${flag.id}"]`);
        if (dom && "scrollIntoView" in dom) {
          (dom as HTMLElement).scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      },
    }),
    [editor],
  );

  return <EditorContent editor={editor} className="editor-content" />;
});

/** Seed Tiptap with a single paragraph per line of incoming plain text. */
function textToDoc(text: string) {
  const trimmed = text ?? "";
  if (trimmed.trim() === "") {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  const paragraphs = trimmed.split(/\n+/).map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content: paragraphs };
}
