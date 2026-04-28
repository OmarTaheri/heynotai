import { simulateDetection } from '@/lib/detector';
import { pushScan } from '@/lib/storage';
import { sendMessage } from '@/lib/messaging';
import type { ScanDetection, ScanState } from '@/lib/types';
import '@/styles/content.css';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',

  main() {
    // ── State ────────────────────────────────────────────
    let currentVideoId: string | null = null;
    let borderEl: HTMLDivElement | null = null;
    let badgeEl: HTMLDivElement | null = null;
    let panelEl: HTMLDivElement | null = null;
    let panelOpen = false;
    let actionBtnEl: HTMLElement | null = null;

    const badgeLabels: Record<ScanState | 'scanning', string> = {
      scanning: 'Scanning…',
      authentic: 'Authentic',
      suspicious: 'Uncertain',
      'ai-generated': 'AI Detected',
    };

    function getVideoId(): string | null {
      return new URLSearchParams(window.location.search).get('v');
    }

    function getPlayerContainer(): HTMLElement | null {
      return (
        document.querySelector<HTMLElement>('#movie_player') ||
        document.querySelector<HTMLElement>('.html5-video-player') ||
        document.querySelector<HTMLElement>('#player-container-inner')
      );
    }

    function injectOverlay(container: HTMLElement) {
      container.classList.add('hn-video-container-positioned');

      borderEl = document.createElement('div');
      borderEl.id = 'heynotai-border';
      borderEl.className = 'hn-scanning';
      container.appendChild(borderEl);

      badgeEl = document.createElement('div');
      badgeEl.id = 'heynotai-badge';
      badgeEl.className = 'hn-scanning';
      badgeEl.innerHTML = `
        <span class="hn-badge-dot"></span>
        <span class="hn-badge-label">${badgeLabels.scanning}</span>
      `;
      badgeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDetailPanel();
      });
      container.appendChild(badgeEl);
    }

    function updateOverlay(result: ScanDetection) {
      if (!borderEl || !badgeEl) return;
      const stateClass = `hn-${result.state}`;
      borderEl.className = stateClass;
      badgeEl.className = stateClass;
      const label = badgeEl.querySelector<HTMLElement>('.hn-badge-label');
      if (label) label.textContent = badgeLabels[result.state];
      badgeEl.style.animation = 'none';
      void badgeEl.offsetHeight;
      badgeEl.style.animation = '';
    }

    function toggleDetailPanel() {
      if (panelOpen) closeDetailPanel();
      else openDetailPanel();
    }

    function openDetailPanel(_anchorEl?: HTMLElement) {
      const videoId = getVideoId();
      if (!videoId) return;
      const result = simulateDetection(videoId);

      if (badgeEl) badgeEl.style.display = 'none';

      const colorClass =
        result.state === 'authentic' ? 'hn-green' :
        result.state === 'suspicious' ? 'hn-yellow' :
        'hn-red';

      const verdictIcon =
        result.state === 'authentic'
          ? '<svg viewBox="0 0 20 20" fill="none"><path d="M5 10.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : result.state === 'suspicious'
          ? '<svg viewBox="0 0 20 20" fill="none"><path d="M8 7a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2.5 1.5-2.5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14.5" r="1" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 20 20" fill="none"><path d="M10 5.5v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14" r="1" fill="currentColor"/></svg>';

      const backdrop = document.createElement('div');
      backdrop.id = 'heynotai-backdrop';
      backdrop.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDetailPanel();
      });
      document.body.appendChild(backdrop);

      panelEl = document.createElement('div');
      panelEl.id = 'heynotai-detail-panel';
      panelEl.innerHTML = `
        <div class="hn-panel-header">
          <div class="hn-logo-text">
            <svg class="hn-icon" viewBox="0 0 56 56" fill="none"><path d="M28 14C17 14 7.4 21.6 4 28c3.4 6.4 13 14 24 14s20.6-7.6 24-14c-3.4-6.4-13-14-24-14Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28" cy="28" r="7" stroke="currentColor" stroke-width="3.5"/><circle cx="28" cy="28" r="2.5" fill="currentColor"/></svg>
            <span class="hn-logo-word" aria-label="heynotai">
              <span class="hn-logo-hey">hey</span>
              <span class="hn-logo-not"><span class="hn-logo-not-inner">not</span></span>
              <span class="hn-logo-ai">
                <span class="hn-logo-strike" aria-hidden="true"></span>ai
              </span>
            </span>
          </div>
          <button class="hn-panel-close-btn" id="hn-close-panel" aria-label="Close panel">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="hn-panel-body">
          <div class="hn-panel-verdict">
            <div class="hn-verdict-icon ${colorClass}">${verdictIcon}</div>
            <div class="hn-verdict-text">
              <h3>${result.label}</h3>
              <p>${result.sublabel}</p>
            </div>
          </div>
          <div class="hn-trust-section">
            <div class="hn-trust-label">
              <span>Trust Score</span>
              <span class="hn-trust-score-value">${result.trustScore}/100</span>
            </div>
            <div class="hn-trust-bar">
              <div class="hn-trust-bar-fill ${colorClass}" style="width: ${result.trustScore}%"></div>
            </div>
          </div>
          <div class="hn-details-list">
            <div class="hn-detail-row"><span class="hn-detail-label">Detection Type</span><span class="hn-detail-value">${result.detectionType}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Face Analysis</span><span class="hn-detail-value">${result.faceAnalysis}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Audio Sync</span><span class="hn-detail-value">${result.audioSync}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Frame Consistency</span><span class="hn-detail-value">${result.frameConsistency}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Scan Time</span><span class="hn-detail-value">${result.scanTime}s</span></div>
          </div>
        </div>
      `;

      document.body.appendChild(panelEl);
      panelOpen = true;

      const logoWord = panelEl.querySelector<HTMLElement>('.hn-logo-word');
      if (logoWord) {
        setTimeout(() => logoWord.classList.add('is-closed'), 1000);
      }

      panelEl.querySelector('#hn-close-panel')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDetailPanel();
      });

      setTimeout(() => {
        document.addEventListener('keydown', escapeHandler);
      }, 100);
    }

    function closeDetailPanel() {
      const backdrop = document.getElementById('heynotai-backdrop');
      if (backdrop) {
        backdrop.classList.add('hn-closing');
        setTimeout(() => backdrop.remove(), 320);
      }
      if (panelEl) {
        panelEl.classList.add('hn-closing');
        const el = panelEl;
        setTimeout(() => {
          el.remove();
          panelEl = null;
        }, 320);
      }
      panelOpen = false;
      if (badgeEl) badgeEl.style.display = '';
      document.removeEventListener('keydown', escapeHandler);
    }

    function escapeHandler(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelOpen) closeDetailPanel();
    }

    const HN_EYE_SVG = `
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" style="display:inherit;width:100%;height:100%">
        <path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    `;

    function injectActionButton(result: ScanDetection, retries = 0): void {
      if (retries > 10) return;

      if (actionBtnEl) {
        actionBtnEl.remove();
        actionBtnEl = null;
      }

      const container = document.querySelector('#top-level-buttons-computed');
      if (!container) {
        setTimeout(() => injectActionButton(result, retries + 1), 500);
        return;
      }

      actionBtnEl = document.createElement('yt-button-view-model') as HTMLElement;
      actionBtnEl.className = 'ytd-menu-renderer';
      actionBtnEl.id = 'heynotai-action-wrapper';
      actionBtnEl.style.marginLeft = '8px';

      const innerWrap = document.createElement('button-view-model');
      innerWrap.className = 'ytSpecButtonViewModelHost style-scope ytd-menu-renderer';

      const btn = document.createElement('button');
      btn.className =
        'yt-spec-button-shape-next yt-spec-button-shape-next--tonal ' +
        'yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m ' +
        'yt-spec-button-shape-next--icon-leading ' +
        'yt-spec-button-shape-next--enable-backdrop-filter-experiment';
      btn.setAttribute('aria-label', `heynotai trust score: ${result.trustScore}%`);
      btn.innerHTML = `
        <div aria-hidden="true" class="yt-spec-button-shape-next__icon">
          <div style="width:24px;height:24px;display:block">${HN_EYE_SVG}</div>
        </div>
        <div class="yt-spec-button-shape-next__button-text-content">${result.trustScore}%</div>
        <yt-touch-feedback-shape aria-hidden="true" class="yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response">
          <div class="yt-spec-touch-feedback-shape__stroke"></div>
          <div class="yt-spec-touch-feedback-shape__fill"></div>
        </yt-touch-feedback-shape>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panelOpen) closeDetailPanel();
        else openDetailPanel(btn);
      });

      innerWrap.appendChild(btn);
      actionBtnEl.appendChild(innerWrap);
      container.appendChild(actionBtnEl);
    }

    function cleanup() {
      borderEl?.remove(); borderEl = null;
      badgeEl?.remove();  badgeEl = null;
      panelEl?.remove();  panelEl = null; panelOpen = false;
      document.getElementById('heynotai-backdrop')?.remove();
      actionBtnEl?.remove(); actionBtnEl = null;
      document.removeEventListener('keydown', escapeHandler);
    }

    function runScan() {
      const videoId = getVideoId();
      if (!videoId) {
        cleanup();
        currentVideoId = null;
        return;
      }

      if (videoId === currentVideoId && borderEl) return;

      cleanup();
      currentVideoId = videoId;

      const container = getPlayerContainer();
      if (!container) {
        setTimeout(runScan, 500);
        return;
      }

      injectOverlay(container);

      const scanDelay = 1000 + Math.random() * 1000;
      setTimeout(async () => {
        const result = simulateDetection(videoId);
        updateOverlay(result);
        injectActionButton(result);

        if (result.state === 'authentic') {
          setTimeout(() => {
            borderEl?.classList.add('hn-hidden');
            badgeEl?.classList.add('hn-hidden');
          }, 3000);
        }

        const entry = {
          videoId,
          title: document.title.replace(' - YouTube', ''),
          result: result.state,
          trustScore: result.trustScore,
          timestamp: Date.now(),
          url: window.location.href,
        };

        await pushScan(entry);
        sendMessage({ type: 'SCAN_COMPLETE', payload: entry });
      }, scanDelay);
    }

    // Watch for YouTube SPA navigation
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(runScan, 800);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (document.readyState === 'complete') {
      setTimeout(runScan, 1000);
    } else {
      window.addEventListener('load', () => setTimeout(runScan, 1000));
    }

    window.addEventListener('popstate', () => setTimeout(runScan, 800));

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'RESCAN') {
        currentVideoId = null;
        runScan();
      }
    });
  },
});
