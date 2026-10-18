/* gate-15-elite.cjs —— W7 精英「大灯」闸（阶段2 垂直切片；先红后绿）
   ============ 测什么 ============
   13 行（字母 A–M，判据逐字预注册于 tools/w7-edits.md §0；执行次序见下）：
     A 走链：E1-3 born 值 kinds==="purple,purple,elite" 且出生 x=[460,550,640]（走链克隆 gate-7）
     B 静态：被测树 game.js 含 `{k:"elite",x:640}`（恰 1 处）
     C 霸体：wind 中 enemyHit(6) ⇒ 仍 wind→strike、无 "hit" 态、hp −6
     D struck 不泄漏：strike 中 enemyHit(6) ⇒ 同一次 strike 仍打中玩家（hp −18）且精英 hp −6
     E 后仰：① 负控（无受击 rec 前 0.3s 前滑 ≤1px）② rec 中 enemyHit ⇒ 位移 ≥2px 且方向=背离玩家
     F P2 门：hp 打到 ≤45（=42）⇒ phase==2 且旁白 elite_enrage 起播（chars>0）
     G 双挥：P2 链序 = strike(ch0) → …ch1… → strike(ch1) → …ch0…（100ms 采样）
     H 站台提醒：站 T3 连续满 8s ⇒ 其后 1s 内 elite_standoff 起播（恰 1 次；log 计数+渲染双证）
     I 视觉：① bbox 内精确 #ffb040 ≥80（css 等效）且剪影 bbox 外==0 ② 主连通分量 ≥95%
       ③ 掩膜高 ≥1.15×红（同协议红参照）④ wind 冻结帧 #ffffff ≥100（白描边+环）
     J 旁白：三键 elite_intro/elite_enrage/elite_standoff 都在 narrator-lines.js+json（静态）
       + 出生时 elite_intro 真起播（活跑）
     K 复活链：死亡→respawn 后精英满血 90/phase 1/chain 0 且 elite_intro 不复播（log 恒 1）
     L 契约字段：state().enemies[精英].phase/chain 为数值；红/紫恒 phase===1 && chain===0
     M 风压：wind 全程 |Δx| ≥8px（0.6×spd 位移存在）
   ============ 执行次序（位置编排所需）============
   J静态 → 序章走链→act2 → E1-3 触发 → A → J活跑 → 杀紫 → H(9.4s) → 杀残余? → I(精英采样+红参照)
   → C → D → E → M → F → G → K → L → 哨兵/汇总。
   （I 在 K 之前＝死亡重置场景前采样；H 在 I 前＝站台期精英钉在 T3 左沿 740，正好给 I 的
     A 帧一个稳定起点。）
   ============ 编排协议（flick：拉刀口不挨打）============
   敌 strike 命中带（game.js 实读）：|P.x−(e.x+dir*26)|<36 ∧ |(P.y−27)−(e.y−23)|<48（地面战两
   y 恒差 4 ⇒ 竖直恒真）。编排：把玩家瞬移到 e.x±45（adx=45<58 ⇒ 当帧 chase→wind），侦测到
   state==="wind" 立即把玩家teleport 到同侧 300px 外（e.x+side*300）——wind 期间 dir 每帧按玩家
   位置重算 ⇒ away 必须与 flick 同侧，否则 wind 中途反向、M 行风压位移假零。side 规则：
   e.x>560 ⇒ side=−1（朝左＝离开 T3 停步带 [740,916]），否则 side=+1（朝右＝离开 T1 停步带
   [280,384]）——停步带方向反向时 wind 位移被 clamp 抵消（384 处向左、740 处向右皆纹丝不动）。
   D 行例外（stay：玩家留在 e.x−45 吃 strike）。每次测量后把玩家停到远离侧（e.x<480?900:60）。
   ============ I 行测量协议（克隆 gate-11 冻结差分掩膜；supersample dsf=2）============
   viewport deviceScaleFactor=2 ⇒ k=2（game dpr=min(dpr,2)）。阈值全部以 css 等效登记：
   像素数 ÷k²、长度 ÷k。窗口＝冻结点读到的敌 x 为中心：[x±70]×[365,480]（白窗 [x±60]×[370,476]）。
   冻结前：玩家已park在 150（窗距 ≥220px）、narrClean、精英 state==="chase"（避免 wind 白环污染）。
   A 抓帧 + 220ms 后 A2 自证（≤2css 变像素）；B1/B2＝解冻让精英跑离窗（≥100px）后成对冻结抓，
   |B1−B2|（窗内）>64css ⇒ 整对重抓 ≤4；掩膜=|A−B1| 剔 dilate(2css)(|B1−B2|)；主连通/面积/bbox
   自掩膜；精确色在裁片原图上数。红参照：spawnEnemy("red") 于 x≈200 + 同协议（红窗 [x±70]）。
   出图：窗真彩|掩膜 64px 并排（sil64-amber / sil64-red）。
   ============ 红侧预期（现树 72016cb8…，unexpected PASS 必须 =0）============
   全部字母行红（无精英/无键/无钩子）；G15.0 零错误哨兵绿（哨兵不计入字母行）。rc=1。
   ============ 用法 ============
   node tools/gate-15-elite.cjs   env：CHAITAI_URL / CHAITAI_SHOT_PREFIX（截图前缀）
   红档留档：CHAITAI_SHOT_PREFIX=D:/2006L/chaitai/shots/w7-red/gate-15-
   ============ 仪器修订记录（10-17 红侧首跑前；只动仪器，不动判据/阈值）============
   R1：补 B 行实现——§0 预注册有 B 行（静态源码含 {k:"elite",x:640}），初稿漏落，
     红侧凑不齐 A–M 13 行；补上，判据与 §0 原文一致（want=1）。
   R2：I 行白环布尔式修复——初稿该式为拼接残渣（JS 求值恒 false，绿侧必假红），
     修为 css(whiteN) >= 100（阈值 100 不变）。
   R3：红侧缺钩子防崩溃——杀非精英原直调 dbg("enemyHit")，现树无此钩子（E34 才加），
     evaluate 抛错 ⇒ rc=2 整体中断、红表残缺；改为页内 typeof 自检，缺则记 "no-hook" 继续。
   R4：走链保真双钉——照 gate-7 :121/:131，E1-1 前与 E1-2 清场前各补 setPlayerX(430)
     （序章挨打击退会移动玩家；镜像数学依赖恰 430）。
   R5：H 行 skew 实测化——初稿 4600ms 硬编码改为实测（触发刻→trace 起刻）；
     判据窗 [7800,9300] 与 log 双证不变。
   R6：旁白读数改走正式通道——探针实测定性 window.Narr 不存在（游戏脚本非全局作用域；
     gate-11 当年即绕道 state().narrator）⇒ logCount 改用 debug.telemetry().events、
     narrTrace 改用 telemetry().narrKey/narrChars（E34 预注册观测面；红树恒 null ⇒ 诚实红，
     绿树可达）。waitClean 直用 state().narrator（原 window.Narr 分支为死码）。
   R7（10-17 绿侧首跑后；只动仪器，判据/阈值零变化）：I 行 B 对「跑离窗」协议对地面精英不可达——
     台箱停步带（game.js updEnemy 尾：箱面前后 20px 拽回箱侧）把精英锁在 T3 一带，
     |x−cxA|≥100 恒假 ⇒ 4 连 continue、B1/B2=null、maskClean 崩（rc=2；红树无精英走不到此支）。
     改「离场」法：A 帧后 park(900)（玩家出窗）→ enemyHit(id,9999) 击杀（死兵帧 continue，
     P2 门/怒旁白/站台提醒三守卫零触达）→ 轮询 id 消失（尸体 0.6s 后 splice）→ waitClean
     （吞幕终 act1_end 旁白）→ 同窗成对冻结抓 B1/B2（噪声守卫保留）。红参照段同法（kill 提前）。
     白环段前补 spawnEnemy("elite",740)（原精英已被 B 对用掉；此钉位与白环侧向注释吻合；
     C/D/E/M/F/G 行 eliteInfo 依此活体）。
   R8（10-17 绿侧二跑后；仍只动仪器，判据/阈值零变化）：
     根因1（I 行）：R7 离场法在抓帧之间 park(900) 移动了玩家 x——game.js :994 layOff(par)=
       Math.round(clamp((player.x−480)*par,±12)) 随 player.x 变 ⇒ 远/中景整体横移（150→900 差 24px），
       中景全部边界入 |A−B| 掩膜（实测掩膜 23554px、主连通 68.9%）。还原本文件 :36 预注册原协议
       「解冻让目标跑离窗（≥100px）后成对冻结抓」：玩家钉 150 全程不动，精英追 150 左行至台箱 B
       停步带钉位 584（|584−760|=176≥100 可达；R7 注释误判不可达）。B 对后击杀清场（幕终链路不变）。
     根因2（I 行）：解冻期 LAY.t 前进 ⇒ 环境灯（bakeMidTick LX=700/830，lv=floor((0.5+0.5*sin(
       tok*2.3+lx*0.137))*4) 封顶 3）跨 ≥2 档时灯心 ΔR≥13 入 8 阈值（单档 ΔR≈5.8-7.2 不入掩膜）。
       加「采样窗静默预检」（方案 v2 :152）：A 冻结后读两灯实画像素，解冻期轮询至两灯回到 A 值
       （相位周期 2π/2.3≈2.73s ⇒ ≤3.4s 必达）才封冻 B；B 对后灯箱区 A−B 差像素须=0，连同
       |B1−B2|≤64css 不满足则整对重抓 ≤4（阈值/判据不变）。红参照段同协议（窗内唯一灯＝
       LX[1]=150，ly=411，经 LAMP_LY 表）——防其掩膜高度（hRatio 分母）被灯污染抬升。
     根因3（M 行）：wind x+=dir*spd*0.6*dt 若风向侧顶着停步带壁则被 clamp（P2b 实测 7.6px<8）——
       侧向改按「风向前进余量」取大者（判据 mOk=dx>=8 不动）。
     旁白守卫说明：Loop6 后 playing 相字幕箱 ty=184 恒在抓帧窗 y∈[365,480] 外 ≥123px（game.js:1570）
       ⇒ 结构上不入掩膜；narrClean 以冻结态 narrator 读数复核记录（免 gate-11 式重抓）。
   R9（10-17 绿侧三跑后；仍只动仪器，判据/阈值零变化）：高比基准改主连通块 bbox。
     根因4：远景层 bakeFarTick（game.js:1023）于天际线画四档闪烁楼窗（6×9px，lv 随 tok 相位，
     与灯同族但散布全窗）。A→B 间隔内任一楼窗跨档即产出 54px 独立碎块：R8 三跑实测红窗 by0
     被碎块上抬 28 设备像素（挂环顶上方 14css 处）⇒ hRed 145→173、高比在 1.59/0.97 间随机
     掀翻——判据被噪声主宰（违反「不稳定不得标 PASS」）。碎块与本体不连通（mainFrac≈99% 自证）；
     「剪影」＝主连通体（与判据「连笔单连通」同源）⇒ hRatio 改 (RA.mBh/RR.mBh)。阈值与算式
     （≥95% / ≥1.15 / ≥80 / ≥100 / 框外=0）零变化；全掩膜值仍在 G15-DATA 行并列打印
     （h/hRed 全掩膜 vs hMain/hRedMain 主连通）备查。
   R10（10-17 绿侧四跑前；仍只动仪器，判据/阈值零变化）：I 行 A/B 相位玩家位改 park(350)。
     根因5（对 R8 注释「R7 误判不可达」的更正——R7 结论对、理由不同）：精英 chase 门为 adx<430
     （game.js :490-493：adx>430 ⇒ 退 patrol；patrol 以 sin(t*0.7+seed)*30*dt 原地振荡，
     ±≈43px）。玩家钉 150 时 adx≈610 ⇒ 精英恒 patrol ⇒ 永不左行离窗 ⇒ B 对「9s 内未达
     x≤cxA−100」（R8/R9 实跑日志两轮实证）且 B 帧内本尊仍在窗内 ⇒ 掩膜＝本尊×幽灵位移并集
     （两像同顶 ⇒ 高度量侥幸无偏；连通/面积被污染：mainFrac 99.2↔81.6 摆动即此）。
     修法：玩家改钉 350 —— adx(760)≈410<430 ⇒ 保持 chase ⇒ 精英左行至台箱 B 停步带钉位 584
     （|584−cxA|≥100 真正可达）⇒ B 帧/掩膜只含本尊。视差零位移：A 对与 B 对都钉在玩家
     x=350 抓取（layOff 只随 player.x 变；对内恒同 ⇒ |A−B| 无视差项），与旧协议 150 的
     偏移差（far 0.08×130=10.4→−10 vs 150 时 −12）不参与任何一对的差分。
     红参照段不受影响（红灯由击杀离场，且其 B 对无本尊影像）。
   R11（10-17 绿侧五跑前；仍只动仪器，判据/阈值零变化）：静默预检修复（定案依据＝g15-diag2 一次性诊断
     ＋ game.js:974 源码注释＋R8/R9/R10 实跑数据）：
     根因6a（探针错位）：灯实画于屏幕 x=lx+layOffM（:1064 层画在 off−12/纹理 +12 平移抵消）；
       I 相位 layOffM=−12 ⇒ 灯 700 实位 688，而探针 lampPix(700) 读屏幕 700＝灯外 12px 的静态像素
       （diag 实测 A/B/B′ 三次逐字节相同 (41,27,44)，对齐恒「达成」＝空转）。修：探针与灯箱一律
       按 lx+layOffM 读（layers() 活读；红段 +12 同理 150→162）。R8-run2 boxPx=1619≈灯 2+ 档跳变
       的 r≈11css 盘量级（1520px 设备）——探针死时灯确实会漏。
     根因6b（楼窗碎块漏检）：bakeFarTick 闪窗白名单＝完全位于 x∈[680,940]（:974 注释原文），
       恰罩住抓帧窗左侧；每档 ΔR≈13-17(≥8) ⇒ A/B 间隔内翻档的楼窗＝216 设备 px 碎块，R10 的
       boxPx 497≈2 窗+精英左缘 16（diag 复现 16 逐像素吻合）；4 连重抓值 500/497/497/497 稳定＝
       重试仅隔 ~0.3s、楼窗相位几乎未动。R10 主连通 94.9% 的非主 551 ≈ boxPx 497+54 同源。
     修（预注册「采样窗静默预检」方案 v2:152 的正确形态——直接度量窗口静默度）：B 对验收条件
       由「灯箱差=0 ∧ |B1−B2|≤64css」扩为「∧ maskClean(A1,B1,B2) 的 mainFrac ≥ 0.95」（阈值
       ＝判据原文值，零新常数）。真缺陷（连笔断开/灯盘大斑）在每对重测中恒存 ⇒ 4 对全部 <0.95
       ⇒ 沿用末对照判照红——重试只能清相位性噪声、不可能掩盖判据；相位性楼窗在重试间移动相位
       （对齐等待 0~2.7s 自然提供）⇒ 有一次干净即成。红参照段同扩。
     附：A1/B1/mask 两段各存 3 张 PNG＋连通块 top5 明细入日志（取证；不判定）。
   R12（10-17 J 步；falsify-g15 首跑驱动；仍只动仪器，判据/阈值零变化）：
     ①D 行受击窗口前移（驱动＝M4「struck 泄漏」副本绿 ⇒ D 行「strike 中受击不改命中」有检验盲区）：
       原协议玩家贴脸 45px（|45−26|=19<36）⇒ strike 首帧即结伤、struck 被 :497 锁死 ⇒ 注入的
       受击恒发生在命中结算之后 ⇒ 「不改命中」从未被检验。修：wind 期（windup 0.65s，宽裕）先移
       玩家出触及范围（windX+side*130）→ 等 strike → 注入受击（此时 struck 仍 false）→ 回位 45px
       （blade 距 19 ⇒ 正树触及结伤恰一次；M4 提前锁 struck ⇒ 命中被吞 ⇒ hp 差 0 ⇒ D 红）。
       证据：M4 副本改后 D 红「玩家 hp 100→100」（shots/falsify-g15/M4/gate-on-M4.txt）；正本改后
       仍 13/13 rc=0（falsify 内嵌正本两跑一致；后续全套 falsify 六趟再验）。
     ②（falsify-g15.cjs 侧）M1 预期红集 {C,D}→{C,D,E}——理由与证据见该文件头注 F1 条。
   R14（10-17 K 步后；仍只动仪器，判据/阈值/rc 逻辑零变化）：汇总行文案缺陷修复。
     T4 首跑（绿侧 13/13 PASS）时汇总行仍打印红侧口径原文「（红侧预期 0/13）· unexpected
     PASS=13（违反第一判据！）」——该文案写死于红侧首跑语境（:40），与同段「GATE gate-15-elite:
     PASS」及 rc=0 自相矛盾（数字对、口径错）。rc 判定（末两行）与全部 [PASS]/[FAIL] 判据行一字
     未动；修法＝汇总行改中性双口径标注（红侧预注册口径 0/13 且 unexpected=0；绿侧口径 13/13；
     「当前=」按 passN 判读达成方）。三口径文案模拟已验（0/13、13/13、5/13 三种输出自洽）。
     R14 代码态 md5＝c1c209c266b2c22599e44a30bf950681（R11+R12 后为 61fb7cdd…；备份
     shots/w7-t2b/gate-15-elite.cjs.pre-r14.bak）；加本条头注后的定版 md5 见台账
     shots/w7-t2b/r8-r12-instrument-revision-record.txt 定版钉（免头注自指递归）。
     R14 后全量 T4 重跑为终版回执。 */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOTP = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/g15-");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }

/* 预注册常数（一字不动；k 归一在用法处） */
const WIN_HALF = 70;          /* 剪影/精确色窗半宽 css */
const WHITE_HALF = 60;        /* 白窗半宽 css */
const WIN_Y0 = 365, WIN_Y1 = 480;
const WHITE_Y0 = 370, WHITE_Y1 = 476;
const BP_NOISE_MAX_CSS = 64;  /* |B1−B2| 窗内噪声上限（css 等效） */
const FREEZE_NOISE_MAX_CSS = 2;

const results = [];
function report(tag, ok, detail) { results.push({ tag, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + tag + " —— " + detail); }
const lettered = () => results.filter(r => /^G15\.[A-M] /.test(r.tag));

/* ---------- 零依赖 PNG 写出（照 gate-11） ---------- */
function crc32(buf) { let crc = 0xffffffff; for (let i = 0; i < buf.length; i++) { crc ^= buf[i]; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); }
function writePNG(file, w, h, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  fs.writeFileSync(file, Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]));
}
function scaleRegion(rgba, cw, bx0, by0, bw, bh, outH) {
  const outW = Math.max(1, Math.round(bw * outH / bh)); const buf = Buffer.alloc(outW * outH * 3);
  for (let oy = 0; oy < outH; oy++) { const sy0 = by0 + Math.floor(oy * bh / outH), sy1 = Math.max(sy0 + 1, by0 + Math.floor((oy + 1) * bh / outH));
    for (let ox = 0; ox < outW; ox++) { const sx0 = bx0 + Math.floor(ox * bw / outW), sx1 = Math.max(sx0 + 1, bx0 + Math.floor((ox + 1) * bw / outW));
      let r = 0, g = 0, b = 0, n = 0; for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { const j = (y * cw + x) * 4; r += rgba[j]; g += rgba[j + 1]; b += rgba[j + 2]; n++; }
      const j2 = (oy * outW + ox) * 3; buf[j2] = Math.round(r / n); buf[j2 + 1] = Math.round(g / n); buf[j2 + 2] = Math.round(b / n); } }
  return { w: outW, h: outH, buf };
}
function maskToRGB(mask, cw, bx0, by0, bw, bh, outH) {
  const outW = Math.max(1, Math.round(bw * outH / bh)); const buf = Buffer.alloc(outW * outH * 3);
  for (let oy = 0; oy < outH; oy++) for (let ox = 0; ox < outW; ox++) {
    const x = bx0 + Math.floor((ox + 0.5) * bw / outW), y = by0 + Math.floor((oy + 0.5) * bh / outH);
    const on = mask[y * cw + x]; const j = (oy * outW + ox) * 3;
    buf[j] = on ? 235 : 16; buf[j + 1] = on ? 235 : 16; buf[j + 2] = on ? 245 : 24; }
  return { w: outW, h: outH, buf };
}
/* R11 存证用：整窗（不缩放、不裁剪）RGBA→RGB 与掩膜→RGB */
function rgbaToRGBFull(rgba, w, h) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { const j = i * 4, j2 = i * 3; buf[j2] = rgba[j]; buf[j2 + 1] = rgba[j + 1]; buf[j2 + 2] = rgba[j + 2]; }
  return { w, h, buf };
}
function maskToRGBFull(mask, w, h) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { const on = mask[i], j2 = i * 3; buf[j2] = on ? 235 : 16; buf[j2 + 1] = on ? 235 : 16; buf[j2 + 2] = on ? 245 : 24; }
  return { w, h, buf };
}
function hconcat(parts, gap) {
  const H = Math.max.apply(null, parts.map(p => p.h)); const W = parts.reduce((s, p) => s + p.w, 0) + gap * (parts.length - 1);
  const buf = Buffer.alloc(W * H * 3); buf.fill(48);
  let xo = 0; for (const p of parts) { for (let y = 0; y < p.h; y++) p.buf.copy(buf, (y * W + xo) * 3, y * p.w * 3, (y + 1) * p.w * 3); xo += p.w + gap; }
  return { w: W, h: H, buf };
}

(async () => {
  console.log("== gate-15-elite（W7 精英·大灯）==");
  console.log("URL  = " + URL_);
  let dir = ROOT;
  try { const u = new URL(URL_); if (u.protocol === "file:") dir = path.dirname(decodeURIComponent(u.pathname.replace(/^\//, ""))); } catch (e) {}
  console.log("md5  = game.js " + md5(path.join(dir, "game.js")) + " / index.html " + md5(path.join(dir, "index.html")) + "（被测目录 " + dir + "）");
  fs.mkdirSync(path.dirname(SHOTP), { recursive: true });

  /* ---------- J 静态：三旁白键在两文件 ---------- */
  const KEYS3 = ["elite_intro", "elite_enrage", "elite_standoff"];
  const jsTxt = (() => { try { return fs.readFileSync(path.join(dir, "assets", "narrator-lines.js"), "utf8"); } catch (e) { return null; } })();
  const jsonTxt = (() => { try { return fs.readFileSync(path.join(dir, "assets", "narrator-lines.json"), "utf8"); } catch (e) { return null; } })();
  const cntIn = (txt, k) => (!txt ? -1 : txt.split(k).length - 1);
  const jStatic = KEYS3.every(k => cntIn(jsTxt, k) >= 1 && cntIn(jsonTxt, k) >= 1);
  const jStaticD = KEYS3.map(k => k + " js=" + cntIn(jsTxt, k) + "/json=" + cntIn(jsonTxt, k)).join(" ");

  /* ---------- B 行：静态源码（§0 预注册：E1-3 行含 {k:"elite",x:640} 恰 1 处） ---------- */
  const gameSrc = (() => { try { return fs.readFileSync(path.join(dir, "game.js"), "utf8"); } catch (e) { return ""; } })();
  const bHits = gameSrc.split('{k:"elite",x:640}').length - 1;
  report("G15.B 静态源码 E1-3", bHits === 1, "game.js 含 {k:\"elite\",x:640} 命中=" + bHits + "（须 1）");

  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });

  const st = () => page.evaluate(() => window.__game.state());
  const dbg = (f, a) => page.evaluate((fn, args) => { const d = window.__game.debug; return d[fn].apply(d, args); }, f, a || []);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(60); } return null; };
  const bornOf = (id) => page.evaluate((want) => { const s = window.__game.state(); const L = s.lastSpawn; return (L && L.id === want) ? L.born : null; }, id);
  const waitBorn = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const b = await bornOf(id); if (b) return b; await sleep(50); } return null; };
  const ksOf = (b) => b.map(e => e.k).join(",");
  const xsOf = (b) => b.map(e => Math.round(e.x)).join(",");
  const bornOk = (b, ks, xs) => !!b && b.length === xs.length && ksOf(b) === ks && b.every((e, i) => Math.abs(e.x - xs[i]) <= 1);
  const enemies = async () => (await st()).enemies || [];
  const eliteInfo = async () => { const es = await enemies(); for (const e of es) if (e.kind === "elite") return e; return null; };
  const enemyById = async (id) => { const es = await enemies(); for (const e of es) if (e.id === id) return e; return null; };
  const playerInfo = async () => (await st()).player;
  /* R6：旁白日志改走 telemetry().events（window.Narr 探针实测不存在） */
  const logCount = (key) => page.evaluate((k) => { try { const t = window.__game.debug.telemetry(); return (t && Array.isArray(t.events)) ? t.events.filter(function (x) { return x === k; }).length : -1; } catch (e) { return -1; } }, key);
  const waitClean = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 12000)) { const n = await page.evaluate(() => { try { const n2 = window.__game.state().narrator; return !n2.current && n2.queueLen === 0; } catch (e) { return true; } }); if (n) return true; await sleep(150); } return false; };

  /* ---------- 采样/编排工具 ---------- */
  const traceElite = (id, ms, step) => page.evaluate((a) => new Promise((res) => {
    const S = window.__game.state; const out = []; const t0 = performance.now();
    (function tick() {
      try { const s = S(); let e = null; for (let i = 0; i < s.enemies.length; i++) if (s.enemies[i].id === a.id) { e = s.enemies[i]; break; }
        out.push(e ? { t: Math.round(performance.now() - t0), x: Math.round(e.x * 10) / 10, st: e.state, ch: e.chain | 0, hp: e.hp, ph: e.phase } : { t: Math.round(performance.now() - t0), gone: 1 });
      } catch (err) { out.push({ t: Math.round(performance.now() - t0), err: String(err) }); }
      if (performance.now() - t0 < a.ms) setTimeout(tick, a.step); else res(out);
    })();
  }), { id, ms, step: step || 10 });
  /* R6：narrKey/narrChars 走 telemetry（E34 预注册观测面；红树字段缺失 ⇒ k=null/c=-1＝诚实红） */
  const narrTrace = (ms, step) => page.evaluate((a) => new Promise((res) => {
    const out = []; const t0 = performance.now();
    (function tick() {
      let k = null, c = -1;
      try { const t = window.__game.debug.telemetry();
        k = (t && t.narrKey != null) ? t.narrKey : null;
        c = (t && typeof t.narrChars === "number") ? Math.round(t.narrChars) : -1;
      } catch (e) { k = "ERR"; }
      out.push({ t: Math.round(performance.now() - t0), k: k, c: c });
      if (performance.now() - t0 < a.ms) setTimeout(tick, a.step); else res(out);
    })();
  }), { ms, step: step || 25 });
  /* flick：place→wind 侦测→(可选)away。stay=true 时玩家留在 e.x+side*45（D 行） */
  const flick = (id, side, away, stay) => page.evaluate((a) => new Promise((res) => {
    const d = window.__game.debug, S = window.__game.state;
    const find = () => { try { const s = S(); for (let i = 0; i < s.enemies.length; i++) if (s.enemies[i].id === a.id) return s.enemies[i]; } catch (e) {} return null; };
    const e0 = find(); if (!e0) return res({ ok: false, why: "no-elite" });
    d.setPlayerPos(e0.x + a.side * 45, 470);
    const t0 = performance.now();
    (function tick() {
      const e = find(); if (!e) return res({ ok: false, why: "gone" });
      if (e.state === "wind") { if (!a.stay) d.setPlayerPos(a.away, 470); return res({ ok: true, windMs: Math.round(performance.now() - t0), windX: e.x, side: a.side }); }
      if (performance.now() - t0 > 1600) { const p = S().player; return res({ ok: false, why: "no-wind", state: e.state, x: Math.round(e.x), adx: Math.round(Math.abs(e.x - p.x)) }); }
      setTimeout(tick, 8);
    })();
  }), { id, side, away, stay });
  /* flickFreeze：wind 后 awayOnWind，afterWindMs 后封冻并回报（I 白窗用） */
  const flickFreeze = (id, side, away, afterWindMs) => page.evaluate((a) => new Promise((res) => {
    const d = window.__game.debug, S = window.__game.state;
    const find = () => { try { const s = S(); for (let i = 0; i < s.enemies.length; i++) if (s.enemies[i].id === a.id) return s.enemies[i]; } catch (e) {} return null; };
    const e0 = find(); if (!e0) return res({ ok: false, why: "no-elite" });
    d.setPlayerPos(e0.x + a.side * 45, 470);
    const t0 = performance.now();
    (function tick() {
      const e = find(); if (!e) return res({ ok: false, why: "gone" });
      if (e.state === "wind") {
        d.setPlayerPos(a.away, 470);
        setTimeout(function () {
          d.setHitstop(600);
          setTimeout(function () { const e2 = find(); res(e2 ? { ok: true, windX: e2.x, frozenX: e2.x, st: e2.state } : { ok: false, why: "gone" }); }, 60);
        }, a.afterWindMs);
        return;
      }
      if (performance.now() - t0 > 1600) return res({ ok: false, why: "no-wind", state: e.state });
      setTimeout(tick, 8);
    })();
  }), { id, side, away, afterWindMs });
  const pickSide = (cx) => (cx > 560 ? -1 : 1);
  const awayX = (cx, side) => Math.max(60, Math.min(920, Math.round(cx + side * 300)));
  const neutralX = (cx) => (cx < 480 ? 900 : 60);
  const waitStateIn = async (id, wants, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = await enemyById(id); if (!e) return null; if (wants.indexOf(e.state) >= 0) return e; await sleep(20); } return null; };
  const park = (x) => dbg("setPlayerPos", [x, 470]);

  /* ---------- 抓帧/掩膜（克隆 gate-11，dil/阈值 k 归一） ---------- */
  const crop = (x0, y0, x1, y1) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const w = Math.round((a[2] - a[0]) * k), h = Math.round((a[3] - a[1]) * k);
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), w, h).data;
    return { w: w, h: h, k: k, data: Array.prototype.slice.call(d) };
  }, [x0, y0, x1, y1]);
  function changedCount(A, B, thr) { let c = 0; for (let i = 0; i < A.w * A.h; i++) { const j = i * 4; if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= (thr || 8)) c++; } return c; }
  function maskOf(A, B) { const n = A.w * A.h; const m = new Uint8Array(n); for (let i = 0; i < n; i++) { const j = i * 4; if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= 8) m[i] = 1; } return m; }
  function maskClean(A, B1, B2) {
    const w = A.w, h = A.h, k = A.k, m = maskOf(A, B1), nb = maskOf(B1, B2);
    const dil = Math.max(2, Math.round(2 * k));
    let removed = 0, noise = 0; for (let i = 0; i < nb.length; i++) if (nb[i]) noise++;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!m[y * w + x]) continue;
      let hit = false;
      for (let dy = -dil; dy <= dil && !hit; dy++) for (let dx = -dil; dx <= dil && !hit; dx++) { const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && nb[ny * w + nx]) hit = true; }
      if (hit) { m[y * w + x] = 0; removed++; } }
    return { m, removed, noise };
  }
  function analyze(A, m) {
    const w = A.w, h = A.h, k = A.k; let area = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { area++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    if (!area) return { area: 0, bx0: 0, by0: 0, bx1: 0, by1: 0, bw: 0, bh: 0, nComp: 0, mainFrac: 0, mBx0: 0, mBy0: 0, mBx1: 0, mBy1: 0, mBw: 0, mBh: 0, compTop5: [], k: k };
    const seen = new Uint8Array(w * h); const comps = []; let main = null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i0 = y * w + x; if (!m[i0] || seen[i0]) continue;
      let sz = 0, cx0 = 1e9, cy0 = 1e9, cx1 = -1, cy1 = -1; const q = [i0]; seen[i0] = 1;
      while (q.length) { const i = q.pop(); sz++; const cx = i % w, cy = (i - cx) / w;
        if (cx < cx0) cx0 = cx; if (cx > cx1) cx1 = cx; if (cy < cy0) cy0 = cy; if (cy > cy1) cy1 = cy;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const ni = ny * w + nx; if (m[ni] && !seen[ni]) { seen[ni] = 1; q.push(ni); } } }
      comps.push(sz);
      if (!main || sz > main.sz) main = { sz: sz, x0: cx0, y0: cy0, x1: cx1, y1: cy1 }; }
    comps.sort((a, b) => b - a);
    const nComp = comps.filter(s => s >= 4).length;
    const mainFrac = area ? comps[0] / area : 0;
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    const mBw = main.x1 - main.x0 + 1, mBh = main.y1 - main.y0 + 1;
    return { area, bx0, by0, bx1, by1, bw, bh, nComp, mainFrac, mBx0: main.x0, mBy0: main.y0, mBx1: main.x1, mBy1: main.y1, mBw, mBh, compTop5: comps.slice(0, 5), k: k };
  }
  /* 精确色统计（裁片原图；返回 device 数、bbox、bbox 外数） */
  function exactColor(A, r, g, b) {
    let n = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) { const j = (y * A.w + x) * 4;
      if (A.data[j] === r && A.data[j + 1] === g && A.data[j + 2] === b) { n++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
    return { n, bx0, by0, bx1, by1 };
  }
  function outsideBox(A, ex, bx0, by0, bx1, by1) { let n = 0; for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) { const j = (y * A.w + x) * 4;
    if (A.data[j] === ex[0] && A.data[j + 1] === ex[1] && A.data[j + 2] === ex[2]) { if (x < bx0 || x > bx1 || y < by0 || y > by1) n++; } } return n; }
  const winOf = (cx, y0, y1, half) => [Math.max(0, Math.round(cx - half)), y0, Math.min(960, Math.round(cx + half)), y1];

  /* ---------- R8 灯箱静默预检辅助（原理见头注 R8 根因2；R11：探针按 lx+layOffM 读灯实位——判据/阈值零变化） ---------- */
  const LAMP_LY = { 150: 411, 700: 410, 830: 408 }; /* bakeMidTick LX=[60,150,300,400,520,700,830]，ly=406+((i*5)%7)：i=1→411、i=5→410、i=6→408 */
  let PROBE_DX = 0; /* R11：= 当前段 layOffM（layers().mid 活读）；灯屏幕位 = lx + PROBE_DX */
  const lampPix = (lx) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(Math.round((a[0] + a[2]) * k), Math.round(a[1] * k), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [lx, LAMP_LY[lx], PROBE_DX]);
  const lampPairRead = async () => [await lampPix(700), await lampPix(830)];
  const rgbNear = (a, b, tol) => !!a && !!b && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
  const lampBoxDiff = (A, B, x0, boxes) => { /* A−B 在指定灯箱区（世界 css 矩形，窗内部分）≥8 差像素 */
    const k = A.k; let n = 0;
    for (const bx of boxes) {
      const cx0 = Math.max(0, Math.round((bx[0] - x0) * k)), cx1 = Math.min(A.w, Math.round((bx[2] - x0) * k));
      const cy0 = Math.max(0, Math.round((bx[1] - WIN_Y0) * k)), cy1 = Math.min(A.h, Math.round((bx[3] - WIN_Y0) * k));
      for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) { const j = (y * A.w + x) * 4;
        if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= 8) n++; }
    }
    return n;
  };

  /* ---------- 序章走链 → 第一幕（克隆 gate-7 序章段） ---------- */
  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(700);
  await dbg("setPlayerX", [430]);
  const w1 = await until(async () => { const s = await st(); return s.enemies.length >= 2 ? s : null; }, 4500);
  await dbg("clearWave");
  const w2 = await until(async () => { const s = await st(); return s.enemies.length >= 3 ? s : null; }, 4500);
  await dbg("clearWave");
  const cl = await until(async () => { const s = await st(); return s.cleared ? s : null; }, 7000);
  const cr = await until(async () => { const s = await st(); return s.continueReady ? s : null; }, 9000);
  if (!w1 || !w2 || !cl || !cr) throw new Error("序章走链失败（w1=" + !!w1 + " w2=" + !!w2 + " cleared=" + !!cl + " cont=" + !!cr + "）");
  await page.keyboard.press("KeyJ"); await sleep(300);
  const s2 = await st();
  if (s2.act !== 2) throw new Error("按 J 未进入第一幕 act=" + s2.act);
  await dbg("setPlayerX", [430]); /* R4 保真（gate-7 :121 同款）：序章挨打击退会移动玩家，E1-1 判出生前回中 */
  const bE1 = await waitBorn("E1-1", 4500); await dbg("clearWave");
  await dbg("setPlayerX", [430]); /* R4 保真（gate-7 :131 同款）：E1-2 镜像数学依赖恰 430 */
  const bE2 = await waitBorn("E1-2", 5000); await dbg("clearWave");
  if (!bornOk(bE1, "red,red", [760, 850]) || !bornOk(bE2, "purple,purple,red", [800, 890, 900])) throw new Error("E1-1/E1-2 走链异常（前场基线坏）");
  await sleep(900); /* 负控窗 */

  /* ---------- E1-3 触发（站 T3）+ A 行 + J 活跑 ---------- */
  const nTraceP = narrTrace(4600, 40);
  const tT3 = Date.now(); /* R5：触发刻（H 行 skew 实测锚） */
  await dbg("setPlayerPos", [828, 300]);
  const b3 = await waitBorn("E1-3", 3000);
  const liveE = await eliteInfo();
  const aOk = bornOk(b3, "purple,purple,elite", [460, 550, 640]);
  report("G15.A 走链 E1-3", aOk && !!liveE,
    b3 ? ("kinds=" + ksOf(b3) + " born=" + xsOf(b3) + " · 活体=" + (liveE ? ("elite@" + Math.round(liveE.x)) : "无精英")) : "3s 内没等到 E1-3");
  await page.screenshot({ path: SHOTP + "01-e13-born.png" });

  /* J 活跑：出生 4.6s 内 elite_intro 真起播（chars>0） */
  const nJ = await nTraceP;
  const jLive = nJ.find(s => s.k === "elite_intro" && s.c > 0);
  report("G15.J 旁白三键", jStatic && !!jLive,
    "静态[" + (jStatic ? "三键齐" : "缺") + ":" + jStaticD + "] · 活跑 " + (jLive ? ("elite_intro@" + jLive.t + "ms chars=" + jLive.c) : ("4.6s 未起播（键历史=" + nJ.map(s => s.k).filter(k => k).slice(0, 4).join(",") + "）")));

  /* ---------- 杀非精英（留精英；R3 缺钩子守卫：现树无 enemyHit ⇒ 记录后继续，不崩） ---------- */
  const killRes = await page.evaluate(() => {
    const d = window.__game.debug, S = window.__game.state;
    if (typeof d.enemyHit !== "function") return { ok: false, why: "no-hook（现树预期；E34 后才有）" };
    let n = 0; const done = [];
    for (const e of S().enemies) {
      if (e.kind === "elite" || e.hp <= 0) continue;
      for (let i = 0; i < 30; i++) {
        const cur = S().enemies.filter(function (x) { return x.id === e.id; })[0];
        if (!cur || cur.hp <= 0) break;
        d.enemyHit(e.id, 50); n++;
      }
      done.push(e.kind + "@" + Math.round(e.x));
    }
    return { ok: true, killed: done, hits: n };
  });
  console.log("   [杀非精英] " + JSON.stringify(killRes));

  /* ---------- H 行：站 T3 连续满 8s（t0=触发时刻；R5：skew 实测化，判据窗不变） ---------- */
  const logH0 = await logCount("elite_standoff");
  const hStart = Date.now();
  const hSkew = hStart - tT3; /* 实测：触发 → H trace 起刻（替代初稿 4600 硬编码） */
  const nH = await narrTrace(5200, 50);
  const logH1 = await logCount("elite_standoff");
  const hSeen = nH.find(s => s.k === "elite_standoff");
  const hAbs = hSeen ? hSkew + hSeen.t : -1;
  const hOk = (logH1 - logH0 === 1) && !!hSeen && hAbs >= 7800 && hAbs <= 9300;
  report("G15.H 站台提醒", hOk,
    "log 触发=" + (logH1 - logH0) + "（须 1）· skew=" + hSkew + "ms · 渲染首见≈触发后 " + (hAbs >= 0 ? hAbs : "未") + "ms（须 ∈[7800,9300]）· " + (hSeen ? ("chars=" + hSeen.c) : "9.8s 窗内未起播"));

  /* ---------- I 行前置：park 350（R10）—— 玩家 x 自 A 抓帧到 B 抓帧全程不动（gate-11「视差零位移」）
     R10：350 使 adx(760)≈410<430 ⇒ 精英保持 chase 左行（150 时 adx≈610>430 ⇒ 恒 patrol 原地振荡）。
     park 后早冻结：精英离场启动有迟滞（R7 实测 ~0.5s 未动 ⇒ cxA≈760）；cxA≥684 即可保 |Δ|≥100 可达 ---------- */
  await park(350);
  await sleep(150);
  PROBE_DX = await page.evaluate(() => window.__game.debug.layers().mid); /* R11：灯探针实位偏移（本段恒 −12；此处活读留证） */
  console.log("   [R11 探针] I 段 layOffM=" + PROBE_DX + " ⇒ 灯 700/830 实位屏幕 x=" + (700 + PROBE_DX) + "/" + (830 + PROBE_DX));
  const elI0 = await eliteInfo();
  const iOkParts = [];
  let RA = null, RR = null, IW = null, amberExact = -1, amberOut = -1, whiteN = -1, whiteCtl = -1, MC = null, MCR = null;
  if (!elI0) {
    report("G15.I 视觉（#ffb040/连通/高度/白环）", false, "无精英（红侧预期）");
  } else {
    const id = elI0.id;
    /* A 对：冻结（须 chase/patrol——排除 wind 白环/strike 旋转；冻结先行 + 抓后状态复核，不过则解冻重试 ≤3） */
    let A1 = null, A2 = null, selfNoise = -1, cxA = elI0.x, aGood = false;
    let k = 2, css = (n) => n / 4;
    for (let ta = 1; ta <= 3; ta++) {
      await waitStateIn(id, ["chase", "patrol"], 1800);
      await dbg("setHitstop", [600]);
      await sleep(180);
      const eA = await enemyById(id);
      if (!eA) break;
      const stA = eA.state;
      if (["wind", "strike", "hit", "dead"].indexOf(stA) >= 0) {
        console.log("   [R8 A 对复核:I-elite] 第" + ta + "次冻结态 state=" + stA + " ⇒ 解冻重试");
        await dbg("setHitstop", [0]); continue;
      }
      cxA = eA.x;
      A1 = await crop.apply(null, winOf(cxA, WIN_Y0, WIN_Y1, WIN_HALF));
      await sleep(220);
      A2 = await crop.apply(null, winOf(cxA, WIN_Y0, WIN_Y1, WIN_HALF));
      selfNoise = changedCount(A1, A2);
      if (selfNoise <= FREEZE_NOISE_MAX_CSS * A1.k * A1.k) { aGood = true; break; }
      console.log("   [R8 A 对自证:I-elite] 第" + ta + "次 |A1−A2|=" + selfNoise + "px ⇒ 解冻重抓");
      await dbg("setHitstop", [0]);
    }
    if (aGood) {
      k = A1.k; css = (n) => n / (k * k);
      const amber = exactColor(A1, 255, 176, 64);
      /* 旁白守卫（记录性复核）：playing 相字幕箱 ty=184 恒在窗外 123px，结构上不入掩膜 */
      const narrAtA = await page.evaluate(() => { try { const n2 = window.__game.state().narrator; return !!(n2 && n2.current); } catch (e) { return null; } });
      /* B 对（预注册原协议还原＋R10）：解冻 → 精英追 350 左行至台箱 B 停步带钉位 584（|Δ|≥100）→
         灯相位对齐封冻 → B1/B2 成对抓 → 静默预检（灯箱差=0 ∧ |B1−B2|≤64css，不过则整对重抓 ≤4） */
      const wantL = await lampPairRead();
      let B1 = null, B2 = null, bpNoise = -1, boxPx = -1, lampAligned = false, tMF = -1;
      const BP_LIM = BP_NOISE_MAX_CSS * A1.k * A1.k;
      for (let bp = 1; bp <= 4; bp++) {
        await dbg("setHitstop", [0]);
        const away = await until(async () => { const e = await enemyById(id); return (e && e.x <= cxA - 100) ? e : null; }, 9000);
        if (!away) console.log("   [R8 离场法:I-elite] 第" + bp + "次 9s 内未达 x≤" + Math.round(cxA - 100) + "——掩膜可能含精英本体");
        lampAligned = false;
        const tL0 = Date.now();
        while (Date.now() - tL0 < 3400) {
          const nowL = await lampPairRead();
          if (rgbNear(nowL[0], wantL[0], 2) && rgbNear(nowL[1], wantL[1], 2)) { lampAligned = true; break; }
          await sleep(35);
        }
        await dbg("setHitstop", [600]);
        await sleep(120);
        B1 = await crop.apply(null, winOf(cxA, WIN_Y0, WIN_Y1, WIN_HALF));
        await sleep(220);
        B2 = await crop.apply(null, winOf(cxA, WIN_Y0, WIN_Y1, WIN_HALF));
        bpNoise = changedCount(B1, B2);
        boxPx = lampBoxDiff(A1, B1, Math.max(0, Math.round(cxA - WIN_HALF)), [[662, 384, 714, 436], [792, 382, 844, 434]]); /* R11：灯箱按实位（700/830+layOffM） */
        const tMC = maskClean(A1, B1, B2); const tA = analyze(A1, tMC.m);
        tMF = tA.mainFrac;
        MC = tMC; RA = tA; /* 本对结果保留：验收通过即用、用尽沿用（R11：静默预检＝窗口静默度直接度量，阈值取判据原文 0.95） */
        if (boxPx === 0 && bpNoise <= BP_LIM && tMF >= 0.95) break;
        console.log("   [R8 静默预检:I-elite] 第" + bp + "对 灯箱差=" + boxPx + "px（须 0）· |B1−B2|=" + bpNoise + "px · mainFrac=" + (tMF * 100).toFixed(1) + "%（须 ≥95）· 对齐=" + lampAligned + " ⇒ 整对重抓");
      }
      if (!(boxPx === 0 && bpNoise <= BP_LIM && tMF >= 0.95)) console.log("   [R8 静默预检:I-elite] 重试用尽——沿用最后一对（几何类报告可能含残余噪声，附日志）");
      amberExact = amber.n;
      amberOut = outsideBox(A1, [255, 176, 64], RA.bx0, RA.by0, RA.bx1, RA.by1);
      whiteCtl = exactColor(A1, 255, 255, 255).n;
      console.log("   [R8 I 行] cxA=" + cxA.toFixed(1) + " A 自证=" + selfNoise + "px · A 灯值=" + JSON.stringify(wantL) + " · B 灯箱差=" + boxPx + "px |B1−B2|=" + bpNoise + "px 对齐=" + lampAligned + " 旁白活动=" + narrAtA);
      /* R11 存证：A1/B1/最终掩膜 三张整窗 PNG ＋ 连通 top5 明细（供目检连笔完整性与残余噪声形态） */
      if (B1) {
        writePNG(SHOTP + "r11-A1-elite.png", A1.w, A1.h, rgbaToRGBFull(A1.data, A1.w, A1.h).buf);
        writePNG(SHOTP + "r11-B1-elite.png", B1.w, B1.h, rgbaToRGBFull(B1.data, B1.w, B1.h).buf);
        writePNG(SHOTP + "r11-MC-elite.png", A1.w, A1.h, maskToRGBFull(MC.m, A1.w, A1.h).buf);
        console.log("   [R11 存证:I-elite] r11-A1/B1/MC-elite.png · compTop5=" + JSON.stringify(RA.compTop5) + " · main bbox=(" + [RA.mBx0, RA.mBy0, RA.mBx1, RA.mBy1].join(",") + ") " + RA.mBw + "×" + RA.mBh + " (css " + (RA.mBw / k).toFixed(1) + "×" + (RA.mBh / k).toFixed(1) + ")");
      }
    } else {
      console.log("   [R8 I 行] A 对三次未取到——I 行判据自然红（RA=null）");
    }
    await dbg("setHitstop", [0]);
    /* 离场/清理：击杀精英（原 R7 击杀时点后移到 B 对之后；act1_end 旁白由 waitClean 吞）→ 玩家移 900（红参照前提） */
    await dbg("enemyHit", [id, 9999]);
    const eGone = await until(async () => !(await enemyById(id)), 2500);
    if (!eGone) console.log("   [R8 清场:I-elite] 击杀后 2.5s 精英未消失");
    await waitClean(5000);
    await park(900);
    await sleep(250);
    PROBE_DX = await page.evaluate(() => window.__game.debug.layers().mid); /* R11：红段灯探针实位偏移（此段恒 +12） */
    console.log("   [R11 探针] I-red 段 layOffM=" + PROBE_DX + " ⇒ 灯 150 实位屏幕 x=" + (150 + PROBE_DX));
    /* 红参照：spawnEnemy("red") @200（玩家 900 距远），同协议 */
    let rid = null;
    try {
      const before = (await enemies()).map(e => e.id);
      await dbg("spawnEnemy", ["red", 200]);
      await sleep(90);
      const after = await enemies();
      for (const e of after) if (e.kind === "red" && before.indexOf(e.id) < 0) rid = e.id;
    } catch (e) { console.log("   [I 红参照] spawnEnemy 不可用：" + e.message); }
    if (rid !== null) {
      await dbg("setHitstop", [600]); await sleep(60);
      const er = await enemyById(rid);
      const cxR = er ? er.x : 200;
      const AR1 = await crop.apply(null, winOf(cxR, WIN_Y0, WIN_Y1, WIN_HALF));
      const wantR = await lampPix(150); /* 红窗 [cxR±70] 内唯一环境灯（lx=150，箱 [124,176]×[385,437]）；冻结态读 */
      /* R8：击杀离场 → 灯相位对齐封冻 → 同窗同冻成对抓 → 静默预检（灯箱差=0 ∧ |B1−B2|≤64css，
         不过则整对重抓 ≤4）。目的：消除灯污染对红参照掩膜高度（hRatio 分母）的抬升。 */
      await dbg("setHitstop", [0]);
      await dbg("enemyHit", [rid, 99]);
      const rGone = await until(async () => !(await enemyById(rid)), 2500);
      if (!rGone) console.log("   [R8 离场法:I-red] 击杀后 2.5s 红参照未消失——掩膜可能含残影");
      let BR1 = null, BR2 = null, rpNoise = -1, rBox = -1, rAligned = false, rMF = -1;
      const RP_LIM = BP_NOISE_MAX_CSS * AR1.k * AR1.k;
      for (let bp = 1; bp <= 4; bp++) {
        rAligned = false;
        const tR0 = Date.now();
        while (Date.now() - tR0 < 3400) { /* 相位周期 2π/2.3≈2.73s ⇒ 必达 */
          const nowR = await lampPix(150);
          if (rgbNear(nowR, wantR, 2)) { rAligned = true; break; }
          await sleep(35);
        }
        await dbg("setHitstop", [600]); await sleep(120);
        BR1 = await crop.apply(null, winOf(cxR, WIN_Y0, WIN_Y1, WIN_HALF));
        await sleep(220);
        BR2 = await crop.apply(null, winOf(cxR, WIN_Y0, WIN_Y1, WIN_HALF));
        rpNoise = changedCount(BR1, BR2);
        rBox = lampBoxDiff(AR1, BR1, Math.max(0, Math.round(cxR - WIN_HALF)), [[142, 391, 182, 431]]); /* R11：灯箱按实位（150+layOffM=162） */
        const tRMC = maskClean(AR1, BR1, BR2); const tRR = analyze(AR1, tRMC.m);
        rMF = tRR.mainFrac;
        MCR = tRMC; RR = tRR; /* 本对结果保留：验收通过即用、用尽沿用（R11，同精英段） */
        if (rBox === 0 && rpNoise <= RP_LIM && rMF >= 0.95) break;
        console.log("   [R8 静默预检:I-red] 第" + bp + "对 灯箱差=" + rBox + "px（须 0）· |B1−B2|=" + rpNoise + "px · mainFrac=" + (rMF * 100).toFixed(1) + "%（须 ≥95）· 对齐=" + rAligned + " ⇒ 整对重抓");
        await dbg("setHitstop", [0]); await sleep(400);
      }
      if (!(rBox === 0 && rpNoise <= RP_LIM && rMF >= 0.95)) console.log("   [R8 静默预检:I-red] 重试用尽——沿用最后一对（几何类报告可能含残余噪声，附日志）");
      await dbg("setHitstop", [0]);
      /* R7：红参照击杀已提前至 B 对前（原「enemyHit(rid,99) 末置清理」句删除；防误伤目的已由提前击杀达成） */
      if (RA && RA.area && RR && RR.area) {
        const s64 = hconcat([scaleRegion(A1.data, A1.w, RA.bx0, RA.by0, RA.bw, RA.bh, 64), maskToRGB(MC.m, A1.w, RA.bx0, RA.by0, RA.bw, RA.bh, 64)], 6);
        writePNG(SHOTP + "sil64-amber.png", s64.w, s64.h, s64.buf);
        const r64 = hconcat([scaleRegion(AR1.data, AR1.w, RR.bx0, RR.by0, RR.bw, RR.bh, 64), maskToRGB(MCR.m, AR1.w, RR.bx0, RR.by0, RR.bw, RR.bh, 64)], 6);
        writePNG(SHOTP + "sil64-red.png", r64.w, r64.h, r64.buf);
        /* R11 存证：红参照 A/B/掩膜 三张整窗 PNG ＋ 连通 top5 */
        writePNG(SHOTP + "r11-AR1-red.png", AR1.w, AR1.h, rgbaToRGBFull(AR1.data, AR1.w, AR1.h).buf);
        writePNG(SHOTP + "r11-BR1-red.png", BR1.w, BR1.h, rgbaToRGBFull(BR1.data, BR1.w, BR1.h).buf);
        writePNG(SHOTP + "r11-MCR-red.png", AR1.w, AR1.h, maskToRGBFull(MCR.m, AR1.w, AR1.h).buf);
        console.log("   [R11 存证:I-red] r11-AR1/BR1/MCR-red.png · compTop5=" + JSON.stringify(RR.compTop5) + " · main bbox=(" + [RR.mBx0, RR.mBy0, RR.mBx1, RR.mBy1].join(",") + ") " + RR.mBw + "×" + RR.mBh);
      }
    }
    /* R7：白环段前补精英——B 对（离场法）已用掉原精英；C/D/E/M/F/G 行 eliteInfo() 亦依此活体。
       740 与白环「flick 695 侧」（740−45）注释吻合 */
    await page.evaluate(() => window.__game.debug.spawnEnemy("elite", 740));
    await sleep(450);
    /* 白环：wind 冻结帧（玩家 900 → flick 695 侧=侧向 T3 的反侧规则） */
    const elW = await eliteInfo();
    if (elW) {
      const sideW = -1; /* 精英在 740 钉位 ⇒ 朝左 flick */
      const awayW = awayX(elW.x, sideW);
      const fr = await flickFreeze(elW.id, sideW, awayW, 300);
      if (fr.ok && fr.st === "wind") {
        const AW = await crop.apply(null, winOf(fr.frozenX, WHITE_Y0, WHITE_Y1, WHITE_HALF));
        whiteN = exactColor(AW, 255, 255, 255).n;
        await dbg("setHitstop", [0]);
        await sleep(600); /* wind 收尾（strike 打空） */
      } else {
        await dbg("setHitstop", [0]);
        iOkParts.push("白环窗未取到：" + JSON.stringify(fr));
      }
    } else iOkParts.push("白环窗前精英消失");
    const hRatio = (RA && RR && RA.mBh > 0 && RR.mBh > 0) ? RA.mBh / RR.mBh : -1;
    const iOk = !!RA && !!RR && RA.area > 0 && RR.area > 0 &&
      css(amberExact) >= 80 && amberOut === 0 && RA.mainFrac >= 0.95 && hRatio >= 1.15 && css(whiteN) >= 100;
    report("G15.I 视觉（#ffb040/连通/高度/白环）", iOk,
      "精确 amber=" + Math.round(css(amberExact)) + "css²(≥80) 框外=" + amberOut + "(=0) 主连通=" + (RA ? (RA.mainFrac * 100).toFixed(1) : "?") + "%(≥95) 高比=" + (hRatio >= 0 ? hRatio.toFixed(2) : "?") + "(≥1.15) 白=" + Math.round(css(whiteN)) + "css²(≥100) · 面积 E/R=" + (RA ? RA.area : "?") + "/" + (RR ? RR.area : "?") + " selfNoise=" + (RA ? changedCount(A1, A2) : "?") + " 白对照(A帧)=" + Math.round(css(whiteCtl)) + (iOkParts.length ? (" · " + iOkParts.join(";")) : ""));
  }

  /* ---------- C 行：霸体（wind 中打） ---------- */
  const elC = await eliteInfo();
  let cOk = false, cDet = "无精英（红侧预期）";
  if (elC) {
    await waitStateIn(elC.id, ["chase", "patrol"], 3000);
    const side = pickSide(elC.x);
    const fr = await flick(elC.id, side, awayX(elC.x, side), false);
    if (fr.ok) {
      const hp0 = (await enemyById(elC.id)) ? (await enemyById(elC.id)).hp : -1;
      await sleep(120);
      await dbg("enemyHit", [elC.id, 6]);
      const tr = await traceElite(elC.id, 1400, 12);
      const states = tr.filter(s => s.st).map(s => s.st);
      const sawWind = states.indexOf("wind") >= 0;
      const sawStrike = states.indexOf("strike") >= 0;
      const sawHit = states.indexOf("hit") >= 0;
      const e1 = await enemyById(elC.id);
      cOk = sawWind && sawStrike && !sawHit && !!e1 && e1.hp === hp0 - 6;
      cDet = "wind=" + sawWind + " strike=" + sawStrike + " hit态=" + sawHit + " hp " + hp0 + "→" + (e1 ? e1.hp : "?") + "（须 −6）";
    } else cDet = "flick 失败：" + JSON.stringify(fr);
  }
  report("G15.C 霸体（wind 中受击不停手）", cOk, cDet);
  const elC2 = await eliteInfo(); if (elC2) await park(neutralX(elC2.x));

  /* ---------- D 行：struck 不泄漏（strike 中打，同一次 strike 仍命中玩家） ---------- */
  const elD = await eliteInfo();
  let dOk = false, dDet = "无精英（红侧预期）";
  if (elD) {
    await waitStateIn(elD.id, ["chase", "patrol"], 3000);
    const side = pickSide(elD.x);
    const fr = await flick(elD.id, side, awayX(elD.x, side), true /* stay */);
    if (fr.ok) {
      const hp0 = (await playerInfo()).hp;
      const eh0 = (await enemyById(elD.id)).hp;
      const trP = traceElite(elD.id, 1600, 12);
      /* R11-M4 强化（受击窗口前移；判据行零变化）：原协议玩家贴脸 45px（|45−26|=19<36）⇒ strike 首帧即结伤、
         struck 被 :497 锁死 ⇒ 注入的受击恒在命中之后 ⇒ 「strike 中受击不改命中」从未被检验（M4 副本因此绿）。
         法：flick(stay) 返回时 elite 在 wind（windup 0.65s，wind 中前移 0.6×spd=60px/s）⇒ 先移玩家至
         fr.windX+side*130（wind 全程 39px 前移后 strike 起始 blade 距 ≈65px、注入时刻 ≥55px，均 >36 ⇒
         strike 起始与注入时未结伤、struck 保持 false）⇒ 等 strike ⇒ 注入受击（M4：struck 被无守卫置 true
         ⇒ 将至的命中被吞；正树：applyHit 对 elite 不碰 struck）⇒ 回位 side*45（blade 距 19<36 ⇒ 正树触及、
         结伤恰一次）。 */
      await dbg("setPlayerPos", [fr.windX + side * 130, 470]);
      const sStrike = await waitStateIn(elD.id, ["strike"], 1500);
      if (sStrike) {
        await dbg("enemyHit", [elD.id, 6]);
        await dbg("setPlayerPos", [sStrike.x + side * 45, 470]);
      }
      const tr = await trP;
      const hp1 = (await playerInfo()).hp;
      const e1 = await enemyById(elD.id);
      const states = tr.filter(s => s.st).map(s => s.st);
      const okSeq = states.indexOf("strike") >= 0 && states.lastIndexOf("rec") > states.indexOf("strike");
      dOk = !!sStrike && (hp0 - hp1 === 18) && !!e1 && e1.hp === eh0 - 6 && okSeq;
      dDet = "玩家 hp " + hp0 + "→" + hp1 + "（须 −18 恰一次）· 精英 hp " + eh0 + "→" + (e1 ? e1.hp : "?") + "（须 −6）· strike→rec=" + okSeq + " strike锁=" + !!sStrike;
    } else dDet = "flick 失败：" + JSON.stringify(fr);
  }
  report("G15.D struck 不泄漏（strike 中受击不改命中）", dOk, dDet);
  { const e = await eliteInfo(); if (e) await park(neutralX(e.x)); }

  /* ---------- E 行：后仰 + 负控 ---------- */
  const elE = await eliteInfo();
  let eOk = false, eDet = "无精英（红侧预期）";
  if (elE) {
    /* 负控：无受击 rec 前 0.3s 前滑 ≤1px */
    await waitStateIn(elE.id, ["chase", "patrol"], 3000);
    let side = pickSide(elE.x);
    let fr = await flick(elE.id, side, awayX(elE.x, side), false);
    let deltaN = -1;
    if (fr.ok) {
      const sRec = await waitStateIn(elE.id, ["rec"], 1300);
      if (sRec) {
        const x0 = sRec.x;
        await sleep(300);
        const e300 = await enemyById(elE.id);
        deltaN = e300 ? Math.abs(e300.x - x0) : -1;
      }
    }
    /* 受击：rec 中 enemyHit ⇒ 位移 ≥2px 且背离玩家 */
    await waitStateIn(elE.id, ["chase", "patrol"], 3000);
    side = pickSide((await enemyById(elE.id)).x);
    fr = await flick(elE.id, side, awayX((await enemyById(elE.id)).x, side), false);
    let deltaH = -1, dirOk = false;
    if (fr.ok) {
      const sRec = await waitStateIn(elE.id, ["rec"], 1300);
      if (sRec) {
        const p = await playerInfo();
        const sgn = (sRec.x >= p.x) ? 1 : -1;
        await dbg("enemyHit", [elE.id, 6]);
        const tr = await traceElite(elE.id, 420, 10);
        const xs = tr.filter(s => typeof s.x === "number");
        if (xs.length > 2) { deltaH = (xs[xs.length - 1].x - xs[0].x) * 1; dirOk = (sgn * deltaH) >= 2; }
      }
    }
    eOk = deltaN >= 0 && deltaN <= 1 && dirOk;
    eDet = "负控 Δ0.3s=" + (deltaN < 0 ? "未取到" : deltaN.toFixed(1) + "px（≤1）") + " · 受击 Δ=​" + (deltaH === -1 ? "未取到" : deltaH.toFixed(1) + "px 背离=" + dirOk + "（≥2 且背离玩家）");
  }
  report("G15.E 后仰（rec 受击位移+负控）", eOk, eDet);
  { const e = await eliteInfo(); if (e) await park(neutralX(e.x)); }

  /* ---------- M 行：风压 wind Δx ≥8px ---------- */
  const elM = await eliteInfo();
  let mOk = false, mDet = "无精英（红侧预期）";
  if (elM) {
    await waitStateIn(elM.id, ["chase", "patrol"], 3000);
    const cur = await enemyById(elM.id);
    /* R8：侧向按「风向前进余量」取大者——wind 期间 x+=dir*spd*0.6*dt，风向侧顶停步带壁（箱面前后
       20px 钉位）时位移被 clamp（P2b 实测 7.6px<8 假红）；判据 mOk=dx>=8 与阈值不动。 */
    const rw = await (async () => {
      const plats = (await st()).plats || []; let L = 24, R = 936;
      for (const p of plats) { const b0 = p.x - 20, b1 = p.x + p.w + 20;
        if (b1 <= cur.x && b1 > L) L = b1; if (b0 >= cur.x && b0 < R) R = b0; }
      return { left: cur.x - L, right: R - cur.x };
    })();
    const side = (rw.right >= rw.left) ? 1 : -1;
    console.log("   [R8 M 行侧向] cur.x=" + cur.x.toFixed(1) + " 余量 L/R=" + rw.left.toFixed(0) + "/" + rw.right.toFixed(0) + " ⇒ side=" + side);
    const fr = await flick(elM.id, side, awayX(cur.x, side), false);
    if (fr.ok) {
      const tr = await traceElite(elM.id, 1300, 10);
      const w = tr.filter(s => s.st === "wind");
      if (w.length) {
        const dx = Math.abs(w[w.length - 1].x - w[0].x);
        const obsMs = w[w.length - 1].t - w[0].t;
        mOk = dx >= 8;
        mDet = "wind |Δx|=" + dx.toFixed(1) + "px（≥8）· 观测量长=" + obsMs + "ms";
      } else mDet = "1.3s 内未见 wind 采样";
    } else mDet = "flick 失败：" + JSON.stringify(fr);
  }
  report("G15.M 风压（wind 位移 ≥8px）", mOk, mDet);
  { const e = await eliteInfo(); if (e) await park(neutralX(e.x)); }

  /* ---------- F 行：P2 门（hp≤45 ⇒ phase 2 + elite_enrage） ---------- */
  const elF = await eliteInfo();
  let fOk = false, fDet = "无精英（红侧预期）";
  if (elF) {
    const hp0 = (await enemyById(elF.id)).hp;
    const nTrP = narrTrace(2000, 30);
    const hpSeq = await page.evaluate((a) => new Promise((res) => {
      const d = window.__game.debug; const S = window.__game.state; const seq = [];
      const findHp = () => { const s = S(); for (let i = 0; i < s.enemies.length; i++) if (s.enemies[i].id === a.id) return s.enemies[i].hp; return -1; };
      let n = 0;
      (function hit() { d.enemyHit(a.id, 6); seq.push(findHp()); if (++n < 5) setTimeout(hit, 90); else res(seq); })();
    }), { id: elF.id });
    const ph2 = await until(async () => { const e = await enemyById(elF.id); return (e && e.phase === 2) ? e : null; }, 1800);
    const nTr = await nTrP;
    const seen = nTr.find(s => s.k === "elite_enrage" && s.c > 0);
    fOk = !!ph2 && !!seen && (await enemyById(elF.id)).hp === 42;
    fDet = "hp " + hp0 + "→" + ((await enemyById(elF.id)) || {}).hp + "（须 42）· phase2=" + !!ph2 + " · elite_enrage=" + (seen ? ("起播@" + seen.t + "ms") : "2s 内未起播") + " · 伤害序列=" + hpSeq.join(">");
  }
  report("G15.F P2 门（hp≤45⇒phase 2+怒旁白）", fOk, fDet);

  /* ---------- G 行：双挥链序 ---------- */
  const elG = await eliteInfo();
  let gOk = false, gDet = "无精英（红侧预期）";
  if (elG) {
    await waitStateIn(elG.id, ["chase", "patrol"], 3500);
    const cur = await enemyById(elG.id);
    if (cur) {
      const side = pickSide(cur.x);
      const fr = await flick(elG.id, side, awayX(cur.x, side), false);
      if (fr.ok) {
        const tr = await traceElite(elG.id, 6000, 100);
        const firstCh1 = tr.findIndex(s => s.ch === 1);
        const strike0 = tr.some((s, i) => i < firstCh1 && s.st === "strike" && s.ch === 0);
        const strike1 = firstCh1 >= 0 && tr.some((s, i) => i > firstCh1 && s.st === "strike" && s.ch === 1);
        const back0 = firstCh1 >= 0 && tr.slice(firstCh1).some(s => s.ch === 0);
        gOk = firstCh1 >= 0 && strike0 && strike1 && back0;
        gDet = "chain1 首见@" + (firstCh1 >= 0 ? tr[firstCh1].t + "ms" : "未") + " · strike@ch0=" + strike0 + " strike@ch1=" + strike1 + " 回 ch0=" + back0 + " · 轨迹=" + tr.filter((s, i) => i % 5 === 0 && s.st).map(s => s.st.replace("patrol", "P").replace("chase", "c").replace("wind", "W").replace("strike", "S").replace("rec", "r").charAt(0) + (s.ch || "")).join("");
      } else gDet = "flick 失败：" + JSON.stringify(fr);
    } else gDet = "chase 等待期精英消失";
  }
  report("G15.G 双挥链序（P2 两连击）", gOk, gDet);

  /* ---------- K 行：复活链（死亡重置 + intro 不复播） ---------- */
  const intro0 = await logCount("elite_intro");
  await dbg("hurtPlayer", [100]);
  const deadS = await until(async () => { const s = await st(); return s.phase === "dead" ? s : null; }, 2500);
  const aliveS = await until(async () => { const s = await st(); return s.phase === "playing" ? s : null; }, 6000);
  const freshE = await until(async () => { const e = await eliteInfo(); return (e && e.hp === 90) ? e : null; }, 8000);
  await sleep(1500);
  const intro1 = await logCount("elite_intro");
  const kOk = !!deadS && !!aliveS && !!freshE && freshE.phase === 1 && (freshE.chain | 0) === 0 && intro0 === 1 && intro1 === 1;
  report("G15.K 复活链（满血/回 P1/intro 不复播）", kOk,
    "dead=" + !!deadS + " 复活=" + !!aliveS + " · 新精英 " + (freshE ? ("hp=" + freshE.hp + " phase=" + freshE.phase + " chain=" + (freshE.chain | 0)) : "未现") + " · elite_intro log " + intro0 + "→" + intro1 + "（须 1→1）");

  /* ---------- L 行：契约字段 ---------- */
  const lS1 = await st(); await sleep(600); const lS2 = await st();
  const pickL = (s) => {
    const out = { elite: null, others: [] };
    for (const e of (s.enemies || [])) {
      if (e.kind === "elite") out.elite = e;
      else out.others.push(e);
    }
    return out;
  };
  const L1 = pickL(lS1), L2 = pickL(lS2);
  const elNum = (e) => !!e && typeof e.phase === "number" && typeof e.chain === "number";
  const othersOk = (L) => L.others.length > 0 && L.others.every(e => e.phase === 1 && (e.chain | 0) === 0);
  const stable = (a, b) => !!a && !!b && a.phase === b.phase && (a.chain | 0) === (b.chain | 0);
  const lOk = elNum(L1.elite) && elNum(L2.elite) && stable(L1.elite, L2.elite) && othersOk(L1) && othersOk(L2);
  report("G15.L 契约字段（phase/chain 数值、他敌恒 P1）", lOk,
    "精英 phase=" + (L1.elite ? L1.elite.phase : "?") + "/chain=" + (L1.elite ? (L1.elite.chain | 0) : "?") + "（两采一致=" + stable(L1.elite, L2.elite) + "）· 他敌[" + L1.others.map(e => e.kind + ":p" + e.phase + "c" + (e.chain | 0)).join(",") + "]");
  await page.screenshot({ path: SHOTP + "02-k-after.png" });

  /* ---------- 哨兵与汇总 ---------- */
  report("G15.0 全程零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 4).join(" | "));
  const let_ = lettered();
  const passN = let_.filter(r => r.ok).length; /* R14：汇总行双口径标注——红侧预注册口径＝0/13 且 unexpected=0（w7-edits.md §0 对现树的第一判据）；绿侧口径＝13/13。rc 判定与 [PASS]/[FAIL] 行不受本行影响。 */
  const unexpected = passN; /* 红侧口径下的 unexpected（＝任何 PASS）；绿侧口径下该量不适用 */
  if (let_.length !== 13) console.log("!! 字母行计数=" + let_.length + " ≠13（行表残缺，判不出）");
  console.log("G15-DATA I: amber=" + Math.round(amberExact / 4) + "css² out=" + amberOut + " white=" + Math.round(whiteN / 4) + " whiteCtl=" + Math.round(whiteCtl / 4) + " area=" + (RA ? RA.area : -1) + " h=" + (RA ? (RA.bh / 2).toFixed(1) : -1) + " hRed=" + (RR ? (RR.bh / 2).toFixed(1) : -1) + " hMain=" + (RA ? (RA.mBh / 2).toFixed(1) : -1) + " hRedMain=" + (RR ? (RR.mBh / 2).toFixed(1) : -1) + " mainFrac=" + (RA ? RA.mainFrac.toFixed(3) : -1) + " noise=" + (MC ? MC.noise : -1) + " removed=" + (MC ? MC.removed : -1) + " rNoise=" + (MCR ? MCR.noise : -1));
  console.log("G15-DATA H: log=" + (logH1 - logH0) + " fireAt=" + hAbs + "ms");
  const sum = "字母行 PASS " + passN + "/" + let_.length + "（红侧预注册口径：0/13 且 unexpected=0；绿侧口径：13/13）· " +
    (passN === 0 ? "当前=红侧口径达成" : (passN === let_.length ? "当前=绿侧口径达成（13/13）" : "当前=两口径均未达成")) +
    " · unexpectedPASS(红侧口径)=" + unexpected;
  console.log("---- 汇总：" + sum + " ----");
  console.log("GATE gate-15-elite: " + (results.some(r => !r.ok) ? "FAIL" : "PASS"));
  await browser.close().catch(() => {});
  process.exit(results.some(r => !r.ok) ? 1 : 0);
})().catch(e => { console.error("崩溃：" + ((e && e.stack) || e)); process.exit(2); });
