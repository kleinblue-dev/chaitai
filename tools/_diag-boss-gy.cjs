/* _diag-boss-gy.cjs —— 复现探针：run1 序列（无 T3 ⇒ Boss 站地面 y=470、不清陷阱）下 drawImage 报错定位。
   同 _diag-boss-visual 骨架；只 spawnBoss→等 1.5s→打印带栈错误 + 逐帧错误首现时间。 */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("== _diag-boss-gy（run1 复现） ==");
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("t+" + Date.now() % 100000 + " " + e.message
    + " @ " + String((e.stack || "").split("\n").slice(0, 6).join(" | "))));
  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(600);
  console.log("[前] errs=" + errs.length);
  const sp = await page.evaluate(() => window.__game.debug.spawnBoss());
  console.log("[spawn 无T3] " + JSON.stringify(sp));
  await sleep(350);
  await page.screenshot({ path: path.join(ROOT, "shots", "_diag-boss", "gy-idle.png"),
    clip: { x: 728, y: 160, width: 200, height: 200 } }); /* 复刻 run1：截图夹在动作之间 */
  await sleep(350);
  console.log("[spawn 后 700ms] errs=" + errs.length);
  await page.evaluate(() => window.__game.debug.bossDamage(85));
  await sleep(1500);
  console.log("[暴怒后 1.5s] errs=" + errs.length);
  for (let i = 0; i < Math.min(errs.length, 4); i++) console.log("ERR[" + i + "] " + errs[i]);
  /* 手动探 reflSprite 两键（同页面上下文直测） */
  const probe = await page.evaluate(() => {
    const r = { };
    try { r.reflGold = !!document.createElement; const g = document.createElement("canvas").getContext("2d");
      const lg = g.createLinearGradient(0,0,0,96); lg.addColorStop(0,"#ffd76aaa"); lg.addColorStop(0.55,"#ffd76a33"); lg.addColorStop(1,"#ffd76a00"); r.gold = "ok";
    } catch (e) { r.gold = "EX " + e.message; }
    try { const g2 = document.createElement("canvas").getContext("2d");
      const lg2 = g2.createLinearGradient(0,0,0,96); lg2.addColorStop(0,"#ff8fa3aa"); lg2.addColorStop(0.55,"#ff8fa333"); lg2.addColorStop(1,"#ff8fa300"); r.rose = "ok";
    } catch (e) { r.rose = "EX " + e.message; }
    r.drawImg = typeof (document.createElement("canvas").getContext("2d").drawImage);
    return r; });
  console.log("[上下文直测] " + JSON.stringify(probe));
  console.log(errs.length ? "ERRORS: " + errs.length : "0 pageerror");
  await browser.close().catch(() => {});
  process.exit(errs.length ? 1 : 0);
})();
