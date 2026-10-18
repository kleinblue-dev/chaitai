#!/usr/bin/env node
/* 拆台 · GATE-4 defy-wall —— 反复进左区 4 次（真实按键）→ defy_left≥3；x>220 后砌墙
 *
 * 契约：左边界区 x<120＝"违抗区"，反复走进去累计 defyLeft，第 4 次触发砌墙；
 *       墙 x≈150 升起；若玩家在墙左侧则等玩家 x>220 再升。
 *
 * 断言：
 *   G4.1 window.__game 可挂钩
 *   G4.2 标题按任意键(Enter) → playing
 *   G4.3 以真实按键 4 次走进左区（每次进到 x<120）
 *   G4.4 log 里 'defy_left' ≥3 次
 *   G4.5 narrator.counters.defyLeft ≥3
 *   G4.6 玩家 x>220 后 wall.built === true
 *   G4.7 log 含 'wall_build'
 *   G4.8 全程 0 pageerror
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
  const nm = "gate-4-defy-wall";
  console.log("== " + nm + " @ " + URL + " ==");
  const file = URL.startsWith("file:///") ? decodeURIComponent(URL.slice(8)) : null;
  if (file && !fs.existsSync(file)) {
    console.log("  [FAIL] G4.0 目标文件不存在：" + file + "（游戏还没写出来？）");
    fails.push("G4.0"); finish(nm); return;
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
  const holdUntil = async (key, pred, ms, iv) => {
    await p.keyboard.down(key);
    const t0 = Date.now();
    let last = null, ok = false;
    while (Date.now() - t0 < ms) {
      last = await st();
      if (pred(last)) { ok = true; break; }
      await sleep(iv || 80);
    }
    await p.keyboard.up(key);
    await sleep(70);
    return { ok, last };
  };

  let hooked = true;
  try { await p.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 20000 }); }
  catch (e) { hooked = false; }
  await sleep(700);
  item(hooked, "G4.1", "window.__game 可挂钩", hooked ? "等到" : "20s 没等到");
  if (!hooked) { await BROWSER.close(); finish(nm); return; }

  await p.keyboard.press("Enter");
  let started = true;
  try { await p.waitForFunction('window.__game.state().phase === "playing"', { timeout: 3500 }); }
  catch (e) { started = false; }
  item(started, "G4.2", "标题按任意键(Enter)→playing", started ? "playing" : "3.5s 未进 playing");

  /* 一次"进左区"：按 A 走到 x<115，停 320ms，再按 D 退出到 x>185 */
  const doEntry = async (shotPath) => {
    const inR = await holdUntil("KeyA", (s) => s.player.x < 115, 5000);
    await sleep(320);
    const sIn = await st();
    if (shotPath) await p.screenshot({ path: shotPath });
    const outR = await holdUntil("KeyD", (s) => s.player.x > 185, 6000);
    await sleep(140);
    const sOut = await st();
    return { inOk: inR.ok && sIn.player.x < 120, xIn: +sIn.player.x.toFixed(1),
      xOut: +sOut.player.x.toFixed(1), defy: sIn.narrator.counters.defyLeft, outOk: outR.ok };
  };

  const entries = [];
  for (let i = 1; i <= 4; i++) {
    entries.push(await doEntry(i === 1 ? SHOTS + "/" + PREFIX + "gate-4-defy-wall-01-zone.png" : null));
    say("第 " + i + " 次进区：xIn=" + entries[i - 1].xIn + " xOut=" + entries[i - 1].xOut + " defyLeft=" + entries[i - 1].defy + (entries[i - 1].outOk ? "" : "（退出腿没走完）"));
  }
  item(entries.every((e) => e.inOk), "G4.3", "以真实按键 4 次走进左区（x<120）", "每次进入 x=" + entries.map((e) => e.xIn).join(", "));

  const sA = await st();
  const defyLogCount = ((sA.narrator && sA.narrator.log) || []).filter((k) => k === "defy_left").length;
  item(defyLogCount >= 3, "G4.4", "log 里 'defy_left' ≥3 次", "实际 " + defyLogCount + " 次；log=" + JSON.stringify(((sA.narrator && sA.narrator.log) || []).slice(0, 12)));
  item(sA.narrator.counters.defyLeft >= 3, "G4.5", "counters.defyLeft ≥3", "值=" + sA.narrator.counters.defyLeft);

  /* 若前 4 次没把计数顶到砌墙阈值（4），再补真实进区给砌墙一个公平机会。
     G4.4/G4.5 已按"4 次进区"的规矩判过，补动作不改变上面的结论。 */
  let extra = 0;
  while ((await st()).narrator.counters.defyLeft < 4 && extra < 3) {
    extra++;
    const e = await doEntry(null);
    say("补第 " + extra + " 次进区：xIn=" + e.xIn + " defyLeft=" + e.defy);
  }
  if (extra) say("前 4 次进区后 defyLeft 只记到 " + (await st()).narrator.counters.defyLeft + "，补了 " + extra + " 次真实进区");

  /* —— 让玩家 x>220 → 墙应升起 —— */
  const walkR = await holdUntil("KeyD", (s) => s.player.x > 232, 8000);
  say("右移腿：" + (walkR.ok ? "已达 x=" + walkR.last.player.x : "没走到 x>232"));
  let built = false;
  try { await p.waitForFunction('(function(){var w=window.__game.state().wall;return w && w.built === true;})()', { timeout: 6000 }); built = true; }
  catch (e) {}
  const sW = await st();
  item(built && sW.wall.built === true, "G4.6", "玩家 x>220 后 wall.built===true",
    "x=" + sW.player.x + " wall=" + JSON.stringify(sW.wall));
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-4-defy-wall-02-wall.png" });
  const logW = (sW.narrator && sW.narrator.log) || [];
  item(logW.indexOf("wall_build") >= 0, "G4.7", "log 含 'wall_build'", JSON.stringify(logW.slice(-8)));
  item(pageErrs.length === 0, "G4.8", "全程 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  say("截图：shots/" + PREFIX + "gate-4-defy-wall-01-zone.png, -02-wall.png");
  await BROWSER.close();
  finish(nm);
})().catch(async (e) => {
  console.log("  [FAIL] G4.EX 脚本/桥接异常：" + ((e && e.stack) || e));
  console.log("GATE gate-4-defy-wall: FAIL (EX)");
  try { if (BROWSER) await BROWSER.close(); } catch (_) {}
  process.exit(2);
});
