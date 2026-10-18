/* _diag-gem-zone.cjs —— 一次性诊断（非闸）：呼吸灯（护手芯灯）世界坐标 vs gate-11 ZONE_LUMA=[290,303]×[452,466]。
   目的：绿侧 G11.9=3.44<4.0 ⇒ 先量「灯到底画在哪」再修，不瞎调。
   只读不改：不开 debug 写接口以外的任何改动；跑完即弃。 */
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
  let ok = false;
  for (let i = 0; i < 40; i++) { const s = await page.evaluate(() => window.__game.state()).catch(() => null); if (s && s.phase === "playing") { ok = true; break; } await sleep(200); }
  console.log("playing=" + ok);
  await page.evaluate(() => { const d = window.__game.debug; d.setDust(0); d.setEmber(0); d.setShadow(false); d.setPlayerX(300); });
  await sleep(800);
  const st = await page.evaluate(() => window.__game.state().player);
  console.log("player=" + JSON.stringify(st));

  /* 30 帧扫玩家区 cyan（灯系像素：g>=150∧b>=170∧r<=170；刀芯 #eafcff 因 r 高被排除） */
  const scan = await page.evaluate(() => new Promise(res => {
    const cv = document.getElementById("cv"), g = cv.getContext("2d"), k = cv.width / 960;
    const X0 = Math.round(250 * k), Y0 = Math.round(380 * k), X1 = Math.round(340 * k), Y1 = Math.round(478 * k);
    const W = X1 - X0, H = Y1 - Y0; const frames = []; let n = 0;
    function tick() {
      const d = g.getImageData(X0, Y0, W, H).data;
      let cnt = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, peak = 0;
      const rows = {};
      for (let i = 0; i < W * H; i++) { const j = i * 4, r = d[j], gg = d[j + 1], b = d[j + 2];
        if (gg >= 150 && b >= 170 && r <= 170) { cnt++; const x = i % W, y = (i / W) | 0;
          if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
          if (gg + b > peak) peak = gg + b;
          const wy = Math.round((y + Y0) / k); rows[wy] = (rows[wy] || 0) + 1; } }
      frames.push({ cnt, box: cnt ? [+((minx + X0) / k).toFixed(1), +((miny + Y0) / k).toFixed(1), +((maxx + X0) / k).toFixed(1), +((maxy + Y0) / k).toFixed(1)] : null, peak, rows });
      if (++n < 30) requestAnimationFrame(tick); else res(frames);
    }
    requestAnimationFrame(tick);
  }));
  const best = scan.slice().sort((a, b) => b.cnt - a.cnt)[0];
  console.log("cyanBest cnt=" + best.cnt + " peak=" + best.peak + " boxWorld=" + JSON.stringify(best.box));
  console.log("rowHistogram(worldY:cnt)=" + JSON.stringify(best.rows));
  console.log("cntSample=" + scan.map(f => f.cnt).join(","));

  /* 130 帧 ZONE luma 极差（逐字复现 gate-11 G11.9 采样） */
  const lums = await page.evaluate(() => new Promise(res => {
    const cv = document.getElementById("cv"), g = cv.getContext("2d"), k = cv.width / 960;
    const L = [Math.round(290 * k), Math.round(452 * k), Math.round((303 - 290) * k), Math.round((466 - 452) * k)];
    const lums = []; let n = 0;
    function tick() { const d = g.getImageData(L[0], L[1], L[2], L[3]).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
      lums.push(s / (d.length / 4));
      if (++n < 130) requestAnimationFrame(tick); else res(lums); }
    requestAnimationFrame(tick);
  }));
  console.log("breathRange=" + (Math.max.apply(null, lums) - Math.min.apply(null, lums)).toFixed(2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
