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
let frame=0;let lastTime=0;let visibleFeedback=false;let feedbackAnimation:Animation|undefined;let destroyed=false;
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
  copy.textContent=playing?'タイミングひとつで、あと1本。':ended?'もう1個、いっとく？':locked?'':'あと1本、いける？';
  $('meter-title').textContent=ended?'次のスイカは、何本いける？':locked?'':'SAFEを狙って、輪ゴムを巻こう';
}
function start(){
  feedbackAnimation?.cancel();visibleFeedback=false;feedback.classList.remove('show');
  previousBest=best;game.start();renderer.reset();count.textContent='0';updatePhase();
  announce('スタート。SAFEを狙ってタップすると輪ゴムが1本増えます。');
}
function perform(){
  if(document.hidden)return;
  void sound.unlock();
  if(game.phase==='ready'||game.phase==='result'){start();return;}
  const grade=game.tap();if(!grade)return;
  sound.snap(grade);count.textContent=String(game.bands);
  feedback.textContent=grade==='perfect'?(game.combo>1?`PERFECT ×${game.combo}`:'PERFECT!'):grade==='good'?'GOOD!':'MISS!';
  feedback.dataset.grade=grade;feedback.classList.add('show');visibleFeedback=true;
  feedbackAnimation?.cancel();
  if(!motion.matches)feedbackAnimation=feedback.animate([{transform:'translate(-50%,-50%) rotate(-7deg) scale(.8)'},{transform:'translate(-50%,-50%) rotate(-7deg) scale(1)'}],{duration:180,easing:'ease-out'});
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
  sound.toggle();soundButton.setAttribute('aria-pressed',String(sound.enabled));soundButton.setAttribute('aria-label',sound.enabled?'サウンドをオフにする':'サウンドをオンにする');
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
    $('result-title').textContent=game.bands>previousBest?'NEW PERSONAL BEST!':'NICE SQUEEZE!';
    updatePhase();announce(`スイカがはじけました。${game.bands}本。PERFECT ${game.perfectRate}%。ベスト${best}本。新しいスイカで再挑戦できます。`);
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
function dispose(){destroyed=true;pause();feedbackAnimation?.cancel();events.abort();renderer.dispose();sound.dispose();}
if(import.meta.hot)import.meta.hot.dispose(dispose);
updatePhase();resume();
