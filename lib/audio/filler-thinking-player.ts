export type FillerPlayResult = "playing" | "blocked" | "failed";

/**
 * Âm thanh chờ thinking — phát một lần WAV từ GET /fillers/:file.
 * Tách biệt AgentAudioPlayer (TTS) để không xung đột lifecycle.
 */
export class FillerThinkingPlayer {
  private audio: HTMLAudioElement | null = null;

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.removeAttribute("src");
    this.audio.load();
    this.audio = null;
  }

  async playOnce(url: string): Promise<FillerPlayResult> {
    this.stop();
    const audio = new Audio(url);
    audio.loop = false;
    audio.preload = "auto";
    this.audio = audio;

    try {
      await audio.play();
      return "playing";
    } catch (err) {
      this.stop();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "AbortError") return "blocked";
      return "failed";
    }
  }
}
