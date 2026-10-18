/* verify-v031.cjs —— 《拆台》玩家自测开关闸（?debug=1：浮层／Esc 暂停／重置进度；C6/P5「给人用」）
   缘起：合议 C6（07-Unity-Editor-Tool-Developer P5）——用户将首玩，闸知识应转成人眼器械：
   ?debug=1 页内浮层（关键字段/检查点）＋Esc 暂停＋重置进度（清 chaitai.save.v1 与 ended）。
   注：命中盒（07 原文标「可选」）v1 不做——命中判定分散五处（灯/落物/墙压/敌/Boss 各算距离）、
   无统一矩形源，近似盒会误导；待用户首玩反馈再定。
   ==== 实现前先行钉死的契约（本探针即契约，非事后调参）====
   · state().dbg 新字段（只读）：{on,pause,t}——on=?debug=1 命中；pause=Esc 暂停态；
     t=world.t（暂停冻结/恢复的观测锚）。
   · 无参负控：dbg.on===false；#dbgOverlay DOM 存在但 display:none；按 Esc 无效（dbg.t 照涨 ≥0.3/600ms
     且 pause 恒 false）。
   · ?debug=1：浮层可见（display!=none）且文本含 act= 与 cp=；Esc 切换 pause；暂停时 t 三连采样全等
     （0.7s）；再 Esc 恢复 t 复涨。Backspace＝重置进度：清 chaitai.save.v1 与 world.ended
     （两段式验证：先 saveWrite＋setEnded 见「有」，再见「无」）。
   · debug.setEnded(list) 钩子：world.ended 全量替换（验证重置语义用）。
   · 零正常游玩变化：无参路径一切照旧（浮层 hidden、键位不生效）——A 段即负控；
     浮层为 DOM 层（样式在 index.html），game.js 不引新色值（J1 全扫面不变）。
   红侧（W5-1 定版 c2de719e 旧码）：全部判据红（state().dbg 缺失／#dbgOverlay 不存在／setEnded 缺失；
   「钩子缺失」模式同 v021/v022 先例）。绿侧＝实现后全绿。
   用法：node tools/verify-v031.cjs；环境：CHAITAI_URL / CHAITAI_SHOT_PREFIX。 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v031/v031");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("== verify-v031 ==");
  console.log("md5  = game.js " + md5(path.join(ROOT, "game.js")) + " / index.html " + md5(path.join(ROOT, "index.html")) + "（被测目录 " + ROOT.replace(/\\/g, "/") + "）");
  fs.mkdirSync(path.dirname(SHOT), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  const line = (id, ok, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + id + " —— " + detail); return ok ? 1 : 0; };
  let pass = 0;

  const dbgRead = () => G(() => { const s = window.__game.state();
    return (s.dbg && typeof s.dbg.t === "number")
      ? { has: true, on: !!s.dbg.on, pause: !!s.dbg.pause, t: +s.dbg.t } : { has: false }; });
  const ovRead = () => G(() => { const el = document.getElementById("dbgOverlay");
    if (!el) return { exists: false };
    return { exists: true, visible: getComputedStyle(el).display !== "none",
             text: (el.textContent || "").replace(/\s+/g, " ").slice(0, 260) }; });

  /* ============ A 段：无参负控（零正常游玩变化） ============ */
  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(1200);
  const a0 = await dbgRead();
  const ovA = await ovRead();
  pass += line("V31-A1 无参·开关关闭", a0.has && a0.on === false,
    a0.has ? ("dbg=" + JSON.stringify(a0) + "（期望 on:false）") : "state().dbg 不存在（钩子缺失）");
  /* Esc 负控：真按一次 Esc，t 必须照涨（未被暂停）＋浮层不可见 */
  await page.keyboard.press("Escape");
  await sleep(150);
  const a1 = await dbgRead();
  await sleep(600);
  const a2 = await dbgRead();
  const negEsc = a1.has && a2.has && a1.pause === false && a2.pause === false && (a2.t - a1.t) >= 0.3;
  pass += line("V31-A2 无参·Esc 无效＋浮层不可见", negEsc && ovA.exists && ovA.visible === false,
    (a1.has ? ("按 Esc 后 0.6s Δt=" + (a2.t - a1.t).toFixed(2) + "（应≥0.3＝未被暂停） pause=" + a1.pause + "/" + a2.pause)
      : "钩子缺失") +
    "；浮层=" + (ovA.exists ? (ovA.visible ? "可见（应不可见）" : "存在且不可见✓") : "DOM 不存在"));

  /* ============ B 段：?debug=1 ============ */
  const U2 = URL_ + (URL_.indexOf("?") >= 0 ? "&" : "?") + "debug=1";
  await page.goto(U2, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(1400);
  const b0 = await dbgRead();
  const ovB = await ovRead();
  const b1ok = b0.has && b0.on === true && ovB.exists && ovB.visible === true
    && /act=/.test(ovB.text) && /cp=/.test(ovB.text);
  pass += line("V31-B1 ?debug=1·开关打开＋浮层可见含 act=/cp=", b1ok,
    (b0.has ? ("dbg=" + JSON.stringify(b0)) : "钩子缺失") +
    "；浮层=" + (ovB.exists ? (ovB.visible ? "可见" : "不可见（应可见）") + " 文本=" + JSON.stringify(ovB.text.slice(0, 90))
      : "DOM 不存在"));
  await page.screenshot({ path: SHOT + "-overlay.png" });

  /* 暂停：Esc → t 三连采样全等 */
  await page.keyboard.press("Escape");
  await sleep(200);
  const p1 = await dbgRead();
  await sleep(350);
  const p2 = await dbgRead();
  await sleep(350);
  const p3 = await dbgRead();
  const pauOk = p1.has && p1.pause === true && p1.t === p2.t && p2.t === p3.t && p3.t > 0;
  pass += line("V31-B2 Esc 暂停·t 冻结", pauOk,
    p1.has ? ("pause=" + p1.pause + " t 三连=" + [p1.t, p2.t, p3.t].join("/") + "（0.7s 应全等）") : "钩子缺失");
  await page.screenshot({ path: SHOT + "-paused.png" });

  /* 恢复：再 Esc → t 复涨 */
  await page.keyboard.press("Escape");
  await sleep(200);
  const r1 = await dbgRead();
  await sleep(600);
  const r2 = await dbgRead();
  const resOk = r1.has && r1.pause === false && (r2.t - r1.t) >= 0.3;
  pass += line("V31-B3 再 Esc 恢复·t 复涨", resOk,
    r1.has ? ("pause=" + r1.pause + " Δt=" + (r2.t - r1.t).toFixed(2) + "（应≥0.3）") : "钩子缺失");

  /* 重置进度（两段式：先有后无） */
  const w0 = await G(() => { try { return window.__game.debug.saveWrite(); } catch (e) { return { err: String(e) }; } });
  await sleep(120);
  const rd1 = await G(() => { try { return window.__game.debug.saveRead(); } catch (e) { return { err: String(e) }; } });
  const se0 = await G(() => { try { return window.__game.debug.setEnded(["end_a", "end_b"]); } catch (e) { return null; } });
  const se1 = await G(() => window.__game.state().ended);
  const seeded = !!(rd1 && rd1.ok === true) && Array.isArray(se1) && se1.length === 2 && Array.isArray(se0);
  await page.keyboard.press("Backspace");
  await sleep(250);
  const rd2 = await G(() => { try { return window.__game.debug.saveRead(); } catch (e) { return { err: String(e) }; } });
  const se2 = await G(() => window.__game.state().ended);
  const resetOk = seeded && rd2 && rd2.ok === false && rd2.reason === "empty" && Array.isArray(se2) && se2.length === 0;
  pass += line("V31-B4 Backspace·重置进度（先有后无）", resetOk,
    "saveWrite=" + JSON.stringify(w0) + "→saveRead=" + JSON.stringify(rd1) + " setEnded→" + JSON.stringify(se1) +
    "；重置后 saveRead=" + JSON.stringify(rd2) + " ended=" + JSON.stringify(se2));

  /* 零错误哨兵（两段合计） */
  pass += line("V31-0 零错误", errs.length === 0, errs.length ? errs.slice(0, 2).join(" | ") : "0 条");

  console.log("---- 汇总：PASS " + pass + "/7 " + (pass === 7 ? "全绿" : "有红") + " ----");
  await browser.close();
  process.exit(pass === 7 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
