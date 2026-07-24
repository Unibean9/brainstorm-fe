"use client";

// SignalR tạm tắt — hook vẫn giữ nguyên, bật lại qua SignalRProvider khi cần.

import { useEffect } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectIsAuthenticated } from "@/lib/redux/slices/authSlice";
import { startHubConnection, stopHubConnection } from "@/lib/realtime/signalr";

export function useSignalR() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    startHubConnection().catch((err) => {
      console.error("[useSignalR] failed to connect", err);
    });

    return () => {
      stopHubConnection();
    };
  }, [isAuthenticated]);
}
