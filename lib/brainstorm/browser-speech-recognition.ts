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
  recognition.continuous = false;

  let latest = "";
  let rejectRef: ((reason?: unknown) => void) | null = null;

  recognition.onresult = (event) => {
    latest = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join("");
    options.onInterim?.(latest);
  };

  recognition.onerror = (event) => {
    rejectRef?.(new Error(event.error ?? "speech_recognition_failed"));
  };

  recognition.start();

  return {
    stop: () =>
      new Promise((resolve, reject) => {
        rejectRef = reject;
        recognition.onend = () => {
          rejectRef = null;
          resolve(latest.trim());
        };
        recognition.stop();
      }),
    abort: () => {
      rejectRef = null;
      recognition.abort();
    },
  };
}
