import type { Grade } from './game';
/** Original, synthesized sounds only. No audio downloads or recorded voices. */
export class Sound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  enabled = true;
  async unlock() {
    if (!this.enabled) return;
    try {
      const Audio = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return;
      if (!this.context) {
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.gain.value = 0.5;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -15;
        this.master.connect(compressor); compressor.connect(this.context.destination);
        this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { /* The visual game still works if a browser disables audio. */ }
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.context && this.master) this.master.gain.setValueAtTime(this.enabled ? 0.5 : 0, this.context.currentTime);
    if (this.enabled) void this.unlock();
  }
  private tone(start: number, end: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
    const ctx = this.context;
    if (!ctx || !this.master || !this.enabled || ctx.state !== 'running') return;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(start, at); osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
    gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(volume,at+0.006); gain.gain.exponentialRampToValueAtTime(0.001,at+duration);
    osc.connect(gain); gain.connect(this.master); osc.start(at); osc.stop(at+duration+0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  private noise(duration: number, volume: number, frequency: number, delay = 0) {
    const ctx = this.context;
    if (!ctx || !this.master || !this.noiseBuffer || !this.enabled || ctx.state !== 'running') return;
    const at = ctx.currentTime+delay; const src = ctx.createBufferSource(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter();
    src.buffer = this.noiseBuffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(frequency,at);
    filter.frequency.exponentialRampToValueAtTime(120,at+duration);
    gain.gain.setValueAtTime(volume,at); gain.gain.exponentialRampToValueAtTime(.001,at+duration);
    src.connect(filter);filter.connect(gain);gain.connect(this.master);src.start(at);src.stop(at+duration+.02);
    src.onended = () => { src.disconnect();filter.disconnect();gain.disconnect(); };
  }
  snap(grade: Grade) {
    this.tone(420,95,.105,.18,'triangle'); this.noise(.045,.16,2700);
    if (grade === 'perfect') { this.tone(880,880,.14,.12,'sine',.025); this.tone(1320,1760,.2,.11,'sine',.085); }
    if (grade === 'good') this.tone(540,690,.14,.09,'sine',.025);
    if (grade === 'miss') this.tone(135,65,.16,.1,'triangle',.025);
  }
  crack() { this.noise(.16,.23,1100);this.noise(.07,.22,1800,.12);this.tone(95,55,.22,.2,'sawtooth'); }
  burst() { this.noise(.4,.78,6800);this.tone(190,35,.45,.58);this.noise(.22,.3,2300,.07); }
  hit() { this.noise(.23,.52,1800);this.tone(260,65,.2,.27,'triangle');this.tone(115,160,.22,.16,'sine',.12);this.tone(170,80,.35,.17,'triangle',.32); }
  suspend() { if (this.context?.state === 'running') void this.context.suspend().catch(() => {}); }
  dispose() { if (this.context) void this.context.close().catch(() => {}); this.context = null; this.master = null; this.noiseBuffer = null; }
}
