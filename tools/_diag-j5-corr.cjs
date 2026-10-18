/* _diag-j5-corr.cjs —— J5② 互相关诊断（非闸；为步幅/采样盒修复取证）。
   问题：步幅修复后 远景带 best=6（期望 8）残差 47.9；平台带 best=9（期望 0）残差 8.1。
   本诊断打印 d(off) 全曲线 + 最大差分像素热点（定位是谁在动），并做冻结对照（Z）。
   输出：JSON + 曲线表。 */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const G = (fn) => page.evaluate(fn);

let page;
(async () => {
  console.log("== _diag-j5-corr ==");
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(600);

  const grab = (x, y, w, h) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    return Array.from(g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k),
      Math.round(a[2] * k), Math.round(a[3] * k)).data);
  }, [x, y, w, h]);
  const curve = (A, B, wpx, rows, lo, hi) => {
    const out = [];
    for (let off = lo; off <= hi; off++) {
      let d = 0, n = 0;
      for (let y = 0; y < rows; y += 3) for (let x = 0; x < wpx - 30; x += 3) {
        const i = ((y * wpx) + x) * 4, j = ((y * wpx) + x + off) * 4;
        d += Math.abs(A[i] - B[j]) + Math.abs(A[i + 1] - B[j + 1]) + Math.abs(A[i + 2] - B[j + 2]); n++;
      }
      out.push(+(d / n).toFixed(2));
    } return out; };
  const hotspots = (A, B, wpx, off) => {
    const list = [];
    for (let y = 0; y < 80; y += 3) for (let x = 0; x < wpx - 30; x += 3) {
      const i = ((y * wpx) + x) * 4, j = ((y * wpx) + x + off) * 4;
      const d = Math.abs(A[i] - B[j]) + Math.abs(A[i + 1] - B[j + 1]) + Math.abs(A[i + 2] - B[j + 2]);
      list.push({ x, y, d });
    }
    list.sort((a, b) => b.d - a.d);
    return list.slice(0, 10);
  };

  const kLive = await G(() => document.getElementById("cv").width / 960);
  console.log("kLive=" + kLive);

  /* ---- 1. 远景带（镜像 J5） ---- */
  await G(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(480); });
  await sleep(900);
  const bandA = await grab(100, 265, 300, 80);
  await G(() => window.__game.debug.setPlayerX(580)); await sleep(350);
  const bandB = await grab(100, 265, 300, 80);
  await G(() => window.__game.debug.setPlayerX(480)); await sleep(250);
  const w300 = Math.round(300 * kLive), w80 = Math.round(80 * kLive);
  console.log("[远景带] d(off) off=0..12: " + JSON.stringify(curve(bandA, bandB, w300, w80, 0, 12)));
  console.log("[远景带] 热点(off=6): " + JSON.stringify(hotspots(bandA, bandB, w300, 6)));

  /* ---- 2. 平台带（旧盒 y379-385 与新盒 y372-388 含左端帽 x250） ---- */
  await G(() => window.__game.debug.setPlatforms([{ x: 250, y: 380, w: 180, h: 16 }])).catch(() => {});
  await sleep(400);
  const poA = await grab(260, 379, 170, 6); await G(() => window.__game.debug.setPlayerX(580)); await sleep(350);
  const poB = await grab(260, 379, 170, 6);
  const w170 = Math.round(170 * kLive), h6 = Math.round(6 * kLive);
  console.log("[平台·旧盒] d(off): " + JSON.stringify(curve(poA, poB, w170, h6, 0, 12)));

  await G(() => window.__game.debug.setPlayerX(480)); await sleep(350);
  const pnA = await grab(238, 372, 176, 16); await G(() => window.__game.debug.setPlayerX(580)); await sleep(350);
  const pnB = await grab(238, 372, 176, 16);
  const w176 = Math.round(176 * kLive), h16 = Math.round(16 * kLive);
  console.log("[平台·新盒(含端帽)] d(off): " + JSON.stringify(curve(pnA, pnB, w176, h16, 0, 12)));

  /* ---- 3. 冻结对照：世界全停后 480 vs 580（只留渲染位移） ---- */
  await G(() => window.__game.debug.setPlayerX(480)); await sleep(400);
  await G(() => window.__game.debug.setHitstop(4)); await sleep(200);
  const fA = await grab(100, 265, 300, 80);
  await G(() => window.__game.debug.setPlayerX(580)); await sleep(200);
  const fB = await grab(100, 265, 300, 80);
  await G(() => window.__game.debug.setHitstop(0));
  console.log("[远景带·冻结] d(off): " + JSON.stringify(curve(fA, fB, w300, w80, 0, 12)));

  /* ---- 4. 自比基线曲线（同帧内容 vs 自身，看结构性谷底） ---- */
  await G(() => window.__game.debug.setPlayerX(480)); await sleep(400);
  const sA = await grab(100, 265, 300, 80);
  console.log("[自比] d(off): " + JSON.stringify(curve(sA, sA, w300, w80, 0, 12)));

  console.log(errs.length ? ("ERRORS: " + errs.join(" | ")) : "0 pageerror");
  await browser.close().catch(() => {});
  process.exit(0);
})();
