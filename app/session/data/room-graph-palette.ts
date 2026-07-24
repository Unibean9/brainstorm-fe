import { GRAPH_HEX } from "./room-graph-mock";
import type { RoomGraphLink, RoomGraphNode } from "./room-graph-types";

/** Deepened workshop palette — readable on warm-paper canvas (#faf7f2) */
export const GRAPH_LUMINOUS = {
  /** Room hub (nhân) — terracotta anchor, tách khỏi phase + sticky idea vàng */
  hub: "#c2571f",
  framing: "#0f766e",
  context: "#be185d",
  explore: "#0369a1",
  expand: "#7e22ce",
  challenge: "#c2410c",
  insight: "#15803d",
  decision: "#a21caf",
  action: "#1d4ed8",
  sticky: "#ca8a04",
  coral: GRAPH_HEX.coral,
  sky: "#0284c7",
  artifact: "#78716c",
  output: "#a8a29e",
} as const;

const INK = "#1c1917";
const SELECTED = GRAPH_HEX.coral;

const phaseLuminous: Record<string, string> = {
  Framing: GRAPH_LUMINOUS.framing,
  Context: GRAPH_LUMINOUS.context,
  Explore: GRAPH_LUMINOUS.explore,
  Expand: GRAPH_LUMINOUS.expand,
  Challenge: GRAPH_LUMINOUS.challenge,
  Insight: GRAPH_LUMINOUS.insight,
  Decision: GRAPH_LUMINOUS.decision,
  Action: GRAPH_LUMINOUS.action,
};

function baseLuminousColor(node: RoomGraphNode): string {
  if (node.phaseKey && phaseLuminous[node.phaseKey]) {
    if (node.type === "phase") return phaseLuminous[node.phaseKey];
  }

  switch (node.type) {
    case "room":
      return GRAPH_LUMINOUS.hub;
    case "technique":
      return GRAPH_LUMINOUS.sky;
    case "idea":
      return node.color === GRAPH_HEX.sticky ? GRAPH_LUMINOUS.sticky : node.color;
    case "insight":
      return GRAPH_LUMINOUS.insight;
    case "artifact":
      return GRAPH_LUMINOUS.artifact;
    case "output":
      return GRAPH_LUMINOUS.output;
    default:
      return node.color;
  }
}

export function resolveGraphNodeColor(
  node: RoomGraphNode,
  selectedId: string | null,
  _focusPhase: string | null = null
): string {
  if (node.id === selectedId) return SELECTED;
  return baseLuminousColor(node);
}

export function resolveGraphNodeVal(
  node: RoomGraphNode,
  selectedId: string | null
): number {
  const base =
    node.type === "room" ? 1.25 : node.type === "phase" ? 1.08 : 1;
  if (node.id === selectedId) {
    return node.type === "room" ? base * 1.35 : base * 1.28;
  }
  return base;
}

function linkEndpointId(endpoint: string | RoomGraphNode): string {
  return typeof endpoint === "object" ? endpoint.id! : String(endpoint);
}

export function linkTouchesSelection(
  link: RoomGraphLink,
  selectedId: string | null
): boolean {
  if (!selectedId) return false;
  return (
    linkEndpointId(link.source) === selectedId ||
    linkEndpointId(link.target) === selectedId
  );
}

export function resolveLinkColor(
  link: RoomGraphLink,
  selectedId: string | null
): string {
  const base = "rgba(28,25,23,0.16)";
  if (!selectedId) return base;
  if (linkTouchesSelection(link, selectedId)) return INK;
  return base;
}

export function resolveLinkParticles(
  link: RoomGraphLink,
  selectedId: string | null,
  liveParticles: boolean
): number {
  if (linkTouchesSelection(link, selectedId)) {
    return link.type === "evolved-from" ? 3 : 2;
  }
  if (liveParticles && link.type === "evolved-from") return 1;
  return 0;
}

export function resolveLinkParticleColor(
  link: RoomGraphLink,
  selectedId: string | null,
  nodes: RoomGraphNode[]
): string {
  if (!selectedId || !linkTouchesSelection(link, selectedId)) {
    return GRAPH_LUMINOUS.sky;
  }
  const selected = nodes.find((n) => n.id === selectedId);
  if (!selected) return SELECTED;
  if (selected.type === "room") return GRAPH_LUMINOUS.hub;
  return resolveGraphNodeColor(selected, null);
}
