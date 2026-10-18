/* verify-w41-knock.cjs —— 《拆台》W4.1 A 批 A4：敲门回响（火花＋震屏＋旁白，1.5s 冷却）验收探针
   依据：批量A-实施清单.md A4（K1·8 名独立）——砌好的不可拆墙被 J 敲中时：wall.hitFlash=0.14＋addTrauma(0.06)
   ＋1.5s 冷却内 Narr.fire("wall_touch")（打字机台词档位随 fc 递进，台词资产 narrator-lines.json 已有，不改）。
   键流：真实按键——4+ 次进左区砌墙（gate-4 流程）→ 走到 x>232 等墙升起 → 贴墙（A 压到 x=166 钳位）。
   断言（先红后绿）：
   W41K.1 单次敲击恰 +1 fire（红侧旧码：+0＝「敲门没有回声」；火花/闪白/震屏走截图目检，state 不暴露）
   W41K.2 冷却：1.5s 内连敲两次只 fire 1 次（红侧：+0 ⇒ 红）
   W41K.3 档位递进：足距三敲 fire +3 且每敲 0.7s 窗口内打字机出现过 json 按 fc 推演的预期行（红侧：+0 ⇒ 红）
   W41K.4 无回归·敲击计数：单挥击 world.wallHits 恰 +1（a.wallKnock 双帧锁）；六个 J 全敲中 ⇒ 总 +6
   W41K.5 无回归·身体撞墙路径（:427）仍单局一次：贴墙反复推 A 不再 fire
   W41K.0 全程 0 pageerror / 0 console.error
   用法：node tools/verify-w41-knock.cjs
   环境：CHAITAI_URL（默认正本）／CHAITAI_SHOT_PREFIX
   先红后绿：改码前 ⇒ W41K.1/.2/.3 红、.4/.5/.0 绿；改码后 ⇒ 全绿 rc=0 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-w41-knock/w41k");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 台词档位推演（与 Narr.fire 同式：tier=clamp(fc,0,T-1)，pick=该档已被点次数 mod 长度） */
const NL = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/narrator-lines.json"), "utf8"));
const TIERS = NL.lines.wall_touch.tiers;
function expText(n) { /* n = 第 n 次 fire（1 起） */
  const T = TIERS.length, t = Math.min(n - 1, T - 1), arr = TIERS[t];
  const idx = (n <= T) ? 0 : ((n - T) % arr.length);
  return arr[idx].text;
}

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-w41-knock（A4 敲门回响） ==");
  console.log("URL  = " + URL_);
  let dir = ROOT;
  try { const u = new URL(URL_); if (u.protocol === "file:") dir = path.dirname(decodeURIComponent(u.pathname.replace(/^\//, ""))); } catch (e) {}
  console.log("md5  = game.js " + md5(path.join(dir, "game.js")) + " / index.html " + md5(path.join(dir, "index.html")) + "（被测目录 " + dir + "）");
  console.log("台词档=wall_touch " + TIERS.length + " 档（" + TIERS.map(a => a.length).join("+") + " 条）");
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
  const st = () => page.evaluate(() => window.__game.state());
  const fires = async () => page.evaluate(() => (window.__game.state().narrator.log || []).filter(k => k === "wall_touch").length);

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await page.waitForFunction('window.__game.state().phase === "playing"', { timeout: 4000 });

  const holdUntil = async (key, pred, ms) => {
    await page.keyboard.down(key);
    const t0 = Date.now(); let ok = false, last = null;
    while (Date.now() - t0 < ms) { last = await st(); if (pred(last)) { ok = true; break; } await sleep(70); }
    await page.keyboard.up(key); await sleep(60);
    return { ok, last };
  };

  /* —— 砌墙键流（gate-4 同流程）—— */
  const doEntry = async () => {
    const inR = await holdUntil("KeyA", s => s.player.x < 115, 5000);
    await sleep(320);
    const sIn = await st();
    await holdUntil("KeyD", s => s.player.x > 185, 6000);
    await sleep(140);
    return { inOk: inR.ok && sIn.player.x < 120, defy: sIn.narrator.counters.defyLeft };
  };
  for (let i = 1; i <= 4; i++) { const e = await doEntry(); console.log("  进区# " + i + "：" + (e.inOk ? "x<120 ✓" : "没到位") + " defyLeft=" + e.defy); }
  let extra = 0;
  while ((await st()).narrator.counters.defyLeft < 4 && extra < 3) { extra++; const e = await doEntry(); console.log("  补进区# " + extra + "：defyLeft=" + e.defy); }

  const walkR = await holdUntil("KeyD", s => s.player.x > 232, 8000);
  let built = false;
  try { await page.waitForFunction('window.__game.state().wall.built === true', { timeout: 6000 }); built = true; } catch (e) {}
  console.log("  砌墙：" + (built ? "wall.built=true ✓" : "6s 未升起") + "（右移腿 " + (walkR.ok ? "到 x=" + walkR.last.player.x : "没走完") + "）");
  await shot("01-wall");

  /* —— 贴墙（A 压到钳位 x=166）—— */
  await holdUntil("KeyA", s => s.player.x <= 167, 4000);
  await sleep(300);
  const s0 = await st();
  const fires0 = await fires(), hits0 = s0.wallHits;
  console.log("  贴墙：x=" + s0.player.x + " wallHits=" + hits0 + "（此前 wall_touch fire=" + fires0 + "，含撞墙路径至多 1）");

  /* ---------- W41K.1 单次敲击恰 +1 fire ---------- */
  await sleep(2200); /* 让砌墙/撞墙台词先吐完 */
  await page.keyboard.press("KeyJ");
  await sleep(260);
  await shot("02-knock");
  await sleep(1100);
  const f1 = await fires(), h1 = (await st()).wallHits;
  report("W41K.1 单次敲击恰 +1 fire", (f1 - fires0) === 1,
    "fire +" + (f1 - fires0) + "（期望 +1；红侧旧码 +0＝敲门无回声） wallHits +" + (h1 - hits0) + "（该字段不入断言，见 K.4）");

  /* ---------- W41K.2 冷却：1.5s 内两敲只 fire 1 ---------- */
  await sleep(900); /* 距上一次 fire ≥1.5s ⇒ 下一敲必 fire */
  await page.keyboard.press("KeyJ"); /* B1：应 fire */
  await sleep(500);
  await page.keyboard.press("KeyJ"); /* B2：距 B1 仅 0.5s，冷却内 ⇒ 不 fire */
  await sleep(1300);
  const f2 = await fires(), h2 = (await st()).wallHits;
  report("W41K.2 冷却·1.5s 内两敲只 fire 1", (f2 - f1) === 1,
    "窗口内 fire +" + (f2 - f1) + "（期望 +1；红侧 +0） wallHits +" + (h2 - h1) + "（两敲都应计入隐藏结局，仅旁白受冷却）");

  /* ---------- W41K.3 三敲档位递进 ---------- */
  /* 采样策略：敲墙算「挥空」(a.hit 不含 wall)，挥空旁白会在挥击尾(~0.32s)后 fire 可能盖住打字机行。
     故每敲在 0.7s 窗口内 60ms 轮询，采集出现过的不同当前行文本集合；预期行只要在该窗口内上屏即算命中
     （墙的回声先于挥空旁白上屏；红侧从不出现预期行 ⇒ 判红不受此策略影响）。 */
  const sampled = [];
  for (let i = 0; i < 3; i++) {
    const nBefore = await fires();          /* 本次 fire 将是第 nBefore+1 次 */
    await page.keyboard.press("KeyJ");
    const seen = new Set();
    for (let k = 0; k < 12; k++) {
      await sleep(60);
      const cur = await page.evaluate(() => window.__game.state().narrator.current);
      if (cur) seen.add(cur);
    }
    sampled.push({ n: nBefore + 1, seen: Array.from(seen), want: expText(nBefore + 1) });
    await sleep(1150); /* 两敲间隔 ≈1.9s（0.72 窗口＋1.15）≥1.5 ✅ */
  }
  await shot("03-tier");
  const f3 = await fires();
  const tierOk = (f3 - f2) === 3 && sampled.every(s => s.seen.indexOf(s.want) >= 0);
  report("W41K.3 三敲档位递进（fire +3＋文本=json 推演）", tierOk,
    "fire +" + (f3 - f2) + "；逐敲（第n次→窗口内上屏行）：" + sampled.map(s =>
      "n" + s.n + (s.seen.indexOf(s.want) >= 0 ? " 预期行✓" : " 预期行未上屏（实见：" + (s.seen.length ? s.seen.map(x => "“" + String(x).slice(0, 10) + "…”").join("/") : "空") + "；预期“" + String(s.want).slice(0, 10) + "…”）")).join("｜"));

  /* ---------- W41K.4 无回归·敲击计数 ---------- */
  const h3 = (await st()).wallHits;
  report("W41K.4 无回归·敲击计数（单挥击+1／总=按J数）", (h1 - hits0) === 1 && (h3 - hits0) === 6,
    "墙上敲总计数 +" + (h3 - hits0) + "（期望 +6＝6 次 J）；单挥击 +" + (h1 - hits0) + "（期望 +1＝a.wallKnock 帧锁）");

  /* ---------- W41K.5 无回归·身体撞墙路径仍单局一次 ---------- */
  const fBefore = await fires();
  await page.keyboard.down("KeyA"); await sleep(1200); await page.keyboard.up("KeyA"); await sleep(300);
  await page.keyboard.down("KeyA"); await sleep(1200); await page.keyboard.up("KeyA"); await sleep(300);
  const f5 = await fires();
  report("W41K.5 无回归·撞墙路径仍单局一次", (f5 - fBefore) === 0,
    "反复推墙 fire +" + (f5 - fBefore) + "（期望 +0＝world.wallTouched 已在贴墙时消耗；全程 wall_touch 总 fire=" + f5 + "）");

  /* ---------- W41K.0 零错误 ---------- */
  report("W41K.0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));
  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("探针崩溃：" + e.stack); process.exit(2); });
