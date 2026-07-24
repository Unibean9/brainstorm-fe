"use client";

import { Slider } from "@/components/ui/slider";

type RoomReplayTimelineProps = {
  durationMinutes: number;
  positionPercent: number;
  onPositionChange: (percent: number) => void;
};

export function RoomReplayTimeline({
  durationMinutes,
  positionPercent,
  onPositionChange,
}: RoomReplayTimelineProps) {
  const currentMinute = Math.round((positionPercent / 100) * durationMinutes);

  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 text-xs tabular-nums text-[#1c1917]/55">
        {formatTime(currentMinute)} / {formatTime(durationMinutes)}
      </span>
      <Slider
        value={[positionPercent]}
        max={100}
        step={1}
        onValueChange={(value) => {
          const next = Array.isArray(value) ? value[0] : value;
          if (typeof next === "number") onPositionChange(next);
        }}
        className="flex-1 [&_[data-slot=slider-range]]:bg-[#ea580c] [&_[data-slot=slider-thumb]]:border-[#ea580c]/60"
        aria-label="Vị trí replay phiên"
      />
      <span className="shrink-0 text-xs text-[#1c1917]/55">Replay</span>
    </div>
  );
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} phút`;
}
