import type { Grade } from './game';
import { makeMusic } from './music';
type AudioSession = { type: string };
export type SoundStatus = 'waiting' | 'on' | 'off';
/** Original, synthesized sounds only. No audio downloads or recorded voices. */
export class Sound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private music: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicLevel = .7;
  private paused = false;
  private session: AudioSession | null = null;
  private previousSessionType = 'auto';
  onStatusChange: (() => void) | null = null;
  enabled = true;
  get status(): SoundStatus { return !this.enabled ? 'off' : this.context?.state === 'running' && !this.paused ? 'on' : 'waiting'; }
  private playbackSession() {
    // Safari 17+: explicitly requested game audio should use media volume, including Silent Mode.
    const session = (navigator as unknown as { audioSession?: AudioSession }).audioSession;
    if (!session) return;
    try {
      if (!this.session) { this.session = session; this.previousSessionType = session.type; }
      if (session.type !== 'playback') session.type = 'playback';
    } catch { /* Other browsers may expose a read-only or unsupported session type. */ }
  }
  private releaseSession() {
    try { if (this.session) this.session.type = this.previousSessionType; } catch { /* Optional API. */ }
    this.session = null;
  }
  async unlock() {
    if (!this.enabled || this.paused) return false;
    try {
      const Audio = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return false;
      this.playbackSession();
      if (!this.context) {
        this.context = new Audio({ latencyHint: 'interactive' });
        this.context.onstatechange = () => this.onStatusChange?.();
        this.master = this.context.createGain();
        this.master.gain.value = 0.5;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -15;
        this.master.connect(compressor); compressor.connect(this.context.destination);
      }
      const context = this.context;
      // Invoke resume in the trusted input event, before doing any PCM synthesis or awaiting work.
      const resumed = context.state === 'running' ? Promise.resolve() : context.resume();
      if (!this.music) {
        const samples = makeMusic(), buffer = this.context.createBuffer(1, samples.length, 22050);
        buffer.copyToChannel(samples, 0);
        this.musicGain = this.context.createGain(); this.musicGain.gain.value = 0;
        this.musicGain.connect(this.master!);
        this.music = this.context.createBufferSource(); this.music.buffer = buffer; this.music.loop = true;
        this.music.connect(this.musicGain); this.music.start();
        this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      await resumed;
      if (this.context !== context) return false;
      if (this.paused) { void context.suspend().catch(() => {}); return false; }
      if (!this.enabled) return false;
      this.musicGain?.gain.setTargetAtTime(this.musicLevel, context.currentTime, .08);
      return context.state === 'running';
    } catch { return false; /* The button offers another user-gesture retry instead of claiming SOUND ON. */ }
    finally { this.onStatusChange?.(); }
  }
  toggle() {
    // Before activation or after a rejected resume, the sound button means "try enabling sound".
    this.enabled = this.status !== 'on';
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.context.currentTime, .012);
    if (this.enabled) void this.unlock(); else this.releaseSession();
    this.onStatusChange?.();
  }
  /** Duck the music for the creak and burst; no pitch or tempo hints at hidden durability. */
  setPhase(phase: string) {
    this.musicLevel = phase === 'cracking' || phase === 'bursting' ? .09 : phase === 'result' ? .46 : .7;
    if (this.context && this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicLevel, this.context.currentTime, .06);
  }
  startRound() { this.tone(660,660,.16,.11,'sine');this.tone(990,990,.22,.1,'sine',.08); }
  private tone(start: number, end: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
    const ctx = this.context;
    if (!ctx || !this.master || !this.enabled || this.paused || ctx.state !== 'running') return;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(start, at); osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
    gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(volume,at+0.006); gain.gain.exponentialRampToValueAtTime(0.001,at+duration);
    osc.connect(gain); gain.connect(this.master); osc.start(at); osc.stop(at+duration+0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  private noise(duration: number, volume: number, frequency: number, delay = 0) {
    const ctx = this.context;
    if (!ctx || !this.master || !this.noiseBuffer || !this.enabled || this.paused || ctx.state !== 'running') return;
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
  spray() { this.noise(.18,.24,2100);this.noise(.13,.14,1200,.07);this.tone(180,70,.13,.09,'triangle'); }
  suspend() { this.paused = true; this.releaseSession(); if (this.context?.state === 'running') void this.context.suspend().catch(() => {}); this.onStatusChange?.(); }
  resume() { this.paused = false; if (this.context && this.enabled) void this.unlock(); }
  dispose() {
    this.onStatusChange = null; this.releaseSession();
    if (this.context) this.context.onstatechange = null;
    this.music?.stop(); this.music?.disconnect(); this.musicGain?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null; this.master = null; this.noiseBuffer = null; this.music = null; this.musicGain = null;
  }
}
