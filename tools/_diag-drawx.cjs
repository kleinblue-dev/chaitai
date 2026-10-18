/* _diag-drawx.cjs —— J5② 未冻结之谜定位·第二版（非闸；为 verify-visual-v1 J5② 采样法修复取证）。
   第一版铁证（已入档）：未冻结 480→580 窗口内 fg=49 帧、rAF=134fps、display ctx 实收
   drawImage dx∈{0,-4}（−4=条带 off−12，off=8 ✓）；但 band 像素互相关 min@0 —— 与实画矛盾。
   本版矩阵（同 session 全串）：
     U1/U2 未冻结 480 双抓（间隔 30ms）→ band 内在时间变化基线（d(0) 非零 ⇒ 带内有动画内容）。
     F0    冻结 480 → curve(U1,F0)（冻结不改内容？）
     F1    冻结 580（同冻结态位移）→ curve(F0,F1) 期望 min@8
     U3    解冻 300ms（仍 580）→ curve(F1,U3)（解冻效应）
     U4    未冻结 回 480 350ms → curve(U3,U4)（谜题对：未冻结位移）＋ curve(U1,U4)（同位置同态）
     行dump：band 相对 y=40（屏 y305）x100-280 luma 每 2px —— 目检楼体边缘位置。
     热点：对谜题对 off=0 打印最大差像素的 A/B RGB。
   输出：JSON 行 + 曲线 + 行表。 */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const G = (fn) => page.evaluate(fn);

let page;
(async () => {
  console.log("== _diag-drawx v2 ==");
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));

  await page.evaluateOnNewDocument(() => {
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    window.__drawLog = [];
    CanvasRenderingContext2D.prototype.drawImage = function (img, a1, a2, a3, a4, a5, a6, a7, a8) {
      try {
        if (img && img.width > 900 && this.canvas && this.canvas.id === "cv") {
          const n = arguments.length;
          const dx = (n === 9) ? a5 : a1;
          window.__drawLog.push({ dx: dx, t: performance.now() });
          if (window.__drawLog.length > 1500) window.__drawLog.splice(0, 700);
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  });

  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(600);

  const kLive = await G(() => document.getElementById("cv").width / 960);
  console.log("kLive=" + kLive);
  const wBuf = Math.round(400 * kLive), w80 = Math.round(80 * kLive);
  const x0 = Math.round(100 * kLive), x1 = Math.round(370 * kLive); /* 采样列：屏 x100-370（带内） */
  const curve = (A, B, lo, hi) => {
    const out = [];
    for (let off = lo; off <= hi; off++) {
      let d = 0, n = 0;
      for (let y = 0; y < w80; y += 3) for (let x = x0; x < x1; x += 3) {
        const i = ((y * wBuf) + x) * 4, j = ((y * wBuf) + x + off) * 4;
        d += Math.abs(A[i] - B[j]) + Math.abs(A[i + 1] - B[j + 1]) + Math.abs(A[i + 2] - B[j + 2]); n++;
      }
      out.push(+(d / n).toFixed(2));
    } return out; };
  const rowLuma = (A, relY) => {
    const out = [];
    for (let x = x0; x <= x0 + 180 * kLive; x += 2 * kLive) {
      const i = ((Math.round(relY * kLive)) * wBuf + x) * 4;
      out.push(Math.round((A[i] + A[i + 1] + A[i + 2]) / 3));
    } return out; };
  const hotRGB = (A, B) => {
    const list = [];
    for (let y = 0; y < w80; y += 3) for (let x = x0; x < x1; x += 3) {
      const i = ((y * wBuf) + x) * 4;
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
      list.push({ x: Math.round(x / kLive), y: Math.round(y / kLive) + 265, d: d,
        a: [A[i], A[i + 1], A[i + 2]], b: [B[i], B[i + 1], B[i + 2]] });
    }
    list.sort((p, q) => q.d - p.d);
    return list.slice(0, 8); };

  let prevT = 0;
  const atomic = () => page.evaluate((m) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(0, Math.round(265 * k), Math.round(400 * k), Math.round(80 * k)).data;
    /* 注意：本抓取从屏 x=0 起宽 400（含带外左缘，供行 dump 对齐世界坐标 x100-280=缓冲 100-280） */
    const st = window.__game.state();
    const log = window.__drawLog.filter(e => e.t > m);
    const counts = {};
    log.forEach(e => { counts[e.dx] = (counts[e.dx] || 0) + 1; });
    return { band: Array.from(d), px: +st.player.x.toFixed(1), layers: window.__game.debug.layers(),
      hurtT: +(st.player.hurtT || 0).toFixed(2), jsT: performance.now(),
      fg: window.__game.debug.layerStats().fg, dxCnt: counts, nDraw: log.length };
  }, prevT).then(r => { prevT = r.jsT; return r; });

  const setX = (x) => page.evaluate((xx) => window.__game.debug.setPlayerX(xx), x);
  const setFz = (t) => page.evaluate((tt) => window.__game.debug.setHitstop(tt), t);
  const stat = (tag, r) => console.log("[" + tag + "] px=" + r.px + " layers=" + JSON.stringify(r.layers)
    + " hurtT=" + r.hurtT + " dx计=" + JSON.stringify(r.dxCnt) + " 大画数=" + r.nDraw);

  await G(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(480); });
  await sleep(900);
  const U1 = await atomic(); stat("U1 未冻480", U1);
  await sleep(30);
  const U2 = await atomic(); stat("U2 +30ms", U2);
  console.log("[U1→U2 30ms] d(off 0..12): " + JSON.stringify(curve(U1.band, U2.band, 0, 12)));

  await setFz(4); await sleep(250);
  const F0 = await atomic(); stat("F0 冻480", F0);
  console.log("[U1→F0 冻结] d: " + JSON.stringify(curve(U1.band, F0.band, 0, 12)));
  await setX(580); await sleep(200);
  const F1 = await atomic(); stat("F1 冻580", F1);
  console.log("[F0→F1 冻结位移] d: " + JSON.stringify(curve(F0.band, F1.band, 0, 12)));

  await setFz(0); await sleep(300);
  const U3 = await atomic(); stat("U3 解冻580", U3);
  console.log("[F1→U3 解冻同pos] d: " + JSON.stringify(curve(F1.band, U3.band, 0, 12)));
  await setX(480); await sleep(350);
  const U4 = await atomic(); stat("U4 未冻回480", U4);
  console.log("[U3→U4 未冻位移(谜题对)] d: " + JSON.stringify(curve(U3.band, U4.band, 0, 12)));
  console.log("[U1→U4 同位置(首尾)] d: " + JSON.stringify(curve(U1.band, U4.band, 0, 12)));

  console.log("-- 行 dump：屏 y305（带内 y40），x100-280 每 2px luma --");
  console.log("U1: " + JSON.stringify(rowLuma(U1.band, 40)));
  console.log("F1: " + JSON.stringify(rowLuma(F1.band, 40)));
  console.log("U4: " + JSON.stringify(rowLuma(U4.band, 40)));
  console.log("U3: " + JSON.stringify(rowLuma(U3.band, 40)));
  console.log("-- 热点 U3→U4 off=0（x,y,d,a,b） --");
  console.log(JSON.stringify(hotRGB(U3.band, U4.band)));

  console.log(errs.length ? ("ERRORS: " + errs.join(" | ")) : "0 pageerror");
  await browser.close().catch(() => {});
  process.exit(0);
})();
