"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";

const RoomHubWebgl = dynamic(
  () => import("@/app/session/components/room-hub-webgl").then((m) => m.RoomHubWebgl),
  { ssr: false }
);

/**
 * Nền động dùng chung cho mọi trang product (gate, rooms, workspace) — cùng canvas
 * `RoomHubWebgl` mà session workspace đã dùng, chỉ tắt `armed` để bỏ orb trung tâm,
 * giữ lại gradient xanh sâu + hiệu ứng breathing ring làm khí quyển nền.
 */
export function EngineAmbientBg() {
  const reduceMotion = useReducedMotion();
  return (
    <RoomHubWebgl
      state="idle"
      armed={false}
      reduceMotion={reduceMotion}
      className="fixed inset-0 z-0"
    />
  );
}
