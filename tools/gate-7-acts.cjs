/* gate-7-acts.cjs —— 幕推进/连通：序章 → 第一幕（v0.2 W1 接线；契约见 review-v02/d8-qa/qa-plan.md §闸）
   断言链（全部走真实输入/真实流程，只读 state 判结果）：
   G7.1 序章照常：W1 幕卡降级为「序章 · 第1镜」；W2 照常链式 spawn（清后 1.2s）
   G7.2 序章清场链照常（cleared=true）
   G7.3 outro 后「按 J 开拍」开闸（state.continueReady）
        G7.3b 驻留态 ▶/⟳ 双按钮在屏；G7.3c 死亡中按 J 不开拍（phase 门禁）、复活后闸保持
        G7.4b 开拍后 ▶/⟳ 全收（驻留泄漏护栏）；G7.11d 幕终驻留 ⟳ 上屏、▶ 不上
   G7.4-G7.6 按 J → 第一幕：state.act=2、幕卡「第一幕 · 对峙」、cleared 复位
   G7.7 台箱三件：T1 300/420/64/50、T2 500/390/64/80、T3 780/300/96/170（state.plats）
   G7.8 E1-1：curtain 1.5s 后 红×2 出生 760/850（玩家430，距>260 ⇒ 不镜像）
   G7.9 E1-2：清后 delay 1.5s；玩家430 距锚60 队 190<260 ⇒ 整队镜像 → 出生 800/890/900（clamp 上界900）
   G7.10 E1-3：清后负控（不站不生成）→ setPlayerPos(828,300) 站 T3 触发 T-STAND；
        R2 生效（y≤420 ⇒ 安全距140；|640-828|=188≥140）⇒ 不镜像 → 出生 460/550/640
        G7.10c/d＝数据面耦合：stand 触发 y/x0/x1 必须与 T3 台箱面逐值相等
        （防「调 T3 几何忘同步触发」⇒ E1-3 永不触发）
   位置口径：一律断言 lastSpawn.born（出生值＝encSpawnX 结果、首帧整形前）；敌生成后会被
   台箱停步带（d2 §2.1④ 敌不越箱面 ⇒ 箱足印内推至边缘，如 850→896）与追踪移动改变
   活体坐标，故活体值只作明细输出、不作断言。
   G7.11 a1_end：E1-3 清后 cp=a1_end + actHold；下一幕已接线（W2）⇒ continueReady 开、▶ 上屏
   G7.12 R 重开回序章（act=1、台箱清空）
   G7.14 E1-3 软锁兜底（W4.1/A2）：R 后重放至 E1-3 等待——不站 T3 静置 ⇒ 25s 强推
        （玩家在地面 ⇒ R-rule 安全距 260 触发整队镜像 ⇒ 出生 400/490/580；红侧=永等不生成）
   红侧（W1 接线前）：G7.1b/G7.3 起全红（continueReady/plats 字段不存在、幕牌未换名）。
   跑法：node tools/gate-7-acts.cjs   （env：CHAITAI_URL / CHAITAI_SHOT_PREFIX 同其它闸） */
"use strict";
const path = require("path");
const fs = require("fs");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOTS = path.join(ROOT, "shots");
const PFX = process.env.CHAITAI_SHOT_PREFIX || "gate-7-";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const chk = (ok, tag, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + tag + " —— " + detail); ok ? pass++ : fail++; };

(async () => {
  console.log("== gate-7-acts（幕推进/连通：序章→第一幕）==");
  console.log("URL  = " + URL);
  fs.mkdirSync(SHOTS, { recursive: true });
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
  const dbg = (f, a) => page.evaluate((fn, args) => { const d = window.__game.debug; return d[fn].apply(d, args); }, f, a || []);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(60); } return null; };
  /* 出生值断言工具：lastSpawn.born 是 encSpawnX 的原始结果（首帧整形前） */
  const bornOf = (id) => page.evaluate((want) => { const s = window.__game.state(); const L = s.lastSpawn; return (L && L.id === want) ? L.born : null; }, id);
  const waitBorn = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const b = await bornOf(id); if (b) return b; await sleep(50); } return null; };
  const ksOf = (b) => b.map(e => e.k).join(",");
  const xsOf = (b) => b.map(e => Math.round(e.x)).join(",");
  const bornOk = (b, ks, xs) => !!b && b.length === xs.length && ksOf(b) === ks && b.every((e, i) => Math.abs(e.x - xs[i]) <= 1);

  chk(errs.length === 0, "G7.0 进入游戏零错误", errs.length ? errs[0] : "0 条");

  /* —— 序章（回归：行为逐值保留，仅幕卡降级） —— */
  await dbg("setPlayerX", [430]);
  let w1 = null; { const t0 = Date.now(); while (Date.now() - t0 < 4000) { const s = await st(); if (s.enemies.length >= 2) { w1 = s; break; } await sleep(60); } }
  chk(!!w1, "G7.1a 序章 W1（zone x>420）照常 spawn", w1 ? ("enemies=" + w1.enemies.length) : "4s 内没等到");
  const stg1 = await st();
  chk(!!(stg1.staging.act && stg1.staging.act.name === "序章 · 第1镜"),
    "G7.1b 序章幕卡已降级为「序章 · 第1镜」", stg1.staging.act ? stg1.staging.act.name : "(null)");
  await page.screenshot({ path: path.join(SHOTS, PFX + "01-prologue-w1.png") });
  await dbg("clearWave");
  let w2 = null; { await sleep(250); const t0 = Date.now(); while (Date.now() - t0 < 4000) { const s = await st(); if (s.enemies.length >= 3) { w2 = s; break; } await sleep(60); } }
  chk(!!w2, "G7.1c W2 照常链式 spawn（清后 1.2s）", w2 ? ("enemies=" + w2.enemies.length) : "4s 内没等到");
  await dbg("clearWave");
  let cleared = null; { const t0 = Date.now(); while (Date.now() - t0 < 6000) { const s = await st(); if (s.cleared) { cleared = s; break; } await sleep(80); } }
  chk(!!cleared, "G7.2 序章清场链照常（cleared=true）", cleared ? "cleared" : "6s 内没等到");
  let cont = null; { const t0 = Date.now(); while (Date.now() - t0 < 8000) { const s = await st(); if (s.continueReady) { cont = s; break; } await sleep(80); } }
  chk(!!cont, "G7.3 outro 后「按 J 开拍」开闸（continueReady=true）", cont ? ("act=" + cont.act + " cp=" + (cont.cp || "")) : "8s 内没等到（接线前应红于此）");

  /* 驻留态按钮（手机 UI）＋死亡门控：cleared 后死亡中按 J 不得开拍、continueReady 不得被吞 */
  const btnState = () => page.evaluate(() => {
    const g = (id) => { const el = document.getElementById(id); return el ? el.classList.contains("on") : null; };
    return { cont: g("t-continue"), rest: g("t-restart") }; }); /* null＝旧版无此按钮（红侧）：判 FAIL 不判崩 */
  const bs1 = await btnState();
  chk(!!cont && bs1.cont === true && bs1.rest === true && cont.showRestart === true, "G7.3b 驻留态：showRestart=true 且 ▶/⟳ 都在屏", JSON.stringify(bs1) + " showRestart=" + (cont ? cont.showRestart : "(无)"));
  await dbg("hurtPlayer", [100]);
  const dS = await until(async () => { const s = await st(); return s.phase === "dead" ? s : null; }, 2000);
  chk(!!dS, "G7.3c-1 驻留态可被击倒（phase=dead）", dS ? "dead" : "2s 内没到 dead");
  await page.keyboard.press("KeyJ"); await sleep(250);
  const dJ = await st();
  chk(dJ.phase === "dead" && dJ.act === 1 && dJ.continueReady === true,
    "G7.3c-2 死亡中按 J 不开拍（phase 门禁；continueReady 未被吞）",
    "phase=" + dJ.phase + " act=" + dJ.act + " continueReady=" + dJ.continueReady);
  const rS = await until(async () => { const s = await st(); return s.phase === "playing" ? s : null; }, 5000);
  chk(!!rS, "G7.3c-3 复活回 playing", rS ? "playing" : "5s 内没复活");
  const bs2 = await btnState();
  chk(bs2.cont, "G7.3c-4 复活后 ▶ 仍在（continueReady 跨死亡保持）", JSON.stringify(bs2));

  /* —— 按 J 开拍 → 第一幕 —— */
  const tJ = Date.now();
  await page.keyboard.press("KeyJ"); await sleep(300);
  const a2 = await st();
  chk(a2.act === 2, "G7.4 按 J 进入第一幕（state.act=2）", "act=" + a2.act);
  chk(!!(a2.staging.act && a2.staging.act.name === "第一幕 · 对峙"),
    "G7.5 幕卡「第一幕 · 对峙」", a2.staging.act ? a2.staging.act.name : "(null)");
  chk(a2.cleared === false, "G7.6 换幕后 cleared 复位", "cleared=" + a2.cleared);
  const bs3 = await btnState();
  chk(!bs3.cont && !bs3.rest && a2.showRestart === false, "G7.4b 开拍清场：showRestart=false 且 ▶/⟳ 全收（驻留泄漏护栏）", JSON.stringify(bs3) + " showRestart=" + a2.showRestart);
  await page.screenshot({ path: path.join(SHOTS, PFX + "02-act2-card.png") });

  const plats = a2.plats || [];
  const want = [{ x: 300, y: 420, w: 64, h: 50 }, { x: 500, y: 390, w: 64, h: 80 }, { x: 780, y: 300, w: 96, h: 170 }];
  const pOk = Array.isArray(plats) && plats.length === 3 &&
    want.every((w, i) => plats[i] && plats[i].x === w.x && plats[i].y === w.y && plats[i].w === w.w && plats[i].h === w.h);
  chk(pOk, "G7.7 台箱三件 T1/T2/T3（300/420 · 500/390 · 780/300）", JSON.stringify(plats));

  /* E1-1：curtain 1.5s，红×2 出生 760/850（玩家 430 → 距 330 > 260 不镜像、与表同值） */
  await dbg("setPlayerX", [430]); /* 保真：G7.9/G7.10 的镜像数学都依赖玩家恰在 430 */
  const b1 = await waitBorn("E1-1", 4500), d1 = Date.now() - tJ;
  chk(bornOk(b1, "red,red", [760, 850]) && d1 >= 1250 && d1 <= 4000,
    "G7.8 E1-1（按 J 后 curtain 1.5s）红×2 出生 760/850（玩家430 不镜像）",
    b1 ? ("kinds=" + ksOf(b1) + " born=" + xsOf(b1) + " Δ=" + d1 + "ms") : "4.5s 内没等到");
  const live1 = await st();
  console.log("       · 活体明细（不作断言）：" + live1.enemies.map(e => e.kind + "@" + Math.round(e.x)).join(" "));
  await page.screenshot({ path: path.join(SHOTS, PFX + "03-act2-e1.png") });

  /* E1-2：清后 delay 1.5s；玩家430 距锚60 队 190<260 ⇒ 整队镜像（2*430-60=800 → 800/890/980→clamp900） */
  await dbg("setPlayerX", [430]);
  const tC1 = Date.now();
  await dbg("clearWave");
  const b2 = await waitBorn("E1-2", 4500), d2 = Date.now() - tC1;
  chk(bornOk(b2, "purple,purple,red", [800, 890, 900]) && d2 >= 1300 && d2 <= 4000,
    "G7.9 E1-2（清后 delay 1.5s）整队镜像 出生 800/890/900",
    b2 ? ("kinds=" + ksOf(b2) + " born=" + xsOf(b2) + " Δ=" + d2 + "ms") : "4.5s 内没等到");

  /* E1-3：先负控（不站不生成），再 setPlayerPos(828,300) 站 T3 触发；R2 ⇒ 出生 460/550/640 */
  await dbg("clearWave"); await sleep(900);
  const negS = await st();
  const negOk = !!(negS.lastSpawn && negS.lastSpawn.id === "E1-2") && negS.encPhase === "idle";
  chk(negOk, "G7.10a 负控：清 E1-2 后 900ms E1-3 未自动生成（轮询等 T-STAND）",
    "lastSpawn=" + (negS.lastSpawn ? negS.lastSpawn.id : "(null)") + " encPhase=" + negS.encPhase);
  const tS = Date.now();
  await dbg("setPlayerPos", [828, 300]);
  const b3 = await waitBorn("E1-3", 3000), d3 = Date.now() - tS;
  chk(bornOk(b3, "purple,purple,elite", [460, 550, 640]) && d3 <= 2500,
    "G7.10b E1-3（站 T3 触发）R2 ⇒ 不镜像 出生 460/550/640",
    b3 ? ("kinds=" + ksOf(b3) + " born=" + xsOf(b3) + " Δ=" + d3 + "ms") : "站上 T3 后 3s 内没等到");
  /* 耦合断言（数据面）：站触发区必须与 T3 台箱面逐值绑定（防「只改 T3 忘改触发」＝E1-3 永不触发；d2 §9 若调 T3 顶高，此闸先红） */
  const trip = await page.evaluate(() => { try { const e = window.__game.debug.acts[2].encounters[2]; return (e && e.trigger) ? { t: e.trigger.type, x0: e.trigger.x0, x1: e.trigger.x1, y: e.trigger.y } : null; } catch (err) { return null; } });
  const p3 = (a2.plats || [])[2];
  chk(!!trip && !!p3 && trip.t === "stand" && trip.y === p3.y, "G7.10c 站触发 y 与 T3 顶高耦合（trigger.y = T3.y）",
    (trip && p3) ? ("trigger.y=" + trip.y + " T3.y=" + p3.y) : "(缺数据：trip=" + !!trip + " T3=" + !!p3 + ")");
  chk(!!trip && !!p3 && trip.x0 === p3.x && trip.x1 === p3.x + p3.w, "G7.10d 站触发 x 区间与 T3 足印耦合（x0/x1 = T3.x/x+w）",
    (trip && p3) ? ("trigger[" + trip.x0 + "," + trip.x1 + "] T3[" + p3.x + "," + (p3.x + p3.w) + "]") : "(缺数据)");
  await page.screenshot({ path: path.join(SHOTS, PFX + "04-act2-stand.png") });

  /* a1_end：清后 actHold；下一幕未接线 ⇒ continueReady 关 */
  await dbg("clearWave");
  let endS = null; { const t0 = Date.now(); while (Date.now() - t0 < 3000) { const s = await st(); if (s.actHold) { endS = s; break; } await sleep(60); } }
  const cpId = await page.evaluate(() => { try { return window.__game.debug.cp().id; } catch (e) { return "(no debug.cp)"; } });
  chk(!!endS, "G7.11a E1-3 清后 actHold（幕终挂起）", endS ? "actHold=true" : "3s 内没等到");
  chk(cpId === "a1_end", "G7.11b cp=a1_end", "cp=" + cpId);
  chk(endS ? endS.continueReady === true : false, "G7.11c 下一幕已接线 ⇒ continueReady 开（W2 起；接线前应为关）", endS ? ("continueReady=" + endS.continueReady) : "(无)");
  const bs4 = await btnState();
  chk(endS && endS.showRestart === true && bs4.rest && bs4.cont === true, "G7.11d 幕终驻留：showRestart=true 且 ⟳/▶ 都在屏（W2 起接线）", JSON.stringify(bs4) + " showRestart=" + (endS ? endS.showRestart : "(无)"));

  /* R 重开回序章 */
  await page.keyboard.press("KeyR"); await sleep(400);
  const rs = await st();
  chk(rs.act === 1 && (rs.plats || []).length === 0, "G7.12 R 重开回序章（act=1、台箱清空）",
    "act=" + rs.act + " plats=" + JSON.stringify(rs.plats || []));

  /* —— G7.14 E1-3 软锁兜底（W4.1/A2）：R 后重放一/二场，不站 T3 静置 ⇒ 25s 强推 ——
     玩家留地面（430）：30<260 ⇒ R-rule 整队镜像 ⇒ 出生 400/490/580（区别于台上 R2 的 460/550/640）。
     红侧＝encIdleT 不存在 ⇒ 永等不生成（waitBorn 30s+ null ⇒ FAIL）。 */
  await dbg("setPlayerX", [430]);
  await until(async () => { const s = await st(); return s.enemies.length >= 2 ? s : null; }, 4500); await dbg("clearWave");
  await until(async () => { const s = await st(); return s.enemies.length >= 3 ? s : null; }, 6000); await dbg("clearWave");
  await until(async () => { const s = await st(); return s.cleared ? s : null; }, 7000);
  await until(async () => { const s = await st(); return s.continueReady ? s : null; }, 9000);
  await page.keyboard.press("KeyJ"); await sleep(300);
  const wF1 = await waitBorn("E1-1", 4500); await dbg("clearWave");
  const wF2 = await waitBorn("E1-2", 5000); await dbg("clearWave");
  await dbg("setPlayerX", [430]); /* 明确不站 T3（顶面 x∈[780,876] y=300） */
  const tI = Date.now();
  await sleep(10000); /* 静置过 8s：T3 上方提示箭头应已出现（目检截图） */
  await page.screenshot({ path: path.join(SHOTS, PFX + "05-e13-guide.png") });
  const bF = await waitBorn("E1-3", 23000); /* 25s 强推（从静置起点算；等待窗 10s→33s 覆盖） */
  const dF = Date.now() - tI;
  chk(!!wF1 && !!wF2 && bornOk(bF, "purple,purple,elite", [400, 490, 580]) && dF >= 24500 && dF <= 31000,
    "G7.14 E1-3 软锁兜底：不站 T3 静置 ⇒ 25s 强推（地面镜像 出生 400/490/580；红侧=永等不生成）",
    bF ? ("born=" + xsOf(bF) + " Δ=" + dF + "ms") : ("永等未生成（wF1=" + !!wF1 + " wF2=" + !!wF2 + " 已等 " + dF + "ms）"));
  await page.screenshot({ path: path.join(SHOTS, PFX + "06-e13-fallback.png") });

  chk(errs.length === 0, "G7.13 全程零错误", errs.length ? (errs.length + " 条，首条：" + errs[0]) : "0 条");
  console.log("---- 汇总：" + (fail === 0 ? "PASS " + pass + "/" + pass : "FAIL " + fail + "（PASS " + pass + "）") + " ----");
  console.log("GATE gate-7-acts: " + (fail === 0 ? "PASS" : "FAIL"));
  await browser.close().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
