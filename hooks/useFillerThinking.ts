"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { FillerThinkingPlayer } from "@/lib/audio/filler-thinking-player";
import { resolveFillerAssetUrl } from "@/lib/audio/resolve-filler-url";
import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import {
  readFillerEnabledPreference,
  writeFillerEnabledPreference,
} from "@/lib/brainstorm/filler-storage";
import type { BrainstormFillerAsset, BrainstormPhaseKey } from "@/types/brainstorm-stream";
import type { BrainstormLanguage } from "@/types/brainstorm-domain";

/** Chỉ chọn filler đúng voice; thiếu metadata thì không phát để tránh lẫn giọng. */
function pickFiller(
  fillers: BrainstormFillerAsset[],
  phaseKey: BrainstormPhaseKey | null,
  voiceId: string | null,
  language: BrainstormLanguage | null
) {
  if (!fillers.length || !voiceId) return null;

  const byVoicePhaseLanguage = fillers.filter(
    (f) =>
      f.voiceId === voiceId &&
      (!phaseKey || f.phase === phaseKey) &&
      (!language || f.lang === language)
  );
  const byVoicePhaseLegacy = fillers.filter(
    (f) => f.voiceId === voiceId && (!phaseKey || f.phase === phaseKey) && f.lang == null
  );
  const byVoiceLanguage = fillers.filter(
    (f) => f.voiceId === voiceId && (!language || f.lang === language)
  );
  const byVoice = fillers.filter((f) => f.voiceId === voiceId);
  const pool = byVoicePhaseLanguage.length
    ? byVoicePhaseLanguage
    : byVoicePhaseLegacy.length
      ? byVoicePhaseLegacy
      : byVoiceLanguage.length
        ? byVoiceLanguage
        : byVoice;

  if (!pool.length) return null;

  return pool[Math.floor(Math.random() * pool.length)]!;
}

type UseFillerThinkingOptions = {
  /** Session UI đang mở — prefetch catalog */
  sessionActive: boolean;
  /** Một turn đang chờ agent — phát filler đúng một lần */
  isProcessing: boolean;
  phaseKey?: BrainstormPhaseKey | null;
  voiceId?: string | null;
  language?: BrainstormLanguage | null;
};

export function useFillerThinking({
  sessionActive,
  isProcessing,
  phaseKey = null,
  voiceId = null,
  language = null,
}: UseFillerThinkingOptions) {
  const [enabled, setEnabledState] = useState(() => readFillerEnabledPreference());
  const playerRef = useRef<FillerThinkingPlayer | null>(null);
  const playedThisTurnRef = useRef(false);

  const ensurePlayer = () => {
    if (!playerRef.current) playerRef.current = new FillerThinkingPlayer();
    return playerRef.current;
  };

  const { data: catalog } = useQuery({
    queryKey: brainstormKeys.fillers(),
    queryFn: () => brainstormSessionApi.getFillers(),
    enabled: sessionActive,
    staleTime: Infinity,
  });

  const setEnabled = useCallback((next: boolean) => {
    writeFillerEnabledPreference(next);
    setEnabledState(next);
    if (!next) playerRef.current?.stop();
  }, []);

  // Do not start the thinking clip while the snapshot is still loading. A null voice must never
  // fall through to a random catalog-wide asset.
  const shouldPlay = sessionActive && enabled && isProcessing && Boolean(voiceId);

  useEffect(() => {
    const player = ensurePlayer();

    if (!shouldPlay) {
      player.stop();
      playedThisTurnRef.current = false;
      return;
    }

    if (playedThisTurnRef.current) return;

    const filler = pickFiller(catalog?.fillers ?? [], phaseKey, voiceId, language);
    if (!filler) return;

    playedThisTurnRef.current = true;
    const url = resolveFillerAssetUrl(filler.url);
    void player.playOnce(url).catch(() => undefined);

    return () => {
      player.stop();
    };
  }, [shouldPlay, catalog, phaseKey, voiceId, language]);

  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      playerRef.current = null;
    };
  }, []);

  return {
    fillerEnabled: enabled,
    setFillerEnabled: setEnabled,
    fillersLoaded: Boolean(catalog?.fillers.length),
  };
}
