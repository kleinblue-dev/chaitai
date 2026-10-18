/* g15-diag2.cjs —— 一次性诊断（非套件成员；判据/预注册零接触；不产出 PASS/FAIL）
   目的：定案 R10 跑残留现象「精英箱区差 497px 稳定（4 连重抓 500/497/497/497）＋主连通 94.9%」的来源。
   背景（本次源码精读）：
     · 环境灯＝bakeMidTick(game.js:1042-1048)：半径 26css 径向渐变，整盘 alpha=0.10+0.10(lv/3) 四档；
       灯心屏幕位 = lx + layOffM()（:1064 层画在 off−12、纹理内 +12 平移抵消）。
       I 行 park(350)：layOffM=(350−480)×0.20=−26→钳 −12 ⇒ 灯 700 实画于屏幕 x=688；
       现工具探针 lampPix(700) 读屏幕 (700,410)＝离灯心 12px 的渐变边缘（覆盖率≈0.54）。
     · 远景楼窗＝bakeFarTick(game.js:1031-1036)：6×9css fillRect（layDpr=2 ⇒ 12×18 设备px），
       四档闪，条件 (wx*7+wy*13)%5<2 && isFlickWin(wx)——独立于灯的 2.0 vs 2.3 rad/s 相位。
   诊断动作：
     D1（T3 相位，off=+12，未冻结）：区域 [656..744)×[380..440) 5s 时间序列——
        逐 2css 单元「曾变化(≥8)」图＋关键探针像素值序列（含门探针 700 与灯心实位 712/688）。
     D2（park 350 相位，off=−12）：精英追 350 走离 → ①不对齐直接冻结抓 B（量全差）
        → ②解冻跑现工具同款对齐循环（探针 700）→ 再冻结抓 B′（量对齐后残差）
        → 对照 A：掩膜连通块明细（尺寸＋bbox）＋箱区 [674..726]×[384..436] 差分布图
        ＋三探针值 A/B/B′ 对照（测探针鉴别力）。出图 4 张。
   用法：node tools/g15-diag2.cjs  （输出前缀 shots/w7-t2b/diag2-） */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const PFX = process.env.CHAITAI_SHOT_PREFIX || (ROOT.replace(/\\/g, "/") + "/shots/w7-t2b/diag2-");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---- PNG 写出（照 gate-15） ---- */
function crc32(buf) { let crc = 0xffffffff; for (let i = 0; i < buf.length; i++) { crc ^= buf[i]; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); }
function writePNG(file, w, h, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  fs.writeFileSync(file, Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]));
}

(async () => {
  fs.mkdirSync(path.dirname(PFX), { recursive: true });
  console.log("== g15-diag2（一次性诊断；不判 PASS/FAIL）==");
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  const st = () => page.evaluate(() => window.__game.state());
  const dbg = (f, a) => page.evaluate((fn, args) => { const d = window.__game.debug; return d[fn].apply(d, args); }, f, a || []);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(60); } return null; };
  const enemies = async () => (await st()).enemies || [];
  const enemyById = async (id) => { const es = await enemies(); for (const e of es) if (e.id === id) return e; return null; };
  const eliteInfo = async () => { const es = await enemies(); for (const e of es) if (e.kind === "elite") return e; return null; };
  const crop = (x0, y0, x1, y1) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const w = Math.round((a[2] - a[0]) * k), h = Math.round((a[3] - a[1]) * k);
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), w, h).data;
    return { w: w, h: h, k: k, data: Array.prototype.slice.call(d) };
  }, [x0, y0, x1, y1]);
  function diffCount(A, B) { let c = 0; for (let i = 0; i < A.w * A.h; i++) { const j = i * 4; if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= 8) c++; } return c; }
  function compsOf(A, B) { /* |A−B|≥8 连通块（8邻域）→ [{sz,x0,y0,x1,y1}] 降序 */
    const w = A.w, h = A.h, m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { const j = i * 4; if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= 8) m[i] = 1; }
    const seen = new Uint8Array(w * h), comps = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i0 = y * w + x; if (!m[i0] || seen[i0]) continue;
      let sz = 0, cx0 = 1e9, cy0 = 1e9, cx1 = -1, cy1 = -1; const q = [i0]; seen[i0] = 1;
      while (q.length) { const i = q.pop(); sz++; const cx = i % w, cy = (i - cx) / w;
        if (cx < cx0) cx0 = cx; if (cx > cx1) cx1 = cx; if (cy < cy0) cy0 = cy; if (cy > cy1) cy1 = cy;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const ni = ny * w + nx; if (m[ni] && !seen[ni]) { seen[ni] = 1; q.push(ni); } } }
      comps.push({ sz, x0: cx0, y0: cy0, x1: cx1, y1: cy1 }); }
    comps.sort((a, b) => b.sz - a.sz); return { comps, m, w, h };
  }
  const probe = (pxs) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    return a.map(p => { const d = g.getImageData(Math.round(p[0] * k), Math.round(p[1] * k), 1, 1).data; return [d[0], d[1], d[2]]; });
  }, pxs);

  /* ---------- 走链（复刻 gate-15 序章段）→ E1-3 精英 ---------- */
  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter"); await sleep(700);
  await dbg("setPlayerX", [430]);
  const w1 = await until(async () => { const s = await st(); return s.enemies.length >= 2 ? s : null; }, 4500);
  await dbg("clearWave");
  const w2 = await until(async () => { const s = await st(); return s.enemies.length >= 3 ? s : null; }, 4500);
  await dbg("clearWave");
  await until(async () => { const s = await st(); return s.cleared ? s : null; }, 7000);
  await until(async () => { const s = await st(); return s.continueReady ? s : null; }, 9000);
  await page.keyboard.press("KeyJ"); await sleep(300);
  const s2 = await st(); if (s2.act !== 2) throw new Error("未进 act2");
  await dbg("setPlayerX", [430]);
  await until(async () => (await enemies()).length >= 2, 4500); await dbg("clearWave");
  await dbg("setPlayerX", [430]);
  await until(async () => (await enemies()).length >= 3, 5000); await dbg("clearWave");
  await sleep(600);
  await dbg("setPlayerPos", [828, 300]);
  const b3 = await until(async () => { const s = await st(); return (s.lastSpawn && s.lastSpawn.id === "E1-3") ? s.lastSpawn.born : null; }, 3000);
  if (!b3) throw new Error("E1-3 未出生");
  console.log("   [走链] E1-3 born=" + b3.map(e => e.k + "@" + Math.round(e.x)).join(","));
  /* 杀非精英（同 gate-15） */
  await page.evaluate(() => { const d = window.__game.debug, S = window.__game.state;
    for (const e of S().enemies) { if (e.kind === "elite" || e.hp <= 0) continue;
      for (let i = 0; i < 30; i++) { const cur = S().enemies.filter(x => x.id === e.id)[0]; if (!cur || cur.hp <= 0) break; d.enemyHit(e.id, 50); } } });
  const el0 = await eliteInfo();
  console.log("   [走链] 精英 id=" + el0.id + " x=" + Math.round(el0.x) + " 玩家@828");
  const offT3 = await page.evaluate(() => window.__game.debug.layers().mid);
  console.log("   [层偏移] T3 相位 mid=" + offT3 + " ⇒ 灯700 屏幕 x=" + (700 + offT3) + " · 灯830 屏幕 x=" + (830 + offT3));

  /* ---------- D1：灯箱区 5s 闪烁足迹（未冻结） ---------- */
  console.log("---- D1 灯箱区时间序列（region css x[656..744) y[380..440)，46 采样 ×110ms）----");
  const D1 = await page.evaluate((a) => new Promise((res) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const X0 = a.X0, Y0 = a.Y0, Wc = a.Wc, Hc = a.Hc; /* css */
    const w = Math.round(Wc * k), h = Math.round(Hc * k);
    const grab = () => g.getImageData(Math.round(X0 * k), Math.round(Y0 * k), w, h).data;
    const P0 = grab(); const cells = {}; let count = 0;
    const probes = [[700, 410], [688, 410], [712, 410], [700, 396], [700, 424], [726, 430], [674, 430]];
    const series = [];
    let t = 0;
    (function tick() {
      const P = grab(); let ch = 0;
      for (let i = 0; i < w * h; i++) { const j = i * 4;
        if (Math.max(Math.abs(P[j] - P0[j]), Math.abs(P[j + 1] - P0[j + 1]), Math.abs(P[j + 2] - P0[j + 2])) >= 8) {
          ch++; const cx = Math.floor((i % w) / (2 * k)), cy = Math.floor(Math.floor(i / w) / (2 * k)); cells[cx + "," + cy] = 1; } }
      count += ch;
      const pv = probes.map(p => { const d = g.getImageData(Math.round(p[0] * k), Math.round(p[1] * k), 1, 1).data; return d[0] + "," + d[1] + "," + d[2]; });
      series.push({ t: t, ch: ch, p: pv });
      t += 110;
      if (t < 46 * 110) setTimeout(tick, 110); else res({ series: series, cells: Object.keys(cells), Wc: Wc, Hc: Hc });
    })();
  }), { X0: 656, Y0: 380, Wc: 88, Hc: 60 });
  /* 变化单元图（2css/格，44×30） */
  const grid = Array.from({ length: 30 }, () => new Array(44).fill("."));
  for (const c of D1.cells) { const [cx, cy] = c.split(",").map(Number); if (cy < 30 && cx < 44) grid[cy][cx] = "#"; }
  console.log("   曾变化(≥8)单元图（每格 2css；行=cy 0..29 即 y 380..440，列=cx 0..43 即 x 656..744）:");
  console.log("     " + "0123456789".repeat(5).slice(0, 44));
  for (let r = 0; r < 30; r++) console.log("   y" + (380 + r * 2) + " " + grid[r].join(""));
  const tot = D1.series.reduce((s, x) => s + x.ch, 0);
  console.log("   逐采样变化数（对 vs 样本0）：" + D1.series.map(x => x.ch).join(","));
  console.log("   探针值序列（t: p700 p688 p712 p700@396 p700@424 p726@430 p674@430）：");
  for (const s of D1.series) if (s.t % 550 === 0) console.log("     t=" + s.t + "ms  " + s.p.map(v => "(" + v + ")").join(" "));

  /* ---------- D2：A/B/B′ 三帧（park 350；off=−12） ---------- */
  console.log("---- D2 A/B/B′（park 350；精英走离前提同 R10）----");
  await dbg("setPlayerPos", [350, 470]);
  await sleep(150);
  const offI = await page.evaluate(() => window.__game.debug.layers().mid);
  console.log("   [层偏移] I 相位 mid=" + offI + " ⇒ 灯700 屏幕 x=" + (700 + offI) + " · 灯830 屏幕 x=" + (830 + offI));
  await dbg("setHitstop", [600]); await sleep(180);
  const eA = await eliteInfo(); const cxA = eA.x;
  const winX0 = Math.max(0, Math.round(cxA - 70));
  const A = await crop(winX0, 365, Math.min(960, Math.round(cxA + 70)), 480);
  const pA = await probe([[688, 410], [700, 410], [712, 410]]);
  console.log("   A 冻结: cxA=" + cxA.toFixed(1) + " 窗x0=" + winX0 + " 探针[688,700,712]@A=" + JSON.stringify(pA));
  /* ①不对齐：直接解冻走离再冻结 → B */
  await dbg("setHitstop", [0]);
  const tWalk = Date.now();
  const away = await until(async () => { const e = await enemyById(el0.id); return (e && e.x <= cxA - 100) ? e : null; }, 9000);
  console.log("   走离: " + (away ? ("达 x=" + away.x.toFixed(1) + " 用时 " + (Date.now() - tWalk) + "ms") : "9s 未达"));
  await sleep(700); /* 故意放任意相位 */
  await dbg("setHitstop", [600]); await sleep(120);
  const B = await crop(winX0, 365, Math.min(960, Math.round(cxA + 70)), 480);
  await sleep(220);
  const B2 = await crop(winX0, 365, Math.min(960, Math.round(cxA + 70)), 480);
  const pB = await probe([[688, 410], [700, 410], [712, 410]]);
  const dB = diffCount(A, B), dB2 = diffCount(B, B2);
  console.log("   B 冻结(不对齐): |A−B|=" + dB + "px |B−B2|=" + dB2 + "px 探针[688,700,712]@B=" + JSON.stringify(pB));
  /* ②现工具同款对齐（探针 700）→ B′ */
  const want = pA[1]; /* 探针 700 @ A */
  await dbg("setHitstop", [0]);
  let aligned = false; const tA0 = Date.now();
  while (Date.now() - tA0 < 3500) { const now = await probe([[700, 410]]);
    if (Math.abs(now[0][0] - want[0]) <= 2 && Math.abs(now[0][1] - want[1]) <= 2 && Math.abs(now[0][2] - want[2]) <= 2) { aligned = true; break; } await sleep(35); }
  await dbg("setHitstop", [600]); await sleep(120);
  const Bp = await crop(winX0, 365, Math.min(960, Math.round(cxA + 70)), 480);
  const pBp = await probe([[688, 410], [700, 410], [712, 410]]);
  const dBp = diffCount(A, Bp);
  console.log("   B′ 冻结(对齐探针700 " + (aligned ? "达成@" + (Date.now() - tA0) + "ms" : "3.5s 未达成") + "): |A−B′|=" + dBp + "px 探针[688,700,712]@B′=" + JSON.stringify(pBp));

  /* ---------- 掩膜连通块 + 箱区分布（B′ 为主，B 对照） ---------- */
  for (const [name, BF] of [["B", B], ["B'", Bp]]) {
    const R = compsOf(A, BF);
    console.log("   [连通块 |A−" + name + "|] 块数=" + R.comps.length + " 前8：" + R.comps.slice(0, 8).map(c => c.sz + "@[" + c.x0 + "," + c.y0 + ".." + c.x1 + "," + c.y1 + "]").join(" "));
    /* 箱区 [674..726]×[384..436] 差图（crop 坐标：减 winX0/365，设备×k） */
    const k = A.k, bx = Math.round((674 - winX0) * k), by = Math.round((384 - 365) * k);
    const bw2 = Math.round((726 - 674) * k), bh2 = Math.round((436 - 384) * k);
    let box = 0; const cellsB = {};
    for (let y = Math.max(0, by); y < Math.min(R.h, by + bh2); y++) for (let x = Math.max(0, bx); x < Math.min(R.w, bx + bw2); x++) {
      if (R.m[y * R.w + x]) { box++; const cx = Math.floor(x / (2 * k)), cy = Math.floor((y) / (2 * k)); cellsB[cx + "," + cy] = 1; } }
    console.log("   [箱区差 |A−" + name + "|] " + box + "px（窗内部分；箱=屏幕[674..726]×[384..436]）");
    const g2 = Array.from({ length: Math.ceil(bh2 / (2 * k)) }, () => new Array(Math.ceil(bw2 / (2 * k))).fill("."));
    for (const c of Object.keys(cellsB)) { const [cx, cy] = c.split(",").map(Number);
      const lx = cx - Math.floor(bx / (2 * k)), ly = cy - Math.floor(by / (2 * k)); if (ly >= 0 && ly < g2.length && lx >= 0 && lx < g2[0].length) g2[ly][lx] = "#"; }
    console.log("   箱区差图（2css/格；行 y384..，列 x674..）：");
    for (const row of g2) console.log("     " + row.join(""));
    /* 出图 */
    const bw = R.w, bh = R.h;
    const cr = Buffer.alloc(bw * bh * 3);
    for (let i = 0; i < bw * bh; i++) { const j = i * 4; const on = R.m[i]; cr[i * 3] = on ? 235 : 16; cr[i * 3 + 1] = on ? 235 : 16; cr[i * 3 + 2] = on ? 245 : 24; }
    writePNG(PFX + "mask-" + (name === "B" ? "B" : "Bp") + ".png", bw, bh, cr);
  }
  /* 原始 A/B 帧出图 */
  for (const [name, F] of [["A", A], ["B", B], ["Bp", Bp]]) {
    const cr = Buffer.alloc(F.w * F.h * 3);
    for (let i = 0; i < F.w * F.h; i++) { const j = i * 4; cr[i * 3] = F.data[j]; cr[i * 3 + 1] = F.data[j + 1]; cr[i * 3 + 2] = F.data[j + 2]; }
    writePNG(PFX + name + ".png", F.w, F.h, cr);
  }
  console.log("   出图: " + PFX + "{A,B,Bp,mask-B,mask-Bp}.png");
  await browser.close().catch(() => {});
  process.exit(0);
})().catch(e => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
