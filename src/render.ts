import { clamp, FLIGHT_DURATION, Game, HIT_STOP, perfectWidth } from './game';
const TAU = Math.PI * 2;
const ink = '#244537';
function ellipse(c: CanvasRenderingContext2D, x: number,y: number,rx: number,ry: number,color: string,rotation=0) {
  c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rotation,0,TAU);c.fillStyle=color;c.fill();
}
function path(c: CanvasRenderingContext2D, d: string, fill: string, stroke?: string, width=2) {
  const p=new Path2D(d);c.fillStyle=fill;c.fill(p);
  if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke(p);}
}
function line(c: CanvasRenderingContext2D, points: number[], color: string, width=2) {
  c.beginPath();c.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
}
function rounded(c: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,color:string) {
  c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=color;c.fill();
}
function seed(c: CanvasRenderingContext2D,x:number,y:number,scale=1,rot=0) {
  c.save();c.translate(x,y);c.rotate(rot);c.scale(scale,scale);path(c,'M0 -5 Q6 2 0 5 Q-5 2 0 -5','#463e30');c.restore();
}
interface Particle { x:number;y:number;vx:number;vy:number;size:number;rotation:number;spin:number;kind:number;delay:number }
export class Renderer {
  private scene: CanvasRenderingContext2D;
  private meter: CanvasRenderingContext2D;
  private width=520;
  private height=510;
  private meterWidth=510;
  private meterHeight=91;
  private particles:Particle[]=[];
  private observer:ResizeObserver;
  private pixelRatio=1;
  private speckles=Array.from({length:130},(_,i)=>({x:Math.sin(i*127.13)*112,y:Math.cos(i*71.91)*115,r: .6+(i%4)*.38}));
  constructor(private sceneCanvas:HTMLCanvasElement,private meterCanvas:HTMLCanvasElement) {
    this.scene=sceneCanvas.getContext('2d')!;this.meter=meterCanvas.getContext('2d')!;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(sceneCanvas);this.observer.observe(meterCanvas);this.resize();
  }
  resize() {
    this.pixelRatio=Math.min(window.devicePixelRatio||1,2);
    const s=this.sceneCanvas.getBoundingClientRect();const m=this.meterCanvas.getBoundingClientRect();
    this.width=s.width;this.height=s.height;this.meterWidth=m.width;this.meterHeight=m.height;
    this.sceneCanvas.width=Math.round(s.width*this.pixelRatio);this.sceneCanvas.height=Math.round(s.height*this.pixelRatio);
    this.meterCanvas.width=Math.round(m.width*this.pixelRatio);this.meterCanvas.height=Math.round(m.height*this.pixelRatio);
  }
  dispose(){this.observer.disconnect();this.particles=[];}
  reset(){this.particles=[];}
  burst() {
    this.particles=Array.from({length:92},(_,i)=>({
      x:260+(Math.random()-.5)*80,y:325+(Math.random()-.5)*18,
      vx:(Math.random()-.5)*220,vy:-470-Math.random()*310,
      size:3+Math.random()*9,rotation:Math.random()*TAU,spin:(Math.random()-.5)*15,kind:i%7,delay:Math.random()*.075
    }));
    // Secondary juice fans out only after the upward cap has reached the face.
    for(let i=0;i<28;i++)this.particles.push({x:260,y:155,vx:(Math.random()-.5)*460,vy:-80-Math.random()*240,size:3+Math.random()*7,rotation:Math.random()*TAU,spin:6,kind:i%5,delay:FLIGHT_DURATION});
  }
  render(game:Game,time:number,reduced:boolean) {
    const c=this.scene;
    c.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);c.clearRect(0,0,this.width,this.height);
    const scale=Math.min(this.width/410,this.height/510);
    c.save();c.translate(this.width/2,this.height);c.scale(scale,scale);c.translate(-260,-510);
    let visual=game.phaseTime;
    if(game.phase==='bursting') visual-=clamp((visual-FLIGHT_DURATION)/HIT_STOP)*HIT_STOP;
    if(game.phase==='result') visual=2.65;
    if(!reduced && game.phase==='bursting' && visual<.6){const power=9*(1-visual/.6);c.translate(Math.sin(visual*140)*power,Math.cos(visual*170)*power*.65);}
    this.background(c);
    this.person(c,game,time,visual,reduced);
    this.table(c,game.phase==='bursting'||game.phase==='result');
    const burst=game.phase==='bursting'||game.phase==='result';
    c.save();c.translate(260,340);
    if(!reduced){
      const snap=Math.exp(-game.snapTime*19)*Math.sin(game.snapTime*48)*.035;
      const tension=clamp((game.bands-27)/30);
      const shiver=game.phase==='cracking'?Math.sin(game.phaseTime*145)*3:Math.sin(time*38)*tension*.7;
      c.translate(shiver,0);c.scale(1+snap,1-snap);
    }
    this.melon(c,game.bands,burst?'bottom':'whole');
    c.restore();
    if(burst){
      this.drawParticles(c,visual,reduced);
      this.cap(c,visual,reduced,game.bands);
      if(visual<.62){
        c.save();c.translate(362,266);c.rotate(.17);c.font='italic 900 45px Impact, Arial Black, sans-serif';c.textAlign='center';c.lineJoin='round';c.strokeStyle='#f8f0d7';c.lineWidth=9;c.strokeText('BANG!',0,0);c.fillStyle='#eb6947';c.fillText('BANG!',0,0);c.restore();
      }
    }
    if(game.phase==='playing' && game.lastGrade==='perfect' && game.snapTime<.4 && !reduced){
      const p=game.snapTime/.4;c.globalAlpha=1-p;
      for(let i=0;i<6;i++){const a=i*TAU/6;this.spark(c,260+Math.cos(a)*(120+p*24),334+Math.sin(a)*65,5*(1-p),'#c5a54e');}c.globalAlpha=1;
    }
    c.restore();this.drawMeter(game,time,reduced);
  }
  private background(c:CanvasRenderingContext2D) {
    ellipse(c,260,241,200,203,'#e2e7cf');
    c.save();c.globalAlpha=.52;c.strokeStyle='#b4c19c';c.lineWidth=1;c.setLineDash([3,8]);c.beginPath();c.arc(260,241,213,.15,Math.PI-.15);c.stroke();c.restore();
    ellipse(c,438,173,4,4,'#c9d2b5');ellipse(c,87,297,3,3,'#c9d2b5');
    this.spark(c,401,85,7,'#bac7a4');this.spark(c,93,191,5,'#c7d1b4');
  }
  private spark(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){line(c,[x-r,y,x+r,y],color,1.7);line(c,[x,y-r,x,y+r],color,1.7);}
  private table(c:CanvasRenderingContext2D,burst:boolean) {
    ellipse(c,260,489,205,13,'#c6ceb153');
    path(c,'M42 441 L478 441 L511 478 Q514 485 505 487 L15 487 Q6 485 11 478 Z','#c59163');
    path(c,'M15 480 L505 480 L505 495 Q505 500 496 500 L24 500 Q15 500 15 495 Z','#a7734e');
    path(c,'M42 441 L478 441 L507 477 L13 477 Z','#dcb48a');
    line(c,[62,446,458,446],'#edc9a0',2);
    line(c,[35,468,125,468,139,465,360,465,378,468,487,468],'#b1876144',1.4);
    line(c,[77,453,167,453],'#b1876155',1.2);line(c,[391,455,449,455],'#b1876166',1.4);
    ellipse(c,260,447,127,19,'#704f3835');
    ellipse(c,260,451,124,15,'#c7936966');
    if(burst){
      for(let i=0;i<15;i++){const x=138+(i*71)%244;const y=445+(i*11)%27;ellipse(c,x,y,3+(i%4)*3,2+(i%2),'#ed8055b3');}
      seed(c,155,458,.6,.7);seed(c,353,463,.7,1.3);
    }
  }
  private person(c:CanvasRenderingContext2D,g:Game,time:number,visual:number,reduced:boolean) {
    const tense=clamp(g.bands/50);
    const hit=(g.phase==='bursting'||g.phase==='result') && visual>=FLIGHT_DURATION;
    const recoil=hit ? clamp((visual-FLIGHT_DURATION)/.32) : 0;
    const settle=hit ? clamp((visual-1.25)/.7) : 0;
    // Chair sits directly behind the melon and remains in place when the person recoils.
    rounded(c,180,222,160,208,25,'#708774');rounded(c,188,228,144,192,20,'#8ba18a');
    c.save();c.translate(260,320);
    const bob=!reduced&&!hit?Math.sin(time*2)*1.6:0;
    c.translate(0,-tense*8+bob);
    if(hit){c.translate(8*recoil,20*recoil-10*settle);c.rotate((recoil*.12-settle*.045));c.scale(1-.12*recoil,1-.13*recoil);}
    c.translate(-260,-320);
    // Shirt, neck and bent arms. Warm highlights make the figure feel tactile.
    path(c,hit?'M206 203 Q181 209 186 253 L202 371 L321 371 L334 253 Q340 211 314 203 Z':'M206 203 Q181 209 169 246 L151 322 Q145 342 165 350 L197 320 L202 371 L321 371 L328 320 L355 350 Q377 342 368 322 L350 245 Q338 211 314 203 Z','#527d6e',ink,2.5);
    path(c,'M208 214 Q259 249 313 212 L323 371 L200 371 Z','#679886');
    path(c,'M238 182 L238 210 Q260 232 283 210 L281 181 Z','#d99870',ink,2);
    path(c,'M234 209 Q258 235 287 209 L297 217 Q258 252 225 217Z','#305b4c');
    if(!hit){line(c,[176,254,163,316,187,305],'#88ab94',5);line(c,[343,254,359,316,337,305],'#88ab94',5);}
    c.save();c.translate(260,148-tense*5);
    if(!hit)c.rotate(-.025+Math.sin(time*.9)*.01*(reduced?0:1));
    // Ears and face.
    ellipse(c,-56,3,11,18,'#dda176');ellipse(c,56,3,11,18,'#dda176');
    const skin=c.createLinearGradient(-50,-65,52,67);skin.addColorStop(0,'#f5c794');skin.addColorStop(.65,'#eeb783');skin.addColorStop(1,'#d78e68');
    c.beginPath();c.moveTo(-53,-34);c.bezierCurveTo(-49,-76,48,-77,54,-31);c.bezierCurveTo(62,22,45,66,0,67);c.bezierCurveTo(-41,66,-62,23,-53,-34);c.closePath();c.fillStyle=skin;c.fill();c.strokeStyle='#714c39';c.lineWidth=2.5;c.stroke();
    ellipse(c,-33,26,15,7,'#ea927254');ellipse(c,35,26,14,7,'#ea927254');
    // Tousled, fictional character; no real-person likeness.
    path(c,'M-55 -2 Q-70 -34 -51 -55 L-58 -65 L-32 -64 Q-15 -86 3 -72 Q25 -91 46 -68 L57 -70 L56 -56 Q73 -39 54 -2 L48 -30 Q22 -29 10 -49 Q-3 -31 -38 -32 L-48 4 Z','#493c30','#302e27',2.5);
    path(c,'M-43 -52 Q-16 -75 4 -58 Q27 -79 45 -56 Q22 -64 11 -51 Q-8 -61 -43 -45 Z','#67503b');
    if(!hit){
      const eyeY=2-tense*2;ellipse(c,-23,eyeY,13,13+tense*3,'#fff7df');ellipse(c,25,eyeY,13,13+tense*3,'#fff7df');
      ellipse(c,-20,eyeY+5,5,6.5,'#34382b');ellipse(c,21,eyeY+5,5,6.5,'#34382b');ellipse(c,-21,eyeY+3,1.6,2,'white');ellipse(c,20,eyeY+3,1.6,2,'white');
      line(c,[-37,-20-tense*7,-17,-24-tense*5],'#584231',5);line(c,[17,-24-tense*5,38,-19-tense*7],'#584231',5);
      path(c,'M0 9 L-5 24 Q0 28 8 23','transparent','#bd7957',2);
      c.beginPath();c.moveTo(-13,45);c.quadraticCurveTo(0,35-tense*4,15,45);c.strokeStyle='#865741';c.lineWidth=2.8;c.stroke();
      if(tense>.5){path(c,'M53 -17 Q66 -1 57 5 Q48 3 53 -17','#8ec9c5','#519c9b',1);}
    } else {
      line(c,[-34,0,-23,6,-12,0],'#573e31',3);line(c,[14,0,25,6,36,0],'#573e31',3);
      ellipse(c,1,43,12,13,'#8b5137');ellipse(c,2,48,7,4,'#eab283');
      // Bright orange-red pulp, rind and visible seeds make the splash unmistakably fruit.
      path(c,'M-45 -20 Q-26 -37 -10 -18 Q9 -32 18 -13 Q46 -25 50 -4 L43 17 Q27 21 31 41 Q24 50 19 29 Q8 25 -3 29 L-6 47 Q-14 51 -16 29 Q-43 33 -39 11 Q-55 4 -45 -20Z','#f7754c');
      path(c,'M-39 -17 Q-16 -31 -10 -11 Q14 -27 18 -7 Q38 -17 39 -2 L32 6 Q13 -1 2 13 Q-8 1 -26 10 L-32 1Z','#ff9b5e');
      seed(c,-23,-7,.8,.8);seed(c,25,0,.85,-.5);seed(c,5,19,.65,.2);seed(c,-29,17,.6,-1);
      path(c,'M-47 -41 Q-22 -54 -8 -39 L-13 -28 Q-33 -43 -44 -29 Z','#478546','#224e37',2);
      path(c,'M-44 -29 Q-30 -41 -13 -28 L-15 -24 Q-31 -35 -42 -25Z','#e5e8a9');
      // Loose pulp drips; no wounds, blood or injury.
      ellipse(c,33,37,5,7,'#fb8b53');
    }
    c.restore();
    // Elbows and forearms lift with the hands; the character stays in one piece.
    if(hit){for(const side of [-1,1]){line(c,[260+side*51,237,260+side*86,273],'#527d6e',30);line(c,[260+side*86,273,260+side*111,240-20*recoil],'#eab282',22);}}
    // Hands rest by the melon, then fly up in surprise.
    for(const side of [-1,1]){
      c.save();c.translate(260+side*111,hit?230-20*recoil:333);c.rotate(side*(hit?.9:-.22));
      rounded(c,-15,-18,31,47,14,'#eab282');line(c,[-8,-7,-8,6],'#be855e',1.4);line(c,[-1,-10,-1,5],'#be855e',1.4);line(c,[6,-9,6,4],'#be855e',1.4);c.restore();
    }
    if(hit && !reduced){
      const a=visual*2;for(let i=0;i<3;i++){this.spark(c,260+Math.cos(a+i*TAU/3)*70,70+Math.sin(a+i*TAU/3)*12,4,'#c8a247');}
    }
    c.restore();
  }
  private melonShape(bands:number) {
    const pinch=clamp((bands-6)/48)*.37;
    const ry=109+pinch*24;
    const shape=new Path2D();
    for(let i=0;i<=100;i++){
      const a=i/100*TAU;const y=-Math.cos(a)*ry;
      const x=Math.sin(a)*116*(1-pinch*Math.exp(-Math.pow(y/ry*2.7,2)));
      if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
    shape.closePath();return {shape,pinch,ry};
  }
  private melon(c:CanvasRenderingContext2D,bands:number,part:'whole'|'bottom'|'top') {
    const {shape,pinch,ry}=this.melonShape(bands);
    c.save();
    if(part!=='whole'){c.beginPath();c.rect(-160,part==='bottom'?-1:-160,320,part==='bottom'?180:160);c.clip();}
    const green=c.createRadialGradient(-44,-50,10,8,10,153);green.addColorStop(0,'#b3ca61');green.addColorStop(.4,'#86ae4e');green.addColorStop(.82,'#4d813d');green.addColorStop(1,'#315e35');
    c.fillStyle=green;c.fill(shape);c.strokeStyle='#345b33';c.lineWidth=2.5;c.stroke(shape);
    c.save();c.clip(shape);
    for(let j=-4;j<=4;j++){
      const p=new Path2D();const longitudinal=j/4.7;
      for(let side=0;side<2;side++){
        for(let i=0;i<=54;i++){
          const k=side===0?i:54-i;const y=-ry+k/54*ry*2;const yy=y/ry;
          const cross=Math.sqrt(Math.max(0,1-yy*yy))*116*(1-pinch*Math.exp(-Math.pow(yy*2.7,2)));
          const wobble=Math.sin(y*.09+j*2)*2+Math.sin(y*.27+j)*1.2;
          const x=cross*longitudinal+wobble+(side===0?-1:1)*cross*.052;
          if(i===0&&side===0)p.moveTo(x,y);else p.lineTo(x,y);
        }
      }
      p.closePath();c.fillStyle=j%2===0?'#2e6838':'#376e37';c.fill(p);
    }
    for(const s of this.speckles)ellipse(c,s.x,s.y,s.r,s.r*.65,'#d7de8133');
    const shine=c.createRadialGradient(-47,-60,0,-30,-45,93);shine.addColorStop(0,'#edf2ad59');shine.addColorStop(1,'#f5f0b000');c.fillStyle=shine;c.fillRect(-140,-150,280,300);
    if(bands>34){
      line(c,[-30,-31,-20,-21,-28,-13,-19,-5],'#d5d786',1.4);line(c,[47,24,38,14,43,5],'#c3c777',1.4);
      if(bands>45)line(c,[9,-54,4,-41,14,-28,11,-18],'#e0dc8b',1.5);
    }
    c.restore();
    if(bands>0){
      const bundle=Math.min(35,3+bands*.55);const waist=116*(1-pinch);
      for(let i=0;i<bands;i++){
        const y=bands===1?0:-bundle/2+(i/(bands-1))*bundle;
        c.beginPath();c.ellipse(0,y,waist+1,8+(Math.abs(y)*.07),0,0,Math.PI);c.strokeStyle='#70592c55';c.lineWidth=3.5;c.stroke();
        c.beginPath();c.ellipse(0,y-1,waist+1,8+(Math.abs(y)*.07),0,0,Math.PI);c.strokeStyle=['#d9b66d','#e5c886','#c7a15e','#f0d391'][i%4];c.lineWidth=2.2;c.stroke();
      }
    }
    if(part==='whole'){
      path(c,`M-3 ${-ry+3} Q8 ${-ry-5} 2 ${-ry-11} Q-3 ${-ry-15} -8 ${-ry-10}`,'transparent','#63793e',3);
      ellipse(c,-6,-ry+3,6,3,'#426b34');
    }
    c.restore();
    if(part==='bottom'){
      const waist=116*(1-pinch);
      ellipse(c,0,0,waist,20,'#326439');ellipse(c,0,-2,waist-5,18,'#e3e7a6');ellipse(c,0,-3,waist-10,15,'#f77852');
      path(c,`M${-waist+14} -3 L-42 -11 L-24 -6 L-6 -14 L14 -6 L30 -12 L${waist-13} -1 Q30 10 -20 8 Z`,'#fa9860');
      for(let i=0;i<8;i++)seed(c,-waist*.65+i*waist*.18,Math.sin(i*4)*6-3,.45,i);
    }
  }
  private cap(c:CanvasRenderingContext2D,t:number,reduced:boolean,bands:number) {
    if(t>1.3)return;
    const flight=clamp(t/FLIGHT_DURATION);
    const after=Math.max(0,t-FLIGHT_DURATION);
    const fall=clamp((after-.12)/.92);
    const x=260+fall*101;const y=340-182*(1-Math.pow(1-flight,1.5))+fall*fall*345;
    c.save();c.translate(x,y);c.rotate(reduced?-.12:flight*-.14+fall*3.8);c.scale(1-flight*.32,1-flight*.32);
    if(flight<.65){this.melon(c,bands,'top');ellipse(c,0,0,116*(1-clamp((bands-6)/48)*.37)-4,17,'#e1e5a3');ellipse(c,0,-1,116*(1-clamp((bands-6)/48)*.37)-10,12,'#fb8253');}
    else {
      const r=80;ellipse(c,0,-18,r,58,'#32663b');ellipse(c,0,-23,r-4,55,'#95ad51');ellipse(c,0,-25,r-9,51,'#e7eab0');ellipse(c,0,-27,r-14,46,'#f4724d');ellipse(c,-15,-36,38,24,'#fb8852');
      for(let i=0;i<10;i++){const a=i*2.4;seed(c,Math.cos(a)*46,Math.sin(a)*27-25,.9,a+.5);}
    }
    c.restore();
  }
  private drawParticles(c:CanvasRenderingContext2D,t:number,reduced:boolean){
    const limit=reduced?20:this.particles.length;
    for(let i=0;i<limit;i++){
      const p=this.particles[i];const age=t-p.delay;if(age<0||age>1.7)continue;
      const x=p.x+p.vx*age;const y=p.y+p.vy*age+650*age*age;
      if(y>467)continue;
      c.save();c.translate(x,y);c.rotate(p.rotation+p.spin*age);c.globalAlpha=clamp((1.7-age)/.5);
      if(p.kind===0)seed(c,0,0,p.size/6);
      else if(p.kind===1){path(c,`M${-p.size} ${-p.size} L${p.size} 0 L0 ${p.size} Z`,'#f77c4d','#d9dd9b',2);line(c,[-p.size,-p.size,0,p.size],'#438040',3);}
      else if(p.kind===2){path(c,`M${-p.size} 0 L-3 ${-p.size} L${p.size} -2 L2 ${p.size} Z`,'#ff9360');}
      else ellipse(c,0,0,p.size*.65,p.size*(p.kind===3?1.5:.7),p.kind%2?'#f87e4ac9':'#ffab63dc');
      c.restore();
    }
  }
  private drawMeter(g:Game,time:number,reduced:boolean){
    const c=this.meter,w=this.meterWidth,h=this.meterHeight;
    c.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);c.clearRect(0,0,w,h);
    const left=8,right=w-8,span=right-left;const top=22,bottom=h-28,barH=bottom-top;
    rounded(c,left,top,span,barH,5,'#172f26');
    c.save();c.beginPath();c.roundRect(left,top,span,barH,5);c.clip();
    c.fillStyle='#745946';c.globalAlpha=.68;c.fillRect(left,top,span,barH);c.globalAlpha=1;
    for(let x=left-20;x<right+20;x+=13)line(c,[x,top,x-15,bottom],'#ad866244',5);
    const safeX=left+(g.safeCenter-g.width/2)*span,safeW=g.width*span;
    c.fillStyle='#a6c57f';c.fillRect(safeX,top,safeW,barH);
    const perfectW=perfectWidth(g.width)*span;c.fillStyle='#edf2a2';c.fillRect(left+g.safeCenter*span-perfectW/2,top,perfectW,barH);
    c.restore();
    for(let i=0;i<=40;i++){const x=left+i/40*span;line(c,[x,top-5,x,top-(i%5===0?12:8)],'#a4b697',i%5===0?1.4:1);}
    const x=left+g.needle*span;
    c.save();c.shadowColor='#0d281d';c.shadowBlur=4;c.shadowOffsetY=2;line(c,[x,top-7,x,bottom+4],'#fffce3',3);path(c,`M${x-5} ${top-15} L${x+5} ${top-15} L${x} ${top-9}Z`,'#fffce3');c.restore();
    c.font='600 9px ui-monospace, monospace';c.fillStyle='#bdc9af';c.textAlign='left';c.fillText('DANGER',left,h-9);c.textAlign='right';c.fillText('DANGER',right,h-9);
    c.textAlign='center';c.fillStyle='#eaf0bc';c.fillText('SAFE',left+g.safeCenter*span,h-9);
    if(g.phase==='ready'&&!reduced){c.globalAlpha=.65+Math.sin(time*3)*.25;ellipse(c,left+g.safeCenter*span,top+barH/2,2,2,'#244737');c.globalAlpha=1;}
  }
}
