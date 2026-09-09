/** Pure rules. Durability and damage stay internal; neither is exposed by the UI. */
export type Phase = 'ready' | 'playing' | 'cracking' | 'bursting' | 'result';
export type Grade = 'perfect' | 'good' | 'miss';
export const SHOT_COOLDOWN = 0.29;
export const CRACK_DURATION = 0.24;
export const FLIGHT_DURATION = 0.24;
export const HIT_STOP = 0.14;
export const BURST_DURATION = 2.65;
export const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const safeWidth = (bands: number) => Math.max(0.065, 0.28 - Math.max(0, bands) * 0.0043);
// A one-way traverse takes 1.56s at the start, 0.94s at 30, 0.75s at 50.
export const needleSpeed = (bands: number) => Math.min(1.35, 0.64 + Math.max(0, bands) * 0.014);
export const positionAt = (phase: number) => 1 - Math.abs(1 - ((phase % 2) + 2) % 2);
export const perfectWidth = (width: number) => width * 0.34;

export class Game {
  phase: Phase = 'ready';
  bands = 0;
  perfects = 0;
  combo = 0;
  hiddenDamage = 0;
  burstThreshold = 0;
  safeCenter = 0.5;
  width = 0.28;
  needlePhase = 0.15;
  phaseTime = 0;
  runTime = 0;
  cooldown = 0;
  lastGrade: Grade | null = null;
  feedbackTime = 0;
  snapTime = 1;
  hitTriggered = false;
  constructor(private random: () => number = Math.random) {}
  get needle() { return positionAt(this.needlePhase); }
  get perfectRate() { return this.bands ? Math.round(this.perfects / this.bands * 100) : 0; }

  start() {
    this.phase = 'playing';
    this.bands = this.perfects = this.combo = this.hiddenDamage = 0;
    this.burstThreshold = 40 + Math.floor(this.random() * 31);
    this.needlePhase = 0.15;
    this.phaseTime = this.runTime = this.cooldown = this.feedbackTime = 0;
    this.snapTime = 1;
    this.lastGrade = null;
    this.hitTriggered = false;
    this.relocate();
  }
  private relocate() {
    this.width = safeWidth(this.bands);
    const margin = 0.085 + this.width / 2;
    const range = 1 - 2 * margin;
    const next = margin + this.random() * range;
    // Every band visibly relocates the zone; keep the entire zone off the edges.
    this.safeCenter = Math.abs(next - this.safeCenter) < 0.075
      ? margin + ((next - margin + range / 2) % range)
      : next;
  }
  tap(): Grade | null {
    if (this.phase !== 'playing' || this.cooldown > 0) return null;
    const distance = Math.abs(this.needle - this.safeCenter);
    const grade: Grade = distance <= perfectWidth(this.width) / 2 ? 'perfect'
      : distance <= this.width / 2 ? 'good' : 'miss';
    this.bands++;
    if (grade === 'perfect') { this.perfects++; this.combo++; }
    else {
      this.combo = 0;
      this.hiddenDamage += grade === 'good' ? 0.09 : 1.7 + Math.min(1.15, distance * 2.3);
    }
    this.lastGrade = grade;
    this.feedbackTime = 0.85;
    this.snapTime = 0;
    this.cooldown = SHOT_COOLDOWN;
    this.relocate();
    if (this.bands + this.hiddenDamage >= this.burstThreshold) {
      this.phase = 'cracking';
      this.phaseTime = 0;
    }
    return grade;
  }
  tick(dt: number): 'burst' | 'hit' | 'result' | null {
    if (!Number.isFinite(dt) || dt <= 0) return null;
    dt = Math.min(dt, 0.05); // Background/resume never jumps through a round.
    this.feedbackTime = Math.max(0, this.feedbackTime - dt);
    this.snapTime += dt;
    if (this.phase === 'playing' || this.phase === 'ready') {
      this.needlePhase = (this.needlePhase + needleSpeed(this.bands) * dt) % 2;
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.phase === 'playing') this.runTime += dt;
    }
    if (this.phase === 'cracking' || this.phase === 'bursting') this.phaseTime += dt;
    if (this.phase === 'cracking' && this.phaseTime >= CRACK_DURATION) {
      this.phase = 'bursting'; this.phaseTime = 0; return 'burst';
    }
    if (this.phase === 'bursting') {
      if (!this.hitTriggered && this.phaseTime >= FLIGHT_DURATION) {
        this.hitTriggered = true; return 'hit';
      }
      if (this.phaseTime >= BURST_DURATION) {
        this.phase = 'result'; return 'result';
      }
    }
    return null;
  }
}

export function readBest(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const raw = Number(storage?.getItem('rubber-band-best') ?? 0);
    return Number.isInteger(raw) && raw >= 0 && raw <= 70 ? raw : 0;
  } catch { return 0; }
}
export function saveBest(best: number, storage?: Pick<Storage, 'setItem'>) {
  try { storage?.setItem('rubber-band-best', String(best)); } catch { /* Private storage can be unavailable. */ }
}
