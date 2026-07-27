import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { BrainstormPhaseKey } from "@/types/brainstorm-stream";

/** BE `wrap-up` → UI phase Action */
export function isSessionReadyForReport(
  sessionPhaseKey: BrainstormPhaseKey | null | undefined,
  transcript: TranscriptEntry[]
): boolean {
  if (sessionPhaseKey === "wrap-up") return true;

  const agents = transcript.filter((e) => e.speaker === "agent" && e.text.trim());
  const lastAgent = agents[agents.length - 1];
  return lastAgent?.phaseKey === "Action";
}
