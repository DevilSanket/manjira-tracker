class AmbienceService {
  private started: boolean = false;
  private auElement: HTMLAudioElement | null = null;
  private isLoading: boolean = false;
  private volume: number = 0; // Set base volume

  constructor() {}

  async start() {
    // If already playing or loading, don't trigger again
    if (this.started || this.isLoading) return;
    this.isLoading = true;

    try {
      console.log("AmbienceService: Starting background music...");

      if (!this.auElement) {
        this.auElement = new Audio("/bgm.mp3");
        this.auElement.loop = true;
        this.auElement.volume = this.volume;
        this.auElement.addEventListener("error", (e) => {
          console.warn(
            "AmbienceService: Failed to load bgm.mp3. Please ensure it is a valid audio file.",
          );
        });
      }

      await this.auElement.play();
      this.started = true;
      console.log("AmbienceService: Playing background music");
    } catch (err) {
      console.error("AmbienceService: Failed to start bgm", err);
    } finally {
      this.isLoading = false;
    }
  }

  stop() {
    if (this.auElement) {
      this.auElement.pause();
      this.auElement.currentTime = 0;
    }
    this.started = false;
  }

  setVolume(val: number) {
    let linearVol = val;
    if (val < 0) {
      linearVol = Math.pow(10, val / 20);
    }
    this.volume = linearVol;
    if (this.auElement) {
      this.auElement.volume = this.volume;
    }
  }
}

export const ambienceService = new AmbienceService();
