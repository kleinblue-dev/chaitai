#!/usr/bin/env node
/* 拆台 · 证伪 G7 —— 三个独立变异各建一份副本 ⇒ gate-7 必须见红（正本必须见绿）。
 *
 * 真文件（index.html＋game.js）只读；每个变异把 index.html＋assets/＋变异后的 game.js
 * 复制到 shots/falsify-g7/<变异号>/，从副本目录加载 index.html 跑 gate-7。
 *
 * 变异（锚点均在 2026-10-15 实测行号核对过）：
 *   M1  ACTS[2].stage "playable"→"planned"（第一幕被判为未接线 ⇒ outro 后不开「按 J 开拍」）
 *       预期锚红 G7.3；连锁：G7.4~G7.11c 全红（幕进不去，全部断言无数据）——一并列出核对
 *   M2  T3 {x:780,y:300,...} → y:400（台箱表错位一格）
 *       预期锚红 G7.7；实测：G7.10c（触发/台箱耦合数据断言）一并红。
 *       已知盲区：闸内 setPlayerPos(828,300) 瞬移出场恰满足旧触发 y≤302 的一瞬 ⇒ G7.10b 不红
 *       （真机玩法层面「T3 在 400 就站不到 302」闸抓不到，由 G7.7＋G7.10c 数据面兜底）
 *   M3  safeDist:260→0（地面镜像规则失效 ⇒ E1-2 不镜像、出生回原始 60/150/240）
 *       预期锚红 G7.9；E1-1（本就不镜像）与 E1-3（走 R2=standSafeDist）应保持绿
 *   M4  删 startNextAct 的 phase 门禁 ⇒ 死亡态按 J 开拍 —— 预期锚红 G7.3c-2
 *   M5  删 startAct 的 showRestart 归零 ⇒ 驻留提示泄漏进战斗态 —— 预期锚红 G7.4b
 *   M6  删 actEnd 的 showRestart 置位 ⇒ 幕终无「R 再来一次」 —— 预期锚红 G7.11d（并在 G7.12 连带红）
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
const OUTBASE = path.join(ROOT, "shots", "falsify-g7");
const GATE = path.join(ROOT, "tools", "gate-7-acts.cjs");

const MUTS = [
  { id: "M1", desc: "ACTS[2].stage playable→planned（第一幕未接线）",
    re: /(2:\{name:"第一幕",stage:)"playable"/g, to: '$1"planned"',
    anchor: "G7.3" },
  { id: "M2", desc: "T3 台箱 y 300→400（台箱表错位一格）",
    re: /\{x:780,y:300,w:96,h:170\}/g, to: "{x:780,y:400,w:96,h:170}",
    anchor: "G7.7" },
  { id: "M3", desc: "rule.safeDist 260→0（地面镜像规则失效）",
    re: /safeDist:260/g, to: "safeDist:0",
    anchor: "G7.9" },
  { id: "M4", desc: "删 startNextAct 的 phase 门禁（死亡态按 J 也能开拍）",
    re: / if\(world\.phase!=="playing"\)return false; \/\* W1[^\n]*\n/g, to: "",
    anchor: "G7.3c-2" },
  { id: "M5", desc: "删 startAct 的 showRestart 归零（驻留提示/⟳ 泄漏回战斗态）",
    re: / world\.showRestart=false; \/\* W1[^\n]*\n/g, to: "",
    anchor: "G7.4b" },
  { id: "M6", desc: "删 actEnd 的 showRestart 置位（幕终 R 重开失效）",
    re: / world\.showRestart=true; \/\* W1[^\n]*\n/g, to: "",
    anchor: "G7.11d" },
];

(async () => {
  console.log("== falsify-g7：六个变异各建副本 ⇒ gate-7 必须在各自锚点见红 ==");
  if (!fs.existsSync(SRC_HTML) || !fs.existsSync(SRC_JS)) {
    console.log("!! 正本不全 —— 证伪实验建不起来"); process.exit(2);
  }
  const srcHtml = fs.readFileSync(SRC_HTML, "utf8");
  const srcJs = fs.readFileSync(SRC_JS, "utf8");

  const runGate = (url, tag, outdir) => new Promise((resolve) => {
    const child = spawn(process.execPath, [GATE], {
      env: Object.assign({}, process.env, { CHAITAI_URL: url, CHAITAI_SHOT_PREFIX: "falsify-g7-" + tag + "-" }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let txt = "";
    child.stdout.on("data", (d) => { txt += d; });
    child.stderr.on("data", (d) => { txt += d; });
    const killer = setTimeout(() => { console.log("  !! " + tag + " 超 360s，掐掉"); try { child.kill(); } catch (e) {} }, 360000);
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
    console.log("   [!!] 正本 gate-7 本身红（FAIL=[" + pp.failIds.join(" ") + "]）⇒ 判不出，先把正本修绿。");
    fs.writeFileSync(path.join(OUTBASE, "verdict.txt"), "判不出（正本红）\n", "utf8");
    process.exit(2);
  }

  let allOk = true, summary = [];
  for (const mut of MUTS) {
    const hits = (srcJs.match(mut.re) || []).length;
    if (!hits) { console.log("!! " + mut.id + " 锚点没命中 game.js（实现形式变了？）⇒ 该项判不出"); allOk = false; summary.push(mut.id + "=锚点未命中"); continue; }
    const mutantJs = srcJs.replace(mut.re, mut.to);
    const outdir = path.join(OUTBASE, mut.id);
    fs.mkdirSync(outdir, { recursive: true });
    fs.writeFileSync(path.join(outdir, "index.html"), srcHtml, "utf8");
    fs.writeFileSync(path.join(outdir, "game.js"), mutantJs, "utf8");
    if (fs.existsSync(SRC_ASSETS)) fs.cpSync(SRC_ASSETS, path.join(outdir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(outdir, "mutation.txt"),
      "变异 " + mut.id + "：" + mut.desc + "\n命中 " + hits + " 处（只改副本 " + outdir + "/game.js；真文件未动；PRIVATE 副本勿发布）\n", "utf8");

    const mr = await runGate("file:///D:/2006L/chaitai/shots/falsify-g7/" + mut.id + "/index.html", mut.id, outdir);
    const mm = parse(mr.txt);
    console.log("—— " + mut.id + "（" + mut.desc + "）×" + hits + "：rc=" + mr.rc + "  FAIL=[" + mm.failIds.join(" ") + "]");
    const extra = mm.failIds.filter((x) => x !== mut.anchor);
    if (extra.length) console.log("   [warn] 除锚 " + mut.anchor + " 外还有连带红：" + extra.join(" ") + "（连锁副作用，逐条对照预期）");
    if (mr.rc === 0) { console.log("   [BAD] 变异副本居然全绿 —— gate-7 的该组断言是瞎的"); allOk = false; summary.push(mut.id + "=副本竟绿"); }
    else if (mm.failIds.indexOf(mut.anchor) < 0) { console.log("   [BAD] 副本红了但锚 " + mut.anchor + " 不在红里 —— 红在别处不算数"); allOk = false; summary.push(mut.id + "=锚未红"); }
    else { console.log("   锚 " + mut.anchor + " 红 ✓"); summary.push(mut.id + "=成立(" + mm.failIds.length + "红)"); }
    fs.writeFileSync(path.join(outdir, "verdict.txt"), (mr.rc !== 0 && mm.failIds.indexOf(mut.anchor) >= 0 ? "证伪成立" : "证伪失败") + "（变异 " + mut.id + "，锚 " + mut.anchor + "）\n", "utf8");
  }

  fs.writeFileSync(path.join(OUTBASE, "verdict.txt"),
    (allOk ? "证伪成立（6/6）" : "证伪失败") + "：" + summary.join("；") + "（正本 PASS " + pp.nPass + "）\n", "utf8");
  console.log(allOk ? "=> 证伪成立：正本全绿，6 个变异各自在锚点见红。" : "=> 证伪失败（见上）。");
  process.exit(allOk ? 0 : 1);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
