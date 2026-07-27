"use client";

import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";

import type { HubWebglState } from "./room-hub-webgl";
import { Checkbox } from "@/components/ui/checkbox";

type WeatherInfo = {
  tempC: number | null;
  label: string;
  place: string;
};

function weatherFromCode(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code <= 3) return "Cloudy";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Rain";
  return "Overcast";
}

function formatClock(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(d: Date) {
  return d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
}

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

type SessionStatusHudProps = {
  state: HubWebglState;
  micActive?: boolean;
  fillerEnabled?: boolean;
  onFillerEnabledChange?: (enabled: boolean) => void;
  roomName?: string;
  sessionName?: string;
  onSwitchRoom?: () => void;
};

export function SessionStatusHud({
  state,
  micActive = false,
  fillerEnabled = true,
  onFillerEnabledChange,
  roomName,
  sessionName,
  onSwitchRoom,
}: SessionStatusHudProps) {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherInfo>({
    tempC: null,
    label: "…",
    place: "Local",
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async (lat: number, lon: number, place: string) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("weather");
        const data = (await res.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        if (cancelled) return;
        const code = data.current?.weather_code ?? 2;
        setWeather({
          tempC: Math.round(data.current?.temperature_2m ?? 0),
          label: weatherFromCode(code),
          place,
        });
      } catch {
        if (!cancelled) setWeather((w) => ({ ...w, tempC: null, label: "Unavailable" }));
      }
    };

    const fallback = () => void load(21.0285, 105.8542, "Hanoi");

    if (!navigator.geolocation) {
      fallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => void load(pos.coords.latitude, pos.coords.longitude, "Near you"),
      () => fallback(),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
    );

    const refresh = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => void load(pos.coords.latitude, pos.coords.longitude, "Near you"),
        () => fallback(),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
      );
    }, 15 * 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  const temp = weather.tempC === null ? "—" : `${weather.tempC}°C`;
  const weatherLine = `${weather.place} — ${weather.label}`.toUpperCase();
  const voiceHot = micActive || state === "listening" || state === "agent-speaking";
  const systemOnline = state !== "processing";
  const loadPct =
    state === "processing" ? 72 : state === "agent-speaking" ? 88 : state === "listening" ? 54 : 28;

  return (
    <aside
      className="pointer-events-none absolute left-4 top-4 z-30 w-[min(92vw,420px)] select-none sm:left-6 sm:top-5 sm:w-[440px]"
      aria-label="Session overview"
    >
      {/* OVERVIEW + neon glow bar */}
      <div className="mb-3.5">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-[#67e8f9]/90">OVERVIEW</p>
        <div className="relative mt-2 h-[3px] w-full overflow-visible">
          <div
            className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 blur-md"
            style={{
              background:
                "linear-gradient(90deg, rgba(34,211,238,0.55) 0%, rgba(56,189,248,0.35) 40%, transparent 85%)",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-x-0 top-0 h-[3px] rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #67e8f9 0%, #22d3ee 42%, rgba(34,211,238,0.15) 78%, transparent 100%)",
              boxShadow:
                "0 0 6px rgba(34,211,238,0.95), 0 0 18px rgba(34,211,238,0.75), 0 0 36px rgba(56,189,248,0.35)",
            }}
          />
        </div>
      </div>

      {/* Time · Weather · Greeting */}
      <div className="flex flex-wrap items-start gap-x-7 gap-y-2">
        <div className="min-w-[5.75rem]">
          <p
            className="font-sans text-[2.6rem] font-semibold leading-none tracking-tight text-[#e0f2fe] sm:text-[3rem]"
            style={{
              textShadow:
                "0 0 8px rgba(34,211,238,0.55), 0 0 22px rgba(34,211,238,0.35), 0 0 40px rgba(56,189,248,0.2)",
            }}
          >
            {formatClock(now)}
          </p>
          <p className="mt-1.5 text-[11px] font-medium tracking-[0.14em] text-white/90">
            {formatDate(now)}
          </p>
        </div>

        <div className="min-w-[7rem] pt-1">
          <p
            className="text-[1.45rem] font-semibold leading-none tabular-nums text-[#22d3ee] sm:text-[1.65rem]"
            style={{
              textShadow: "0 0 10px rgba(34,211,238,0.7), 0 0 22px rgba(56,189,248,0.45)",
            }}
          >
            {temp}
          </p>
          <p className="mt-1.5 max-w-[12rem] text-[9px] font-medium uppercase leading-snug tracking-[0.1em] text-white/55">
            {weatherLine}
          </p>
        </div>

        <div className="pt-2 sm:pt-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/90 sm:text-xs">
            {greetingFor(now)}
          </p>
        </div>
      </div>

      {/* Room / session + status LEDs */}
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        {onSwitchRoom ? (
          <button
            type="button"
            onClick={onSwitchRoom}
            title="Đổi phòng"
            className="pointer-events-auto group inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/12 bg-white/3 px-2.5 py-1 text-[11px] font-medium text-white/80 transition-colors hover:border-[#67e8f9]/45 hover:text-[#a5f3fc]"
          >
            <FolderOpen className="size-3 shrink-0 text-white/45 group-hover:text-[#67e8f9]" aria-hidden />
            <span className="max-w-32 truncate">{roomName ?? "Room"}</span>
            <span className="text-white/25">/</span>
            <span className="max-w-32 truncate text-white/55 group-hover:text-[#a5f3fc]">
              {sessionName ?? "Session"}
            </span>
          </button>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1.5 text-[11px] font-medium text-white/70">
            <span className="max-w-32 truncate">{roomName ?? "Room"}</span>
            <span className="text-white/25">/</span>
            <span className="max-w-32 truncate text-white/50">{sessionName ?? "Session"}</span>
          </span>
        )}
        <StatusDot
          label="VOICE"
          on={voiceHot}
          alert={!voiceHot && micActive === false && state === "idle"}
        />
      </div>

      {/* System online + thin meter */}
      <div className="mt-3 flex items-center gap-3">
        <p className="shrink-0 text-[11px] text-white/85">
          {systemOnline ? "System online" : "System thinking…"}
        </p>
        <div className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${loadPct}%`,
              background: "linear-gradient(90deg, #67e8f9, #22d3ee)",
              boxShadow: "0 0 10px rgba(34,211,238,0.7)",
            }}
          />
          <span
            className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-[#e0f2fe]"
            style={{
              left: `calc(${loadPct}% - 4px)`,
              boxShadow: "0 0 8px rgba(34,211,238,0.95)",
            }}
          />
        </div>
      </div>

      {onFillerEnabledChange ? (
        <label className="pointer-events-auto mt-3 flex cursor-pointer items-center gap-2.5 text-[10px] font-medium tracking-[0.12em] text-white/70">
          <Checkbox
            checked={fillerEnabled}
            onCheckedChange={(checked) => onFillerEnabledChange(checked === true)}
            aria-label="Bật âm thanh chờ khi facilitator đang suy nghĩ"
          />
          THINKING SOUND
        </label>
      ) : null}
    </aside>
  );
}

function StatusDot({
  label,
  on,
  alert,
}: {
  label: string;
  on?: boolean;
  alert?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-1.5 rounded-full"
        style={
          alert
            ? {
                background: "#ea580c",
                boxShadow: "0 0 6px rgba(234,88,12,0.9), 0 0 12px rgba(234,88,12,0.45)",
              }
            : on
              ? {
                  background: "#22d3ee",
                  boxShadow: "0 0 6px rgba(34,211,238,0.95), 0 0 14px rgba(56,189,248,0.55)",
                }
              : { background: "rgba(255,255,255,0.25)" }
        }
        aria-hidden
      />
      {label}
    </span>
  );
}
