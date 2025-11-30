class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazy initialization handled in methods
  }

  private init() {
    if (!this.ctx) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.15; // Drastically reduced master volume
        this.masterGain.connect(this.ctx.destination);
      }
    }
    
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public resume() {
    this.init();
  }

  // Soft, subtle click
  public playHover() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Very short, soft sine blip
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01); // Soft attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05); // Fast decay

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Soft "Thud" or "Bloop"
  public playSelect() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  // Subtle "Zip" out
  public playBack() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  // Ambient swell, kept distinct but quieter
  public playBoot() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    const windOsc = this.ctx.createOscillator();
    windOsc.type = 'sine'; // Changed to sine for softness
    windOsc.frequency.setValueAtTime(60, t);
    windOsc.frequency.linearRampToValueAtTime(120, t + 3);
    
    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0, t);
    windGain.gain.linearRampToValueAtTime(0.1, t + 2);
    windGain.gain.linearRampToValueAtTime(0, t + 6);

    windOsc.connect(windGain);
    windGain.connect(this.masterGain);
    windOsc.start(t);
    windOsc.stop(t + 7);
  }
}

export const soundManager = new SoundManager();