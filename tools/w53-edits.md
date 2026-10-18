# W5.3 动态表现力 · Phase 4 编辑清单（工作笔记，非交付物）

基准树：W5.2 定版 game.js `c226d540003d1a2a0bfc04cc894f2a01` / index.html `53c879c51d8d83c75568e83e1b7d7864`
（本清单全部 old_string 已于 2026-10-16 逐字读实。falsify-g13 的 M1–M4 正则与 E5/E6/E10/E12 逐字对照已核。）

## 落码前 grep（防撞名）

`grep -n "pushGhost\|iaido\|updQi\|drawQi\|drawFlash\|qiSpawn\|qiEmit\|qiCount\|QI_\|apiFire\|jHold\|qiLatch\|qiWind\|iaiW\|iaiFire\|flashW" game.js`
期望：0 命中（qi 仅 :145 Narr 函数内局部循环变量，不冲突）。若命中≠0 ⇒ 改名。

## 编辑表（21 处，全部 Edit，逐字 old→new）

- **E1** `var fx=[], ghosts=[], ghostT=0, bladeTrail=[];`
  → `var fx=[], ghosts=[], ghostT=0, bladeTrail=[], qi=null, qiTrail=[];`
- **E2** `function pushBlade(x,y){ bladeTrail.push({x:x,y:y,t:0}); if(bladeTrail.length>8)bladeTrail.shift(); }`
  → 前插 pushGhost（上限 24）＋ pushBlade 同坐标去重（修 :1421 渲染期重复采样）：
  `function pushGhost(x,y,facing,k){ ghosts.push({x:x,y:y,facing:facing,t:0,k:k||""}); if(ghosts.length>24)ghosts.shift(); }`
  `function pushBlade(x,y){ var bt=bladeTrail[bladeTrail.length-1]; if(bt&&bt.x===x&&bt.y===y)return; bladeTrail.push({x:x,y:y,t:0}); if(bladeTrail.length>8)bladeTrail.shift(); }`
- **E3** player 行尾 ` atk:null,...,jumpBuf:0,atkBuf:0,dashBuf:0, /* W4.1（A5） */`
  → 在 `dashBuf:0,` 后插：` jHold:0,qiLatch:false,qiWind:0,iaiW:0,iaiFire:-1,`（插在注释前）
- **E4** world 行 ` t:0,hitstop:0,slowT:0,trauma:0,timers:[],deaths:0,arena:"prologue",`
  → ` t:0,hitstop:0,slowT:0,flashW:0,trauma:0,timers:[],deaths:0,arena:"prologue",`
- **E5**（锚 M1）`  if(!a.swung){ a.swung=true; spawnSlashFx(...a.step===3); }`
  → `  if(!a.swung){ a.swung=true; pushGhost(P.x,P.y,P.facing,"atk"); spawnSlashFx(...); }`
  M1 re: `a\.swung=true; pushGhost\(P\.x,P\.y,P\.facing,"atk"\); spawnSlashFx` ✓ 逐字
- **E6**（锚 M3）applyHit 行 ` world.hitstop=Math.min(0.12,Math.max(world.hitstop,o.hs||0.045)); addTrauma(o.sh||0.2);`
  → ` var cap=(o.step===3?0.15:0.12), tgt=(o.step===3?0.15:(o.hs||0.045)); world.hitstop=Math.min(cap,Math.max(world.hitstop,tgt));`
  ` if(o.step===3){ world.flashW=0.12; }`
  ` addTrauma(o.sh||0.2);`
  M3 re: `\(o\.step===3\?0\.15:0\.12\)` 唯一（tgt 是 `:0.15:(o.hs` 不匹配）✓
- **E7** hitWall 行 ` world.hitstop=Math.min(0.12,Math.max(world.hitstop,A.hs)); addTrauma(A.sh*0.7);`
  → ` var wcap=(step===3?0.15:0.12), wtgt=(step===3?0.15:A.hs); world.hitstop=Math.min(wcap,Math.max(world.hitstop,wtgt));`
  ` if(step===3){ world.flashW=0.12; }`
  ` addTrauma(A.sh*0.7);`
- **E8** startDash `...hitBurst(P.x-P.facing*10,...,"#aef6ff"); ghostT=0;`
  → 尾加 ` P.iaiW=0.45; P.iaiFire=-1;`
- **E9** ` P.hurtT=Math.max(0,P.hurtT-dt); P.stun=Math.max(0,P.stun-dt);`
  → 尾加 ` P.iaiW=Math.max(0,P.iaiW-dt);`
- **E10**（锚 M4）` if(justDown(ATKK))P.atkBuf=0.14; P.atkBuf=Math.max(0,P.atkBuf-dt);`
  → ` if(P.iaiW>0&&!P.atk&&justDown(ATKK)){ iaido(); P.iaiW=0; } else if(justDown(ATKK))P.atkBuf=0.14; P.atkBuf=Math.max(0,P.atkBuf-dt);`
  M4 re: 同串 ✓
- **E11** dash 缓冲行（W4.1 注释行）尾后追加：
  ` if(anyDown(ATKK)){ P.jHold+=dt; } else { P.jHold=0; P.qiLatch=false; }`
  ` if(P.qiWind>0){ P.qiWind-=dt; if(P.qiWind<=0){ qiSpawn(); P.qiWind=0; P.qiLatch=true; } }`
  ` else if(P.jHold>=0.38&&!P.qiLatch&&world.phase==="playing"&&(!P.atk||P.atk.phase==="rec")){ P.qiWind=0.10; P.jHold=0; }`
- **E12**（锚 M2）在 `function addTrauma(...)` 后插整块（★qi.em 而非 qiEmitQ）：
  ```
  /* —— W5.3 动态表现力：剑气/居合（游戏时间驱动：updQi 由 updateFx 调用，冻结窗自动停） —— */
  var QI_SPD=489, QI_FLY=0.45, QI_FADE=0.1, QI_EMIT=80, QI_BUDGET=120;
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
    for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.hp<=0||qi.hit[e.id])continue; /* 命中＝只读视觉：爆粒子＋敌闪白，零扣血 */
     if(Math.abs(e.x-qi.x)<22&&Math.abs((e.y-26)-qi.y)<26){ qi.hit[e.id]=1; qiEmit(12,e.x,e.y-26,1.3); e.flash=Math.max(e.flash||0,0.12); } } }
   else if(qi.t<QI_FLY+QI_FADE){ if(!qi.boomed){ qi.boomed=true; qiEmit(16,qi.x,qi.y,1.1); } }
   else { qi=null; } }
  function iaido(){ var P=player; world.slowT=Math.max(world.slowT,0.30); P.iaiFire=world.t;
   spawnSlashFx(P.x+P.facing*26,P.y-30,P.facing,true); addTrauma(0.3); AudioSys.play("slash");
   for(var i=0;i<4;i++)pushGhost(P.x-P.facing*(8+i*6),P.y,P.facing,"iai");
   qiSpawn(); }
  ```
- **E13** updateFx 尾 ` for(var bi=bladeTrail...splice(bi,1); } }` → 尾加 `\n updQi(dt); }`
- **E14** step else `  if(world.slowT>0){ world.slowT-=dt; sdt=dt*0.3; }`
  → 后加行 `  if(world.flashW>0)world.flashW=Math.max(0,world.flashW-dt);`（冻结期不衰减＝闪白保持）
- **E15** 残影绘制：`var ga=(1-gh.t/0.28)*0.20*(blink?0.5:1);` → `var ga=Math.pow(Math.max(0,1-gh.t/0.28),1.6)*0.20*(blink?0.5:1);`
  ＋ `ctx.strokeStyle="#7df9ff";` → `ctx.strokeStyle=gh.k==="iai"?"#ffd76a":"#7df9ff";`
- **E16** drawBladeTrail 函数后插 drawQiTrail()/drawQi()/drawFlash()：
  ```
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
  ```
- **E17** ` drawEnemies(); drawBossAura(); drawBoss(); drawPlayer(); drawBladeTrail(); drawFx();`
  → ` drawEnemies(); drawBossAura(); drawBoss(); drawPlayer(); drawBladeTrail(); drawQiTrail(); drawQi(); drawFx();`
- **E18** drawVignette 注释行后加 ` drawFlash(); /* W5.3 收刀闪白（static alpha ⇒ 冻结窗逐字节稳定；0 时零绘制） */`
- **E19** 辉光链 ` var gMain=ctx; ctx=gb; drawAtmo(); drawBladeTrail(); drawFx();`
  → ` var gMain=ctx; ctx=gb; drawAtmo(); drawBladeTrail(); drawQiTrail(); drawQi(); drawFx();`
- **E20** state() player 块尾 `  attacking:!!player.atk,facing:player.facing,combo:player.combo,walk:+player.walk.toFixed(3)},`
  → 尾加 `,\n dyn:{afterimages:ghosts.length,bladeTrail:bladeTrail.length,qiTrail:qiTrail.length,qiParts:qiCount(),qiActive:!!qi,`
  `  hitstop:+world.hitstop.toFixed(3),slowT:+world.slowT.toFixed(3),flash:+world.flashW.toFixed(3),`
  `  iaiW:+player.iaiW.toFixed(3),iaido:+(player.iaiFire||0).toFixed(3),atkActive:!!player.atk,`
  `  buf:{atk:+player.atkBuf.toFixed(3),jump:+player.jumpBuf.toFixed(3),dash:+player.dashBuf.toFixed(3)}},`
- **E21** ` setHitstop:function(t){ world.hitstop=Math.max(0,+t||0); },`
  → 后加 `\n /* W5.3 动态表现力钩子（gate-13-dynamics 契约） */`
  ` afterimageCount:function(){ return ghosts.length; },`
  ` bladeTrailCount:function(){ return bladeTrail.length; },`
  ` qiParticleCount:function(){ return qiCount(); },`
- **E22**（绿跑首跑抓出 G13.12 后补）`  if(world.slowT>0){ world.slowT-=dt; sdt=dt*0.3; }`
  → `  if(world.slowT>0){ world.slowT=Math.max(0,world.slowT-dt); sdt=dt*0.3; } /* W5.3 E22：过零钳位 */`
  依据：绿跑首跑 PASS 13/FAIL 1（唯一红 G13.12 现 slowT=-0.017）＝跨零那帧 dt≈17ms 过冲成负残渣后被 `>0` 守卫永久卡住；判据原文 `slowNow2===0` 系预注册不许动 ⇒ 修实现。物理零影响：钳位前后每帧 `slowT>0` 分支判定序列不变（≤0 的两种取值对 `>0` 同为假）⇒ `sdt=dt*0.3` 适用帧集合逐帧一致；全工具链仅 gate-13 读 slowT（旧 33 闸 0 引用，grep 实证；:1691 慢动作罩同为 `>0` 守卫不动）。

index.html：零改动。

## 与闸的对照结论（已核）

- gate-13 读 dyn：qiTrail/qiParts/qiActive/hitstop/slowT/flash/iaido/atkActive/buf.atk ✓ E20 全供
- 钩子三件 ✓ E21；M1↔E5、M2↔E12、M3↔E6、M4↔E10 逐字一致 ✓
- 预算：单发峰值≈50-56（burst24＋稳态32＋尾爆16），叠加两发≈70-90 ∈ gate-13 的 [45,120] ✓
- 时序：q1 出现 ≈0.38+0.10+抖动 ≈ 480ms <1800ms 观察窗 ✓
- 色板新用值：#ffd76a/#7df9ff/#aef6ff/#eafcff/#ffffff 全部已注册（J1 过）✓
- M4 变异下 dash 中按 J：atkBuf=0.14 于 dash 结束立刻 startAttack ⇒ atkActive 红＋iaido 未观测＝双红锚 ✓

## 执行顺序（本波）

1. ✅ 全套 33 首跑完 → 32 PASS/1 FAIL（唯一红＝gate-11 G11.10 仪器 flake；md5 五文件前后一致）
2. ✅ gate-11 处理完：standalone 复跑 2绿1红（复现 1/3 定性仪器 flake）→ 旁白守卫修复（A/B 全抓帧点，协议/阈值零改动）→ 修后 standalone ×4 全绿（0.975-1.007）＋ falsify-g11 OK 3/BAD 0/判不出 0
3. ✅ 全套 33 复跑完 → **PASS 33 / FAIL 0**（md5 六文件跑前=跑后全 OK）→ W5.2 收口五连全完：回执 §四 回填 + 计划档两处待填（终数 + `33fb598`）+ 桌面档 W5.2 版（BOM 单枚已验）+ 记忆 + git commit `33fb598`（8 files +526/−38）
4. ✅ gate-13 红侧首跑（对 W5.2 定版树）→ **13 红 1 绿，与预注册逐条一致**（唯一绿＝G13-0 零错误哨兵；红形态全＝钩子缺失类：G13.4 undefined／G13.1-3 -1 或 0／G13.5-7 qi 未观测／G13.13 帧率本体合格但前置 qi 活跃=false／G13.8-10 maxHit=0.000 达不到新 0.13）。★ 首跑暴露仪器缺陷：`freezeP.then` 脱链 promise 无拒绝处理器 ⇒ `BROWSER.close()` 时 CDP 拒 ⇒ unhandled rejection 在 `finish()` 前崩（日志缺汇总行、rc=1 是 crash 码）⇒ 修仪器（加 `, () => {}` 拒绝处理器，判据/阈值零改动）→ 重跑：`---- 汇总：PASS 1 FAIL=13 rc=1 ----`＋`GATE gate-13-dynamics: FAIL (...13 条列名)` 干净留档 `shots/g13-red.txt`（首跑原文存 `shots/g13-red-prefix-instrument-fix.txt`）
5. ✅ E1-E21 落码（21 处全中）→ node --check SYNTAX-OK → game.js 1897→1953 行 md5 `3c024c9e…`。绿跑首跑 **PASS 13 / FAIL 1**（唯一红＝G13.12 slowT=-0.017 残渣；留档 `shots/g13-green-prefix-slowt-residue.txt`）⇒ E22 过零钳位（物理零影响）→ md5 `943ef165…` → 绿跑复跑 **PASS 14 / FAIL 0 / rc=0**（G13.12 现 slowT=0；留档 `shots/g13-green.txt`）
6. ✅ falsify-g13 首跑＝**OK 0 / BAD 4 / 判不出 0**——**非变异体问题**：四变异副本红集原始证据逐条与预注册吻合（M1→{G13.1}；M2→{G13.5,6,7,13}；M3→{G13.8,10}；M4→{G13.11,12}；各日志 URL 均指副本路径）。缺陷＝falsify 解析锚 `^\[FAIL\]` 不吃 gate-13 的两空格缩进（gate-12 行首无缩进故框架迁移后不奏效）⇒ **仪器级修复**：解析锚改 `^\s*` 容缩进 ＋ gate-13 GATE 行补右括号（纯显示串）→ 首跑存档 `shots/f13-run-prefix-parse-bug.txt` → 复跑：绿跑 **PASS 14 / FAIL 0 / rc=0**＋falsify **OK 4 / BAD 0 / 判不出 0（共 4 变异）**（正本 live 前缀 PASS=14 rc=0；四锚 G13.1/5/8/11 全中；留档 `shots/f13-run.txt`）——**闭环**
7. ✅ _run-suite.sh 升 35 闸（头注释改十三闸+八证伪；列表两处插入；gate-13 600s＋falsify-g13 1800s）→ 跑前 md5 快照 `shots/suite-35-prefix-md5.txt`（game.js `943ef165…` / index.html `53c879c5…` / gate-13 `d1c5e197…` / falsify-g13 `00711f03…` / _run-suite `510af737…`）＋33 闸时代 suite-logs 归档 `shots/suite-logs-33gate-2026-10-16/`（保 W5.2 回执引证不指向换树后日志）→ **全套 35 复跑中**（后台 `shots/suite35-run.txt`，约 75–85 分钟；跑后 md5 -c 对照）
8. ✅ **W5.3 收口五连全完**：①回执（八节；T1–T7 全回填，0 占位）②计划档（§5.1 头行＋W5.3 条目＋权威终数 35）③桌面档 W5.3 版（BOM 单枚已验）④记忆（topic 段＋description＋MEMORY.md 行）⑤commit `18161b0`（4 文件 +515/−19）。**全套 35 闸 PASS 35/FAIL 0（16:06→17:05 约 60 分钟；跑前=跑后 md5 五文件零变动；跑后无头残渣 0）→ W5.3 收官**
