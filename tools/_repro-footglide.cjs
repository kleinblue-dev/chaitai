/* _repro-footglide.cjs —— V25-B 闪断机制复现（非闸，不判 PASS/FAIL 进套件；只证机制类别）。
   案情：全套运行 v025-B 曾红（超限段=1，例 {"fi":1,"x0":35,"dx":3.96,"n":50}），单独重跑同代码全绿
    ⇒ 时序闪断。机制假设：放键后 moving=false 分支以 approach(...,50,dt)（指数式）滑停收脚，
   而 pl 无条件报 1 —— 采样窗（CDP 延迟在套件负载下被拉长）跨过放键点时，"滑移中"的帧被算作支撑段。
   全局契约判据（无需知道放键时刻）：同一只脚相邻两个 p=1 样本，cx 必须相等（走动支撑＝世界锁死；
   唯一的 p=1 位移源就是收脚滑移）⇒ 断言「相邻 p=1 样本 |Δcx| ≤ 0.5px」。
   pre-fix 预期：incidents > 0（收脚滑移帧混入 pl=1）。post-fix 预期：incidents = 0。
   序列：Enter → setPlayerX(300) → 按 KeyA 1.3s → 放键 → 再采 600ms（覆盖滑停收脚窗）。 */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const G = (fn) => page.evaluate(fn);

let page;
(async () => {
  console.log("== _repro-footglide（V25-B 闪断机制）==");
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(600); await page.keyboard.press("Enter"); await sleep(900);
  await G(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(300); });
  await sleep(400);
  await G(() => { window.__RG = []; (function tk() {
    try { const r = window.__game.debug.rig(); window.__RG.push({ t: performance.now(),
      feet: r.feet.map(f => ({ cx: f.cx, p: f.p })) }); } catch (e) {}
    requestAnimationFrame(tk); })(); });
  await page.keyboard.down("KeyA"); await sleep(1300); await page.keyboard.up("KeyA");
  await sleep(600); /* 覆盖滑停收脚窗（指数收敛 k=50 ⇒ 0.2s 后亚像素） */
  const S = await G(() => window.__RG.slice());

  /* 分析：同一只脚相邻两个 p=1 样本 |Δcx|——走动支撑期恒等，>0.5px 即「p=1 却在滑移」 */
  const incidents = [];
  for (let fi = 0; fi < 2; fi++) {
    let prev = null;
    for (const s of S) {
      const f = s.feet[fi];
      if (f && f.p === 1) {
        if (prev && Math.abs(f.cx - prev.cx) > 0.5)
          incidents.push({ fi, cx0: prev.cx, cx1: f.cx, d: +Math.abs(f.cx - prev.cx).toFixed(2) });
        prev = { cx: f.cx };
      } else prev = null; /* p=0 打断连续段 */
    }
  }
  const maxD = incidents.length ? Math.max(...incidents.map(i => i.d)) : 0;
  console.log(`样本=${S.length} ｜ p=1 滑移事件数=${incidents.length} ｜ 最大单帧滑移=${maxD.toFixed(2)}px`);
  if (incidents.length) console.log("例: " + JSON.stringify(incidents.slice(0, 3)));
  console.log(errs.length ? ("ERRORS: " + errs.join(" | ")) : "0 pageerror");
  await browser.close().catch(() => {});
  process.exit(0);
})();
