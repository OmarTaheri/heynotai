import type { ExtensionMessage } from '@/lib/messaging';
import { FRONTEND_URL } from '@/lib/scans-api';
import type { Scan } from '@/lib/scans-api';
import '@/styles/text-overlay.css';

/* Site-agnostic content script that renders a small floating pill near
 * the user's text selection when the right-click "AI check this text"
 * action fires. It owns no scanning logic — the background service
 * worker drives the lifecycle and pushes status updates over
 * chrome.runtime.sendMessage.
 *
 * Kept separate from the YT/IG/FB content.ts because:
 *   - it needs <all_urls> matches, but content.ts intentionally narrows
 *     to the three platforms it auto-scans;
 *   - the platform script's selectors and prefs gating are irrelevant
 *     here, and merging them would risk surprise regressions on the
 *     well-trodden video flow.
 */

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  // Document-end-friendly contexts only — skip frames/PDFs/etc. The
  // selection itself comes from the active document, so anchoring in
  // an iframe would mis-position relative to the top viewport.
  allFrames: false,

  main() {
    const PILL_ID = 'heynotai-text-pill';
    const AUTO_DISMISS_MS = 30_000;

    let anchorRect: DOMRect | null = null;
    let dismissTimer: number | null = null;
    // Cached during the contextmenu event so we still have the rect
    // after Chrome closes the native menu (which clears the visible
    // selection in some sites/themes). Without this, by the time the
    // background SW round-trips back to us with TEXT_SCAN_STARTED,
    // window.getSelection() is often empty.
    let cachedSelectionRect: DOMRect | null = null;
    // When the user explicitly closes the pill while a scan is still
    // running, we suppress the eventual COMPLETE/FAILED messages for
    // that in-flight scan. Reset on the next STARTED.
    let mutedForActiveScan = false;

    document.addEventListener(
      'contextmenu',
      () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        cachedSelectionRect = rect;
        // Hand the SW the *exact* selection string with newlines intact
        // before chrome.contextMenus.onClicked fires. info.selectionText
        // delivered to onClicked normalizes whitespace, which is why
        // pasted bullet lists / paragraphs collapse in the editor.
        const text = sel.toString();
        if (text) {
          chrome.runtime
            .sendMessage({ type: 'TEXT_SELECTION_PRIMED', text })
            .catch(() => {});
        }
      },
      { capture: true },
    );

    chrome.runtime.onMessage.addListener((msg: ExtensionMessage) => {
      switch (msg.type) {
        case 'TEXT_SCAN_STARTED':
          mutedForActiveScan = false;
          captureSelectionRect();
          renderPill('scanning');
          return;
        case 'TEXT_SCAN_COMPLETE':
          if (mutedForActiveScan) return;
          renderPill('result', msg.scan);
          return;
        case 'TEXT_SCAN_FAILED':
          if (mutedForActiveScan) return;
          renderPill('error', undefined, msg.error);
          return;
        case 'TEXT_AI_CHECK_AUTH_REQUIRED':
          captureSelectionRect();
          renderPill('auth');
          return;
        default:
          return;
      }
    });

    function captureSelectionRect() {
      // Prefer the live selection (most up-to-date), but the contextmenu
      // listener above usually wins because it fires before the native
      // menu opens — which is what clears the selection in the first
      // place. Fall back to the cached rect from that listener.
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.width !== 0 || rect.height !== 0) {
          anchorRect = rect;
          return;
        }
      }
      anchorRect = cachedSelectionRect;
    }

    type PillState = 'scanning' | 'result' | 'error' | 'auth';

    function renderPill(
      state: PillState,
      scan?: Scan,
      error?: string,
    ) {
      let pill = document.getElementById(PILL_ID) as HTMLDivElement | null;
      if (!pill) {
        pill = document.createElement('div');
        pill.id = PILL_ID;
        pill.setAttribute('role', 'status');
        pill.setAttribute('aria-live', 'polite');
        document.documentElement.appendChild(pill);
      }

      const stateClass = pillStateClass(state, scan);
      pill.className = `${stateClass}`;

      pill.innerHTML = pillHtml(state, scan, error);
      positionPill(pill);

      // Defer the visible class one frame so the transition runs.
      requestAnimationFrame(() => pill?.classList.add('hn-visible'));

      attachHandlers(pill, state, scan);

      // Auto-dismiss only on terminal states; scanning shouldn't time out
      // here (the background worker enforces that).
      clearDismiss();
      if (state === 'result' || state === 'error' || state === 'auth') {
        dismissTimer = window.setTimeout(() => removePill(), AUTO_DISMISS_MS);
      }
    }

    function pillStateClass(state: PillState, scan?: Scan): string {
      if (state === 'scanning') return 'is-scanning';
      if (state === 'auth') return 'is-auth';
      if (state === 'error') return 'is-error';
      const verdict = scan?.verdict;
      if (verdict === 'human') return 'is-human';
      if (verdict === 'ai') return 'is-ai';
      if (verdict === 'mixed') return 'is-mixed';
      return 'is-error';
    }

    function pillHtml(
      state: PillState,
      scan?: Scan,
      error?: string,
    ): string {
      if (state === 'scanning') {
        return `
          <span class="hn-tp-dot" aria-hidden="true"></span>
          <span class="hn-tp-label">Scanning…</span>
          <button type="button" class="hn-tp-action hn-tp-close" aria-label="Cancel">
            <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        `;
      }
      if (state === 'auth') {
        return `
          <span class="hn-tp-dot" aria-hidden="true"></span>
          <span class="hn-tp-label">Sign in to scan text</span>
          <button type="button" class="hn-tp-action hn-tp-signin">Sign in</button>
          <button type="button" class="hn-tp-action hn-tp-close" aria-label="Dismiss">
            <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        `;
      }
      if (state === 'error') {
        const msg = humanizeError(error);
        return `
          <span class="hn-tp-dot" aria-hidden="true"></span>
          <span class="hn-tp-label">${escapeHtml(msg)}</span>
          <button type="button" class="hn-tp-action hn-tp-close" aria-label="Dismiss">
            <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        `;
      }
      // Result.
      const label = verdictLabel(scan);
      const pct = aiPctLabel(scan);
      const panel = renderPanel(scan);
      return `
        <span class="hn-tp-dot" aria-hidden="true"></span>
        <span class="hn-tp-label">${escapeHtml(label)}</span>
        <span class="hn-tp-pct">${escapeHtml(pct)}</span>
        <button type="button" class="hn-tp-action hn-tp-close" aria-label="Dismiss">
          <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
        ${panel}
      `;
    }

    function renderPanel(scan?: Scan): string {
      if (!scan) return '';
      const editorUrl = `${FRONTEND_URL}/editor/${encodeURIComponent(scan.id)}`;
      const aiPct = clampPct(scan.aiPct);
      const conf = clampPct(scan.confidence);
      const wc = Number.isFinite(scan.wordCount) ? scan.wordCount : 0;
      const model = scan.model || '—';
      return `
        <div class="hn-tp-panel" role="dialog" aria-label="AI check details">
          <div class="hn-tp-panel-title">heynotai · text scan</div>
          <div class="hn-tp-panel-row">
            <span class="hn-tp-k">Verdict</span>
            <span class="hn-tp-v">${escapeHtml(verdictLabel(scan))}</span>
          </div>
          <div class="hn-tp-panel-row">
            <span class="hn-tp-k">AI probability</span>
            <span class="hn-tp-v">${aiPct}%</span>
          </div>
          <div class="hn-tp-panel-row">
            <span class="hn-tp-k">Confidence</span>
            <span class="hn-tp-v">${conf}%</span>
          </div>
          <div class="hn-tp-panel-row">
            <span class="hn-tp-k">Model</span>
            <span class="hn-tp-v">${escapeHtml(model)}</span>
          </div>
          ${
            wc > 0
              ? `<div class="hn-tp-panel-row">
                  <span class="hn-tp-k">Words</span>
                  <span class="hn-tp-v">${wc.toLocaleString()}</span>
                </div>`
              : ''
          }
          <div class="hn-tp-bar" aria-hidden="true">
            <div class="hn-tp-bar-fill" style="width: ${aiPct}%"></div>
          </div>
          <a class="hn-tp-link" href="${editorUrl}" target="_blank" rel="noopener noreferrer">
            Open in editor
            <svg viewBox="0 0 16 16"><path d="M6 3h7v7M13 3l-9 9"/></svg>
          </a>
        </div>
      `;
    }

    function attachHandlers(pill: HTMLDivElement, state: PillState, scan?: Scan) {
      // Click on the pill body toggles the inline panel (only when we
      // have something to show).
      pill.onclick = (ev) => {
        const target = ev.target as HTMLElement;
        if (target.closest('.hn-tp-close')) {
          ev.stopPropagation();
          // If we're closing mid-scan, mute the eventual completion so
          // the result doesn't pop the pill back open uninvited. The
          // scan still finishes server-side and lands in Content tab.
          if (state === 'scanning') mutedForActiveScan = true;
          removePill();
          return;
        }
        if (target.closest('.hn-tp-signin')) {
          ev.stopPropagation();
          chrome.runtime
            .sendMessage({ type: 'OPEN_DRAWER' })
            .catch(() => {});
          // Leave the pill open so the user can re-trigger the scan
          // from the right-click after signing in.
          return;
        }
        if (target.closest('.hn-tp-link')) {
          // Default link behavior takes over (opens in new tab).
          return;
        }
        if (state === 'result' && scan) {
          pill.classList.toggle('is-expanded');
          // Once expanded the user is reading — cancel auto-dismiss.
          if (pill.classList.contains('is-expanded')) clearDismiss();
        }
      };
    }

    function positionPill(pill: HTMLDivElement) {
      // Default: centered horizontally, near top of viewport. Used as
      // a fallback when we couldn't capture a selection rect (e.g. the
      // user dismissed the selection before the menu fired).
      const margin = 12;
      let top = margin + 16;
      let left = (window.innerWidth - 200) / 2;
      let side: 'above' | 'below' = 'below';

      if (anchorRect) {
        const pillHeightEstimate = 40;
        const wantBelow = anchorRect.bottom + 8 + pillHeightEstimate < window.innerHeight - margin;
        side = wantBelow ? 'below' : 'above';
        top = wantBelow
          ? anchorRect.bottom + 8
          : Math.max(margin, anchorRect.top - pillHeightEstimate - 8);
        left = Math.max(
          margin,
          Math.min(
            anchorRect.left,
            window.innerWidth - 320 - margin,
          ),
        );
      }

      pill.dataset.side = side;
      pill.style.top = `${Math.round(top)}px`;
      pill.style.left = `${Math.round(left)}px`;
    }

    function removePill() {
      clearDismiss();
      const pill = document.getElementById(PILL_ID);
      if (!pill) return;
      pill.classList.remove('hn-visible');
      // Match the CSS transition duration so the fade-out plays.
      window.setTimeout(() => pill.remove(), 200);
    }

    function clearDismiss() {
      if (dismissTimer != null) {
        window.clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    }

    function verdictLabel(scan?: Scan): string {
      switch (scan?.verdict) {
        case 'human': return 'Likely human';
        case 'ai': return 'Likely AI';
        case 'mixed': return 'Mixed signals';
        default: return 'Unclear';
      }
    }

    function aiPctLabel(scan?: Scan): string {
      const v = clampPct(scan?.aiPct);
      return `${v}% AI`;
    }

    function clampPct(n: number | undefined | null): number {
      if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(100, Math.round(n)));
    }

    function humanizeError(err: string | undefined): string {
      if (!err) return "Couldn't scan — try again";
      if (err.includes('plan_not_allowed')) return 'Upgrade plan to scan';
      if (err.includes('payload_too_large')) return 'Selection too long';
      if (err.includes('detection_unconfigured')) return 'Detection unavailable';
      if (err.includes('timeout')) return 'Scan timed out';
      if (err.includes('402') || err.includes('insufficient')) return 'Out of scans this month';
      return "Couldn't scan — try again";
    }

    function escapeHtml(s: string): string {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  },
});
