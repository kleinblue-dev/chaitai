/* verify-v026.cjs —— 《拆台》演出装置闸（Loop 7：P1-2 幕卡/死亡场记板/标题 REC；先红后绿）
   依据（d6-art §P1-2 逐字＋今日实读源码）：
   - 幕卡契约：wave1/wave2 开场 → 黑边滑入(0.35s)＋大字盖印(持 1s)＋滑出(0.35s)，全程 1.7s；
     wave1/wave2 名＝「序章 · 第1镜」/「序章 · 第2镜」（W1 2026-10-15 d1 §28 幕牌降级：
     五幕各占幕牌，序章波牌降级；与 HUD 序章标签同串）、清场="完 · 一条过"（已由结局仪式取代）。
   - 死亡场记板契约：玩家倒下 → "卡！"＋全屏白闪 0.18s、拍板"第 N 条 · 重拍"（N=world.deaths）
     死亡期间常驻；2.2s 自动复活（respawn），再次倒下 N=2。
   - 标题页契约：REC 红点＋走秒时间码（state().staging.titleSec 单调）＋取景框四角（四角视觉项不设判据）。
   - 空间契约（防踩旧仪器）：黑边仅 y0-46 / y494-540；大字 y246-294；拍板 y136-194。
     均不触：月亮带 y62-178（v011 质心——x370-590 与月亮盘 x692-808 无横向重叠，且 v011 为
     精确色匹配＋valid 过滤，闪白期 n≈0 样本会被其滤掉）、(60,60) 题字像素（v012 X4，y60>黑边 46）、
     阴影带 y463-470（v012 X6）与地面行 460-474（v025-C，黑边起 494）。
     ★ 拍板定 y136-194（非 170-228）：板若伸进闪白带 y200-320，板面约 13860 亮像素会灌进
     flashPost 采样 ⇒ 必假红（先红侧未跑时的设计修正，非事后调参；板上沿也避开月亮带下沿 178 的横向区）。
   断言（8 判据行 / 6 组）：
   V26-D 标题页（先跑，fresh title）：①红盒(760-830,42-74) 红像素≥25；②时间码盒(836-916,44-72)
          亮像素≥25；③titleSec 两次采样单调 +≥0.9s；④Enter 后同两盒 红≤5 且亮≤20（负控）且 titleSec=null。
   V26-A 幕卡-序章第1镜（真键）：按住 KeyD 过 x=420 → staging.act.name="序章 · 第1镜" 且 t≤1.0；
          持相内采顶带(100-860,8-40)暗像素 vs 卡毕同带：duringDark≥900 ∧ afterDark≤200；
          文字带(240-720,230-304)亮像素：duringBright ≥ afterBright+1200。
   V26-B 幕卡-序章第2镜＋结局仪式（debug.clearWave 链）：wave2 卡名="序章 · 第2镜"；再清 → cleared 时
         出现 staging.ceremony（Loop 8 结局仪式取代「完 · 一条过」幕卡——契约演进 v2：cleared 后
         staging.act 不得再出现；对旧版 611a101 本段先红=无 ceremony 钩子，红侧留档）。
   V26-C 死亡场记板：①死亡前采闪白带(240-720,200-320)亮=flashPre、拍板带(370-590,134-196)亮=boardPre；
          ②hurtPlayer(100) 后在页面内 rAF 2..6 取最大闪白帧：flashOn≥20000；③+0.7s 采 flashPost≤12000 且 ≤flashOn−15000；
          ④死亡中拍板亮 ≥ boardPre+600；⑤以"此刻活着"的 deaths 为基线：死后 deaths=基线+1 且
          staging.death.n===deaths（场记板号自洽；红侧实测 A 段长按探路期玩家会被杂兵自然打死
          ⇒ 绝对计数 `deaths===1` 属探针自身缺陷，改相对基线）；⑥复活后再死 = 基线+2 且再自洽。
   V26-E 帧时 sanity：p95 ≤25ms。V26-0 零错误。
   先红后绿（预期红侧＝无 staging 钩子结构性红＋像素无闪白/无卡；像素判据在实现后须全绿）。
   用法：node tools/verify-v026.cjs；环境：CHAITAI_URL / CHAITAI_SHOT_PREFIX。 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v026/v026");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v026 ==");
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

  /* 像素三元计数（logical 坐标带；暗=luma<9，亮=luma>140，红=r>150∧g<110∧b<110） */
  const px = (x0, x1, y0, y1) => G((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[2] * k),
      Math.round((a[1] - a[0]) * k), Math.round((a[3] - a[2]) * k)).data;
    let dark = 0, bright = 0, red = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2], l = (r + gg + b) / 3;
      if (l < 9) dark++; if (l > 140) bright++; if (r > 150 && gg < 110 && b < 110) red++;
    }
    return { dark, bright, red, n: d.length / 4 };
  }, [x0, x1, y0, y1]);
  const stg = () => G(() => ((window.__game.state() || {}).staging) || null).catch(() => null);

  const TOP = [100, 860, 8, 40], TEXT = [240, 720, 230, 304];
  const REDBOX = [760, 830, 42, 74], TCBOX = [836, 916, 44, 72];
  const FLASH = [240, 720, 200, 320], BOARD = [370, 590, 134, 196];

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);

  /* ---------- V26-D 标题页 REC/时间码/取景框 ---------- */
  {
    const r1 = await px(...REDBOX), t1 = await px(...TCBOX);
    const s1 = await stg();
    await shot("title-rec");
    await sleep(1150);
    const s2 = await stg();
    const sec1 = s1 && typeof s1.titleSec === "number" ? s1.titleSec : null;
    const sec2 = s2 && typeof s2.titleSec === "number" ? s2.titleSec : null;
    const stepOk = sec1 !== null && sec2 !== null && (sec2 - sec1) >= 0.9;
    console.log("  D 采样：红盒 red=" + r1.red + " 时间码盒 bright=" + t1.bright +
      " titleSec=" + sec1 + "→" + sec2);
    await page.keyboard.press("Enter");
    await sleep(700);
    const r2 = await px(...REDBOX), t2 = await px(...TCBOX);
    const s3 = await stg();
    const negOk = r2.red <= 5 && t2.bright <= 20 && (s3 ? s3.titleSec === null : true);
    const ok = r1.red >= 25 && t1.bright >= 25 && stepOk && negOk;
    report("V26-D 标题 REC/时间码", ok,
      "红点+R…红像素=" + r1.red + "（≥25） 时间码亮像素=" + t1.bright + "（≥25） titleSec=" + sec1 + "→" + sec2 +
      "（+≥0.9 单调）｜Enter 后负控：红=" + r2.red + "（≤5） 亮=" + t2.bright + "（≤20） titleSec=" + (s3 ? s3.titleSec : "无staging") +
      "｜" + (ok ? "全项达标" : [r1.red >= 25 ? "" : "红点缺", t1.bright >= 25 ? "" : "时间码缺", stepOk ? "" : "秒表不动/无staging", negOk ? "" : "负控脏"].filter(Boolean).join("、")));
  }

  /* ---------- V26-A 幕卡-序章第1镜（真键过 420；W1 起牌名降级，装置契约不变） ---------- */
  {
    const pre = await stg();
    await page.keyboard.down("KeyD");
    let act = null;
    for (let i = 0; i < 250 && !act; i++) { await sleep(40); const s = await stg(); if (s && s.act) act = s.act; }
    await page.keyboard.up("KeyD");
    if (!act) { report("V26-A 幕卡-第一幕", false, "过 x=420 后 10s 内未捕到 staging.act（钩子缺失或未触发）"); }
    else {
      /* 等持相（t≥0.55；持相 0.35-1.35s） */
      let hold = null;
      for (let i = 0; i < 40; i++) { const s = await stg(); if (s && s.act && s.act.t >= 0.55) { hold = s.act; break; } if (!s || !s.act) break; await sleep(30); }
      const dDuring = hold ? await px(...TOP) : null;
      const bDuring = hold ? await px(...TEXT) : null;
      if (hold) await shot("act1-card");
      /* 等卡片结束＋0.35s 余量再采 after */
      for (let i = 0; i < 70; i++) { const s = await stg(); if (!(s && s.act)) break; await sleep(40); }
      await sleep(350);
      const dAfter = await px(...TOP), bAfter = await px(...TEXT);
      const nameOk = act.name === "序章 · 第1镜";
      const earlyOk = act.t <= 1.0;
      const pixOk = hold && dDuring.dark >= 900 && dAfter.dark <= 200 && bDuring.bright >= bAfter.bright + 1200;
      report("V26-A 幕卡-第一幕", !!(nameOk && earlyOk && pixOk),
        "触发名=\"" + act.name + "\"（=序章 · 第1镜）t=" + act.t + "（≤1.0）｜" +
        (hold ? "持相：顶带暗=" + dDuring.dark + "（≥900） 文字带亮=" + bDuring.bright + "（≥after+1200）" :
          "持相未捕到（页内未见 t≥0.55）") +
        "｜卡毕：顶带暗=" + dAfter.dark + "（≤200） 文字带亮=" + bAfter.bright +
        "｜pre-staging=" + (pre ? "有" : "无"));
    }
  }

  /* ---------- V26-B 幕卡-序章第2镜＋完卡（clearWave 触发链；W1 起牌名降级） ---------- */
  {
    const res = { w2: null, clr: null };
    await G(() => window.__game.debug.clearWave());
    for (let i = 0; i < 150 && !res.w2; i++) { await sleep(60); const s = await stg(); if (s && s.act) res.w2 = s.act.name; }
    for (let i = 0; i < 70; i++) { const s = await stg(); if (!(s && s.act)) break; await sleep(40); }
    await sleep(250);
    await G(() => window.__game.debug.clearWave());
    /* Loop8 v2 契约演进：cleared 不再盖「完 · 一条过」幕卡 → 改为结局仪式（staging.ceremony）。
       同时监测 staging.act 不得再出现（出现=旧行为残留 ⇒ 红）。 */
    let cerSeen = false;
    for (let i = 0; i < 150 && !cerSeen; i++) {
      await sleep(60); const s = await stg();
      if (s && s.act) res.clr = s.act.name;
      if (s && s.ceremony) cerSeen = true;
    }
    const ok = res.w2 === "序章 · 第2镜" && cerSeen && res.clr === null;
    await shot("clear-ceremony");
    report("V26-B 幕卡-第二幕/结局仪式", ok,
      "wave2 触发卡名=\"" + res.w2 + "\"（=序章 · 第2镜）；cleared → staging.ceremony " + (cerSeen ? "出现" : "未出现") +
      "（Loop8 起取代完卡）｜cleared 后 staging.act=" + (res.clr === null ? "未出现" : "出现\"" + res.clr + "\"") + "（=未出现）");
    for (let i = 0; i < 70; i++) { const s = await stg(); if (!(s && s.act)) break; await sleep(40); }
  }

  /* ---------- V26-C 死亡场记板（两连死） ---------- */
  {
    /* Loop8 护栏：cleared→+4.5s 结局仪式期间，仪式板(y208-270)/颗粒/琥珀会污染 bPre 与闪白带，
       先等仪式自清（611a101 无仪式时立即通过）。 */
    for (let i = 0; i < 60; i++) { const s = await stg(); if (!(s && s.ceremony)) break; await sleep(100); }
    /* 归因基线：A 段长按探路期玩家可能已被杂兵打死自然复活多次（红侧实测 deaths=2 起步），
       故以"此刻活着"为基线做相对断言 + 场记板号自洽（staging.death.n === deaths）。 */
    let baseDeaths = null;
    for (let i = 0; i < 40; i++) { const s = await G(() => window.__game.state()); if (s.phase === "playing") { baseDeaths = s.narrator.counters.deaths; break; } await sleep(300); }
    if (baseDeaths === null) baseDeaths = await G(() => window.__game.state().narrator.counters.deaths);
    await sleep(400);
    const fPre = await px(...FLASH), bPre = await px(...BOARD);
    /* 页面内：死亡 + rAF 2..6 取闪白亮像素最大值（对 rAF 节拍鲁棒：慢帧也至少扫到高 α 段） */
    const r = await G(() => new Promise((res) => {
      window.__game.debug.hurtPlayer(100);
      const st0 = window.__game.state();
      let n = 0, maxBright = 0;
      const tick = () => { n++;
        const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
        const d = g.getImageData(Math.round(240 * k), Math.round(200 * k), Math.round(480 * k), Math.round(120 * k)).data;
        let bright = 0; for (let i = 0; i < d.length; i += 4) { if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 140) bright++; }
        if (bright > maxBright) maxBright = bright;
        if (n >= 6) { res({ phase: st0.phase, deaths: st0.narrator.counters.deaths, sg: st0.staging || null, flashOn: maxBright }); return; }
        requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }));
    await sleep(750);
    const fPost = await px(...FLASH), bDuring = await px(...BOARD);
    await shot("death-card");
    const d1ok = r.phase === "dead" && r.deaths === baseDeaths + 1 && r.sg && r.sg.death && r.sg.death.n === r.deaths;
    const flashOk = r.flashOn >= 20000 && fPost.bright <= 12000 && (r.flashOn - fPost.bright) >= 15000;
    const boardOk = bDuring.bright >= bPre.bright + 600;
    /* 复活（2.2s）→ 再死 → 记第 baseDeaths+2 条 */
    let n2 = null, ph2 = null;
    for (let i = 0; i < 30; i++) { await sleep(300); const s = await G(() => window.__game.state()); if (s.phase === "playing") break; }
    const r2 = await G(() => { window.__game.debug.hurtPlayer(100); const s = window.__game.state(); return { phase: s.phase, sg: s.staging || null, deaths: s.narrator.counters.deaths }; });
    ph2 = r2.phase; n2 = r2.sg && r2.sg.death ? r2.sg.death.n : null;
    const d2ok = ph2 === "dead" && r2.deaths === baseDeaths + 2 && n2 === r2.deaths;
    report("V26-C 死亡场记板", !!(d1ok && flashOk && boardOk && d2ok),
      "基线deaths=" + baseDeaths + "｜死1：phase=" + r.phase + " deaths=" + r.deaths + "（=基线+1） staging.death.n=" + (r.sg && r.sg.death ? r.sg.death.n : (r.sg ? "无death" : "无staging")) + "（=deaths 自洽）｜" +
      "闪白帧=" + r.flashOn + "（≥20000） +0.75s=" + fPost.bright + "（≤12000 且 Δ≥15000=" + (r.flashOn - fPost.bright) + "）｜" +
      "拍板亮 " + bPre.bright + "→" + bDuring.bright + "（≥+600）｜死2：phase=" + ph2 + " deaths=" + r2.deaths + "（=基线+2） staging.death.n=" + n2 + "（=deaths）");
  }

  /* ---------- V26-E 帧时 ---------- */
  {
    const t = await G(() => window.__game.debug.telemetry());
    const ok = t.frameP95Ms <= 25;
    report("V26-E 帧时 sanity", ok, "p95=" + t.frameP95Ms + "ms（≤25 穷举上限；量级参考 v025=6.3ms）");
  }
  {
    const ok = errs.length === 0;
    report("V26-0 零错误", ok, "0 pageerror / 0 console.error" + (ok ? "" : " → " + JSON.stringify(errs.slice(0, 4))));
  }

  const red = results.filter(r => !r.ok).length;
  console.log("---- 汇总：PASS " + (results.length - red) + "/" + results.length + (red ? "（红 " + red + "）" : " 全绿") + " ----");
  await browser.close();
  process.exit(red ? 1 : 0);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
