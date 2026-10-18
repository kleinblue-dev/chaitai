/* _diag-j5win.cjs —— 一次性诊断（非闸）：J5① 候选采样窗静默度对照。
   老窗 A(300,660,60,140)（含提示字带，预期波动）vs 候选 B(40,340,60,140)（左空天）vs C(660,950,60,140)（右月区）。 */
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

  const meanOf = (x0, x1, y0, y1) => page.evaluate((a) => {
    const cv = document.getElementById("cv"), k = cv.width / 960, g = cv.getContext("2d");
    const d = g.getImageData(Math.round(a[0] * k), Math.round(a[2] * k),
      Math.round((a[1] - a[0]) * k), Math.round((a[3] - a[2]) * k)).data;
    let r = 0, gg = 0, b = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    return [r / n, gg / n, b / n];
  }, [x0, x1, y0, y1]);
  const probe = async (name, w) => {
    const out = [];
    for (let t = 0; t < 5; t++) {
      const f1 = await meanOf(w[0], w[1], w[2], w[3]); await sleep(100);
      const f2 = await meanOf(w[0], w[1], w[2], w[3]);
      out.push(+Math.max(...[0, 1, 2].map(i => Math.abs(f1[i] - f2[i]))).toFixed(2));
    }
    console.log(name + " = [" + out.join(", ") + "]");
  };
  await probe("A 老窗(300,660,60,140)", [300, 660, 60, 140]);
  await probe("B 左空天(40,340,60,140)", [40, 340, 60, 140]);
  await probe("C 右月区(660,950,60,140)", [660, 950, 60, 140]);
  await probe("A 老窗重现", [300, 660, 60, 140]);
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
