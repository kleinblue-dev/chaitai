/* 《拆台》v0.1 —— 一个不听话的动作游戏（原创切片）
   设计："会记账的旁白"＋打击感。全部程序化美术/音效，零外部素材。
   测试钩子契约 v2：window.__game = { version, state(), debug:{hurtPlayer,clearWave,setPlayerX,setPlatforms,setShadow,audioCount,audioLog,telemetry,registry,reset} }（W4.1 A3 增键 audioLog：音频播放记录环形 32；W5.3–W7 增键：afterimageCount/bladeTrailCount/qiParticleCount/setHitstop/spawnBoss/setPlayerPos/spawnEnemy/enemyHit（telemetry 增 narrKey/narrChars/cpLog））
   v0.1.2 增量：分幕调色板＋预渲染背景／接触阴影／地面反射光／刀光拖尾／MusicSys 分层音乐(P0)／台箱单面平台／旁白音频叠播修复／fx 上限。
   W6.1 战斗闭环（VER 不动）：剑气/居合接入统一受击路径 applyHit（伤害/击退/硬直/音效/顿帧）＋一刀一结算
   （刀身命中预标记 qi.hit）＋Boss 同路径；state 契约增 enemies[].vx/flash、dyn.iaidoN。 */
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
 /* far/mid 必须与 farS/midS 同清：只清源不清目标 ⇒ step 路径的 bakeFar/MidTick 通过 `if(!c)return`
    却 drawImage(null 源)⇒ TypeError（verify-v030 红侧取证 12 条；2026-10-14 Loop D 验证期修复） */
 ctx.setTransform(dpr,0,0,dpr,0,0); LAY.base=null; LAY.baseKey=""; LAY.key=""; LAY.farS=null; LAY.midS=null;
 LAY.far=null; LAY.mid=null; }
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
 play:function(n){ this.log=this.log||[]; this.log.push({id:n,t:world.t}); if(this.log.length>32)this.log.shift(); /* W4.1（A3）：播放请求环形记录（32）——静音/无 ctx 也记，供时序探针 debug.audioLog */
  if(!this.ctx||this.muted)return; switch(n){
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
  case "warn_lamp": this.tone(1250,340,0.35,"sine",0.10); break;
  case "warn_drop": this.tone(340,980,0.18,"triangle",0.10); break;
  case "warn_press": this.tone(180,90,0.4,"square",0.12); this.noise(0.45,300,120,0.22); break;
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
 air_swing_spam:{tiers:[[fb("as_1","剑法不错，可惜没有观众。"),fb("as_2","对着空气耍帅，这段我剪不掉。")]]},
 elite_intro:{tiers:[[fb("ei_1","压轴的角儿上场了。这台布景，归它管。")]]},
 elite_enrage:{tiers:[[fb("er_1","灯芯烧起来了——它不打算再让着你。")]]},
 elite_standoff:{tiers:[[fb("es_1","别在高处看戏。这场要你下来演。")]]}
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
   if(this.cur&&this.cur.key===key){ this.stopCur(); this.cur=null; } for(var qi=this.queue.length-1;qi>=0;qi--){ if(this.queue[qi].key===key)this.queue.splice(qi,1); } var PRIO={wall_build:1,arena_cleared:1,wall_open:1,outro:1,player_death:1,perfect_dodge:1,boss_intro:1,boss_half:1,boss_low:1,boss_defeat:1}; if(PRIO[key]){ if(this.cur&&!PRIO[this.cur.key]){ this.stopCur(); this.cur=null; } for(var qj=this.queue.length-1;qj>=0;qj--){ if(!PRIO[this.queue[qj].key])this.queue.splice(qj,1); } } this.queue.push({key:key,line:arr[idx]}); while(this.queue.length>2)this.queue.shift(); },
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
/* ?debug=1 玩家自测开关（C6/P5）：无参时 DBG.on=false ⇒ 全部门控不生效——零正常游玩变化 */
var DBG={on:/[?&]debug=1/.test(location.search),pause:false,msg:""};
function resetProgress(){ saveClear(); world.ended.length=0; DBG.pause=false; DBG.msg="已重置进度（存档已清、结局收集归零）"; }
addEventListener("keydown",function(e){
 if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code)>=0)e.preventDefault();
 if(DBG.on&&e.code==="Escape"&&!e.repeat){ DBG.pause=!DBG.pause; just={}; return; }
 if(DBG.on&&e.code==="Backspace"&&!e.repeat){ e.preventDefault(); resetProgress(); return; }
 if(e.code==="KeyM"&&!e.repeat){ AudioSys.toggle(); return; }
 if(e.code==="KeyR"&&!e.repeat&&world.showRestart){ restart(); return; }
 if((e.code==="KeyJ"||e.code==="KeyZ")&&!e.repeat&&world.continueReady){ if(startNextAct())return; } /* 幕终「按 J 开拍」：命中即吞输入（不挥剑） */
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
bindBtn("t-continue","tcontinue",function(){ if(world.continueReady)startNextAct(); });
cv.addEventListener("pointerdown",function(){ if(world.phase==="title"&&!world.started)beginGame(); });

/* ============ 特效 ============ */
var fx=[], ghosts=[], ghostT=0, bladeTrail=[], qi=null, qiTrail=[];
/* 机关实体（v0.2 Loop3 灰盒：灯带/道具坠落；序章无机关，接线在各幕循环） */
var traps=[];
/* SHADOW_ON：接触阴影总开关（测试钩子 debug.setShadow 用；X6 探针以同像素 ON/OFF 差值测阴影，背景/辉光天然对消） */
var SHADOW_ON=true;
/* ============ Loop D：程序化美术配方（2026-10-14）＝「参数唯一来源」的绘制层对应物 ============
   - HIT_FX：打击粒子配方（数值等价 Loop C 现状；仅 kill/death/bossDown 放大尺寸剖面＝语义微调）。
   - ART：形状/节奏配方（丝带噪波、刀光贝塞尔、Boss 视效）——绘制点只准读配方，不散写数值。
   - 颜色纪律：全部经调用点取注册表族色（J1 调色板契约）；时间源一律 world.t/RIG.t（冻结停，v027 契约）。 */
var HIT_FX={
 hitSpark:{n:10,spd:260,life:0.4}, lightSpark:{n:6,spd:160,life:0.3}, kill:{n:22,spd:340,life:0.7,sLo:2.5,sHi:6},
 hurt:{n:12,spd:300,life:0.45}, death:{n:26,spd:380,life:0.8,sLo:2.4,sHi:6}, jump:{n:6,spd:120,life:0.3},
 landDust:{n:4,spd:90,life:0.25}, parry:{n:16,spd:380,life:0.5}, cpSpark:{n:2,spd:140,life:0.5},
 propLand:{n:14,spd:260,life:0.5}, pressLand:{n:16,spd:260,life:0.5},
 bossHit:{n:10,spd:260,life:0.4}, bossDown:{n:30,spd:340,life:0.9,sLo:2.5,sHi:6.2}, enemyDrop:{n:18,spd:320,life:0.6} };
var ART={
 /* 丝带噪波（发带绘制升级）：带宽基础/渐细、噪波幅/频率/相位步进 */
 ribbon:{base:2.0,taper:0.55,waveAmp:0.55,waveK:1.9,waveSpd:6.0,col:"#ffd76a"}, /* W5-1：1.1→2.0 金丝带读得出（64px 可读性）；绘制层延长见 drawPlayer */
 /* 刀光贝塞尔：弧半径/线宽/外弧鼓量/白芯内弧系数/起止角/扫幅（包围盒≈原 arc 界，J2 采样箱内） */
 slash:{light:{R:50,w:11,arc:-0.06},heavy:{R:58,w:16,arc:0.02},bulge:1.18,coreR:0.84,a0:-1.25,span:0.9},
 /* Boss 视效：光环半径/脉动速度、漂浮幅/速、暴怒抖动、拖尾节数/采样位移阈值(px)、色偏错位(px) */
 bossFx:{auraR:64,pulseSpd:2.2,floatAmp:2.5,floatSpd:1.6,shakeAmp:1.2,shakeSpd:34,trailN:6,trailHop:0.5,spill:9} };
function spawnBurst(x,y,n,color,spd,life,grav,sLo,sHi){ sLo=(sLo==null)?2:sLo; sHi=(sHi==null)?5:sHi;
 for(var i=0;i<n;i++){ var a=Math.random()*Math.PI*2,v=spd*(0.35+Math.random()*0.85);
  fx.push({k:"p",x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:life*(0.5+Math.random()*0.5),max:life,g:(grav==null?900:grav),size:sLo+Math.random()*(sHi-sLo),color:color}); } }
function hitBurst(x,y,recipe,color){ var r=HIT_FX[recipe]||HIT_FX.hitSpark;
 spawnBurst(x,y,r.n,color,r.spd,r.life,r.grav,r.sLo,r.sHi); }
function spawnRing(x,y,color,max){ fx.push({k:"ring",x:x,y:y,t:0,max:max||0.22,color:color}); }
function spawnSlashFx(x,y,facing,heavy){ fx.push({k:"slash",x:x,y:y,facing:facing,t:0,max:heavy?0.2:0.14,heavy:heavy}); }
function addTrauma(v){ world.trauma=Math.min(1,world.trauma+v); }
/* —— W5.3 动态表现力：剑气/居合（游戏时间驱动：updQi 由 updateFx 调用，冻结窗自动停） —— */
var QI_SPD=489, QI_FLY=0.45, QI_FADE=0.1, QI_EMIT=80, QI_BUDGET=120, QI_DMG=6, IAI_DMG=12; /* W6.1 伤害常量：红兵 hp30＝剑气 5 发／居合近身爆发 12 */
function qiCount(){ var n=0; for(var i=0;i<fx.length;i++)if(fx[i].q)n++; return n; }
function qiEmit(n,x,y,spdK){ for(var i=0;i<n;i++){ if(qiCount()>=QI_BUDGET)return;
 var a=Math.random()*Math.PI*2,v=(70+Math.random()*120)*(spdK||1);
 fx.push({k:"p",q:1,x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,life:0.3+Math.random()*0.2,max:0.5,g:160,size:2+Math.random()*2.4,
  color:(Math.random()<0.5?"#aef6ff":(Math.random()<0.5?"#7df9ff":"#eafcff"))}); } }
function qiSpawn(){ var P=player; qi={x:P.x+P.facing*26,y:P.y-30,dir:P.facing,t:0,tr:0,em:0,hit:{}}; qiTrail.length=0;
 qiEmit(24,qi.x,qi.y,1.2); addTrauma(0.12); AudioSys.play("slash"); }
function updQi(dt){ for(var ti=qiTrail.length-1;ti>=0;ti--){ qiTrail[ti].t+=dt; if(qiTrail[ti].t>0.14)qiTrail.splice(ti,1); }
 if(!qi)return; qi.t+=dt; qi.tr+=dt;
 while(qi.tr>=0.012){ qi.tr-=0.012; qiTrail.push({x:qi.x,y:qi.y,t:0}); if(qiTrail.length>14)qiTrail.shift(); }
 if(qi.t<QI_FLY){ qi.x+=qi.dir*QI_SPD*dt;
  qi.em+=dt; while(qi.em>=1/QI_EMIT){ qi.em-=1/QI_EMIT; qiEmit(1,qi.x,qi.y,0.9); }
  for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.hp<=0||qi.hit[e.id])continue; /* W6.1 战斗闭环：命中接入统一受击路径（伤害/击退/硬直/音效/顿帧）；qi.hit 防重＝一次飞行每敌至多一次（穿透保留） */
   if(Math.abs(e.x-qi.x)<22&&Math.abs((e.y-26)-qi.y)<26){ qi.hit[e.id]=1; qiEmit(12,e.x,e.y-26,1.3);
    applyHit(e,QI_DMG,qi.dir,{kx:150,hs:0.03,sh:0.12}); } }
  if(boss.active&&!boss.dead&&!qi.hit["boss"]){ /* W6.1：Boss 同路径（几何 |boss.x−qi.x|<36、|(boss.y−26)−qi.y|<40） */
   if(Math.abs(boss.x-qi.x)<36&&Math.abs((boss.y-26)-qi.y)<40){ qi.hit["boss"]=1; qiEmit(12,boss.x,boss.y-26,1.3);
    hitBoss(QI_DMG,qi.dir,{hs:0.03,sh:0.12}); } } }
 else if(qi.t<QI_FLY+QI_FADE){ if(!qi.boomed){ qi.boomed=true; qiEmit(16,qi.x,qi.y,1.1); } }
 else { qi=null; } }
function iaido(){ var P=player; world.slowT=Math.max(world.slowT,0.30); P.iaiFire=world.t;
 spawnSlashFx(P.x+P.facing*26,P.y-30,P.facing,true); addTrauma(0.3); AudioSys.play("slash");
 for(var i=0;i<4;i++)pushGhost(P.x-P.facing*(8+i*6),P.y,P.facing,"iai");
 /* W6.1 战斗闭环：刀身即时判定带 dx∈(−40,96)（facing 偏置）、|dy|<52（重击档 kx260/顿帧0.15/闪白）；一刀一结算＝命中者预标记 qi.hit，随行剑气不二次扣除 */
 var preHit={}, struckN=0;
 for(var j=0;j<enemies.length;j++){ var e=enemies[j]; if(e.hp<=0)continue;
  var dx=(e.x-P.x)*P.facing, dy=(e.y-23)-(P.y-27);
  if(dx>-40&&dx<96&&Math.abs(dy)<52){ preHit[e.id]=1; struckN++;
   applyHit(e,IAI_DMG,e.x>=P.x?1:-1,{kx:260,hs:0.08,sh:0.3,step:3}); } }
 if(boss.active&&!boss.dead){ var bdx=(boss.x-P.x)*P.facing, bdy=(boss.y-23)-(P.y-27);
  if(bdx>-40&&bdx<96&&Math.abs(bdy)<52){ preHit["boss"]=1; struckN++;
   hitBoss(IAI_DMG,P.facing,{hs:0.08,sh:0.3,step:3}); } }
 world.iaiN=struckN;
 qiSpawn();
 for(var k in preHit)qi.hit[k]=1; }
function updateFx(dt){ if(fx.length>260)fx.splice(0,fx.length-260);
 for(var i=fx.length-1;i>=0;i--){ var f=fx[i];
  if(f.k==="p"){ f.vy+=f.g*dt; f.x+=f.vx*dt; f.y+=f.vy*dt; f.life-=dt; if(f.life<=0)fx.splice(i,1); }
  else { f.t+=dt; if(f.t>=f.max)fx.splice(i,1); } }
 for(var j=ghosts.length-1;j>=0;j--){ ghosts[j].t+=dt; if(ghosts[j].t>0.28)ghosts.splice(j,1); }
 for(var bi=bladeTrail.length-1;bi>=0;bi--){ bladeTrail[bi].t+=dt; if(bladeTrail[bi].t>0.14)bladeTrail.splice(bi,1); }
 updQi(dt); }
function drawFx(){ for(var i=0;i<fx.length;i++){ var f=fx[i];
  if(f.k==="p"){ var al=Math.max(0,f.life/f.max); ctx.globalAlpha=al; ctx.fillStyle=f.color;
   ctx.fillRect(f.x-f.size/2,f.y-f.size/2,f.size,f.size); ctx.globalAlpha=1; }
  else if(f.k==="ring"){ var p=f.t/f.max; ctx.globalAlpha=Math.max(0,1-p); ctx.strokeStyle=f.color; ctx.lineWidth=3;
   ctx.beginPath(); ctx.arc(f.x,f.y,8+70*p,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
  else if(f.k==="slash"){ var q=f.t/f.max; ctx.save(); ctx.globalCompositeOperation="lighter";
   /* Loop D 刀光＝贝塞尔月牙（arc 圆环 → 弯刃扫掠；参数 ART.slash）：
      外弧控制点沿中角外扩 bulge ⇒ 厚刃在外缘；白芯走内弧（coreR）⇒ 亮口贴刃内侧；
      facing<0 水平镜像。包围盒≈原 arc 界（端点主导）——J2 刀弧箱 x+16..x+80,y−82..y−42 仍包住。 */
   var S2=f.heavy?ART.slash.heavy:ART.slash.light, fc=f.facing<0?-1:1;
   var a0=ART.slash.a0+q*ART.slash.span, a1=a0+1.1, am=(a0+a1)/2;
   ctx.globalAlpha=Math.max(0,1-q)*0.9; ctx.lineWidth=S2.w; ctx.lineCap="round";
   var p0x=f.x+Math.cos(a0)*S2.R*fc, p0y=f.y+Math.sin(a0)*S2.R;
   var p1x=f.x+Math.cos(a1)*S2.R*fc, p1y=f.y+Math.sin(a1)*S2.R;
   var cOx=f.x+Math.cos(am+S2.arc)*S2.R*ART.slash.bulge*fc, cOy=f.y+Math.sin(am+S2.arc)*S2.R*ART.slash.bulge;
   var cIx=f.x+Math.cos(am)*S2.R*ART.slash.coreR*fc, cIy=f.y+Math.sin(am)*S2.R*ART.slash.coreR;
   ctx.strokeStyle=f.heavy?"#ffd76a":"#aef6ff";
   ctx.beginPath(); ctx.moveTo(p0x,p0y); ctx.quadraticCurveTo(cOx,cOy,p1x,p1y); ctx.stroke();
   ctx.globalAlpha*=0.55; ctx.lineWidth=f.heavy?6:4; ctx.strokeStyle="#ffffff";
   ctx.beginPath(); ctx.moveTo(p0x,p0y); ctx.quadraticCurveTo(cIx,cIy,p1x,p1y); ctx.stroke();
   ctx.restore(); } } }

/* ============ 氛围粒子（Loop9 / d6-art P1-1：常驻尘埃＋二幕上升火星；全程序绘制、零素材） ============
   预算（d6-art:103-104）：尘埃 40 / 火星 24（fx 另有 260 上限）。空间契约（防踩旧仪器）：
   尘埃 y∈[24,454]（★上限 454 避 v012-X6/v025-A 脚带 [310,326]×[463,470]）；火星出生 y∈[464,470]、
   升程≤110 ⇒ 顶点 y≥360（避 v026 FLASH 带 y200-320 与 v027 SKY 带 y150-178）。
   颜色/透明度：尘埃 α=0.15 恒定、色 #ffecd2；火星 α=0.15+0.45·(life/max)、色=该幕霓虹（act2.neon）。
   数学封闭（v011 安全）：两者叠加 r=(1−α)·br+α·255 ≥ 0.15×255=38.25 > 22 ⇒ 永不产出月亮色 #16203a。
   更新挂 step 的 hitstop-else 分支（与 updateFx 同门）：冻结窗全停（v027-C3 全等保持）、慢动作吃 sdt、title 相照走。
   探针：tools/verify-v028.cjs（契约 state().atmo / debug.setDust / setEmber / atmoPos）。 */
var dust=[], embers=[];
function initDust(n){ if(n==null)n=40; n=clamp(n|0,0,40); dust.length=0;
 for(var i=0;i<n;i++) dust.push({x:Math.random()*W, y:24+Math.random()*430,
  vx:(Math.random()*2-1)*5, vy:(Math.random()*2-1)*3, s:1+Math.random()});
 return dust.length; }
function spawnEmberOnce(){ if(embers.length>=24)return false;
 var life=1.2+Math.random();
 embers.push({x:40+Math.random()*880, y:464+Math.random()*6,
  vy:-(30+Math.random()*20), life:life, max:life});
 return true; }
function updAtmo(dt){
 for(var i=0;i<dust.length;i++){ var d=dust[i];
  d.x+=d.vx*dt; d.y+=d.vy*dt;
  if(d.x<0)d.x+=W; else if(d.x>=W)d.x-=W;
  if(d.y<24)d.y+=430; else if(d.y>454)d.y-=430; }
 if(world.phase==="playing"&&palKey()==="act2"&&!world.cleared&&Math.random()<dt*4) spawnEmberOnce(); /* 序章W2 等价；2+幕=该幕常驻火星 */
 for(var j=embers.length-1;j>=0;j--){ var e=embers[j];
  e.y+=e.vy*dt; e.life-=dt; if(e.life<=0||e.y<350) embers.splice(j,1); } }
function drawAtmo(){
 ctx.save(); ctx.globalAlpha=0.15; ctx.fillStyle="#ffecd2";
 for(var i=0;i<dust.length;i++){ var d=dust[i]; ctx.fillRect(d.x-d.s/2,d.y-d.s/2,d.s,d.s); }
 for(var j=0;j<embers.length;j++){ var e=embers[j];
  ctx.globalAlpha=0.15+0.45*(e.life/e.max); ctx.fillStyle=PALETTES.act2.neon;
  ctx.fillRect(e.x,e.y,2,2); }
 ctx.restore(); }

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
var wall={built:false,rising:false,opening:false,h:0,sideRight:true,pendingOpen:false,hp:0,breakable:false,breaking:false,hitFlash:0}; /* W3：hp/breakable/breaking＝A3-3 可拆墙（d2 §3）；hitFlash＝被击闪白 */
var player={x:190,y:GY,vx:0,vy:0,hp:100,maxHp:100,grounded:true,facing:1,
 dashT:0,dashCd:0,airDash:1,iframes:0,invuln:0,hurtT:0,combo:0,comboT:0,
 atk:null,walk:0,dead:false,deathT:0,airJumps:1,coyote:0,jumpBuf:0,atkBuf:0,dashBuf:0, jHold:0,qiLatch:false,qiWind:0,iaiW:0,iaiFire:-1, /* W4.1（A5） */
 hurtOnce:false,lowFired:false,stun:0,perfDodges:0};
var enemies=[], eid=1;
var world={phase:"title",started:false,wave:0,cleared:false,advancing:false,showRestart:false,act:1,enc:0,encPhase:"idle",encIdleT:0,actHold:false,continueReady:false,
 t:0,hitstop:0,slowT:0,flashW:0,trauma:0,timers:[],deaths:0,arena:"prologue",
 wave1Started:false,lastGuide:0,lastInput:0,idleIdx:0,idleCombatFired:false,
 inZone:false,defyLeft:0,pendingWall:false,cp:"",cpLog:[],ended:[],spare:null,ending:null,wallHits:0,maxCombo:0,
 swingT:[],whiffT:[],dashT:[],jumpT:[],wallTouched:false,wallReplyT:0,lastEnemyFired:false,cdJump:0,wallWarnT:null,wallUsedEnc:null,dropWavesFired:0,dropWavesLeft:0,lampCycle:0,lampPeriod:6,iaiN:0,eliteIntroFired:false,eliteNudgeT:0}; /* W2：wallWarnT＝砌墙预告倒计时、wallUsedEnc＝本场已用砌墙配额（每场最多 1 次）；W3：落物波（已发/剩余）＋灯带周期；W4.1：wallReplyT＝敲墙回声冷却戳；W6.1：iaiN＝最近一次居合刀身命中数（state().dyn.iaidoN） */
function schedule(t,fn){ world.timers.push({t:t,fn:fn}); }

/* ============ 敌人工厂 ============ */
var EKIND={
 red:{hp:30,spd:118,windup:0.5,lunge:400,dmg:18,rec:0.55,color:"#ff4d6d",glow:"#ff8fa3"},
 purple:{hp:18,spd:178,windup:0.34,lunge:470,dmg:12,rec:0.44,color:"#b76bff",glow:"#d9b3ff"},elite:{hp:90,spd:100,windup:0.65,lunge:300,dmg:18,rec:0.75,color:"#ffb040",glow:"#ffcf7a"}};
function mkEnemy(kind,x){ var p=EKIND[kind]; return {id:eid++,kind:kind,x:x,y:GY,vx:0,hp:p.hp,maxHp:p.hp,
 state:"patrol",t:0,dir:-1,spd:p.spd,windup:p.windup,lunge:p.lunge,dmg:p.dmg,rec:p.rec,seed:Math.random()*6,flash:0,struck:false,phase:1,chain:0}; }
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
  if(!a.swung){ a.swung=true; pushGhost(P.x,P.y,P.facing,"atk"); spawnSlashFx(P.x+P.facing*26,P.y-30,P.facing,a.step===3); }
  var hx=P.x+P.facing*(14+A.rng/2);
  for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.hp<=0||a.hit[e.id])continue;
   if(Math.abs(e.x-hx)<A.rng/2+16&&Math.abs((e.y-23)-(P.y-27))<48){ a.hit[e.id]=1;
    applyHit(e,A.dmg,P.facing,{kx:A.kx,hs:A.hs,sh:A.sh,step:a.step}); } }
  if(boss.active&&!boss.dead&&!a.hit["boss"]){ /* Boss 走同一命中带（d2 §6） */
   if(Math.abs(boss.x-hx)<A.rng/2+16&&Math.abs((boss.y-23)-(P.y-27))<48){ a.hit["boss"]=1;
    hitBoss(A.dmg,P.facing,{hs:A.hs,sh:A.sh,step:a.step}); } }
  if(wall.built&&(!wall.breakable||wall.hp>0)){ /* W4：攻击命中墙带（墙身 x137-163 中心 150、立于地面；d2 §3）——可拆墙走 hitWall（W3 原路径）；砌好的不可拆墙＝「敲墙」（火花＋world.wallHits 计数，供隐藏结局 d「敲够九下」解锁；whiff 语义不变） */
   if(Math.abs(150-hx)<A.rng/2+16&&Math.abs((GY-23)-(P.y-27))<48){
    if(wall.breakable){ if(!a.hit["wall"]){ a.hit["wall"]=1; hitWall(A.dmg,a.step); } }
    else if(!a.wallKnock){ a.wallKnock=1; world.wallHits++; wall.hitFlash=0.14;
     hitBurst(150,GY-150,"hitSpark","#ffd76a"); addTrauma(0.06); AudioSys.play(a.step===3?"hit3":(a.step===2?"hit2":"hit1"));
     if(world.t-(world.wallReplyT||0)>1.5){ world.wallReplyT=world.t; Narr.fire("wall_touch"); } } } } /* W4.1（A4）：敲门回声弧线解闩（火花＋震屏＋旁白；1.5s 冷却防刷屏；wallReplyT 逐局复位见 resetWorld） */
 } /* W4 修：此 } 关 else if(a.t<d1) 块（:334 开）——初版替换曾丢它，_brace-scan 定位 */
 else if(a.t<d2){ a.phase="rec"; }
 else { endSwing(a); P.atk=null; return; }
 if(P.dashT>0&&a.phase!=="wind"){ endSwing(a); P.atk=null; } }
function applyHit(e,dmg,dir,o){ e.hp-=dmg; if(e.kind!=="elite"){e.state="hit"; e.t=0; e.struck=true;} if(e.kind!=="elite"||e.state!=="strike")e.vx=dir*(o.kx||180)*(e.kind==="elite"?0.3:1); e.flash=0.12;
 var cap=(o.step===3?0.15:0.12), tgt=(o.step===3?0.15:(o.hs||0.045)); world.hitstop=Math.min(cap,Math.max(world.hitstop,tgt));
 if(o.step===3){ world.flashW=0.12; }
 addTrauma(o.sh||0.2);
 hitBurst(e.x+e.vx*0.02,e.y-26,"hitSpark",e.kind==="red"?"#ff5a78":(e.kind==="elite"?"#ffb040":"#c88bff"));
 spawnRing(e.x,e.y-26,"#ffffff",0.16);
 AudioSys.play(o.step===3?"hit3":(o.step===2?"hit2":"hit1"));
 player.combo++; player.comboT=2.5; if(player.combo>world.maxCombo)world.maxCombo=player.combo; if(player.combo===3)Narr.fire("combo_praise");
 if(e.hp<=0){ e.hp=0; e.state="dead"; e.t=0; hitBurst(e.x,e.y-24,"kill",e.kind==="red"?"#ff5a78":(e.kind==="elite"?"#ffb040":"#c88bff")); } }
function hitWall(dmg,step){ var A=ATK[step-1]; world.wallHits++; wall.hp-=dmg; wall.hitFlash=0.14; /* W3：可拆墙受击（d2 §3 hp32＝一套三连击 8+9+15 恰好拆掉） */
 var wcap=(step===3?0.15:0.12), wtgt=(step===3?0.15:A.hs); world.hitstop=Math.min(wcap,Math.max(world.hitstop,wtgt));
 if(step===3){ world.flashW=0.12; }
 addTrauma(A.sh*0.7);
 hitBurst(150,GY-150,"hitSpark","#ffd76a"); spawnRing(150,GY-150,"#ffffff",0.16);
 AudioSys.play(step===3?"hit3":(step===2?"hit2":"hit1"));
 if(wall.hp<=0){ wall.hp=0; wall.breaking=true; addTrauma(0.45); AudioSys.play("wall"); /* 崩落声复用手感：砌墙同源低频轰鸣 */
  Narr.fire("wall_break"); setCp("a3_break"); } }
function startDash(){ var P=player; if(!P.grounded)P.airDash--; P.dashT=0.16; P.vx=P.facing*DASH_SPD; P.vy=0;
 P.iframes=Math.max(P.iframes,0.22); P.dashCd=0.32; AudioSys.play("dash");
 hitBurst(P.x-P.facing*10,P.y-30,"lightSpark","#aef6ff"); ghostT=0; P.iaiW=0.45; P.iaiFire=-1;
 world.dashT.push(world.t); }
function damagePlayer(d,dir,force){ var P=player; if(world.phase!=="playing")return;
 if(!force&&(P.invuln>0||P.dashT>0))return;
 P.hp-=d; P.invuln=1.0; P.stun=0.18; P.vx=dir*260; P.vy=-140; P.hurtT=0.15;
 world.hitstop=Math.max(world.hitstop,0.05); addTrauma(0.32);
 AudioSys.play("hurt"); hitBurst(P.x,P.y-30,"hurt","#ff6a86");
 if(!P.hurtOnce){ P.hurtOnce=true; Narr.fire("player_hurt"); }
 else if(!P.lowFired&&P.hp<=30){ P.lowFired=true; Narr.fire("player_hurt"); }
 if(P.hp<=0){ P.hp=0; P.dead=true; P.deathT=0; world.phase="dead"; world.deaths++;
  stageDeath(world.deaths); /* 场记板"第 N 条"：N=导演账本本局死亡数（与 state().narrator.counters.deaths 恒等） */
  Narr.fire("player_death"); AudioSys.play("death"); hitBurst(P.x,P.y-30,"death","#ff6a86");
  if(boss.active&&!boss.dead)setBossNarr("taunting"); /* BossNarrativeController：Boss 在场时玩家倒下 → 嘲弄 */
  schedule(2.2,respawn); } }
function respawn(){ var P=player; P.hp=P.maxHp; P.x=190;P.y=GY;P.vx=0;P.vy=0;P.invuln=1.5;P.dead=false;P.deathT=0;
 P.combo=0;P.atk=null;P.dashT=0;
 world.hitstop=0; world.slowT=0;
 if(world.wave>0&&!world.cleared)respawnWave();
 world.phase="playing"; Narr.fire("respawn");
 if(boss.active&&boss.dead&&!world.spare&&!world.ending)openSpare(); } /* W4.1（A1）：spare 软锁兜底——死亡窗吞掉开窗时，复活即补开 */
function updPlayer(dt){ var P=player;
 if(world.phase==="dead"){ P.deathT+=dt; if(!P.grounded){P.vy+=GRAV*dt;P.y+=P.vy*dt;if(P.y>=GY){P.y=GY;P.grounded=true;}} return; }
 P.dashCd=Math.max(0,P.dashCd-dt); P.iframes=Math.max(0,P.iframes-dt); P.invuln=Math.max(0,P.invuln-dt);
 P.hurtT=Math.max(0,P.hurtT-dt); P.stun=Math.max(0,P.stun-dt); P.iaiW=Math.max(0,P.iaiW-dt);
 if(P.comboT>0){P.comboT-=dt; if(P.comboT<=0)P.combo=0;}
 var mv=0; if(anyDown(MOVE_L))mv-=1; if(anyDown(MOVE_R))mv+=1;
 if(mv!==0)P.facing=mv;
 if(justDown(JUMPK))P.jumpBuf=0.12; P.jumpBuf=Math.max(0,P.jumpBuf-dt);
 if(P.iaiW>0&&!P.atk&&justDown(ATKK)){ iaido(); P.iaiW=0; } else if(justDown(ATKK))P.atkBuf=0.14; P.atkBuf=Math.max(0,P.atkBuf-dt);
 if(justDown(DASHK))P.dashBuf=0.14; P.dashBuf=Math.max(0,P.dashBuf-dt); /* W4.1（A5）：冲刺缓冲（唯一硬拒动词补齐；jumpBuf/atkBuf 数值升级不入本批） */
 if(anyDown(ATKK)){ P.jHold+=dt; } else { P.jHold=0; P.qiLatch=false; } /* W5.3：长按 J 蓄剑气（qiWind 0.10s 起手，qiLatch 防连发） */
 if(P.qiWind>0){ P.qiWind-=dt; if(P.qiWind<=0){ qiSpawn(); P.qiWind=0; P.qiLatch=true; } }
 else if(P.jHold>=0.38&&!P.qiLatch&&world.phase==="playing"&&(!P.atk||P.atk.phase==="rec")){ P.qiWind=0.10; P.jHold=0; }
 if(P.dashBuf>0&&P.dashCd<=0&&P.dashT<=0&&(P.grounded||P.airDash>0)&&!(P.atk&&P.atk.phase==="wind")){ startDash(); P.dashBuf=0; }
 if(P.atkBuf>0&&P.dashT<=0){ if(!P.atk){ startAttack(1); P.atkBuf=0; }
  else if(P.atk.phase==="rec"&&P.atk.step<3){ startAttack(P.atk.step+1); P.atkBuf=0; } }
 var dashing=P.dashT>0;
 if(dashing){ P.dashT-=dt; P.vx=P.facing*DASH_SPD; P.vy=0;
  ghostT-=dt; if(ghostT<=0){ ghosts.push({x:P.x,y:P.y,facing:P.facing,t:0}); ghostT=0.028; }
  if(P.dashT<=0)P.vx*=0.3; }
 else if(P.stun>0){ P.vx*=Math.pow(0.01,dt); }
 else if(mv!==0){ P.vx=mv*SPD; P.walk+=Math.abs(P.vx)*dt/30; } /* Loop6：步相改距离驱动（270/30=9/s，与旧 dt*9 逐值等价），慢动作下自洽 */
 else { P.vx*=Math.pow(0.0001,dt); if(Math.abs(P.vx)<8)P.vx=0; }
 if(!dashing){
  if(P.grounded)P.coyote=0.09; else P.coyote=Math.max(0,P.coyote-dt);
  if(P.jumpBuf>0){ if(P.grounded||P.coyote>0){ P.vy=-JUMPV; P.grounded=false; P.coyote=0; P.jumpBuf=0; P.airJumps=1;
    AudioSys.play("jump"); world.jumpT.push(world.t); hitBurst(P.x,GY,"jump","#aef6ff"); }
   else if(P.airJumps>0){ P.airJumps--; P.vy=-JUMPV*0.92; P.jumpBuf=0; AudioSys.play("jump"); world.jumpT.push(world.t); spawnRing(P.x,P.y-24,"#7df9ff",0.2); } }
  if(!anyDown(JUMPK)&&P.vy<-170)P.vy=-170;
  P.vy+=GRAV*dt; if(P.vy>1000)P.vy=1000; }
 else P.vy=0;
 P.x=clamp(P.x+P.vx*dt,24,W-26);
 /* 台箱侧挡（d2 §2.1③）：贴地（脚低于箱顶 6px 以下）时箱面挡人——照墙钳位写法；站顶/越顶（P.y≤顶+6）不触发 */
 for(var spi=0;spi<PLATFORMS.length;spi++){ var spb=PLATFORMS[spi];
  if(P.y>spb.y+6&&P.x>spb.x-6&&P.x<spb.x+spb.w+6){ P.x=(P.x<spb.x+spb.w*0.5)?spb.x-6:spb.x+spb.w+6; } }
 var prevY=P.y; P.y+=P.vy*dt;
 var landY=(P.vy>=0)?landSurface(P.x,prevY,P.y):null;
 if(landY!==null){ if(!P.grounded){ AudioSys.play("land"); if(P.vy>480)addTrauma(0.05); hitBurst(P.x,landY,"landDust","#8b9db8"); }
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
  case "wind": e.t+=dt; e.dir=dx>0?1:-1; if(e.kind==="elite")e.x+=e.dir*e.spd*0.6*dt; if(e.t>=e.windup){ e.state="strike"; e.t=0; e.struck=false; e.vx=e.dir*e.lunge; } break;
  case "strike": e.t+=dt; e.x+=e.vx*dt; e.vx*=Math.pow(0.02,dt);
   if(!e.struck&&world.phase==="playing"){
    if(Math.abs(P.x-(e.x+e.dir*26))<36&&Math.abs((P.y-27)-(e.y-23))<48){ e.struck=true;
     if(P.dashT>0&&P.iframes>0)perfectDodge(e); else damagePlayer(e.dmg,e.dir); } }
   if(e.t>=0.2){ e.state="rec"; e.t=0; if(e.kind==="elite")e.vx=0; } break;
  case "rec": e.t+=dt; e.vx*=Math.pow(0.01,dt); if(e.kind==="elite")e.x+=e.vx*dt; var ec=(e.kind==="elite"&&e.phase>=2&&(e.chain|0)<1); if(e.t>=(ec?0.5:e.rec)){ if(ec){e.chain=1; e.state="wind"; e.t=0;}else{ e.state="chase"; if(e.kind==="elite")e.chain=0; } } break;
  case "hit": e.t+=dt; e.x+=e.vx*dt; e.vx*=Math.pow(0.001,dt); if(e.t>=0.18)e.state="chase"; break;
 }
 /* 台箱：敌不越箱面也不上箱（d2 §2.1④）——脚在箱顶下方时，箱面前后 20px 为停步带 */
 for(var sqi=0;sqi<PLATFORMS.length;sqi++){ var sqb=PLATFORMS[sqi];
  if(e.y<=sqb.y+6)continue;
  if(e.x>sqb.x-20&&e.x<sqb.x+sqb.w+20){ e.x=(e.x<sqb.x+sqb.w*0.5)?sqb.x-20:sqb.x+sqb.w+20; } }
 e.x=clamp(e.x,24,W-24); }
function updEnemies(dt){ for(var i=enemies.length-1;i>=0;i--){ var e=enemies[i];
 if(e.hp<=0){ e.t+=dt; if(e.t>0.6)enemies.splice(i,1); continue; }
 if(e.kind==="elite"){ /* W7 精英（大灯）：P2 门／入场旁白／站台提醒——三守卫，red/purple 零触达 */
  if(e.phase<2&&e.hp<=e.maxHp*0.5&&world.phase==="playing"){ e.phase=2; Narr.fire("elite_enrage"); world.hitstop=Math.min(0.12,Math.max(world.hitstop,0.08)); world.flashW=Math.max(world.flashW,0.08); spawnRing(e.x,e.y-40,"#ffb040",0.5); }
  if(world.phase==="playing"&&!world.eliteIntroFired){ world.eliteIntroFired=true; Narr.fire("elite_intro"); }
  if(world.phase==="playing"&&world.encPhase==="fight"&&player.grounded&&player.y<=420){ if(!world.eliteNudgeT)world.eliteNudgeT=world.t; else if(world.t-world.eliteNudgeT>8){ world.eliteNudgeT=world.t; Narr.fire("elite_standoff"); } } else world.eliteNudgeT=0;
 }
 updEnemy(e,dt); } }
function perfectDodge(e){ var P=player; P.facing=e.x>P.x?1:-1;
 world.slowT=0.5; P.iframes=0.6; P.invuln=0.6; P.perfDodges++;
 AudioSys.play("perfect"); spawnRing(P.x,P.y-28,"#aef6ff",0.4); hitBurst(e.x,e.y-26,"parry","#aef6ff");
 applyHit(e,26,P.facing,{kx:380,hs:0.09,sh:0.6,step:3}); Narr.fire("perfect_dodge"); }

/* ============ 墙 ============ */
function updWall(dt){ if(wall.hitFlash>0)wall.hitFlash=Math.max(0,wall.hitFlash-dt);
 if(wall.rising){ wall.h+=420*dt;
  if(Math.random()<0.5)hitBurst(150,GY,"cpSpark","#ffd76a");
  if(wall.h>=300){ wall.h=300; wall.rising=false; wall.built=true; } }
 if(wall.breaking){ wall.h-=900*dt; /* W3：可拆墙崩落（built 保持 true 至归零 ⇒ 清场链在崩落期不推进） */
  if(Math.random()<0.7)hitBurst(137+26*Math.random(),GY-30-Math.random()*220,"cpSpark","#ffd76a");
  if(wall.h<=0){ wall.h=0; wall.breaking=false; wall.built=false; addTrauma(0.3);
   hitBurst(150,GY-6,"propLand","#ffd76a"); } }
 if(wall.opening){ wall.h-=520*dt; if(wall.h<=0){ wall.h=0; wall.opening=false; wall.built=false; } }
 if(wall.pendingOpen&&wall.built&&!wall.opening&&!wall.breaking){ wall.pendingOpen=false; openWall(); } } /* W2：升墙窗口清场兜底（清场时墙还在 rising、built=false，openWall 判不到）；W3：崩落期不消费 */
function openWall(){ if(wall.built&&!wall.opening&&!wall.breaking){ wall.opening=true; Narr.fire("wall_open"); } }

/* ============ 机关系统（d2 §4；Loop3 灰盒，幕接线后启用） ============
 灯带：灯头(480,40)，落点 x=480+420·sin(2πt/T)；三幕 T=6.0s／终幕 4.2s（数据定）；
  预警＝亮相位前 0.8s 光斑 α0.25→1＋预警音；伤害 12，仅贴地(y>450)且|x−落点|<54；站箱顶(y≤420)全免；
  跳跃(y≤450)与冲刺(damagePlayer 的 dashT/invuln 门)可过。
 道具坠落：落点＝地面或箱顶；预警椭圆 0.7s；伤 14（半径 34，点到玩家体型矩形最近距）；自上而下 ⇒ 跳跃无效；
  同波错峰 0.35s（间距≥140px 属关卡数据约定，由摆点方保证）。 */
var LAMP_X0=480, LAMP_AMP=420, LAMP_WARN=0.8, LAMP_DMG=12, LAMP_HIT=54,
    DROP_WARN=0.7, DROP_DMG=14, DROP_R=34, DROP_G=1600;
function lampX(t,T){ return LAMP_X0+LAMP_AMP*Math.sin(2*Math.PI*t/T); }
function mkLamp(T){ return {type:"lamp",T:+T||6,t:0,warnHot:false}; }
function dropLandY(x){ var best=GY; for(var i=0;i<PLATFORMS.length;i++){ var p=PLATFORMS[i];
 if(p.y>0&&p.y<best&&x>=p.x-8&&x<=p.x+p.w+8)best=p.y; } return best; }
function mkDrop(x,lead){ x=clamp(x,24,W-26); return {type:"drop",x:x,lead:+lead||0,t:0,phase:"warn",y:-40,vy:0,landY:dropLandY(x),hit:false}; }
function dropBurst(xs,stagger){ stagger=stagger==null?0.35:+stagger;
 for(var i=0;i<xs.length;i++)traps.push(mkDrop(xs[i],i*stagger)); }
/* 墙压（Boss 招，d2 §6 招表；Loop4 灰盒）：板 52×64 自 y60 落至 GY，停 1.2s、0.5s 收回；
 预警 0.9s：地面 x±40 阴影闪 3 次＋预警音（抬手＝Boss 在场时由 drawBoss 表现）；
 危险带＝板 x±26（落到位的瞬间＋停留期判定一次）；伤 20；安全法＝横走/冲刺跨过（跳无效：自上而下）。 */
var PRESS_WARN=0.9, PRESS_DMG=20, PRESS_HALF=26, PRESS_W=52, PRESS_H=64,
    PRESS_TOP=60, PRESS_SPD=1600, PRESS_STAY=1.2, PRESS_BACK=0.5;
function mkPress(x){ x=clamp(x,60,900); var landY=GY-PRESS_H;
 return {type:"press",x:x,t:0,phase:"warn",y:PRESS_TOP,landY:landY,vy:0,hit:false}; }
function updTraps(dt){ for(var i=traps.length-1;i>=0;i--){ var t=traps[i]; t.t+=dt;
 if(t.type==="lamp"){
  var bx=lampX(t.t,t.T), wx=lampX(t.t+LAMP_WARN,t.T), d=Math.abs(wx-player.x);
  if(d<LAMP_HIT&&!t.warnHot){ t.warnHot=true; AudioSys.play("warn_lamp"); }
  else if(d>90)t.warnHot=false;
  if(player.y>450&&Math.abs(player.x-bx)<LAMP_HIT)damagePlayer(LAMP_DMG, player.x<bx?-1:1);
 } else if(t.type==="drop"){
  var lt=t.t-t.lead; if(lt<0)continue;
  if(t.phase==="warn"){ if(!t.warnPlayed){ t.warnPlayed=true; AudioSys.play("warn_drop"); } if(lt>=DROP_WARN){ t.phase="fall"; } } /* W4.1（A3）：警示音移到预警窗起点（音前量 0.7s→0），机制不变 */
  else if(t.phase==="fall"){ t.vy+=DROP_G*dt; t.y+=t.vy*dt;
   if(!t.hit){ var nx=clamp(t.x,player.x-14,player.x+14), ny=clamp(t.y,player.y-46,player.y);
    if((t.x-nx)*(t.x-nx)+(t.y-ny)*(t.y-ny)<DROP_R*DROP_R){ t.hit=true; damagePlayer(DROP_DMG, player.x<t.x?-1:1); } }
   if(t.y>=t.landY){ hitBurst(t.x,t.landY-10,"propLand","#ffcf7a"); AudioSys.play("land"); traps.splice(i,1); } }
 } else if(t.type==="press"){
  if(t.phase==="warn"){ if(!t.warnPlayed){ t.warnPlayed=true; AudioSys.play("warn_press"); } if(t.t>=PRESS_WARN){ t.phase="slam"; } } /* W4.1（A3）：音前量 0.9s→0（听到在手落之前） */
  else if(t.phase==="slam"){ t.y+=PRESS_SPD*dt;
   if(t.y>=t.landY){ t.y=t.landY; t.phase="stay"; t.t=0; addTrauma(0.25);
    hitBurst(t.x,GY-8,"pressLand","#ffd76a"); AudioSys.play("land"); } }
  else if(t.phase==="stay"){ if(t.t>=PRESS_STAY){ t.phase="back"; } }
  else if(t.phase==="back"){ t.y-=(t.landY-PRESS_TOP)/PRESS_BACK*dt;
   if(t.y<=PRESS_TOP){ traps.splice(i,1); continue; } }
  if(t.phase==="stay"){ if(!t.hit&&player.y>420&&Math.abs(player.x-t.x)<PRESS_HALF){ /* W4：加 y 带（站台箱 y≤420 免——地面墙压不判台上；与 rule R2 同口径；地面 GY=470 照中） */
   t.hit=true; damagePlayer(PRESS_DMG, player.x<t.x?-1:1); } }
 } } }

/* ============ Boss 灰盒（d2 §6 终幕＋§9 第④步；BossNarrativeController＝旁白点名件） ============
 实体：独立（不进 enemies ⇒ 不混清场判定，d2 §6 工程注意；另加 world.arena="boss" 门兜底）。
 站位：T3（y=300、x 790–866 中心 828；落位走 dropLandY ⇒ 有无 T3 都成立）；命中带沿用敌式（:271 同算式）
 ⇒ 必须与 Boss 同台面才打得到（上 T3）。
 近身保命招＝场记板横挥（红参数 windup 0.5s／伤 18）＝一闪靶（perfectDodge :288 同路径的 Boss 版）。
 招序/间隔/阶段从 ACTS[5].boss 数据读（castOrder＝Loop4 加的机器可读字段，order 字符串保留给人读）。
 BossNarrativeController（Idle/Taunting/Enraged）：spawn→idle；Boss 在场时玩家死亡→taunting；hp≤40→enraged。
 转移即 Narr.fire：boss_intro/boss_half/boss_low/boss_defeat（台词在外置表 assets/narrator-lines.*，禁硬编码）。
 灰盒决策（d2 未定处，写明）：墙压落点＝施放瞬间 player.x；灯扫＝T=4.2 常驻一顶（已有则不重复）；
 雨＝玩家±140 三点＋T3 台面点 828（d2 §6「3 地面点＋1 台面点」）；招循环在 active 期间持续推进（不做索敌开关）。 */
var BOSS_WINDUP=0.5, BOSS_MELEE_DMG=18, BOSS_PARRY=26;
var boss={active:false,dead:false,x:828,y:GY,hp:0,maxHp:0,phase:1,narr:"off",state:"wait",
 t:0,atkT:0,ci:0,dir:-1,flash:0,struck:false,once:{}};
/* D-6 Boss 视效（Loop D）：渲染位拖尾快照（updBoss 内 push＝冻结停；只存渲染偏移渲染层用，逻辑坐标不动） */
var bossTrail=[];
function hasTrap(kind){ for(var i=0;i<traps.length;i++)if(traps[i].type===kind)return true; return false; }
function lampT(){ for(var i=0;i<traps.length;i++)if(traps[i].type==="lamp")return traps[i].t; return -1; } /* W3：灯带相位读出（同拍落物与探针用） */
function setBossNarr(s){ if(boss.narr!==s)boss.narr=s; }
function spawnBoss(x){ var Bd=ACTS[5].boss;
 boss.active=true; boss.dead=false; boss.maxHp=Bd.hp; boss.hp=Bd.hp;
 boss.x=clamp(x==null?Math.round((Bd.x0+Bd.x1)/2):x,60,900); boss.y=dropLandY(boss.x);
 boss.phase=1; boss.state="wait"; boss.t=0; boss.atkT=1.2; boss.ci=0; boss.dir=-1; boss.flash=0; boss.once={};
 bossTrail.length=0;
 world.arena="boss"; setBossNarr("idle"); Narr.fire("boss_intro"); setCp("boss_intro"); setCp("a4_p1"); } /* W4：a4_p1＝入场同帧（p1 门 hp120＝开场） */
function clearBoss(){ boss.active=false; boss.dead=false; boss.hp=0; boss.state="wait"; boss.once={}; bossTrail.length=0;
 world.arena="prologue"; setBossNarr("off"); }
function bossDefeat(){ boss.dead=true; boss.state="down"; boss.t=0;
 Narr.fire("boss_defeat"); AudioSys.play("clear"); addTrauma(0.5); world.slowT=0.6;
 hitBurst(boss.x,boss.y-46,"bossDown","#ffd76a");
 /* W4 尾链：a4_down → 收灯（d2 §3「灯可以收了」）→ 2.2s 后开 spare 窗口（收手/补刀；判定树见结局系统块） */
 setCp("a4_down");
 for(var td=traps.length-1;td>=0;td--)if(traps[td].type==="lamp")traps.splice(td,1);
 schedule(2.2,openSpare); }
function hitBoss(dmg,dir,o){ if(!boss.active||boss.dead)return; boss.hp-=dmg; boss.flash=0.12;
 world.hitstop=Math.min(0.12,Math.max(world.hitstop,(o&&o.hs)||0.045)); addTrauma((o&&o.sh)||0.2);
 hitBurst(boss.x,boss.y-46,"bossHit","#ffd76a"); spawnRing(boss.x,boss.y-46,"#ffffff",0.16);
 AudioSys.play(o&&o.step===3?"hit3":(o&&o.step===2?"hit2":"hit1"));
 player.combo++; player.comboT=2.5; if(player.combo>world.maxCombo)world.maxCombo=player.combo; if(player.combo===3)Narr.fire("combo_praise");
 bossTick(); }
function bossTick(){ if(!boss.active||boss.dead)return; var PH=ACTS[5].boss.phases;
 if(boss.hp<=0){ boss.hp=0; bossDefeat(); return; }
 if(boss.phase<2&&boss.hp<=PH[1].hp[0]){ boss.phase=2; Narr.fire("boss_half"); setCp("a4_p2"); /* W4：阶段门即检查点 */
  var mn=PH[1].minions;
  if(mn&&!boss.once.p2){ boss.once.p2=true;
   for(var i=0;i<mn.length;i++)enemies.push(mkEnemy(mn[i].k,mn[i].x)); } }
 if(boss.phase<3&&boss.hp<=PH[2].hp[0]){ boss.phase=3; Narr.fire("boss_low"); setBossNarr("enraged"); setCp("a4_p3"); } }
function bossParry(){ var P=player; P.facing=boss.x>P.x?1:-1;
 world.slowT=0.5; P.iframes=0.6; P.invuln=0.6; P.perfDodges++;
 AudioSys.play("perfect"); spawnRing(P.x,P.y-28,"#aef6ff",0.4); hitBurst(boss.x,boss.y-46,"parry","#aef6ff");
 hitBoss(BOSS_PARRY,P.facing,{hs:0.09,sh:0.6,step:3}); Narr.fire("perfect_dodge"); }
function bossCast(){ var PH=ACTS[5].boss.phases, ord=PH[boss.phase-1].castOrder; if(!ord||!ord.length)return;
 var name=ord[boss.ci%ord.length]; boss.ci++;
 if(name==="press")traps.push(mkPress(player.x));
 else if(name==="lamp"){ if(!hasTrap("lamp"))traps.push(mkLamp(4.2)); }
 else if(name==="rain"){ var px=clamp(player.x,60,900);
  dropBurst([clamp(px-140,24,W-26),px,clamp(px+140,24,W-26),828],0.35); } }
function updBoss(dt){ if(!boss.active)return; var B=boss,P=player,PH=ACTS[5].boss.phases;
 B.flash=Math.max(0,B.flash-dt);
 /* D-6 拖尾采样：渲染位（含暴怒抖动/漂浮偏移）位移超阈值即记一帧，容量 trailN；world.t 驱动 ⇒ 冻结停 */
 if(!B.dead){ var BF6=ART.bossFx, shkT=(B.narr==="enraged")?Math.sin(world.t*BF6.shakeSpd)*BF6.shakeAmp:0,
  flT=Math.sin(world.t*BF6.floatSpd)*BF6.floatAmp;
  var lt6=bossTrail.length?bossTrail[bossTrail.length-1]:null;
  if(!lt6||Math.abs(lt6.x-(B.x+shkT))>BF6.trailHop||Math.abs(lt6.y-(B.y+flT))>BF6.trailHop){
   bossTrail.push({x:B.x+shkT,y:B.y+flT});
   if(bossTrail.length>BF6.trailN)bossTrail.shift(); } }
 if(B.dead){ B.t+=dt; bossTrail.length=0; return; }
 var sameBand=Math.abs((B.y-23)-(P.y-27))<48, adx=Math.abs(P.x-B.x);
 if(B.state==="wait"){
  if(world.phase==="playing"){ B.atkT-=dt;
   if(B.atkT<=0){ bossCast(); B.atkT=PH[B.phase-1].gap; }
   if(sameBand&&adx<58){ B.state="wind"; B.t=0; B.dir=P.x>B.x?1:-1; } } }
 else if(B.state==="wind"){ B.t+=dt; if(B.t>=BOSS_WINDUP){ B.state="strike"; B.t=0; B.struck=false; } }
 else if(B.state==="strike"){ B.t+=dt;
  if(!B.struck&&world.phase==="playing"){
   if(Math.abs(P.x-(B.x+B.dir*26))<36&&Math.abs((P.y-27)-(B.y-23))<48){ B.struck=true;
    if(P.dashT>0&&P.iframes>0)bossParry(); else damagePlayer(BOSS_MELEE_DMG,B.dir); } }
  if(B.t>=0.2){ B.state="rec"; B.t=0; } }
 else if(B.state==="rec"){ B.t+=dt; if(B.t>=0.5)B.state="wait"; } }

/* ============ W4 终幕结局系统（d2 §6 尾段／§7 A4 链；d3 ending_a-d 文本；d7 finale→endcard） ============
   链：boss_defeat[a4_down]→2.2s→spare 窗口（spare_prompt[a4_choice]；按 J＝补刀／静候满窗＝收手）
     →spare_taken/finish_taken→结局判定→end_x 检查点→ending_x 分镜连发（同键按档序；轮询器＝播完接下一句，
     零吞句——Narr.fire 同键会打断当前句，硬间隔会被吞）→「完」仪式（Loop8 ceremony_final 复用）→杀青卡。
   结局判定树（灰盒决策：文档只到「收手/补刀→a/b/c/d」为止、细则全库无载体，本轮钉死并登记 registry）：
     d（攻击命中墙累计≥9「敲够九下」）＞ a（deaths===0「一条过」）＞ 收手 c（合约重签）／补刀 b（都散了）。
   开窗 1.2s 内不吃补刀键＝防末击连按误触（Boss 死后玩家常仍在连打）。 */
var SPARE_WIN=6.0;
function openSpare(){ if(!world.started)return; if(world.spare||world.ending)return;
 if(world.phase==="dead"){ schedule(0.5,openSpare); return; } /* W4.1（A1）：boss_defeat→开窗的 2.2s 死亡窗 ⇒ 重试（复活尾补开见 respawn） */
 if(world.phase!=="playing")return;
 world.spare={open:true,t:0};
 setCp("a4_choice"); Narr.fire("spare_prompt"); }
function endingId(spared){
 if(world.wallHits>=9)return "end_d";
 if(world.deaths===0)return "end_a";
 return spared?"end_c":"end_b"; }
function endingKey(id){ return "ending_"+id.replace("end_",""); } /* d3 旁白键真名＝ending_a..d（无 end_ 双前缀）；W4 探针抓出：初版 fire("ending_"+id)⇒键不存在・分镜静默跳仪式（log 计数 0） */
function beginEnding(spared){ var id=endingId(spared);
 world.spare=null; world.ending={id:id,spared:!!spared,stage:"lines",fired:0,t:0,gap:1.0};
 setCp(id); /* cp＝结局 id 本名（end_a/b/c/d）；W4 探针抓出：初版写 "end_"+id ⇒ cp 变 "end_end_c" */
 if(world.ended.indexOf(id)<0)world.ended.push(id);
 Narr.fc[endingKey(id)]=0; /* 分镜第 1 档起（fc 跨局累计不清 ⇒ 不清则重开一局直接封顶播末档） */
 Narr.fire(spared?"spare_taken":"finish_taken");
 saveWrite(); } /* W4.1（A7）：ended 落盘（收集跨 reload 成立；与杀青卡收集栏 B 批配套） */
function updFinale(dt){ if(!world.started||world.phase!=="playing")return;
 if(world.spare&&world.spare.open){ var S=world.spare; S.t+=dt;
  if(S.t>=1.2&&justDown(ATKK))beginEnding(false); /* 按 J＝补刀 */
  else if(S.t>=SPARE_WIN)beginEnding(true); } /* 静候满窗＝收手 */
 var E=world.ending; if(!E)return; E.t+=dt; if(E.gap>0)E.gap-=dt;
 if(E.stage==="lines"){ /* 分镜连发：上一句播完（cur/queue 清空）且间隔到点 ⇒ 发下一档 */
  var ekey=endingKey(E.id); var def=(Narr.data&&Narr.data[ekey])||null, N=(def&&def.tiers&&def.tiers.length)||0;
  if(N>0&&E.gap<=0&&E.fired<N&&!Narr.cur&&Narr.queue.length===0){ Narr.fire(ekey); E.fired++; E.gap=0.7; }
  if(N===0||E.fired>=N){ if(!Narr.cur&&Narr.queue.length===0){ E.stage="cer"; stageCeremony(); } } }
 else if(E.stage==="cer"){ if(!STG.cer){ E.stage="card"; STG.card={t:0}; world.showRestart=true;
  var tr=document.getElementById("t-restart"); if(tr)tr.classList.add("on"); } } }

/* ============ 世界流程 ============ */
/* ============ ACTS：幕/遭遇数据表（review-v02/d2-levels/design.md §3） ============
 ★序章（ACTS[1]）＝现行为逐值落表（d2 §5「逐值落表，不改行为」）：W1 红×2 800/880（x>420）；
   W2 红×1紫×2 740/830/900，玩家>480 时 ±270 镜像；清后 1.2s（T-DELAY）；清场链 0.7s／2.2s 同表。
 2+ 幕＝照 §3 落数据（W1 起逐幕接线：ACTS[2] 第一幕已通）；触发器 kinds：zone／delay(T-DELAY)／curtain／stand(T-STAND)。
 2+ 幕总则 rule：锚点起 90px 间距、钳[60,900]；队员距玩家<260px 整队镜像玩家另一侧；R2＝玩家站台箱(y≤420)时安全距放宽 140px。
 序章 mirror 上界 934 无钳（=现公式逐字），2+ 幕按 rule.clamp 钳——§5 序章不改行为优先。 */
var ACTS={
 1:{name:"序章",stage:"playable",
  encounters:[
   {id:"W1",spawns:[{k:"red",x:800},{k:"red",x:880}],trigger:{type:"zone",x:420}},
   {id:"W2",spawns:[{k:"red",x:740},{k:"purple",x:830},{k:"purple",x:900}],trigger:{type:"delay",after:1,t:1.2},
    mirror:{at:480,offsetRight:270,span:180,rightLimit:934,flipOffset:450,lowerClamp:60,gap:90}}],
  chain:{clearDelay:0.7,outroDelay:2.2}},
 2:{name:"第一幕",stage:"playable",card:"第一幕 · 对峙",rule:{gap:90,safeDist:260,standSafeDist:140,clamp:[60,900]},
  plats:[{x:300,y:420,w:64,h:50},{x:500,y:390,w:64,h:80},{x:780,y:300,w:96,h:170}], /* d2 §3 台箱表：T1/T2 单跳可上；T3(顶300) 二段跳必经 */
  encounters:[
   {id:"E1-1",anchor:760,spawns:[{k:"red",x:760},{k:"red",x:850}],trigger:{type:"curtain",t:1.5},note:"从右来"},
   {id:"E1-2",anchor:60,spawns:[{k:"purple",x:60},{k:"purple",x:150},{k:"red",x:240}],trigger:{type:"delay",after:1,t:1.5},note:"左台后；红/紫次序照 §3 字面"},
   {id:"E1-3",anchor:460,spawns:[{k:"purple",x:460},{k:"purple",x:550},{k:"elite",x:640}],trigger:{type:"stand",x0:780,x1:876,y:300},note:"R2 生效；T-STAND＝站上 T3（逼下台应战）；次序照字面"}]},
 3:{name:"第二幕",stage:"playable",card:"第二幕 · 加码",rule:{gap:90,safeDist:260,standSafeDist:140,clamp:[60,900],onScreen:"3→4"}, /* W2：接线（砌墙规则见 updWorld 二幕块） */
  plats:[{x:210,y:420,w:64,h:50},{x:650,y:390,w:64,h:80}], /* W2：d2 §3 台箱表 T1′/T2′——教学空场 x∈[340,620] 无箱、两侧冲刺位≥200 */
  encounters:[
   {id:"A2-1",anchor:480,spawns:[{k:"red",x:480}],trigger:{type:"curtain",t:1.2},note:"一闪教学；教学空场 x∈[340,620] 无箱、两侧各留≥200px 冲刺位"},
   {id:"A2-2",anchor:760,spawns:[{k:"red",x:760},{k:"purple",x:850},{k:"purple",x:900}],trigger:{type:"delay",after:1,t:2.0},note:"次序照 §3 字面"},
   {id:"A2-3",anchor:60,spawns:[{k:"red",x:60},{k:"red",x:150},{k:"purple",x:760},{k:"purple",x:850}],trigger:{type:"delay",after:2,t:2.0},note:"两线夹击 左60/150＋右760/850（玩家预期 x≈300–500）；两线分配照字面"}],
  wallRule:{during:"arena",triggerX:190,warn:0.6,maxPerFight:1}},
 4:{name:"第三幕",stage:"playable",card:"第三幕 · 翻脸",rule:{gap:90,safeDist:260,standSafeDist:140,clamp:[60,900],onScreen:"3→4"}, /* W3：接线 */
  plats:[{x:210,y:420,w:64,h:50},{x:650,y:390,w:64,h:80}], /* W3：沿用 T1′/T2′（d2 §3）；T3 不进场——幕终「搭台」升起（T3_PLAT） */
  lamp:{T:6.0}, /* W3：灯带全程开（d2 §3 A3-1 注「灯带全程开 T=6.0s」／§4 机关表） */
  encounters:[
   {id:"A3-1",anchor:760,spawns:[{k:"purple",x:760},{k:"purple",x:850},{k:"red",x:900}],trigger:{type:"curtain",t:1.2},note:"灯带全程开 T=6.0s（W3 接线）；次序照字面"},
   {id:"A3-2",anchor:60,spawns:[{k:"red",x:60},{k:"red",x:150},{k:"purple",x:760},{k:"purple",x:850}],trigger:{type:"delay",after:1,t:1.5},drops:{points:[300,480,660],stagger:0.9,waves:2},note:"同拍落物 3 点 300/480/660 错峰 0.9s（W3 接线）；灰盒决策：错峰取 d2 §3 字面 0.9（§4 的 0.35 系「同波」默认参数）；波数 2＝§4；触拍＝灯带周期过界（同拍）"},
   {id:"A3-3",anchor:60,spawns:[{k:"red",x:60},{k:"purple",x:150},{k:"purple",x:240}],trigger:{type:"delay",after:2,t:1.5},wall:{breakable:true,hp:32},note:"锚60＋砌墙(breakable)；墙倒前清场链不开墙；次序照字面"}]},
 5:{name:"终幕",stage:"playable",card:"终幕 · 杀青", /* W4：终幕接线（Boss 战全链＋结局 a-d） */
  plats:[{x:300,y:420,w:64,h:50},{x:500,y:390,w:64,h:80},{x:780,y:300,w:96,h:170}], /* W4：终幕＝第一幕全布局（d2 §3 终行「＝第一幕全布局(300/500/780)＋Boss 站 T3」）——startAct 集会重建；T3 三幕幕终已升起 ⇒ 同坐标替换无感 */
  encounters:[], /* W4：终幕无常规遭遇（编队＝Boss＋p2 一次性 2 红）——空数组＝清场链/startAct 安全落空（Boss 战不走遭遇链） */
  boss:{hp:120,standOn:"T3",x0:790,x1:866,y:300,band:"沿用命中带（必须上 T3 才打得到）",
   phases:[{id:"p1",hp:[120,80],order:"墙压→灯扫",castOrder:["press","lamp"],gap:1.6,minions:[]},
    {id:"p2",hp:[80,40],order:"灯扫＋道具雨连携",castOrder:["lamp","rain"],gap:1.6,minions:[{k:"red",x:60},{k:"red",x:150}],once:true},
    {id:"p3",hp:[40,0],order:"墙压＋雨＋灯扫",castOrder:["press","rain","lamp"],gap:1.2,minions:[]}],
   tail:"boss_defeat→spare_prompt→ending_a/b/c/d"}}};
/* 触发器判定：zone/stand 可轮询；delay/curtain 由 schedule 计时承载、不进本判定（返回 false）。
   stand（T-STAND）＝着地且脚 y≤位点顶+2 且 x 在位点段内。当前序章只用 zone/delay；stand 供 2+幕接线时调用。 */
function triggerCheck(tr){ if(!tr||!tr.type)return false;
 if(tr.type==="zone")return player.x>tr.x;
 if(tr.type==="stand")return player.grounded&&player.y<=tr.y+2&&player.x>=tr.x0&&player.x<=tr.x1;
 if(tr.type==="bosshp"){ if(!boss.active||boss.dead)return false;
  if(tr.lte!=null&&boss.hp>tr.lte)return false;
  if(tr.gte!=null&&boss.hp<tr.gte)return false; return true; }
 return false; }
function encSpawnX(enc,i,a){ var ex=enc.spawns[i].x, m=enc.mirror;
 if(m&&player.x>m.at){ var b=player.x+m.offsetRight; if(b+m.span>m.rightLimit)b=player.x-m.flipOffset; ex=Math.max(m.lowerClamp,b+m.gap*i); return ex; }
 var R=a&&ACTS[a]&&ACTS[a].rule; /* 2+ 幕规则镜像：任一队员距玩家<安全距 ⇒ 整队镜像玩家另一侧（锚点反射＋原间距）；R2=玩家站台箱(y≤420)放宽 */
 if(R){ var safe=(player.grounded&&player.y<=420)?R.standSafeDist:R.safeDist, mind=1e9, j;
  for(j=0;j<enc.spawns.length;j++){ var dd=Math.abs(enc.spawns[j].x-player.x); if(dd<mind)mind=dd; }
  if(mind<safe){ var anchor=(enc.anchor!=null)?enc.anchor:enc.spawns[0].x, nA=2*player.x-anchor;
   ex=clamp(nA+(enc.spawns[i].x-anchor),R.clamp[0],R.clamp[1]); } }
 return ex; }
function spawnEncounter(a,n){ var enc=ACTS[a].encounters[n-1], born=[];
 for(var i=0;i<enc.spawns.length;i++){ var x=encSpawnX(enc,i,a); born.push({k:enc.spawns[i].k,x:x}); enemies.push(mkEnemy(enc.spawns[i].k,x)); }
 world.lastSpawn={act:a,id:enc.id,born:born}; }
function spawnWave(n,silent){ if(!silent){ Narr.fire("wave"+n+"_start");
  var nm={1:"序章 · 第1镜",2:"序章 · 第2镜"}[n]; if(nm)stageAct(nm); } /* d1 §28 降级：序章波牌＝「序章·第N镜」（幕牌让给五幕）；respawnWave(silent) 不重复盖卡 */
 world.wave=n; world.idleCombatFired=false; world.lastEnemyFired=false;
 spawnEncounter(1,n); }
function respawnWave(){ enemies.length=0;
 if(world.act===1){ spawnWave(world.wave,true); return; } /* 序章原路径 */
 var a=world.act, i=Math.max(1,world.enc); spawnEncounter(a,i); /* 2+幕：同遭遇原索引重生成（rule 镜像按重生时玩家位重算） */
 world.wave=i; world.idleCombatFired=false; world.lastEnemyFired=false; world.encPhase="fight"; }
/* —— 幕通用机（W1：ACTS[2] 第一幕；d2 §3／§7）—— */
function setPlatformsData(list){ PLATFORMS.length=0; if(list)for(var i=0;i<list.length;i++){ var p=list[i];
 PLATFORMS.push({x:+p.x,y:+p.y,w:+p.w,h:+(p.h||16)}); } }
var CP_MAP={ /* registry.checkpoints（d2 §7 链）逐幕映射；W1 实通 ACTS[2] */
 2:{open:null,enc:["a1_e1","a1_e2","a1_e3"],end:"a1_end"},
 3:{open:"act2_open",enc:["a2_teach","a2_a1","a2_a2"],end:"a2_end"},
 4:{open:"act3_open",enc:["a3_1","a3_2","a3_3"],end:"a3_end"},
 5:{open:"act4_open",enc:["boss_intro","a4_p1","a4_p2","a4_p3"],end:"a4_down"}};
var T3_PLAT={x:780,y:300,w:96,h:170}, T3BUILD_DUR=1.6; /* W3：幕终「搭台」升起的目标台箱（d2 §3 T3 规格同第一幕）＋升起时长 */
function startAct(n){ var A=ACTS[n]; if(!A)return;
 world.act=n; world.enc=0; world.encPhase="idle"; world.encIdleT=0; world.actHold=false; world.continueReady=false;
 world.cleared=false; world.advancing=false; world.wave=0; world.wave1Started=true; world.inZone=false; world.pendingWall=false; world.wallWarnT=null; world.wallUsedEnc=null; wall.pendingOpen=false;
 world.idleCombatFired=false; world.lastEnemyFired=false; world.lastSpawn=null; world.eliteIntroFired=false; world.eliteNudgeT=0;
 STG.cer=null; STG.t3build=null; /* 接幕撤销结局仪式/搭台残留（玩家读过就按 J 时防叠画；W3：T3 升满后已入 PLATFORMS，登场次即撤演出层） */
 world.showRestart=false; /* W1：开拍＝战斗态，收起「再来一次」提示与 ⟳ 按钮（基线泄漏：outro 置位后不清会全程挂着） */
 var tr0=document.getElementById("t-restart"); if(tr0)tr0.classList.remove("on");
 setPlatformsData(A.plats);
 if(A.lamp){ world.lampPeriod=A.lamp.T; if(!hasTrap("lamp"))traps.push(mkLamp(A.lamp.T)); } /* W3：灯带全程开（进场即亮；幕终收灯见 actEnd(4)） */
 if(A.card)stageAct(A.card);
 var cpm=CP_MAP[n]; if(cpm&&cpm.open)setCp(cpm.open);
 var ok={3:"act2_open",4:"act3_open",5:"act4_open"}[n]; if(ok)Narr.fire(ok); /* d3 幕开场词（接线到该幕时有键才出声） */
 var tc=document.getElementById("t-continue"); if(tc)tc.classList.remove("on");
 var e0=A.encounters[0], tg=e0&&e0.trigger; /* 首遭遇：curtain/delay＝schedule；zone/stand＝updWorld 轮询 */
 if(tg&&(tg.type==="curtain"||tg.type==="delay"))schedule(tg.t,function(){ if(world.act===n&&world.encPhase==="idle"&&world.enc===0)spawnActEncounter(n,1); });
 if(A.boss)schedule(2.0,function(){ if(world.act===n&&world.arena!=="boss"&&!boss.active)spawnBoss(); }); } /* W4：终幕 Boss 入场（幕卡 1.7s 收后下场；boss_intro/a4_p1 cp 在 spawnBoss 内） */
function spawnActEncounter(a,i){ var enc=ACTS[a].encounters[i-1]; if(!enc)return;
 spawnEncounter(a,i);
 world.enc=i; world.encPhase="fight"; world.wave=i; world.wallUsedEnc=null; /* W2：新一场＝砌墙配额重置（d2 §3 每场最多 1 次） */
 world.idleCombatFired=false; world.lastEnemyFired=false;
 var cpm=CP_MAP[a]; if(cpm&&cpm.enc[i-1])setCp(cpm.enc[i-1]);
 if(enc.wall&&enc.wall.breakable){ /* W3：A3-3 开场即起可拆墙（d2 §3 wall:{breakable,hp32}；sideRight 照砌墙写法=玩家在右） */
  wall.hp=enc.wall.hp|0; wall.breakable=true; wall.breaking=false; wall.rising=true; wall.h=0.01; wall.sideRight=player.x>150;
  Narr.fire("wall_build"); AudioSys.play("wall"); }
 if(enc.drops){ world.dropWavesLeft=enc.drops.waves|0; world.dropWavesFired=0; /* W3：落物配额（本场 2 波；随场重置） */
  world.lampCycle=Math.floor(lampT()/world.lampPeriod); } }
function actEnd(a){ world.encPhase="hold"; world.actHold=true;
 var cpm=CP_MAP[a]; if(cpm&&cpm.end)setCp(cpm.end);
 var ek={2:"act1_end",3:"act2_end",4:"act3_end"}[a]; if(ek)Narr.fire(ek); /* 幕终口播（W1 act1_end＝d2 幕终「意外地好」字面；W2 act2_end＝d1:23 幕终「清场即拆景、他亲自撤墙」字面；W3 act3_end＝d1:24 幕终「砸场记板『重拍！全部重拍！』」字面） */
 if(a===4){ /* W3：幕终演出「搭台」——场务收灯＋T3 自地槽升起（d2 §3 台箱表 T3；终幕 Boss 台面） */
  for(var ti=traps.length-1;ti>=0;ti--)if(traps[ti].type==="lamp")traps.splice(ti,1);
  STG.t3build={t:0,done:false}; }
 var na=a+1;
 world.showRestart=true; /* W1：幕终＝驻留等玩家（R 重开可用、⟳ 按钮上屏；下一幕接线时与 continueReady 同屏） */
 var tr2=document.getElementById("t-restart"); if(tr2)tr2.classList.add("on");
 if(ACTS[na]&&ACTS[na].stage==="playable"){ world.continueReady=true;
  var tc=document.getElementById("t-continue"); if(tc)tc.classList.add("on"); } }
function startNextAct(){ if(!world.continueReady)return false;
 if(world.phase!=="playing")return false; /* W1：死亡/标题态不开拍（护 keydown 与 ▶ 按钮两入口） */
 var na=world.act+1;
 if(!ACTS[na]||ACTS[na].stage!=="playable")return false;
 world.continueReady=false;
 var tc=document.getElementById("t-continue"); if(tc)tc.classList.remove("on");
 startAct(na); return true; }
function updWorld(dt,rdt){ world.t+=rdt;
 for(var i=world.timers.length-1;i>=0;i--){ var tm=world.timers[i]; tm.t-=dt; if(tm.t<=0){ world.timers.splice(i,1); tm.fn(); } }
 if(just["KeyA"]||just["KeyD"]||just["Space"]||just["KeyJ"]||just["KeyK"]||just["ArrowLeft"]||just["ArrowRight"]||just["ArrowUp"]||just["KeyW"]||just["KeyZ"]||just["KeyX"]||just["tleft"]||just["tright"]||just["tjump"]||just["tatk"]||just["tdash"]){ world.lastInput=world.t; world.idleIdx=0; }
 if(world.phase!=="playing")return;
 if(!world.wave1Started&&player.x>420){ world.wave1Started=true; Narr.fire("obey_enter"); if(world.defyLeft>=2)Narr.fire("return_obedient"); spawnWave(1,false); setCp("wave1"); }
 if(!world.wave1Started&&world.t>7&&(world.lastGuide===0||world.t-world.lastGuide>12)){ world.lastGuide=world.t; Narr.fire("guide_right"); }
 if(!world.firstMoveFired&&Math.abs(player.vx)>40){ world.firstMoveFired=true; Narr.fire("first_move"); }
 if(world.wave>0&&!world.cleared&&aliveEnemies()===1&&!world.lastEnemyFired){ world.lastEnemyFired=true; Narr.fire("last_enemy"); }
 if(world.act===1&&world.wave>0&&!world.cleared&&!world.advancing&&aliveEnemies()===0&&world.arena!=="boss"){
  world.advancing=true;
  if(world.wave===1)schedule(ACTS[1].encounters[1].trigger.t,function(){ world.advancing=false; spawnWave(2,false); setCp("wave2"); });
  else if(world.wave===2)schedule(ACTS[1].chain.clearDelay,function(){ world.cleared=true; setCp("arena_cleared"); Narr.fire("arena_cleared"); AudioSys.play("clear"); stageCeremony(); /* Loop8：结局仪式取代「完 · 一条过」幕卡 */
    if(wall.built)openWall();
    schedule(ACTS[1].chain.outroDelay,function(){ Narr.fire("outro"); setCp("outro"); world.showRestart=true;
      var tr=document.getElementById("t-restart"); if(tr)tr.classList.add("on");
      if(ACTS[2]&&ACTS[2].stage==="playable"){ world.continueReady=true; /* W1：下一幕已接线 ⇒ 开「按 J 开拍」闸 */
       var tc=document.getElementById("t-continue"); if(tc)tc.classList.add("on"); } }); }); }
 /* —— 2+ 幕遭遇链（W1：第一幕）：fight→清→(delay/curtain=schedule｜zone/stand=轮询)→下一遭遇；链尽=actEnd —— */
 if(world.act>=2&&!world.actHold){ var encs=ACTS[world.act].encounters;
  if(world.encPhase==="idle"&&world.enc<encs.length){ world.encIdleT=(world.encIdleT||0)+dt; var tr2=encs[world.enc].trigger;
   if(tr2&&(tr2.type==="zone"||tr2.type==="stand")&&(triggerCheck(tr2)||(tr2.type==="stand"&&world.encIdleT>=25)))spawnActEncounter(world.act,world.enc+1); } /* W4.1（A2）：stand 静置 25s 强推——E1-3 软锁兜底（玩家不站 T3 也能续幕；配 drawT3Guide 提示） */
  else if(world.arena!=="boss"&&world.encPhase==="fight"&&aliveEnemies()===0){ /* W4：Boss 战清场门（d2 §6 工程注意：Boss/小兵不得混清场判定；与序章门同款兜底） */
   var encNow=encs[world.enc-1];
   if(encNow&&encNow.wall&&encNow.wall.breakable&&(wall.built||wall.rising)){ /* W3：A3-3「墙倒前清场链不开墙」（d2 §3 字面）——不自动开、不升满兜底、不推进；墙由三连击拆倒（breaking 期 built 仍 true ⇒ 崩落走完才推进） */ }
   else { if(wall.built)openWall(); else if(wall.rising)wall.pendingOpen=true; /* W2：d2 §3 清场自动开（墙还在升 ⇒ 升满再开） */ var nxt=world.enc+1;
    if(nxt>encs.length){ actEnd(world.act); }
    else { var tg2=encs[nxt-1].trigger;
     if(!tg2||tg2.type==="zone"||tg2.type==="stand"){ world.encPhase="idle"; world.encIdleT=0; } /* 轮询等触发；W4.1（A2）：静置计时随新等待清零 */
     else { world.encPhase="chain"; (function(a2,i2,t2){ schedule(t2,function(){ if(world.act===a2&&world.encPhase==="chain"&&world.enc===i2-1)spawnActEncounter(a2,i2); }); })(world.act,nxt,tg2.t); } } } }
 }
 if(world.act===1&&!wall.built&&!wall.rising){ /* 序章专属砌墙（4 次门槛）；2+ 幕墙规则按幕接线（W2 第二幕 wallRule） */
  if(player.x<120)world.inZone=true;
  else if(world.inZone&&player.x>170){ world.inZone=false; world.defyLeft++; Narr.fire("defy_left");
   if(world.defyLeft>=4)world.pendingWall=true; }
  if(world.pendingWall&&player.x>220){ world.pendingWall=false; wall.rising=true; wall.h=0.01; wall.sideRight=player.x>150;
   Narr.fire("wall_build"); AudioSys.play("wall"); } }
 if(world.act>=2&&ACTS[world.act].wallRule){ var WR=ACTS[world.act].wallRule; /* W2：d2 §3 砌墙规则（二幕专属；序章块在上、原样不动） */
  if(world.encPhase==="fight"&&!wall.built&&!wall.rising&&!wall.opening&&world.wallUsedEnc!==world.enc){
   if(world.wallWarnT==null){ if(player.x<WR.triggerX)world.wallWarnT=WR.warn; }
   else { world.wallWarnT-=dt;
    if(player.x>=WR.triggerX){ world.wallWarnT=null; } /* W2：预告中途回场 ⇒ 预告撤销（d2 §3「x<190 ⇒ 0.6s 预告」＝在场连续性；配额不消耗） */
    else if(world.wallWarnT<=0){ world.wallWarnT=null;
     wall.rising=true; wall.h=0.01; wall.sideRight=player.x>150; /* sideRight 照序章规则（d2 §3「照 :332」字面） */
     world.wallUsedEnc=world.enc; Narr.fire("wall_build"); AudioSys.play("wall"); } } } }
 if(world.act===4&&world.encPhase==="fight"&&world.dropWavesLeft>0){ /* W3：A3-2 同拍落物——灯带周期过界即放一波（3 点错峰；d2 §3×§4 灰盒决策） */
  var encD=ACTS[4].encounters[world.enc-1];
  if(encD&&encD.drops&&hasTrap("lamp")){ var lt=lampT(), cyc=Math.floor(lt/world.lampPeriod);
   if(cyc>world.lampCycle){ world.lampCycle=cyc; world.dropWavesLeft--; world.dropWavesFired++;
    dropBurst(encD.drops.points,encD.drops.stagger); } } }
 var idle=world.t-world.lastInput;
 if(world.ending||(world.spare&&world.spare.open))idle=0; /* W4：结局连发/杀青卡/spare 窗口静默闲话（防 idle 旁白叠进结局分镜、卡后幽灵 blip） */
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
 player.hurtOnce=false;player.lowFired=false;player.perfDodges=0;player.stun=0;player.dashBuf=0; /* W4.1（A5）：缓冲随局清（防复位帧残留值即刻触发） */
 enemies.length=0; ghosts.length=0; bladeTrail.length=0; traps.length=0; embers.length=0; rigReset();
 wall.built=false;wall.rising=false;wall.opening=false;wall.h=0;wall.sideRight=true;wall.pendingOpen=false;wall.hp=0;wall.breakable=false;wall.breaking=false;wall.hitFlash=0;
 world.wave=0;world.cleared=false;world.advancing=false;world.showRestart=false;world.t=0;
 world.hitstop=0;world.slowT=0;world.trauma=0;world.timers.length=0;
 world.wave1Started=false;world.firstMoveFired=false;world.lastGuide=0;world.lastInput=0;world.idleIdx=0;world.idleCombatFired=false;
 world.inZone=false;world.defyLeft=0;world.pendingWall=false;world.cp="";world.cpLog.length=0;world.wallWarnT=null;world.wallUsedEnc=null;world.dropWavesFired=0;world.dropWavesLeft=0;world.lampCycle=0;world.lampPeriod=6;
 world.spare=null;world.ending=null;world.wallHits=0;world.maxCombo=0; /* W4：结局/敲墙计数随局复位（world.ended/deaths 不清＝跨局累计——与场记板 N=deaths 同源语义） */
 world.act=1;world.enc=0;world.encPhase="idle";world.encIdleT=0;world.actHold=false;world.continueReady=false;setPlatformsData(null); /* 回序章＝无台箱 */
 world.swingT=[];world.whiffT=[];world.dashT=[];world.jumpT=[];world.cdWhiff=0;world.cdAir=0;world.cdDash=0;world.cdJump=0;
 world.wallTouched=false;world.wallReplyT=0;world.lastEnemyFired=false;world.lastSpawn=null;world.eliteIntroFired=false;world.eliteNudgeT=0; /* W4.1（A4）：回声冷却戳随局清（world.t 归零 ⇒ 旧值会把回声锁住，属清单外必要偏离） */
 STG.act=null; STG.death=null; STG.cer=null; STG.t3build=null; STG.card=null; /* 演出层随局复位（titleSec 由相位自管；W3 搭台同清；W4 杀青卡同清） */
 world.arena="prologue";
 boss.active=false;boss.dead=false;boss.hp=0;boss.phase=1;boss.state="wait";boss.narr="off";
 boss.t=0;boss.ci=0;boss.flash=0;boss.once={};
 var tr=document.getElementById("t-restart"); if(tr)tr.classList.remove("on");
 var tc=document.getElementById("t-continue"); if(tc)tc.classList.remove("on"); }
function beginGame(){ world.started=true; world.phase="playing"; resetWorld();
 AudioSys.init(); AudioSys.resume(); Music.start();
 schedule(0.5,function(){ setCp("game_start"); Narr.fire("game_start"); }); }
function restart(){ resetWorld(); world.phase="playing"; Narr.stopCur(); Narr.queue.length=0; Narr.cur=null; Music.onRestart(); Narr.fire("restart_done"); setCp("restart_done"); }
function hardReset(){ Narr.reset(); Music.onRestart(); world.deaths=0; world.phase=world.started?"playing":"title"; if(world.started)resetWorld();
 else { resetWorld(); world.phase="title"; } }

/* ============ 演出层（Loop7 / d6-art P1-2：幕卡＋死亡场记板＋标题 REC；全程序绘制、零素材） ============
   空间契约（防踩旧仪器；判于 tools/verify-v026.cjs）：黑边仅 y0-46 / y494-540——(60,60) 题字像素留给
   v012-X4（46<60）、月亮 #16203a 质心带 y62-178（v011 全屏精确匹配，黑边/文字/拍板均不产该色）、
   阴影带 y463-470（v012-X6）、地面行 460-474（v025-C）全部避让。大字 y239-294（x≈290-670，不压月亮盘
   x692-808）；拍板 y136-194（避开闪白带 y200-320，否则板面亮像素会灌进 v026-C 的 flashPost 采样）。
   时间契约：幕卡 1.7s＝滑入 0.35＋持 1.0＋滑出 0.35；死拍＝闪白 0.30s（白 α0.9→0）＋"卡！"0.45s
   ＋场记板持续整个 dead 相（复活即撤）；标题 REC/时间码仅 title 相。 */
var STG={ act:null, death:null, titleSec:null, cer:null, card:null }; /* W4：card＝杀青卡（结局后统计屏） */
var ACT_IN=0.35, ACT_HOLD=1.0, ACT_OUT=0.35, ACT_TOTAL=ACT_IN+ACT_HOLD+ACT_OUT;
function stageAct(name){ if(!world.started)return; STG.act={name:name,t:0}; }
function stageDeath(n){ STG.death={n:n,t:0}; }
/* Loop8 结局仪式（d6-art P1-3）：黑边滑入0.4 → 冻结0.3 → 1帧白闪 → 完字盖印+琥珀罩 → 胶片颗粒
   → 2.2s 一条过板（与 outro「按 R」提示同窗）；4.5s 自清（v011 calm 在 cleared+8.2s，必须早于它）。 */
var CER_IN=0.40, CER_FLASH=0.70, CER_SEAL=0.72, CER_AMBER=0.16, CER_BOARD=2.20, CER_FADE0=4.20, CER_TOTAL=4.50;
var GRAIN=null;
function grainTile(){ if(GRAIN)return GRAIN; /* 128×128 预渲染噪声（每帧随机整数偏移平铺，α=0.06） */
 var c=document.createElement("canvas"); c.width=c.height=128; var g=c.getContext("2d"), id=g.createImageData(128,128);
 for(var i=0;i<id.data.length;i+=4){ var v=(Math.random()*255)|0; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; }
 g.putImageData(id,0,0); GRAIN=c; return c; }
function stageCeremony(){ if(!world.started)return; STG.cer={t:0,flashAt:-1}; }
function stgUpdate(dt){
 if(world.phase==="title"){ STG.titleSec=(STG.titleSec===null)?0:STG.titleSec+dt; STG.act=null; STG.death=null; STG.cer=null; STG.card=null; return; }
 STG.titleSec=null;
 if(STG.cer){ var c=STG.cer; c.t+=dt;
  if(c.t>=CER_IN&&c.t<CER_FLASH)world.hitstop=Math.max(world.hitstop,0.03); /* 0.4-0.7：hitstop 顶住=世界全停 */
  if(c.flashAt<0&&c.t>=CER_FLASH)c.flashAt=c.t; /* 一帧白闪锚点（渲染层 t-flashAt<0.009 ⇒ 恰 1 step 帧） */
  if(c.t>=CER_TOTAL)STG.cer=null; }
 if(STG.act){ STG.act.t+=dt; if(STG.act.t>=ACT_TOTAL)STG.act=null; }
 if(STG.t3build){ var tb=STG.t3build; if(!tb.done){ tb.t+=dt; /* W3：搭台升起（完即入 PLATFORMS；演出层留到换幕/重置再清） */
  if(Math.random()<0.5)hitBurst(T3_PLAT.x+Math.random()*T3_PLAT.w,GY-6,"landDust","#8b9db8");
  if(tb.t>=T3BUILD_DUR){ tb.done=true; addTrauma(0.15); AudioSys.play("land");
   PLATFORMS.push({x:T3_PLAT.x,y:T3_PLAT.y,w:T3_PLAT.w,h:T3_PLAT.h}); } } }
 if(STG.death){ if(world.phase!=="dead")STG.death=null; else STG.death.t+=dt; }
 if(STG.card)STG.card.t+=dt; }

/* ============ 主循环 ============ */
var last=now(), acc=0, STEP=1/60, frameTimes=[], frameTotal=0;
function step(dt){
 if(DBG.pause){ just={}; return; } /* ?debug=1 暂停：世界/演出/计时全停（渲染照常）；just 清掉防解冻误消费 */
 stgUpdate(dt); /* 演出层走真实步（hitstop/慢动作下卡片照常走时；title 相管 REC 秒表） */
 world.trauma=Math.max(0,world.trauma-0.6*dt); if(world.hitstop>0){ world.hitstop-=dt; if(!world.started){} }
 else { var sdt=dt;
  if(world.slowT>0){ world.slowT=Math.max(0,world.slowT-dt); sdt=dt*0.3; } /* W5.3 E22：过零钳位（原 -=dt 跨零那帧过冲成负残渣后被 >0 守卫永久卡住 ⇒ G13.12「slowT 归 0」不达；钳位对 sdt 决策逐帧不变＝物理零影响） */
  if(world.flashW>0)world.flashW=Math.max(0,world.flashW-dt);
  if(world.phase!=="title"){ updWorld(sdt,dt); updPlayer(sdt); updEnemies(sdt); updWall(sdt); updTraps(sdt); updBoss(sdt); updFinale(sdt); rigUpdate(sdt); }
  updateFx(sdt); updAtmo(sdt); updLayers(sdt);
  just={}; } } /* W3 修：just 只在非冻结步清——hitstop 冻结窗（hs 0.045–0.12s）内按下的 J 原本被 step 末尾无条件清掉＝按键整个被吞（G9.16 轨迹实证：三按只中两击，第三击无着落）；现冻结期留存、解冻首帧由 updPlayer 消费，atkBuf 0.14s 缓冲设计才完整 */
function frame(ts){ requestAnimationFrame(frame);
 var rdt=(ts-last)/1000; last=ts; if(rdt>0.1)rdt=0.1;
 frameTimes.push(rdt); frameTotal++; if(frameTimes.length>600)frameTimes.shift();
 if(world.phase!=="title"&&!DBG.pause)Narr.update(rdt);
 acc+=rdt; var guard=0; while(acc>=STEP&&guard++<5){ step(STEP); acc-=STEP; }
 render(ts/1000); }

/* ============ 渲染 ============ */
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
 ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
/* ============ 背景·动态层级（Loop C / 视觉宪法 §4：前景 60fps 零视差、中景 30fps、远景 15fps） ============
   拆解：BASE（天空＋月亮＋地面＋霓虹，按幕缓存）＋远景条带 FAR＋中景条带 MID（各 984×218=W+24，逻辑 y∈[250,468)）。
   - 条带自带天空渐变切片：同参数 createLinearGradient(0,0,0,H) 在平移空间中重绘 ⇒ 与 BASE 逐像素恒等（位移时楼动天不动）。
   - 建筑三副本环绕（bx−W,bx,bx+W）；楼体画到 y467 止——y468-469 霓虹两行留 BASE（原像素保持，v012-X6/v025-A 采样带恒定）。
   - 远窗闪烁白名单＝完全位于 x∈[680,940] 的亮窗（四档 α 调制；该区规避全部既有像素探针带）；其余窗静态。
   - 中景＝5 幕剪影（顶 y≥350：避 J2 中心箱 y≤340 与 J5 远带 y≤345；x 边距避开 J2 刀弧箱与 v025-C 负控列）＋7 点光（y406-412 r26 四档脉冲）。
   - 帧率/视差系数唯一源=VISUAL_CONFIG.layers（活读；缺失⇒视差 0＋条带静态的安全降级）。偏移去整（整数逻辑像素 ⇒ 无重采样）。
   - 更新挂 step 的 hitstop-else 分支：冻结窗全停（v027-C3 PZONE 字节恒等保持）；title 相照走。
   探针：verify-visual-v1 J3（layerStats 2s 帧率＋layers() 位移数学）／J5②（远景带互相关位移=8、平台带=0）。
   铁律：四套调色板 moon 一律 #16203a——verify-v011 以该色像素质心为判据，改了它=弄瞎旧探针 */
var PALETTES={
 title:{sky0:"#070b14",sky1:"#0e1524",bld:"#0a0f1c",win:"#ffd76a22",floor:"#090e18",neon:"#7df9ff",moon:"#16203a"},
 act1:{sky0:"#0a0f1c",sky1:"#131b2e",bld:"#0c1322",win:"#9fb2d81e",floor:"#0b101d",neon:"#7df9ff",moon:"#16203a"},
 act2:{sky0:"#150a20",sky1:"#271233",bld:"#1a0d28",win:"#c88bff26",floor:"#130a1c",neon:"#ff6ad5",moon:"#16203a"},
 clear:{sky0:"#1a1208",sky1:"#2d2110",bld:"#221808",win:"#ffd76a2e",floor:"#171004",neon:"#ffd76a",moon:"#16203a"} };
function palKey(){ if(world.phase==="title")return "title"; if(world.cleared)return "clear"; if(world.act>=2)return "act2"; if(world.wave===2)return "act2"; return "act1"; } /* 2+幕暂共用 act2 紫调（d6 分幕调色板后续接） */
var LAY={ t:0, accF:0, accM:0, key:"", base:null, baseKey:"", farS:null, midS:null,
 far:null, mid:null, stats:{far:0,mid:0,fg:0} };
var LAY_TY=250, LAY_TH=218; /* 条带逻辑窗口 y∈[250,468)：最高楼顶=250；底止 467（468-469 霓虹行留 BASE） */
function layCfg(){ var c=ppCfg(); return (c&&c.layers)?c.layers:null; }
function layDpr(){ return Math.min(devicePixelRatio||1,2); }
function layCanvas(w,h){ var c=document.createElement("canvas");
 c.width=Math.round(w*layDpr()); c.height=Math.round(h*layDpr()); return c; }
function layCtx(c){ var g=c.getContext("2d"); g.setTransform(layDpr(),0,0,layDpr(),0,0); return g; }
function layOff(par){ return Math.round(clamp((player.x-480)*par,-12,12)); } /* 位离去整（±12 钳） */
function layOffF(){ var L=layCfg(); return layOff(L?+L.far.parallax:0); }
function layOffM(){ var L=layCfg(); return layOff(L?+L.mid.parallax:0); }
function isFlickWin(wx){ return wx>=680&&wx+6<=940; } /* 闪窗白名单：完全位于 x∈[680,940] */
function bakeBase(key){ var p=PALETTES[key], c=layCanvas(W,H), g=layCtx(c);
 var lg=g.createLinearGradient(0,0,0,H); lg.addColorStop(0,p.sky0); lg.addColorStop(1,p.sky1);
 g.fillStyle=lg; g.fillRect(0,0,W,H);
 g.fillStyle=p.moon; g.beginPath(); g.arc(750,120,58,0,Math.PI*2); g.fill();
 g.fillStyle=p.floor; g.fillRect(0,GY,W,H-GY);
 var nl=g.createLinearGradient(0,0,W,0); nl.addColorStop(0,"#00000000"); nl.addColorStop(0.5,p.neon+"44"); nl.addColorStop(1,"#00000000");
 g.fillStyle=nl; g.fillRect(0,GY-2,W,2);
 return c; }
function bakeFarStatic(key){ var p=PALETTES[key], c=layCanvas(W+24,LAY_TH), g=layCtx(c);
 g.beginPath(); g.rect(0,0,W+24,LAY_TH); g.clip(); g.translate(12,-LAY_TY);
 var lg=g.createLinearGradient(0,0,0,H); lg.addColorStop(0,p.sky0); lg.addColorStop(1,p.sky1); /* 天空切片：与 BASE 同参 ⇒ 逐像素恒等 */
 g.fillStyle=lg; g.fillRect(-12,LAY_TY,W+24,LAY_TH);
 for(var i=0;i<9;i++){ var bw=60+((i*37)%50), bx0=(i*118+((i*53)%40))%W, top=250+((i*29)%90);
  for(var q=-1;q<=1;q++){ var bx=bx0+q*W;
   g.fillStyle=p.bld; g.fillRect(bx,top,bw,GY-top);
   g.fillStyle=p.win;
   for(var wy=top+14;wy<GY-16;wy+=22){ for(var wx=bx+8;wx<bx+bw-10;wx+=18){
    if((wx*7+wy*13)%5<2 && !isFlickWin(wx)) g.fillRect(wx,wy,6,9); } } } }
 return c; }
function bakeMidStatic(){ var c=layCanvas(W+24,LAY_TH), g=layCtx(c);
 g.beginPath(); g.rect(0,0,W+24,LAY_TH); g.clip(); g.translate(12,-LAY_TY);
 var sil=[[90,368,66,"#05070d"],[170,352,64,"#080a12"],[560,378,78,"#05070d"],[780,360,70,"#080a12"],[880,372,62,"#05070d"]];
 for(var i=0;i<sil.length;i++){ g.fillStyle=sil[i][3];
  g.fillRect(sil[i][0]-sil[i][2]/2,sil[i][1],sil[i][2],GY-sil[i][1]); }
 return c; }
function bakeFarTick(tok){ var c=LAY.far; if(!c)return; var g=layCtx(c);
 g.clearRect(0,0,W+24,LAY_TH);
 g.drawImage(LAY.farS,0,0,W+24,LAY_TH);
 var p=PALETTES[LAY.key];
 var wr=parseInt(p.win.substr(1,2),16), wg=parseInt(p.win.substr(3,2),16), wb=parseInt(p.win.substr(5,2),16), wa=parseInt(p.win.substr(7,2),16)/255;
 g.save(); g.beginPath(); g.rect(0,0,W+24,LAY_TH); g.clip(); g.translate(12,-LAY_TY);
 for(var i=0;i<9;i++){ var bw=60+((i*37)%50), bx0=(i*118+((i*53)%40))%W, top=250+((i*29)%90);
  for(var q=-1;q<=1;q++){ var bx=bx0+q*W;
   for(var wy=top+14;wy<GY-16;wy+=22){ for(var wx=bx+8;wx<bx+bw-10;wx+=18){
    if((wx*7+wy*13)%5<2 && isFlickWin(wx)){
     var lv=Math.floor((0.5+0.5*Math.sin(tok*2.0+wx*0.113+wy*0.271))*4); if(lv>3)lv=3;
     g.globalAlpha=wa*(0.6+0.4*(lv/3)); /* 四档：0.6/0.733/0.867/1.0（闪烁增益带，α 只减不增） */
     g.fillStyle="rgb("+wr+","+wg+","+wb+")";
     g.fillRect(wx,wy,6,9); } } } } }
 g.globalAlpha=1; g.restore(); }
function bakeMidTick(tok){ var c=LAY.mid; if(!c)return; var g=layCtx(c);
 g.clearRect(0,0,W+24,LAY_TH);
 g.drawImage(LAY.midS,0,0,W+24,LAY_TH);
 g.save(); g.beginPath(); g.rect(0,0,W+24,LAY_TH); g.clip(); g.translate(12,-LAY_TY);
 var LX=[60,150,300,400,520,700,830];
 for(var i=0;i<LX.length;i++){ var lx=LX[i], ly=406+((i*5)%7);
  var lv=Math.floor((0.5+0.5*Math.sin(tok*2.3+lx*0.137))*4); if(lv>3)lv=3;
  var al=(0.10+0.10*(lv/3)).toFixed(4); /* 四档：0.10/0.133/0.167/0.20 */
  var rg=g.createRadialGradient(lx,ly,0,lx,ly,26);
  rg.addColorStop(0,"rgba(255,215,106,"+al+")"); rg.addColorStop(1,"rgba(255,215,106,0)");
  g.fillStyle=rg; g.fillRect(lx-26,ly-26,52,52); }
 g.restore(); }
function ensureLayers(key){ if(LAY.key===key && LAY.far && LAY.mid)return;
 LAY.key=key; LAY.farS=bakeFarStatic(key); LAY.midS=bakeMidStatic();
 LAY.far=layCanvas(W+24,LAY_TH); LAY.mid=layCanvas(W+24,LAY_TH);
 LAY.accF=0; LAY.accM=0; bakeFarTick(LAY.t); bakeMidTick(LAY.t); }
function updLayers(dt){ var L=layCfg(); if(!L)return;
 LAY.t+=dt;
 var fF=+L.far.fps||0, fM=+L.mid.fps||0; /* 0=不限速（缺省降级）；>0=按累加器限帧 */
 if(fF>0){ LAY.accF+=dt; while(LAY.accF>=1/fF){ LAY.accF-=1/fF; LAY.stats.far++; bakeFarTick(LAY.t); } }
 if(fM>0){ LAY.accM+=dt; while(LAY.accM>=1/fM){ LAY.accM-=1/fM; LAY.stats.mid++; bakeMidTick(LAY.t); } } }
function drawBG(){ var key=palKey();
 if(LAY.baseKey!==key){ LAY.base=bakeBase(key); LAY.baseKey=key; }
 ensureLayers(key);
 ctx.drawImage(LAY.base,0,0,W,H);
 ctx.drawImage(LAY.far,layOffF()-12,LAY_TY,W+24,LAY_TH); /* 条带画在 off−12：世界 x 落屏 x=world+off ⇒ 未位移列与 BASE 逐像素重合 */
 ctx.drawImage(LAY.mid,layOffM()-12,LAY_TY,W+24,LAY_TH); }
/* ============ 台箱/接触阴影/地面反射/刀光拖尾（v0.1.2 P0-2/3/4） ============ */
function drawPlatforms(){ for(var i=0;i<PLATFORMS.length;i++){ var p=PLATFORMS[i];
 ctx.save(); ctx.fillStyle="#141a2c"; ctx.strokeStyle="#7df9ff66"; ctx.lineWidth=2;
 ctx.fillRect(p.x,p.y,p.w,p.h); ctx.strokeRect(p.x,p.y,p.w,p.h);
 ctx.fillStyle="#7df9ff33"; ctx.fillRect(p.x,p.y,p.w,2); ctx.restore(); } }
function drawT3Build(){ if(!STG.t3build||STG.t3build.done)return; /* W3：搭台升起中（琥珀＝施工中；完即走 drawPlatforms 常态） */
 var u=clamp(STG.t3build.t/T3BUILD_DUR,0,1), u2=1-(1-u)*(1-u); /* 缓出：起步快、将到位减速 */
 var top=GY+(T3_PLAT.y-GY)*u2;
 ctx.save(); ctx.fillStyle="#141a2c"; ctx.strokeStyle="#ffd76a"; ctx.lineWidth=2;
 ctx.fillRect(T3_PLAT.x,top,T3_PLAT.w,GY-top); ctx.strokeRect(T3_PLAT.x,top,T3_PLAT.w,GY-top);
 ctx.strokeStyle="#ffd76a44"; ctx.lineWidth=1;
 for(var y=top+20+(STG.t3build.t*7%24);y<GY;y+=26){ ctx.beginPath(); ctx.moveTo(T3_PLAT.x+2,y); ctx.lineTo(T3_PLAT.x+T3_PLAT.w-2,y); ctx.stroke(); }
 ctx.globalAlpha=0.3; ctx.fillStyle="#ffd76a"; ctx.fillRect(T3_PLAT.x,GY-6,T3_PLAT.w,6); ctx.restore(); }
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
function pushGhost(x,y,facing,k){ ghosts.push({x:x,y:y,facing:facing,t:0,k:k||""}); if(ghosts.length>24)ghosts.shift(); }
function pushBlade(x,y){ var bt=bladeTrail[bladeTrail.length-1]; if(bt&&bt.x===x&&bt.y===y)return; bladeTrail.push({x:x,y:y,t:0}); if(bladeTrail.length>8)bladeTrail.shift(); }
function drawBladeTrail(){ if(bladeTrail.length<2)return;
 ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.lineCap="round";
 for(var i=1;i<bladeTrail.length;i++){ var a=bladeTrail[i-1],b=bladeTrail[i];
  ctx.globalAlpha=Math.max(0,1-b.t/0.14)*0.5; ctx.lineWidth=1+11*(i/bladeTrail.length);
  ctx.strokeStyle="#aef6ff"; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
 ctx.restore(); }
/* W5.3 剑气拖尾/剑气体/收刀闪白（纯绘制层；qi 数据同源 updQi；全部 static 读 ⇒ 冻结窗零随机） */
function drawQiTrail(){ if(qiTrail.length<2)return;
 ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.lineCap="round";
 for(var i=1;i<qiTrail.length;i++){ var a=qiTrail[i-1],b=qiTrail[i];
  ctx.globalAlpha=Math.max(0,1-b.t/0.14)*0.45; ctx.lineWidth=1+9*(i/qiTrail.length);
  ctx.strokeStyle="#7df9ff"; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
 ctx.restore(); }
function drawQi(){ if(!qi)return; var q=qi.t<QI_FLY?1:Math.max(0,1-(qi.t-QI_FLY)/QI_FADE);
 ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.translate(qi.x,qi.y); ctx.scale(qi.dir,1);
 ctx.lineCap="round"; ctx.globalAlpha=0.85*q; ctx.lineWidth=5; ctx.strokeStyle="#aef6ff";
 ctx.beginPath(); ctx.moveTo(-6,-20); ctx.quadraticCurveTo(14,0,-6,20); ctx.stroke();
 ctx.globalAlpha=0.9*q; ctx.lineWidth=2; ctx.strokeStyle="#eafcff";
 ctx.beginPath(); ctx.moveTo(-4,-14); ctx.quadraticCurveTo(9,0,-4,14); ctx.stroke();
 ctx.restore(); }
function drawFlash(){ if(world.flashW<=0)return;
 ctx.save(); ctx.globalAlpha=Math.min(1,world.flashW/0.12)*0.32; ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,W,H); ctx.restore(); }
function drawGuide(){ if(world.wave1Started||world.phase==="title"){ drawT3Guide(); return; }
 var pulse=0.5+0.5*Math.sin(world.t*4);
 ctx.save(); ctx.globalAlpha=0.35+0.35*pulse; ctx.strokeStyle="#ffd76a"; ctx.lineWidth=4; ctx.lineCap="round";
 for(var i=0;i<2;i++){ var x=500+i*34+Math.sin(world.t*3+i)*6, y=300;
  ctx.beginPath(); ctx.moveTo(x-10,y-13); ctx.lineTo(x+8,y); ctx.lineTo(x-10,y+13); ctx.stroke(); }
 ctx.restore(); }
function drawT3Guide(){ /* W4.1（A2）：E1-3 待触发提示——T3 顶上方脉冲向下双箭头（静置 >8s 出现；25s 强推兜底） */
 if(world.phase!=="playing"||world.act!==2||world.encPhase!=="idle"||world.enc!==2||(world.encIdleT||0)<=8)return;
 if(world.enc>=ACTS[2].encounters.length)return;
 var pulse=0.5+0.5*Math.sin(world.t*4);
 ctx.save(); ctx.globalAlpha=0.35+0.35*pulse; ctx.strokeStyle="#ffd76a"; ctx.lineWidth=4; ctx.lineCap="round";
 for(var i=0;i<2;i++){ var y=252+i*20+Math.sin(world.t*3+i)*5, x=828;
  ctx.beginPath(); ctx.moveTo(x-12,y-8); ctx.lineTo(x,y+9); ctx.lineTo(x+12,y-8); ctx.stroke(); }
 ctx.restore(); }
function drawWall(){ if(wall.h<=0&&world.wallWarnT==null)return;
 if(world.wallWarnT!=null){ /* W2：0.6s 预告（d2 §3）——琥珀警示面闪烁，空间=砌成后墙的足印 */
  ctx.save(); ctx.globalAlpha=0.16+0.30*Math.abs(Math.sin(world.t*11)); ctx.fillStyle="#ffd76a";
  ctx.fillRect(137,GY-300,26,300); ctx.restore(); }
 ctx.save(); ctx.fillStyle=(wall.hitFlash>0)?"#463823":"#1a2033"; ctx.strokeStyle="#ffd76a99"; ctx.lineWidth=2; /* W3：被击亮闪 */
 ctx.fillRect(137,GY-wall.h,26,wall.h); ctx.strokeRect(137,GY-wall.h,26,wall.h);
 if(wall.breakable&&wall.built&&!wall.breaking&&wall.hp<32){ /* W3：可拆墙裂纹随血量（三连击 32→24→15→0 各一段） */
  var fr=1-Math.max(0,wall.hp)/32; ctx.strokeStyle="#0b101d"; ctx.lineWidth=2; ctx.beginPath(); /* W3 收口：原 #0b0f1a 未在调色板注册表（J1 离域）；#0b101d 色差不可见（ΔB=3）且已在册 */
  ctx.moveTo(139,GY-300*fr-16); ctx.lineTo(152,GY-300*fr+34); ctx.lineTo(145,GY-300*fr+72);
  if(fr>0.4){ ctx.moveTo(161,GY-96); ctx.lineTo(147,GY-42); }
  ctx.stroke(); }
 ctx.strokeStyle="#ffd76a55"; ctx.lineWidth=1;
 for(var y=GY-wall.h+24;y<GY;y+=26){ ctx.beginPath(); ctx.moveTo(137,y); ctx.lineTo(163,y); ctx.stroke(); }
 ctx.restore(); }
function drawTraps(){ for(var i=0;i<traps.length;i++){ var t=traps[i];
 if(t.type==="lamp"){
  var bx=lampX(t.t,t.T), wx=lampX(t.t+LAMP_WARN,t.T), d=Math.abs(wx-player.x);
  var wa=0.25+0.75*clamp(1-d/300,0,1);   /* 预警光斑：近玩家渐亮 α0.25→1 */
  ctx.save();
  ctx.globalAlpha=0.5; ctx.strokeStyle="#ffd76a"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(LAMP_X0,40); ctx.lineTo(bx,GY); ctx.stroke();
  ctx.globalAlpha=0.85; ctx.fillStyle="#ffd76a";
  ctx.beginPath(); ctx.ellipse(bx,GY,30,8,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=wa; ctx.beginPath(); ctx.ellipse(wx,GY,26,7,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(LAMP_X0,40,7,0,Math.PI*2); ctx.fill();
  ctx.restore();
 } else if(t.type==="drop"){ var lt=t.t-t.lead; if(lt<0)continue;
  var la=t.phase==="warn"?(0.2+0.5*clamp(lt/DROP_WARN,0,1)):0.7;
  ctx.save(); ctx.globalAlpha=la; ctx.strokeStyle="#ffcf7a"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(t.x,t.landY,DROP_R,9,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
  if(t.phase==="fall"){ ctx.save(); ctx.translate(t.x,t.y); ctx.rotate(t.t*6);
   ctx.fillStyle="#ffcf7a"; ctx.fillRect(-9,-9,18,18); ctx.restore(); }
 } else if(t.type==="press"){
  ctx.save();
  if(t.phase==="warn"){
   var fl=(Math.floor(t.t/0.3)%2===0)?0.55:0.22;   /* 地面 x±40 阴影闪 3 次（0.9s/0.3s 一周期） */
   ctx.globalAlpha=fl; ctx.fillStyle="#ffd76a";
   ctx.beginPath(); ctx.ellipse(t.x,GY,40,9,0,0,Math.PI*2); ctx.fill();
   drawClap(t.x,PRESS_TOP+PRESS_H/2,PRESS_W,PRESS_H,0.3);   /* 顶部待命板提示 */
  } else drawClap(t.x,t.y+PRESS_H/2,PRESS_W,PRESS_H,1);
  ctx.restore();
 } } }
function drawClap(cx,cy,w,h,alpha){ /* 场记板（道具画笔）：琥珀边框＋顶条斜纹 */
 ctx.save(); ctx.globalAlpha=alpha;
 ctx.fillStyle="#2a2118"; ctx.strokeStyle="#ffd76a"; ctx.lineWidth=2;
 ctx.beginPath(); ctx.rect(cx-w/2,cy-h/2,w,h); ctx.fill(); ctx.stroke();
 ctx.fillStyle="#ffd76a"; ctx.fillRect(cx-w/2,cy-h/2,w,h*0.3);
 ctx.fillStyle="#2a2118";
 for(var i=0;i<3;i++){ var x0=cx-w/2+w*(0.08+i*0.34);
  ctx.beginPath(); ctx.moveTo(x0,cy-h/2); ctx.lineTo(x0+w*0.14,cy-h/2);
  ctx.lineTo(x0+w*0.05,cy-h/2+h*0.3); ctx.lineTo(x0-w*0.09,cy-h/2+h*0.3); ctx.closePath(); ctx.fill(); }
 ctx.restore(); }
function drawBoss(){ if(!boss.active)return; var B=boss;
 var wqb=(B.state==="wind")?Math.min(1,B.t/BOSS_WINDUP):0; /* Loop6：预警可视化（白满描边＋收敛环） */
 /* D-6（Loop D）：光环脉动/漂浮/暴怒抖动全走 world.t（冻结停、零 Math.random）；死态不漂浮不抖 */
 var BF=ART.bossFx, rage=(B.narr==="enraged");
 var pulse=0.5+0.5*Math.sin(world.t*BF.pulseSpd);
 var bfl=B.dead?0:Math.sin(world.t*BF.floatSpd)*BF.floatAmp;
 var bshk=(rage&&!B.dead)?Math.sin(world.t*BF.shakeSpd)*BF.shakeAmp:0;
 ctx.save(); ctx.translate(B.x+bshk,B.y+bfl);
 if(B.dead){ ctx.globalAlpha=Math.max(0.25,1-B.t/2.5); ctx.rotate(0.5*Math.min(1,B.t/1.2)); }
 else if(B.state==="wind"){ var wq=B.t/BOSS_WINDUP; ctx.rotate(-0.14*wq); ctx.translate(Math.sin(B.t*50)*wq*2,0); }
 else if(B.state==="strike"){ ctx.rotate(0.2); ctx.scale(1.15,1); }
 var col=B.flash>0?"#ffffff":(B.narr==="enraged"?"#ff8fa3":"#ffd76a"); /* C-3 绑色（2026-10-14 Loop D）：#ff8f6a→#ff8fa3＝绯族注册档，端点与 1265 反射两处同改 */
 ctx.shadowColor=col; ctx.shadowBlur=STROKE_SPEC.bossBlur*(0.75+0.5*pulse)+(rage?6:0); /* D-6：光晕随脉动呼吸，暴怒加厚 */
 ctx.strokeStyle=(wqb>0)?"#ffffff":col; ctx.lineWidth=(wqb>0)?3.6:3; ctx.fillStyle="#1c1610"; /* C-6 绑色：#1a1410→#1c1610（附件B 登记档） */
 ctx.beginPath(); ctx.ellipse(0,-40,27,36,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
 ctx.fillStyle=(B.state==="wind")?"#ffffff":col;
 ctx.beginPath(); ctx.arc(B.dir*9,-58,6,0,Math.PI*2); ctx.fill();
 /* 场记板道具：press 预警时抬手高举（d2 §6 墙压预警「抬手」） */
 var raise=0; for(var i=0;i<traps.length;i++){ var tr=traps[i]; if(tr.type==="press"&&tr.phase==="warn")raise=1; }
 var hx=20, hy=raise? -92 : -52;
 ctx.shadowBlur=0; /* W4.1（A6）：道具层不吃模糊（保留体+眼 3 图元）；修 TA 抓出的 ShadowBlur 未复位 */
 ctx.strokeStyle="#1c1610"; ctx.lineWidth=6; /* C-6 绑色（第二处） */
 ctx.beginPath(); ctx.moveTo(14,-46); ctx.lineTo(hx,hy+8); ctx.stroke();
 drawClap(hx,hy-8,26,18,1);
 if(!B.dead&&wqb>0){ /* 计时环：64→26 收敛＝出招倒计时（与红兵同语言） */
  ctx.shadowBlur=0; ctx.globalAlpha=0.3+0.5*wqb; ctx.strokeStyle="#ffffff"; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(0,-40,64-38*wqb,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
 if(B.active&&!B.dead&&B.hp>0){ /* 血条（Boss 头顶） */
  ctx.shadowBlur=0; ctx.fillStyle="#ffffff22"; ctx.fillRect(-30,-96,60,5);
  ctx.fillStyle=col; ctx.fillRect(-30,-96,60*(B.hp/B.maxHp),5); }
 ctx.restore(); }
/* D-6 Boss 光环（Loop D）：宪法 §5「（Loop D 起）Boss 光环」入 Bloom 源序列（ppBloom 内同函数同条件重画）。
   主光晕＝world.t 脉动径向渐变（常态金族/暴怒绯族）；拖尾＝渲染位快照幽灵描边（旧→新渐弱）；
   暴怒色偏最大化＝青色 ±spill 错位剪影。全部 world.t 驱动 + 零 Math.random ⇒ v027-C3 冻结窗口不受影响
   （boss 未激活/已死即整函数早退，非 Boss 幕零像素零开销）。 */
function drawBossAura(){ if(!boss.active||boss.dead)return; var B=boss;
 var BF=ART.bossFx, rage=(B.narr==="enraged");
 var pulse=0.5+0.5*Math.sin(world.t*BF.pulseSpd);
 var bfl=Math.sin(world.t*BF.floatSpd)*BF.floatAmp;
 var bshk=rage?Math.sin(world.t*BF.shakeSpd)*BF.shakeAmp:0;
 var ax=B.x+bshk, ay=B.y+bfl-40;
 ctx.save();
 for(var i=0;i<bossTrail.length;i++){ var tr=bossTrail[i], ta=(i+1)/bossTrail.length*0.16; /* 拖尾幽灵 */
  ctx.globalAlpha=ta; ctx.strokeStyle=rage?"#ff8fa3":"#ffd76a"; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.ellipse(tr.x,tr.y-40,27,36,0,0,Math.PI*2); ctx.stroke(); }
 ctx.globalAlpha=1;
 if(rage){ ctx.globalAlpha=0.14; ctx.fillStyle="#7df9ff"; /* 暴怒色偏：青色错位剪影（±spill） */
  ctx.beginPath(); ctx.ellipse(ax-BF.spill,ay,27,36,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(ax+BF.spill,ay,27,36,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1; }
 var sp=auraSprite(rage), sc=1+0.08*pulse, side=sp.width*sc;
 /* 预烤辐射精灵（drawImage 缩放）：主画布与 1/ds Bloom 缓冲两处绘制语义逐像素一致
    （绕开 createRadialGradient 坐标受哪次 CTM 影响在两种上下文下的歧义） */
 ctx.globalAlpha=0.30+0.18*pulse; ctx.drawImage(sp,ax-side/2,ay-side/2,side,side);
 ctx.globalAlpha=1;
 ctx.restore(); }
/* 光环辐射精灵（惰性预烤一次；在 identity CTM 的离屏画布上建渐变 ⇒ 与使用处变换无关；金/绯两档） */
var AURA_SPR={};
function auraSprite(rage){ var key=rage?"r":"g"; if(AURA_SPR[key])return AURA_SPR[key];
 var R=ART.bossFx.auraR, c=document.createElement("canvas"); c.width=c.height=Math.ceil(R*2+16);
 var g=c.getContext("2d"), cx=c.width/2, base=rage?"255,143,163":"255,215,106";
 var gr=g.createRadialGradient(cx,cx,6,cx,cx,R);
 gr.addColorStop(0,"rgba("+base+",1)"); gr.addColorStop(1,"rgba("+base+",0)");
 g.fillStyle=gr; g.beginPath(); g.arc(cx,cx,R,0,Math.PI*2); g.fill();
 AURA_SPR[key]=c; return c; }
/* ============ Loop 6 角色骨架渲染层（RIG）＝「画面感」升级第 1 件（2026-10-13，全程序美术零素材） ============
 目标（用户首玩反馈最大项）：人物像样——有骨架、姿态跟动作、衣料有物理。构成：
 ①局部角度 FK＋姿态参数表＋指数混合（攻击段 k=80 ⇒ 30ms 达 91%「进击混合 ≤0.03s」；rigUpdate 挂在
   step 的 else 分支用 sdt ⇒ hitstop 帧冻结、slow-mo 全套正确）；
 ②足锁：两骨 IK 到「世界坐标」落点——支撑期 zone 进入时锁定一次、之后逐帧零改动（v025-B 契约：
   落定 |Δx|≤3px 真 0.00；cy 报 GY/弧高；步态周期 36px＝站 18＋摆 18，摆动脚世界扫 36px＋7px 弧）；
 ③披风 4 节＋发带 2×2 节＝世界系 Verlet（定步进惯性×0.92、速度夹 6px/步、最大段长钳：链式 ⇒ 锚→末端
   路径长 ≤ L·rest ⇒ 下摆行 ≤ 锚行+24 ——「X6 行带 463-470 结构不可达」由此保证，双朝向同）；
 ④双描边剪影（宽光边 α0.25＋暗芯 #0b1322＋亮芯线）全层零 shadowBlur——旧版 12px 光晕即 v025-A 红因。
 禁区契约（v025-A：静立时 [310,326]×[463,470] 带内零角色像素）：站姿踝 ±4（面向系对称，双朝向同界）
 ＋脚趾 nub 3px＋butt 端帽（端帽不外延）⇒ 最大 +x 路径 307，留 3px 余量；刀休息位 tool=1.50rad 微前垂
 ⇒ 刀尖+倒钩 ≤308.5。跑动/攻击/死亡不在采样窗（A 只在静立采）。
 确定性：全部微噪 sin(seed+t) 合成、无 Math.random（帧间可复现）。rig() 供 v025-B（见 debug 钩子）。 */
var RIG={ t:0, lean:0, crouch:0, k:18, gcol:"#7df9ff", breath:0, rax:0, ray:0,
 feet:[{wx:186,wy:GY,pl:1,zone:0,sx0:0},{wx:194,wy:GY,pl:1,zone:0,sx0:0}],
 gait:0, glx:190, lastF:1,
 hx:-4.6, hy:-25.5, tool:1.50,
 cape:{x:[0,0,0,0],y:[0,0,0,0],ox:[0,0,0,0],oy:[0,0,0,0],lx:0,init:false},
 sa:{x:[0,0],y:[0,0],ox:[0,0],oy:[0,0],lx:0,init:false},
 sb:{x:[0,0],y:[0,0],ox:[0,0],oy:[0,0],lx:0,init:false} };
function rigReset(){ RIG.t=0; RIG.lean=0; RIG.crouch=0; RIG.gait=0; RIG.glx=player.x;
 RIG.lastF=player.facing; RIG.hx=-4.6; RIG.hy=-25.5; RIG.tool=1.50;
 RIG.feet[0].wx=player.x+4*player.facing; RIG.feet[0].wy=GY; RIG.feet[0].pl=1; RIG.feet[0].zone=0;
 RIG.feet[1].wx=player.x-4*player.facing; RIG.feet[1].wy=GY; RIG.feet[1].pl=1; RIG.feet[1].zone=0;
 RIG.cape.init=false; RIG.sa.init=false; RIG.sb.init=false; }
function approach(v,tg,k,dt){ return v+(tg-v)*(1-Math.exp(-k*dt)); }
function ik2(jx,jy,tx,ty,l1,l2,bend){ var dx=tx-jx,dy=ty-jy,d=Math.sqrt(dx*dx+dy*dy)||0.001;
 var dc=Math.min(d,l1+l2-0.03), ux=dx/d, uy=dy/d, ex=jx+ux*dc, ey=jy+uy*dc;
 var c=(l1*l1-l2*l2+dc*dc)/(2*l1*dc); c=Math.max(-1,Math.min(1,c));
 var base=Math.atan2(ey-jy,ex-jx), off=Math.acos(c)*bend;
 return {kx:jx+Math.cos(base+off)*l1, ky:jy+Math.sin(base+off)*l1, ex:ex, ey:ey}; }
/* 世界系 Verlet 链：p0 钉在锚、逐段「最大长度」约束（可折不可伸）；|Δ锚|>40px＝传送 ⇒ 重置垂坠 */
function chainStep(C,ax,ay,dir,dt,g,wx,wy,rest,cv){ var L=C.x.length,i;
 if(!C.init||Math.abs(ax-(C.lx||ax))>40){ for(i=0;i<L;i++){ C.x[i]=ax-(i+1)*rest*0.35*dir; C.y[i]=ay+(i+1)*rest*0.9;
   C.ox[i]=C.x[i]; C.oy[i]=C.y[i]; } C.init=true; }
 C.lx=ax; C.x[0]=ax; C.y[0]=ay; C.ox[0]=ax; C.oy[0]=ay;
 for(i=1;i<L;i++){ var vx=C.x[i]-C.ox[i], vy=C.y[i]-C.oy[i], vl=Math.sqrt(vx*vx+vy*vy);
  if(vl>cv){ vx*=cv/vl; vy*=cv/vl; }
  C.ox[i]=C.x[i]; C.oy[i]=C.y[i];
  C.x[i]+=vx*0.92+(wx+Math.sin(RIG.t*2.3+i*2.1)*26)*dt*dt;
  C.y[i]+=vy*0.92+(g+wy)*dt*dt; }
 for(var it=0;it<3;it++){ C.x[0]=ax; C.y[0]=ay;
  for(i=1;i<L;i++){ var ddx=C.x[i]-C.x[i-1], ddy=C.y[i]-C.y[i-1], dd=Math.sqrt(ddx*ddx+ddy*ddy)||0.001;
   if(dd>rest){ var f=(dd-rest)/dd;
    if(i===1){ C.x[i]-=ddx*f; C.y[i]-=ddy*f; }
    else { C.x[i-1]+=ddx*f*0.5; C.y[i-1]+=ddy*f*0.5; C.x[i]-=ddx*f*0.5; C.y[i]-=ddy*f*0.5; } } } } }
function rigUpdate(dt){ var P=player; if(P.dead){ RIG.t+=dt*0.2; return; }
 RIG.t+=dt;
 var moving=(anyDown(MOVE_L)||anyDown(MOVE_R))&&P.grounded&&P.dashT<=0&&!P.atk;
 var rising=moving&&!RIG.wasMove; RIG.wasMove=moving;
 /* —— 步相（距离驱动，周期 36px＝站 18px＋摆 18px）＋足锁：zone 进入锁一次、支撑期零改动。
    步长设计：站定位 rel=+4·facing（与待机脚位同值 ⇒ idle→走 转场零跳变）；撑到 rel=−14 ⇒ 两骨 IK 恒可达
    （|rel|max=14 < 触达 14.6）。转场帧把世界坐标在调整⇒pl 报 0（非支撑，v025-B「支撑=世界锁死」语义自洽）—— */
 var dx=P.x-RIG.glx; RIG.glx=P.x; if(moving)RIG.gait+=Math.abs(dx);
 if(P.facing!==RIG.lastF){ RIG.lastF=P.facing; RIG.feet[0].zone=0; RIG.feet[1].zone=0; }
 for(var f=0;f<2;f++){ var F=RIG.feet[f];
  if(!moving){ var twx=P.x+(f===0?4:-4)*P.facing; /* 收脚靶位（rel=+4·facing 与站姿恒等 ⇒ 转场零跳变） */
   F.wx=approach(F.wx,twx,50,dt); F.wy=GY-5;
   /* 收脚滑移中＝世界坐标仍在调整 ⇒ 按「支撑=世界锁死」契约报 0（v025-B：p=1⇒零漂移 须全局恒真，
      指数收敛永不完全相等 ⇒ 亚像素阈 0.05px 判收敛；纯仪器字段，绘制只读 wx/wy）。 */
   F.pl=(Math.abs(F.wx-twx)<0.05)?1:0; F.zone=0; continue; }
  var p=(RIG.gait+f*18)%36;
  if(p<18){ if(F.zone!==1){ F.zone=1; F.wx=P.x+4*P.facing; F.pl=rising?0:1; } /* 落定：世界锁定 */
   else F.pl=1; F.wy=GY-5; }
  else { var u=(p-18)/18;
   if(F.zone!==2){ F.zone=2; F.sx0=P.x-14*P.facing; }
   F.wx=F.sx0+u*36*P.facing; F.wy=GY-5-7*Math.sin(u*Math.PI); F.pl=0; } }
 /* —— 姿态目标（面向系 +x=前）→ 指数混合 —— */
 var leanT=0, crT=0, handT={x:-4.6,y:-25.5}, toolT=1.50, k=18;
 var bre=P.grounded?Math.sin(RIG.t*2.1):0; RIG.breath=bre;
 if(P.dashT>0){ leanT=0.34; crT=1.8; handT={x:-11,y:-20}; toolT=2.3; k=60; }
 else if(P.atk&&P.atk.phase!=="rec"){
  var A=ATK[P.atk.step-1], tt=P.atk.t, PD={1:{w:3.55,a:0.85},2:{w:0.75,a:2.75},3:{w:3.85,a:0.65}}[P.atk.step], alp;
  if(P.atk.phase==="wind"){ var u1=Math.min(1,tt/A.wind); alp=1.50+(PD.w-1.50)*u1; }
  else { var u2=Math.min(1,(tt-A.wind)/A.act); alp=PD.w+(PD.a-PD.w)*Math.pow(u2,1.5); }
  handT={x:1.5+Math.cos(alp)*15, y:-37+Math.sin(alp)*15}; toolT=alp+0.25;
  leanT=(P.atk.phase==="act")?0.15:0.04; crT=0.6; k=80; }
 else if(!P.grounded){ leanT=0.05; crT=-0.5; handT={x:2,y:-33}; toolT=1.0; k=26; }
 else if(moving){ var r=Math.min(1,Math.abs(P.vx)/270);
  leanT=0.05+0.10*r; crT=0.3*r+0.9*r*Math.abs(Math.sin(RIG.gait/36*Math.PI*2));
  var gph=RIG.gait/36*Math.PI*2, sw=Math.sin(gph); /* Loop10：摆臂＝步态相位联动（修「僵尸臂」）；刀角随摆微转、tip 恒离地 */
  handT={x:-4-7*sw, y:-25.5+1.35*Math.cos(gph)}; toolT=1.28+0.12*sw; k=50; }
 else { leanT=0.02*bre; crT=0.55*bre; handT={x:-4.6, y:-25.5+0.9*bre}; } /* Loop10：待机呼吸（修「雕像」）；hand.x 恒 −4.6 保 v025-A 契约 */
 if(P.hurtT>0){ leanT=-0.10; crT=1.2; }
 RIG.k=k;
 RIG.lean=approach(RIG.lean,leanT,k,dt);
 RIG.crouch=approach(RIG.crouch,crT+(bre*0.55),Math.max(k,10),dt);
 RIG.hx=approach(RIG.hx,handT.x,k,dt); RIG.hy=approach(RIG.hy,handT.y,k,dt);
 RIG.tool=approach(RIG.tool,toolT,k,dt);
 /* —— 披风/发带（锚随颈后；受力＝反向拖曳＋微摆；一闪窗口上飘）—— */
 var wind=-P.vx*1.4-P.facing*30, wfy=(P.iframes>0)?-900:0;
 chainStep(RIG.cape, P.x-P.facing*4, P.y-42+RIG.crouch, P.facing, dt, 1400, wind, wfy, 8, 6);
 var sxa=P.x-P.facing*3, sya=P.y-52+RIG.crouch*0.6; /* Loop10：锚点从前额顶 P.x+f*4/P.y-56 挪到脑后（修「金带披在头顶」） */
 chainStep(RIG.sa, sxa, sya, P.facing, dt, 900, wind*0.8, wfy*0.5, 7, 6);
 chainStep(RIG.sb, sxa-P.facing*3, sya+1, P.facing, dt, 900, wind*0.8, wfy*0.5, 7, 6);
 RIG.rax=sxa; RIG.ray=sya;
 if(!(P.iframes>0)){ var rl0=sya-1.5; /* 非一闪时：发带逐节钳 y ≥ 锚−1.5（修 Loop6 遗留「头顶金线」）；一闪上飘保留不钳 */
  for(var ri=1;ri<RIG.sa.x.length;ri++){ if(RIG.sa.y[ri]<rl0)RIG.sa.y[ri]=rl0; if(RIG.sb.y[ri]<rl0)RIG.sb.y[ri]=rl0; } } }
/* 描边规格（宪法 §3）：strokeLimb 三笔/Boss 唯一特许光环/标题金字共用此数据源——数值即契约，
 debug.strokeProfile() 直接回读本表（结构自证）；改动=走 §6 变更纪律 */
var STROKE_SPEC={ playerLayers:3, glowW:3.2, glowA:0.25, core:"#0b1322", thin:0.34,
 bgStroke:0, bossBlur:18, titleBlur:26, otherBlur:0 };
/* 三笔剪影：宽光边→暗芯→亮芯线（同一条 path 三连 stroke；零 shadowBlur） */
function strokeLimb(pts,w,al){ ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
 for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
 ctx.globalAlpha=al*STROKE_SPEC.glowA; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=w+STROKE_SPEC.glowW; ctx.stroke();
 ctx.globalAlpha=al; ctx.strokeStyle=STROKE_SPEC.core; ctx.lineWidth=w; ctx.stroke();
 ctx.globalAlpha=al*0.95; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=Math.max(1,w*STROKE_SPEC.thin); ctx.stroke(); }
function drawPlayer(){ var P=player; if(P.dead&&P.deathT>1.5)return;
 var blink=(P.invuln>0&&!P.dead)&&(Math.floor(P.invuln*20)%2===0);
 var al=blink?0.45:1; if(P.dead)al=Math.max(0,1-P.deathT/1.5);
 RIG.gcol=P.hurtT>0?"#ff6a86":"#7df9ff";
 ctx.save();
 /* 残影（冲刺突进剪影） */
 for(var gi=0;gi<ghosts.length;gi++){ var gh=ghosts[gi];
  var ga=Math.pow(Math.max(0,1-gh.t/0.28),1.6)*0.20*(blink?0.5:1); if(ga<=0.01)continue;
  ctx.save(); ctx.globalAlpha=ga; ctx.translate(gh.x,gh.y); ctx.scale(gh.facing,1);
  ctx.strokeStyle=gh.k==="iai"?"#ffd76a":"#7df9ff"; ctx.lineWidth=2; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(-9,-24); ctx.lineTo(5,-40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5,-40); ctx.lineTo(10,-46); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4,-24); ctx.lineTo(-14,-10); ctx.lineTo(-19,-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4,-24); ctx.lineTo(8,-15); ctx.lineTo(14,-3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8,-37); ctx.lineTo(1,-29); ctx.stroke(); ctx.restore(); }
 ctx.globalAlpha=al; ctx.translate(P.x,P.y); ctx.scale(P.facing,1); if(P.dead)ctx.rotate(-1.2);
 ctx.lineCap="round"; ctx.lineJoin="round";
 /* 披风（世界系 Verlet → 面向系绘制；下摆行 ≤456：链长钳制的结构保证＋渲染层纵向微动 ≤0.5 叠加） */
 var C=RIG.cape;
 if(C.init){ var NR=4,wA=[5.5,4.6,3.6,2.5],ptA=[],ptB=[],ii;
  for(ii=0;ii<NR;ii++){ var nx=(ii<NR-1?C.x[ii+1]-C.x[ii]:C.x[ii]-C.x[ii-1]),
    ny=(ii<NR-1?C.y[ii+1]-C.y[ii]:C.y[ii]-C.y[ii-1]);
   var nl=Math.sqrt(nx*nx+ny*ny)||1; nx/=nl; ny/=nl;
   /* W5-1 披风微摆（仅渲染层：世界系横向 ≤1.15/纵向 ≤0.5，RIG.t 驱动⇒冻结即停；链物理不动） */
   var cow=(ii===0?0.3:0.55+0.15*ii), csw=Math.sin(RIG.t*1.9+ii*1.3)*1.15*cow, cvy=Math.sin(RIG.t*2.3+ii*0.9)*0.5*cow;
   ptA.push([(C.x[ii]+csw-ny*wA[ii]-P.x)*P.facing, C.y[ii]+cvy+nx*wA[ii]-P.y]);
   ptB.push([(C.x[ii]+csw+ny*wA[ii]-P.x)*P.facing, C.y[ii]+cvy-nx*wA[ii]-P.y]); }
  ctx.beginPath(); ctx.moveTo(ptA[0][0],ptA[0][1]);
  for(ii=1;ii<NR;ii++)ctx.lineTo(ptA[ii][0],ptA[ii][1]);
  for(ii=NR-1;ii>=0;ii--)ctx.lineTo(ptB[ii][0],ptB[ii][1]);
  ctx.closePath(); ctx.globalAlpha=al*0.95; ctx.fillStyle="#0d1526"; ctx.fill();
  ctx.globalAlpha=al*0.45; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=1; ctx.stroke();
  var tears=Math.min(world.deaths,4);
  if(tears>0){ ctx.globalAlpha=al; ctx.fillStyle="#080d18";
   for(ii=0;ii<tears;ii++){ var tfi=Math.min(2,Math.floor((ii+1)/(tears+1)*(NR-1))),
     ix=C.x[tfi]+(C.x[tfi+1]-C.x[tfi])*0.5, iy=C.y[tfi]+(C.y[tfi+1]-C.y[tfi])*0.5,
     lx2=(ix-P.x)*P.facing, ly2=iy-P.y;
    ctx.beginPath(); ctx.moveTo(lx2-3,ly2-2); ctx.lineTo(lx2+3,ly2-2); ctx.lineTo(lx2,ly2+5); ctx.closePath(); ctx.fill(); } } }
 /* 骨架 FK：髋→脊→头（呼吸/前倾由混合驱动） */
 var hipX=RIG.lean*7, hipY=-24+RIG.crouch;
 var chX=hipX+Math.sin(RIG.lean)*17, chY=hipY-Math.cos(RIG.lean)*17;
 var hdX=chX+Math.sin(RIG.lean*1.3+0.12)*10, hdY=chY-Math.cos(RIG.lean*1.3+0.12)*10;
 hdY-=RIG.breath*0.7; /* Loop10：头随呼吸轻浮 */
 /* 腿：两骨 IK → 踝（世界落点转局部；空中用收腿定姿） */
 for(var f2=0;f2<2;f2++){ var Fp=RIG.feet[f2], ax2, ay2;
  if(!P.grounded&&!P.dead){ ax2=(f2===0?8:-7); ay2=(f2===0?-15:-9); }
  else { ax2=(Fp.wx-P.x)*P.facing; ay2=Fp.wy-P.y; }
  var kn=ik2(hipX,hipY,ax2,ay2,12,12,-1);
  /* W5-1 腿芯：实体垫（+1.6/+1.4）把细线读作腿；前向不越既有趾端界（v025-A 带 310 余量在案） */
  ctx.globalAlpha=al*0.85; ctx.strokeStyle="#131b2e"; ctx.lineWidth=5.0;
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(kn.kx,kn.ky); ctx.stroke();
  ctx.lineWidth=4.4; ctx.beginPath(); ctx.moveTo(kn.kx,kn.ky); ctx.lineTo(kn.ex,kn.ey); ctx.stroke();
  strokeLimb([[hipX,hipY],[kn.kx,kn.ky]],3.4,al);
  strokeLimb([[kn.kx,kn.ky],[kn.ex,kn.ey]],3.0,al);
  /* W5-1 靴楔：踝部小实体（前向 ≤+3.0+描边=与既有趾端同界）＋青细描边＝接地感 */
  ctx.globalAlpha=al; ctx.fillStyle="#0b1322"; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=0.9;
  ctx.beginPath(); ctx.moveTo(kn.ex-4.5,kn.ey-2.6); ctx.lineTo(kn.ex+2.4,kn.ey-2.6); ctx.lineTo(kn.ex+3.0,kn.ey+1.0); ctx.lineTo(kn.ex-4.8,kn.ey+1.0); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=al*0.5; ctx.stroke();
  ctx.globalAlpha=al*0.25; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=5; ctx.lineCap="butt";
  ctx.beginPath(); ctx.moveTo(kn.ex,kn.ey); ctx.lineTo(kn.ex+3,kn.ey+2.2); ctx.stroke();
  ctx.globalAlpha=al; ctx.strokeStyle="#0b1322"; ctx.lineWidth=2.4; ctx.stroke();
  ctx.globalAlpha=al*0.95; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=1.1; ctx.stroke();
  ctx.lineCap="round"; }
 /* 躯干＋立领尖角（W5-1：薄实体垫在笔触之下＝64px 读作质量，不夺线框身份） */
 ctx.globalAlpha=al*0.8; ctx.fillStyle="#131b2e";
 ctx.beginPath(); ctx.moveTo(hipX+6.5,hipY+1.5); ctx.lineTo(hipX-7,hipY+1.5); ctx.lineTo(chX-5,chY-1); ctx.lineTo(chX+5.5,chY-1); ctx.closePath(); ctx.fill();
 strokeLimb([[hipX,hipY],[chX,chY]],6.5,al);
 ctx.globalAlpha=al; ctx.fillStyle="#0b1322"; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=1;
 ctx.beginPath(); ctx.moveTo(chX-4,chY+2); ctx.lineTo(chX-9,chY-9); ctx.lineTo(chX-1,chY-3); ctx.closePath(); ctx.fill(); ctx.stroke();
 ctx.beginPath(); ctx.moveTo(chX-2,chY-1); ctx.lineTo(chX-6,chY-12); ctx.lineTo(chX+2,chY-4); ctx.closePath(); ctx.fill(); ctx.stroke();
 /* 头＋眼缝＋金发带（导演的黄色：他毕竟是在给导演打工） */
 ctx.globalAlpha=al*0.9; ctx.fillStyle="#131b2e"; /* W5-1 发冠弧：脑后薄弧（半径 8.7、偏移 −1.6/+0.6），头质量+、头顶不抬 */
 ctx.beginPath(); ctx.arc(hdX-1.6,hdY+0.6,8.7,0,Math.PI*2); ctx.fill();
 ctx.globalAlpha=al; ctx.fillStyle="#0b1322"; ctx.beginPath(); ctx.arc(hdX,hdY,7.5,0,Math.PI*2); ctx.fill();
 ctx.globalAlpha=al*0.95; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=1.4; ctx.stroke();
 ctx.globalAlpha=al; ctx.fillStyle="#ffd76a"; ctx.fillRect(hdX+1.5,hdY-2.5,5.5,2);
 var sss=[RIG.sa,RIG.sb];
 for(var si=0;si<2;si++){ var S2=sss[si]; if(!S2.init)continue;
  /* D-3 丝带噪波（2026-10-14 Loop D）：带宽渐变＋法线向确定性波动，绘制层只读 RIG.s*
     （物理点不动＝v029 rig() 契约）；波相用 RIG.t（冻结即停）＋ si 相位差，零 Math.random */
  var RN=ART.ribbon, n2=S2.x.length; if(n2<2)continue;
  /* W5-1 渲染层摆动：先算「摆动后节点坐标」swx/swy（锚 0、越靠尾摆越大；RIG.t 驱动⇒冻结即停）
     —— 只动绘制坐标，S2.x/S2.y 物理点一律不动（v029 rig() 契约） */
  var swx=[],swy=[],lx=[],ly=[],rx=[],ry=[];
  for(ii=0;ii<n2;ii++){
   var bwx=(ii===0?0:Math.sin(RIG.t*2.0+si*1.9+ii*0.55)*4.2);
   var bwy=(ii===0?0:Math.abs(Math.sin(RIG.t*1.5+si*2.3+ii*0.4))*1.2);
   swx.push((S2.x[ii]-P.x)*P.facing+bwx); swy.push(S2.y[ii]-P.y+bwy); }
  for(ii=0;ii<n2;ii++){
   var px2=swx[ii], py2=swy[ii];
   var jx=(ii<n2-1?(swx[ii+1]-swx[ii]):(swx[ii]-swx[ii-1]));
   var jy=(ii<n2-1?(swy[ii+1]-swy[ii]):(swy[ii]-swy[ii-1]));
   var jl=Math.sqrt(jx*jx+jy*jy)||1, nx2=-jy/jl, ny2=jx/jl;
   var wv=RN.base*(1-(1-RN.taper)*(ii/(n2-1)))*(1+RN.waveAmp*Math.sin(ii*RN.waveK+si*2.1+RIG.t*RN.waveSpd));
   lx.push(px2+nx2*wv); ly.push(py2+ny2*wv); rx.push(px2-nx2*wv); ry.push(py2-ny2*wv); }
  /* W5-1 尾渲染延长：沿尾节方向续两点（1.75×/2.5×节向量；节长被物理约束 ≤7 ⇒ 延展 ≤10.5px），
     宽度续接 taper 递降（0.62/0.34×尾宽），摆幅逐点增大（RIG.t 相位递增） */
  var e1x=0,e1y=0,e2x=0,e2y=0;
  { var q0x=swx[n2-2], q0y=swy[n2-2], q1x=swx[n2-1], q1y=swy[n2-1];
   var qdx=q1x-q0x, qdy=q1y-q0y, ql2=Math.sqrt(qdx*qdx+qdy*qdy)||1;
   var qnx=-qdy/ql2, qny=qdx/ql2, wb1=RN.base*RN.taper;
   e1x=q0x+qdx*1.75+Math.sin(RIG.t*2.0+si*1.9+1.4)*6.0; e1y=q0y+qdy*1.75+Math.abs(Math.sin(RIG.t*1.5+si*2.3+0.8))*1.5;
   e2x=q0x+qdx*2.50+Math.sin(RIG.t*2.0+si*1.9+2.3)*7.5; e2y=q0y+qdy*2.50+Math.abs(Math.sin(RIG.t*1.5+si*2.3+1.5))*2.2;
   var w1=wb1*0.62, w2=wb1*0.34;
   lx.push(e1x+qnx*w1); ly.push(e1y+qny*w1); rx.push(e1x-qnx*w1); ry.push(e1y-qny*w1);
   lx.push(e2x+qnx*w2); ly.push(e2y+qny*w2); rx.push(e2x-qnx*w2); ry.push(e2y-qny*w2); }
  ctx.globalAlpha=al*0.5; ctx.fillStyle=RN.col; ctx.beginPath();
  ctx.moveTo(lx[0],ly[0]);
  for(ii=1;ii<lx.length;ii++)ctx.lineTo(lx[ii],ly[ii]);
  for(ii=lx.length-1;ii>=0;ii--)ctx.lineTo(rx[ii],ry[ii]);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha=al*0.85; ctx.strokeStyle=RN.col; ctx.lineWidth=1.7; ctx.beginPath();
  ctx.moveTo(swx[0],swy[0]);
  for(ii=1;ii<swx.length;ii++)ctx.lineTo(swx[ii],swy[ii]);
  ctx.lineTo(e1x,e1y); ctx.lineTo(e2x,e2y);
  ctx.stroke(); }
 /* 臂：两骨 IK 到手靶；工具（刀＝倒钩短刃，随 tool 角度） */
 var sx2=chX+1.5, sy2=chY+3;
 var aw=ik2(sx2,sy2,RIG.hx,RIG.hy,9,8,-1);
 strokeLimb([[sx2,sy2],[aw.kx,aw.ky]],3.0,al);
 strokeLimb([[aw.kx,aw.ky],[aw.ex,aw.ey]],2.7,al);
 var tdx=Math.cos(RIG.tool), tdy=Math.sin(RIG.tool);
 var tipx=aw.ex+tdx*22, tipy=aw.ey+tdy*22;
 /* D-2b 刀刃贝塞尔微弯（Loop D）：刃身沿切向 11px 处向法线偏 2.4px 的臂点作控制——微弧不破直刃观感，
    三笔（晕/底/亮）复用同一条路径；端点 tipx/tipy 不动 ⇒ pushBlade 采样不受影响 */
 var mcx=aw.ex+tdx*11-tdy*2.4, mcy=aw.ey+tdy*11+tdx*2.4;
 ctx.globalAlpha=al*0.25; ctx.strokeStyle=RIG.gcol; ctx.lineWidth=5;
 ctx.beginPath(); ctx.moveTo(aw.ex,aw.ey); ctx.quadraticCurveTo(mcx,mcy,tipx,tipy); ctx.stroke();
 ctx.globalAlpha=al; ctx.strokeStyle="#0b1322"; ctx.lineWidth=3.0; ctx.stroke();
 ctx.globalAlpha=al*0.95; ctx.strokeStyle="#eafcff"; ctx.lineWidth=1.8; ctx.stroke(); /* W5-1：1.2→1.8 亮刃=身份锚（G11 刃亮像素留裕量）；尖端+0.9 半宽仍 ∈ V25-C 466..472 */
 var bbx=aw.ex+tdx*14.5, bby=aw.ey+tdy*14.5, bpx=-tdy, bpy=tdx;
 ctx.globalAlpha=al; ctx.fillStyle="#0b1322"; ctx.strokeStyle="#eafcff"; ctx.lineWidth=0.8;
 ctx.beginPath(); ctx.moveTo(bbx-tdx*2,bby-tdy*2); ctx.lineTo(bbx+tdx*2,bby+tdy*2);
 ctx.lineTo(bbx+bpx*2.6,bby+bpy*2.6); ctx.closePath(); ctx.fill(); ctx.stroke();
 /* W5-1 护手芯灯（呼吸灯）：RIG.t 驱动⇒冻结即停；圆心＝护手沿刀向 1.3 上移 3.5＝护手上缘发光珠
    （r4.5：诊断实测——圆心若落腿/刀 gcol 亮线上会同色相叠「不闪」；上移后多半个圆在暗底上，
     闪烁可见且落进 G11 ZONE[290,303]×[452,466]；灯底世界 y≈462.7(含AA) < V25-C 刀尖亮像素 466.5）
    x∈[292,301]：区 [290,303] 内、离 v025-A 带 310 远。α 幅 0.20..0.95 */
 var gemx=bbx+tdx*1.3, gemy=bby+tdy*1.3-3.5, gemp=0.5+0.5*Math.sin(RIG.t*2.6+0.8), gema=0.20+0.75*gemp;
 ctx.globalAlpha=al*gema; ctx.fillStyle=RIG.gcol;
 ctx.beginPath(); ctx.arc(gemx,gemy,4.5,0,Math.PI*2); ctx.fill();
 ctx.globalAlpha=al*Math.min(1,gema*1.05); ctx.fillStyle="#eafcff";
 ctx.beginPath(); ctx.arc(gemx,gemy,1.6,0,Math.PI*2); ctx.fill();
 if(P.atk&&P.atk.phase==="act")pushBlade(P.x+tipx*P.facing,P.y+tipy);
 ctx.restore(); }
function drawEnemies(){ for(var i=0;i<enemies.length;i++){ var e=enemies[i]; var p=EKIND[e.kind];
 ctx.save(); ctx.translate(e.x,e.y);
 if(e.hp<=0){ ctx.globalAlpha=Math.max(0,1-e.t/0.6); ctx.scale(1, Math.max(0.3,1-e.t)); }
 else if(e.state==="wind"){ var wq=e.t/e.windup; ctx.rotate(-0.16*wq); ctx.translate(Math.sin(e.t*60)*wq*2,0); }
 else if(e.state==="strike"){ ctx.rotate(0.22); ctx.scale(1.18,1); }
 var col=e.flash>0?"#ffffff":p.color;
 ctx.strokeStyle=col; ctx.lineWidth=2.2; ctx.lineCap="round"; ctx.fillStyle="#141019";
 /* 腿（蹿动双笔；wind/strike 定身） */
 if(e.hp>0&&(e.state==="chase"||e.state==="patrol")){ var lph=e.t*11+e.seed;
  ctx.beginPath(); ctx.moveTo(-3,-12); ctx.lineTo(-3+Math.sin(lph)*5,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3,-12); ctx.lineTo(3+Math.sin(lph+Math.PI)*5,0); ctx.stroke(); }
 else { ctx.beginPath(); ctx.moveTo(-4,-12); ctx.lineTo(-5,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,-12); ctx.lineTo(5,0); ctx.stroke(); }
 /* 蛋形躯干（19×27 保持命中体量）＋种差装备 ≠ 换皮 */
 ctx.beginPath(); ctx.ellipse(0,-24,19,27,0,0,Math.PI*2); ctx.fill();
 if(e.state==="wind"){ ctx.strokeStyle="#ffffff"; ctx.lineWidth=3; ctx.stroke(); }
 else ctx.stroke();
 if(e.kind==="red"){ /* 灯架反派：扛一根灯杆 */
  ctx.strokeStyle="#2a2118"; ctx.lineWidth=3.4;
  ctx.beginPath(); ctx.moveTo(-6,-34); ctx.lineTo(-13,-56); ctx.stroke();
  ctx.strokeStyle=col; ctx.lineWidth=1.2; ctx.stroke();
  ctx.fillStyle="#141019"; ctx.beginPath(); ctx.arc(-13,-57,4.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.stroke(); }
 else if(e.kind==="elite"){ /* 大灯（W7）：追光灯剪影（连笔：灯罩→立柱→配重底；E30 立柱延至 −60＝接点加固 w7-edits:146 预授权） */
  ctx.strokeStyle="#2a2118"; ctx.lineWidth=3.4; ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(0,-60); ctx.stroke();
  ctx.strokeStyle=col; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(0,-60); ctx.stroke();
  ctx.fillStyle="#141019"; ctx.beginPath(); ctx.moveTo(-11,-72); ctx.lineTo(11,-72); ctx.lineTo(14,-58); ctx.lineTo(-14,-58); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=col; ctx.lineWidth=2.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0,-4,12,4,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle=p.glow; ctx.globalAlpha=0.55; ctx.beginPath(); ctx.arc(0,-65,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  if(e.phase>=2){ ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(-7,-72); ctx.lineTo(-16,-86); ctx.moveTo(7,-72); ctx.lineTo(16,-86); ctx.stroke(); } /* P2：灯头分叉双束（形状事件） */
 } else { /* 反光板反派：手持反光板 */
  ctx.save(); ctx.translate(11,-34);
  ctx.rotate(e.state==="wind"?-0.7:(e.state==="strike"?0.5:-0.15));
  ctx.fillStyle="#141019"; ctx.fillRect(-2,-9,5.5,18);
  ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.strokeRect(-2,-9,5.5,18);
  ctx.globalAlpha=0.5; ctx.fillStyle=p.glow; ctx.fillRect(-1,-7,3.5,14); ctx.globalAlpha=1; ctx.restore(); }
 var eR=6+(e.state==="wind"?4*(e.t/e.windup):0);
 ctx.fillStyle=(e.state==="wind")?"#ffffff":"#ffd9e2"; ctx.beginPath(); ctx.arc(e.dir*7,-38,eR,0,Math.PI*2); ctx.fill();
 if(e.hp>0&&e.hp<e.maxHp){ ctx.fillStyle="#ffffff22"; ctx.fillRect(-20,-60,40,4);
  ctx.fillStyle=p.glow; ctx.fillRect(-20,-60,40*(e.hp/e.maxHp),4); }
 if(e.hp>0&&e.state==="wind"){ /* 预警可视化：白描边已在体上，加收敛计时环（34→10） */
  var wq2=e.t/e.windup, rr=(e.kind==="elite"?58-28*wq2:34-24*wq2);
  ctx.globalAlpha=0.35+0.45*wq2; ctx.strokeStyle="#ffffff"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(0,-24,rr,0,Math.PI*2); ctx.stroke(); if(e.kind==="elite"&&e.phase>=2){ ctx.beginPath(); ctx.arc(0,-24,rr+8,0,Math.PI*2); ctx.stroke(); } ctx.globalAlpha=1; }
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
 else if(world.act>=2){ ctx.fillStyle="#ffd76a"; ctx.font="16px 'Microsoft YaHei',sans-serif"; ctx.textAlign="right";
  ctx.fillText(ACTS[world.act].card||ACTS[world.act].name,W-20,30); } /* 幕牌＝幕卡同串（d1 §28） */
 else if(world.wave===1){ ctx.fillStyle="#ffd76a"; ctx.font="16px 'Microsoft YaHei',sans-serif"; ctx.textAlign="right";
  ctx.fillText("序章 · 第1镜",W-20,30); }
 else if(world.wave===2){ ctx.fillStyle="#ffd76a"; ctx.font="16px 'Microsoft YaHei',sans-serif"; ctx.textAlign="right";
  ctx.fillText("序章 · 第2镜",W-20,30); }
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
 /* Loop6：playing 字幕箱上移至 ty=184——①给角色下盘让位（旧位 y444-502 压腿、也压 X6 带 463-470）
    ②ty≥179 恒不触月亮（y62-178）：v011 以 #16203a 质心散布为判据，箱盖月=质心跳变 ③title/dead 保持旧位。 */
 var tw=Math.min(760,W-120), tx=(W-tw)/2, ty=(world.phase==="playing")?184:H-96;
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
  ctx.textAlign="center"; ctx.shadowColor="#ffd76a"; ctx.shadowBlur=STROKE_SPEC.titleBlur;
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
  ctx.fillStyle="#ffd76a";
  if(world.continueReady){ ctx.font="20px 'Microsoft YaHei',sans-serif";
   ctx.fillText("按 J 开拍 · 下一场（手机点 ▶）",W/2,104);
   ctx.font="16px 'Microsoft YaHei',sans-serif";
   ctx.fillText("按 R 再来一次（手机点 ⟳）",W/2,132); }
  else { ctx.font="20px 'Microsoft YaHei',sans-serif";
   ctx.fillText("按 R 再来一次（手机点右下角 ⟳）",W/2,132); }
  ctx.restore(); } }
/* 演出层绘制：在震屏 restore 之外（与 HUD/旁白同级，不随 trauma 抖） */
function drawStaging(){
 if(STG.titleSec!==null){ /* 标题页：REC 红点＋走秒时间码（x836-916 带内）＋四角取景框 */
  var ts=STG.titleSec, mm=Math.floor(ts/60), ss=Math.floor(ts%60), tt=Math.floor(ts*10)%10;
  var p2=function(v){ return (v<10?"0":"")+v; };
  ctx.save();
  ctx.fillStyle="#ff4d5e"; ctx.beginPath(); ctx.arc(778,58,5.5,0,Math.PI*2); ctx.fill();
  ctx.font="bold 13px 'Segoe UI',sans-serif"; ctx.textAlign="left"; ctx.fillText("REC",790,63);
  ctx.font="15px Consolas,monospace"; ctx.fillStyle="rgba(232,238,252,0.85)"; ctx.textAlign="right";
  ctx.fillText(p2(mm)+":"+p2(ss)+"."+tt,916,62); ctx.textAlign="left";
  ctx.strokeStyle="rgba(159,178,216,0.5)"; ctx.lineWidth=2;
  var q=16,ql=26;
  ctx.beginPath();
  ctx.moveTo(q,q+ql); ctx.lineTo(q,q); ctx.lineTo(q+ql,q);
  ctx.moveTo(W-q-ql,q); ctx.lineTo(W-q,q); ctx.lineTo(W-q,q+ql);
  ctx.moveTo(q,H-q-ql); ctx.lineTo(q,H-q); ctx.lineTo(q+ql,H-q);
  ctx.moveTo(W-q-ql,H-q); ctx.lineTo(W-q,H-q); ctx.lineTo(W-q,H-q-ql); ctx.stroke();
  ctx.restore(); }
 if(STG.act){ var a=STG.act, u=(a.t<ACT_IN)?a.t/ACT_IN:((a.t<ACT_IN+ACT_HOLD)?1:1-(a.t-ACT_IN-ACT_HOLD)/ACT_OUT);
  var ease=u*(2-u); /* easeOutQuad */
  ctx.save();
  ctx.fillStyle="rgba(0,0,0,0.92)"; var hbar=46*ease;
  ctx.fillRect(0,0,W,hbar); ctx.fillRect(0,H-hbar,W,hbar);
  if(ease>0.08){ var sc=1.18-0.18*ease;
   ctx.translate(W/2,286); ctx.scale(sc,sc); ctx.globalAlpha=ease;
   ctx.textAlign="center"; ctx.fillStyle="#ffd76a"; ctx.font="bold 54px 'Microsoft YaHei',sans-serif";
   ctx.fillText(a.name,0,0); }
  ctx.restore(); }
 if(STG.death){ var d=STG.death, td=d.t;
  if(td<0.30){ var fa=0.9*(1-td/0.30); ctx.fillStyle="rgba(255,255,255,"+fa.toFixed(3)+")"; ctx.fillRect(0,0,W,H); }
  if(td<0.45){ var ka=(td<0.30)?1:Math.max(0,1-(td-0.30)/0.15);
   ctx.save(); ctx.globalAlpha=ka; ctx.textAlign="center"; ctx.fillStyle="#ff4d5e";
   ctx.font="bold 64px 'Microsoft YaHei',sans-serif"; ctx.fillText("卡！",W/2,390); ctx.restore(); }
  var ba=Math.min(1,td/0.12), bx=W/2-110, by=136; /* 场记板 y136-194（避开闪白带 200-320） */
  ctx.save(); ctx.globalAlpha=ba;
  ctx.fillStyle="rgba(242,244,248,0.94)"; roundRect(bx,by,220,58,6); ctx.fill();
  ctx.save(); roundRect(bx,by,220,16,6); ctx.clip(); ctx.fillStyle="#141108";
  for(var si=0;si<8;si++){ var sx0=bx+si*32-16;
   ctx.beginPath(); ctx.moveTo(sx0,by+16); ctx.lineTo(sx0+16,by); ctx.lineTo(sx0+32,by); ctx.lineTo(sx0+16,by+16); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle="rgba(20,17,8,0.55)"; ctx.lineWidth=1.5; roundRect(bx,by,220,58,6); ctx.stroke();
  ctx.fillStyle="#141108"; ctx.font="bold 21px 'Microsoft YaHei',sans-serif"; ctx.textAlign="center";
  ctx.fillText("第 "+d.n+" 条 · 重拍",W/2,by+42);
  ctx.restore(); }
 if(STG.cer){ var c=STG.cer, t=c.t;
  var uIn2=Math.min(1,t/CER_IN), eIn2=uIn2*(2-uIn2); /* 黑边滑入 easeOutQuad */
  var uOut2=(t>=CER_FADE0)?Math.min(1,(t-CER_FADE0)/(CER_TOTAL-CER_FADE0)):0;
  var bars2=46*Math.min(eIn2,1-uOut2);
  ctx.save();
  if(t>=CER_SEAL-0.03){ var ua2=Math.min(1,(t-(CER_SEAL-0.03))/0.30); /* 琥珀罩（怀旧片调） */
   var ak2=CER_AMBER*ua2*(1-uOut2);
   if(ak2>0.004){ ctx.fillStyle="rgba(255,176,64,"+ak2.toFixed(3)+")"; ctx.fillRect(0,0,W,H); } }
  if(t>=0.75&&t<CER_FADE0){ /* 胶片颗粒：128 噪声平铺＋每帧随机偏移 */
   var gt=grainTile(), ox2=(Math.random()*128)|0, oy2=(Math.random()*128)|0;
   ctx.globalAlpha=0.06;
   for(var gy2=oy2-128;gy2<H+128;gy2+=128)for(var gx2=ox2-128;gx2<W+128;gx2+=128)ctx.drawImage(gt,gx2,gy2);
   ctx.globalAlpha=1; }
  if(bars2>0.5){ ctx.fillStyle="rgba(0,0,0,0.92)"; ctx.fillRect(0,0,W,bars2); ctx.fillRect(0,H-bars2,W,bars2); }
  if(c.flashAt>=0&&t-c.flashAt<0.009){ ctx.fillStyle="rgba(255,255,255,0.96)"; ctx.fillRect(0,0,W,H); } /* 1 帧白闪 */
  if(t>=CER_SEAL&&t<2.0){ /* 「完」字盖印 */
   var us2=Math.min(1,(t-CER_SEAL)/0.25), sc3=1+1.2*(1-us2)*(1-us2);
   var aa3=Math.min(1,us2*2.5), fd2=(t>1.70)?Math.max(0,1-(t-1.70)/0.30):1;
   ctx.save(); ctx.translate(W/2,286); ctx.scale(sc3,sc3); ctx.globalAlpha=aa3*fd2;
   ctx.textAlign="center"; ctx.textBaseline="middle";
   ctx.font="bold 84px 'Microsoft YaHei',sans-serif";
   ctx.lineWidth=4; ctx.strokeStyle="rgba(56,38,10,0.55)"; ctx.strokeText("完",0,0);
   ctx.fillStyle="#ffd76a"; ctx.fillText("完",0,0); ctx.restore(); }
  if(t>=CER_BOARD&&t<CER_FADE0){ /* 「一条过」板 y208-270（避死拍板带 y134-196） */
   var ba3=Math.min(1,(t-CER_BOARD)/0.12), bx3=W/2-110, by3=210;
   ctx.save(); ctx.globalAlpha=ba3;
   ctx.fillStyle="rgba(242,244,248,0.94)"; roundRect(bx3,by3,220,58,6); ctx.fill();
   ctx.save(); roundRect(bx3,by3,220,16,6); ctx.clip(); ctx.fillStyle="#141108";
   for(var si3=0;si3<8;si3++){ var sx3=bx3+si3*32-16;
    ctx.beginPath(); ctx.moveTo(sx3,by3+16); ctx.lineTo(sx3+16,by3); ctx.lineTo(sx3+32,by3); ctx.lineTo(sx3+16,by3+16); ctx.closePath(); ctx.fill(); }
   ctx.restore();
   ctx.strokeStyle="rgba(20,17,8,0.55)"; ctx.lineWidth=1.5; roundRect(bx3,by3,220,58,6); ctx.stroke();
   ctx.fillStyle="#141108"; ctx.font="bold 22px 'Microsoft YaHei',sans-serif"; ctx.textAlign="center";
   ctx.fillText("一条过",W/2,by3+42); ctx.restore(); }
  ctx.restore(); }
 /* W4：spare 窗口提示（收手/补刀；基线 y486＝避开黑边 y494-540 与地面行 460-474 探针带） */
 if(world.spare&&world.spare.open){ var sw=world.spare;
  ctx.save(); ctx.textAlign="center"; ctx.globalAlpha=Math.min(1,sw.t/0.4);
  ctx.fillStyle="#ffd76a"; ctx.font="bold 18px 'Microsoft YaHei',sans-serif";
  ctx.fillText("J = 补刀 ｜ 等待 = 收手",W/2,486); ctx.restore(); }
 /* W4：杀青卡（结局后统计屏；R 再拍一条；全帧遮挡＝模态） */
 if(STG.card){ var ck=STG.card, cka=Math.min(1,ck.t/0.5);
  ctx.save(); ctx.globalAlpha=cka;
  ctx.fillStyle="rgba(5,7,13,0.92)"; ctx.fillRect(0,0,W,H);
  ctx.textAlign="center";
  ctx.fillStyle="#ffd76a"; ctx.font="bold 46px 'Microsoft YaHei',sans-serif";
  ctx.fillText("拆 台 · 杀青",W/2,150);
  var cid=world.ending?world.ending.id.replace("end_","").toUpperCase():"-",
   csp=world.ending?(world.ending.spared?"收手":"补刀"):"-",
   clines=["结局 "+cid+" · "+csp,
    "用时 "+Math.floor(world.t/60)+" 分 "+Math.floor(world.t%60)+" 秒",
    "死亡 "+world.deaths+" · 闪避 "+player.perfDodges,
    "拆台 "+world.wallHits+" · 连击 "+world.maxCombo];
  ctx.font="20px 'Microsoft YaHei',sans-serif";
  for(var ci=0;ci<clines.length;ci++){ var cla=Math.min(1,Math.max(0,(ck.t-0.5-ci*0.06)/0.3));
   ctx.globalAlpha=cka*cla; ctx.fillStyle=(ci===0)?"#e8eefc":"#9fb2d8";
   ctx.fillText(clines[ci],W/2,236+ci*40); }
  ctx.globalAlpha=cka*Math.min(1,Math.max(0,(ck.t-1.2)/0.4));
  ctx.fillStyle="#ffd76a"; ctx.font="18px 'Microsoft YaHei',sans-serif";
  ctx.fillText("R 再拍一条",W/2,470);
  ctx.restore(); } }
function render(sec){ LAY.stats.fg++; /* 前景＝每次渲染即现状帧率（verify-visual-v1 J3 fgFps 计数点） */
 var sx=(Math.random()*2-1)*26*world.trauma*world.trauma,
 sy=(Math.random()*2-1)*20*world.trauma*world.trauma;
 ctx.save(); ctx.translate(sx,sy);
 drawBG(); drawAtmo(); drawGuide(); drawWall(); drawPlatforms(); drawT3Build(); drawTraps();
 if(!player.dead){ var pb=groundUnder(player.x,player.y);
  drawRefl(player.x,pb,player.y,player.hurtT>0?"#ff6a86":"#7df9ff",30); if(SHADOW_ON)drawShadow(player.x,pb,player.y,28); }
 for(var ei=0;ei<enemies.length;ei++){ var en=enemies[ei]; if(en.hp<=0)continue; var eb2=groundUnder(en.x,en.y);
  drawRefl(en.x,eb2,en.y,en.kind==="red"?"#ff8fa3":(en.kind==="elite"?"#ffcf7a":"#d9b3ff"),26); if(SHADOW_ON)drawShadow(en.x,eb2,en.y,15); }
 if(boss.active){ var bb=groundUnder(boss.x,boss.y);
  drawRefl(boss.x,bb,boss.y,boss.narr==="enraged"?"#ff8fa3":"#ffd76a",46); if(SHADOW_ON)drawShadow(boss.x,bb,boss.y,42); } /* C-3 绑色（反射站点；与 871 端点两处同改） */
 drawEnemies(); drawBossAura(); drawBoss(); drawPlayer(); drawBladeTrail(); drawQiTrail(); drawQi(); drawFx();
 ctx.restore();
 ppBloom(sx,sy); /* 后处理第一级 Bloom（含 Tone 软肩）：震屏外合成；缓冲重绘吃同一 (sx,sy) ⇒ 辉光永远贴体 */
 if(world.slowT>0){ ctx.fillStyle="rgba(125,249,255,0.05)"; ctx.fillRect(0,0,W,H); } /* 慢动作罩（C-4：色相已拉回主色B 183°） */
 drawHUD(); drawNarrator(); drawOverlays();
 drawVignette(); /* 后处理第三级 Vignette：在演出层之前——栈序 Bloom→Tone→Vignette→Grain（Grain 在 drawStaging 末） */
 drawFlash(); /* W5.3 收刀闪白（static alpha ⇒ 冻结窗逐字节稳定；0 时零绘制） */
 drawStaging(); }

/* ============ 后处理栈（Loop B / 视觉宪法 §5：Bloom → ToneMapping → Vignette → Optional Grain） ============
   参数铁律（宪法 §5）：全部从 window.VISUAL_CONFIG 活读（assets/visual-config.js 预加载）——game.js 零硬编码；
   配置缺失 ⇒ 整体关闭（安全降级，不启用内置镜像值）。探针：tools/verify-visual-v1.cjs（判据 2）。
   仪器避让（宪法 §8）：
   - Bloom 只吃「氛围/特效源」：尘埃/火星(drawAtmo)、刀轨(drawBladeTrail)、fx 粒子/环/刀弧(drawFx)。
     玩家三笔剪影/敌人/背景/平台/HUD/文本/演出层一律不进缓冲（v025-A 静止带、v025-C 负控、v026 计数区、
     v011 月面、v012-X4 点——它们都只在主画布、从不进 blur 缓冲）。
   - 两条 tap ＝ gain（近场）＋ gain×toneShoulder（更宽更暗 = ToneMapping 软肩）。
   - Vignette 内径 ≥0.88：内区逐像素恒等（v012-X4 点 t=0.8526、月盘最远 t≤0.65 均在内区）。
   - 两级均为 (内容, 静态参数) 的纯函数：零时间噪声 ⇒ v027-C3 冻结窗逐字节全等保持。 */
var PP={ b:null, A:null, B:null };
function ppCfg(){ return (typeof window!=="undefined"&&window.VISUAL_CONFIG)||null; }
function ppBloom(sx,sy){ var c=ppCfg(); if(!c||!c.bloom||!c.bloom.enabled)return;
 var ds=Math.max(2,c.bloom.downscale|0), gain=+c.bloom.gain, sh=+c.bloom.toneShoulder;
 var bw=Math.ceil(W/ds), bh=Math.ceil(H/ds);
 if(!PP.b){ PP.b=document.createElement("canvas"); PP.b.width=bw; PP.b.height=bh;
  PP.A=document.createElement("canvas"); PP.A.width=Math.ceil(bw/2); PP.A.height=Math.ceil(bh/2);
  PP.B=document.createElement("canvas"); PP.B.width=Math.ceil(bw/4); PP.B.height=Math.ceil(bh/4); }
 var gb=PP.b.getContext("2d");
 gb.setTransform(1,0,0,1,0,0); gb.clearRect(0,0,bw,bh);
 gb.setTransform(1/ds,0,0,1/ds,0,0); gb.translate(sx,sy);
 var gMain=ctx; ctx=gb; drawAtmo(); drawBladeTrail(); drawQiTrail(); drawQi(); drawFx();
 if(boss.active&&!boss.dead)drawBossAura(); /* 宪法 §5（Loop D 起）：Boss 光环入 Bloom 源序列 */
 ctx=gMain;
 var ga=PP.A.getContext("2d");
 ga.setTransform(1,0,0,1,0,0); ga.clearRect(0,0,PP.A.width,PP.A.height);
 ga.drawImage(PP.b,0,0,PP.A.width,PP.A.height);
 var gB=PP.B.getContext("2d");
 gB.setTransform(1,0,0,1,0,0); gB.clearRect(0,0,PP.B.width,PP.B.height);
 gB.drawImage(PP.A,0,0,PP.B.width,PP.B.height);
 ctx.save(); ctx.globalCompositeOperation="lighter";
 ctx.globalAlpha=gain; ctx.drawImage(PP.A,0,0,W,H);
 ctx.globalAlpha=gain*sh; ctx.drawImage(PP.B,0,0,W,H);
 ctx.restore(); }
function drawVignette(){ var c=ppCfg(); if(!c||!c.vignette||!c.vignette.enabled)return;
 var inner=+c.vignette.inner, outer=+c.vignette.outer, maxD=+c.vignette.maxDark;
 var half=Math.sqrt((W/2)*(W/2)+(H/2)*(H/2));
 var gr=ctx.createRadialGradient(W/2,H/2,half*inner,W/2,H/2,half*outer);
 gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(0,0,0,"+maxD+")");
 ctx.save(); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H); ctx.restore(); }
/* 后处理栈状态（debug.pp() 契约；全部字段活读 VISUAL_CONFIG——改配置即时反映，无缓存无镜像） */
function ppState(){ var c=ppCfg();
 function sec(k){ return c&&c[k]?c[k]:null; }
 var b=sec("bloom"), t=sec("tone"), v=sec("vignette"), gr2=sec("grain");
 return { enabled: !!(b&&b.enabled)||!!(v&&v.enabled)||!!(gr2&&gr2.enabled), order:["bloom","tone","vignette","grain"],
  params:{ bloom:{enabled:!!(b&&b.enabled), downscale:b?+b.downscale:null, gain:b?+b.gain:null, toneShoulder:b?+b.toneShoulder:null},
   tone:{enabled:!!(t&&t.enabled)},
   vignette:{enabled:!!(v&&v.enabled), inner:v?+v.inner:null, outer:v?+v.outer:null, maxDark:v?+v.maxDark:null},
   grain:{enabled:!!(gr2&&gr2.enabled), alpha:gr2?+gr2.alpha:null, ceremonyOnly:gr2?!!gr2.ceremonyOnly:null} } }; }
function setPP(o){ var c=ppCfg(); if(!c)return null;
 if(o)for(var k in o){ if(!c[k])c[k]={}; var s=o[k]; for(var k2 in s)c[k][k2]=s[k2]; }
 return ppState(); }
/* 调色板注册表（宪法 §1/§2 的机械载体；verify-visual-v1 J1 契约）：配置清单＋分幕调色板在场登记 */
function paletteRegistry(){ var c=ppCfg(), allowed=[];
 if(c&&c.palette&&c.palette.allowed)allowed=c.palette.allowed.slice();
 for(var k in PALETTES){ var p=PALETTES[k]; for(var f in p){ var v=String(p[f]).slice(0,7).toLowerCase();
  if(v.charAt(0)==="#"&&allowed.indexOf(v)<0)allowed.push(v); } } /* 附件 A：幕调色板真值扫描登记 */
 return { anchors:(c&&c.palette&&c.palette.anchors)||{}, locked:(c&&c.palette&&c.palette.locked)||{}, allowed:allowed }; }
/* 描边规格回读（verify-visual-v1 J4 契约）：与 strokeLimb/drawBoss/标题大字同一数据源 STROKE_SPEC */
function strokeProfile(){ return { player:{layers:STROKE_SPEC.playerLayers, glowW:STROKE_SPEC.glowW, glowA:STROKE_SPEC.glowA,
  core:STROKE_SPEC.core, thin:STROKE_SPEC.thin},
 bgStroke:STROKE_SPEC.bgStroke, bossBlur:STROKE_SPEC.bossBlur, titleBlur:STROKE_SPEC.titleBlur, otherBlur:STROKE_SPEC.otherBlur }; }

/* ============ 检查点 / 存档（d2 §7 检查点链＋d8 契约 v2；Loop5 灰盒） ============
 介质＝localStorage〔2026-10-13 实测 file:// 下可用：读写/重载持久/跨进程启动持久；
 key 前缀 chaitai. 防与同 origin 其他本地页串键〕。存档内容＝durable 七字段（见 REGISTRY.durableFields）。
 灰盒口径：只落 API＋内存元（saveMem）——不自动落盘、不带读档恢复（接线属幕循环）；
 state().save={enabled,slot,version,dirty}。指纹＝七字段固定序 JSON（逐字节可比；"往返×3"判据用）。 */
var SAVE_V=1, SAVE_KEY="chaitai.save.v1", DIFFICULTY="normal";
var saveMem={enabled:false,slot:null,lastFp:null};
(function(){ try{ localStorage.setItem("__chaitai_probe","1"); localStorage.removeItem("__chaitai_probe"); saveMem.enabled=true; }catch(e){ saveMem.enabled=false; } })();
function setCp(id){ var L=world.cpLog; if(L.length&&L[L.length-1].id===id)return id; /* 连记去重 */
 world.cp=id; L.push({id:id,t:+world.t.toFixed(2)}); return id; }
function buildDurable(){ return {act:world.started?1:0,cp:world.cp,deaths:world.deaths,defyLeft:world.defyLeft,
 perfDodges:player.perfDodges,difficulty:DIFFICULTY,ended:world.ended.slice()}; }
function fingerprint(o){ var d=o||buildDurable(); return JSON.stringify([d.act,d.cp,d.deaths,d.defyLeft,d.perfDodges,d.difficulty,d.ended]); }
function validDurable(d){ return !!d&&typeof d==="object"&&typeof d.act==="number"&&typeof d.cp==="string"
 &&typeof d.deaths==="number"&&typeof d.defyLeft==="number"&&typeof d.perfDodges==="number"
 &&typeof d.difficulty==="string"&&Object.prototype.toString.call(d.ended)==="[object Array]"; }
function saveWrite(){ if(!saveMem.enabled)return {ok:false,reason:"disabled"};
 try{ var d=buildDurable(), fp=fingerprint(d);
  localStorage.setItem(SAVE_KEY,JSON.stringify({v:SAVE_V,ts:Date.now(),durable:d}));
  saveMem.slot="auto"; saveMem.lastFp=fp; return {ok:true,fp:fp}; }
 catch(e){ return {ok:false,reason:"io"}; } }
function saveRead(){ if(!saveMem.enabled)return {ok:false,reason:"disabled"};
 var raw=null; try{ raw=localStorage.getItem(SAVE_KEY); }catch(e){ return {ok:false,reason:"io"}; }
 if(raw==null)return {ok:false,reason:"empty"};
 var o=null; try{ o=JSON.parse(raw); }catch(e){ return {ok:false,reason:"corrupt"}; }
 if(!o||typeof o!=="object"||typeof o.v!=="number"||!validDurable(o.durable))return {ok:false,reason:"corrupt"};
 if(o.v!==SAVE_V)return {ok:false,reason:"version",found:o.v}; /* 迁移桩：现仅 v1，旧版直判负 */
 return {ok:true,data:o}; }
function saveClear(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} saveMem.slot=null; saveMem.lastFp=null; return {ok:true}; }
(function(){ try{ var raw=localStorage.getItem(SAVE_KEY); if(raw!=null){ var o=JSON.parse(raw);
 if(o&&o.v===SAVE_V&&validDurable(o.durable)){ saveMem.slot="auto"; saveMem.lastFp=fingerprint(o.durable); } } }catch(e){} })();

/* ============ 测试钩子（契约 v2，见 review-v02/d8-qa/qa-plan.md §1） ============ */
/* registry＝登记表：v0.2 新内容在此登记后，套件/画像探针据此长覆盖，不必人肉加闸 */
var REGISTRY={ acts:[{id:1,name:"序章",stage:"playable",note:"=v0.1 切片体量"},
 {id:2,name:"第一幕",stage:"playable",note:"W1(2026-10-15) 接线：幕通用机＋台箱布局＋E1-1/2/3＋T-STAND＋「按 J 开拍」（gate-7）"},
 {id:3,name:"第二幕",stage:"playable",note:"ACTS[3]＋砌墙规则已接线（W2）"},
 {id:4,name:"第三幕",stage:"playable",note:"W3(2026-10-15) 接线：灯带 T=6.0 全程＋A3-2 同拍落物 3 点错峰 0.9s×2 波＋A3-3 可拆墙 hp32（墙倒前清场链不开墙）＋幕终「搭台」升 T3（gate-9）"},
 {id:5,name:"终幕",stage:"playable",note:"W4(2026-10-15) 接线：Boss 上 T3 hp120 三阶段（p1 墙压+灯扫 1.6s／p2 灯扫+雨+2红 once／p3 三连 1.2s）＋boss_defeat→spare 窗口(6s 收手/按 J 补刀)→结局 a-d＋杀青卡（gate-10）"}],
 mechanics:[{id:"move",act:1,event:"first_move"},{id:"jump",act:1},{id:"air_jump",act:1},
  {id:"attack3",act:1,event:"combo_praise"},{id:"dash",act:1},{id:"perfect_dodge",act:1,event:"perfect_dodge"},
  {id:"defy_wall",act:1,event:"wall_build"},{id:"platform",act:1,note:"台箱布局 W1 接线（第一幕 T1/T2/T3，d2 §3 台箱表）"},
  {id:"trap_lamp",act:4,note:"机关：灯带（Loop3 灰盒系统；W3 第三幕接线＝A3 全程 T=6.0；W4 终幕＝Boss 招·灯扫 T=4.2）"},
  {id:"trap_drop",act:4,note:"机关：道具坠落（Loop3 灰盒系统；W3 第三幕接线＝A3-2 同拍 2 波×3 点错峰 0.9s）"},
  {id:"wall_break",act:4,note:"可拆墙（W3）：A3-3 hp32＝一套三连击 8+9+15；墙倒前清场链不开墙；破墙事件 cp=a3_break"},
  {id:"trap_press",act:5,note:"Boss 招·墙压（Loop4 灰盒；d2 §6 招表；W4 接线＋判定加 y 带 y>420 防误判台上）"},
  {id:"boss_entity",act:5,note:"Boss 实体（Loop4 灰盒→W4 接线）：hp120/三阶段招序读 ACTS[5]；入场＝startAct(5)+2.0s；阶段门＝cp a4_p2/p3"},
  {id:"boss_narr",act:5,note:"BossNarrativeController：Idle/Taunting/Enraged（Harness 点名；转移即 Narr.fire）"}],
 endings:[{id:"slice_outro",act:1,recipe:"cleared=true → outro"},
  {id:"end_a",act:5,recipe:"「一条过」：world.deaths===0（自本局加载起零死亡；收手/补刀皆可；优先级次于 end_d）→ ending_a 连发 5 档"},
  {id:"end_b",act:5,recipe:"「都散了」：deaths>0＋spare 窗口按 J 补刀 → ending_b 连发 5 档"},
  {id:"end_c",act:5,recipe:"「合约重签」：deaths>0＋窗口静候满 6s 收手 → ending_c 连发 3 档"},
  {id:"end_d",act:5,recipe:"隐藏「敲门」：攻击命中墙累计≥9（敲够九下）→ ending_d 连发 3 档（判定树最高优先：d＞a＞收手 c／补刀 b）"}],
 staging:[{id:"title_rec",scope:"title",note:"REC 红点＋走秒时间码＋四角取景框（Loop7 P1-2；state().staging.titleSec）"},
  {id:"act_card",scope:"wave1/wave2",note:"黑边滑入＋大字 1.7s（Loop7 P1-2；state().staging.act；Loop8 起 cleared 不再盖章）"},
  {id:"death_clapper",scope:"death",note:"闪白＋卡！＋第N条场记板（N=world.deaths；Loop7 P1-2；state().staging.death）"},
  {id:"ceremony_final",scope:"cleared→+4.5s",note:"结局仪式：黑边滑入0.4→冻结0.3→1帧白闪→完字+琥珀罩→胶片颗粒→2.2s一条过板；4.5s自清（Loop8 P1-3；state().staging.ceremony）"},
  {id:"atmo_dust",scope:"全相(title/act1/act2/clear)",note:"常驻尘埃 40 粒：慢漂(vx±5/vy±3 px/s)、α0.15、色#ffecd2、y≤454（Loop9 P1-1；state().atmo.dust）"},
  {id:"atmo_ember",scope:"palKey==act2∧!cleared（序章W2＋2+幕）",note:"上升火星 ≤24：vy−30~−50、寿命1.2-2.2s、顶点 y≥360、色=该幕霓虹（Loop9 P1-1；state().atmo.ember）"},
  {id:"endcard",scope:"结局分镜后（ceremony 自清→卡）",note:"杀青卡：结局 id+收手/补刀＋统计（用时/死亡/闪避/拆台/连击）＋R 再拍一条；showRestart 同置（W4；state().staging.card）"}],
 checkpoints:[{id:"game_start",act:1,stage:"live",note:"beginGame 0.5s 后（≡d2 §7 p0_start）"},
  {id:"wave1",act:1,stage:"live",note:"x>420 触发 W1（≡p0_w1）"},
  {id:"wave2",act:1,stage:"live",note:"W1 清后链 spawnWave(2)"},
  {id:"arena_cleared",act:1,stage:"live",note:"W2 清后 clearDelay 回调（≡p0_clear）"},
  {id:"outro",act:1,stage:"live",note:"outroDelay 回调（通关旁白）"},
  {id:"restart_done",act:1,stage:"live",note:"R 重开 restart()"},
  {id:"a1_e1",act:2,stage:"live"},{id:"a1_e2",act:2,stage:"live"},{id:"a1_e3",act:2,stage:"live"},{id:"a1_end",act:2,stage:"live"},
  {id:"act2_open",act:3,stage:"live"},{id:"a2_teach",act:3,stage:"live"},{id:"a2_a1",act:3,stage:"live"},{id:"a2_a2",act:3,stage:"live"},{id:"a2_end",act:3,stage:"live"},
  {id:"act3_open",act:4,stage:"live"},{id:"a3_1",act:4,stage:"live"},{id:"a3_2",act:4,stage:"live"},{id:"a3_3",act:4,stage:"live"},{id:"a3_break",act:4,stage:"live",note:"破墙事件（hitWall 击破瞬间；W3）"},{id:"a3_end",act:4,stage:"live",note:"幕终（砸场记板；W3）"},
  {id:"act4_open",act:5,stage:"live",note:"幕开（startAct(5)；W4）"},{id:"boss_intro",act:5,stage:"live",note:"Boss 登场（spawnBoss；W4）"},{id:"a4_p1",act:5,stage:"live",note:"p1 开场（spawnBoss 同帧；W4）"},{id:"a4_p2",act:5,stage:"live",note:"hp≤80 阶段门；W4"},{id:"a4_p3",act:5,stage:"live",note:"hp≤40 阶段门；W4"},{id:"a4_down",act:5,stage:"live",note:"boss_defeat；W4"},{id:"a4_choice",act:5,stage:"live",note:"spare 窗口开（openSpare；W4）"},
  {id:"end_a",act:5,stage:"live",note:"W4"},{id:"end_b",act:5,stage:"live",note:"W4"},{id:"end_c",act:5,stage:"live",note:"W4"},{id:"end_d",act:5,stage:"live",note:"W4"}],
 durableFields:[{k:"act",note:"当前幕（W1 起真值；序章=1）"},
  {k:"cp",note:"最新经过点 id（registry.checkpoints 之一）"},
  {k:"deaths",note:"本局死亡数"},
  {k:"defyLeft",note:"拆台计数（砌墙进度）"},
  {k:"perfDodges",note:"一闪次数（含 Boss 反）"},
  {k:"difficulty",note:"难度（现常量 normal；难度系统未建）"},
  {k:"ended",note:"已达成结局 id 列表（W4 接线：结局触发即入列、去重、跨局累计）"}],
 mechanicsMustFire:[{act:1,ids:["move","attack3","dash","defy_wall"]},{act:5,ids:["trap_press","boss_entity"]}] };
function state(){ return {
 phase:world.phase, wave:world.wave, cleared:!!world.cleared, arena:world.arena,
 act:world.started?world.act:0, enc:world.enc, encPhase:world.encPhase, dropWaves:world.dropWavesFired|0,
 actHold:!!world.actHold, continueReady:!!world.continueReady, showRestart:!!world.showRestart,
 plats:PLATFORMS.map(function(p){ return {x:p.x,y:p.y,w:p.w,h:p.h}; }),
 lastSpawn:world.lastSpawn?{act:world.lastSpawn.act,id:world.lastSpawn.id,born:world.lastSpawn.born}:null,
 ending:world.ending?world.ending.id:null, ended:world.ended.slice(),
 spare:world.spare&&world.spare.open?{open:true,t:+world.spare.t.toFixed(2)}:null,
 wallHits:world.wallHits, maxCombo:world.maxCombo,
 boss:{active:boss.active,phase:boss.active?boss.phase:0,hp:boss.hp,maxHp:boss.maxHp,
  x:+boss.x.toFixed(1),y:+boss.y.toFixed(1),narr:boss.narr,state:boss.state,dead:boss.dead},
 menu:{screen:"none"}, save:{enabled:saveMem.enabled,slot:saveMem.slot,version:SAVE_V,dirty:saveMem.lastFp!==null&&fingerprint()!==saveMem.lastFp},
 audio:{osc:Music.live,intensity:+Music.cur.toFixed(2)},
 player:{x:+player.x.toFixed(1),y:+player.y.toFixed(1),vx:+player.vx.toFixed(1),vy:+player.vy.toFixed(1),
  hp:player.hp,maxHp:player.maxHp,grounded:player.grounded,dashing:player.dashT>0,invuln:player.invuln>0,
  attacking:!!player.atk,facing:player.facing,combo:player.combo,walk:+player.walk.toFixed(3)},
 dyn:{afterimages:ghosts.length,bladeTrail:bladeTrail.length,qiTrail:qiTrail.length,qiParts:qiCount(),qiActive:!!qi,
  hitstop:+world.hitstop.toFixed(3),slowT:+world.slowT.toFixed(3),flash:+world.flashW.toFixed(3),
  iaiW:+player.iaiW.toFixed(3),iaido:+(player.iaiFire||0).toFixed(3),iaidoN:world.iaiN|0,atkActive:!!player.atk,
  buf:{atk:+player.atkBuf.toFixed(3),jump:+player.jumpBuf.toFixed(3),dash:+player.dashBuf.toFixed(3)}},
 enemies:enemies.map(function(e){return {id:e.id,kind:e.kind,x:+e.x.toFixed(1),y:+e.y.toFixed(1),vx:+(e.vx||0).toFixed(1),hp:e.hp,maxHp:e.maxHp,state:e.state,flash:+(e.flash||0).toFixed(2),phase:(e.phase|0),chain:(e.chain|0)};}), /* W7 契约：phase/chain（精英门与连挥；red/purple 恒 1/0） */ /* W6.1 契约：vx/flash（受击反应可观测） */
 wall:{built:wall.built,rising:wall.rising,sideRight:wall.sideRight,warn:world.wallWarnT!=null?+world.wallWarnT.toFixed(2):null,
  hp:Math.round(wall.hp),breakable:!!wall.breakable,breaking:!!wall.breaking}, /* W2：sideRight/warn；W3：hp/breakable/breaking（gate-9 契约） */
 atmo:{dust:dust.length,ember:embers.length},
 dbg:{on:DBG.on,pause:DBG.pause,t:+world.t.toFixed(3)},
 traps:traps.map(function(t){ if(t.type==="lamp")return {type:"lamp",T:t.T,t:+t.t.toFixed(4),x:+lampX(t.t,t.T).toFixed(2),warnX:+lampX(t.t+LAMP_WARN,t.T).toFixed(2)};
  if(t.type==="press")return {type:"press",x:+t.x.toFixed(1),y:+t.y.toFixed(1),phase:t.phase,age:+t.t.toFixed(3),hit:!!t.hit};
  return {type:"drop",x:+t.x.toFixed(1),y:+t.y.toFixed(1),phase:t.phase,lead:+t.lead.toFixed(2),age:+(t.t-t.lead).toFixed(2),hit:!!t.hit}; }),
 staging:{ act:STG.act?{name:STG.act.name,t:+STG.act.t.toFixed(3)}:null,
  t3build:STG.t3build?{t:+STG.t3build.t.toFixed(3),done:!!STG.t3build.done}:null,
  death:STG.death?{n:STG.death.n,t:+STG.death.t.toFixed(3)}:null,
  ceremony:STG.cer?{t:+STG.cer.t.toFixed(3),flashAt:+STG.cer.flashAt.toFixed(3)}:null,
  card:STG.card?{t:+STG.card.t.toFixed(3)}:null,
  titleSec:STG.titleSec===null?null:+STG.titleSec.toFixed(2) },
 narrator:{current:Narr.cur?Narr.cur.line.text:null,queueLen:Narr.queue.length,
  counters:{defyLeft:world.defyLeft,deaths:world.deaths,perfectDodges:player.perfDodges},
  log:Narr.log.slice()} }; }
window.__game={ version:VER, state:state, debug:{
 hurtPlayer:function(n){ damagePlayer(n,1,true); },
 clearWave:function(){ for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.hp>0){ e.hp=0;e.state="dead";e.t=0;
  hitBurst(e.x,e.y-24,"enemyDrop",e.kind==="red"?"#ff5a78":(e.kind==="elite"?"#ffb040":"#c88bff")); } } },
 setPlayerX:function(x){ player.x=clamp(x,24,W-26); },
 setPlatforms:function(list){ setPlatformsData(list); },
 audioCount:function(){ return Music.live; },
 audioLog:function(){ return (AudioSys.log||[]).slice(); }, /* W4.1（A3）：音频播放记录（环形 32、含静音请求；契约 v2 增键） */
 setShadow:function(v){ SHADOW_ON=(v!==false); return SHADOW_ON; },
 spawnLamp:function(T){ traps.push(mkLamp(T)); return traps.length; },
 spawnDrop:function(x,lead){ traps.push(mkDrop(x,lead)); return traps.length; },
 dropBurst:function(xs,stagger){ dropBurst(xs,stagger); return traps.length; },
 spawnPress:function(x){ traps.push(mkPress(x==null?player.x:x)); return traps.length; },
 clearTraps:function(){ traps.length=0; },
 setPlayerPos:function(x,y){ player.x=clamp(x,24,W-26); player.y=+y||GY; player.vx=0; player.vy=0; player.grounded=true; return {x:player.x,y:player.y}; },
 /* Loop9 氛围粒子钩子（v028 契约）：setDust=重建 n 粒（0=清、clamp≤40、返回实际数）；setEmber(0)=清、n>0 循环补至 n（吃 24 上限、返回实际数）；atmoPos=全量坐标 */
 setDust:function(n){ return initDust(n); },
 setEmber:function(n){ n=n|0; if(n<=0){ embers.length=0; return 0; } while(n-->0)spawnEmberOnce(); return embers.length; },
 atmoPos:function(){ function p(a){ var r=[]; for(var i=0;i<a.length;i++)r.push({x:+a[i].x.toFixed(2),y:+a[i].y.toFixed(2)}); return r; }
  return {dust:p(dust),ember:p(embers)}; },
 spawnBoss:function(x){ spawnBoss(x); return {x:boss.x,y:boss.y,hp:boss.hp}; },
 spawnEnemy:function(kind,x){ if(!EKIND[kind])return null; var e=mkEnemy(kind,clamp(+x||300,24,W-24)); enemies.push(e); return e.id; },
 enemyHit:function(id,dmg){ for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.id===id&&e.hp>0){ applyHit(e,Math.max(1,+dmg||1),e.x>=player.x?1:-1,{kx:180}); return e.hp; } } return null; },
 startAct:function(n){ startAct(+n||1); return {act:world.act,encPhase:world.encPhase}; }, /* W4：测试快径（gate-10/falsify 用；走真 startAct 全链，不影响正常流程） */
 clearBoss:clearBoss,
 bossDamage:function(n){ hitBoss(+n||1,1,{hs:0.05,sh:0.2,step:1}); return boss.hp; },
 saveWrite:function(){ return saveWrite(); },
 saveRead:function(){ return saveRead(); },
 saveClear:function(){ return saveClear(); },
 setEnded:function(list){ world.ended.length=0; if(list)for(var i=0;i<list.length;i++)world.ended.push(String(list[i])); return world.ended.slice(); },
 saveFingerprint:function(){ return fingerprint(); },
 cp:function(){ return {id:world.cp,log:world.cpLog.slice()}; },
 /* Loop6 骨架探针（v025-B 契约）：feet=世界坐标；cx=支撑点/摆动轨迹 x，cy=落定时 GY、离地时为弧高，p=1 落定 */
 rig:function(){ return { walk:+player.walk.toFixed(3),
  state:player.dead?"dead":(player.dashT>0?"dash":(!player.grounded?"air":((anyDown(MOVE_L)||anyDown(MOVE_R))?"move":"idle"))),
  crouch:+RIG.crouch.toFixed(3), /* Loop10 观测字段（v029 契约）：待机呼吸 */
  hand:{x:+RIG.hx.toFixed(2),y:+RIG.hy.toFixed(2)}, /* Loop10：走路摆臂 */
  ribbon:{ax:+RIG.rax.toFixed(2),ay:+RIG.ray.toFixed(2),s0x:+RIG.sa.x[1].toFixed(2),s0y:+RIG.sa.y[1].toFixed(2),init:!!RIG.sa.init}, /* Loop10：发带锚点/首节 */
  feet:[{cx:+RIG.feet[0].wx.toFixed(2),cy:(RIG.feet[0].pl?GY:+RIG.feet[0].wy.toFixed(2)),p:RIG.feet[0].pl},
        {cx:+RIG.feet[1].wx.toFixed(2),cy:(RIG.feet[1].pl?GY:+RIG.feet[1].wy.toFixed(2)),p:RIG.feet[1].pl}] }; },
 registry:REGISTRY, acts:ACTS, lastSpawn:function(){ return world.lastSpawn; }, triggerCheck:triggerCheck,
 /* Loop B 视觉钩子（verify-visual-v1 J1/J2/J4 契约）：全部活读 VISUAL_CONFIG/STROKE_SPEC，无缓存 */
 pp:ppState, setPP:setPP, paletteRegistry:paletteRegistry, strokeProfile:strokeProfile,
 /* Loop C 动态层级钩子（verify-visual-v1 J3 契约）：layers=活读当前偏移（数学）；layerStats=帧率计数（reset===0 归零） */
 layers:function(){ return {far:layOffF(),mid:layOffM(),fg:0}; },
 layerStats:function(reset){ var s={far:LAY.stats.far,mid:LAY.stats.mid,fg:LAY.stats.fg};
  if(reset===0){ LAY.stats.far=0; LAY.stats.mid=0; LAY.stats.fg=0; } return s; },
 /* 探针冻结（verify-visual-v1 J4 像素采样用）：等同游戏内 hitstop 门——世界全停、渲染照常。
    t=0 解除。测棚专用钩子，不参与任何玩法路径。 */
 setHitstop:function(t){ world.hitstop=Math.max(0,+t||0); },
 /* W5.3 动态表现力钩子（gate-13-dynamics 契约） */
 afterimageCount:function(){ return ghosts.length; },
 bladeTrailCount:function(){ return bladeTrail.length; },
 qiParticleCount:function(){ return qiCount(); },
 telemetry:function(){ var f=frameTimes.slice(), s=f.slice().sort(function(a,b){return a-b;});
  var p95=s.length?s[Math.min(s.length-1,Math.floor(s.length*0.95))]:0;
  return {events:Narr.log.slice(), frames:f, frameCount:frameTotal, frameP95Ms:+(p95*1000).toFixed(1), narrKey:Narr.cur?Narr.cur.key:null, narrChars:Narr.cur?Narr.chars:0, cpLog:world.cpLog.slice()}; },
 reset:function(){ hardReset(); } }};
/* ?debug=1 浮层（C6/P5 人眼器械）：DOM 层零 canvas 像素面；无参时（DBG.on=false）不建 interval、一切不动 */
if(DBG.on){ (function(){
 var ov=document.getElementById("dbgOverlay"), ovB=document.getElementById("dbgBody");
 if(ov)ov.classList.add("on");
 var tick=function(){
  if(!ovB)return;
  var s=state();
  ovB.textContent="act="+s.act+" cp="+(world.cp||"-")+" t="+world.t.toFixed(2)+(DBG.pause?" ［已暂停］":"")
   +"\n玩家 x="+Math.round(player.x)+" y="+Math.round(player.y)+" 命="+player.hp+"/"+player.maxHp
   +"\n检查点 "+world.cpLog.length+" 条"+(world.cpLog.length?"（尾："+world.cpLog.slice(-3).map(function(c){return c.id;}).join(">")+"）":"")
   +"\n结局收集 "+s.ended.length+"/4"+(s.ended.length?"（"+s.ended.join(",")+"）":"")
   +"\nEsc 暂停 ｜ Backspace 重置进度"+(DBG.msg?"\n"+DBG.msg:"");
 };
 setInterval(tick,250); tick();
})(); }

/* ============ 启动 ============ */
Narr.init(); resize(); initDust(40); /* Loop9 氛围尘埃常驻（resetWorld 不清——氛围跨局） */
if(isTouch){ var tc=document.getElementById("touch"); if(tc)tc.classList.add("on"); }
requestAnimationFrame(frame);
console.log("拆台 v"+VER+" 已启动");
})();
