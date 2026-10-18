/* verify-v024.cjs —— 《拆台》v0.2 增量验收探针（Loop 5：检查点/存档灰盒）
   依据：review-v02/d2-levels/design.md §7（幕推进与检查点链·durable 建议）＋
   review-v02/d8-qa/qa-plan.md §1 契约 v2（state().save{slot,version,dirty}／registry.checkpoints[]／
   durableFields[]）＋ gate-11-save 的 M3 判据灰盒子集（指纹往返×3、坏档不崩、清档、版本迁移桩）。
   介质：localStorage（今日实测 file:// 下可用：读写/重载持久/跨进程启动持久）。
   断言（10 判据行 / 9 组）：
   V24-A 出厂契约（title 态）：save={enabled:true,slot:null,version:1,dirty:false}；registry.durableFields=7 条（含 ended，W4）；
         checkpoints=32（live 32 条且序=game_start>…>a3_end>act4_open>boss_intro>a4_p1>a4_p2>a4_p3>a4_down>a4_choice>end_a>end_b>end_c>end_d＋planned 0；W1 第一幕 a1_* 翻 live、W2 第二幕 a2_* 翻 live、W3 第三幕 a3_* 翻 live、W4 终幕 a4_* 与 end_* 翻 live——检查点链至此全 live）；
         saveRead={ok:false,reason:"empty"}（无档）。
   V24-B1 cp 链·首局：Enter 开始 ⇒ log=[game_start]（0.5s 与旁白同拍）；x>420 ⇒ wave1；清 W1 ⇒ wave2；
         清 W2 ⇒ arena_cleared；outro 确认 ⇒ log 前 5＝[game_start,wave1,wave2,arena_cleared,outro]。
   V24-B2 cp 链·R 重开（真键）：showRestart 后按 R ⇒ log=[restart_done]（单元素，重启=新局起点）。
   V24-C 指纹确定性＋形状：saveFingerprint()×2 逐字节相等；JSON.parse 为 7 元数组（number/string/number/
         number/number/string/array）。
   V24-D 往返×3（d8 M3）：saveWrite{ok:true} ⇒ saveRead×3 全 ok 且 durable 指纹与当前指纹相等；
         页面内直读 localStorage[chaitai.save.v1]：v=1、ts 数字>0、durable 七字段齐。
   V24-E 坏档三连·不崩可继续：①"not-json"⇒corrupt；②{"v":1}⇒corrupt；③v99 合法 durable⇒version(found=99)；
         每步后 phase 恒 "playing"（游戏可继续）＋全程 0 pageerror。
   V24-F 清档：saveClear ⇒ saveRead=empty、save.slot=null、dirty=false。
   V24-G dirty 语义：saveWrite 后 dirty=false；走一次拆台（x<120→回>170，defyLeft+1）⇒ dirty=true。
   V24-H 跨 reload 持久：page.reload ⇒ save.slot="auto"（读回存档元）＋当前新局指纹≠档指纹 ⇒ dirty=true。
   V24-0 零错误：0 pageerror / 0 console.error
   用法：node tools/verify-v024.cjs
   环境：CHAITAI_URL（覆盖被测页，默认正本）／CHAITAI_SHOT_PREFIX（截图前缀）
   先红后绿：对 versions/v0.1.2/index.html 跑 => 9 红全在预期 ID（钩子缺失/契约旧形状）；对正本跑 => 全绿（rc=0） */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.CHAITAI_URL || ("file:///" + ROOT.replace(/\\/g, "/") + "/index.html");
const SHOT = process.env.CHAITAI_SHOT_PREFIX || (ROOT + "/shots/verify-v024/v024");
const SAVE_KEY = "chaitai.save.v1";
function md5(p) { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];
function report(id, ok, detail) { results.push({ id, ok, detail }); console.log("[" + (ok ? "PASS" : "FAIL") + "] " + id + " —— " + detail); }

(async () => {
  console.log("== verify-v024 ==");
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
  const G = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  const has = (p) => G((p) => { try { return !!p.split(".").reduce((o, k) => o && o[k], window.__game); } catch (e) { return false; } }, p);

  await page.goto(URL_, { waitUntil: "load" });
  await sleep(900);

  /* ---------- V24-A 出厂契约（title 态；先清环境档保证幂等） ---------- */
  {
    const pre = await G((K) => localStorage.getItem(K), SAVE_KEY);
    let note = "";
    if (pre != null) { await G((K) => localStorage.removeItem(K), SAVE_KEY); note = "（环境有档已预清）"; }
    if (!(await has("debug.saveFingerprint")) || !(await has("debug.saveWrite")) || !(await has("debug.cp"))) {
      report("V24-A 出厂契约(title态)", false, "debug.saveWrite/saveRead/saveClear/saveFingerprint/cp 不存在（v0.1.2 无存档灰盒，应有此红）");
    } else {
      const s = await G(() => window.__game.state());
      const reg = await G(() => window.__game.debug.registry);
      const rd = await G(() => window.__game.debug.saveRead());
      const live = reg.checkpoints.filter(c => c.stage === "live");
      const liveIds = live.map(c => c.id).join(">");
      const planned = reg.checkpoints.filter(c => c.stage === "planned").length;
      const okA = s.save.enabled === true && s.save.slot === null && s.save.version === 1 && s.save.dirty === false
        && reg.durableFields.length === 7 && reg.checkpoints.length === 32 && live.length === 32 && planned === 0
        && liveIds === "game_start>wave1>wave2>arena_cleared>outro>restart_done>a1_e1>a1_e2>a1_e3>a1_end>act2_open>a2_teach>a2_a1>a2_a2>a2_end>act3_open>a3_1>a3_2>a3_3>a3_break>a3_end>act4_open>boss_intro>a4_p1>a4_p2>a4_p3>a4_down>a4_choice>end_a>end_b>end_c>end_d" && rd.ok === false && rd.reason === "empty";
      report("V24-A 出厂契约(title态)", okA,
        "save=" + JSON.stringify(s.save) + "（期望 enabled:true/slot:null/version:1/dirty:false）" +
        " durableFields=" + reg.durableFields.length + "（期望7） checkpoints=" + reg.checkpoints.length + "（期望32=live32+planned0，W4 后链全 live）" +
        " live序=" + liveIds + " saveRead=" + JSON.stringify(rd) + "（期望 empty）" + note);
    }
  }

  /* ---------- V24-B1 cp 链·首局（Enter→game_start→wave1→wave2→arena_cleared→outro） ---------- */
  let b1ok = false;
  if (!(await has("debug.cp"))) {
    report("V24-B1 cp链·首局", false, "debug.cp 不存在（应有此红）");
  } else {
    await page.keyboard.press("Enter");
    await sleep(800);
    let cpNow = await G(() => window.__game.debug.cp());
    const gotStart = cpNow.log.length === 1 && cpNow.log[0].id === "game_start";
    await G(() => window.__game.debug.setPlayerX(430));
    await sleep(350);
    cpNow = await G(() => window.__game.debug.cp());
    const gotW1 = cpNow.log.some(x => x.id === "wave1");
    /* 清 W1（防御循环：出生竞态下多清几轮） */
    let w2 = false;
    for (let i = 0; i < 10; i++) {
      await G(() => window.__game.debug.clearWave());
      await sleep(320);
      const s = await G(() => window.__game.state().wave);
      if (s === 2) { w2 = true; break; }
    }
    /* 清 W2 → 等 arena_cleared → 等 outro */
    let gotClear = false, gotOutro = false;
    for (let i = 0; i < 14; i++) {
      await G(() => window.__game.debug.clearWave());
      await sleep(320);
      const ids = await G(() => window.__game.debug.cp().log.map(x => x.id));
      if (ids.indexOf("arena_cleared") >= 0) gotClear = true;
      if (ids.indexOf("outro") >= 0) { gotOutro = true; break; }
    }
    await shot("first-run-outro");
    const ids = await G(() => window.__game.debug.cp().log.map(x => x.id));
    const head5 = ids.slice(0, 5).join(">");
    b1ok = gotStart && gotW1 && w2 && gotClear && gotOutro && head5 === "game_start>wave1>wave2>arena_cleared>outro";
    report("V24-B1 cp链·首局", b1ok,
      "首点=" + (ids[0] || "-") + " wave2见=" + w2 + " arena_cleared见=" + gotClear + " outro见=" + gotOutro +
      " 前5序=" + head5 + "（期望 game_start>wave1>wave2>arena_cleared>outro）");
  }

  /* ---------- V24-B2 cp 链·R 重开（真键） ---------- */
  if (!(await has("debug.cp"))) {
    report("V24-B2 cp链·R重开", false, "debug.cp 不存在（应有此红）");
  } else {
    const sr = await G(() => { const s = window.__game.state(); return s.cleared; });
    await page.keyboard.press("r");
    await sleep(400);
    const log = await G(() => window.__game.debug.cp().log.map(x => x.id));
    const okB2 = sr === true && log.length === 1 && log[0] === "restart_done";
    await shot("after-restart");
    report("V24-B2 cp链·R重开", okB2,
      "R前cleared=" + sr + "（期望true=showRestart已开） R后log=" + JSON.stringify(log) + "（期望[restart_done]单元素）");
  }

  /* ---------- V24-C 指纹确定性＋形状 ---------- */
  if (!(await has("debug.saveFingerprint"))) {
    report("V24-C 指纹确定性+形状", false, "debug.saveFingerprint 不存在（应有此红）");
  } else {
    const fp1 = await G(() => window.__game.debug.saveFingerprint());
    const fp2 = await G(() => window.__game.debug.saveFingerprint());
    let arr = null; try { arr = JSON.parse(fp1); } catch (e) {}
    const shape = !!arr && arr.length === 7 && typeof arr[0] === "number" && typeof arr[1] === "string"
      && typeof arr[2] === "number" && typeof arr[3] === "number" && typeof arr[4] === "number"
      && typeof arr[5] === "string" && Object.prototype.toString.call(arr[6]) === "[object Array]";
    const okC = fp1 === fp2 && shape;
    report("V24-C 指纹确定性+形状", okC,
      "两次相等=" + (fp1 === fp2) + " 7元形状=" + shape + " fp=" + fp1);
  }

  /* ---------- V24-D 往返×3（M3 判据） ---------- */
  if (!(await has("debug.saveWrite"))) {
    report("V24-D 往返×3", false, "debug.saveWrite 不存在（应有此红）");
  } else {
    const w = await G(() => window.__game.debug.saveWrite());
    const curFp = await G(() => window.__game.debug.saveFingerprint());
    const reads = [];
    for (let i = 0; i < 3; i++) {
      const r = await G(() => window.__game.debug.saveRead());
      let fpR = null; try { fpR = r.ok ? JSON.stringify([r.data.durable.act, r.data.durable.cp, r.data.durable.deaths, r.data.durable.defyLeft, r.data.durable.perfDodges, r.data.durable.difficulty, r.data.durable.ended]) : null; } catch (e) {}
      reads.push({ ok: r.ok, same: fpR === curFp });
    }
    const raw = await G((K) => { try { return localStorage.getItem(K); } catch (e) { return "ERR"; } }, SAVE_KEY);
    let rawOk = false, rawv = null;
    try { const o = JSON.parse(raw); rawv = o.v; rawOk = o.v === 1 && typeof o.ts === "number" && o.ts > 0 && typeof o.durable === "object"; } catch (e) {}
    const okD = w.ok === true && reads.every(r => r.ok && r.same) && rawOk;
    report("V24-D 往返×3", okD,
      "write=" + w.ok + " 3读全ok且指纹同=" + reads.every(r => r.ok && r.same) +
      " 直读存档 v=" + rawv + "（期望1，ts数字，durable七字段） 当前fp=" + curFp);
  }

  /* ---------- V24-E 坏档三连·不崩可继续 ---------- */
  if (!(await has("debug.saveRead"))) {
    report("V24-E 坏档三连", false, "debug.saveRead 不存在（应有此红）");
  } else {
    const errsBefore = errs.length;
    const phases = [];
    const put = async (raw) => { await G((a) => { try { localStorage.setItem(a[0], a[1]); } catch (e) {} }, [SAVE_KEY, raw]); };
    await put("not-json");
    let r1 = await G(() => window.__game.debug.saveRead());
    phases.push(await G(() => window.__game.state().phase));
    await put('{"v":1}');
    let r2 = await G(() => window.__game.debug.saveRead());
    phases.push(await G(() => window.__game.state().phase));
    await put('{"v":99,"ts":1,"durable":{"act":1,"cp":"x","deaths":0,"defyLeft":0,"perfDodges":0,"difficulty":"normal","ended":[]}}');
    let r3 = await G(() => window.__game.debug.saveRead());
    phases.push(await G(() => window.__game.state().phase));
    const okE = r1.ok === false && r1.reason === "corrupt" && r2.ok === false && r2.reason === "corrupt"
      && r3.ok === false && r3.reason === "version" && r3.found === 99
      && phases.every(p => p === "playing") && errs.length === errsBefore;
    report("V24-E 坏档三连", okE,
      "①not-json=" + r1.reason + " ②缺durable=" + r2.reason + " ③v99=" + r3.reason + "(found=" + r3.found + ")" +
      " 三步后phase=" + JSON.stringify(phases) + "（期望全playing） 新增错误=" + (errs.length - errsBefore));
  }

  /* ---------- V24-F 清档 ---------- */
  if (!(await has("debug.saveClear"))) {
    report("V24-F 清档", false, "debug.saveClear 不存在（应有此红）");
  } else {
    await G(() => window.__game.debug.saveClear());
    const rd = await G(() => window.__game.debug.saveRead());
    const s = await G(() => window.__game.state());
    const okF = rd.ok === false && rd.reason === "empty" && s.save.slot === null && s.save.dirty === false;
    report("V24-F 清档", okF,
      "clear后 read=" + JSON.stringify(rd) + "（期望empty） save.slot=" + s.save.slot + "（期望null） save.dirty=" + s.save.dirty + "（期望false）");
  }

  /* ---------- V24-G dirty 语义 ---------- */
  if (!(await has("debug.saveWrite"))) {
    report("V24-G dirty语义", false, "debug.saveWrite 不存在（应有此红）");
  } else {
    await G(() => window.__game.debug.saveWrite());
    await sleep(120);
    const d0 = await G(() => window.__game.state().save.dirty);
    await G(() => window.__game.debug.setPlayerX(100));
    await sleep(150);
    await G(() => window.__game.debug.setPlayerX(200));
    await sleep(150);
    const st = await G(() => { const s = window.__game.state(); return { dirty: s.save.dirty, defy: s.narrator.counters.defyLeft }; });
    const okG = d0 === false && st.dirty === true && st.defy === 1;
    report("V24-G dirty语义", okG,
      "写后dirty=" + d0 + "（期望false） 拆台一次 defyLeft=" + st.defy + "（期望1） ⇒ dirty=" + st.dirty + "（期望true）");
  }

  /* ---------- V24-H 跨 reload 持久 ---------- */
  if (!(await has("debug.saveRead"))) {
    report("V24-H 跨reload持久", false, "debug.saveRead 不存在（应有此红）");
  } else {
    await page.reload({ waitUntil: "load" });
    await sleep(900);
    const s = await G(() => window.__game.state());
    const raw = await G((K) => { try { return localStorage.getItem(K) != null; } catch (e) { return false; } }, SAVE_KEY);
    const okH = s.save.enabled === true && s.save.slot === "auto" && s.save.dirty === true && raw === true;
    report("V24-H 跨reload持久", okH,
      "reload后 slot=" + s.save.slot + "（期望auto=读回存档元） dirty=" + s.save.dirty + "（期望true=新局指纹≠档） 档在盘=" + raw);
  }

  /* ---------- V24-0 零错误 ---------- */
  report("V24-0 零错误", errs.length === 0, errs.length === 0 ? "0 pageerror / 0 console.error" : JSON.stringify(errs.slice(0, 4)));

  await browser.close();
  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log("---- 汇总：PASS " + pass + "/" + results.length + (fail === 0 ? " 全绿" : "（红 " + fail + "）") + " ----");
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("崩溃：" + e.stack); process.exit(2); });
