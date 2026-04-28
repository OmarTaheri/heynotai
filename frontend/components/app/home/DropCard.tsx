"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/Button";
import { Card } from "@/components/ui/Card";
import { setPendingScan } from "@/lib/scanHandoff";

export type DropMode = "upload" | "paste" | "link" | "record";

const TABS: { value: DropMode; label: string; icon: IconName }[] = [
  { value: "upload", label: "Upload", icon: "upload" },
  { value: "paste", label: "Paste", icon: "paperclip" },
  { value: "link", label: "Link", icon: "link" },
  { value: "record", label: "Record", icon: "mic" },
];

const PLACEHOLDER: Record<DropMode, string> = {
  upload: "Drop a file here, paste text, or enter any link to verify…",
  paste: "Press ⌘V to paste from your clipboard, or type/drop content here…",
  link: "Paste any URL — article, social post, video, or homepage…",
  record: "Hit Record to capture audio or video, or paste content here…",
};

const MAX = 5000;

/**
 * The "Scan something" card on the home page. A textarea-first input
 * with mode tabs (Upload / Paste / Link / Record) and a Verify button
 * at the bottom — same shape as the marketing hero detector card.
 *
 * Tabs swap the placeholder copy so the helper text matches the input
 * method. Real handlers (file pickers, recorders, URL fetches) wire up
 * when the detection backend ships.
 */
export function DropCard() {
  const router = useRouter();
  const [mode, setMode] = useState<DropMode>("upload");
  const [text, setText] = useState("");

  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  const goToEditor = () => {
    setPendingScan(text);
    router.push("/editor");
  };

  return (
    <Card className="home-drop">
      <div className="home-drop-top">
        <div className="home-drop-title">
          What would you like to <em>verify?</em>
        </div>
        <div className="home-drop-help">Drop anywhere</div>
      </div>

      <div className="home-drop-box">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          placeholder={PLACEHOLDER[mode]}
          className="home-drop-textarea"
          aria-label="Content to verify"
        />

        <div className="home-drop-bar">
          <div className="home-drop-tabs" role="tablist" aria-label="Input method">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={mode === tab.value}
                className={`home-drop-tab${mode === tab.value ? " is-active" : ""}`}
                onClick={() => setMode(tab.value)}
              >
                <Icon name={tab.icon} size={12} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="home-drop-meta">
            <span
              className={`home-drop-count${text.length > 0 ? " is-visible" : ""}`}
              aria-hidden={text.length === 0}
            >
              <strong>{wordCount}</strong> word{wordCount === 1 ? "" : "s"} ·{" "}
              <strong>{text.length}</strong>/{MAX}
            </span>
            <Button
              variant="green"
              size="sm"
              leftIcon={<Icon name="check" size={13} />}
              disabled={text.trim() === ""}
              className="home-drop-verify-btn"
              onClick={goToEditor}
            >
              Verify
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
