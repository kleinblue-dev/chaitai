/* slice-pacing.cjs —— W7 阶段2 垂直切片：pacing／帧率／截图证据工具（非套件成员；不做易碎新闸）
   依据＝方案 v2 §六 I 行（D:/2006L/docs/2026-10-16/拆台-阶段2-垂直切片方案-2026-10-16.md:150,153,188）：
   · I-a 走链：真键（Enter/J/A/D）＋钩子（setPlayerX/clearWave/setPlayerPos）——
         序章 W1/W2 → 幕终(actHold/continueReady) → 按 J 进第一幕 → E1-1/E1-2 →
         站 T3 触 E1-3（精英「大灯」入场＋elite_intro 起播）→ 清 → actHold＋cp=a1_end＋continueReady。
         产出：cpLog 时长表（{id,t}＋相邻差）＋五节点截图。
   · I-c 附件：P1/P2 冻结对比帧（目检；机械判据在 gate-15 I 行）、三体对照帧、精英 64px 缩样
         （页面内 canvas 直裁——世界→后备像素 ×dpr，index.html 无摄像机）。
         右墙按 J 镜像观察帧 1 张（设计 P2-9 观察项；本工具只出图不判定）。
   · I-d 帧率协议（评审 P0-1 重写版，逐字）：≥3 段 ×30s 战斗段。每段每 3s 轮询 telemetry()：
         frameCount 单调递增（防环形 600 帧错窗）→ 钳位帧数（frames 中 f>=0.0999）须为 0；
         p95（frameP95Ms）≤16.6ms；同时轮询 state() 声明「真在战斗」（敌数采样、死亡数、补敌数）。
         对照 W6.1 基线 6.5ms〔历史回执〕。单机 msedge headless 口径，不外推。
   判定：I-a 关键项（act2／E1-3 出生含精英／elite_intro 渲染进展／a1_end＋continueReady）＋I-d 三段
         全部 ≤16.6／钳位 0／frameCount 单调推进 ⇒ PASS；任一 FAIL ⇒ rc=1；脚本自身错 rc=2。
   纪律：不重试碰绿、不调阈值、截图不裁剪伪造；失败如实打印。
   R13（10-17 H 步首跑后；本文件唯一修订项）：I-a-8 观测法改「有界序列轮询（≤5s）」，判据回预注册语义。
     原 W7.3 初版＝出生 +900ms 单点快照断言 narrKey==="elite_intro"（单点系仪器自加约束，非预注册阈值）。
     首跑实读 narrKey=idle_in_combat narrChars=14（t2b-h-slice-pacing.txt）⇒ 根因 N7：脚本走链真键停止
     ⇒ world.lastInput 冻结（game.js:822）⇒ idle>6；spawnActEncounter 重置 idleCombatFired（:795）
     ⇒ E1-2/E1-3 出生帧 idle 块（:869-871，在 updWorld 内）重播 idle_in_combat；同帧 updEnemies
     （:508；主循环顺序 :957＝updWorld 先于 updEnemies）再 fire elite_intro ⇒ Narr 为队列且非抢占
     （fire :145；elite_intro 不在 PRIO 表）⇒ elite_intro 排在该 14 字行后 ≈1.09s（26cps×14＝0.54s＋
     hold 0.55s）起播。独立辅证：gate-15 J 行 narrTrace 实测 elite_intro@1163ms chars=1（t2b-r11.txt:6）。
     预注册判据＝w7-edits.md:48「活跑 narrKey==="elite_intro" 且 narrChars>0」（序列语义，本非单点）。
     ⇒ 修订＝同一观测量改有界轮询（首见即证），阈值/判据语义零放宽；序列与首见时延入日志为证据。
   用法：node tools/slice-pacing.cjs
   环境：CHAITAI_URL（默认正本）／CHAITAI_SHOT_PREFIX（截图前缀，默认 shots/w7-h/sp-） */
"use strict";
const fs = require("fs");
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const PFX = process.env.CHAITAI_SHOT_PREFIX || (ROOT.replace(/\\/g, "/") + "/shots/w7-h/sp-");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const res = [];
function item(id, ok, detail) { res.push({ id, ok }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  fs.mkdirSync(path.dirname(PFX), { recursive: true });
  console.log("== slice-pacing（I-a 走链／I-c 附件帧／I-d 帧率协议；单机 msedge headless 口径，不外推）==");
  console.log("URL  = " + URL_);
  console.log("截图前缀 = " + PFX);
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  const shot = async (tag) => { await page.screenshot({ path: PFX + tag + ".png" }); };
  const st = () => page.evaluate(() => window.__game.state());
  const dbg = (f, a) => page.evaluate((fn, args) => { const d = window.__game.debug; return d[fn].apply(d, args); }, f, a || []);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(60); } return null; };
  const bornOf = (id) => page.evaluate((want) => { const s = window.__game.state(); const L = s.lastSpawn; return (L && L.id === want) ? L.born : null; }, id);
  const waitBorn = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const b = await bornOf(id); if (b) return b; await sleep(50); } return null; };
  const tele = () => page.evaluate(() => window.__game.debug.telemetry());

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);

  /* ================= I-a 走链（五节点） ================= */
  await shot("01-title");
  const tEnter = Date.now();
  await page.keyboard.press("Enter"); await sleep(400);
  await dbg("setPlayerX", [430]);
  /* W1：真键移动＋攻击几下（真键证据），再清场推进 */
  const w1 = await until(async () => { const s = await st(); return s.enemies.length >= 2 ? s : null; }, 4000);
  await page.keyboard.down("KeyD"); await sleep(220); await page.keyboard.up("KeyD");
  await page.keyboard.press("KeyJ"); await sleep(350);
  await page.keyboard.press("KeyJ"); await sleep(250);
  await shot("02-prologue-w1");
  item("I-a-1 序章 W1 出生＋真键移动/攻击", !!w1, w1 ? ("敌数=" + w1.enemies.length + "（真键 D 220ms＋J×2）") : "4s 内 W1 未出生");
  await dbg("clearWave");
  const w2 = await until(async () => { const s = await st(); return s.enemies.length >= 3 ? s : null; }, 4000);
  item("I-a-2 序章 W2 链式出生", !!w2, w2 ? ("敌数=" + w2.enemies.length) : "4s 内 W2 未出生");
  await dbg("clearWave");
  const cleared = await until(async () => { const s = await st(); return s.cleared ? s : null; }, 8000);
  const cont = await until(async () => { const s = await st(); return s.continueReady ? s : null; }, 9000);
  item("I-a-3 幕终 actHold/continueReady", !!cleared && !!cont,
    "cleared=" + !!cleared + " continueReady=" + !!cont);
  await page.keyboard.press("KeyJ"); await sleep(400);
  const a2 = await st();
  item("I-a-4 按 J 进第一幕", a2.act === 2, "act=" + a2.act + " 台箱=" + JSON.stringify((a2.plats || []).map(p => p.x + "/" + p.y)));
  await shot("03-act2-card");
  await dbg("setPlayerX", [430]);
  const b1 = await waitBorn("E1-1", 5000);
  item("I-a-5 E1-1 出生", !!b1, b1 ? ("出生=" + b1.map(e => Math.round(e.x)).join(",")) : "5s 未出生");
  await dbg("clearWave"); await sleep(150);
  await dbg("setPlayerX", [430]);
  const b2 = await waitBorn("E1-2", 5000);
  item("I-a-6 E1-2 出生", !!b2, b2 ? ("出生=" + b2.map(e => Math.round(e.x)).join(",")) : "5s 未出生");
  await dbg("clearWave"); await sleep(150);
  /* 站 T3 触 E1-3（精英入场＝切片终点） */
  await dbg("setPlayerPos", [828, 300]);
  const b3 = await waitBorn("E1-3", 3500);
  const kinds3 = b3 ? b3.map(e => e.k).join(",") : "";
  /* I-a-8（R13）elite_intro 渲染观测：按预注册判据（w7-edits.md:48 J 行＝活跑 narrKey==="elite_intro"
     且 narrChars>0，序列语义）做 ≤5s 有界轮询；首见后 250ms 再采一帧示渲染进展（打印用，不入判定）。
     原 +900ms 单点快照系仪器自加约束、被 idle_in_combat 正当队列占位（根因 N7，见头注 R13）。 */
  const t8 = Date.now();
  const seq8 = [];
  let introMs = null, introChars = 0;
  while (Date.now() - t8 < 5000) {
    const tr = await tele();
    seq8.push(tr.narrKey + ":" + Math.round(tr.narrChars));
    if (tr.narrKey === "elite_intro" && tr.narrChars > 0) {
      introMs = Date.now() - t8; introChars = Math.round(tr.narrChars);
      await sleep(250);
      const gr = await tele();
      seq8.push(gr.narrKey + ":" + Math.round(gr.narrChars) + "[+250ms]");
      break;
    }
    await sleep(150);
  }
  await shot("04-e13-elite");
  item("I-a-7 E1-3 出生含精英", !!b3 && kinds3 === "purple,purple,elite",
    b3 ? ("kinds=" + kinds3 + " born=" + b3.map(e => Math.round(e.x)).join(",")) : "3.5s 未出生");
  item("I-a-8 elite_intro 起播（渲染进展量）", introMs !== null && introChars > 0,
    (introMs !== null ? "首见 +" + introMs + "ms chars=" + introChars : "5s 内未见") + " · 序列=" + seq8.join(">"));
  /* 清 E1-3 → actHold＋cp=a1_end＋continueReady */
  await dbg("clearWave");
  const hold = await until(async () => { const s = await st(); return (s.actHold && s.continueReady) ? s : null; }, 6000);
  const cpNow = await page.evaluate(() => { try { return window.__game.debug.cp().id; } catch (e) { return null; } });
  await shot("05-a1-end");
  item("I-a-9 清后 actHold＋continueReady＋cp=a1_end", !!hold && cpNow === "a1_end",
    "actHold=" + (hold ? hold.actHold : "未达") + " continueReady=" + (hold ? hold.continueReady : "未达") + " cp=" + cpNow);
  /* cpLog 时长表 */
  const tEnd = Date.now();
  const cp = await tele();
  console.log("   cpLog 时长表（{id,t}：t=world 秒；Δ=相邻步进秒）：");
  for (let i = 0; i < cp.cpLog.length; i++) {
    const prev = i ? cp.cpLog[i - 1].t : 0;
    console.log("     " + cp.cpLog[i].id.padEnd(18) + " t=" + cp.cpLog[i].t.toFixed(2) + "  Δ=" + (cp.cpLog[i].t - prev).toFixed(2));
  }
  console.log("   墙钟：Enter→切片终点（E1-3 清后 actHold）＝" + ((tEnd - tEnter) / 1000).toFixed(1) + "s（含脚本等待/截图开销，非纯游玩时长）");
  item("I-a-10 cpLog 时间戳链完整", cp.cpLog.length >= 5 && cp.cpLog.every(x => typeof x.t === "number" && typeof x.id === "string"),
    "条数=" + cp.cpLog.length + " 首=" + (cp.cpLog[0] || {}).id + " 末=" + (cp.cpLog[cp.cpLog.length - 1] || {}).id);

  /* ================= I-c 附件帧 ================= */
  /* P1/P2 冻结对比帧：新放一只精英 → P1 冻结帧 → enemyHit(48)（90→42≤45）→ P2 冻结帧 */
  await dbg("clearWave"); await sleep(250);
  await dbg("setPlayerX", [150]);
  const eid = await page.evaluate(() => window.__game.debug.spawnEnemy("elite", 620));
  await sleep(500);
  await page.evaluate(() => window.__game.debug.setHitstop(1)); await sleep(250);
  await shot("06-elite-P1-frozen");
  await page.evaluate(() => window.__game.debug.setHitstop(0)); await sleep(120);
  const hpAfter = await page.evaluate((id) => window.__game.debug.enemyHit(id, 48), eid);
  await sleep(700); /* P2 门 + enrage 特效窗 */
  const ph = await page.evaluate((id) => { const s = window.__game.state(); const e = s.enemies.filter(x => x.id === id)[0]; return e ? { phase: e.phase, hp: e.hp } : null; }, eid);
  await page.evaluate(() => window.__game.debug.setHitstop(1)); await sleep(250);
  await shot("07-elite-P2-frozen");
  await page.evaluate(() => window.__game.debug.setHitstop(0));
  item("I-c-1 P1/P2 对比帧（P2 门实测）", hpAfter === 42 && !!ph && ph.phase === 2,
    "enemyHit→hp=" + hpAfter + " phase=" + (ph ? ph.phase : "?") + "（冻结帧 06/07）");
  /* 三体对照帧：red/purple/elite 同框 */
  await page.evaluate(() => { const d = window.__game.debug; d.spawnEnemy("red", 480); d.spawnEnemy("purple", 550); });
  await sleep(400);
  await page.evaluate(() => window.__game.debug.setHitstop(1)); await sleep(250);
  await shot("08-triple-compare");
  await page.evaluate(() => window.__game.debug.setHitstop(0));
  item("I-c-2 三体对照帧（红/紫/精英同框）", true, "冻结帧 08（目检用，不判定）");
  /* 精英 64px 缩样（页面内 canvas 直裁；世界→后备像素 ×dpr；窗 x±75、y∈[GY-160,GY+8]） */
  const b64 = await page.evaluate(() => {
    try {
      const cv = document.getElementById("cv");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const s = window.__game.state();
      const e = s.enemies.filter(x => x.kind === "elite" && x.hp > 0)[0];
      if (!e) return null;
      const sw = 150, sh = 168;
      const sx = (e.x - sw / 2) * dpr, sy = (e.y - sh + 8) * dpr;
      const outH = 64, outW = Math.round(sw / sh * 64);
      const c2 = document.createElement("canvas"); c2.width = outW; c2.height = outH;
      const g = c2.getContext("2d");
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      g.drawImage(cv, sx, sy, sw * dpr, sh * dpr, 0, 0, outW, outH);
      return c2.toDataURL("image/png");
    } catch (err) { return null; }
  });
  if (b64) fs.writeFileSync(PFX + "09-elite-64px.png", Buffer.from(b64.replace(/^data:image\/png;base64,/, ""), "base64"));
  item("I-c-3 精英 64px 缩样出图", !!b64, b64 ? "09-elite-64px.png（真彩直裁）" : "取材失败（无活体精英）");
  /* 右墙按 J 镜像观察帧（设计 P2-9 观察项；不判定） */
  await dbg("setPlayerX", [900]);
  await sleep(200);
  await page.keyboard.press("KeyJ");
  await sleep(280); /* 攻击动作窗 */
  await shot("10-wall-j-mirror");
  item("I-c-4 右墙按 J 镜像观察帧", true, "10-wall-j-mirror.png（观察项 P2-9，只出图不判定）");

  /* ================= I-d 帧率协议：≥3 段 ×30s 战斗段 ================= */
  const poll = () => page.evaluate(() => {
    const t = window.__game.debug.telemetry();
    const s = window.__game.state();
    const clamps = t.frames.filter(f => f >= 0.0999).length;
    return { fc: t.frameCount, p95: t.frameP95Ms, clamps, enemies: s.enemies.length,
      deaths: (typeof s.deaths === "number" ? s.deaths : -1), phase: s.phase };
  });
  let dOk = true;
  for (let segI = 1; segI <= 3; segI++) {
    const name = "S" + segI;
    await dbg("clearWave"); await sleep(300);
    await dbg("setPlayerX", [430]);
    await page.evaluate(() => window.__game.debug.spawnEnemy("elite", 620));
    await sleep(500);
    const polls = []; let jN = 0, refills = 0, k = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const r0 = Date.now();
      while (Date.now() - r0 < 2900) {
        const key = (k % 2) ? "KeyA" : "KeyD";
        await page.keyboard.down(key); await sleep(90); await page.keyboard.up(key);
        await page.keyboard.press("KeyJ"); jN++;
        await sleep(240); k++;
      }
      const p = await poll(); polls.push(p);
      if (p.enemies === 0) { refills++; await page.evaluate(() => window.__game.debug.spawnEnemy("elite", 620)); }
    }
    const fcDelta = polls[polls.length - 1].fc - polls[0].fc;
    const mono = polls.every((p, i) => i === 0 || p.fc > polls[i - 1].fc);
    const clampSum = polls.reduce((a, p) => a + p.clamps, 0);
    const p95Max = Math.max.apply(null, polls.map(p => p.p95));
    const fightShare = polls.filter(p => p.enemies > 0).length / polls.length;
    const d0 = polls[0].deaths, dN = polls[polls.length - 1].deaths;
    const ok = fcDelta >= 1500 && mono && clampSum === 0 && p95Max <= 16.6;
    if (!ok) dOk = false;
    console.log("   [" + name + "] 轮询明细 fc：" + polls.map(p => p.fc).join(">") + " · p95：" + polls.map(p => p.p95).join(","));
    item("I-d " + name + " 30s 战斗段", ok,
      "帧增量=" + fcDelta + "（单调=" + mono + "）· 钳位帧总=" + clampSum + " · p95 max=" + p95Max + "ms（≤16.6）" +
      " · 战斗态：敌>0 采样=" + Math.round(fightShare * 100) + "% 补敌=" + refills + " 自计 J=" + jN +
      " 死亡 " + d0 + "→" + dN + "（W6.1 基线 6.5ms〔历史回执〕对照）");
  }

  /* ================= 汇总 ================= */
  const fails = res.filter(r => !r.ok);
  console.log("---- 汇总：PASS " + (res.length - fails.length) + "/" + res.length + (fails.length ? " · FAIL=" + fails.map(f => f.id).join(",") : "") + " ----");
  console.log("   零错误哨兵：" + (errs.length === 0 ? "0 pageerror / 0 console.error" : errs.join(" | ")));
  await browser.close().catch(() => {});
  process.exit(fails.length === 0 && errs.length === 0 ? 0 : 1);
})().catch(e => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
