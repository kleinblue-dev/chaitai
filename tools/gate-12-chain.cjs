/* gate-12-chain.cjs —— 《拆台》全链检查点闸（W5 收口 C5／07-Unity-Editor-Tool-Developer P3）
   目的：一次完整真跑（复用 gate-10 全梯路径＋终幕速通）后，断 cpLog 与 registry 32 条 live 序逐项比对——
   v024 只验前 5 条运行序（B1 首局链），其余为逐幕端点静检；本闸把「全链收口」变成机器可验证：
   · G12.1 全梯全序 28 条：game_start→…→a4_choice→end_X（27 条固定序逐项相等＋末条∈end_a/b/c/d）
   · G12.2 无重复（28 条每 id 恰一次）
   · G12.3 对 registry 运行时冻结串（32 条 live）子序合法（第二源交叉——防硬编码 FIX27 与实现漂移）
   · G12.4 R 重置段：结局后按 R ⇒ cpLog 恰为 [restart_done]（补齐 32 条中 restart_done 的运行验证）
   · G12-0 零错误（pageerror/console.error）
   覆盖口径：本闸运行覆盖 29/32（28 全梯＋restart_done 单点）；end_b/c/d 三条由 gate-10 四配方覆盖
   （beginEnding 单调用点参数化，删它＝falsify-g12 M3 锚）。
   风险与口径：必须真梯（段模式无效——段模式 cpLog 只有终幕段）；全程零动作钩子是做不到的（全梯要清场
   推进），但断言只读 cpLog＋注册表层——「链」本身未被 debug 干预（setCp 只由游戏路径调用）。
   用法：node tools/gate-12-chain.cjs；环境：CHAITAI_URL / CHAITAI_SHOT_PREFIX（falsify-g12 副本用）。
   红侧口径：链在 W4 已全接线 ⇒ 本闸正本预期绿；分辨力由 falsify-g12（删任一 setCp ⇒ 红）证明。 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOTS = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/gate-12");
const PFX = "g12-";
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 27 条固定序（与 v024:81 冻结串同源同文，去 restart_done 与 end_b/c/d 后逐字一致）＋1 条 end_X */
const FIX27 = ["game_start", "wave1", "wave2", "arena_cleared", "outro",
  "a1_e1", "a1_e2", "a1_e3", "a1_end", "act2_open", "a2_teach", "a2_a1", "a2_a2", "a2_end",
  "act3_open", "a3_1", "a3_2", "a3_3", "a3_break", "a3_end",
  "act4_open", "boss_intro", "a4_p1", "a4_p2", "a4_p3", "a4_down", "a4_choice"];

(async () => {
  console.log("== gate-12-chain（全链检查点：全梯 28 条全序／无重复／registry 子序／R 重置段） ==");
  console.log("URL  = " + URL);
  console.log("md5  = game.js " + md5(path.join(ROOT, "game.js")) + " / index.html " + md5(path.join(ROOT, "index.html")) + "（被测目录 " + ROOT.replace(/\\/g, "/") + "）");
  fs.mkdirSync(SHOTS, { recursive: true });
  let FAIL = 0, PASS = 0;
  const chk = (ok, id, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + id + " —— " + detail); ok ? PASS++ : FAIL++; };

  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  await page.goto(URL, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(700);

  const st = () => page.evaluate(() => window.__game.state());
  const dbg = (f, a) => page.evaluate((fn, args) => { try { const d = window.__game.debug; return d[fn].apply(d, args || []); } catch (e) { return null; } }, f, a || []);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(60); } return null; };
  const bornOf = (id) => page.evaluate((want) => { const s = window.__game.state(); const L = s.lastSpawn; return (L && L.id === want) ? L.born : null; }, id);
  const waitBorn = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const b = await bornOf(id); if (b) return b; await sleep(50); } return null; };
  const cpLogIds = () => page.evaluate(() => { try { return window.__game.debug.cp().log.map(x => x.id); } catch (e) { return []; } });

  /* ============ §全梯：序章 → 第一幕 → 第二幕 → 第三幕终（照 gate-10-final !SEG 段路径） ============ */
  await dbg("setPlayerX", [430]);
  await until(async () => { const s = await st(); return s.enemies.length >= 2 ? s : null; }, 4500); await dbg("clearWave");
  await until(async () => { const s = await st(); return s.enemies.length >= 3 ? s : null; }, 4500); await dbg("clearWave");
  await until(async () => { const s = await st(); return s.cleared ? s : null; }, 8000);
  await until(async () => { const s = await st(); return s.continueReady ? s : null; }, 8000);
  await page.keyboard.press("KeyJ"); await sleep(300);
  const p1 = await waitBorn("E1-1", 4500); await dbg("clearWave");
  const p2 = await waitBorn("E1-2", 5000); await dbg("clearWave");
  await dbg("setPlayerPos", [828, 300]);
  const p3 = await waitBorn("E1-3", 3000); await dbg("clearWave");
  await until(async () => { const s = await st(); return s.actHold ? s : null; }, 4000);
  await page.keyboard.press("KeyJ"); await sleep(300);
  await dbg("setPlayerX", [800]);
  const q1 = await waitBorn("A2-1", 4500); await dbg("clearWave");
  await dbg("setPlayerX", [300]);
  const q2 = await waitBorn("A2-2", 5000); await dbg("clearWave");
  await dbg("setPlayerX", [490]);
  const q3 = await waitBorn("A2-3", 5000); await dbg("clearWave");
  await until(async () => { const s = await st(); return s.actHold ? s : null; }, 4000);
  await page.keyboard.press("KeyJ"); await sleep(300);
  console.log("   [梯] 一/二幕到场=" + [!!p1, !!p2, !!p3, !!q1, !!q2, !!q3].join(","));
  await dbg("setPlayerPos", [480]);
  const r1 = await waitBorn("A3-1", 5000); await dbg("clearWave");
  await dbg("setPlayerPos", [490]);
  const r2 = await waitBorn("A3-2", 5500); await dbg("clearWave");
  await dbg("setPlayerPos", [200]); /* 等待期避开落物 3 点 300/480/660 */
  const r3 = await waitBorn("A3-3", 5500);
  await until(async () => { const w = (await st()).wall; return w.built === true ? w : null; }, 3000);
  await dbg("clearWave");
  /* 拆墙：安全窗（灯带 m∈[0.15,1.6]）＋180 朝左三连 130ms（gate-9 G9.16 技术直搬） */
  await dbg("setPlayerPos", [200, 420]);
  await until(async () => { const s = await st(); const L = (s.traps || []).find(t => t.type === "lamp");
    if (!L) return null; const m = L.t % 6; return (m >= 0.15 && m <= 1.6) ? true : null; }, 8000);
  await dbg("setPlayerPos", [180]);
  await page.keyboard.down("KeyA"); await sleep(90); await page.keyboard.up("KeyA");
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press("KeyJ"); await sleep(130);
    await page.keyboard.press("KeyJ"); await sleep(130);
    await page.keyboard.press("KeyJ");
    const broke = await until(async () => { const w = (await st()).wall; return w.built === false ? w : null; }, 2500);
    if (broke) break;
  }
  const endS4 = await until(async () => { const s = await st(); return s.actHold ? s : null; }, 5000);
  console.log("   [梯] 三幕到场=" + [!!r1, !!r2, !!r3].join(",") + " 幕终actHold=" + !!endS4);
  await page.screenshot({ path: path.join(SHOTS, PFX + "00-act4-hold.png") });
  await page.keyboard.press("KeyJ");
  const a5 = await until(async () => { const s = await st(); return s.act === 5 ? s : null; }, 3000);
  console.log("   [梯] 按 J 进终幕 act5=" + !!a5);

  /* ============ §终幕速通：Boss 入场 → 速杀（p2/p3 门同发）→ a4_down → a4_choice → 收手 → end_X ============ */
  const bossE = await until(async () => { const s = await st(); return (s.boss && s.boss.active) ? s : null; }, 7000);
  console.log("   [终] Boss 入场=" + !!bossE + " hp=" + (bossE ? bossE.boss.hp : "-"));
  let fired1 = false, fired2 = false, dead = false;
  const tKill = Date.now();
  while (Date.now() - tKill < 20000) {
    const s = await st();
    if ((s.traps || []).length) await dbg("clearTraps"); /* 消险：press/雨/灯全清（gate-10 harvest 同径） */
    if (!fired1) { await dbg("bossDamage", [80]); await sleep(250); await dbg("clearWave"); fired1 = true; }
    else if (!fired2 && s.boss.phase >= 3) { await dbg("bossDamage", [50]); fired2 = true; }
    if (s.boss.dead) { dead = true; break; }
    await sleep(80);
  }
  console.log("   [终] bossDead=" + dead + " fired=" + fired1 + "/" + fired2);
  const ch1 = await until(async () => { const s = await st(); return s.spare && s.spare.open ? s : null; }, 9000); /* bossDefeat 2.2s → openSpare */
  console.log("   [终] spare 开窗=" + !!ch1);
  /* 收手：静候满窗 6.0s（不按 J）——SPARE_WIN=6.0 */
  const tS = Date.now();
  let endSeen = null;
  while (Date.now() - tS < 20000) {
    const s = await st();
    if ((s.traps || []).length) await dbg("clearTraps");
    if (s.ending) { endSeen = s.ending; }
    if (s.staging && s.staging.card) break;
    await sleep(120);
  }
  console.log("   [终] ending=" + (endSeen ? endSeen : "(未见)") + " 杀青卡=" + true);
  await page.screenshot({ path: path.join(SHOTS, PFX + "01-ending-card.png") });

  const L = await cpLogIds();
  console.log("   [链] cpLog 实测 " + L.length + " 条: " + L.join(">"));

  /* ---- G12.1 全梯 28 条全序 ---- */
  {
    const headOk = L.length === 28 && FIX27.every((id, i) => L[i] === id);
    const endOk = /^end_[abcd]$/.test(L[27] || "");
    chk(headOk && endOk, "G12.1 全梯全序 28 条（27 固定序逐项＋end_X）",
      "len=" + L.length + " 固定序前27=" + FIX27.every((id, i) => L[i] === id) + " 末条=" + (L[27] || "-") +
      (headOk ? "" : "｜前5实测=" + L.slice(0, 5).join(">") + "｜尾3实测=" + L.slice(-3).join(">")));
  }
  /* ---- G12.2 无重复 ---- */
  {
    const dup = L.filter((x, i) => L.indexOf(x) !== i);
    chk(dup.length === 0, "G12.2 无重复（每 id 恰一次）", "28 条 unique=" + (new Set(L).size === L.length) + " 重复项=" + (dup.join(",") || "无"));
  }
  /* ---- G12.3 对 registry 32 条 live 序子序合法（第二源交叉） ---- */
  {
    const reg = await page.evaluate(() => { try { return window.__game.debug.registry.checkpoints.filter(c => c.stage === "live").map(c => c.id); } catch (e) { return null; } });
    let ok = !!reg, missing = [], idx = 0;
    if (reg) for (const id of L) {
      const k = reg.indexOf(id, idx);
      if (k < 0) { ok = false; missing.push(id); } else idx = k + 1;
    }
    chk(ok, "G12.3 registry 子序合法（32 条 live 冻结串）",
      ok ? ("L 逐项在 registry 序中严格递增（" + (reg ? reg.length : 0) + " 条）") : ("逆序/不在册项=" + (missing.join(",") || "registry 读取失败")));
  }
  /* ---- G12.4 R 重置段（restart_done 运行验证） ---- */
  {
    const wr = await until(async () => { const s = await st(); return s.showRestart ? s : null; }, 6000);
    await page.keyboard.press("KeyR"); await sleep(500);
    const LR = await cpLogIds();
    const ok = !!wr && LR.length === 1 && LR[0] === "restart_done";
    chk(ok, "G12.4 R 重置段：cpLog 恰为 [restart_done]", "R 前 showRestart=" + !!wr + " 按 R 后=" + JSON.stringify(LR));
  }
  /* ---- 覆盖报告（不断，只印） ---- */
  console.log("   覆盖口径：本跑运行覆盖 29/32（28 全梯＋restart_done）；end_b/c/d 由 gate-10 四配方覆盖（beginEnding 单调用点参数化）");
  /* ---- G12-0 零错误 ---- */
  chk(errs.length === 0, "G12-0 零错误", errs.length ? errs.slice(0, 2).join(" | ") : "0 条");

  console.log("---- 汇总：PASS " + PASS + " FAIL=" + FAIL + " rc=" + (FAIL ? 1 : 0) + " ----");
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
