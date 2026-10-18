/* verify-v025.cjs —— 《拆台》角色渲染契约闸（Loop 6：角色骨骼化专用；先红后绿）
   依据（今日实读，Loop 6 评审五团＋技术美术档案）：
   - rebutter 针脚清单：X6 带 [310,326]×[463,470] 现余量仅 0.6px、X7 深带余量 1.9×、
     采样时刻玩家朝向=左（X3 按 KeyA 后未再转向）——「静止站姿/披风下摆」是雷区，跑动步幅不是。
   - 禁区契约（本轮写死）：静止（idle/无输入）时角色像素不得进入 X6 采样带；
     X6 夹心法的前提「两次采样环境一致」由本闸 A 组独立看守（防 flaky 闸）。
   - 滑步契约：足部 IK 落定（plant）期间，支撑脚世界坐标必须锁死（|Δx|≤3px）——
     现版火柴人滑步率≈72%〔rebutter 自代码推算〕，本闸只测「落定脚不动」这一必要条件。
   - 锚点契约：P.x,P.y=足底中点；静止时角色最低亮像素必须贴地（ground±2px）。
   - 预警契约：敌人 wind 期间位移 ≤1.5px（现行为已满足；此闸锁死防回归）。
   断言（6 判据行 / 5 组）：
   V25-A 静止带清洁×双朝向：shadow OFF、x=300——①同带 400ms 两次采样 |Δ|≤0.35（无动画方差）；
         ②x=300 与 x=250（移走角色）同带均值 |Δ|≤0.5（带内无角色像素）。朝向 +1 / -1 各测一遍。
   V25-B 滑步/足锁探针（需 debug.rig）：按住 KeyA 走 1.3s，逐帧采 feet[]——
         落定脚（p=1）逐脚独立游标连续段 |cx−x0|≤3px 且 cy=GY（垂直接地）；摆动幅度>4px（负控）；
         再静置 0.6s：双脚 |Δx|≤0.75px（呼吸不得动脚）。
   V25-C 足底锚点（像素）：静止 x=300，列 290-310 行 460-474 内最低亮像素（luma>90）∈[466,472]；
         负控列 500-516 同行为空（同扫描器不得全绿）。
   V25-D 敌人 wind 定身：触发 W1 后，按「连续片段」捕捉 wind（每段 ≥3 样本），段内 |Δx|≤1.5px。
   V25-E 帧时 sanity：telemetry p95 ≤25ms（穷举上限防灾难回归；只报告真值不做微调判据）。
   V25-0 零错误：0 pageerror / 0 console.error。
   探针自身踩过的坑（2026-10-13 首跑实测，已修——防复踩）：
   ① 旁白箱占 y444-502，X6 带 463-470 在箱内！且箱随「打字」逐字变亮 ⇒ 只查 narrator.current
      不够（队列下一句会晚到）⇒ narrClean=current空∧queueLen=0 + 采样前后双守卫（bandSample）。
   ② D 组首版按 enemy id 混段统计 ⇒ 相邻两段 wind（中间隔着 chase）间位移 62px 假红；
      wind 态本身 e.x 不动（updEnemy:354 只 e.t+=dt）⇒ 必须按连续片段分段。
   ③ B 组首版单游标 ⇒ 双脚同时落定时互相截断段 ⇒ 逐脚独立游标。
   用法：node tools/verify-v025.cjs
   环境：CHAITAI_URL（覆盖被测页，默认正本）／CHAITAI_SHOT_PREFIX（截图前缀）
   先红后绿：对 versions/v0.1.2 跑 => V25-A +1 红（足缘辉光越 x=310，真缺陷）
   ＋ V25-B 红（rig 钩子缺失＝结构红）；C/D/E 绿（探针可信）；对正本（Loop 6 后）跑 => 全绿（rc=0）。 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v025/v025");
const GY = 470;
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v025 ==");
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
  let shotN = 0;
  const shot = async (tag) => { try { await page.screenshot({ path: SHOT + "-" + (++shotN) + "-" + tag + ".png" }); } catch (e) {} };
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  const bandMean = (x0, x1, y0, y1) => G((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[2] * k),
      Math.round((a[1] - a[0]) * k), Math.round((a[3] - a[2]) * k)).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return +(s / (d.length / 4)).toFixed(2);
  }, [x0, x1, y0, y1]);
  /* 旁白完全静止 = current 空 且队列空（只查 current 会漏「队列下一句晚到」——今日实测：X6 带在
     旁白箱体内 y444-502，箱在打字时带被污染 ⇒ 必须双向判空 + 采样前后双守卫） */
  const narrClean = () => G(() => { const n = window.__game.state().narrator; return !n.current && n.queueLen === 0; }).catch(() => true);
  const bandClean = async (tries) => { for (let i = 0; i < tries; i++) {
    if (await narrClean()) { await sleep(120); if (await narrClean()) return true; }
    await sleep(320); } return false; };
  /* 带采样（守卫版）：采样前后都验旁白静止，任一不合格则重试；6 轮仍不行 → 明确报因 */
  const bandSample = async (x0, x1, y0, y1) => { for (let i = 0; i < 6; i++) {
    if (!(await bandClean(9))) return { ok: false, why: "旁白箱 ~4s 未清" };
    const m = await bandMean(x0, x1, y0, y1);
    if (await bandClean(2)) return { ok: true, m };
    await sleep(260); } return { ok: false, why: "采样时旁白反复" }; };

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(1200);
  await bandClean(15);

  /* ---------- V25-A 静止带清洁×双朝向（shadow OFF） ---------- */
  const hasShadow = await G(() => typeof ((window.__game && window.__game.debug) || {}).setShadow === "function").catch(() => false);
  if (!hasShadow) report("V25-A 静止带清洁×双朝向", false, "setShadow 不存在（钩子缺失）");
  else {
    await G(() => window.__game.debug.setShadow(false));
    const rows = [];
    let aOK = true;
    for (const f of [1, -1]) {
      await page.keyboard.down(f === 1 ? "KeyD" : "KeyA"); await sleep(90); await page.keyboard.up(f === 1 ? "KeyD" : "KeyA");
      await sleep(260); await bandClean(15);
      await G(() => window.__game.debug.setPlayerX(300)); await sleep(560);
      const r1 = await bandSample(310, 326, 463, 470);
      await sleep(400);
      const r2 = await bandSample(310, 326, 463, 470);
      await G(() => window.__game.debug.setPlayerX(250)); await sleep(460);
      const r0 = await bandSample(310, 326, 463, 470);
      const fac = await G(() => window.__game.state().player.facing);
      if (!(r1.ok && r2.ok && r0.ok)) { aOK = false;
        rows.push(`朝向${f > 0 ? "+" : ""}${f}(实${fac}) 采样守卫失败：${[r1, r2, r0].filter(r => !r.ok).map(r => r.why).join("/")}`); continue; }
      const ok = Math.abs(r1.m - r2.m) <= 0.35 && Math.abs(r1.m - r0.m) <= 0.5;
      if (!ok) aOK = false;
      rows.push(`朝向${f > 0 ? "+" : ""}${f}(实${fac}) 带内 静500?${r1.m}/静+400ms?${r2.m} 移走250?${r0.m} ⇒ Δ自=${Math.abs(r1.m - r2.m).toFixed(2)}(≤0.35) Δ角色=${Math.abs(r1.m - r0.m).toFixed(2)}(≤0.5)`);
    }
    report("V25-A 静止带清洁×双朝向", aOK, rows.join(" ｜ "));
  }
  await shot("band-clean");

  /* ---------- V25-B 滑步/足锁探针（KeyA 走 1.3s 逐帧采 feet[]） ---------- */
  const hasRig = await G(() => typeof ((window.__game && window.__game.debug) || {}).rig === "function").catch(() => false);
  if (!hasRig) { report("V25-B 滑步/足锁探针", false, "debug.rig 不存在（v0.1.2 无误足锁数据，应有此红）"); }
  else {
    /* 采集器：代际计数（__SGEN）防双跑——每段重开都自增，旧 ticker 下一帧即自杀 */
    const startTicker = () => G(() => { window.__SGEN = (window.__SGEN || 0) + 1; window.__S = [];
      const g = window.__SGEN;
      (function tk() { if (window.__SGEN !== g) return;
        try { const st = window.__game.state().player, r = window.__game.debug.rig();
          window.__S.push({ t: performance.now(), vx: st.vx, clip: r.clip, feet: r.feet }); } catch (e) {}
        requestAnimationFrame(tk); })(); });
    await G(() => window.__game.debug.setPlayerX(300)); await sleep(400);
    await startTicker();
    await page.keyboard.down("KeyA"); await sleep(1300); await page.keyboard.up("KeyA");
    const walkS = await G(() => window.__S.slice());
    await sleep(300);
    await G(() => { window.__SGEN++; window.__S = []; });
    await startTicker();
    await sleep(650);
    const idleS = await G(() => { const a = window.__S.slice(); window.__SGEN++; return a; });
    /* 分析（Node 侧）：逐脚独立游标——双脚同时落定时不得互相截断落定段 */
    const runs = [], cur = [null, null], swingXs = [[], []];
    let stance = 0;
    for (const s of walkS) {
      const feet = s.feet || [];
      for (let fi = 0; fi < feet.length && fi < 2; fi++) {
        const ft = feet[fi];
        if (ft.p) {
          stance++;
          if (cur[fi]) { cur[fi].dx = Math.max(cur[fi].dx, Math.abs(ft.cx - cur[fi].x0)); cur[fi].dy = Math.max(cur[fi].dy, Math.abs(ft.cy - GY)); cur[fi].n++; }
          else cur[fi] = { fi, x0: ft.cx, dx: 0, dy: 0, n: 1 };
        } else {
          swingXs[fi].push(ft.cx);
          if (cur[fi]) { runs.push(cur[fi]); cur[fi] = null; }
        }
      }
    }
    for (let fi = 0; fi < 2; fi++) if (cur[fi]) runs.push(cur[fi]);
    const swRange = swingXs.map(xs => xs.length ? Math.max.apply(null, xs) - Math.min.apply(null, xs) : 0);
    const badRun = runs.filter(r => r.n >= 4 && r.dx > 3);
    const badY = runs.filter(r => r.n >= 4 && r.dy > 2);
    const okRuns = runs.filter(r => r.n >= 4).length;
    /* 静置段：双脚 x 波动（呼吸不得动脚） */
    let idleDX = 0;
    for (let fi = 0; fi < 2; fi++) {
      const xs = idleS.map(s => s.feet && s.feet[fi] ? s.feet[fi].cx : null).filter(v => v !== null);
      if (xs.length) idleDX = Math.max(idleDX, Math.max.apply(null, xs) - Math.min.apply(null, xs));
    }
    const ok = okRuns >= 4 && badRun.length === 0 && badY.length === 0 && idleDX <= 0.75 &&
      walkS.length > 40 && Math.max(swRange[0], swRange[1]) >= 4 /* 负控：摆动脚确实在动 */;
    report("V25-B 滑步/足锁探针", ok,
      `帧=${walkS.length}（>40） 落定段=${runs.length}（≥4帧段=${okRuns}，需≥4） 超限段(dx>3)=${badRun.length} 离地段(dy>2)=${badY.length} ` +
      `最大漂移=${runs.length ? Math.max.apply(null, runs.map(r => r.dx)).toFixed(2) : "-"}px 摆动幅度=[${swRange.map(v => v.toFixed(1)).join(",")}]px（负控>4） ` +
      `静置双脚Δx=${idleDX.toFixed(2)}（≤0.75）` + (badRun.length ? " 例:" + JSON.stringify(badRun.slice(0, 2)) : ""));
  }

  /* ---------- V25-C 足底锚点（像素；行 460-474 与旁白箱 y444-502 重叠 ⇒ 同守卫） ---------- */
  {
    await G(() => window.__game.debug.setPlayerX(300)); await sleep(560);
    if (!(await bandClean(15))) report("V25-C 足底锚点", false, "旁白箱 ~5s 未清，拒绝采数");
    else {
    const r = await G(() => {
      const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
      const scan = (x0, x1, y0, y1) => {
        const d = g.getImageData(Math.round(x0 * k), Math.round(y0 * k),
          Math.round((x1 - x0) * k), Math.round((y1 - y0) * k)).data;
        const w = Math.round((x1 - x0) * k); let lowest = -1, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const luma = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (luma > 90) { n++; const py = y0 + Math.floor((i / 4) / w) + 0.5; if (py > lowest) lowest = py; }
        }
        return { lowest: +lowest.toFixed(1), n };
      };
      return { foot: scan(290, 310, 460, 474), ctrl: scan(500, 516, 460, 474) };
    }).catch(e => ({ err: e.message }));
    if (r.err) report("V25-C 足底锚点", false, "evaluate 异常 " + r.err);
    else {
      const ok = r.foot.lowest >= 466 && r.foot.lowest <= 472 && r.ctrl.n === 0;
      report("V25-C 足底锚点", ok,
        `脚列(290-310)最低亮像素 y=${r.foot.lowest}（期望 466-472=贴地±2）亮像素=${r.foot.n}；` +
        `负控列(500-516)亮像素=${r.ctrl.n}（期望 0）`);
    }
    }
  }
  await shot("foot-anchor");

  /* ---------- V25-D 敌人 wind 定身（按「连续片段」分段——首版把多次 wind 混成一段统计＝探针假红） ---------- */
  {
    await page.keyboard.down("KeyD");
    { const t0 = Date.now(); while (Date.now() - t0 < 2500) { const x = await G(() => window.__game.state().player.x); if (x > 445) break; await sleep(60); } }
    await page.keyboard.up("KeyD");
    const eps = {}, lastSt = {}; /* id -> [片段[次], …]，片段=连续 state==="wind" 的采样 */
    const t0 = Date.now();
    while (Date.now() - t0 < 16000) {
      const es = await G(() => window.__game.state().enemies).catch(() => []);
      for (const e of es) {
        const id = e.id;
        if (e.state === "wind") {
          if (lastSt[id] !== "wind") { (eps[id] = eps[id] || []).push([]); }
          if (eps[id] && eps[id].length) eps[id][eps[id].length - 1].push(e.x);
        }
        lastSt[id] = e.state;
      }
      if (Object.keys(eps).some(id => eps[id].some(seg => seg.length >= 3))) break;
      await sleep(40);
    }
    const segs = [];
    for (const id of Object.keys(eps)) for (const seg of eps[id]) segs.push({ id, seg });
    const big = segs.filter(s => s.seg.length >= 3);
    if (!big.length) report("V25-D 敌人 wind 定身", false, `未捕捉到完整 wind 片段（片段=${segs.length}，需 ≥1 段 ≥3 样本；16s 超时）`);
    else {
      let worst = 0, best = null;
      for (const s of big) { const sp = Math.max.apply(null, s.seg) - Math.min.apply(null, s.seg);
        if (!best || sp > worst) { worst = sp; best = s; } } /* 注意 spread 可为 0（定身＝真 0 位移） */
      const ok = worst <= 1.5;
      report("V25-D 敌人 wind 定身", ok,
        `wind片段=${segs.length}（≥3样本段=${big.length}）最长段=${best.seg.length}样本 enemy#${best.id} ` +
        `片段内最大位移=${worst.toFixed(2)}px（≤1.5）`);
    }
  }
  await shot("enemy-wind");

  /* ---------- V25-E 帧时 sanity ---------- */
  {
    const t = await G(() => window.__game.debug.telemetry()).catch(() => null);
    const p95 = t && typeof t.frameP95Ms === "number" ? t.frameP95Ms : -1;
    report("V25-E 帧时 sanity", p95 >= 0 && p95 <= 25, `p95=${p95}ms（≤25 穷举上限；现基线 6.2ms 量级，仅报告真值）`);
  }

  /* ---------- V25-0 零错误 ---------- */
  report("V25-0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));

  const pass = results.filter(r => r.ok).length, fail = results.length - pass;
  console.log("---- 汇总：PASS " + pass + "/" + results.length + (fail ? "（红 " + fail + "）" : " 全绿") + " ----");
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
