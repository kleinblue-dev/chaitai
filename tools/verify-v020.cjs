/* verify-v020.cjs —— 《拆台》v0.2 增量验收探针（Loop 1：台箱碰撞完备 ③侧挡 ＋ ④敌停步）
   断言（依据 review-v02/d2-levels/design.md §2.1③④ 与 §9 施工序第①步"须先灰盒验证"）：
   V20-A 玩家侧挡（红闸）：贴地走到台箱侧面 → 横向钳位在箱面 −6px（394=400−6）；对 v0.1.2 应"穿箱而过"(max≈934=红)
   V20-B 敌停步（红闸）：敌人追逐玩家、箱面挡路 → 停在箱面 +20px 停步带（774=754+20）；对 v0.1.2 红侧实测追到 371.3（≪772=红）
   V20-C 站台免打（回归钉；双侧预期绿，非红闸）：玩家站台箱顶、敌人贴身出招 → 出招真发生但 y 几何（54px>48px）天然打不中
   V20-0 全程 0 pageerror / 0 console.error
   用法：node tools/verify-v020.cjs
   环境：CHAITAI_URL（覆盖被测页，默认正本）／CHAITAI_SHOT_PREFIX（截图前缀）
   先红后绿：对 versions/v0.1.2/index.html 跑 => A、B 红（C 为钉、预期绿）；对正本跑 => 全绿（rc=0） */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v020/v020");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v020 ==");
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

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await sleep(400);

  /* ---------- V20-A 玩家侧挡（红闸） ----------
     台箱 x400..464（顶 390，高 80）→ 玩家从 300 贴地右行；箱面 400，钳位预期 394（−6）。
     红侧（无侧挡）会一路走到右边界 934。 */
  await page.evaluate(() => { const d = window.__game.debug;
    d.setPlatforms([{ x: 400, y: 390, w: 64, h: 80 }]); d.setPlayerX(300); }).catch(() => {});
  await sleep(300);
  await page.keyboard.down("KeyD");
  let xMax = -1;
  for (let i = 0; i < 14; i++) { await sleep(250);
    const x = await page.evaluate(() => window.__game.state().player.x).catch(() => -1);
    if (x > xMax) xMax = x; }
  await page.keyboard.up("KeyD");
  await shot("sideblock");
  report("V20-A 玩家侧挡", xMax >= 386 && xMax <= 400,
    "贴地右行最大 x=" + xMax + "（预期 394=400−6，判据 [386,400]；无侧挡的 v0.1.2 应≈934）");

  /* ---------- V20-B 敌停步（红闸） ----------
     台箱 x690..754（顶 390）；玩家 430（>420 触发第一波，且 adx<430 使敌进入追逐）。
     敌人从 800/880 追来：预期停在 754+20=774（[772,794] 证明"到了停步带"而非没动）。
     红侧会追到玩家身边（min≈455）。 */
  await page.evaluate(() => { const d = window.__game.debug;
    d.setPlatforms([{ x: 690, y: 390, w: 64, h: 80 }]); d.setPlayerX(430); }).catch(() => {});
  await sleep(400);
  let minEx = 1e9, seen = 0;
  for (let i = 0; i < 24; i++) { await sleep(250);
    const es = await page.evaluate(() => window.__game.state().enemies.filter(e => e.hp > 0).map(e => e.x)).catch(() => []);
    if (es.length > seen) seen = es.length;
    for (const x of es) if (x < minEx) minEx = x; }
  await shot("enemystop");
  report("V20-B 敌停步", seen >= 2 && minEx >= 772 && minEx <= 794,
    "敌人最左 x=" + (minEx === 1e9 ? "n/a（6s 内没看见敌人）" : minEx) + "（预期 774=754+20，判据 [772,794]；同屏最多 " + seen + " 敌；无停步的红侧实测追到 371.3）");

  /* ---------- V20-C 站台免打（回归钉；双侧预期绿） ----------
     先硬重置清场：红侧（v0.1.2）B 段里地面玩家会被敌人打到 46 血、残留敌人还会在 C 段
     把玩家打死重生（hp 回满、位置回出生点→假红），必须先归零再开 C。
     台箱 x470..534（顶 420，h50）。玩家 464 贴左面 → 真键跳上顶 → 顶面右行到 ~500。
     敌人停在右侧 554（534+20），adx≈50<58 进入 wind/strike（出招真发生）；
     打击 y 判据 |(420−27)−(470−23)|=54>48 → 天然不中。两版本都应按此几何成立 ⇒ 钉。 */
  await page.evaluate(() => { const g = window.__game; if (g.debug && g.debug.reset) g.debug.reset(); }).catch(() => {});
  await sleep(500);
  await page.evaluate(() => { const d = window.__game.debug;
    d.setPlatforms([{ x: 470, y: 420, w: 64, h: 50 }]); d.setPlayerX(464); }).catch(() => {});
  await sleep(350);
  await page.keyboard.down("Space"); await sleep(400); await page.keyboard.up("Space");
  let onTop = false;
  for (let i = 0; i < 20; i++) { await sleep(150);
    const s = await page.evaluate(() => window.__game.state()).catch(() => null);
    if (s && s.player.grounded && Math.abs(s.player.y - 420) < 3) { onTop = true; break; } }
  await page.keyboard.down("KeyD");
  for (let i = 0; i < 14; i++) { await sleep(150);
    const x = await page.evaluate(() => window.__game.state().player.x).catch(() => 0);
    if (x >= 498) break; }
  await page.keyboard.up("KeyD");
  const hp0 = await page.evaluate(() => window.__game.state().player.hp).catch(() => -1);
  let sawAttack = false, yEnd = -1;
  for (let i = 0; i < 24; i++) { await sleep(250);
    const s = await page.evaluate(() => window.__game.state()).catch(() => null);
    if (!s) continue;
    if (s.enemies.some(e => e.hp > 0 && (e.state === "wind" || e.state === "strike"))) sawAttack = true;
    yEnd = s.player.y; }
  const hpEnd = await page.evaluate(() => window.__game.state().player.hp).catch(() => -2);
  await shot("nodamage");
  report("V20-C 站台免打(钉/非红闸)", onTop && sawAttack && hp0 > 0 && hp0 === hpEnd && Math.abs(yEnd - 420) < 3,
    "站顶=" + onTop + " 敌出招=" + sawAttack + " hp " + hp0 + "→" + hpEnd + "（不变=6s 未掉血） 末 y=" + yEnd + "（420=仍在箱顶）");

  /* ---------- V20-0 零错误 ---------- */
  report("V20-0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : errs.slice(0, 5).join(" | "));
  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("探针崩溃：" + e.stack); process.exit(2); });
