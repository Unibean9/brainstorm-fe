"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { spokeCurvePath } from "@/app/session/components/room-orb-layout";
import { cn } from "@/lib/utils";

type ConstellationGridProps = {
  /** Mỗi item cần 1 phần tử mang attribute `data-constellation-node` — điểm neo để nối đường cong. */
  children: ReactNode;
  className?: string;
};

/**
 * Nối các node liền kề (thứ tự DOM) bằng đường cong glow — cùng công thức `spokeCurvePath`
 * dùng để vẽ nan hoa trong session workspace hub. Đo vị trí thật qua ResizeObserver nên
 * luôn khớp layout dù flex-wrap đổi dòng ở màn hình nhỏ.
 */
export function ConstellationGrid({ children, className }: ConstellationGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    const recompute = () => {
      const nodes = Array.from(
        container.querySelectorAll<HTMLElement>("[data-constellation-node]")
      );
      const containerRect = container.getBoundingClientRect();
      const centers = nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - containerRect.left,
          y: r.top + r.height / 2 - containerRect.top,
        };
      });
      const next: string[] = [];
      for (let i = 0; i < centers.length - 1; i += 1) {
        const a = centers[i]!;
        const b = centers[i + 1]!;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const bend = Math.min(36, dist * 0.16) * (i % 2 === 0 ? 1 : -1);
        next.push(spokeCurvePath(a.x, a.y, b.x, b.y, bend));
      }
      setPaths(next);
    };

    const scheduleRecompute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };

    scheduleRecompute();
    const ro = new ResizeObserver(scheduleRecompute);
    ro.observe(container);
    window.addEventListener("resize", scheduleRecompute);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", scheduleRecompute);
    };
  }, [children]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="constellation-line-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="url(#constellation-line-gradient)"
            strokeWidth={1.4}
            strokeLinecap="round"
            className="constellation-line"
            style={{
              strokeDasharray: 480,
              strokeDashoffset: 480,
              animation: `constellation-draw 0.85s cubic-bezier(0.16,1,0.3,1) forwards`,
              animationDelay: `${i * 90}ms`,
            }}
          />
        ))}
      </svg>
      {children}
    </div>
  );
}
