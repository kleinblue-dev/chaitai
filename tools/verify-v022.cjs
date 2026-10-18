/* verify-v022.cjs —— 《拆台》v0.2 增量验收探针（Loop 3：机关 spawner 灯带/道具坠落）
   依据 review-v02/d2-levels/design.md §4（机关表）＋§9 施工序第③步＋d5-audio/audio-plan.md（缺 3 条预警音）。
   断言：
   V22-A 灯带轨迹/包络（红闸）：spawnLamp(6) 后逐样本核对公式 x=480+420·sin(2πt/T)（同帧读数，容差 0.2px），
        warnX=x(t+0.8) 同式；一个周期内包络到边（maxX>890、minX<70）。对 v0.1.2 应红（无 debug.spawnLamp）。
   V22-B 灯带三判据（结构依赖）：
        B1 贴地命中＝12：站 300 不动，光束扫过 ⇒ hp 100→88 恰一次，命中时刻 ∈[3.15,3.75]s（预期过线 3.42s），wave=0（无敌人干扰）。
        B2 站箱免伤：箱{330,390,72,16} 跳上去（y≈390≤420），光束过 324 窗口 [3.23,3.50]s ⇒ hp 恒 100 且确证光束入窗(minDist<40)。
        B3 腾空免伤：站谷点 x=60，T=2.5 谷点 t=1.875，窗口 [1.670,2.080]s；t≈1.4-1.6 起跳（全跳保持≥0.9s）
           ⇒ 全部 dist<54 样本 py≤450 且 hp 恒 100；命中则整项红（保守到可判错）。
   V22-C 落物四判据（结构依赖）：
        C1 预警时序：落点 400、玩家 190 远处；warn→fall 转换 age≈0.7（±0.12），落地消失 ≈1.50s 总时长（∈[1.35,2.0]）。
        C2 正中命中＝14：玩家站 400 ⇒ hp 100→86 恰一次。
        C3 跳跃无效：玩家站 400，坠落段起跳×2 ⇒ 仍受击 hp=86 且确证腾空过（minPy<450）。
        C4 域外对照：玩家 340（距落点 60 > 半径 34）⇒ hp 恒 100。
   V22-D 错峰波（结构依赖）：dropBurst([300,480,660],0.35)：3 枚"fall"起始时刻差 ≈0.35/0.70（±0.12/±0.15），全部落地清空。
   V22-0 全程 0 pageerror / 0 console.error
   用法：node tools/verify-v022.cjs
   环境：CHAITAI_URL（覆盖被测页，默认正本）／CHAITAI_SHOT_PREFIX（截图前缀）
   先红后绿：对 versions/v0.1.2/index.html 跑 => A/B/C/D 红（0 通过项全在预期 ID）；对正本跑 => 全绿（rc=0） */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v022/v022");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v022 ==");
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
  const reset = async () => { await page.evaluate(() => { const d = window.__game.debug; d.reset(); if (d.setPlatforms) d.setPlatforms([]); }); await sleep(350); };
  const lampOf = () => page.evaluate(() => window.__game.state().traps.filter(t => t.type === "lamp")[0] || null);

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(400);

  const hooks = await page.evaluate(() => { const d = window.__game.debug;
    return { lamp: typeof d.spawnLamp === "function", drop: typeof d.spawnDrop === "function", burst: typeof d.dropBurst === "function" }; });
  const hasHooks = hooks.lamp && hooks.drop && hooks.burst;

  /* ---------- V22-A 灯带轨迹/包络（红闸） ---------- */
  let A = { ok: 0, n: 0, maxErr: 0, minX: 1e9, maxX: -1e9 };
  if (hasHooks) {
    await reset();
    await page.evaluate(() => window.__game.debug.spawnLamp(6));
    for (let i = 0; i < 70; i++) {
      await sleep(100);
      const r = await lampOf();
      if (!r) break;
      const xw = 480 + 420 * Math.sin(2 * Math.PI * r.t / 6);
      const ww = 480 + 420 * Math.sin(2 * Math.PI * (r.t + 0.8) / 6);
      const e1 = Math.abs(r.x - xw), e2 = Math.abs(r.warnX - ww);
      A.n++; A.maxErr = Math.max(A.maxErr, e1, e2);
      A.minX = Math.min(A.minX, r.x); A.maxX = Math.max(A.maxX, r.x);
      if (i === 12) await shot("lamp-beam");
    }
  }
  {
    const ok = hasHooks && A.n >= 50 && A.maxErr <= 0.2 && A.maxX > 890 && A.minX < 70;
    report("V22-A 灯带轨迹/包络(vs 公式)", ok, hasHooks
      ? "样本=" + A.n + " 公式最大偏差=" + A.maxErr.toFixed(3) + "px 包络[" + A.minX.toFixed(1) + "," + A.maxX.toFixed(1) + "]（期望≈[60,900]，>890/<70）"
      : "debug.spawnLamp 不存在（v0.1.2 无机关系统，应有此红）");
  }

  /* ---------- V22-B1 灯带·贴地命中=12 ---------- */
  let B1 = { hp: null, hitT: null, wave: null };
  if (hasHooks) {
    await reset();
    await page.evaluate(() => window.__game.debug.setPlayerX(300));
    await page.evaluate(() => window.__game.debug.spawnLamp(6));
    for (let i = 0; i < 80; i++) {
      await sleep(100);
      const r = await page.evaluate(() => { const s = window.__game.state(); const tr = s.traps.filter(t => t.type === "lamp")[0];
        return { hp: s.player.hp, t: tr ? tr.t : null, wave: s.wave }; });
      if (r.hp < 100) { B1.hp = r.hp; B1.hitT = r.t; B1.wave = r.wave; break; }
      B1.wave = r.wave;
    }
  }
  {
    const ok = hasHooks && B1.hp === 88 && B1.hitT !== null && B1.hitT >= 3.15 && B1.hitT <= 3.75 && B1.wave === 0;
    report("V22-B1 灯带·贴地命中=12", ok, hasHooks
      ? "hp 100→" + B1.hp + " 命中时刻 t=" + (B1.hitT === null ? "n/a" : B1.hitT.toFixed(2)) + "s（期望≈3.42 区间[3.15,3.75]） wave=" + B1.wave + "（0=无敌人干扰）"
      : "debug.spawnLamp 不存在（应有此红）");
  }

  /* ---------- V22-B2 灯带·站箱免伤 ---------- */
  let B2 = { landTop: false, hpMin: 200, minDist: 999, badGrounded: false, seen: 0 };
  if (hasHooks) {
    await reset();
    await page.evaluate(() => { const d = window.__game.debug; d.setPlatforms([{ x: 330, y: 390, w: 72, h: 16 }]); d.setPlayerX(324); });
    await sleep(300);
    await page.keyboard.down("Space"); await sleep(400); await page.keyboard.up("Space");
    for (let i = 0; i < 20; i++) { await sleep(150);
      const s = await page.evaluate(() => window.__game.state());
      if (s.player.grounded && Math.abs(s.player.y - 390) < 3) { B2.landTop = true; break; } }
    await page.evaluate(() => window.__game.debug.spawnLamp(6));
    for (let i = 0; i < 46; i++) { await sleep(100);
      const r = await page.evaluate(() => { const s = window.__game.state(); const tr = s.traps.filter(t => t.type === "lamp")[0];
        return { t: tr ? tr.t : null, bx: tr ? tr.x : null, y: s.player.y, hp: s.player.hp }; });
      if (r.t === null || r.t > 4.1) break;
      B2.seen++;
      const d = Math.abs(r.bx - 324); B2.minDist = Math.min(B2.minDist, d);
      B2.hpMin = Math.min(B2.hpMin, r.hp);
      if (d < 54 && r.y > 450) B2.badGrounded = true;
      if (i === 33) await shot("lamp-boxTop");
    }
  }
  {
    const ok = hasHooks && B2.landTop && B2.seen >= 30 && B2.minDist < 40 && B2.hpMin === 100 && !B2.badGrounded;
    report("V22-B2 灯带·站箱免伤", ok, hasHooks
      ? "上箱顶=" + B2.landTop + " 样本=" + B2.seen + " 光束最近距=" + (B2.minDist === 999 ? "n/a" : B2.minDist.toFixed(1)) + "px（期望<40=光束确过） hp-min=" + B2.hpMin + "（期望100） 窗口内曾贴地=" + B2.badGrounded + "（期望false）"
      : "debug.spawnLamp 不存在（应有此红）");
  }

  /* ---------- V22-B3 灯带·腾空免伤（谷点跳） ---------- */
  let B3 = { pressed: false, hpEnd: null, minDist: 999, badGrounded: false, n: 0 };
  if (hasHooks) {
    await reset();
    await page.evaluate(() => window.__game.debug.setPlayerX(60));
    await page.evaluate(() => window.__game.debug.spawnLamp(2.5));
    for (let i = 0; i < 80; i++) {
      await sleep(40);
      const r = await page.evaluate(() => { const s = window.__game.state(); const tr = s.traps.filter(t => t.type === "lamp")[0];
        return { t: tr ? tr.t : null, bx: tr ? tr.x : null, y: s.player.y, hp: s.player.hp }; });
      if (r.t === null) break;
      B3.n++;
      const d = Math.abs(r.bx - 60); B3.minDist = Math.min(B3.minDist, d);
      if (d < 54 && r.y > 450) B3.badGrounded = true;
      if (!B3.pressed && r.t >= 1.40 && r.t < 1.60) { B3.pressed = true; await page.keyboard.down("Space"); }
      if (r.t > 2.45) { await page.keyboard.up("Space"); B3.hpEnd = r.hp; break; }
      B3.hpEnd = r.hp;
    }
    await page.keyboard.up("Space");
  }
  {
    const ok = hasHooks && B3.pressed && B3.hpEnd === 100 && B3.minDist < 30 && !B3.badGrounded;
    report("V22-B3 灯带·腾空免伤(谷点跳)", ok, hasHooks
      ? "起跳=" + B3.pressed + " 样本=" + B3.n + " 光束最近距=" + (B3.minDist === 999 ? "n/a" : B3.minDist.toFixed(1)) + "px（期望<30=确入窗口） hp=" + B3.hpEnd + "（期望100） 窗口内曾贴地=" + B3.badGrounded + "（期望false）"
      : "debug.spawnLamp 不存在（应有此红）");
  }

  /* ---------- V22-C1 落物·预警时序 ---------- */
  let C1 = { fallAge: null, goneMs: null, sawWarn: false };
  if (hasHooks) {
    await reset();
    const t0 = Date.now();
    await page.evaluate(() => window.__game.debug.spawnDrop(400));
    for (let i = 0; i < 50; i++) {
      await sleep(60);
      const r = await page.evaluate(() => window.__game.state().traps.filter(t => t.type === "drop").map(t => ({ phase: t.phase, age: t.age })));
      if (r.length === 0) { C1.goneMs = Date.now() - t0; break; }
      if (r[0].phase === "warn") C1.sawWarn = true;
      if (r[0].phase === "fall" && C1.fallAge === null) C1.fallAge = r[0].age;
      if (i === 6) await shot("drop-warn");
      if (i === 14) await shot("drop-fall");
    }
  }
  {
    const ok = hasHooks && C1.sawWarn && C1.fallAge !== null && Math.abs(C1.fallAge - 0.7) <= 0.12
      && C1.goneMs !== null && C1.goneMs >= 1350 && C1.goneMs <= 2000;
    report("V22-C1 落物·预警时序", ok, hasHooks
      ? "warn阶段所见=" + C1.sawWarn + " fall转换age=" + (C1.fallAge === null ? "n/a" : C1.fallAge.toFixed(2)) + "（期望0.7±0.12） 落地清空=" + C1.goneMs + "ms（期望1350-2000，理论1498）"
      : "debug.spawnDrop 不存在（应有此红）");
  }

  /* ---------- V22-C2 落物·正中命中=14 ---------- */
  let C2 = { hp: null, left: null };
  if (hasHooks) {
    await reset();
    await page.evaluate(() => { const d = window.__game.debug; d.setPlayerX(400); d.spawnDrop(400); });
    await sleep(2200);
    const r = await page.evaluate(() => ({ hp: window.__game.state().player.hp, left: window.__game.state().traps.length }));
    C2.hp = r.hp; C2.left = r.left;
  }
  {
    const ok = hasHooks && C2.hp === 86 && C2.left === 0;
    report("V22-C2 落物·正中命中=14", ok, hasHooks
      ? "hp 100→" + C2.hp + "（期望86=只中一次） 残留机关=" + C2.left + "（期望0=已落地清空）"
      : "debug.spawnDrop 不存在（应有此红）");
  }

  /* ---------- V22-C3 落物·跳跃无效 ---------- */
  let C3 = { hpEnd: null, minPy: 999, pressed: 0 };
  if (hasHooks) {
    await reset();
    await page.evaluate(() => { const d = window.__game.debug; d.setPlayerX(400); d.spawnDrop(400); });
    for (let i = 0; i < 40; i++) { await sleep(50);
      const a = await page.evaluate(() => { const tr = window.__game.state().traps.filter(t => t.type === "drop")[0]; return tr ? tr.age : 9; });
      if (a >= 0.72) { C3.pressed++; await page.keyboard.down("Space"); break; } }
    await sleep(250); await page.keyboard.up("Space");
    await sleep(150);
    await page.keyboard.down("Space"); C3.pressed++; await sleep(250); await page.keyboard.up("Space");
    for (let i = 0; i < 30; i++) { await sleep(60);
      const r = await page.evaluate(() => ({ py: window.__game.state().player.y, hp: window.__game.state().player.hp }));
      C3.minPy = Math.min(C3.minPy, r.py); C3.hpEnd = r.hp; }
  }
  {
    const ok = hasHooks && C3.hpEnd === 86 && C3.pressed === 2 && C3.minPy < 450;
    report("V22-C3 落物·跳跃无效", ok, hasHooks
      ? "起跳次数=" + C3.pressed + " 全程最低足位 y=" + (C3.minPy === 999 ? "n/a" : C3.minPy.toFixed(0)) + "（<450=确腾空） hp 终=" + C3.hpEnd + "（期望86=跳跃未躲过）"
      : "debug.spawnDrop 不存在（应有此红）");
  }

  /* ---------- V22-C4 落物·域外对照 ---------- */
  let C4 = { hp: null };
  if (hasHooks) {
    await reset();
    await page.evaluate(() => { const d = window.__game.debug; d.setPlayerX(340); d.spawnDrop(400); });
    await sleep(2200);
    C4.hp = await page.evaluate(() => window.__game.state().player.hp);
  }
  {
    const ok = hasHooks && C4.hp === 100;
    report("V22-C4 落物·域外对照(距60>34)", ok, hasHooks
      ? "hp 100→" + C4.hp + "（期望100=半径 34 外不打；配合 C2 正中 86 形成双侧）"
      : "debug.spawnDrop 不存在（应有此红）");
  }

  /* ---------- V22-D 错峰波 ---------- */
  let D = { seen3: false, fallT: {}, gone: false };
  if (hasHooks) {
    await reset();
    await page.evaluate(() => window.__game.debug.dropBurst([300, 480, 660], 0.35));
    for (let i = 0; i < 60; i++) {
      await sleep(50);
      const r = await page.evaluate(() => window.__game.state().traps.filter(t => t.type === "drop").map(t => ({ x: t.x, phase: t.phase, abs: +(t.age + t.lead).toFixed(2) })));
      if (r.length === 3) D.seen3 = true;
      if (r.length === 0) { D.gone = true; break; }
      for (const o of r) if (o.phase === "fall" && D.fallT[o.x] === undefined) D.fallT[o.x] = o.abs;
    }
  }
  {
    const f = D.fallT;
    const ok = hasHooks && D.seen3 && D.gone && f[300] !== undefined && f[480] !== undefined && f[660] !== undefined
      && Math.abs((f[480] - f[300]) - 0.35) <= 0.12 && Math.abs((f[660] - f[300]) - 0.70) <= 0.15;
    report("V22-D 落物·错峰波(0.35s)", ok, hasHooks
      ? "3枚同现=" + D.seen3 + " fall起始 300→" + (f[300] === undefined ? "n/a" : f[300]) + "s/480→" + (f[480] === undefined ? "n/a" : f[480]) + "s/660→" + (f[660] === undefined ? "n/a" : f[660]) + "s（差期望0.35/0.70） 全部清空=" + D.gone + "（摆点间距300-480-660=180px≥140 ✓）"
      : "debug.dropBurst 不存在（应有此红）");
  }

  /* ---------- V22-0 零错误 ---------- */
  report("V22-0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));
  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("探针崩溃：" + e.stack); process.exit(2); });
