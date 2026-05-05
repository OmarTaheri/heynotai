"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { slugify } from "@/lib/collections-slug";
import { createCollection } from "@/lib/collections-create";
import type {
  CollectionTone,
  CollectionPattern,
} from "@/lib/collections-data";

const TONES: { value: CollectionTone; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "human", label: "Human" },
  { value: "ai", label: "AI" },
  { value: "mixed", label: "Mixed" },
  { value: "info", label: "Info" },
  { value: "gold", label: "Gold" },
];

const PATTERNS: { value: CollectionPattern; label: string }[] = [
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "lines", label: "Lines" },
];

const DESC_MAX = 500;

export function NewCollectionModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<CollectionTone>("neutral");
  const [pattern, setPattern] = useState<CollectionPattern>("dots");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    titleInputRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const slugPreview = useMemo(() => slugify(title) || "your-title", [title]);
  const canSubmit = title.trim().length > 0 && !submitting && Boolean(user);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const record = await createCollection({
        userId: user.id,
        title,
        description,
        tone,
        pattern,
      });
      router.push(`/app/collections/${record.slug}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Couldn't create the collection.";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div
      onMouseDown={() => !submitting && onClose()}
      className="auth-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-coll-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card coll-modal-card"
      >
        <header className="coll-modal-head">
          <h2 id="new-coll-title" className="coll-modal-title">
            New collection
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label="Close"
            className="coll-modal-close"
            disabled={submitting}
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="coll-modal-form">
          <div className="coll-modal-row">
            <label htmlFor="coll-title" className="coll-modal-label">
              Title
              <span className="coll-modal-required" aria-hidden>
                *
              </span>
            </label>
            <input
              ref={titleInputRef}
              id="coll-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fall semester essays"
              maxLength={120}
              required
              disabled={submitting}
              className="coll-modal-input"
              autoComplete="off"
            />
            <p className="coll-modal-url-preview">
              <span className="coll-modal-url-host">heynot.ai/c/</span>
              <span className="coll-modal-url-slug">{slugPreview}</span>
            </p>
          </div>

          <div className="coll-modal-row">
            <label htmlFor="coll-desc" className="coll-modal-label">
              Description
            </label>
            <textarea
              id="coll-desc"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value.slice(0, DESC_MAX))
              }
              placeholder="What's in this collection?"
              maxLength={DESC_MAX}
              rows={3}
              disabled={submitting}
              className="coll-modal-textarea"
            />
            <p className="coll-modal-counter">
              {description.length}/{DESC_MAX}
            </p>
          </div>

          <div className="coll-modal-row">
            <span className="coll-modal-label">Cover tone</span>
            <div className="coll-modal-swatches" role="radiogroup" aria-label="Cover tone">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={tone === t.value}
                  aria-label={t.label}
                  className={`coll-modal-swatch coll-tone-${t.value}${
                    tone === t.value ? " is-selected" : ""
                  }`}
                  onClick={() => setTone(t.value)}
                  disabled={submitting}
                >
                  <span className="coll-modal-swatch-fill" aria-hidden />
                </button>
              ))}
            </div>
          </div>

          <div className="coll-modal-row">
            <span className="coll-modal-label">Pattern</span>
            <div className="coll-modal-swatches" role="radiogroup" aria-label="Cover pattern">
              {PATTERNS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={pattern === p.value}
                  aria-label={p.label}
                  className={`coll-modal-swatch coll-modal-swatch-pat coll-tone-${tone} ${
                    pattern === p.value ? "is-selected" : ""
                  }`}
                  onClick={() => setPattern(p.value)}
                  disabled={submitting}
                >
                  <span
                    className={`coll-modal-swatch-fill coll-pat-${p.value}`}
                    aria-hidden
                  />
                  <span className="coll-modal-swatch-label">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="coll-modal-error">{error}</p>}

          <footer className="coll-modal-foot">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="coll-modal-btn coll-modal-btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="coll-modal-btn coll-modal-btn-primary"
            >
              {submitting ? "Creating…" : "Create collection"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
