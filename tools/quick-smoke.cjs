/* 快速冒烟：加载游戏 → 抓 pageerror → 三连截图（标题/开局/战斗）→ 打印状态 JSON */
const puppeteer = require('D:/2006L/personal-site/node_modules/puppeteer-core');
const fs = require('fs');
const DIR = 'D:/2006L/chaitai/shots';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1024, height: 640, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto('file:///D:/2006L/chaitai/index.html');
  await wait(900);
  const s0 = await p.evaluate(() => window.__game && window.__game.state());
  await p.screenshot({ path: DIR + '/v0-1-title.png' });
  await p.keyboard.press('Space');
  await wait(1400);
  const s1 = await p.evaluate(() => window.__game.state());
  await p.screenshot({ path: DIR + '/v0-2-start.png' });
  await p.keyboard.down('KeyD'); await wait(900); await p.keyboard.up('KeyD');
  for (let i = 0; i < 6; i++) { await p.keyboard.press('KeyJ'); await wait(130); }
  await wait(400);
  const s2 = await p.evaluate(() => window.__game.state());
  await p.screenshot({ path: DIR + '/v0-3-combat.png' });
  console.log(JSON.stringify({ errs, s0, s1, s2 }, null, 1));
  await b.close();
})().catch(e => { console.error('SMOKE CRASH', e); process.exit(1); });
