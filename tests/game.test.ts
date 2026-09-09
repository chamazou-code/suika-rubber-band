import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, safeWidth, needleSpeed, positionAt, readBest, saveBest } from '../src/game.ts';
const ready=(rng=()=>.5)=>{const g=new Game(rng);g.start();return g;};
const aim=(g:Game,p=g.safeCenter)=>{g.cooldown=0;g.needlePhase=p;return g.tap();};
test('every grade adds one band; PERFECT has no hidden damage and GOOD very little',()=>{
  const g=ready();assert.equal(aim(g),'perfect');assert.equal(g.bands,1);assert.equal(g.hiddenDamage,0);
  assert.equal(aim(g,g.safeCenter+g.width*.4),'good');assert.equal(g.bands,2);assert.equal(g.hiddenDamage,.09);
  assert.equal(aim(g,0),'miss');assert.equal(g.bands,3);assert.ok(g.hiddenDamage>1.7);
});
test('all-perfect players always burst at the individual threshold, from 40 through 70',()=>{
  for(let threshold=40;threshold<=70;threshold++){
    const g=ready(()=>((threshold-40)+.1)/31);
    for(let i=1;i<=threshold;i++){assert.equal(aim(g),'perfect');assert.equal(g.bands,i);assert.equal(g.phase,i===threshold?'cracking':'playing');}
    assert.equal(g.perfectRate,100);assert.equal(g.tap(),null);
  }
});
test('errors end the same individual melon earlier; consecutive PERFECT resets on GOOD or MISS',()=>{
  const g=ready();aim(g);aim(g);assert.equal(g.combo,2);aim(g,0);assert.equal(g.combo,0);
  while(g.phase==='playing')aim(g,0);assert.ok(g.bands<25);
});
test('difficulty progresses; random zones always relocate and remain safely inset',()=>{
  let seed=78;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let run=0;run<500;run++){
    const g=ready(random);
    while(g.phase==='playing'){
      const previous=g.safeCenter;aim(g);
      assert.ok(Math.abs(g.safeCenter-previous)>.074);
      assert.ok(g.safeCenter-g.width/2>=.085-1e-10);assert.ok(g.safeCenter+g.width/2<=.915+1e-10);
    }
  }
  assert.equal(safeWidth(0),.28);assert.ok(safeWidth(30)<.16);assert.equal(safeWidth(60),.065);
  assert.ok(needleSpeed(0)<needleSpeed(30));assert.ok(needleSpeed(30)<needleSpeed(50));assert.ok(needleSpeed(100)<1.4);
});
test('tap spam and blast input cannot corrupt state; each timed event fires once',()=>{
  const g=ready();aim(g,0);for(let i=0;i<500;i++)assert.equal(g.tap(),null);assert.equal(g.bands,1);
  while(g.phase==='playing')aim(g,0);
  const bands=g.bands;const events:string[]=[];
  for(let i=0;i<400;i++){assert.equal(g.tap(),null);const event=g.tick(.016);if(event)events.push(event);}
  assert.deepEqual(events,['burst','hit','result']);assert.equal(g.bands,bands);assert.equal(g.phase,'result');
});
test('restart clears all game state and invalid ticks never create NaN or advance',()=>{
  const g=ready();while(g.phase==='playing')aim(g,0);g.tick(.05);g.start();
  assert.equal(g.phase,'playing');assert.equal(g.bands,0);assert.equal(g.hiddenDamage,0);assert.equal(g.phaseTime,0);assert.equal(g.hitTriggered,false);assert.equal(g.lastGrade,null);
  const p=g.needlePhase;g.tick(NaN);g.tick(Infinity);g.tick(-1);assert.equal(g.needlePhase,p);assert.equal(g.perfectRate,0);
});
test('needle is a bounded triangle wave, independent of frame rate',()=>{
  assert.equal(positionAt(0),0);assert.equal(positionAt(.5),.5);assert.equal(positionAt(1),1);assert.equal(positionAt(1.5),.5);assert.equal(positionAt(2),0);
  for(let i=-100;i<100;i+=.13)assert.ok(positionAt(i)>=0&&positionAt(i)<=1);
  const a=ready(),b=ready();for(let i=0;i<600;i++)a.tick(1/60);for(let i=0;i<1200;i++)b.tick(1/120);assert.ok(Math.abs(a.needle-b.needle)<1e-10);
});
test('BEST safely handles corrupt, malicious, or unavailable localStorage',()=>{
  for(const value of ['NaN','Infinity','-1','2.5','99999','bad'])assert.equal(readBest({getItem:()=>value}),0);
  assert.equal(readBest({getItem:()=>'53'}),53);assert.equal(readBest({getItem:()=>{throw Error();}}),0);
  assert.doesNotThrow(()=>saveBest(55,{setItem:()=>{throw Error();}}));
});
