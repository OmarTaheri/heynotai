import type { ExtensionMessage } from '@/lib/messaging';
import type { ScanState } from '@/lib/types';
import { getPinnedTabs, setPinnedTab } from '@/lib/storage';

export default defineBackground(() => {
  const badgeConfig: Record<ScanState, { text: string; color: string }> = {
    authentic:      { text: '✓', color: '#16a34a' },
    suspicious:     { text: '?', color: '#d97706' },
    'ai-generated': { text: '!', color: '#dc2626' },
  };

  function isInjectableUrl(url: string | undefined): boolean {
    if (!url) return false;
    return !(
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:')
    );
  }

  async function injectDrawer(tabId: number, fromAutoReopen: boolean) {
    const popupUrl = chrome.runtime.getURL('drawer.html');
    const pinned = await getPinnedTabs();
    const initialPinned = pinned[tabId] === true;
    const { appliedTheme } = await chrome.storage.local.get('appliedTheme');
    const theme: 'light' | 'dark' = appliedTheme === 'dark' ? 'dark' : 'light';
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [popupUrl, tabId, initialPinned, fromAutoReopen, theme],
        func: toggleHeynotaiDrawer,
      });
    } catch {
      // Chrome blocks injection on error pages, chrome://, web store, etc.
      // Nothing actionable — fail silently.
    }
  }

  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !isInjectableUrl(tab.url)) return;
    injectDrawer(tab.id, false);
  });

  chrome.runtime.onMessage.addListener((msg: ExtensionMessage, sender) => {
    if (msg.type === 'SCAN_COMPLETE' && sender.tab?.id != null) {
      const cfg = badgeConfig[msg.payload.result] ?? badgeConfig.authentic;
      const tabId = sender.tab.id;
      chrome.action.setBadgeText({ text: cfg.text, tabId });
      chrome.action.setBadgeBackgroundColor({ color: cfg.color, tabId });
      chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
    }
    if (msg.type === 'PIN_STATE') {
      setPinnedTab(msg.tabId, msg.pinned);
    }
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && !changeInfo.url.includes('youtube.com/watch')) {
      chrome.action.setBadgeText({ text: '', tabId });
    }
    if (changeInfo.status !== 'complete') return;
    if (!isInjectableUrl(tab.url)) return;
    const pinned = await getPinnedTabs();
    if (pinned[tabId]) injectDrawer(tabId, true);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    setPinnedTab(tabId, false);
  });
});

/* ── Drawer toggle (host-page injection) ─────────────────────────
   Builds the floating drawer + a small vertical control rail beside it.
   Rail buttons (top → bottom): close, pin, refresh, dock-side.
   - Close   → slide-out + remove + unpin.
   - Pin     → toggles a "pinned" flag (persisted via PIN_STATE message).
   - Refresh → reloads the iframe.
   - Dock    → swaps the drawer between the left and right edges of
               the viewport via a single transform value driven from
               --hn-x; the rail's own side flips automatically.

   Arguments (passed via chrome.scripting.executeScript args):
   - popupUrl:       URL of the drawer HTML
   - tabId:          the tab this drawer lives on (for pin persistence)
   - initialPinned:  whether the pin button should start active
   - fromAutoReopen: true when injected because the tab was pinned on
                     load — in that case, don't toggle-close an existing
                     drawer, just early-return. */
function toggleHeynotaiDrawer(
  popupUrl: string,
  tabId: number,
  initialPinned: boolean,
  fromAutoReopen: boolean,
  initialTheme: 'light' | 'dark',
) {
  const ROOT_ID = 'heynotai-drawer-root';
  const STYLE_ID = 'heynotai-drawer-style';
  const existing = document.getElementById(ROOT_ID);

  const closeNow = (el: HTMLElement) => {
    const side = el.dataset.side === 'left' ? 'left' : 'right';
    el.style.transform = side === 'right' ? 'translateX(100vw)' : 'translateX(-100%)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  };

  if (existing) {
    if (fromAutoReopen) return;
    closeNow(existing);
    return;
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        top: 0;
        left: 0;
        width: min(440px, 92vw);
        height: 100vh;
        z-index: 2147483647;
        background: #f3f0e8;
        opacity: 0;
        transform: translateX(100vw);
        transition:
          transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
          opacity   0.4s ease;
        will-change: transform, opacity;
      }
      #${ROOT_ID}[data-theme="dark"] { background: #0f1013; }
      #${ROOT_ID}[data-side="right"] {
        border-left: 1px solid rgba(0,0,0,0.12);
        box-shadow: -24px 0 60px rgba(0,0,0,0.32),
                    -6px 0 14px rgba(0,0,0,0.18);
      }
      #${ROOT_ID}[data-side="left"] {
        border-right: 1px solid rgba(0,0,0,0.12);
        box-shadow: 24px 0 60px rgba(0,0,0,0.32),
                    6px 0 14px rgba(0,0,0,0.18);
      }
      #${ROOT_ID} > iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: transparent;
      }

      /* Vertical control rail — matches the extension's .icon-btn design
         language (warm neutrals, 28×28 buttons, 7px radius, 14px icons). */
      #${ROOT_ID} .hn-rail {
        position: absolute;
        top: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        width: 36px;
        padding: 4px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow:
          0 20px 60px rgba(20,18,10,0.18),
          0 2px 6px rgba(20,18,10,0.06),
          0 0 0 1px rgba(26,25,22,0.09);
        z-index: 1;
      }
      #${ROOT_ID}[data-side="right"] .hn-rail { left: -44px; }
      #${ROOT_ID}[data-side="left"]  .hn-rail { right: -44px; }

      #${ROOT_ID} .hn-rail button {
        appearance: none;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 0;
        border-radius: 7px;
        color: #5b5749;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
        padding: 0;
      }
      #${ROOT_ID} .hn-rail button:hover,
      #${ROOT_ID} .hn-rail button.is-active {
        background: #f1ede4;
        color: #1a1916;
      }
      #${ROOT_ID} .hn-rail svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
        transition: transform 0.18s ease;
      }
      #${ROOT_ID} .hn-rail button[data-action="pin"].is-active svg {
        transform: rotate(-20deg);
        fill: currentColor;
        stroke: none;
      }

      #${ROOT_ID}[data-theme="dark"] .hn-rail {
        background: #17191e;
        box-shadow:
          0 20px 60px rgba(0,0,0,0.55),
          0 0 0 1px rgba(255,255,255,0.07);
      }
      #${ROOT_ID}[data-theme="dark"] .hn-rail button { color: #a5a39a; }
      #${ROOT_ID}[data-theme="dark"] .hn-rail button:hover,
      #${ROOT_ID}[data-theme="dark"] .hn-rail button.is-active {
        background: #0b0c0f;
        color: #ecebe5;
      }

      @media (prefers-reduced-motion: reduce) {
        #${ROOT_ID} { transition-duration: 0.01ms !important; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  // ── Build the drawer + rail ──
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.dataset.side = 'right';
  root.dataset.theme = initialTheme;
  root.style.setProperty('--hn-x', '100vw'); // start off-screen right

  const iframe = document.createElement('iframe');
  iframe.src = popupUrl;
  iframe.setAttribute('allow', 'clipboard-write');
  root.appendChild(iframe);

  // Rail with the four control buttons. SVG paths are inline so the
  // injected drawer doesn't need any external icon font.
  const rail = document.createElement('div');
  rail.className = 'hn-rail';
  rail.innerHTML = `
    <button type="button" data-action="close" title="Close" aria-label="Close">
      <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <button type="button" data-action="pin" title="Pin" aria-label="Pin">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 17v5"/>
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
      </svg>
    </button>
    <button type="button" data-action="refresh" title="Refresh" aria-label="Refresh">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M21 3v5h-5"/>
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        <path d="M3 21v-5h5"/>
      </svg>
    </button>
    <button type="button" data-action="dock" title="Dock to other side" aria-label="Dock to other side">
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <path d="M14 4v16"/>
      </svg>
    </button>
  `;
  root.appendChild(rail);

  if (initialPinned) {
    root.toggleAttribute('data-pinned', true);
    const pinBtn = rail.querySelector<HTMLButtonElement>('button[data-action="pin"]');
    pinBtn?.classList.add('is-active');
  }

  document.documentElement.appendChild(root);

  // Slide in: flip --hn-x on next frame so the transition catches.
  requestAnimationFrame(() => {
    root.style.setProperty('--hn-x', 'calc(100vw - 100%)'); // dock right
    root.style.opacity = '1';
  });

  const sendPinState = (pinned: boolean) => {
    try {
      chrome.runtime.sendMessage({ type: 'PIN_STATE', tabId, pinned });
    } catch {}
  };

  // ── Rail button handlers ──
  rail.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'close') {
      sendPinState(false);
      closeNow(root);
      cleanup();
      return;
    }

    if (action === 'pin') {
      const nowPinned = !root.hasAttribute('data-pinned');
      btn.classList.toggle('is-active', nowPinned);
      root.toggleAttribute('data-pinned', nowPinned);
      sendPinState(nowPinned);
      return;
    }

    if (action === 'refresh') {
      // Re-assigning .src forces a reload even if same URL.
      iframe.src = iframe.src;
      // Brief flash on the button so the action feels acknowledged.
      btn.classList.add('is-active');
      setTimeout(() => btn.classList.remove('is-active'), 350);
      return;
    }

    if (action === 'dock') {
      const next = root.dataset.side === 'right' ? 'left' : 'right';
      root.dataset.side = next;
      // For left: x = 0; for right: x = (100vw - drawer width)
      root.style.setProperty(
        '--hn-x',
        next === 'right' ? 'calc(100vw - 100%)' : '0px',
      );
      btn.classList.toggle('is-active', next === 'left');
      return;
    }
  });

  // ── Iframe → parent message bridge ──
  const onMessage = (ev: MessageEvent) => {
    if (ev.data === 'heynotai:close-drawer') {
      const el = document.getElementById(ROOT_ID);
      if (el) closeNow(el as HTMLElement);
      sendPinState(false);
      cleanup();
      return;
    }
    if (ev.data && typeof ev.data === 'object' && ev.data.type === 'heynotai:theme') {
      const next = ev.data.theme === 'dark' ? 'dark' : 'light';
      root.dataset.theme = next;
    }
  };
  const cleanup = () => window.removeEventListener('message', onMessage);
  window.addEventListener('message', onMessage);
}
