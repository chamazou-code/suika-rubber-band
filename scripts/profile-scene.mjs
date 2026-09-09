// Development-only renderer harness. No hooks or diagnostics are shipped in the game UI.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});
const origin=process.env.GAME_URL || 'http://127.0.0.1:5173';
await page.route('**/qa-harness',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0}#scene{width:390px;height:844px}#meter{position:absolute;width:300px;height:130px;left:0;top:0}</style><canvas id="scene"></canvas><canvas id="meter"></canvas>'}));
await page.goto(`${origin}/qa-harness`);
const report=await page.evaluate(async()=>{
  const {Renderer}=await import('/src/render.ts');const {Game}=await import('/src/game.ts');
  const renderer=new Renderer(document.querySelector('#scene'),document.querySelector('#meter'));
  await renderer.prepare();const game=new Game(()=>.999);game.start();
  let time=1;const draw=()=>renderer.render(game,time+=1/60,false);
  const sample=()=>({calls:renderer.webgl.info.render.calls,triangles:renderer.webgl.info.render.triangles,geometries:renderer.webgl.info.memory.geometries,textures:renderer.webgl.info.memory.textures,programs:renderer.webgl.info.programs.length});
  draw();const initial=sample(),camera=renderer.camera.position.clone().sub({x:0,y:.58,z:0});
  let draws=0;const render=renderer.webgl.render.bind(renderer.webgl);renderer.webgl.render=(...args)=>{draws++;return render(...args);};
  for(let i=0;i<120;i++)draw();const idleDraws=draws;
  const rounds=[];let late,peak,flight,releasedBands;
  for(let round=0;round<5;round++){
    game.start();renderer.reset();draw();
    for(let count=1;count<=70;count++){game.bands=count;game.snapTime=1;draw();}
    late=sample();game.phase='bursting';game.phaseTime=.15;renderer.burst();draw();peak=sample();
    flight={upperY:renderer.watermelon.upper.position.y,lowerY:renderer.watermelon.lower.position.y};
    game.phase='result';game.phaseTime=2.65;draw();for(let frame=0;frame<100;frame++)draw();rounds.push(sample());const matrix=renderer.watermelon.root.getObjectByName('ReleasedRubberBands').instanceMatrix.array;releasedBands={count:renderer.watermelon.root.getObjectByName('ReleasedRubberBands').count,firstDistance:Math.hypot(matrix[12],matrix[14]),lastDistance:Math.hypot(matrix[69*16+12],matrix[69*16+14])};
  }
  game.start();renderer.reset();draw();const reset=sample();
  const ratio=renderer.webgl.getPixelRatio();renderer.dispose();
  return{viewport:'390x844 DPR3',renderRatio:ratio,cameraDownDegrees:Math.asin(camera.y/camera.length())*180/Math.PI,initial,idleDrawsOver120Frames:idleDraws,late70:late,burst:peak,flight,releasedBands,rounds,reset,afterDispose:sample()};
});
console.log(JSON.stringify(report,null,2));await writeFile('artifacts/scene-profile.json',JSON.stringify(report,null,2));await browser.close();
