#!/usr/bin/env node
/* 拆台 · GATE-14 damage —— W6.1 战斗闭环：剑气/居合的伤害、受击反应与边界规则
 *
 * 判据（W6.1 契约冻结；红侧预注册＝在 W5.3 定版树（game.js 943ef165…）上 6 红 4 绿：
 *   零伤害行为决定 G14.1–G14.6 全红（Δ=0 / 无受击 / 杀不死）；
 *   G14.7 空挥负控、G14.8 死后不判、G14.9 帧率、G14-0 零错误哨兵在红侧即应绿。
 *   判据非空性由 falsify-g14（M1 剑气伤害归零锚 G14.1 / M2 删防重置位锚 G14.2 /
 *   M3 删居合刀身判定锚 G14.4 / M4 居合击退翻转锚 G14.5）实证。）
 *
 *   G14.1 剑气伤害：一次长按 J 命中红兵 ⇒ hp 30→24（Δ=6 恰）
 *   G14.2 剑气防重：同一次飞行多帧重叠 ⇒ 采样序列只见 1 次掉血（无二次扣除）
 *   G14.3 剑气受击反应：命中瞬间 state="hit"＋击退 vx 同剑气向 ≥80＋flash>0.08
 *   G14.4 居合伤害：冲刺中段 J 近身 ⇒ Δ=12 恰（刀身命中数 iaidoN ≥1；刀身＋随行剑气一刀一结算）
 *   G14.5 居合击退：受击瞬间 state="hit"＋vx ≥150（kx260 初速）＋flash>0.08
 *   G14.6 剑气击杀链：续射至死亡（≤8 发，每发 Δ∈(0,6]）⇒ hp==0 且 state="dead"（无负血）
 *   G14.7 剑气空挥：无敌人场长按 J ⇒ qiActive 出现＋0 pageerror（负控）
 *   G14.8 死后不判：clearWave 造尸＋在飞剑气穿越 ⇒ 尸 hp 恒 0、state 恒 "dead"、不见 "hit"
 *   G14.9 帧率：telemetry p95 ≤17.2（≥58fps）
 *   G14-0 全程 0 pageerror
 *
 * 站位纪律：wave1（序章 W1＝2×红兵 @800/880）由 x>420 触发 ⇒ 空挥探针（G14.7）在 x=190 先跑。
 * 仪器修订 run1→run2（2026-10-16 实测抓出；只动测试站位/时序，判据与阈值一字未改）：
 *   ① 长按 J 附带的普攻可在近距真命中（run1 G14.1 Δ=8 污染）⇒ 剑气站位 170→240px（普攻最大够程≈108px）。
 *   ② 冲刺无敌帧窗口内敌 strike ⇒ perfectDodge 反击 26 伤（run1 G14.4 Δ=26 污染）⇒ 居合前先等敌
 *      state=chase（wind 需 adx<58 才能起，等回 chase 再定位）→ 定位 90px → K ⇒ 60ms ⇒ J；
 *      此时敌 strike 落在 K+≈0.5s ≫ 冲刺无敌帧 0.22s，反击无从触发。
 *   ③ 尸测射距 150→160px 加裕量。
 *   ④ 击杀链带收招兜底（waitChase；正常瞬过——乒乓走位已保证不出 wind）。
 *   ⑤ 入场清机关（clearTraps，gate-10/12「消险」同径惯例；本案序章实测 traps=0，纯防御性保留）。
 *   ⑥ 击杀链走位＝乒乓换侧（run3–run5 假红真根因，诊断实锤 shots/_diag-g14-killer.txt）：
 *      固定「站敌左 240」以 ~118px/s 净漂移（每轮敌追近 ≈ 定位距）⇒ 五六轮后玩家顶死 x=24 左墙、
 *      贴身被 wind→strike 连打致死 ⇒ 死亡清场清敌 ⇒ G14.6「已退场」/G14.8「B 不在场」假红。
 *      改每发跨敌换侧、站距恒 300（W=960：两侧各 300 才交替、只一侧够则强制该侧，恒有解）⇒
 *      有界零漂移、普攻够程 108 外、qi 射程 246（26+220）内。玩家 hp 全程不变＝仪器自证（回执含 玩家hp=a→b）。
 *   ⑦ vxMax 仅采受击态样本（state==="hit"）：绿跑 r1 实测 G14.5 vxMax=400＝红兵自身 strike 突进
 *      （lunge=400；game.js updEnemy :491 wind→strike 置 e.vx、chase 不走 vx）污染采样 ⇒ 归属精修，
 *      判据阈值一字未动（「受击瞬间 vx」更贴判据原文）。红树无 vx 键 ⇒ 红侧回执不受此修订影响。
 * 环境：CHAITAI_URL 换被测对象（默认 file:///D:/2006L/chaitai/index.html）；
 *       CHAITAI_SHOT_PREFIX 截图目录（默认 shots/gate-14/）。
 * exit：0=PASS；1=断言 FAIL（含目标文件不存在）；2=脚本/桥接异常
 */
"use strict";
const fs = require("fs");
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || "file:///D:/2006L/chaitai/index.html";
const ROOT = "D:/2006L/chaitai";
const SHOTS = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/gate-14");

let BROWSER = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
let nItems = 0;
const item = (ok, id, name, detail) => {
  nItems++;
  console.log("  [" + (ok ? "PASS" : "FAIL") + "] " + id + " " + name + (detail ? "  " + detail : ""));
  if (!ok) fails.push(id);
};
const say = (s) => console.log("  [info] " + s);
const finish = (nm) => {
  console.log("---- 汇总：PASS " + (nItems - fails.length) + " FAIL=" + fails.length + " rc=" + (fails.length ? 1 : 0) + " ----");
  console.log("GATE " + nm + ": " + (fails.length ? "FAIL (" + fails.join(",") + ")" : "PASS"));
  process.exit(fails.length ? 1 : 0);
};
const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };

(async () => {
  const nm = "gate-14-damage";
  console.log("== " + nm + " @ " + URL + " ==");
  const file = URL.startsWith("file:///") ? decodeURIComponent(URL.slice(8)).replace(/[?#].*$/, "") : null;
  if (file && !fs.existsSync(file)) {
    console.log("  [FAIL] G14.0 目标文件不存在：" + file);
    fails.push("G14.0"); finish(nm); return;
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  BROWSER = await puppeteer.launch({
    executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"],
  });
  const p = await BROWSER.newPage();
  const pageErrs = [];
  p.on("pageerror", (e) => pageErrs.push(String((e && e.message) || e)));
  p.on("console", (m) => { if (m.type() === "error") say("console error（不计入断言）：" + m.text()); });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: "load" });

  const st = () => p.evaluate(() => window.__game.state());
  const waitPhase = async (ph, ms) => {
    try { await p.waitForFunction('window.__game && window.__game.state().phase === ' + JSON.stringify(ph), { timeout: ms }); return true; }
    catch (e) { return false; }
  };
  /* 页内监视：fnBody 表达式首次为真 ⇒ 返回毫秒数；超时 ⇒ -1（同 gate-13） */
  const watchFn = (fnBody, ms) => p.evaluate((fnBody, ms) => new Promise((res) => {
    let f; try { f = new Function("return (" + fnBody + ")"); } catch (e) { f = function () { return false; }; }
    const t0 = performance.now();
    (function tick() {
      let v = false; try { v = !!f(); } catch (e) { v = false; }
      if (v) return res(Math.round(performance.now() - t0));
      if (performance.now() - t0 > ms) return res(-1);
      setTimeout(tick, 8);
    })();
  }), fnBody, ms);
  /* 页内序列采样：每 step ms 取一次 fnBody 表达式值（对象/ null 原样）；时长 ms */
  const trace = (fnBody, ms, step) => p.evaluate((fnBody, ms, step) => new Promise((res) => {
    let f; try { f = new Function("return (" + fnBody + ")"); } catch (e) { f = function () { return null; }; }
    const out = []; const t0 = performance.now();
    (function tick() {
      let v = null; try { v = f(); } catch (e) { v = null; }
      out.push(v);
      if (performance.now() - t0 < ms) setTimeout(tick, step); else res(out);
    })();
  }), fnBody, ms, step);

  let hooked = true;
  try { await p.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 20000 }); }
  catch (e) { hooked = false; }
  await sleep(700);
  if (!hooked) {
    console.log("  [FAIL] G14.0 window.__game 20s 没等到");
    fails.push("G14.0"); await BROWSER.close(); finish(nm); return;
  }
  await p.keyboard.press("Enter");
  const started = await waitPhase("playing", 3500);
  say("入局 playing=" + started);
  await sleep(400);
  await p.evaluate(() => { if (window.__game.debug.setPlayerX) window.__game.debug.setPlayerX(190); });
  await sleep(500);

  /* ---------- G14.7 剑气空挥负控（无敌人场，x=190 < 420 不触发 wave1） ---------- */
  const errs0 = pageErrs.length;
  await p.keyboard.down("KeyJ");
  const q0 = await watchFn("(window.__game.state().dyn||{}).qiActive===true", 1600);
  await p.keyboard.up("KeyJ");
  await sleep(650); /* 剑气飞完消散 */
  item(q0 >= 0 && pageErrs.length === errs0, "G14.7", "剑气空挥：无敌人场长按 J ⇒ qiActive 出现（负控）",
    "qi 出现=" + (q0 >= 0 ? q0 + "ms" : "未观测（1.6s 内）") + " 期间 pageerror=" + (pageErrs.length - errs0));

  /* ---------- 触发 wave1（2×红兵 @800/880） ---------- */
  await p.keyboard.down("KeyD");
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      const s = await st();
      if (s.wave >= 1 || (s.enemies && s.enemies.length >= 2)) break;
      await sleep(90);
    }
    await p.keyboard.up("KeyD"); await sleep(250);
  }
  /* run1 仪器修订⑥：清机关（gate-10/12 消险同径惯例）——灯带 x∈[60,900] 横扫全场地、y>450 必中，
     站桩测会被反复打 12（同帧 1s 无敌限速）⇒ 玩家 hp 漂移甚至死亡清场（run3/run4 假红真根因） */
  { const t0 = (await st()).traps.length;
    await p.evaluate(() => window.__game.debug.clearTraps());
    const t1 = (await st()).traps.length;
    say("traps 消险：" + t0 + "→" + t1 + "（灯带/落物/压板全清）"); }
  const sW = await st();
  const es0 = (sW.enemies || []).slice().sort((a, b) => a.x - b.x);
  say("wave1 触发：" + (sW.wave >= 1) + " 敌=" + es0.length + " " + es0.map((e) => e.id + ":" + e.kind + "@" + e.x).join(" "));
  if (es0.length < 2) {
    item(false, "G14.1", "wave1 供体到场（2 红兵）", "敌=" + es0.length + " ⇒ 无法开测");
    item(false, "G14.2", "（级联）", "-");
    item(false, "G14.3", "（级联）", "-");
    item(false, "G14.4", "（级联）", "-");
    item(false, "G14.5", "（级联）", "-");
    item(false, "G14.6", "（级联）", "-");
    item(false, "G14.8", "（级联）", "-");
    item(pageErrs.length === 0, "G14-0", "全程 0 pageerror", pageErrs.slice(0, 3).join(" | "));
    await BROWSER.close(); finish(nm); return;
  }
  const eA = es0[0], eB = es0[1]; /* A=左、B=右；A 走剑气链、B 走居合 */
  const hpOf = async (id) => { const s = await st(); for (const e of (s.enemies || [])) if (e.id === id) return e; return null; };
  const placeAt = async (x) => { await p.evaluate((x) => window.__game.debug.setPlayerPos(x, 470), x); await sleep(120); };
  const faceRight = async () => { await p.keyboard.down("KeyD"); await sleep(70); await p.keyboard.up("KeyD"); };
  const faceLeft = async () => { await p.keyboard.down("KeyA"); await sleep(70); await p.keyboard.up("KeyA"); };
  /* 等敌回到 chase 态（wind/strike/rec 中不定位；run1 仪器修订②） */
  const waitChase = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = await hpOf(id); if (!e || e.state === "chase") return true; await sleep(55); } return false; };
  const probeFor = (id) => "(function(){var s=window.__game.state();for(var i=0;i<s.enemies.length;i++){var e=s.enemies[i];if(e.id===" + id + ")return{hp:e.hp,state:e.state,vx:(e.vx==null?-999:e.vx),flash:(e.flash||0),n:((s.dyn||{}).iaidoN||0)};}return null;})()";
  /* 采样序列 → {hpSeq(含首值), drops(掉血事件数), sawHit, vxMax, sawFlash, nMax} */
  const analyze = (startHp, tr) => {
    const rows = tr.filter(Boolean);
    const hpSeq = [startHp].concat(rows.map((r) => r.hp));
    let drops = 0;
    for (let i = 1; i < hpSeq.length; i++) if (hpSeq[i] < hpSeq[i - 1]) drops++;
    let vxMax = -999, nMax = 0, sawHit = false, sawFlash = false;
    for (const r of rows) {
      if (num(r.n, 0) > nMax) nMax = num(r.n, 0);
      if (r.state === "hit") { sawHit = true; /* 修订⑦：vx 仅采受击态样本（敌自身 strike 突进 lunge=400 不算受击——game.js:491 污染实证） */
        const v = num(r.vx, -999); if (v > vxMax) vxMax = v; }
      if (num(r.flash, 0) > 0.08) sawFlash = true;
    }
    return { hpEnd: hpSeq[hpSeq.length - 1], hpMin: Math.min.apply(null, hpSeq), drops, vxMax, nMax, sawHit, sawFlash, nSamp: rows.length };
  };

  /* ---------- G14.1/G14.2/G14.3 剑气一发命中 A ---------- */
  let sA = await hpOf(eA.id);
  await placeAt(sA.x - 240); /* 240：普攻最大够程≈108 之外，长按 J 附带的普攻不可命中（run1 仪器修订①） */
  await faceRight();
  const tr1P = trace(probeFor(eA.id), 1400, 10);
  await p.keyboard.down("KeyJ");
  const q1 = await watchFn("(window.__game.state().dyn||{}).qiActive===true", 1600);
  await p.keyboard.up("KeyJ");
  const tr1 = await tr1P;
  const a1 = analyze(sA.hp, tr1);
  const d1 = sA.hp - a1.hpEnd;
  item(q1 >= 0 && d1 === 6 && a1.hpMin === sA.hp - 6 && a1.hpMin >= 0, "G14.1",
    "剑气伤害：一发命中红兵 ⇒ Δ=6 恰",
    "hp " + sA.hp + "→" + a1.hpEnd + "（Δ=" + d1 + "） qi出现=" + (q1 >= 0 ? q1 + "ms" : "未观测"));
  item(d1 === 6 && a1.drops === 1, "G14.2",
    "剑气防重：同一次飞行多帧重叠 ⇒ 仅 1 次掉血",
    "掉血事件=" + a1.drops + "（采样 " + a1.nSamp + " 点） 序列尾=[" + tr1.filter(Boolean).slice(-4).map((r) => r.hp).join(",") + "]");
  item(a1.sawHit && a1.vxMax >= 80 && a1.sawFlash, "G14.3",
    "剑气受击反应：state=hit＋击退 vx≥80（同剑气向）＋flash>0.08",
    "state=hit 见=" + a1.sawHit + " vxMax=" + a1.vxMax + " flash见=" + a1.sawFlash);

  /* ---------- G14.4/G14.5 居合打 B（先面向、后定位、冲刺中段 J） ---------- */
  let sB = await hpOf(eB.id);
  await faceRight();
  await waitChase(eB.id, 2500); /* run1 仪器修订②：等敌回 chase 再定位，冲刺无敌帧不再撞上敌 strike（防 perfectDodge 反击 26 污染） */
  sB = (await hpOf(eB.id)) || sB; /* 等 chase 期间敌会移动 ⇒ 按最新位置定位 */
  await placeAt(sB.x - 90);
  const trBP = trace(probeFor(eB.id), 1300, 10);
  await p.keyboard.press("KeyK");
  await sleep(60);
  await p.keyboard.press("KeyJ");
  const trB = await trBP;
  const aB = analyze(sB.hp, trB);
  const dB = sB.hp - aB.hpEnd;
  await p.screenshot({ path: path.join(SHOTS, "gate-14-01-iaido.png") }).catch(() => {});
  item(dB === 12 && aB.nMax >= 1 && aB.hpMin >= 0, "G14.4",
    "居合伤害：冲刺中段 J 近身 ⇒ Δ=12 恰（刀身 iaidoN≥1）",
    "hp " + sB.hp + "→" + aB.hpEnd + "（Δ=" + dB + "） iaidoN=" + aB.nMax);
  item(aB.sawHit && aB.vxMax >= 150 && aB.sawFlash, "G14.5",
    "居合击退：state=hit＋vx≥150（kx260 初速）＋flash>0.08",
    "state=hit 见=" + aB.sawHit + " vxMax=" + aB.vxMax + " flash见=" + aB.sawFlash);

  /* ---------- G14.6 剑气击杀链（A 续射至死；≤8 发，每发 Δ∈(0,6]；负血=无） ----------
     走位＝乒乓放风筝（修订⑦，诊断实锤后定）：固定侧位以 ~118px/s 净漂移（敌每轮追近 ≈ 定位距）⇒
     五六轮后玩家顶死 x=24 左墙、被贴身 wind→strike 连打致死（探针 shots/_diag-g14-killer.txt：
     px 360→24、8.78s@x24 被 1@73:strike 打掉 100→82、15.32s 死、17.5s wave 重生 id3/4）。
     乒乓＝每发放完跨敌换侧、站距恒 300（W=960 单屏：两侧各有 300 才交替，只一侧够则强制该侧——
     两候选恒至少一侧成立 ⇒ 站距永远 300、位置有界零漂移；收招 waitChase 作兜底）。
     300 的靶心：普攻够程 108 外（J 按下时敌 ≈191）、qi 射程 26+220=246 内（qi 生成时敌 ≈133）。 */
  let shots = 0, killed = false, badShot = null, hpMinSeen = Infinity, lastHp = null;
  let cur = await hpOf(eA.id);
  let side = 0; /* -1=站 A 左（向右射）、+1=站 A 右（向左射）——记录用 */
  const pickX = (ex, bx, px) => { const okL = (ex - 300) >= 70, okR = (ex + 300) <= 890;
    /* 侧偏好＝跨到 B 的反侧（B 追着玩家 ⇒ 与乒乓换侧同向；且 B 恒被放风筝在 ≥200：
       B 蹲 [58,108] 带会被长按 J 的普攻蹭死——run6 G14.8「B 不在场」的真因） */
    let want = (bx != null) ? ((bx <= ex) ? 1 : -1) : ((px <= ex) ? -1 : 1);
    const okWant = (want === -1) ? okL : okR;
    side = okWant ? want : (okL ? -1 : 1);
    return ex + side * 300; };
  const hpP0 = (await st()).player.hp; /* 玩家血量取证：链中玩家应零伤（hp 不变＝仪器干净的硬证据） */
  { const eB0 = await hpOf(eB.id); if (cur) await placeAt(pickX(cur.x, eB0 && eB0.x, (await st()).player.x)); } /* 首轮定位（乒乓体系入轨） */
  while (shots < 8 && cur && cur.hp > 0) {
    const before = cur.hp;
    await waitChase(eA.id, 1500); /* 收招兜底（正常瞬过） */
    cur = (await hpOf(eA.id)) || cur;
    if (!cur) break;
    const s1 = await st();
    if (cur.x > s1.player.x) await faceRight(); else await faceLeft();
    await p.keyboard.down("KeyJ");
    const qw = await watchFn("(window.__game.state().dyn||{}).qiActive===true", 1600);
    await p.keyboard.up("KeyJ");
    { const eN = await hpOf(eA.id); const bN = await hpOf(eB.id);
      if (eN) { const sP = await st(); await placeAt(pickX(eN.x, bN && bN.x, sP.player.x)); } } /* 跨敌换侧（乒乓核心，B 反侧偏好） */
    await sleep(650);
    if (qw < 0 && shots === 0) { badShot = "首发射不出（qi 未出现）"; break; }
    cur = await hpOf(eA.id);
    shots++;
    if (cur) { if (cur.hp < hpMinSeen) hpMinSeen = cur.hp; lastHp = cur.hp;
      const d = before - cur.hp;
      if (!(d > 0 && d <= 6)) badShot = "第" + shots + "发 Δ=" + d + "（需 ∈(0,6]）";
      if (cur.hp <= 0) { killed = cur.state === "dead"; break; }
    } else { killed = true; hpMinSeen = Math.min(hpMinSeen, 0); break; } /* 尸体 0.6s 退场 ⇒ 已死且结算完成 */
  }
  const hpP1 = (await st()).player.hp;
  item(killed && shots <= 8 && badShot === null && hpMinSeen >= 0, "G14.6",
    "剑气击杀链：续射至死亡（≤8 发，每发 Δ∈(0,6]）",
    "发数=" + shots + " 终态=" + (cur ? (cur.hp + "/" + cur.state) : "已退场") + " minHP=" + (hpMinSeen === Infinity ? "n/a" : hpMinSeen)
    + " 玩家hp=" + hpP0 + "→" + hpP1
    + (badShot ? " 异常：" + badShot : ""));

  /* ---------- G14.8 死后不判（clearWave 造尸＋在飞剑气穿越） ---------- */
  let sB2 = await hpOf(eB.id);
  let corpseOk = false, detail8 = "（无供体）";
  { const t0 = (await st()).traps.length;
    if (t0) { await p.evaluate(() => window.__game.debug.clearTraps()); say("traps 再清：" + t0 + "→0"); } }
  if (!sB2) { /* 供体降级：B 若在链中退场（绿树被穿透剑气蹭死的最坏情况）⇒ 取任一生者；仍无 ⇒ startAct(1) 快径重开序章（gate-10 同径）*/
    const sNow = await st(); sB2 = (sNow.enemies || [])[0] || null;
    if (sB2) say("G14.8 供体：B 已退场 ⇒ 改用 " + sB2.id + "@" + Math.round(sB2.x));
    else {
      say("G14.8 供体：全场已清 ⇒ startAct(1) 重开序章第一镜");
      await p.evaluate(() => window.__game.debug.startAct(1));
      await sleep(400);
      for (let k = 0; k < 8 && !sB2; k++) {
        const s = await st(); sB2 = (s.enemies || [])[0] || null;
        if (!sB2) { await p.keyboard.down("KeyD"); await sleep(400); await p.keyboard.up("KeyD"); await sleep(200); }
      }
      if (sB2) say("G14.8 供体：重开得 " + sB2.id + "@" + Math.round(sB2.x));
    }
  }
  if (sB2) {
    await placeAt(sB2.x - 160);
    await faceRight();
    await p.keyboard.down("KeyJ");
    const q8 = await watchFn("(window.__game.state().dyn||{}).qiActive===true", 1600);
    await p.evaluate(() => window.__game.debug.clearWave());
    await p.keyboard.up("KeyJ");
    const tr8P = trace(probeFor(sB2.id), 700, 10); /* 探针跟供体 id（正常路径 sB2.id===eB.id；降级路径亦正确） */
    const tr8 = await tr8P;
    const rows8 = tr8.filter(Boolean);
    const anyLive = rows8.some((r) => r.hp !== 0 || r.state !== "dead");
    corpseOk = q8 >= 0 && rows8.length >= 10 && !anyLive;
    detail8 = "qi出现=" + (q8 >= 0 ? q8 + "ms" : "未观测") + " 尸样本=" + rows8.length
      + " 违例=" + (anyLive ? "尸被改判（hp/state 变）" : "0");
  } else { corpseOk = false; }
  item(corpseOk, "G14.8", "死后不判：在飞剑气穿越尸体 ⇒ hp 恒 0、state 恒 dead",
    detail8);
  await p.screenshot({ path: path.join(SHOTS, "gate-14-02-corpse.png") }).catch(() => {});

  /* ---------- G14.9 帧率 ---------- */
  await sleep(500);
  const tm = await p.evaluate(() => { try { return window.__game.debug.telemetry(); } catch (e) { return null; } });
  const p95 = tm && typeof tm.frameP95Ms === "number" ? tm.frameP95Ms : -1;
  item(p95 >= 0 && p95 <= 17.2, "G14.9", "帧率：p95 ≤17.2ms（≥58fps）",
    "frameP95Ms=" + p95 + " frames=" + (tm && tm.frameCount) + "（全程含 q 命中/居合窗口）");

  item(pageErrs.length === 0, "G14-0", "全程 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  say("截图：" + SHOTS + "/gate-14-0*.png");
  await BROWSER.close();
  finish(nm);
})().catch(async (e) => {
  console.log("  [FAIL] G14.EX 脚本/桥接异常：" + ((e && e.stack) || e));
  console.log("GATE gate-14-damage: FAIL (EX)");
  try { if (BROWSER) await BROWSER.close(); } catch (_) {}
  process.exit(2);
});
