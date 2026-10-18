#!/usr/bin/env node
/* 拆台 · GATE-5 clear —— clearWave 两次 → cleared + arena_cleared/outro；按 R 重开
 *
 * 断言（按冻结契约）：
 *   G5.1 window.__game 可挂钩
 *   G5.2 标题按任意键(Enter) → playing
 *   G5.3 向右走触发第一波（wave===1）
 *   G5.4 debug.clearWave() 第一次后 wave===2（等 wave2 出现；必要时右移推进）
 *   G5.5 log 含 'wave2_start'
 *   G5.6 debug.clearWave() 第二次后 cleared===true
 *   G5.7 log 含 'arena_cleared'
 *   G5.8 log 含 'outro'
 *   G5.9 按 R → log 含 'restart_done'
 *   G5.10 按 R 后 phase==='playing'
 *   G5.11 重开是干净开局（wave===0 且无敌人）
 *   G5.12 全程 0 pageerror
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
  const nm = "gate-5-clear";
  console.log("== " + nm + " @ " + URL + " ==");
  const file = URL.startsWith("file:///") ? decodeURIComponent(URL.slice(8)) : null;
  if (file && !fs.existsSync(file)) {
    console.log("  [FAIL] G5.0 目标文件不存在：" + file + "（游戏还没写出来？）");
    fails.push("G5.0"); finish(nm); return;
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

  const st = () => p.evaluate(() => window.__game.state());
  const waitPhase = async (ph, ms) => {
    try { await p.waitForFunction('window.__game.state().phase === ' + JSON.stringify(ph), { timeout: ms }); return true; }
    catch (e) { return false; }
  };
  const waitLog = async (key, ms) => {
    try { await p.waitForFunction('(function(){var s=window.__game.state();return (s.narrator.log||[]).indexOf(' + JSON.stringify(key) + ') >= 0;})()', { timeout: ms }); return true; }
    catch (e) { return false; }
  };
  const holdUntil = async (key, pred, ms, iv) => {
    await p.keyboard.down(key);
    const t0 = Date.now();
    let last = null, ok = false;
    while (Date.now() - t0 < ms) {
      last = await st();
      if (pred(last)) { ok = true; break; }
      await sleep(iv || 90);
    }
    await p.keyboard.up(key);
    await sleep(80);
    return { ok, last };
  };

  let hooked = true;
  try { await p.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 20000 }); }
  catch (e) { hooked = false; }
  await sleep(700);
  item(hooked, "G5.1", "window.__game 可挂钩", hooked ? "等到" : "20s 没等到");
  if (!hooked) { await BROWSER.close(); finish(nm); return; }

  await p.keyboard.press("Enter");
  const started = await waitPhase("playing", 3500);
  item(started, "G5.2", "标题按任意键(Enter)→playing", started ? "playing" : "3.5s 未进 playing");

  const walk = await holdUntil("KeyD", (s) => s.wave >= 1, 9000);
  const s1 = await st();
  item(s1.wave === 1, "G5.3", "向右走触发第一波（wave===1）", "wave=" + s1.wave + " enemies=" + s1.enemies.length + " x=" + s1.player.x);

  /* 第一次 clearWave → 应出现 wave2（清场推进是系统的活；必要时右移推进当助力） */
  await p.evaluate(() => window.__game.debug.clearWave());
  let w2 = false, pushed = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    const s = await st();
    if (s.wave === 2) { w2 = true; break; }
    if (Date.now() - t0 > 2500 && pushed < 3) {
      pushed++;
      await p.keyboard.down("KeyD"); await sleep(700); await p.keyboard.up("KeyD");
    }
    await sleep(250);
  }
  const s2 = await st();
  item(w2 && s2.wave === 2, "G5.4", "clearWave()×1 后 wave===2", "wave=" + s2.wave + " enemies=" + s2.enemies.length + "（右移推进 " + pushed + " 次）");
  const log2 = (s2.narrator && s2.narrator.log) || [];
  item(log2.indexOf("wave2_start") >= 0, "G5.5", "log 含 'wave2_start'", JSON.stringify(log2.slice(-6)));
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-5-clear-01-wave2.png" });

  /* 第二次 clearWave → cleared */
  await p.evaluate(() => window.__game.debug.clearWave());
  let cleared = false;
  try { await p.waitForFunction('(function(){var s=window.__game.state();return s.cleared === true || s.phase === "cleared";})()', { timeout: 12000 }); cleared = true; }
  catch (e) {}
  const s3 = await st();
  item(cleared && s3.cleared === true, "G5.6", "clearWave()×2 后 cleared===true", "cleared=" + s3.cleared + " phase=" + s3.phase);
  /* outro 与"可重开"标志在 arena_cleared 之后另有动画节拍，等它播出来 */
  const gotOutro = await waitLog("outro", 8000);
  const s4 = await st();
  const log4 = (s4.narrator && s4.narrator.log) || [];
  item(log4.indexOf("arena_cleared") >= 0, "G5.7", "log 含 'arena_cleared'", JSON.stringify(log4.slice(-8)));
  item(gotOutro && log4.indexOf("outro") >= 0, "G5.8", "log 含 'outro'", JSON.stringify(log4.slice(-8)));
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-5-clear-02-cleared.png" });

  /* 按 R 重开 */
  await p.keyboard.press("KeyR");
  const backP = await waitPhase("playing", 4000);
  await sleep(300);
  const s5 = await st();
  const log5 = (s5.narrator && s5.narrator.log) || [];
  item(log5.indexOf("restart_done") >= 0, "G5.9", "按 R → log 含 'restart_done'", JSON.stringify(log5.slice(-6)));
  item(backP && s5.phase === "playing", "G5.10", "按 R 后 phase==='playing'", "phase=" + s5.phase);
  item(s5.wave === 0 && (s5.enemies || []).length === 0, "G5.11", "重开是干净开局（wave=0、无敌人）", "wave=" + s5.wave + " enemies=" + s5.enemies.length);
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-5-clear-03-restart.png" });
  item(pageErrs.length === 0, "G5.12", "全程 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  say("截图：shots/" + PREFIX + "gate-5-clear-01-wave2.png, -02-cleared.png, -03-restart.png");
  await BROWSER.close();
  finish(nm);
})().catch(async (e) => {
  console.log("  [FAIL] G5.EX 脚本/桥接异常：" + ((e && e.stack) || e));
  console.log("GATE gate-5-clear: FAIL (EX)");
  try { if (BROWSER) await BROWSER.close(); } catch (_) {}
  process.exit(2);
});
