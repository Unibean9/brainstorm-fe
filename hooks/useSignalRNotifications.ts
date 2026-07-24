"use client";

// SignalR tạm tắt — hook vẫn giữ nguyên, bật lại qua SignalRProvider khi cần.

import { useEffect } from "react";
import { toast } from "sonner";
import { getHubConnection } from "@/lib/realtime/signalr";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectIsAuthenticated } from "@/lib/redux/slices/authSlice";

export function useSignalRNotifications() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    const connection = getHubConnection();

    const handleSessionUpdate = (message: string, title?: string) => {
      toast(title || "Phiên brainstorm", { description: message });
    };

    const handleNotification = (message: string, title?: string) => {
      toast(title || "Thông báo", { description: message });
    };

    connection.on("SessionUpdated", handleSessionUpdate);
    connection.on("ReceiveNotification", handleNotification);

    return () => {
      connection.off("SessionUpdated", handleSessionUpdate);
      connection.off("ReceiveNotification", handleNotification);
    };
  }, [isAuthenticated]);
}
