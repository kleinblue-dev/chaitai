/* _diag-boss-p95.cjs —— 《拆台》W4.1 A6 陪跑探针：Boss 激活态（含场记板「抬手」路径）帧时采样（非闸）
   背景：A6 改动行只在 drawBoss 内执行；v026/v027 覆盖路径不含 Boss（grep 佐证），其 p95 差不可归因 A6。
   流程：playing → debug.spawnBoss(828)（被动渲染，不含 Boss 招式 AI ⇒ A/B 负载可控）→ 预热 1.5s
        → 每 0.85s spawnPress(player.x)（3 次，命中玩家掉 20×3，不死）保持 raise 路径活跃 → 采样 4.5s
        → telemetry().frameP95Ms。
   用法：node tools/_diag-boss-p95.cjs   （改码前后各跑一次＝A/B；同机同脚本） */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(900);
  await p.keyboard.press("Enter");
  await p.waitForFunction('window.__game.state().phase === "playing"', { timeout: 4000 });
  await p.evaluate(() => window.__game.debug.spawnBoss(828));
  await p.waitForFunction('window.__game.state().boss.active === true', { timeout: 5000, polling: "raf" });
  await sleep(1500);
  const c0 = await p.evaluate(() => window.__game.debug.telemetry().frameCount);
  let presses = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 4500 && presses < 3) {
    await p.evaluate(() => window.__game.debug.spawnPress(window.__game.state().player.x));
    presses++;
    await sleep(1100);
  }
  while (Date.now() - t0 < 4500) await sleep(200);
  const t = await p.evaluate(() => window.__game.debug.telemetry());
  const s = await p.evaluate(() => window.__game.state());
  console.log("boss.active=" + s.boss.active + " 采样帧 +" + (t.frameCount - c0) + " / spawnPress×" + presses
    + " ⇒ p95=" + t.frameP95Ms + "ms  frameCount=" + t.frameCount + "  player.hp=" + s.player.hp);
  await browser.close();
  process.exit(0);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
