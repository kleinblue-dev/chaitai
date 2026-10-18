/* verify-v027.cjs —— 《拆台》结局仪式闸（Loop 8：P1-3 杀青序列；先红后绿）
   依据（d6-art:62 原文）：「触发点用 world.cleared；序列：黑边滑入 0.4s → 0.3s hitstop 式冻结
   → 1 帧白闪 → "完"字盖印＋琥珀色罩（怀旧片调）→ 胶片颗粒（预渲染 128×128 noise 平铺，随机偏移，
   α≈0.06）→ 1.5s 后出"一条过"场记板＋重来提示」。
   ==== 实现前先行钉死的时间轴契约（相对 cleared 时刻；本探针即契约，非事后调参）====
   0.00-0.40 黑边滑入（hbar=46，easeOutQuad），常驻至 4.2 后 0.3s 滑出；
   0.40-0.70 冻结（stgUpdate 每步顶 world.hitstop≥0.03 ⇒ updWorld 全停）；
   0.70      一帧白闪（flashAt 锚点：恰 1 个 step 帧 = 1/60s 窗，渲染层最多跨 2 渲染帧）；
   0.72-2.00 「完」字盖印（scale 2.2→1 迟滞 0.25s，1.7-2.0 淡出）＋琥珀罩升至 α=0.16 常驻；
   0.75-4.20 胶片颗粒 128×128 预渲染平铺＝每帧随机整数偏移 α=0.06；
   2.20-4.20 「一条过」板（x370-590, y208-270——避 v026 死拍板带 y134-196，二者不同相）；
   4.20-4.50 黑边滑出/琥珀淡出 → t≥4.50 staging.ceremony=null（自清）。
   「重来提示」=复用现 outroDelay=2.2s 的「按 R 再来一次」（timers 消费在 updWorld :553，
   冻结 0.3s 令其顺延 ⇒ 实际 ≈2.5s 出现；采样窗 [2.35,3.2] 两情形都覆盖）。
   ==== 阈值推导（先于红侧跑）====
   黑边带 TOP=[242,718,8,40]：满黑边 476×32 逻辑×2.25=34272 device。★ 推导修正（绿侧首跑抓出）：
     黑边 α=0.92 有 8% 透光 ⇒ 带内亮窗像素透光后 avg=(159+178+216)/3×0.08≈14.7>9 不判暗 ⇒
     暗像素比例恒 ~40-43%（本机实测 14616=43%；v026 同规格带历史实测 21328=39%，两代交叉印证
     该比例为 α0.92 透光固有）⇒ 阈值 ≥8000（实测 55%）。归零后该带=clear 天空（#1a1208
     luma≈17 非暗非亮）⇒ ≤400。
   冻结带 PZONE=[370,510,380,468]（玩家过 420 后站桩区；开键停步无惯性）：t∈[0.42,0.68] 每渲染帧
     采 140×88 逻辑，与首帧逐字节比 ⇒ hitstop 生效=全等（freezeNeq=0，≥5 帧）；负控（过卡后 idle
     期同带 0.5s×4 次间隔采样，骨架呼吸/任何人影移动 ⇒ 有差）证明该带能看见变化。
   白闪检带 FLASHQ=[600,660,250,310]（避月亮盘 x692+、避「完」字 x420-540、避旁白箱 y184-242）：
     非闪帧该带=天空/建筑（luma≈21）+窗金块（α0.18 ⇒ luma<140）⇒ 亮占比≈0；白闪 α0.96 全屏 ⇒
     亮占比>0.9。判 1≤flashFrames≤3（闪窗 1/60s；渲染帧 60Hz 时同 t 值至多被 2 渲染帧读到，容差 3）。
   完字带 SEAL=[420,540,236,306]（84px 字 textBaseline=middle @(480,286)）：金字笔画≥4000 device
     ⇒ 窗内多帧取 max ≥800；归零后 ≤100（该带=天空+建筑底+箱底描边 luma<140）。
   琥珀/颗粒带 SKY=[200,660,150,178]（★ 修正：原 y80-160 含「按 R」提示闪烁带 y112-140 ⇒ 归零后
     帧差=19.26 假红；现带空窗：上避提示(y≤140)/下避旁白箱(y≥184)）+避月亮(x>660)/建筑(top≥250)）
     mean(r-b)——推导：sky0 #1a1208
     r-b=18 底，叠 rgba(255,176,64,0.16)：r'=26*0.84+40.8≈62.6, b'=8*0.84+10.2≈17.0 ⇒ r-b≈45.6；
     sky1 #2d2110 r-b=29 ⇒ 叠后≈55 ⇒ 全线 Δ≈26-28。判 (amberIn[1.4-1.9] − amberAfter[归零+0.3s]) ≥15。
     灰噪声（r=g=b）对 r-b 零贡献 ⇒ 与颗粒不耦合。
   颗粒：同 SKY 带相邻采样帧（隔 2 渲染帧）逐像素 mean|Δ|——两独立均匀 [0,255] 噪声 E|n1-n2|=85
     ⇒ E|Δ|=0.06×85≈5.1（逐像素差均值不随带面积衰减）。判 grainIn≥1.5（推导值 30%）；归零后世界
     静止（背景为预渲染静态图，无粒子/震屏/动画）⇒ grainAfter≤0.4。
   板带 BOARD2=[370,590,208,270]：v026 死拍板同规格实测亮=9802 ⇒ 判 ≥600；归零后 ≤300。
   「按 R」带 RKEY=[340,620,112,140]：★ 修正（绿侧首跑抓出）：金色 α=0.6 时 luma=(164+137+67)/3≈122
     <140 不受「亮>140」捕获，且 sin 周期 2.2s 下 0.85s 窗可能整段错过 α 峰值 ⇒ 改「金像素」判据
     luma>100（α∈[0.6,1] 时金叠天空 luma∈[122,192]，底<25 干净区分）＋窗延至 [2.35,3.9]（1.55s
     >0.7 周期 ⇒ 必含 α 峰值相位）；判 ≥40。
   时长：首采 firstT≤0.1；归零前最后 t=tMax∈[4.2,5.2]（轮询粒度 ~16ms）；归零后 staging.act=null
     （「完 · 一条过」幕卡被仪式取代，不再出现——契约演进，见 v026 v2 头注）。
   ==== 旧仪器安全（实测推导，写入回执）====
   v012-X4 c3 采 (60,60) 于 cleared+0.4~0.65s：黑边只到 y46<60；琥珀 0.72 起、颗粒 0.75 起 ⇒ c3
     时画面该点仍=clear rgb(28,19,8)，diff23=40 不动。v011-V4b calm 在 cleared+8.2s ≥ 自清 4.5s。
   v025 不进 cleared 相；v020/v022 不触碰 cleared；v023/v024 无像素采样。
   断言（9 判据行 / 7 组）：C1 触发/时长/自清；C2 黑边滑入态与撤；C3 冻结（＋idle 负控）；
   C4 一帧白闪；C5 完字＋琥珀；C6 颗粒；C7 一条过板＋重来提示；E 帧时 p95≤25ms；0 零错误。
   用法：node tools/verify-v027.cjs；环境：CHAITAI_URL / CHAITAI_SHOT_PREFIX。 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v027/v027");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v027 ==");
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

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  for (let i = 0; i < 30; i++) { const s = await G(() => window.__game.state()); if (s.phase === "playing") break; await sleep(200); }

  /* ---------- 走位触发第一幕（真键过 420；玩家停 ≈420-440 = 后续冻结带） ---------- */
  await page.keyboard.down("KeyD");
  let act1 = false;
  for (let i = 0; i < 250 && !act1; i++) { await sleep(40); const s = await stg(); if (s && s.act) act1 = true; }
  await page.keyboard.up("KeyD");
  if (!act1) console.log("  ! 过 420 后 10s 未见第一幕卡（继续跑，B 段会红）");

  /* ---------- idle 负控：冻结带能看见变化（骨架呼吸/任何人影移动 ⇒ 首帧 vs 后续帧有差） ---------- */
  const idleDiff = await G(() => new Promise(res => {
    const cv = document.getElementById("cv"), gc = cv.getContext("2d"), k = cv.width / 960;
    const grab = () => gc.getImageData(Math.round(370 * k), Math.round(380 * k),
      Math.round(140 * k), Math.round(88 * k)).data.slice();
    const b1 = grab(); let dif = 0, tries = 0;
    const tick = () => { tries++;
      const b2 = grab(); let d0 = 0;
      for (let i = 0; i < b2.length; i += 4) { if (b2[i] !== b1[i]) { d0 = 1; break; } }
      if (d0) dif = 1;
      if (tries >= 4 || dif) res(dif); else setTimeout(tick, 500); };
    setTimeout(tick, 500);
  }));

  /* ---------- 链：清 W1 → 等第二幕卡走完 → 清 W2 → 等仪式 ---------- */
  for (let i = 0; i < 70; i++) { const s = await stg(); if (!(s && s.act)) break; await sleep(40); }
  await G(() => window.__game.debug.clearWave());
  let w2seen = false;
  for (let i = 0; i < 150 && !w2seen; i++) { await sleep(60); const s = await G(() => window.__game.state()); if (s.wave === 2) w2seen = true; }
  for (let i = 0; i < 70; i++) { const s = await stg(); if (!(s && s.act)) break; await sleep(40); }
  await sleep(250);

  /* ---------- 仪式全流程采样（页内 rAF；与截图轮询并发） ---------- */
  const pData = G(() => new Promise((resolve) => {
    const cv = document.getElementById("cv"), gc = cv.getContext("2d"), k = cv.width / 960;
    const out = { seen: false, firstT: null, lastT: 0, tMax: 0,
      barsDark: null, topAfter: null,
      freezeN: 0, freezeNeq: 0,
      flashFrames: 0, flashMaxRatio: 0,
      sealOn: 0, sealOff: null, amberIn: null, amberAfter: null,
      grainIn: 0, grainInN: 0, grainAfter: 0, grainAfterN: 0,
      boardOn: 0, boardOff: null, rkeyOn: 0, actAfter: "unset" };
    const band = (x0, x1, y0, y1) => gc.getImageData(Math.round(x0 * k), Math.round(y0 * k),
      Math.round((x1 - x0) * k), Math.round((y1 - y0) * k)).data;
    const lum = (d, i) => (d[i] + d[i + 1] + d[i + 2]) / 3;
    const brightOf = (d) => { let br = 0; for (let i = 0; i < d.length; i += 4) if (lum(d, i) > 140) br++; return br; };
    let fzBuf = null, skyPrev = null, frames = 0, phase = "wait", nullSince = 0, afterAt = 0;
    const t0 = performance.now();
    window.__game.debug.clearWave(); /* 清 W2 → clearDelay 0.7s → cleared → 仪式 */
    function tick() {
      frames++;
      const s = window.__game.state();
      const cer = s.staging && s.staging.ceremony;
      if (phase === "wait") {
        if (cer) phase = "active";
        else if (performance.now() - t0 > 4000) { resolve(out); return; }
      } else if (phase === "active") {
        if (!cer) { phase = "after"; nullSince = performance.now(); }
        else {
          out.seen = true; const t = cer.t; out.lastT = t;
          if (out.firstT === null) out.firstT = t;
          if (t > out.tMax) out.tMax = t;
          if (out.barsDark === null && t >= 0.45 && t <= 0.68) {
            const d = band(242, 718, 8, 40); let dark = 0;
            for (let i = 0; i < d.length; i += 4) if (lum(d, i) < 9) dark++;
            out.barsDark = dark;
          }
          if (t >= 0.42 && t <= 0.68) {
            const d = band(370, 510, 380, 468);
            if (!fzBuf) fzBuf = d.slice();
            else { out.freezeN++;
              let neq = 0;
              for (let i = 0; i < d.length; i += 4) { if (d[i] !== fzBuf[i] || d[i + 1] !== fzBuf[i + 1] || d[i + 2] !== fzBuf[i + 2]) { neq = 1; break; } }
              if (neq) out.freezeNeq++; }
          }
          if (t >= 0.60 && t <= 0.95) {
            const d = band(600, 660, 250, 310), n = d.length / 4;
            const ratio = brightOf(d) / n;
            if (ratio > out.flashMaxRatio) out.flashMaxRatio = ratio;
            if (ratio > 0.9) out.flashFrames++;
          }
          if (t >= 1.05 && t <= 1.65) {
            const br = brightOf(band(420, 540, 236, 306));
            if (br > out.sealOn) out.sealOn = br;
          }
          if (t >= 1.40 && t <= 1.90) {
            const d = band(200, 660, 150, 178), n = d.length / 4; let sr = 0, sb = 0;
            for (let i = 0; i < d.length; i += 4) { sr += d[i]; sb += d[i + 2]; }
            out.amberIn = (sr - sb) / n;
          }
          if (t >= 1.00 && t <= 2.00 && frames % 2 === 0) {
            const d = band(200, 660, 150, 178);
            if (skyPrev) { let acc = 0; const n = d.length / 4;
              for (let i = 0; i < d.length; i += 4) acc += Math.abs(d[i] - skyPrev[i]);
              out.grainIn += acc / n; out.grainInN++; }
            skyPrev = d.slice();
          }
          if (t >= 2.35 && t <= 3.20) {
            const br = brightOf(band(370, 590, 208, 270));
            if (br > out.boardOn) out.boardOn = br;
          }
          if (t >= 2.35 && t <= 3.90) { /* 「按 R」提示全程闪烁；金像素判据 luma>100（见头注修正） */
            const d2 = band(340, 620, 112, 140); let gld = 0;
            for (let i = 0; i < d2.length; i += 4) if (lum(d2, i) > 100) gld++;
            if (gld > out.rkeyOn) out.rkeyOn = gld;
          }
        }
      } else if (phase === "after") {
        const since = performance.now() - nullSince;
        if (since >= 300 && !afterAt) {
          afterAt = performance.now();
          skyPrev = null; /* ★ 修正：不清则首对比较=「仪式中(含琥珀/颗粒)帧 vs 归零帧」⇒ 假大 (实测 19.6) */
          const top = band(242, 718, 8, 40); let dark = 0;
          for (let i = 0; i < top.length; i += 4) if (lum(top, i) < 9) dark++;
          out.topAfter = dark;
          out.sealOff = brightOf(band(420, 540, 236, 306));
          out.boardOff = brightOf(band(370, 590, 208, 270));
          const sk = band(200, 660, 150, 178), n = sk.length / 4; let sr = 0, sb = 0;
          for (let i = 0; i < sk.length; i += 4) { sr += sk[i]; sb += sk[i + 2]; }
          out.amberAfter = (sr - sb) / n;
        }
        if (afterAt && performance.now() - afterAt >= 120) {
          const d = band(200, 660, 150, 178);
          if (skyPrev) { let acc = 0; const n = d.length / 4;
            for (let i = 0; i < d.length; i += 4) acc += Math.abs(d[i] - skyPrev[i]);
            out.grainAfter += acc / n; out.grainAfterN++; }
          skyPrev = d.slice();
          if (out.grainAfterN >= 2) { out.actAfter = (s.staging && s.staging.act) ? "残留" : "无"; resolve(out); return; }
        }
        if (since > 4000) { out.actAfter = "超时"; resolve(out); return; }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }));

  /* ---------- 截图（与采样并发；轮询 staging 时点） ---------- */
  try {
    await page.waitForFunction(() => { const s = window.__game.state(); return s.staging && s.staging.ceremony && s.staging.ceremony.t >= 1.10; }, { polling: "raf", timeout: 15000 });
    await shot("seal-amber-grain");
    await page.waitForFunction(() => { const s = window.__game.state(); return s.staging && s.staging.ceremony && s.staging.ceremony.t >= 2.60; }, { polling: "raf", timeout: 8000 });
    await shot("board-once");
  } catch (e) { console.log("  ! 截图轮询超时（无仪式）：" + String(e).slice(0, 80)); }

  const r = await pData;
  try { await page.waitForFunction(() => { const s = window.__game.state(); return !(s.staging && s.staging.ceremony); }, { polling: "raf", timeout: 8000 }); } catch (e) {}
  await sleep(500);
  await shot("clean-after");

  /* ---------- 断言 ---------- */
  {
    const ok = r.seen && r.firstT !== null && r.firstT <= 0.1 && r.tMax >= 4.2 && r.tMax <= 5.2 && r.actAfter === "无";
    report("V27-C1 触发/时长/自清", ok,
      "seen=" + r.seen + " firstT=" + (r.firstT === null ? "未出现" : r.firstT) + "（≤0.1） tMax=" + (r.tMax ? r.tMax.toFixed(3) : r.tMax) +
      "（∈[4.2,5.2]）｜归零后 staging.act=" + r.actAfter + "（=无）");
  }
  {
    const ok = r.barsDark !== null && r.barsDark >= 8000 && r.topAfter !== null && r.topAfter <= 400;
    report("V27-C2 黑边滑入/撤", ok,
      "满相顶带暗=" + r.barsDark + "（≥8000；α0.92 透光下比例固有 ~40-43%）｜归零后顶带暗=" + r.topAfter + "（≤400）");
  }
  {
    const ok = r.freezeN >= 5 && r.freezeNeq === 0 && idleDiff >= 1;
    report("V27-C3 冻结 0.3s", ok,
      "冻结窗帧对=" + r.freezeN + "（≥5） 不等帧=" + r.freezeNeq + "（=0）｜负控(idle 同带 0.5s 间隔)有差=" + idleDiff + "（≥1，证明该带能看见变化）");
  }
  {
    const ok = r.flashFrames >= 1 && r.flashFrames <= 3;
    report("V27-C4 一帧白闪", ok,
      "闪帧数=" + r.flashFrames + "（∈[1,3]；闪窗 1/60s，渲染帧最多读到 2） 最大亮占比=" + r.flashMaxRatio.toFixed(3) + "（>0.9 记闪）");
  }
  {
    const amberD = (r.amberIn !== null && r.amberAfter !== null) ? (r.amberIn - r.amberAfter) : null;
    const ok = r.sealOn >= 800 && r.sealOff !== null && r.sealOff <= 100 && amberD !== null && amberD >= 15;
    report("V27-C5 完字＋琥珀罩", ok,
      "完字带亮=" + r.sealOn + "（≥800）→归零 " + r.sealOff + "（≤100）｜琥珀 r-b：" + (r.amberIn === null ? "无" : r.amberIn.toFixed(1)) +
      "→归零 " + (r.amberAfter === null ? "无" : r.amberAfter.toFixed(1)) + " Δ=" + (amberD === null ? "无" : amberD.toFixed(1)) + "（≥15）");
  }
  {
    const gIn = r.grainInN ? r.grainIn / r.grainInN : null;
    const gAf = r.grainAfterN ? r.grainAfter / r.grainAfterN : null;
    const ok = gIn !== null && gIn >= 1.5 && gAf !== null && gAf <= 0.4;
    report("V27-C6 胶片颗粒", ok,
      "仪式中逐像素帧差=" + (gIn === null ? "无" : gIn.toFixed(2)) + "（≥1.5；推导 E|Δ|=0.06×85≈5.1）×" + r.grainInN +
      "对｜归零后=" + (gAf === null ? "无" : gAf.toFixed(2)) + "（≤0.4）×" + r.grainAfterN + "对");
  }
  {
    const ok = r.boardOn >= 600 && r.boardOff !== null && r.boardOff <= 300 && r.rkeyOn >= 40;
    report("V27-C7 一条过板＋重来提示", ok,
      "板带亮=" + r.boardOn + "（≥600）→归零 " + r.boardOff + "（≤300）｜「按 R」带亮=" + r.rkeyOn + "（≥40）");
  }
  {
    const t = await G(() => window.__game.debug.telemetry());
    const ok = t.frameP95Ms <= 25;
    report("V27-E 帧时 sanity", ok, "p95=" + t.frameP95Ms + "ms（≤25 穷举上限）");
  }
  {
    const ok = errs.length === 0;
    report("V27-0 零错误", ok, "0 pageerror / 0 console.error" + (ok ? "" : " → " + JSON.stringify(errs.slice(0, 4))));
  }

  const red = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - red) + "/" + results.length + (red ? "（红 " + red + "）" : " 全绿") + " ----");
  await browser.close();
  process.exit(red ? 1 : 0);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
