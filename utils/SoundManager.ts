/**
 * Synthesized PS2-style system voices. No samples or trademarked audio.
 *
 * The graph is: voice -> master gain -> low-pass -> compressor -> destination.
 * UI voices use short soft envelopes; the boot pad has a long swell and tail.
 * A hard three-voice cap keeps rapid navigation from stacking nodes.
 */

export type SoundEvent = 'cursor' | 'confirm' | 'back' | 'error';

// The early build ran at 0.15 with no filter. A slightly higher master plus
// the low-pass below keeps the same quiet level without the bright edge.
const MASTER = 0.18;
const MAX_VOICES = 3;
// One gentle low-pass across the whole system keeps the high harmonics soft.
const TONE_CUTOFF = 1500;
/** ~40% longer than the old 3.85 s pad, so the tone carries the boot out. */
const BOOT_LONG_SECONDS = 5.4;
const BOOT_SHORT_SECONDS = 1.75;

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
  private toneFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  /** Output fader: the only node that is ramped to silence on suspend. */
  private output: GainNode | null = null;
  private suspendTimer: number | null = null;
  private muted = false;
  private voices = 0;
  private activeSources = new Set<AudioScheduledSourceNode>();
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

  /** A context exists and can accept nodes, even while it is resuming. */
  public get ready(): boolean {
    return this.ctx !== null && (this.ctx.state as string) !== 'closed'
      && this.master !== null && this.compressor !== null;
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
      const toneFilter = ctx.createBiquadFilter();
      const compressor = ctx.createDynamicsCompressor();
      const output = ctx.createGain();
      master.gain.value = this.muted ? 0.0001 : MASTER;
      output.gain.value = 1;
      toneFilter.type = 'lowpass';
      toneFilter.frequency.value = TONE_CUTOFF;
      toneFilter.Q.value = 0.3;
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 2;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.3;
      master.connect(toneFilter);
      toneFilter.connect(compressor);
      compressor.connect(output);
      output.connect(ctx.destination);
      ctx.onstatechange = () => this.notify();
      this.ctx = ctx;
      this.master = master;
      this.toneFilter = toneFilter;
      this.compressor = compressor;
      this.output = output;
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  private teardown(): void {
    this.stopBoot();
    this.clearSuspendTimer();
    this.ctx = null;
    this.master = null;
    this.toneFilter = null;
    this.compressor = null;
    this.output = null;
    this.activeSources.clear();
    this.voices = 0;
    this.notify();
  }

  private clearSuspendTimer(): void {
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
  }

  /**
   * Bring the output fader back after a silent park. The ramp is short but
   * starts at the fader's current value, so resuming never steps the signal.
   */
  private wakeOutput(): void {
    this.clearSuspendTimer();
    const ctx = this.ctx;
    const output = this.output;
    if (!ctx || !output) return;
    const now = ctx.currentTime;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(output.gain.value, now);
    output.gain.linearRampToValueAtTime(1, now + 0.02);
  }

  /**
   * Synchronous iOS unlock for a live user gesture: create or resume the
   * context and play a one-sample silent buffer through the destination.
   * The buffer queues while the context is still suspended and flushes on
   * resume, which is what lifts the Safari gesture requirement.
   */
  public primeFromGesture(): boolean {
    if (!this.available) return false;

    if (this.ctx && (this.ctx.state as string) === 'closed') this.teardown();
    if (!this.ctx && !this.create()) return false;

    const ctx = this.ctx;
    if (!ctx) return false;

    if (ctx.state !== 'running') {
      try {
        // A context that cannot start still returns a rejected promise on
        // WebKit; it must not surface as an unhandled page error.
        void ctx.resume().catch(() => {});
      } catch {
        // The next gesture retries.
      }
    }

    this.wakeOutput();

    try {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // The silent buffer is best-effort; resume still ran in the gesture.
    }

    this.notify();
    return (ctx.state as string) === 'running';
  }

  /**
   * Create or resume the context. Call this synchronously inside a user
   * gesture: browsers only allow the resume while activation is live.
   */
  public async ensureRunning(): Promise<boolean> {    if (!this.available) return false;

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

    if ((ctx.state as string) === 'running') this.wakeOutput();
    this.notify();
    return (ctx.state as string) === 'running';
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

  private track(source: AudioScheduledSourceNode): void {
    this.activeSources.add(source);
    source.addEventListener('ended', () => this.activeSources.delete(source));
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
    gain.gain.setValueAtTime(0, start);
    // A 20 ms attack takes the edge off the note while it stays responsive.
    gain.gain.linearRampToValueAtTime(level, start + 0.02);
    // A linear release reaches true zero before the source is stopped, so no
    // trailing sample is cut mid-waveform.
    gain.gain.linearRampToValueAtTime(0, start + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
    this.track(osc);
  }

  /** Soft sine blip: 600 to 400 Hz, the early build's hover voice. */
  private cursor(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.005;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.055);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.012);
    gain.gain.linearRampToValueAtTime(0, t + 0.075);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.08);
    this.track(osc);
  }

  /** Two quiet low notes, a major third apart, with no bell partials. */
  private confirm(short: boolean): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.005;
    this.tone(master, 'sine', 262, t, short ? 0.16 : 0.2, 0.12);
    this.tone(master, 'sine', 330, t + (short ? 0.055 : 0.075), short ? 0.22 : 0.34, 0.14);
  }

  /** One low sine falling from 200 to 100 Hz: the soft muted back tap. */
  private back(short: boolean): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.005;
    this.tone(master, 'sine', 200, t, short ? 0.16 : 0.22, 0.15, 100);
  }

  /** Two low, muted pulses for a failed action. */
  private error(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.005;
    this.tone(master, 'sine', 196, t, 0.16, 0.13, 140);
    this.tone(master, 'sine', 147, t + 0.14, 0.2, 0.14, 100);
  }

  public play(event: SoundEvent, short = false): void {
    // A suspended context still accepts nodes: schedule now so the gesture's
    // sound is already queued when resume() settles. Only a missing or closed
    // context drops the event.
    if (!this.ready || this.muted) return;
    this.wakeOutput();

    const durations: Record<SoundEvent, number> = {
      cursor: 120,
      confirm: short ? 320 : 480,
      back: short ? 260 : 300,
      error: 400,
    };
    if (!this.acquire(durations[event])) return;

    // A tiny observation hook for the browser checks. It carries the logical
    // event and voice name, never audio data, and has no effect on synthesis.
    const voice: Record<SoundEvent, string> = {
      cursor: 'tick',
      confirm: 'select',
      back: 'tap',
      error: 'error',
    };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jsb:sound', { detail: { event, voice: voice[event] } }));
    }

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
   * Warm boot pad: 200/300/450 Hz through a slowly opening low-pass. No bell
   * or ding rides on top. `short` is used under reduced motion.
   */
  public playBoot(short = false): void {
    if (!this.ready || this.muted) return;
    this.stopBoot();
    if (!this.acquire(short ? 1750 : 5400)) return;

    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + 0.02;
    const length = short ? BOOT_SHORT_SECONDS : BOOT_LONG_SECONDS;

    const out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(master);
    this.wakeOutput();

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(short ? 600 : 300, t);
    filter.frequency.linearRampToValueAtTime(short ? 1100 : 1200, t + length * 0.42);

    const pad = ctx.createGain();
    const peak = short ? 0.1 : 0.12;
    pad.gain.setValueAtTime(0, t);
    // A slow one-second swell and a long release to true zero keep it gentle.
    pad.gain.linearRampToValueAtTime(peak, t + (short ? 0.3 : 1));
    pad.gain.setValueAtTime(peak, t + length * 0.58);
    pad.gain.linearRampToValueAtTime(0, t + length);
    filter.connect(pad);
    pad.connect(out);

    [200, 300, 450].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 2 ? 'triangle' : 'sine';
      osc.frequency.value = frequency;
      osc.detune.value = index === 2 ? 0 : index === 0 ? -4 : 3;
      const level = index === 2 ? 0.1 : 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.015);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(t);
      osc.stop(t + length + 0.05);
      this.bootOscillators.push(osc);
      this.track(osc);
    });

    this.bootOut = out;
  }

  /** Fade and stop the boot pad so it never runs underneath the menu. */
  public stopBoot(): void {
    if (this.ctx && this.bootOut) {
      const now = this.ctx.currentTime;
      const gain = this.bootOut.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      // A short fade to true zero: stopping mid-waveform is what clicked.
      gain.linearRampToValueAtTime(0, now + 0.06);
    }
    this.bootOscillators.forEach(osc => {
      try {
        osc.stop((this.ctx?.currentTime ?? 0) + 0.12);
      } catch {
        // Already stopped.
      }
    });
    this.bootOscillators = [];
    this.bootOut = null;
  }

  /**
   * Silence the site when the page is hidden. The context keeps running: an
   * explicit `suspend()` renegotiates the device audio session and is what
   * interrupted other apps' music (and popped when the page came back).
   */
  public quiesce(): void {
    this.stopBoot();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const output = this.output;

    // Fade the whole output to true silence (~40 ms), then stop the sources
    // once they are inaudible. The context itself is never suspended,
    // resumed or closed from a lifecycle event.
    if (output) {
      output.gain.cancelScheduledValues(now);
      output.gain.setValueAtTime(output.gain.value, now);
      output.gain.linearRampToValueAtTime(0, now + 0.04);
    }

    this.clearSuspendTimer();
    this.suspendTimer = window.setTimeout(() => {
      this.suspendTimer = null;
      this.activeSources.forEach(source => {
        try {
          source.stop(ctx.currentTime);
        } catch {
          // Already stopped.
        }
        try {
          source.disconnect();
        } catch {
          // Already disconnected.
        }
      });
      this.activeSources.clear();
      this.voices = 0;
      this.notify();
    }, 70);
  }
}

export const soundManager = new SoundManager();
