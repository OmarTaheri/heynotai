/**
 * Imperative driver for the word-by-word scan animation.
 *
 * Given the editor's rendered DOM root, we:
 *   1. Walk every text node inside `<p>` and `<h1>` and wrap individual
 *      words in `<span class="word">…</span>` (whitespace stays as-is).
 *   2. Light up each word span sequentially via the `.scan-active` class.
 *   3. After the sweep finishes, unwrap the spans to restore the original
 *      text nodes — Tiptap is none the wiser because no transaction ran.
 *
 * The wrapper and unwrapper are split out so the React component can run
 * the wrap, animate via setTimeout, and call unwrap on cleanup if the
 * user cancels the scan mid-way.
 */

const WORD_CLASS = "ws-word";

export interface ScanRun {
  /** Total scheduled timeouts so we can clear them on cancel. */
  timers: ReturnType<typeof setTimeout>[];
  /** Restore the DOM to its pre-scan state. */
  cleanup: () => void;
}

export function runWordScan(
  root: HTMLElement,
  durationMs: number,
  onComplete?: () => void,
): ScanRun {
  const wrapped = wrapWords(root);
  const total = wrapped.length || 1;
  const stepDelay = durationMs / total;
  const litWindow = 4;

  const timers: ReturnType<typeof setTimeout>[] = [];

  wrapped.forEach((w, i) => {
    const ignite = setTimeout(() => {
      w.classList.add("scan-active");
    }, i * stepDelay);
    const dim = setTimeout(
      () => {
        w.classList.remove("scan-active");
        w.classList.add("scanned");
      },
      i * stepDelay + stepDelay * litWindow,
    );
    timers.push(ignite, dim);
  });

  const finish = setTimeout(() => {
    onComplete?.();
  }, durationMs + 200);
  timers.push(finish);

  const cleanup = () => {
    timers.forEach((t) => clearTimeout(t));
    unwrapWords(root);
  };

  return { timers, cleanup };
}

function wrapWords(root: HTMLElement): HTMLSpanElement[] {
  const blocks = root.querySelectorAll("p, h1, h2, h3");
  const spans: HTMLSpanElement[] = [];

  blocks.forEach((block) => {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        // Skip text already inside one of our wrappers.
        const parent = node.parentElement;
        if (parent?.classList.contains(WORD_CLASS)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) textNodes.push(n as Text);

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue ?? "";
      const frag = document.createDocumentFragment();
      const parts = text.split(/(\s+)/);
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement("span");
          span.className = WORD_CLASS;
          span.textContent = part;
          frag.appendChild(span);
          spans.push(span);
        }
      });
      textNode.parentNode?.replaceChild(frag, textNode);
    });
  });

  return spans;
}

function unwrapWords(root: HTMLElement): void {
  const wrappers = root.querySelectorAll<HTMLSpanElement>(`span.${WORD_CLASS}`);
  wrappers.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    const text = document.createTextNode(span.textContent ?? "");
    parent.replaceChild(text, span);
  });
  // Coalesce adjacent text nodes back together so future walks don't see
  // many tiny fragments.
  root.normalize?.();
}
