/* _shot-fixed.cjs —— 固定机位静帧套（视觉循环改前/改后同机位对比用；非测试闸，不判 PASS/FAIL）
   状态与固定时序（两次运行间逐帧对齐，除版本差异外一切同参）：
     t  = 标题页（载入后 1.2s）
     a1 = 第一幕站定：Enter → 0.9s → clearWave+setPlayerX(480) → 0.9s
     sl = 刀弧定格：按 J → 120ms（攻击 1 act 窗内）
   输出：<PREFIX>-t.png / -a1.png / -sl.png（整屏 1440×900）
   用法：CHAITAI_SHOT_PREFIX=D:/2006L/chaitai/shots/pp/before node tools/_shot-fixed.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const PREFIX = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/pp/shot");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("== _shot-fixed ==");
  console.log("URL    = " + URL_);
  console.log("PREFIX = " + PREFIX);
  fs.mkdirSync(path.dirname(PREFIX), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  await page.goto(URL_, { waitUntil: "load" });
  await sleep(1200);
  await page.screenshot({ path: PREFIX + "-t.png" }); console.log("shot t");
  await page.keyboard.press("Enter");
  await sleep(900);
  await page.evaluate(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(480); });
  await sleep(900);
  await page.screenshot({ path: PREFIX + "-a1.png" }); console.log("shot a1");
  await page.keyboard.press("KeyJ");
  await sleep(120);
  await page.screenshot({ path: PREFIX + "-sl.png" }); console.log("shot sl");
  await browser.close().catch(() => {});
  console.log(errs.length ? ("ERRORS: " + errs.join(" | ")) : "0 pageerror / 0 console.error");
  process.exit(errs.length ? 1 : 0);
})();
