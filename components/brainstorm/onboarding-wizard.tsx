"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, Check, ChevronRight, Loader2, Plus } from "lucide-react";

import { PHASES } from "@/app/session/components/room-phase-rail";
import { EngineAmbientBg } from "@/components/brainstorm/engine-ambient-bg";
import { EngineCard } from "@/components/brainstorm/engine-card";
import { Input } from "@/components/ui/input";
import { teachersApi } from "@/lib/api/services/teachers";
import { roomsApi } from "@/lib/api/services/rooms";
import { voicesApi } from "@/lib/api/services/voices";
import { runtimeProvidersApi } from "@/lib/api/services/runtimeProviders";
import { languagesApi } from "@/lib/api/services/languages";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import {
  clearStoredTeacher,
  writeStoredTeacher,
  type StoredTeacher,
} from "@/lib/brainstorm/teacher-storage";
import { useStoredTeacher } from "@/hooks/useStoredTeacher";
import { parseAxiosApiError } from "@/lib/brainstorm/parse-api-error";
import { navigateWithTransition } from "@/lib/motion/navigate-with-transition";
import { formatRelativeTime } from "@/lib/utils/formatDate";
import { cn } from "@/lib/utils";
import type {
  RuntimeProvider,
  BrainstormLanguage,
  Room,
  RoomSessionSummary,
  TeacherDirectoryEntry,
} from "@/types/brainstorm-domain";

type WizardStep = 1 | 2 | 3;

const STEP_META: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Giáo viên" },
  { id: 2, label: "Room" },
  { id: 3, label: "Session" },
];

const FIELD_ERROR_COPY: Record<string, string> = {
  invalid_code: "Mã giáo viên không hợp lệ (tối đa 64 ký tự).",
  invalid_name: "Tên chưa hợp lệ.",
  invalid_teacher: "Có trường dữ liệu không hợp lệ.",
  invalid_room: "Dữ liệu room không hợp lệ.",
  room_not_found: "Room này không còn tồn tại.",
  facilitator_start_failed:
    "Runtime provider của room chưa khởi động được. Provider được ghim ở room — không tự chuyển provider; hãy thử lại hoặc kiểm tra CLI/auth.",
  invalid_brief: "Brief chưa đúng định dạng — kiểm tra lại các trường đã nhập.",
};

function formatSessionStartError(error: unknown): string {
  const apiErr = parseAxiosApiError(error);
  if (apiErr.code && FIELD_ERROR_COPY[apiErr.code]) return FIELD_ERROR_COPY[apiErr.code];
  if (apiErr.isTimeout || apiErr.isNetworkError) {
    return "Kết nối tới runtime bị gián đoạn. Bạn có thể thử lại mà không mất chủ đề.";
  }
  return "Chưa thể khởi động session. Kiểm tra CLI/auth của provider rồi thử lại.";
}

const FALLBACK_RUNTIME_PROVIDERS: { providerId: RuntimeProvider; label: string }[] = [
  { providerId: "claude", label: "Claude" },
  { providerId: "codex", label: "Codex" },
];

const FALLBACK_LANGUAGES: { languageId: BrainstormLanguage; label: string }[] = [
  { languageId: "vi", label: "Tiếng Việt" },
  { languageId: "en", label: "English" },
];

// Backend currently exposes these three stable voice ids. Keep this UI-only
// compatibility map while the public voice endpoint remains language-agnostic.
const VOICE_LANGUAGE: Record<string, BrainstormLanguage> = {
  "vi-female-01": "vi",
  "vi-male-01": "vi",
  "en-male-01": "en",
};

const PHASE_LABEL: Record<string, string> = Object.fromEntries(
  PHASES.map((phase) => [phase.key, phase.label])
);

const PROVIDER_LABEL: Record<RuntimeProvider, string> = { claude: "Claude", codex: "Codex" };

type RoomStyle = "guided" | "supportive";

const ROOM_STYLE_OPTIONS: { value: RoomStyle; label: string }[] = [
  { value: "guided", label: "Chuyên sâu" },
  { value: "supportive", label: "Nhanh" },
];

const ROOM_STYLE_HINT: Record<RoomStyle, string> = {
  guided: "AI dẫn dắt bằng câu hỏi, không giới hạn số lượt.",
  supportive:
    "AI chủ động gợi ý và tự điền chỗ trống, tổng kết rồi tự đóng session sau khoảng 6 lượt.",
};

function roomProvider(room: Pick<Room, "runtimeProvider" | "agent"> | null): RuntimeProvider {
  return room?.runtimeProvider ?? room?.agent ?? "claude";
}

/** "Cô Lan (Ngữ văn)" → "L": initial of the given name, ignoring honorific and notes. */
function teacherInitial(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return (words[words.length - 1]?.[0] ?? "?").toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

const inputClass = cn(
  "h-10 rounded-md border-white/12 bg-[#07111f] px-3 text-sm text-[#e0f2fe] md:text-sm",
  "placeholder:text-white/40 dark:bg-[#07111f]",
  "focus-visible:border-[#67e8f9]/70 focus-visible:ring-2 focus-visible:ring-[#67e8f9]/25"
);

function PrimaryButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-[#22d3ee]/55 bg-[#22d3ee]/15 px-4",
        "text-sm font-semibold text-[#e0f2fe] shadow-[0_0_18px_-6px_rgba(34,211,238,0.6)]",
        "transition-colors duration-150 hover:bg-[#22d3ee]/25",
        "outline-none focus-visible:ring-2 focus-visible:ring-[#67e8f9]/60",
        "disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

function GhostButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-white/70",
        "transition-colors duration-150 hover:bg-white/[0.06] hover:text-white",
        "outline-none focus-visible:ring-2 focus-visible:ring-[#67e8f9]/60",
        className
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div className="flex flex-col gap-1.5">
      <LabelTag htmlFor={htmlFor} className="text-[13px] font-medium text-white/85">
        {label}
      </LabelTag>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-white/55">{hint}</p> : null}
    </div>
  );
}

/** Native radios styled as a segmented control — keyboard arrows and form semantics for free. */
function Segmented<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-md border border-white/12 bg-[#07111f] p-1"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex h-8 flex-1 cursor-pointer items-center justify-center rounded px-3 text-sm font-medium",
            "text-white/60 transition-colors duration-150 hover:text-white/90",
            "has-[:checked]:bg-[#22d3ee]/15 has-[:checked]:text-[#e0f2fe]",
            "has-[:checked]:shadow-[inset_0_0_0_1px_rgba(103,232,249,0.35)]",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#67e8f9]/60"
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

function Stepper({
  step,
  values,
  onJump,
}: {
  step: WizardStep;
  values: Partial<Record<WizardStep, string>>;
  onJump: (target: WizardStep) => void;
}) {
  return (
    <nav aria-label="Các bước bắt đầu" className="border-b border-white/[0.08] px-3 py-2.5 sm:px-4">
      <ol className="flex min-h-9 items-center gap-1">
        {STEP_META.map((s, index) => {
          const status = s.id < step ? "done" : s.id === step ? "active" : "upcoming";
          const value = status === "done" ? values[s.id] : undefined;
          const marker = (
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                status === "done" && "bg-[#22d3ee]/15 text-[#67e8f9]",
                status === "active" && "bg-[#67e8f9] text-[#041018]",
                status === "upcoming" && "border border-white/20 text-white/45"
              )}
            >
              {status === "done" ? <Check className="size-3" strokeWidth={3} aria-hidden /> : s.id}
            </span>
          );
          const text = (
            <span className="flex min-w-0 flex-col text-left leading-tight">
              {value ? (
                <>
                  <span className="text-[11px] text-white/50">{s.label}</span>
                  <span className="truncate text-[13px] font-medium text-white/90">{value}</span>
                </>
              ) : (
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    status === "active" ? "text-white" : "text-white/45"
                  )}
                >
                  {s.label}
                </span>
              )}
            </span>
          );

          return (
            <li
              key={s.id}
              className={cn("flex min-w-0 items-center gap-1", value && "flex-1 sm:flex-none")}
              aria-current={status === "active" ? "step" : undefined}
            >
              {index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 text-white/25" aria-hidden />
              ) : null}
              {status === "done" ? (
                <button
                  type="button"
                  onClick={() => onJump(s.id)}
                  title={`Đổi ${s.label.toLowerCase()}`}
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 outline-none transition-colors duration-150 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-[#67e8f9]/60"
                >
                  {marker}
                  {text}
                </button>
              ) : (
                <span className="flex min-w-0 items-center gap-2 px-2 py-1">
                  {marker}
                  {text}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepHeader({
  title,
  hint,
  action,
  headingRef,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold tracking-tight text-white outline-none"
        >
          {title}
        </h2>
        {hint ? <p className="mt-1 text-sm leading-relaxed text-white/65">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function NewButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[13px] font-medium text-white/80",
        "transition-colors duration-150 hover:border-[#67e8f9]/50 hover:text-[#e0f2fe]",
        "outline-none focus-visible:ring-2 focus-visible:ring-[#67e8f9]/60"
      )}
    >
      <Plus className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}

/** Inline create form. Rendered above the list so it sits right under the button that opened it. */
function Composer({
  open,
  onSubmit,
  children,
}: {
  open: boolean;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.form
          key="composer"
          onSubmit={onSubmit}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.25, 1, 0.5, 1] }}
          className="mb-4 flex flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-4"
        >
          {children}
        </motion.form>
      ) : null}
    </AnimatePresence>
  );
}

function ComposerActions({
  pending,
  submitLabel,
  pendingLabel,
  onCancel,
  aside,
}: {
  pending: boolean;
  submitLabel: string;
  pendingLabel?: string;
  onCancel?: () => void;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
      {aside ? <p className="text-xs text-white/55 sm:mr-auto">{aside}</p> : null}
      <div className="flex items-center justify-end gap-2 sm:ml-auto">
        {onCancel ? <GhostButton onClick={onCancel}>Huỷ</GhostButton> : null}
        <PrimaryButton pending={pending} pendingLabel={pendingLabel}>
          {submitLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ItemList({ children }: { children: ReactNode }) {
  return (
    <ul role="list" className="-mx-2 flex max-h-[min(22rem,48vh)] flex-col overflow-y-auto">
      {children}
    </ul>
  );
}

function ItemRow({
  leading,
  title,
  meta,
  trailing,
  onClick,
  pending,
  disabled,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={pending || undefined}
        className={cn(
          "group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left",
          "outline-none transition-colors duration-150 hover:bg-white/[0.05]",
          "focus-visible:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#67e8f9]/50",
          "disabled:cursor-default disabled:hover:bg-transparent"
        )}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-white">{title}</span>
          {meta ? <span className="mt-0.5 block truncate text-[13px] text-white/60">{meta}</span> : null}
        </span>
        {trailing}
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-[#67e8f9]" aria-hidden />
        ) : (
          <ChevronRight
            className="size-4 shrink-0 text-white/30 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-white/70"
            aria-hidden
          />
        )}
      </button>
    </li>
  );
}

function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "live" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
        tone === "live" ? "bg-[#22c55e]/12 text-[#86efac]" : "bg-white/[0.06] text-white/70"
      )}
    >
      {children}
    </span>
  );
}

function ListSkeleton({ leading = true }: { leading?: boolean }) {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Đang tải">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          {leading ? <div className="size-8 animate-pulse rounded-full bg-white/[0.07]" /> : null}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2.5 text-sm text-white/70">
      <span>Không tải được danh sách. Kiểm tra backend đang chạy.</span>
      <GhostButton onClick={onRetry} className="h-8 text-[#a5f3fc]">
        Thử lại
      </GhostButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

export function OnboardingWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const teacher = useStoredTeacher();

  // step chưa từng set thủ công (null) → suy ra từ teacher đã nhớ, không cần effect.
  // Tránh setState-in-effect: useSyncExternalStore (useStoredTeacher) tự xử lý đồng bộ
  // hydration, nên step tính lại đúng ngay trong render đầu tiên trên client.
  const [manualStep, setManualStep] = useState<WizardStep | null>(null);
  const step: WizardStep = manualStep ?? (teacher ? 2 : 1);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [teacherComposerOpen, setTeacherComposerOpen] = useState(false);
  const [roomComposerOpen, setRoomComposerOpen] = useState(false);
  const [sessionComposerOpen, setSessionComposerOpen] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [sessionTopic, setSessionTopic] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedRuntimeProvider, setSelectedRuntimeProvider] = useState<RuntimeProvider>("codex");
  // null = not touched yet → follow the backend's env default.
  const [selectedRoomStyle, setSelectedRoomStyle] = useState<RoomStyle | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<BrainstormLanguage>("vi");
  const [stepError, setStepError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const teacherInputRef = useRef<HTMLInputElement>(null);
  const roomInputRef = useRef<HTMLInputElement>(null);
  const sessionInputRef = useRef<HTMLInputElement>(null);

  const teachersQuery = useQuery({
    queryKey: ["brainstorm", "teachers"],
    queryFn: teachersApi.list,
    enabled: step === 1 && !teacher,
    staleTime: 15_000,
  });

  const roomsQuery = useQuery({
    queryKey: brainstormKeys.rooms(),
    queryFn: roomsApi.list,
    enabled: step === 2,
    staleTime: 15_000,
  });

  const runtimeProvidersQuery = useQuery({
    queryKey: brainstormKeys.runtimeProviders(),
    queryFn: runtimeProvidersApi.list,
    enabled: step === 2,
    staleTime: Infinity,
  });

  const sessionsQuery = useQuery({
    queryKey: brainstormKeys.roomSessions(selectedRoom?.roomId ?? "pending"),
    queryFn: () => roomsApi.listSessions(selectedRoom!.roomId),
    enabled: step === 3 && Boolean(selectedRoom),
    staleTime: 5_000,
  });

  const voicesQuery = useQuery({
    queryKey: brainstormKeys.voices(),
    queryFn: voicesApi.list,
    enabled: step === 3,
    staleTime: Infinity,
  });

  const languagesQuery = useQuery({
    queryKey: brainstormKeys.languages(),
    queryFn: languagesApi.list,
    enabled: step === 3,
    staleTime: Infinity,
  });

  const roomDefaultsQuery = useQuery({
    queryKey: brainstormKeys.roomDefaults(),
    queryFn: roomsApi.defaults,
    enabled: step === 2,
    staleTime: 60_000,
  });

  const runtimeProviderOptions = runtimeProvidersQuery.data?.length
    ? runtimeProvidersQuery.data
    : FALLBACK_RUNTIME_PROVIDERS;
  const roomStyle: RoomStyle =
    selectedRoomStyle ?? (roomDefaultsQuery.data?.supportiveMode ? "supportive" : "guided");
  const languageOptions = languagesQuery.data?.length ? languagesQuery.data : FALLBACK_LANGUAGES;
  const compatibleVoiceOptions = (voicesQuery.data ?? []).filter(
    (voice) => VOICE_LANGUAGE[voice.voiceId] === selectedLanguage
  );
  const effectiveVoiceId = compatibleVoiceOptions.some((voice) => voice.voiceId === selectedVoiceId)
    ? selectedVoiceId
    : (compatibleVoiceOptions[0]?.voiceId ?? null);

  // An empty list has nothing to choose from, so the create form is the step's content.
  const teachersEmpty = teachersQuery.isSuccess && teachersQuery.data.length === 0;
  const roomsEmpty = roomsQuery.isSuccess && roomsQuery.data.length === 0;
  const sessionsEmpty = sessionsQuery.isSuccess && sessionsQuery.data.length === 0;
  const teacherFormOpen = teacherComposerOpen || teachersEmpty;
  const roomFormOpen = roomComposerOpen || roomsEmpty;
  const sessionFormOpen = sessionComposerOpen || sessionsEmpty;

  useEffect(() => {
    if (teacherComposerOpen) teacherInputRef.current?.focus();
  }, [teacherComposerOpen]);
  useEffect(() => {
    if (roomComposerOpen) roomInputRef.current?.focus();
  }, [roomComposerOpen]);
  useEffect(() => {
    if (sessionComposerOpen) sessionInputRef.current?.focus();
  }, [sessionComposerOpen]);
  // Move focus to the new step's heading after a step change (not on first paint).
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const registerTeacherMutation = useMutation({
    mutationFn: teachersApi.register,
    onSuccess: (result) => {
      const stored: StoredTeacher = {
        teacherId: result.teacherId,
        code: result.code,
        name: result.name,
      };
      writeStoredTeacher(stored);
      setTeacherComposerOpen(false);
      setStepError(null);
      setPendingCode(null);
      setManualStep(2);
    },
    onError: (err) => {
      const apiErr = parseAxiosApiError(err);
      setStepError((apiErr.code && FIELD_ERROR_COPY[apiErr.code]) || apiErr.message);
      setPendingCode(null);
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: roomsApi.create,
    onSuccess: (room) => {
      queryClient.setQueryData(brainstormKeys.rooms(), (prev: Room[] | undefined) =>
        prev ? [room, ...prev] : [room]
      );
      setSelectedRoom(room);
      setRoomComposerOpen(false);
      setRoomName("");
      setStepError(null);
      setManualStep(3);
    },
    onError: (err) => {
      const apiErr = parseAxiosApiError(err);
      setStepError((apiErr.code && FIELD_ERROR_COPY[apiErr.code]) || apiErr.message);
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: (body: {
      topic: string;
      voiceId: string;
      language: BrainstormLanguage;
      capabilities: { research: boolean };
    }) => roomsApi.createSession(selectedRoom!.roomId, body),
    onSuccess: (snapshot) => {
      navigateWithTransition(
        router,
        `/rooms/${selectedRoom!.roomId}/sessions/${snapshot.sessionId}`
      );
    },
    onError: (err) => {
      setStepError(formatSessionStartError(err));
    },
  });

  const selectTeacher = (entry: TeacherDirectoryEntry) => {
    setStepError(null);
    setPendingCode(entry.code);
    registerTeacherMutation.mutate({ code: entry.code, name: entry.name });
  };

  const submitNewTeacher = (e: FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedCode || !trimmedName) {
      setStepError("Nhập cả tên và mã giáo viên trước đã.");
      return;
    }
    setStepError(null);
    setPendingCode(trimmedCode);
    registerTeacherMutation.mutate({ code: trimmedCode, name: trimmedName });
  };

  const submitNewRoom = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = roomName.trim();
    if (!trimmed) {
      setStepError("Đặt tên room trước đã.");
      return;
    }
    setStepError(null);
    createRoomMutation.mutate({
      name: trimmed,
      runtimeProvider: selectedRuntimeProvider,
      supportiveMode: roomStyle === "supportive",
    });
  };

  const submitNewSession = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = sessionTopic.trim();
    if (!trimmed) {
      setStepError("Nhập chủ đề brainstorm trước đã.");
      return;
    }
    if (!effectiveVoiceId) {
      setStepError("Chọn giọng đọc trước đã.");
      return;
    }
    setStepError(null);
    createSessionMutation.mutate({
      topic: trimmed,
      voiceId: effectiveVoiceId,
      language: selectedLanguage,
      // Keep the existing research capability default without adding another decision to the
      // minimum start flow. It is a capability flag, not part of the session seed/brief.
      capabilities: { research: true },
    });
  };

  const goToStep = (target: WizardStep) => {
    setStepError(null);
    if (target === 1) clearStoredTeacher();
    if (target <= 2) setSelectedRoom(null);
    setManualStep(target);
  };

  // Open sessions first; the API order (newest first) is kept within each group.
  const sessions = [...(sessionsQuery.data ?? [])].sort(
    (a, b) => Number(a.status === "wrapped") - Number(b.status === "wrapped")
  );

  const stepMotion = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: { duration: reduceMotion ? 0 : 0.18, ease: [0.25, 1, 0.5, 1] as const },
  };

  return (
    <div className="engine-surface relative min-h-dvh overflow-hidden">
      <EngineAmbientBg />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[40rem] flex-col px-4 pt-[9vh] pb-16 sm:px-6">
        <header className="mb-5 px-1">
          <h1 className="text-base font-bold tracking-tight text-[#e0f2fe]">AI Brainstorm Room</h1>
          <p className="mt-0.5 text-sm text-white/60">
            Chọn người dùng, room và session để vào phiên brainstorm.
          </p>
        </header>

        <EngineCard className="w-full p-0!">
          <Stepper
            step={step}
            values={{ 1: teacher?.name, 2: selectedRoom?.name }}
            onJump={goToStep}
          />

          <div className="p-5 sm:p-6">
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.section key="step-1" {...stepMotion}>
                  <StepHeader
                    headingRef={headingRef}
                    title="Ai đang dùng máy này?"
                    hint={
                      teachersEmpty
                        ? "Chưa có giáo viên nào trên máy này. Nhập tên và mã để bắt đầu."
                        : "Chọn tên của bạn. Lần đầu dùng thì thêm giáo viên mới."
                    }
                    action={
                      !teacherFormOpen && teachersQuery.isSuccess ? (
                        <NewButton onClick={() => setTeacherComposerOpen(true)}>
                          Giáo viên mới
                        </NewButton>
                      ) : null
                    }
                  />

                  <Composer open={teacherFormOpen} onSubmit={submitNewTeacher}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Tên hiển thị" htmlFor="wiz-name">
                        <Input
                          ref={teacherInputRef}
                          id="wiz-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="vd. Cô Hoa"
                          autoComplete="name"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Mã giáo viên" htmlFor="wiz-code">
                        <Input
                          id="wiz-code"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="vd. gv-hoa-01"
                          maxLength={64}
                          autoComplete="username"
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <ComposerActions
                      pending={registerTeacherMutation.isPending}
                      submitLabel="Tiếp tục"
                      aside="Mã giúp nhận ra bạn ở lần sau."
                      onCancel={teachersEmpty ? undefined : () => setTeacherComposerOpen(false)}
                    />
                  </Composer>

                  {teachersQuery.isPending ? (
                    <ListSkeleton />
                  ) : teachersQuery.isError ? (
                    <LoadError onRetry={() => teachersQuery.refetch()} />
                  ) : teachersQuery.data.length > 0 ? (
                    <ItemList>
                      {teachersQuery.data.map((t) => (
                        <ItemRow
                          key={t.code}
                          leading={
                            <span
                              aria-hidden
                              className="grid size-8 shrink-0 place-items-center rounded-full bg-[#67e8f9]/10 text-sm font-semibold text-[#a5f3fc]"
                            >
                              {teacherInitial(t.name)}
                            </span>
                          }
                          title={t.name}
                          meta={t.code}
                          pending={registerTeacherMutation.isPending && pendingCode === t.code}
                          disabled={registerTeacherMutation.isPending}
                          onClick={() => selectTeacher(t)}
                        />
                      ))}
                    </ItemList>
                  ) : null}
                </motion.section>
              ) : step === 2 ? (
                <motion.section key="step-2" {...stepMotion}>
                  <StepHeader
                    headingRef={headingRef}
                    title="Chọn room"
                    hint={
                      roomsEmpty
                        ? "Chưa có room nào. Tạo room đầu tiên — mỗi room gom các session của một lớp hoặc dự án."
                        : "Mỗi room gom các session brainstorm của một lớp hoặc dự án."
                    }
                    action={
                      !roomFormOpen && roomsQuery.isSuccess ? (
                        <NewButton onClick={() => setRoomComposerOpen(true)}>Room mới</NewButton>
                      ) : null
                    }
                  />

                  <Composer open={roomFormOpen} onSubmit={submitNewRoom}>
                    <Field label="Tên room" htmlFor="wiz-room-name">
                      <Input
                        ref={roomInputRef}
                        id="wiz-room-name"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="vd. Lớp 10A — Ý tưởng CLB"
                        maxLength={200}
                        className={inputClass}
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="AI provider" hint="Mọi session trong room dùng provider này.">
                        <Segmented
                          name="wiz-runtime-provider"
                          label="AI provider"
                          value={selectedRuntimeProvider}
                          options={runtimeProviderOptions.map((p) => ({
                            value: p.providerId,
                            label: p.label,
                          }))}
                          onChange={setSelectedRuntimeProvider}
                        />
                      </Field>
                      <Field label="Cách dẫn dắt" hint={ROOM_STYLE_HINT[roomStyle]}>
                        <Segmented
                          name="wiz-room-style"
                          label="Cách dẫn dắt"
                          value={roomStyle}
                          options={ROOM_STYLE_OPTIONS}
                          onChange={setSelectedRoomStyle}
                        />
                      </Field>
                    </div>
                    <ComposerActions
                      pending={createRoomMutation.isPending}
                      submitLabel="Tạo room"
                      aside="Không đổi được hai lựa chọn này sau khi tạo."
                      onCancel={roomsEmpty ? undefined : () => setRoomComposerOpen(false)}
                    />
                  </Composer>

                  {roomsQuery.isPending ? (
                    <ListSkeleton leading={false} />
                  ) : roomsQuery.isError ? (
                    <LoadError onRetry={() => roomsQuery.refetch()} />
                  ) : roomsQuery.data.length > 0 ? (
                    <ItemList>
                      {roomsQuery.data.map((room) => {
                        const mine = teacher?.teacherId === room.ownerTeacherId;
                        return (
                          <ItemRow
                            key={room.roomId}
                            title={room.name}
                            meta={[
                              mine ? "Của bạn" : (room.ownerName ?? "Không rõ"),
                              formatRelativeTime(room.createdAt),
                              room.supportiveMode ? "Nhanh" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            trailing={<Tag>{PROVIDER_LABEL[roomProvider(room)]}</Tag>}
                            onClick={() => {
                              setSelectedRoom(room);
                              setSelectedRuntimeProvider("codex");
                              setManualStep(3);
                            }}
                          />
                        );
                      })}
                    </ItemList>
                  ) : null}
                </motion.section>
              ) : (
                <motion.section key="step-3" {...stepMotion}>
                  <StepHeader
                    headingRef={headingRef}
                    title="Chọn session"
                    hint={
                      sessionsEmpty
                        ? "Room này chưa có session. Nêu chủ đề để bắt đầu session đầu tiên."
                        : "Mở lại một session cũ, hoặc bắt đầu chủ đề mới."
                    }
                    action={
                      !sessionFormOpen && sessionsQuery.isSuccess ? (
                        <NewButton onClick={() => setSessionComposerOpen(true)}>
                          Session mới
                        </NewButton>
                      ) : null
                    }
                  />

                  <Composer open={sessionFormOpen} onSubmit={submitNewSession}>
                    <Field
                      label="Chủ đề brainstorm"
                      htmlFor="wiz-topic"
                      hint="Chỉ cần nêu chủ đề. Ở các lượt đầu, AI sẽ cùng bạn làm rõ mục tiêu, bối cảnh và tiêu chí thành công."
                    >
                      <Input
                        ref={sessionInputRef}
                        id="wiz-topic"
                        value={sessionTopic}
                        onChange={(e) => setSessionTopic(e.target.value)}
                        placeholder="vd. Làm sao giúp học sinh đọc nhiều hơn?"
                        maxLength={200}
                        className={inputClass}
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Ngôn ngữ">
                        <Segmented
                          name="wiz-language"
                          label="Ngôn ngữ"
                          value={selectedLanguage}
                          options={languageOptions.map((l) => ({
                            value: l.languageId,
                            label: l.label,
                          }))}
                          onChange={setSelectedLanguage}
                        />
                      </Field>
                      <Field label="Giọng đọc">
                        {voicesQuery.isPending ? (
                          <div className="h-10 animate-pulse rounded-md bg-white/[0.06]" />
                        ) : compatibleVoiceOptions.length > 0 ? (
                          <Segmented
                            name="wiz-voice"
                            label="Giọng đọc"
                            value={effectiveVoiceId}
                            options={compatibleVoiceOptions.map((v) => ({
                              value: v.voiceId,
                              label: v.label,
                            }))}
                            onChange={setSelectedVoiceId}
                          />
                        ) : (
                          <p className="flex h-10 items-center text-sm text-white/55">
                            Chưa có giọng cho ngôn ngữ này.
                          </p>
                        )}
                      </Field>
                    </div>
                    <ComposerActions
                      pending={createSessionMutation.isPending}
                      submitLabel="Bắt đầu session"
                      pendingLabel="Đang khởi động…"
                      aside={`Theo room: ${PROVIDER_LABEL[roomProvider(selectedRoom)]} · ${selectedRoom?.supportiveMode ? "Nhanh" : "Chuyên sâu"}`}
                      onCancel={sessionsEmpty ? undefined : () => setSessionComposerOpen(false)}
                    />
                  </Composer>

                  {sessionsQuery.isPending ? (
                    <ListSkeleton leading={false} />
                  ) : sessionsQuery.isError ? (
                    <LoadError onRetry={() => sessionsQuery.refetch()} />
                  ) : sessions.length > 0 ? (
                    <ItemList>
                      {sessions.map((session: RoomSessionSummary) => {
                        const open = session.status !== "wrapped";
                        const meta = [
                          PHASE_LABEL[session.phaseKey] ?? session.phaseKey,
                          formatRelativeTime(session.createdAt),
                          session.briefStatus && session.briefStatus !== "confirmed"
                            ? "Brief chưa chốt"
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <ItemRow
                            key={session.sessionId}
                            title={session.name}
                            meta={meta}
                            trailing={
                              <Tag tone={open ? "live" : "neutral"}>
                                {open ? "Đang mở" : "Đã kết thúc"}
                              </Tag>
                            }
                            onClick={() =>
                              navigateWithTransition(
                                router,
                                `/rooms/${selectedRoom!.roomId}/sessions/${session.sessionId}`
                              )
                            }
                          />
                        );
                      })}
                    </ItemList>
                  ) : null}
                </motion.section>
              )}
            </AnimatePresence>

            {stepError ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-md border border-[#ea580c]/30 bg-[#ea580c]/10 px-3 py-2.5 text-sm text-[#fdba74]"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{stepError}</span>
              </div>
            ) : null}
          </div>
        </EngineCard>
      </main>
    </div>
  );
}
