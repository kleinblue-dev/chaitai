#!/usr/bin/env node
/* 拆台 · GATE-13 dynamics —— W5.3 动态表现力：残影 / 剑气 / 收刀顿帧 / 居合
 *
 * 判据（W5.3 契约冻结；红侧预注册＝在旧树（W5.2 定版 game.js c226d540）上 13 红 1 绿：
 *   本闸全部数值判据依赖 W5.3 新增钩子/字段（debug.afterimageCount 等 / state().dyn），
 *   旧树上必然全红；唯一绿＝G13-0 零错误哨兵（探针全部 try 守卫，不产 pageerror）。
 *   判据非空性由 falsify-g13（M1 删出招残影锚 G13.1 / M2 禁 qi 释放锚 G13.5 /
 *   M3 顿帧上限回落锚 G13.8 / M4 删居合分支锚 G13.11）实证。）
 *
 *   G13.1 出招留影：两次单发 J，各观测 afterimageCount 峰值 ≥1，且第二序列末值 ≤1（回落）
 *   G13.2 冲刺残影回归：真键 K 冲刺，峰值 ≥3（既有 dash 机制不得被 W5.3 破坏）
 *   G13.3 残影衰减：峰值后单调不增，且 0.7s 窗口末归 0（既有 0.28s 生命周期）
 *   G13.4 三钩子契约：debug.{afterimageCount,bladeTrailCount,qiParticleCount} 均函数＋返回有限数 ≥0
 *   G13.5 剑气释放：长按 J ⇒ dyn.qiActive 出现（含 0.38s 门槛+起手）＋dyn.qiParts>0
 *   G13.6 粒子预算：peaks qiParts ∈[45,120]（120＝硬上限合同；≥45＝非空证据地板）
 *   G13.7 剑气拖尾：飞行期 dyn.qiTrail 峰值 ≥5；消散后 qiTrail=0 且 qiActive=false
 *   G13.8 收刀顿帧：三连第 3 段真命中 ⇒ max(dyn.hitstop) ≥0.13（数学上⇒突破旧 0.12 上限）
 *   G13.9 闪白：G13.8 窗口 max(dyn.flash)>0.05，且此后 dyn.flash 归 0
 *   G13.10 W3 兼容：冻结窗内按 J ⇒ 解冻后 dyn.buf.atk ≥0.10（注入值 0.14；残留衰减 ≤0.08 不可达）
 *   G13.11 居合：dash 中段 J ⇒ dyn.iaido>0 ＋残影≥3 ＋slowT>0 ＋atkActive 全程 false（不误触普攻）
 *   G13.12 子弹时间恢复：前置 slowT>0；0.6s 后 dyn.slowT=0
 *   G13.13 帧率：telemetry().frameP95Ms ≤17.2（≥58fps）＋前置：测量窗内 qi 曾活跃
 *   G13-0 全程 0 pageerror
 *
 * state().dyn 契约（至少含，可多不可少）：
 *   {qiTrail, qiParts, qiActive, hitstop, slowT, flash, iaido, atkActive, buf:{atk}}
 *
 * 站位纪律：wave1 由玩家 x>420 触发 ⇒ 所有 dash 探针在 x≤316 处起冲（190/300 起点，位移 104px）。
 * 环境：CHAITAI_URL 换被测对象（默认 file:///D:/2006L/chaitai/index.html）；
 *       CHAITAI_SHOT_PREFIX 截图目录（falsify-g13 副本用；默认 shots/gate-13/）。
 * exit：0=PASS；1=断言 FAIL（含目标文件不存在）；2=脚本/桥接异常
 */
"use strict";
const fs = require("fs");
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || "file:///D:/2006L/chaitai/index.html";
const ROOT = "D:/2006L/chaitai";
const SHOTS = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/gate-13");

let BROWSER = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
let nItems = 0;
const item = (ok, id, name, detail) => {
  nItems++;
  console.log("  [" + (ok ? "PASS" : "FAIL") + "] " + id + " " + name + (detail ? "  " + detail : ""));
  if (!ok) fails.push(id);
};
const say = (s) => console.log("  [info] " + s);
const finish = (nm) => {
  console.log("---- 汇总：PASS " + (nItems - fails.length) + " FAIL=" + fails.length + " rc=" + (fails.length ? 1 : 0) + " ----");
  console.log("GATE " + nm + ": " + (fails.length ? "FAIL (" + fails.join(",") + ")" : "PASS")); /* 仪器级修复：补右括号（纯显示串；判据/阈值零改动） */
  process.exit(fails.length ? 1 : 0);
};
const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
const maxOf = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);

(async () => {
  const nm = "gate-13-dynamics";
  console.log("== " + nm + " @ " + URL + " ==");
  const file = URL.startsWith("file:///") ? decodeURIComponent(URL.slice(8)).replace(/[?#].*$/, "") : null;
  if (file && !fs.existsSync(file)) {
    console.log("  [FAIL] G13.0 目标文件不存在：" + file);
    fails.push("G13.0"); finish(nm); return;
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
    try { await p.waitForFunction('window.__game && window.__game.state().phase === ' + JSON.stringify(ph), { timeout: ms }); return true; }
    catch (e) { return false; }
  };
  /* 页内快速采样：每 ms 毫秒取一次 fnBody 表达式值；异常/非数 → -1 哨兵（"读不到"） */
  const burst = (fnBody, ms, n) => p.evaluate((fnBody, ms, n) => new Promise((res) => {
    let f; try { f = new Function("return (" + fnBody + ")"); } catch (e) { f = function () { return -1; }; }
    const series = []; const t0 = performance.now();
    (function tick() {
      let v; try { v = f(); } catch (e) { v = -1; }
      if (typeof v !== "number" || !isFinite(v)) v = -1;
      series.push(v);
      if (series.length < n && performance.now() - t0 < ms * n + 900) setTimeout(tick, ms);
      else res(series);
    })();
  }), fnBody, ms, n);
  /* 页内监视：fnBody 表达式首次为真 ⇒ 返回毫秒数（相对开始）；超时 ⇒ -1 */
  const watchFn = (fnBody, ms) => p.evaluate((fnBody, ms) => new Promise((res) => {
    let f; try { f = new Function("return (" + fnBody + ")"); } catch (e) { f = function () { return false; }; }
    const t0 = performance.now();
    (function tick() {
      let v = false; try { v = !!f(); } catch (e) { v = false; }
      if (v) return res(Math.round(performance.now() - t0));
      if (performance.now() - t0 > ms) return res(-1);
      setTimeout(tick, 8);
    })();
  }), fnBody, ms);

  let hooked = true;
  try { await p.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 20000 }); }
  catch (e) { hooked = false; }
  await sleep(700);
  if (!hooked) {
    console.log("  [FAIL] G13.0 window.__game 20s 没等到");
    fails.push("G13.0"); await BROWSER.close(); finish(nm); return;
  }
  await p.keyboard.press("Enter");
  const started = await waitPhase("playing", 3500);
  say("入局 playing=" + started);
  await sleep(400);
  await p.evaluate(() => { if (window.__game.debug.setPlayerX) window.__game.debug.setPlayerX(300); });
  await sleep(500);

  /* ---------- G13.4 三钩子契约 ---------- */
  const hookT = await p.evaluate(() => {
    const d = window.__game.debug || {};
    const t = (x) => typeof x;
    const v = (fn) => { try { const r = fn(); return (typeof r === "number" && isFinite(r)) ? r : null; } catch (e) { return null; } };
    return { a: t(d.afterimageCount), b: t(d.bladeTrailCount), c: t(d.qiParticleCount),
      av: v(d.afterimageCount), bv: v(d.bladeTrailCount), cv: v(d.qiParticleCount) };
  });
  const hooksOk = hookT.a === "function" && hookT.b === "function" && hookT.c === "function"
    && hookT.av !== null && hookT.bv !== null && hookT.cv !== null && hookT.av >= 0 && hookT.bv >= 0 && hookT.cv >= 0;
  item(hooksOk, "G13.4", "三钩子契约（afterimage/bladeTrail/qiParticle Count）", JSON.stringify(hookT));

  /* ---------- G13.1 出招留影（两次单发 J） ---------- */
  await p.keyboard.press("KeyJ");
  const a1 = await burst("window.__game.debug.afterimageCount()", 25, 26);
  await sleep(350);
  await p.keyboard.press("KeyJ");
  const a2 = await burst("window.__game.debug.afterimageCount()", 25, 26);
  const m1 = maxOf(a1), m2 = maxOf(a2);
  item(m1 >= 1 && m2 >= 1 && a2[a2.length - 1] <= 1, "G13.1", "出招留影：两击各观测残影 ≥1（且回落）",
    "max1=" + m1 + " max2=" + m2 + " a2尾=[" + a2.slice(-5).join(",") + "]");

  /* ---------- G13.2/G13.3 dash 残影回归＋衰减 ---------- */
  await sleep(350);
  await p.keyboard.press("KeyK");
  const d1 = await burst("window.__game.debug.afterimageCount()", 25, 28);
  const md = maxOf(d1);
  item(md >= 3, "G13.2", "冲刺残影回归：峰值 ≥3（既有机制）", "max=" + md + " 首6=[" + d1.slice(0, 6).join(",") + "]");
  let pk = 0;
  for (let i = 1; i < d1.length; i++) if (d1[i] > d1[pk]) pk = i;
  let mono = true;
  for (let i = pk + 1; i < d1.length; i++) if (d1[i] > d1[i - 1]) mono = false;
  const dTail = d1[d1.length - 1];
  item(md >= 3 && mono && dTail === 0, "G13.3", "残影衰减：峰值后单调不增＋窗口末归 0",
    "peak=" + d1[pk] + "(i=" + pk + ") 单调=" + mono + " 末值=" + dTail);
  await sleep(400);
  await p.evaluate(() => { if (window.__game.debug.setPlayerX) window.__game.debug.setPlayerX(300); });
  await sleep(200);

  /* ---------- G13.11/G13.12 居合（dash 中段按 J；x=300→404<420 不触发 wave1） ---------- */
  await p.keyboard.press("KeyK");
  const dashSeen = await watchFn("window.__game.state().player.dashing===true", 600);
  const iaiWatchP = watchFn("((window.__game.state().dyn||{}).iaido||0)>0", 600);
  const comboP = p.evaluate(() => new Promise((res) => {
    const out = { maxGhost: 0, atkTrue: 0, slowTSeen: 0, n: 0 };
    const t0 = performance.now();
    (function tick() {
      let s; try { s = window.__game.state(); } catch (e) { s = {}; }
      const d = s.dyn || {};
      let g = -1; try { g = window.__game.debug.afterimageCount(); } catch (e) { g = -1; }
      if (typeof g === "number" && g > out.maxGhost) out.maxGhost = g;
      if (d.atkActive === true) out.atkTrue++;
      if (+d.slowT > 0) out.slowTSeen++;
      out.n++;
      if (performance.now() - t0 < 800) setTimeout(tick, 12); else res(out);
    })();
  }));
  await p.keyboard.press("KeyJ");
  const iaiMs = await iaiWatchP;
  const CB = await comboP;
  item(iaiMs >= 0 && CB.maxGhost >= 3 && CB.slowTSeen > 0 && CB.atkTrue === 0, "G13.11",
    "居合：dash 中 J ⇒ iaido＋残影≥3＋slowT>0＋未误触普攻",
    "dash侦测=" + dashSeen + "ms iaido=" + (iaiMs >= 0 ? iaiMs + "ms" : "未观测") + " 残影max=" + CB.maxGhost
    + " slowT样本=" + CB.slowTSeen + " atkActive样本=" + CB.atkTrue);
  const sSlow = await st();
  await sleep(650);
  const slowNow = num((sSlow.dyn || {}).slowT, -1);
  const sSlow2 = await st();
  const slowNow2 = num((sSlow2.dyn || {}).slowT, -1);
  item(CB.slowTSeen > 0 && slowNow2 === 0, "G13.12", "子弹时间恢复：0.6s 后 slowT 归 0",
    "前置 slowT 样本=" + CB.slowTSeen + " 现 slowT=" + slowNow2 + "（0.6s 前=" + slowNow + "）");
  await p.screenshot({ path: path.join(SHOTS, "gate-13-dynamics-02-iai.png") }).catch(() => {});

  /* ---------- G13.5/G13.6/G13.7 剑气（x=190；三次长按，第 2/3 次与前发尾巴叠加压预算） ---------- */
  await p.evaluate(() => { if (window.__game.debug.setPlayerX) window.__game.debug.setPlayerX(190); });
  await sleep(400);
  await p.keyboard.down("KeyJ");
  const q1ms = await watchFn("(window.__game.state().dyn||{}).qiActive===true", 1800);
  const qShotP = p.screenshot({ path: path.join(SHOTS, "gate-13-dynamics-01-qi.png") }).catch(() => {});
  const mixBody = "((((window.__game.state().dyn||{}).qiParts||0)*1000)+((window.__game.state().dyn||{}).qiTrail||0))";
  const mixP = burst(mixBody, 20, 150); /* 3.0s：覆盖三次长按全程 */
  await p.keyboard.up("KeyJ"); await sleep(60);
  await p.keyboard.down("KeyJ"); await sleep(950);
  await p.keyboard.up("KeyJ"); await sleep(60);
  await p.keyboard.down("KeyJ"); await sleep(750);
  await p.keyboard.up("KeyJ");
  await qShotP;
  const mixS = await mixP;
  const parts = mixS.map((v) => (v >= 0 ? Math.floor(v / 1000) : -1));
  const trail = mixS.map((v) => (v >= 0 ? v % 1000 : -1));
  const pMax = maxOf(parts), tMax = maxOf(trail);
  item(q1ms >= 0 && pMax >= 1, "G13.5", "剑气释放：长按 J（≥0.38s 门槛）⇒ qiActive＋粒子>0",
    "qi 出现=" + (q1ms >= 0 ? q1ms + "ms" : "未观测（1.8s 内）") + " 粒子峰值=" + pMax);
  item(pMax >= 45 && pMax <= 120, "G13.6", "粒子预算：qiParts 峰值 ∈[45,120]（120 硬上限）",
    "峰值=" + pMax + "（三次长按 3.0s 窗，样本 " + parts.length + "；超限=跳过排放，故 ≤120 为上界合同）");
  await sleep(800);
  const sQ = await st();
  const trailNow = num((sQ.dyn || {}).qiTrail, -1), qiNow = !!((sQ.dyn || {}).qiActive);
  item(tMax >= 5 && trailNow === 0 && qiNow === false, "G13.7", "剑气拖尾：飞行期 ≥5；消散后 qiTrail=0 且 qiActive=false",
    "拖尾峰值=" + tMax + " 现拖尾=" + trailNow + " 现 qiActive=" + qiNow);

  /* ---------- G13.13 帧率（telemetry ~600 帧≈10s 缓冲，覆盖刚过去的剑气段） ---------- */
  const tm = await p.evaluate(() => { try { return window.__game.debug.telemetry(); } catch (e) { return null; } });
  const p95 = tm && typeof tm.frameP95Ms === "number" ? tm.frameP95Ms : -1;
  item(q1ms >= 0 && p95 >= 0 && p95 <= 17.2, "G13.13", "帧率：p95 ≤17.2ms（≥58fps）＋前置 qi 活跃",
    "frameP95Ms=" + p95 + " frames=" + (tm && tm.frameCount) + "（窗内 qi 活跃=" + (q1ms >= 0) + "）");

  /* ---------- G13.8/G13.9/G13.10 三连收刀顿帧（真打 wave1；gate-3 接近配方） ---------- */
  await p.keyboard.down("KeyD");
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      const s = await st();
      if (s.wave >= 1 || (s.enemies && s.enemies.length >= 2)) break;
      await sleep(90);
    }
    await p.keyboard.up("KeyD"); await sleep(250);
  }
  const sW = await st();
  say("wave1 触发：" + (sW.wave >= 1) + " 敌=" + ((sW.enemies || []).length));

  const combatSampleP = p.evaluate(() => new Promise((res) => {
    const out = { n: 0, maxHit: 0, maxFlash: 0, maxCombo: 0, samples: [] };
    const t0 = performance.now();
    (function tick() {
      let s; try { s = window.__game.state(); } catch (e) { s = {}; }
      const d = s.dyn || {}, pl = s.player || {};
      const hit = Math.abs(+d.hitstop) || 0, fl = Math.abs(+d.flash) || 0;
      const cb = Math.abs(+pl.combo) || 0, bf = +((d.buf || {}).atk) || 0;
      if (hit > out.maxHit) out.maxHit = hit;
      if (fl > out.maxFlash) out.maxFlash = fl;
      if (cb > out.maxCombo) out.maxCombo = cb;
      out.samples.push({ t: Math.round(performance.now() - t0), hit: +hit.toFixed(3), fl: +fl.toFixed(3), buf: +bf.toFixed(3) });
      out.n++;
      if (!window.__g13Stop && out.n < 3600) setTimeout(tick, 8); else res(out);
    })();
  }));
  let frzMs = -1;
  const freezeP = p.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    (function tick() {
      let h = 0; try { h = Math.abs(+((window.__game.state().dyn || {}).hitstop)) || 0; } catch (e) { h = 0; }
      if (h >= 0.13) return res(Math.round(performance.now() - t0));
      if (performance.now() - t0 > 26000) return res(-1);
      setTimeout(tick, 8);
    })();
  }));
  freezeP.then((v) => { frzMs = v; if (v >= 0) { p.keyboard.press("KeyJ").catch(() => {}); } }, () => {}); /* 冻结窗内按 J（W3 探针）；拒绝处理器＝close 竞态防未处理拒绝（仪器级，判据零改动） */
  let jc = 0, minD = 9e9;
  {
    const tc = Date.now();
    while (frzMs < 0 && Date.now() - tc < 24000) {
      const s = await st();
      if (!s || s.phase === "dead") { await sleep(400); continue; }
      if (s.phase !== "playing") { await sleep(200); continue; }
      const es = s.enemies || [];
      if (!es.length) { await sleep(200); continue; }
      let near = es[0];
      for (const e of es) if (Math.abs(e.x - s.player.x) < Math.abs(near.x - s.player.x)) near = e;
      const dx = near.x - s.player.x;
      minD = Math.min(minD, Math.abs(dx));
      if (Math.abs(dx) > 48) { const k = dx > 0 ? "KeyD" : "KeyA"; await p.keyboard.down(k); await sleep(140); await p.keyboard.up(k); }
      else { await p.keyboard.press("KeyJ"); jc++; await sleep(70); }
    }
  }
  if (frzMs >= 0) await p.screenshot({ path: path.join(SHOTS, "gate-13-dynamics-03-combo.png") }).catch(() => {});
  await sleep(frzMs >= 0 ? 900 : 300);
  await p.evaluate(() => { window.__g13Stop = 1; });
  const C = await combatSampleP;
  const S = C.samples;
  let fi = -1;
  for (let i = 0; i < S.length; i++) if (S[i].hit >= 0.13) { fi = i; break; }
  let fe = -1;
  if (fi >= 0) for (let i = fi + 1; i < S.length; i++) if (S[i].hit === 0) { fe = i; break; }
  let boxBuf = -1;
  if (fe >= 0) for (let i = fe + 1; i < S.length; i++) { if (S[i].t > S[fe].t + 300) break; if (S[i].buf > boxBuf) boxBuf = S[i].buf; }
  item(frzMs >= 0 && fi >= 0 && C.maxHit >= 0.13, "G13.8", "收刀顿帧：三连第 3 段命中 ⇒ max(hitstop) ≥0.13",
    "maxHit=" + C.maxHit.toFixed(3) + "（旧上限 0.12） combo峰值=" + C.maxCombo + " J×" + jc
    + " 最近距离=" + (minD === 9e9 ? "n/a" : minD.toFixed(0)) + "px");
  const sFlash = await st();
  const flashNow = num((sFlash.dyn || {}).flash, -1);
  item(C.maxFlash > 0.05 && flashNow === 0, "G13.9", "闪白：命中时 flash>0.05；此后归 0",
    "maxFlash=" + C.maxFlash.toFixed(3) + " 现 flash=" + flashNow);
  item(frzMs >= 0 && fe >= 0 && boxBuf >= 0.10, "G13.10", "W3 兼容：冻结窗内按 J ⇒ 解冻后 buf.atk ≥0.10（注入 0.14）",
    "冻结窗=" + (fi >= 0 && fe >= 0 ? "[" + S[fi].t + "→" + S[fe].t + "]ms" : "未观测") + " 解冻后 buf 峰=" + boxBuf);

  item(pageErrs.length === 0, "G13-0", "全程 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  say("截图：" + SHOTS + "/gate-13-dynamics-0*.png");
  await BROWSER.close();
  finish(nm);
})().catch(async (e) => {
  console.log("  [FAIL] G13.EX 脚本/桥接异常：" + ((e && e.stack) || e));
  console.log("GATE gate-13-dynamics: FAIL (EX)");
  try { if (BROWSER) await BROWSER.close(); } catch (_) {}
  process.exit(2);
});
