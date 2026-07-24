"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

import { cn } from "@/lib/utils";

import { orbCenter } from "./room-orb-layout";

export type HubWebglState = "idle" | "listening" | "agent-speaking" | "processing";

type RoomHubWebglProps = {
  state: HubWebglState;
  /** false = STANDBY orb (no waves); true = full session hub */
  armed?: boolean;
  /** 0–1 dock progress (number or mutable ref — ref avoids React every frame) */
  dockProgress?: number;
  dockProgressRef?: MutableRefObject<number>;
  voiceLevel?: number;
  reduceMotion?: boolean | null;
  className?: string;
};

/**
 * Hub canvas: dải sóng đồ thị + orb hạt thở.
 */
export function RoomHubWebgl({
  state,
  armed = true,
  dockProgress = 0,
  dockProgressRef: dockProgressRefProp,
  voiceLevel = 0.2,
  reduceMotion = false,
  className,
}: RoomHubWebglProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const voiceRef = useRef(voiceLevel);
  const armedRef = useRef(armed);
  const dockProgressRef = useRef(dockProgress);

  useEffect(() => {
    stateRef.current = state;
    voiceRef.current = voiceLevel;
    armedRef.current = armed;
    if (!dockProgressRefProp) dockProgressRef.current = dockProgress;
  }, [state, voiceLevel, armed, dockProgress, dockProgressRefProp]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const particles = Array.from({ length: reduceMotion ? 220 : 620 }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.62);
      return {
        a,
        r,
        s: 0.22 + Math.random() * 1.05,
        phase: Math.random() * Math.PI * 2,
        bright: Math.random(),
        speed: 0.7 + Math.random() * 1.4,
      };
    });

    let raf = 0;
    let running = true;
    const t0 = performance.now();
    let lastNow = t0;
    // Pha sóng tích lũy — tránh reset khi bấm Voice (state đổi)
    let waveClock = 0;
    let waveRate = 1;
    let energy = 0;
    let armedAmt = armedRef.current ? 1 : 0;

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawWaveBands = (
      w: number,
      h: number,
      clock: number,
      energyAmt: number,
      reduce: boolean
    ) => {
      /**
       * Envelope cố định (user):
       * trái cong xuống → gần giữa orb cong lên → phải trải dần xuống
       * + ripple nhỏ animate chảy L→R
       */
      // Ít filament + 1 path / 2 stroke — tránh shadowBlur nặng
      const filaments = [
        { y: 0.3, amp: 0.05, freq: 2.0, speed: 0.65, alpha: 0.1, phase: 0.2, w: 4.2, peak: 0.2, valley: 0.13, fall: 0.15 },
        { y: 0.4, amp: 0.045, freq: 1.6, speed: 0.45, alpha: 0.12, phase: 1.2, w: 5.2, peak: 0.23, valley: 0.14, fall: 0.17 },
        { y: 0.5, amp: 0.055, freq: 1.35, speed: 0.38, alpha: 0.13, phase: 0.7, w: 5.8, peak: 0.25, valley: 0.15, fall: 0.18 },
        { y: 0.6, amp: 0.048, freq: 1.85, speed: 0.55, alpha: 0.1, phase: 2.4, w: 4.6, peak: 0.21, valley: 0.13, fall: 0.16 },
        { y: 0.68, amp: 0.052, freq: 1.5, speed: 0.42, alpha: 0.11, phase: 1.8, w: 5.0, peak: 0.22, valley: 0.14, fall: 0.17 },
      ];

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 0;

      const step = reduce ? 10 : 7;

      for (const f of filaments) {
        const baseY = h * f.y;
        const a = (f.alpha + energyAmt * 0.05) * (reduce ? 0.65 : 1);
        const ampBoost = 1 + energyAmt * 0.2;
        const flow = clock * f.speed + f.phase;

        ctx.beginPath();
        for (let x = -40; x <= w + 40; x += step) {
          const nx = x / w;
          const leftDown = Math.exp(-(((nx - 0.18) / 0.14) ** 2)) * h * f.valley;
          const midUp = Math.exp(-(((nx - 0.5) / 0.16) ** 2)) * h * f.peak;
          const rightDown = nx * nx * h * f.fall;
          const bridge =
            Math.sin(Math.min(1, Math.max(0, (nx - 0.12) / 0.4)) * Math.PI) * h * f.peak * 0.15;
          const ripple = reduce
            ? 0
            : Math.sin(nx * Math.PI * 2 * f.freq + flow) * h * f.amp * ampBoost;
          const y = baseY + leftDown - midUp - bridge + rightDown + ripple;
          if (x === -40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = `rgba(56,189,248,${a * 0.28})`;
        ctx.lineWidth = f.w * 4.2;
        ctx.stroke();

        ctx.strokeStyle = `rgba(186,230,253,${Math.min(0.32, a * 0.95)})`;
        ctx.lineWidth = f.w * 1.2;
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    };

    const readDock = () =>
      Math.min(
        1,
        Math.max(0, dockProgressRefProp ? dockProgressRefProp.current : dockProgressRef.current)
      );

    const draw = (now: number) => {
      if (!running) return;
      if (document.hidden) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      const t = (now - t0) / 1000;
      const voice = voiceRef.current;
      const st = stateRef.current;
      const agentSpeaking = st === "agent-speaking";
      const processing = st === "processing";
      const active = st === "listening" || agentSpeaking || processing;
      const speaking = agentSpeaking || processing;

      // Lerp mượt — armed + dock + energy
      const armedTarget = armedRef.current ? 1 : 0;
      armedAmt += (armedTarget - armedAmt) * Math.min(1, dt * (reduceMotion ? 12 : 2.2));
      const dockAmt = readDock();
      // A: agent reply → energy sóng cao hơn; B: ripple broadcast dùng phase riêng
      const energyTarget = armedAmt > 0.05 ? (agentSpeaking ? 1.4 : active ? 1 : 0) : 0;
      energy += (energyTarget - energy) * Math.min(1, dt * (agentSpeaking ? 4.5 : 3.5));
      const rateTarget = reduceMotion
        ? 0
        : armedAmt > 0.5
          ? agentSpeaking
            ? 1.45
            : active
              ? 1.2
              : 1
          : 0.35;
      waveRate += (rateTarget - waveRate) * Math.min(1, dt * 2.5);
      waveClock += dt * waveRate;

      const orb = orbCenter(dockAmt);
      const cx = w * orb.cx;
      const cy = h * orb.cy;
      const radiusFactor = orb.radiusFactor;

      const pulseHz = agentSpeaking
        ? 0.95
        : st === "listening"
          ? 0.7
          : processing
            ? 0.9
            : 0.4;
      const pulseAmp = agentSpeaking
        ? 0.038 + voice * 0.016
        : speaking
          ? 0.02 + voice * 0.01
          : active
            ? 0.01 + voice * 0.005
            : 0.006;
      const waveSpeed = agentSpeaking
        ? 0.32
        : st === "listening"
          ? 0.22
          : processing
            ? 0.3
            : 0.1;
      const waveAlpha = agentSpeaking
        ? 0.32 + voice * 0.1
        : active
          ? 0.2 + voice * 0.08
          : 0.07;

      // —— Blue bg ——
      const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(w, h) * 0.7);
      bg.addColorStop(0, "#0c5a82");
      bg.addColorStop(0.4, "#0a4568");
      bg.addColorStop(0.75, "#073048");
      bg.addColorStop(1, "#041e30");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Soft ambient wash
      const wash = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.min(w, h) * 0.42);
      wash.addColorStop(
        0,
        `rgba(125,211,252,${0.14 + armedAmt * (0.12 + energy * 0.08 + voice * 0.05)})`
      );
      wash.addColorStop(0.4, `rgba(56,189,248,${0.06 + armedAmt * (0.04 + energy * 0.04)})`);
      wash.addColorStop(1, "transparent");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      const coreR = Math.max(18, Math.min(w, h) * radiusFactor);

      // —— STANDBY atmosphere (DOM owns Play gate; canvas = depth only) ——
      if (armedAmt < 0.98) {
        const s = 1 - armedAmt;
        ctx.save();
        ctx.globalAlpha = s;
        ctx.translate(cx, cy);

        // Soft horizon filament
        const flareW = Math.max(w, h) * 0.62;
        const flare = ctx.createLinearGradient(-flareW, 0, flareW, 0);
        flare.addColorStop(0, "transparent");
        flare.addColorStop(0.38, `rgba(56,189,248,${0.04 * s})`);
        flare.addColorStop(0.5, `rgba(186,230,253,${0.28 * s})`);
        flare.addColorStop(0.62, `rgba(56,189,248,${0.04 * s})`);
        flare.addColorStop(1, "transparent");
        ctx.fillStyle = flare;
        ctx.fillRect(-flareW, -0.7, flareW * 2, 1.4);

        // Cyan well behind Play gate
        const well = ctx.createRadialGradient(0, 0, coreR * 0.15, 0, 0, coreR * 2.4);
        well.addColorStop(0, `rgba(34,211,238,${0.16 * s})`);
        well.addColorStop(0.4, `rgba(14,165,233,${0.08 * s})`);
        well.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.fillStyle = well;
        ctx.arc(0, 0, coreR * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Slow breathing gate rings
        if (!reduceMotion) {
          for (let i = 0; i < 3; i++) {
            const phase = (t * 0.18 + i / 3) % 1;
            const rr = coreR * (1.15 + phase * 1.35);
            const a = (1 - phase) * 0.14 * s;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(125,211,252,${a})`;
            ctx.lineWidth = 1.2;
            ctx.arc(0, 0, rr, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // —— Dải sóng (chỉ khi armed) ——
      if (armedAmt > 0.02) {
        ctx.save();
        ctx.globalAlpha = armedAmt;
        drawWaveBands(w, h, waveClock, energy * armedAmt, !!reduceMotion);
        ctx.restore();
      }

      // —— Active session orb ——
      if (armedAmt < 0.02) {
        if (running) raf = requestAnimationFrame(draw);
        return;
      }

      // A — Breath Reply: thở mạnh khi agent nói
      const breathe = 1 + Math.sin(t * Math.PI * 2 * pulseHz) * pulseAmp;
      const particleBreathe = reduceMotion
        ? 1
        : agentSpeaking
          ? 1 + Math.sin(t * Math.PI * 2 * 1.05) * (0.2 + voice * 0.08)
          : speaking
            ? 1 + Math.sin(t * Math.PI * 2 * 0.85) * (0.14 + voice * 0.06)
            : active
              ? 1 + Math.sin(t * Math.PI * 2 * 0.55) * 0.05
              : 1 + Math.sin(t * Math.PI * 2 * 0.35) * 0.02;

      ctx.save();
      ctx.globalAlpha = armedAmt;
      ctx.translate(cx, cy);

      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(125,211,252,${0.08 - i * 0.015})`;
        ctx.lineWidth = i === 2 ? 1.1 : 0.85;
        ctx.setLineDash(i % 2 === 0 ? [3, 6] : []);
        ctx.arc(0, 0, coreR * (1.08 + i * 0.12) * (agentSpeaking ? breathe : 1), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Soft ambient ripples (listening / thinking)
      if (!reduceMotion && !agentSpeaking) {
        const rippleCount = speaking ? 3 : active ? 2 : 2;
        for (let i = 0; i < rippleCount; i++) {
          const phase = (t * waveSpeed + i / rippleCount) % 1;
          const eased = 1 - Math.pow(1 - phase, 1.45);
          const rr = Math.max(1, coreR * breathe * (1.08 + eased * (speaking ? 1.2 : 0.85)));
          const alpha = (1 - phase) * waveAlpha;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(125,211,252,${alpha})`;
          ctx.lineWidth = 1;
          ctx.arc(0, 0, rr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // B — Ripple Broadcast: 3 vòng cyan + gold lan từ orb khi agent trả lời
      if (!reduceMotion && agentSpeaking) {
        for (let i = 0; i < 3; i++) {
          const phase = (t * 0.85 + i / 3) % 1;
          const eased = 1 - Math.pow(1 - phase, 1.55);
          const rr = Math.max(1, coreR * breathe * (1.12 + eased * 2.35));
          const fade = 1 - phase;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(103,232,249,${0.34 * fade})`;
          ctx.lineWidth = 1.6 - phase * 0.7;
          ctx.arc(0, 0, rr, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.strokeStyle = `rgba(251,191,36,${0.22 * fade})`;
          ctx.lineWidth = 2.2 - phase;
          ctx.arc(0, 0, rr * 0.96, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const ringR = Math.max(8, coreR * breathe);
      const innerR = Math.max(1, ringR - 2);
      const particleR = Math.max(1, ringR - 4) * particleBreathe;

      {
        const aura = ctx.createRadialGradient(0, 0, ringR * 0.5, 0, 0, ringR * (agentSpeaking ? 2.45 : 2.15));
        aura.addColorStop(
          0,
          `rgba(125,211,252,${0.38 + (agentSpeaking ? 0.2 : speaking ? 0.12 : active ? 0.08 : 0)})`
        );
        aura.addColorStop(0.35, `rgba(56,189,248,${0.16 + (agentSpeaking ? 0.12 : speaking ? 0.06 : 0)})`);
        aura.addColorStop(0.7, "rgba(14,165,233,0.05)");
        aura.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.fillStyle = aura;
        ctx.arc(0, 0, ringR * (agentSpeaking ? 2.45 : 2.15), 0, Math.PI * 2);
        ctx.fill();
      }

      {
        const halo = ctx.createRadialGradient(0, 0, ringR * 0.85, 0, 0, ringR * (agentSpeaking ? 1.55 : 1.4));
        halo.addColorStop(0, `rgba(251,191,36,${0.24 + (agentSpeaking ? 0.18 : speaking ? 0.1 : 0)})`);
        halo.addColorStop(0.55, `rgba(245,158,11,${0.1 + voice * 0.04 + (agentSpeaking ? 0.08 : 0)})`);
        halo.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.fillStyle = halo;
        ctx.arc(0, 0, ringR * (agentSpeaking ? 1.55 : 1.4), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.clip();

      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, ringR);
      core.addColorStop(0, `rgba(240,249,255,${0.78 + (agentSpeaking ? 0.18 : speaking ? 0.12 : 0)})`);
      core.addColorStop(0.28, `rgba(186,230,253,${0.58 + (agentSpeaking ? 0.16 : speaking ? 0.1 : 0)})`);
      core.addColorStop(0.58, `rgba(56,189,248,${0.34 + (agentSpeaking ? 0.12 : speaking ? 0.08 : 0)})`);
      core.addColorStop(0.85, "rgba(14,116,144,0.24)");
      core.addColorStop(1, "rgba(8,47,73,0.4)");
      ctx.fillStyle = core;
      ctx.fillRect(-ringR, -ringR, ringR * 2, ringR * 2);

      for (const p of particles) {
        const radial =
          p.r *
          particleR *
          (reduceMotion
            ? 1
            : 1 +
              Math.sin(t * p.speed * (agentSpeaking ? 3.1 : speaking ? 2.4 : 1.2) + p.phase) *
                (agentSpeaking ? 0.055 : speaking ? 0.04 : 0.015));
        const x = Math.cos(p.a) * radial;
        const y = Math.sin(p.a) * radial;
        if (Math.hypot(x, y) > innerR * 0.98) continue;
        const twinkle = reduceMotion
          ? 0.72
          : 0.5 +
            0.5 * (0.5 + 0.5 * Math.sin(t * (agentSpeaking ? 3.4 : speaking ? 2.8 : 1.6) + p.phase));
        const alpha = (0.3 + p.bright * 0.55) * twinkle * (agentSpeaking ? 1.15 : 1);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.28, p.s * (agentSpeaking ? 0.68 : speaking ? 0.58 : 0.48)), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(253,224,71,0.98)";
      ctx.lineWidth = Math.max(7, coreR * (agentSpeaking ? 0.1 : 0.085));
      ctx.shadowColor = agentSpeaking
        ? `rgba(251,191,36,${0.9 + voice * 0.05})`
        : speaking
          ? `rgba(251,191,36,${0.85 + voice * 0.05})`
          : "rgba(251,191,36,0.8)";
      ctx.shadowBlur = agentSpeaking ? 18 : speaking ? 14 : 8;
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(245,158,11,${0.35 + (agentSpeaking ? 0.2 : speaking ? 0.12 : 0)})`;
      ctx.lineWidth = Math.max(12, coreR * 0.13);
      ctx.shadowBlur = agentSpeaking ? 20 : speaking ? 16 : 10;
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(254,249,195,${0.65 + (agentSpeaking ? 0.2 : speaking ? 0.12 : 0)})`;
      ctx.lineWidth = Math.max(1.5, coreR * 0.018);
      ctx.shadowBlur = 0;
      ctx.arc(0, 0, Math.max(1, ringR - Math.max(2.5, coreR * 0.03)), 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      if (running) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (canvas.parentNode === host) host.removeChild(canvas);
    };
  }, [reduceMotion]);

  return (
    <div
      ref={hostRef}
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden
    />
  );
}
