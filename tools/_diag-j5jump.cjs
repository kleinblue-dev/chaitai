/* _diag-j5jump.cjs —— 一次性诊断（非闸）：J5① 帧差 1.54 根因定位。
   窗 x∈[300,660) y∈[60,140)（J5① 官方窗）：A 连拍时序＋变化热点；B 尘埃隔离；C 冻结隔离；D 官方口径复现。 */
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
  /* 复刻 J5 前置：reset 重放全链等 cleared&&!ceremony */
  await page.evaluate(() => { window.__game.debug.reset(); window.__game.debug.setPlayerX(480); });
  const t0 = Date.now(); let st5 = null;
  for (let i = 0; i < 80; i++) {
    st5 = await page.evaluate(() => { const s = window.__game.state();
      return { cleared: s.cleared, cer: !!s.staging.ceremony }; });
    if (st5.cleared && !st5.cer) break;
    await page.evaluate(() => window.__game.debug.clearWave());
    await sleep(500);
  }
  console.log("chainSec=" + ((Date.now() - t0) / 1000).toFixed(1) + " cleared=" + (st5 && st5.cleared) + " cer=" + (st5 && st5.cer));
  await page.evaluate(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(480); });
  await sleep(400);

  const grab = (x, y, w, h) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    return Array.from(g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), Math.round(a[2] * k), Math.round(a[3] * k)).data);
  }, [x, y, w, h]);
  const diffStat = (A, B) => {  /* 每通道均值差最大 + 热点(|Δr|+|Δg|+|Δb|>24)数 + bbox + top8 世界坐标 */
    let r = 0, g2 = 0, b = 0; const n = A.length / 4;
    for (let i = 0; i < A.length; i += 4) { r += A[i] - B[i]; g2 += A[i + 1] - B[i + 1]; b += A[i + 2] - B[i + 2]; }
    const m = [Math.abs(r / n), Math.abs(g2 / n), Math.abs(b / n)];
    let hot = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1; const px = [];
    const wpx = 360;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
      if (d > 24) { hot++; const k2 = i / 4, x = k2 % wpx, y = (k2 / wpx) | 0;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        px.push([x + 300, y + 60, d]); }
    }
    px.sort((a, b2) => b2[2] - a[2]);
    return { maxCh: +Math.max(...m).toFixed(2), hot, box: hot ? [bx0 + 300, by0 + 60, bx1 + 300, by1 + 60] : null, top: px.slice(0, 8) };
  };

  console.log("== A 连拍 100ms×10（现状）==");
  let prev = await grab(300, 60, 360, 80);
  for (let i = 0; i < 9; i++) { await sleep(100); const cur = await grab(300, 60, 360, 80);
    const s = diffStat(prev, cur);
    console.log("  pair" + i + " maxCh=" + s.maxCh + " hot=" + s.hot + " box=" + JSON.stringify(s.box));
    if (i === 0) console.log("    top8=" + JSON.stringify(s.top));
    prev = cur; }

  await page.evaluate(() => { window.__game.debug.setDust(0); window.__game.debug.setEmber(0); });
  await sleep(200);
  console.log("== B dust=0 ember=0 ==");
  prev = await grab(300, 60, 360, 80);
  for (let i = 0; i < 4; i++) { await sleep(100); const cur = await grab(300, 60, 360, 80);
    const s = diffStat(prev, cur); console.log("  pair" + i + " maxCh=" + s.maxCh + " hot=" + s.hot); prev = cur; }

  await page.evaluate(() => window.__game.debug.setHitstop(99));
  await sleep(200);
  console.log("== C hitstop 冻结 ==");
  prev = await grab(300, 60, 360, 80);
  for (let i = 0; i < 3; i++) { await sleep(100); const cur = await grab(300, 60, 360, 80);
    const s = diffStat(prev, cur); console.log("  pair" + i + " maxCh=" + s.maxCh + " hot=" + s.hot); prev = cur; }
  await page.evaluate(() => window.__game.debug.setHitstop(0));

  console.log("== D J5① 官方口径复现（同窗两帧 100ms，连测 5 次）==");
  for (let t = 0; t < 5; t++) {
    const f1 = await page.evaluate(() => { const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
      const d = g.getImageData(Math.round(300 * k), Math.round(60 * k), Math.round(360 * k), Math.round(80 * k)).data;
      let r = 0, gg = 0, b = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      return [r / n, gg / n, b / n]; });
    await sleep(100);
    const f2 = await page.evaluate(() => { const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
      const d = g.getImageData(Math.round(300 * k), Math.round(60 * k), Math.round(360 * k), Math.round(80 * k)).data;
      let r = 0, gg = 0, b = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      return [r / n, gg / n, b / n]; });
    const cj = Math.max(...[0, 1, 2].map(i => Math.abs(f1[i] - f2[i])));
    console.log("  trial" + t + " colorJump=" + cj.toFixed(2));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
