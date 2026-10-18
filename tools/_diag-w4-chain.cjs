/* W4 快速探针：startAct(5) → Boss 入场 → 阶段门 → bossDefeat → spare → end_a → 杀青卡。
   只打印时间线（不判 PASS/FAIL）——用于 gate-10 编写前的链路验证。 */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  await page.goto(URL, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(700);
  const st = () => page.evaluate(() => window.__game.state());
  const dbg = (f, a) => page.evaluate((fn, args) => { const d = window.__game.debug; return d[fn].apply(d, args); }, f, a || []);
  const snap = async (tag) => { const s = await st();
    console.log(tag, JSON.stringify({ act: s.act, arena: s.arena, boss: s.boss, plats: (s.plats || []).map(p => p.x + "/" + p.y),
      spare: s.spare, ending: s.ending, ended: s.ended, wallHits: s.wallHits, maxCombo: s.maxCombo,
      card: s.staging && s.staging.card, cer: s.staging && s.staging.ceremony, showRestart: s.showRestart,
      cp: await page.evaluate(() => window.__game.debug.cp().id),
      cpTail: (await page.evaluate(() => window.__game.debug.cp().log.map(x => x.id))).slice(-6) })); };
  console.log("== startAct(5) ==");
  await dbg("startAct", [5]); await snap("t0");
  await sleep(2600); await snap("t+2.6s(boss应入场)");
  console.log("== p2 门 ==");
  await dbg("bossDamage", [40]); await sleep(300); await snap("hp80");
  console.log("== p3 门 ==");
  await dbg("bossDamage", [40]); await sleep(300); await snap("hp40");
  console.log("== 击杀 ==");
  await dbg("bossDamage", [40]); await sleep(600); await snap("down");
  await sleep(2400); await snap("t+3s(spare应开)");
  console.log("== 收手（等 6.2s） ==");
  await sleep(6300); await snap("spare后");
  await sleep(3000); await snap("+3s(lines中)");
  await sleep(12000); await snap("+12s(cer/card?)");
  await sleep(6000); await snap("+6s(卡?)");
  console.log("errs:", errs.length ? errs : "0 条");
  await browser.close().catch(() => {});
})().catch(e => { console.error("CRASH", e); process.exit(2); });
