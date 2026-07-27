/** Shared orb geometry — keep hub canvas + SVG circuits in sync */

/** Home (center stage) */
export const ORB_CX = 0.5;
export const ORB_CY = 0.44;
/** Smaller than before (was ~0.205) — khớp reference hình 1 */
export const ORB_RADIUS_FACTOR = 0.142;

/** Docked when Chat open — top-right, smaller */
export const ORB_DOCK_CX = 0.82;
export const ORB_DOCK_CY = 0.28;
export const ORB_DOCK_RADIUS_FACTOR = 0.088;

export function orbCoreRadius(w: number, h: number, radiusFactor = ORB_RADIUS_FACTOR) {
  return Math.max(18, Math.min(w, h) * radiusFactor);
}

/** Soft spoke curve: rim orb → node */
export function spokeCurvePath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bend: number
) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return `M ${ax} ${ay} Q ${mx + (-dy / len) * bend} ${my + (dx / len) * bend} ${bx} ${by}`;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function orbCenter(dockAmt: number) {
  return {
    cx: lerp(ORB_CX, ORB_DOCK_CX, dockAmt),
    cy: lerp(ORB_CY, ORB_DOCK_CY, dockAmt),
    radiusFactor: lerp(ORB_RADIUS_FACTOR, ORB_DOCK_RADIUS_FACTOR, dockAmt),
  };
}

/** 8 engine nodes — home orbit around center orb */
export const WORKFLOW_NODES_HOME = [
  {
    id: "observer",
    label: "Observer",
    accent: "gold" as const,
    x: 0.33,
    y: 0.27,
    blurb: "Thu tín hiệu phòng & ngữ cảnh",
  },
  {
    id: "analyzer",
    label: "Analyzer",
    accent: "cyan" as const,
    x: 0.67,
    y: 0.25,
    blurb: "Phân rã ý tưởng thành pattern",
  },
  {
    id: "diagnosis",
    label: "Diagnosis",
    accent: "gold" as const,
    x: 0.78,
    y: 0.42,
    blurb: "Chẩn đoán tắc nghẽn tư duy",
  },
  {
    id: "thinking-state",
    label: "Thinking State",
    accent: "cyan" as const,
    x: 0.75,
    y: 0.58,
    blurb: "Chọn trạng thái tư duy phù hợp",
  },
  {
    id: "technique",
    label: "Technique",
    accent: "gold" as const,
    x: 0.62,
    y: 0.72,
    blurb: "Gợi ý technique brainstorm",
  },
  {
    id: "facilitate",
    label: "Facilitate",
    accent: "gold" as const,
    x: 0.37,
    y: 0.71,
    blurb: "Điều phối vòng hội thoại",
  },
  {
    id: "trace",
    label: "Trace",
    accent: "cyan" as const,
    x: 0.23,
    y: 0.56,
    blurb: "Ghi Thinking Trace có nguồn",
  },
  {
    id: "insight",
    label: "Insight",
    accent: "cyan" as const,
    x: 0.25,
    y: 0.36,
    blurb: "Chốt insight hành động được",
  },
] as const;

export type WorkflowNodeId = (typeof WORKFLOW_NODES_HOME)[number]["id"];

/**
 * Hang offsets from current orb center — nodes travel with the orb as one flock.
 */
export const WORKFLOW_NODES_HANG_OFFSET: Record<WorkflowNodeId, { dx: number; dy: number }> = {
  observer: { dx: -0.11, dy: 0.14 },
  insight: { dx: -0.16, dy: 0.24 },
  analyzer: { dx: 0.08, dy: 0.12 },
  diagnosis: { dx: 0.12, dy: 0.24 },
  "thinking-state": { dx: 0.06, dy: 0.36 },
  technique: { dx: -0.04, dy: 0.42 },
  facilitate: { dx: -0.14, dy: 0.34 },
  trace: { dx: -0.08, dy: 0.26 },
};
