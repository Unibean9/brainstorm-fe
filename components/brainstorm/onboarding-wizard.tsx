"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronRight, Loader2, Plus } from "lucide-react";

import { ConstellationGrid } from "@/components/brainstorm/constellation-grid";
import { EngineAmbientBg } from "@/components/brainstorm/engine-ambient-bg";
import { EngineCard } from "@/components/brainstorm/engine-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teachersApi } from "@/lib/api/services/teachers";
import { roomsApi } from "@/lib/api/services/rooms";
import { voicesApi } from "@/lib/api/services/voices";
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
import type { Room, RoomSessionSummary, TeacherDirectoryEntry } from "@/types/brainstorm-domain";

type WizardStep = 1 | 2 | 3;

const STEP_META: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Giảng viên" },
  { id: 2, label: "Room" },
  { id: 3, label: "Session" },
];

const engineInputClass = cn(
  "h-10 rounded-none border-0 border-b-2 border-white/15 bg-transparent px-1 text-[0.95rem]",
  "font-medium text-[#e0f2fe] shadow-none placeholder:text-white/35",
  "focus-visible:border-[#22d3ee] focus-visible:ring-0"
);

const FIELD_ERROR_COPY: Record<string, string> = {
  invalid_code: "Mã giáo viên không hợp lệ (tối đa 64 ký tự).",
  invalid_name: "Tên chưa hợp lệ.",
  invalid_teacher: "Có trường dữ liệu không hợp lệ.",
  invalid_room: "Dữ liệu room không hợp lệ.",
  room_not_found: "Room này không còn tồn tại.",
  facilitator_start_failed: "Facilitator chưa khởi động được — thử tạo lại.",
};

function StepNode({
  id,
  label,
  resolvedLabel,
  status,
  onClick,
}: {
  id: WizardStep;
  label: string;
  resolvedLabel?: string;
  status: "done" | "active" | "upcoming";
  onClick?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const clickable = status === "done" && Boolean(onClick);
  const tone = status === "done" ? "#fbbf24" : status === "active" ? "#67e8f9" : "rgba(255,255,255,0.18)";
  const glow =
    status === "done"
      ? "0 0 14px rgba(251,191,36,0.55), 0 0 30px rgba(245,158,11,0.3)"
      : status === "active"
        ? "0 0 16px rgba(103,232,249,0.6), 0 0 34px rgba(34,211,238,0.35)"
        : "none";

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2.5 outline-none",
        clickable ? "cursor-pointer" : "cursor-default"
      )}
    >
      <motion.span
        data-constellation-node
        className="relative grid size-14 shrink-0 place-items-center rounded-full"
        style={{
          border: `2px solid ${tone}`,
          background:
            status === "upcoming"
              ? "rgba(255,255,255,0.02)"
              : "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.22), rgba(7,17,31,0.7) 65%)",
          boxShadow: glow,
        }}
        animate={
          status === "active" && !reduceMotion
            ? {
                boxShadow: [
                  "0 0 12px rgba(103,232,249,0.5), 0 0 26px rgba(34,211,238,0.28)",
                  "0 0 20px rgba(103,232,249,0.7), 0 0 40px rgba(34,211,238,0.4)",
                  "0 0 12px rgba(103,232,249,0.5), 0 0 26px rgba(34,211,238,0.28)",
                ],
              }
            : undefined
        }
        transition={status === "active" && !reduceMotion ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : undefined}
        whileHover={clickable && !reduceMotion ? { scale: 1.08 } : undefined}
      >
        {status === "done" ? (
          <Check className="size-5" style={{ color: "#fde68a" }} strokeWidth={2.5} />
        ) : (
          <span
            className={cn(
              "text-lg font-bold",
              status === "active" ? "text-[#e0f2fe]" : "text-white/30"
            )}
          >
            {id}
          </span>
        )}
      </motion.span>
      <span className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.14em]",
            status === "upcoming" ? "text-white/30" : "text-white/75"
          )}
        >
          {label}
        </span>
        {resolvedLabel ? (
          <span className="max-w-32 truncate text-[11px] font-medium text-[#fde68a]/90">
            {resolvedLabel}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ListRow({
  tone = "cyan",
  title,
  meta,
  badge,
  onClick,
  pending,
}: {
  tone?: "cyan" | "gold";
  title: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  onClick: () => void;
  pending?: boolean;
}) {
  const dot = tone === "gold" ? "#fde68a" : "#a5f3fc";
  const ring = tone === "gold" ? "#fbbf24" : "#67e8f9";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="group flex w-full items-center gap-3.5 rounded-lg px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-50"
    >
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full"
        style={{ border: `1.5px solid ${ring}`, boxShadow: `0 0 8px ${ring}55` }}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-white/70" />
        ) : (
          <span className="size-1.5 rounded-full" style={{ background: dot }} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.95rem] font-medium text-white">{title}</span>
        {meta ? <span className="block truncate text-[11px] text-white/40">{meta}</span> : null}
      </span>
      {badge}
      <ChevronRight
        className="size-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/50"
        aria-hidden
      />
    </button>
  );
}

function StepShell({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-sans text-[1.3rem] font-bold tracking-tight text-white">{title}</p>
        {hint ? <p className="mt-1 text-[13px] text-white/45">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ComposerToggle({ open, onOpen, label }: { open: boolean; onOpen: () => void; label: string }) {
  if (open) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-3 text-sm font-semibold text-white/45 transition-colors hover:border-[#67e8f9]/40 hover:text-[#67e8f9]"
    >
      <Plus className="size-4" aria-hidden />
      {label}
    </button>
  );
}

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
  const [sessionName, setSessionName] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const roomInputRef = useRef<HTMLInputElement>(null);
  const sessionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (roomComposerOpen) roomInputRef.current?.focus();
  }, [roomComposerOpen]);
  useEffect(() => {
    if (sessionComposerOpen) sessionInputRef.current?.focus();
  }, [sessionComposerOpen]);

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

  // selectedVoiceId chưa từng set thủ công (null) → mặc định về preset đầu tiên,
  // tính lại ngay trong render thay vì setState trong effect (tránh cascading render).
  const effectiveVoiceId = selectedVoiceId ?? voicesQuery.data?.[0]?.voiceId ?? null;

  const registerTeacherMutation = useMutation({
    mutationFn: teachersApi.register,
    onSuccess: (result) => {
      const stored: StoredTeacher = { teacherId: result.teacherId, code: result.code, name: result.name };
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
    mutationFn: ({ name, voiceId }: { name: string; voiceId: string }) =>
      roomsApi.createSession(selectedRoom!.roomId, { name, voiceId }),
    onSuccess: (snapshot) => {
      navigateWithTransition(router, `/rooms/${selectedRoom!.roomId}/sessions/${snapshot.sessionId}`);
    },
    onError: (err) => {
      const apiErr = parseAxiosApiError(err);
      setStepError((apiErr.code && FIELD_ERROR_COPY[apiErr.code]) || apiErr.message);
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
      setStepError("Nhập cả mã và tên trước đã.");
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
    createRoomMutation.mutate({ name: trimmed });
  };

  const submitNewSession = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = sessionName.trim();
    if (!trimmed) {
      setStepError("Đặt tên session trước đã.");
      return;
    }
    if (!effectiveVoiceId) {
      setStepError("Chọn giọng đọc trước đã.");
      return;
    }
    setStepError(null);
    createSessionMutation.mutate({ name: trimmed, voiceId: effectiveVoiceId });
  };

  const goToStep = (target: WizardStep) => {
    setStepError(null);
    if (target === 1) clearStoredTeacher();
    if (target <= 2) setSelectedRoom(null);
    setManualStep(target);
  };

  const slideVariants = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 },
  };

  return (
    <div className="engine-surface relative min-h-dvh overflow-hidden">
      <EngineAmbientBg />

      <div className="relative z-10 flex min-h-dvh flex-col items-center px-5 py-14 sm:py-20">
        <div className="mb-10 text-center">
          <p
            className="font-sans text-[1.4rem] font-bold tracking-tight text-[#e0f2fe]"
            style={{ textShadow: "0 0 24px rgba(34,211,238,0.4)" }}
          >
            AI Brainstorm Room
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
            Thinking Orchestration Engine
          </p>
        </div>

        <ConstellationGrid className="mb-10 flex w-full max-w-md items-start justify-between">
          {STEP_META.map((s) => (
            <StepNode
              key={s.id}
              id={s.id}
              label={s.label}
              resolvedLabel={s.id === 1 ? teacher?.name : s.id === 2 ? selectedRoom?.name : undefined}
              status={s.id < step ? "done" : s.id === step ? "active" : "upcoming"}
              onClick={s.id < step ? () => goToStep(s.id) : undefined}
            />
          ))}
        </ConstellationGrid>

        <div className="w-full max-w-md">
          <EngineCard tone={step === 3 ? "gold" : "cyan"} className="w-full overflow-hidden p-6!">
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div key="step-1" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: reduceMotion ? 0 : 0.22 }}>
                  <StepShell
                    title="Ai đang thao tác trên máy này?"
                    hint="Chọn tên bạn trong danh sách, hoặc nhập mã mới nếu đây là lần đầu."
                  >
                    {teachersQuery.isPending ? (
                      <ListSkeleton />
                    ) : teachersQuery.data && teachersQuery.data.length > 0 ? (
                      <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
                        {teachersQuery.data.map((t) => (
                          <ListRow
                            key={t.code}
                            title={t.name}
                            meta={`Mã: ${t.code}`}
                            pending={registerTeacherMutation.isPending && pendingCode === t.code}
                            onClick={() => selectTeacher(t)}
                          />
                        ))}
                      </div>
                    ) : null}

                    <ComposerToggle
                      open={teacherComposerOpen}
                      onOpen={() => setTeacherComposerOpen(true)}
                      label="Giáo viên mới"
                    />

                    {teacherComposerOpen ? (
                      <form onSubmit={submitNewTeacher} className="flex flex-col gap-3.5 border-t border-white/8 pt-4">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="wiz-code" className="text-[11px] font-semibold tracking-[0.08em] text-white/45">
                            MÃ GIÁO VIÊN
                          </Label>
                          <Input
                            id="wiz-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="vd. gv-hoa-01"
                            maxLength={64}
                            autoComplete="username"
                            className={engineInputClass}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="wiz-name" className="text-[11px] font-semibold tracking-[0.08em] text-white/45">
                            TÊN HIỂN THỊ
                          </Label>
                          <Input
                            id="wiz-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="vd. Cô Hoa"
                            autoComplete="name"
                            className={engineInputClass}
                          />
                        </div>
                        <WizardSubmitRow
                          pending={registerTeacherMutation.isPending}
                          label="Xác nhận"
                          onCancel={() => setTeacherComposerOpen(false)}
                        />
                      </form>
                    ) : null}
                  </StepShell>
                </motion.div>
              ) : step === 2 ? (
                <motion.div key="step-2" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: reduceMotion ? 0 : 0.22 }}>
                  <StepShell title="Chọn room" hint="Toàn bộ room trên máy này, hoặc ghim room mới cho lớp của bạn.">
                    {roomsQuery.isPending ? (
                      <ListSkeleton />
                    ) : roomsQuery.data && roomsQuery.data.length > 0 ? (
                      <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
                        {roomsQuery.data.map((room) => (
                          <ListRow
                            key={room.roomId}
                            title={room.name}
                            meta={`${room.ownerName ?? "—"} · ${formatRelativeTime(room.createdAt)}`}
                            onClick={() => {
                              setSelectedRoom(room);
                              setManualStep(3);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/40">Chưa có room nào — ghim room đầu tiên.</p>
                    )}

                    <ComposerToggle open={roomComposerOpen} onOpen={() => setRoomComposerOpen(true)} label="Room mới" />

                    {roomComposerOpen ? (
                      <form onSubmit={submitNewRoom} className="flex flex-col gap-3.5 border-t border-white/8 pt-4">
                        <Input
                          ref={roomInputRef}
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                          placeholder="Tên room, vd. Lớp 10A — Ý tưởng CLB"
                          maxLength={200}
                          className={engineInputClass}
                        />
                        <WizardSubmitRow
                          pending={createRoomMutation.isPending}
                          label="Ghim room"
                          onCancel={() => setRoomComposerOpen(false)}
                        />
                      </form>
                    ) : null}
                  </StepShell>
                </motion.div>
              ) : (
                <motion.div key="step-3" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: reduceMotion ? 0 : 0.22 }}>
                  <StepShell
                    title="Chọn session"
                    hint={selectedRoom ? `Trong room "${selectedRoom.name}".` : undefined}
                  >
                    {sessionsQuery.isPending ? (
                      <ListSkeleton />
                    ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
                      <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
                        {sessionsQuery.data.map((session: RoomSessionSummary) => (
                          <ListRow
                            key={session.sessionId}
                            tone="gold"
                            title={session.name}
                            meta={session.phaseKey}
                            badge={
                              <span
                                className={
                                  session.status === "wrapped"
                                    ? "rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/50"
                                    : "rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-semibold text-[#86efac]"
                                }
                              >
                                {session.status === "wrapped" ? "ĐÃ WRAP" : "ĐANG MỞ"}
                              </span>
                            }
                            onClick={() =>
                              navigateWithTransition(
                                router,
                                `/rooms/${selectedRoom!.roomId}/sessions/${session.sessionId}`
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/40">Chưa có session — bắt đầu session đầu tiên.</p>
                    )}

                    <ComposerToggle
                      open={sessionComposerOpen}
                      onOpen={() => setSessionComposerOpen(true)}
                      label="Session mới"
                    />

                    {sessionComposerOpen ? (
                      <form onSubmit={submitNewSession} className="flex flex-col gap-3.5 border-t border-white/8 pt-4">
                        <Input
                          ref={sessionInputRef}
                          value={sessionName}
                          onChange={(e) => setSessionName(e.target.value)}
                          placeholder="Tên session, vd. Brainstorm sáng thứ 2"
                          className={engineInputClass}
                        />
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-[11px] font-semibold tracking-[0.08em] text-white/45">
                            GIỌNG ĐỌC
                          </Label>
                          <div className="flex gap-2">
                            {(voicesQuery.data ?? []).map((voice) => (
                              <button
                                key={voice.voiceId}
                                type="button"
                                onClick={() => setSelectedVoiceId(voice.voiceId)}
                                className={cn(
                                  "flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                                  effectiveVoiceId === voice.voiceId
                                    ? "border-[#fbbf24]/60 bg-[#fbbf24]/10 text-[#fde68a]"
                                    : "border-white/12 text-white/50 hover:border-white/25 hover:text-white/75"
                                )}
                              >
                                {voice.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <WizardSubmitRow
                          pending={createSessionMutation.isPending}
                          label="Bắt đầu session"
                          onCancel={() => setSessionComposerOpen(false)}
                          gold
                        />
                      </form>
                    ) : null}
                  </StepShell>
                </motion.div>
              )}
            </AnimatePresence>

            {stepError ? (
              <p role="alert" className="mt-4 text-[13px] font-medium text-[#fdba74]">
                {stepError}
              </p>
            ) : null}
          </EngineCard>

          {step > 1 ? (
            <button
              type="button"
              onClick={() => goToStep((step - 1) as WizardStep)}
              className="mt-4 text-xs font-medium text-white/35 hover:text-white/60"
            >
              ← Quay lại bước trước
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WizardSubmitRow({
  pending,
  label,
  onCancel,
  gold,
}: {
  pending: boolean;
  label: string;
  onCancel: () => void;
  gold?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          gold
            ? "border-[#fbbf24]/50 text-[#fde68a] hover:bg-[#fbbf24]/10"
            : "border-[#22d3ee]/50 text-[#e0f2fe] hover:bg-[#22d3ee]/10"
        )}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        {label}
      </button>
      <button type="button" onClick={onCancel} className="text-xs font-medium text-white/40 hover:text-white/70">
        Huỷ
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3.5 px-2.5 py-2.5">
          <div className="size-9 animate-pulse rounded-full bg-white/8" style={{ animationDelay: `${i * 120}ms` }} />
          <div className="h-4 flex-1 animate-pulse rounded bg-white/8" />
        </div>
      ))}
    </div>
  );
}
