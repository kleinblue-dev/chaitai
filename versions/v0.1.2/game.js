/* 《拆台》v0.1 —— 一个不听话的动作游戏（原创切片）
   设计："会记账的旁白"＋打击感。全部程序化美术/音效，零外部素材。
   测试钩子契约 v2：window.__game = { version, state(), debug:{hurtPlayer,clearWave,setPlayerX,setPlatforms,setShadow,audioCount,telemetry,registry,reset} }
   v0.1.2 增量：分幕调色板＋预渲染背景／接触阴影／地面反射光／刀光拖尾／MusicSys 分层音乐(P0)／台箱单面平台／旁白音频叠播修复／fx 上限。 */
"use strict";
(function(){
var VER="0.1.2";
var W=960,H=540,GY=470,GRAV=1600,SPD=270,JUMPV=590,DASH_SPD=650;
var cv=document.getElementById("cv"), ctx=cv.getContext("2d");

/* ============ 工具 ============ */
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function now(){return performance.now();}

/* ============ 画布自适应 ============ */
function resize(){ var s=Math.min(innerWidth/W,innerHeight/H), dpr=Math.min(devicePixelRatio||1,2);
 cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
 cv.style.width=(W*s)+"px"; cv.style.height=(H*s)+"px";
 ctx.setTransform(dpr,0,0,dpr,0,0); BGC=null; BGKEY=""; }
addEventListener("resize",resize);

/* ============ 音频合成（Web Audio，零素材） ============ */
var AudioSys={ctx:null,master:null,muted:false,nbuf:null,
 init:function(){ if(this.ctx)return; try{ var AC=window.AudioContext||window.webkitAudioContext; this.ctx=new AC();
  this.master=this.ctx.createGain(); this.master.gain.value=0.35; this.master.connect(this.ctx.destination);}catch(e){} },
 resume:function(){ try{ if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume(); }catch(e){} },
 toggle:function(){ this.muted=!this.muted; if(this.master)this.master.gain.value=this.muted?0:0.35; },
 tone:function(f0,f1,dur,type,vol,delay){ if(!this.ctx||this.muted)return; var c=this.ctx,t0=c.currentTime+(delay||0),
  o=c.createOscillator(),g=c.createGain(); o.type=type||"sine";
  o.frequency.setValueAtTime(Math.max(20,f0),t0); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t0+dur);
  g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol),t0+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0+dur+0.05); },
 nbufGet:function(){ if(this.nbuf)return this.nbuf; var c=this.ctx,b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);
  for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1; this.nbuf=b; return b; },
 noise:function(dur,f0,f1,vol,delay,type){ if(!this.ctx||this.muted)return; var c=this.ctx,t0=c.currentTime+(delay||0);
  var s=c.createBufferSource(); s.buffer=this.nbufGet(); s.loop=true;
  var f=c.createBiquadFilter(); f.type=type||"bandpass"; f.Q.value=0.8;
  f.frequency.setValueAtTime(Math.max(30,f0),t0); f.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t0+dur);
  var g=c.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol),t0+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0+dur+0.05); },
 play:function(n){ if(!this.ctx||this.muted)return; switch(n){
  case "slash": this.noise(0.1,1700,300,0.35); this.tone(760,240,0.06,"triangle",0.06); break;
  case "hit1": this.tone(200,70,0.09,"square",0.2); this.noise(0.09,900,200,0.4); break;
  case "hit2": this.tone(190,60,0.1,"square",0.24); this.noise(0.1,800,180,0.45); break;
  case "hit3": this.tone(170,45,0.16,"sawtooth",0.26); this.noise(0.16,700,120,0.55); break;
  case "dash": this.noise(0.16,420,2400,0.3,0,"bandpass"); break;
  case "jump": this.tone(300,540,0.12,"triangle",0.14); break;
  case "land": this.noise(0.09,320,120,0.22); break;
  case "hurt": this.tone(240,70,0.22,"sawtooth",0.28); this.noise(0.1,600,150,0.35); break;
  case "death": this.tone(420,50,0.7,"sawtooth",0.26); break;
  case "wall": this.noise(1.0,90,55,0.5,0,"lowpass"); this.tone(62,40,0.9,"sine",0.18); break;
  case "perfect": this.tone(880,1760,0.18,"triangle",0.2); this.tone(1320,2640,0.22,"sine",0.1,0.06); this.noise(0.2,2000,5200,0.15); break;
  case "clear": this.tone(523,523,0.12,"triangle",0.18); this.tone(659,659,0.12,"triangle",0.18,0.12); this.tone(784,784,0.22,"triangle",0.2,0.24); break;
  case "deny": this.tone(160,120,0.12,"square",0.12); break;
  case "blip": this.tone(920,920,0.025,"square",0.025); break;
 }}};

/* ============ 分层音乐 MusicSys（v0.1.2 P0：L0 心跳＋L1 低音＋L3 和弦垫＋强度门控琶音/鼓） ============ */
var Music={ CHORDS:[[110,220,261.63,329.63],[87.31,174.61,220,261.63],[130.81,261.63,329.63,392],[98,196,246.94,329.63]],
 PENTA:[440,523.25,587.33,659.25,783.99], EIGHTH:60/72/2,
 ctx:null,bus:null,filt:null,timer:null,started:false,live:0,step:0,next:0,cur:0,
 start:function(){ if(this.started||!AudioSys.ctx)return; this.started=true; var c=this.ctx=AudioSys.ctx;
  this.bus=c.createGain(); this.bus.gain.value=0;
  this.filt=c.createBiquadFilter(); this.filt.type="lowpass"; this.filt.frequency.value=2200;
  this.bus.connect(this.filt); this.filt.connect(AudioSys.master);
  try{ this.bus.gain.setTargetAtTime(0.22,c.currentTime,0.8); }catch(e){}
  this.next=c.currentTime+0.25; var s=this;
  this.timer=setInterval(function(){ s.sched(); },100); },
 note:function(t,f,dur,type,vol,det,f1,atk){ if(!this.ctx||this.live>16||AudioSys.muted)return;
  var c=this.ctx,o=c.createOscillator(),g=c.createGain(); o.type=type;
  o.frequency.setValueAtTime(Math.max(20,f),t); if(f1)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  if(det)o.detune.value=det;
  var a=atk||0.01;
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol),t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(this.bus); o.start(t); o.stop(t+dur+0.05);
  this.live++; var s=this; o.onended=function(){ s.live=Math.max(0,s.live-1); }; },
 emit:function(t,st){ var s=st%16, ch=this.CHORDS[Math.floor(st/16)%4], I=this.cur;
  if(s%4===0)this.note(t,55,0.4,"sine",0.06,0,0,0.012);            /* L0 心跳常开 */
  if(s===0){ this.note(t,ch[1],6.5,"sawtooth",0.026,-7,0,1.2); this.note(t,ch[2],6.5,"sawtooth",0.026,7,0,1.2); this.note(t,ch[3],6.5,"sawtooth",0.022,0,0,1.2); } /* L3 和弦垫常开 */
  if(I>=0.15){ if(s===0)this.note(t,ch[0],6.4,"triangle",0.045,0,0,0.4);                  /* L1 低音 */
   if(s%2===0)this.note(t,this.PENTA[Math.floor(st/2)%5],0.22,"triangle",0.045,0,0,0.006); } /* L2 琶音 */
  if(I>=0.5){ if(s%4===0)this.note(t,150,0.12,"sine",0.22,0,45,0.005);                    /* L4 kick */
   if(s%2===1&&AudioSys.ctx&&!AudioSys.muted)AudioSys.noise(0.03,6000,6000,0.04,Math.max(0,t-AudioSys.ctx.currentTime),"highpass"); } },
 updIntensity:function(dt){ var t=0,chase=false;
  for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.hp>0&&e.state!=="patrol")chase=true; }
  if(chase&&world.phase==="playing")t=0.55;
  t+=Math.min(0.15*aliveEnemies(),0.3);
  if(world.wave===2)t+=0.05; if(player.combo>=3)t+=0.1;
  if(world.phase==="dead")t=Math.min(t,0.2);
  t=clamp(t,0,1); this.cur+=(t-this.cur)*Math.min(1,dt/1.5); },
 sched:function(){ try{ var c=this.ctx; if(!c)return; this.updIntensity(0.1);
  var t=c.currentTime; if(this.next<t-0.25)this.next=t+0.05;
  while(this.next<t+0.35){ this.emit(this.next,this.step); this.step++; this.next+=this.EIGHTH; } }catch(e){} },
 onRestart:function(){ this.cur=0; } };
document.addEventListener("visibilitychange",function(){ if(!Music.started)return;
 if(document.hidden){ if(Music.timer){clearInterval(Music.timer);Music.timer=null;} }
 else if(!Music.timer){ Music.next=Music.ctx.currentTime+0.2; var s=Music; Music.timer=setInterval(function(){ s.sched(); },100); } });

/* ============ 内置台词库（外部 assets/narrator-lines.js 存在时整体覆盖） ============ */
function fb(id,text){return {id:id,text:text};}
var FALLBACK_LINES={ meta:{version:1,persona:"自视甚高的导演，坚信自己在拍一部正经动作大片"}, lines:{
 game_start:{tiers:[[fb("gs_1","灯光就位，主角就位——开机！"),fb("gs_2","肃静！本片第一场，Action！"),fb("gs_3","欢迎来到我的作品。请严肃对待。")]]},
 first_move:{tiers:[[fb("fm_1","很好，主角动了。找到感觉了吗？"),fb("fm_2","对，就是这样走。我在看着。")]]},
 guide_right:{tiers:[[fb("gr_1_1","往右走，那里才是你的舞台。"),fb("gr_1_2","右边。戏在右边。")],[fb("gr_2_1","我说右边。你的右手边。"),fb("gr_2_2","再说一次：右。")]]},
 obey_enter:{tiers:[[fb("oe_1","很好，你入戏了。"),fb("oe_2","对嘛，听话的主角最好拍。")]]},
 wave1_start:{tiers:[[fb("w1s_1","第一波反派登场——把戏做足！"),fb("w1s_2","看，真正的对手来了。认真打。")]]},
 wave2_start:{tiers:[[fb("w2s_1","加码。这场戏的高潮来了！"),fb("w2s_2","第二波。我警告过你有难度的。")]]},
 combo_praise:{tiers:[[fb("cp_1_1","漂亮！这段我要放进预告片。"),fb("cp_1_2","三连击！有点主角的样子了。")],[fb("cp_2_1","你越打越顺了，我记下了。"),fb("cp_2_2","又来了——这镜头值钱。")]]},
 perfect_dodge:{tiers:[[fb("pd_1_1","一闪！这时机感，专业。"),fb("pd_1_2","完美闪避——剪辑师会爱死你。")],[fb("pd_2_1","……又一下。你是不是练过？"),fb("pd_2_2","我开始怀疑你是谁了，主角。")]]},
 player_hurt:{tiers:[[fb("ph_1_1","受伤了。没关系，戏就是这样。"),fb("ph_1_2","注意血条，我只有一条主角。")],[fb("ph_2_1","血不多了！撑住，别毁片！"),fb("ph_2_2","喂，剩这点血你还敢浪？")]]},
 whiff_spam:{tiers:[[fb("ws_1","你在砍什么？空气吗？"),fb("ws_2","这位主角，敌人在你前面。")]]},
 dash_spam:{tiers:[[fb("ds_1","你是在练跑步吗？"),fb("ds_2","镜头跟不上了，慢点。")]]},
 idle_in_combat:{tiers:[[fb("ic_1","……站着不动，是什么表演流派？"),fb("ic_2","喂，戏在打，你别睡了。")]]},
 player_death:{tiers:[[fb("pdd_1_1","卡！……没关系，主角再站起来一次。"),fb("pdd_1_2","死了？不慌。重拍一条。")],[fb("pdd_2_1","又死。胶片很贵的好吗。"),fb("pdd_2_2","同一个坑摔两次，主角。")],[fb("pdd_3_1","你这是在用生命拖进度。"),fb("pdd_3_2","行，我等你。全体休息。")]]},
 respawn:{tiers:[[fb("rs_1","再来。镜头就位。"),fb("rs_2","回位！从这条继续。")]]},
 defy_left:{tiers:[[fb("dl_1_1","走错了，舞台在右边。"),fb("dl_1_2","左是无意义的。回来。")],[fb("dl_2_1","你又往左边走。为什么？"),fb("dl_2_2","我看见了。往左——你故意的吧。")],[fb("dl_3_1","最后警告一次：回到右边去。"),fb("dl_3_2","我的耐心和胶片一样有限。")],[fb("dl_4_1","行。你自己选的。"),fb("dl_4_2","好，很好。这是你要的。")],[fb("dl_5_1","……我不管了。随便你。"),fb("dl_5_2","左边有什么好看的？什么都没有。")]]},
 wall_build:{tiers:[[fb("wb_1","——砌墙。你逼我的。"),fb("wb_2","门，封了。现在你没得选了。"),fb("wb_3","这才对嘛。往前走。")]]},
 wall_open:{tiers:[[fb("wo_1","……墙撤了。快去清场。"),fb("wo_2","门给你开了。别让我后悔。")]]},
 arena_cleared:{tiers:[[fb("ac_1_1","……收工。这段其实拍得不错。"),fb("ac_1_2","卡。清场，一条过。")],[fb("ac_2_1","不错。比剧本写的好。"),fb("ac_2_2","我收回前言。你有点东西。")]]},
 outro:{tiers:[[fb("ot_1","第一场，结束。剩下的戏，下次拍。"),fb("ot_2","这是个切片，预告你懂吗？下一集更大。"),fb("ot_3","今天就到这。下次别让我砌墙了。")]]},
 restart_done:{tiers:[[fb("rd_1_1","……我们见过吗？重来。"),fb("rd_1_2","新的一条。当刚才无事发生。")],[fb("rd_2_1","唉，又是你。行吧，开机。"),fb("rd_2_2","第二次了。希望这次听话点。")]]},
 idle_10s:{tiers:[[fb("i10_1","你在等什么？等我说开始吗？"),fb("i10_2","喂，还有呼吸吗？")]]},
 idle_30s:{tiers:[[fb("i30_1_1","挂着吧。我先喝口水。"),fb("i30_1_2","你不动，我不剪，耗着。")],[fb("i30_2_1","……你是挂机了吗？"),fb("i30_2_2","行，我也挂机。看谁先动。")],[fb("i30_3_1","我认输。你赢了。动一下好不好。")]]},
 air_swing_spam:{tiers:[[fb("as_1","剑法不错，可惜没有观众。"),fb("as_2","对着空气耍帅，这段我剪不掉。")]]}
}};

/* ============ 旁白系统（会记账） ============ */
var Narr={ data:null, audioMap:null, fc:{}, pick:{}, log:[], queue:[], cur:null, chars:0, hold:0, blipC:0,
 init:function(){
   var ext=window.NARRATOR_LINES;
   if(ext&&ext.lines&&Object.keys(ext.lines).length>0){ this.data=ext.lines; } else { this.data=FALLBACK_LINES.lines; }
   this.audioMap=(window.NARRATOR_AUDIO&&typeof window.NARRATOR_AUDIO==="object")?window.NARRATOR_AUDIO:{}; },
 fire:function(key){ this.log.push(key);
   var def=this.data[key]; if(!def||!def.tiers||!def.tiers.length)return;
   var tier=clamp(this.fc[key]||0,0,def.tiers.length-1); this.fc[key]=(this.fc[key]||0)+1;
   var arr=def.tiers[tier]; if(!arr.length)return;
   var pk=key+"_"+tier; var idx=(this.pick[pk]||0)%arr.length; this.pick[pk]=(this.pick[pk]||0)+1;
   if(this.cur&&this.cur.key===key){ this.stopCur(); this.cur=null; } for(var qi=this.queue.length-1;qi>=0;qi--){ if(this.queue[qi].key===key)this.queue.splice(qi,1); } var PRIO={wall_build:1,arena_cleared:1,wall_open:1,outro:1,player_death:1,perfect_dodge:1}; if(PRIO[key]){ if(this.cur&&!PRIO[this.cur.key]){ this.stopCur(); this.cur=null; } for(var qj=this.queue.length-1;qj>=0;qj--){ if(!PRIO[this.queue[qj].key])this.queue.splice(qj,1); } } this.queue.push({key:key,line:arr[idx]}); while(this.queue.length>2)this.queue.shift(); },
 update:function(rdt){ if(!this.cur){ if(!this.queue.length)return;
     this.cur=this.queue.shift(); this.chars=0; this.hold=0; this.blipC=0;
     var id=this.cur.line.id, src=this.audioMap[id];
     if(src){ try{ var a=new Audio(src); a.volume=0.9; a.play().catch(function(){}); this.cur.audio=a; }catch(e){} }
     return; }
   var txt=this.cur.line.text, cps=26;
   var prev=this.chars; this.chars=Math.min(txt.length,this.chars+cps*rdt);
   if(Math.floor(this.chars)>Math.floor(prev)){ this.blipC++; if(this.blipC%4===0)AudioSys.play("blip"); }
   if(this.chars>=txt.length){
     this.hold+=rdt;
     var adone=(!this.cur.audio)||this.cur.audio.ended||this.cur.audio.error;
     if(this.hold>(this.cur.audio?0.35:0.55)&&adone){ this.cur=null; }
   } },
 stopCur:function(){ if(this.cur&&this.cur.audio){ try{ this.cur.audio.pause(); this.cur.audio.currentTime=0; }catch(e){} } },
 reset:function(){ this.stopCur(); this.fc={}; this.pick={}; this.log=[]; this.queue=[]; this.cur=null; }
};

/* ============ 输入 ============ */
var key={}, just={};
var MOVE_L=["KeyA","ArrowLeft","tleft"], MOVE_R=["KeyD","ArrowRight","tright"],
 JUMPK=["Space","ArrowUp","KeyW","tjump"], ATKK=["KeyJ","KeyZ","tatk"], DASHK=["KeyK","KeyX","tdash"];
function anyDown(l){ for(var i=0;i<l.length;i++)if(key[l[i]])return true; return false; }
function justDown(l){ for(var i=0;i<l.length;i++)if(just[l[i]])return true; return false; }
function kbDown(c){ if(key[c])return; key[c]=1; just[c]=1; }
function kbUp(c){ key[c]=0; }
addEventListener("keydown",function(e){
 if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code)>=0)e.preventDefault();
 if(e.code==="KeyM"&&!e.repeat){ AudioSys.toggle(); return; }
 if(e.code==="KeyR"&&!e.repeat&&world.showRestart){ restart(); return; }
 if(world.phase==="title"&&!world.started)beginGame();
 kbDown(e.code); });
addEventListener("keyup",function(e){ kbUp(e.code); });
/* 触屏 */
var isTouch=(navigator.maxTouchPoints>0)||("ontouchstart" in window)||/[?&]touch=1/.test(location.search);
function bindBtn(id,code,custom){
 var el=document.getElementById(id); if(!el)return;
 var t0=0;
 function press(ev){ ev.preventDefault();
   if(custom){custom();return;}
   if(!key[code]){ key[code]=1; just[code]=1;
     if(world.phase==="title"&&!world.started)beginGame(); }
   t0=now(); try{if(el.setPointerCapture)el.setPointerCapture(ev.pointerId);}catch(_){} }
 function release(){ var dt=now()-t0; var done=function(){ key[code]=0; };
   if(dt>=120)done(); else setTimeout(done,120-dt); }
 el.addEventListener("pointerdown",press);
 el.addEventListener("pointerup",release); el.addEventListener("pointercancel",release);
 el.addEventListener("contextmenu",function(ev){ev.preventDefault();}); }
bindBtn("t-left","tleft"); bindBtn("t-right","tright"); bindBtn("t-jump","tjump");
bindBtn("t-atk","tatk"); bindBtn("t-dash","tdash");
bindBtn("t-restart","trestart",function(){ if(world.showRestart)restart(); });
cv.addEventListener("pointerdown",function(){ if(world.phase==="title"&&!world.started)beginGame(); });

/* ============ 特效 ============ */
var fx=[], ghosts=[], ghostT=0, bladeTrail=[];
/* SHADOW_ON：接触阴影总开关（测试钩子 debug.setShadow 用；X6 探针以同像素 ON/OFF 差值测阴影，背景/辉光天然对消） */
var SHADOW_ON=true;
function spawnBurst(x,y,n,color,spd,life,grav){ for(var i=0;i<n;i++){ var a=Math.random()*Math.PI*2,v=spd*(0.35+Math.random()*0.85);
  fx.push({k:"p",x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:life*(0.5+Math.random()*0.5),max:life,g:(grav==null?900:grav),size:2+Math.random()*3,color:color}); } }
function spawnRing(x,y,color,max){ fx.push({k:"ring",x:x,y:y,t:0,max:max||0.22,color:color}); }
function spawnSlashFx(x,y,facing,heavy){ fx.push({k:"slash",x:x,y:y,facing:facing,t:0,max:heavy?0.2:0.14,heavy:heavy}); }
function addTrauma(v){ world.trauma=Math.min(1,world.trauma+v); }
function updateFx(dt){ if(fx.length>260)fx.splice(0,fx.length-260);
 for(var i=fx.length-1;i>=0;i--){ var f=fx[i];
  if(f.k==="p"){ f.vy+=f.g*dt; f.x+=f.vx*dt; f.y+=f.vy*dt; f.life-=dt; if(f.life<=0)fx.splice(i,1); }
  else { f.t+=dt; if(f.t>=f.max)fx.splice(i,1); } }
 for(var j=ghosts.length-1;j>=0;j--){ ghosts[j].t+=dt; if(ghosts[j].t>0.28)ghosts.splice(j,1); }
 for(var bi=bladeTrail.length-1;bi>=0;bi--){ bladeTrail[bi].t+=dt; if(bladeTrail[bi].t>0.14)bladeTrail.splice(bi,1); } }
function drawFx(){ for(var i=0;i<fx.length;i++){ var f=fx[i];
  if(f.k==="p"){ var al=Math.max(0,f.life/f.max); ctx.globalAlpha=al; ctx.fillStyle=f.color;
   ctx.fillRect(f.x-f.size/2,f.y-f.size/2,f.size,f.size); ctx.globalAlpha=1; }
  else if(f.k==="ring"){ var p=f.t/f.max; ctx.globalAlpha=Math.max(0,1-p); ctx.strokeStyle=f.color; ctx.lineWidth=3;
   ctx.beginPath(); ctx.arc(f.x,f.y,8+70*p,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
  else if(f.k==="slash"){ var q=f.t/f.max; ctx.save(); ctx.globalCompositeOperation="lighter";
   ctx.globalAlpha=Math.max(0,1-q)*0.9; ctx.lineWidth=f.heavy?16:11; ctx.lineCap="round";
   var a0=-1.25+q*0.9, a1=-0.15+q*0.9;
   ctx.strokeStyle=f.heavy?"#ffd76a":"#aef6ff";
   ctx.beginPath(); ctx.arc(f.x,f.y,f.heavy?58:50,a0,a1,f.facing<0); ctx.stroke();
   ctx.globalAlpha*=0.55; ctx.lineWidth=f.heavy?6:4; ctx.strokeStyle="#ffffff";
   ctx.beginPath(); ctx.arc(f.x,f.y,f.heavy?58:50,a0,a1,f.facing<0); ctx.stroke();
   ctx.restore(); } } }

/* ============ 台箱平台（v0.1.2 机制骨架：单面顶碰撞，可站/可穿；v0.2 由各幕数据表填充，见 d2-levels T1/T2/T3） ============ */
var PLATFORMS=[];
function landSurface(x,fromY,toY){ var best=null;
 for(var i=0;i<PLATFORMS.length;i++){ var p=PLATFORMS[i];
  if(x>=p.x-8&&x<=p.x+p.w+8&&fromY<=p.y+0.6&&toY>=p.y){ if(best===null||p.y<best)best=p.y; } }
 if(best!==null)return best; return toY>=GY?GY:null; }
function groundUnder(x,y){ var g=GY;
 for(var i=0;i<PLATFORMS.length;i++){ var p=PLATFORMS[i];
  if(x>=p.x-8&&x<=p.x+p.w+8&&p.y>=y-1&&p.y<g)g=p.y; }
 return g; }

/* ============ 世界状态 ============ */
var wall={built:false,rising:false,opening:false,h:0,sideRight:true};
var player={x:190,y:GY,vx:0,vy:0,hp:100,maxHp:100,grounded:true,facing:1,
 dashT:0,dashCd:0,airDash:1,iframes:0,invuln:0,hurtT:0,combo:0,comboT:0,
 atk:null,walk:0,dead:false,deathT:0,airJumps:1,coyote:0,jumpBuf:0,atkBuf:0,
 hurtOnce:false,lowFired:false,stun:0,perfDodges:0};
var enemies=[], eid=1;
var world={phase:"title",started:false,wave:0,cleared:false,advancing:false,showRestart:false,
 t:0,hitstop:0,slowT:0,trauma:0,timers:[],deaths:0,
 wave1Started:false,lastGuide:0,lastInput:0,idleIdx:0,idleCombatFired:false,
 inZone:false,defyLeft:0,pendingWall:false,
 swingT:[],whiffT:[],dashT:[],jumpT:[],wallTouched:false,lastEnemyFired:false,cdJump:0};
function schedule(t,fn){ world.timers.push({t:t,fn:fn}); }

/* ============ 敌人工厂 ============ */
var EKIND={
 red:{hp:30,spd:118,windup:0.5,lunge:400,dmg:18,rec:0.55,color:"#ff4d6d",glow:"#ff8fa3"},
 purple:{hp:18,spd:178,windup:0.34,lunge:470,dmg:12,rec:0.44,color:"#b76bff",glow:"#d9b3ff"}};
function mkEnemy(kind,x){ var p=EKIND[kind]; return {id:eid++,kind:kind,x:x,y:GY,vx:0,hp:p.hp,maxHp:p.hp,
 state:"patrol",t:0,dir:-1,spd:p.spd,windup:p.windup,lunge:p.lunge,dmg:p.dmg,rec:p.rec,seed:Math.random()*6,flash:0,struck:false}; }
function aliveEnemies(){ var n=0; for(var i=0;i<enemies.length;i++)if(enemies[i].hp>0)n++; return n; }

/* ============ 玩家逻辑 ============ */
var ATK=[{wind:0.055,act:0.09,rec:0.15,dmg:8,kx:170,rng:78,hs:0.045,sh:0.16},
 {wind:0.055,act:0.09,rec:0.17,dmg:9,kx:190,rng:80,hs:0.05,sh:0.18},
 {wind:0.1,act:0.11,rec:0.3,dmg:15,kx:340,rng:88,hs:0.085,sh:0.5}];
function startAttack(step){ player.atk={step:step,t:0,phase:"wind",hit:{},swung:false}; AudioSys.play("slash"); }
function endSwing(a){ world.swingT.push(world.t); if(Object.keys(a.hit).length===0)world.whiffT.push(world.t); }
function updAttack(dt){ var P=player,a=P.atk; if(!a)return; var A=ATK[a.step-1]; a.t+=dt;
 var d0=A.wind,d1=A.wind+A.act,d2=d1+A.rec;
 if(a.t<d0){ a.phase="wind"; if(a.step===3){P.vx=P.facing*230;} }
 else if(a.t<d1){ a.phase="act";
  if(!a.swung){ a.swung=true; spawnSlashFx(P.x+P.facing*26,P.y-30,P.facing,a.step===3); }
  var hx=P.x+P.facing*(14+A.rng/2);
  for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.hp<=0||a.hit[e.id])continue;
   if(Math.abs(e.x-hx)<A.rng/2+16&&Math.abs((e.y-23)-(P.y-27))<48){ a.hit[e.id]=1;
    applyHit(e,A.dmg,P.facing,{kx:A.kx,hs:A.hs,sh:A.sh,step:a.step}); } } }
 else if(a.t<d2){ a.phase="rec"; }
 else { endSwing(a); P.atk=null; return; }
 if(P.dashT>0&&a.phase!=="wind"){ endSwing(a); P.atk=null; } }
function applyHit(e,dmg,dir,o){ e.hp-=dmg; e.state="hit"; e.t=0; e.vx=dir*(o.kx||180); e.flash=0.12; e.struck=true;
 world.hitstop=Math.min(0.12,Math.max(world.hitstop,o.hs||0.045)); addTrauma(o.sh||0.2);
 spawnBurst(e.x+e.vx*0.02,e.y-26,10,e.kind==="red"?"#ff5a78":"#c88bff",260,0.4);
 spawnRing(e.x,e.y-26,"#ffffff",0.16);
 AudioSys.play(o.step===3?"hit3":(o.step===2?"hit2":"hit1"));
 player.combo++; player.comboT=2.5; if(player.combo===3)Narr.fire("combo_praise");
 if(e.hp<=0){ e.hp=0; e.state="dead"; e.t=0; spawnBurst(e.x,e.y-24,22,e.kind==="red"?"#ff5a78":"#c88bff",340,0.7); } }
function startDash(){ var P=player; if(!P.grounded)P.airDash--; P.dashT=0.16; P.vx=P.facing*DASH_SPD; P.vy=0;
 P.iframes=Math.max(P.iframes,0.22); P.dashCd=0.32; AudioSys.play("dash");
 spawnBurst(P.x-P.facing*10,P.y-30,6,"#8fd6ff",160,0.3); ghostT=0;
 world.dashT.push(world.t); }
function damagePlayer(d,dir,force){ var P=player; if(world.phase!=="playing")return;
 if(!force&&(P.invuln>0||P.dashT>0))return;
 P.hp-=d; P.invuln=1.0; P.stun=0.18; P.vx=dir*260; P.vy=-140; P.hurtT=0.15;
 world.hitstop=Math.max(world.hitstop,0.05); addTrauma(0.32);
 AudioSys.play("hurt"); spawnBurst(P.x,P.y-30,12,"#ff6a86",300,0.45);
 if(!P.hurtOnce){ P.hurtOnce=true; Narr.fire("player_hurt"); }
 else if(!P.lowFired&&P.hp<=30){ P.lowFired=true; Narr.fire("player_hurt"); }
 if(P.hp<=0){ P.hp=0; P.dead=true; P.deathT=0; world.phase="dead"; world.deaths++;
  Narr.fire("player_death"); AudioSys.play("death"); spawnBurst(P.x,P.y-30,26,"#ff6a86",380,0.8);
  schedule(2.2,respawn); } }
function respawn(){ var P=player; P.hp=P.maxHp; P.x=190;P.y=GY;P.vx=0;P.vy=0;P.invuln=1.5;P.dead=false;P.deathT=0;
 P.combo=0;P.atk=null;P.dashT=0;
 world.hitstop=0; world.slowT=0;
 if(world.wave>0&&!world.cleared)respawnWave();
 world.phase="playing"; Narr.fire("respawn"); }
function updPlayer(dt){ var P=player;
 if(world.phase==="dead"){ P.deathT+=dt; if(!P.grounded){P.vy+=GRAV*dt;P.y+=P.vy*dt;if(P.y>=GY){P.y=GY;P.grounded=true;}} return; }
 P.dashCd=Math.max(0,P.dashCd-dt); P.iframes=Math.max(0,P.iframes-dt); P.invuln=Math.max(0,P.invuln-dt);
 P.hurtT=Math.max(0,P.hurtT-dt); P.stun=Math.max(0,P.stun-dt);
 if(P.comboT>0){P.comboT-=dt; if(P.comboT<=0)P.combo=0;}
 var mv=0; if(anyDown(MOVE_L))mv-=1; if(anyDown(MOVE_R))mv+=1;
 if(mv!==0)P.facing=mv;
 if(justDown(JUMPK))P.jumpBuf=0.12; P.jumpBuf=Math.max(0,P.jumpBuf-dt);
 if(justDown(ATKK))P.atkBuf=0.14; P.atkBuf=Math.max(0,P.atkBuf-dt);
 if(justDown(DASHK)&&P.dashCd<=0&&P.dashT<=0&&(P.grounded||P.airDash>0)&&!(P.atk&&P.atk.phase==="wind"))
  startDash();
 if(P.atkBuf>0&&P.dashT<=0){ if(!P.atk){ startAttack(1); P.atkBuf=0; }
  else if(P.atk.phase==="rec"&&P.atk.step<3){ startAttack(P.atk.step+1); P.atkBuf=0; } }
 var dashing=P.dashT>0;
 if(dashing){ P.dashT-=dt; P.vx=P.facing*DASH_SPD; P.vy=0;
  ghostT-=dt; if(ghostT<=0){ ghosts.push({x:P.x,y:P.y,facing:P.facing,t:0}); ghostT=0.028; }
  if(P.dashT<=0)P.vx*=0.3; }
 else if(P.stun>0){ P.vx*=Math.pow(0.01,dt); }
 else if(mv!==0){ P.vx=mv*SPD; P.walk+=dt*9; }
 else { P.vx*=Math.pow(0.0001,dt); if(Math.abs(P.vx)<8)P.vx=0; }
 if(!dashing){
  if(P.grounded)P.coyote=0.09; else P.coyote=Math.max(0,P.coyote-dt);
  if(P.jumpBuf>0){ if(P.grounded||P.coyote>0){ P.vy=-JUMPV; P.grounded=false; P.coyote=0; P.jumpBuf=0; P.airJumps=1;
    AudioSys.play("jump"); world.jumpT.push(world.t); spawnBurst(P.x,GY,6,"#9fd8ff",120,0.3); }
   else if(P.airJumps>0){ P.airJumps--; P.vy=-JUMPV*0.92; P.jumpBuf=0; AudioSys.play("jump"); world.jumpT.push(world.t); spawnRing(P.x,P.y-24,"#7df9ff",0.2); } }
  if(!anyDown(JUMPK)&&P.vy<-170)P.vy=-170;
  P.vy+=GRAV*dt; if(P.vy>1000)P.vy=1000; }
 else P.vy=0;
 P.x=clamp(P.x+P.vx*dt,24,W-26);
 var prevY=P.y; P.y+=P.vy*dt;
 var landY=(P.vy>=0)?landSurface(P.x,prevY,P.y):null;
 if(landY!==null){ if(!P.grounded){ AudioSys.play("land"); if(P.vy>480)addTrauma(0.05); spawnBurst(P.x,landY,4,"#8b9db8",90,0.25); }
  var landNow=!P.grounded; P.y=landY;P.vy=0;P.grounded=true; if(landNow&&P.dashT>0)P.dashT=0; } else P.grounded=false;
 if(P.grounded)P.airDash=1;
 if(P.atk)updAttack(dt);
 if(wall.h>50){ var hitW=false; if(wall.sideRight){ if(P.x<166){P.x=166;hitW=true;} } else { if(P.x>134){P.x=134;hitW=true;} }
  if(hitW&&!world.wallTouched){ world.wallTouched=true; Narr.fire("wall_touch"); } } }

/* ============ 敌人逻辑 ============ */
function updEnemy(e,dt){ var P=player;
 var dx=P.x-e.x, adx=Math.abs(dx);
 e.flash=Math.max(0,e.flash-dt);
 switch(e.state){
  case "patrol": if(world.phase==="playing"&&adx<430)e.state="chase"; else e.x+=Math.sin(world.t*0.7+e.seed)*30*dt; break;
  case "chase": e.dir=dx>0?1:-1; e.x+=e.dir*e.spd*dt;
   if(world.phase!=="playing"||adx>430){ e.state="patrol"; }
   else if(adx<58){ e.state="wind"; e.t=0; } break;
  case "wind": e.t+=dt; e.dir=dx>0?1:-1; if(e.t>=e.windup){ e.state="strike"; e.t=0; e.struck=false; e.vx=e.dir*e.lunge; } break;
  case "strike": e.t+=dt; e.x+=e.vx*dt; e.vx*=Math.pow(0.02,dt);
   if(!e.struck&&world.phase==="playing"){
    if(Math.abs(P.x-(e.x+e.dir*26))<36&&Math.abs((P.y-27)-(e.y-23))<48){ e.struck=true;
     if(P.dashT>0&&P.iframes>0)perfectDodge(e); else damagePlayer(e.dmg,e.dir); } }
   if(e.t>=0.2){ e.state="rec"; e.t=0; } break;
  case "rec": e.t+=dt; e.vx*=Math.pow(0.01,dt); if(e.t>=e.rec)e.state="chase"; break;
  case "hit": e.t+=dt; e.x+=e.vx*dt; e.vx*=Math.pow(0.001,dt); if(e.t>=0.18)e.state="chase"; break;
 }
 e.x=clamp(e.x,24,W-24); }
function updEnemies(dt){ for(var i=enemies.length-1;i>=0;i--){ var e=enemies[i];
 if(e.hp<=0){ e.t+=dt; if(e.t>0.6)enemies.splice(i,1); continue; } updEnemy(e,dt); } }
function perfectDodge(e){ var P=player; P.facing=e.x>P.x?1:-1;
 world.slowT=0.5; P.iframes=0.6; P.invuln=0.6; P.perfDodges++;
 AudioSys.play("perfect"); spawnRing(P.x,P.y-28,"#aef6ff",0.4); spawnBurst(e.x,e.y-26,16,"#aef6ff",380,0.5);
 applyHit(e,26,P.facing,{kx:380,hs:0.09,sh:0.6,step:3}); Narr.fire("perfect_dodge"); }

/* ============ 墙 ============ */
function updWall(dt){ if(wall.rising){ wall.h+=420*dt;
  if(Math.random()<0.5)spawnBurst(150,GY,2,"#ffd76a",140,0.5);
  if(wall.h>=300){ wall.h=300; wall.rising=false; wall.built=true; } }
 if(wall.opening){ wall.h-=520*dt; if(wall.h<=0){ wall.h=0; wall.opening=false; wall.built=false; } } }
function openWall(){ if(wall.built&&!wall.opening){ wall.opening=true; Narr.fire("wall_open"); } }

/* ============ 世界流程 ============ */
var WAVES={1:[["red",800],["red",880]],2:[["red",740],["purple",830],["purple",900]]};
function spawnWave(n,silent){ if(!silent)Narr.fire("wave"+n+"_start"); world.wave=n; world.idleCombatFired=false; world.lastEnemyFired=false;
 var list=WAVES[n]; for(var i=0;i<list.length;i++){ var ex=list[i][1]; if(n===2&&player.x>480){ var b=player.x+270; if(b+180>934)b=player.x-450; ex=Math.max(60,b+90*i); } enemies.push(mkEnemy(list[i][0],ex)); } }
function respawnWave(){ enemies.length=0; spawnWave(world.wave,true); }
function updWorld(dt,rdt){ world.t+=rdt;
 for(var i=world.timers.length-1;i>=0;i--){ var tm=world.timers[i]; tm.t-=dt; if(tm.t<=0){ world.timers.splice(i,1); tm.fn(); } }
 if(just["KeyA"]||just["KeyD"]||just["Space"]||just["KeyJ"]||just["KeyK"]||just["ArrowLeft"]||just["ArrowRight"]||just["ArrowUp"]||just["KeyW"]||just["KeyZ"]||just["KeyX"]||just["tleft"]||just["tright"]||just["tjump"]||just["tatk"]||just["tdash"]){ world.lastInput=world.t; world.idleIdx=0; }
 if(world.phase!=="playing")return;
 if(!world.wave1Started&&player.x>420){ world.wave1Started=true; Narr.fire("obey_enter"); if(world.defyLeft>=2)Narr.fire("return_obedient"); spawnWave(1,false); }
 if(!world.wave1Started&&world.t>7&&(world.lastGuide===0||world.t-world.lastGuide>12)){ world.lastGuide=world.t; Narr.fire("guide_right"); }
 if(!world.firstMoveFired&&Math.abs(player.vx)>40){ world.firstMoveFired=true; Narr.fire("first_move"); }
 if(world.wave>0&&!world.cleared&&aliveEnemies()===1&&!world.lastEnemyFired){ world.lastEnemyFired=true; Narr.fire("last_enemy"); }
 if(world.wave>0&&!world.cleared&&!world.advancing&&aliveEnemies()===0){
  world.advancing=true;
  if(world.wave===1)schedule(1.2,function(){ world.advancing=false; spawnWave(2,false); });
  else if(world.wave===2)schedule(0.7,function(){ world.cleared=true; Narr.fire("arena_cleared"); AudioSys.play("clear");
    if(wall.built)openWall();
    schedule(2.2,function(){ Narr.fire("outro"); world.showRestart=true;
      var tr=document.getElementById("t-restart"); if(tr)tr.classList.add("on"); }); }); }
 if(!wall.built&&!wall.rising){
  if(player.x<120)world.inZone=true;
  else if(world.inZone&&player.x>170){ world.inZone=false; world.defyLeft++; Narr.fire("defy_left");
   if(world.defyLeft>=4)world.pendingWall=true; }
  if(world.pendingWall&&player.x>220){ world.pendingWall=false; wall.rising=true; wall.h=0.01; wall.sideRight=player.x>150;
   Narr.fire("wall_build"); AudioSys.play("wall"); } }
 var idle=world.t-world.lastInput;
 if(world.wave>0&&aliveEnemies()>0){ if(idle>6&&!world.idleCombatFired){ world.idleCombatFired=true; Narr.fire("idle_in_combat"); } }
 else { var steps=[10,30,60,90,120];
  while(world.idleIdx<steps.length&&idle>steps[world.idleIdx]){ var k=world.idleIdx++; Narr.fire(k===0?"idle_10s":"idle_30s"); } }
 /* 挥空/冲刺刷屏 */
 if(world.swingT.length){ for(var s=world.swingT.length-1;s>=0;s--)if(world.t-world.swingT[s]>5)world.swingT.splice(s,1); }
 if(world.whiffT.length){ for(var s2=world.whiffT.length-1;s2>=0;s2--)if(world.t-world.whiffT[s2]>4)world.whiffT.splice(s2,1); }
 if(world.dashT.length){ for(var s3=world.dashT.length-1;s3>=0;s3--)if(world.t-world.dashT[s3]>3)world.dashT.splice(s3,1); }
 if(world.jumpT.length){ for(var s4=world.jumpT.length-1;s4>=0;s4--)if(world.t-world.jumpT[s4]>4)world.jumpT.splice(s4,1); }
 world.cdWhiff=Math.max(0,(world.cdWhiff||0)-dt); world.cdAir=Math.max(0,(world.cdAir||0)-dt); world.cdDash=Math.max(0,(world.cdDash||0)-dt);
 world.cdJump=Math.max(0,(world.cdJump||0)-dt);
 if(world.whiffT.length>=4&&!world.cdWhiff){ world.cdWhiff=6; Narr.fire("whiff_spam"); }
 if(world.swingT.length>=7&&!world.cdAir){ world.cdAir=8; Narr.fire("air_swing_spam"); }
 if(world.dashT.length>=5&&!world.cdDash){ world.cdDash=5; Narr.fire("dash_spam"); }
 if(world.jumpT.length>=5&&!world.cdJump){ world.cdJump=6; Narr.fire("jump_spam"); } }

/* ============ 开始/重开/复位 ============ */
function resetWorld(){ player.x=190;player.y=GY;player.vx=0;player.vy=0;player.hp=player.maxHp;player.dead=false;
 player.deathT=0;player.atk=null;player.combo=0;player.invuln=0.5;player.dashT=0;player.dashCd=0;
 player.hurtOnce=false;player.lowFired=false;player.perfDodges=0;player.stun=0;
 enemies.length=0; ghosts.length=0; bladeTrail.length=0;
 wall.built=false;wall.rising=false;wall.opening=false;wall.h=0;wall.sideRight=true;
 world.wave=0;world.cleared=false;world.advancing=false;world.showRestart=false;world.t=0;
 world.hitstop=0;world.slowT=0;world.trauma=0;world.timers.length=0;
 world.wave1Started=false;world.firstMoveFired=false;world.lastGuide=0;world.lastInput=0;world.idleIdx=0;world.idleCombatFired=false;
 world.inZone=false;world.defyLeft=0;world.pendingWall=false;
 world.swingT=[];world.whiffT=[];world.dashT=[];world.jumpT=[];world.cdWhiff=0;world.cdAir=0;world.cdDash=0;world.cdJump=0;
 world.wallTouched=false;world.lastEnemyFired=false;
 var tr=document.getElementById("t-restart"); if(tr)tr.classList.remove("on"); }
function beginGame(){ world.started=true; world.phase="playing"; resetWorld();
 AudioSys.init(); AudioSys.resume(); Music.start();
 schedule(0.5,function(){ Narr.fire("game_start"); }); }
function restart(){ resetWorld(); world.phase="playing"; Narr.stopCur(); Narr.queue.length=0; Narr.cur=null; Music.onRestart(); Narr.fire("restart_done"); }
function hardReset(){ Narr.reset(); Music.onRestart(); world.deaths=0; world.phase=world.started?"playing":"title"; if(world.started)resetWorld();
 else { resetWorld(); world.phase="title"; } }

/* ============ 主循环 ============ */
var last=now(), acc=0, STEP=1/60, frameTimes=[], frameTotal=0;
function step(dt){
 world.trauma=Math.max(0,world.trauma-0.6*dt); if(world.hitstop>0){ world.hitstop-=dt; if(!world.started){} }
 else { var sdt=dt;
  if(world.slowT>0){ world.slowT-=dt; sdt=dt*0.3; }
  if(world.phase!=="title"){ updWorld(sdt,dt); updPlayer(sdt); updEnemies(sdt); updWall(sdt); }
  updateFx(sdt); }
 just={}; }
function frame(ts){ requestAnimationFrame(frame);
 var rdt=(ts-last)/1000; last=ts; if(rdt>0.1)rdt=0.1;
 frameTimes.push(rdt); frameTotal++; if(frameTimes.length>600)frameTimes.shift();
 if(world.phase!=="title")Narr.update(rdt);
 acc+=rdt; var guard=0; while(acc>=STEP&&guard++<5){ step(STEP); acc-=STEP; }
 render(ts/1000); }

/* ============ 渲染 ============ */
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
 ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
/* ============ 背景：分幕调色板＋预渲染（v0.1.2 P0-1） ============ */
/* 铁律：四套调色板 moon 一律 #16203a——verify-v011 以该色像素质心为判据，改了它=弄瞎旧探针 */
var PALETTES={
 title:{sky0:"#070b14",sky1:"#0e1524",bld:"#0a0f1c",win:"#ffd76a22",floor:"#090e18",neon:"#7df9ff",moon:"#16203a"},
 act1:{sky0:"#0a0f1c",sky1:"#131b2e",bld:"#0c1322",win:"#9fb2d81e",floor:"#0b101d",neon:"#7df9ff",moon:"#16203a"},
 act2:{sky0:"#150a20",sky1:"#271233",bld:"#1a0d28",win:"#c88bff26",floor:"#130a1c",neon:"#ff6ad5",moon:"#16203a"},
 clear:{sky0:"#1a1208",sky1:"#2d2110",bld:"#221808",win:"#ffd76a2e",floor:"#171004",neon:"#ffd76a",moon:"#16203a"} };
function palKey(){ if(world.phase==="title")return "title"; if(world.cleared)return "clear"; if(world.wave===2)return "act2"; return "act1"; }
var BGC=null, BGKEY="";
function makeBG(key){ var p=PALETTES[key], dpr=Math.min(devicePixelRatio||1,2);
 var c=document.createElement("canvas"); c.width=Math.round(W*dpr); c.height=Math.round(H*dpr);
 var g=c.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0);
 var lg=g.createLinearGradient(0,0,0,H); lg.addColorStop(0,p.sky0); lg.addColorStop(1,p.sky1);
 g.fillStyle=lg; g.fillRect(0,0,W,H);
 for(var i=0;i<9;i++){ var bw=60+((i*37)%50), bx=(i*118+((i*53)%40))%W, top=250+((i*29)%90);
  g.fillStyle=p.bld; g.fillRect(bx,top,bw,GY-top);
  g.fillStyle=p.win;
  for(var wy=top+14;wy<GY-16;wy+=22){ for(var wx=bx+8;wx<bx+bw-10;wx+=18){ if((wx*7+wy*13)%5<2)g.fillRect(wx,wy,6,9); } } }
 g.fillStyle=p.moon; g.beginPath(); g.arc(750,120,58,0,Math.PI*2); g.fill();
 g.fillStyle=p.floor; g.fillRect(0,GY,W,H-GY);
 var nl=g.createLinearGradient(0,0,W,0); nl.addColorStop(0,"#00000000"); nl.addColorStop(0.5,p.neon+"44"); nl.addColorStop(1,"#00000000");
 g.fillStyle=nl; g.fillRect(0,GY-2,W,2);
 return c; }
function drawBG(){ var key=palKey(); if(!BGC||BGKEY!==key){ BGC=makeBG(key); BGKEY=key; }
 ctx.drawImage(BGC,0,0,W,H); }
/* ============ 台箱/接触阴影/地面反射/刀光拖尾（v0.1.2 P0-2/3/4） ============ */
function drawPlatforms(){ for(var i=0;i<PLATFORMS.length;i++){ var p=PLATFORMS[i];
 ctx.save(); ctx.fillStyle="#141a2c"; ctx.strokeStyle="#7df9ff66"; ctx.lineWidth=2;
 ctx.fillRect(p.x,p.y,p.w,p.h); ctx.strokeRect(p.x,p.y,p.w,p.h);
 ctx.fillStyle="#7df9ff33"; ctx.fillRect(p.x,p.y,p.w,2); ctx.restore(); } }
function drawShadow(x,by,y,wd){ var k=clamp(1-(by-y)/260,0.15,1);
 ctx.save(); ctx.globalAlpha=0.35*k; ctx.fillStyle="#000";
 ctx.beginPath(); ctx.ellipse(x,by-3,wd*k+6,7*k,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
var reflCache={};
function reflSprite(color){ if(reflCache[color])return reflCache[color];
 var c=document.createElement("canvas"); c.width=32;c.height=96; var g=c.getContext("2d");
 var lg=g.createLinearGradient(0,0,0,96); lg.addColorStop(0,color+"aa"); lg.addColorStop(0.55,color+"33"); lg.addColorStop(1,color+"00");
 g.fillStyle=lg; g.fillRect(0,0,32,96); reflCache[color]=c; return c; }
function drawRefl(x,by,y,color,w){ var k=clamp(1-(by-y)/260,0,1); if(k<=0.02)return;
 ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.32*k;
 ctx.drawImage(reflSprite(color),x-w/2,by+2,w,44); ctx.restore(); }
function pushBlade(x,y){ bladeTrail.push({x:x,y:y,t:0}); if(bladeTrail.length>8)bladeTrail.shift(); }
function drawBladeTrail(){ if(bladeTrail.length<2)return;
 ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.lineCap="round";
 for(var i=1;i<bladeTrail.length;i++){ var a=bladeTrail[i-1],b=bladeTrail[i];
  ctx.globalAlpha=Math.max(0,1-b.t/0.14)*0.5; ctx.lineWidth=1+11*(i/bladeTrail.length);
  ctx.strokeStyle="#aef6ff"; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
 ctx.restore(); }
function drawGuide(){ if(world.wave1Started||world.phase==="title")return;
 var pulse=0.5+0.5*Math.sin(world.t*4);
 ctx.save(); ctx.globalAlpha=0.35+0.35*pulse; ctx.strokeStyle="#ffd76a"; ctx.lineWidth=4; ctx.lineCap="round";
 for(var i=0;i<2;i++){ var x=500+i*34+Math.sin(world.t*3+i)*6, y=300;
  ctx.beginPath(); ctx.moveTo(x-10,y-13); ctx.lineTo(x+8,y); ctx.lineTo(x-10,y+13); ctx.stroke(); }
 ctx.restore(); }
function drawWall(){ if(wall.h<=0)return;
 ctx.save(); ctx.fillStyle="#1a2033"; ctx.strokeStyle="#ffd76a99"; ctx.lineWidth=2;
 ctx.fillRect(137,GY-wall.h,26,wall.h); ctx.strokeRect(137,GY-wall.h,26,wall.h);
 ctx.strokeStyle="#ffd76a55"; ctx.lineWidth=1;
 for(var y=GY-wall.h+24;y<GY;y+=26){ ctx.beginPath(); ctx.moveTo(137,y); ctx.lineTo(163,y); ctx.stroke(); }
 ctx.restore(); }
function drawPlayer(){ var P=player; if(P.dead&&P.deathT>1.5)return;
 var blink=(P.invuln>0&&!P.dead)&&(Math.floor(P.invuln*20)%2===0);
 ctx.save(); ctx.globalAlpha=blink?0.45:1;
 var gcol=P.hurtT>0?"#ff6a86":"#7df9ff";
 /* 残影 */
 for(var gi=0;gi<ghosts.length;gi++){ var gh=ghosts[gi];
  ctx.globalAlpha=(1-gh.t/0.28)*0.22*(blink?0.5:1);
  ctx.save(); ctx.translate(gh.x,gh.y); ctx.scale(gh.facing,1);
  ctx.strokeStyle="#7df9ff"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,-46); ctx.lineTo(0,-4); ctx.stroke();
  ctx.restore(); }
 ctx.globalAlpha=blink?0.45:1;
 ctx.translate(P.x,P.y); if(P.dead)ctx.globalAlpha=Math.max(0,1-P.deathT/1.5); ctx.scale(P.facing,1);
 if(P.dead){ ctx.rotate(-1.2); }
 var air=!P.grounded, wp=P.walk;
 ctx.shadowColor=gcol; ctx.shadowBlur=12; ctx.strokeStyle=gcol; ctx.lineWidth=2;
 /* 腿 */
 var l1=air?-0.5:Math.sin(wp)*0.7, l2=air?0.4:Math.sin(wp+Math.PI)*0.7;
 ctx.beginPath(); ctx.moveTo(0,-26); ctx.lineTo(l1*12,0); ctx.stroke();
 ctx.beginPath(); ctx.moveTo(0,-26); ctx.lineTo(l2*12,0); ctx.stroke();
 /* 躯干 */
 ctx.lineWidth=10; ctx.lineCap="round"; ctx.strokeStyle="#0e1726";
 ctx.beginPath(); ctx.moveTo(0,-24); ctx.lineTo(0,-44); ctx.stroke();
 ctx.lineWidth=2; ctx.strokeStyle=gcol;
 ctx.beginPath(); ctx.moveTo(0,-44); ctx.lineTo(0,-24); ctx.stroke();
 /* 头 */
 ctx.fillStyle="#0e1726"; ctx.beginPath(); ctx.arc(2,-52,9,0,Math.PI*2); ctx.fill(); ctx.stroke();
 ctx.fillStyle=gcol; ctx.fillRect(4,-55,8,2);
 /* 持刀手 */
 var swing=2.55;
 if(P.atk){ var A=ATK[P.atk.step-1], tt=P.atk.t, d0=A.wind,d1=A.wind+A.act;
  if(tt<d0)swing=2.55-(tt/d0)*1.4; else if(tt<d1)swing=1.15+(tt-d0)/A.act*1.5; else swing=2.65; }
 var hx=Math.cos(swing)*16, hy=-36+Math.sin(swing)*14;
 ctx.strokeStyle="#0e1726"; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(0,-38); ctx.lineTo(hx,hy); ctx.stroke();
 var bx=hx+Math.cos(swing)*30, by=hy+Math.sin(swing)*30;
 ctx.lineWidth=3; ctx.strokeStyle="#aef6ff"; ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(bx,by); ctx.stroke();
 ctx.lineWidth=1; ctx.strokeStyle="#ffffff"; ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(bx,by); ctx.stroke();
 if(P.atk&&P.atk.phase==="act")pushBlade(P.x+bx*P.facing,P.y+by);
 ctx.restore(); }
function drawEnemies(){ for(var i=0;i<enemies.length;i++){ var e=enemies[i]; var p=EKIND[e.kind];
 ctx.save(); ctx.translate(e.x,e.y);
 if(e.hp<=0){ ctx.globalAlpha=Math.max(0,1-e.t/0.6); ctx.scale(1, Math.max(0.3,1-e.t)); }
 else if(e.state==="wind"){ var wq=e.t/e.windup; ctx.rotate(-0.16*wq); ctx.translate(Math.sin(e.t*60)*wq*2,0); }
 else if(e.state==="strike"){ ctx.rotate(0.22); ctx.scale(1.18,1); }
 var col=e.flash>0?"#ffffff":p.color;
 ctx.shadowColor=col; ctx.shadowBlur=14; ctx.strokeStyle=col; ctx.lineWidth=2; ctx.fillStyle="#141019";
 ctx.beginPath(); ctx.ellipse(0,-24,19,27,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
 var eR=6+(e.state==="wind"?4*(e.t/e.windup):0);
 ctx.fillStyle=(e.state==="wind")?"#ffffff":"#ffd9e2"; ctx.beginPath(); ctx.arc(e.dir*7,-38,eR,0,Math.PI*2); ctx.fill();
 if(e.hp>0&&e.hp<e.maxHp){ ctx.shadowBlur=0; ctx.fillStyle="#ffffff22"; ctx.fillRect(-20,-60,40,4);
  ctx.fillStyle=p.glow; ctx.fillRect(-20,-60,40*(e.hp/e.maxHp),4); }
 ctx.restore(); } }
function drawHUD(){ var P=player;
 ctx.save(); ctx.font="14px 'Segoe UI','Microsoft YaHei',sans-serif";
 ctx.fillStyle="#9fb2d8"; ctx.fillText("体力",20,30);
 ctx.fillStyle="#ffffff18"; roundRect(62,18,220,16,8); ctx.fill();
 var hpr=P.hp/P.maxHp, low=hpr<0.35&&hpr>0;
 ctx.fillStyle=low?(Math.floor(world.t*6)%2?"#ff4d6d":"#ff8fa3"):"#7df9ff";
 if(hpr>0){ roundRect(62,18,Math.max(8,220*hpr),16,8); ctx.fill(); }
 if(world.cleared){ ctx.fillStyle="#ffd76a"; ctx.font="16px 'Microsoft YaHei',sans-serif"; ctx.textAlign="right";
  ctx.fillText("完 · 一条过",W-20,30); }
 else if(world.wave===1){ ctx.fillStyle="#ffd76a"; ctx.font="16px 'Microsoft YaHei',sans-serif"; ctx.textAlign="right";
  ctx.fillText("第一幕 · 对峙",W-20,30); }
 else if(world.wave===2){ ctx.fillStyle="#ffd76a"; ctx.font="16px 'Microsoft YaHei',sans-serif"; ctx.textAlign="right";
  ctx.fillText("第二幕 · 加码",W-20,30); }
 ctx.textAlign="left";
 if(P.combo>=2){ var al=Math.min(1,P.comboT); ctx.globalAlpha=al; ctx.fillStyle="#ffd76a";
  ctx.font="bold 20px 'Microsoft YaHei',sans-serif"; ctx.textAlign="center";
  ctx.fillText(P.combo+" 连击",P.x,P.y-96); ctx.globalAlpha=1; ctx.textAlign="left"; }
 ctx.fillStyle="#5c6b8a"; ctx.font="12px 'Microsoft YaHei',sans-serif";
 ctx.fillText("A/D 移动 · 空格 跳 · J 攻击 · K 冲刺 · M 静音",20,H-14);
 ctx.textAlign="right"; ctx.fillText("拆台 v"+VER+" · 原创切片",W-20,H-14); ctx.textAlign="left";
 if(AudioSys.muted){ ctx.fillStyle="#ffd76a88"; ctx.fillText("已静音",20,52); }
 ctx.restore(); }
function drawNarrator(){ var c=Narr.cur; if(!c)return;
 var tw=Math.min(760,W-120), tx=(W-tw)/2, ty=H-96;
 ctx.save();
 ctx.fillStyle="rgba(8,10,18,0.8)"; ctx.strokeStyle="rgba(255,215,106,0.4)"; ctx.lineWidth=1;
 roundRect(tx,ty,tw,58,10); ctx.fill(); ctx.stroke();
 ctx.fillStyle="#ffd76a"; roundRect(tx+10,ty+9,48,20,5); ctx.fill();
 ctx.fillStyle="#141108"; ctx.font="bold 13px 'Microsoft YaHei',sans-serif"; ctx.textAlign="center";
 ctx.fillText("导演",tx+34,ty+23);
 ctx.textAlign="left"; ctx.fillStyle="#f2f6ff"; ctx.font="19px 'Microsoft YaHei',sans-serif";
 ctx.fillText(c.line.text.slice(0,Math.floor(Narr.chars)),tx+72,ty+36);
 ctx.restore(); }
function drawOverlays(){ var t=world.t;
 if(world.phase==="title"){ ctx.save(); ctx.fillStyle="rgba(5,7,13,0.66)"; ctx.fillRect(0,0,W,H);
  ctx.textAlign="center"; ctx.shadowColor="#ffd76a"; ctx.shadowBlur=26;
  ctx.fillStyle="#ffd76a"; ctx.font="bold 84px 'Microsoft YaHei',sans-serif"; ctx.fillText("拆 台",W/2,230);
  ctx.shadowBlur=0; ctx.fillStyle="#9fb2d8"; ctx.font="20px 'Microsoft YaHei',sans-serif";
  ctx.fillText("—— 一个不听话的动作游戏 ——",W/2,280);
  var al=0.55+0.45*Math.sin(now()/400);
  ctx.globalAlpha=al; ctx.fillStyle="#e8eefc"; ctx.font="22px 'Microsoft YaHei',sans-serif";
  ctx.fillText("按任意键开始（手机点屏幕）",W/2,368); ctx.globalAlpha=1;
  ctx.fillStyle="#5c6b8a"; ctx.font="13px 'Microsoft YaHei',sans-serif";
  ctx.fillText("原创切片 · 全部素材程序生成 · 2026-10-13",W/2,H-40); ctx.restore(); }
 if(world.phase==="dead"){ ctx.save(); ctx.fillStyle="rgba(20,0,8,0.35)"; ctx.fillRect(0,0,W,H);
  ctx.textAlign="center"; ctx.fillStyle="#ff8fa3"; ctx.font="bold 34px 'Microsoft YaHei',sans-serif";
  ctx.fillText("你倒下了",W/2,H/2-16);
  ctx.fillStyle="#9fb2d8"; ctx.font="16px 'Microsoft YaHei',sans-serif";
  ctx.fillText("导演正在重拍……",W/2,H/2+20); ctx.restore(); }
 if(world.showRestart&&world.phase==="playing"){ ctx.save(); ctx.textAlign="center";
  var al2=0.6+0.4*Math.sin(now()/350); ctx.globalAlpha=al2;
  ctx.fillStyle="#ffd76a"; ctx.font="20px 'Microsoft YaHei',sans-serif";
  ctx.fillText("按 R 再来一次（手机点右下角 ⟳）",W/2,132); ctx.restore(); } }
function render(sec){ var sx=(Math.random()*2-1)*26*world.trauma*world.trauma,
 sy=(Math.random()*2-1)*20*world.trauma*world.trauma;
 ctx.save(); ctx.translate(sx,sy);
 drawBG(); drawGuide(); drawWall(); drawPlatforms();
 if(!player.dead){ var pb=groundUnder(player.x,player.y);
  drawRefl(player.x,pb,player.y,player.hurtT>0?"#ff6a86":"#7df9ff",30); if(SHADOW_ON)drawShadow(player.x,pb,player.y,28); }
 for(var ei=0;ei<enemies.length;ei++){ var en=enemies[ei]; if(en.hp<=0)continue; var eb2=groundUnder(en.x,en.y);
  drawRefl(en.x,eb2,en.y,en.kind==="red"?"#ff8fa3":"#d9b3ff",26); if(SHADOW_ON)drawShadow(en.x,eb2,en.y,15); }
 drawEnemies(); drawPlayer(); drawBladeTrail(); drawFx();
 ctx.restore();
 if(world.slowT>0){ ctx.fillStyle="rgba(120,200,255,0.05)"; ctx.fillRect(0,0,W,H); }
 drawHUD(); drawNarrator(); drawOverlays(); }

/* ============ 测试钩子（契约 v2，见 review-v02/d8-qa/qa-plan.md §1） ============ */
/* registry＝登记表：v0.2 新内容在此登记后，套件/画像探针据此长覆盖，不必人肉加闸 */
var REGISTRY={ acts:[{id:1,name:"序章",stage:"playable",note:"=v0.1 切片体量"}],
 mechanics:[{id:"move",act:1,event:"first_move"},{id:"jump",act:1},{id:"air_jump",act:1},
  {id:"attack3",act:1,event:"combo_praise"},{id:"dash",act:1},{id:"perfect_dodge",act:1,event:"perfect_dodge"},
  {id:"defy_wall",act:1,event:"wall_build"},{id:"platform",act:1,note:"机制骨架（v0.1.2），关卡内容待 v0.2"}],
 endings:[{id:"slice_outro",act:1,recipe:"cleared=true → outro"}],
 checkpoints:[{id:"game_start"},{id:"wave1"},{id:"wave2"},{id:"arena_cleared"},{id:"outro"},{id:"restart_done"}],
 durableFields:[],
 mechanicsMustFire:[{act:1,ids:["move","attack3","dash","defy_wall"]}] };
function state(){ return {
 phase:world.phase, wave:world.wave, cleared:!!world.cleared,
 act:world.started?1:0, ending:null,
 boss:{active:false,phase:0,hp:0,maxHp:0}, menu:{screen:"none"}, save:{enabled:false},
 audio:{osc:Music.live,intensity:+Music.cur.toFixed(2)},
 player:{x:+player.x.toFixed(1),y:+player.y.toFixed(1),vx:+player.vx.toFixed(1),vy:+player.vy.toFixed(1),
  hp:player.hp,maxHp:player.maxHp,grounded:player.grounded,dashing:player.dashT>0,invuln:player.invuln>0,
  attacking:!!player.atk,facing:player.facing,combo:player.combo},
 enemies:enemies.map(function(e){return {id:e.id,kind:e.kind,x:+e.x.toFixed(1),y:+e.y.toFixed(1),hp:e.hp,maxHp:e.maxHp,state:e.state};}),
 wall:{built:wall.built,rising:wall.rising},
 narrator:{current:Narr.cur?Narr.cur.line.text:null,queueLen:Narr.queue.length,
  counters:{defyLeft:world.defyLeft,deaths:world.deaths,perfectDodges:player.perfDodges},
  log:Narr.log.slice()} }; }
window.__game={ version:VER, state:state, debug:{
 hurtPlayer:function(n){ damagePlayer(n,1,true); },
 clearWave:function(){ for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.hp>0){ e.hp=0;e.state="dead";e.t=0;
  spawnBurst(e.x,e.y-24,18,e.kind==="red"?"#ff5a78":"#c88bff",320,0.6); } } },
 setPlayerX:function(x){ player.x=clamp(x,24,W-26); },
 setPlatforms:function(list){ PLATFORMS.length=0; if(list)for(var i=0;i<list.length;i++){ var p=list[i];
  PLATFORMS.push({x:+p.x,y:+p.y,w:+p.w,h:+(p.h||16)}); } },
 audioCount:function(){ return Music.live; },
 setShadow:function(v){ SHADOW_ON=(v!==false); return SHADOW_ON; },
 registry:REGISTRY,
 telemetry:function(){ var f=frameTimes.slice(), s=f.slice().sort(function(a,b){return a-b;});
  var p95=s.length?s[Math.min(s.length-1,Math.floor(s.length*0.95))]:0;
  return {events:Narr.log.slice(), frames:f, frameCount:frameTotal, frameP95Ms:+(p95*1000).toFixed(1)}; },
 reset:function(){ hardReset(); } }};

/* ============ 启动 ============ */
Narr.init(); resize();
if(isTouch){ var tc=document.getElementById("touch"); if(tc)tc.classList.add("on"); }
requestAnimationFrame(frame);
console.log("拆台 v"+VER+" 已启动");
})();
