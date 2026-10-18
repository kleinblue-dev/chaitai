/* _shot-seq.cjs —— 动作序列连拍链（诊断「动作很奇怪」用；非测试闸，不判 PASS/FAIL）
   用途：对当前版本截「连续动作」的等间隔帧序列，供人工目检运动是否连贯、相位是否正确。
   与 _shot-poses.cjs 的区别：那个按脚本摆拍单帧；这个专门抓「运动过程」——等间隔连拍，
   每帧同时记录 walk（步态相位）/x/y/facing，输出可拼成胶片条。
   输出：<PREFIX>-<seq>-NN.png（玩家邻域特写裁剪）
   用法：CHAITAI_SHOT_PREFIX=D:/.../shots/seq-1013/walk node tools/_shot-seq.cjs
   注意：只读+截图，按键走真实输入路径；debug.setPlayerX 仅用于复位站位，不干预动作本身。 */
"use strict";
const fs = require("fs");
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const PREFIX = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/seq-1013/seq");
const ONLY = (process.env.CHAITAI_SEQ || "").split(",").filter(Boolean); /* 空=全跑 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("== _shot-seq ==");
  console.log("URL    = " + URL_);
  console.log("PREFIX = " + PREFIX);
  console.log("ONLY   = " + (ONLY.length ? ONLY.join(",") : "(全部)"));
  fs.mkdirSync(path.dirname(PREFIX), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  /* 特写框（logical，相对玩家）：比姿态画廊更紧，人物在格子里更大，利于看四肢 */
  const BOX = { lx: -120, rx: 80, ty: -150, by: 20 };
  const all = [];
  const cropShot = async (seq, i, t0) => {
    const file = PREFIX + "-" + seq + "-" + String(i).padStart(2, "0") + ".png";
    let r;
    try {
      r = await G((box) => {
        const st = window.__game.state().player;
        const rg = window.__game.debug.rig ? window.__game.debug.rig() : null;
        const cv = document.getElementById("cv"), rc = cv.getBoundingClientRect();
        const k = rc.width / 960, kx = cv.width / 960;
        const x0 = Math.max(0, st.x + box.lx), x1 = Math.min(960, st.x + box.rx);
        const y0 = Math.max(0, st.y + box.ty), y1 = Math.min(540, st.y + box.by);
        const clip = { x: rc.left + x0 * k, y: rc.top + y0 * k,
                       width: (x1 - x0) * k, height: (y1 - y0) * k };
        return { x: st.x, y: st.y, facing: st.facing, walk: rg ? rg.walk : null, clip };
      }, BOX);
      r.clip.width = Math.min(r.clip.width, 1440 - r.clip.x);
      r.clip.height = Math.min(r.clip.height, 900 - r.clip.y);
      await page.screenshot({ path: file, clip: r.clip });
    } catch (e) { console.log("  frame " + seq + "-" + i + " 失败：" + e.message); return; }
    const t = Date.now() - t0;
    console.log("  " + seq + "-" + i + "  t=" + t + "ms x=" + r.x + " y=" + r.y + " facing=" + r.facing + " walk=" + r.walk + " -> " + path.basename(file));
    all.push({ seq, i, t, x: +r.x.toFixed(1), y: +r.y.toFixed(1), facing: r.facing, walk: r.walk });
  };
  /* 等间隔连拍：interval 毫秒一帧，共 n 帧；onTick(i) 可在帧间发按键 */
  const burst = async (seq, n, interval, onTick) => {
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      if (onTick) await onTick(i);
      const wait = t0 + i * interval - Date.now();
      if (wait > 0) await sleep(wait);
      await cropShot(seq, i, t0);
    }
  };
  const run = (name) => !ONLY.length || ONLY.indexOf(name) >= 0;

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(1600);
  const toX = async (x) => { await G((v) => window.__game.debug.setPlayerX(v), x); await sleep(350); };

  /* 2) 三连击全过程：每 90ms 发一次 J（链式触发），50ms 一帧连拍 22 帧 */
  if (run("atk")) {
    await toX(240);
    await burst("atk", 22, 50, async (i) => { if (i < 12 && i % 3 === 0) await page.keyboard.press("KeyJ"); });
    await sleep(500);
  }
  /* 3) 跳跃全程：Space 后 60ms 一帧连拍 13 帧 */
  if (run("jump")) {
    await toX(240);
    await page.keyboard.down("Space"); await sleep(60); await page.keyboard.up("Space");
    await burst("jump", 13, 60);
    await sleep(500);
  }
  /* 4) 冲刺：K 后 40ms 一帧连拍 9 帧 */
  if (run("dash")) {
    await toX(240);
    await page.keyboard.press("KeyK");
    await burst("dash", 9, 40);
    await sleep(500);
  }
  /* 5) 待机微动：200ms 一帧 8 帧（呼吸/披风） */
  if (run("idle")) {
    await toX(240);
    await burst("idle", 8, 200);
  }
  /* 6) 走路步态（放最后！9 帧 × 80ms：x 200→~396，永不越过 420 触发线 ⇒ 全场零敌人污染；
        之前 15 帧版越过 420 引出 W1，把 dash/idle 段全拍脏了——教训记录） */
  if (run("walk")) {
    await toX(200);
    await page.keyboard.down("KeyD");
    await burst("walk", 9, 80);
    await page.keyboard.up("KeyD");
  }

  console.log("错误数 = " + errs.length + (errs.length ? " " + JSON.stringify(errs.slice(0, 4)) : ""));
  fs.writeFileSync(PREFIX + "-seqmeta.json", JSON.stringify({
    url: URL_, prefix: PREFIX, when: new Date().toISOString(),
    note: "等间隔连拍；t=相对该序列首帧的毫秒。walk=步态里程(gait px)，可对相位。",
    frames: all }, null, 1));
  console.log("seqmeta -> " + PREFIX + "-seqmeta.json（" + all.length + " 帧）");
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
