# W7 编辑清单（阶段 2 · 垂直切片）——逐字定版

基准：game.js md5 `72016cb87bb506bd5a894e6aa12154a3`（1970 行，今日基线；下表行号为基线值，编辑一律以**锚串+命中数(want)**定位）
回滚点：HEAD `ab1ca19`。反演：每项的「改为」还原为「原文锚」（全文唯一）即可；新增文件删除清单见文末。
纪律：①先红后绿 ②闸跑期间不碰 live game.js ③每个 want 都先 grep 实核再替换（T0 步）④`node --check` 每轮必跑 ⑤改过没跑过＝不存在。

## −1. 三视角评审处置表（2026-10-16 定稿；方案 §十一 精简对齐）

**总账：采纳 24／部分采纳 2／驳回 0。** 本文即处置落地清单；评审全文留档方案 §十一。

| 评审项 | 处置 | 落点 |
|---|---|---|
| 红队 P0-1 性能采样错窗 | 采纳：I-d 重写（frameCount 单调切片＋钳位计数＋战斗态声明＋≥3 重复） | §4 slice-pacing＋§0 禁言 #3 |
| 红队 P0-2 旁白假绿 | 采纳：表键存在静态行＋运行可观测 | E34（narrKey/narrChars）＋§0 J 行＋E35 |
| 红队 P0-3＋工程 P1-1 rec 双挥结构 | 采纳：`ec` 条件式（红/紫逐词等值、单 token 可变异） | E29b＋M2 |
| 三方 P0 glow 未注册（#ffd28a） | 采纳：改 `#ffcf7a` | E27a＋E31（1702） |
| 红队 P1-1/2/6/7/8 | 采纳：红侧判据＋rc 语义、v021 补偿钉、仪器钩子、T0–T4 测序、禁言清单 | §0 全节＋§3＋E34 |
| 设计 P1-1/P1-2 沙包/空头击退 | 采纳＋复核 R1：0.6× 风压、dmg 18、rec 积分后仰、strike 不写 vx、余速归零 | E28/E29a/E29b/E29d |
| 设计 P1-4 站台僵局 | 采纳：行为钩子（不画箭头） | E29c standoff（驻留 8s） |
| 设计 P1-5 背景灯污染/转金不可感 | 采纳：精确 #ffb040 计数；P2 改形状事件、不进机械闸 | §0 I 行＋E30 锚1/3 |
| 工程 P0-2/3/4/5 | 采纳：变异锚与结构、套件超时预注册、narrator 双文件硬门槛 | §0 M 表＋§3＋§2 |
| 工程 P1-2/3/4/5 | 采纳：eliteIntroFired 复位簇、E32 加 chain、playing 守卫、gate-8/9 不误伤 | E36/E32/E29c/§3 |
| 部分采纳①：一闪教学台词 | 挂 K3.3（等用户；不回＝维持现状） | 方案 §十 |
| 部分采纳②：双挥空间变奏 | 留观察点，不落码（本波不做） | 方案 §五注 |
| 驳回 | **0 项** | — |

**10-16 预检另修文档自身 5 处**（全部实核后落）：E32 锚尾形 `};}),`（原稿差一字符＝假锚）；E31 实为 3 处火花＋1 处 glow 反射（原稿记"4 处同形"）；新增 E29d（复核 R1：strike→rec 余速归零）；E29c 站台计时改**驻留语义**（原时间戳式会开战即响）；红表补 K 行凑齐 A–M（复活链）。

---

## 0. 红侧预注册（评审 P1-1 采纳；executed before ANY edit）

**rc 语义**（w7 全波通用）：`0=全绿／1=有红或判不出／2=脚本自身错／124=超时`。**124 禁止记作红**（写回执时必须区分"超时未跑完"与"跑了且红"）。

**gate-15 对现树的预期＝精确红**（unexpected PASS=0 为第一判据）。逐行清单：

| 行 | 断言 | 现树预期 | 红原因类 |
|---|---|---|---|
| A | 走至 E1-3：`state().enemies` kinds==="purple,purple,elite" 且精英 x≈640 | 红 | 现树为 red@640 |
| B | 静态：game.js 源码 E1-3 行含 `{k:"elite",x:640}`（fs+grep） | 红 | 无此串 |
| C | 霸体：wind 中受击 state 序列从无 "hit" 且仍进 strike | 红 | 钩子缺失+无 elite |
| D | struck 不泄漏：strike 中受击后玩家仍掉血 | 红 | 同 C |
| E | 后仰：rec 中受击 0.25s 内 Δx ≥2px（方向=背离玩家）；负控：本趟内无受击的 rec 前 0.3s 前滑 ≤1px（E29d 钉） | 红 | 同 C |
| F | P2 门：hp 打至 ≤45 后 phase==2 ＋ narrKey==="elite_enrage" | 红 | 无 phase 字段 |
| G | 双挥：P2 后远位（|dx|≈380）窗内见 chain==1→wind→strike→chain==0 | 红 | 同 F |
| H | 站台提醒：战斗相站 T3(820,300) 连续满 8s ⇒ 其后 1s 内 narrKey==="elite_standoff" | 红 | 无此逻辑 |
| I | 视觉：冻结帧 bbox 内精确 #ffb040 ≥80 且框外==0；主连通分量≥95%；高≥1.15×红 | 红 | 画面无 #ffb040 |
| J | 旁白：assets/narrator-lines.js(.json) 含 3 键；活跑 narrKey==="elite_intro" 且 narrChars>0 | 红 | 键不存在 |
| K | 复活链：玩家真死一次 → resp 后精英 hp==90、phase==1、chain==0 且 Narr.log 计 elite_intro 恰 1 次（不复播） | 红 | 同 C |
| L | 契约：state().enemies[elite] 有数值 phase/chain，red/purple phase===1 且恒不变 | 红 | 字段不存在 |
| M | 风压推进：wind 窗内 x 前进 ≥8px | 红 | 同 C |

共 13 行 A–M（10-16 预检补 K 行，与方案 §六「A–M 行逐条」对齐）。**执行次序**：K 行（真死）排在 I 视觉采样与各战斗行之后——死亡会重置场景。

**falsify-g15 变异预注册**（对**改后树**跑：正本+M1..M5 共 6 趟）：

| 变异 | 锚 → 替换 | want | 预期红行（其余不得红） |
|---|---|---|---|
| M1 霸体关 | `if(e.kind!=="elite"){e.state="hit"; e.t=0; e.struck=true;}` → `{e.state="hit"; e.t=0; e.struck=true;}` | 1 | C、D |
| M2 双挥关 | `(e.chain|0)<1` → `(e.chain|0)<0` | 1 | G |
| M3 身份色换 | `color:"#ffb040"` → `color:"#ffcf7a"` | 1 | I |
| M4 struck 泄漏 | `if(e.kind!=="elite"){e.state="hit"; e.t=0; e.struck=true;}` → `if(e.kind!=="elite"){e.state="hit"; e.t=0;}e.struck=true;` | 1 | D |
| M5 风压关 | `e.x+=e.dir*e.spd*0.6*dt` → `e.x+=e.dir*e.spd*0*dt` | 1 | M |

（M1 与 M4 同锚不同替换，各跑一趟；M1 预期同时红 C/D 属预注册行为。判据＝预期红全中 且 无预期外红；任一不满足 ⇒ BAD，exit 1。判不出（语法坏/钩子缺失）单独计数，不得混作 OK。）

**T0（落码前，静态，1–2 分钟）**：md5 存底 → `node --check game.js` → 逐锚 `grep -c` 打命中数与 want 比对 → `grep -rn '"elite"' game.js` == 0（撞名核验，评审已预核）→ `grep -n '"#c88bff"' game.js` 打印全部命中（预期 3：403/407/1896——10-16 预检否证原"4 处同形"；反射位 1702 为 #d9b3ff 族，见 E31）→ `node tools/merge-narrator.cjs --check`（合并器健康）→ 读 narrator-lines.json 一条含全字段叶子（draft 模板）。
**T1（≤2 分钟）**：gate-7（已更新）→ verify-v021（已更新）→ verify-visual-v1（J1 色域）→ gate-14。
**T2**：gate-3、gate-5、gate-13、gate-15、falsify-g7、falsify-g13、falsify-g14、falsify-g15。
**T3**：gate-8、gate-9、gate-10、gate-11、gate-12、falsify-g11。
**T4**：全套 39 后台重跑（~90 分钟）；falsify-g12 单独后台跑（不在套件内，20–30 分钟）；若未跑，回执明写"未跑＋原因"。

**禁言清单（评审 P1-8 采纳，回执与汇报逐条自查）**：
1. 不写"无 bug"——只写"在 39 闸＋脚本覆盖范围内未发现 P0"；
2. 时长一律标〔推算〕或〔脚本实测〕，不得混；首玩数据在用户玩过之前不存在；
3. 不写"60fps/流畅"——只写 p95 毫秒数与协议（单机口径、不外推）；
4. 不写绝对"零平行系统"——写"本波 diff 未触达＋已跑闸未观测到既有行为变化"；
5. "精英天然获得一闪"在 gate-15 相关行通过之前只算设计推断；
6. falsify 汇报必须含 逐变异 OK/BAD/判不出 计数；
7. "全绿"必须附超时(rc=124)/判不出清单（可为空，但须显式写"无"）；
8. 来源三档〔今日实测〕〔历史回执〕〔文档自述〕不混句。

---

## 1. game.js 逐字编辑（E27–E36）

> 全部为守卫式；「红/紫等值论证」在每项内嵌。E34 钩子**先行**（改后需重跑 T0→T1）。

**E27a · EKIND 增行（基线 366）**
- 锚：`glow:"#d9b3ff"}};`（want 1）
- 改为：`glow:"#d9b3ff"},elite:{hp:90,spd:100,windup:0.65,lunge:300,dmg:18,rec:0.75,color:"#ffb040",glow:"#ffcf7a"}};`

**E27b · mkEnemy 字段（基线 367–368）**
- 锚：`seed:Math.random()*6,flash:0,struck:false}; }`（want 1）
- 改为：`seed:Math.random()*6,flash:0,struck:false,phase:1,chain:0}; }`
- 等值：新增字段无既有读取方（评审实扫：全 tools 无 enemy 字段集严格断言）；red/purple 行为零变化。

**E28 · applyHit 三守卫（基线 399，一处替换两处语义）**
- 锚：`e.hp-=dmg; e.state="hit"; e.t=0; e.vx=dir*(o.kx||180); e.flash=0.12; e.struck=true;`（want 1）
- 改为：`e.hp-=dmg; if(e.kind!=="elite"){e.state="hit"; e.t=0; e.struck=true;} if(e.kind!=="elite"||e.state!=="strike")e.vx=dir*(o.kx||180)*(e.kind==="elite"?0.3:1); e.flash=0.12;`
- 等值：kind!=="elite" ⇒ 守卫真 ⇒ 原三项顺序效应不变；vx 式对 red/purple 恒 ×1 ⇒ 数值不变。elite：无硬直；非 strike 态写 0.3×vx（rec 态由 E29b 积分出可见后仰；strike→rec 余速归零见 E29d）；strike 态不写 vx（防削突进）。`e.struck=true;` 被守卫＝struck 不泄漏（玩家打不白嫖它的攻击）。
- 行内三态都在同一行 ⇒ M1/M4 变异的"删前缀保后缀"结构成立。

**E29a · wind 风压推进（基线 491）**
- 锚：`case "wind": e.t+=dt; e.dir=dx>0?1:-1; if(e.t>=e.windup){`（want 1）
- 改为：`case "wind": e.t+=dt; e.dir=dx>0?1:-1; if(e.kind==="elite")e.x+=e.dir*e.spd*0.6*dt; if(e.t>=e.windup){`
- 等值：单守卫插句；red/purple 逐词不变。

**E29b · rec 段重写（基线 497，M2 变异锚在此）**
- 锚：`case "rec": e.t+=dt; e.vx*=Math.pow(0.01,dt); if(e.t>=e.rec)e.state="chase"; break;`（want 1）
- 改为：`case "rec": e.t+=dt; e.vx*=Math.pow(0.01,dt); if(e.kind==="elite")e.x+=e.vx*dt; var ec=(e.kind==="elite"&&e.phase>=2&&(e.chain|0)<1); if(e.t>=(ec?0.5:e.rec)){ if(ec){e.chain=1; e.state="wind"; e.t=0;}else{ e.state="chase"; if(e.kind==="elite")e.chain=0; } } break;`
- 等值：red/purple ⇒ ec 恒 false ⇒ 门=e.rec ⇒ 仅 state="chase"（chain 行 no-op）；vx 衰减行未动。elite：非 P2 rec 0.75；P2 第一挥后 rec 0.5 → 二挥 → 链末 rec 0.75 → chase 且 chain 归 0。

**E29d · strike→rec 余速归零（基线 496；复核修订 R1）**
- 锚：`if(e.t>=0.2){ e.state="rec"; e.t=0; } break;`（want 1）
- 改为：`if(e.t>=0.2){ e.state="rec"; e.t=0; if(e.kind==="elite")e.vx=0; } break;`
- 理由：E29b 给 elite 加 rec 态积分；若不归零，突进余速（strike 末 ≈300×0.02^0.2≈137px/s〔实算〕）会被积分成 ≈29px 无来由前滑["打中有 3–8px 可见后仰"的语义被淹没，E 行「方向=背离玩家」判据被污染]。归零后 rec 积分只吃受击写入的 0.3×vx ⇒ 后仰 0.25s 窗内 ≈8px（step3 ≈21px），≥2px 判据可达。
- 等值：elite-only 守卫，red/purple 逐字符不触达（其 strike→rec 路径本无 vx 积分，无观测差异）。

**E29c · updEnemies 精英块（基线 505–506）**
- 锚（两行整体，want 1）：`if(e.hp<=0){ e.t+=dt; if(e.t>0.6)enemies.splice(i,1); continue; } updEnemy(e,dt); } }`
- 改为：
```
if(e.hp<=0){ e.t+=dt; if(e.t>0.6)enemies.splice(i,1); continue; }
 if(e.kind==="elite"){ /* W7 精英（大灯）：P2 门／入场旁白／站台提醒——三守卫，red/purple 零触达 */
  if(e.phase<2&&e.hp<=e.maxHp*0.5&&world.phase==="playing"){ e.phase=2; Narr.fire("elite_enrage"); world.hitstop=Math.min(0.12,Math.max(world.hitstop,0.08)); world.flashW=Math.max(world.flashW,0.08); spawnRing(e.x,e.y-40,"#ffb040",0.5); }
  if(world.phase==="playing"&&!world.eliteIntroFired){ world.eliteIntroFired=true; Narr.fire("elite_intro"); }
  if(world.phase==="playing"&&world.encPhase==="fight"&&player.grounded&&player.y<=420){ if(!world.eliteNudgeT)world.eliteNudgeT=world.t; else if(world.t-world.eliteNudgeT>8){ world.eliteNudgeT=world.t; Narr.fire("elite_standoff"); } } else world.eliteNudgeT=0;
 }
 updEnemy(e,dt); } }
```
- 说明：位置＝死兵 continue 之后（评审红队 P0-2 守卫位）；P2/入场带 playing 守卫（死亡相不叠演）；站台提醒要求 grounded（跳跃中 y≤420 不触发假阳性）、y≤420 覆盖 T1 顶(420)。站台计时＝**驻留语义**（eliteNudgeT＝本段站台起刻，离开台面清零；响后重新起刻 ⇒ 真"站满 8s"才响，同句 8s 冷却）——10-16 预检修正：原时间戳式会在开战瞬间站台即响，不符方案"满 8s"字面。

**E30 · drawEnemies 精英剪影（基线 1505–1524）**
- 锚1：`else { /* 反光板反派：手持反光板 */`（want 1）→ `else if(e.kind==="elite"){ /* 大灯（W7）：追光灯剪影（连笔：灯罩→立柱→配重底） */
  ctx.strokeStyle="#2a2118"; ctx.lineWidth=3.4; ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(0,-56); ctx.stroke();
  ctx.strokeStyle=col; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(0,-54); ctx.stroke();
  ctx.fillStyle="#141019"; ctx.beginPath(); ctx.moveTo(-11,-72); ctx.lineTo(11,-72); ctx.lineTo(14,-58); ctx.lineTo(-14,-58); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=col; ctx.lineWidth=2.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0,-4,12,4,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle=p.glow; ctx.globalAlpha=0.55; ctx.beginPath(); ctx.arc(0,-65,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  if(e.phase>=2){ ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(-7,-72); ctx.lineTo(-16,-86); ctx.moveTo(7,-72); ctx.lineTo(16,-86); ctx.stroke(); } /* P2：灯头分叉双束（形状事件） */
 } else { /* 反光板反派：手持反光板 */`
- 锚2（环半径档，want 1）：`var wq2=e.t/e.windup, rr=34-24*wq2;` → `var wq2=e.t/e.windup, rr=(e.kind==="elite"?58-28*wq2:34-24*wq2);`
- 锚3（P2 双环，want 1）：`ctx.beginPath(); ctx.arc(0,-24,rr,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }` → 同前＋` if(e.kind==="elite"&&e.phase>=2){ ctx.beginPath(); ctx.arc(0,-24,rr+8,0,Math.PI*2); ctx.stroke(); } ctx.globalAlpha=1; }`
- 颜色核对：本项用色 #2a2118/#141019/#ffb040(#col)/#ffcf7a(#glow)/#ffffff(继承) — 全部注册表内。造型细节（灯罩角度/双束角）允许 W7.2 以截图目检微调，颜色集合/白描边/环结构不许动。wind 白满描边（1503）与受击闪白（1493 col 逻辑）自动对 elite 生效，零额外编辑。**连通性预留**：立柱端点 -56 与灯罩底边 -58 之间靠笔触圆端补差（≈0.3px 缝）——若 W7.2 首跑 I 行主连通分量 <95%，按"造型细节"条款把立柱延长至 -60（记录；不动判据）。

**E31 · 色三元 3＋1（403/407/1896 火花 ＋ 1702 反射）**
- T0 实核（10-16 预检）：`grep -n '"#c88bff"' game.js` ⇒ **3 处**（403/407/1896，均在 `e.kind==="red"?"#ff5a78":"#c88bff"` 形态内）；反射位是 **glow 族**：1702 为 `en.kind==="red"?"#ff8fa3":"#d9b3ff"`（变量名 `en`，不含 #c88bff）。原稿"4 处均 #c88bff"已否证。
- 403/407/1896（want 各 1，grep 形态 want 3）：`e.kind==="red"?"#ff5a78":"#c88bff"` → `e.kind==="red"?"#ff5a78":(e.kind==="elite"?"#ffb040":"#c88bff")`（火花档 #ffb040）
- 1702（want 1）：`en.kind==="red"?"#ff8fa3":"#d9b3ff"` → `en.kind==="red"?"#ff8fa3":(en.kind==="elite"?"#ffcf7a":"#d9b3ff")`（反射档用 glow #ffcf7a，与 EKIND.glow 同族）

**E32 · state() enemies 契约（基线 1876）**
- 锚：`maxHp:e.maxHp,state:e.state,flash:+(e.flash||0).toFixed(2)};}),`（want 1——10-16 预检实锤：实际尾形为 `};}),`（后随 wall 属性）；原稿 `};});` 差一字符＝假锚，正形已替换）
- 改为：`maxHp:e.maxHp,state:e.state,flash:+(e.flash||0).toFixed(2),phase:(e.phase|0),chain:(e.chain|0)};}), /* W7 契约：phase/chain（精英门与连挥；red/purple 恒 1/0） */`

**E33 · ACTS[2] E1-3（基线 707）**
- 锚：`{k:"purple",x:550},{k:"red",x:640}]`（want 1）
- 改为：`{k:"purple",x:550},{k:"elite",x:640}]`

**E34 · 仪器钩子（先行；基线 1913 spawnBoss 后、1945–1947 telemetry）**
- 锚1：`spawnBoss:function(x){ spawnBoss(x); return {x:boss.x,y:boss.y,hp:boss.hp}; },`（want 1）
- 改为其后追加：
```
 spawnEnemy:function(kind,x){ if(!EKIND[kind])return null; var e=mkEnemy(kind,clamp(+x||300,24,W-24)); enemies.push(e); return e.id; },
 enemyHit:function(id,dmg){ for(var i=0;i<enemies.length;i++){ var e=enemies[i]; if(e.id===id&&e.hp>0){ applyHit(e,Math.max(1,+dmg||1),e.x>=player.x?1:-1,{kx:180}); return e.hp; } } return null; },
```
- 锚2：`return {events:Narr.log.slice(), frames:f, frameCount:frameTotal, frameP95Ms:+(p95*1000).toFixed(1)}; },`（want 1）
- 改为：`return {events:Narr.log.slice(), frames:f, frameCount:frameTotal, frameP95Ms:+(p95*1000).toFixed(1), narrKey:Narr.cur?Narr.cur.key:null, narrChars:Narr.cur?Narr.chars:0, cpLog:world.cpLog.slice()}; },`
- 锚3（头注 :3 契约行，want 1）：`...audioCount,audioLog,telemetry,registry,reset} }（W4.1 A3 增键 audioLog：音频播放记录环形 32）` → 句尾追加 `；W5.3–W7 增键：afterimageCount/bladeTrailCount/qiParticleCount/setHitstop/spawnBoss/setPlayerPos/spawnEnemy/enemyHit（telemetry 增 narrKey/narrChars/cpLog）`

**E35 · FALLBACK_LINES 三键（基线 133）**
- 锚：`air_swing_spam:{tiers:[[fb("as_1","剑法不错，可惜没有观众。"),fb("as_2","对着空气耍帅，这段我剪不掉。")]]}`（want 1）
- 改为：同句后加 `,\n elite_intro:{tiers:[[fb("ei_1","压轴的角儿上场了。这台布景，归它管。")]]},\n elite_enrage:{tiers:[[fb("er_1","灯芯烧起来了——它不打算再让着你。")]]},\n elite_standoff:{tiers:[[fb("es_1","别在高处看戏。这场要你下来演。")]]}`

**E36 · 新世界字段与复位**
- 锚1（world 字面量 :360，want 1）：`lampPeriod:6,iaiN:0};` → `lampPeriod:6,iaiN:0,eliteIntroFired:false,eliteNudgeT:0};`
- 锚2（startAct :770，want 1）：`world.idleCombatFired=false; world.lastEnemyFired=false; world.lastSpawn=null;` → 尾加 ` world.eliteIntroFired=false; world.eliteNudgeT=0;`
- 锚3（resetWorld，T0 grep `wallReplyT` 定位其复位行；want 1）→ 同处追加 `world.eliteIntroFired=false; world.eliteNudgeT=0;`
- **不加进 respawnWave**（死亡重试不重播 intro；评审工程 P1-2）。

---

## 2. 旁白三键（外部表＋FALLBACK）

1. T0：`node tools/merge-narrator.cjs --check` ⇒ 期望 rc=0「往返复现通过」。
2. `cp review-v02/d3-story/merge-receipt-2026-10-15.txt review-v02/d3-story/merge-receipt-2026-10-15.w13.bak.txt`（回执路径硬编码会被覆盖）。
3. 写 draft（落 `review-v02/d3-story/w7-elite-draft.json`）：`{"lines":{"elite_intro":{"tiers":[[{…}]]}, "elite_enrage":{…}, "elite_standoff":{…}}}`；叶子字段照 T0 读取的现网样例（含 id/text/tts 全套字段名与格式，值照 E35 文案）。
4. `node tools/merge-narrator.cjs review-v02/d3-story/w7-elite-draft.json` ⇒ rc=0；核对回执逐键动作；`grep -c elite_ assets/narrator-lines.js assets/narrator-lines.json` 两文件各 ≥3。
5. E35（FALLBACK 三键）同批落。

## 3. 测试与套件改动

- **gate-7-acts.cjs**（锚串定位，各 want 1；**以坐标数组为唯一锚**，防误伤 gate-8/9 同形串）：
  - `"purple,purple,red", [460, 550, 640]` → `"purple,purple,elite", [460, 550, 640]`（10-16 预检实锤：锚含逗号后空格；原稿无空格＝假锚）
  - `"purple,purple,red", [400, 490, 580]` → `"purple,purple,elite", [400, 490, 580]`（同上）
- **verify-v021.cjs**：:76 白名单 `["red","purple"]` → `["red","purple","elite"]`；新增补偿钉（T0 先看 v021 从哪取 ACTS，照抄该通道）：`eliteSites`＝扫 ACTS[2] 全部 spawns 取 `k==="elite"` 拼 `"A{act}E{enc#}#{spawn#}"`，断言 `==="A2E3#3"`（白名单放宽的补偿：全场仅此一处精英）；头注 :6 兵种清单同步加 elite。
- **_run-suite.sh**：头注（:2）「共 37 闸」→「共 39 闸」并在 :3 补一句 falsify-g15 体例；for 列表（:14）`gate-14-damage` 后插 `gate-15-elite`、`falsify-g14` 后插 `falsify-g15`；超时预注册：`[ "$g" = "gate-15-elite" ] && to=600`、`[ "$g" = "falsify-g15" ] && to=1800`（600/1800 为初值——W7.1 首跑实测单趟时长后按实调高并留档理由；只动超时参数，不动任何判据）。
- **禁止**：任何其它既有断言的改动。

## 4. 新增文件

- `tools/gate-15-elite.cjs`：A–M 行；冻结/截图/剪影助手从 gate-11 现成协议克隆（含 narrClean 双守卫）；走梯助手从 gate-7 克隆；视觉采样前 clearWave 只留精英（or 杀两只紫；**不得再 clearWave 精英本体**——要测它）；采样窗静默度预检（静帧帧差类教训）。
- `tools/falsify-g15.cjs`：克隆 falsify-g14 结构；6 趟（正本+M1–M5）；每趟独立报告撮合 0 节预期表；输出 OK/BAD/判不出计数。
- `tools/slice-pacing.cjs`（非套件）：I-a 走链（真键+钩子）＋cpLog 时长表＋I-d 性能协议（≥3×30s 战斗段：frameCount 单调切片、钳位帧==0、p95≤16.6ms、每段声明战斗态）＋截图五节点＋P2 形状对比帧＋右墙按 J 镜像场景 1 张。
- 删除/回滚清单：上述 3 工具 + w7-elite-draft.json + 新回执 + merge-receipt 备份（保留）均可独立删除；game.js/assets/suite 反演见上表。

## 5. 收尾

- W7.2 完：`node --check game.js` + md5 记录 + commit（B: code）。
- W7.4：全套 39 + falsify-g12 单独跑 ⇒ 回执（9 节＋禁言清单自查＋来源三档）⇒ docs commit（A）。
- 红侧日志、T0-T4 各步原始输出留 `shots/w7-*`，回执内嵌关键行原文。
