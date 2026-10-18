/* verify-visual-v1.cjs —— 《拆台》视觉系统闸（美术总监循环；5 判据）
   纪律：红侧必须在实现之前定稿（本文件 2026-10-13 先于 Loop B/C/D 实现写成并跑出红档）。
   判据（对应宪法 VISUAL_CONSTITUTION.md）：
   J1 调色板一致性：game.js 源码全量色值（去注释）⊆ debug.paletteRegistry() 注册表；
      且六项违宪色（扫描清单 C-1..C-6）在源码中绝迹——【独立于钩子，红侧即应指认】。
   J2 后处理栈顺序：debug.pp().order === ["bloom","tone","vignette","grain"]；参数=window.VISUAL_CONFIG
      活读（改 VC 立即反映）；像素功能证据：bloom 关→开 刀弧区增亮≥3（2026-10-14 采样法修复：
      单次刀→120ms 弧中 setHitstop 冻结→同帧关/开双采；旧两刀法第二次落连段二弧型/相位不同 ⇒ flake，
      取证 _diag-j4-freeze.cjs[C] 正对照 +6.03；无冻结钩子自动退化旧法）；vignette 关→开 左上角变暗≥0.8
      且中心恒等区 |Δ|≤0.15、月盘区 |Δ|≤0.10（v011 锁色契约）。
   J3 动态层级帧率：debug.layerStats() 2s 窗口（far∈[12,18] / mid∈[25,35] / fg≥45）；
      debug.layers() 位移数学：x480→580 时 far=+8 / mid=+12（钳制±12 内）。
   J4 描边规则：debug.strokeProfile() 与宪法 §3 全等（玩家三笔 3.2/0.25/#0b1322/0.34、背景 0、
      Boss 18、标题 26）；像素互证「元素不浮」：bloom 关→开，玩家躯干带 |Δluma|≤2
      （2026-10-14 采样法修复：清场＋setHitstop 冻结双采均值；判据未动，取证 _diag-j4-freeze.cjs）。
   J5 截图三判据（自动代理＋出图供人工目检）：①颜色不跳：静帧 100ms 帧差每通道均值 ≤1.5；
      ②层级有深：远景专属带相关位移=8±1.5（player 480→580）、平台边列与像素 0 位移。
      （2026-10-14 采样协议重写（两处根因＋一处盲区，全部实锤取证）：
        根因1 palKey 翻幕（game.js:712）——wave1 生成即排 wave2、wave2 排 cleared，palKey 变 ⇒ 整层
          重烤（BASE/FAR/MID 全换色）⇒ 跨翻面像素对比平坦 ~23、真位移信号被埋（_diag-drawx.cjs；
          drawImage 实画 dx 已确为 −12↔−4）。新协议：debug.reset() → setPlayerX(480) 主动重放
          wave1→wave2→cleared 全链（实测 7.7s）→ 等 cleared 且 ceremony 结束。
        根因2 结局仪式污染——ceremony 分支每帧贴随机偏移胶片颗粒（game.js:1228, α0.06）＋幕卡 y286
          （带内）动画 ⇒ 跨仪式任何对比全屏噪声（旧 J5 res 47.9 真身）。已在等待条件中排除。
        盲区3 互相关只扫 off∈[0,12] —— 反方向对的真谷在 −8 永不入扫。现全扫 ±12。
        平台端帽竖线列法：平台屏固定（drawPlatforms 画 p.x），端帽 #7df9ff66 列定义列均值 B−R 峰值列；
          A/B 位置必须恒等（_diag-j5b.cjs 校准：端帽列 Δ=0、平台曲线 argmin=0 残差 1.02、
          远景带 argmin=8 残差 0.04 d0=3.88）。判据口径未放松，仅换仪器；
        采样期间 setHitstop 冻结，抗相位噪声，无冻结钩子自动退化。）
      ③暗角：角区关→开变暗≥0.8（与 J2 同证）；输出 shots/verify-visual-v1/*.png。
   V-0 零错误。
   用法：node tools/verify-visual-v1.cjs   环境：CHAITAI_URL 覆盖被测页。
*/
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const GAME = path.join(ROOT, "game.js");
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = ROOT + "/shots/verify-visual-v1/vv1";
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

/* ---------- J1 源码色值扫描（Node 侧，独立于页面） ---------- */
function scanSourceColors(file) {
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""); // 去注释（含行号会漂——只报色值）
  const found = {};
  let m;
  const reHex = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  while ((m = reHex.exec(src))) {
    let h = m[1].toLowerCase();
    if (h.length === 8) h = h.slice(0, 6);       // 8 位=6 位+α ⇒ 取基色
    else if (h.length === 3) h = h.split("").map(c => c + c).join("");
    found["#" + h] = (found["#" + h] || 0) + 1;
  }
  const reRgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
  while ((m = reRgb.exec(src))) {
    const h = "#" + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, "0")).join("");
    found[h] = (found[h] || 0) + 1;
  }
  return found;
}
/* 扫描清单 C-1..C-6 的颜色本体（修正后必须绝迹） */
const FORBIDDEN = ["#8fd6ff", "#9fd8ff", "#ff8f6a", "#1a1410", "#78c8ff", "#3c1600"];

(async () => {
  console.log("== verify-visual-v1 ==");
  console.log("URL  = " + URL_);
  console.log("md5  = game.js " + md5(GAME) + " / index.html " + md5(path.join(ROOT, "index.html")));
  fs.mkdirSync(path.dirname(SHOT), { recursive: true });

  /* ---- J1（源码侧先判，不依赖页面；注册表部分在主流程里判） ---- */
  const srcColors = scanSourceColors(GAME);
  const hits = FORBIDDEN.filter(c => srcColors[c]);

  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  let shotN = 0;
  const shot = async (tag) => { try { await page.screenshot({ path: SHOT + "-" + (++shotN) + "-" + tag + ".png" }); } catch (e) {} };
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  const K = () => page.evaluate(() => { const cv = document.getElementById("cv"); return cv ? cv.width / 960 : 1.5; });
  const meanBox = (x0, x1, y0, y1) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[2] * k),
      Math.round((a[1] - a[0]) * k), Math.round((a[3] - a[2]) * k)).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return s / (d.length / 4);
  }, [x0, x1, y0, y1]).catch(() => null);
  const meanRGB = (x0, x1, y0, y1) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[2] * k),
      Math.round((a[1] - a[0]) * k), Math.round((a[3] - a[2]) * k)).data;
    let r = 0, gg = 0, b = 0, n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    return [r / n, gg / n, b / n];
  }, [x0, x1, y0, y1]).catch(() => null);

  try {
    await page.goto(URL_, { waitUntil: "load" });
    await sleep(900);

    /* ---- J1 完成：页面注册表 ⊆ 检查 ---- */
    const reg = await G(() => {
      const d = window.__game && window.__game.debug;
      if (!d || typeof d.paletteRegistry !== "function") return null;
      try { return d.paletteRegistry(); } catch (e) { return { err: String(e) }; }
    });
    if (reg === null) {
      report("J1 调色板一致性", false, "钩子缺失（debug.paletteRegistry 不存在）" +
        (hits.length ? `；且源码现存违宪色 ${hits.join(" ")}` : ""));
    } else if (reg.err) {
      report("J1 调色板一致性", false, "paletteRegistry 抛错：" + reg.err);
    } else {
      const allowed = new Set((reg.allowed || []).map(s => String(s).toLowerCase()));
      allowed.add("#000000"); // 透明/黑工具色
      const off = Object.keys(srcColors).filter(c => !allowed.has(c));
      const ok = off.length === 0 && hits.length === 0;
      report("J1 调色板一致性", ok,
        `源码色值 ${Object.keys(srcColors).length} 个去重 / 注册表 ${allowed.size} 项｜离域 ${off.length} 个: ` +
        (off.slice(0, 10).join(" ") || "无") + `｜违宪色残留: ${hits.join(" ") || "无"}`);
    }

    /* ---- J2 后处理栈 ---- */
    const pp0 = await G(() => {
      const d = window.__game && window.__game.debug;
      return (d && typeof d.pp === "function") ? d.pp() : null;
    });
    if (!pp0) {
      report("J2 后处理栈顺序", false, "钩子缺失（debug.pp 不存在）");
    } else {
      const orderOk = Array.isArray(pp0.order) && pp0.order.join(",") === "bloom,tone,vignette,grain";
      /* 活读：改 VC 一个值，pp() 必须反映 */
      const live = await G(() => {
        if (!window.VISUAL_CONFIG) return { ok: false, why: "VISUAL_CONFIG 不存在" };
        const old = window.VISUAL_CONFIG.bloom.gain;
        window.VISUAL_CONFIG.bloom.gain = 0.91;
        const seen = window.__game.debug.pp().params.bloom.gain;
        window.VISUAL_CONFIG.bloom.gain = old;
        return { ok: seen === 0.91, seen };
      });
      /* 像素证据（2026-10-14 采样法修复：旧法＝两次独立刀，第二次落连段二（comboT=2.5s 内）
         弧型/相位不同 ⇒ flake（实测出现 −0.75，历史 +5.85/+15.1）；新法＝单次刀→120ms 弧中
         setHitstop 冻结→冻结中同帧 bloom 关/开双采（取证 _diag-j4-freeze.cjs[C]：冻结弧带
         正对照 Δ=+6.03 确定可复现）。判据不动（+≥3）；无冻结钩子自动退化回旧双刀法。 */
      await page.keyboard.press("Enter"); await sleep(500);
      const canFz2 = await G(() => { const d = window.__game.debug; return !!(d && typeof d.setHitstop === "function"); });
      const arcBoxOf = async () => {
        const s = await G(() => window.__game.state());
        /* 刀弧包围盒（弧心 x+26,y−30、半径 50、θ∈[−1.25,−0.35] ⇒ 弧体落在 x+42..x+73, y−77..y−47）；
           框取 x+16..x+80, y−82..y−42 完整包住弧体＋周边辉光。 */
        return [s.player.x + 16, s.player.x + 80, s.player.y - 82, s.player.y - 42];
      };
      const slashMean = async (bloomOn) => {                /* 退化法（无冻结钩子）：两次独立刀 B 采样 */
        await G((on) => window.__game.debug.setPP({ bloom: { enabled: on } }), bloomOn);
        await sleep(280);
        await page.keyboard.press("KeyJ");
        await sleep(120);
        const b = await arcBoxOf();
        const m = await meanBox(b[0], b[1], b[2], b[3]);
        await sleep(650);
        return m;
      };
      let bloomHi = null, bloomLo = null, bloomWhy = "";
      try {
        if (canFz2) {
          await G(() => { const d = window.__game.debug; if (typeof d.clearWave === "function") d.clearWave(); });
          await page.keyboard.press("KeyJ"); await sleep(120);
          await G(() => window.__game.debug.setHitstop(4)); await sleep(300);
          const b2 = await arcBoxOf();
          await G(() => window.__game.debug.setPP({ bloom: { enabled: false } })); await sleep(200);
          bloomLo = await meanBox(b2[0], b2[1], b2[2], b2[3]);
          await G(() => window.__game.debug.setPP({ bloom: { enabled: true } })); await sleep(200);
          bloomHi = await meanBox(b2[0], b2[1], b2[2], b2[3]);
          await G(() => window.__game.debug.setHitstop(0));
        } else { bloomLo = await slashMean(false); bloomHi = await slashMean(true); }
      }
      catch (e) { bloomWhy = "像素采样异常 " + e.message; }
      const bloomOk = bloomHi !== null && bloomLo !== null && (bloomHi - bloomLo) >= 3;
      /* vignette：关→开 角区变暗；中心/月盘恒等 */
      await G(() => window.__game.debug.setPP({ bloom: { enabled: true }, vignette: { enabled: false } }));
      await sleep(300);
      const cOff = await meanBox(4, 36, 4, 36), midOff = await meanBox(560, 640, 280, 340), moonOff = await meanBox(735, 765, 105, 135);
      await G(() => window.__game.debug.setPP({ vignette: { enabled: true } }));
      await sleep(300);
      const cOn = await meanBox(4, 36, 4, 36), midOn = await meanBox(560, 640, 280, 340), moonOn = await meanBox(735, 765, 105, 135);
      const vDark = (cOff !== null && cOn !== null) ? (cOff - cOn) : null;
      const vMid = (midOff !== null && midOn !== null) ? Math.abs(midOff - midOn) : null;
      const vMoon = (moonOff !== null && moonOn !== null) ? Math.abs(moonOff - moonOn) : null;
      const vOk = vDark !== null && vDark >= 0.8 && vMid !== null && vMid <= 0.15 && vMoon !== null && vMoon <= 0.10;
      report("J2 后处理栈顺序", orderOk && live.ok && bloomOk && vOk,
        `顺序=[${(pp0.order || []).join(",")}]（=bloom,tone,vignette,grain）｜活读 ${live.ok ? "✓" : "✗" + JSON.stringify(live)}｜` +
        `bloom 刀弧区 ${bloomLo === null ? "?" : bloomLo.toFixed(2)}→${bloomHi === null ? "?" : bloomHi.toFixed(2)}（+≥3，${canFz2 ? "冻结单刀" : "退化双刀"}）` +
        (bloomWhy ? "（" + bloomWhy + "）" : "") +
        `｜vignette 角区变暗 ${vDark === null ? "?" : vDark.toFixed(2)}（≥0.8） 中心|Δ| ${vMid === null ? "?" : vMid.toFixed(3)}（≤0.15） 月盘|Δ| ${vMoon === null ? "?" : vMoon.toFixed(3)}（≤0.10）`);
      await G(() => window.__game.debug.setPP({ bloom: { enabled: true }, vignette: { enabled: true } })).catch(() => {});
    }

    /* ---- J3 动态层级帧率 + 视差数学 ---- */
    const hasLS = await G(() => {
      const d = window.__game && window.__game.debug;
      return !!(d && typeof d.layerStats === "function" && typeof d.layers === "function");
    });
    if (!hasLS) {
      report("J3 动态层级帧率", false, "钩子缺失（debug.layerStats/layers 不存在）");
    } else {
      await G(() => window.__game.debug.layerStats(0)); // 重置
      await sleep(2000);
      const ls = await G(() => window.__game.debug.layerStats(0));
      const farFps = ls.far / 2, midFps = ls.mid / 2, fgFps = ls.fg / 2;
      const fpsOk = farFps >= 12 && farFps <= 18 && midFps >= 25 && midFps <= 35 && fgFps >= 45;
      const mv = await G(() => {
        window.__game.debug.setPlayerX(480); const a = window.__game.debug.layers();
        window.__game.debug.setPlayerX(580); const b = window.__game.debug.layers();
        window.__game.debug.setPlayerX(480); return { a, b };
      });
      const mathOk = (mv.b.far - mv.a.far) === 8 && (mv.b.mid - mv.a.mid) === 12;
      report("J3 动态层级帧率", fpsOk && mathOk,
        `2s 实测 far=${farFps.toFixed(1)}fps（[12,18]） mid=${midFps.toFixed(1)}fps（[25,35]） fg=${fgFps.toFixed(1)}fps（≥45）｜` +
        `视差 480→580：far ${mv.a.far}→${mv.b.far}（Δ=8） mid ${mv.a.mid}→${mv.b.mid}（Δ=12）`);
    }

    /* ---- J4 描边规则 + 元素不浮 ---- */
    const prof = await G(() => {
      const d = window.__game && window.__game.debug;
      if (!d || typeof d.strokeProfile !== "function") return null;
      try { return d.strokeProfile(); } catch (e) { return { err: String(e) }; }
    });
    if (!prof) {
      report("J4 描边规则", false, "钩子缺失（debug.strokeProfile 不存在）");
    } else {
      const p = prof.player || {};
      const structOk = proc(p);
      function proc(p) {
        return p.layers === 3 && p.glowW === 3.2 && p.glowA === 0.25 && String(p.core).toLowerCase() === "#0b1322" &&
          p.thin === 0.34 && prof.bgStroke === 0 && prof.bossBlur === 18 && prof.titleBlur === 26 && prof.otherBlur === 0;
      }
      /* 元素不浮：bloom 关→开，玩家躯干带均值 |Δ|≤2（判据不变）
         采样法修复 2026-10-14：旧法在敌兵存活场景采样——实测被击退污染（px457 时 Δ=−41.6）、
         静置亦有 ±1 相位晃（取证 tools/_diag-j4-freeze.cjs＋shots/suite-logs/）。
         新法＝清场＋setHitstop 冻结画面（噪声地板 0.00；正对照弧带 Δ=+6.03 证灵敏度），
         每态双采取均值。旧版本无 setHitstop 钩子 ⇒ 自动退化回旧采样法。 */
      let coreLo = null, coreHi = null, noiseTxt = "";
      try {
        await G(() => { const d = window.__game.debug; if (typeof d.clearWave === "function") d.clearWave(); }).catch(() => {});
        await G(() => window.__game.debug.setPlayerX(480)); await sleep(600);
        const canFreeze = await G(() => !!(window.__game.debug && typeof window.__game.debug.setHitstop === "function"));
        await G(() => window.__game.debug.setPP({ bloom: { enabled: false } })); await sleep(300);
        if (canFreeze) { await G(() => window.__game.debug.setHitstop(4)); await sleep(300); }
        const lo1 = await meanBox(472, 488, 438, 452); await sleep(300);
        const lo2 = await meanBox(472, 488, 438, 452);
        await G(() => window.__game.debug.setPP({ bloom: { enabled: true } })); await sleep(300);
        const hi1 = await meanBox(472, 488, 438, 452); await sleep(300);
        const hi2 = await meanBox(472, 488, 438, 452);
        if (canFreeze) await G(() => window.__game.debug.setHitstop(0));
        if (lo1 !== null && lo2 !== null && hi1 !== null && hi2 !== null) {
          coreLo = (lo1 + lo2) / 2; coreHi = (hi1 + hi2) / 2;
          noiseTxt = `｜噪声地板 lo±${Math.abs(lo2 - lo1).toFixed(2)} hi±${Math.abs(hi2 - hi1).toFixed(2)}` +
            (canFreeze ? "（冻结采样）" : "（非冻结·退化）");
        }
      } catch (e) { }
      const notFloat = coreLo !== null && coreHi !== null && Math.abs(coreHi - coreLo) <= 2;
      report("J4 描边规则", structOk && notFloat,
        `结构：${JSON.stringify(prof)}｜元素不浮：玩家躯干带 ${coreLo === null ? "?" : coreLo.toFixed(2)}→${coreHi === null ? "?" : coreHi.toFixed(2)}（|Δ|≤2）${noiseTxt}`);
    }

    /* ---- J5 截图三判据（自动代理＋出图） ---- */
    const hasAll = await G(() => {
      const d = window.__game && window.__game.debug;
      return !!(d && typeof d.layers === "function" && typeof d.setPP === "function");
    });
    if (!hasAll) {
      report("J5 截图三判据", false, "钩子缺失（layers/setPP）——出图供人工目检的自动代理不可评");
      await shot("red-state");
    } else {
      /* —— 新协议（2026-10-14，根因取证 _diag-drawx/_diag-j5b）：palKey 翻幕（game.js:712）在
         wave1 生成时排 wave2、wave2 排 cleared ⇒ 整层重烤，跨翻面像素对比全带变化 ⇒ 必须主动
         reset 并重放全链等 cleared 且无仪式（仪式分支每帧随机颗粒 game.js:1228 亦污染对比）。
         探针校准：链 7.7s；静帧 d0=0.02；远景 argmin=8 残差 0.04（d0=3.88）；平台 argmin=0 残差
         1.02（±8 处 ~40）；端帽列 Δ=0。 —— */
      const hasReset = await G(() => { const d = window.__game.debug; return typeof d.reset === "function"; });
      const canFz5 = await G(() => { const d = window.__game.debug; return typeof d.setHitstop === "function"; });
      let chainSec = 0, chainOk = true;
      if (hasReset) {
        await G(() => { window.__game.debug.reset(); window.__game.debug.setPlayerX(480); });
        const t0 = Date.now();
        let st5 = null;
        for (let i = 0; i < 80; i++) {
          st5 = await G(() => { const s = window.__game.state();
            return { cleared: s.cleared, cer: !!s.staging.ceremony }; });
          if (st5.cleared && !st5.cer) break;
          await G(() => window.__game.debug.clearWave());   /* 链为计时器驱动，与敌存活无关；防敌近身 */
          await sleep(500);
        }
        chainSec = +((Date.now() - t0) / 1000).toFixed(1);
        chainOk = !!(st5 && st5.cleared && !st5.cer);
      }
      /* 静止环境：清场、离敌、站定 */
      await G(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(480); });
      await sleep(400);
      const grab = (x, y, w, h) => page.evaluate((a) => {
        const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
        return Array.from(g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), Math.round(a[2] * k), Math.round(a[3] * k)).data);
      }, [x, y, w, h]);
      /* 步幅修复 2026-10-14：原以 w*1.5（假定 dpr=1.5）跨步，实际 k=cv.width/960=1.0 ⇒
         450 宽步幅踏 300 宽缓冲越界 → 全 NaN → 哨兵 best=-99/bestD=Infinity（J5 永远无法转绿）。
         现按活读 k 计设备像素宽/高（grab 同源），越界即除根。 */
      const kLive = await G(() => document.getElementById("cv").width / 960);
      const W300 = Math.round(300 * kLive), H80 = Math.round(80 * kLive);
      const WPlat = Math.round(28 * kLive), HPlat = Math.round(16 * kLive);
      /* 相关评分：全重叠采样（off 负向亦计入，旧法只扫 0..12 漏掉反向谷） */
      const dAt = (A, B, wpx, rows, off, step) => {
        step = step || 3;
        let d = 0, n = 0;
        const xa = Math.max(0, -off), xb = Math.min(wpx, wpx - off);
        for (let y = 0; y < rows; y += step) for (let x = xa; x < xb; x += step) {
          const i = ((y * wpx) + x) * 4, j = ((y * wpx) + x + off) * 4;
          d += Math.abs(A[i] - B[j]) + Math.abs(A[i + 1] - B[j + 1]) + Math.abs(A[i + 2] - B[j + 2]); n++;
        }
        return n ? +(d / n).toFixed(2) : Infinity;
      };
      const corrScan = (A, B, wpx, rows, step) => {
        const out = []; for (let off = -12; off <= 12; off++) out.push(dAt(A, B, wpx, rows, off, step)); return out; };
      const argMin = (curve) => { let best = -99, bestD = Infinity;
        curve.forEach((d, i) => { if (d < bestD) { bestD = d; best = i - 12; } }); return { best, bestD }; };
      const strokeCol = (buf, wpx, rows) => {  /* 端帽竖线列：列均值 B−R 峰值列（青端帽 #7df9ff66） */
        let bestX = -1, bestV = -1e9;
        for (let x = 0; x < wpx; x++) {
          let s = 0; for (let y = 0; y < rows; y++) { const i = ((y * wpx) + x) * 4; s += buf[i + 2] - buf[i]; }
          s /= rows; if (s > bestV) { bestV = s; bestX = x; }
        } return { x: bestX, v: +bestV.toFixed(1) }; };
      /* 静帧预检：同位置双抓 250ms，帧差须 ≤1.0（≤10 试；冻结/清场后应一次即静） */
      let quietD0 = null, quietTries = 0;
      for (let i = 0; i < 10; i++) {
        quietTries = i + 1;
        const q1 = await grab(100, 265, 300, 80); await sleep(250);
        const q2 = await grab(100, 265, 300, 80);
        quietD0 = dAt(q1, q2, W300, H80, 0, 3);
        if (quietD0 <= 1.0) break;
      }
      /* ① 颜色不跳：静帧 100ms 均值帧差。
         W5-1 收口修正（2026-10-16，先例＝Loop 8 教训②「改带位避闪烁提示带」）：原窗 (300,660,60,140)
         与清场态「按 J 开拍·下一场／按 R 再来一次」提示字带（y≈72-135，绝对时钟 sin 闪烁——冻结仍在闪、
         Math.random 栈自证与其无关）空间重叠 ⇒ 采样值按闪烁相位抽签（同条件连测：0.14…1.87，阈值 1.5
         落在分布内 ⇒ 历轮 W4.1/W3/W2 侥幸绿）。挪到左空天纯净区（x40-340 无字无色块；v012-X4 只读点在同区
         但本闸只读像素零耦合）。实测对照：老窗 10 连测 [1.43,1.87,1.84,1.83,1.43,0.48,0.18,0.77,1.34,1.79]
         vs 新窗 5 连测全 0.00。与 W5-1 剪影重设计零关联（玩家域 x>400/y>380 与原窗零交）。 */
      const f1 = await meanRGB(40, 340, 60, 140); await sleep(100);
      const f2 = await meanRGB(40, 340, 60, 140);
      const colorJump = f1 && f2 ? Math.max(...[0, 1, 2].map(i => Math.abs(f1[i] - f2[i]))) : null;
      /* ② 层级有深：远景专属带（y265-345）互相关位移应=8px；平台带（前景）位移应=0px
         （盒含左端帽 x250 列位；冻结中对抓，抗相位噪声） */
      await G(() => window.__game.debug.setPlatforms([{ x: 250, y: 380, w: 180, h: 16 }])).catch(() => {});
      if (canFz5) await G(() => window.__game.debug.setHitstop(4));
      await G(() => window.__game.debug.setPlayerX(480)).catch(() => {}); await sleep(300);
      const bandA = await grab(100, 265, 300, 80);
      const platA = await grab(238, 372, 28, 16);
      await G(() => window.__game.debug.setPlayerX(580)).catch(() => {}); await sleep(350);
      const bandB = await grab(100, 265, 300, 80);
      const platB = await grab(238, 372, 28, 16);
      if (canFz5) await G(() => window.__game.debug.setHitstop(0)).catch(() => {});
      const farCurve = corrScan(bandA, bandB, W300, H80, 3);
      const farC = argMin(farCurve);
      const d0band = dAt(bandA, bandB, W300, H80, 0, 3);
      const platCurve = corrScan(platA, platB, WPlat, HPlat, 1);
      const platC = argMin(platCurve);
      const platEdgeD = Math.min(platCurve[4], platCurve[20]);   /* off=±8 处对比下界 */
      const sA = strokeCol(platA, WPlat, HPlat), sB = strokeCol(platB, WPlat, HPlat);
      const farOk = farC.best >= 6.5 && farC.best <= 9.5 && farC.bestD <= 2.0 && farC.bestD <= 0.7 * d0band;
      const platOk = platC.best === 0 && platC.bestD <= 2.0 && platEdgeD >= 10 && sA.x === sB.x;
      const quietOk = quietD0 !== null && quietD0 <= 1.0;
      await shot("layers-x580");
      await G(() => window.__game.debug.setPlayerX(480)); await sleep(250);
      await shot("layers-x480");
      /* ③ 暗角出图 */
      await G(() => { window.__game.debug.setPP({ vignette: { enabled: true } }); window.__game.debug.setPlatforms([]); }).catch(() => {});
      await sleep(300);
      await shot("vignette-on");
      await G(() => window.__game.debug.setPP({ vignette: { enabled: false } }));
      await sleep(300);
      await shot("vignette-off");
      await G(() => window.__game.debug.setPP({ vignette: { enabled: true } }));
      report("J5 截图三判据", colorJump !== null && colorJump <= 1.5 && farOk && platOk && chainOk && quietOk,
        `①颜色不跳 帧差=${colorJump === null ? "?" : colorJump.toFixed(2)}（≤1.5）｜` +
        `②层级有深 远景带 argmin=${farC.best}px（∈[6.5,9.5] 残差${farC.bestD.toFixed(2)} ≤0.7×d0=${(0.7 * d0band).toFixed(2)}）｜` +
        `平台 argmin=${platC.best}px（=0 残差${platC.bestD.toFixed(2)}≤2 边差${platEdgeD.toFixed(1)}≥10） 端帽列Δ=${sA.x - sB.x}（=0，列值${sA.v}/${sB.v}）｜` +
        `静帧 d0=${quietD0 === null ? "?" : quietD0.toFixed(2)}（${quietTries}试≤1.0） 链=${hasReset ? chainSec + "s" + (chainOk ? "✓" : "✗") : "旧版跳过"} ` +
        `${canFz5 ? "冻结采样" : "非冻结"}｜` +
        `③暗角见 J2（出图 shots/verify-visual-v1/*.png 供人工目检三判据）`);
    }

    /* ---- V-0 ---- */
    report("V0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 4).join(" | "));
  } catch (e) {
    console.log("CHAIR-SCRIPT-ERROR", e && e.stack || e);
    report("script", false, String(e));
  }
  await browser.close().catch(() => {});
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})();
