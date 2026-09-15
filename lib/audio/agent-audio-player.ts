type AudioChunkInput = {
  chunkBase64: string;
  encoding: "audio/mpeg" | "audio/wav" | "audio/webm" | "audio/pcm16";
  sampleRate?: number;
};

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function mimeFor(encoding: AudioChunkInput["encoding"], sampleRate?: number) {
  if (encoding === "audio/pcm16") {
    return `audio/wav`; // browser plays via blob URL better as wav/mp3/webm
  }
  if (encoding === "audio/mpeg") return "audio/mpeg";
  if (encoding === "audio/webm") return "audio/webm";
  return "audio/wav";
}

/**
 * Queue phát audio chunk BE stream — mỗi chunk là file nhỏ (mp3/webm/wav).
 */
export class AgentAudioPlayer {
  private queue: Promise<void> = Promise.resolve();
  private current: HTMLAudioElement | null = null;
  private objectUrls: string[] = [];
  private playing = false;
  private unlockPromise: Promise<void> | null = null;

  get isPlaying() {
    return this.playing;
  }

  /** Resolve khi queue hiện tại phát xong hết — dùng để đợi audio thật xong trước khi đổi UI state. */
  whenIdle(): Promise<void> {
    return this.queue;
  }

  /**
   * Ask the browser for audio permission while a user gesture is still active.
   * The actual TTS bytes arrive later through SSE, after which browsers may reject
   * `HTMLAudioElement.play()` as autoplay. Keeping the same element for TTS chunks
   * also avoids losing that permission between queued chunks.
   */
  unlock(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (this.unlockPromise) return this.unlockPromise;

    const audio = this.current ?? new Audio();
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");
    this.current = audio;

    const bytes = new Uint8Array([
      82, 73, 70, 70, 38, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
      16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 128, 62, 0, 0, 2, 0, 16, 0,
      100, 97, 116, 97, 2, 0, 0, 0, 0, 0,
    ]);
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    audio.muted = true;
    audio.src = url;

    let playAttempt: Promise<void>;
    try {
      playAttempt = audio.play();
    } catch {
      playAttempt = Promise.resolve();
    }
    this.unlockPromise = playAttempt
      .catch(() => undefined)
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audio.volume = 1;
        audio.removeAttribute("src");
        audio.load();
      })
      .finally(() => {
        URL.revokeObjectURL(url);
      });
    return this.unlockPromise;
  }

  enqueue(chunk: AudioChunkInput) {
    this.queue = this.queue.then(() => this.playChunk(chunk)).catch(() => undefined);
    return this.queue;
  }

  stop() {
    this.current?.pause();
    this.current = null;
    this.playing = false;
    this.queue = Promise.resolve();
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  /** Một file TTS hoàn chỉnh từ BE — phát xong resolve */
  playOnce(chunk: AudioChunkInput): Promise<void> {
    this.stop();
    return this.playChunk(chunk);
  }

  private playChunk(chunk: AudioChunkInput): Promise<void> {
    const bytes = decodeBase64(chunk.chunkBase64);
    const mime = mimeFor(chunk.encoding, chunk.sampleRate);
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);

    return new Promise(async (resolve) => {
      // The unlock is normally started synchronously by the send/play click. If it
      // has not settled yet, wait for it before assigning the real TTS source.
      await this.unlockPromise?.catch(() => undefined);
      const audio = this.current ?? new Audio();
      audio.preload = "auto";
      audio.setAttribute("playsinline", "");
      audio.muted = false;
      audio.src = url;
      this.current = audio;
      this.playing = true;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.objectUrls = this.objectUrls.filter((u) => u !== url);
        if (this.current === audio) this.current = null;
        this.playing = false;
        resolve();
      };
      audio.onerror = () => {
        this.playing = false;
        resolve();
      };
      void audio.play().catch(() => {
        this.playing = false;
        resolve();
      });
    });
  }
}
