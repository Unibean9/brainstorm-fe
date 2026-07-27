"use client";

import { startTransition } from "react";

type Router = { push: (href: string) => void };

/**
 * Điều hướng qua View Transitions API khi trình duyệt hỗ trợ và user không bật
 * reduced-motion; fallback là router.push thường (progressive enhancement).
 */
export function navigateWithTransition(router: Router, href: string) {
  const supportsViewTransition =
    typeof document !== "undefined" && "startViewTransition" in document;
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!supportsViewTransition || reduceMotion) {
    router.push(href);
    return;
  }

  (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(
    () => {
      startTransition(() => {
        router.push(href);
      });
    }
  );
}
