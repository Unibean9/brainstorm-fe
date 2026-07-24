import { mockRooms } from "./mock-data";
import type {
  RoomGraphData,
  RoomGraphLink,
  RoomGraphNode,
  RoomPhaseKey,
  RoomSessionMeta,
  TranscriptEntry,
  TraceEvent,
} from "./room-graph-types";

/**
 * Knowledge graph topology (ai-brainstorm-room-tool-concept.md)
 *
 * Room hub = session anchor (tên room / topic) — mọi phase `contains` từ hub.
 * Mỗi phase = một “phần” trong state machine; kiến thức (artifact, technique,
 * idea, insight, output) `contains` từ phase tương ứng.
 * Liên kết chéo: progression (gợi ý), loop-back (quay phase), evolved-from (trace).
 */

const STICKY = "#fde047";
const CORAL = "#ea580c";
const SKY = "#0ea5e9";
const ARTIFACT = "#cbd5e1";
const OUTPUT = "#e2e8f0";

export const GRAPH_HEX = {
  hub: "#ffc896",
  framing: "#14b8a6",
  context: "#ec4899",
  explore: "#38bdf8",
  expand: "#a855f7",
  challenge: "#f97316",
  insight: "#22c55e",
  decision: "#f472b6",
  action: "#93c5fd",
  sticky: STICKY,
  coral: CORAL,
  sky: SKY,
  artifact: ARTIFACT,
  output: OUTPUT,
} as const;

export const ROOM_GRAPH_PHASES: {
  key: RoomPhaseKey;
  label: string;
  short: string;
  color: string;
}[] = [
  { key: "Framing", label: "Problem Framing", short: "Fr", color: GRAPH_HEX.framing },
  { key: "Context", label: "Context Building", short: "Cx", color: GRAPH_HEX.context },
  { key: "Explore", label: "Explore", short: "Ex", color: GRAPH_HEX.explore },
  { key: "Expand", label: "Expand", short: "Xp", color: GRAPH_HEX.expand },
  { key: "Challenge", label: "Challenge", short: "Ch", color: GRAPH_HEX.challenge },
  { key: "Insight", label: "Insight", short: "In", color: GRAPH_HEX.insight },
  { key: "Decision", label: "Decision", short: "De", color: GRAPH_HEX.decision },
  { key: "Action", label: "Action Planning", short: "Ac", color: GRAPH_HEX.action },
];

const QR_WIFI_TRACE: TraceEvent[] = [
  {
    time: "09:15",
    event: "created",
    technique: "SCAMPER",
    detail: "Sinh ra trong vòng Combine — QR + WiFi",
  },
  {
    time: "09:22",
    event: "expanded",
    technique: "Six Thinking Hats",
    detail: "Green Hat: thêm WiFi validation chống share QR",
  },
  {
    time: "09:28",
    event: "challenged",
    technique: "Devil's Advocate",
    detail: "Rủi ro: user chụp QR gửi cho người khác",
  },
  {
    time: "09:35",
    event: "improved",
    technique: "First Principles",
    detail: "Time window + office WiFi requirement",
  },
  {
    time: "09:45",
    event: "scored",
    detail: "ICE: Impact 9 · Confidence 8 · Ease 9",
  },
  {
    time: "09:50",
    event: "decision",
    detail: "Chọn cho MVP",
  },
];

function phaseIndex(key: RoomPhaseKey) {
  return ROOM_GRAPH_PHASES.findIndex((p) => p.key === key);
}

function addPhaseNodes(nodes: RoomGraphNode[]) {
  const radius = 118;
  ROOM_GRAPH_PHASES.forEach((phase, index) => {
    const angle = (index / ROOM_GRAPH_PHASES.length) * Math.PI * 2 - Math.PI / 2;
    const layer = index % 2 === 0 ? 1 : 0.88;
    nodes.push({
      id: `phase-${phase.key}`,
      label: phase.label,
      type: "phase",
      phaseKey: phase.key,
      color: phase.color,
      val: 1,
      status: index <= phaseIndex("Decision") ? "complete" : "pending",
      x: Math.cos(angle) * radius * layer,
      y: Math.sin(angle) * radius * 0.62 * layer,
      z: Math.sin(angle * 1.35) * 72,
    });
  });
}

function offsetNearPhase(phaseKey: RoomPhaseKey, seed: number) {
  const index = phaseIndex(phaseKey);
  const angle = (index / ROOM_GRAPH_PHASES.length) * Math.PI * 2 - Math.PI / 2;
  const radius = 118 * (index % 2 === 0 ? 1 : 0.88);
  const px = Math.cos(angle) * radius;
  const py = Math.sin(angle) * radius * 0.62;
  const pz = Math.sin(angle * 1.35) * 56;
  const spread = 28 + (seed % 4) * 10;
  const a2 = angle + (seed % 7) * 0.38;
  return {
    x: px + Math.cos(a2) * spread,
    y: py + Math.sin(a2) * spread * 0.7,
    z: pz + ((seed % 5) - 2) * 18,
  };
}

const PHASE_KNOWLEDGE: Record<RoomPhaseKey, { label: string; kind: RoomGraphNode["type"] }[]> = {
  Framing: [
    { label: "Problem Statement", kind: "artifact" },
    { label: "Goal phiên", kind: "artifact" },
    { label: "Stakeholder chính", kind: "artifact" },
    { label: "Success Criteria", kind: "artifact" },
  ],
  Context: [
    { label: "User Persona", kind: "artifact" },
    { label: "Current Workflow", kind: "artifact" },
    { label: "Pain Points", kind: "artifact" },
    { label: "Assumptions", kind: "artifact" },
  ],
  Explore: [
    { label: "QR + WiFi", kind: "idea" },
    { label: "GPS check-in", kind: "idea" },
    { label: "NFC tag", kind: "idea" },
    { label: "Zalo bot", kind: "idea" },
    { label: "Morphological matrix", kind: "idea" },
  ],
  Expand: [
    { label: "White Hat notes", kind: "artifact" },
    { label: "Black Hat risks", kind: "artifact" },
    { label: "Green Hat variants", kind: "idea" },
    { label: "Stakeholder lens", kind: "artifact" },
  ],
  Challenge: [
    { label: "Fake QR risk", kind: "artifact" },
    { label: "Buddy punch", kind: "artifact" },
    { label: "Five Whys chain", kind: "artifact" },
    { label: "Pre-mortem", kind: "artifact" },
  ],
  Insight: [
    { label: "Cluster: Automation", kind: "artifact" },
    { label: "Cluster: Anti-fraud", kind: "artifact" },
    { label: "Key pattern", kind: "insight" },
    { label: "Opportunity area", kind: "artifact" },
  ],
  Decision: [
    { label: "ICE: QR+WiFi", kind: "artifact" },
    { label: "ICE: GPS", kind: "artifact" },
    { label: "ICE: FaceID", kind: "artifact" },
    { label: "MVP candidate", kind: "artifact" },
  ],
  Action: [
    { label: "Product Brief", kind: "output" },
    { label: "PRD seed", kind: "output" },
    { label: "Event Storming", kind: "output" },
    { label: "Validation plan", kind: "artifact" },
  ],
};

function addPhaseKnowledge(nodes: RoomGraphNode[], links: RoomGraphLink[]) {
  let seed = 24;

  (Object.entries(PHASE_KNOWLEDGE) as [RoomPhaseKey, (typeof PHASE_KNOWLEDGE)[RoomPhaseKey]][]).forEach(
    ([phaseKey, items]) => {
      const phaseColor = ROOM_GRAPH_PHASES.find((p) => p.key === phaseKey)?.color ?? STICKY;

      items.forEach((item, index) => {
        const id = `knowledge-${phaseKey}-${index}`;
        const color =
          item.kind === "idea"
            ? STICKY
            : item.kind === "technique"
              ? SKY
              : item.kind === "insight"
                ? GRAPH_HEX.insight
                : item.kind === "output"
                  ? OUTPUT
                  : ARTIFACT;

        nodes.push({
          id,
          label: item.label,
          type: item.kind,
          phaseKey,
          color: item.kind === "idea" && index % 2 === 1 ? phaseColor : color,
          val: 1,
          status: "complete",
          ...offsetNearPhase(phaseKey, seed++),
        });

        links.push({
          source: `phase-${phaseKey}`,
          target: id,
          type: "contains",
        });
      });
    }
  );
}

function buildWookkiGraph(): RoomGraphData {
  const nodes: RoomGraphNode[] = [
    {
      id: "room-hub",
      label: "Wookki Attendance MVP",
      type: "room",
      color: GRAPH_HEX.hub,
      val: 1,
      fx: 0,
      fy: 0,
      fz: 0,
    },
  ];
  const links: RoomGraphLink[] = [];

  addPhaseNodes(nodes);
  addPhaseKnowledge(nodes, links);

  ROOM_GRAPH_PHASES.forEach((phase) => {
    links.push({
      source: "room-hub",
      target: `phase-${phase.key}`,
      type: "contains",
    });
  });

  for (let i = 0; i < ROOM_GRAPH_PHASES.length - 1; i++) {
    links.push({
      source: `phase-${ROOM_GRAPH_PHASES[i].key}`,
      target: `phase-${ROOM_GRAPH_PHASES[i + 1].key}`,
      type: "progression",
    });
  }

  links.push(
    {
      source: "phase-Challenge",
      target: "phase-Explore",
      type: "loop-back",
      color: CORAL,
    },
    {
      source: "phase-Expand",
      target: "phase-Explore",
      type: "loop-back",
      color: GRAPH_HEX.expand,
    },
    {
      source: "phase-Insight",
      target: "phase-Explore",
      type: "loop-back",
      color: GRAPH_HEX.insight,
    },
    {
      source: "phase-Context",
      target: "phase-Framing",
      type: "loop-back",
      color: GRAPH_HEX.context,
    }
  );

  const artifacts: RoomGraphNode[] = [
    {
      id: "artifact-problem",
      label: "Problem: Excel/Zalo chấm công",
      type: "artifact",
      phaseKey: "Framing",
      color: ARTIFACT,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Framing", 1),
    },
    {
      id: "artifact-goal",
      label: "Goal: MVP rẻ, dễ triển khai",
      type: "artifact",
      phaseKey: "Framing",
      color: ARTIFACT,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Framing", 2),
    },
    {
      id: "artifact-persona",
      label: "Persona: SME owner + HR",
      type: "artifact",
      phaseKey: "Context",
      color: ARTIFACT,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Context", 3),
    },
    {
      id: "technique-scamper",
      label: "SCAMPER",
      type: "technique",
      phaseKey: "Explore",
      color: SKY,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Explore", 4),
    },
    {
      id: "technique-six-hats",
      label: "Six Thinking Hats",
      type: "technique",
      phaseKey: "Expand",
      color: SKY,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Expand", 5),
    },
    {
      id: "technique-devil",
      label: "Devil's Advocate",
      type: "technique",
      phaseKey: "Challenge",
      color: SKY,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Challenge", 6),
    },
    {
      id: "idea-qr-wifi",
      label: "QR + WiFi Check-in",
      type: "idea",
      phaseKey: "Explore",
      color: STICKY,
      val: 1,
      status: "complete",
      trace: QR_WIFI_TRACE,
      ...offsetNearPhase("Explore", 7),
    },
    {
      id: "idea-gps",
      label: "GPS Check-in",
      type: "idea",
      phaseKey: "Explore",
      color: STICKY,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Explore", 8),
    },
    {
      id: "idea-faceid",
      label: "FaceID Attendance",
      type: "idea",
      phaseKey: "Explore",
      color: STICKY,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Explore", 9),
    },
    {
      id: "insight-workflow",
      label: "Attendance = workflow tự nhiên",
      type: "insight",
      phaseKey: "Insight",
      color: GRAPH_HEX.insight,
      val: 1,
      status: "complete",
      ...offsetNearPhase("Insight", 10),
    },
    {
      id: "output-brief",
      label: "Product Brief",
      type: "output",
      phaseKey: "Action",
      color: OUTPUT,
      val: 1,
      ...offsetNearPhase("Action", 11),
    },
  ];

  artifacts.forEach((node) => {
    nodes.push(node);
    if (node.phaseKey) {
      links.push({
        source: `phase-${node.phaseKey}`,
        target: node.id,
        type: "contains",
      });
    }
  });

  links.push(
    { source: "technique-scamper", target: "idea-qr-wifi", type: "technique-source" },
    { source: "technique-six-hats", target: "idea-qr-wifi", type: "evolved-from" },
    { source: "technique-devil", target: "idea-qr-wifi", type: "evolved-from" },
    { source: "idea-qr-wifi", target: "insight-workflow", type: "evolved-from" },
    { source: "phase-Decision", target: "idea-qr-wifi", type: "contains" },
    { source: "phase-Action", target: "output-brief", type: "contains" },
    { source: "room-hub", target: "idea-qr-wifi", type: "contains" },
    { source: "room-hub", target: "insight-workflow", type: "contains" },
    { source: "room-hub", target: "output-brief", type: "contains" }
  );

  return { nodes, links };
}

function buildMinimalGraph(title: string): RoomGraphData {
  const nodes: RoomGraphNode[] = [
    {
      id: "room-hub",
      label: title,
      type: "room",
      color: GRAPH_HEX.hub,
      val: 5,
      x: 0,
      y: 0,
      z: 0,
    },
  ];
  const links: RoomGraphLink[] = [];

  addPhaseNodes(nodes);

  nodes.forEach((node) => {
    if (node.type === "phase") {
      links.push({ source: "room-hub", target: node.id, type: "contains" });
    }
  });

  return { nodes, links };
}

export function buildGraphForRoom(roomId: string): RoomGraphData {
  if (roomId === "room-001") {
    return buildWookkiGraph();
  }
  const room = mockRooms.find((r) => r.id === roomId);
  return buildMinimalGraph(room?.title ?? "Brainstorm Room");
}

export function deriveSessionPhaseAtMs(timestampMs: number): RoomPhaseKey {
  const reached = MOCK_TRANSCRIPT.filter((entry) => entry.timestampMs <= timestampMs);
  const last = reached[reached.length - 1];
  return last?.phaseKey ?? "Framing";
}

export function getRoomSessionMeta(roomId: string): RoomSessionMeta {
  const room = mockRooms.find((r) => r.id === roomId);
  const isLive = room?.status === "active";

  return {
    roomId,
    title: room?.title ?? "Brainstorm Room",
    topic: room?.topic ?? "Topic chưa đặt",
    goal: room?.goal ?? "",
    readiness: room?.readiness ?? 0,
    currentPhase: (room?.phase.replace(/\s+x\d+$/i, "").trim() as RoomPhaseKey) ?? "Framing",
    durationMinutes: 120,
    mode: isLive ? "live" : "replay",
    activeTechnique: isLive ? "SCAMPER — Combine" : undefined,
  };
}

export const MOCK_TRANSCRIPT: TranscriptEntry[] = [
  {
    id: "t1",
    speaker: "agent",
    text: "Chúng ta đang giải quyết vấn đề gì với attendance cho SME?",
    time: "09:00",
    timestampMs: 0,
    phaseKey: "Framing",
  },
  {
    id: "t2",
    speaker: "user",
    text: "SME đang dùng Excel và Zalo, HR mất nhiều giờ tổng hợp.",
    time: "09:02",
    timestampMs: 120_000,
    phaseKey: "Framing",
  },
  {
    id: "t3",
    speaker: "agent",
    text: "Mục tiêu MVP là gì — giảm chi phí hay tăng độ chính xác?",
    time: "09:05",
    timestampMs: 300_000,
    phaseKey: "Framing",
  },
  {
    id: "t4",
    speaker: "user",
    text: "Cả hai, nhưng ưu tiên triển khai nhanh, không hardware.",
    time: "09:08",
    timestampMs: 480_000,
    phaseKey: "Context",
  },
  {
    id: "t5",
    speaker: "agent",
    text: "Chuyển sang SCAMPER — Combine: QR với WiFi có ý nghĩa gì?",
    time: "09:15",
    timestampMs: 900_000,
    phaseKey: "Explore",
  },
  {
    id: "t6",
    speaker: "user",
    text: "QR session + validate office WiFi — rẻ và không cần máy chấm công.",
    time: "09:18",
    timestampMs: 1_080_000,
    phaseKey: "Explore",
  },
  {
    id: "t7",
    speaker: "agent",
    text: "Six Hats Green: thêm time window để giảm share QR?",
    time: "09:22",
    timestampMs: 1_320_000,
    phaseKey: "Expand",
  },
  {
    id: "t8",
    speaker: "agent",
    text: "Devil's Advocate: nếu gian lận, user sẽ chụp QR gửi bạn.",
    time: "09:28",
    timestampMs: 1_680_000,
    phaseKey: "Challenge",
  },
  {
    id: "t9",
    speaker: "user",
    text: "Cần WiFi binding + QR đổi liên tục trong time window.",
    time: "09:32",
    timestampMs: 1_920_000,
    phaseKey: "Challenge",
  },
  {
    id: "t10",
    speaker: "agent",
    text: "Insight: vấn đề không chỉ chấm công nhanh mà là workflow tự nhiên.",
    time: "10:05",
    timestampMs: 3_900_000,
    phaseKey: "Insight",
  },
  {
    id: "t11",
    speaker: "agent",
    text: "ICE cho QR+WiFi: 26 điểm — candidate MVP hàng đầu.",
    time: "10:20",
    timestampMs: 4_800_000,
    phaseKey: "Decision",
  },
];
