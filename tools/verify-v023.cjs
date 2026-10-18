/* verify-v023.cjs —— 《拆台》v0.2 增量验收探针（Loop 4：Boss 灰盒＋BossNarrativeController）
   依据：review-v02/d2-levels/design.md §6（终幕 Boss：站 T3 / hp120 / 近身板挥 windup0.5s 伤18＝一闪靶 /
   三阶段 gap 1.6/1.6/1.2＋p2 双红兵 once / 招表 墙压·灯扫·道具雨）＋§7 T-BOSSHP＋§9 第④步＋
   Harness 专项指令「BossNarrativeController：Idle/Taunting/Enraged」＋d5 墙压预警音。
   断言（13 判据行 / 10 组）：
   V23-A  Boss 落位/命中带（红闸）：T3={790,300,76,16} 下 spawnBoss(828) ⇒ boss.y=300（站上台）、x=828；
        玩家站 T3 x=800 真键 J ⇒ hp 120→112（同带可打）；落到地面再挥 ⇒ hp 不变且确挥了（不同带打不到）。
   V23-B1 近身板挥·不闪被伤 18：站 800（adx=28<58 触发 wind）⇒ wind→strike→rec 全链路所见，hp 100→82 恰一次。
   V23-B2 近身板挥·一闪反击：wind 末按 K ⇒ boss.hp 120→94（-26 一闪靶），玩家 hp 恒 100。
   V23-C1 墙压·正中 -20：spawnPress(400) 玩家 400 ⇒ hp 100→80，且 hit 锁 true（落地 stay 相判一次）。
   V23-C2 墙压·域外对照：玩家 400、板 330（距 70>26）⇒ hp 恒 100 且 hit 锁 false。
   V23-D1 墙压·冲刺免：玩家 345（探针先按 D 定朝向为右）slam 中按 K ⇒ 落点入带时 dashT/iframes 门 ⇒ hit 锁 true（确入带）但 hp 恒 100。
   V23-D2 墙压·跳无效：玩家 400 起跳 ⇒ 确腾空(minY<440) 仍 -20（hp=80）＝自上而下不可跳避（判定仅 x 向）。
   V23-E  阶段链：p1(120)→80 门触发 p2＋boss_half＋双红兵 once（60/150）；hp 75 不再补；→40 门触发 p3＋boss_low＋narr=enraged。
   V23-F  BossNarrativeController 真实转移链：spawn⇒idle；玩家倒下⇒taunting；hp≤40⇒enraged。
   V23-G  击败：bossDamage(≥hp) ⇒ hp0/dead/state=down＋boss_defeat 日志；clearBoss ⇒ arena 回 prologue、narr 关。
   V23-H  T-BOSSHP 触发器：无 Boss⇒false；120⇒{lte:40}=false、{gte:100}=true；35⇒lte 真/gte 假；倒下⇒false。
   V23-I  arena 门（d2 §6 工程注意）：波次开着、小兵清光、Boss 在场 ⇒ 清场链必须冻结（2.4s 内 wave 恒 1、cleared 恒 false、余敌恒 0）；
         clearBoss 后 ⇒ 3s 内恢复推进（cleared 或 wave2 出现）。
   V23-0  全程 0 pageerror / 0 console.error
   用法：node tools/verify-v023.cjs
   环境：CHAITAI_URL（覆盖被测页，默认正本）／CHAITAI_SHOT_PREFIX（截图前缀）
   先红后绿：对 versions/v0.1.2/index.html 跑 => 12 红全在预期 ID（钩子缺失）；对正本跑 => 全绿（rc=0） */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v023/v023");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v023 ==");
  console.log("URL  = " + URL_);
  let dir = ROOT;
  try { const u = new URL(URL_); if (u.protocol === "file:") dir = path.dirname(decodeURIComponent(u.pathname.replace(/^\//, ""))); } catch (e) {}
  console.log("md5  = game.js " + md5(path.join(dir, "game.js")) + " / index.html " + md5(path.join(dir, "index.html")) + "（被测目录 " + dir + "）");
  fs.mkdirSync(path.dirname(SHOT), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  let shotN = 0;
  const shot = async (tag) => { try { await page.screenshot({ path: SHOT + "-" + (++shotN) + "-" + tag + ".png" }); } catch (e) {} };
  const reset = async () => { await page.evaluate(() => { const d = window.__game.debug; d.reset(); if (d.setPlatforms) d.setPlatforms([]); }); await sleep(400); };
  /* 预先消化 W1：站 430 触发 → 等红兵真刷出 → 清光（最多 3 轮复核）。
     目的：Boss 场景把玩家摆到 x>420 时 wave1Started 已置位 ⇒ 不会再刷兵（红兵 dmg=18 与 Boss 同值，会污染归因） */
  const preClearWaves = async () => {
    await G(() => window.__game.debug.setPlayerX(430));
    await sleep(300);
    for (let k = 0; k < 3; k++) {
      await G(() => window.__game.debug.clearWave());
      await sleep(90);
      const r = await G(() => ({ n: window.__game.state().enemies.filter(e => e.hp > 0).length, w: window.__game.state().wave }));
      if (r.n === 0 && r.w === 1) return true;
    }
    return false;
  };
  const G = (fn) => page.evaluate(fn);
  const st = () => G(() => { const s = window.__game.state(); return { hp: s.player.hp, px: s.player.x, py: s.player.y, attacking: s.player.attacking, alive: s.player.hp > 0, boss: s.boss, arena: s.arena, wave: s.wave, cleared: !!s.cleared, enemies: s.enemies.filter(e => e.hp > 0).length, log: s.narrator.log, traps: s.traps }; });
  const pressOf = (s) => s.traps.filter(t => t.type === "press")[0] || null;

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(400);

  const hooks = await G(() => { const d = window.__game.debug;
    return { boss: typeof d.spawnBoss === "function", dmg: typeof d.bossDamage === "function",
      press: typeof d.spawnPress === "function", clear: typeof d.clearBoss === "function", pos: typeof d.setPlayerPos === "function" }; });
  const hasHooks = hooks.boss && hooks.dmg && hooks.press && hooks.clear && hooks.pos;

  /* ---------- V23-A Boss 落位/命中带（红闸） ---------- */
  let A = { bossY: null, bossX: null, hp1: null, sawSwing1: false, hp2: null, hpBefore2: null, sawSwing2: false };
  if (hasHooks) {
    await reset();
    await preClearWaves();
    await G(() => { const d = window.__game.debug; d.setPlatforms([{ x: 790, y: 300, w: 76, h: 16 }]); d.setPlayerPos(800, 300); });
    const spawn = await G(() => window.__game.debug.spawnBoss(828));
    A.bossY = spawn.y; A.bossX = spawn.x;
    await sleep(250);
    await page.keyboard.press("j");
    for (let i = 0; i < 20; i++) { await sleep(50);
      const s = await st(); if (s.boss.hp < 120) { A.hp1 = s.boss.hp; break; }
      if (s.attacking) A.sawSwing1 = true; }
    if (A.sawSwing1 === false) { for (let i = 0; i < 6; i++) { await sleep(30); if (await G(() => window.__game.state().player.attacking)) { A.sawSwing1 = true; break; } } }
    await shot("boss-t3");
    /* 地面再挥：不同带 ⇒ 打不到 */
    A.hpBefore2 = (await st()).boss.hp;
    await G(() => window.__game.debug.setPlayerPos(758, 470));
    await sleep(120);
    await page.keyboard.press("j");
    for (let i = 0; i < 12; i++) { await sleep(50); if (await G(() => window.__game.state().player.attacking)) A.sawSwing2 = true; }
    A.hp2 = (await st()).boss.hp;
  }
  {
    const ok = hasHooks && A.bossY === 300 && A.bossX === 828 && A.hp1 === 112 && A.sawSwing1
      && A.sawSwing2 && A.hp2 === A.hpBefore2;
    report("V23-A Boss 落位/命中带", ok, hasHooks
      ? "落位 y=" + A.bossY + "（期望300=T3台面） x=" + A.bossX + "（期望828）；T3 同带挥中 hp 120→" + A.hp1 + "（期望112=step1 8伤，确挥=" + A.sawSwing1 + "）；地面挥打不到 hp " + A.hpBefore2 + "→" + A.hp2 + "（期望不变，确挥=" + A.sawSwing2 + "）"
      : "debug.spawnBoss/setPlayerPos 不存在（v0.1.2 无 Boss 灰盒，应有此红）");
  }

  /* ---------- V23-B1 近身板挥·不闪被伤 18 ---------- */
  let B1 = { hp: null, seq: [], n: 0 };
  if (hasHooks) {
    await reset();
    await preClearWaves();
    await G(() => { const d = window.__game.debug; d.spawnBoss(828); d.setPlayerPos(800, 470); });
    /* 首伤记 82 后不 break：继续采 rec 相（0.5s）；被击退后玩家远离 ⇒ 不会二连击伪影 */
    for (let i = 0; i < 70; i++) { await sleep(40);
      const s = await st(); B1.n++;
      const bs = s.boss.state;
      if (B1.seq[B1.seq.length - 1] !== bs) B1.seq.push(bs);
      if (s.hp < 100 && B1.hp === null) B1.hp = s.hp;
      if (B1.hp !== null && B1.seq.indexOf("rec") >= 0) break; }
  }
  {
    const sawWind = B1.seq.indexOf("wind") >= 0, sawStrike = B1.seq.indexOf("strike") >= 0, sawRec = B1.seq.indexOf("rec") >= 0;
    const ok = hasHooks && B1.hp === 82 && sawWind && sawStrike && sawRec;
    report("V23-B1 近身板挥·不闪被伤18", ok, hasHooks
      ? "hp 100→" + B1.hp + "（期望82=伤18恰一次） FSM路径=" + B1.seq.join("→") + "（期望含 wind→strike→rec） 样本=" + B1.n
      : "debug.spawnBoss 不存在（应有此红）");
  }

  /* ---------- V23-B2 近身板挥·一闪反击 ---------- */
  let B2 = { bossHp: null, hp: null, windSeen: false, dodges: null };
  if (hasHooks) {
    await reset();
    await preClearWaves();
    await G(() => { const d = window.__game.debug; d.spawnBoss(828); d.setPlayerPos(800, 470); });
    let pressed = false;
    for (let i = 0; i < 260; i++) {
      await sleep(12);
      const bs = await G(() => window.__game.state().boss.state);
      if (bs === "wind") {
        if (!B2.windSeen) { B2.windSeen = true;
          /* wind 0.5s：detect 后 ~482ms 按 K ⇒ 冲刺(0.16s) 覆盖 strike 帧，位移 ≤33px 仍入带 */
          await sleep(482); await page.keyboard.press("k"); pressed = true; }
      }
      if (pressed) { const s = await st();
        if (s.boss.hp < 120) { B2.bossHp = s.boss.hp; B2.hp = s.hp; B2.dodges = await G(() => window.__game.state().narrator.counters.perfectDodges); break; }
        if (s.hp < 100) { B2.bossHp = s.boss.hp; B2.hp = s.hp; break; } }
    }
    await shot("boss-parry");
  }
  {
    const ok = hasHooks && B2.bossHp === 94 && B2.hp === 100 && B2.dodges === 1;
    report("V23-B2 近身板挥·一闪反击", ok, hasHooks
      ? "wind所见=" + B2.windSeen + " boss hp 120→" + B2.bossHp + "（期望94=一闪 -26） 玩家 hp=" + B2.hp + "（期望100） perfectDodges=" + B2.dodges + "（期望1=parry 走 perfectDodge 同路径）"
      : "debug.spawnBoss 不存在（应有此红）");
  }

  /* ---------- V23-C1 墙压·正中 -20 ---------- */
  let C1 = { hp: null, hit: null, sawStay: false, slamSeen: false };
  if (hasHooks) {
    await reset();
    await G(() => { const d = window.__game.debug; d.setPlayerPos(400, 470); d.spawnPress(400); });
    for (let i = 0; i < 90; i++) { await sleep(40);
      const s = await st(); const p = pressOf(s);
      if (!p) break;
      if (p.phase === "slam") C1.slamSeen = true;
      if (p.phase === "stay") { C1.sawStay = true; if (i < 32) await shot("press-slam"); }
      if (s.hp < 100) { C1.hp = s.hp; C1.hit = p.hit; break; } }
  }
  {
    const ok = hasHooks && C1.hp === 80 && C1.hit === true && C1.sawStay && C1.slamSeen;
    report("V23-C1 墙压·正中-20", ok, hasHooks
      ? "hp 100→" + C1.hp + "（期望80） hit锁=" + C1.hit + "（期望true=stay相只判一次） 相序见 slam=" + C1.slamSeen + " stay=" + C1.sawStay
      : "debug.spawnPress 不存在（应有此红）");
  }

  /* ---------- V23-C2 墙压·域外对照 ---------- */
  let C2 = { hp: null, hit: null };
  if (hasHooks) {
    await reset();
    await G(() => { const d = window.__game.debug; d.setPlayerPos(400, 470); d.spawnPress(330); }); /* 距70>26；玩家 ≤420 不触发 W1 */
    await sleep(1600);
    const s = await st(); C2.hp = s.hp; const p = pressOf(s); C2.hit = p ? p.hit : null;
  }
  {
    const ok = hasHooks && C2.hp === 100 && C2.hit === false;
    report("V23-C2 墙压·域外对照(距70>26)", ok, hasHooks
      ? "hp 100→" + C2.hp + "（期望100） hit锁=" + C2.hit + "（期望false=从未入带；配合 C1 出 80 形成双侧）"
      : "debug.spawnPress 不存在（应有此红）");
  }

  /* ---------- V23-D1 墙压·冲刺免 ---------- */
  let D1 = { hp: null, hit: null, pressY: null, landX: null, pressed: false, f0: null };
  if (hasHooks) {
    await reset();
    /* 冲刺方向＝facing：先用真实输入按住 D 片刻把朝向定死为右，再回位摆板（不依赖上游场景的朝向残留） */
    await G(() => window.__game.debug.setPlayerPos(345, 470));
    await page.keyboard.down("d"); await sleep(80); await page.keyboard.up("d");
    await G(() => { const d = window.__game.debug; d.setPlayerPos(345, 470); d.spawnPress(400); });
    /* 页面内 rAF 逐帧触发（零往返延迟）：板顶 y∈[240,267) 时派发真 KeyK ⇒ 落点≈395±10 入带 */
    const r = await G(() => new Promise(res => {
      const done = (o) => res(o); let pressY = null, landX = null, f0 = null, n = 0;
      const to = setTimeout(() => done({ timeout: true, pressY: pressY, landX: landX, f0: f0 }), 6000);
      const tick = () => {
        n++; if (n > 400) { clearTimeout(to); return done({ tooMany: true, pressY: pressY, landX: landX, f0: f0 }); }
        const s = window.__game.state();
        const p = s.traps.filter(t => t.type === "press")[0];
        if (!p) { clearTimeout(to); return done({ gone: true, pressY: pressY, landX: landX, f0: f0 }); }
        if (p.phase === "slam" && pressY === null && p.y >= 240 && p.y < 330) {
          pressY = p.y; f0 = s.player.facing;
          window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyK", key: "k" }));
          window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyK", key: "k" })); }
        if (p.phase === "stay" && landX === null) landX = s.player.x;
        if (p.phase === "stay" && p.hit) { clearTimeout(to); return done({ pressY: pressY, landX: landX, f0: f0, hit: true, hp: s.player.hp }); }
        if (s.player.hp < 100) { clearTimeout(to); return done({ pressY: pressY, landX: landX, f0: f0, hit: !!p.hit, hp: s.player.hp }); }
        requestAnimationFrame(tick); };
      requestAnimationFrame(tick); }));
    D1.pressY = r.pressY; D1.landX = r.landX; D1.hit = r.hit === undefined ? null : r.hit; D1.pressed = r.pressY !== null && r.pressY !== undefined; D1.f0 = r.f0;
    D1.hp = r.hp === undefined ? (await st()).hp : r.hp;
  }
  {
    const ok = hasHooks && D1.pressed && D1.hp === 100 && D1.hit === true;
    report("V23-D1 墙压·冲刺免", ok, hasHooks
      ? "按K于y=" + D1.pressY + "（slam 中段，朝向=" + D1.f0 + " 期望1） 落点x=" + (D1.landX === null || D1.landX === undefined ? "n/a" : D1.landX.toFixed(1)) + " hp=" + D1.hp + "（期望100=冲刺门放行不伤；若门破=80） hit锁=" + D1.hit + "（期望true=确入带，排除【没踩到】）"
      : "debug.spawnPress 不存在（应有此红）");
  }

  /* ---------- V23-D2 墙压·跳无效 ---------- */
  let D2 = { hp: null, minPy: 999, jumped: false };
  if (hasHooks) {
    await reset();
    await G(() => { const d = window.__game.debug; d.setPlayerPos(400, 470); d.spawnPress(400); });
    for (let i = 0; i < 200; i++) {
      await sleep(20);
      const s = await st(); D2.minPy = Math.min(D2.minPy, s.py);
      const p = pressOf(s);
      if (p && p.phase === "slam" && !D2.jumped) { D2.jumped = true; await page.keyboard.down("Space"); }
      if (s.hp < 100) { D2.hp = s.hp; break; } }
    await page.keyboard.up("Space");
  }
  {
    const ok = hasHooks && D2.jumped && D2.hp === 80 && D2.minPy < 440;
    report("V23-D2 墙压·跳无效", ok, hasHooks
      ? "起跳=" + D2.jumped + " 全程最高足位 y=" + (D2.minPy === 999 ? "n/a" : D2.minPy.toFixed(0)) + "（<440=确腾空） hp=" + D2.hp + "（期望80=自上而下跳不避）"
      : "debug.spawnPress 不存在（应有此红）");
  }

  /* ---------- V23-E 阶段链 p1→p2→p3 ---------- */
  let E = { p1: null, hpA: null, phA: null, minA: null, hpB: null, phB: null, minB: null, hpC: null, phC: null, narrC: null, log: [], kindsA: null };
  if (hasHooks) {
    await reset();
    await G(() => window.__game.debug.spawnBoss(828));
    const s0 = await st(); E.p1 = { hp: s0.boss.hp, ph: s0.boss.phase, narr: s0.boss.narr, intro: s0.log.indexOf("boss_intro") >= 0 };
    await G(() => window.__game.debug.bossDamage(40));
    await sleep(150);
    const s1 = await st(); E.hpA = s1.boss.hp; E.phA = s1.boss.phase; E.minA = s1.enemies; E.kindsA = (await G(() => window.__game.state().enemies.filter(e => e.hp > 0).map(e => e.kind))).join(",");
    await G(() => window.__game.debug.bossDamage(5));
    await sleep(150);
    const s2 = await st(); E.hpB = s2.boss.hp; E.phB = s2.boss.phase; E.minB = s2.enemies;
    await G(() => window.__game.debug.bossDamage(35));
    await sleep(150);
    const s3 = await st(); E.hpC = s3.boss.hp; E.phC = s3.boss.phase; E.narrC = s3.boss.narr; E.log = s3.log;
    await shot("boss-enraged");
  }
  {
    const halfFired = E.log.indexOf("boss_half") >= 0, lowFired = E.log.indexOf("boss_low") >= 0;
    const ok = hasHooks && E.p1 && E.p1.hp === 120 && E.p1.ph === 1 && E.p1.narr === "idle" && E.p1.intro
      && E.hpA === 80 && E.phA === 2 && halfFired && E.minA === 2 && E.kindsA === "red,red"
      && E.hpB === 75 && E.phB === 2 && E.minB === 2
      && E.hpC === 40 && E.phC === 3 && lowFired && E.narrC === "enraged";
    report("V23-E 阶段链 p1→p2→p3＋双红兵once", ok, hasHooks
      ? "spawn hp" + E.p1.hp + "/ph" + E.p1.ph + "/narr=" + E.p1.narr + "/intro日志=" + E.p1.intro + "；hp80⇒ph" + E.phA + "＋boss_half=" + halfFired + "＋小兵" + E.minA + "[" + E.kindsA + "]（期望2红 once）；hp75⇒ph" + E.phB + "小兵" + E.minB + "（期望仍2=不重复补）；hp40⇒ph" + E.phC + "＋boss_low=" + lowFired + "＋narr=" + E.narrC
      : "debug.spawnBoss/bossDamage 不存在（应有此红）");
  }

  /* ---------- V23-F BossNarrativeController 转移链 ---------- */
  let F = { intro: false, narr0: null, narr1: null, dead1: null, narr2: null, hp2: null };
  if (hasHooks) {
    await reset();
    await G(() => window.__game.debug.spawnBoss(828));
    await sleep(200);
    const s0 = await st(); F.intro = s0.log.indexOf("boss_intro") >= 0; F.narr0 = s0.boss.narr;
    await G(() => window.__game.debug.hurtPlayer(200));
    await sleep(300);
    const s1 = await st(); F.narr1 = s1.boss.narr; F.dead1 = s1.alive;
    await shot("boss-taunting");
    await G(() => window.__game.debug.bossDamage(85));
    await sleep(200);
    const s2 = await st(); F.narr2 = s2.boss.narr; F.hp2 = s2.boss.hp;
  }
  {
    const ok = hasHooks && F.intro && F.narr0 === "idle" && F.dead1 === false && F.narr1 === "taunting" && F.narr2 === "enraged" && F.hp2 === 35;
    report("V23-F 叙事控制器链 idle→taunting→enraged", ok, hasHooks
      ? "spawn narr=" + F.narr0 + "（期望idle，boss_intro日志=" + F.intro + "）⇒ 玩家倒下（dead=" + (F.dead1 === false) + "）narr=" + F.narr1 + "（期望taunting）⇒ hp" + F.hp2 + " narr=" + F.narr2 + "（期望enraged）"
      : "debug.spawnBoss 不存在（应有此红）");
  }

  /* ---------- V23-G 击败 ---------- */
  let Gg = { hp: null, dead: null, state: null, arena: null, defeat: false, after: null };
  if (hasHooks) {
    await reset();
    await G(() => window.__game.debug.spawnBoss(828));
    await G(() => window.__game.debug.bossDamage(200));
    await sleep(250);
    const s1 = await st(); Gg.hp = s1.boss.hp; Gg.dead = s1.boss.dead; Gg.state = s1.boss.state; Gg.arena = s1.arena; Gg.defeat = s1.log.indexOf("boss_defeat") >= 0;
    await shot("boss-down");
    await G(() => window.__game.debug.clearBoss());
    await sleep(150);
    const s2 = await st(); Gg.after = { active: s2.boss.active, narr: s2.boss.narr, arena: s2.arena, state: s2.boss.state };
  }
  {
    const A2 = Gg.after || {};
    const ok = hasHooks && Gg.hp === 0 && Gg.dead === true && Gg.state === "down" && Gg.defeat && Gg.arena === "boss"
      && A2.active === false && A2.narr === "off" && A2.arena === "prologue" && A2.state === "wait";
    report("V23-G 击败＋clearBoss", ok, hasHooks
      ? "hp=" + Gg.hp + " dead=" + Gg.dead + " state=" + Gg.state + "（期望down） boss_defeat日志=" + Gg.defeat + " 尸体期arena=" + Gg.arena + " ⇒ clearBoss 后 active=" + A2.active + " narr=" + A2.narr + " arena=" + A2.arena + " state=" + A2.state
      : "debug.spawnBoss/bossDamage/clearBoss 不存在（应有此红）");
  }

  /* ---------- V23-H T-BOSSHP 触发器 ---------- */
  let H = {};
  if (hasHooks) {
    await reset();
    H.h0 = await G(() => window.__game.debug.triggerCheck({ type: "bosshp", lte: 40 }));
    await G(() => window.__game.debug.spawnBoss(828));
    H.h1 = await G(() => window.__game.debug.triggerCheck({ type: "bosshp", lte: 40 }));
    H.h2 = await G(() => window.__game.debug.triggerCheck({ type: "bosshp", gte: 100 }));
    await G(() => window.__game.debug.bossDamage(85));
    await sleep(120);
    H.h3 = await G(() => window.__game.debug.triggerCheck({ type: "bosshp", lte: 40 }));
    H.h4 = await G(() => window.__game.debug.triggerCheck({ type: "bosshp", gte: 100 }));
    await G(() => window.__game.debug.bossDamage(40));
    await sleep(120);
    H.h5 = await G(() => window.__game.debug.triggerCheck({ type: "bosshp", lte: 40 }));
  }
  {
    const ok = hasHooks && H.h0 === false && H.h1 === false && H.h2 === true && H.h3 === true && H.h4 === false && H.h5 === false;
    report("V23-H T-BOSSHP 触发器", ok, hasHooks
      ? "无Boss{lte40}=" + H.h0 + "（期望false）；hp120{lte40,=false}=" + H.h1 + " {gte100,=true}=" + H.h2 + "；hp35{lte40,=true}=" + H.h3 + " {gte100,=false}=" + H.h4 + "；倒下{lte40,=false}=" + H.h5
      : "debug.spawnBoss/bossDamage 不存在（应有此红）");
  }

  /* ---------- V23-I arena 门（清小兵不清场） ---------- */
  let I = { wave: null, aliveAfterKill: null, blockedOk: null, blockedWave: null, resumed: null, resumedHow: null };
  if (hasHooks) {
    await reset();
    await G(() => window.__game.debug.setPlayerX(430)); /* x>420 ⇒ 序章 W1 开 */
    await sleep(350);
    const s0 = await st(); I.wave = s0.wave;
    await G(() => { const d = window.__game.debug; d.spawnBoss(828); d.bossDamage(200); }); /* 尸体期也须顶住门 */
    await sleep(200);
    await G(() => window.__game.debug.clearWave());
    await sleep(150);
    const s1 = await st(); I.aliveAfterKill = s1.enemies;
    /* 冻结判据：2.4s 内 wave 恒 1、cleared 恒 false、余敌恒 0（若门失效 ⇒ 1.2s 后 wave2 会开出 ⇒ 判红） */
    let blocked = true; I.blockedWave = null;
    for (let i = 0; i < 12; i++) { await sleep(200);
      const s = await st();
      I.blockedWave = s.wave;
      if (s.cleared || s.wave !== 1 || s.enemies !== 0) { blocked = false; break; } }
    I.blockedOk = blocked;
    await G(() => window.__game.debug.clearBoss());
    let resumed = false, how = "none";
    for (let i = 0; i < 15; i++) { await sleep(200);
      const r = await G(() => { const s = window.__game.state(); return { c: s.cleared, w: s.wave }; });
      if (r.c === true || r.w === 2) { resumed = true; how = r.c ? "cleared" : "wave2"; break; } }
    I.resumed = resumed; I.resumedHow = how;
  }
  {
    const ok = hasHooks && I.wave === 1 && I.aliveAfterKill === 0 && I.blockedOk === true && I.blockedWave === 1 && I.resumed === true;
    report("V23-I arena门·清小兵不清场", ok, hasHooks
      ? "wave=" + I.wave + "（W1 已开） 清光后余敌=" + I.aliveAfterKill + " ⇒ Boss在场 2.4s 采样：冻结=" + I.blockedOk + "（wave恒" + I.blockedWave + "、cleared 恒 false、余敌恒 0）⇒ clearBoss 后恢复=" + I.resumed + "（经 " + I.resumedHow + "）"
      : "debug.spawnBoss/clearWave/clearBoss 不存在（应有此红）");
  }

  /* ---------- V23-0 零错误 ---------- */
  report("V23-0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));
  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("探针崩溃：" + e.stack); process.exit(2); });
