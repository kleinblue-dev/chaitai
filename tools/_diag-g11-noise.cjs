#!/usr/bin/env node
/* _diag-g11-noise.cjs —— 诊断探针（只读，不改游戏/不改闸/不改判据）：
   W6.1 全套复跑 gate-11 左路红（G11.10 面积比 0.803；G11-DATA-L bgNoisePx=657 removedPx=153）根因定位。
   假设（源码推导）：mid 层 30fps 重烤（visual-config layers.mid.fps=30），7 盏琥珀街灯
   LX=[60,150,300,400,520,700,830]，lx=300 灯 ly=406+((2*5)%7)=409、r=26、四档 α=0.10+0.10*(lv/3)；
   玩家 x=300 时 layOffM=clamp(round((300-480)*0.20))=-12 ⇒ 该灯屏幕 x=288，梯度 [262,314]×[383,435]，
   正压采样区 CROP=[230,370]×[385,472] 且正压玩家剪影（W5-1 红档「12px 卫星块@(267,403)」＝本灯左缘）。
   B1L→B2L 两抓相隔 ~495ms，mid 每 33ms 重烤 ⇒ 两抓所见四档相位可跨档；lv 跨 ≥2 档 ⇒ Δα=0.0667
   ⇒ 变像素 ≈π·13.8²≈600（观测 657 同族）⇒ maskClean 的 2px 膨胀剔噪把 153px 剪影腿脚误吃。
   本探针复刻 B 对协议：15 对「生产窗」（与 gate-11 逐字一致 95 / 400+95）＋15 对「长窗」
   （B2=400+430+430+95 补传链，Δtok≈1260ms；每落段 ≤430ms＜触景顶 530ms 约束、setPlayerPos
   每段清零 vy ⇒ 视差同 x 零位移），把命中率抬到 ~6 成/对。逐对报 |B1−B2|≥8 变像素数＋变区 bbox
   （换算游戏坐标）＋窗内 LAY 重烤计数＋旁白净；命中（>64px 且两抓旁白净）落盘三联图 B1|B2|diff红。
   跑法：node tools/_diag-g11-noise.cjs        （约 90 秒） */
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT = path.join(ROOT, "shots", "g11-noise-diag");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/* 与 gate-11 同：crop(x0,y0,x1,y1)=(230,385,370,472) */
const CROP = [230, 370, 385, 472];

function crc32(buf) { let crc = 0xffffffff; for (let i = 0; i < buf.length; i++) { crc ^= buf[i]; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); }
function writePNG(file, w, h, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  fs.writeFileSync(file, Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]));
}
function triPNG(file, A, B) {
  const w = A.w, h = A.h, GAP = 4, W = w * 3 + GAP * 2, buf = Buffer.alloc(W * h * 3); buf.fill(40);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y * w + x) * 4, o1 = (y * W + x) * 3, o2 = (y * W + w + GAP + x) * 3, o3 = (y * W + 2 * w + 2 * GAP + x) * 3;
    buf[o1] = A.data[j]; buf[o1 + 1] = A.data[j + 1]; buf[o1 + 2] = A.data[j + 2];
    buf[o2] = B.data[j]; buf[o2 + 1] = B.data[j + 1]; buf[o2 + 2] = B.data[j + 2];
    const ch = Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= 8;
    buf[o3] = ch ? 255 : (A.data[j] >> 1); buf[o3 + 1] = ch ? 90 : (A.data[j + 1] >> 1); buf[o3 + 2] = ch ? 90 : (A.data[j + 2] >> 1);
  }
  writePNG(file, W, h, buf);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  const narrClean = () => G(() => { const n = window.__game.state().narrator; return !n.current && n.queueLen === 0; }).catch(() => true);
  const waitClean = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 12000)) { if (await narrClean()) return true; await sleep(150); } return false; };
  const crop = (x0, y0, x1, y1) => G((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const w = Math.round((a[2] - a[0]) * k), h = Math.round((a[3] - a[1]) * k);
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), w, h).data;
    return { w: w, h: h, k: k, data: Array.prototype.slice.call(d) };
  }, [x0, y0, x1, y1]);
  const grab = () => crop(CROP[0], CROP[2], CROP[1], CROP[3]);
  function diffBB(A, B) { const n = A.w * A.h; let c = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, sx = 0;
    for (let i = 0; i < n; i++) { const j = i * 4;
      if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= 8) {
        c++; const x = i % A.w, y = (i - x) / A.w; sx += x;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return { c: c, x0: x0, y0: y0, x1: x1, y1: y1, mx: c ? sx / c : -1, k: A.k };
  }
  /* B1：与 bGrabGuarded("B1",95,0) 逐字同窗（解冻→传(300,160)→95ms→冻结→180ms→抓） */
  async function grabB1() {
    await G(() => { const d = window.__game.debug; d.setHitstop(0); d.setPlayerPos(300, 160); });
    await sleep(95);
    await G(() => window.__game.debug.setHitstop(600));
    await sleep(180);
    const img = await grab();
    return { img: img, clean: await narrClean() };
  }
  /* B2：生产窗＝与 bGrabGuarded("B2",400,95) 逐字同；长窗＝多插两段 430ms 补传（Δtok 抬到 ~1260ms） */
  async function grabB2(prod) {
    await G(() => { const d = window.__game.debug; d.setHitstop(0); d.setPlayerPos(300, 160); });
    await sleep(400);
    if (!prod) for (let i = 0; i < 2; i++) { await G(() => window.__game.debug.setPlayerPos(300, 160)); await sleep(430); }
    await G(() => window.__game.debug.setPlayerPos(300, 160));
    await sleep(95);
    await G(() => window.__game.debug.setHitstop(600));
    await sleep(180);
    const img = await grab();
    return { img: img, clean: await narrClean() };
  }

  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(1200);
  await page.keyboard.press("Enter");
  { let ok = false; for (let i = 0; i < 40; i++) { const s = await G(() => window.__game.state()).catch(() => null); if (s && s.phase === "playing") { ok = true; break; } await sleep(200); } if (!ok) { console.log("!! 未能进入 playing"); process.exit(2); } }
  await sleep(2600);
  await G(() => { const d = window.__game.debug; d.setDust(0); d.setEmber(0); d.setShadow(false); });
  await G(() => window.__game.debug.setPlayerX(300));
  await sleep(900);
  await sleep(3700); /* 与 gate-11 同节奏：静候 guide_right（t>7）与空闲短句响完 */
  await waitClean();

  const LY = await G(() => window.__game.debug.layers());
  console.log("== gate-11 背景噪声诊断（B 对协议复刻；只读）==");
  console.log("layers 契约（player.x=300）：far=" + LY.far + " mid=" + LY.mid + " fg=" + LY.fg + "（预期 mid=-12 ⇒ 灯 lx=300 落屏 x=288）");
  console.log("参照：失败轮 G11-DATA-L bgNoisePx=657 removedPx=153 ⇒ 面积比 0.803；干净轮 bgNoisePx=7");
  const stats = { prodMax: -1, longMax: -1, prodDirty: 0, longDirty: 0 };
  let dumped = 0;
  for (let g = 0; g < 2; g++) {
    const prod = (g === 0), N = 15;
    for (let it = 1; it <= N; it++) {
      const B1 = await grabB1();
      await G(() => window.__game.debug.layerStats(0));
      const B2 = await grabB2(prod);
      const L = await G(() => window.__game.debug.layerStats(0));
      const dd = diffBB(B1.img, B2.img);
      const gx = (v) => Math.round(CROP[0] + v / dd.k), gy = (v) => Math.round(CROP[2] + v / dd.k);
      const dirty = dd.c > 64 && B1.clean && B2.clean;
      console.log("[" + (prod ? "生产窗" : "长窗  ") + " 对" + (it < 10 ? " " : "") + it + "] |B1−B2|=" + String(dd.c).padStart(4) + "px  bbox 游戏坐标=[" + gx(dd.x0) + "," + gy(dd.y0) + "]..[" + gx(dd.x1) + "," + gy(dd.y1) + "]  质心x=" + (dd.c ? Math.round(CROP[0] + dd.mx / dd.k) : -1) + "  mid烤=" + L.mid + " far烤=" + L.far + "  旁白净=" + B1.clean + "/" + B2.clean + (dirty ? "  ★事件" : (dd.c > 64 ? "  （旁白干扰，不计）" : "")));
      if (prod) { if (dd.c > stats.prodMax) stats.prodMax = dd.c; if (dirty) stats.prodDirty++; }
      else { if (dd.c > stats.longMax) stats.longMax = dd.c; if (dirty) stats.longDirty++; }
      if (dirty && dumped < 3) { dumped++; triPNG(path.join(OUT, (prod ? "prod" : "long") + "-pair" + it + "-noise" + dd.c + ".png"), B1.img, B2.img); console.log("   → 三联图落盘 shots/g11-noise-diag/" + (prod ? "prod" : "long") + "-pair" + it + "-noise" + dd.c + ".png"); }
    }
  }
  console.log("---- 汇总 ----");
  console.log("生产窗 15 对：max=" + stats.prodMax + "px  事件数(>64，旁白净)=" + stats.prodDirty + "（理论 ≈3%/对/次）");
  console.log("长窗   15 对：max=" + stats.longMax + "px  事件数(>64，旁白净)=" + stats.longDirty + "（Δtok≈1260ms 抬命中）");
  console.log("预期事件几何：灯 lx=300 ⇒ 屏幕 x=288（offM=−12），梯度 [262,314]×[383,435]；|Δlv|=2 ⇒ 变化 ≈600px");
  console.log("pageerror=" + errs.length + (errs.length ? "：" + errs[0] : ""));
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("崩溃：" + (e && e.stack || e)); process.exit(2); });
