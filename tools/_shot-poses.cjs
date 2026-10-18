/* _shot-poses.cjs —— 姿态画廊截图链（Loop 6 角色升级专用辅助脚本；非测试闸，不判 PASS/FAIL）
   用途：对任意版本（CHAITAI_URL 环境变量）截一组「同场景同输入」的角色姿态帧，供
   「旧版 vs 新版」人工目检对比。输出：shots/<prefix>-NN-<tag>.png
     ＋每张同时追加 <prefix>-NN-<tag>-zoom.png（玩家邻域特写，框=logical (px-150..px+110, py-150..py+20)）
     ＋链末写 <prefix>-metrics.json（每张的特写框内 青色亮像素数/高亮像素数，跨版本可比）
   用法：CHAITAI_URL=file:///.../index.html CHAITAI_SHOT_PREFIX=D:/.../shots/loop6/before node tools/_shot-poses.cjs
   场景：title / idle ×2（呼吸相位）/ run ×4（步态相位）/ atk1·2·3（各 wind+act）/
        jump-rise / jump-fall / dash / enemy-wind / enemy-strike / 胜利姿
   注意：只读+截图，不改任何游戏状态钩子；按键走真实输入路径。
   指标口径：cyan=特写框内 (r<150 && g>150 && b>190)；bright=亮度>140 的像素数。数字是描述性
   证据（同场景同输入跨版本对比），不是判据。 */
"use strict";
const fs = require("fs");
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const PREFIX = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/loop6/poses");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("== _shot-poses ==");
  console.log("URL    = " + URL_);
  console.log("PREFIX = " + PREFIX);
  fs.mkdirSync(path.dirname(PREFIX), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  let n = 0;
  const metrics = [];
  /* 特写框（logical 坐标，相对玩家）：左右不对称——左边多给视野装得住冲刺残影/披风拖尾 */
  const BOX = { lx: -150, rx: 110, ty: -150, by: 20 };
  const shot = async (tag) => {
    const file = PREFIX + "-" + String(++n).padStart(2, "0") + "-" + tag + ".png";
    await page.screenshot({ path: file });
    console.log("shot " + n + " " + tag);
    /* 特写裁剪＋框内像素计数（同一帧读数：先取状态/裁剪，再截图——间隔 <60ms，玩家位移约 ≤30px，
       框留有余量）。计数失败不打断链。 */
    try {
      const r = await G((box) => {
        const st = window.__game.state().player;
        const cv = document.getElementById("cv"), rc = cv.getBoundingClientRect();
        const k = rc.width / 960, kx = cv.width / 960;
        const x0 = Math.max(0, st.x + box.lx), x1 = Math.min(960, st.x + box.rx);
        const y0 = Math.max(0, st.y + box.ty), y1 = Math.min(540, st.y + box.by);
        const d = cv.getContext("2d").getImageData(Math.round(x0 * kx), Math.round(y0 * kx),
          Math.round((x1 - x0) * kx), Math.round((y1 - y0) * kx)).data;
        let cyan = 0, bright = 0;
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          if (R < 150 && G > 150 && B > 190) cyan++;
          if ((R + G + B) / 3 > 140) bright++;
        }
        const clip = { x: rc.left + x0 * k, y: rc.top + y0 * k,
                       width: (x1 - x0) * k, height: (y1 - y0) * k };
        return { px: st.x, py: st.y, facing: st.facing, cyan, bright, clip };
      }, BOX);
      r.clip.width = Math.min(r.clip.width, 1440 - r.clip.x);
      r.clip.height = Math.min(r.clip.height, 900 - r.clip.y);
      await page.screenshot({ path: PREFIX + "-" + String(n).padStart(2, "0") + "-" + tag + "-zoom.png", clip: r.clip });
      metrics.push({ n, tag, x: r.px, y: r.py, facing: r.facing, cyan: r.cyan, bright: r.bright });
      console.log("  zoom " + tag + "  x=" + r.px + " y=" + r.py + " facing=" + r.facing +
                  "  cyan=" + r.cyan + " bright=" + r.bright);
    } catch (e) { console.log("  zoom " + tag + " 跳过：" + e.message); }
  };
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  const keyHold = async (code, ms) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);

  /* 0) 标题 */
  await shot("title");

  /* 1) 开局 → idle 呼吸两相位 */
  await page.keyboard.press("Enter");
  await sleep(1600);                       /* 等开场旁白打字完成，画面静止 */
  await G(() => window.__game.debug.setPlayerX(200));
  await shot("idle-1");
  await sleep(700);
  await shot("idle-2");                    /* 与 idle-1 对比 = 呼吸/微动幅度 */

  /* 2) 跑动步态四相位（按住 D 连拍） */
  await page.keyboard.down("KeyD");
  for (let i = 0; i < 4; i++) { await sleep(130); await shot("run-" + (i + 1)); }
  await page.keyboard.up("KeyD");
  await sleep(600);

  /* 3) 三连击（每段截 wind 近段 + act 近段；节拍风/坐/收由 ATK 表约 55/90/150ms 决定，放宽拍） */
  await G(() => window.__game.debug.setPlayerX(240));
  for (let s = 1; s <= 3; s++) {
    await page.keyboard.press("KeyJ");
    await sleep(45);  await shot("atk" + s + "-wind");
    await sleep(70);  await shot("atk" + s + "-act");
    await sleep(240);                        /* 让该段收完，进下一段窗口 */
  }
  await sleep(400);

  /* 4) 跳跃上升/下落 */
  await page.keyboard.down("Space"); await sleep(60); await page.keyboard.up("Space");
  await sleep(140); await shot("jump-rise");
  await sleep(260); await shot("jump-fall");
  await sleep(500);

  /* 5) 冲刺帧 */
  await page.keyboard.press("KeyK");
  await sleep(80); await shot("dash");
  await sleep(500);

  /* 6) 敌人 wind/strike（去触发 W1，等红兵贴近） */
  await G(() => window.__game.debug.setPlayerX(430));
  await sleep(500);
  let sawWind = false, sawStrike = false;
  for (let i = 0; i < 40 && !(sawWind && sawStrike); i++) {
    const st = await G(() => (window.__game.state().enemies || []).map(e => e.state)).catch(() => []);
    if (!sawWind && st.indexOf("wind") >= 0) { sawWind = true; await shot("enemy-wind"); }
    if (!sawStrike && st.indexOf("strike") >= 0) { sawStrike = true; await shot("enemy-strike"); }
    await sleep(80);
  }
  if (!sawWind) console.log("（未捕捉到 enemy-wind）");
  if (!sawStrike) console.log("（未捕捉到 enemy-strike）");

  /* 7) 胜利姿（清场到通关 → 占位截图；若探针环境清波不可用则跳过并注明） */
  try {
    for (let i = 0; i < 20; i++) {
      await G(() => window.__game.debug.clearWave());
      await sleep(300);
      const s = await G(() => ({ cleared: window.__game.state().cleared, wave: window.__game.state().wave }));
      if (s.cleared) break;
    }
    await sleep(400); await shot("cleared");
  } catch (e) { console.log("cleared 段跳过：" + e.message); }

  console.log("错误数 = " + errs.length + (errs.length ? " " + JSON.stringify(errs.slice(0, 4)) : ""));
  fs.writeFileSync(PREFIX + "-metrics.json", JSON.stringify({
    url: URL_, prefix: PREFIX, when: new Date().toISOString(),
    note: "cyan=(r<150&&g>150&&b>190)的像素数，特写框内；bright=亮度>140像素数。描述性证据，非判据。",
    shots: metrics }, null, 1));
  console.log("metrics -> " + PREFIX + "-metrics.json（" + metrics.length + " 条）");
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
