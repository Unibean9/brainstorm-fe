type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string } }>;
};

export function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isBrowserSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionCtor());
}

export type BrowserSpeechSession = {
  stop: () => Promise<string>;
  abort: () => void;
};

type StartBrowserSpeechOptions = {
  /** Cập nhật transcript tạm trong lúc nói */
  onInterim?: (text: string) => void;
  /** Báo lỗi ngay cả khi browser kết thúc recognition trước khi người dùng bấm dừng */
  onError?: (error: Error) => void;
  /** Browser tự kết thúc recognition (không phải do stop/abort của ứng dụng) */
  onEnd?: (text: string) => void;
};

export function startBrowserSpeechRecognition(
  options: StartBrowserSpeechOptions = {}
): BrowserSpeechSession {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    throw new Error("Trình duyệt không hỗ trợ nhận giọng nói");
  }

  const recognition = new Ctor();
  recognition.lang = "vi-VN";
  recognition.interimResults = true;
  // Voice mode is explicitly stopped by the user. With `false`, Chrome ends the
  // recognition after the first silence and the old UI had no way to observe that
  // end, leaving the microphone button stuck in "Voice On".
  recognition.continuous = true;

  let latest = "";
  let terminalError: Error | null = null;
  let ended = false;
  let stopRequested = false;
  let abortRequested = false;
  let stopPromise: Promise<string> | null = null;
  let resolveStop: ((text: string) => void) | null = null;
  let rejectStop: ((reason?: unknown) => void) | null = null;

  recognition.onresult = (event) => {
    latest = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join("");
    options.onInterim?.(latest);
  };

  recognition.onerror = (event) => {
    terminalError = new Error(event.error ?? "speech_recognition_failed");
    options.onError?.(terminalError);
    rejectStop?.(terminalError);
    resolveStop = null;
    rejectStop = null;
  };

  recognition.onend = () => {
    ended = true;
    const text = latest.trim();

    if (!stopRequested && !abortRequested && !terminalError) {
      options.onEnd?.(text);
    }

    if (terminalError) {
      rejectStop?.(terminalError);
    } else {
      resolveStop?.(text);
    }
    resolveStop = null;
    rejectStop = null;
  };

  recognition.start();

  return {
    stop: () => {
      stopRequested = true;
      if (stopPromise) return stopPromise;
      if (terminalError) return Promise.reject(terminalError);
      if (ended) return Promise.resolve(latest.trim());

      stopPromise = new Promise((resolve, reject) => {
        resolveStop = resolve;
        rejectStop = reject;
        try {
          recognition.stop();
        } catch (error) {
          reject(error);
          resolveStop = null;
          rejectStop = null;
        }
      });
      return stopPromise;
    },
    abort: () => {
      abortRequested = true;
      resolveStop = null;
      rejectStop = null;
      try {
        recognition.abort();
      } catch {
        // Abort is best-effort during component teardown.
      }
    },
  };
}
