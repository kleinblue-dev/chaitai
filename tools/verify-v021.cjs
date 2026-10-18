/* verify-v021.cjs —— 《拆台》v0.2 增量验收探针（Loop 2：ACTS 幕/遭遇数据表）
   依据 review-v02/d2-levels/design.md §3（编队表）＋§5（序章逐值不改行为）＋§9 施工序第②步。
   断言：
   V21-S 结构闸（红闸）：ACTS 五幕；序章 W1 红×2 800/880、W2 红×1紫×2 740/830/900；一幕 3 场；
        E1-3 触发器 = stand(780,876,300)（T-STAND＝站上 T3）；触发类型 ∈ {zone,delay,curtain,stand}；
        兵种 ∈ {red,purple,elite}；终幕 Boss hp=120；registry.acts 5 条。对 v0.1.2 应红（无 debug.acts）。
   V21-P 平价钉（结构依赖）：序章 W2 镜像公式 = v0.1.2 :311 原式逐字（b=player.x+270; b+180>934→b=player.x−450;
        ex=max(60,b+90i)）——4 个玩家站位下出生点与字面量逐值相等：
        300→740/830/900 ｜ 481→751/841/931 ｜ 600→150/240/330 ｜ 934→484/574/664；W1 恒 800/880。
        读数用 world.lastSpawn 出生记录（免疫出生后移动）。红侧无该钩子 ⇒ 红（预期）。
   V21-T T-STAND 灰盒：站箱顶=真 ｜ 同触发器站地面=假 ｜ 地面位点(y=470)=真 ｜ 站箱顶但 x 出区=假。红侧无 triggerCheck ⇒ 红（预期）。
   V21-0 全程 0 pageerror / 0 console.error
   用法：node tools/verify-v021.cjs
   环境：CHAITAI_URL（覆盖被测页，默认正本）／CHAITAI_SHOT_PREFIX（截图前缀）
   先红后绿：对 versions/v0.1.2/index.html 跑 => S、P、T 红（0 通过项全在预期 ID）；对正本跑 => 全绿（rc=0） */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v021/v021");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v021 ==");
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

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(400);

  /* ---------- V21-S 结构闸（红闸） ---------- */
  const S = await page.evaluate(() => {
    const g = window.__game, out = { has: false };
    if (!g.debug || !g.debug.acts) return out;
    out.has = true;
    const A = g.debug.acts;
    out.actsN = Object.keys(A).length;
    out.w1 = A[1].encounters[0].spawns.map(s => s.k + ":" + s.x).join(",");
    out.w2 = A[1].encounters[1].spawns.map(s => s.k + ":" + s.x).join(",");
    out.e1N = A[2].encounters.length;
    const t = A[2].encounters[2].trigger;
    out.t13 = t.type + "(" + t.x0 + "," + t.x1 + "," + t.y + ")";
    const types = [], kinds = [], eliteSites = [];
    [1, 2, 3, 4].forEach(a => A[a].encounters.forEach((e, ei) => {
      if (types.indexOf(e.trigger && e.trigger.type) < 0) types.push(e.trigger && e.trigger.type);
      e.spawns.forEach((s, si) => { if (kinds.indexOf(s.k) < 0) kinds.push(s.k);
        if (s.k === "elite") eliteSites.push("A" + a + "E" + (ei + 1) + "#" + (si + 1)); }); }));
    out.types = types; out.kinds = kinds; out.eliteSites = eliteSites; /* W7 补偿钉通道 */
    out.bossHp = A[5] && A[5].boss ? A[5].boss.hp : null;
    out.regActs = g.debug.registry.acts.length;
    return out;
  });
  {
    const allowedT = ["zone", "delay", "curtain", "stand"], allowedK = ["red", "purple", "elite"];
    const ok = S.has && S.actsN === 5 && S.w1 === "red:800,red:880" && S.w2 === "red:740,purple:830,purple:900"
      && S.e1N === 3 && S.t13 === "stand(780,876,300)" && S.bossHp === 120 && S.regActs === 5
      && S.types.every(t => allowedT.indexOf(t) >= 0) && S.kinds.every(k => allowedK.indexOf(k) >= 0)
      && (S.eliteSites || []).join(",") === "A2E3#3"; /* W7 补偿钉：白名单放宽（+elite）的补偿——全场精英仅 E1-3#3 一处 */
    report("V21-S 幕表结构", ok, S.has
      ? "五幕=" + S.actsN + " W1=" + S.w1 + " W2=" + S.w2 + " 一幕场数=" + S.e1N + " E1-3触发=" + S.t13
        + " 触发类型=[" + S.types + "] 兵种=[" + S.kinds + "] 精英位=[" + (S.eliteSites || []) + "] BossHP=" + S.bossHp + " registry.acts=" + S.regActs
      : "debug.acts 不存在（v0.1.2 无幕表，应有此红）");
  }

  /* ---------- V21-P 平价钉（序章 W2 镜像公式 ≡ v0.1.2 :311 原式） ---------- */
  const hasHook = await page.evaluate(() => typeof (window.__game.debug.lastSpawn) === "function");
  const SC = [
    { px: 300, want: [740, 830, 900] },   // 无镜像（x≤480）
    { px: 481, want: [751, 841, 931] },   // 镜像右：b=481+270=751，751+180≤934 不翻
    { px: 600, want: [150, 240, 330] },   // 镜像右越界 → 翻左：b=600−450=150
    { px: 934, want: [484, 574, 664] },   // 镜像右越界 → 翻左：b=934−450=484
  ];
  const scen = [];
  if (hasHook) {
    for (const sc of SC) {
      await page.evaluate(() => window.__game.debug.reset());
      await sleep(350);
      await page.evaluate(() => window.__game.debug.setPlayerX(430));      // 触发 W1（x>420）
      for (let i = 0; i < 20; i++) { await sleep(120);
        if (await page.evaluate(() => window.__game.state().wave) === 1) break; }
      const w1 = await page.evaluate(() => window.__game.debug.lastSpawn());
      await page.evaluate(() => window.__game.debug.clearWave());
      await page.evaluate(x => window.__game.debug.setPlayerX(x), sc.px);  // 站到平价点，等 W2 出生
      let w2 = null;
      for (let i = 0; i < 40; i++) { await sleep(150);
        const r = await page.evaluate(() => { const g = window.__game;
          return { wave: g.state().wave, ls: g.debug.lastSpawn ? g.debug.lastSpawn() : null }; });
        if (r.wave === 2 && r.ls && r.ls.id === "W2") { w2 = r.ls; break; } }
      const xs = w2 ? w2.born.map(o => o.x) : null;
      const w1ok = !!(w1 && w1.id === "W1" && w1.born[0].k === "red" && w1.born[0].x === 800 && w1.born[1].k === "red" && w1.born[1].x === 880);
      const ok = w1ok && xs && xs.length === 3 && xs.every((x, i) => Math.abs(x - sc.want[i]) < 0.001);
      scen.push({ px: sc.px, xs, w1ok, ok });
      if (sc.px === 600) await shot("wave2-parity");   // 截一张出生画面（证据用）
    }
  }
  {
    const ok = hasHook && scen.length === 4 && scen.every(s => s.ok);
    const fmt = hasHook
      ? scen.map(s => "px" + s.px + "→[" + (s.xs ? s.xs.join(",") : "n/a") + "]" + (s.ok ? "✓" : "✗(期望" + JSON.stringify(SC.find(c => c.px === s.px).want) + ")")).join(" ｜ ")
        + "；W1 恒 800/880=" + scen.every(s => s.w1ok)
      : "debug.lastSpawn 钩子不存在（v0.1.2 无出生读数，应有此红）";
    report("V21-P 序章编队平价钉(vs :311 原式)", ok, fmt);
  }

  /* ---------- V21-T T-STAND 灰盒（判定器） ---------- */
  const hasTC = await page.evaluate(() => typeof (window.__game.debug.triggerCheck) === "function");
  let T = { onTop: false };
  if (hasTC) {
    await page.evaluate(() => window.__game.debug.reset());
    await sleep(350);
    await page.evaluate(() => { const d = window.__game.debug;
      d.setPlatforms([{ x: 470, y: 420, w: 64, h: 50 }]); d.setPlayerX(464); });
    await sleep(300);
    await page.keyboard.down("Space"); await sleep(400); await page.keyboard.up("Space");
    for (let i = 0; i < 20; i++) { await sleep(150);
      const s = await page.evaluate(() => window.__game.state());
      if (s.player.grounded && Math.abs(s.player.y - 420) < 3) { T.onTop = true; break; } }
    T.t1 = await page.evaluate(() => window.__game.debug.triggerCheck({ type: "stand", x0: 400, x1: 534, y: 420 }));  // 站箱顶 → 真
    T.t2 = await page.evaluate(() => window.__game.debug.triggerCheck({ type: "stand", x0: 600, x1: 700, y: 420 }));  // 站箱顶但 x 出区 → 假
    await shot("tstand-ontop");
    await page.evaluate(() => window.__game.debug.clearWave());   // 清场防干扰（右上行会触发 W1）
    await page.keyboard.down("KeyD"); await sleep(400); await page.keyboard.up("KeyD");
    for (let i = 0; i < 12; i++) { await sleep(150);
      const s = await page.evaluate(() => window.__game.state());
      if (s.player.grounded && s.player.y > 440) break; }
    T.t3 = await page.evaluate(() => window.__game.debug.triggerCheck({ type: "stand", x0: 400, x1: 534, y: 420 }));  // 站地面 ≠ 箱顶触发器 → 假
    T.t4 = await page.evaluate(() => window.__game.debug.triggerCheck({ type: "stand", x0: 24, x1: 934, y: 470 }));   // 地面位点(y=470) 可表达 → 真
    await shot("tstand-ground");
  }
  {
    const ok = hasTC && T.onTop === true && T.t1 === true && T.t2 === false && T.t3 === false && T.t4 === true;
    report("V21-T T-STAND 判定器(灰盒)", ok, hasTC
      ? "站箱顶=" + T.onTop + " ｜站箱顶+位点(400-534,420)→真=" + T.t1 + " ｜站箱顶+x出区→假=" + (T.t2 === false)
        + " ｜站地面+同触发器→假=" + (T.t3 === false) + " ｜地面位点(24-934,470)→真=" + T.t4
      : "debug.triggerCheck 不存在（v0.1.2 无判定器，应有此红）");
  }

  /* ---------- V21-0 零错误 ---------- */
  report("V21-0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));
  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("探针崩溃：" + e.stack); process.exit(2); });
