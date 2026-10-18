/* gate-11-silhouette.cjs —— 《拆台》主角剪影可读性闸（W5-1：剪影重设计；先红后绿）
   ============ 目的 ============
   测「主角剪影在 64px 高度下的可读性」三实数 + 身份元素 + 待机动画活性：
   组件数（连通块）／长宽比／填充率（掩膜面积÷外接框）／亮刃与金饰像素数／
   丝带横向摆幅／呼吸灯亮度极差／双朝向镜像。红侧＝现树（定版 379e67ae…）真值留档，
   绿侧＝剪影重设计后全断言过。
   ============ 测量协议（冻结差分掩膜法）============
   ① 玩家定位 x=300、朝向 +1（用「按 KeyD 后 x 增大」作朝向代理，随后 setPlayerX 归位）；
      setShadow(false)（阴影椭圆在 460-467 行，会进窗）；setDust(0)/setEmber(0)（粒尘位移进窗）。
   ② narrClean（current 空 ∧ queueLen=0）后 setHitstop(600) 冻结——冻结窗内世界全停、
      Narr.update 照走（:900）故必须先判空；trauma 衰减在冻结外（:891 每步），定位后静置 ≥900ms。
   ③ 抓帧 A（玩家在场）：窗 CROP=[230,370]×[385,472]（行 385..471）。
      行下界=472 依据 drawRefl（:1023）：反射精灵画在 by+2=472 起 ⇒ 471 及以下无反射；
      y=160 时 k=1−(470−160)/260<0.02 ⇒ 参考帧完全无反射（:1023 早退）。
   ④ 冻结零噪声自证：A 隔 220ms 再抓 A2，|Δ|≥8（通道）像素数须 ≤2（理论 0）。
   ⑤ 参考帧 B（玩家离场）：解冻 → setPlayerPos(300,160)（同 x ⇒ 视差层零位移，J3 数学）→
      95ms 让 rig 收脚 → 再冻结 → 同行同列抓 B1；离场段 ≤495ms 即再补传（落体 ~0.53s 触窗、
      ~0.62s 落地），累计 ~0.6s 世界走表后冻结抓 B2。掩膜 M = |A−B1| 通道差 ≥8，**再剔除
      |B1−B2| 膨胀 2px 邻域**（背景世界时噪声：星点眨眼/层重烤/残旁白字——协议 v1 红档实测
      12px 卫星块@(267,403) 即此，非角色部件；v1 日志 w51-g11-red-protocol-v1.txt 留档；
      v2-crash 教训：离场段过长玩家落回地面 ⇒ 剔噪连掩膜一起吃掉，area=0）。离场玩家体
      y≤290、阴影关、反射 k<0.02、粒尘清空 ⇒ 剔噪后 M=纯剪影。剔除像素数计入 G11-DATA。
   ⑥ 指标全部在掩膜上算；身份色只在 M 内分类（背景同帧两侧相等⇒不在 M）。
   ============ 预注册阈值（写死于此，先红后绿，禁事后调参）============
   几何推导：角色头顶≈412、足底亮像素≈469（V25-C 契约 466..472）⇒ h≈57±；静立宽（含
   丝带尾+刀尖辉光）≈27-40。填充率：第一性原理「64px 可读性 = 实体质量 ≥ 外接框 30%」
   （纯线框 0.15-0.25 读作噪声）；上限 0.70 防掩膜退化整块。组件：可读剪影须 ≤2 块
   （主体 + 允许一处独立装饰），主块 ≥92% 面积。长宽比 1.3-2.6（人形竖长；越界=退化）。
   刃亮像素（#eafcff 系：b≥200∧r≥170∧g≥200）≥15（刃亮线 22px×1.2w≈26px² 推导）；
   金饰（#ffd76a 系：r≥120∧g≥110∧b≤120∧r−b≥70；g≥110 排除敌屑粉 #ff5a78[g=90]、
   b≤120 排除丝带旁紫 #c88bff[b=255]）≥25（头带≈11 + 双丝带描边 ≈15+ 推导；
   仅头带达不到 25 ⇒ M1 删丝带锚定）；丝带摆幅（金像素质心 x 极差，2.0s）≥3.0px
   （现仅宽度波动预计 <1）；呼吸灯（护手区 [290,303]×[452,466] luma 极差，2.0s）≥4.0
   （现恒常 ⇒≈0-3）；镜像面积比 ∈[0.85,1.18]。p95≤25ms 穷举上限。
   ============ 与既有闸的护栏（逐条已核对 10-16）============
   v025-A 带 [310,326]×[463,470]：静立零像素（足端路径 ≤308.5 在案）——本闸不新增前向
   几何（靴楔 ≤+3.0 local）；V25-C 最低亮像素 466..472：呼吸灯半径 ≤2.2、位置护手 15.8 处
   ⇒ 灯底 ≈462.3 不越 466；J1：只用已注册色 #131b2e/#0b1322/#ffd76a/#7df9ff/#eafcff；
   J4：STROKE_SPEC 数值不动（只插新绘制段）；J5 采样带 y≤345 与本测区零交集；
   v027-C3 冻结逐字节：全部新动画用 RIG.t 驱动（冻结即停）；v028 带全在 y≤320/V027 SKY
   y150-178（丝带延长件 y≤440 无交）；drawRefl 行 472、narr 箱 y444-502（CROP 行 385-471
   与箱重叠 ⇒ narrClean 双守卫必须保持；W5.2 补：A/B 全部抓帧点同名旁白守卫——Narr.update
   走 rdt 不受 hitstop 冻结，重响/空闲长句可在解冻窗起播，逐字像素混进 |A−B1| 掩膜与
   |B1−B2| 剔噪邻域把腿脚误扣 ⇒ 曾甩尾 G11.10 面积比 0.78–0.79，复现 1/3）。
   W6.1 补（背景噪声守卫）：mid 层 30fps 重烤街灯 lx=300（ly=409 r=26 四档 α）落屏 x=288
   （layOffM=−12）正在采样区且正压剪影；B1/B2 相跨 ≥2 档 ⇒ |B1−B2| 冲上 656–931px（探针
   tools/_diag-g11-noise.cjs 实测：质心 x=288 与 W6.1 首跑 bgNoisePx=657 逐位吻合；干净
   floor 7–16px；v1 卫星块@(267,403) 即本灯左缘），剔噪膨胀 2px 吃掉剪影腿脚 ⇒ 左面积 746
   面积比 0.803 假红（非游戏回归；同树 falsify-g11 live 13/13 全绿为旁证）。守卫：成对抓完
   复核 |B1−B2|，>64px（预注册＝floor 上界 16px 的 4 倍、事件级 656px 的 1/10）⇒ 整对重抓，
   最多 4 对；重试用尽沿用最后一对并在日志亮明（noiseRetries 进 G11-DATA）。判据/阈值一字未动。
   ============ 用法 ============
   node tools/gate-11-silhouette.cjs   环境：CHAITAI_URL／CHAITAI_SHOT_PREFIX（截图前缀）
   出图：<PREFIX>sil-silhouette-64.png（64px 高：真彩+掩膜并排目检）、<PREFIX>sil-silhouette-full.png
   红侧预期（现树）：组件 3-6、摆幅 <1、呼吸 0-3 ⇒ 至少 3 行红；以跑出真值为准（G11-DATA 行）。
   falsify 锚（falsify-g11.cjs，锚串绿树实测重钉）：M1 删双丝带→G11.7 金/G11.8 摆幅；
   M2 删刀→G11.7 刃/G11.9 呼吸灯；M3 缩身 0.8×→G11.3 尺寸。 */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOTP = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/sil-");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }

/* CROP：行 385..471（下界 472=反射精灵顶缘，drawRefl by+2） */
const CROP = [230, 370, 385, 472];
/* 动画采样区（朝向 +1） */
const ZONE_GOLD = [272, 301, 405, 435];   /* 丝带尾区（头带 x≥309.5 在外 ⇒ 区内金像素=丝带） */
const ZONE_LUMA = [290, 303, 452, 466];   /* 护手/呼吸灯区（刀芯常亮为底噪，灯脉冲=增量） */
const ZONE_CAPE = [268, 296, 428, 458];   /* 披风微动区（报告用） */

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

/* ---------- 零依赖 PNG 写出（RGB，filter 0） ---------- */
function crc32(buf) { let crc = 0xffffffff; for (let i = 0; i < buf.length; i++) { crc ^= buf[i]; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); }
function writePNG(file, w, h, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  fs.writeFileSync(file, Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]));
}
/* RGBA（crop 内）→ 按 bbox 缩放成目标高度的小图（箱式均值） */
function scaleRegion(rgba, cw, bx0, by0, bw, bh, outH) {
  const outW = Math.max(1, Math.round(bw * outH / bh)); const buf = Buffer.alloc(outW * outH * 3);
  for (let oy = 0; oy < outH; oy++) { const sy0 = by0 + Math.floor(oy * bh / outH), sy1 = Math.max(sy0 + 1, by0 + Math.floor((oy + 1) * bh / outH));
    for (let ox = 0; ox < outW; ox++) { const sx0 = bx0 + Math.floor(ox * bw / outW), sx1 = Math.max(sx0 + 1, bx0 + Math.floor((ox + 1) * bw / outW));
      let r = 0, g = 0, b = 0, n = 0; for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { const j = (y * cw + x) * 4; r += rgba[j]; g += rgba[j + 1]; b += rgba[j + 2]; n++; }
      const j2 = (oy * outW + ox) * 3; buf[j2] = Math.round(r / n); buf[j2 + 1] = Math.round(g / n); buf[j2 + 2] = Math.round(b / n); } }
  return { w: outW, h: outH, buf };
}
function maskToRGB(mask, cw, bx0, by0, bw, bh, outH) {
  const outW = Math.max(1, Math.round(bw * outH / bh)); const buf = Buffer.alloc(outW * outH * 3);
  for (let oy = 0; oy < outH; oy++) for (let ox = 0; ox < outW; ox++) {
    const x = bx0 + Math.floor((ox + 0.5) * bw / outW), y = by0 + Math.floor((oy + 0.5) * bh / outH);
    const on = mask[y * cw + x]; const j = (oy * outW + ox) * 3;
    buf[j] = on ? 235 : 16; buf[j + 1] = on ? 235 : 16; buf[j + 2] = on ? 245 : 24; }
  return { w: outW, h: outH, buf };
}
function hconcat(parts, gap) {
  const H = Math.max.apply(null, parts.map(p => p.h)); const W = parts.reduce((s, p) => s + p.w, 0) + gap * (parts.length - 1);
  const buf = Buffer.alloc(W * H * 3); buf.fill(48);
  let xo = 0; for (const p of parts) { for (let y = 0; y < p.h; y++) p.buf.copy(buf, (y * W + xo) * 3, y * p.w * 3, (y + 1) * p.w * 3); xo += p.w + gap; }
  return { w: W, h: H, buf };
}

(async () => {
  console.log("== gate-11-silhouette ==");
  console.log("URL  = " + URL_);
  let dir = ROOT;
  try { const u = new URL(URL_); if (u.protocol === "file:") dir = path.dirname(decodeURIComponent(u.pathname.replace(/^\//, ""))); } catch (e) {}
  console.log("md5  = game.js " + md5(path.join(dir, "game.js")) + " / index.html " + md5(path.join(dir, "index.html")) + "（被测目录 " + dir + "）");
  fs.mkdirSync(path.dirname(SHOTP), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  let shotN = 0;
  const shot = async (tag) => { try { await page.screenshot({ path: SHOTP + "sh-" + (++shotN) + "-" + tag + ".png" }); } catch (e) {} };
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  const narrClean = () => G(() => { const n = window.__game.state().narrator; return !n.current && n.queueLen === 0; }).catch(() => true);
  const waitClean = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 12000)) { if (await narrClean()) return true; await sleep(150); } return false; };
  const crop = (x0, y0, x1, y1) => G((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const w = Math.round((a[2] - a[0]) * k), h = Math.round((a[3] - a[1]) * k);
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), w, h).data;
    return { w: w, h: h, k: k, data: Array.prototype.slice.call(d) };
  }, [x0, y0, x1, y1]);
  const grabCrop = () => crop(CROP[0], CROP[2], CROP[1], CROP[3]);
  function changedCount(A, B, thr) { let c = 0; for (let i = 0; i < A.w * A.h; i++) { const j = i * 4; if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= (thr || 8)) c++; } return c; }
  function maskOf(A, B) { const n = A.w * A.h; const m = new Uint8Array(n); for (let i = 0; i < n; i++) { const j = i * 4; if (Math.max(Math.abs(A.data[j] - B.data[j]), Math.abs(A.data[j + 1] - B.data[j + 1]), Math.abs(A.data[j + 2] - B.data[j + 2])) >= 8) m[i] = 1; } return m; }
  /* 剔噪：|B1−B2|（玩家离场两抓）膨胀 2px 作背景世界时噪声邻域，从 |A−B1| 掩膜中扣除 */
  function maskClean(A, B1, B2) {
    const w = A.w, h = A.h, m = maskOf(A, B1), nb = maskOf(B1, B2);
    let removed = 0, noise = 0; for (let i = 0; i < nb.length; i++) if (nb[i]) noise++;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!m[y * w + x]) continue;
      let hit = false;
      for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2 && !hit; dx++) { const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && nb[ny * w + nx]) hit = true; }
      if (hit) { m[y * w + x] = 0; removed++; } }
    return { m, removed, noise };
  }
  function analyze(A, m) {
    const w = A.w, h = A.h; let area = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { area++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    if (!area) return { area: 0, bx0: 0, by0: 0, bx1: 0, by1: 0, bw: 0, bh: 0, nComp: 0, comps: [], mainFrac: 0,
      fill: 0, aspect: 0, blade: 0, gold: 0, marginL: 0, marginR: 0, marginT: 0, marginB: 0, k: A.k };
    /* 8-连通组件 */
    const seen = new Uint8Array(w * h); const comps = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i0 = y * w + x; if (!m[i0] || seen[i0]) continue;
      let sz = 0; const q = [i0]; seen[i0] = 1;
      while (q.length) { const i = q.pop(); sz++; const cx = i % w, cy = (i - cx) / w;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const ni = ny * w + nx; if (m[ni] && !seen[ni]) { seen[ni] = 1; q.push(ni); } } }
      comps.push(sz); }
    comps.sort((a, b) => b - a);
    const nComp = comps.filter(s => s >= 4).length;
    const mainFrac = area ? comps[0] / area : 0;
    /* 身份色（只在掩膜内） */
    let blade = 0, gold = 0;
    for (let i = 0; i < w * h; i++) if (m[i]) { const j = i * 4, r = A.data[j], g = A.data[j + 1], b = A.data[j + 2];
      if (b >= 200 && r >= 170 && g >= 200) blade++;
      if (r >= 120 && g >= 110 && b <= 120 && (r - b) >= 70) gold++; }
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    return { area, bx0, by0, bx1, by1, bw, bh, nComp, comps: comps.slice(0, 5), mainFrac,
      fill: area / (bw * bh), aspect: bh / bw, blade, gold,
      marginL: bx0, marginR: w - 1 - bx1, marginT: by0, marginB: h - 1 - by1, k: A.k };
  }

  /* —— 旁白守卫（W5.2 复跑抓出的 flake 根因修复）：重响/空闲长句可在解冻窗起播，其逐字推进
       的像素会混进 |A−B| 掩膜与 |B1−B2| 剔噪邻域（Narr.update 走 rdt=渲染帧时，不受 hitstop
       冻结 ⇒ 冻结窗内也会继续打字），把玩家腿脚误扣。协议语义不变（窗长/补传时序/冻结抓帧
       照旧），只在每抓后复核旁白净；脏 ⇒ 解冻等旁白退场（waitClean）再重走该窗，最多 tries 次；
       重试用尽则沿用最后一抓并在日志亮明（guardRetries 计数进 G11-DATA）。 —— */
  let guardRetries = 0;
  /* —— 背景世界时噪声守卫（W6.1 全套复跑抓出的 flake 根因修复，详见头注释）——
     成对抓帧后复核 |B1−B2|：>BP_NOISE_MAX 视为层重烤事件（街灯跨档），整对重抓（≤4 对）；
     界限 64 预注册＝探针实测干净 floor 上界 16px 的 4 倍、事件级 656px 的 1/10。
     判据与阈值一字未动；重试用尽沿用最后一对并在日志亮明（noiseRetries 计数进 G11-DATA）。 —— */
  const BP_NOISE_MAX = 64;
  let noiseRetries = 0;
  async function bGrabGuarded(label, ms1, ms2, tries) {
    let img = null;
    for (let i = 1; i <= (tries || 4); i++) {
      if (i > 1) { await G(() => window.__game.debug.setHitstop(0)); await waitClean(); }
      await G(() => { const d = window.__game.debug; d.setHitstop(0); d.setPlayerPos(300, 160); });
      await sleep(ms1);
      if (ms2) { await G(() => window.__game.debug.setPlayerPos(300, 160)); await sleep(ms2); }
      await G(() => window.__game.debug.setHitstop(600));
      await sleep(180);
      img = await grabCrop();
      if (await narrClean()) return img;
      guardRetries++;
      console.log("   [旁白守卫:" + label + "] 第" + i + "次抓帧遇旁白活动 ⇒ 整窗重走");
    }
    console.log("   [旁白守卫:" + label + "] 重试用尽 —— 沿用最后一抓（面积类报告可能异常）");
    return img;
  }

  /* ============ 开场 ============ */
  await page.goto(URL_, { waitUntil: "load" });
  await sleep(1200);
  await page.keyboard.press("Enter");
  { let ok = false; for (let i = 0; i < 40; i++) { const s = await G(() => window.__game.state()).catch(() => null); if (s && s.phase === "playing") { ok = true; break; } await sleep(200); }
    if (!ok) throw new Error("未能进入 playing（Enter 后 8s）"); }
  await sleep(2600); /* 幕卡 1.7s 收场 */
  await G(() => { const d = window.__game.debug; d.setDust(0); d.setEmber(0); d.setShadow(false); });

  /* ---------- 定位：x=300，朝向 +1（位置增量作朝向代理） ---------- */
  const x0 = await G(() => window.__game.state().player.x);
  await page.keyboard.down("KeyD"); await sleep(160); await page.keyboard.up("KeyD"); await sleep(300);
  const x1 = await G(() => window.__game.state().player.x);
  const faceR = x1 > x0 + 2;
  await G(() => window.__game.debug.setPlayerX(300));
  await sleep(900); /* 足部 IK 收敛 */
  await waitClean();
  await shot("idle-r");

  /* ---------- 冻结抓帧 A（玩家在场）+ 零噪声自证（旁白守卫：抓后复核，脏则解冻退场重抓） ---------- */
  let A1 = null, aGuard = false;
  for (let ai = 1; ai <= 3 && !aGuard; ai++) {
    if (ai > 1) { guardRetries++; await G(() => window.__game.debug.setHitstop(0)); await waitClean(); console.log("   [旁白守卫:A] 第" + ai + "轮重抓（上轮抓帧时旁白活动）"); }
    await G(() => window.__game.debug.setHitstop(600));
    await sleep(180);
    A1 = await grabCrop();
    aGuard = await narrClean();
  }
  await sleep(220);
  const A2 = await grabCrop();
  const noise = changedCount(A1, A2);
  await shot("frozen-A");
  /* ---------- 参考帧 B1/B2（玩家离场：同 x 纵向传送，视差零位移；B1-B2 间隔作背景噪声掩膜）
     坠落核算：y=160 起自由落体，~0.53s 触取景顶（385）、~0.62s 落地 ⇒ 离场段一律 ≤495ms 即再补传
     （协议 v2-crash 教训：850ms 直落回地面 ⇒ |B1−B2| 含玩家本体 ⇒ 剔噪把掩膜整个吃掉 area=0） ---------- */
  let B1 = null, B2 = null, bpNoise = -1;
  for (let bp = 1; bp <= 4; bp++) {
    B1 = await bGrabGuarded("B1", 95, 0);
    await shot("frozen-B1");
    B2 = await bGrabGuarded("B2", 400, 95);
    bpNoise = changedCount(B1, B2);
    if (bpNoise <= BP_NOISE_MAX) break;
    noiseRetries++;
    console.log("   [背景噪声守卫:B] 第" + bp + "对 |B1−B2|=" + bpNoise + "px（>" + BP_NOISE_MAX + "，层重烤事件）⇒ 成对重抓");
  }
  if (bpNoise > BP_NOISE_MAX) console.log("   [背景噪声守卫:B] 重试用尽 —— 沿用最后一对（面积类报告可能异常）");
  await G(() => { const d = window.__game.debug; d.setHitstop(0); d.setPlayerPos(300, 470); });
  await sleep(700);
  /* 静候 world.t≥8.4：guide_right（t>7 必响一次）与空闲短句先响完，否则落进动画采样窗＝两侧皆红的假失败 */
  await sleep(3700);
  await waitClean();

  const MC = maskClean(A1, B1, B2);
  const M = MC.m;
  const RA = analyze(A1, M);

  /* ---------- 待机动画活性（未冻结 130 帧 ≈2.1s：金质心摆幅 + 护手区 luma 极差） ---------- */
  const clean0 = await narrClean();
  const anim = await G((a) => new Promise(res => {
    const cv = document.getElementById("cv"), g = cv.getContext("2d"), k = cv.width / 960;
    const gx = [], lum = []; let n = 0;
    const R = [Math.round(a.g[0] * k), Math.round(a.g[2] * k), Math.round((a.g[1] - a.g[0]) * k), Math.round((a.g[3] - a.g[2]) * k)];
    const L = [Math.round(a.l[0] * k), Math.round(a.l[2] * k), Math.round((a.l[1] - a.l[0]) * k), Math.round((a.l[3] - a.l[2]) * k)];
    function tick() {
      const dR = g.getImageData(R[0], R[1], R[2], R[3]).data; let sx = 0, c = 0;
      for (let i = 0; i < R[2] * R[3]; i++) { const j = i * 4; const r = dR[j], gg = dR[j + 1], b = dR[j + 2];
        if (r >= 120 && gg >= 110 && b <= 120 && (r - b) >= 70) { sx += (i % R[2]); c++; } }
      gx.push(c ? sx / c : -1);
      const dL = g.getImageData(L[0], L[1], L[2], L[3]).data; let s = 0;
      for (let i = 0; i < dL.length; i += 4) s += (dL[i] + dL[i + 1] + dL[i + 2]) / 3;
      lum.push(s / (dL.length / 4));
      if (++n < 130) requestAnimationFrame(tick); else res({ n: n, gx: gx, lum: lum, k: k });
    }
    requestAnimationFrame(tick);
  }), { g: ZONE_GOLD, l: ZONE_LUMA }).catch(() => null);
  const clean1 = await narrClean();
  let ribbonRange = -1, breathRange = -1, goldFrames = 0;
  if (anim) { const gv = anim.gx.filter(v => v >= 0); goldFrames = gv.length;
    if (gv.length > 1) ribbonRange = (Math.max.apply(null, gv) - Math.min.apply(null, gv)) / anim.k;
    if (anim.lum.length > 1) breathRange = Math.max.apply(null, anim.lum) - Math.min.apply(null, anim.lum); }

  /* ---------- 披风微动（报告用；两抓相距 620ms 的变像素数） ---------- */
  const C0 = await crop(ZONE_CAPE[0], ZONE_CAPE[2], ZONE_CAPE[1], ZONE_CAPE[3]);
  await sleep(620);
  const C1 = await crop(ZONE_CAPE[0], ZONE_CAPE[2], ZONE_CAPE[1], ZONE_CAPE[3]);
  const capeChanged = changedCount(C0, C1);

  /* ---------- 双朝向镜像：朝向 −1 全套冻结协议 ---------- */
  const xa = await G(() => window.__game.state().player.x);
  await page.keyboard.down("KeyA"); await sleep(160); await page.keyboard.up("KeyA"); await sleep(300);
  const xb = await G(() => window.__game.state().player.x);
  const faceL = xb < xa - 2;
  await G(() => window.__game.debug.setPlayerX(300));
  await sleep(900); await waitClean();
  let A1L = null, aGuardL = false;
  for (let ai = 1; ai <= 3 && !aGuardL; ai++) {
    if (ai > 1) { guardRetries++; await G(() => window.__game.debug.setHitstop(0)); await waitClean(); console.log("   [旁白守卫:A-L] 第" + ai + "轮重抓（上轮抓帧时旁白活动）"); }
    await G(() => window.__game.debug.setHitstop(600));
    await sleep(180);
    A1L = await grabCrop();
    aGuardL = await narrClean();
  }
  let B1L = null, B2L = null, bpNoiseL = -1;
  for (let bp = 1; bp <= 4; bp++) {
    B1L = await bGrabGuarded("B1L", 95, 0);
    B2L = await bGrabGuarded("B2L", 400, 95);
    bpNoiseL = changedCount(B1L, B2L);
    if (bpNoiseL <= BP_NOISE_MAX) break;
    noiseRetries++;
    console.log("   [背景噪声守卫:B-L] 第" + bp + "对 |B1L−B2L|=" + bpNoiseL + "px（>" + BP_NOISE_MAX + "，层重烤事件）⇒ 成对重抓");
  }
  if (bpNoiseL > BP_NOISE_MAX) console.log("   [背景噪声守卫:B-L] 重试用尽 —— 沿用最后一对（面积类报告可能异常）");
  await G(() => { const d = window.__game.debug; d.setHitstop(0); d.setPlayerPos(300, 470); });
  await sleep(400);
  const MCL = maskClean(A1L, B1L, B2L);
  const ML = MCL.m;
  const RL = analyze(A1L, ML);

  /* ---------- 出图：64px 缩略图（真彩|掩膜）+ 全尺寸对照 ---------- */
  if (RA.area) {
    const s64 = hconcat([scaleRegion(A1.data, A1.w, RA.bx0, RA.by0, RA.bw, RA.bh, 64), maskToRGB(M, A1.w, RA.bx0, RA.by0, RA.bw, RA.bh, 64)], 6);
    writePNG(SHOTP + "sil-silhouette-64.png", s64.w, s64.h, s64.buf);
    const full = hconcat([scaleRegion(A1.data, A1.w, 0, 0, A1.w, A1.h, A1.h), maskToRGB(M, A1.w, 0, 0, A1.w, A1.h, A1.h)], 6);
    writePNG(SHOTP + "sil-silhouette-full.png", full.w, full.h, full.buf);
    console.log("  出图 = " + SHOTP + "sil-silhouette-64.png / -full.png（bbox " + RA.bw + "x" + RA.bh + "）");
  }

  /* ============ 断言 ============ */
  report("G11.0 冻结零噪声", noise <= 2, `冻结双抓 |Δ|≥8 像素=${noise}（≤2；理论 0，仪器自证）`);
  report("G11.1 掩膜有效", RA.area >= 400 && RA.area <= 6000, `掩膜面积=${RA.area}px²（∈[400,6000]；0=仪器死/整块=坏帧）`);
  report("G11.2 窗内含体", RA.area > 0 && RA.marginL >= 5 && RA.marginR >= 5 && RA.marginT >= 5 && faceR,
    `边距 L/T/R=${RA.marginL}/${RA.marginT}/${RA.marginR}（≥5，底部=B:${RA.marginB} 仅报值——脚辉光可触缘；h 窗 [50,72] 吸收 ≤2px 截断）朝向代理=+1:${faceR}`);
  report("G11.3 尺寸", RA.bh >= 50 && RA.bh <= 72 && RA.bw >= 24 && RA.bw <= 90, `高=${RA.bh}px（∈[50,72]）宽=${RA.bw}px（∈[24,90]）`);
  report("G11.4 填充率", RA.fill >= 0.30 && RA.fill <= 0.70, `填充率=${RA.fill.toFixed(3)}（∈[0.30,0.70]；64px 可读性下限）`);
  report("G11.5 长宽比", RA.aspect >= 1.3 && RA.aspect <= 2.6, `长宽比=${RA.aspect.toFixed(2)}（∈[1.3,2.6]）`);
  report("G11.6 组件数", RA.nComp <= 2 && RA.mainFrac >= 0.92, `组件=${RA.nComp}（≤2）主块占比=${(RA.mainFrac * 100).toFixed(1)}%（≥92%）面积前5=[${RA.comps.join(",")}]`);
  report("G11.7 身份元素", RA.blade >= 15 && RA.gold >= 25, `亮刃像素=${RA.blade}（≥15）金饰像素=${RA.gold}（≥25；头带≈11 单独不达标）`);
  report("G11.8 丝带摆幅", ribbonRange >= 3.0 && goldFrames >= 60 && clean0 && clean1,
    `金质心 x 极差=${ribbonRange < 0 ? "无金像素" : ribbonRange.toFixed(2)}px（≥3.0；未冻结 130 帧，有效帧=${goldFrames}，旁白净=${clean0}/${clean1}）`);
  report("G11.9 呼吸灯", breathRange >= 4.0 && clean0 && clean1, `护手区 luma 极差=${breathRange < 0 ? "?" : breathRange.toFixed(2)}（≥4.0；未冻结 130 帧）`);
  console.log("  报告 G11-cape 披风微动 = " + capeChanged + " 变像素/620ms（仅真值，无阈值——呼吸共带难分离）");
  const mirrorOk = RA.area && RL.area && (RL.area / RA.area) >= 0.85 && (RL.area / RA.area) <= 1.18 && RL.nComp <= 2 && faceL;
  report("G11.10 双朝向镜像", mirrorOk, `面积比=-1/+1=${RA.area ? (RL.area / RA.area).toFixed(3) : "?"}（∈[0.85,1.18]）组件(-1)=${RL.nComp} 朝向代理=-1:${faceL}`);
  console.log(`G11-DATA comps=${RA.nComp} main=${(RA.mainFrac * 100).toFixed(1)}% area=${RA.area} bbox=${RA.bw}x${RA.bh} fill=${RA.fill.toFixed(3)} aspect=${RA.aspect.toFixed(2)} blade=${RA.blade} gold=${RA.gold} ribbonRange=${ribbonRange.toFixed(2)} breathRange=${breathRange.toFixed(2)} capeChanged=${capeChanged} noise=${noise} bgNoisePx=${MC.noise} removedPx=${MC.removed} guardRetries=${guardRetries} noiseRetries=${noiseRetries}`);
  console.log(`G11-DATA-L area=${RL.area} comps=${RL.nComp} fill=${RL.fill.toFixed(3)} aspect=${RL.aspect.toFixed(2)} bgNoisePx=${MCL.noise} removedPx=${MCL.removed} noiseRetries=${noiseRetries}`);

  const t = await G(() => window.__game.debug.telemetry()).catch(() => null);
  const p95 = t && typeof t.frameP95Ms === "number" ? t.frameP95Ms : -1;
  report("G11-E 帧时 sanity", p95 >= 0 && p95 <= 25, `p95=${p95}ms（≤25 穷举上限；仅报告真值）`);
  report("G11-0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));

  const pass = results.filter(r => r.ok).length, fail = results.length - pass;
  console.log("---- 汇总：PASS " + pass + "/" + results.length + (fail ? "（红 " + fail + "）" : " 全绿") + " ----");
  console.log("GATE gate-11-silhouette: " + (fail ? "FAIL" : "PASS"));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
