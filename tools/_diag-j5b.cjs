/* _diag-j5b.cjs —— J5② 新协议校准（非闸；为 verify-visual-v1 J5② 判据阈值取证）。
   协议（修复版）：debug.reset()（清计时器/旁白/演出层）→ setPlayerX(480) 主动触发
   wave1→wave2→cleared 全链（palKey 翻幕会整层重烤，必须等链走完）→ 等待期间持续 clearWave
   （链为计时器驱动，与敌人存活无关；防止敌兵近身打断）→ 等 cleared 且无仪式 → 静帧预检 →
   setPlatforms → 冻结 → 480/580 对抓 → 远景带 ±12 互相关 + 平台端帽竖线列位置法。
   输出：全曲线+阈值候选值，供判据定档。 */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const G = (fn) => page.evaluate(fn);

let page;
(async () => {
  console.log("== _diag-j5b（新协议校准） ==");
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(600);

  const kLive = await G(() => document.getElementById("cv").width / 960);
  console.log("kLive=" + kLive);
  const W300 = Math.round(300 * kLive), H80 = Math.round(80 * kLive);
  const WPlat = Math.round(28 * kLive), HPlat = Math.round(16 * kLive);

  const grab = (x, y, w, h) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    return Array.from(g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k),
      Math.round(a[2] * k), Math.round(a[3] * k)).data);
  }, [x, y, w, h]);
  const dAt = (A, B, wpx, rows, off, step) => {
    step = step || 3;
    let d = 0, n = 0;
    const xa = Math.max(0, -off), xb = Math.min(wpx, wpx - off);
    for (let y = 0; y < rows; y += step) for (let x = xa; x < xb; x += step) {
      const i = ((y * wpx) + x) * 4, j = ((y * wpx) + x + off) * 4;
      d += Math.abs(A[i] - B[j]) + Math.abs(A[i + 1] - B[j + 1]) + Math.abs(A[i + 2] - B[j + 2]); n++;
    }
    return n ? +(d / n).toFixed(2) : Infinity;
  };
  const curve = (A, B, wpx, rows, step) => {
    const out = [];
    for (let off = -12; off <= 12; off++) out.push(dAt(A, B, wpx, rows, off, step));
    return out; };
  const strokeCol = (buf, wpx, rows) => { /* 端帽竖线列：B−R 均值最大的列（青 #7df9ff：B−R≈130；背景≈10-24） */
    let bestX = -1, bestV = -1e9;
    for (let x = 0; x < wpx; x++) {
      let s = 0; for (let y = 0; y < rows; y++) { const i = ((y * wpx) + x) * 4; s += buf[i + 2] - buf[i]; }
      s /= rows; if (s > bestV) { bestV = s; bestX = x; }
    } return { x: bestX, v: +bestV.toFixed(1) }; };

  /* ---- 1. 复位并重放全链 ---- */
  const hasReset = await G(() => typeof window.__game.debug.reset === "function");
  console.log("[协议] debug.reset 存在 = " + hasReset);
  if (!hasReset) { console.log("中止：无 reset 钩子"); await browser.close(); process.exit(1); }
  await G(() => { window.__game.debug.reset(); window.__game.debug.setPlayerX(480); });
  const t0 = Date.now();
  let st5 = null;
  for (let i = 0; i < 80; i++) {
    st5 = await G(() => { const s = window.__game.state();
      return { cleared: s.cleared, cer: !!s.staging.ceremony, wave: s.wave, t: s.staging.titleSec }; });
    if (i % 10 === 0) console.log("  等待链 @ " + ((Date.now() - t0) / 1000).toFixed(1) + "s: " + JSON.stringify(st5));
    if (st5.cleared && !st5.cer) break;
    await G(() => window.__game.debug.clearWave());
    await sleep(500);
  }
  console.log("[协议] 链完成 @ " + ((Date.now() - t0) / 1000).toFixed(1) + "s: " + JSON.stringify(st5));

  /* ---- 2. 静帧预检 ---- */
  await G(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(480); });
  await sleep(400);
  let qD = null, qN = 0;
  for (let i = 0; i < 10; i++) {
    qN = i + 1;
    const q1 = await grab(100, 265, 300, 80); await sleep(250);
    const q2 = await grab(100, 265, 300, 80);
    qD = dAt(q1, q2, W300, H80, 0);
    if (qD <= 1.0) break;
  }
  console.log("[静帧] d0=" + qD + "（" + qN + " 试，" + (qD <= 1.0 ? "静" : "未静") + "）");

  /* ---- 3. 冻结对抓 ---- */
  await G(() => window.__game.debug.setPlatforms([{ x: 250, y: 380, w: 180, h: 16 }]));
  await G(() => window.__game.debug.setHitstop(4));
  await G(() => window.__game.debug.setPlayerX(480)); await sleep(300);
  const bandA = await grab(100, 265, 300, 80);
  const platA = await grab(238, 372, 28, 16);
  await G(() => window.__game.debug.setPlayerX(580)); await sleep(350);
  const bandB = await grab(100, 265, 300, 80);
  const platB = await grab(238, 372, 28, 16);
  await G(() => window.__game.debug.setHitstop(0));

  const farCurve = curve(bandA, bandB, W300, H80, 3);
  let fBest = 0, fD = Infinity;
  farCurve.forEach((d, i) => { if (d < fD) { fD = d; fBest = i - 12; } });
  const d0band = dAt(bandA, bandB, W300, H80, 0);
  console.log("[远景带] 曲线(off -12..12): " + JSON.stringify(farCurve));
  console.log("[远景带] argmin=" + fBest + " bestD=" + fD + " d0=" + d0band + " 对比比=" + (d0band / fD).toFixed(2));

  const sA = strokeCol(platA, WPlat, HPlat), sB = strokeCol(platB, WPlat, HPlat);
  const platCurve = curve(platA, platB, WPlat, HPlat, 1);
  let pBest = 0, pD = Infinity;
  platCurve.forEach((d, i) => { if (d < pD) { pD = d; pBest = i - 12; } });
  console.log("[平台] 端帽列 A=" + JSON.stringify(sA) + " B=" + JSON.stringify(sB)
    + " ⇒ Δ列=" + (sA.x - sB.x));
  console.log("[平台] 曲线(off -12..12, step1): " + JSON.stringify(platCurve));
  console.log("[平台] argmin=" + pBest + " bestD=" + pD
    + " d(±8)=" + platCurve[4] + "/" + platCurve[20]);

  console.log(errs.length ? ("ERRORS: " + errs.join(" | ")) : "0 pageerror");
  await browser.close().catch(() => {});
  process.exit(0);
})();
