import { usePlayerStore } from '@/stores/playerStore';

export interface ProceduralSynthOptions {
  bpm?: number;
  rootFreq?: number;
  scale?: 'pentatonic' | 'major7' | 'ambient';
}

class ProceduralAmbientSynth {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private timer: number | null = null;
  private masterGain: GainNode | null = null;

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public start(): void {
    if (this.isRunning) return;
    try {
      const ctx = this.initContext();
      this.isRunning = true;
      const master = ctx.createGain();
      const currentVolume = usePlayerStore.getState().volumePercent / 100;
      master.gain.setValueAtTime(Math.max(0.01, currentVolume * 0.4), ctx.currentTime);
      master.connect(ctx.destination);
      this.masterGain = master;

      // Soothing chord frequencies (A minor 9 / F maj 7 ambient pads)
      const chords = [
        [220.0, 261.63, 329.63, 392.0, 493.88], // Am9
        [174.61, 220.0, 261.63, 329.63, 392.0],  // Fmaj7
        [196.0, 246.94, 293.66, 369.99, 440.0],  // G6
        [164.81, 220.0, 246.94, 329.63, 392.0],  // Em7
      ];

      let chordIndex = 0;

      const playChord = () => {
        if (!this.isRunning || !this.ctx || !this.masterGain) return;
        const currentChord = chords[chordIndex % chords.length] ?? [220, 330, 440];
        chordIndex++;
        const now = this.ctx.currentTime;
        const duration = 5.5;

        currentChord.forEach((freq, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          // Gentle detuning for lush chorus effect
          osc.frequency.setValueAtTime(freq + (idx * 0.4 - 0.8), now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800 + Math.sin(now) * 200, now);

          noteGain.gain.setValueAtTime(0.001, now);
          noteGain.gain.linearRampToValueAtTime(0.08 / currentChord.length, now + 1.2);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(this.masterGain);

          osc.start(now);
          osc.stop(now + duration);
        });

        this.timer = window.setTimeout(playChord, 5000);
      };

      playChord();
    } catch {
      // AudioContext policy fallback
    }
  }

  public setVolume(volumeFraction: number): void {
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        Math.max(0.0001, volumeFraction * 0.4),
        this.ctx.currentTime,
      );
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        void this.ctx.suspend();
      } catch {
        // ignore
      }
    }
  }
}

class HtmlAudioEngine {
  private audio: HTMLAudioElement | null = null;
  private synth = new ProceduralAmbientSynth();
  private currentUrl: string | null = null;
  private isProcedural = false;
  private onTrackEndedCallback: (() => void) | null = null;

  public constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';

      this.audio.addEventListener('timeupdate', () => {
        if (!this.audio || this.isProcedural) return;
        const currentMs = Math.round(this.audio.currentTime * 1000);
        usePlayerStore.getState().setPlaybackSnapshot({
          positionMs: currentMs,
          isPlaying: !this.audio.paused,
        });
      });

      this.audio.addEventListener('playing', () => {
        usePlayerStore.getState().setPlaybackSnapshot({ isPlaying: true });
      });

      this.audio.addEventListener('pause', () => {
        if (!this.isProcedural) {
          usePlayerStore.getState().setPlaybackSnapshot({ isPlaying: false });
        }
      });

      this.audio.addEventListener('ended', () => {
        usePlayerStore.getState().setPlaybackSnapshot({ isPlaying: false });
        if (this.onTrackEndedCallback) {
          this.onTrackEndedCallback();
        }
      });

      this.audio.addEventListener('error', () => {
        // Fall back gracefully to procedural ambient synthesizer if network/format fails
        if (this.currentUrl && !this.isProcedural) {
          this.playProcedural();
        }
      });
    }
  }

  public setOnTrackEnded(callback: () => void): void {
    this.onTrackEndedCallback = callback;
  }

  public async playUrl(url: string, startMs = 0): Promise<void> {
    this.synth.stop();
    this.isProcedural = false;

    if (!this.audio) {
      this.audio = new Audio();
    }

    if (this.currentUrl !== url) {
      this.audio.src = url;
      this.currentUrl = url;
    }

    const currentVol = usePlayerStore.getState().volumePercent / 100;
    this.audio.volume = Math.max(0, Math.min(1, currentVol));

    if (startMs > 0) {
      this.audio.currentTime = startMs / 1000;
    }

    try {
      await this.audio.play();
      usePlayerStore.getState().setPlaybackSnapshot({
        isPlaying: true,
        positionMs: startMs,
      });
    } catch {
      // If audio file URL cannot be decoded or autoplay blocked, fallback to procedural synth
      this.playProcedural();
    }
  }

  public playProcedural(): void {
    if (this.audio) {
      this.audio.pause();
    }
    this.isProcedural = true;
    this.synth.start();
    usePlayerStore.getState().setPlaybackSnapshot({
      isPlaying: true,
    });
  }

  public pause(): void {
    if (this.isProcedural) {
      this.synth.stop();
      usePlayerStore.getState().setPlaybackSnapshot({ isPlaying: false });
    } else if (this.audio) {
      this.audio.pause();
      usePlayerStore.getState().setPlaybackSnapshot({ isPlaying: false });
    }
  }

  public async resume(): Promise<void> {
    if (this.isProcedural) {
      this.synth.start();
      usePlayerStore.getState().setPlaybackSnapshot({ isPlaying: true });
    } else if (this.audio && this.audio.src) {
      try {
        await this.audio.play();
        usePlayerStore.getState().setPlaybackSnapshot({ isPlaying: true });
      } catch {
        this.playProcedural();
      }
    } else {
      this.playProcedural();
    }
  }

  public seek(positionMs: number): void {
    if (this.audio && !this.isProcedural) {
      this.audio.currentTime = positionMs / 1000;
      usePlayerStore.getState().setPlaybackSnapshot({ positionMs });
    }
  }

  public setVolume(volumeFraction: number): void {
    const clamped = Math.max(0, Math.min(1, volumeFraction));
    if (this.audio) {
      this.audio.volume = clamped;
    }
    this.synth.setVolume(clamped);
  }

  public stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.synth.stop();
    this.isProcedural = false;
    usePlayerStore.getState().setPlaybackSnapshot({ isPlaying: false, positionMs: 0 });
  }

  public isUsingProcedural(): boolean {
    return this.isProcedural;
  }
}

export const htmlAudioEngine = new HtmlAudioEngine();
