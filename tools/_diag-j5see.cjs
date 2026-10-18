/* _diag-j5see.cjs —— 一次性诊断（非闸）：把 J5① 窗区(300,60,360,80)放大 3× 存 PNG＋全帧存 PNG，
   双目检「到底什么东西在变」。附 diff 网格计数。 */
const fs = require("fs");
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on("pageerror", e => console.log("PAGEERR", String(e)));
  await page.goto("file:///D:/2006L/chaitai/index.html");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 40; i++) { const s = await page.evaluate(() => window.__game.state()).catch(() => null); if (s && s.phase === "playing") break; await sleep(200); }
  await page.evaluate(() => { window.__game.debug.reset(); window.__game.debug.setPlayerX(480); });
  let st5 = null;
  for (let i = 0; i < 80; i++) {
    st5 = await page.evaluate(() => { const s = window.__game.state();
      return { cleared: s.cleared, cer: !!s.staging.ceremony }; });
    if (st5.cleared && !st5.cer) break;
    await page.evaluate(() => window.__game.debug.clearWave());
    await sleep(500);
  }
  console.log("cleared=" + (st5 && st5.cleared));
  await page.evaluate(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(480); });
  await sleep(400);

  const snap = () => page.evaluate(() => {
    const cv = document.getElementById("cv"), g = cv.getContext("2d");
    const d = Array.from(g.getImageData(300, 60, 360, 80).data);
    return d;
  });
  const A = await snap(); await sleep(100); const B = await snap();
  /* diff 统计＋8px 网格计数（24 列 × 10 行） */
  const W2 = 360, H2 = 80;
  let hot = 0; const grid = Array.from({ length: 10 }, () => Array(24).fill(0));
  let sumAbs = [0, 0, 0], npx = 0, minV = [255, 255, 255], maxV = [0, 0, 0];
  for (let i = 0; i < A.length; i += 4) {
    const dc = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    sumAbs[0] += Math.abs(A[i] - B[i]); sumAbs[1] += Math.abs(A[i + 1] - B[i + 1]); sumAbs[2] += Math.abs(A[i + 2] - B[i + 2]); npx++;
    for (let c2 = 0; c2 < 3; c2++) { const v = B[i + c2]; if (v < minV[c2]) minV[c2] = v; if (v > maxV[c2]) maxV[c2] = v; }
    if (dc > 24) { hot++; const k2 = i / 4, x = k2 % W2, y = (k2 / W2) | 0;
      grid[(y / 8) | 0][(x / 8) | 0]++; }
  }
  console.log("hot=" + hot + " 窗均值|Δ|=" + sumAbs.map(v => (v / npx).toFixed(2)).join(","));
  console.log("B帧窗内 RGB 值域 min=" + minV.join(",") + " max=" + maxV.join(","));
  console.log("热力网格(8px 格，行=格y/8 从 60 起，列=格x/8 从 300 起):");
  grid.forEach((row, ri) => console.log("  y" + (60 + ri * 8) + ": " + row.map(v => String(v).padStart(4)).join("")));

  /* 窗区放大 3× 存 PNG＋全帧存 PNG */
  const outs = await page.evaluate(() => {
    const cv = document.getElementById("cv"), g = cv.getContext("2d");
    const big = document.createElement("canvas"); big.width = 360 * 3; big.height = 80 * 3;
    const bg = big.getContext("2d"); bg.imageSmoothingEnabled = false;
    bg.drawImage(cv, 300, 60, 360, 80, 0, 0, 1080, 240);
    const full = document.createElement("canvas"); full.width = 960; full.height = 540;
    full.getContext("2d").drawImage(cv, 0, 0);
    return { win: big.toDataURL("image/png"), full: full.toDataURL("image/png") };
  });
  fs.writeFileSync("D:/2006L/chaitai/shots/_diag-j5see-window.png", Buffer.from(outs.win.split(",")[1], "base64"));
  fs.writeFileSync("D:/2006L/chaitai/shots/_diag-j5see-full.png", Buffer.from(outs.full.split(",")[1], "base64"));
  console.log("saved: shots/_diag-j5see-window.png / _diag-j5see-full.png");
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
