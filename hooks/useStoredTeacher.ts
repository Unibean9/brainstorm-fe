"use client";

import { useSyncExternalStore } from "react";

import {
  readStoredTeacher,
  subscribeStoredTeacher,
  type StoredTeacher,
} from "@/lib/brainstorm/teacher-storage";

let cachedValue: StoredTeacher | null = null;
let cachedRaw = "";

function getSnapshot(): StoredTeacher | null {
  const next = readStoredTeacher();
  const raw = JSON.stringify(next);
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = next;
  return cachedValue;
}

function getServerSnapshot(): StoredTeacher | null {
  return null;
}

/**
 * Đọc teacher đã lưu qua useSyncExternalStore — an toàn hydration (server luôn null,
 * client tự đồng bộ ngay khi commit) và không vi phạm rule "no setState in effect".
 */
export function useStoredTeacher(): StoredTeacher | null {
  return useSyncExternalStore(subscribeStoredTeacher, getSnapshot, getServerSnapshot);
}
