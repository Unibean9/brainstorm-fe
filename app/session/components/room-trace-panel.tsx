import type { RoomGraphNode } from "../data/room-graph-types";

type RoomTracePanelProps = {
  node: RoomGraphNode;
};

export function RoomTracePanel({ node }: RoomTracePanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <p className="text-xs text-white/45">Thinking Trace</p>
        <h2 className="font-heading text-base font-semibold text-balance text-white">
          {node.label}
        </h2>
        <p className="mt-1 text-xs text-white/40">
          {node.type}
          {node.phaseKey ? ` · ${node.phaseKey}` : ""}
        </p>
      </div>

      {node.trace?.length ? (
        <ol className="space-y-2 overflow-y-auto pr-1">
          {node.trace.map((event, index) => (
            <li
              key={`${event.time}-${index}`}
              className="rounded-xl border border-white/8 bg-white/5 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-white/90">{event.event}</span>
                <span className="shrink-0 text-[10px] text-white/40">{event.time}</span>
              </div>
              {event.technique ? (
                <p className="mt-1 text-xs text-primary">{event.technique}</p>
              ) : null}
              <p className="mt-1 text-sm text-pretty text-white/60">{event.detail}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-white/45">
          Chọn một idea trên graph để xem lịch sử hình thành.
        </p>
      )}
    </div>
  );
}
