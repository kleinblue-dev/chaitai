/* gate-8-acts2.cjs —— 幕推进/连通：第一幕 → 第二幕（v0.2 W2 接线）＋砌墙规则（d2 §3；契约见 review-v02/d8-qa/qa-plan.md §闸）
   rev6（2026-10-15，W3 接线波）：G8.16b/G8.17 版本钉死期望随接线翻面——
   W2 收官司时「下一幕（第三幕）未接线 ⇒ 二幕终 continueReady 关、▶ 不上」，W3 接线后应开。
   红侧＝shots/red-g9/（W2 收官版正本）：rev6 下恰应 2 红（G8.16b/G8.17）；正本跑应全绿。
   rev5 历史（W2 波）：G8.16b/G8.17 期望「关」；红侧＝shots/red-g8/（W1 版）恰 2 红。
   断言链（全部走真实输入/真实流程，只读 state；出生值一律断 lastSpawn.born）：
   G8.P 前置阶梯：序章速通 → J → 第一幕 E1-1/E1-2/E1-3 三场到场（gate-7 已逐值断过，这里只保「到场」）
   G8.1 第一幕终：continueReady=true 且 ▶ 上屏（第二幕已接线；W1 基线时此处应为关——见红侧）
   G8.2-G8.4 按 J → 第二幕：act=3、幕卡「第二幕 · 加码」、cleared 复位、▶/⟳ 全收（驻留泄漏护栏复检）
   G8.5 台箱两件 T1′/T2′＝210/420/64/50 · 650/390/64/80（deep-equal）
   G8.6 教学空场（数据面）：PLATFORMS 无箱足印∩[340,620]；两侧冲刺位 ≥200px（340-clamp0＝280、clamp1-620＝280）
   G8.7 act2_open 旁白已出声（narrator.log 含键）
   G8.8 A2-1：幕卡+1.2s（curtain），红×1 出生 480（玩家 800 距 320>260 不镜像）；cp=a2_teach
   G8.9 A2-2 负控：清 A2-1 后 1000ms 未自动生成（delay 2.0 未到）
   G8.10 A2-2：清后 2.0s 红×1紫×2 出生 760/850/900（玩家 300 不镜像）；cp=a2_a1
   G8.11 砌墙规则（A2-2 场；d2 §3「竞技场进行中玩家 x<190 → 0.6s 预告 → 砌墙；清场自动开；每场最多 1 次」）：
         a 预告出现（x=170 ⇒ state.wall.warn>0、未 rising）
         b 预告中途回场 x=300 ⇒ 预告撤销、未砌墙（负控；观测窗 250ms＝离场即撤销须已发生、到点前即读）
         c 再进并保持 x=170 ⇒ 0.6s 后 rising、sideRight=true（170>150）、log 含 wall_build
         d 每场最多 1 次：墙砌成后 x=130（被墙推回 166、仍<190）⇒ 900ms 无新预告、无二次 rising（墙挡住=物理断言 x≥164）
         e 清场自动开：清 A2-2 ⇒ opening→built=false；log 含 wall_open
   G8.12 A2-3：清后 2.0s 两线 60/150/760/850 出生（玩家 480 不镜像）；cp=a2_a2
   G8.13 砌墙每场重置：A2-3 中 x=100 ⇒ 预告再出现（新一场＝新一次机会）
   G8.14 保持 x=100（防击退重钉）⇒ 0.6s 后 rising、sideRight=false（100<150；false 支）
   G8.15 升墙窗口清场（边角）：rising 中清场 ⇒ pendingOpen 兜底 ⇒ 升满（built=true）后自动开（built=false）
        两段式（先升满再开完）——旧「直接等 built=false」会被还在升的 false 立刻满足＝空断言（2026-10-15 M5 证伪暴露后修）
        ＋log 含 wall_open 双保险（防旧侧序章 wall 自带 built=false 一类空满足）
   G8.16 幕终：actHold=true、cp=a2_end
   G8.16b 下一幕接线状态 ⇒ continueReady（rev6/W3 起＝开；W2 收官司期望为关——见文件头 rev6 记）
   G8.17 幕终驻留：showRestart=true、⟳ 上、▶ 上（rev6/W3 起；W2 收官司不上——见文件头 rev6 记）；log 含 act2_end（W2 新著键）
   G8.18 R 重开回序章（act=1、台箱清空、wall.warn=null）
   G8.19 全程零错误
   位置口径：同 gate-7——只断 born（首帧整形前）；活体坐标会被追踪/停步带改变，只作明细。
   砌墙相关断言用「重钉」防击退漂移：每轮轮询先 setPlayerX 再读，捕获帧（0.6s 到点）取决于最后 60-80ms 的钉位。
   红侧历史（W2 接线前）：G8.1 起全红（continueReady 关、进不了第二幕、plats/wall.warn 字段不存在）——
   先红后绿用红侧副本 shots/red-g8/（W1 收官版正本）跑本闸留档。
   rev6 红侧＝shots/red-g9/（W2 收官版正本）跑本闸：恰应 2 红（G8.16b/G8.17）。
   跑法：node tools/gate-8-acts2.cjs   （env：CHAITAI_URL / CHAITAI_SHOT_PREFIX 同其它闸） */
"use strict";
const path = require("path");
const fs = require("fs");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOTS = path.join(ROOT, "shots");
const PFX = process.env.CHAITAI_SHOT_PREFIX || "gate-8-";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const chk = (ok, tag, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + tag + " —— " + detail); ok ? pass++ : fail++; };

(async () => {
  console.log("== gate-8-acts2（幕推进/连通：第一幕→第二幕＋砌墙规则）==");
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
  const bornOf = (id) => page.evaluate((want) => { const s = window.__game.state(); const L = s.lastSpawn; return (L && L.id === want) ? L.born : null; }, id);
  const waitBorn = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const b = await bornOf(id); if (b) return b; await sleep(50); } return null; };
  const ksOf = (b) => b.map(e => e.k).join(",");
  const xsOf = (b) => b.map(e => Math.round(e.x)).join(",");
  const bornOk = (b, ks, xs) => !!b && b.length === xs.length && ksOf(b) === ks && b.every((e, i) => Math.abs(e.x - xs[i]) <= 1);
  const cpId = () => page.evaluate(() => { try { return window.__game.debug.cp().id; } catch (e) { return "(no debug.cp)"; } });
  const logHas = (s, key) => !!(s && s.narrator && s.narrator.log && s.narrator.log.indexOf(key) >= 0);
  const warnOf = (s) => (s && s.wall && s.wall.warn != null) ? s.wall.warn : null; /* 基线无字段 ⇒ null（判 FAIL 不判崩） */
  const wallOf = (s) => (s && s.wall) ? s.wall : { built: undefined, rising: undefined, sideRight: undefined };
  const btnState = () => page.evaluate(() => {
    const g = (id) => { const el = document.getElementById(id); return el ? el.classList.contains("on") : null; };
    return { cont: g("t-continue"), rest: g("t-restart") }; });

  chk(errs.length === 0, "G8.0 进入游戏零错误", errs.length ? errs[0] : "0 条");

  /* —— §前置：序章速通（与 gate-7 同法） —— */
  await dbg("setPlayerX", [430]);
  { const t0 = Date.now(); while (Date.now() - t0 < 4500) { const s = await st(); if (s.enemies.length >= 2) break; await sleep(60); } }
  await dbg("clearWave");
  { await sleep(250); const t0 = Date.now(); while (Date.now() - t0 < 4500) { const s = await st(); if (s.enemies.length >= 3) break; await sleep(60); } }
  await dbg("clearWave");
  { const t0 = Date.now(); while (Date.now() - t0 < 6000) { const s = await st(); if (s.cleared) break; await sleep(80); } }
  const cont = await until(async () => { const s = await st(); return s.continueReady ? s : null; }, 8000);
  chk(!!cont, "G8.0b 序章 outro 开闸（continueReady）", cont ? "continueReady=true" : "8s 内没等到");
  await page.keyboard.press("KeyJ"); await sleep(300);

  /* —— §前置：第一幕三场到场（逐值断言归 gate-7；这里只保「到过场」） —— */
  const p1 = await waitBorn("E1-1", 4500); await dbg("clearWave");
  const p2 = await waitBorn("E1-2", 5000); await dbg("clearWave");
  await dbg("setPlayerPos", [828, 300]);
  const p3 = await waitBorn("E1-3", 3000); await dbg("clearWave");
  const hold2 = await until(async () => { const s = await st(); return s.actHold ? s : null; }, 4000);
  chk(!!(p1 && p2 && p3 && hold2), "G8.P 前置阶梯：序章→第一幕三场到场、幕终挂起",
    "E1-1=" + !!p1 + " E1-2=" + !!p2 + " E1-3=" + !!p3 + " actHold=" + !!(hold2));

  /* —— G8.1 第一幕终：第二幕已接线 ⇒ 开闸、▶ 上屏 —— */
  const bsH = await btnState();
  chk(!!hold2 && hold2.continueReady === true && bsH.cont === true,
    "G8.1 第一幕终：continueReady=true 且 ▶ 上屏（第二幕已接线）",
    (hold2 ? ("continueReady=" + hold2.continueReady) : "(无 actHold)") + " " + JSON.stringify(bsH));

  /* —— §进第二幕 —— */
  const tJ3 = Date.now();
  await page.keyboard.press("KeyJ");
  const a3 = await until(async () => { const s = await st(); return s.act === 3 ? s : null; }, 2000);
  chk(!!a3, "G8.2 按 J 进入第二幕（state.act=3）", a3 ? "act=3" : "2s 内没进（接线前应红于此）");
  await dbg("setPlayerX", [800]); /* A2-1 出生用：|480-800|=320>260 不镜像 */
  const a3s = (await st()) || {};
  chk(!!(a3s.staging && a3s.staging.act && a3s.staging.act.name === "第二幕 · 加码"),
    "G8.3 幕卡「第二幕 · 加码」＋cleared 复位",
    (a3s.staging && a3s.staging.act ? a3s.staging.act.name : "(null)") + " cleared=" + a3s.cleared);
  const bs3 = await btnState();
  chk(!bs3.cont && !bs3.rest && a3s.showRestart === false, "G8.4 开拍清场：showRestart=false 且 ▶/⟳ 全收（泄漏护栏复检）",
    JSON.stringify(bs3) + " showRestart=" + a3s.showRestart);
  const plats = a3s.plats || [];
  const wantP = [{ x: 210, y: 420, w: 64, h: 50 }, { x: 650, y: 390, w: 64, h: 80 }];
  const pOk = Array.isArray(plats) && plats.length === 2 &&
    wantP.every((w, i) => plats[i] && plats[i].x === w.x && plats[i].y === w.y && plats[i].w === w.w && plats[i].h === w.h);
  chk(pOk, "G8.5 台箱两件 T1′/T2′（210/420 · 650/390）", JSON.stringify(plats));
  await page.screenshot({ path: path.join(SHOTS, PFX + "01-act3-card.png") });

  /* G8.6 教学空场（数据面，防「调台箱破坏教学区」） */
  const a3d = await page.evaluate(() => { try { const a = window.__game.debug.acts[3]; return { plats: (a.plats || []).map(p => ({ x: p.x, w: p.w })), clamp: a.rule.clamp }; } catch (e) { return null; } });
  const noOverlap = !!a3d && a3d.plats.length === 2 && !a3d.plats.some(p => p.x < 620 && p.x + p.w > 340);
  const sprintL = a3d ? 340 - a3d.clamp[0] : -1, sprintR = a3d ? a3d.clamp[1] - 620 : -1;
  chk(noOverlap && sprintL >= 200 && sprintR >= 200,
    "G8.6 教学空场：无箱∩[340,620]；两侧冲刺位≥200px",
    "无重叠=" + noOverlap + " 左冲位=" + sprintL + " 右冲位=" + sprintR + "（clamp=[" + (a3d ? a3d.clamp.join(",") : "-") + "]）");
  chk(logHas(a3s, "act2_open"), "G8.7 act2_open 旁白已出声（log 含键）",
    "log 尾=" + JSON.stringify((a3s.narrator && a3s.narrator.log ? a3s.narrator.log.slice(-4) : null)));

  /* —— G8.8 A2-1：curtain 1.2s，红×1 出生 480 —— */
  const b0 = await waitBorn("A2-1", 4500), d0 = Date.now() - tJ3;
  chk(bornOk(b0, "red", [480]) && d0 >= 900 && d0 <= 4000,
    "G8.8 A2-1（按 J 后 curtain 1.2s）红×1 出生 480（玩家800 不镜像）",
    b0 ? ("kinds=" + ksOf(b0) + " born=" + xsOf(b0) + " Δ=" + d0 + "ms") : "4.5s 内没等到");
  const cp0 = await cpId();
  chk(cp0 === "a2_teach", "G8.8b cp=a2_teach", "cp=" + cp0);
  await page.screenshot({ path: path.join(SHOTS, PFX + "02-a2-1.png") });

  /* —— G8.9/G8.10 A2-2：负控 + 清后 2.0s —— */
  await dbg("setPlayerX", [300]); /* 出生用：距 760/850/900 均≥260；且>430 ⇒ 敌不追（砌墙测试用同一驻位） */
  const tC1 = Date.now();
  await dbg("clearWave"); await sleep(1000);
  const negS = await st();
  const negOk = !!(negS.lastSpawn && negS.lastSpawn.id === "A2-1") && negS.encPhase === "chain";
  chk(negOk, "G8.9 A2-2 负控：清 A2-1 后 1000ms 未自动生成（delay 2.0）",
    "lastSpawn=" + (negS.lastSpawn ? negS.lastSpawn.id : "(null)") + " encPhase=" + negS.encPhase);
  const b1 = await waitBorn("A2-2", 5000), d1 = Date.now() - tC1;
  chk(bornOk(b1, "red,purple,purple", [760, 850, 900]) && d1 >= 1700 && d1 <= 5000,
    "G8.10 A2-2（清后 2.0s）红×1紫×2 出生 760/850/900（玩家300 不镜像）",
    b1 ? ("kinds=" + ksOf(b1) + " born=" + xsOf(b1) + " Δ=" + d1 + "ms") : "5s 内没等到");
  const cp1 = await cpId();
  chk(cp1 === "a2_a1", "G8.10b cp=a2_a1", "cp=" + cp1);

  /* —— §G8.11 砌墙规则（A2-2 场） —— */
  const pin170 = async () => { await dbg("setPlayerX", [170]); };
  await pin170();
  const wv1 = await until(async () => { const s = await st(); const w = warnOf(s); return (w != null && w > 0) ? { w, wall: wallOf(s) } : null; }, 1200);
  chk(!!wv1 && wv1.wall.rising !== true, "G8.11a 预告出现（x<190 ⇒ warn>0、未 rising）",
    wv1 ? ("warn=" + wv1.w + " rising=" + wv1.wall.rising) : "1.2s 内没有 warn（接线前应红于此）");
  await page.screenshot({ path: path.join(SHOTS, PFX + "03-wall-warn.png") });
  await dbg("setPlayerX", [300]);
  await sleep(250); /* 观测窗：晚于数帧（撤销须已发生）、早于 0.6s 到点（区分「离场即撤销」vs「到点才判」） */
  const wv2 = await st();
  const wv2ok = warnOf(wv2) === null && wallOf(wv2).rising !== true;
  chk(!!wv2ok, "G8.11b 预告中途回场 x=300 ⇒ 预告撤销、未砌墙（负控；离场即撤销、不等 0.6s 到点）",
    "warn=" + warnOf(wv2) + " rising=" + wallOf(wv2).rising + " built=" + wallOf(wv2).built);
  /* 再进并保持 170（每轮先重钉再读，防漂移污染捕获帧） */
  const tRise = Date.now();
  const risen = await until(async () => { await pin170(); const s = await st(); const w = wallOf(s); return w.rising === true ? { t: Date.now() - tRise, wall: w } : null; }, 1800);
  chk(!!(risen && risen.wall.sideRight === true), "G8.11c 起墙：0.6s 后 rising、sideRight=true（170>150）",
    risen ? ("Δ=" + risen.t + "ms sideRight=" + risen.wall.sideRight) : "1.8s 内没到 rising");
  await page.screenshot({ path: path.join(SHOTS, PFX + "04-wall-rising.png") });
  const built = await until(async () => { const s = await st(); return wallOf(s).built === true ? s : null; }, 2500);
  chk(!!built, "G8.11c2 升满 300px 后 built=true", built ? "built=true" : "2.5s 内没砌成");
  const logB = await st();
  chk(logHas(logB, "wall_build"), "G8.11c3 log 含 wall_build", JSON.stringify(logB.narrator.log.slice(-3)));
  /* d 每场最多 1 次：130 会被墙推回 166（仍<190）⇒ 若无门禁会再次预告 */
  await dbg("setPlayerX", [130]); await sleep(900);
  const dS = await st();
  const dOk = warnOf(dS) === null && wallOf(dS).rising !== true && wallOf(dS).built === true && dS.player.x >= 164;
  chk(dOk, "G8.11d 每场最多 1 次：起墙后再进无新预告、无二次 rising（且墙把玩家推回 x≥164）",
    "warn=" + warnOf(dS) + " rising=" + wallOf(dS).rising + " built=" + wallOf(dS).built + " x=" + dS.player.x);
  /* e 清场自动开 */
  const tClear2 = Date.now(); /* t0 锚：A2-3 链延迟从清场起算（拆墙动画 ~0.75s 在等待里被吃掉，不顶后 t0） */
  await dbg("clearWave");
  const opened = await until(async () => { const s = await st(); return wallOf(s).built === false ? s : null; }, 3000);
  chk(!!(opened && logHas(opened, "wall_open")), "G8.11e 清场自动开：opening→built=false；log 含 wall_open",
    opened ? ("built=false wall_open✓") : "3s 内墙没开");
  await page.screenshot({ path: path.join(SHOTS, PFX + "05-wall-open.png") });

  /* —— G8.12 A2-3：清后 2.0s 两线 —— */
  await dbg("setPlayerX", [480]);
  const b2 = await waitBorn("A2-3", 5000), d2 = Date.now() - tClear2;
  chk(bornOk(b2, "red,red,purple,purple", [60, 150, 760, 850]) && d2 >= 1700 && d2 <= 5000,
    "G8.12 A2-3（清后 2.0s）两线 左60/150＋右760/850（玩家480 不镜像）",
    b2 ? ("kinds=" + ksOf(b2) + " born=" + xsOf(b2) + " Δ=" + d2 + "ms") : "5s 内没等到");
  const cp2 = await cpId();
  chk(cp2 === "a2_a2", "G8.12b cp=a2_a2", "cp=" + cp2);

  /* —— G8.13/G8.14 砌墙每场重置 ＋ sideRight=false 支（x=100；左近敌会打人，每轮重钉防击退） —— */
  const pin100 = async () => { await dbg("setPlayerX", [100]); };
  await pin100();
  const wv3 = await until(async () => { const s = await st(); const w = warnOf(s); return (w != null && w > 0) ? w : null; }, 1500);
  chk(wv3 != null, "G8.13 砌墙每场重置：A2-3 中新一场 ⇒ 预告再出现", wv3 != null ? ("warn=" + wv3) : "1.5s 内没有 warn");
  const tR2 = Date.now();
  const risen2 = await until(async () => { await pin100(); const s = await st(); const w = wallOf(s); return w.rising === true ? { t: Date.now() - tR2, wall: w, x: s.player.x } : null; }, 1800);
  chk(!!(risen2 && risen2.wall.sideRight === false), "G8.14 起墙 false 支：rising、sideRight=false（100<150）",
    risen2 ? ("Δ=" + risen2.t + "ms sideRight=" + risen2.wall.sideRight + " x=" + risen2.x) : "1.8s 内没到 rising");

  /* —— G8.15 升墙窗口清场（边角） ＋ G8.16/G8.17 幕终 —— */
  await dbg("clearWave"); /* 故意在 rising 中清：墙还 built=false ⇒ pendingOpen 兜底 */
  const endS = await until(async () => { const s = await st(); return s.actHold ? s : null; }, 3000);
  /* 两段式（2026-10-15 修）：旧写法直接等 built=false，会被「还在升」的 built=false 立刻满足 ⇒ 空断言
     （falsify-g8 M5 删兜底后竟全绿，把空断言暴露出来）。必须先见升满（built=true），再见开完（built=false）。 */
  const wallFull = await until(async () => { const s = await st(); return wallOf(s).built === true ? s : null; }, 3000);
  chk(!!wallFull, "G8.15a 升墙窗口清场：升满被看到一次（built=true）",
    wallFull ? "built=true" : "3s 内没看到升满（墙没在升/已提前开）");
  /* 双保险：①挂在 wallFull 之后——旧侧（无墙系统）序章 wall 自带 built=false，会被单等 built=false 立刻满足；
     ②条件再加 log 含 wall_open——防「built 被清但没走过 openWall」类空满足。 */
  const wallGone = wallFull ? await until(async () => { const s = await st(); return (wallOf(s).built === false && logHas(s, "wall_open")) ? s : null; }, 4000) : null;
  chk(!!wallGone, "G8.15 升墙窗口清场：pendingOpen 兜底 ⇒ 升满后自动开（built=false ＋ log 含 wall_open，≤4s）",
    wallGone ? "built=false wall_open✓（升满后开完）" : (wallFull ? ("4s 内墙没开完（升满未开=兜底失效）wall=" + JSON.stringify(wallOf(await st()))) : "未升满 ⇒ 本项判不出（红）"));
  const cpE = await cpId();
  chk(!!endS && endS.actHold === true && cpE === "a2_end", "G8.16 幕终：actHold=true、cp=a2_end",
    (endS ? "actHold=true" : "(无)") + " cp=" + cpE);
  chk(endS ? endS.continueReady === true : false, "G8.16b 下一幕已接线（W3）⇒ continueReady 开",
    endS ? ("continueReady=" + endS.continueReady) : "(无)");
  const bsE = await btnState();
  const endLog = endS && endS.narrator && endS.narrator.log;
  chk(endS && endS.showRestart === true && bsE.rest === true && bsE.cont === true && logHas(endS, "act2_end"),
    "G8.17 幕终驻留：showRestart=true、⟳ 上、▶ 上（W3 翻面）；log 含 act2_end",
    JSON.stringify(bsE) + " showRestart=" + (endS ? endS.showRestart : "(无)") + " log尾=" + JSON.stringify(endLog ? endLog.slice(-3) : null));
  await page.screenshot({ path: path.join(SHOTS, PFX + "06-actend.png") });

  /* —— G8.18 R 重开回序章 —— */
  await page.keyboard.press("KeyR"); await sleep(400);
  const rs = await st();
  chk(rs.act === 1 && (rs.plats || []).length === 0 && warnOf(rs) === null, "G8.18 R 重开回序章（act=1、台箱清空、wall.warn=null）",
    "act=" + rs.act + " plats=" + JSON.stringify(rs.plats || []) + " warn=" + warnOf(rs));

  chk(errs.length === 0, "G8.19 全程零错误", errs.length ? (errs.length + " 条，首条：" + errs[0]) : "0 条");
  console.log("---- 汇总：" + (fail === 0 ? "PASS " + pass + "/" + pass : "FAIL " + fail + "（PASS " + pass + "）") + " ----");
  console.log("GATE gate-8-acts2: " + (fail === 0 ? "PASS" : "FAIL"));
  await browser.close().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
