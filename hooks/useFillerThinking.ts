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
import type { BrainstormFillerAsset } from "@/types/brainstorm-stream";

function pickRandomFiller(fillers: BrainstormFillerAsset[]) {
  if (!fillers.length) return null;
  return fillers[Math.floor(Math.random() * fillers.length)]!;
}

type UseFillerThinkingOptions = {
  /** Session UI đang mở — prefetch catalog */
  sessionActive: boolean;
  /** Một turn đang chờ agent — phát filler đúng một lần */
  isProcessing: boolean;
};

export function useFillerThinking({ sessionActive, isProcessing }: UseFillerThinkingOptions) {
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

  const shouldPlay = sessionActive && enabled && isProcessing;

  useEffect(() => {
    const player = ensurePlayer();

    if (!shouldPlay) {
      player.stop();
      playedThisTurnRef.current = false;
      return;
    }

    if (playedThisTurnRef.current) return;

    const filler = pickRandomFiller(catalog?.fillers ?? []);
    if (!filler) return;

    playedThisTurnRef.current = true;
    const url = resolveFillerAssetUrl(filler.url);
    void player.playOnce(url).catch(() => undefined);

    return () => {
      player.stop();
    };
  }, [shouldPlay, catalog]);

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
