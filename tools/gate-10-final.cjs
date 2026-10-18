/* gate-10-final.cjs —— 终幕·杀青（v0.2 W4 接线）：Boss 上 T3＋三阶段招序＋结局 a–d＋杀青卡（d2 §6/§7、d3、d7）
   断言链（全部走真实输入/真实流程，只读 state；出生值断 lastSpawn.born；Boss 阶段推进走 debug.bossDamage（=真 hitBoss 链））：
   G10.0 注册表基线：ACTS[5].playable、endings≥5 且含 end_a..d＋配方、act5 检查点 11 条全 live、mechanicsMustFire 含 act5
   G10.P 完整模式：全梯（序章→一二三幕→第三幕终）→ act4-hold：continueReady=true、▶ 上屏（W4 翻面点；红侧应红于此）
   G10.1 按 J 进终幕：act=5、幕卡「终幕 · 杀青」、cp=act4_open、plats＝T1/T2/T3 三件 deep-equal、cleared 复位、▶/⟳ 全收
   G10.2 Boss 入场（≤4.5s）：active、arena=boss、hp=maxHp=120、y≈300（站 T3 顶）、x=828、narr=idle、cp=a4_p1、cpLog 序含 boss_intro→a4_p1、log 含 boss_intro
   G10.3 p1 招序：抓包（轮询 traps 记录后清险）见 press＋lamp；lamp.T===4.2
   G10.4 命中带（核心「必须上 T3」）：地面挥（x=700）Boss 不落血；上 T3（贴脸 boss.x−43、抢在 melee 落锤前）挥 ⇒ hp 120→112（step1=8；被抢拍重试 ≤3、php<40 弃测）
   G10.5 p2 门：hp≤80 ⇒ phase=2、cp=a4_p2、log boss_half、2 红 once 生成（60/150）；清兵负控：清后 700ms 无清场链副作用（encPhase 仍 idle、actHold false）
   G10.6 p3 门：hp≤40 ⇒ phase=3、cp=a4_p3、log boss_low、narr=enraged
   G10.7 p3 招序：清空后抓包见 press＋drop＋lamp；drop 含 T3 点 x≈828、含错峰 lead≥0.9
   G10.8 零血：bossDefeat：dead、state=down、cp=a4_down、log boss_defeat、灯带收净（traps 无 lamp）
   G10.9 spare 窗口（defeat+2.2s）：spare.open、cp=a4_choice、log spare_prompt
   G10.10 结局 a 配方（零死亡收手）：deaths===0＋静候满窗 ⇒ ending=end_a、ended 含 end_a、cp=end_a、log spare_taken（无 finish_taken）
   G10.11 墙压 y 带（W4 修）：地面 spawnPress ⇒ −20；T3 顶（y=300）spawnPress ⇒ 零伤
   G10.12 分镜连发→仪式→杀青卡：ending_a 连发恰 5 档（log 计数）、ceremony 出现、staging.card、showRestart=true、⟳ 上
   G10.13 R 再拍：act=1、spare/ending/card 清、ended 保留 [end_a]；hurtPlayer 致死 ⇒ deaths=1；三段 b 配方：J 补刀 ⇒ end_b、cp=end_b、log finish_taken
   G10.14 c 配方（有死亡收手）：静候满窗 ⇒ end_c、cp=end_c、log spare_taken
   G10.15 d 配方（隐藏敲门）：startAct(3)→A2-1 砌墙→真键续敲（260ms 一拍至 wallHits≥9）→startAct(5)→击杀→J ⇒ end_d、ended=[end_a,end_b,end_c,end_d]
   （首跑 6 红修位：①debug.registry 路径写错 ②贴脸攻速被 melee 抢拍 ③130ms 连按被 atkBuf 吞；另有 game.js 真 bug——分镜键名
     "ending_"+id 拼成 "ending_end_a" 而 d3 键真名 "ending_a" ⇒ 结局分镜整体静默跳仪式；已修 endingKey()，由 G10.12 log×5 锁住）
   G10.16 再 R：ended 跨局保留；G10.18 spare 软锁兜底（W4.1/A1）：boss_defeat→openSpare 的 2.2s 死亡窗内致死 ⇒ 复活后 spare 仍开
     （红侧＝软锁：spare 永不开、结局永不可达）；G10.17 全程零错误
   模式：默认完整＝29 断言（含全梯＝真入口「按 J 进终幕」）；CHAITAI_G10_SEG=1 段模式＝27 断言（跳过全梯，debug.startAct(5) 起——falsify 用，省全梯时间）
   红侧（W3 收官 ab65f67）：G10.P 起全红（ACTS[5] planned ⇒ 进不去终幕；startAct 钩子不存在 ⇒ 段模式亦全红）
   跑法：node tools/gate-10-final.cjs   （env：CHAITAI_URL / CHAITAI_SHOT_PREFIX / CHAITAI_G10_SEG） */
"use strict";
const path = require("path");
const fs = require("fs");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOTS = path.join(ROOT, "shots");
const PFX = process.env.CHAITAI_SHOT_PREFIX || "gate-10-";
const SEG = !!process.env.CHAITAI_G10_SEG;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const chk = (ok, tag, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + tag + " —— " + detail); ok ? pass++ : fail++; };

(async () => {
  console.log("== gate-10-final（终幕：Boss 上 T3＋三阶段招序＋结局 a–d＋杀青卡）" + (SEG ? "［段模式］" : "［完整模式］") + " ==");
  console.log("URL  = " + URL);
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  await page.goto(URL, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(700);

  const st = () => page.evaluate(() => window.__game.state());
  const dbg = (f, a) => page.evaluate((fn, args) => { try { const d = window.__game.debug; return d[fn].apply(d, args || []); } catch (e) { return null; } }, f, a || []);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(60); } return null; };
  const bornOf = (id) => page.evaluate((want) => { const s = window.__game.state(); const L = s.lastSpawn; return (L && L.id === want) ? L.born : null; }, id);
  const waitBorn = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const b = await bornOf(id); if (b) return b; await sleep(50); } return null; };
  const cpId = () => page.evaluate(() => { try { return window.__game.debug.cp().id; } catch (e) { return "(no debug.cp)"; } });
  const cpLogIds = () => page.evaluate(() => { try { return window.__game.debug.cp().log.map(x => x.id); } catch (e) { return []; } });
  const logHas = (s, key) => !!(s && s.narrator && s.narrator.log && s.narrator.log.indexOf(key) >= 0);
  const logCount = (s, key) => (s && s.narrator && s.narrator.log) ? s.narrator.log.filter(k => k === key).length : -1;
  const btnState = () => page.evaluate(() => {
    const g = (id) => { const el = document.getElementById(id); return el ? el.classList.contains("on") : null; };
    return { cont: g("t-continue"), rest: g("t-restart") }; });
  /* 收菜器（W4 招序抓包）：轮询 traps 记录种类/细节后立即 clearTraps——
     ① 观察 Boss 招是否按 castOrder 出手；② 消险（不挨打 ⇒ a 配方零死亡可判） */
  const harvest = async (ms, wantKinds) => {
    const seen = { kinds: {}, lampT: [], dropXs: [], dropLeads: [], cleared: 0 };
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await st();
      for (const t of (s.traps || [])) {
        seen.kinds[t.type] = (seen.kinds[t.type] || 0) + 1;
        if (t.type === "lamp" && seen.lampT.indexOf(t.T) < 0) seen.lampT.push(t.T);
        if (t.type === "drop") { seen.dropXs.push(Math.round(t.x)); seen.dropLeads.push(+t.lead); }
      }
      if ((s.traps || []).length) { await dbg("clearTraps"); seen.cleared++; }
      if (wantKinds && wantKinds.every(k => seen.kinds[k])) break;
      await sleep(80);
    }
    return seen;
  };
  const faceRight = async () => { await page.keyboard.down("KeyD"); await sleep(80); await page.keyboard.up("KeyD"); };
  const waitCard = async (ms) => { /* 等 card 出现；同时回报 ceremony 是否见过 */
    let cerSeen = false, t0 = Date.now();
    while (Date.now() - t0 < ms) { const s = await st();
      if (s.staging && s.staging.ceremony) cerSeen = true;
      if (s.staging && s.staging.card) return { s: s, cerSeen: cerSeen };
      await sleep(100); }
    return { s: null, cerSeen: cerSeen }; };

  chk(errs.length === 0, "G10.0a 进入游戏零错误", errs.length ? errs[0] : "0 条");
  /* —— G10.0 注册表基线 —— */
  const reg = await page.evaluate(() => { const g = window.__game; if (!g || !g.debug || !g.debug.registry) return null; const r = g.debug.registry;
    return { a5: r.acts.find(a => a.id === 5), endIds: r.endings.map(e => e.id), endRecipes: r.endings.map(e => e.recipe),
      cp5: r.checkpoints.filter(c => c.act === 5), mf: r.mechanicsMustFire, dur: r.durableFields.map(f => f.k) }; });
  const cp5live = reg ? reg.cp5.filter(c => c.stage === "live").length : -1;
  const mf5 = reg ? (reg.mf.find(m => m.act === 5) || { ids: [] }) : { ids: [] };
  chk(!!reg && reg.a5 && reg.a5.stage === "playable" && reg.endIds.indexOf("end_a") >= 0 && reg.endIds.indexOf("end_d") >= 0
      && reg.endRecipes.every(x => typeof x === "string" && x.length > 8)
      && reg.cp5.length === 11 && cp5live === 11 && reg.dur.indexOf("ended") >= 0
      && mf5.ids.indexOf("trap_press") >= 0 && mf5.ids.indexOf("boss_entity") >= 0,
    "G10.0 注册表基线：ACT5 playable、endings 含 a–d＋配方、act5 检查点 11/11 live、ended 入 durable、mustFire 含终幕机关",
    reg ? ("stage=" + reg.a5.stage + " endIds=" + reg.endIds.join(",") + " cp5=" + cp5live + "/" + reg.cp5.length + " mf5=" + mf5.ids.join(",")) : "(没有 registry)");

  let endS4 = null;
  if (!SEG) {
    /* —— §全梯：序章 → 第一幕 → 第二幕 → 第三幕终（act4-hold）—— */
    await dbg("setPlayerX", [430]);
    await until(async () => { const s = await st(); return s.enemies.length >= 2 ? s : null; }, 4500); await dbg("clearWave");
    await until(async () => { const s = await st(); return s.enemies.length >= 3 ? s : null; }, 4500); await dbg("clearWave");
    await until(async () => { const s = await st(); return s.cleared ? s : null; }, 6000);
    await until(async () => { const s = await st(); return s.continueReady ? s : null; }, 8000);
    await page.keyboard.press("KeyJ"); await sleep(300);
    const p1 = await waitBorn("E1-1", 4500); await dbg("clearWave");
    const p2 = await waitBorn("E1-2", 5000); await dbg("clearWave");
    await dbg("setPlayerPos", [828, 300]);
    const p3 = await waitBorn("E1-3", 3000); await dbg("clearWave");
    await until(async () => { const s = await st(); return s.actHold ? s : null; }, 4000);
    await page.keyboard.press("KeyJ"); await sleep(300);
    await dbg("setPlayerX", [800]);
    const q1 = await waitBorn("A2-1", 4500); await dbg("clearWave");
    await dbg("setPlayerX", [300]);
    const q2 = await waitBorn("A2-2", 5000); await dbg("clearWave");
    await dbg("setPlayerX", [490]);
    const q3 = await waitBorn("A2-3", 5000); await dbg("clearWave");
    await until(async () => { const s = await st(); return s.actHold ? s : null; }, 4000);
    await page.keyboard.press("KeyJ"); await sleep(300);
    console.log("   [梯] 一/二幕到场=" + [!!p1, !!p2, !!p3, !!q1, !!q2, !!q3].join(","));
    await dbg("setPlayerPos", [480]);
    const r1 = await waitBorn("A3-1", 5000); await dbg("clearWave");
    await dbg("setPlayerPos", [490]);
    const r2 = await waitBorn("A3-2", 5500); await dbg("clearWave");
    await dbg("setPlayerPos", [200]); /* 等待期避开落物 3 点 300/480/660 */
    const r3 = await waitBorn("A3-3", 5500);
    await until(async () => { const w = (await st()).wall; return w.built === true ? w : null; }, 3000);
    await dbg("clearWave");
    /* 拆墙：安全窗（灯带 m∈[0.15,1.6]）＋180 朝左三连 130ms（gate-9 G9.16 技术直搬） */
    await dbg("setPlayerPos", [200, 420]);
    await until(async () => { const s = await st(); const L = (s.traps || []).find(t => t.type === "lamp");
      if (!L) return null; const m = L.t % 6; return (m >= 0.15 && m <= 1.6) ? true : null; }, 8000);
    await dbg("setPlayerPos", [180]);
    await page.keyboard.down("KeyA"); await sleep(90); await page.keyboard.up("KeyA");
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.keyboard.press("KeyJ"); await sleep(130);
      await page.keyboard.press("KeyJ"); await sleep(130);
      await page.keyboard.press("KeyJ");
      const broke = await until(async () => { const w = (await st()).wall; return w.built === false ? w : null; }, 2500);
      if (broke) break;
    }
    endS4 = await until(async () => { const s = await st(); return s.actHold ? s : null; }, 5000);
    console.log("   [梯] 三幕到场=" + [!!r1, !!r2, !!r3].join(",") + " 幕终actHold=" + !!endS4);
    const bsP = await btnState();
    chk(!!endS4 && endS4.act === 4 && endS4.continueReady === true && bsP.cont === true && bsP.rest === true,
      "G10.P 第三幕终驻留：continueReady=true、▶/⟳ 上屏（终幕已接线 ⇒ 可开拍）",
      (endS4 ? "act=" + endS4.act + " continueReady=" + endS4.continueReady + " " + JSON.stringify(bsP) : "5s 内没到幕终"));
    await page.keyboard.press("KeyJ");
    const a5 = await until(async () => { const s = await st(); return s.act === 5 ? s : null; }, 3000);
    const bs1 = await btnState(); const a5s = a5 || (await st()) || {};
    chk(!!a5 && a5s.staging && a5s.staging.act && a5s.staging.act.name === "终幕 · 杀青" && a5s.cleared === false
        && a5s.showRestart === false && !bs1.cont && !bs1.rest,
      "G10.1 按 J 进终幕：act=5、幕卡「终幕 · 杀青」、cleared 复位、▶/⟳ 全收",
      (a5 ? ("act=5 卡=" + (a5s.staging && a5s.staging.act ? a5s.staging.act.name : "(null)")) : "3s 内没进（接线前应红于此）") +
      " cleared=" + a5s.cleared + " " + JSON.stringify(bs1));
  } else {
    await dbg("startAct", [5]); await sleep(150);
    console.log("   [段] startAct(5) 直入（模式：CHAITAI_G10_SEG=1）");
  }

  /* —— G10.1b 台箱 T1/T2/T3＋cp=act4_open —— */
  const s5 = await st();
  const wantP5 = [{ x: 300, y: 420, w: 64, h: 50 }, { x: 500, y: 390, w: 64, h: 80 }, { x: 780, y: 300, w: 96, h: 170 }];
  const p5Ok = s5.act === 5 && Array.isArray(s5.plats) && s5.plats.length === 3 &&
    wantP5.every((w, i) => s5.plats[i] && s5.plats[i].x === w.x && s5.plats[i].y === w.y && s5.plats[i].w === w.w && s5.plats[i].h === w.h);
  const cpO = await cpId();
  chk(p5Ok && cpO === "act4_open", "G10.1b 终幕布局＝第一幕全布局（T1/T2/T3 三件 deep-equal）＋cp=act4_open",
    "act=" + s5.act + " plats=" + JSON.stringify(s5.plats || []) + " cp=" + cpO);

  /* —— G10.2 Boss 入场 —— */
  const bossE = await until(async () => { const s = await st(); return (s.boss && s.boss.active) ? s : null; }, 5000);
  const bs2 = bossE ? bossE.boss : {};
  const cpL2 = await cpLogIds();
  const iBI = cpL2.lastIndexOf("boss_intro"), iP1 = cpL2.lastIndexOf("a4_p1");
  chk(!!bossE && bossE.arena === "boss" && bs2.hp === 120 && bs2.maxHp === 120 && Math.abs(bs2.y - 300) <= 1
      && Math.abs(bs2.x - 828) <= 1 && bs2.narr === "idle" && iBI >= 0 && iP1 > iBI && logHas(bossE, "boss_intro") && (await cpId()) === "a4_p1",
    "G10.2 Boss 入场（幕卡后 2.0s）：active、arena=boss、hp=120、y≈300（站上 T3 顶）、x=828、narr=idle、cp=a4_p1、序含 boss_intro→a4_p1",
    (bossE ? ("hp=" + bs2.hp + " x=" + bs2.x + " y=" + bs2.y + " arena=" + bossE.arena + " narr=" + bs2.narr +
      " cpLog尾=" + JSON.stringify(cpL2.slice(-3))) : "5s 内 Boss 没入场（接线前应红于此）"));
  await page.screenshot({ path: path.join(SHOTS, PFX + "01-boss-entry.png") });

  /* —— G10.3 p1 招序：press＋lamp（T=4.2） —— */
  await dbg("setPlayerPos", [490]);
  const h1 = await harvest(7500, ["press", "lamp"]);
  chk((h1.kinds.press | 0) >= 1 && (h1.kinds.lamp | 0) >= 1 && h1.lampT.indexOf(4.2) >= 0,
    "G10.3 p1 招序：抓包见 press＋lamp（lamp.T=4.2）",
    "kinds=" + JSON.stringify(h1.kinds) + " lampT=" + JSON.stringify(h1.lampT) + " 清险=" + h1.cleared + " 次");

  /* —— G10.4 命中带：「必须上 T3」 —— */
  await dbg("setPlayerPos", [700]); await faceRight();
  await page.keyboard.press("KeyJ"); await sleep(500);
  const hpG = (await st()).boss.hp;
  /* 上 T3 贴脸直攻抢跑：不重新转向（地面后已面向右）、落台即刻 J —— 攻击判定 ~0.25s 先于 Boss melee 起手 0.5s 落锤；
     首跑红因＝先 faceRight（±0.3s）再按 ⇒ 撞上 melee 落锤被拍飞（php −18、Boss 不落血）。被抢拍则重试（≤3），php<40 保命弃测 */
  let hpT = hpG; const tries = [];
  for (let i = 0; i < 3; i++) {
    const bx = (await st()).boss.x;
    await dbg("setPlayerPos", [Math.max(782, Math.min(868, Math.round(bx - 43))), 300]);
    await page.keyboard.press("KeyJ"); await sleep(430);
    const sT = await st(); hpT = sT.boss.hp; tries.push(hpT + "/php" + sT.player.hp);
    if (hpT < 120) break;
    await dbg("setPlayerPos", [490]);
    if (sT.player.hp < 40) break;
    await sleep(500);
  }
  await dbg("setPlayerPos", [490]);
  chk(hpG === 120 && hpT === 112,
    "G10.4 命中带：地面挥（700）Boss 不落血；上 T3（贴脸 boss.x−43）挥 ⇒ 120→112（step1=8）",
    "地面后 hp=" + hpG + "；T3 试行=" + JSON.stringify(tries));
  await page.screenshot({ path: path.join(SHOTS, PFX + "02-band-t3.png") });

  /* —— G10.5 p2 门＋小兵 once＋清兵负控 —— */
  await dbg("setPlayerPos", [490]);
  await dbg("bossDamage", [40]); await sleep(280);
  const sP2 = await st();
  const mn = (sP2.enemies || []).filter(e => e.hp > 0);
  const cpP2 = await cpId();
  chk(sP2.boss.phase === 2 && cpP2 === "a4_p2" && logHas(sP2, "boss_half")
      && mn.length === 2 && mn.every(e => e.kind === "red") && Math.abs(mn[0].x - 60) <= 40 && Math.abs(mn[1].x - 150) <= 40,
    "G10.5 p2 门：hp=80 ⇒ phase=2、cp=a4_p2、log boss_half、2 红 once 生成（60/150）",
    "phase=" + sP2.boss.phase + " hp=" + sP2.boss.hp + " cp=" + cpP2 + " 小兵=" + mn.map(e => e.kind + "@" + e.x).join(","));
  await dbg("clearWave"); await sleep(700);
  const sNeg = await st();
  chk(sNeg.encPhase === "idle" && sNeg.actHold !== true && sNeg.lastSpawn === null && (sNeg.enemies || []).length === 0,
    "G10.5b 清兵负控（arena=boss）：清后 700ms 无清场链副作用（encPhase 仍 idle、actHold false）",
    "encPhase=" + sNeg.encPhase + " actHold=" + sNeg.actHold + " lastSpawn=" + JSON.stringify(sNeg.lastSpawn));

  /* —— G10.6 p3 门 —— */
  await dbg("bossDamage", [40]); await sleep(280);
  const sP3 = await st();
  const cpP3 = await cpId();
  chk(sP3.boss.phase === 3 && cpP3 === "a4_p3" && logHas(sP3, "boss_low") && sP3.boss.narr === "enraged",
    "G10.6 p3 门：hp=40 ⇒ phase=3、cp=a4_p3、log boss_low、narr=enraged",
    "phase=" + sP3.boss.phase + " hp=" + sP3.boss.hp + " cp=" + cpP3 + " narr=" + sP3.boss.narr);

  /* —— G10.7 p3 招序：press＋drop（含 828 台面点/错峰）＋lamp —— */
  await dbg("clearTraps");
  const h3 = await harvest(9000, ["press", "drop", "lamp"]);
  const drop828 = h3.dropXs.some(x => Math.abs(x - 828) <= 1);
  const leadOk = h3.dropLeads.some(l => l >= 0.9);
  chk((h3.kinds.press | 0) >= 1 && (h3.kinds.drop | 0) >= 1 && (h3.kinds.lamp | 0) >= 1 && drop828 && leadOk,
    "G10.7 p3 招序：press＋drop＋lamp；drop 含 T3 点 x≈828、错峰 lead≥0.9",
    "kinds=" + JSON.stringify(h3.kinds) + " dropXs=" + JSON.stringify(h3.dropXs.slice(0, 8)) + " leads=" + JSON.stringify(h3.dropLeads.slice(0, 8)));

  /* —— G10.8 零血→bossDefeat —— */
  await dbg("clearTraps");
  await dbg("bossDamage", [40]); await sleep(500);
  const sD = await st();
  const cpD = await cpId();
  const lampGone = !(sD.traps || []).some(t => t.type === "lamp");
  chk(sD.boss.dead === true && sD.boss.state === "down" && cpD === "a4_down" && logHas(sD, "boss_defeat") && lampGone,
    "G10.8 零血：bossDefeat（dead/down）、cp=a4_down、log boss_defeat、灯带收净",
    "dead=" + sD.boss.dead + " state=" + sD.boss.state + " cp=" + cpD + " lampGone=" + lampGone);

  /* —— G10.9 spare 窗口（defeat+2.2s） —— */
  const sSp = await until(async () => { const s = await st(); return (s.spare && s.spare.open) ? s : null; }, 4600);
  const cpSp = await cpId();
  chk(!!sSp && cpSp === "a4_choice" && logHas(sSp, "spare_prompt"),
    "G10.9 spare 窗口：spare.open、cp=a4_choice、log spare_prompt",
    sSp ? ("spare.t=" + sSp.spare.t + " cp=" + cpSp + " prompt=" + logHas(sSp, "spare_prompt")) : "4.6s 内没开窗");
  await page.screenshot({ path: path.join(SHOTS, PFX + "03-spare.png") });

  /* —— G10.10 结局 a 配方：零死亡＋收手 —— */
  const sEa = await until(async () => { const s = await st(); return s.ending ? s : null; }, 9000);
  const cpEa = await cpId();
  chk(!!sEa && sEa.ending === "end_a" && sEa.ended.indexOf("end_a") >= 0 && cpEa === "end_a"
      && logHas(sEa, "spare_taken") && !logHas(sEa, "finish_taken") && sEa.narrator.counters.deaths === 0,
    "G10.10 结局 a（一条过）：deaths=0＋静候满窗 ⇒ ending=end_a、cp=end_a、log spare_taken（无 finish_taken）",
    sEa ? ("ending=" + sEa.ending + " ended=" + JSON.stringify(sEa.ended) + " cp=" + cpEa + " deaths=" + sEa.narrator.counters.deaths +
      " spare_taken=" + logHas(sEa, "spare_taken")) : "9s 内没出结局");

  /* —— G10.11 墙压 y 带（W4 修：地面中、台上免） —— */
  await dbg("setPlayerPos", [490]);
  const hp0 = (await st()).player.hp;
  await dbg("spawnPress", [490]); await sleep(1700);
  const hpP = (await st()).player.hp;
  await dbg("setPlayerPos", [820, 300]);
  const hp1 = (await st()).player.hp;
  await dbg("spawnPress", [820]); await sleep(1700);
  const hpN = (await st()).player.hp;
  chk(hpP === hp0 - 20 && hpN === hp1,
    "G10.11 墙压 y 带：地面 spawnPress ⇒ −20；T3 顶（y=300）spawnPress ⇒ 零伤",
    "地面 " + hp0 + "→" + hpP + "；台上 " + hp1 + "→" + hpN);

  /* —— G10.12 分镜连发→仪式→杀青卡 —— */
  const cardA = await waitCard(34000);
  const nA = cardA.s ? logCount(cardA.s, "ending_a") : -1;
  const bsC = await btnState();
  chk(!!cardA.s && nA === 5 && cardA.cerSeen && cardA.s.staging.card && cardA.s.showRestart === true && bsC.rest === true,
    "G10.12 分镜连发：ending_a 恰 5 档（log 计数）、ceremony 出现、staging.card、showRestart=true、⟳ 上",
    "card=" + !!(cardA.s && cardA.s.staging.card) + " ending_a×" + nA + " ceremony见=" + cardA.cerSeen +
    " " + JSON.stringify(bsC) + (cardA.s ? " card.t=" + cardA.s.staging.card.t : ""));
  await page.screenshot({ path: path.join(SHOTS, PFX + "04-card-a.png") });

  /* —— G10.13 R 再拍＋b 配方（死亡＋补刀） —— */
  await page.keyboard.press("KeyR"); await sleep(450);
  const sR = await st();
  const rOk = sR.act === 1 && sR.spare === null && sR.ending === null && (!sR.staging || sR.staging.card === null)
    && (sR.ended || []).join(",") === "end_a" && sR.wallHits === 0;
  chk(rOk, "G10.13a R 再拍一条：act=1、spare/ending/card 清、ended 保留 [end_a]、wallHits 复位",
    "act=" + sR.act + " spare=" + JSON.stringify(sR.spare) + " ending=" + sR.ending + " ended=" + JSON.stringify(sR.ended) + " wallHits=" + sR.wallHits);
  await dbg("hurtPlayer", [500]);
  await until(async () => { const s = await st(); return s.phase === "dead" ? s : null; }, 3000);
  await until(async () => { const s = await st(); return s.phase === "playing" ? s : null; }, 6000);
  const d1 = (await st()).narrator.counters.deaths;
  chk(d1 === 1, "G10.13b 死亡计数：hurtPlayer 致死 ⇒ deaths=1（跨 R 累计语义）", "deaths=" + d1);
  await dbg("startAct", [5]); await sleep(150);
  await until(async () => { const s = await st(); return (s.boss && s.boss.active) ? s : null; }, 5000);
  await dbg("bossDamage", [120]);
  await until(async () => { const s = await st(); return (s.spare && s.spare.open) ? s : null; }, 5000);
  await sleep(1400);
  await page.keyboard.press("KeyJ");
  const sEb = await until(async () => { const s = await st(); return s.ending ? s : null; }, 3000);
  const cpEb = await cpId();
  chk(!!sEb && sEb.ending === "end_b" && sEb.ended.indexOf("end_b") >= 0 && cpEb === "end_b" && logHas(sEb, "finish_taken"),
    "G10.13c 结局 b（都散了）：J 补刀 ⇒ ending=end_b、cp=end_b、log finish_taken",
    sEb ? ("ending=" + sEb.ending + " ended=" + JSON.stringify(sEb.ended) + " cp=" + cpEb) : "3s 内没出结局");

  /* —— G10.14 c 配方（有死亡收手） —— */
  const cardB = await waitCard(34000);
  chk(!!cardB.s, "G10.14a b 分镜→卡完成", cardB.s ? ("card.t=" + cardB.s.staging.card.t + " cer=" + cardB.cerSeen) : "34s 内卡没出");
  await page.keyboard.press("KeyR"); await sleep(450);
  await dbg("startAct", [5]); await sleep(150);
  await until(async () => { const s = await st(); return (s.boss && s.boss.active) ? s : null; }, 5000);
  await dbg("bossDamage", [120]);
  const sSp2 = await until(async () => { const s = await st(); return (s.spare && s.spare.open) ? s : null; }, 5000);
  const sEc = await until(async () => { const s = await st(); return s.ending ? s : null; }, 9000);
  const cpEc = await cpId();
  chk(!!sSp2 && !!sEc && sEc.ending === "end_c" && sEc.ended.indexOf("end_c") >= 0 && cpEc === "end_c" && logHas(sEc, "spare_taken"),
    "G10.14b 结局 c（合约重签）：静候满窗 ⇒ ending=end_c、cp=end_c、log spare_taken",
    sEc ? ("ending=" + sEc.ending + " ended=" + JSON.stringify(sEc.ended) + " cp=" + cpEc) : "9s 内没出结局");

  /* —— G10.15 d 配方（隐藏·敲门：真键敲墙 9 下） —— */
  const cardC = await waitCard(34000);
  chk(!!cardC.s, "G10.15a c 分镜→卡完成", cardC.s ? ("card.t=" + cardC.s.staging.card.t) : "34s 内卡没出");
  await page.keyboard.press("KeyR"); await sleep(450);
  await dbg("startAct", [3]); await sleep(150);
  const w1 = await waitBorn("A2-1", 4500);
  await dbg("setPlayerPos", [170]);
  const wallB = await until(async () => { const w = (await st()).wall; return w.built === true ? w : null; }, 4500);
  await dbg("setPlayerPos", [180]);
  await page.keyboard.down("KeyA"); await sleep(90); await page.keyboard.up("KeyA");
  /* 真键敲门：260ms 一拍（首跑红因＝130ms 连按被 atkBuf 吞、9 按仅 6 中）＋逐拍查 wallHits 提前收；
     php<25 或 wallHits≥9 即停（A2-1 敌人逼近期保命——deaths 计数在 G10.16b 被断言） */
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("KeyJ"); await sleep(260);
    const sk = await st();
    if (sk.wallHits >= 9 || sk.player.hp < 25) break;
  }
  await sleep(300);
  const sK = await st();
  chk(!!w1 && !!wallB && sK.wallHits >= 9,
    "G10.15b 敲门计数：A2-1 砌墙（built）＋真键续敲（260ms 一拍）⇒ wallHits≥9",
    "A2-1=" + !!w1 + " built=" + !!wallB + " wallHits=" + sK.wallHits + " php=" + sK.player.hp);
  await dbg("clearWave"); await sleep(900); await dbg("startAct", [5]); await sleep(150); /* 900ms：让清场墙开（wall.pendingOpen）跑完再切幕，防残墙进终幕 */
  await until(async () => { const s = await st(); return (s.boss && s.boss.active) ? s : null; }, 5000);
  await dbg("bossDamage", [120]);
  await until(async () => { const s = await st(); return (s.spare && s.spare.open) ? s : null; }, 5000);
  await sleep(1400);
  await page.keyboard.press("KeyJ");
  const sEd = await until(async () => { const s = await st(); return s.ending ? s : null; }, 3000);
  const cpEd = await cpId();
  chk(!!sEd && sEd.ending === "end_d" && cpEd === "end_d" && sEd.ended.join(",") === "end_a,end_b,end_c,end_d",
    "G10.15c 结局 d（隐藏·敲门）：敲≥9 后补刀 ⇒ ending=end_d、cp=end_d、ended=[a,b,c,d] 全集",
    sEd ? ("ending=" + sEd.ending + " ended=" + JSON.stringify(sEd.ended) + " cp=" + cpEd) : "3s 内没出结局");
  await page.screenshot({ path: path.join(SHOTS, PFX + "05-ending-d.png") });

  /* —— G10.16 收尾：d 卡＋再 R（ended 跨局保留） —— */
  const cardD = await waitCard(34000);
  chk(!!cardD.s, "G10.16a d 分镜→杀青卡完成", cardD.s ? ("card.t=" + cardD.s.staging.card.t + " cer=" + cardD.cerSeen) : "34s 内卡没出");
  await page.screenshot({ path: path.join(SHOTS, PFX + "06-card-d.png") });
  await page.keyboard.press("KeyR"); await sleep(450);
  const sFin = await st();
  chk(sFin.act === 1 && (sFin.ended || []).join(",") === "end_a,end_b,end_c,end_d" && sFin.ending === null && sFin.narrator.counters.deaths === 1,
    "G10.16b 结局记忆跨局：R 后 ended 保留全四结局、ending 清、deaths 保持 1",
    "act=" + sFin.act + " ended=" + JSON.stringify(sFin.ended) + " ending=" + sFin.ending + " deaths=" + sFin.narrator.counters.deaths);

  /* —— G10.18 spare 软锁兜底（W4.1/A1）：boss_defeat→openSpare 的 2.2s 窗内致死 ⇒ 复活后 spare 仍开 ——
     红侧＝软锁：openSpare 在 dead 相直接 return 且复活不清账 ⇒ spare 永为 null（结局永不可达、玩家卡死在杀青前）。
     修＝openSpare dead 相 0.5s 重试 ＋ respawn 尾补开（冗余双保险；证伪整串删）。 */
  await dbg("startAct", [5]); await sleep(150);
  await until(async () => { const s = await st(); return (s.boss && s.boss.active) ? s : null; }, 5000);
  await dbg("bossDamage", [120]); await sleep(1200); /* 落在 defeat→openSpare 的 2.2s 窗内（spare 还没开） */
  await dbg("hurtPlayer", [500]);
  const sDeadF = await until(async () => { const s = await st(); return s.phase === "dead" ? s : null; }, 3000);
  const sBackF = await until(async () => { const s = await st(); return s.phase === "playing" ? s : null; }, 6000); /* 死拍 2.2s 后复活 */
  const sRbF = await until(async () => { const s = await st(); return (s.spare && s.spare.open) ? s : null; }, 4000); /* 兜底路径开窗 */
  const cpF = await cpId();
  chk(!!sDeadF && !!sBackF && !!sRbF && cpF === "a4_choice" && logHas(sRbF, "spare_prompt"),
    "G10.18 spare 软锁兜底：defeat 后 1.2s 致死 ⇒ 复活回 playing 且 spare 仍开（cp=a4_choice、log spare_prompt）",
    (sDeadF ? "已死" : "没死") + "→复活=" + !!sBackF + " spare=" + JSON.stringify(sRbF ? sRbF.spare : null) + " cp=" + cpF);

  chk(errs.length === 0, "G10.17 全程零错误", errs.length ? (errs.length + " 条，首条：" + errs[0]) : "0 条");
  console.log("---- 汇总：" + (fail === 0 ? "PASS " + pass + "/" + pass : "FAIL " + fail + "（PASS " + pass + "）") + " ----");
  console.log("GATE gate-10-final: " + (fail === 0 ? "PASS" : "FAIL"));
  await browser.close().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
