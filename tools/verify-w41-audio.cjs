/* verify-w41-audio.cjs —— 《拆台》W4.1 A 批 A3：预警音时序前移＋audioLog（环形 32）验收探针
   依据：批量A-实施清单.md A3（K2·7 名独立；drop/press 预警音提前到预警窗起点）＋契约 v2 增键 debug.audioLog。
   断言（先红后绿）：
   W41A.1 audioLog 钩子存在（红侧：无此契约 ⇒ 红）
   W41A.2 press 音前量 Δ=音落−spawn ≤0.15s（红侧旧码 ≈PRESS_WARN=0.9s；时序语义由 falsify M11 正/反双向钉住）
   W41A.3 drop 音前量 Δ ≤0.15s（lead=0；旧码 ≈DROP_WARN=0.7s）
   W41A.4a 机制不变 press：warn→slam 仍≈0.9s（∈[0.78,1.08]）＋地面正下命中恰一次 20 伤（100→80 且两读不复扣）
   W41A.4b 机制不变 drop：warn→fall 仍≈0.7s（∈[0.55,0.88]）＋落点域外（x=60 对玩家≈4xx）不伤（hp 恒 80）
   W41A.5 环形上限：连发 40 枚 drop ⇒ log 长度恰 32、其中 warn_drop ≥30（上限=32 硬性验证）
   W41A.0 全程 0 pageerror / 0 console.error
   用法：node tools/verify-w41-audio.cjs
   环境：CHAITAI_URL（覆盖被测页，默认正本）／CHAITAI_SHOT_PREFIX
   先红后绿：改码前跑 ⇒ W41A.1/.2/.3/.5 红、.4a/.4b 绿（无回归）；改码后 ⇒ 全绿 rc=0 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-w41-audio/w41a");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-w41-audio（A3 预警音时序前移） ==");
  console.log("URL  = " + URL_);
  let dir = ROOT;
  try { const u = new URL(URL_); if (u.protocol === "file:") dir = path.dirname(decodeURIComponent(u.pathname.replace(/^\//, ""))); } catch (e) {}
  console.log("md5  = game.js " + md5(path.join(dir, "game.js")) + " / index.html " + md5(path.join(dir, "index.html")) + "（被测目录 " + dir + "）");
  fs.mkdirSync(path.dirname(SHOT), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  const shot = async (tag) => { try { await page.screenshot({ path: SHOT + "-" + tag + ".png" }); } catch (e) {} };

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(600);
  await shot("01-playing");

  /* 读钩子 + 基线（spawn 前后各一次，规避环形滑窗） */
  const meta = await page.evaluate(() => { const d = window.__game.debug, g = window.__game;
    return { hasHook: typeof d.audioLog === "function", phase: g.state().phase, px: g.state().player.x,
      len: (typeof d.audioLog === "function") ? d.audioLog().length : 0 }; });
  const hasHook = meta.hasHook;
  console.log("钩子：audioLog=" + hasHook + "  phase=" + meta.phase + "  player.x=" + meta.px + "  基线log长度=" + meta.len);

  /* 通用：spawn 后测「第一条新声」落点 Δ 与「phase 转换」Δ（Node 侧 Date.now 轮询，粒度 ~20-30ms） */
  async function timeSpawn(spawnFn, wantId, wantPhase, kind, budgetMs) {
    const base = await page.evaluate(() => { const d = window.__game.debug; return (typeof d.audioLog === "function") ? d.audioLog().length : 0; });
    const t0 = Date.now();
    await page.evaluate(spawnFn);
    let snd = null, ph = null, sndId = null;
    while (Date.now() - t0 < budgetMs && (snd === null || ph === null)) {
      await sleep(20);
      const r = await page.evaluate((baseN, wid, wph, k) => {
        const d = window.__game.debug, g = window.__game;
        let snd = null;
        if (typeof d.audioLog === "function") { const L = d.audioLog();
          for (let i = baseN; i < L.length; i++) if (L[i].id === wid) { snd = { id: L[i].id, t: L[i].t }; break; } }
        const tr = (g.state().traps || []).find(t => t.type === k);
        return { snd: snd, phase: tr ? tr.phase : null };
      }, base, wantId, wantPhase, kind);
      const dt = (Date.now() - t0) / 1000;
      if (r.snd && snd === null) { snd = dt; sndId = r.snd.id; }
      if (r.phase === wantPhase && ph === null) ph = dt;
      if (!hasHook && ph !== null) break; /* 红侧无钩子：只等 phase，别空转 */
    }
    return { snd, sndId, ph };
  }

  /* ---------- W41A.1 钩子存在 ---------- */
  report("W41A.1 audioLog 钩子存在", hasHook,
    hasHook ? "debug.audioLog 可调用，基线长度=" + meta.len : "debug.audioLog 不存在（红侧预期：旧码无此契约键）");

  /* ---------- W41A.2/.4a press ---------- */
  const press = await timeSpawn(() => window.__game.debug.spawnPress(window.__game.state().player.x),
    "warn_press", "slam", "press", 3000);
  const hpA1 = await page.evaluate(() => window.__game.state().player.hp);
  await sleep(900); /* 进 stay（slam≈0.9＋行程≈0.22）后第一次读 */
  const hpA2 = await page.evaluate(() => window.__game.state().player.hp);
  await sleep(900); /* stay 尾再读一次：验证「恰一次」不复扣 */
  const hpA3 = await page.evaluate(() => window.__game.state().player.hp);
  await shot("02-press-stay");
  report("W41A.2 press 音前量 ≤0.15s", hasHook && press.snd !== null && press.snd <= 0.15,
    hasHook ? ("Δ=" + (press.snd === null ? "n/a（未见 warn_press）" : press.snd.toFixed(3) + "s") + "（旧码应在 ≈" + 0.9 + "s：由 falsify M11 双向钉）")
            : "无 audioLog 钩子 ⇒ 音落不可观测（红侧预期）");
  report("W41A.4a 机制不变·press warn→slam≈0.9s＋命中恰一次20", press.ph !== null && press.ph >= 0.78 && press.ph <= 1.08
    && hpA1 === 100 && hpA2 === 80 && hpA3 === 80,
    "warn→slam Δ=" + (press.ph === null ? "n/a" : press.ph.toFixed(3) + "s") + "（期望≈0.9） hp 读三次=" + hpA1 + "/" + hpA2 + "/" + hpA3 + "（期望 100/80/80）");

  /* ---------- W41A.3/.4b drop（lead=0，落点 60 远离玩家） ---------- */
  await page.evaluate(() => window.__game.debug.clearTraps());
  const drop = await timeSpawn(() => window.__game.debug.spawnDrop(60, 0), "warn_drop", "fall", "drop", 2500);
  await sleep(1100); /* 落完（warn0.7+fall≈0.32+余量） */
  const hpB = await page.evaluate(() => window.__game.state().player.hp);
  report("W41A.3 drop 音前量 ≤0.15s", hasHook && drop.snd !== null && drop.snd <= 0.15,
    hasHook ? ("Δ=" + (drop.snd === null ? "n/a（未见 warn_drop）" : drop.snd.toFixed(3) + "s") + "（旧码 ≈0.7s）")
            : "无 audioLog 钩子 ⇒ 音落不可观测（红侧预期）");
  report("W41A.4b 机制不变·drop warn→fall≈0.7s＋域外不伤", drop.ph !== null && drop.ph >= 0.55 && drop.ph <= 0.88 && hpB === 80,
    "warn→fall Δ=" + (drop.ph === null ? "n/a" : drop.ph.toFixed(3) + "s") + "（期望≈0.7） hp 落位后=" + hpB + "（期望恒 80，落点 x=60 对玩家 " + meta.px + " 域外）");

  /* ---------- W41A.5 环形上限 32 ---------- */
  await page.evaluate(() => window.__game.debug.clearTraps());
  await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__game.debug.spawnDrop(60 + i * 2, 0); });
  await sleep(300);
  const ring = await page.evaluate(() => { const d = window.__game.debug;
    if (typeof d.audioLog !== "function") return { len: -1, warnDrop: -1, tail: "n/a" }; /* 红侧守卫 */
    const L = d.audioLog();
    return { len: L.length, warnDrop: L.filter(e => e.id === "warn_drop").length, tail: L.slice(-3).map(e => e.id).join(",") }; });
  await page.evaluate(() => window.__game.debug.clearTraps());
  report("W41A.5 环形上限=32（40 连发）", hasHook && ring.len === 32 && ring.warnDrop >= 30,
    hasHook ? ("len=" + ring.len + " warn_drop=" + ring.warnDrop + "/32 尾三=" + ring.tail)
            : "无 audioLog 钩子 ⇒ 环形不可观测（红侧预期）");

  /* ---------- W41A.0 零错误 ---------- */
  report("W41A.0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));
  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("探针崩溃：" + e.stack); process.exit(2); });
