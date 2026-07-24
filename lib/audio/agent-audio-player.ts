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

  get isPlaying() {
    return this.playing;
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

  private playChunk(chunk: AudioChunkInput): Promise<void> {
    const bytes = decodeBase64(chunk.chunkBase64);
    const mime = mimeFor(chunk.encoding, chunk.sampleRate);
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);

    return new Promise((resolve) => {
      const audio = new Audio(url);
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
