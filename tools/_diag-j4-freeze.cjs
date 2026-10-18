/* _diag-j4-freeze.cjs —— J4 像素代理「元素不浮」诊断（非闸；为 verify-visual-v1 采样法修复取证）。
   背景：Loop C 后 J4 由绿转红且三连红（Δ=2.74/2.91/4.05 全正），Loop B 存档两连绿（Δ=1.54/1.70 全负）
   ⇒ 疑似「确定性但隨代码态漂移」的干扰（敌兵接触/击退/慢动作）而非纯相位噪声。
   本诊断做三件事，全部同机位（玩家 x480 躯干带 472-488×438-452 ＋ 天空参照带 300-316×60-76）：
     A. 旧采样法原样复跑 4 连（无清场，镜像闸内环境）——同时记录每次采样的 player.x/hurtT（击退/受击证据）。
     B. 冻结采样（debug.setHitstop(4)＋清场）——离抖：on/off 各两次连采（噪声地板）+ 天空参照。
     C. 阳性对照：冻结下把 bloom.gain 拉到 5.0（活读）——冻结采样法必须报出 ≫2 的抬升，否则采样法失聪。
   输出：JSON 表 + 判读行。 */
"use strict";
const path = require("path");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const G = (fn) => page.evaluate(fn);

let page;
(async () => {
  console.log("== _diag-j4-freeze ==");
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  await page.goto("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", { waitUntil: "load" });
  await sleep(900);

  /* 与闸同拍：J1 侧近乎瞬时 ⇒ 900ms 后直接 Enter；J2 斜砍块 2.1s、J3 块 2.5s 用睡眠镜像 */
  await page.keyboard.press("Enter"); await sleep(500);
  await sleep(2100 + 2500);

  const sample = () => page.evaluate(() => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const box = (x0, y0, w, h) => {
      const d = g.getImageData(Math.round(x0 * k), Math.round(y0 * k), Math.round(w * k), Math.round(h * k)).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return +(s / (d.length / 4)).toFixed(3);
    };
    const st = window.__game.state();
    return { torso: box(472, 438, 16, 14), sky: box(300, 60, 16, 16),
      px: +st.player.x.toFixed(1), hurtT: +(st.player.hurtT || 0).toFixed(2),
      y: +st.player.y.toFixed(1) };
  });
  const setPP = (o) => page.evaluate((oo) => window.__game.debug.setPP(oo), o);
  const setX = (x) => page.evaluate((xx) => window.__game.debug.setPlayerX(xx), x);

  /* ---- A. 旧采样法原样 ×4（镜像闸 J4 序列） ---- */
  const A = [];
  for (let i = 0; i < 4; i++) {
    await setPP({ bloom: { enabled: false } }); await sleep(300);
    await setX(480); await sleep(450);
    const lo = await sample();
    await setPP({ bloom: { enabled: true } }); await sleep(300);
    const hi = await sample();
    A.push({ i, lo: lo.torso, hi: hi.torso, d: +(hi.torso - lo.torso).toFixed(3),
      loPx: lo.px, hiPx: hi.px, loHurt: lo.hurtT, hiHurt: hi.hurtT, loY: lo.y, hiY: hi.y });
  }
  console.log("[A] 旧法四连（torso=躯干带均值, d=bloom开−关, px/hurt=采样时刻玩家状态）:");
  A.forEach(r => console.log("   " + JSON.stringify(r)));

  /* ---- B. 冻结采样（清场＋setHitstop 冻结） ---- */
  await G(() => window.__game.debug.clearWave());
  await setX(480); await sleep(600);
  const hasFreeze = await G(() => typeof window.__game.debug.setHitstop === "function");
  console.log("[B] setHitstop 钩子存在 = " + hasFreeze);
  const B = { frozen: hasFreeze };
  if (hasFreeze) {
    await G(() => window.__game.debug.setHitstop(4)); await sleep(400);
    await setPP({ bloom: { enabled: true } }); await sleep(150);
    const on1 = await sample(); await sleep(150); const on2 = await sample();
    await setPP({ bloom: { enabled: false } }); await sleep(150);
    const off1 = await sample(); await sleep(150); const off2 = await sample();
    B.on1 = on1.torso; B.on2 = on2.torso; B.off1 = off1.torso; B.off2 = off2.torso;
    B.onNoise = +Math.abs(on2.torso - on1.torso).toFixed(3);
    B.offNoise = +Math.abs(off2.torso - off1.torso).toFixed(3);
    B.frozenD = +(( (on1.torso + on2.torso) / 2) - ((off1.torso + off2.torso) / 2)).toFixed(3);
    B.skyOn = on1.sky; B.skyOff = off1.sky; B.skyD = +(on1.sky - off1.sky).toFixed(3);
    B.pxFrozen = on1.px; B.hurtFrozen = on1.hurtT;
    await G(() => window.__game.debug.setHitstop(0));
    /* ---- C. 灵敏度正对照（冻结中刀弧带）：解冻→原地起刀→120ms 弧中冻结（trail 活源在场）→
       bloom 关/开各采弧带——冻结采样法必须报出 ≫2 的抬升，否则采样法对该类源失聪。 ---- */
    await sleep(400);
    await setX(480); await sleep(500);
    await page.keyboard.press("KeyJ"); await sleep(120);
    await G(() => window.__game.debug.setHitstop(4)); await sleep(300);
    const arcBox = () => page.evaluate(() => {
      const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
      const st = window.__game.state(); const px = st.player.x, py = st.player.y;
      const d = g.getImageData(Math.round((px + 16) * k), Math.round((py - 82) * k),
        Math.round(64 * k), Math.round(40 * k)).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return { m: +(s / (d.length / 4)).toFixed(3), px: +px.toFixed(1), py: +py.toFixed(1) };
    });
    await setPP({ bloom: { enabled: false } }); await sleep(150);
    const arcOff = await arcBox();
    await setPP({ bloom: { enabled: true } }); await sleep(150);
    const arcOn = await arcBox();
    B.arcOff = arcOff.m; B.arcOn = arcOn.m;
    B.arcD = +(arcOn.m - arcOff.m).toFixed(3);
    B.arcPx = arcOff.px + "/" + arcOff.py;
    await G(() => window.__game.debug.setHitstop(0));
  }
  console.log("[B/C] 冻结采样 + 阳性对照:");
  console.log("   " + JSON.stringify(B));

  console.log(errs.length ? ("ERRORS: " + errs.join(" | ")) : "0 pageerror");
  await browser.close().catch(() => {});
  process.exit(0);
})();
