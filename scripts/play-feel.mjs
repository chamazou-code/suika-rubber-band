// QA player reads only the painted meter and operates the public button.
// No game internals, seeded durability, fake clock or production test hooks.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}});
const reports=[];
for(const style of (process.env.PLAY_STYLES || 'careful,mixed').split(',')){
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173/');
  await page.locator('#game[data-render="ready"]').waitFor();
  await page.locator('#action').click();
  let captured=false;
  const capture=setInterval(async()=>{
    if(captured)return;
    if(Number(await page.locator('#band-count').textContent())>=40){captured=true;await page.screenshot({path:`artifacts/feel-${reports.length+1}-late.png`});}
  },900);
  const report=await page.evaluate(async(style)=>new Promise(resolve=>{
    const meter=document.querySelector('#meter');const ctx=meter.getContext('2d',{willReadFrequently:true});
    const button=document.querySelector('#action');const score=document.querySelector('#band-count');const game=document.querySelector('#game');
    const started=performance.now();let last=0;const attempts=[],frames=[];let previous=started;
    function play(now){
      frames.push(now-previous);previous=now;
      const phase=game.dataset.phase;
      if(phase==='result'||now-started>95000){frames.sort((a,b)=>a-b);resolve({style,seconds:+((now-started)/1000).toFixed(2),bands:Number(score.textContent),perfect:document.querySelector('#perfect-rate').textContent,phase,frameMedianMs:+frames[Math.floor(frames.length*.5)].toFixed(2),frameP95Ms:+frames[Math.floor(frames.length*.95)].toFixed(2),attempts});return;}
      if(phase==='playing' && now-last>320){
        const bounds=meter.getBoundingClientRect(),ratio=meter.width/bounds.width;
        const cx=bounds.width/2,cy=bounds.height-24,radius=Math.min(bounds.width*.43,bounds.height-34);
        const pixels=ctx.getImageData(0,0,meter.width,meter.height).data;
        const pixel=(n,r)=>{const a=Math.PI*(1+n),x=Math.round((cx+Math.cos(a)*r)*ratio),y=Math.round((cy+Math.sin(a)*r)*ratio);return (y*meter.width+x)*4;};
        let safe=[],needle=[];
        for(let i=0;i<=720;i++){
          let p=pixel(i/720,radius-2);const r=pixels[p],g=pixels[p+1],b=pixels[p+2];
          if((Math.abs(r-139)<3&&Math.abs(g-189)<3&&Math.abs(b-104)<3)||(Math.abs(r-222)<3&&Math.abs(g-236)<3&&Math.abs(b-164)<3))safe.push(i/720);
          p=pixel(i/720,radius*.64);
          if(Math.abs(pixels[p]-255)<3&&Math.abs(pixels[p+1]-251)<3&&Math.abs(pixels[p+2]-231)<3&&pixels[p+3]>245)needle.push(i/720);
        }
        if(safe.length&&needle.length){
          const center=(safe[0]+safe.at(-1))/2,n=(needle[0]+needle.at(-1))/2;
          const bands=Number(score.textContent);let target=center;
          if(style==='mixed' && bands%6===4)target=.05;
          else if(style==='mixed' && bands%4===2)target=center+(safe.at(-1)-safe[0])*.37;
          if(Math.abs(n-target)<.007){button.click();last=now;attempts.push({n:Number(score.textContent),grade:document.querySelector('#feedback').dataset.grade,t:+((now-started)/1000).toFixed(2)});}
        }
      }
      requestAnimationFrame(play);
    }
    requestAnimationFrame(play);
  }),style);
  clearInterval(capture);reports.push(report);console.log(JSON.stringify(report));
  await page.screenshot({path:`artifacts/feel-${reports.length}-${style}.png`});
}
await writeFile('artifacts/game-feel.json',JSON.stringify(reports,null,2));await browser.close();
