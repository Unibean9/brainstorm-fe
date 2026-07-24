import {
  WORKFLOW_NODES_HOME,
  type WorkflowNodeId,
} from "@/app/session/components/room-orb-layout";

/** Số engine node trên ring — luôn khớp WORKFLOW_NODES_HOME */
export const ENGINE_STEP_COUNT = WORKFLOW_NODES_HOME.length;

/** step index → node (BE contract — giữ thứ tự cố định) */
export const WORKFLOW_ENGINE_STEPS = WORKFLOW_NODES_HOME.map((node, step) => ({
  step,
  id: node.id,
  label: node.label,
}));

export function clampEngineStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(ENGINE_STEP_COUNT - 1, Math.max(0, Math.floor(step)));
}

export function engineStepNodeId(step: number): WorkflowNodeId {
  return WORKFLOW_NODES_HOME[clampEngineStep(step)]!.id;
}

export function engineStepIndex(nodeId: WorkflowNodeId): number {
  const idx = WORKFLOW_NODES_HOME.findIndex((n) => n.id === nodeId);
  return idx >= 0 ? idx : 0;
}

export function normalizeEngineStepPayload(
  step: number,
  focusNodeId?: string | null
): { step: number; focusNodeId: WorkflowNodeId } {
  const clamped = clampEngineStep(step);
  const defaultId = engineStepNodeId(clamped);
  if (
    focusNodeId &&
    WORKFLOW_NODES_HOME.some((n) => n.id === focusNodeId)
  ) {
    return { step: clamped, focusNodeId: focusNodeId as WorkflowNodeId };
  }
  return { step: clamped, focusNodeId: defaultId };
}

/** Demo orchestration — BE có thể emit tương tự trong SSE turn */
export const DEMO_TURN_ENGINE_TIMELINE: ReadonlyArray<{
  offsetMs: number;
  step: number;
}> = [
  { offsetMs: 0, step: 0 },
  { offsetMs: 140, step: 1 },
  { offsetMs: 280, step: 2 },
  { offsetMs: 420, step: 3 },
  { offsetMs: 560, step: 4 },
  { offsetMs: 720, step: 5 },
];
