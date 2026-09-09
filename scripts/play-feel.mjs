// QA player reads only the painted meter and operates the public button.
// No game internals, seeded durability, fake clock or production test hooks.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}});
const reports=[];
for(const style of ['careful','mixed','careful']){
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173/');await page.locator('#action').click();
  const report=await page.evaluate(async(style)=>new Promise(resolve=>{
    const meter=document.querySelector('#meter');const ctx=meter.getContext('2d',{willReadFrequently:true});
    const button=document.querySelector('#action');const score=document.querySelector('#band-count');const game=document.querySelector('#game');
    const started=performance.now();let last=0;const attempts=[];
    function play(now){
      const phase=game.dataset.phase;
      if(phase==='result'||now-started>95000){resolve({style,seconds:+((now-started)/1000).toFixed(2),bands:Number(score.textContent),perfect:document.querySelector('#perfect-rate').textContent,phase,attempts});return;}
      if(phase==='playing' && now-last>320){
        const ratio=meter.width/meter.getBoundingClientRect().width;
        const row=ctx.getImageData(0,Math.floor(26*ratio),meter.width,1).data;
        let perfect=[],safe=[],needle=[];
        for(let x=0;x<meter.width;x++){
          const r=row[x*4],g=row[x*4+1],b=row[x*4+2];
          if(Math.abs(r-237)<3&&Math.abs(g-242)<3&&Math.abs(b-162)<3)perfect.push(x);
          if(Math.abs(r-166)<3&&Math.abs(g-197)<3&&Math.abs(b-127)<3)safe.push(x);
          if(r>248&&g>248&&b>218)needle.push(x);
        }
        if(safe.length&&needle.length){
          const center=(safe[0]+safe.at(-1))/2;const n=(needle[0]+needle.at(-1))/2;
          const bands=Number(score.textContent);let target=center;
          if(style==='mixed' && bands%6===4)target=50*ratio;
          else if(style==='mixed' && bands%4===2 && safe.length)target=center+(safe.at(-1)-safe[0])*.37;
          if(Math.abs(n-target)<3*ratio){button.click();last=now;attempts.push({n:Number(score.textContent),grade:document.querySelector('#feedback').dataset.grade,t:+((now-started)/1000).toFixed(2)});}
        }
      }
      requestAnimationFrame(play);
    }
    requestAnimationFrame(play);
  }),style);
  reports.push(report);console.log(JSON.stringify(report));
  await page.screenshot({path:`artifacts/feel-${reports.length}-${style}.png`});
}
await writeFile('artifacts/game-feel.json',JSON.stringify(reports,null,2));await browser.close();
