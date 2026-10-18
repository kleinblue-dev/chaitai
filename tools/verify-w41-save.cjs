/* verify-w41-save.cjs —— 《拆台》W4.1 A 批 A7：结局落盘（beginEnding 尾 saveWrite()）验收探针
   依据：批量A-实施清单.md A7（K9·2 方）——游戏·结局触发即落盘，收集跨 reload 成立。
   走法（复用 gate-10 G10.13c 同款）：Enter→playing → debug.startAct(5) → 等 boss.active
     → bossDamage(120) 击杀 → 等 spare 开窗（defeat+2.2s）→ spare.t≥1.5 真键 J 补刀 → 等 ending 出现。
   断言（先红后绿）：
   W41S.1 前置·走结局：内存态 ending=X 且 ended 含 X（两侧应绿——红侧红在「没落盘」不在「没出结局」）
   W41S.2 落盘·结局触发后（未 reload）：debug.saveRead().ok===true（红侧：无写入者 ⇒ false/"empty"）
   W41S.3 跨 reload·内容：page.reload() 后 durable.ended 含 X（红侧=[]）
   W41S.4 跨 reload·回读成立：state().save.slot==="auto" 且 durable.cp===X（boot 回读 IIFE 识别到存档）
   W41S.0 全程 0 pageerror / 0 console.error（含 reload 前后）
   口径说明（清单措辞偏离）：清单原文写「断言 state().ended 仍含该结局 id」；reload 后 state().ended 是
   内存 world.ended（boot 不恢复 durable——灰盒口径「不带读档恢复」，恢复接线属 B 批/幕循环）⇒ 后装树上
   恒为 []，无判别力。故 S.3 改读 saveRead().data.durable.ended（落盘副本=reload 后唯一可观测），
   S.4 另以 state().save.slot 佐证 boot 侧回读成立。内容一致（ended 含 X），仅观测面换为落盘副本。
   用法：node tools/verify-w41-save.cjs
   环境：CHAITAI_URL（默认正本）／CHAITAI_SHOT_PREFIX
   先红后绿：改码前 ⇒ W41S.2/.3/.4 红、.1/.0 绿；改码后 ⇒ 全绿 rc=0 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-w41-save/w41s");
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-w41-save（A7 结局落盘） ==");
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
  const st = () => page.evaluate(() => window.__game.state());
  const readSave = () => page.evaluate(() => { const r = window.__game.debug.saveRead();
    return r.ok ? { ok: true, cp: r.data.durable.cp, ended: r.data.durable.ended, ts: r.data.ts } : { ok: false, reason: r.reason }; });
  const until = async (fn, ms) => { const t0 = Date.now(); let last = null;
    while (Date.now() - t0 < ms) { last = await fn(); if (last) return last; await sleep(120); } return null; };

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);
  await page.keyboard.press("Enter");
  await page.waitForFunction('window.__game.state().phase === "playing"', { timeout: 4000 });
  await page.evaluate(() => window.__game.debug.saveClear()); /* 明确空基线（每次启动是新 profile；clear 只为口径干净） */
  const base = await readSave();
  console.log("基线：saveRead=" + JSON.stringify(base) + "（期望 empty＝干净）");

  /* —— 走结局（gate-10 G10.13c 同款快径）—— */
  await page.evaluate(() => window.__game.debug.startAct(5));
  const bossUp = await until(async () => (await st()).boss.active ? true : null, 6000);
  if (bossUp) { /* 等入场帧过掉，防 hitBoss 落在激活前 */ }
  await page.evaluate(() => window.__game.debug.bossDamage(120));
  const sSp = await until(async () => { const s = await st(); return (s.spare && s.spare.open && s.spare.t >= 1.5) ? s : null; }, 6500);
  console.log("Boss 激活=" + !!bossUp + "  spare=" + JSON.stringify(sSp ? sSp.spare : null));
  for (let i = 0; i < 3 && sSp; i++) { /* J 补刀（S.t≥1.5 已过 1.2 防误触线；多点几次防单次边沿丢失） */
    await page.keyboard.press("KeyJ"); await sleep(700);
    if ((await st()).ending) break;
  }
  const sE = await until(async () => { const s = await st(); return s.ending ? s : null; }, 4000);
  const X = sE ? sE.ending : null;
  await shot("01-ending");
  report("W41S.1 前置·走结局", !!sE && !!X && (sE.ended || []).indexOf(X) >= 0,
    sE ? ("ending=" + X + " ended=" + JSON.stringify(sE.ended) + " cp=" + (await page.evaluate(() => window.__game.debug.cp().id)))
       : "8s 内没出结局（走法失效，红绿皆疑问）");

  /* —— 落盘（未 reload）—— */
  const w1 = await readSave();
  report("W41S.2 结局触发后 saveRead().ok", w1.ok === true,
    "saveRead=" + JSON.stringify(w1) + "（红侧预期：无写入者 ⇒ {ok:false,reason:\"empty\"}）");

  /* —— 跨 reload —— */
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction('window.__game && typeof window.__game.state === "function"', { timeout: 15000 });
  await sleep(500);
  const w2 = await readSave();
  const sBoot = await st();
  await shot("02-after-reload");
  report("W41S.3 reload 后 durable.ended 含结局 id", w2.ok === true && X !== null && (w2.ended || []).indexOf(X) >= 0,
    "durable=" + JSON.stringify(w2) + "（期望含 " + X + "；红侧=[] 或 empty）");
  report("W41S.4 reload 后 boot 回读成立（slot=auto＋cp=结局 id）",
    sBoot.save && sBoot.save.slot === "auto" && w2.ok === true && w2.cp === X,
    "state().save=" + JSON.stringify(sBoot.save) + " durable.cp=" + (w2.ok ? w2.cp : "n/a") + "（期望 slot=auto、cp=" + X + "）");

  /* —— W41S.0 零错误 —— */
  report("W41S.0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error（含 reload 前后）" : errs.slice(0, 5).join(" | "));
  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log("---- 汇总：PASS " + (results.length - bad) + "/" + results.length + (bad ? "（红 " + bad + "）" : " 全绿") + " ----");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("探针崩溃：" + e.stack); process.exit(2); });
