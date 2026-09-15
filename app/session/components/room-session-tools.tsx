"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Loader2,
  Pause,
  Plus,
  Send,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";

import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import { parseAxiosApiError } from "@/lib/brainstorm/parse-api-error";
import { cn } from "@/lib/utils";
import type {
  AutonomousIdeationCandidate,
  AutonomousIdeationJob,
  AdaptiveState,
  BriefStatus,
  BrainstormLanguage,
  DurableOutcome,
  DurableOutcomeKind,
  FacilitationMode,
  RuntimeProvider,
  SessionBrief,
  WorkingBrief,
} from "@/types/brainstorm-domain";

const MODE_LABELS: Record<FacilitationMode, string> = {
  facilitator: "Facilitator",
  creative_partner: "Creative partner",
};

const INTENT_LABELS: Record<NonNullable<AdaptiveState["cognitiveIntent"]>, string> = {
  explore: "Explore",
  analyze: "Analyze",
  ideate: "Ideate",
  challenge: "Challenge",
  develop: "Develop",
  evaluate: "Evaluate",
  converge: "Converge",
  synthesize: "Synthesize",
};

const EMPTY_WORKING_BRIEF: WorkingBrief = {
  goal: null,
  context: null,
  constraints: null,
  audience: null,
  successCriteria: null,
};

const KIND_LABELS: Record<DurableOutcomeKind, string> = {
  idea: "Ý tưởng",
  insight: "Insight",
  assumption: "Giả định",
  risk: "Rủi ro",
  question: "Câu hỏi",
  decision: "Quyết định",
  rejected_option: "Phương án loại",
  action: "Việc cần làm",
};

const OUTCOME_KINDS = Object.keys(KIND_LABELS) as DurableOutcomeKind[];

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function contentText(content: unknown) {
  if (typeof content === "string") return content;
  try {
    return JSON.stringify(content);
  } catch {
    return "Không hiển thị được nội dung";
  }
}

function apiErrorCopy(error: unknown) {
  const parsed = parseAxiosApiError(error);
  const codes: Record<string, string> = {
    brief_not_ready: "Working Brief chưa đủ rõ — tiếp tục brainstorm thêm vài lượt.",
    invalid_brief_update: "Working Brief có dữ liệu chưa hợp lệ.",
    invalid_brief_confirmation: "Không thể xác nhận Working Brief với dữ liệu hiện tại.",
    session_closed: "Phiên đã đóng.",
    root_turn_in_progress: "Lượt chính đang chạy — đợi lượt đó xong rồi thử lại.",
    autonomous_job_limit: "Mỗi session chỉ chạy một nhánh tại một thời điểm.",
    legacy_job_not_runnable: "Nhánh cũ không thể chạy lại — hãy tạo một nhánh mới.",
    claude_fork_unsupported: "Claude trên server này chưa hỗ trợ nhánh tự động.",
    codex_fork_unsupported: "Codex trên server này chưa hỗ trợ nhánh tự động.",
    job_not_completed: "Nhánh chưa hoàn tất.",
    candidate_not_found: "Không tìm thấy candidate này.",
    candidate_not_pending: "Candidate này đã được xử lý.",
  };
  return parsed.code && codes[parsed.code] ? codes[parsed.code] : parsed.message;
}

function briefReady(value: WorkingBrief) {
  return Boolean(
    value.goal?.trim() &&
    value.context?.trim() &&
    value.audience?.trim() &&
    value.constraints?.length &&
    value.successCriteria?.length
  );
}

function splitBriefLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function briefFieldValue(value: string | null | undefined) {
  return value ?? "";
}

type RoomSessionToolsProps = {
  sessionId: string;
  runtimeProvider?: RuntimeProvider;
  language?: BrainstormLanguage;
  facilitationMode?: FacilitationMode;
  modeRevision?: number;
  seedTopic?: string;
  workingBrief?: WorkingBrief | null;
  briefStatus?: BriefStatus;
  briefRevision?: number;
  brief?: SessionBrief | null;
  adaptiveState?: AdaptiveState;
  durableOutcomes?: DurableOutcome[];
  autonomousJobs?: AutonomousIdeationJob[];
  activeTurn?: {
    turnId: string;
    status: string;
    facilitationMode?: FacilitationMode;
    modeRevision?: number;
  } | null;
  turnInProgress?: boolean;
  isWrapped: boolean;
  onCompleted: () => void;
};

export function RoomSessionTools({
  sessionId,
  runtimeProvider = "claude",
  language = "vi",
  facilitationMode = "facilitator",
  modeRevision,
  seedTopic,
  workingBrief,
  briefStatus = "discovery",
  briefRevision,
  brief,
  adaptiveState,
  durableOutcomes = [],
  autonomousJobs = [],
  activeTurn,
  turnInProgress = false,
  isWrapped,
  onCompleted,
}: RoomSessionToolsProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(facilitationMode);
  const [currentMode, setCurrentMode] = useState(facilitationMode);
  const [currentModeRevision, setCurrentModeRevision] = useState(modeRevision);
  const [draftBrief, setDraftBrief] = useState<WorkingBrief>(workingBrief ?? EMPTY_WORKING_BRIEF);
  const [savedBriefKey, setSavedBriefKey] = useState(
    JSON.stringify(workingBrief ?? EMPTY_WORKING_BRIEF)
  );
  const [currentBrief, setCurrentBrief] = useState<SessionBrief | null>(brief ?? null);
  const [currentBriefStatus, setCurrentBriefStatus] = useState<BriefStatus>(briefStatus);
  const [currentBriefRevision, setCurrentBriefRevision] = useState(briefRevision);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [outcomeKind, setOutcomeKind] = useState<DurableOutcomeKind>("idea");
  const [outcomeContent, setOutcomeContent] = useState("");
  const [ideationPrompt, setIdeationPrompt] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    autonomousJobs[0]?.jobId ?? null
  );
  const [localJobs, setLocalJobs] = useState<AutonomousIdeationJob[]>([]);

  // Server snapshots can change after a mutation or refetch, so reset the local
  // controls when their source props change.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMode(facilitationMode);
    setCurrentMode(facilitationMode);
    setCurrentModeRevision(modeRevision);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [facilitationMode, modeRevision]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDraftBrief(workingBrief ?? EMPTY_WORKING_BRIEF);
    setSavedBriefKey(JSON.stringify(workingBrief ?? EMPTY_WORKING_BRIEF));
    setCurrentBrief(brief ?? null);
    setCurrentBriefStatus(briefStatus);
    setCurrentBriefRevision(briefRevision);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [brief, briefRevision, briefStatus, workingBrief]);

  const jobs = useMemo(() => {
    const byId = new Map<string, AutonomousIdeationJob>();
    for (const job of autonomousJobs) byId.set(job.jobId, job);
    for (const job of localJobs) byId.set(job.jobId, job);
    return [...byId.values()];
  }, [autonomousJobs, localJobs]);
  const selectedJob = jobs.find((job) => job.jobId === selectedJobId) ?? jobs[0];

  const selectedJobQuery = useQuery({
    queryKey: brainstormKeys.autonomousJob(sessionId, selectedJob?.jobId ?? "pending"),
    queryFn: () => brainstormSessionApi.getAutonomousJob(sessionId, selectedJob!.jobId),
    enabled: open && Boolean(selectedJob),
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? selectedJob?.status;
      return status === "queued" || status === "running" ? 3_000 : false;
    },
  });
  const liveSelectedJob = selectedJobQuery.data ?? selectedJob;
  const displayJobs = useMemo(() => {
    if (!liveSelectedJob) return jobs;
    return jobs.map((job) => (job.jobId === liveSelectedJob.jobId ? liveSelectedJob : job));
  }, [jobs, liveSelectedJob]);

  const outcomesQuery = useQuery({
    queryKey: brainstormKeys.outcomes(sessionId),
    queryFn: () => brainstormSessionApi.listOutcomes(sessionId),
    enabled: open,
    initialData: durableOutcomes,
    staleTime: 10_000,
  });

  const candidatesQuery = useQuery({
    queryKey: brainstormKeys.autonomousCandidates(sessionId, selectedJob?.jobId ?? "pending"),
    queryFn: () => brainstormSessionApi.listAutonomousCandidates(sessionId, selectedJob!.jobId),
    enabled: open && Boolean(liveSelectedJob && liveSelectedJob.status === "completed"),
    staleTime: 5_000,
  });

  const modeMutation = useMutation({
    mutationFn: () => brainstormSessionApi.updateMode(sessionId, mode, reason),
    onSuccess: (result) => {
      setCurrentMode(result.facilitationMode);
      setCurrentModeRevision(result.modeRevision);
      setReason("");
      setNotice(
        `Đã chuyển sang ${MODE_LABELS[result.facilitationMode]}. Có hiệu lực từ lượt tiếp theo.`
      );
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const updateBriefMutation = useMutation({
    mutationFn: () =>
      brainstormSessionApi.updateBrief(sessionId, {
        goal: draftBrief.goal?.trim() || null,
        context: draftBrief.context?.trim() || null,
        audience: draftBrief.audience?.trim() || null,
        constraints: draftBrief.constraints?.length ? draftBrief.constraints : null,
        successCriteria: draftBrief.successCriteria?.length ? draftBrief.successCriteria : null,
      }),
    onSuccess: (result) => {
      setDraftBrief(result.workingBrief);
      setSavedBriefKey(JSON.stringify(result.workingBrief));
      setCurrentBrief(result.brief);
      setCurrentBriefStatus(result.briefStatus);
      setCurrentBriefRevision(result.briefRevision);
      setNotice(
        result.briefStatus === "ready_for_confirmation"
          ? "Working Brief đã đủ rõ — bạn có thể xác nhận trước khi đi tiếp."
          : "Đã cập nhật Working Brief."
      );
      void queryClient.invalidateQueries({ queryKey: brainstormKeys.session(sessionId) });
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const confirmBriefMutation = useMutation({
    mutationFn: () => brainstormSessionApi.confirmBrief(sessionId),
    onSuccess: (result) => {
      setDraftBrief(result.workingBrief);
      setSavedBriefKey(JSON.stringify(result.workingBrief));
      setCurrentBrief(result.brief);
      setCurrentBriefStatus(result.briefStatus);
      setCurrentBriefRevision(result.briefRevision);
      setNotice("Đã xác nhận Session Brief. Bạn vẫn có thể cập nhật nếu bối cảnh thay đổi.");
      void queryClient.invalidateQueries({ queryKey: brainstormKeys.session(sessionId) });
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const completeMutation = useMutation({
    mutationFn: () => brainstormSessionApi.complete(sessionId),
    onSuccess: () => {
      setNotice("Đã kết thúc session. Bạn vẫn có thể tạo output còn thiếu.");
      onCompleted();
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const outcomeMutation = useMutation({
    mutationFn: (body: Parameters<typeof brainstormSessionApi.createOutcome>[1]) =>
      brainstormSessionApi.createOutcome(sessionId, body),
    onSuccess: () => {
      setOutcomeContent("");
      setNotice("Đã lưu vào outcomes ledger.");
      void queryClient.invalidateQueries({ queryKey: brainstormKeys.outcomes(sessionId) });
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const ideationMutation = useMutation({
    mutationFn: () =>
      brainstormSessionApi.startAutonomousIdeation(sessionId, {
        clientJobId: newId(),
        prompt: ideationPrompt.trim(),
      }),
    onSuccess: (job) => {
      setLocalJobs((current) => [job, ...current]);
      setSelectedJobId(job.jobId);
      setIdeationPrompt("");
      setNotice("Đã khởi động nhánh ideation.");
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => brainstormSessionApi.cancelAutonomousJob(sessionId, jobId),
    onSuccess: (job) => {
      setLocalJobs((current) => {
        const index = current.findIndex((item) => item.jobId === job.jobId);
        if (index === -1) return [...current, job];
        const next = [...current];
        next[index] = job;
        return next;
      });
      queryClient.setQueryData(brainstormKeys.autonomousJob(sessionId, job.jobId), job);
      setNotice("Đã hủy nhánh ideation.");
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const acceptMutation = useMutation({
    mutationFn: (candidate: AutonomousIdeationCandidate) =>
      brainstormSessionApi.acceptAutonomousCandidate(
        sessionId,
        selectedJob!.jobId,
        candidate.candidateId,
        {
          kind: candidate.kind,
          outcomeId: newId(),
        }
      ),
    onSuccess: () => {
      setNotice("Đã đưa candidate vào outcomes ledger.");
      void queryClient.invalidateQueries({
        queryKey: brainstormKeys.autonomousCandidates(sessionId, selectedJob?.jobId ?? "pending"),
      });
      void queryClient.invalidateQueries({ queryKey: brainstormKeys.outcomes(sessionId) });
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: (candidate: AutonomousIdeationCandidate) =>
      brainstormSessionApi.rejectAutonomousCandidate(
        sessionId,
        selectedJob!.jobId,
        candidate.candidateId
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: brainstormKeys.autonomousCandidates(sessionId, selectedJob?.jobId ?? "pending"),
      });
    },
    onError: (error) => setNotice(apiErrorCopy(error)),
  });

  const submitOutcome = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = outcomeContent.trim();
    if (!content) {
      setNotice("Viết nội dung outcome trước đã.");
      return;
    }
    const serialized = JSON.stringify(content);
    if (serialized === undefined || new TextEncoder().encode(serialized).byteLength > 16 * 1024) {
      setNotice("Outcome tối đa 16KB dữ liệu.");
      return;
    }
    outcomeMutation.mutate({
      outcomeId: newId(),
      kind: outcomeKind,
      content,
      status: "accepted",
    });
  };

  const submitIdeation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ideationPrompt.trim() || ideationMutation.isPending) return;
    ideationMutation.mutate();
  };

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] transition-colors",
          open
            ? "border-[#67e8f9]/55 bg-[#22d3ee]/10 text-[#a5f3fc]"
            : "border-white/15 bg-white/[0.035] text-white/65 hover:border-[#67e8f9]/45 hover:text-[#a5f3fc]"
        )}
      >
        <Settings2 className="size-3.5" aria-hidden />
        SESSION
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(72vh,42rem)] w-[min(92vw,410px)] overflow-y-auto rounded-xl border border-[#67e8f9]/25 bg-[#07111f]/98 p-4 text-left backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Session controls</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                {runtimeProvider === "codex" ? "Codex" : "Claude"} ·{" "}
                {language === "en" ? "English" : "Tiếng Việt"} · conversation chính được ghim
              </p>
              {seedTopic ? (
                <p
                  className="mt-1 max-w-[18rem] truncate text-[11px] text-white/65"
                  title={seedTopic}
                >
                  Chủ đề: {seedTopic}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng session controls"
              className="grid size-9 place-items-center rounded-full text-white/45 hover:bg-white/8 hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <WorkingBriefEditor
            brief={draftBrief}
            briefStatus={currentBriefStatus}
            briefRevision={currentBriefRevision}
            hasConfirmedBrief={Boolean(currentBrief)}
            isDirty={JSON.stringify(draftBrief) !== savedBriefKey}
            onTextChange={(field, value) =>
              setDraftBrief((current) => ({ ...current, [field]: value || null }))
            }
            onListChange={(field, value) =>
              setDraftBrief((current) => ({ ...current, [field]: value }))
            }
            onSave={() => updateBriefMutation.mutate()}
            onConfirm={() => confirmBriefMutation.mutate()}
            savePending={updateBriefMutation.isPending}
            confirmPending={confirmBriefMutation.isPending}
            isWrapped={isWrapped}
          />

          <section className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/85">Facilitation mode · adaptive</p>
                <p className="mt-1 text-[11px] text-white/40">
                  Agent tự chuyển giữa facilitator và creative partner theo trạng thái nhóm. Bạn có
                  thể yêu cầu override cho lượt kế tiếp.
                </p>
              </div>
              {typeof currentModeRevision === "number" ? (
                <span className="text-[10px] text-white/35">v{currentModeRevision}</span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(MODE_LABELS) as FacilitationMode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={isWrapped || modeMutation.isPending}
                  onClick={() => setMode(value)}
                  className={cn(
                    "min-h-10 rounded-lg border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                    mode === value
                      ? "border-[#67e8f9]/55 bg-[#22d3ee]/10 text-[#a5f3fc]"
                      : "border-white/12 text-white/50 hover:border-white/25 hover:text-white/80"
                  )}
                >
                  {MODE_LABELS[value]}
                </button>
              ))}
            </div>
            {mode !== currentMode && !isWrapped ? (
              <div className="mt-3">
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="Lý do chuyển mode (không bắt buộc)"
                  className="h-10 w-full rounded-lg border border-white/12 bg-white/[0.035] px-3 text-xs text-white outline-none placeholder:text-white/30 focus-visible:border-[#67e8f9]"
                />
                <button
                  type="button"
                  onClick={() => modeMutation.mutate()}
                  disabled={modeMutation.isPending}
                  className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#67e8f9]/45 px-3 text-xs font-semibold text-[#a5f3fc] hover:bg-[#22d3ee]/10 disabled:opacity-50"
                >
                  {modeMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : null}
                  Áp dụng từ lượt sau
                </button>
              </div>
            ) : null}
            {activeTurn ? (
              <p className="mt-2 text-[11px] text-[#fde68a]/75">
                Lượt đang chạy giữ mode {MODE_LABELS[activeTurn.facilitationMode ?? currentMode]} —
                đổi mode sẽ áp dụng sau lượt này.
              </p>
            ) : null}
            {adaptiveState?.cognitiveIntent ? (
              <p className="mt-2 text-[11px] text-[#a5f3fc]/80">
                Intent hiện tại: {INTENT_LABELS[adaptiveState.cognitiveIntent]}
                {adaptiveState.userState ? ` · ${adaptiveState.userState}` : ""}
              </p>
            ) : null}
          </section>

          <section className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white/85">Outcomes ledger</p>
                <p className="mt-1 text-[11px] text-white/40">
                  Ghi lại điều đã được xác nhận để dùng cho output.
                </p>
              </div>
              <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-semibold text-[#fde68a]">
                {(outcomesQuery.data ?? []).length}
              </span>
            </div>
            <form onSubmit={submitOutcome} className="mt-3 flex flex-col gap-2">
              <div className="grid grid-cols-[9rem_1fr] gap-2">
                <select
                  value={outcomeKind}
                  onChange={(event) => setOutcomeKind(event.target.value as DurableOutcomeKind)}
                  className="h-10 rounded-lg border border-white/12 bg-[#0b1528] px-2 text-xs text-white outline-none focus-visible:border-[#fbbf24]"
                >
                  {OUTCOME_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={outcomeMutation.isPending || isWrapped}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#fbbf24]/45 px-3 text-xs font-semibold text-[#fde68a] hover:bg-[#fbbf24]/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {outcomeMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="size-3.5" aria-hidden />
                  )}
                  Lưu outcome
                </button>
              </div>
              <textarea
                value={outcomeContent}
                onChange={(event) => setOutcomeContent(event.target.value)}
                maxLength={16000}
                rows={2}
                placeholder="Điều muốn giữ lại cho quyết định hoặc output…"
                className="resize-y rounded-lg border border-white/12 bg-white/[0.035] px-3 py-2 text-xs leading-relaxed text-white outline-none placeholder:text-white/30 focus-visible:border-[#fbbf24]"
              />
            </form>
            <div className="mt-3 flex flex-col gap-2">
              {(outcomesQuery.data ?? [])
                .slice(-4)
                .reverse()
                .map((outcome) => (
                  <div key={outcome.outcomeId} className="rounded-lg bg-white/[0.035] px-3 py-2">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-[#fde68a]/80">
                      {KIND_LABELS[outcome.kind]}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/65">
                      {contentText(outcome.content)}
                    </p>
                  </div>
                ))}
            </div>
          </section>

          <section className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#a5f3fc]" aria-hidden />
              <div>
                <p className="text-xs font-semibold text-white/85">Subtask / fork</p>
                <p className="mt-1 text-[11px] text-white/40">
                  Tạo nhánh có grounded snapshot từ lượt gốc gần nhất; kết quả sẽ trả về outcomes
                  của conversation chính.
                </p>
              </div>
            </div>
            <form onSubmit={submitIdeation} className="mt-3 flex gap-2">
              <input
                value={ideationPrompt}
                onChange={(event) => setIdeationPrompt(event.target.value)}
                maxLength={4000}
                disabled={isWrapped}
                placeholder="Ví dụ: tìm thêm 5 hướng khác…"
                className="h-10 min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.035] px-3 text-xs text-white outline-none placeholder:text-white/30 focus-visible:border-[#67e8f9] disabled:opacity-45"
              />
              <button
                type="submit"
                disabled={!ideationPrompt.trim() || ideationMutation.isPending || isWrapped}
                aria-label="Bắt đầu ideation"
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#67e8f9]/45 text-[#a5f3fc] hover:bg-[#22d3ee]/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {ideationMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
              </button>
            </form>
            {jobs.length ? (
              <div className="mt-3 flex flex-col gap-2">
                {displayJobs.slice(0, 3).map((job) => (
                  <button
                    key={job.jobId}
                    type="button"
                    onClick={() => setSelectedJobId(job.jobId)}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-lg border px-3 text-left transition-colors",
                      selectedJob?.jobId === job.jobId
                        ? "border-[#67e8f9]/40 bg-[#22d3ee]/8"
                        : "border-white/10 hover:border-white/25"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-xs text-white/70">
                      {job.prompt}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                      {job.status}
                    </span>
                  </button>
                ))}
                {liveSelectedJob &&
                (liveSelectedJob.status === "running" || liveSelectedJob.status === "queued") ? (
                  <button
                    type="button"
                    onClick={() => cancelMutation.mutate(liveSelectedJob.jobId)}
                    disabled={cancelMutation.isPending}
                    className="inline-flex min-h-10 items-center gap-2 self-start text-xs font-semibold text-[#fdba74] hover:text-[#fed7aa] disabled:opacity-50"
                  >
                    <Pause className="size-3.5" aria-hidden /> Hủy nhánh đang chạy
                  </button>
                ) : null}
              </div>
            ) : null}
            {liveSelectedJob?.status === "completed" ? (
              <div className="mt-3 flex flex-col gap-2">
                {candidatesQuery.isPending ? (
                  <p className="text-xs text-white/45">Đang tải candidates…</p>
                ) : null}
                {(candidatesQuery.data ?? []).map((candidate) => (
                  <CandidateRow
                    key={candidate.candidateId}
                    candidate={candidate}
                    accepting={acceptMutation.isPending}
                    rejecting={rejectMutation.isPending}
                    onAccept={() => acceptMutation.mutate(candidate)}
                    onReject={() => rejectMutation.mutate(candidate)}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section className="mt-4 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => completeMutation.mutate()}
              disabled={
                isWrapped || Boolean(activeTurn) || turnInProgress || completeMutation.isPending
              }
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#fbbf24]/45 px-3 text-xs font-semibold text-[#fde68a] hover:bg-[#fbbf24]/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {completeMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="size-3.5" aria-hidden />
              )}
              {activeTurn || turnInProgress
                ? "Đợi lượt hiện tại hoàn tất"
                : isWrapped
                  ? "Session đã kết thúc"
                  : "Kết thúc session"}
            </button>
          </section>

          {notice ? (
            <p
              role="status"
              className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-[#a5f3fc]/85"
            >
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WorkingBriefEditor({
  brief,
  briefStatus,
  briefRevision,
  hasConfirmedBrief,
  isDirty,
  onTextChange,
  onListChange,
  onSave,
  onConfirm,
  savePending,
  confirmPending,
  isWrapped,
}: {
  brief: WorkingBrief;
  briefStatus: BriefStatus;
  briefRevision?: number;
  hasConfirmedBrief: boolean;
  isDirty: boolean;
  onTextChange: (field: "goal" | "context" | "audience", value: string) => void;
  onListChange: (field: "constraints" | "successCriteria", value: string[] | null) => void;
  onSave: () => void;
  onConfirm: () => void;
  savePending: boolean;
  confirmPending: boolean;
  isWrapped: boolean;
}) {
  const filled = [
    brief.goal,
    brief.context,
    brief.audience,
    brief.constraints?.length ? brief.constraints.join("\n") : null,
    brief.successCriteria?.length ? brief.successCriteria.join("\n") : null,
  ].filter(Boolean).length;
  const canConfirm = briefReady(brief);
  const statusLabel = hasConfirmedBrief
    ? "ĐÃ XÁC NHẬN"
    : canConfirm || briefStatus === "ready_for_confirmation"
      ? "SẴN SÀNG XÁC NHẬN"
      : `${filled}/5 ĐANG LÀM RÕ`;

  return (
    <section className="mt-4 border-t border-white/10 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-white/90">Working Brief</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/42">
            Agent sẽ tự bổ sung từ các lượt brainstorm. Bạn có thể sửa inline rồi xác nhận khi đủ
            rõ.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.08em]",
            hasConfirmedBrief
              ? "bg-[#fbbf24]/12 text-[#fde68a]"
              : canConfirm
                ? "bg-[#a7f3d0]/12 text-[#a7f3d0]"
                : "bg-white/8 text-white/45"
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 grid gap-2.5">
        <BriefTextField
          id="working-brief-goal"
          label="Mục tiêu"
          value={briefFieldValue(brief.goal)}
          placeholder="Phiên này cần giúp nhóm quyết định hoặc tạo ra điều gì?"
          onChange={(value) => onTextChange("goal", value)}
        />
        <BriefTextField
          id="working-brief-context"
          label="Bối cảnh"
          value={briefFieldValue(brief.context)}
          placeholder="Điều gì đang diễn ra hoặc đã được biết?"
          onChange={(value) => onTextChange("context", value)}
        />
        <BriefTextField
          id="working-brief-audience"
          label="Đối tượng"
          value={briefFieldValue(brief.audience)}
          placeholder="Ai sẽ dùng hoặc bị ảnh hưởng?"
          onChange={(value) => onTextChange("audience", value)}
        />
        <BriefListField
          id="working-brief-constraints"
          label="Ràng buộc · mỗi dòng một ý"
          value={brief.constraints?.join("\n") ?? ""}
          placeholder="Ngân sách…\nThời gian…"
          onChange={(value) => onListChange("constraints", value ? splitBriefLines(value) : null)}
        />
        <BriefListField
          id="working-brief-success"
          label="Tiêu chí thành công · mỗi dòng một ý"
          value={brief.successCriteria?.join("\n") ?? ""}
          placeholder="Có hướng ưu tiên rõ ràng…"
          onChange={(value) =>
            onListChange("successCriteria", value ? splitBriefLines(value) : null)
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={isWrapped || savePending || confirmPending}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/18 px-3 text-[11px] font-semibold text-white/75 transition-colors hover:border-[#67e8f9]/45 hover:text-[#a5f3fc] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {savePending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Cập nhật brief
        </button>
        {!hasConfirmedBrief ? (
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isDirty || isWrapped || savePending || confirmPending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#fbbf24]/45 px-3 text-[11px] font-semibold text-[#fde68a] transition-colors hover:bg-[#fbbf24]/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {confirmPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Xác nhận Session Brief
          </button>
        ) : null}
        {!hasConfirmedBrief && isDirty ? (
          <span className="basis-full text-[10px] text-white/38">
            Cập nhật Working Brief trước khi xác nhận.
          </span>
        ) : null}
        {typeof briefRevision === "number" ? (
          <span className="text-[10px] text-white/30">revision {briefRevision}</span>
        ) : null}
      </div>
    </section>
  );
}

function BriefTextField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.08em] text-white/45">{label}</span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={4000}
        placeholder={placeholder}
        className="h-9 rounded-lg border border-white/12 bg-white/[0.035] px-3 text-xs text-white outline-none placeholder:text-white/28 focus-visible:border-[#67e8f9]"
      />
    </label>
  );
}

function BriefListField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.08em] text-white/45">{label}</span>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={12000}
        rows={2}
        placeholder={placeholder}
        className="resize-y rounded-lg border border-white/12 bg-white/[0.035] px-3 py-2 text-xs leading-relaxed text-white outline-none placeholder:text-white/28 focus-visible:border-[#67e8f9]"
      />
    </label>
  );
}

function CandidateRow({
  candidate,
  accepting,
  rejecting,
  onAccept,
  onReject,
}: {
  candidate: AutonomousIdeationCandidate;
  accepting: boolean;
  rejecting: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const pending = candidate.status !== "pending";
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5">
      <p className="text-xs leading-relaxed text-white/70">{contentText(candidate.content)}</p>
      {!pending ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting || rejecting}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#a7f3d0]/40 px-2.5 text-[11px] font-semibold text-[#a7f3d0] hover:bg-[#a7f3d0]/10 disabled:opacity-45"
          >
            <Check className="size-3.5" aria-hidden /> Nhận
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={accepting || rejecting}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-[11px] font-semibold text-white/50 hover:text-white/80 disabled:opacity-45"
          >
            <X className="size-3.5" aria-hidden /> Bỏ qua
          </button>
        </div>
      ) : null}
    </div>
  );
}
