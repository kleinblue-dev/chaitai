/* verify-v012.cjs —— 《拆台》v0.1.2 增量验收探针
   断言：
   X1 钩子契约 v2（state 新字段 / debug.setPlatforms,setShadow,audioCount,telemetry,registry / version）
   X2 telemetry() 真在数帧（frameCount 增长、p95>0、events 数组）
   X3 台箱平台：真键跳上（Space 按足 400ms——短按触发松手截断 vy<-170→-170，顶点够不着 380）→ 落在平台上；真键走落（KeyA）→ 落回地面
   X4 分幕调色板：act1≠act2≠clear 的背景像素变化
   X5 音乐引擎：audioCount()>0；战斗中 intensity≥0.4（采样峰值）
   X6 接触阴影：同像素 ON/OFF 夹心（debug.setShadow 关→开，同一带差值=阴影本身；背景/辉光/朝向天然对消）变暗 ≥3
   X7 地面反射：玩家正下方像素比参照亮 ≥4
   X0 全程 0 pageerror / 0 console.error
   用法：node tools/verify-v012.cjs
   环境：CHAITAI_URL（覆盖被测页，默认正本）／CHAITAI_SHOT_PREFIX（截图前缀）
   先红后绿：对 versions/v0.1.1/index.html 跑 => X1..X7 红；对正本跑 => 全绿（rc=0） */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v012/v012");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v012 ==");
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
  await sleep(1000);

  /* ---------- X1 钩子契约 v2 ---------- */
  let r = await page.evaluate(() => {
    const g = window.__game; if (!g) return { ok: false, why: "__game 不存在" };
    const miss = [];
    if (g.version !== "0.1.2") miss.push("version=" + g.version);
    const s = g.state();
    for (const k of ["act", "ending", "boss", "menu", "save", "audio"]) if (!(k in s)) miss.push("state." + k);
    for (const k of ["setPlatforms", "setShadow", "audioCount", "telemetry"]) if (typeof g.debug[k] !== "function") miss.push("debug." + k);
    if (!g.debug.registry || !Array.isArray(g.debug.registry.acts)) miss.push("debug.registry");
    else {
      if (!g.debug.registry.mechanics.some(m => m.id === "platform")) miss.push("registry.mechanics.platform");
      if (!g.debug.registry.checkpoints.some(c => c.id === "game_start")) miss.push("registry.checkpoints.game_start");
    }
    return { ok: miss.length === 0, why: miss.join(",") || "全字段在" };
  }).catch(e => ({ ok: false, why: "evaluate 异常 " + e.message }));
  report("X1 钩子契约v2", r.ok, r.why);

  /* ---------- X2 telemetry ---------- */
  await sleep(800);
  r = await page.evaluate(() => {
    const g = window.__game; if (!g || typeof g.debug.telemetry !== "function") return { ok: false, why: "telemetry 不存在" };
    const t = g.debug.telemetry();
    const ok = t.frameCount >= 10 && t.frameP95Ms > 0 && Array.isArray(t.events) && Array.isArray(t.frames);
    return { ok, why: "frameCount=" + t.frameCount + " p95=" + t.frameP95Ms + "ms events=" + t.events.length };
  }).catch(e => ({ ok: false, why: "evaluate 异常 " + e.message }));
  report("X2 telemetry", r.ok, r.why);

  /* ---------- 开局 ---------- */
  await page.keyboard.press("Enter");
  await sleep(400);
  await shot("start");

  /* ---------- X5a audioCount>0 ---------- */
  let ac = -1;
  for (let i = 0; i < 16; i++) {
    ac = await page.evaluate(() => { const d = window.__game && window.__game.debug;
      return (d && typeof d.audioCount === "function") ? d.audioCount() : -1; }).catch(() => -1);
    if (ac > 0) break; await sleep(250);
  }
  report("X5a 音乐引擎起振", ac > 0, "audioCount=" + ac + (ac > 0 ? "" : "（>0 预期；-1=接口不存在）"));

  /* ---------- X3 台箱平台（真键） ---------- */
  r = await page.evaluate(() => { const d = window.__game && window.__game.debug;
    if (!d || typeof d.setPlatforms !== "function") return false;
    d.setPlatforms([{ x: 250, y: 380, w: 180, h: 16 }]); d.setPlayerX(330); return true; }).catch(() => false);
  if (!r) { report("X3 台箱平台", false, "setPlatforms 不存在"); }
  else {
    await sleep(300);
    await page.keyboard.down("Space"); await sleep(400); await page.keyboard.up("Space");
    let landed = null;
    for (let i = 0; i < 20; i++) { await sleep(150);
      landed = await page.evaluate(() => { const s = window.__game.state();
        return { x: s.player.x, y: s.player.y, g: s.player.grounded }; });
      if (landed.g && Math.abs(landed.y - 380) < 3) break; }
    const onPlat = landed && landed.g && Math.abs(landed.y - 380) < 3;
    let stable = false;
    if (onPlat) { await sleep(400); const s2 = await page.evaluate(() => window.__game.state());
      stable = s2.player.grounded && Math.abs(s2.player.y - 380) < 3; }
    await shot("platform");
    await page.keyboard.down("KeyA");
    let off = null;
    for (let i = 0; i < 16; i++) { await sleep(150);
      off = await page.evaluate(() => window.__game.state());
      if (off.player.x < 235) break; }
    await page.keyboard.up("KeyA");
    let back = null;
    for (let i = 0; i < 18; i++) { await sleep(150);
      back = await page.evaluate(() => window.__game.state());
      if (back.player.grounded && Math.abs(back.player.y - 470) < 3) break; }
    const ground = back && back.player.grounded && Math.abs(back.player.y - 470) < 3;
    report("X3 台箱平台", onPlat && stable && ground,
      "跳上 y=" + (landed && landed.y) + " 站稳=" + stable + " 走落回地 y=" + (back && back.player.y) + " grounded=" + (back && back.player.grounded));
  }

  /* ---------- X6 接触阴影（同像素 ON/OFF 夹心） / X7 地面反射（像素） ---------- */
  await page.evaluate(() => { const d = window.__game && window.__game.debug; if (!d) return;
    if (typeof d.setPlatforms === "function") d.setPlatforms([]);
    if (typeof d.setPlayerX === "function") d.setPlayerX(300); }).catch(() => {});
  await sleep(800);
  /* 等旁白箱滚出画面（盒子 α0.8 会盖住采样带；夹心要求两次采样环境一致） */
  for (let i = 0; i < 20; i++) {
    const quiet = await page.evaluate(() => { const s = window.__game.state(); return !s.narrator || !s.narrator.current; }).catch(() => true);
    if (quiet) break; await sleep(200);
  }
  r = await page.evaluate(() => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    function mean(x0, x1, y0, y1) { const d = g.getImageData(Math.round(x0 * k), Math.round(y0 * k), Math.round((x1 - x0) * k), Math.round((y1 - y0) * k)).data;
      let s = 0, n = d.length / 4; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / n; }
    /* 反射带取地面辉光够不到的深处（y≥496） */
    const rfA = mean(292, 309, 474, 481), rfR = mean(121, 129, 474, 481);
    const dpA = mean(290, 310, 496, 508), dpR = mean(121, 129, 496, 508);
    return { reflA: +rfA.toFixed(2), reflR: +rfR.toFixed(2), light: +(rfA - rfR).toFixed(2),
             deepA: +dpA.toFixed(2), deepR: +dpR.toFixed(2), deep: +(dpA - dpR).toFixed(2) };
  }).catch(e => ({ err: e.message }));
  /* X6 夹心：同一像素带在「阴影关→开」下各采一次；背景/辉光/刀刃/朝向两次相同，差值只可能来自阴影。
     负控＝远处无物体带（x500-516）同操作漂移应≈0，证明差值不是渲染抖动。 */
  const bandExpr = (x0, x1, y0, y1) => `(() => { const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(Math.round(${x0} * k), Math.round(${y0} * k), Math.round((${x1} - ${x0}) * k), Math.round((${y1} - ${y0}) * k)).data;
    let s = 0, n = d.length / 4; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return +(s / n).toFixed(2); })()`;
  let x6off = null, x6on = null, x6refOff = null, x6refOn = null, x6why = "";
  const hasShadow = await page.evaluate(() => typeof ((window.__game && window.__game.debug) || {}).setShadow === "function").catch(() => false);
  if (!hasShadow) x6why = "setShadow 不存在（阴影开关钩子缺失）";
  else {
    await page.evaluate(() => window.__game.debug.setShadow(false)); await sleep(400);
    x6off = await page.evaluate(bandExpr(310, 326, 463, 470)).catch(() => null);
    x6refOff = await page.evaluate(bandExpr(500, 516, 463, 470)).catch(() => null);
    await page.evaluate(() => window.__game.debug.setShadow(true)); await sleep(400);
    x6on = await page.evaluate(bandExpr(310, 326, 463, 470)).catch(() => null);
    x6refOn = await page.evaluate(bandExpr(500, 516, 463, 470)).catch(() => null);
  }
  await shot("shadow-refl");
  if (r.err) { report("X6 接触阴影", false, "evaluate 异常 " + r.err); report("X7 地面反射", false, "evaluate 异常 " + r.err); }
  else {
    const dark = (x6off !== null && x6on !== null) ? +(x6off - x6on).toFixed(2) : null;
    const drift = (x6refOff !== null && x6refOn !== null) ? +Math.abs(x6refOff - x6refOn).toFixed(2) : null;
    report("X6 接触阴影", dark !== null && dark >= 3 && drift !== null && drift <= 0.6,
      dark === null ? x6why : "同像素带 阴影关 " + x6off + " → 开 " + x6on + " => 变暗 " + dark + "（≥3）；远处参照带漂移 |Δ|=" + drift + "（≤0.6 负控）");
    report("X7 地面反射", r.light >= 12 && r.deep >= 5, "亮带 " + r.reflA + " vs " + r.reflR + " => +" + r.light + "（≥12）；深带 " + r.deepA + " vs " + r.deepR + " => +" + r.deep + "（≥5，无辉光污染）");
  }

  /* ---------- X4 调色板分幕 + X5b intensity ---------- */
  await page.keyboard.down("KeyD");
  let s = null;
  for (let i = 0; i < 25; i++) { await sleep(200); s = await page.evaluate(() => window.__game.state()); if (s.player.x > 445) break; }
  await page.keyboard.up("KeyD");
  const px = () => page.evaluate(() => { const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(Math.round(60 * k), Math.round(60 * k), 1, 1).data; return [d[0], d[1], d[2]]; });
  let iMax = -1;
  for (let i = 0; i < 18; i++) { await sleep(280);
    const v = await page.evaluate(() => { const a = window.__game.state().audio; return a ? a.intensity : -1; }).catch(() => -1);
    if (v > iMax) iMax = v;
    if (s.wave === 1 && iMax >= 0.4) break; }
  const c1 = await px();
  report("X5b 战斗 intensity", iMax >= 0.4, "峰值 intensity=" + iMax + "（≥0.4；-1=字段不存在）");
  await page.evaluate(() => window.__game.debug.clearWave());
  let w2 = false;
  for (let i = 0; i < 20; i++) { await sleep(250); s = await page.evaluate(() => window.__game.state()); if (s.wave === 2) { w2 = true; break; } }
  await sleep(400);
  const c2 = await px();
  await shot("act2");
  const d12 = Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]) + Math.abs(c1[2] - c2[2]);
  await page.evaluate(() => window.__game.debug.clearWave());
  let cl = false;
  for (let i = 0; i < 20; i++) { await sleep(250); s = await page.evaluate(() => window.__game.state()); if (s.cleared) { cl = true; break; } }
  await sleep(400);
  const c3 = await px();
  await shot("clear");
  const d23 = Math.abs(c2[0] - c3[0]) + Math.abs(c2[1] - c3[1]) + Math.abs(c2[2] - c3[2]);
  report("X4 分幕调色板", w2 && cl && d12 >= 15 && d23 >= 15,
    "act1 rgb(" + c1 + ") act2 rgb(" + c2 + ") clear rgb(" + c3 + ") diff12=" + d12 + " diff23=" + d23 + "（各≥15）");

  /* ---------- X0 零错误 ---------- */
  report("X0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));
  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("探针崩溃：" + e.stack); process.exit(2); });
