"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Plus, Square, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import {
  isBrowserSpeechRecognitionSupported,
  startBrowserSpeechRecognition,
  type BrowserSpeechSession,
} from "@/lib/brainstorm/browser-speech-recognition";
import { cn } from "@/lib/utils";
import { roomHudDock } from "./room-immersive-surfaces";

const WAVE_HEIGHTS = [0.4, 0.75, 1, 0.55, 0.85, 0.5] as const;

/** ~5 dòng text-sm — giống các AI chat bar hiện nay */
const TEXTAREA_MAX_PX = 120;
const TEXTAREA_MIN_PX = 24;

const sessionBar =
  "rounded-[1.625rem] border border-white/12 bg-[#0c1228]/92 py-1.5 pl-1.5 pr-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md";

const actionBtn =
  "mb-0.5 grid size-9 shrink-0 place-items-center rounded-full transition-colors sm:size-10";

type RoomChatBarProps = {
  micActive?: boolean;
  micDisabled?: boolean;
  onMicToggle?: () => void;
  onSendText: (text: string) => void;
  onClose: () => void;
  variant?: "session" | "workspace";
  placeholder?: string;
  autoFocus?: boolean;
};

export function RoomChatBar({
  micActive = false,
  micDisabled = false,
  onMicToggle,
  onSendText,
  onClose,
  variant = "workspace",
  placeholder,
  autoFocus = false,
}: RoomChatBarProps) {
  const [value, setValue] = useState("");
  const [dictationActive, setDictationActive] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dictationRef = useRef<BrowserSpeechSession | null>(null);
  const dictationBaseRef = useRef("");
  const isSession = variant === "session";

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, TEXTAREA_MIN_PX), TEXTAREA_MAX_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_PX ? "auto" : "hidden";
  }, []);

  const mergeDictationText = useCallback((base: string, spoken: string) => {
    const chunk = spoken.trim();
    if (!chunk) return base;
    if (!base.trim()) return chunk;
    return `${base.trimEnd()} ${chunk}`;
  }, []);

  const stopDictation = useCallback(async () => {
    const session = dictationRef.current;
    dictationRef.current = null;
    if (!session) {
      setDictationActive(false);
      return;
    }
    try {
      const spoken = await session.stop();
      setValue((prev) => mergeDictationText(dictationBaseRef.current || prev, spoken));
      setDictationError(null);
    } catch (err) {
      setDictationError(err instanceof Error ? err.message : "Nhận giọng nói thất bại");
    } finally {
      setDictationActive(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [mergeDictationText]);

  const startDictation = useCallback(() => {
    if (micDisabled || dictationActive) return;
    if (!isBrowserSpeechRecognitionSupported()) {
      setDictationError("Trình duyệt không hỗ trợ nhận giọng nói");
      return;
    }
    setDictationError(null);
    dictationBaseRef.current = value;
    try {
      dictationRef.current = startBrowserSpeechRecognition({
        onInterim: (interim) => {
          setValue(mergeDictationText(dictationBaseRef.current, interim));
        },
      });
      setDictationActive(true);
    } catch (err) {
      setDictationError(err instanceof Error ? err.message : "Mic failed");
    }
  }, [dictationActive, mergeDictationText, micDisabled, value]);

  const toggleDictation = useCallback(() => {
    if (dictationActive) void stopDictation();
    else startDictation();
  }, [dictationActive, startDictation, stopDictation]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || micDisabled || dictationActive) return;
    onSendText(trimmed);
    setValue("");
  };

  const canSend = value.trim().length > 0 && !micDisabled && !dictationActive;

  const resolvedPlaceholder =
    placeholder ??
    (dictationActive
      ? "Đang nghe… nhấn mic để dừng"
      : micDisabled
        ? "Facilitator đang xử lý…"
        : isSession
          ? "Loại"
          : "Nhắn cho Facilitator…");

  useEffect(() => {
    syncTextareaHeight();
  }, [value, syncTextareaHeight]);

  useEffect(() => {
    if (!autoFocus || dictationActive) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 280);
    return () => window.clearTimeout(id);
  }, [autoFocus, dictationActive]);

  useEffect(() => {
    return () => {
      dictationRef.current?.abort();
      dictationRef.current = null;
    };
  }, []);

  const handleClose = () => {
    dictationRef.current?.abort();
    dictationRef.current = null;
    setDictationActive(false);
    onClose();
  };

  if (micActive && !isSession) {
    return (
      <div className={cn("flex items-center gap-3 px-4 py-2.5", roomHudDock)}>
        <ListeningWave />
        <p className="flex-1 text-sm font-medium text-[#fbbf24]">Đang nghe… nhấn để dừng</p>
        <button
          type="button"
          onClick={onMicToggle}
          aria-label="Dừng ghi âm và gửi"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ea580c] text-white shadow-[0_0_24px_-6px_rgba(234,88,12,0.7)] transition-transform hover:scale-105"
        >
          <Square className="size-3.5 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-end gap-1",
        isSession ? sessionBar : cn("gap-1 rounded-[1.625rem] py-1.5 pr-1.5 pl-1.5", roomHudDock)
      )}
    >
      <button
        type="button"
        aria-label="Thêm"
        className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/8 hover:text-white/75"
      >
        <Plus className="size-4.5 stroke-[1.75]" />
      </button>

      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        onChange={(e) => {
          if (dictationActive) return;
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        disabled={micDisabled || dictationActive}
        readOnly={dictationActive}
        autoFocus={autoFocus}
        placeholder={resolvedPlaceholder}
        aria-label="Nhắn tin"
        className="no-scrollbar max-h-[7.5rem] min-h-6 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-white/42 disabled:opacity-50 [&::-webkit-scrollbar]:hidden"
      />

      <div className="mb-0.5 flex shrink-0 items-end gap-2 sm:gap-2.5">
        {isSession ? (
          <>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Gửi tin nhắn"
              className={cn(
                actionBtn,
                canSend
                  ? "bg-cyan-300 text-[#060a14] hover:bg-cyan-200"
                  : "bg-white/10 text-white/35 disabled:pointer-events-none"
              )}
            >
              <ArrowUp className="size-4 stroke-[2.25] sm:size-4.5" />
            </button>

            <button
              type="button"
              onClick={toggleDictation}
              disabled={micDisabled}
              aria-label={dictationActive ? "Dừng dictation" : "Nhập bằng giọng nói"}
              aria-pressed={dictationActive}
              className={cn(
                actionBtn,
                dictationActive
                  ? "border border-white/20 bg-white/14 text-[#f5d76e] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "bg-white/10 text-white/75 hover:bg-white/14 hover:text-white disabled:pointer-events-none disabled:opacity-40"
              )}
            >
              <Mic className="size-4 stroke-[1.75] sm:size-4.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onMicToggle}
            disabled={micDisabled || !onMicToggle}
            aria-label="Chuyển sang voice"
            className={cn(actionBtn, "bg-white/10 text-white/75 hover:bg-white/14 hover:text-white disabled:pointer-events-none disabled:opacity-40")}
          >
            <Mic className="size-4.5 stroke-[1.75]" />
          </button>
        )}

        <button
          type="button"
          onClick={handleClose}
          aria-label={isSession ? "Đóng chat, quay về voice" : "Kết thúc phiên"}
          className={cn(actionBtn, "bg-white text-[#060a14] transition-transform hover:scale-105")}
        >
          <X className="size-4 stroke-[2.5] sm:size-4.5" />
        </button>
      </div>

      {dictationError ? (
        <p className="sr-only" role="status">
          {dictationError}
        </p>
      ) : null}
    </div>
  );
}

function ListeningWave() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex h-6 shrink-0 items-center gap-0.75" aria-hidden>
      {WAVE_HEIGHTS.map((height, index) => (
        <motion.span
          key={index}
          className="w-0.75 rounded-full bg-[#22d3ee]"
          animate={
            reduceMotion
              ? { height: 6 + height * 8, opacity: 0.85 }
              : { height: [5, 5 + height * 16, 5], opacity: [0.55, 1, 0.55] }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: 0.48 + index * 0.06,
                  repeat: Infinity,
                  ease: [0.37, 0, 0.63, 1],
                  delay: index * 0.05,
                }
          }
        />
      ))}
    </div>
  );
}
