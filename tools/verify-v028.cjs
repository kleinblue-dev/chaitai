/* verify-v028.cjs —— 《拆台》环境粒子闸（Loop 9：d6-art P1-1 氛围粒子·尘埃/火星；先红后绿）
   依据（d6-art:48-50 原文）：「常驻"尘埃"≤40 粒（慢速漂移、α 0.15）；第二幕加"上升火星"≤24
   （复用 spawnBurst 机制，颜色取该幕霓虹色）；雨留作未来第三幕（≤90 条短斜线＋落地小 splash，
   移动端关）」＋:103-104 预算表「fx 粒子总量≤260（已有）｜尘埃/雨/火星 40/90/24」。雨=未来件，
   本闸不测。「复用 spawnBurst 机制」落成=同族粒子系统（独立数组，上限硬截；fx 260 上限已存）。
   ==== 实现前先行钉死的契约（本探针即契约，非事后调参）====
   state().atmo={dust:N, ember:M}；debug.setDust(n) / setEmber(n) / atmoPos()（全量坐标，尘埃 ≤40/火星 ≤24 项）。
   · 尘埃：40 粒常驻（title/act1/act2/clear 全相；updateFx 同层——title 相照走）；x∈[0,960) wrap
     、y∈[24,454] wrap（★上限 454 避 v012-X6/v025-A 脚带 [310,326]×[463,470]——"悬浮空中"的
     空间契约）；vx∈[−5,5]、vy∈[−3,3] px/s；α=0.15 恒定；色 #ffecd2（r=255）；size 1-2px。
   · 火星：仅 act2 门（phase playing ∧ wave==2 ∧ !cleared）；x∈[40,920] 出生 y∈[464,470]；
     vy∈[−50,−30] px/s（升）、寿命∈[1.2,2.2]s ⇒ 升程≤110px ⇒ 顶点 y≥360（★避 v026 FLASH 带
     y200-320 与 v027 SKY 带 y150-178，边距 40px）；色=PALETTES.act2.neon（#ff6ad5，字面兑现
     "颜色取该幕霓虹色"）；α=0.15+0.45·(life/max)（下限 0.15）；上限 24 硬截；生成率≈4/s。
   · 两者更新挂 step 的 hitstop-else 分支（与 updateFx 同门）：hitstop 冻结窗全停 ⇒ v027-C3
     逐字节全等保持；慢动作自动吃 sdt；resetWorld 清 embers（重拍=火焰重来）不动 dust（氛围跨局）。
   ==== 旧仪器安全推导（写入回执）====
   v011 月亮质心：尘埃/火星叠加色 r=(1−α)·br+α·255 ≥ 0.15×255=38.25 > 22 ⇒ 数学封死"叠加后
     ==#16203a(r=22) 的像素"（尘埃 α 恒 0.15、火星 α 下限 0.15 即为封死实现）；遮蔽月亮像素的
     质心扰动 ~0.02px（4px 遮蔽/月亮 ~1e4 样本×半径效应）≪ 0.6 阈值。
   v027：C2 顶带暗计数只受"变亮"影响（尘埃/火星恒增亮）✔；C5 完字带归零后 ≤100（尘叠 clear
     天空 luma≈40+0.15×195≈69<100）✔；C6 归零后帧差≤0.4（SKY 带内尘粒期望 <2，贡献 ~0.002
     级）✔；C3 冻结（更新在 hitstop-else ⇒ 冻结窗零运动）✔。
   v026：FLASH/BOARD/TOP/TEXT 带均在 y≤320（火星顶点 ≥360）；REDBOX/TCBOX 标题带（尘 g=236>110
     不计红；TCBOX 亮计数虚增 ≤2 像素/阈 25）。
   v012-X4 c2 采样 (60,60)（act2 相）：尘粒命中 ~0.03%/帧且只增通道差（判据 ≥15 为下限）✔；
     X4 阈=通道差和 ≥15（非精确 40），实测 40 级。X6/脚带：尘埃 y≤454 不触；火星 act2-only
     而 X6 测 act1 ✔（火星出生点 464-470 在脚带内——未来若在 act2 相采脚带需重审，留档）。
   v022/v023/gate 系：数值判据，无像素带 ✔。
   ==== 本次探针自身设计要点 ====
   B2 带 SKY2=[240,660,150,178]（v027 同域子集——已证该区在 cleared 后帧差 0.00；左缘 240 避
     玩家 idle 呼吸 x190±15 与带 [200,...] 的 5px 擦碰）。基线 setDust(0) 帧差 ≤0.02（负控）；
   4 次重铺 setDust(40) 每次 1.8s 两快照逐像素 r 通道 mean|Δ|——带内期望粒 1.25 粒/次、粒 1.8s
     移 ~5px 必跨像素 ⇒ 单次正信号 P≈71% ⇒ 4 次全零 P≈0.7%（可重跑）；阈 (0.003,0.5)。
   D 单点夹心·原子读（替代全带均值——带均值受敌/玩家进入污染）：setEmber(24) 后 0.32s 于
     【同一 evaluate 内】取 atmoPos().ember 挑一粒（与玩家/活敌距离 >40px、y∈[430,474] 域内、
     遍历全部候选）并立即读该点像素（同一渲染缓冲、无 rAF 插入 ⇒ pos 与像素严格相干，免疫
     震屏/hitstop 的时刻错位）；setPlayerPos 把追兵拉走（拾取点背景不受影响）→ setEmber(0)
     → 0.25s 后读同点 ⇒ Δr。出生 0.32s 时粒 α≈0.55（α 最大相位）压暗底 ⇒ 期望 Δr≈0.55×
     (255−40)≈118 ⇒ 阈 ≥5 极松；品红特征 Δr>Δg（火星 r 分量 255 > g 106 恒成立）。失败重试
     ≤2 次取最大 Δr（只抗时间性干扰，不放宽阈值）。追兵节奏（实测参数：红 spd=118/紫 178，
     接触=(270−58)/spd+windup≈1.6s）：玩家驻中(≈440)；D 开场 teleport(80)〔追兵反向〕→0.7s 后
     折返 teleport(900) ⇒ 追兵须横穿全场 ~700px（紫 ≥3.4s、红 ≥5.1s 免击窗）⇒ 两次 attempt 的
     全部读数（含 off 间隙）都在窗内；off 相再 teleport(80) 为 attempt2 续窗。两次折返期间零接
     触 ⇒ 无震屏污染、玩家双保险存活。
   判据（10 行 / 8 组）：A 尘埃常驻满量；B1 运动（坐标位移）；B2 运动（像素帧差＋负控）；
   C1 act1 无火星；C2 act2 火星∈[2,24]；C3 clear 后归零；D 火星像素夹心（品位+品红）；
   E 上限硬截（setEmber(60)≤24 / setDust(80)==40）；F 帧时 p95≤25ms；0 零错误。
   用法：node tools/verify-v028.cjs；环境：CHAITAI_URL / CHAITAI_SHOT_PREFIX。 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v028/v028");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v028 ==");
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
  const stg = () => G(() => ((window.__game.state() || {}).staging) || null).catch(() => null);
  const atmoOf = () => G(() => { const s = window.__game.state(); return (s && s.atmo) ? s.atmo : null; }).catch(() => null);
  const waitSafe = async (ms, needWave2) => { const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await G(() => window.__game.state()).catch(() => null);
      if (s && s.player && s.player.hp > 0 && !(s.staging && s.staging.death) && (!needWave2 || s.wave === 2)) return true;
      await sleep(250);
    } return false; };
  /* 两快照逐像素 r 通道 mean|Δ|（v027 同款度量） */
  const bandPairDiff = (b, gapMs) => G((arg) => new Promise(res => {
    const [x0, x1, y0, y1, gap] = arg;
    const cv = document.getElementById("cv"), gc = cv.getContext("2d"), k = cv.width / 960;
    const grab = () => gc.getImageData(Math.round(x0 * k), Math.round(y0 * k),
      Math.round((x1 - x0) * k), Math.round((y1 - y0) * k)).data.slice();
    const b1 = grab();
    setTimeout(() => { const b2 = grab(); let acc = 0; const n = b2.length / 4;
      for (let i = 0; i < b2.length; i += 4) acc += Math.abs(b2[i] - b1[i]);
      res({ v: acc / n, n }); }, gap);
  }), [b[0], b[1], b[2], b[3], gapMs]);
  const bandRGB = (b) => G((arg) => { const cv = document.getElementById("cv"), gc = cv.getContext("2d"), k = cv.width / 960;
    const d = gc.getImageData(Math.round(arg[0] * k), Math.round(arg[2] * k),
      Math.round((arg[1] - arg[0]) * k), Math.round((arg[3] - arg[2]) * k)).data;
    let r = 0, g = 0, bl = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; }
    return { r: r / n, g: g / n, b: bl / n, n }; }, [b[0], b[1], b[2], b[3]]);
  const pxAt = (x, y) => G((arg) => { const cv = document.getElementById("cv"), gc = cv.getContext("2d"), k = cv.width / 960;
    const d = gc.getImageData(Math.round(arg[0] * k), Math.round(arg[1] * k), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] }; }, [x, y]);

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(1500);
  const hasAtmo = await G(() => !!(window.__game.debug && typeof window.__game.debug.setDust === "function"
    && typeof window.__game.debug.setEmber === "function" && typeof window.__game.debug.atmoPos === "function" && typeof window.__game.debug.telemetry === "function"));

  /* ---------- V28-A 尘埃常驻满量（title 相 + playing 3 连采） ---------- */
  const aT1 = await atmoOf();
  await shot("title-dust");
  let aPlays = []; /* playing 相在 Enter 后采 */
  /* ---------- V28-B1 尘埃运动（坐标位移；title 相 1s） ---------- */
  let b1ok = false, b1info = "钩子缺失（atmoPos 不存在）";
  if (hasAtmo) {
    const p1 = await G(() => window.__game.debug.atmoPos());
    await sleep(1000);
    const p2 = await G(() => window.__game.debug.atmoPos());
    let cnt = 0; const ds = [];
    const n = Math.min(4, (p1.dust || []).length, (p2.dust || []).length);
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(p2.dust[i].x - p1.dust[i].x, p2.dust[i].y - p1.dust[i].y);
      ds.push(d.toFixed(2)); if (d >= 0.5 && d <= 15) cnt++;
    }
    b1ok = n >= 4 && cnt >= 3;
    b1info = "1s 位移px[" + ds.join(",") + "] 达标 " + cnt + "/" + ds.length + "（≥3 粒 ∈[0.5,15]）";
  }

  await page.keyboard.press("Enter");
  for (let i = 0; i < 30; i++) { const s = await G(() => window.__game.state()); if (s.phase === "playing") break; await sleep(200); }
  await sleep(400);
  for (let i = 0; i < 3; i++) { const a = await atmoOf(); aPlays.push(a ? a.dust : null); await sleep(400); }
  {
    const ok = hasAtmo && aT1 && aT1.dust === 40 && aPlays.length === 3 && aPlays.every(v => v === 40) && (!aT1 || aT1.ember === 0);
    report("V28-A 尘埃常驻满量", ok,
      "title dust=" + (aT1 ? aT1.dust : "无atmo") + "（=40）｜playing 3 连采=[" + aPlays.join(",") + "]（全=40）| " + (hasAtmo ? "" : "钩子缺失"));
  }
  report("V28-B1 尘埃运动(坐标)", b1ok, b1info);

  /* ---------- V28-B2 尘埃运动（像素帧差夹心＋负控；act1、玩家 x190 未走） ---------- */
  let b2base = null, b2max = null, b2runs = 0;
  const SKY2 = [240, 660, 150, 178];
  if (hasAtmo) {
    await G(() => window.__game.debug.setDust(0));
    await sleep(350);
    const base = await bandPairDiff(SKY2, 1800);
    b2base = base.v;
    b2max = 0;
    for (let i = 0; i < 4; i++) {
      await G(() => window.__game.debug.setDust(40));
      await sleep(350);
      const r = await bandPairDiff(SKY2, 1800);
      if (r.v > b2max) b2max = r.v;
      b2runs++;
    }
    await shot("act1-dust-on");
  }
  {
    const ok = hasAtmo && b2base !== null && b2base <= 0.02 && b2max !== null && b2max > 0.003 && b2max < 0.5;
    report("V28-B2 尘埃运动(像素帧差)", ok,
      "负控(0 粒)帧差=" + (b2base === null ? "无" : b2base.toFixed(3)) + "（≤0.02）｜重铺×" + b2runs +
      " max=" + (b2max === null ? "无" : b2max.toFixed(3)) + "（∈(0.003,0.5)；r 通道 mean|Δ|，1.8s 跨度）");
  }

  /* ---------- V28-C1 act1 无火星（走之前） ---------- */
  const c1a = await atmoOf(); await sleep(500); const c1b = await atmoOf();
  {
    const ok = hasAtmo && c1a && c1b && c1a.ember === 0 && c1b.ember === 0;
    report("V28-C1 act1 无火星(相位门)", ok,
      "ember=" + (c1a ? c1a.ember : "无atmo") + "→" + (c1b ? c1b.ember : "无atmo") + "（两次全 0）");
  }

  /* ---------- 走位触发第一幕（真键过 420）→ 清 W1 → 等 act2 ---------- */
  await page.keyboard.down("KeyD");
  let actSeen = false;
  for (let i = 0; i < 250 && !actSeen; i++) { await sleep(40); const s = await stg(); if (s && s.act) actSeen = true; }
  await page.keyboard.up("KeyD");
  for (let i = 0; i < 70; i++) { const s = await stg(); if (!(s && s.act)) break; await sleep(40); }
  await G(() => window.__game.debug.clearWave());
  let w2seen = false;
  for (let i = 0; i < 150 && !w2seen; i++) { await sleep(60); const s = await G(() => window.__game.state()); if (s.wave === 2) w2seen = true; }
  await waitSafe(6000, true);
  await sleep(2000); /* 自然生成累积（4/s ⇒ λ≈8，C2 下界 2 的稳态窗口） */

  /* ---------- V28-C2 act2 火星∈[2,24] ---------- */
  let c2min = null;
  if (hasAtmo) {
    const e1 = await atmoOf(); await sleep(600); const e2 = await atmoOf();
    if (e1 && e2) c2min = Math.min(e1.ember, e2.ember);
  }
  {
    const ok = c2min !== null && c2min >= 2 && c2min <= 24;
    report("V28-C2 act2 火星∈[2,24]", ok,
      "两次采 min=" + (c2min === null ? "无（钩子/字段缺失）" : c2min) + "（∈[2,24]，≤24=预算上限；下界=生成器活着）");
  }

  /* ---------- V28-D 火星像素夹心·原子读（同一 evaluate 取 pos+像素；teleport 拉开追兵；重试 ≤2） ---------- */
  let dInfo = "钩子缺失", dOk = false;
  if (hasAtmo) {
    let best = null, attempts = 0;
    await G(() => window.__game.debug.setPlayerPos(80, 470)); /* 先反拉，再折返——每次折返=追兵横穿全场 */
    await sleep(700);
    for (let att = 0; att < 2 && (!best || best.dr < 5); att++) {
      attempts++;
      await G(() => window.__game.debug.setPlayerPos(900, 470));
      await G(() => window.__game.debug.setEmber(24));
      await sleep(320);
      const on = await G(() => {
        const g = window.__game.debug, s = window.__game.state();
        const cv = document.getElementById("cv"), gc = cv.getContext("2d"), k = cv.width / 960;
        const en = (s.enemies || []).filter(e => e.hp > 0);
        for (const q of g.atmoPos().ember) {
          if (q.y < 430 || q.y > 474 || q.x < 50 || q.x > 910) continue;
          if (Math.hypot(q.x - s.player.x, q.y - s.player.y) < 40) continue;
          if (en.some(e => Math.hypot(q.x - e.x, q.y - e.y) < 40)) continue;
          const d = gc.getImageData(Math.round(q.x * k), Math.round(q.y * k), 1, 1).data;
          return { x: q.x, y: q.y, r: d[0], g: d[1] };
        }
        return null;
      });
      await G(() => window.__game.debug.setPlayerPos(80, 470)); /* 追兵反拉（拾取点背景不受影响） */
      await G(() => window.__game.debug.setEmber(0));
      await sleep(250);
      const off = on ? await pxAt(on.x, on.y) : null;
      if (on && off) {
        const dr = on.r - off.r, dg = on.g - off.g;
        if (!best || dr > best.dr) best = { x: on.x, y: on.y, onR: on.r, offR: off.r, dr, dg };
      }
    }
    if (best) {
      dOk = best.dr >= 5 && best.dr > best.dg;
      dInfo = "粒(" + best.x.toFixed(0) + "," + best.y.toFixed(0) + ") r " + best.offR + "→" + best.onR +
        " Δr=" + best.dr + "（≥5）；Δg=" + best.dg + "（Δr>Δg=品红特征）｜attempts=" + attempts;
    } else { dInfo = "未挑到采样点/读失败（attempts=" + attempts + "）"; }
    await shot("act2-ember-off");
    await G(() => window.__game.debug.setEmber(24));
    await sleep(1100);
    await shot("act2-ember-on");
  }
  report("V28-D 火星像素夹心", dOk, dInfo);

  /* ---------- V28-E 上限硬截 ---------- */
  let eInfo = "钩子缺失", eOk = false;
  if (hasAtmo) {
    const nE = await G(() => window.__game.debug.setEmber(60));
    const aE = await atmoOf();
    const nD = await G(() => window.__game.debug.setDust(80));
    const aD = await atmoOf();
    await G(() => window.__game.debug.setDust(40));
    eOk = nE <= 24 && aE && aE.ember <= 24 && nD <= 40 && aD && aD.dust <= 40;
    eInfo = "setEmber(60)→" + nE + "/state=" + (aE ? aE.ember : "?") + "（≤24）｜setDust(80)→" + (aD ? aD.dust : "?") + "（≤40）";
  }
  report("V28-E 上限硬截", eOk, eInfo);

  /* ---------- 清 W2 → 等 cleared（仪式 4.5s 自清）→ 再等 → V28-C3 ---------- */
  await G(() => window.__game.debug.clearWave());
  let clr = false;
  for (let i = 0; i < 40; i++) { const s = await G(() => window.__game.state()); if (s.cleared) { clr = true; break; } await sleep(200); }
  await sleep(4800);
  const c3a = await atmoOf();
  {
    const ok = clr && c3a && c3a.ember === 0 && (!c3a || c3a.dust === 40);
    report("V28-C3 clear 后归零(停刷+耗尽)", ok,
      "cleared=" + clr + "｜ember=" + (c3a ? c3a.ember : "无atmo") + "（=0）dust=" + (c3a ? c3a.dust : "?") + "（=40，尘埃常驻到 clear 相）");
  }

  {
    const t = await G(() => window.__game.debug.telemetry());
    const ok = t.frameP95Ms <= 25;
    report("V28-F 帧时 sanity", ok, "p95=" + t.frameP95Ms + "ms（≤25 穷举上限；+64 fillRect/帧=预算表 40+24）");
  }
  {
    const ok = errs.length === 0;
    report("V28-0 零错误", ok, "0 pageerror / 0 console.error" + (ok ? "" : " → " + JSON.stringify(errs.slice(0, 4))));
  }

  const red = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - red) + "/" + results.length + (red ? "（红 " + red + "）" : " 全绿") + " ----");
  await browser.close();
  process.exit(red ? 1 : 0);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
