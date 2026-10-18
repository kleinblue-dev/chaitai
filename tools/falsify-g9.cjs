#!/usr/bin/env node
/* 拆台 · 证伪 G9 —— 八个独立变异各建一份副本 ⇒ gate-9 必须见红（正本必须见绿）。
 *
 * 真文件（index.html＋game.js）只读；每个变异把 index.html＋assets/＋变异后的 game.js
 * 复制到 shots/falsify-g9/<变异号>/，从副本目录加载 index.html 跑 gate-9。
 * 每个变异锚点 regex 均带 want=1 门槛：命中数≠1 ⇒ 该项判不出（防正则日后变宽误伤两处）。
 *
 * 变异（锚点均在 2026-10-15 实测行号核对过；行号=W3 落地版）：
 *   M1  :615 ACTS[4].stage "playable"→"planned"（第三幕被判未接线）—— 预期锚红 G9.2
 *       连锁：G9.3 起全红（进不了第三幕）
 *   M2  :617 lamp.T 6.0→4.2（灯带周期不对）—— 预期锚红 G9.6（T/公式）
 *       连锁：G9.16 安全窗（探针按 mod 6 计算）可能失准 ⇒ 连带红属预期
 *   M3  :620 drops.stagger 0.9→0.35（错峰变密）—— 预期锚红 G9.11b（lead 0/0.9/1.8 不再）
 *   M4  :731 清场链 W3 门整条件改 false（清场即自动开墙，不守「墙倒前不开」）—— 预期锚红 G9.15
 *   M5  :621 wall.hp 32→64（三连拆不掉）—— 预期锚红 G9.14（hp 值）＋连锁 G9.16b（无 breaking）
 *   M6  :695 删 STG.t3build 创建（幕终无搭台）—— 预期锚红 G9.18＋连锁 G9.18b/G9.19
 *   M7  :694 删幕终收灯循环（灯带不收）—— 预期锚红 G9.18b（灯带已收 conjunct）
 *   M8  :754 落物触发相位 +2.5s（不再贴灯带过界拍）—— 预期锚红 G9.11（检测刻 m 超窗）
 *
 * 已核盲区（写明，防过度声称）：
 *   a) 同拍判定是行为面近似：G9.11 检查「检测刻 lamp.t mod 6 ≤1.2」——M8 用 +2.5s 大相位偏移
 *      保证落在窗外（确定性红）；探针不解析调度器内部，只认可观测相位。
 *   b) 安全窗只保「按击期间不挨灯扫」：G9.16 不断言灯带碰撞伤害本身（trap_lamp 族 Loop3 旧闸覆盖）。
 *   c) G9.19 用 setPlayerPos 传送到 T3 上方再落：只证「T3 可站」，不证「玩家跳得上 T3」（跳高属 W4 标定）。
 *   d) G9.18b「灯带已收」的前置＝灯带在场（G9.6/G9.11 已证）；M7 只拆收灯循环一环。
 *
 * 判定（逐变异）：正本绿 ＋ 该变异副本红、且红里含该变异锚 ⇒ 该项成立；
 *   副本还绿 / 锚不在红里 ⇒ 该项失败。正本自己红 / 锚点建不起来 ⇒ 判不出。
 * exit：0=全部成立；1=有失败；2=建不起来/判不出
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = "D:/2006L/chaitai";
const SRC_HTML = path.join(ROOT, "index.html");
const SRC_JS = path.join(ROOT, "game.js");
const SRC_ASSETS = path.join(ROOT, "assets");
const OUTBASE = path.join(ROOT, "shots", "falsify-g9");
const GATE = path.join(ROOT, "tools", "gate-9-acts3.cjs");

const MUTS = [
  { id: "M1", desc: "ACTS[4].stage playable→planned（第三幕未接线）", want: 1,
    re: /(4:\{name:"第三幕",stage:)"playable"/g, to: '$1"planned"',
    anchor: "G9.2" },
  { id: "M2", desc: "lamp.T 6.0→4.2（灯带周期不对）", want: 1,
    re: /lamp:\{T:6\.0\}/g, to: "lamp:{T:4.2}",
    anchor: "G9.6" },
  { id: "M3", desc: "drops.stagger 0.9→0.35（错峰变密）", want: 1,
    re: /stagger:0\.9/g, to: "stagger:0.35",
    anchor: "G9.11b" },
  { id: "M4", desc: "清场链 W3 门整条件改 false（清场即自动开墙）", want: 1,
    re: /if\(encNow&&encNow\.wall&&encNow\.wall\.breakable&&\(wall\.built\|\|wall\.rising\)\)/g, to: "if(false)",
    anchor: "G9.15" },
  { id: "M5", desc: "wall.hp 32→64（三连拆不掉）", want: 1,
    re: /wall:\{breakable:true,hp:32\}/g, to: "wall:{breakable:true,hp:64}",
    anchor: "G9.14" },
  { id: "M6", desc: "删 STG.t3build 创建（幕终无搭台）", want: 1,
    re: /STG\.t3build=\{t:0,done:false\}; \}/g, to: "}",
    anchor: "G9.18" },
  { id: "M7", desc: "删幕终收灯循环（灯带不收）", want: 1,
    re: /for\(var ti=traps\.length-1;ti>=0;ti--\)if\(traps\[ti\]\.type==="lamp"\)traps\.splice\(ti,1\);/g, to: "",
    anchor: "G9.18b" },
  { id: "M8", desc: "落物触发相位 +2.5s（不再贴灯带过界拍）", want: 1,
    re: /var lt=lampT\(\), cyc=Math\.floor\(lt\/world\.lampPeriod\);/g, to: "var lt=lampT(), cyc=Math.floor((lt+2.5)/world.lampPeriod);",
    anchor: "G9.11" },
];

(async () => {
  console.log("== falsify-g9：八个变异各建副本 ⇒ gate-9 必须在各自锚点见红 ==");
  if (!fs.existsSync(SRC_HTML) || !fs.existsSync(SRC_JS)) {
    console.log("!! 正本不全 —— 证伪实验建不起来"); process.exit(2);
  }
  const srcHtml = fs.readFileSync(SRC_HTML, "utf8");
  const srcJs = fs.readFileSync(SRC_JS, "utf8");

  const runGate = (url, tag, outdir) => new Promise((resolve) => {
    const child = spawn(process.execPath, [GATE], {
      env: Object.assign({}, process.env, { CHAITAI_URL: url, CHAITAI_SHOT_PREFIX: "falsify-g9-" + tag + "-" }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let txt = "";
    child.stdout.on("data", (d) => { txt += d; });
    child.stderr.on("data", (d) => { txt += d; });
    const killer = setTimeout(() => { console.log("  !! " + tag + " 超 900s，掐掉"); try { child.kill(); } catch (e) {} }, 900000);
    child.on("close", (code) => {
      clearTimeout(killer);
      if (outdir) fs.writeFileSync(path.join(outdir, "gate-on-" + tag + ".txt"), txt, "utf8");
      resolve({ rc: code, txt });
    });
  });
  const parse = (txt) => ({
    failIds: (txt.match(/\[FAIL\]\s+(\S+)/g) || []).map((x) => x.replace(/\[FAIL\]\s+/, "")),
    nPass: (txt.match(/\[PASS\]/g) || []).length,
    gateLine: (txt.match(/^GATE .*$/m) || ["(没有 GATE 行)"])[0],
  });

  fs.mkdirSync(OUTBASE, { recursive: true });
  const pristine = await runGate("file:///D:/2006L/chaitai/index.html", "pristine", OUTBASE);
  const pp = parse(pristine.txt);
  console.log("—— 正本：rc=" + pristine.rc + "  PASS " + pp.nPass + " 条  " + pp.gateLine);
  if (pristine.rc !== 0) {
    console.log("   [!!] 正本 gate-9 本身红（FAIL=[" + pp.failIds.join(" ") + "]）⇒ 判不出，先把正本修绿。");
    fs.writeFileSync(path.join(OUTBASE, "verdict.txt"), "判不出（正本红）\nFAIL=[" + pp.failIds.join(" ") + "]\n", "utf8");
    process.exit(2);
  }

  let allOk = true, summary = [];
  for (const mut of MUTS) {
    const hits = (srcJs.match(mut.re) || []).length;
    if (hits !== mut.want) { console.log("!! " + mut.id + " 锚点命中 " + hits + " 处（期望 " + mut.want + "）（实现形式变了？）⇒ 该项判不出"); allOk = false; summary.push(mut.id + "=锚点未命中(" + hits + "/" + mut.want + ")"); continue; }
    const mutantJs = srcJs.replace(mut.re, mut.to);
    const outdir = path.join(OUTBASE, mut.id);
    fs.mkdirSync(outdir, { recursive: true });
    fs.writeFileSync(path.join(outdir, "index.html"), srcHtml, "utf8");
    fs.writeFileSync(path.join(outdir, "game.js"), mutantJs, "utf8");
    if (fs.existsSync(SRC_ASSETS)) fs.cpSync(SRC_ASSETS, path.join(outdir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(outdir, "mutation.txt"),
      "变异 " + mut.id + "：" + mut.desc + "\n命中 " + hits + " 处（只改副本 " + outdir + "/game.js；真文件未动；PRIVATE 副本勿发布）\n", "utf8");

    const mr = await runGate("file:///D:/2006L/chaitai/shots/falsify-g9/" + mut.id + "/index.html", mut.id, outdir);
    const mm = parse(mr.txt);
    console.log("—— " + mut.id + "（" + mut.desc + "）×" + hits + "：rc=" + mr.rc + "  FAIL=[" + mm.failIds.join(" ") + "]");
    const extra = mm.failIds.filter((x) => x !== mut.anchor);
    if (extra.length) console.log("   [warn] 除锚 " + mut.anchor + " 外还有连带红：" + extra.join(" ") + "（连锁副作用，逐条对照预期）");
    if (mr.rc === 0) { console.log("   [BAD] 变异副本居然全绿 —— gate-9 的该组断言是瞎的"); allOk = false; summary.push(mut.id + "=副本竟绿"); }
    else if (mm.failIds.indexOf(mut.anchor) < 0) { console.log("   [BAD] 副本红了但锚 " + mut.anchor + " 不在红里 —— 红在别处不算数"); allOk = false; summary.push(mut.id + "=锚未红"); }
    else { console.log("   锚 " + mut.anchor + " 红 ✓"); summary.push(mut.id + "=成立(" + mm.failIds.length + "红)"); }
    fs.writeFileSync(path.join(outdir, "verdict.txt"), (mr.rc !== 0 && mm.failIds.indexOf(mut.anchor) >= 0 ? "证伪成立" : "证伪失败") + "（变异 " + mut.id + "，锚 " + mut.anchor + "）\n", "utf8");
  }

  fs.writeFileSync(path.join(OUTBASE, "verdict.txt"),
    (allOk ? "证伪成立（8/8）" : "证伪失败") + "：" + summary.join("；") + "（正本 PASS " + pp.nPass + "）\n", "utf8");
  console.log(allOk ? "=> 证伪成立：正本全绿，8 个变异各自在锚点见红。" : "=> 证伪失败（见上）。");
  process.exit(allOk ? 0 : 1);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
