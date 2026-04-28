import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { AiFlag } from "@/lib/detection-types";

/**
 * Tiptap extension that paints AI-detection flags as ProseMirror inline
 * decorations. Decorations are stored in plugin state (not in the doc),
 * so the document JSON stays clean and the positions auto-remap when
 * the user edits the text.
 */

export interface AiFlagPluginMeta {
  /** Replace the entire flag set. */
  setFlags?: AiFlag[];
  /** Currently-selected flag id, used to render the `.is-selected` style. */
  selected?: string | null;
}

export const aiFlagPluginKey = new PluginKey<{
  flags: AiFlag[];
  selected: string | null;
}>("aiFlag");

export const AiFlagExtension = Extension.create<{
  /** Optional click handler — fired when the user clicks a flagged span. */
  onFlagClick?: (id: string) => void;
}>({
  name: "aiFlag",

  addOptions() {
    return { onFlagClick: undefined };
  },

  addProseMirrorPlugins() {
    const { onFlagClick } = this.options;

    return [
      new Plugin({
        key: aiFlagPluginKey,

        state: {
          init: () => ({ flags: [] as AiFlag[], selected: null as string | null }),
          apply(tr, prev) {
            const meta = tr.getMeta(aiFlagPluginKey) as AiFlagPluginMeta | undefined;
            let next = prev;
            if (meta?.setFlags) next = { ...next, flags: meta.setFlags };
            if (meta && "selected" in meta) {
              next = { ...next, selected: meta.selected ?? null };
            }
            return next;
          },
        },

        props: {
          decorations(state) {
            const pluginState = aiFlagPluginKey.getState(state);
            if (!pluginState) return DecorationSet.empty;
            const { flags, selected } = pluginState;
            if (flags.length === 0) return DecorationSet.empty;

            const docSize = state.doc.content.size;
            const decos: Decoration[] = [];
            for (const f of flags) {
              const from = Math.max(0, Math.min(docSize, f.from));
              const to = Math.max(from, Math.min(docSize, f.to));
              if (to <= from) continue;
              const cls = [
                "ai-flag",
                `ai-flag-${f.kind}`,
                selected === f.id ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              decos.push(
                Decoration.inline(from, to, {
                  class: cls,
                  "data-flag-id": f.id,
                }),
              );
            }
            return DecorationSet.create(state.doc, decos);
          },

          handleClick(view, _pos, event) {
            const target = event.target as HTMLElement | null;
            if (!target) return false;
            const node = target.closest("[data-flag-id]") as HTMLElement | null;
            if (!node) return false;
            const id = node.getAttribute("data-flag-id");
            if (id && onFlagClick) {
              onFlagClick(id);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

/**
 * Helper: dispatch a plugin transaction to update the active flags.
 * Call from a React effect when the scan result changes.
 */
export function setAiFlags(
  view: { state: import("@tiptap/pm/state").EditorState; dispatch: (tr: import("@tiptap/pm/state").Transaction) => void },
  flags: AiFlag[],
) {
  const tr = view.state.tr.setMeta(aiFlagPluginKey, { setFlags: flags } as AiFlagPluginMeta);
  view.dispatch(tr);
}

export function setSelectedFlag(
  view: { state: import("@tiptap/pm/state").EditorState; dispatch: (tr: import("@tiptap/pm/state").Transaction) => void },
  id: string | null,
) {
  const tr = view.state.tr.setMeta(aiFlagPluginKey, { selected: id } as AiFlagPluginMeta);
  view.dispatch(tr);
}
