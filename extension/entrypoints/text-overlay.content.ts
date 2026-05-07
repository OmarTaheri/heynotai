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
    // Drag state. Once the user has moved the pill we stop snapping it
    // back to the selection on scroll/resize — they put it where they
    // wanted it. `suppressNextClick` keeps a drag from also firing the
    // panel-toggle click that would otherwise follow mouseup.
    let userMovedPill = false;
    let suppressNextClick = false;

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
      // Don't snap back on re-render once the user has dragged — keep
      // the pill where they put it. Position is only set on the very
      // first render in that case (state transitions reuse the node).
      if (!userMovedPill) positionPill(pill);

      // Defer the visible class one frame so the transition runs.
      requestAnimationFrame(() => pill?.classList.add('hn-visible'));

      attachHandlers(pill, state, scan);

      // Reposition on viewport changes so the panel stays glued to the
      // selection and the side keeps making sense if the user resizes.
      bindRepositionListeners();
      bindDragHandler(pill);

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
      const text = (scan.content ?? '').trim();
      const textBlock = text
        ? `<div class="hn-tp-text" aria-label="Scanned text">${escapeHtml(text)}</div>`
        : '';
      return `
        <div class="hn-tp-panel" role="dialog" aria-label="AI check details">
          <div class="hn-tp-panel-title">heynotai · text scan</div>
          ${textBlock}
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
            <span>Open in editor</span>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3l-9 9"/></svg>
          </a>
        </div>
      `;
    }

    function attachHandlers(pill: HTMLDivElement, state: PillState, scan?: Scan) {
      // Click on the pill body toggles the inline panel (only when we
      // have something to show).
      pill.onclick = (ev) => {
        if (suppressNextClick) {
          suppressNextClick = false;
          ev.stopPropagation();
          return;
        }
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
          // Stack height just changed — re-pick above/below so the
          // newly-visible panel doesn't fall off the viewport edge.
          requestAnimationFrame(() => positionPill(pill));
        }
      };
    }

    function positionPill(pill: HTMLDivElement) {
      // Default: centered horizontally, near top of viewport. Used as
      // a fallback when we couldn't capture a selection rect (e.g. the
      // user dismissed the selection before the menu fired).
      const margin = 12;
      const gap = 8;
      const isExpanded = pill.classList.contains('is-expanded');
      const panel = pill.querySelector<HTMLElement>('.hn-tp-panel');

      // Measure live where possible — the rendered panel can be much
      // taller than the pill once the text excerpt lands, so picking
      // the side based on a 40px guess clipped the panel below the fold.
      const pillRect = pill.getBoundingClientRect();
      const pillH = pillRect.height || 40;
      const pillW = pillRect.width || 200;
      const panelH = isExpanded && panel ? panel.getBoundingClientRect().height : 0;

      let top = margin + 16;
      let left = (window.innerWidth - pillW) / 2;
      let side: 'above' | 'below' = 'below';

      if (anchorRect) {
        // Stack height is the pill itself plus the inline panel when
        // expanded. The panel sits on the side opposite the selection,
        // so room-below = anchor.bottom..viewportBottom and similarly
        // for above. When collapsed, panelH is 0 and the math reduces
        // to the original "does the pill fit below" check.
        const stack = pillH + (isExpanded ? panelH + gap : 0);
        const roomBelow = window.innerHeight - margin - anchorRect.bottom - gap;
        const roomAbove = anchorRect.top - margin - gap;
        const fitsBelow = stack <= roomBelow;
        const fitsAbove = stack <= roomAbove;
        // Prefer below; flip up only when below can't fit but above can,
        // or when above simply has more room. Avoids a jittery flip when
        // both sides are tight (we'd rather clip the bottom than yo-yo).
        if (fitsBelow) side = 'below';
        else if (fitsAbove) side = 'above';
        else side = roomBelow >= roomAbove ? 'below' : 'above';

        top = side === 'below'
          ? anchorRect.bottom + gap
          : Math.max(margin, anchorRect.top - pillH - gap);
        // Keep the pill (and the panel that hangs off it) inside the
        // viewport horizontally. Panel max-width is 360 — clamp using
        // the larger of pill / panel widths so neither overflows.
        const widthForClamp = Math.max(pillW, 360);
        left = Math.max(
          margin,
          Math.min(anchorRect.left, window.innerWidth - widthForClamp - margin),
        );
      }

      pill.dataset.side = side;
      pill.style.top = `${Math.round(top)}px`;
      pill.style.left = `${Math.round(left)}px`;
    }

    let scrollListenerBound = false;
    function bindRepositionListeners() {
      if (scrollListenerBound) return;
      scrollListenerBound = true;
      const reflow = () => {
        if (userMovedPill) return;
        const live = document.getElementById(PILL_ID) as HTMLDivElement | null;
        if (!live) return;
        // Anchor rect is captured in viewport coords at scan time and
        // doesn't migrate with the page. Re-query the selection if it
        // is still alive so the pill follows the text on scroll/resize.
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          const r = sel.getRangeAt(0).getBoundingClientRect();
          if (r.width !== 0 || r.height !== 0) anchorRect = r;
        }
        positionPill(live);
      };
      window.addEventListener('resize', reflow);
      window.addEventListener('scroll', reflow, { passive: true, capture: true });
    }

    let dragHandlerBound = false;
    function bindDragHandler(pill: HTMLDivElement) {
      if (dragHandlerBound) return;
      dragHandlerBound = true;
      // Mouse-only for now — touch dragging would need pointer events
      // and isn't worth wiring until a user actually asks for it.
      pill.addEventListener('mousedown', (ev) => {
        // Don't grab drags that started on a real interactive element.
        // The close/sign-in buttons and Open-in-editor link should keep
        // their normal click behavior; the panel body itself is non-
        // interactive but should also not be a drag handle (the user
        // is reading, not relocating).
        const target = ev.target as HTMLElement;
        if (
          target.closest('.hn-tp-action, .hn-tp-link') ||
          target.closest('.hn-tp-panel')
        ) {
          return;
        }
        if (ev.button !== 0) return;

        const startX = ev.clientX;
        const startY = ev.clientY;
        const rect = pill.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;
        let dragging = false;
        const THRESHOLD = 4;

        const onMove = (e: MouseEvent) => {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (!dragging && Math.hypot(dx, dy) < THRESHOLD) return;
          if (!dragging) {
            dragging = true;
            pill.classList.add('is-dragging');
          }
          const margin = 6;
          const w = rect.width;
          const h = pill.getBoundingClientRect().height;
          const newLeft = clamp(startLeft + dx, margin, window.innerWidth - w - margin);
          const newTop = clamp(startTop + dy, margin, window.innerHeight - h - margin);
          pill.style.left = `${Math.round(newLeft)}px`;
          pill.style.top = `${Math.round(newTop)}px`;
          e.preventDefault();
        };

        const onUp = () => {
          document.removeEventListener('mousemove', onMove, true);
          document.removeEventListener('mouseup', onUp, true);
          if (dragging) {
            pill.classList.remove('is-dragging');
            userMovedPill = true;
            // The mouseup will be followed by a synthetic click on the
            // pill — eat it once so dragging doesn't also expand/collapse
            // the panel.
            suppressNextClick = true;
          }
        };

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
      });
    }

    function clamp(v: number, lo: number, hi: number): number {
      return Math.max(lo, Math.min(hi, v));
    }

    function removePill() {
      clearDismiss();
      const pill = document.getElementById(PILL_ID);
      if (!pill) return;
      pill.classList.remove('hn-visible');
      // Match the CSS transition duration so the fade-out plays.
      window.setTimeout(() => pill.remove(), 200);
      // The next scan should re-anchor to the new selection, even if
      // the user dragged the previous pill across the screen.
      userMovedPill = false;
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
