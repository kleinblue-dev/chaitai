#!/usr/bin/env node
/* 拆台 · GATE-3 combat —— 走到触发 wave1；连打 J 使敌 hp 下降；打死→dead→自动复活
 *
 * 断言（按冻结契约）：
 *   G3.1 window.__game 可挂钩
 *   G3.2 标题按任意键(Enter) → playing
 *   G3.15 冲缓冲：cd 剩 ~40ms 真键按 K ⇒ ≤150ms 起冲（W4.1 A5；红侧永不接）
 *   G3.16 冲缓负控：cd 剩 ~260ms 按 K ⇒ +220~460ms 窗内不起第二段（缓冲 0.14 先过期）
 *   G3.3 向右走触发第一波（wave===1）
 *   G3.4 触发点在 x≥400（契约：向右过 x≈420 触发）
 *   G3.5 wave1 敌人 ≥2
 *   G3.6 其中红怪 ≥2（契约：2 个红怪）
 *   G3.7 log 含 'wave1_start'
 *   G3.8 以真实按键接近并连打 J → 某敌 hp 低于 maxHp（或该敌被打没）
 *   G3.9 debug.hurtPlayer(9999) → phase==='dead'
 *   G3.10 log 含 'player_death'
 *   G3.11 narrator.counters.deaths 记到这次死亡
 *   G3.12 自动复活回 phase==='playing'
 *   G3.13 log 含 'respawn'
 *   G3.14 全程 0 pageerror
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
  const nm = "gate-3-combat";
  console.log("== " + nm + " @ " + URL + " ==");
  const file = URL.startsWith("file:///") ? decodeURIComponent(URL.slice(8)) : null;
  if (file && !fs.existsSync(file)) {
    console.log("  [FAIL] G3.0 目标文件不存在：" + file + "（游戏还没写出来？）");
    fails.push("G3.0"); finish(nm); return;
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
  /* 按住某键直到谓词成立或超时；返回 { ok, last }（last=判定时的 state） */
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
  item(hooked, "G3.1", "window.__game 可挂钩", hooked ? "等到" : "20s 没等到");
  if (!hooked) { await BROWSER.close(); finish(nm); return; }

  await p.keyboard.press("Enter");
  const started = await waitPhase("playing", 3500);
  item(started, "G3.2", "标题按任意键(Enter)→playing", started ? "playing" : "3.5s 未进 playing");

  /* ---------- W4.1（A5）：冲刺输入缓冲（真键；正+负控）---------- */
  /* 环境：此刻 wave 未触发（x>420 才 trigger），dash 位移 650×0.16=104px ⇒ 每步 reset 到 190 防越线。 */
  const isDash = (s) => s.player.dashing === true;
  const freshStand = async () => { await p.evaluate(() => window.__game.debug.setPlayerPos(190, 470)); await sleep(150); };
  /* 正侧：K#1 起 dash（cd=0.32 自起帧）⇒ 侦测到 dashing 记 t0 ⇒ 在 t0+280ms（cd 剩 ≈40ms）真键再按 K ⇒ 期望缓冲接住。 */
  await freshStand();
  await p.keyboard.press("KeyK");
  let t0d = null;
  for (let i = 0; i < 40 && t0d === null; i++) { await sleep(12); if (isDash(await st())) t0d = Date.now(); }
  if (t0d !== null) { await p.evaluate(() => window.__game.debug.setPlayerPos(190, 470)); /* 防越 420 线；不影响 cd 计时 */ }
  let d2ms = null;
  if (t0d !== null) {
    await sleep(Math.max(0, (t0d + 280) - Date.now()));
    const tP = Date.now();
    await p.keyboard.press("KeyK");
    for (let i = 0; i < 27 && d2ms === null; i++) { await sleep(15); if (isDash(await st())) d2ms = Date.now() - tP; }
  }
  item(t0d !== null && d2ms !== null && d2ms <= 150, "G3.15",
    "冲缓冲：cd 剩 ~40ms 按 K ⇒ ≤2 帧起冲（红侧永不接）",
    "首冲侦测=" + (t0d !== null ? "✓" : "✗") + " 缓冲冲距按键 " + (d2ms === null ? "n/a（400ms 内未见 dashing ⇒ 红）" : d2ms + "ms") + "（期望 ≤150）");

  /* 负控：dash A 起后 +60ms（cd 剩 ≈260ms）按 K ⇒ 0.14s 缓冲先过期 ⇒ [A起+220,+460]ms 内不得再 dash。 */
  await sleep(500); /* 让上一段 dash/cd 收干 */
  await freshStand();
  await p.keyboard.press("KeyK");
  let t0b = null;
  for (let i = 0; i < 40 && t0b === null; i++) { await sleep(12); if (isDash(await st())) t0b = Date.now(); }
  let early = 0;
  if (t0b !== null) {
    await p.evaluate(() => window.__game.debug.setPlayerPos(190, 470));
    await sleep(Math.max(0, (t0b + 60) - Date.now()));
    await p.keyboard.press("KeyK"); /* cd 剩 ≈260ms（280-20 侦测滞后在 240-260 带） */
    await sleep(Math.max(0, (t0b + 220) - Date.now()));
    while (Date.now() < t0b + 460) { await sleep(15); if (isDash(await st())) early++; }
  }
  item(t0b !== null && early === 0, "G3.16",
    "冲缓负控：cd 剩 ~260ms 按 K ⇒ +220~460ms 窗内不起第二段",
    "dash A 侦测=" + (t0b !== null ? "✓" : "✗") + " 窗内 dashing 采样=" + early + "（期望 0）");
  await p.evaluate(() => window.__game.debug.setPlayerPos(190, 470)); /* 还原站位给后续走向右触发流程 */
  await sleep(200);

  /* —— 向右走触发 wave1（真实按键）—— */
  const walk = await holdUntil("KeyD", (s) => s.wave >= 1 || (s.enemies && s.enemies.length >= 2), 9000);
  await sleep(350);
  const sW = await st();
  const xTrig = walk.ok && walk.last ? walk.last.player.x : null;
  item(sW.wave === 1, "G3.3", "向右走触发第一波（wave===1）", "wave=" + sW.wave + " enemies=" + sW.enemies.length + " x=" + sW.player.x);
  item(xTrig != null && xTrig >= 400, "G3.4", "触发点 x≥400（契约 ≈420）", xTrig == null ? "没观测到触发瞬间" : "触发时 x=" + xTrig);
  item(sW.enemies.length >= 2, "G3.5", "wave1 敌人 ≥2", sW.enemies.length + " 个：" + JSON.stringify(sW.enemies.map((e) => e.kind)));
  const nRed = sW.enemies.filter((e) => e.kind === "red").length;
  item(nRed >= 2, "G3.6", "wave1 红怪 ≥2", "red=" + nRed);
  const logW = (sW.narrator && sW.narrator.log) || [];
  item(logW.indexOf("wave1_start") >= 0, "G3.7", "log 含 'wave1_start'", JSON.stringify(logW.slice(0, 10)));
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-3-combat-01-wave1.png" });

  /* —— 连打 J 打到某敌掉血（真实按键接近 + 攻击）—— */
  const seen = new Map(); // id -> { hpMax }
  let ev = null, jPresses = 0, minDist = 1e9, samples = 0;
  const t0 = Date.now();
  while (!ev && Date.now() - t0 < 25000) {
    const s = await st(); samples++;
    if (s.phase === "dead") { await sleep(450); continue; }
    if (s.phase !== "playing") { await sleep(250); continue; }
    const es = s.enemies || [];
    for (const e of es) {
      if (!seen.has(e.id)) seen.set(e.id, { hpMax: e.hp });
      const rec = seen.get(e.id);
      rec.hpMax = Math.max(rec.hpMax, e.hp);
      if (e.hp < e.maxHp || e.hp < rec.hpMax) { ev = { how: "hp 下降", id: e.id, kind: e.kind, hp: e.hp, maxHp: e.maxHp }; break; }
    }
    if (ev) break;
    for (const [id, rec] of seen) {
      if (!rec.gone && !es.some((e) => e.id === id) && rec.hpMax > 0) { rec.gone = true; ev = { how: "被打没（击杀后消失）", id }; }
    }
    if (ev) break;
    if (!es.length) { await sleep(250); continue; }
    let near = es[0];
    for (const e of es) if (Math.abs(e.x - s.player.x) < Math.abs(near.x - s.player.x)) near = e;
    const dx = near.x - s.player.x;
    minDist = Math.min(minDist, Math.abs(dx));
    if (Math.abs(dx) > 48) {
      const key = dx > 0 ? "KeyD" : "KeyA";
      await p.keyboard.down(key); await sleep(150); await p.keyboard.up(key);
    } else {
      await p.keyboard.press("KeyJ"); jPresses++;
      await sleep(70);
    }
    if (jPresses === 3) await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-3-combat-02-attacking.png" });
  }
  item(!!ev, "G3.8", "连打 J → 某敌 hp 下降（或被打没）",
    ev ? (ev.how === "hp 下降" ? "敌#" + ev.id + "(" + ev.kind + ") hp " + ev.hp + "/" + ev.maxHp : ev.how + " 敌#" + ev.id)
       : "25s 内按了 " + jPresses + " 次 J 没打出任何变化（最近距离 " + (minDist === 1e9 ? "n/a" : minDist.toFixed(0)) + "px）");

  /* —— 死亡 → 自动复活 —— */
  const before = await st();
  const deathsBefore = before.narrator.counters.deaths;
  await p.evaluate(() => window.__game.debug.hurtPlayer(9999));
  const died = await waitPhase("dead", 5000);
  await sleep(200);
  const sD = await st();
  item(died && sD.phase === "dead", "G3.9", "hurtPlayer(9999) → phase==='dead'", "phase=" + sD.phase + " hp=" + sD.player.hp);
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-3-combat-03-dead.png" });
  const logD = (sD.narrator && sD.narrator.log) || [];
  item(logD.indexOf("player_death") >= 0, "G3.10", "log 含 'player_death'", JSON.stringify(logD.slice(-6)));
  item(sD.narrator.counters.deaths > deathsBefore, "G3.11", "counters.deaths 记到这次死亡", deathsBefore + " → " + sD.narrator.counters.deaths);

  const back = await waitPhase("playing", 15000);
  await sleep(150);
  const sR = await st();
  item(back && sR.phase === "playing", "G3.12", "自动复活回 playing", "phase=" + sR.phase + " hp=" + sR.player.hp);
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-3-combat-04-respawn.png" });
  const logR = (sR.narrator && sR.narrator.log) || [];
  item(logR.indexOf("respawn") >= 0, "G3.13", "log 含 'respawn'", JSON.stringify(logR.slice(-6)));
  item(pageErrs.length === 0, "G3.14", "全程 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  say("采样 " + samples + " 次；J 按了 " + jPresses + " 次；截图 4 张在 shots/" + PREFIX + "gate-3-combat-0*.png");
  await BROWSER.close();
  finish(nm);
})().catch(async (e) => {
  console.log("  [FAIL] G3.EX 脚本/桥接异常：" + ((e && e.stack) || e));
  console.log("GATE gate-3-combat: FAIL (EX)");
  try { if (BROWSER) await BROWSER.close(); } catch (_) {}
  process.exit(2);
});
