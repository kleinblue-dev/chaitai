#!/usr/bin/env node
/* 拆台 · GATE-1 load —— 加载无错 / 接口齐全 / 标题页可见 / 任意键开始 / game_start
 *
 * 断言（全部按冻结契约写；实现不符＝FAIL，不为变绿松口）：
 *   G1.1 加载期 0 pageerror
 *   G1.2 window.__game 可挂钩（20s 内等到 state 函数）
 *   G1.3 接口齐全：version 字符串、state 函数、debug.{hurtPlayer,clearWave,setPlayerX,reset} 全是函数
 *   G1.4 初始 phase === 'title'
 *   G1.5 标题页真渲染（整页截图非空白：采样色数 ≥3 且最大色占比 ≤0.999）
 *   G1.6 标题按任意键（Enter）→ 3s 内 phase === 'playing'
 *   G1.7 narrator.log 含触发键 'game_start'（契约：开局播报，等 4s）
 *   G1.8 全程 0 pageerror
 *
 * 环境：CHAITAI_URL 换被测对象（默认 file:///D:/2006L/chaitai/index.html）；
 *       CHAITAI_SHOT_PREFIX 给截图加前缀（证伪跑副本时避免覆盖正本截图）。
 * exit：0=PASS；1=有断言 FAIL（含目标文件不存在）；2=脚本/桥接异常
 */
"use strict";
const fs = require("fs");
const zlib = require("zlib");
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

/* 够用的 PNG 读（8 位非隔行 color type 0/2/6）—— 只为量"标题页是不是真画了东西"。 */
function readPNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("不是 PNG");
  let p = 8, W = 0, H = 0, depth = 0, color = 0, inter = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { W = data.readUInt32BE(0); H = data.readUInt32BE(4); depth = data[8]; color = data[9]; inter = data[12]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const SRC = { 0: 1, 2: 3, 6: 4 }[color];
  if (depth !== 8 || !SRC || inter !== 0) throw new Error("只支持 8 位非隔行 0/2/6（depth=" + depth + " color=" + color + " inter=" + inter + "）");
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = SRC, rowBytes = W * bpp;
  const px = Buffer.alloc(rowBytes * H);
  let prev = Buffer.alloc(rowBytes), pos = 0;
  for (let y = 0; y < H; y++) {
    const ft = raw[pos++];
    const cur = px.subarray(y * rowBytes, (y + 1) * rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      const x = raw[pos + i];
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      if (ft === 0) v = x;
      else if (ft === 1) v = x + a;
      else if (ft === 2) v = x + b;
      else if (ft === 3) v = x + ((a + b) >> 1);
      else if (ft === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c)); }
      else throw new Error("第 " + y + " 行 filter=" + ft);
      cur[i] = v & 255;
    }
    pos += rowBytes; prev = cur;
  }
  return { w: W, h: H, bpp, data: px };
}
function pngStats(buf) {
  const img = readPNG(buf);
  const { w, h, bpp, data } = img;
  const cnt = new Map();
  let n = 0;
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
    const i = (y * w + x) * bpp;
    const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    cnt.set(k, (cnt.get(k) || 0) + 1); n++;
  }
  let top = 0; for (const v of cnt.values()) if (v > top) top = v;
  return { w, h, sampled: n, distinct: cnt.size, topFrac: +(top / n).toFixed(4) };
}

(async () => {
  const nm = "gate-1-load";
  console.log("== " + nm + " @ " + URL + " ==");
  const file = URL.startsWith("file:///") ? decodeURIComponent(URL.slice(8)).replace(/[?#].*$/, "") : null; /* 2026-10-16：CHAITAI_URL 可带 ?debug=1 等 query（07-P5 验证口径）；无 query 时行为不变 */
  if (file && !fs.existsSync(file)) {
    console.log("  [FAIL] G1.0 目标文件不存在：" + file + "（游戏还没写出来？）");
    fails.push("G1.0"); finish(nm); return;
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  BROWSER = await puppeteer.launch({
    executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"],
  });
  const p = await BROWSER.newPage();
  const pageErrs = [], consoleErrs = [];
  p.on("pageerror", (e) => pageErrs.push(String((e && e.message) || e)));
  p.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: "load" });

  const waitPhase = async (ph, ms) => {
    try { await p.waitForFunction('window.__game && window.__game.state().phase === ' + JSON.stringify(ph), { timeout: ms }); return true; }
    catch (e) { return false; }
  };
  const waitLog = async (key, ms) => {
    try { await p.waitForFunction('(function(){var s=window.__game.state();return (s.narrator.log||[]).indexOf(' + JSON.stringify(key) + ') >= 0;})()', { timeout: ms }); return true; }
    catch (e) { return false; }
  };

  let hooked = true;
  try { await p.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 20000 }); }
  catch (e) { hooked = false; }
  await sleep(900); // 让第一帧真跑起来，别在 rAF 之前下结论

  item(pageErrs.length === 0, "G1.1", "加载期 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  item(hooked, "G1.2", "window.__game 可挂钩（等 state 函数）", hooked ? "等到" : "20s 没等到");
  if (!hooked) { await BROWSER.close(); finish(nm); return; }

  const iface = await p.evaluate(() => {
    const g = window.__game || {}, d = g.debug || {}, t = (x) => typeof x;
    return { version: t(g.version), versionVal: typeof g.version === "string" ? g.version : null,
      state: t(g.state), hurtPlayer: t(d.hurtPlayer), clearWave: t(d.clearWave), setPlayerX: t(d.setPlayerX), reset: t(d.reset) };
  });
  const ifaceOk = iface.version === "string" && !!iface.versionVal && iface.state === "function"
    && iface.hurtPlayer === "function" && iface.clearWave === "function"
    && iface.setPlayerX === "function" && iface.reset === "function";
  item(ifaceOk, "G1.3", "接口齐全（version/state/debug 四件套）", JSON.stringify(iface));

  const s0 = await p.evaluate(() => window.__game.state());
  const log0 = s0 && s0.narrator && Array.isArray(s0.narrator.log) ? s0.narrator.log : null;
  item(!!s0 && s0.phase === "title", "G1.4", "初始 phase==='title'", "phase=" + (s0 && s0.phase) + " wave=" + (s0 && s0.wave));
  if (!log0) say("narrator.log 不是数组（契约要求字符串数组）：" + typeof (s0 && s0.narrator && s0.narrator.log));

  const shot = Buffer.from(await p.screenshot({ encoding: "binary" }));
  fs.writeFileSync(SHOTS + "/" + PREFIX + "gate-1-load-01-title.png", shot);
  let stats;
  try { stats = pngStats(shot); } catch (e) { stats = { err: String((e && e.message) || e) }; }
  const renderOk = !stats.err && stats.distinct >= 3 && stats.topFrac <= 0.999;
  item(renderOk, "G1.5", "标题页真渲染（截图非空白）",
    stats.err ? "读图失败：" + stats.err
      : stats.w + "x" + stats.h + " 采样 " + stats.sampled + " 点，不同色 " + stats.distinct + "，最大色占比 " + stats.topFrac);

  await p.keyboard.press("Enter");
  const started = await waitPhase("playing", 3000);
  const s1 = await p.evaluate(() => window.__game.state());
  item(started && s1.phase === "playing", "G1.6", "标题按任意键(Enter)→playing", "phase=" + s1.phase);
  await p.screenshot({ path: SHOTS + "/" + PREFIX + "gate-1-load-02-playing.png" });

  const gotKey = await waitLog("game_start", 4000);
  const s2 = await p.evaluate(() => window.__game.state());
  const log1 = (s2.narrator && Array.isArray(s2.narrator.log)) ? s2.narrator.log : [];
  item(gotKey && log1.indexOf("game_start") >= 0, "G1.7", "log 含触发键 'game_start'",
    "log(" + log1.length + ")=" + JSON.stringify(log1.slice(0, 12)) + (log1.length > 12 ? "…" : ""));

  await sleep(300);
  item(pageErrs.length === 0, "G1.8", "全程 0 pageerror", pageErrs.length ? pageErrs.slice(0, 3).join(" | ") : "(0 条)");
  if (consoleErrs.length) say("console error " + consoleErrs.length + " 条（不计入断言，供排查）：" + consoleErrs.slice(0, 2).join(" | "));
  say("截图：shots/" + PREFIX + "gate-1-load-01-title.png, -02-playing.png");
  await BROWSER.close();
  finish(nm);
})().catch(async (e) => {
  console.log("  [FAIL] G1.EX 脚本/桥接异常：" + ((e && e.stack) || e));
  console.log("GATE gate-1-load: FAIL (EX)");
  try { if (BROWSER) await BROWSER.close(); } catch (_) {}
  process.exit(2);
});
