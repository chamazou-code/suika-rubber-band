import './style.css';
import { Game, readBest, saveBest } from './game';
import { Renderer } from './render';
import { Sound } from './audio';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const root = $('game'), action = $<HTMLButtonElement>('action'), soundButton = $<HTMLButtonElement>('sound');
const count = $('band-count'), feedback = $('feedback'), result = $('result'), announcement = $('announcement');
const game = new Game(), sound = new Sound();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let renderer: Renderer | null = null;
let storage: Storage | undefined;
try { storage = window.localStorage; } catch { /* Storage is optional. */ }
let best = readBest(storage), previousBest = best;
let frame = 0, lastTime = 0, visibleFeedback = false, destroyed = false, prepared = false;
const animations = new Map<string, Animation>(), events = new AbortController();

function animateUI(key: string, element: HTMLElement, frames: Keyframe[], duration: number) {
  animations.get(key)?.cancel(); animations.delete(key);
  if (motion.matches) return;
  const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
  animations.set(key, animation);
  animation.onfinish = () => { if (animations.get(key) === animation) animations.delete(key); };
}
function clearAnimations() { for (const animation of animations.values()) animation.cancel(); animations.clear(); }
function announce(text: string) { announcement.textContent = text; }
function updatePhase() {
  root.dataset.phase = game.phase;
  const playing = game.phase === 'playing', ended = game.phase === 'result';
  const locked = game.phase === 'cracking' || game.phase === 'bursting';
  action.disabled = locked || !prepared || !renderer?.available;
  result.hidden = !ended;
  $('action-label').textContent = playing ? 'ADD BAND' : ended ? 'TRY ANOTHER' : locked ? '…' : 'TAP TO START';
  $('action-icon').textContent = playing ? '+' : ended ? '↻' : locked ? '' : '↗';
  action.setAttribute('aria-label', playing ? '輪ゴムを1本巻く' : ended ? '新しいスイカで再挑戦' : 'ゲームを開始');
  $('stage-copy').textContent = ended ? 'もう1個、いっとく？' : 'あと1本、いける？';
  $('phase-label').textContent = ended ? 'THAT WAS JUICY.' : 'ONE TAP. ONE BAND.';
  $('meter-title').textContent = locked ? '' : 'SAFEを狙ってタップ';
  $('meter-visual').setAttribute('aria-hidden', String(ended));
  $('retry-message').setAttribute('aria-hidden', String(!ended));
  $('hud-best').textContent = String(best);
}
function start() {
  clearAnimations(); visibleFeedback = false; feedback.classList.remove('show');
  previousBest = best; game.start(); renderer?.reset(); count.textContent = '0'; updatePhase();
  announce('スタート。SAFEを狙ってタップすると輪ゴムが1本増えます。');
}
function perform() {
  if (document.hidden || !prepared || !renderer?.available) return;
  void sound.unlock();
  if (game.phase === 'ready' || game.phase === 'result') { start(); return; }
  const grade = game.tap(); if (!grade) return;
  sound.snap(grade); count.textContent = String(game.bands);
  $('feedback-text').textContent = grade === 'perfect' ? (game.combo > 1 ? `PERFECT ×${game.combo}` : 'PERFECT!') : grade === 'good' ? 'GOOD!' : 'MISS!';
  feedback.dataset.grade = grade; feedback.classList.add('show'); visibleFeedback = true;
  $('feedback-symbol').textContent = grade === 'perfect' ? '✦' : grade === 'good' ? '✓' : '·';
  animateUI('score', count, [{ transform: getComputedStyle(count).transform }, { transform: 'translateY(-2px) scale(1.05)', offset: .3 }, { transform: 'none' }], 220);
  animateUI('feedback', feedback, [{ transform: 'translate(-50%,7px) scale(.96)', opacity: .3 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }], 160);
  animateUI('button', action, [{ transform: 'translateY(2px)' }, { transform: 'none' }], 120);
  announce(`${game.bands}本。${grade.toUpperCase()}${game.combo > 1 ? `、${game.combo}コンボ` : ''}`);
  if (game.phase === 'cracking') { sound.crack(); feedback.classList.remove('show'); visibleFeedback = false; updatePhase(); }
}
root.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary) return;
  const target = event.target as HTMLElement;
  if (target.closest('#sound, #reload')) return;
  if (game.phase === 'result' && !target.closest('#action')) return;
  perform();
}, { signal: events.signal });
action.addEventListener('click', event => { if (event.detail === 0) perform(); }, { signal: events.signal });
$('reload').addEventListener('click', () => location.reload(), { signal: events.signal });
soundButton.addEventListener('click', () => {
  sound.toggle(); $('sound-hint').textContent = sound.enabled ? 'SOUND ON' : 'SOUND OFF';
  soundButton.setAttribute('aria-pressed', String(sound.enabled));
  soundButton.setAttribute('aria-label', sound.enabled ? 'サウンドをオフにする' : 'サウンドをオンにする');
}, { signal: events.signal });
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.target === soundButton || event.target === $('reload')) return;
  event.preventDefault(); if (!event.repeat) perform();
}, { signal: events.signal });

function loop(now: number) {
  if (destroyed || document.hidden || !renderer?.available) { frame = 0; return; }
  const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0; lastTime = now;
  const effect = game.tick(dt);
  if (effect === 'burst') { renderer.burst(); sound.burst(); updatePhase(); }
  if (effect === 'hit') sound.spray();
  if (effect === 'result') {
    best = Math.max(best, game.bands); saveBest(best, storage);
    $('result-count').textContent = String(game.bands); $('perfect-rate').textContent = `${game.perfectRate}%`; $('best-count').textContent = String(best);
    result.dataset.newBest = String(game.bands > previousBest);
    $('result-title').textContent = game.bands > previousBest ? 'NEW PERSONAL BEST' : 'NICE SQUEEZE!';
    updatePhase(); announce(`スイカがはじけました。${game.bands}本。PERFECT ${game.perfectRate}%。ベスト${best}本。新しいスイカで再挑戦できます。`);
    animateUI('result', result, [{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 220);
    action.focus({ preventScroll: true });
  }
  if (visibleFeedback && game.feedbackTime <= 0) { feedback.classList.remove('show'); visibleFeedback = false; }
  renderer.render(game, now / 1000, motion.matches);
  frame = requestAnimationFrame(loop);
}
function pause() { if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = 0; sound.suspend(); }
function resume() { if (!frame && prepared && renderer?.available && !destroyed && !document.hidden) { lastTime = 0; frame = requestAnimationFrame(loop); } }
function availability(available: boolean) {
  root.dataset.render = available ? 'ready' : 'unavailable'; $('render-error').hidden = available;
  if (!available && prepared) {
    $('render-error').querySelector('strong')!.textContent = '3D表示が一時停止しました';
    $('render-error').querySelector('p')!.textContent = '表示の復帰を待っています。戻らない場合は再読み込みしてください。';
  }
  updatePhase(); if (available) resume(); else pause();
}
async function initialize() {
  try {
    renderer = new Renderer($<HTMLCanvasElement>('scene'), $<HTMLCanvasElement>('meter'));
    renderer.onAvailabilityChange = availability;
    await renderer.prepare();
    if (destroyed) return;
    prepared = true; availability(renderer.available);
    renderer.render(game, performance.now() / 1000, motion.matches);
  } catch (error) {
    renderer?.dispose(); renderer = null; availability(false);
    console.warn('3D rendering is unavailable.', error instanceof Error ? error.message : 'WebGL2 initialization failed');
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else resume(); }, { signal: events.signal });
window.addEventListener('pagehide', event => { pause(); if (!event.persisted) dispose(); }, { signal: events.signal });
window.addEventListener('pageshow', () => { renderer?.resize(); resume(); }, { signal: events.signal });
function dispose() { destroyed = true; pause(); clearAnimations(); events.abort(); renderer?.dispose(); sound.dispose(); }
if (import.meta.hot) import.meta.hot.dispose(dispose);
updatePhase(); void initialize();
