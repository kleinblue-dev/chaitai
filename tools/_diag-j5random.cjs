/* _diag-j5random.cjs —— 一次性诊断（非闸）：J5① 窗内每帧变化的来源定位。
   hook Math.random（计数＋调用栈）、drawImage（层重绘）、每帧首个 translate（震屏 sx,sy）。 */
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
  console.log("cleared=" + (st5 && st5.cleared) + " cer=" + (st5 && st5.cer));
  await page.evaluate(() => { window.__game.debug.clearWave(); window.__game.debug.setPlayerX(480); });
  await sleep(400);

  await page.evaluate(() => {
    const P2 = CanvasRenderingContext2D.prototype;
    const origR = Math.random;
    window.__log = { rand: 0, stacks: [], draws: 0, tr: [] };
    Math.random = function () {
      window.__log.rand++;
      if (window.__log.stacks.length < 6) {
        window.__log.stacks.push((new Error().stack || "").split("\n").slice(2, 5).join(" | "));
      }
      return origR();
    };
    const origDI = P2.drawImage;
    P2.drawImage = function () { window.__log.draws++; return origDI.apply(this, arguments); };
    /* 每帧首个 translate＝render 顶层的震屏 (sx,sy) */
    window.__frameFirst = true;
    const origRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = function (cb) {
      return origRAF(function (t) { window.__frameFirst = true; return cb(t); });
    };
    const origT = P2.translate;
    P2.translate = function (x, y) {
      if (window.__frameFirst) { window.__frameFirst = false;
        if (window.__log.tr.length < 500) window.__log.tr.push([+x.toFixed(3), +y.toFixed(3)]); }
      return origT.apply(this, arguments);
    };
    window.__buckets = [];
    let last = 0, lastD = 0;
    window.__tick = setInterval(() => {
      window.__buckets.push([window.__log.rand - last, window.__log.draws - lastD]);
      last = window.__log.rand; lastD = window.__log.draws;
    }, 16);
  });
  await sleep(2000);
  const r = await page.evaluate(() => { clearInterval(window.__tick); return {
    rand: window.__log.rand, draws: window.__log.draws, stacks: window.__log.stacks,
    buckets: window.__buckets.slice(0, 40), tr: window.__log.tr.slice(0, 30) }; });
  console.log("randPer2s=" + r.rand + " drawsPer2s=" + r.draws);
  console.log("stacks=" + JSON.stringify(r.stacks, null, 1));
  console.log("buckets[rand,draws]/16ms=" + JSON.stringify(r.buckets));
  console.log("frameFirstTranslate=" + JSON.stringify(r.tr));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
