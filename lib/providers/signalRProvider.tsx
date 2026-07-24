"use client";

import { ReactNode } from "react";
// SignalR tạm tắt — giữ file, bật lại khi cần real-time
// import { useSignalR } from "@/hooks/useSignalR";
// import { useSignalRNotifications } from "@/hooks/useSignalRNotifications";

export function SignalRProvider({ children }: { children: ReactNode }) {
  // useSignalR();
  // useSignalRNotifications();
  return <>{children}</>;
}
