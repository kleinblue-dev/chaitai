# W6.1 战斗闭环 · 编辑清单（工作笔记，非交付物）

基准树：W5.3 定版 game.js `943ef1652167e0d5be49b6b959a513c0`（回滚点 commit `18161b0`）/ index.html `53c879c51d8d83c75568e83e1b7d7864`（本波**零改动**）
本波树：game.js md5 `72016cb87bb506bd5a894e6aa12154a3`（1970 行，+25/−8；git --numstat 实测复核）
（本清单全部 old_string 已于 2026-10-16 逐字读实落盘；falsify-g14 的 M1–M4 正则与 E23/E24/E25 逐字对照已核。VER 不动＝"0.1.2"。仪器侧：gate-11-silhouette.cjs 背景噪声守卫版 md5 `cfc8f6b07216ede56811067a74a862a1`。）

## 落码前撞名核验

`grep -n "QI_DMG\|IAI_DMG\|iaiN\|preHit" game.js` ⇒ 落码后仅命中本波新行（239/254/257/264/267/268/270/271/272/274/360/1874），落码前 0 命中 ⇒ 无撞名。
`qi.hit["boss"]` 复用既有 `a.hit["boss"]` 先例（:369-371 普攻 Boss 带）；字符串键与数字 id 键同表互异。

## 编辑表（7 处，全部 Edit，逐字 old→new）

- **E23a** 头注释（:4 后插 W6.1 行）：
  `…／旁白音频叠播修复／fx 上限。 */` → 追加两行：
  `W6.1 战斗闭环（VER 不动）：剑气/居合接入统一受击路径 applyHit（伤害/击退/硬直/音效/顿帧）＋一刀一结算`
  `（刀身命中预标记 qi.hit）＋Boss 同路径；state 契约增 enemies[].vx/flash、dyn.iaidoN。 */`
- **E23b**（锚 M1）:239 常量行：
  `var QI_SPD=489, QI_FLY=0.45, QI_FADE=0.1, QI_EMIT=80, QI_BUDGET=120;`
  → `var QI_SPD=489, QI_FLY=0.45, QI_FADE=0.1, QI_EMIT=80, QI_BUDGET=120, QI_DMG=6, IAI_DMG=12; /* W6.1 伤害常量：红兵 hp30＝剑气 5 发／居合近身爆发 12 */`
  M1 re: `QI_DMG=6, IAI_DMG=12` want=1 ✓
- **E24**（锚 M2）:252-253 updQi 命中块（updQi 内、`if(qi.t<QI_FLY)` 块内）：
  old `/* 命中＝只读视觉：爆粒子＋敌闪白，零扣血 */ …{ qi.hit[e.id]=1; qiEmit(12,e.x,e.y-26,1.3); e.flash=Math.max(e.flash||0,0.12); } } }`
  → 敌人循环尾接 `applyHit(e,QI_DMG,qi.dir,{kx:150,hs:0.03,sh:0.12});`（flash/爆粒子由 applyHit 与 qiEmit 分别承担，e.flash 手写行删＝applyHit 内 `e.flash=0.12` 同值）
  ＋ Boss 块（同层内、敌人循环后）：
  `if(boss.active&&!boss.dead&&!qi.hit["boss"]){ if(Math.abs(boss.x-qi.x)<36&&Math.abs((boss.y-26)-qi.y)<40){ qi.hit["boss"]=1; qiEmit(12,boss.x,boss.y-26,1.3); hitBoss(QI_DMG,qi.dir,{hs:0.03,sh:0.12}); } }`
  M2 re: `qi\.hit\[e\.id\]=1; qiEmit\(12,e\.x,e\.y-26,1\.3\);` want=1 ✓
- **E25a**（锚 M3/M4）:258-274 iaido()：刀光/残影行后、`qiSpawn();` 前插刀身判定；`qiSpawn();` 后插预标记：
  `var preHit={}, struckN=0;` ＋ 敌循环 `var dx=(e.x-P.x)*P.facing, dy=(e.y-23)-(P.y-27); if(dx>-40&&dx<96&&Math.abs(dy)<52){ preHit[e.id]=1; struckN++; applyHit(e,IAI_DMG,e.x>=P.x?1:-1,{kx:260,hs:0.08,sh:0.3,step:3}); }`
  ＋ Boss `var bdx=(boss.x-P.x)*P.facing, bdy=(boss.y-23)-(P.y-27); if(bdx>-40&&bdx<96&&Math.abs(bdy)<52){ preHit["boss"]=1; struckN++; hitBoss(IAI_DMG,P.facing,{hs:0.08,sh:0.3,step:3}); }`
  ＋ `world.iaiN=struckN;` ＋ `qiSpawn();` 后 `for(var k in preHit)qi.hit[k]=1;`
  M3 re: `if\(dx>-40&&dx<96&&Math\.abs\(dy\)<52\)\{ preHit\[e\.id\]=1; struckN\+\+;` want=1 ✓（Boss 用 bdx 不匹配）
  M4 re: `applyHit\(e,IAI_DMG,e\.x>=P\.x\?1:-1,\{kx:260,hs:0\.08,sh:0\.3,step:3\}\)` want=1 ✓
- **E25b**:360 world 字面量尾：`lampCycle:0,lampPeriod:6};` → `lampCycle:0,lampPeriod:6,iaiN:0}; /* …；W6.1：iaiN＝最近一次居合刀身命中数（state().dyn.iaidoN） */`
- **E26a**:1874 state() dyn：`iaido:+(player.iaiFire||0).toFixed(3),` 后插 `iaidoN:world.iaiN|0,`
- **E26b**:1878 state() enemies：map 项 `y:+e.y.toFixed(1),` 后插 `vx:+(e.vx||0).toFixed(1),`、`state:e.state` 后插 `,flash:+(e.flash||0).toFixed(2)`（尾注释「W6.1 契约：vx/flash（受击反应可观测）」）

## 与闸的对照结论（已核）

- gate-14 读 enemies[].vx/flash＋dyn.iaidoN ✓ E26 全供；probe `vx:(e.vx==null?-999:e.vx)`、`flash:(e.flash||0)` 字段名逐字一致 ✓
- M1↔E23b、M2↔E24、M3/M4↔E25a 逐字一致 ✓（pre-flight 命中数=1 全过）
- G14.4 一刀一结算依据：刀身命中（12）⇒ preHit ⇒ 随行 qi 预标记 ⇒ 同目标不再扣 6 ⇒ Δ恰 12（绿跑实测 iaidoN=2 双敌覆盖场景亦恰 12）✓
- applyHit 契约复用：qi {kx:150,hs:0.03,sh:0.12}（hit1 音/顿帧 0.03）＝轻反馈；iaido {kx:260,hs:0.08,sh:0.3,step:3}（hit3 音/顿帧 0.15/flashW）＝重击档 ✓
- G14.8 尸测：qi 遇 hp<=0 跳过（E24 保留原 `e.hp<=0||qi.hit[e.id]` 守卫）＋预标记冗余 ⇒ 尸体恒 0/dead ✓

## 执行顺序（本波）

1. ✅ gate-14 红侧迭代 r1–r6（仪器去污染六条修订；r6＝G14.6 本体净：8 发/Δ=0/玩家hp=82→82）
2. ✅ 仪器修订⑥（乒乓换侧＋B 反侧偏好）＋G14.8 供体降级链＋探针跟供体 id → 红 r7＝**精确 6 红 4 绿**（预注册口径）
3. ✅ E23–E26 落码（7 处全中）→ node --check OK → md5 `72016cb8…` → 绿 r1＝**PASS 10/FAIL 0**（首跑抓出仪器疑点：G14.5 vxMax=400＝红兵自主 strike 突进污染 ⇒ 修订⑦ vxMax 仅采受击态样本，判据阈值零改动）
4. ✅ 红 r8（`git show 18161b0:game.js` 还原原树副本 `shots/redtree-w53/`，md5 复核 `943ef165…`）＝**精确 6 红 4 绿**；绿 r2＝**PASS 10/FAIL 0**（G14.3 vxMax=150＝qi kx；G14.5 vxMax=231.7＝260×0.89 首帧衰减＝刀身 kx ✓ 采样归属正确）
5. ✅ falsify-g14（M1–M4）＝**OK 4 / BAD 0 / 判不出 0**（留档 `shots/falsify-g14.txt`；首跑踩坑：头注释漏 `*/` 吞码 SyntaxError → 补 ` */`；★ rc 判读须读输出文件内自报值——`&&` 链后 `; echo` 的 rc 是 echo 的，与「判通过直写文件」纪律一致）
6. ✅ _run-suite.sh 升 37 闸（列表两处插入＋gate-14 600s／falsify-g14 1800s＋头注释十四闸+九证伪）
7. ✅ 全套 37 首跑（20:18:23→21:18:45，`shots/suite37-run.txt`）＝ **PASS 36 / FAIL 1**：唯一红 gate-11-silhouette（G11.10 面积比 0.803；G11-DATA-L `area=746 bgNoisePx=657 removedPx=153`）。md5 跑前跑后 5 文件全 OK。
8. ✅ gate-11 红根因诊断（仪器侧 flake，**非 W6.1 回归**）：旁证＝同树 falsify-g11 live 21:10 全绿 13/13＋W6.1 代码路径审阅（gate-11 场景不触任何新路径）；逐层排除 drawT3Guide（act2 门控）/drawGuide 箭头（x≈500 出区）⇒ 定位 mid 层重烤街灯 lx=300（ly=409 r=26 四档 α），layOffM=−12 ⇒ 落屏 x=288 正压采样区与剪影（v1 卫星块@(267,403) 即本灯左缘）。**探针 `tools/_diag-g11-noise.cjs` 实锤**（30 对：生产窗事件 656px（与 657 差 1px）质心 x=288；长窗 931px ×7；窗内 mid 重烤 15–42 次；全大事件旁白净=true/true；干净 floor 7–16px；pageerror=0，留档 `shots/g11-noise-diag/`）。
9. ✅ 仪器修复＝背景噪声守卫（gate-11 6 处：头注释＋`BP_NOISE_MAX=64` 预注册＋右/左对重抓循环 ≤4＋两行 G11-DATA 加 `noiseRetries`；**判据/阈值一字未动**，md5 新＝`cfc8f6b07216ede56811067a74a862a1`）。solo 首跑 **PASS 13/13**（noiseRetries=0，`shots/g11-guard-solo1.txt`）。
10. ✅ falsify-g11 复验（后台）＝ **OK 3/BAD 0/判不出 0**（`shots/falsify-g11-rerun.txt`；同树 live 13/13＋M1–M3 全锚中）→ 全套 37 重跑 r2（跑前 md5 快照 `shots/suite-37-prefix-md5-r2.txt`；21:33→22:33 约 60 分钟）＝ **PASS 37 / FAIL 0**（`shots/suite37-run-r2.txt`；gate-11 13/13 `noiseRetries=0`；跑前=跑后 md5 七文件全 OK）→ 收口＝回执 9 节回填＋桌面档＋记忆＋双 commit（A docs 归档／B W6.1 code）
