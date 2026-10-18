#!/usr/bin/env node
/* 一次性诊断（非套件件）：抓 G14.6 链中玩家被打死的真凶。
 * 复刻 chain 走位（240 退位 + 等 chase + 双退位 + 清机关），每 250ms 采样：
 * 玩家 hp/deaths/perfDodges/dashing/invuln/attacking + 两敌 x/state —— 定位 hp 掉落瞬间的现场。
 * 用法：node tools/_diag-g14-killer.cjs > shots/_diag-g14-killer.txt 2>&1
 */
"use strict";
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || "file:///D:/2006L/chaitai/index.html";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const B = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const p = await B.newPage();
  p.on("pageerror", (e) => console.log("[pageerror] " + e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: "load" });
  await p.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 20000 });
  await sleep(700);
  await p.keyboard.press("Enter");
  await p.waitForFunction('window.__game.state().phase === "playing"', { timeout: 3500 });
  await sleep(400);
  await p.evaluate(() => { window.__game.debug.setPlayerX(190); }); await sleep(400);
  const st = () => p.evaluate(() => window.__game.state());
  const hpOf = async (id) => { const s = await st(); for (const e of (s.enemies || [])) if (e.id === id) return e; return null; };
  const placeAt = async (x) => { await p.evaluate((x) => window.__game.debug.setPlayerPos(x, 470), x); await sleep(120); };
  const faceRight = async () => { await p.keyboard.down("KeyD"); await sleep(70); await p.keyboard.up("KeyD"); };
  const waitChase = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = await hpOf(id); if (!e || e.state === "chase") return true; await sleep(55); } return false; };
  /* 触发 wave1 */
  await p.keyboard.down("KeyD");
  { const t0 = Date.now(); while (Date.now() - t0 < 9000) { const s = await st(); if (s.wave >= 1 || (s.enemies || []).length >= 2) break; await sleep(90); }
    await p.keyboard.up("KeyD"); await sleep(250); }
  await p.evaluate(() => window.__game.debug.clearTraps());

  /* 采样器：200ms 网格，独立于循环（Promise 并跑） */
  let sampling = true;
  const grid = [];
  const camp = (async () => { while (sampling) {
    const s = await st();
    grid.push({ t: +(s.dbg.t).toFixed(2), hp: s.player.hp, d: s.narrator.counters.deaths, pd: s.narrator.counters.perfDodges,
      dash: s.player.dashing, inv: s.player.invuln, atk: s.player.attacking, px: Math.round(s.player.x),
      es: (s.enemies || []).map((e) => e.id + "@" + Math.round(e.x) + ":" + e.state).join(" ") });
    await sleep(200); } })();

  /* 复刻 chain：12 轮（比实际 8 轮更长，放大症状） */
  const s0 = await st();
  const eA0 = (s0.enemies || []).slice().sort((a, b) => a.x - b.x)[0];
  console.log("开测：玩家hp=" + s0.player.hp + " deaths=" + s0.narrator.counters.deaths + " A=" + (eA0 && eA0.id));
  let cur = await hpOf(eA0.id);
  for (let shots = 0; shots < 12 && cur; shots++) {
    cur = (await hpOf(eA0.id)) || cur;
    await placeAt(cur.x - 240);
    await waitChase(eA0.id, 2200);
    cur = (await hpOf(eA0.id)) || cur;
    await placeAt(cur.x - 240);
    await faceRight();
    await p.keyboard.down("KeyJ");
    await p.waitForFunction('window.__game.state().dyn.qiActive===true', { timeout: 1600 }).catch(() => {});
    await p.keyboard.up("KeyJ");
    { const eN = await hpOf(eA0.id); if (eN) await placeAt(eN.x - 240); }
    await sleep(650);
    cur = await hpOf(eA0.id);
  }
  sampling = false; await camp;
  const s1 = await st();
  console.log("收测：玩家hp=" + s1.player.hp + " deaths=" + s1.narrator.counters.deaths + " perfDodges=" + s1.narrator.counters.perfDodges);
  console.log("---- 采样（t, hp, deaths, perfDodge, dash, invuln, atk, px | 敌） ----");
  for (const g of grid) console.log([g.t, g.hp, g.d, g.pd, g.dash ? 1 : 0, g.inv ? 1 : 0, g.atk ? 1 : 0, g.px, "|", g.es].join("  "));
  console.log("---- Narr 事件尾（玩家相关过滤） ----");
  const ev = await p.evaluate(() => window.__game.debug.telemetry().events);
  const rel = ev.filter((e) => /hurt|death|perfect|dodge|dashland|low/i.test(JSON.stringify(e)));
  console.log(JSON.stringify(rel.slice(-30), null, 1));
  await B.close();
})().catch(async (e) => { console.log("EX " + ((e && e.stack) || e)); process.exit(2); });
