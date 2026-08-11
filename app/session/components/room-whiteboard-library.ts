import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { LibraryItems } from "@excalidraw/excalidraw/types";

function libraryItem(id: string, skeleton: ExcalidrawElementSkeleton[]) {
  return {
    id,
    status: "published" as const,
    elements: convertToExcalidrawElements(skeleton),
    created: Date.now(),
  };
}

/** Shared sticky-note rectangle shape — reused by the library and by any
 * mocked/agent-generated scene so manual and auto-drawn notes look identical. */
export function stickyRectSkeleton(opts: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  background: string;
  stroke: string;
  text: string;
  textColor?: string;
  fontSize?: number;
}): ExcalidrawElementSkeleton {
  return {
    type: "rectangle",
    x: opts.x,
    y: opts.y,
    width: opts.width ?? 220,
    height: opts.height ?? 150,
    backgroundColor: opts.background,
    strokeColor: opts.stroke,
    fillStyle: "solid",
    roundness: { type: 3 },
    label: {
      text: opts.text,
      fontSize: opts.fontSize ?? 16,
      strokeColor: opts.textColor,
    },
  };
}

/** Six Thinking Hats color coding — shared so the library swatches and any
 * mocked/agent-generated hat notes always match. */
export const THINKING_HAT_COLORS = {
  white: { background: "#f1f3f5", stroke: "#adb5bd", text: "#343a40", label: "⚪ Trắng" },
  red: { background: "#ffc9c9", stroke: "#e03131", text: "#5c0d0d", label: "🔴 Đỏ" },
  black: { background: "#495057", stroke: "#212529", text: "#f1f3f5", label: "⚫ Đen" },
  yellow: { background: "#ffe066", stroke: "#f08c00", text: "#5c3d05", label: "🟡 Vàng" },
  green: { background: "#b2f2bb", stroke: "#2f9e44", text: "#0b3d1d", label: "🟢 Xanh lá" },
  blue: { background: "#a5d8ff", stroke: "#1971c2", text: "#0b3050", label: "🔵 Xanh dương" },
} as const;

/**
 * Curated shapes for brainstorm sessions — preloaded so the app never needs
 * the default "browse libraries" flow. Agent-generated notes use the same
 * shapes via the FE mapper, keeping manual and AI-drawn content consistent.
 */
export const BRAINSTORM_LIBRARY_ITEMS: LibraryItems = [
  libraryItem("sticky-note-idea", [
    stickyRectSkeleton({ x: 0, y: 0, background: "#fff3b0", stroke: "#e0b400", text: "Ý tưởng", fontSize: 20 }),
  ]),
  libraryItem("sticky-note-question", [
    stickyRectSkeleton({ x: 0, y: 0, background: "#d0ebff", stroke: "#4dabf7", text: "Câu hỏi?", fontSize: 20 }),
  ]),
  libraryItem("sticky-note-decision", [
    stickyRectSkeleton({ x: 0, y: 0, background: "#d3f9d8", stroke: "#40c057", text: "Quyết định", fontSize: 20 }),
  ]),

  // Six Thinking Hats — one blank sticky per hat, ready to drag onto the board.
  ...Object.entries(THINKING_HAT_COLORS).map(([key, hat]) =>
    libraryItem(`hat-${key}`, [
      stickyRectSkeleton({
        x: 0,
        y: 0,
        background: hat.background,
        stroke: hat.stroke,
        textColor: hat.text,
        text: hat.label,
        fontSize: 20,
      }),
    ])
  ),

  libraryItem("icon-lightbulb", [{ type: "text", x: 0, y: 0, text: "💡", fontSize: 64 }]),
  libraryItem("icon-star", [{ type: "text", x: 0, y: 0, text: "⭐", fontSize: 64 }]),
  libraryItem("icon-flag", [{ type: "text", x: 0, y: 0, text: "🚩", fontSize: 64 }]),

  // One icon per brainstorm technique, for labeling clusters on the board.
  libraryItem("icon-5w1h", [{ type: "text", x: 0, y: 0, text: "🧭", fontSize: 56 }]),
  libraryItem("icon-hmw", [{ type: "text", x: 0, y: 0, text: "💭", fontSize: 56 }]),
  libraryItem("icon-brainwriting", [{ type: "text", x: 0, y: 0, text: "✍️", fontSize: 56 }]),
  libraryItem("icon-scamper", [{ type: "text", x: 0, y: 0, text: "🔄", fontSize: 56 }]),
  libraryItem("icon-crazy8s", [{ type: "text", x: 0, y: 0, text: "⚡", fontSize: 56 }]),
  libraryItem("icon-six-hats", [{ type: "text", x: 0, y: 0, text: "🎩", fontSize: 56 }]),
  libraryItem("icon-role-storming", [{ type: "text", x: 0, y: 0, text: "🎭", fontSize: 56 }]),
  libraryItem("icon-premortem", [{ type: "text", x: 0, y: 0, text: "⚰️", fontSize: 56 }]),
  libraryItem("icon-devils-advocate", [{ type: "text", x: 0, y: 0, text: "😈", fontSize: 56 }]),
  libraryItem("icon-impact-effort", [{ type: "text", x: 0, y: 0, text: "📊", fontSize: 56 }]),
  libraryItem("icon-dot-voting", [{ type: "text", x: 0, y: 0, text: "🔴", fontSize: 56 }]),

  libraryItem("connector-arrow", [{ type: "arrow", x: 0, y: 60, points: [[0, 0], [160, 0]] }]),
];
