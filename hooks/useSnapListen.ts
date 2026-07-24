"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SnapListenStatus = "idle" | "listening" | "denied" | "unsupported";

type UseSnapListenOptions = {
  enabled: boolean;
  onSnap: () => void;
  /** Min ms between snap triggers */
  cooldownMs?: number;
};

/**
 * Adaptive finger-snap listener.
 * Soft snaps work via relative spike vs room baseline; speech rejected by duration.
 */
export function useSnapListen({
  enabled,
  onSnap,
  cooldownMs = 900,
}: UseSnapListenOptions) {
  const [status, setStatus] = useState<SnapListenStatus>("idle");
  const [level, setLevel] = useState(0);
  const [retryToken, setRetryToken] = useState(0);
  const onSnapRef = useRef(onSnap);
  const lastSnapRef = useRef(0);

  useEffect(() => {
    onSnapRef.current = onSnap;
  }, [onSnap]);

  const retry = useCallback(() => {
    setRetryToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setLevel(0);
      return;
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;

    const start = async () => {
      setStatus("idle");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            // AGC giúp búng nhẹ vẫn đủ biên độ
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctx = new AC();
        if (ctx.state === "suspended") await ctx.resume();

        const source = ctx.createMediaStreamSource(stream);

        // Mild high-shelf emphasis so soft snaps stand out
        const highShelf = ctx.createBiquadFilter();
        highShelf.type = "highshelf";
        highShelf.frequency.value = 1800;
        highShelf.gain.value = 12;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0;
        source.connect(highShelf);
        highShelf.connect(analyser);

        const bins = new Uint8Array(analyser.frequencyBinCount);
        const wave = new Uint8Array(analyser.fftSize);
        const sampleRate = ctx.sampleRate;
        const binHz = sampleRate / analyser.fftSize;

        const freqToBin = (hz: number) =>
          Math.min(bins.length - 1, Math.max(0, Math.round(hz / binHz)));

        const hi0 = freqToBin(1800);
        const hi1 = freqToBin(9000);
        const lo0 = freqToBin(80);
        const lo1 = freqToBin(900);

        // Rolling history for adaptive threshold (~0.5s)
        const hist: number[] = [];
        const HIST = 28;
        let prevFlux = 0;
        let armedAt = 0;
        let armedScore = 0;
        let loudFrames = 0;

        setStatus("listening");

        const avgRange = (a: number, b: number) => {
          let s = 0;
          let n = 0;
          for (let i = a; i <= b; i++) {
            s += bins[i];
            n++;
          }
          return n ? s / n : 0;
        };

        const median = (arr: number[]) => {
          if (arr.length === 0) return 0;
          const s = [...arr].sort((x, y) => x - y);
          return s[Math.floor(s.length / 2)]!;
        };

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(bins);
          analyser.getByteTimeDomainData(wave);

          const hi = avgRange(hi0, hi1);
          const lo = avgRange(lo0, lo1);

          let rms = 0;
          for (let i = 0; i < wave.length; i++) {
            const v = (wave[i]! - 128) / 128;
            rms += v * v;
          }
          rms = Math.sqrt(rms / wave.length);

          hist.push(hi);
          if (hist.length > HIST) hist.shift();
          const base = Math.max(2, median(hist));
          const flux = Math.max(0, hi - base);
          const onset = Math.max(0, flux - prevFlux);
          prevFlux = flux * 0.65;

          setLevel(Math.min(1, flux / 28 + rms * 1.4));

          const now = performance.now();
          const cooled = now - lastSnapRef.current > cooldownMs;

          // Adaptive: soft snap in quiet room = small absolute, big relative
          const relative = hi / base;
          const brightEnough = hi + 8 >= lo;
          const spike =
            flux >= Math.max(2, base * 0.35) || relative >= 1.28;
          const sharp = onset >= 0.6 || flux >= Math.max(2.8, base * 0.5);
          const hasBody = rms > 0.01 || hi > base + 1.2;

          if (cooled && brightEnough && spike && sharp && hasBody) {
            if (!armedAt) {
              armedAt = now;
              armedScore = flux + onset * 2 + rms * 40;
              loudFrames = 1;
            } else {
              armedScore = Math.max(armedScore, flux + onset * 2 + rms * 40);
              loudFrames += 1;
            }
          }

          if (armedAt) {
            const age = now - armedAt;
            const quietAgain = hi < base * 1.5 + 5 && rms < 0.06;

            // Snap = short burst, then quiet. Speech stays loud.
            if (age >= 18 && age <= 220 && quietAgain && loudFrames <= 10) {
              lastSnapRef.current = now;
              armedAt = 0;
              armedScore = 0;
              loudFrames = 0;
              onSnapRef.current();
            } else if (age > 220 || loudFrames > 12) {
              armedAt = 0;
              armedScore = 0;
              loudFrames = 0;
            } else if (quietAgain && age < 18 && armedScore > 6) {
              lastSnapRef.current = now;
              armedAt = 0;
              armedScore = 0;
              loudFrames = 0;
              onSnapRef.current();
            }
          }

          raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setStatus("denied");
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setLevel(0);
    };
  }, [enabled, cooldownMs, retryToken]);

  return { status, level, retry };
}
