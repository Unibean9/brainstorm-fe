import { ROOM_GRAPH_PHASES } from "../data/room-graph-mock";
import { GRAPH_LUMINOUS, resolveGraphNodeColor } from "../data/room-graph-palette";
import { roomImmersiveCanvas } from "./room-immersive-surfaces";
import type { RoomGraphData, RoomGraphNode } from "../data/room-graph-types";
import { cn } from "@/lib/utils";

type RoomGraphFallbackProps = {
  data: RoomGraphData;
  selectedNodeId: string | null;
  focusPhaseKey?: string | null;
  onNodeSelect: (node: RoomGraphNode | null) => void;
};

const CX = 220;
const CY = 200;
const RADIUS = 130;

export function RoomGraphFallback({
  data,
  selectedNodeId,
  focusPhaseKey,
  onNodeSelect,
}: RoomGraphFallbackProps) {
  const phaseNodes = data.nodes.filter((n) => n.type === "phase");
  const hub = data.nodes.find((n) => n.type === "room");
  const satellites = data.nodes.filter(
    (n) => n.type !== "room" && n.type !== "phase"
  );

  return (
    <svg
      viewBox="0 0 440 400"
      className={cn("h-full w-full", roomImmersiveCanvas)}
      role="img"
      aria-label="Knowledge graph tĩnh — topology phase brainstorm"
    >
      {data.links.map((link, i) => {
        const source = data.nodes.find((n) => n.id === link.source);
        const target = data.nodes.find((n) => n.id === link.target);
        if (!source || !target) return null;

        const s = nodePos(source, phaseNodes.indexOf(source));
        const t = nodePos(target, phaseNodes.indexOf(target));
        const touchesSelection =
          selectedNodeId != null &&
          (selectedNodeId === source.id || selectedNodeId === target.id);
        return (
          <line
            key={`${link.source}-${link.target}-${i}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke={
              touchesSelection ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.14)"
            }
            strokeWidth={touchesSelection ? 2 : link.type === "progression" ? 1.5 : 1}
            strokeDasharray={link.type === "loop-back" ? "4 3" : undefined}
          />
        );
      })}

      {phaseNodes.map((node, index) => {
        const { x, y } = nodePos(node, index);
        const active = focusPhaseKey === node.phaseKey;
        const fill = resolveGraphNodeColor(node, selectedNodeId, focusPhaseKey ?? null);
        return (
          <g key={node.id} className="cursor-pointer" onClick={() => onNodeSelect(node)}>
            <circle
              cx={x}
              cy={y}
              r={active ? 12 : 9}
              fill={fill}
              fillOpacity={1}
              stroke={active ? "#ffffff" : "transparent"}
              strokeWidth={2}
            />
            <text
              x={x}
              y={y + 20}
              textAnchor="middle"
              className="fill-white/60 text-[9px]"
            >
              {ROOM_GRAPH_PHASES.find((p) => p.key === node.phaseKey)?.short}
            </text>
          </g>
        );
      })}

      {hub ? (
        <g className="cursor-pointer" onClick={() => onNodeSelect(hub)}>
          {selectedNodeId === hub.id ? (
            <circle cx={CX} cy={CY} r={22} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
          ) : null}
          <circle
            cx={CX}
            cy={CY}
            r={selectedNodeId === hub.id ? 18 : 16}
            fill={resolveGraphNodeColor(hub, selectedNodeId, focusPhaseKey ?? null)}
            stroke={GRAPH_LUMINOUS.hub}
            strokeWidth={selectedNodeId === hub.id ? 0 : 2}
          />
          <text x={CX} y={CY + 4} textAnchor="middle" className="fill-white text-[8px] font-semibold">
            Room
          </text>
        </g>
      ) : null}

      {satellites.map((node, i) => {
        const angle = (i / Math.max(satellites.length, 1)) * Math.PI * 2;
        const x = CX + Math.cos(angle) * (RADIUS + 42 + (i % 3) * 12);
        const y = CY + Math.sin(angle) * (RADIUS * 0.5 + 28 + (i % 2) * 10);
        const selected = selectedNodeId === node.id;
        return (
          <g key={node.id} className="cursor-pointer" onClick={() => onNodeSelect(node)}>
            <circle
              cx={x}
              cy={y}
              r={selected ? 8 : 5}
              fill={resolveGraphNodeColor(node, selectedNodeId, focusPhaseKey ?? null)}
              fillOpacity={1}
              className={cn(selected && "stroke-white stroke-[2px]")}
            />
          </g>
        );
      })}
    </svg>
  );
}

function nodePos(node: RoomGraphNode, phaseIndex: number) {
  if (node.type === "room") return { x: CX, y: CY };
  if (node.type === "phase") {
    const angle = (phaseIndex / 8) * Math.PI * 2 - Math.PI / 2;
    return {
      x: CX + Math.cos(angle) * RADIUS,
      y: CY + Math.sin(angle) * RADIUS * 0.55,
    };
  }
  return { x: CX, y: CY };
}
