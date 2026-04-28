"use client";

/**
 * Translucent overlay rendered on top of the editor scroll container
 * while a scan is in progress. Two layers:
 *   - .editor-scan-haze   — soft pulsing tint over the whole document
 *   - .editor-scan-bar    — thin bright line that sweeps top→bottom
 *
 * Animations live in /app/editor/editor.css.
 */
export function EditorScanOverlay() {
  return (
    <div className="editor-scan-overlay" aria-hidden>
      <div className="editor-scan-haze" />
      <div className="editor-scan-bar" />
    </div>
  );
}
