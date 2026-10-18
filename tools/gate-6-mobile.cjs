#!/usr/bin/env node
/* 拆台 · GATE-6 mobile —— 375×667/dsf2/isMobile+hasTouch：触屏控件可见＋命中自检，
 * tap ◀ 玩家真的往左动，tap 攻击键 state 真的变了（页内 16ms 采样，不靠"有坐标"糊弄）。
 *
 * 触屏控件契约（主会话冻结）：DOM 元素，id：t-left/t-right/t-jump/t-atk/t-dash/t-restart，
 * 挂在外层容器 #touch（有 .on 类时才显示）。
 *
 * 断言：
 *   G6.1 视口 375×667 dsf2 + 触控启用（maxTouchPoints>0）+ #touch 处于 .on
 *   G6.2 加载期 0 pageerror
 *   G6.3 触屏能开始游戏（tap 屏幕 → playing）
 *   G6.4 必需控件 #t-left/#t-right/#t-atk 存在且可见（display≠none、有尺寸）
 *   G6.5 所有可见控件中心 elementFromPoint 命中自己
 *   G6.6 按住 #t-left 0.3s → player.x 变小
 *   G6.7 tap #t-atk → state 真的变了（attacking 或 combo，页内采样）
 *   G6.8 全程 0 pageerror
 * exit：0=PASS；1=断言 FAIL（含目标文件不存在）；2=脚本/桥接异常
 */
"use strict";
const fs = require("fs");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || "file:///D:/2006L/chaitai/index.html";
const SHOTS = "D:/2006L/chaitai/shots";
const PREFIX = process.env.CHAITAI_SHOT_PREFIX || "";
const VW = 375, VH = 667;
const REQUIRED = ["t-left", "t-right", "t-atk"];
const ALLBTN = ["t-left", "t-right", "t-jump", "t-atk", "t-dash", "t-restart"];

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
  const nm = "gate-6-mobile";
  console.log("== " + nm + " @ " + URL + " 视口 " + VW + "x" + VH + " dsf2 hasTouch ==");
  const file = URL.startsWith("file:///") ? decodeURIComponent(URL.slice(8)) : null;
  if (file && !fs.existsSync(file)) {
    console.log("  [FAIL] G6.0 目标文件不存在：" + file + "（游戏还没写出来？）");
    fails.push("G6.0"); finish(nm); return;
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
  await p.setViewport({ width: VW, height: VH, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(URL, { waitUntil: "load" });

  const st = () => p.evaluate(() => window.__game.state());
  const waitPhase = async (ph, ms) => {
    try { await p.waitForFunction('window.__game.state().phase === ' + JSON.stringify(ph), { timeout: ms }); return true; }
    catch (e) { return false; }
  };
  /* 一次读出所有控件几何 + elementFromPoint 命中自检 */
  const probe = () => p.evaluate((ids) => {
    const touch = document.getElementById("touch");
    const out = { vw: innerWidth, vh: innerHeight, maxTouch: navigator.maxTouchPoints,
      touchExists: !!touch, touchOn: !!(touch && touch.classList.contains("on")),
      docW: document.documentElement.scrollWidth, btns: {} };
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) { out.btns[id] = { found: false }; return; }
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const visible = cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05 && r.width > 0 && r.height > 0;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let hit = "offscreen";
      if (visible && cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight) {
        const t = document.elementFromPoint(cx, cy);
        hit = !t ? "null" : ((t === el || el.contains(t)) ? "self" : ("other:" + (t.id || t.className || t.tagName)));
      }
      out.btns[id] = { found: true, visible: visible, x: +cx.toFixed(1), y: +cy.toFixed(1),
        w: +r.width.toFixed(1), h: +r.height.toFixed(1), hit: hit };
    });
    return out;
  }, ALLBTN);

  let hooked = true;
  try { await p.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 20000 }); }
  catch (e) { hooked = false; }
  await sleep(700);
  if (!hooked) { console.log("  [FAIL] G6.1 window.__game 20s 内没挂钩"); fails.push("G6.1"); await BROWSER.close(); finish(nm); return; }

  const pr0 = await probe();
  item(pr0.vw === VW && pr0.vh === VH && pr0.maxTouch > 0 && pr0.touchOn, "G6.1",
    "视口 375×667 dsf2 + 触控启用 + #touch.on",
    "vw/vh=" + pr0.vw + "x" + pr0.vh + " maxTouchPoints=" + pr0.maxTouch + " #touch=" + (pr0.touchExists ? (pr0.touchOn ? "on" : "存在但没 .on") : "不存在"));
  item(pageErrs.length === 0, "G6.2", "加载期 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-6-mobile-01-initial.png" });

  /* —— 触屏开始游戏：tap 屏幕中心（画布区）—— */
  const s0 = await st();
  let startHow = "(本来就 playing)";
  if (s0.phase === "title") {
    await p.touchscreen.tap(VW / 2, VH / 2);
    let ok = await waitPhase("playing", 1500);
    startHow = "tap 屏幕中心";
    if (!ok) { await p.touchscreen.tap(VW / 2, VH * 0.42); ok = await waitPhase("playing", 1500); startHow = "tap 屏幕中心 ×2"; }
    if (!ok) { const pr = await probe(); const L = pr.btns["t-left"]; if (L && L.found && L.visible) { await p.touchscreen.tap(L.x, L.y); ok = await waitPhase("playing", 1500); startHow = "tap ◀"; } }
  }
  const sStart = await st();
  item(sStart.phase === "playing", "G6.3", "触屏能开始游戏", "phase=" + sStart.phase + "；路径=" + startHow);
  await sleep(250);

  /* —— 控件存在/可见/命中自检 —— */
  const pr = await probe();
  const reqMiss = REQUIRED.filter((id) => !(pr.btns[id] && pr.btns[id].found && pr.btns[id].visible));
  item(reqMiss.length === 0, "G6.4", "必需控件存在且可见（#t-left/#t-right/#t-atk）",
    reqMiss.length ? "缺/不可见：" + reqMiss.join(",") : REQUIRED.map((id) => id + "(" + pr.btns[id].w + "x" + pr.btns[id].h + "@" + pr.btns[id].x + "," + pr.btns[id].y + ")").join(" "));
  const visIds = ALLBTN.filter((id) => pr.btns[id] && pr.btns[id].found && pr.btns[id].visible);
  const badHit = visIds.filter((id) => pr.btns[id].hit !== "self");
  item(visIds.length >= REQUIRED.length && badHit.length === 0, "G6.5", "所有可见控件中心命中自己（elementFromPoint）",
    visIds.length + " 个可见：" + visIds.map((id) => id + "=" + pr.btns[id].hit).join(" ") +
    (badHit.length ? "｜坏命中：" + badHit.join(",") : ""));
  say("控件几何：" + ALLBTN.filter((id) => pr.btns[id] && pr.btns[id].found).map((id) =>
    id + (pr.btns[id].visible ? "" : "(隐)") + "@" + pr.btns[id].x + "," + pr.btns[id].y).join("  "));
  say("横向溢出检查（只报告）：docW=" + pr.docW + " vs vw=" + pr.vw);
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-6-mobile-02-controls.png" });

  /* —— 按住 ◀ 0.3s → player.x 变小 —— */
  const L = pr.btns["t-left"];
  const x0 = (await st()).player.x;
  if (L && L.found && L.visible) { await p.touchscreen.touchStart(L.x, L.y); await sleep(300); await p.touchscreen.touchEnd(); }
  await sleep(200);
  const x1 = (await st()).player.x;
  item(L && L.found && L.visible && x1 < x0 - 0.5, "G6.6", "按住 ◀ 0.3s → player.x 变小",
    L && L.found ? "x " + x0 + " → " + x1 + "（Δ=" + (x1 - x0).toFixed(1) + "）" : "找不到 #t-left");
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-6-mobile-03-after-move.png" });

  /* —— tap 攻击键 → 用页内 16ms 采样证明 state 真的变了 —— */
  const A = pr.btns["t-atk"];
  await p.evaluate(() => {
    window.__ctProbe = { base: null, attacking: false, comboSeen: [], err: null };
    try {
      const pl = window.__game.state().player;
      window.__ctProbe.base = pl.combo;
      window.__ctProbe.comboSeen.push(pl.combo);
      window.__ctProbe.iv = setInterval(function () {
        try {
          const q = window.__game.state().player;
          if (q.attacking) window.__ctProbe.attacking = true;
          if (window.__ctProbe.comboSeen.indexOf(q.combo) < 0) window.__ctProbe.comboSeen.push(q.combo);
        } catch (e) { window.__ctProbe.err = String(e); }
      }, 16);
    } catch (e) { window.__ctProbe.err = String(e); }
  });
  let tapped = false;
  if (A && A.found && A.visible) { await p.touchscreen.tap(A.x, A.y); tapped = true; }
  await sleep(800);
  const pb = await p.evaluate(() => {
    const q = window.__ctProbe;
    clearInterval(q.iv);
    return { base: q.base, attacking: q.attacking, combos: q.comboSeen, err: q.err };
  });
  const comboChanged = pb.combos.length > 1;
  item(tapped && (pb.attacking === true || comboChanged), "G6.7", "tap 攻击键 → state 真的变了",
    (tapped ? "" : "找不到 #t-atk；") + "attacking=" + pb.attacking + " combo=" + JSON.stringify(pb.combos) + (pb.err ? " err=" + pb.err : ""));
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-6-mobile-04-after-atk.png" });

  item(pageErrs.length === 0, "G6.8", "全程 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  say("截图：shots/" + PREFIX + "gate-6-mobile-01-initial.png, -02-controls.png, -03-after-move.png, -04-after-atk.png");
  await BROWSER.close();
  finish(nm);
})().catch(async (e) => {
  console.log("  [FAIL] G6.EX 脚本/桥接异常：" + ((e && e.stack) || e));
  console.log("GATE gate-6-mobile: FAIL (EX)");
  try { if (BROWSER) await BROWSER.close(); } catch (_) {}
  process.exit(2);
});
