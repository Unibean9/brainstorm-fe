import type { RoomPhaseKey, TranscriptEntry } from "@/app/session/data/room-graph-types";
import type {
  ApiTranscriptMessage,
  BrainstormPhaseKey,
  BrainstormSessionSnapshot,
} from "@/types/brainstorm-stream";

const BE_PHASE_TO_UI: Record<BrainstormPhaseKey, RoomPhaseKey> = {
  framing: "Framing",
  diverging: "Explore",
  shifting: "Expand",
  critiquing: "Challenge",
  converging: "Decision",
  "wrap-up": "Action",
};

export function mapBePhaseToUi(phaseKey?: string | null): RoomPhaseKey {
  if (!phaseKey) return "Framing";
  return BE_PHASE_TO_UI[phaseKey as BrainstormPhaseKey] ?? "Framing";
}

function formatTimeFromIso(iso: string) {
  const ts = Date.parse(iso);
  const date = Number.isFinite(ts) ? new Date(ts) : new Date();
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function mapApiTranscriptMessage(message: ApiTranscriptMessage): TranscriptEntry {
  const ts = Date.parse(message.createdAt);
  return {
    id: message.messageId,
    speaker: message.role === "user" ? "user" : "agent",
    text: message.text,
    time: formatTimeFromIso(message.createdAt),
    timestampMs: Number.isFinite(ts) ? ts : Date.now(),
    phaseKey: mapBePhaseToUi(undefined),
  };
}

export function mapSessionSnapshot(snapshot: BrainstormSessionSnapshot) {
  const transcript = (snapshot.transcript ?? []).map(mapApiTranscriptMessage);
  return {
    ...snapshot,
    uiPhaseKey: mapBePhaseToUi(snapshot.phaseKey),
    transcript,
  };
}
