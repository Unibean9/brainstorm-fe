"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { motion } from "motion/react";

import { BRAINSTORM_LIBRARY_ITEMS } from "./room-whiteboard-library";
import { WOKKI_DEMO_ELEMENTS } from "./room-whiteboard-mock-scene";

import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  { ssr: false }
);

type RoomWhiteboardProps = {
  onClose: () => void;
};

export function RoomWhiteboard({ onClose }: RoomWhiteboardProps) {
  return (
    <motion.div
      className="fixed inset-0 z-70 flex flex-col"
      style={{ background: "rgba(6, 10, 24, 0.98)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <span className="text-[13px] font-medium tracking-wide text-white/80">
          Whiteboard
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Đóng whiteboard"
        >
          <X className="size-4 stroke-[1.75]" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {/* Preloaded shapes only — no default "browse libraries" flow */}
        <style>{`
          .library-menu-control-buttons { display: none !important; }
        `}</style>
        <Excalidraw
          theme="dark"
          initialData={{
            elements: WOKKI_DEMO_ELEMENTS,
            libraryItems: BRAINSTORM_LIBRARY_ITEMS,
            scrollToContent: true,
          }}
        />
      </div>
    </motion.div>
  );
}
