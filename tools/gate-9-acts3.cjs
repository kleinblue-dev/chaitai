/* gate-9-acts3.cjs —— 幕推进/连通：第二幕 → 第三幕（v0.2 W3 接线）＋机关循环＋可拆墙（d2 §3/§4；契约见 review-v02/d8-qa/qa-plan.md §闸）
   断言链（全部走真实输入/真实流程，只读 state；出生值一律断 lastSpawn.born）：
   G9.P 前置阶梯：序章速通 → 第一幕三场 → 第二幕速通（A2-1/2/3 只保「到场」；砌墙逐值归 gate-8）
   G9.1 第一幕终：continueReady=true 且 ▶ 上屏（W2 已翻面，复检）
   G9.2 第二幕终：按 J → 第三幕（act=4、幕卡「第三幕 · 翻脸」、cleared 复位、▶/⟳ 全收）——W3 翻面点（红侧：第三幕 planned ⇒ 进不去）
   G9.3 台箱 T1′/T2′＝210/420/64/50 · 650/390/64/80（deep-equal；T3 不进场——幕终搭台才升）
   G9.4 act3_open 旁白出声（W1 期已并入的键）
   G9.5 灯带常驻：traps 有 lamp、T===6、x 与公式 480+420·sin(2πt/6) 一致（±0.05）
   G9.6-G9.7 A3-1（curtain 1.2）：紫紫红 760/850/900（玩家 480 不镜像）；cp=a3_1
   G9.8 负控：第三幕无砌墙规则——A3-1 战斗中钉 x=170 静置 ⇒ 无预告/未 rising/未 built
   G9.9 A3-2 延迟负控：清 A3-1 后 1000ms 未自动生成（delay 1.5）
   G9.10 A3-2：清后 1.5s 红红紫紫 60/150/760/850（玩家 490 不镜像）；cp=a3_2
   G9.11 同拍落物：一波在灯带周期过界时放（检测刻 lamp.t mod 6 ≤1.2）；波数≥1
   G9.11b 波形：3 点 300/480/660、错峰 lead 0/0.9/1.8（±0.06）
   G9.12 第二波：≤7.5s 后波数=2，且复现 3 点；此后不再有（幕终前复检 =2）
   G9.13 A3-3：清后 1.5s 红紫紫 60/150/240（玩家 510 不镜像）；cp=a3_3
   G9.14 可拆墙：rising 被看到（两段式）→ built、sideRight=true（510>150）、hp=32、breakable=true
   G9.15 「墙倒前清场链不开墙」：清 A3-3 敌人后 900ms ⇒ 未推进（!actHold、encPhase=fight）、墙仍 built、hp=32
   G9.16 真键三连拆墙：安全窗内钉 180、A 朝左、J×3（固定 130ms 间距靠 atkBuf 接力）、页内 16ms 轨迹采 hp＋J 键 dn/up ⇒ deltas=[8,9,15]
     （GREEN3 轨迹抓出真 bug：hitstop 冻结窗内按下的 J 被 step 末尾无条件清 just 吞掉 ⇒ game.js 修「just 只在非冻结步清」；本闸按真节奏复验）
   G9.16b 破墙落地：breaking 被看到 → built=false；cpLog 含 a3_break；log 含 wall_break；全程 log 无 wall_open（破≠开）
   G9.17 幕终：actHold、cp=a3_end、log 含 act3_end；continueReady=true（W4 翻面：终幕已接线 ⇒ ▶ 可开）
   G9.17b 驻留：showRestart=true、⟳ 上、▶ 也上（可续拍终幕）
   G9.18 幕终演出「搭台」：staging.t3build 出现 → done、plats 追加 T3{780,300,96,170}、灯带已收（traps 无 lamp）
   G9.19 T3 可站：从上方落下停在 y=300
   G9.20 R 重开：act=1、台箱空、traps 空、staging.t3build 清
   G9.21 全程零错误
   位置口径：同 gate-8——只断 born（首帧整形前）。
   灯带安全窗（G9.16 拆墙期）：灯束 x=480+420·sin(2πt/6)，伤带 |x−166|<54 落在 t mod 6∈[3.56,3.88]∪[5.12,5.43]；
   故拆墙测试等 t mod 6∈[0.15,1.6] 起跑 ⇒ 至下一个危险窗 ≥1.9s 预算，避开「连打被灯打飞」的取样污染。
   红侧（W3 接线前）：G9.2 起全红（第三幕 planned ⇒ 按 J 不进、plats/lamp/hp 字段不存在）——
   先红后绿用红侧副本 shots/red-g9/（W2 收官版正本）跑本闸留档。
   跑法：node tools/gate-9-acts3.cjs   （env：CHAITAI_URL / CHAITAI_SHOT_PREFIX 同其它闸） */
"use strict";
const path = require("path");
const fs = require("fs");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOTS = path.join(ROOT, "shots");
const PFX = process.env.CHAITAI_SHOT_PREFIX || "gate-9-";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const chk = (ok, tag, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + tag + " —— " + detail); ok ? pass++ : fail++; };

(async () => {
  console.log("== gate-9-acts3（幕推进/连通：第二幕→第三幕＋机关循环＋可拆墙）==");
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
  const cpLogIds = () => page.evaluate(() => { try { return window.__game.debug.cp().log.map(x => x.id); } catch (e) { return []; } });
  const logHas = (s, key) => !!(s && s.narrator && s.narrator.log && s.narrator.log.indexOf(key) >= 0);
  const warnOf = (s) => (s && s.wall && s.wall.warn != null) ? s.wall.warn : null;
  const wallOf = (s) => (s && s.wall) ? s.wall : { built: undefined, rising: undefined, sideRight: undefined, hp: undefined, breakable: undefined, breaking: undefined };
  const lampOf = (s) => (s && s.traps) ? (s.traps.find(t => t.type === "lamp") || null) : null;
  const dropsOf = (s) => (s && s.traps) ? s.traps.filter(t => t.type === "drop") : [];
  const btnState = () => page.evaluate(() => {
    const g = (id) => { const el = document.getElementById(id); return el ? el.classList.contains("on") : null; };
    return { cont: g("t-continue"), rest: g("t-restart") }; });
  /* 风筝走位：候选取离最近活敌最远者（落物等待期保命用；不参与任何被断言的位置） */
  const kite = async () => { const s = await st(); const alive = (s.enemies || []).filter(e => e.hp > 0);
    if (!alive.length) return s;
    let best = 490, bd = -1;
    for (const c of [60, 320, 490, 660, 900]) { let m = 1e9;
      for (const e of alive) m = Math.min(m, Math.abs(e.x - c));
      if (m > bd) { bd = m; best = c; } }
    await dbg("setPlayerX", [best]); return s; };

  chk(errs.length === 0, "G9.0 进入游戏零错误", errs.length ? errs[0] : "0 条");

  /* —— §前置：序章速通 → J → 第一幕三场（同 gate-8 法） —— */
  await dbg("setPlayerX", [430]);
  { const t0 = Date.now(); while (Date.now() - t0 < 4500) { const s = await st(); if (s.enemies.length >= 2) break; await sleep(60); } }
  await dbg("clearWave");
  { await sleep(250); const t0 = Date.now(); while (Date.now() - t0 < 4500) { const s = await st(); if (s.enemies.length >= 3) break; await sleep(60); } }
  await dbg("clearWave");
  { const t0 = Date.now(); while (Date.now() - t0 < 6000) { const s = await st(); if (s.cleared) break; await sleep(80); } }
  const cont0 = await until(async () => { const s = await st(); return s.continueReady ? s : null; }, 8000);
  await page.keyboard.press("KeyJ"); await sleep(300);
  const p1 = await waitBorn("E1-1", 4500); await dbg("clearWave");
  const p2 = await waitBorn("E1-2", 5000); await dbg("clearWave");
  await dbg("setPlayerPos", [828, 300]);
  const p3 = await waitBorn("E1-3", 3000); await dbg("clearWave");
  const hold1 = await until(async () => { const s = await st(); return s.actHold ? s : null; }, 4000);
  chk(!!(cont0 && p1 && p2 && p3 && hold1), "G9.P 前置：序章三场→第一幕三场到场、幕终挂起",
    "序章开闸=" + !!cont0 + " E1-1=" + !!p1 + " E1-2=" + !!p2 + " E1-3=" + !!p3 + " actHold=" + !!(hold1));

  /* —— G9.1 第一幕终（W2 已翻面，复检） —— */
  const bs1 = await btnState();
  chk(!!hold1 && hold1.continueReady === true && bs1.cont === true,
    "G9.1 第一幕终：continueReady=true 且 ▶ 上屏", (hold1 ? "continueReady=" + hold1.continueReady : "(无)") + " " + JSON.stringify(bs1));

  /* —— §进第二幕并速通三场（砌墙逐值归 gate-8；这里只保到场） —— */
  await page.keyboard.press("KeyJ");
  const a3 = await until(async () => { const s = await st(); return s.act === 3 ? s : null; }, 2500);
  await dbg("setPlayerX", [800]);
  const q1 = await waitBorn("A2-1", 4500); await dbg("clearWave");
  await dbg("setPlayerX", [300]);
  const q2 = await waitBorn("A2-2", 5000); await dbg("clearWave");
  await dbg("setPlayerX", [490]);
  const q3 = await waitBorn("A2-3", 5000); await dbg("clearWave");
  const hold2 = await until(async () => { const s = await st(); return s.actHold ? s : null; }, 4000);
  chk(!!(a3 && q1 && q2 && q3 && hold2), "G9.Q 前置：第二幕三场到场、幕终挂起",
    "act3=" + !!a3 + " A2-1=" + !!q1 + " A2-2=" + !!q2 + " A2-3=" + !!q3 + " actHold=" + !!(hold2));

  /* —— G9.2 第二幕终 → 第三幕（W3 翻面点） —— */
  const bsH = await btnState();
  chk(!!hold2 && hold2.continueReady === true && bsH.cont === true,
    "G9.2 第二幕终：continueReady=true 且 ▶ 上屏（第三幕已接线）",
    (hold2 ? "continueReady=" + hold2.continueReady : "(无)") + " " + JSON.stringify(bsH));
  const tJ4 = Date.now();
  await page.keyboard.press("KeyJ");
  const a4 = await until(async () => { const s = await st(); return s.act === 4 ? s : null; }, 2000);
  const bs4 = await btnState(); const a4s = a4 || (await st()) || {};
  chk(!!a4 && a4s.staging && a4s.staging.act && a4s.staging.act.name === "第三幕 · 翻脸" && a4s.cleared === false
      && a4s.showRestart === false && !bs4.cont && !bs4.rest,
    "G9.3 按 J 进入第三幕：幕卡「第三幕 · 翻脸」＋cleared 复位＋▶/⟳ 全收",
    (a4 ? ("act=4 卡=" + (a4s.staging && a4s.staging.act ? a4s.staging.act.name : "(null)")) : "2s 内没进（接线前应红于此）") +
    " cleared=" + a4s.cleared + " " + JSON.stringify(bs4));
  const plats4 = a4s.plats || [];
  const wantP4 = [{ x: 210, y: 420, w: 64, h: 50 }, { x: 650, y: 390, w: 64, h: 80 }];
  const p4Ok = Array.isArray(plats4) && plats4.length === 2 && a4s.act === 4 &&
    wantP4.every((w, i) => plats4[i] && plats4[i].x === w.x && plats4[i].y === w.y && plats4[i].w === w.w && plats4[i].h === w.h); /* a4s.act===4 合取：防红侧停在第二幕终时台箱同值真空满足（2026-10-15 红侧审计出） */
  chk(p4Ok, "G9.4 台箱两件 T1′/T2′（210/420 · 650/390；T3 不进场）", JSON.stringify(plats4));
  chk(logHas(a4s, "act3_open"), "G9.5 act3_open 旁白已出声", "log 尾=" + JSON.stringify((a4s.narrator && a4s.narrator.log ? a4s.narrator.log.slice(-4) : null)));
  await page.screenshot({ path: path.join(SHOTS, PFX + "01-act4-card.png") });

  /* —— G9.6 灯带常驻（T/公式） —— */
  await dbg("setPlayerPos", [480]); /* W3 实测修：钉位必须清速度——进场灯带（t=0 在 x=480）会击退玩家 vx=±260，setPlayerX 不清 vx ⇒ 玩家漂到 520 触发整队镜像（G9.7 首跑红因） */
  const lamp1 = lampOf(await st());
  const fxOk = !!lamp1 && Math.abs(lamp1.x - (480 + 420 * Math.sin(2 * Math.PI * lamp1.t / 6))) <= 0.05;
  chk(!!lamp1 && lamp1.T === 6 && fxOk, "G9.6 灯带常驻：lamp 在场、T=6、x=480+420·sin(2πt/6)",
    lamp1 ? ("T=" + lamp1.T + " t=" + lamp1.t + " x=" + lamp1.x + " 公式一致=" + fxOk) : "没有 lamp（接线前应红于此）");

  /* —— G9.7 A3-1（curtain 1.2；玩家 480：距 760 ≥260 不镜像） —— */
  const b0 = await waitBorn("A3-1", 5000), d0 = Date.now() - tJ4;
  const pAt = await st(), plA = pAt.player || {}, dzA = (pAt.narrator && pAt.narrator.counters) ? pAt.narrator.counters.deaths : "?";
  chk(bornOk(b0, "purple,purple,red", [760, 850, 900]) && d0 >= 900 && d0 <= 5000,
    "G9.7 A3-1（按 J 后 curtain 1.2s）紫紫红 出生 760/850/900（玩家480 不镜像）",
    (b0 ? ("kinds=" + ksOf(b0) + " born=" + xsOf(b0) + " Δ=" + d0 + "ms") : "5s 内没等到") +
    " px=" + plA.x + " vx=" + plA.vx + " hp=" + plA.hp + " deaths=" + dzA);
  const cp0 = await cpId();
  chk(cp0 === "a3_1", "G9.7b cp=a3_1", "cp=" + cp0);
  await page.screenshot({ path: path.join(SHOTS, PFX + "02-a3-1-lamp.png") });

  /* —— G9.8 负控：第三幕无砌墙规则（钉 x=170 静置 ⇒ 无预告/未 rising/未 built） —— */
  await dbg("setPlayerPos", [170]); await sleep(1300);
  const negW = await st();
  chk(warnOf(negW) === null && wallOf(negW).rising !== true && wallOf(negW).built !== true && negW.encPhase === "fight",
    "G9.8 负控：第三幕无砌墙规则——战斗中贴左墙静置无预告、无墙",
    "warn=" + warnOf(negW) + " rising=" + wallOf(negW).rising + " built=" + wallOf(negW).built + " encPhase=" + negW.encPhase);

  /* —— G9.9/G9.10 A3-2：延迟负控＋出生（玩家 490） —— */
  await dbg("setPlayerPos", [490]);
  const tC2 = Date.now();
  await dbg("clearWave"); await sleep(1000);
  const negS = await st();
  chk(!!(negS.lastSpawn && negS.lastSpawn.id === "A3-1") && negS.encPhase === "chain",
    "G9.9 A3-2 负控：清 A3-1 后 1000ms 未自动生成（delay 1.5）",
    "lastSpawn=" + (negS.lastSpawn ? negS.lastSpawn.id : "(null)") + " encPhase=" + negS.encPhase);
  const b1 = await waitBorn("A3-2", 5500), d1 = Date.now() - tC2;
  chk(bornOk(b1, "red,red,purple,purple", [60, 150, 760, 850]) && d1 >= 1200 && d1 <= 5500,
    "G9.10 A3-2（清后 1.5s）红红紫紫 出生 60/150/760/850（玩家490 不镜像）",
    b1 ? ("kinds=" + ksOf(b1) + " born=" + xsOf(b1) + " Δ=" + d1 + "ms") : "5.5s 内没等到");
  const cp1 = await cpId();
  chk(cp1 === "a3_2", "G9.10b cp=a3_2", "cp=" + cp1);

  /* —— G9.11/G9.12 同拍落物（等待期风筝走位保命；波1=同拍+波形；波2=复现+封顶） —— */
  let wave1 = null;
  { const t0 = Date.now(); while (Date.now() - t0 < 7000) { const s = await kite();
    if ((s.dropWaves | 0) >= 1 && dropsOf(s).length >= 3) { wave1 = s; break; } await sleep(80); } }
  const lamp1b = wave1 ? lampOf(wave1) : null;
  const beatOk = !!(lamp1b && (lamp1b.t % 6) <= 1.2);
  chk(!!(wave1 && beatOk), "G9.11 落物波1 同拍：灯带周期过界放波（检测刻 lamp.t mod 6 ≤1.2）",
    wave1 ? ("dropWaves=" + (wave1.dropWaves | 0) + " lamp.t mod 6=" + (lamp1b ? (lamp1b.t % 6).toFixed(2) : "(无灯)")) : "7s 内没有落物波");
  const wDrops = wave1 ? dropsOf(wave1) : [];
  const ptsOk = [300, 480, 660].every((x, i) => wDrops.some(d => Math.abs(d.x - x) <= 1.5 && Math.abs(d.lead - i * 0.9) <= 0.06));
  chk(ptsOk, "G9.11b 波形：3 点 300/480/660、错峰 lead 0/0.9/1.8（±0.06）",
    wDrops.map(d => d.x + "@" + d.lead).join(" "));
  await page.screenshot({ path: path.join(SHOTS, PFX + "03-a3-2-drops.png") });
  let wave2 = null;
  { const t0 = Date.now(); while (Date.now() - t0 < 7500) { const s = await kite();
    if ((s.dropWaves | 0) === 2) { const ds = dropsOf(s);
      if ([300, 480, 660].every(x => ds.some(d => Math.abs(d.x - x) <= 1.5))) { wave2 = s; break; } } await sleep(80); } }
  chk(!!wave2, "G9.12 落物波2：≤7.5s 后波数=2 且复现 3 点（此后封顶，幕终前复检）",
    wave2 ? ("dropWaves=" + (wave2.dropWaves | 0) + " drops=" + dropsOf(wave2).map(d => d.x).join(",")) : "7.5s 内没有第二波");

  /* —— G9.13 A3-3（玩家 510：距 240 ≥260 不镜像） —— */
  await dbg("setPlayerPos", [510]);
  const tC3 = Date.now();
  await dbg("clearWave");
  const b2 = await waitBorn("A3-3", 5500), d2 = Date.now() - tC3;
  chk(bornOk(b2, "red,purple,purple", [60, 150, 240]) && d2 >= 1200 && d2 <= 5500,
    "G9.13 A3-3（清后 1.5s）红紫紫 出生 60/150/240（玩家510 不镜像）",
    b2 ? ("kinds=" + ksOf(b2) + " born=" + xsOf(b2) + " Δ=" + d2 + "ms") : "5.5s 内没等到");
  const cp2 = await cpId();
  chk(cp2 === "a3_3", "G9.13b cp=a3_3", "cp=" + cp2);

  /* —— G9.14 可拆墙：rising（两段式）→ built＝sideRight/hp32/breakable —— */
  const risingSeen = await until(async () => { const s = await st(); const w = wallOf(s); return (w.rising === true || w.built === true) ? w : null; }, 2000);
  const builtSeen = await until(async () => { const s = await st(); const w = wallOf(s); return w.built === true ? w : null; }, 2500);
  chk(!!(risingSeen && builtSeen && builtSeen.sideRight === true && builtSeen.hp === 32 && builtSeen.breakable === true),
    "G9.14 可拆墙：rising 见 → built、sideRight=true（510>150）、hp=32、breakable=true",
    (builtSeen ? ("built=true sideRight=" + builtSeen.sideRight + " hp=" + builtSeen.hp + " breakable=" + builtSeen.breakable) : ("未建成 risingSeen=" + !!risingSeen)));
  await page.screenshot({ path: path.join(SHOTS, PFX + "04-a3-3-wall.png") });

  /* —— G9.15 墙倒前清场链不开墙 —— */
  await dbg("clearWave"); await sleep(900);
  const holdW = await st();
  chk(holdW.actHold !== true && holdW.encPhase === "fight" && wallOf(holdW).built === true && wallOf(holdW).hp === 32,
    "G9.15 「墙倒前清场链不开墙」：清场后 900ms 未推进、墙仍立（built、hp32）",
    "actHold=" + holdW.actHold + " encPhase=" + holdW.encPhase + " built=" + wallOf(holdW).built + " hp=" + wallOf(holdW).hp);

  /* —— G9.16 真键三连拆墙（安全窗内；等待期上 T1′ 顶全免灯带；三连＝固定 130ms 间距靠 atkBuf 接力，不在按击间插 eval） —— */
  await dbg("setPlayerPos", [240, 420]); /* 等待期中立位＝T1′ 顶（y=420≤420 ⇒ 灯带全免），防被扫到击退（G9.16 首跑红因排查） */
  const safeWin = await until(async () => { const s = await st(); const L = lampOf(s);
    if (!L) return null; const m = L.t % 6; return (m >= 0.15 && m <= 1.6) ? { m: m } : null; }, 8000);
  await dbg("setPlayerPos", [180]); /* 拆墙位 180：step1/2 命中带宽余（|150−127|=23）；step3 前滑后 |150−≈99|≈51<60 */
  await page.keyboard.down("KeyA"); await sleep(90); await page.keyboard.up("KeyA"); /* 面向左 */
  /* 页内 hp 追踪（16ms 采样，只读 state().wall）：三连台阶仅 ~0.15s，墙外轮询（eval 往返百毫秒级）会漏档
     —— GREEN 首二跑 [8,8] 的教训：检测回环 ~500ms > rec 窗 0.295s ⇒ 每按都成新起手 step1 */
  await page.evaluate(() => { const W = window.__game; window.__g9tr = { arr: [], iv: 0, t0: performance.now() };
    window.__g9tr.kd = function (e) { if (e.code === "KeyJ") window.__g9tr.arr.push({ ev: (e.type === "keydown" ? "dn" : "up"), t: Math.round(performance.now() - window.__g9tr.t0) }); };
    window.addEventListener("keydown", window.__g9tr.kd, true); window.addEventListener("keyup", window.__g9tr.kd, true);
    window.__g9tr.iv = setInterval(() => { try { const w = W.state().wall, a = window.__g9tr.arr; var last = null;
      for (var i = a.length - 1; i >= 0; i--) if (!a[i].ev) { last = a[i]; break; }
      if (!last || last.hp !== w.hp || last.br !== w.breaking) a.push({ hp: w.hp, br: w.breaking, t: Math.round(performance.now() - window.__g9tr.t0) });
    } catch (e) {} }, 16); });
  await page.keyboard.press("KeyJ"); await sleep(130); /* 固定 130ms 间距：后两击落在前招 wind/act 期 ⇒ atkBuf(0.14s) 在 rec 窗接力出 9/15 */
  await page.keyboard.press("KeyJ"); await sleep(130);
  await page.keyboard.press("KeyJ");
  await until(async () => { const r = await page.evaluate(() => (window.__g9tr ? window.__g9tr.arr : [])); const h = r.filter(x => !x.ev);
    return (h.length && h[h.length - 1].hp <= 0) ? r : null; }, 4500);
  const trArr = await page.evaluate(() => { if (window.__g9tr && window.__g9tr.iv) { clearInterval(window.__g9tr.iv); window.__g9tr.iv = 0; }
    if (window.__g9tr && window.__g9tr.kd) { window.removeEventListener("keydown", window.__g9tr.kd, true); window.removeEventListener("keyup", window.__g9tr.kd, true); }
    return window.__g9tr ? window.__g9tr.arr : []; });
  const hpSeq = trArr.filter(x => !x.ev);
  const deltas = []; for (let i = 1; i < hpSeq.length; i++) { const d = hpSeq[i - 1].hp - hpSeq[i].hp; if (d !== 0) deltas.push(d); }
  const trace = trArr.map(x => x.ev ? (x.ev + "@" + x.t) : (x.hp + "@" + x.t + (x.br ? "br" : ""))).join(" ");
  const sF = await st(), pF = sF.player || {}, wF = wallOf(sF), LF = lampOf(sF), nF = (sF.narrator && sF.narrator.counters) || {};
  const diag = "｜末态:php=" + pF.hp + " px=" + pF.x + " py=" + pF.y + " grounded=" + pF.grounded + " face=" + pF.facing +
    " attacking=" + pF.attacking + " alive=" + ((sF.enemies || []).filter(e => e.hp > 0).length) + " deaths=" + nF.deaths +
    " wallHp=" + wF.hp + " breaking=" + wF.breaking + " m=" + (LF ? (LF.t % 6).toFixed(2) : "-");
  const hitOk = deltas.length === 3 && deltas[0] === 8 && deltas[1] === 9 && deltas[2] === 15;
  chk(hitOk, "G9.16 真键三连拆墙：hp 32→24→15→0（deltas=[8,9,15]）",
    "deltas=[" + deltas.join(",") + "] 轨迹[" + trace + "] 安全窗m=" + (safeWin ? safeWin.m.toFixed(2) : "(没等到安全窗，照跑)") + diag);
  const brokeSeen = await until(async () => { const w = wallOf(await st()); return w.breaking === true ? w : null; }, 900);
  const goneSeen = await until(async () => { const w = wallOf(await st()); return w.built === false ? w : null; }, 1800);
  const cpL = await cpLogIds();
  const endLogS = await st();
  chk(!!(brokeSeen && goneSeen) && cpL.indexOf("a3_break") >= 0 && logHas(endLogS, "wall_break") && !logHas(endLogS, "wall_open"),
    "G9.16b 破墙落地：breaking 见 → built=false；cpLog 含 a3_break；log 含 wall_break；全程无 wall_open（破≠开）",
    "breaking见=" + !!brokeSeen + " built=false=" + !!goneSeen + " cpLog尾=" + JSON.stringify(cpL.slice(-4)) +
    " wall_break=" + logHas(endLogS, "wall_break") + " wall_open=" + logHas(endLogS, "wall_open"));
  await page.screenshot({ path: path.join(SHOTS, PFX + "05-wall-broken.png") });

  /* —— G9.17 幕终（破墙后链自动推进） —— */
  const endS = await until(async () => { const s = await st(); return s.actHold ? s : null; }, 3000);
  const cpE = await cpId();
  chk(!!endS && cpE === "a3_end" && logHas(endS, "act3_end") && endS.continueReady === true,
    "G9.17 幕终：actHold、cp=a3_end、log 含 act3_end；终幕已接线（W4）⇒ continueReady=true",
    (endS ? "actHold=true cp=" + cpE + " act3_end=" + logHas(endS, "act3_end") + " continueReady=" + endS.continueReady : "3s 内没到幕终"));
  const bsE = await btnState();
  chk(!!endS && endS.act === 4 && endS.showRestart === true && bsE.rest === true && bsE.cont === true,
    "G9.17b 幕终驻留：showRestart=true、⟳/▶ 均上（W4 翻面）", JSON.stringify(bsE) + " showRestart=" + (endS ? endS.showRestart : "(无)") + " act=" + (endS ? endS.act : "-")); /* act===4 合取：防红侧第二幕终驻留同形真空满足 */

  /* —— G9.18 幕终演出「搭台」：t3build 出现 → done → T3 入场＋收灯 —— */
  const t3st = await until(async () => { const s = await st(); const t3 = s.staging && s.staging.t3build; return t3 ? { t3: t3 } : null; }, 1500);
  chk(!!t3st, "G9.18 幕终演出「搭台」：staging.t3build 出现", t3st ? ("t3build.t=" + t3st.t3.t + " done=" + t3st.t3.done) : "1.5s 内没出现");
  const t3pl = await until(async () => { const s = await st(); const p = (s.plats || []).find(p => p.x === 780 && p.y === 300 && p.w === 96 && p.h === 170);
    return p ? { p: p, s: s } : null; }, 3200);
  const lampGone = t3pl ? lampOf(t3pl.s) === null : false;
  const t3done = t3pl && t3pl.s.staging && t3pl.s.staging.t3build && t3pl.s.staging.t3build.done === true;
  chk(!!(t3pl && lampGone && t3done), "G9.18b T3{780,300,96,170} 入 plats＋灯带已收（traps 无 lamp）＋done=true",
    "T3=" + !!(t3pl) + " lampGone=" + lampGone + " done=" + !!t3done);
  await page.screenshot({ path: path.join(SHOTS, PFX + "06-t3-built.png") });

  /* —— G9.19 T3 可站（从上方落下停在 y=300） —— */
  await dbg("setPlayerPos", [828, 120]);
  const landed = await until(async () => { const s = await st(); return (s.player.grounded === true && Math.abs(s.player.y - 300) <= 0.6) ? s.player : null; }, 2500);
  chk(!!landed, "G9.19 T3 可站：从上方落在 y=300", landed ? ("y=" + landed.y + " grounded=true") : "2.5s 内没落在 T3 顶");

  /* —— G9.20 R 重开回序章 —— */
  await page.keyboard.press("KeyR"); await sleep(400);
  const rs = await st();
  chk(rs.act === 1 && (rs.plats || []).length === 0 && (rs.traps || []).length === 0 && (!rs.staging || rs.staging.t3build === null) && warnOf(rs) === null,
    "G9.20 R 重开回序章：act=1、台箱空、traps 空、staging.t3build 清、wall.warn=null",
    "act=" + rs.act + " plats=" + JSON.stringify(rs.plats || []) + " traps=" + (rs.traps || []).length + " t3build=" + JSON.stringify(rs.staging ? rs.staging.t3build : null));

  chk(errs.length === 0, "G9.21 全程零错误", errs.length ? (errs.length + " 条，首条：" + errs[0]) : "0 条");
  console.log("---- 汇总：" + (fail === 0 ? "PASS " + pass + "/" + pass : "FAIL " + fail + "（PASS " + pass + "）") + " ----");
  console.log("GATE gate-9-acts3: " + (fail === 0 ? "PASS" : "FAIL"));
  await browser.close().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
