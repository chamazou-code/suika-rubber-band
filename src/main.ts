import './style.css';
import { Game, readBest, saveBest } from './game';
import { Renderer } from './render';
import { Sound } from './audio';
const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const root=$('game');const action=$<HTMLButtonElement>('action');const actionLabel=$('action-label');const soundButton=$<HTMLButtonElement>('sound');
const count=$('band-count');const feedback=$('feedback');const result=$('result');const copy=$('stage-copy');const announcement=$('announcement');
const game=new Game();const sound=new Sound();
const renderer=new Renderer($<HTMLCanvasElement>('scene'),$<HTMLCanvasElement>('meter'));
const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
let storage:Storage|undefined;try{storage=window.localStorage;}catch{/* Disabled storage is allowed. */}
let best=readBest(storage);let previousBest=best;
let frame=0;let lastTime=0;let visibleFeedback=false;let destroyed=false;
const animations=new Map<string,Animation>();
function animateUI(key:string,element:HTMLElement,frames:Keyframe[],duration:number){
  animations.get(key)?.cancel();
  animations.delete(key);
  if(motion.matches)return;
  const animation=element.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
  animations.set(key,animation);
  animation.onfinish=()=>{if(animations.get(key)===animation)animations.delete(key);};
}
function clearAnimations(){for(const animation of animations.values())animation.cancel();animations.clear();}
const events=new AbortController();
function announce(text:string){announcement.textContent=text;}
function updatePhase(){
  root.dataset.phase=game.phase;
  const playing=game.phase==='playing';const ended=game.phase==='result';const locked=game.phase==='cracking'||game.phase==='bursting';
  action.disabled=locked;
  result.hidden=!ended;
  actionLabel.textContent=playing?'TAP · 巻く':ended?'TRY ANOTHER 🍉':locked?'…':'TAP TO START';
  $('action-icon').textContent=playing?'+1':ended?'↻':locked?'':'↗';
  action.setAttribute('aria-label',playing?'輪ゴムを1本巻く':ended?'新しいスイカで再挑戦':'ゲームを開始');
  copy.textContent=playing?'狙って、パチン。':ended?'もう1個、いっとく？':locked?'':'あと1本、いける？';
  $('meter-title').textContent=locked?'':'SAFEを狙ってタップ';
  $('phase-label').textContent=ended?'THAT WAS JUICY.':'ONE TAP. ONE BAND.';
  $('meter-visual').setAttribute('aria-hidden',String(ended));
  $('retry-message').setAttribute('aria-hidden',String(!ended));
}
function start(){
  clearAnimations();visibleFeedback=false;feedback.classList.remove('show');
  previousBest=best;game.start();renderer.reset();count.textContent='0';updatePhase();
  announce('スタート。SAFEを狙ってタップすると輪ゴムが1本増えます。');
}
function perform(){
  if(document.hidden)return;
  void sound.unlock();
  if(game.phase==='ready'||game.phase==='result'){start();return;}
  const grade=game.tap();if(!grade)return;
  sound.snap(grade);count.textContent=String(game.bands);
  $('feedback-text').textContent=grade==='perfect'?(game.combo>1?`PERFECT ×${game.combo}`:'PERFECT!'):grade==='good'?'GOOD!':'MISS!';
  feedback.dataset.grade=grade;feedback.classList.add('show');visibleFeedback=true;
  $('feedback-symbol').textContent=grade==='perfect'?'✦':grade==='good'?'✓':'·';
  const currentCountTransform=getComputedStyle(count).transform;
  animateUI('score',count,[{transform:currentCountTransform},{transform:'translateY(-3px) scale(1.06)',offset:.3},{transform:'none'}],240);
  animateUI('feedback',feedback,[{transform:'translate(-50%,-40%) rotate(-5deg) scale(.92)',opacity:.4},{transform:'translate(-50%,-50%) rotate(-5deg) scale(1)',opacity:1}],160);
  animateUI('button',action,[{transform:'translateY(2px)'},{transform:'none'}],130);
  announce(`${game.bands}本。${grade.toUpperCase()}${game.combo>1?`、${game.combo}コンボ`:''}`);
  if(game.phase==='cracking'){sound.crack();feedback.classList.remove('show');visibleFeedback=false;updatePhase();}
}
root.addEventListener('pointerdown',(event)=>{
  if(event.button!==0||!event.isPrimary)return;
  const target=event.target as HTMLElement;
  if(target.closest('#sound'))return;
  if(game.phase==='result'&&!target.closest('#action'))return;
  // One pointer event, independent of the later synthetic click. No touch/click double firing.
  perform();
},{signal:events.signal});
action.addEventListener('click',(event)=>{if(event.detail===0)perform();},{signal:events.signal});
soundButton.addEventListener('click',()=>{
  sound.toggle();$('sound-hint').textContent=sound.enabled?'音ありがおすすめ':'サウンド OFF';soundButton.setAttribute('aria-pressed',String(sound.enabled));soundButton.setAttribute('aria-label',sound.enabled?'サウンドをオフにする':'サウンドをオンにする');
},{signal:events.signal});
document.addEventListener('keydown',(event)=>{
  if(event.code!=='Space'||event.target===soundButton)return;
  event.preventDefault();if(!event.repeat)perform();
},{signal:events.signal});
function loop(now:number){
  if(destroyed||document.hidden){frame=0;return;}
  const dt=lastTime?Math.min((now-lastTime)/1000,.05):0;lastTime=now;
  const effect=game.tick(dt);
  if(effect==='burst'){renderer.burst();sound.burst();updatePhase();}
  if(effect==='hit')sound.hit();
  if(effect==='result'){
    best=Math.max(best,game.bands);saveBest(best,storage);
    $('result-count').textContent=String(game.bands);$('perfect-rate').textContent=`${game.perfectRate}%`;$('best-count').textContent=String(best);
    result.dataset.newBest=String(game.bands>previousBest);
    $('result-title').textContent=game.bands>previousBest?'NEW PERSONAL BEST':'NICE SQUEEZE!';
    updatePhase();announce(`スイカがはじけました。${game.bands}本。PERFECT ${game.perfectRate}%。ベスト${best}本。新しいスイカで再挑戦できます。`);
    animateUI('result',result,[{transform:'translate(-50%,12px) rotate(-2deg) scale(.98)',opacity:0},{transform:'translate(-50%,0) rotate(-2deg) scale(1)',opacity:1}],300);
    action.focus({preventScroll:true});
  }
  if(visibleFeedback&&game.feedbackTime<=0){feedback.classList.remove('show');visibleFeedback=false;}
  renderer.render(game,now/1000,motion.matches);
  frame=requestAnimationFrame(loop);
}
function pause(){if(frame)cancelAnimationFrame(frame);frame=0;lastTime=0;sound.suspend();}
function resume(){if(!frame&&!destroyed&&!document.hidden){lastTime=0;frame=requestAnimationFrame(loop);}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else resume();},{signal:events.signal});
window.addEventListener('pagehide',(event)=>{pause();if(!event.persisted)dispose();},{signal:events.signal});
window.addEventListener('pageshow',()=>{renderer.resize();resume();},{signal:events.signal});
function dispose(){destroyed=true;pause();clearAnimations();events.abort();renderer.dispose();sound.dispose();}
if(import.meta.hot)import.meta.hot.dispose(dispose);
updatePhase();resume();
