"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/Button";
import { BrowserInstallButton } from "@/components/BrowserInstallButton";
import { Card } from "@/components/ui/Card";
import { createScan, ScanApiError } from "@/lib/scans-api";
import { typeFromMime } from "@/lib/scan-infer";
import { formatBytes } from "@/lib/library-data";
import { addScansToCollection } from "@/lib/collection-items";
import { useAuth } from "@/lib/auth";

export type DropMode = "text" | "upload";

const TABS: { value: DropMode; label: string; icon: IconName }[] = [
  { value: "text", label: "Text", icon: "paperclip" },
  { value: "upload", label: "Upload", icon: "upload" },
];

type SourceId = "website" | "instagram" | "youtube" | "facebook" | "reel";

const SOURCES: { id: SourceId; label: string; icon: IconName }[] = [
  { id: "website", label: "Website", icon: "globe" },
  { id: "instagram", label: "Instagram post", icon: "instagram" },
  { id: "youtube", label: "YouTube video", icon: "youtube" },
  { id: "facebook", label: "Facebook post", icon: "facebook" },
  { id: "reel", label: "Reel / TikTok", icon: "reel" },
];

const PLACEHOLDER: Record<DropMode, string> = {
  text: "Press ⌘V to paste from your clipboard, or type/drop content here…",
  upload: "Drop a file here, or click to choose one…",
};

const MAX = 5000;
const ACCEPT = "text/*,image/*,audio/*,video/*,application/pdf";

/**
 * The "Scan something" card on the home page. Two local input modes
 * (text + upload) live as tabs, alongside a "Link" dropdown of sources
 * that require the browser extension to fetch (Instagram, YouTube,
 * Facebook, Reels, arbitrary websites). Picking one pops a small
 * install prompt instead of switching modes.
 *
 * On Verify, the active local input is POSTed to the API. If
 * `linkCollectionId` is provided the new scan is appended to that
 * collection before the page transitions. The default action is to
 * redirect to `/editor/<id>`; pass `onCreated` to keep the user where
 * they are (e.g. the modal launched from /app/library closes and lets
 * the parent page refresh in place).
 */
export function DropCard({
  linkCollectionId,
  onCreated,
}: {
  /** When set, the freshly created scan is added to this collection
   *  via `addScansToCollection` before the redirect/callback fires. */
  linkCollectionId?: string;
  /** Override the default `/editor/<id>` redirect. Receives the new
   *  scan id so the parent can route, refresh, or simply close a
   *  surrounding modal. */
  onCreated?: (scanId: string) => void;
} = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<DropMode>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [extPrompt, setExtPrompt] = useState<{ label: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isFileMode = mode === "upload";
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const canSubmit = !submitting && (isFileMode ? !!file : text.trim() !== "");

  const reset = () => {
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const switchMode = (next: DropMode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    reset();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!extPrompt) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExtPrompt(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [extPrompt]);

  const onFileChange = (f: File | null) => {
    setError(null);
    setFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isFileMode) return;
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) onFileChange(f);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let scan;
      if (mode === "text") {
        scan = await createScan({
          type: "txt",
          origin: "paste",
          content: text.trim(),
        });
      } else if (file) {
        scan = await createScan({
          type: typeFromMime(file.type),
          origin: "upload",
          file,
        });
      } else {
        return;
      }
      if (linkCollectionId && user) {
        // Best-effort link — if the scan was created we don't want a
        // join-table failure to block the user from seeing the result.
        await addScansToCollection({
          collectionId: linkCollectionId,
          addedBy: user.id,
          scanIds: [scan.id],
        }).catch(() => null);
      }
      if (onCreated) onCreated(scan.id);
      else router.push(`/editor/${scan.id}`);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ScanApiError) {
        if (err.status === 401) {
          setError("Please sign in to save scans.");
          return;
        }
        if (err.status === 413) {
          setError("That file is over the 256MB limit.");
          return;
        }
        if (err.status === 415) {
          setError("That file type isn't supported yet.");
          return;
        }
      }
      setError("Couldn't start the scan — please try again.");
    }
  };

  return (
    <>
      <Card className="home-drop">
        <div className="home-drop-top">
          <div className="home-drop-title">
            What would you like to <em>verify?</em>
          </div>
          <div className="home-drop-help">Drop anywhere</div>
        </div>

        <div
          className="home-drop-box"
          onDragOver={(e) => isFileMode && e.preventDefault()}
          onDrop={onDrop}
        >
          {isFileMode ? (
            <div className="home-drop-filezone">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="home-drop-fileinput"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                aria-label="Choose a file to verify"
              />
              <button
                type="button"
                className="home-drop-filepicker"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <span className="home-drop-filepicker-chosen">
                    <Icon name="check" size={14} />
                    <strong>{file.name}</strong>
                    <span className="home-drop-filepicker-size">{formatBytes(file.size)}</span>
                  </span>
                ) : (
                  <span className="home-drop-filepicker-empty">
                    <Icon name="upload" size={16} />
                    <span>{PLACEHOLDER.upload}</span>
                  </span>
                )}
              </button>
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              placeholder={PLACEHOLDER.text}
              className="home-drop-textarea"
              aria-label="Content to verify"
            />
          )}

          <div className="home-drop-bar">
            <div className="home-drop-tabs" role="tablist" aria-label="Input method">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.value}
                  className={`home-drop-tab${mode === tab.value ? " is-active" : ""}`}
                  onClick={() => switchMode(tab.value)}
                >
                  <Icon name={tab.icon} size={12} />
                  {tab.label}
                </button>
              ))}
              <div className="home-drop-tab-menu" ref={menuRef}>
                <button
                  type="button"
                  className={`home-drop-tab home-drop-tab-trigger${menuOpen ? " is-open" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <Icon name="link" size={12} />
                  Link
                  <Icon name="chevron-down" size={11} />
                </button>
                {menuOpen && (
                  <div className="home-drop-menu" role="menu">
                    {SOURCES.map((src) => (
                      <button
                        key={src.id}
                        type="button"
                        role="menuitem"
                        className="home-drop-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          setExtPrompt({ label: src.label });
                        }}
                      >
                        <Icon name={src.icon} size={14} />
                        <span>{src.label}</span>
                        <Icon name="puzzle" size={11} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="home-drop-meta">
              {error ? (
                <span className="home-drop-error" role="status">
                  {error}
                </span>
              ) : isFileMode ? null : (
                <span
                  className={`home-drop-count${text.length > 0 ? " is-visible" : ""}`}
                  aria-hidden={text.length === 0}
                >
                  <strong>{wordCount}</strong> word{wordCount === 1 ? "" : "s"} ·{" "}
                  <strong>{text.length}</strong>/{MAX}
                </span>
              )}
              <Button
                variant="green"
                size="sm"
                leftIcon={<Icon name="check" size={13} />}
                disabled={!canSubmit}
                className="home-drop-verify-btn"
                onClick={submit}
              >
                {submitting ? "Saving…" : "Verify"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {extPrompt && (
        <ExtensionPrompt
          label={extPrompt.label}
          onClose={() => setExtPrompt(null)}
        />
      )}
    </>
  );
}

function ExtensionPrompt({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  return (
    <div
      className="auth-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ext-prompt-title"
        className="auth-card home-drop-ext-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="home-drop-ext-icon" aria-hidden>
          <Icon name="puzzle" size={22} />
        </div>
        <h3 id="ext-prompt-title" className="home-drop-ext-title">
          Install the extension to scan from <em>{label}</em>
        </h3>
        <p className="home-drop-ext-body">
          Pulling content from {label.toLowerCase()} happens inside your
          browser. Add the heynot.ai extension and you'll be able to verify any
          post, page, or video without leaving the tab.
        </p>
        <div className="home-drop-ext-actions">
          <button
            type="button"
            className="home-drop-ext-cancel"
            onClick={onClose}
          >
            Not now
          </button>
          <BrowserInstallButton href="/#extension" />
        </div>
      </div>
    </div>
  );
}
