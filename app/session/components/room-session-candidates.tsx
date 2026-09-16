"use client";

import type { AutonomousIdeationCandidate } from "@/types/brainstorm-domain";

type RoomSessionCandidatesProps = {
  candidates: AutonomousIdeationCandidate[];
};

function candidateText(candidate: AutonomousIdeationCandidate) {
  if (candidate.text?.trim()) return candidate.text;
  if (typeof candidate.content === "string" && candidate.content.trim()) return candidate.content;
  if (candidate.content == null) return "Chưa có nội dung hướng này.";
  try {
    return JSON.stringify(candidate.content);
  } catch {
    return "Chưa có nội dung hướng này.";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "accepted":
      return "ĐÃ CHỌN";
    case "rejected":
      return "ĐÃ BỎ";
    default:
      return "CHỜ XÁC NHẬN";
  }
}

export function RoomSessionCandidates({ candidates }: RoomSessionCandidatesProps) {
  if (!candidates.length) return null;

  return (
    <section className="mt-6 flex flex-col gap-3" aria-label="Các hướng được đề xuất">
      <p className="text-center text-xs font-semibold tracking-[0.22em] text-cyan-100/55">
        CÁC HƯỚNG ĐỀ XUẤT
      </p>
      <div className="flex flex-col gap-3">
        {candidates.map((candidate, index) => (
          <article
            key={candidate.candidateId}
            className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left"
          >
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold tracking-[0.12em] text-cyan-100/60">
              <span>HƯỚNG {candidate.ordinal ?? index + 1}</span>
              <span>{statusLabel(candidate.status)}</span>
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-relaxed text-white">
              {candidateText(candidate)}
            </p>
            <p className="mt-2 text-[10px] tracking-[0.08em] text-white/35">
              AI · TỪ CUỘC TRÒ CHUYỆN
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
