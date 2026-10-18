/* verify-v030.cjs —— resize 后层级烘焙安全性（Loop D 验证期发现；非工具新增判据，是缺陷回归闸）。
   缺陷（Loop C 代码，2026-10-14 由 _diag-boss-visual 抓出）：
   game.js resize() 置 LAY.base/baseKey/key/farS/midS=null 但**未置 LAY.far/mid**——
   step 路径的 bakeFarTick/bakeMidTick（15/30fps 累加器）先于下一帧 drawBG 触发时，
   `var c=LAY.far; if(!c)return;` 放行（c=陈旧非空画布），随后 drawImage(LAY.farS=null) ⇒
   TypeError：'drawImage' 参数非图像类型。渲染帧被中断，数帧后经一次累加器未触发帧自愈。
   真机表现：拖窗口/最大化/F11/手机转屏后若干帧微顿。
   本闸：Enter 进入游戏 → 派发 resize 事件（确定性触发，不靠 headless 意外视口事件）→
   500ms 内 0 pageerror ⇒ PASS。红侧（修复前）应报 drawImage TypeError 于
   updLayers→bakeFarTick/bakeMidTick；绿侧（resize 补 null LAY.far/mid）0 错误。
   另断言恢复性：resize 后 500ms 世界仍在更新（250ms 双抓帧差>0 ⇒ 渲染管线存活）。 */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const chk = (ok, tag, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + tag + " —— " + detail); ok ? pass++ : fail++; };

(async () => {
  console.log("== verify-v030（resize 后层级烘焙安全性）==");
  console.log("URL  = file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message + " @ " + String((e.stack || "").split("\n").slice(1, 4).join(" | "))));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(700);
  chk(errs.length === 0, "V30-0 进入游戏后基线零错误", errs.length ? errs[0] : "0 pageerror");

  /* 密集派发 24 次×16ms：缺陷是「resize 后的首个 step 帧恰好越限累加器」的时序擦肩
     （render 每帧会重烤修复，far 越限 1/4 帧、mid 1/2 帧）——密派覆盖全部相位，红侧必现。 */
  for (let i = 0; i < 24; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await sleep(16);
  }
  await sleep(400);
  chk(errs.length === 0, "V30-1 resize×24 后零错误", errs.length ? (errs.length + " 条，首条：" + errs[0]) : "0 pageerror（drawImage 无 null 源）");

  /* 恢复性：渲染管线存活（静立带 250ms 双抓应有非零帧差：尘埃/呼吸仍在动） */
  const grab = () => page.evaluate(() => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    return Array.from(g.getImageData(Math.round(300 * k), Math.round(255 * k), Math.round(220 * k), Math.round(90 * k)).data);
  });
  const g1 = await grab(); await sleep(250); const g2 = await grab();
  let d = 0, n = 0;
  for (let i = 0; i < g1.length; i += 4) { d += Math.abs(g1[i] - g2[i]) + Math.abs(g1[i + 1] - g2[i + 1]) + Math.abs(g1[i + 2] - g2[i + 2]); n++; }
  const dm = +(d / n / 3).toFixed(3);
  chk(dm > 0, "V30-2 resize 后渲染管线存活（250ms 帧差>0）", "帧差 " + dm);
  chk(errs.length === 0, "V30-3 全程零错误", errs.length ? (errs.length + " 条") : "0 pageerror");

  console.log("---- 汇总：" + (fail === 0 ? "PASS " + pass + "/" + pass : "FAIL " + fail + "（PASS " + pass + "）") + " ----");
  console.log("GATE verify-v030: " + (fail === 0 ? "PASS" : "FAIL"));
  await browser.close().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
})();
