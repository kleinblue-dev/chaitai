#!/usr/bin/env node
/* 拆台 · 证伪 G8 —— 八个独立变异各建一份副本 ⇒ gate-8 必须见红（正本必须见绿）。
 *
 * 真文件（index.html＋game.js）只读；每个变异把 index.html＋assets/＋变异后的 game.js
 * 复制到 shots/falsify-g8/<变异号>/，从副本目录加载 index.html 跑 gate-8。
 * 每个变异锚点 regex 均带 want=1 门槛：命中数≠1 ⇒ 该项判不出（防正则日后变宽误伤两处）。
 *
 * 变异（锚点字节形状在 W2/W3 各实测核对；行号仅参考、随波次漂移）：
 *   M1  （W2 :595 → W3 改锚）删 ACTS[3].plats 台箱数据（第二幕两箱没了）—— 预期锚红 G8.5（深比错）
 *       W3 改锚因：第三幕沿用同台箱表 ⇒ 裸数据形状命中 2；改「3:{name:"第二幕"…\n plats:」上下文唯一定位
 *   M2  :594 ACTS[3].stage "playable"→"planned"（第二幕被判未接线）—— 预期锚红 G8.1
 *       连锁：G8.2 起全红（进不了第二幕，全部断言无数据）——一并列出核对
 *   M3  :600 wallRule.triggerX 190→0（x<190 永不触发 ⇒ 0.6s 预告都出不来）—— 预期锚红 G8.11a
 *       连锁：G8.11b/c/d、G8.13/14/15（无预告⇒无墙）附随红
 *   M4  :703 删清场自动开（清场后墙永不撤）—— 预期锚红 G8.11e
 *       连锁：墙卡着 ⇒ A2-3 配额虽重置但 !wall.built 拦着 ⇒ G8.13/14/15 红
 *   M5  （W2 :450 → W3 改锚）删 updWall pendingOpen 兜底（升墙窗口清场 ⇒ 墙升满后永留）—— 预期锚红 G8.15
 *       W3 改锚因：现形加 &&!wall.breaking（崩落期不消费）；正则 (?:&&!wall\.breaking)? 兼容两形
 *   M6  :719 预告中途回场不撤销（if(player.x>=trigger)写死 false；回场也照砌）—— 预期锚红 G8.11b
 *   M7  :720 砌墙 sideRight 写死 true（x<150 也走右支）—— 预期锚红 G8.14（false 支）
 *       （:713 序章同形语句不在命中范围——regex 带 W2 专属尾注）
 *   M8  :716 整串删砌墙护栏（!built&&!rising&&!opening＋每场配额 wallUsedEnc!==enc 一起删；墙成后玩家被推回 166、仍<190 ⇒ 反复重砌）
 *       —— 预期锚红 G8.11d（「每场最多 1 次」的行为面）
 *   已核盲区（2026-10-15 两轮实证）：
 *   a) 状态三连与每场配额互为冗余 —— 单独删任一侧，另一侧顶上 ⇒ 行为等价、gate-8 全绿；
 *      故 M8 必须整串删才在行为面（11d 的「无新预告/无二次 rising」）可观测。
 *   b) G8.15 旧写法（直接等 built=false）会被「还在升」的 built=false 立刻满足＝空断言 ——
 *      M5（删 pendingOpen 兜底）竟全绿暴露此点；gate-8 已改两段式（G8.15a 先见升满、G8.15 再见开完）。
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
const OUTBASE = path.join(ROOT, "shots", "falsify-g8");
const GATE = path.join(ROOT, "tools", "gate-8-acts2.cjs");

const MUTS = [
  { id: "M1", desc: "删 ACTS[3].plats 台箱数据（第二幕两箱没了）", want: 1,
    re: /(3:\{name:"第二幕",stage:"playable"[^\n]*\n\s*plats:)\[\{x:210,y:420,w:64,h:50\},\{x:650,y:390,w:64,h:80\}\],/g, to: "$1[],",
    anchor: "G8.5" },
  { id: "M2", desc: "ACTS[3].stage playable→planned（第二幕未接线）", want: 1,
    re: /(3:\{name:"第二幕",stage:)"playable"/g, to: '$1"planned"',
    anchor: "G8.1" },
  { id: "M3", desc: "wallRule.triggerX 190→0（预告永不触发）", want: 1,
    re: /triggerX:190/g, to: "triggerX:0",
    anchor: "G8.11a" },
  { id: "M4", desc: "删清场自动开（清场后墙永不撤）", want: 1,
    re: / if\(wall\.built\)openWall\(\); else if\(wall\.rising\)wall\.pendingOpen=true; \/\* W2：d2 §3 清场自动开（墙还在升 ⇒ 升满再开） \*\//g, to: "",
    anchor: "G8.11e" },
  { id: "M5", desc: "删 updWall pendingOpen 兜底（升墙窗口清场 ⇒ 墙升满后永留）", want: 1,
    re: /if\(wall\.pendingOpen&&wall\.built&&!wall\.opening(?:&&!wall\.breaking)?\)\{ wall\.pendingOpen=false; openWall\(\); \}/g, to: "",
    anchor: "G8.15" },
  { id: "M6", desc: "预告中途回场不撤销（回场也照砌 ⇒ 取消失效）", want: 1,
    re: /if\(player\.x>=WR\.triggerX\)\{ world\.wallWarnT=null;/g, to: "if(false){ world.wallWarnT=null;",
    anchor: "G8.11b" },
  { id: "M7", desc: "砌墙 sideRight 写死 true（x<150 也走右支）", want: 1,
    re: /wall\.sideRight=player\.x>150; \/\* sideRight 照序章规则/g, to: "wall.sideRight=true; /* sideRight 照序章规则",
    anchor: "G8.14" },
  { id: "M8", desc: "整串删砌墙护栏（状态三连＋每场配额一起删；战内反复重砌）", want: 1,
    re: /if\(world\.encPhase==="fight"&&!wall\.built&&!wall\.rising&&!wall\.opening&&world\.wallUsedEnc!==world\.enc\)\{/g, to: 'if(world.encPhase==="fight"){',
    anchor: "G8.11d" },
];

(async () => {
  console.log("== falsify-g8：八个变异各建副本 ⇒ gate-8 必须在各自锚点见红 ==");
  if (!fs.existsSync(SRC_HTML) || !fs.existsSync(SRC_JS)) {
    console.log("!! 正本不全 —— 证伪实验建不起来"); process.exit(2);
  }
  const srcHtml = fs.readFileSync(SRC_HTML, "utf8");
  const srcJs = fs.readFileSync(SRC_JS, "utf8");

  const runGate = (url, tag, outdir) => new Promise((resolve) => {
    const child = spawn(process.execPath, [GATE], {
      env: Object.assign({}, process.env, { CHAITAI_URL: url, CHAITAI_SHOT_PREFIX: "falsify-g8-" + tag + "-" }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let txt = "";
    child.stdout.on("data", (d) => { txt += d; });
    child.stderr.on("data", (d) => { txt += d; });
    const killer = setTimeout(() => { console.log("  !! " + tag + " 超 420s，掐掉"); try { child.kill(); } catch (e) {} }, 420000);
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
    console.log("   [!!] 正本 gate-8 本身红（FAIL=[" + pp.failIds.join(" ") + "]）⇒ 判不出，先把正本修绿。");
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

    const mr = await runGate("file:///D:/2006L/chaitai/shots/falsify-g8/" + mut.id + "/index.html", mut.id, outdir);
    const mm = parse(mr.txt);
    console.log("—— " + mut.id + "（" + mut.desc + "）×" + hits + "：rc=" + mr.rc + "  FAIL=[" + mm.failIds.join(" ") + "]");
    const extra = mm.failIds.filter((x) => x !== mut.anchor);
    if (extra.length) console.log("   [warn] 除锚 " + mut.anchor + " 外还有连带红：" + extra.join(" ") + "（连锁副作用，逐条对照预期）");
    if (mr.rc === 0) { console.log("   [BAD] 变异副本居然全绿 —— gate-8 的该组断言是瞎的"); allOk = false; summary.push(mut.id + "=副本竟绿"); }
    else if (mm.failIds.indexOf(mut.anchor) < 0) { console.log("   [BAD] 副本红了但锚 " + mut.anchor + " 不在红里 —— 红在别处不算数"); allOk = false; summary.push(mut.id + "=锚未红"); }
    else { console.log("   锚 " + mut.anchor + " 红 ✓"); summary.push(mut.id + "=成立(" + mm.failIds.length + "红)"); }
    fs.writeFileSync(path.join(outdir, "verdict.txt"), (mr.rc !== 0 && mm.failIds.indexOf(mut.anchor) >= 0 ? "证伪成立" : "证伪失败") + "（变异 " + mut.id + "，锚 " + mut.anchor + "）\n", "utf8");
  }

  fs.writeFileSync(path.join(OUTBASE, "verdict.txt"),
    (allOk ? "证伪成立（8/8）" : "证伪失败") + "：" + summary.join("；") + "（正本 PASS " + pp.nPass + "）\n", "utf8");
  console.log(allOk ? "=> 证伪成立：正本全绿，8 个变异各自在锚点见红。" : "=> 证伪失败（见上）。");
  process.exit(allOk ? 0 : 1);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
