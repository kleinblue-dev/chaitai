#!/usr/bin/env node
/* 拆台 · GATE-2 move —— 按住 D 一秒 player.x 增大；log 含 first_move
 *
 * 断言（按冻结契约）：
 *   G2.1 window.__game 可挂钩
 *   G2.2 标题按任意键(Enter) → playing
 *   G2.3 出生点 x≈200（|Δ|≤25，契约写"x≈200"）
 *   G2.4 按住 D 一秒 → player.x 增大（真实键盘 down/up）
 *   G2.5 narrator.log 含触发键 'first_move'
 *   G2.6 全程 0 pageerror
 * exit：0=PASS；1=断言 FAIL（含目标文件不存在）；2=脚本/桥接异常
 */
"use strict";
const fs = require("fs");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || "file:///D:/2006L/chaitai/index.html";
const SHOTS = "D:/2006L/chaitai/shots";
const PREFIX = process.env.CHAITAI_SHOT_PREFIX || "";

let BROWSER = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const item = (ok, id, name, detail) => {
  console.log("  [" + (ok ? "PASS" : "FAIL") + "] " + id + " " + name + (detail ? "  " + detail : ""));
  if (!ok) fails.push(id);
};
const say = (s) => console.log("  [info] " + s);
const finish = (nm) => {
  console.log("GATE " + nm + ": " + (fails.length ? "FAIL (" + fails.join(",") + ")" : "PASS"));
  process.exit(fails.length ? 1 : 0);
};

(async () => {
  const nm = "gate-2-move";
  console.log("== " + nm + " @ " + URL + " ==");
  const file = URL.startsWith("file:///") ? decodeURIComponent(URL.slice(8)) : null;
  if (file && !fs.existsSync(file)) {
    console.log("  [FAIL] G2.0 目标文件不存在：" + file + "（游戏还没写出来？）");
    fails.push("G2.0"); finish(nm); return;
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  BROWSER = await puppeteer.launch({
    executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"],
  });
  const p = await BROWSER.newPage();
  const pageErrs = [];
  p.on("pageerror", (e) => pageErrs.push(String((e && e.message) || e)));
  p.on("console", (m) => { if (m.type() === "error") say("console error（不计入断言）：" + m.text()); });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: "load" });

  let hooked = true;
  try { await p.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 20000 }); }
  catch (e) { hooked = false; }
  await sleep(700);
  item(hooked, "G2.1", "window.__game 可挂钩", hooked ? "等到" : "20s 没等到");
  if (!hooked) { await BROWSER.close(); finish(nm); return; }

  const st = () => p.evaluate(() => window.__game.state());
  await p.keyboard.press("Enter");
  let started = true;
  try { await p.waitForFunction('window.__game.state().phase === "playing"', { timeout: 3500 }); }
  catch (e) { started = false; }
  await sleep(250);
  const s0 = await st();
  item(started && s0.phase === "playing", "G2.2", "标题按任意键(Enter)→playing", "phase=" + s0.phase);
  item(Math.abs(s0.player.x - 200) <= 25, "G2.3", "出生点 x≈200（|Δ|≤25）", "x=" + s0.player.x);

  /* 按住 D 一秒（真实键盘事件；中途采一次，vx/facing 只报告不断言） */
  await p.keyboard.down("KeyD");
  await sleep(500);
  const sMid = await st();
  await sleep(500);
  await p.keyboard.up("KeyD");
  await sleep(160);
  const s1 = await st();
  const dx = +(s1.player.x - s0.player.x).toFixed(1);
  item(dx > 1, "G2.4", "按住 D 一秒 player.x 增大", "x " + s0.player.x + " → " + s1.player.x + "（Δ=" + dx + "）");
  say("按住中途采样：vx=" + sMid.player.vx + " facing=" + sMid.player.facing + "（只报告）");
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-2-move-01.png" });

  const log = (s1.narrator && Array.isArray(s1.narrator.log)) ? s1.narrator.log : [];
  item(log.indexOf("first_move") >= 0, "G2.5", "log 含触发键 'first_move'", "log=" + JSON.stringify(log.slice(0, 10)));
  item(pageErrs.length === 0, "G2.6", "全程 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  say("截图：shots/" + PREFIX + "gate-2-move-01.png");
  await BROWSER.close();
  finish(nm);
})().catch(async (e) => {
  console.log("  [FAIL] G2.EX 脚本/桥接异常：" + ((e && e.stack) || e));
  console.log("GATE gate-2-move: FAIL (EX)");
  try { if (BROWSER) await BROWSER.close(); } catch (_) {}
  process.exit(2);
});
