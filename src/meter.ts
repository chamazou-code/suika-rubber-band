import { Game, perfectWidth } from './game';

/** A lightweight 2D instrument, independent from the WebGL scene and game rules. */
export class Meter {
  private context: CanvasRenderingContext2D;
  private width = 300;
  private height = 155;
  private ratio = 1;
  constructor(private canvas: HTMLCanvasElement) { this.context = canvas.getContext('2d')!; }
  resize() {
    const bounds = this.canvas.getBoundingClientRect(); this.width = bounds.width; this.height = bounds.height;
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.ratio); this.canvas.height = Math.round(this.height * this.ratio);
  }
  render(game: Game) {
    if (game.phase === 'result') return;
    const c = this.context, w = this.width, h = this.height, cx = w / 2, cy = h - 24;
    const radius = Math.min(w * .43, h - 34), angle = (n: number) => Math.PI * (1 + n);
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); c.clearRect(0, 0, w, h);
    const arc = (from: number, to: number, r: number, width: number, color: string) => {
      c.beginPath(); c.arc(cx, cy, r, angle(from), angle(to)); c.lineWidth = width; c.strokeStyle = color; c.stroke();
    };
    arc(0, 1, radius + 9, 1.5, '#c5bc9c70'); arc(0, 1, radius - 2, 17, '#bc715562');
    const start = game.safeCenter - game.width / 2, end = game.safeCenter + game.width / 2;
    arc(start, end, radius - 2, 17, '#8bbd68');
    const perfect = perfectWidth(game.width);
    arc(game.safeCenter - perfect / 2, game.safeCenter + perfect / 2, radius - 2, 17, '#deeca4');
    for (let i = 0; i <= 40; i++) {
      const a = angle(i / 40), inner = radius - (i % 5 === 0 ? 27 : 23), outer = radius - 18;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner); c.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      c.lineWidth = i % 5 === 0 ? 1.5 : 1; c.strokeStyle = '#e4dec19c'; c.stroke();
    }
    const safeAngle = angle(game.safeCenter);
    c.font = '600 9px Outfit, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#deeca4';
    c.fillText('SAFE', cx + Math.cos(safeAngle) * (radius - 42), cy + Math.sin(safeAngle) * (radius - 42) + 3);
    c.save(); c.translate(cx, cy); c.rotate(angle(game.needle));
    c.shadowColor = '#00000060'; c.shadowBlur = 5; c.shadowOffsetY = 2;
    c.beginPath(); c.moveTo(-5, -6); c.lineTo(radius + 3, 0); c.lineTo(-5, 6); c.closePath(); c.fillStyle = '#fffbe7'; c.fill(); c.restore();
    c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.fillStyle = '#c2bda1'; c.fill();
    c.beginPath(); c.arc(cx, cy, 3.5, 0, Math.PI * 2); c.fillStyle = '#ede8ce'; c.fill();
    c.font = '500 8px Outfit, sans-serif'; c.fillStyle = '#d5ceb6'; c.textAlign = 'left'; c.fillText('DANGER', cx - radius - 6, h - 4);
    c.textAlign = 'right'; c.fillText('DANGER', cx + radius + 6, h - 4);
  }
}
