/**
 * Synthesized PS2-style system voices. No samples or trademarked audio.
 *
 * The graph is: voice -> master gain -> compressor -> destination. Every
 * oscillator is scheduled with short envelopes and a hard three-voice cap, so
 * rapid navigation cannot stack an unbounded number of nodes.
 */

export type SoundEvent = 'cursor' | 'confirm' | 'back' | 'error';

const MASTER = 0.7;
const MAX_VOICES = 3;
const NOISE_SECONDS = 0.02;

type AudioContextCtor = new () => AudioContext;

const getContextCtor = (): AudioContextCtor | null => {
  if (typeof window === 'undefined') return null;
  const candidate = window.AudioContext
    || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  return candidate ?? null;
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private voices = 0;
  private bootOut: GainNode | null = null;
  private bootOscillators: OscillatorNode[] = [];
  private listeners = new Set<() => void>();

  public get available(): boolean {
    return getContextCtor() !== null;
  }

  public get state(): string {
    return this.ctx?.state ?? 'uninitialized';
  }

  public isRunning(): boolean {
    return this.ctx?.state === 'running' && this.master !== null && this.compressor !== null;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  private create(): boolean {
    const Ctor = getContextCtor();
    if (!Ctor) return false;

    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();
      master.gain.value = this.muted ? 0.0001 : MASTER;
      compressor.threshold.value = -16;
      compressor.knee.value = 10;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      ctx.onstatechange = () => this.notify();
      this.ctx = ctx;
      this.master = master;
      this.compressor = compressor;
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  private teardown(): void {
    this.stopBoot();
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.noise = null;
    this.voices = 0;
    this.notify();
  }

  /**
   * Create or resume the context. Call this synchronously inside a user
   * gesture: browsers only allow the resume while activation is live.
   */
  public async ensureRunning(): Promise<boolean> {
    if (!this.available) return false;

    if (this.ctx && (this.ctx.state as string) === 'closed') this.teardown();
    if (!this.ctx && !this.create()) return false;

    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state === 'running') return true;

    try {
      await ctx.resume();
    } catch {
      // A rejected resume is recoverable on the next gesture.
    }

    if ((ctx.state as string) !== 'running') {
      await new Promise<void>(resolve => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          ctx.removeEventListener('statechange', onState);
          resolve();
        };
        const onState = () => {
          if ((ctx.state as string) === 'running') finish();
        };
        const timer = window.setTimeout(finish, 250);
        ctx.addEventListener('statechange', onState);
      });
    }

    this.notify();
    return (ctx.state as string) === 'running';
  }

  /**
   * Best-effort recovery after backgrounding. Never creates a context: that
   * still requires a gesture on iOS and Safari.
   */
  public async resumeIfPossible(): Promise<boolean> {
    if (!this.ctx || (this.ctx.state as string) === 'closed') return false;
    if (this.ctx.state === 'running' || this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') {
      try {
        await this.ctx.resume();
      } catch {
        // Leave it suspended; the next pointer or key gesture retries.
      }
    }
    this.notify();
    return this.isRunning();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0.0001 : MASTER, now, 0.012);
  }

  private acquire(durationMs: number): boolean {
    if (this.voices >= MAX_VOICES) return false;
    this.voices += 1;
    window.setTimeout(() => {
      this.voices = Math.max(0, this.voices - 1);
    }, durationMs);
    return true;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise && this.noise.sampleRate === ctx.sampleRate) return this.noise;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  private tone(
    destination: AudioNode,
    type: OscillatorType,
    frequency: number,
    start: number,
    duration: number,
    level: number,
    endFrequency?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  /** A soft glassy bell: fundamental plus two quiet inharmonic partials. */
  private bell(destination: AudioNode, frequency: number, start: number, duration: number, level: number): void {
    this.tone(destination, 'sine', frequency, start, duration, level);
    this.tone(destination, 'sine', frequency * 2.01, start, duration * 0.7, level * 0.22);
    this.tone(destination, 'sine', frequency * 2.99, start, duration * 0.45, level * 0.1);
  }

  /** Bright glassy cursor tick with a tiny noise transient. */
  private cursor(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.005;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1380, t);
    osc.frequency.exponentialRampToValueAtTime(1120, t + 0.028);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.06);

    const source = ctx.createBufferSource();
    const highpass = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    source.buffer = this.noiseBuffer(ctx);
    highpass.type = 'highpass';
    highpass.frequency.value = 2600;
    noiseGain.gain.setValueAtTime(0.055, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);
    source.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(master);
    source.start(t);
    source.stop(t + 0.016);
  }

  /** Two notes rising, with a brief bell tail. */
  private confirm(short: boolean): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.005;
    this.bell(master, 659.25, t, 0.14, 0.16);
    this.bell(master, 987.77, t + 0.075, short ? 0.26 : 0.46, 0.18);
  }

  /** One lower note falling, with a longer decay than a cursor tick. */
  private back(short: boolean): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.005;
    this.tone(master, 'sine', 440, t, short ? 0.2 : 0.36, 0.19, 220);
    this.tone(master, 'triangle', 220, t, short ? 0.16 : 0.26, 0.055, 110);
  }

  /** Two low, muted pulses for a failed action. */
  private error(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.005;
    this.tone(master, 'triangle', 196, t, 0.1, 0.16, 160);
    this.tone(master, 'triangle', 147, t + 0.11, 0.16, 0.17, 120);
  }

  public play(event: SoundEvent, short = false): void {
    if (!this.isRunning() || this.muted) return;

    const durations: Record<SoundEvent, number> = {
      cursor: 120,
      confirm: short ? 360 : 560,
      back: short ? 300 : 420,
      error: 420,
    };
    if (!this.acquire(durations[event])) return;

    try {
      if (event === 'cursor') this.cursor();
      else if (event === 'confirm') this.confirm(short);
      else if (event === 'back') this.back(short);
      else this.error();
    } catch {
      // Synthesis is decorative; a failed voice must never break navigation.
    }
  }

  /**
   * Warm boot pad: 200/300/450 Hz through a slowly opening low-pass, plus a
   * glassy 520/780 Hz bell. `short` is used under reduced motion.
   */
  public playBoot(short = false): void {
    if (!this.isRunning() || this.muted) return;
    this.stopBoot();
    if (!this.acquire(short ? 1500 : 4800)) return;

    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.02;
    const length = short ? 1.25 : 3.85;

    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(short ? 700 : 320, t);
    filter.frequency.linearRampToValueAtTime(short ? 1800 : 1600, t + length * 0.62);

    const pad = ctx.createGain();
    pad.gain.setValueAtTime(0.0001, t);
    pad.gain.linearRampToValueAtTime(short ? 0.09 : 0.11, t + (short ? 0.22 : 0.85));
    pad.gain.setValueAtTime(short ? 0.09 : 0.11, t + length * 0.6);
    pad.gain.exponentialRampToValueAtTime(0.0001, t + length);
    filter.connect(pad);
    pad.connect(out);

    [200, 300, 450].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 2 ? 'triangle' : 'sine';
      osc.frequency.value = frequency;
      osc.detune.value = index === 2 ? 0 : index === 0 ? -4 : 3;
      gain.gain.value = index === 2 ? 0.13 : 0.24;
      osc.connect(gain);
      gain.connect(filter);
      osc.start(t);
      osc.stop(t + length + 0.05);
      this.bootOscillators.push(osc);
    });

    this.bell(out, 520, t + (short ? 0.16 : 0.34), short ? 0.5 : 1.9, 0.07);
    this.bell(out, 780, t + (short ? 0.16 : 0.34), short ? 0.4 : 1.55, 0.04);

    this.bootOut = out;
  }

  /** Fade and stop the boot pad so it never runs underneath the menu. */
  public stopBoot(): void {
    if (this.ctx && this.bootOut) {
      const now = this.ctx.currentTime;
      const gain = this.bootOut.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(Math.max(0.0001, gain.value), now);
      gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    }
    this.bootOscillators.forEach(osc => {
      try {
        osc.stop((this.ctx?.currentTime ?? 0) + 0.22);
      } catch {
        // Already stopped.
      }
    });
    this.bootOscillators = [];
    this.bootOut = null;
  }
}

export const soundManager = new SoundManager();
