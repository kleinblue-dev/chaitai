/* verify-v029.cjs —— 《拆台》角色动作修正闸（Loop 10：走路摆臂／发带锚点／待机呼吸；先红后绿）
   缘起（用户原话）：「人物动作很奇怪」。诊断（连拍胶片条目检 shots/seq-1013b/tile-*.png）：
   ①走路时腿在迈、持刀臂在整个步态周期里纹丝不动（rigUpdate moving 分支 handT 是常量）⇒ 僵尸臂；
   ②发带锚点在 P.x+4·facing（前额顶）⇒ 金带披在头顶上、起跳/下落时滞后到头顶以上（Loop 6 遗留）；
   ③待机只靠 crouch±0.55px 呼吸，8 帧 1.4s 目检近乎雕像。
   ==== 实现前先行钉死的契约（本探针即契约，非事后调参）====
   · rig() 增观测字段（只读，不改行为）：{crouch, hand:{x,y}, ribbon:{ax,ay,s0x,s0y,init}}。
     hand/ribbon 均为 RIG 局部（x 为面向系）或世界坐标，语义：hand=RIG.hx/hy；ribbon ax/ay=发带链
     锚（世界）、s0x/s0y=sa 链首节（世界）。
   · A 走路摆臂：按住 D 采样 hand.x 极差 ≥8.0px 且 hand.y 极差 ≥1.2px。设计：hand.x=-4-7·sin(gph)、
     hand.y=-25.5+1.5·sin(2·gph)，gph=步态相位；行走分支 k 34→50（补偿 7.6Hz 跟踪衰减 ~0.72）
     ⇒ 实测幅度 ≈10/≈2.2px；旧码 hand.x 恒 ≈-4（无臂摆）⇒ 红。
   · B1 发带锚点在脑后：静立时 ribbon.ax − player.x ≤ −1.0。设计：锚点 P.x−facing*3（旧 +4）⇒ −3。
   · B2 飞行中发带不过锚：起跳全程 min(ribbon.s0y − ribbon.ay) ≥ −2.5px。设计：非 iframe 时
     对 sa/sb 逐节钳 y ≥ 锚.y−1.5（留 1px 余量）；一闪（iframes>0）上飘效果保留不钳。
   · C 待机呼吸：静立 3.4s（>1 个呼吸周期 3.0s）crouch 极差 ≥1.6px。设计：idle 分支 crT=0.55·bre
     ＋全局 +0.55·bre ⇒ 目标 1.1·bre、p-p 2.2px；旧码 0.55·bre ⇒ 1.1px 红。
   · v025-A 安全（静立 [310,326]×[463,470] 零像素）：idle hand.x 恒 −4.6、tool 恒 1.50 不动 ⇒
     +x 路径与旧版逐位同；呼吸只动 y；膝在 y≈455 带外（旧推导沿用）。行走相位不在 A 的采样窗。
   · 0 零错误：pageerror/console.error 计数。
   红侧（b57304c 旧码）：A/B1/B2/C 全 FAIL「钩子缺失」（rig() 无新字段；Loop 9 同款先例），0 PASS。
   用法：node tools/verify-v029.cjs；环境：CHAITAI_URL / CHAITAI_SHOT_PREFIX。 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v029/v029");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("== verify-v029 ==");
  console.log("md5  = game.js " + md5(path.join(ROOT, "game.js")) + " / index.html " + md5(path.join(ROOT, "index.html")) + "（被测目录 " + ROOT.replace(/\\/g, "/") + "）");
  fs.mkdirSync(path.dirname(SHOT), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  const line = (id, ok, detail) => { console.log((ok ? "[PASS] " : "[FAIL] ") + id + " —— " + detail); return ok ? 1 : 0; };
  let pass = 0;

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(1600);

  /* 观测读数：rig() 新字段（缺字段=null，红线可读） */
  const readRig = () => G(() => {
    const p = window.__game.state().player, r = window.__game.debug.rig();
    if (r.crouch === undefined || r.hand === undefined || r.ribbon === undefined) return { has: false };
    return { has: true, px: p.x, facing: p.facing, crouch: r.crouch,
             hx: r.hand.x, hy: r.hand.y, ax: r.ribbon.ax, ay: r.ribbon.ay,
             s0x: r.ribbon.s0x, s0y: r.ribbon.s0y, rinit: !!r.ribbon.init };
  });
  const first = await readRig();
  const HAS = first.has;

  /* —— C 待机呼吸（先跑：在 x=240 纯净区，前面无输入）—— */
  await G(() => window.__game.debug.setPlayerX(240));
  await sleep(400);
  let crouchMin = Infinity, crouchMax = -Infinity;
  for (let i = 0; i < 34; i++) { const r = await readRig(); if (HAS) { crouchMin = Math.min(crouchMin, r.crouch); crouchMax = Math.max(crouchMax, r.crouch); } await sleep(100); }
  await page.screenshot({ path: SHOT + "-idle.png" });
  {
    const rng = HAS ? +(crouchMax - crouchMin).toFixed(3) : null;
    pass += line("V29-C 待机呼吸", HAS && rng >= 1.6, HAS ? "crouch 极差 = " + rng + "px（≥1.6；3.4s/34 采样）" : "钩子缺失（rig() 无 crouch）");
  }

  /* —— A 走路摆臂（x=180 起步 9 采样×80ms ⇒ 收在 <420，不触发 W1；走路排在敌兵可能出现之前/之内均无触线）—— */
  await G(() => window.__game.debug.setPlayerX(180));
  await sleep(350);
  let hxMin = Infinity, hxMax = -Infinity, hyMin = Infinity, hyMax = -Infinity;
  await page.keyboard.down("KeyD");
  { const t0 = Date.now();
    for (let i = 0; i < 9; i++) {
      const w = t0 + i * 80 - Date.now(); if (w > 0) await sleep(w);
      const r = await readRig(); if (HAS) { hxMin = Math.min(hxMin, r.hx); hxMax = Math.max(hxMax, r.hx); hyMin = Math.min(hyMin, r.hy); hyMax = Math.max(hyMax, r.hy); }
    } }
  await page.keyboard.up("KeyD");
  await page.screenshot({ path: SHOT + "-walk.png" });
  {
    const rx = HAS ? +(hxMax - hxMin).toFixed(2) : null, ry = HAS ? +(hyMax - hyMin).toFixed(2) : null;
    pass += line("V29-A 走路摆臂", HAS && rx >= 8.0 && ry >= 1.2,
      HAS ? "hand.x 极差 = " + rx + "px（≥8.0）｜hand.y 极差 = " + ry + "px（≥1.2）" : "钩子缺失（rig() 无 hand）");
  }

  /* —— B1 发带锚点在脑后（回到静立再读）—— */
  await sleep(700);
  let b1ok = false, b1det = "";
  {
    const r = await readRig();
    if (!HAS) b1det = "钩子缺失（rig() 无 ribbon）";
    else if (!r.rinit) b1det = "sa 链未初始化";
    else { const rel = +(r.ax - r.px).toFixed(2); b1ok = rel <= -1.0; b1det = "锚点相对玩家 x = " + rel + "px（≤−1.0 ⇒ 脑后）"; }
    pass += line("V29-B1 发带锚点在脑后", b1ok, b1det);
  }

  /* —— B2 飞行中发带不过锚（起跳全程采样）—— */
  await G(() => window.__game.debug.setPlayerX(240));
  await sleep(400);
  let b2min = Infinity, b2ok = false, b2det = "";
  if (HAS) {
    await page.keyboard.down("Space"); await sleep(60); await page.keyboard.up("Space");
    for (let i = 0; i < 14; i++) { const r = await readRig(); if (r.rinit) b2min = Math.min(b2min, r.s0y - r.ay); await sleep(50); }
    await page.screenshot({ path: SHOT + "-jump.png" });
    b2ok = b2min >= -2.5; b2det = "min(发带首节 y − 锚 y) = " + (+b2min.toFixed(2)) + "px（≥−2.5）";
  } else b2det = "钩子缺失（rig() 无 ribbon）";
  pass += line("V29-B2 飞行中发带不过锚", b2ok, b2det);

  pass += line("V29-0 零错误", errs.length === 0, errs.length + " pageerror / " + errs.length + " console.error" + (errs.length ? " " + JSON.stringify(errs.slice(0, 3)) : ""));

  console.log("---- 汇总：" + (pass >= 5 ? "PASS 5/5 全绿" : "PASS " + pass + "/5（有红）") + " ----");
  await browser.close();
  process.exit(pass >= 5 ? 0 : 1);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
