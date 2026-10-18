/* _diag-boss-visual.cjs —— Loop D Boss 视效（D-6）专项目检（非闸；闸套件不含 Boss 激活态 ⇒ 本探针补盲区）。
   覆盖：spawnBoss → 区域像素出现（光环/本体渲染路径真跑）→ bossDamage(85) 两段转折（p2 兵＋p3 暴怒）
   → 暴怒态区域差异（色相切换＋拖尾累积）→ clearBoss 残留归零 → 全程 0 pageerror。
   出图：shots/_diag-boss/{idle,enraged,cleared}.png（屏幕裁剪 300×450 于 Boss 区，供人工目检）。
   说明：探针只证「几何/时序/帧差」，不宣布好看——好看与否留用户目检。 */
"use strict";
const path = require("path");
const fs = require("fs");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const G = (fn, arg) => page.evaluate(fn, arg);

let page;
let pass = 0, fail = 0;
const chk = (ok, tag, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + tag + " —— " + detail); ok ? pass++ : fail++; };

(async () => {
  console.log("== _diag-boss-visual（Loop D / D-6）==");
  const outDir = path.join(ROOT, "shots", "_diag-boss");
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  const T0 = Date.now();
  page.on("pageerror", e => errs.push("[t+" + ((Date.now() - T0) / 1000).toFixed(1) + "s] " + e.message
    + " @ " + String((e.stack || "").split("\n").slice(0, 5).join(" | "))));
  page.on("console", m => { if (m.type() === "error") errs.push("[t+" + ((Date.now() - T0) / 1000).toFixed(1) + "s] console.error: " + m.text()); });
  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(900);
  console.log("[cp] load+900ms errs=" + errs.length);
  await page.keyboard.press("Enter"); await sleep(600);
  console.log("[cp] Enter+600ms errs=" + errs.length);

  const kLive = await G(() => document.getElementById("cv").width / 960);
  const kCSS = await G(() => document.getElementById("cv").clientWidth / 960); /* screenshot=CSS 像素；getImageData=后备缓冲 */
  console.log("kLive=" + kLive + " kCSS=" + kCSS);
  /* Boss 区世界带：x 728-928, y 160-360（含光环 R64×1.08 与本体 27×36@-40 全部包住） */
  const BX = 728, BY = 160, BW = 200, BH = 200;
  const grab = () => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    return Array.from(g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k),
      Math.round(a[2] * k), Math.round(a[3] * k)).data);
  }, [BX, BY, BW, BH]);
  const dMean = (A, B) => {
    let d = 0, n = 0;
    for (let i = 0; i < A.length; i += 4) {
      d += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); n++;
    } return +(d / n / 3).toFixed(2);
  };
  /* 区域平均色（暴怒切换的色相证据：金→绯，R 高 G 中 B 低 → R 高 G 低 B 中） */
  const hue = (A) => { let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < A.length; i += 4) { r += A[i]; g += A[i + 1]; b += A[i + 2]; n++; }
    return { r: +(r / n).toFixed(1), g: +(g / n).toFixed(1), b: +(b / n).toFixed(1) }; };
  const shot = (name) => page.screenshot({ path: path.join(outDir, name + ".png"),
    clip: { x: BX * kCSS, y: BY * kCSS, width: BW * kCSS, height: BH * kCSS } });

  const before = await grab();
  /* 与 ACTS[5] 同款站位：先摆 T3（x790-866,y300），Boss 落位 dropLandY ⇒ y=300，采样带 y160-360 包住
     （不带 T3 时 Boss 站地面 y=470，本带只扫到天空 ⇒ 采样错位） */
  const sp = await G(() => { window.__game.debug.setPlatforms([{ x: 790, y: 300, w: 76, h: 16 }]);
    return window.__game.debug.spawnBoss(); });
  console.log("[spawn] " + JSON.stringify(sp) + " errs=" + errs.length);
  await G(() => window.__game.debug.clearTraps());
  await sleep(350);
  console.log("[cp] spawn+350ms errs=" + errs.length);
  const idle = await grab();
  const dIdle = dMean(before, idle);
  chk(dIdle >= 3, "D6-1 Boss 激活态渲染路径", "区域帧差 " + dIdle + "（≥3；含光环/漂浮新像素）");
  await shot("idle");

  await G(() => window.__game.debug.bossDamage(85));
  await G(() => window.__game.debug.clearTraps());
  await sleep(500);
  const enraged = await grab();
  const dRage = dMean(idle, enraged);
  const hIdle = hue(idle), hRage = hue(enraged);
  chk(dRage >= 3, "D6-2 暴怒态视效切换（色偏/拖尾/爆闪）", "区域帧差 " + dRage + "（≥3）｜均色 金(" + JSON.stringify(hIdle) + ") → 暴怒(" + JSON.stringify(hRage) + ")");
  await shot("enraged");
  console.log("[timing] 暴怒后 500ms 拖尾累积窗口（阈值 0.5px×34rad/s 抖动 ⇒ 应持续采样）");

  await G(() => { window.__game.debug.clearBoss(); window.__game.debug.clearTraps(); window.__game.debug.clearWave(); });
  await sleep(350);
  const cleared = await grab();
  const dClear = dMean(enraged, cleared), dBack = dMean(before, cleared);
  chk(dClear >= 3, "D6-3 clearBoss 清除（无残留）", "区域帧差 " + dClear + "（≥3）");
  chk(dBack <= 1.5, "D6-4 清后回到基线（残留≤噪声）", "回基线帧差 " + dBack + "（≤1.5）");
  await shot("cleared");

  chk(errs.length === 0, "D6-0 零错误", errs.length ? errs.join(" | ") : "0 pageerror / 0 console.error");

  console.log("---- 汇总：" + (fail === 0 ? "PASS " + pass + "/" + pass : "FAIL " + fail + "（PASS " + pass + "）") + " ｜出图 " + outDir + " ----");
  console.log("GATE _diag-boss-visual: " + (fail === 0 ? "PASS" : "FAIL"));
  await browser.close().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
})();
