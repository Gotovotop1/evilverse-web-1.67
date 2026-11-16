/*!
 * EvilVerse Studio — генератор промо-роликов для медиа.
 * © 2026 EvilVerse (evilverse.lol). Все права защищены.
 * Проприетарное ПО: копирование, изменение, распространение и использование
 * вне evilverse.lol без письменного разрешения запрещены. См. LICENSE.txt.
 */
// Адская сцена EvilVerse (scene2 + scene3), рисует кадр по времени: window.render(t)

// Универсальная адская сцена: window.TL = {dur, items:[{start,end,scene,caps,...}]}
const W=1080,H=1920,c=document.getElementById('c'),g=c.getContext('2d');
g.imageSmoothingEnabled=false;
let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>1-Math.pow(1-clamp(t),3);
const back=t=>{t=clamp(t);const s=1.9;return 1+(s+1)*Math.pow(t-1,3)+s*Math.pow(t-1,2)};
const lerp=(a,b,t)=>a+(b-a)*t;
function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function tex(pal,seedv){const cv=document.createElement('canvas');cv.width=cv.height=16;const x=cv.getContext('2d');seed=seedv;
 for(let i=0;i<16;i++)for(let j=0;j<16;j++){x.fillStyle=pal[Math.floor(rnd()*pal.length)];x.fillRect(i,j,1,1)}return cv}
const NETH=tex(['#6b1e1e','#7a2424','#5a1818','#8a2c2c','#4a1212','#6b1e1e'],11);
const BASALT=tex(['#2a2228','#332a31','#221b20','#3a3038','#2a2228'],5);
const ASH=[];seed=99;for(let i=0;i<120;i++)ASH.push([rnd()*W,rnd()*H,1+rnd()*3,0.3+rnd()*0.7,rnd()*6.28]);
const PILL=[];seed=3;for(let i=0;i<9;i++)PILL.push([i*130-40+rnd()*60,520+rnd()*500,70+rnd()*40]);

// ---------- фон ----------
function bg(t){
 const sk=g.createLinearGradient(0,0,0,H);sk.addColorStop(0,'#1a0303');sk.addColorStop(.55,'#3d0707');sk.addColorStop(1,'#7a1505');
 g.fillStyle=sk;g.fillRect(0,0,W,H);
 g.fillStyle='rgba(255,90,40,0.06)';
 for(let k=0;k<5;k++){const x=((k*290+t*18)%(W+400))-300,y=260+k*150;for(let i=0;i<6;i++)g.fillRect(x+i*48,y+(i%2)*24,96,48);}
 for(const [x,top,w] of PILL){const h=1500-top;g.save();g.globalAlpha=.75;for(let y=top;y<1500;y+=w)g.drawImage(BASALT,x,y,w,w);g.restore();
  g.fillStyle='rgba(255,120,40,.12)';g.fillRect(x,top,6,h)}
 for(let x=0;x<W;x+=90)for(let y=1500;y<H;y+=90)g.drawImage(NETH,x,y,90,90);
 for(let x=0;x<W;x+=18){const v=Math.sin(x*.03+t*3)*.5+.5;g.fillStyle=`rgb(255,${Math.floor(90+v*110)},${Math.floor(v*40)})`;g.fillRect(x,1478,18,22)}
 const glow=g.createLinearGradient(0,1300,0,1500);glow.addColorStop(0,'rgba(255,80,0,0)');glow.addColorStop(1,'rgba(255,80,0,.28)');g.fillStyle=glow;g.fillRect(0,1300,W,200);
 for(const [x,y,s,a,p] of ASH){const yy=(y-t*60*a+H)%H,xx=x+Math.sin(t+p)*20;g.fillStyle=`rgba(255,${Math.floor(140+a*80)},60,${a*.8})`;g.fillRect(xx,yy,s*2,s*2)}
 const vg=g.createRadialGradient(W/2,H/2,400,W/2,H/2,1150);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=vg;g.fillRect(0,0,W,H);
}
function header(){
 g.font='34px "Press Start 2P"';g.textAlign='center';g.fillStyle='rgba(255,233,199,.85)';g.fillText('EVILVERSE · evilverse.lol',W/2,120);
 g.font='26px "Press Start 2P"';g.fillStyle='rgba(255,106,61,.9)';g.fillText('ВАЙП 04.12 · 18:00',W/2,170);
}
// ---------- субтитры ----------
function stroked(txt,x,y,size,fill){g.font=`${size}px "Russo One"`;
 const mw=g.measureText(txt).width;if(mw>980){size=Math.floor(size*980/mw);g.font=`${size}px "Russo One"`}
 g.textAlign='center';g.lineJoin='round';g.lineWidth=size*.22;g.strokeStyle='#000';g.strokeText(txt,x,y);g.fillStyle=fill;g.fillText(txt,x,y)}
function caption(it,u){const [l1,l2]=it.caps;const k=back(u/.22);
 g.save();g.translate(W/2,1080);g.scale(k,k);
 if(l1)stroked(l1,0,l2?-20:40,l1.length>12?92:104,'#FFF3E0');
 if(l2){const gr=g.createLinearGradient(0,40,0,130);gr.addColorStop(0,'#FFD23F');gr.addColorStop(1,'#FF5A1F');stroked(l2,0,100,l2.length>13?98:112,gr)}
 g.restore()}
// ---------- элементы ----------
function card(x,y,w,h,fill,border){rr(x,y,w,h,18);g.fillStyle=fill;g.fill();g.lineWidth=6;g.strokeStyle=border;g.stroke()}
function signAt(cx,cy,w,lines,u){const k=ease(u/.35);const yy=lerp(cy-500,cy,k);g.save();g.globalAlpha=k;
 g.fillStyle='#3a2014';g.fillRect(cx-10,yy+60,20,260);
 for(let x=cx-w/2;x<cx+w/2;x+=60)g.drawImage(NETH,x,yy-70,60,140);
 g.fillStyle='rgba(0,0,0,.35)';g.fillRect(cx-w/2,yy-70,w,140);g.strokeStyle='#ff6a3d';g.lineWidth=5;g.strokeRect(cx-w/2,yy-70,w,140);
 g.font=(lines.length===1?'56px':'44px')+' "Press Start 2P"';g.textAlign='center';g.fillStyle='#FFE9C7';
 lines.forEach((l,i)=>g.fillText(l,cx,yy-8+i*58-(lines.length-1)*24));g.restore()}
const grad=(txt,x,y,a,b)=>{const n=txt.length;let xx=x;for(let i=0;i<n;i++){const f=n>1?i/(n-1):0;g.fillStyle=`rgb(${[0,1,2].map(k=>Math.round(a[k]+(b[k]-a[k])*f)).join(',')})`;g.fillText(txt[i],xx,y);xx+=g.measureText(txt[i]).width}return xx};

const SC={
 comment(u){const k=back((u-.1)/.3);g.save();g.translate(W/2,560);g.scale(k,k);g.rotate(-.04);
  card(-430,-130,860,260,'#f3ead9','#111');g.fillStyle='#777';g.fillRect(-390,-95,40,40);
  g.font='30px "Press Start 2P"';g.textAlign='left';g.fillStyle='#666';g.fillText('@комментарий',-335,-62);
  g.font='46px "Press Start 2P"';g.fillStyle='#111';g.fillText('хардкор скучный.',-390,22);g.fillText('умер и всё',-390,92);g.restore()},
 sign(u,d,it){signAt(W/2,600,800,it.lines||['ЛАДНО,','ПОКАЖЕМ'],u)},
 chat(u){const k=ease(u/.3);g.save();g.translate(lerp(-W,0,k),0);
  g.fillStyle='rgba(0,0,0,.62)';g.fillRect(30,410,1020,350);g.fillStyle='#FF2B2B';g.fillRect(30,410,8,350);
  g.font='37px "Press Start 2P"';g.textAlign='left';const PF=g.font;
  const SK=(x,y,col)=>{g.font='44px "DejaVu Sans"';g.fillStyle=col;g.fillText('☠',x,y+4);const w=g.measureText('☠').width;g.font=PF;return x+w};
  const L=(y)=>{let x=grad('▬▬▬▬',80,y,[90,0,0],[255,69,0]);x=SK(x+20,y,'#FF2B2B')+20;x=grad('ХАРДКОР',x,y,[255,43,43],[255,165,0]);x=SK(x+20,y,'#FF2B2B')+20;grad('▬▬▬▬',x,y,[255,69,0],[90,0,0])};
  L(490);SK(130,570,'#FF2B2B');g.fillStyle='#FFA500';g.fillText('Игрок',200,570);grad('сгорел в аду',420,570,[194,16,16],[255,106,0]);
  SK(130,640,'#8A8A8A');g.fillStyle='#C9A58B';g.fillText('пал от руки',200,640);g.fillStyle='#FFE9C7';g.fillText('Враг',640,640);L(715);g.restore()},
 roar(u){const p=u-.1;for(let i=0;i<4;i++){const r=((Math.max(0,p)*500+i*180)%720);g.strokeStyle=`rgba(190,60,255,${clamp(1-r/720)*.8})`;g.lineWidth=14;g.beginPath();g.arc(W/2,600,Math.max(1,r),0,6.28);g.stroke()}
  const k=back(p/.3);g.save();g.translate(W/2,600);g.scale(k,k);g.rotate(.05);card(-330,-80,660,160,'#1d0630','#b03cff');
  g.font='52px "Press Start 2P"';g.textAlign='center';g.fillStyle='#e8b6ff';g.fillText('Р-Р-РААР!',0,22);g.restore();
  if(p>0&&p<.35){g.fillStyle=`rgba(255,0,0,${(.35-p)*1.4})`;g.fillRect(0,0,W,H)}},
 clock(u,d,it){const k=back((u-.1)/.3);g.save();g.translate(W/2,520);g.scale(k,k);card(-330,-120,660,240,'#1a0505','#ff6a3d');
  g.font='104px "Press Start 2P"';g.textAlign='center';g.fillStyle=(Math.floor(u*2)%2)?'#FFD23F':'#FF7A1F';g.fillText(it.time||'19:00',0,52);g.restore();
  (it.chips||['ШОУДАУН','КЛАНОВЫЕ ВОЙНЫ','АИРДРОПЫ']).forEach((n,i)=>{const t0=d*(.3+i*.17);if(u<t0)return;const kk=back((u-t0)/.25);g.save();g.translate(W/2,760+i*110);g.scale(kk,kk);
   g.font='40px "Press Start 2P"';const w=g.measureText(n).width+80;card(-w/2,-45,w,90,'#3a0d07','#ff2a00');g.textAlign='center';g.fillStyle='#FFE9C7';g.fillText(n,0,18);g.restore()})},
 stamp(u,d){const sw=d*.5,first=u<sw;const k=first?back((u-.1)/.25):1;g.save();g.translate(W/2,600);g.rotate(-.12);g.scale(k*(first?1:1+Math.max(0,(sw+.2-u))*.2),k);
  g.lineWidth=16;g.strokeStyle='#FF2A2A';g.strokeRect(-380,-150,760,300);g.font='150px "Russo One"';g.textAlign='center';g.fillStyle='#FF2A2A';g.fillText(first?'04.12':'ВАЙП',0,55);g.restore()},
 race(u,d){const items=[['НЕЗЕР',.25],['ЭНД',.55],['ДРАКОН',d*.55]];g.fillStyle='rgba(0,0,0,.6)';rr(160,380,760,470,22);g.fill();g.strokeStyle='#ff6a3d';g.lineWidth=5;g.stroke();
  g.font='38px "Press Start 2P"';g.textAlign='center';g.fillStyle='#FFD23F';g.fillText('ГОНКА ВАЙПА',W/2,460);
  items.forEach(([n,t0],i)=>{if(u<t0)return;const y=560+i*110;g.strokeStyle='#FFE9C7';g.lineWidth=5;g.strokeRect(230,y-45,60,60);g.textAlign='left';g.fillStyle='#FFE9C7';g.fillText(n,330,y);g.fillStyle='#FF7A1F';g.textAlign='right';g.fillText('#1 ?',860,y)})},
 ip(u){const k=back((u-.05)/.3);const lg=document.getElementById('logo');g.save();g.translate(W/2,560);g.scale(k,k);g.drawImage(lg,-110,-260,220,220);
  signAt(0,40,900,['evilverse.lol'],9);g.restore()},
 // огромная огненная цифра обратного отсчёта
 countdown(u,d,it){const k=back((u-.05)/.35),pulse=1+Math.sin(u*7)*.03;
  // огненное свечение за цифрой
  const rg=g.createRadialGradient(W/2,620,30,W/2,620,520);rg.addColorStop(0,'rgba(255,140,0,.55)');rg.addColorStop(.5,'rgba(255,40,0,.2)');rg.addColorStop(1,'rgba(255,0,0,0)');
  g.fillStyle=rg;g.fillRect(0,100,W,1100);
  g.save();g.translate(W/2,700);g.scale(k*pulse,k*pulse);
  const num=String(it.n);g.font=`${num.length>1?420:520}px "Russo One"`;g.textAlign='center';
  const fg=g.createLinearGradient(0,-380,0,60);fg.addColorStop(0,'#FFF3D0');fg.addColorStop(.45,'#FFB347');fg.addColorStop(1,'#FF2A00');
  g.lineJoin='round';g.lineWidth=34;g.strokeStyle='#2a0000';g.strokeText(num,0,40);g.fillStyle=fg;g.fillText(num,0,40);g.restore();
  // языки пламени снизу цифры
  // огненные язычки у основания цифры
  for(let i=0;i<11;i++){const x=W/2-300+i*60,h=(90+Math.abs(Math.sin(u*5+i*1.9))*120)*k,sw=Math.sin(u*9+i)*12;
   const fl=g.createLinearGradient(0,800-h,0,800);fl.addColorStop(0,'rgba(255,230,120,0)');fl.addColorStop(.35,'rgba(255,170,30,.85)');fl.addColorStop(1,'rgba(255,40,0,.9)');
   g.fillStyle=fl;g.beginPath();g.moveTo(x-34,800);g.quadraticCurveTo(x-30+sw,800-h*.55,x+sw,800-h);g.quadraticCurveTo(x+30+sw,800-h*.55,x+34,800);g.closePath();g.fill()}
  // дата старта под цифрой
  const k2=ease((u-.35)/.3);g.save();g.globalAlpha=k2;g.font='52px "Press Start 2P"';g.textAlign='center';g.lineWidth=10;g.strokeStyle='#000';
  const lab='04.12 · 18:00';g.strokeText(lab,W/2,880);g.fillStyle='#FFE9C7';g.fillText(lab,W/2,880);g.restore()},
};
// ---------- сцены про механики сервера ----------
const GREEN='#7CFF3B';
function plate(cy,txt,col,bg,u0,u){if(u<u0)return;const k=back((u-u0)/.25);g.save();g.translate(W/2,cy);g.scale(k,k);g.rotate(-.03);
 g.font='88px "Russo One"';const w=Math.min(1000,g.measureText(txt).width+90);card(-w/2,-85,w,170,bg,col);
 g.textAlign='center';g.lineJoin='round';g.lineWidth=14;g.strokeStyle='#000';g.strokeText(txt,0,32);g.fillStyle=col;g.fillText(txt,0,32);g.restore()}
function pixelHead(x,y,s,pal){seed=42;for(let i=0;i<8;i++)for(let j=0;j<8;j++){g.fillStyle=pal[Math.floor(rnd()*pal.length)];g.fillRect(x+i*s,y+j*s,s,s)}
 g.fillStyle='#fff';g.fillRect(x+s,y+4*s,s*2,s);g.fillRect(x+5*s,y+4*s,s*2,s);g.fillStyle='#111';g.fillRect(x+2*s,y+4*s,s,s);g.fillRect(x+5*s,y+4*s,s,s)}
Object.assign(SC,{
 // хук: две плашки-удара
 hook(u,d){plate(560,'СМЕРТЬ = БАН','#FF2A2A','#1a0303',.05,u);plate(820,'ОПЫТ = ДЕНЬГИ',GREEN,'#061a03',d*.5,u);
  if(u<d*.5){g.font='34px "Press Start 2P"';g.textAlign='center';g.fillStyle='rgba(255,233,199,'+clamp((u-.4)*3)+')';g.fillText('EVILVERSE',W/2,1060)}},
 // опыт — это кошелёк
 xpmoney(u,d,it){const m=it.marks||[d*.25,d*.45,d*.65];const buys=[[m[0],'МАГАЗИН',350],[m[1],'АУКЦИОН',600],[m[2],'/PAY',250]];let lvl=2500;buys.forEach(([t0,,c])=>{if(u>t0)lvl-=c*clamp((u-t0)/.3)});
  const k=back(u/.3);g.save();g.translate(W/2,470);g.scale(k,k);g.font='130px "Press Start 2P"';g.textAlign='center';g.lineWidth=18;g.strokeStyle='#000';
  const s=String(Math.round(lvl));g.strokeText(s,0,40);g.fillStyle=GREEN;g.fillText(s,0,40);g.font='34px "Press Start 2P"';g.fillStyle='#C9A58B';g.fillText('XP',0,110);g.restore();
  const segs=18,bw=880;for(let i=0;i<segs;i++){const x=W/2-bw/2+i*(bw/segs);g.fillStyle='#1a1a1a';g.fillRect(x,620,bw/segs-6,30);if(i/segs<lvl/2500){g.fillStyle=GREEN;g.fillRect(x+3,623,bw/segs-12,24)}}
  buys.forEach(([t0,n,c],i)=>{if(u<t0)return;const kk=back((u-t0)/.25);g.save();g.translate(W/2+(i-1)*320,760);g.scale(kk,kk);g.font='30px "Press Start 2P"';
   const w=g.measureText(n).width+50;card(-w/2,-40,w,80,'#3a0d07','#ff6a3d');g.textAlign='center';g.fillStyle='#FFE9C7';g.fillText(n,0,14);g.restore();
   const f=clamp((u-t0)/1.0);if(f<1){g.font='44px "Press Start 2P"';g.textAlign='center';g.fillStyle=`rgba(255,74,58,${1-f})`;g.fillText('-'+c,W/2+(i-1)*320,700-f*120)}})},
 // цена смерти 50/25/25
 xp(u,d,it){const m=it.marks||[.1,d*.35,d*.55];const rows=[['У ТЕБЯ',50,GREEN,m[0]],['СФЕРА',25,'#C8FF6A',m[1]],['СГОРАЕТ',25,'#FF4A1F',m[2]]];
  rows.forEach(([n,v,col,t0],i)=>{if(u<t0)return;const k=ease((u-t0)/.4),y=420+i*150;g.fillStyle='rgba(0,0,0,.55)';rr(90,y,900,110,16);g.fill();
   g.fillStyle=col;rr(100,y+10,Math.max(1,880*v/100*k),90,12);g.fill();g.font='40px "Press Start 2P"';g.lineWidth=8;g.strokeStyle='#000';g.lineJoin='round';
   g.textAlign='left';g.strokeText(n,130,y+72);g.fillStyle='#FFF';g.fillText(n,130,y+72);g.textAlign='right';g.strokeText(Math.round(v*k)+'%',960,y+72);g.fillStyle=col;g.fillText(Math.round(v*k)+'%',960,y+72)})},
 // PvE-щит тает
 shield(u,d){const hp=Math.max(0,100-u/d*70),k=back(u/.3);g.save();g.translate(W/2,520);g.scale(k,k);
  g.font='40px "Press Start 2P"';g.textAlign='center';g.lineWidth=8;g.strokeStyle='#000';const lab='PVE ЩИТ · '+Math.round(hp)+'/100 HP';g.strokeText(lab,0,-30);g.fillStyle=GREEN;g.fillText(lab,0,-30);
  g.fillStyle='#111';g.fillRect(-440,0,880,40);g.fillStyle=(Math.floor(u*6)%2&&hp<50)?'#ffb000':GREEN;g.fillRect(-436,4,872*hp/100,32);g.restore();
  // пиксельный щит
  const ps=42,sx=W/2-ps*4,sy=600;const sh=['..XXXX..','.XOOOOX.','XOOOOOOX','XOOGGOOX','XOOGGOOX','.XOOOOX.','..XOOX..','...XX...'];
  sh.forEach((r,j)=>[...r].forEach((ch,i)=>{if(ch==='.')return;g.fillStyle=ch==='X'?'#2b2b2b':ch==='G'?GREEN:'#8a8a8a';g.fillRect(sx+i*ps,sy+j*ps,ps,ps)}));
  if(hp<60){g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=8;g.beginPath();g.moveTo(sx+ps*3,sy+ps);g.lineTo(sx+ps*5,sy+ps*3.5);g.lineTo(sx+ps*4,sy+ps*6);g.stroke()}},
 // охота за головами
 bounty(u,d){const k=back(u/.3);g.save();g.translate(W/2,600);g.rotate(-.05+Math.sin(u*2)*.01);g.scale(k,k);
  card(-280,-330,560,660,'#e9d8b4','#5a3a1a');g.font='72px "Russo One"';g.textAlign='center';g.fillStyle='#8b0000';g.fillText('РОЗЫСК',0,-235);
  pixelHead(-120,-200,30,['#3a2a20','#4a3628','#2a1e16','#5a4030']);
  g.font='34px "Press Start 2P"';g.fillStyle='#3a2a1a';g.fillText('НАГРАДА',0,110);g.font='60px "Press Start 2P"';g.fillStyle='#1f7a10';g.fillText('5000 XP',0,200);
  if(u>d*.45){const kk=back((u-d*.45)/.2);g.save();g.translate(150,250);g.rotate(-.3);g.scale(kk,kk);g.lineWidth=8;g.strokeStyle='#c00';g.strokeRect(-130,-45,260,90);
   g.font='40px "Russo One"';g.fillStyle='#c00';g.fillText('/bounty',0,14);g.restore()}
  g.restore()},
 // шоудаун: граница сжимается
 border(u,d){const cx=W/2,cy=650,size=lerp(780,280,ease(u/d*1.1));g.fillStyle='rgba(20,5,5,.75)';g.fillRect(cx-400,cy-400,800,800);
  g.strokeStyle='rgba(255,255,255,.06)';g.lineWidth=2;for(let i=-400;i<=400;i+=50){g.beginPath();g.moveTo(cx+i,cy-400);g.lineTo(cx+i,cy+400);g.moveTo(cx-400,cy+i);g.lineTo(cx+400,cy+i);g.stroke()}
  g.strokeStyle='#ff2a2a';g.lineWidth=10;g.shadowColor='#ff2a2a';g.shadowBlur=30;g.strokeRect(cx-size/2,cy-size/2,size,size);g.shadowBlur=0;
  seed=21;for(let i=0;i<14;i++){const px=cx+(rnd()-.5)*700+Math.sin(u*2+i)*20,py=cy+(rnd()-.5)*700+Math.cos(u*2+i)*20;const out=Math.abs(px-cx)>size/2||Math.abs(py-cy)>size/2;
   if(out){g.font='40px "DejaVu Sans"';g.textAlign='center';g.fillStyle='#ff4a3a';g.fillText('☠',px,py+14)}else{g.fillStyle='#FFE9C7';g.fillRect(px-10,py-10,20,20)}}
  g.font='40px "Press Start 2P"';g.textAlign='center';g.lineWidth=8;g.strokeStyle='#000';g.strokeText('ШОУДАУН',cx,cy-345);g.fillStyle='#FFD23F';g.fillText('ШОУДАУН',cx,cy-345)},
 // аирдроп на парашюте
 airdrop(u,d){const land=d*.55,f=clamp(u/land),y=lerp(250,780,ease(f)),sway=Math.sin(u*4)*30*(1-f),x=W/2+sway;
  if(u<land){g.strokeStyle='#ddd';g.lineWidth=3;for(const dx of[-70,-25,25,70]){g.beginPath();g.moveTo(x+dx*2.2,y-260);g.lineTo(x+dx*.6,y-70);g.stroke()}
   g.fillStyle='#d42020';g.beginPath();g.arc(x,y-250,180,Math.PI,0);g.fill();g.fillStyle='#ff6a3d';for(let i=0;i<4;i++){g.beginPath();g.moveTo(x,y-250);g.arc(x,y-250,180,Math.PI+i*Math.PI/4,Math.PI+(i+.5)*Math.PI/4);g.fill()}}
  const bs=230;for(let i=0;i<3;i++)for(let j=0;j<3;j++){g.fillStyle=(i+j)%2?'#8a5a2b':'#7a4e24';g.fillRect(x-bs/2+i*bs/3,y-bs/2+j*bs/3,bs/3,bs/3)}
  g.fillStyle='#3a2a1a';g.fillRect(x-bs/2,y-8,bs,16);g.fillRect(x-8,y-bs/2,16,bs);g.strokeStyle='#2a1a0a';g.lineWidth=6;g.strokeRect(x-bs/2,y-bs/2,bs,bs);
  if(u>land){const p=u-land;g.strokeStyle=`rgba(255,200,80,${clamp(1-p*1.5)})`;g.lineWidth=12;g.beginPath();g.arc(x,y,80+p*500,0,6.28);g.stroke();
   for(let i=0;i<10;i++){const a=i/10*6.28,r=100+p*260;g.fillStyle=`rgba(255,${150+i*10},40,${clamp(1-p*1.3)})`;g.fillRect(x+Math.cos(a)*r,y+Math.sin(a)*r*.5,16,16)}
   g.font='36px "Press Start 2P"';g.textAlign='center';g.fillStyle='#FFD23F';g.fillText('ТИР III',x,y-120)}},
 // клановые войны: три алтаря
 altars(u,d){const xs=[230,540,850],cols=['#ff2a2a','#3aa0ff','#ff2a2a'];xs.forEach((x,i)=>{const k=back((u-i*.15)/.3)*1.25;if(k<=0)return;g.save();g.translate(x,820);g.scale(k,k);
   for(let j=0;j<4;j++){g.fillStyle=j%2?'#1a1024':'#24163a';g.fillRect(-50,-j*70,100,70)}
   const fl=Math.abs(Math.sin(u*8+i))*30;g.fillStyle='#ff7a1f';g.beginPath();g.moveTo(-40,-280);g.quadraticCurveTo(0,-360-fl,40,-280);g.fill();
   const p=clamp((u-.3-i*.2)/(d*.6));g.strokeStyle='rgba(255,255,255,.15)';g.lineWidth=12;g.beginPath();g.arc(0,-140,130,0,6.28);g.stroke();
   g.strokeStyle=cols[i];g.beginPath();g.arc(0,-140,130,-Math.PI/2,-Math.PI/2+p*6.28);g.stroke();
   g.font='28px "Press Start 2P"';g.textAlign='center';g.fillStyle='#FFE9C7';g.fillText(Math.round(p*100)+'%',0,60);g.restore()});
  if(u>d*.55){const kk=back((u-d*.55)/.25),pl=1+Math.sin(u*10)*.05;g.save();g.translate(W/2,330);g.scale(kk*pl,kk*pl);card(-300,-60,600,120,'#2a0505','#ff2a2a');
   g.font='44px "Press Start 2P"';g.textAlign='center';g.fillStyle='#FFD23F';g.fillText('СЕРДЦЕ АДА x3',0,16);g.restore()}},
 // финальный вопрос
 ask(u){const k=back((u-.05)/.3);g.save();g.translate(W/2,580);g.scale(k,k);card(-380,-110,760,220,'#f3ead9','#111');
  g.fillStyle='#ff5a1f';g.fillRect(-340,-75,40,40);g.font='30px "Press Start 2P"';g.textAlign='left';g.fillStyle='#666';g.fillText('@ты',-285,-42);
  g.font='44px "Press Start 2P"';g.fillStyle='#111';g.fillText('добавьте в вайп',-340,40);
  for(let i=0;i<3;i++){g.fillStyle=(Math.floor(u*4)%3===i)?'#111':'#bbb';g.fillRect(-340+i*42,62,24,24)}g.restore();
  g.font='40px "Press Start 2P"';g.textAlign='center';g.lineWidth=8;g.strokeStyle='#000';g.strokeText('evilverse.lol',W/2,800);g.fillStyle='#FFD23F';g.fillText('evilverse.lol',W/2,800)},
});
const SFX_SHAKE={roar:[[.1,1.0,26]],stamp:[[.1,.5,18],['f0.5',.4,22]],countdown:[[.05,.4,14]],hook:[[.05,.35,20],['f0.5',.35,24]],airdrop:[['f0.55',.4,20]],bounty:[['f0.45',.3,14]],altars:[['f0.55',.35,16]]};

window.render=(t)=>{const TL=window.TL;let cur=TL.items[0];for(const it of TL.items)if(t>=it.start)cur=it;
 const u=t-cur.start,d=cur.end-cur.start;let sx=0,sy=0;
 for(const s of (SFX_SHAKE[cur.scene]||[])){const a=typeof s[0]==='string'?d*parseFloat(s[0].slice(1)):s[0],b=a+s[1];if(u>a&&u<b){const f=(b-u)/(b-a);sx+=Math.sin(t*90)*s[2]*f;sy+=Math.cos(t*77)*s[2]*f}}
 const zoom=1+Math.max(0,.035-u*.12);
 g.save();g.translate(W/2+sx,H/2+sy);g.scale(zoom,zoom);g.translate(-W/2,-H/2);bg(t);header();
 SC[cur.scene](u,d,cur);if(t<=cur.end)caption(cur,u);g.restore();
 if(u<.16){g.fillStyle=`rgba(255,120,40,${(.16-u)*1.6})`;g.fillRect(0,0,W,H)}
 g.fillStyle='rgba(255,255,255,.15)';g.fillRect(0,0,W,8);g.fillStyle='#ff5a1f';g.fillRect(0,0,W*Math.min(1,t/TL.dur),8);
 return null;};
// ---------- быстрый режим: пословные субтитры, каждое слово — удар по кадру ----------
const TINTS=['rgba(255,60,0,.10)','rgba(255,0,50,.10)','rgba(255,150,0,.08)','rgba(140,0,255,.07)'];
function fastCaption(txt,cu,ci){const k=back(cu/.12),rot=((ci%3)-1)*.035;g.save();g.translate(W/2,1110);g.rotate(rot);g.scale(k,k);
 let size=150;g.font=`${size}px "Russo One"`;const mw=g.measureText(txt).width;if(mw>960){size=Math.floor(size*960/mw);g.font=`${size}px "Russo One"`}
 g.textAlign='center';g.lineJoin='round';g.lineWidth=size*.24;g.strokeStyle='#000';g.strokeText(txt,0,size*.35);
 if(ci%2){const gr=g.createLinearGradient(0,-size*.5,0,size*.4);gr.addColorStop(0,'#FFE36A');gr.addColorStop(1,'#FF4A12');g.fillStyle=gr}else g.fillStyle='#FFF6E8';
 g.fillText(txt,0,size*.35);g.restore()}
function beatFx(t,cu,ci,txt){
 // огромное слово-эхо на фоне
 g.save();g.globalAlpha=.10;g.font='300px "Russo One"';g.textAlign='center';g.fillStyle=ci%2?'#ff5a1f':'#ffffff';
 g.fillText(txt.split(' ')[0],W/2+60-cu*160,1500);g.restore();
 // смена оттенка ада
 g.fillStyle=TINTS[ci%TINTS.length];g.fillRect(0,0,W,H);
 // лучи скорости
 if(cu<.25){const a=1-cu/.25;g.strokeStyle=`rgba(255,220,160,${.5*a})`;g.lineWidth=6;seed=ci*7+1;
  for(let i=0;i<26;i++){const ang=rnd()*6.28,r1=260+rnd()*200,r2=r1+300+rnd()*500*(1-a*.3);g.beginPath();
   g.moveTo(W/2+Math.cos(ang)*r1,820+Math.sin(ang)*r1);g.lineTo(W/2+Math.cos(ang)*r2,820+Math.sin(ang)*r2);g.stroke()}}
 // взрыв искр
 if(cu<.55){seed=ci*13+5;for(let i=0;i<34;i++){const ang=rnd()*6.28,sp=500+rnd()*900,r=sp*cu,s=6+rnd()*10;
  g.fillStyle=`rgba(255,${120+Math.floor(rnd()*120)},40,${1-cu/.55})`;g.fillRect(W/2+Math.cos(ang)*r,880+Math.sin(ang)*r*.8,s,s)}}
}
function whip(u,dir){if(u>=.2)return 0;const p=1-ease(u/.2);
 g.save();g.fillStyle=`rgba(255,120,40,${p*.5})`;seed=Math.floor(dir*100+50);for(let i=0;i<18;i++){const y=rnd()*H,h=6+rnd()*30;g.fillRect(0,y,W,h)}g.restore();
 return p*W*.55*dir}
const _render=window.render;
window.render=(t)=>{const TL=window.TL;if(!TL.chunks)return _render(t);
 let cur=TL.items[0],si=0;TL.items.forEach((it,i)=>{if(t>=it.start){cur=it;si=i}});
 let ci=0;TL.chunks.forEach((c,i)=>{if(t>=c[0])ci=i});const ch=TL.chunks[ci],cu=t-ch[0];
 const u=t-cur.start,d=cur.end-cur.start;let sx=0,sy=0;
 for(const s of (SFX_SHAKE[cur.scene]||[])){const a=typeof s[0]==='string'?d*parseFloat(s[0].slice(1)):s[0],b=a+s[1];if(u>a&&u<b){const f=(b-u)/(b-a);sx+=Math.sin(t*90)*s[2]*f;sy+=Math.cos(t*77)*s[2]*f}}
 if(cu<.12){sx+=Math.sin(t*120)*10;sy+=Math.cos(t*110)*8}
 const punch=1+.08*Math.max(0,1-cu/.16),tilt=((ci%2)?1:-1)*.03*Math.max(0,1-cu/.22)+((ci%3)-1)*.006;
 const wx=whip(u,si%2?1:-1);
 g.save();g.translate(W/2+sx+wx,H/2+sy);g.rotate(tilt);g.scale(punch*1.02,punch*1.02);g.translate(-W/2,-H/2);
 bg(t*1.6);beatFx(t,cu,ci,ch[2]);header();SC[cur.scene](u,d,cur);g.restore();
 if(cur.scene!=='hook')fastCaption(ch[2],cu,ci);
 whip(u,si%2?1:-1);
 if(cu<.07){g.fillStyle=`rgba(255,230,190,${(.07-cu)*4})`;g.fillRect(0,0,W,H)}
 g.fillStyle='rgba(255,255,255,.15)';g.fillRect(0,0,W,8);g.fillStyle='#ff5a1f';g.fillRect(0,0,W*Math.min(1,t/TL.dur),8);
 return null;};
const SAMPLE='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяABCabc0123456789☠▬—·';
window.ready=document.fonts.ready.then(()=>Promise.all([document.fonts.load('40px "Press Start 2P"',SAMPLE),document.fonts.load('40px "Russo One"',SAMPLE)]))
 .then(()=>new Promise(r=>{const l=document.getElementById('logo');l.complete?r():l.onload=r}));

// EvilVerse промо v3: 3D-мир, плавные переходы, мемы. Подключается после scene2.html.
(function () {
const easeIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

// ---------- 3D-мир ----------
const F = 900, CH = 2.3, HZ = 1150;           // фокус, высота камеры, горизонт
const proj = (X, Y, Z, camX) => [W / 2 + (X - camX) * F / Z, HZ + (CH - Y) * F / Z, F / Z];
const NETH_COL = ['#5a1616', '#6b1e1e', '#4a1212', '#7a2424', '#561414'];
const PILLARS = []; for (let i = 0; i < 16; i++) PILLARS.push({ x: (i % 2 ? 1 : -1) * (3.5 + hash(i, 1) * 7), z: 4 + i * 2.6, h: 5 + hash(i, 2) * 9, w: .9 + hash(i, 3) * .8 });
const EMB = []; for (let i = 0; i < 90; i++) EMB.push({ x: (hash(i, 7) - .5) * 18, y: hash(i, 8) * 9, z: 2 + hash(i, 9) * 30, s: hash(i, 10) });
function world(t) {
  const camZ = t * 2.2, camX = Math.sin(t * .35) * .6;
  const sky = g.createLinearGradient(0, 0, 0, HZ + 40); sky.addColorStop(0, '#120202'); sky.addColorStop(.6, '#3a0606'); sky.addColorStop(1, '#8a1d06');
  g.fillStyle = sky; g.fillRect(0, 0, W, HZ + 40);
  // далёкое зарево
  const gl = g.createRadialGradient(W / 2, HZ, 50, W / 2, HZ, 700); gl.addColorStop(0, 'rgba(255,110,20,.45)'); gl.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gl; g.fillRect(0, HZ - 700, W, 900);
  // пол: ряды плит от дальних к ближним
  const z0 = Math.floor(camZ);
  for (let rz = 42; rz >= 1; rz--) {
    const zw = z0 + rz, zA = zw - camZ, zB = zA + 1; if (zA < .9) continue;
    const fog = clamp((zA - 6) / 32);
    for (let ix = -12; ix < 12; ix++) {
      const a = proj(ix, 0, zB, camX), b = proj(ix + 1, 0, zB, camX), c = proj(ix + 1, 0, zA, camX), d = proj(ix, 0, zA, camX);
      if (c[0] < -50 && b[0] < -50 || d[0] > W + 50 && a[0] > W + 50) continue;
      const hsh = hash(ix, zw), lava = hsh > .93 && Math.abs(ix) > 1;
      let col = lava ? `rgb(255,${Math.floor(110 + Math.sin(t * 3 + ix) * 50)},20)` : NETH_COL[Math.floor(hsh * NETH_COL.length)];
      g.fillStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
      if (fog > 0) { g.fillStyle = `rgba(90,14,6,${fog * .9})`; g.fill(); }
      if (!lava && zA < 10) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.stroke(); }
    }
  }
  // колонны базальта с глубиной
  const ps = PILLARS.map(p => ({ ...p, zz: ((p.z - camZ) % 42 + 42) % 42 + 1.2 })).sort((a, b) => b.zz - a.zz);
  for (const p of ps) {
    const [x0, y0, s] = proj(p.x - p.w / 2, 0, p.zz, camX), [x1, y1] = proj(p.x + p.w / 2, p.h, p.zz, camX);
    const fog = clamp((p.zz - 5) / 30);
    g.fillStyle = `rgb(${Math.floor(38 + fog * 60)},${Math.floor(28 + fog * 4)},${Math.floor(36 - fog * 20)})`; g.fillRect(x0, y1, x1 - x0, y0 - y1);
    g.fillStyle = `rgba(255,120,40,${.25 * (1 - fog)})`; g.fillRect(x0, y1, Math.max(2, s * .08), y0 - y1);
    for (let k = 1; k < p.h; k += 1.3) { const [, yk] = proj(0, k, p.zz, camX); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0, yk, x1 - x0, Math.max(1, s * .04)); }
  }
  // искры с глубиной
  for (const e of EMB) {
    const zz = ((e.z - camZ * .6) % 30 + 30) % 30 + 1.5, yy = (e.y + t * (.4 + e.s * .8)) % 9;
    const [x, y, s] = proj(e.x, yy, zz, camX); const sz = Math.max(1.5, s * .05);
    g.fillStyle = `rgba(255,${Math.floor(150 + e.s * 90)},60,${.85 - zz / 40})`; g.fillRect(x, y, sz, sz);
  }
  const vg = g.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 1200); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

// ---------- 3D-куб ----------
function cube(cx, cy, size, ry, rx, faces) {
  const v = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    let X = x, Y = y, Z = z; let t1 = X * Math.cos(ry) + Z * Math.sin(ry); Z = -X * Math.sin(ry) + Z * Math.cos(ry); X = t1;
    let t2 = Y * Math.cos(rx) - Z * Math.sin(rx); Z = Y * Math.sin(rx) + Z * Math.cos(rx); Y = t2;
    const p = 6 / (6 + Z); v.push([cx + X * size * p, cy + Y * size * p, Z]);
  }
  // грани: индексы вершин (x,y,z → 4x+2y+z)
  const FACES = [[[0, 1, 3, 2], 'side'], [[4, 6, 7, 5], 'side'], [[0, 4, 5, 1], 'side'], [[2, 3, 7, 6], 'side'], [[0, 2, 6, 4], 'top'], [[1, 5, 7, 3], 'top']];
  const list = FACES.map(([ix, kind], n) => ({ ix, kind, n, z: ix.reduce((s, i) => s + v[i][2], 0) / 4 })).sort((a, b) => b.z - a.z);
  for (const f of list) {
    const P = f.ix.map(i => v[i]);
    const cross = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]);
    const shade = .55 + .45 * clamp(Math.abs(cross) / (size * size * 4));
    const tex = faces[f.n % faces.length];
    g.save(); g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
    // аффинная проекция текстуры 16x16 на грань
    const [p0, p1, , p3] = P, tw = tex.width || 16, th = tex.height || 16;
    g.transform((p1[0] - p0[0]) / tw, (p1[1] - p0[1]) / tw, (p3[0] - p0[0]) / th, (p3[1] - p0[1]) / th, p0[0], p0[1]);
    g.drawImage(tex, 0, 0); g.restore();
    g.save(); g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    g.fillStyle = `rgba(0,0,0,${1 - shade})`; g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.stroke(); g.restore();
  }
}
const mkTex = (pal, s) => { const cv = document.createElement('canvas'); cv.width = cv.height = 16; const x = cv.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { x.fillStyle = pal[Math.floor(hash(i + s, j * 3 + s) * pal.length)]; x.fillRect(i, j, 1, 1) } return cv; };
const T_XP = mkTex(['#7CFF3B', '#5ee02a', '#a8ff6a', '#3fb81c', '#c8ff9a'], 3);
const T_GOLD = mkTex(['#ffd23f', '#f5b800', '#ffe680', '#d99a00'], 5);
const T_NETH = mkTex(NETH_COL, 9), T_CRATE = mkTex(['#8a5a2b', '#7a4e24', '#6a421d', '#9a6a35'], 11);
const T_OBS = mkTex(['#1a1024', '#24163a', '#120a1a', '#2e1c48'], 13);
const logoTex = () => document.getElementById('logo');

// ---------- мелочи ----------
function sticker(txt, x, y, rot, u, u0, bg = '#fff', fg = '#111') { if (u < u0) return; const k = back((u - u0) / .25); g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  g.font = '38px "Press Start 2P"'; const w = g.measureText(txt).width + 50; rr(-w / 2, -40, w, 80, 14); g.fillStyle = bg; g.fill(); g.lineWidth = 5; g.strokeStyle = '#000'; g.stroke();
  g.textAlign = 'center'; g.fillStyle = fg; g.fillText(txt, 0, 14); g.restore(); }
function bigText(txt, y, size, fill, u, u0 = 0, rot = 0) { if (u < u0) return; const k = back((u - u0) / .3); g.save(); g.translate(W / 2, y); g.rotate(rot); g.scale(k, k);
  g.font = `${size}px "Russo One"`; const mw = g.measureText(txt).width; if (mw > 980) { size = size * 980 / mw; g.font = `${size}px "Russo One"`; }
  g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * .2; g.strokeStyle = '#000'; g.strokeText(txt, 0, size * .35); g.fillStyle = fill; g.fillText(txt, 0, size * .35); g.restore(); }
function eyesHead(x, y, s, look, pal) { pixelHead(x - s * 4, y - s * 4, s, pal); // выпученные глаза
  g.fillStyle = '#fff'; g.fillRect(x - s * 3.5, y - s * 1.5, s * 2.6, s * 2.6); g.fillRect(x + s * .9, y - s * 1.5, s * 2.6, s * 2.6);
  g.fillStyle = '#111'; g.fillRect(x - s * 2.6 + look * s * .7, y - s * .7, s * 1.2, s * 1.2); g.fillRect(x + s * 1.8 + look * s * .7, y - s * .7, s * 1.2, s * 1.2); }
const SKINS = [['#3a2a20', '#4a3628', '#2a1e16'], ['#c48a5a', '#b07a4a', '#d49a6a'], ['#5a7a3a', '#4a6a2a', '#6a8a4a'], ['#2a3a6a', '#3a4a7a', '#1a2a5a'], ['#7a2a5a', '#8a3a6a', '#6a1a4a']];

Object.assign(SC, {
  // «Обычный сервер»: серо, скучно, храп
  boring(u, d) { g.save(); g.globalAlpha = .92; g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, W, H); g.restore();
    g.fillStyle = '#6aa0d8'; g.fillRect(0, 0, W, 900); g.fillStyle = '#5a9a3a'; g.fillRect(0, 900, W, 140); g.fillStyle = '#7a5a3a'; g.fillRect(0, 1040, W, 900);
    g.fillStyle = '#fff'; g.fillRect(140, 200, 220, 60); g.fillRect(620, 280, 260, 60);
    const bob = Math.sin(u * 2) * 6; pixelHead(W / 2 - 120, 560 + bob, 30, ['#c48a5a', '#b07a4a', '#d49a6a']);
    g.fillStyle = '#111'; g.fillRect(W / 2 - 90, 680 + bob, 60, 10); g.fillRect(W / 2 + 30, 680 + bob, 60, 10); // закрытые глаза
    for (let i = 0; i < 3; i++) { const p = ((u * .8 + i * .33) % 1); g.font = `${40 + i * 18}px "Press Start 2P"`; g.fillStyle = `rgba(40,40,40,${1 - p})`; g.textAlign = 'center'; g.fillText('z', W / 2 + 180 + p * 90, 560 - p * 200 - i * 20); }
    sticker('*храп*', 760, 420, .12, u, .5); },
  // «EvilVerse»: огненное раскрытие + 3D-логотип
  reveal(u, d) { const r = easeIO(u / .6) * 1500; const gl = g.createRadialGradient(W / 2, 640, 10, W / 2, 640, Math.max(20, r)); gl.addColorStop(0, 'rgba(255,220,120,.9)'); gl.addColorStop(.4, 'rgba(255,90,0,.55)'); gl.addColorStop(1, 'rgba(255,0,0,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, H);
    const k = back(u / .45); g.save(); g.translate(W / 2, 640); g.scale(k, k); g.rotate(Math.sin(u * 3) * .04);
    g.drawImage(logoTex(), -190, -190, 380, 380); g.restore();
    bigText('EVILVERSE', 1000, 150, (() => { const gr = g.createLinearGradient(0, -60, 0, 60); gr.addColorStop(0, '#FFF3D0'); gr.addColorStop(.5, '#FFB347'); gr.addColorStop(1, '#FF2A00'); return gr; })(), u, .15); },
  // бан
  ban(u, d) { plate(620, 'СМЕРТЬ = БАН', '#FF2A2A', '#1a0303', .05, u); sticker('*звук бана*', 700, 820, -.1, u, d * .45); },
  // опыт = деньги: вращающийся 3D-блок опыта и золото
  xpcube(u, d) { cube(W / 2 - 170, 600, 150, u * 1.6, -.45 + Math.sin(u) * .1, [T_XP]); cube(W / 2 + 190, 640, 120, -u * 1.3 + 1, -.4, [T_GOLD]);
    g.font = '90px "Russo One"'; g.textAlign = 'center'; g.fillStyle = '#FFE9C7'; g.fillText('=', W / 2 + 10, 670);
    for (let i = 0; i < 8; i++) { const p = (u * .9 + i / 8) % 1; g.fillStyle = `rgba(255,210,63,${1 - p})`; g.beginPath(); g.arc(W / 2 + 190 + Math.sin(i * 2.3) * 120, 640 - p * 420, 14, 0, 6.28); g.fill(); }
    plate(930, 'ОПЫТ = ДЕНЬГИ', '#7CFF3B', '#061a03', .2, u); },
  // «Потрачено»: всё серое, мем
  wasted(u, d) { SC.xpmoney(3.5 + u * .2, 4, { marks: [0, .3, .6] });
    g.save(); g.globalCompositeOperation = 'saturation'; g.fillStyle = '#888'; g.fillRect(0, 0, W, H); g.restore();
    g.fillStyle = `rgba(0,0,0,${clamp(u * 2) * .35})`; g.fillRect(0, 0, W, H);
    const k = clamp(u / .5); g.save(); g.translate(W / 2, 760); g.scale(1.25 - k * .25, 1.25 - k * .25); g.globalAlpha = k;
    g.font = '150px "Russo One"'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = '#000'; g.strokeText('ПОТРАЧЕНО', 0, 50); g.fillStyle = '#e8463a'; g.fillText('ПОТРАЧЕНО', 0, 50); g.restore(); },
  // сфера опыта падает, к ней бегут
  orb(u, d) { const bounce = Math.abs(Math.sin(u * 5)) * 160 * Math.exp(-u * .6); const ox = W / 2, oy = 820 - bounce;
    const gl = g.createRadialGradient(ox, oy, 5, ox, oy, 120); gl.addColorStop(0, 'rgba(200,255,120,.9)'); gl.addColorStop(1, 'rgba(124,255,59,0)'); g.fillStyle = gl; g.fillRect(ox - 130, oy - 130, 260, 260);
    cube(ox, oy, 62, u * 3, u * 2, [T_XP]);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(ox, 900, 70 - bounce * .2, 16, 0, 0, 6.28); g.fill();
    for (let i = 0; i < 4; i++) { const side = i % 2 ? 1 : -1, p = clamp((u - .8 - i * .25) / (d - 1)); const x = ox + side * lerp(520, 140 + i * 30, easeIO(p)); const y = 760 + (i < 2 ? 0 : 60);
      pixelHead(x - 64, y - 64 + Math.abs(Math.sin(u * 14 + i)) * -18, 16, SKINS[i]); }
    sticker('25% ОПЫТА', W / 2, 520, -.06, u, .3, '#7CFF3B', '#06210a'); },
  // весь сервер такой: 👀
  eyes(u, d) { const n = 6; for (let i = 0; i < n; i++) { const k = back((u - i * .1) / .25); if (k <= 0) continue; const x = 190 + (i % 3) * 350, y = 520 + Math.floor(i / 3) * 330;
      g.save(); g.translate(x, y); g.scale(k, k); eyesHead(0, 0, 26, Math.sin(u * 6 + i) > 0 ? 1 : -1, SKINS[i % SKINS.length]); g.restore(); }
    sticker('весь сервер:', W / 2, 330, -.04, u, .1); },
  // все 30 игроков к аирдропу
  rush(u, d) { const cx = W / 2, cy = 760; cube(cx, cy, 90, .6 + Math.sin(u) * .05, -.45, [T_CRATE]);
    for (let i = 0; i < 30; i++) { const a = hash(i, 4) * 6.28, r0 = 700 + hash(i, 5) * 300, sp = .6 + hash(i, 6) * .6, r = Math.max(120, r0 - u * 520 * sp);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .45 + 40; pixelHead(x - 36, y - 36 + Math.sin(u * 16 + i) * 8, 9, SKINS[i % SKINS.length]); }
    sticker('*топот*', 820, 480, .1, u, .2); },
  // мем клана: идём → через минуту ☠
  clanmeme(u, d, it) { const sw = it.swap || d * .5; const before = u < sw, k = before ? back(u / .3) : back((u - sw) / .3);
    if (before) { const n = 5; for (let i = 0; i < n; i++) { const x = 160 + i * 190, y = 640 + Math.sin(u * 8 + i) * 12; pixelHead(x - 48, y - 48, 12, SKINS[i]); }
      bigText('«ИДЁМ НА АЛТАРИ!»', 900, 90, '#7CFF3B', u, .05, -.03); }
    else { for (let i = 0; i < 5; i++) { const kk = back((u - sw - i * .08) / .25); if (kk <= 0) continue; g.save(); g.translate(160 + i * 190, 650); g.scale(kk, kk);
        g.font = '120px "DejaVu Sans"'; g.textAlign = 'center'; g.fillStyle = '#e8e8e8'; g.fillText('☠', 0, 40); g.restore(); }
      sticker('через минуту:', W / 2, 440, .05, u, sw); } },
  // «Удалить старый мир?» → клик → мир рассыпается
  dialog(u, d, it) { const click = it.click || d * .55, crumble = Math.max(0, u - click - .12);
    if (crumble < .05) { const k = back(u / .3); g.save(); g.translate(W / 2, 620); g.scale(k, k);
      g.fillStyle = '#ece9d8'; g.fillRect(-400, -200, 800, 400); g.fillStyle = '#0a246a'; g.fillRect(-400, -200, 800, 64);
      g.font = '32px "Press Start 2P"'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText('Удаление мира', -370, -155);
      g.fillStyle = '#c42b1c'; g.fillRect(340, -190, 46, 44); g.fillStyle = '#fff'; g.fillText('x', 350, -155);
      g.fillStyle = '#111'; g.font = '36px "Press Start 2P"'; g.fillText('Удалить старый мир?', -350, -40);
      const pressed = u > click; g.fillStyle = pressed ? '#bcd' : '#ddd'; g.fillRect(-300, 60, 240, 80); g.fillRect(60, 60, 240, 80); g.strokeStyle = '#555'; g.lineWidth = 4; g.strokeRect(-300, 60, 240, 80); g.strokeRect(60, 60, 240, 80);
      g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText('ДА', -180, 115); g.fillText('НЕТ', 180, 115);
      // курсор едет к «ДА»
      const cp = easeIO(clamp(u / click)); const cx = lerp(300, -190, cp), cy = lerp(300, 110, cp);
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 60); g.lineTo(cx + 16, cy + 46); g.lineTo(cx + 28, cy + 72); g.lineTo(cx + 38, cy + 66); g.lineTo(cx + 26, cy + 42); g.lineTo(cx + 46, cy + 42); g.closePath(); g.fill(); g.stroke();
      g.restore(); }
    else { // блоки разлетаются и падают в 3D
      for (let i = 0; i < 26; i++) { const sx = 220 + (i % 6) * 128, sy = 420 + Math.floor(i / 6) * 110, vx = (hash(i, 1) - .5) * 600, vy = -200 - hash(i, 2) * 500;
        const x = sx + vx * crumble, y = sy + vy * crumble + 1400 * crumble * crumble; if (y > H + 200) continue;
        cube(x, y, 34 + hash(i, 3) * 20, crumble * (2 + hash(i, 4) * 6), crumble * 3, [i % 3 ? T_NETH : T_OBS]); }
      bigText('СТАРЫЙ МИР УДАЛЁН', 980, 80, '#FF4A3A', u, click + .3); } },
  // финал: 3D-куб с логотипом
  ip3(u, d) { const k = back(u / .4); g.save(); g.translate(0, 0); cube(W / 2, 560, 170 * k, u * 1.2, -.35 + Math.sin(u * 1.5) * .08, [logoTex()]); g.restore();
    bigText('evilverse.lol', 900, 110, (() => { const gr = g.createLinearGradient(0, -50, 0, 50); gr.addColorStop(0, '#FFE36A'); gr.addColorStop(1, '#FF4A12'); return gr; })(), u, .2);
    sticker('или боишься?', W / 2, 1040, -.05, u, d * .55, '#1a0303', '#FFE9C7'); },
});

// ---------- переходы ----------
function withTransform(kind, p, isIn, fn) {
  g.save();
  if (kind === 'slide') g.translate(isIn ? (1 - p) * W : -p * W, 0);
  else if (kind === 'push') { g.translate(0, isIn ? (1 - p) * H * .55 : -p * H * .55); g.globalAlpha = isIn ? p : 1 - p; }
  else if (kind === 'zoom') { const s = isIn ? .7 + .3 * p : 1 + .7 * p; g.translate(W / 2, 640); g.scale(s, s); g.translate(-W / 2, -640); g.globalAlpha = isIn ? p : 1 - p; }
  else if (kind === 'flip') { const sx = isIn ? Math.max(0, -Math.cos(p * Math.PI)) : Math.max(0, Math.cos(p * Math.PI)); g.translate(W / 2, 0); g.scale(Math.max(.001, sx), 1); g.translate(-W / 2, 0); }
  else if (kind === 'spin') { const a = isIn ? -(1 - p) * .6 : p * .6, s = isIn ? .5 + .5 * p : 1 - .5 * p; g.translate(W / 2, 640); g.rotate(a); g.scale(s, s); g.translate(-W / 2, -640); g.globalAlpha = isIn ? p : 1 - p; }
  else if (kind === 'iris' && isIn) { g.beginPath(); g.arc(W / 2, 640, Math.max(1, p * 1500), 0, 6.28); g.clip(); }
  else if (kind === 'iris' && !isIn) { /* старый кадр остаётся под шторкой */ }
  fn(); g.restore();
}

// ---------- субтитры: плавно, ключевые — огнём ----------
function softCaption(txt, hl, cu) {
  if (!txt) return; const k = easeIO(cu / .16); g.save(); g.globalAlpha = k; g.translate(W / 2, 1290 + (1 - k) * 34); g.scale(.92 + .08 * k, .92 + .08 * k);
  let size = 112; g.font = `${size}px "Russo One"`; const mw = g.measureText(txt).width; if (mw > 980) { size = Math.floor(size * 980 / mw); g.font = `${size}px "Russo One"`; }
  g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * .22; g.strokeStyle = '#000'; g.strokeText(txt, 0, size * .35);
  if (hl) { const gr = g.createLinearGradient(0, -size * .5, 0, size * .4); gr.addColorStop(0, '#FFE36A'); gr.addColorStop(1, '#FF4A12'); g.fillStyle = gr; } else g.fillStyle = '#FFF6E8';
  g.fillText(txt, 0, size * .35); g.restore();
}

const T_DUR = .38;
const _prev = window.render;
window.render = (t) => {
  const TL = window.TL; if (!TL.v3) return _prev(t);
  let si = 0; TL.items.forEach((it, i) => { if (t >= it.start) si = i; }); const cur = TL.items[si], u = t - cur.start, d = cur.end - cur.start;
  // плавная «камера»: лёгкое покачивание и акценты только на ключевых моментах
  let sx = Math.sin(t * .7) * 6, sy = Math.cos(t * .5) * 5, zoom = 1 + .015 * Math.sin(t * .4);
  for (const a of (cur.hits || [])) { const du = u - a; if (du > 0 && du < .45) { const f = 1 - du / .45; sx += Math.sin(du * 70) * 16 * f; sy += Math.cos(du * 60) * 12 * f; zoom += .05 * f * f; } }
  g.save(); g.translate(W / 2 + sx, H / 2 + sy); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
  world(t);
  const p = easeIO(u / T_DUR), kind = cur.tr || 'cut';
  if (si > 0 && u < T_DUR && kind !== 'cut') { const pv = TL.items[si - 1]; withTransform(kind, p, false, () => SC[pv.scene](t - pv.start, pv.end - pv.start, pv)); }
  if (si > 0 && u < T_DUR && kind !== 'cut') withTransform(kind, p, true, () => SC[cur.scene](u, d, cur)); else SC[cur.scene](u, d, cur);
  g.restore();
  // субтитры
  let ci = -1; (TL.chunks || []).forEach((c, i) => { if (t >= c[0]) ci = i; });
  if (ci >= 0) { const c = TL.chunks[ci]; if (t < c[1]) softCaption(c[2], c[3], t - c[0]); }
  // шапка и прогресс
  g.font = '30px "Press Start 2P"'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,233,199,.8)'; g.fillText('EVILVERSE · evilverse.lol', W / 2, 110);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, W, 7); g.fillStyle = '#ff5a1f'; g.fillRect(0, 0, W * Math.min(1, t / TL.dur), 7);
  return null;
};
})();
