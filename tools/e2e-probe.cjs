/* 全流程 e2e 探针：4 次拆台→砌墙→清场→重开→死亡→复活（每步打印回执） */
const puppeteer = require('D:/2006L/personal-site/node_modules/puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const DIR = 'D:/2006L/chaitai/shots';
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1024, height: 640 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///D:/2006L/chaitai/index.html'); await wait(800);
  await p.keyboard.press('Space'); await wait(900);
  const st = () => p.evaluate(() => window.__game.state());

  // (a) 4 次「进左区再回来」
  for (let i = 0; i < 4; i++) {
    await p.keyboard.down('KeyA'); await wait(650); await p.keyboard.up('KeyA'); await wait(120);
    await p.keyboard.down('KeyD'); await wait(700); await p.keyboard.up('KeyD'); await wait(160);
    const s = await st();
    console.log('cycle', i + 1, 'x=', s.player.x, 'defyLeft=', s.narrator.counters.defyLeft);
  }
  // 走到 x>220 触发砌墙
  await p.keyboard.down('KeyD'); await wait(400); await p.keyboard.up('KeyD');
  await wait(1300);
  let s = await st();
  console.log('WALL built=', s.wall.built, 'rising=', s.wall.rising, '| log=', s.narrator.log.join(','));
  await p.screenshot({ path: DIR + '/v0-4-wall.png' });

  // (b) 过 420 → wave1 → 清两波
  await p.keyboard.down('KeyD'); await wait(900); await p.keyboard.up('KeyD'); await wait(300);
  s = await st();
  console.log('CROSS420 wave=', s.wave, 'enemies=', s.enemies.length, 'kinds=', s.enemies.map(e => e.kind).join('+'));
  await p.evaluate(() => window.__game.debug.clearWave()); await wait(1700);
  s = await st();
  console.log('AFTER clear#1: wave=', s.wave, 'enemies=', s.enemies.map(e => e.kind).join('+'));
  await p.evaluate(() => window.__game.debug.clearWave()); await wait(1400);
  s = await st();
  console.log('AFTER clear#2: cleared=', s.cleared, 'wall.built=', s.wall.built, 'log tail=', s.narrator.log.slice(-3).join(','));
  await wait(2400);
  s = await st();
  console.log('AFTER outro: log tail=', s.narrator.log.slice(-2).join(','));
  await p.screenshot({ path: DIR + '/v0-5-clear.png' });

  // 重开
  await p.keyboard.press('KeyR'); await wait(400);
  s = await st();
  console.log('AFTER R: phase=', s.phase, 'cleared=', s.cleared, 'last log=', s.narrator.log.slice(-1)[0]);

  // (c) 死亡 → 复活
  await p.evaluate(() => window.__game.debug.hurtPlayer(9999)); await wait(300);
  s = await st();
  console.log('AFTER hurt9999: phase=', s.phase, 'deaths=', s.narrator.counters.deaths);
  await wait(2500);
  s = await st();
  console.log('AFTER respawn: phase=', s.phase, 'hp=', s.player.hp, 'last log=', s.narrator.log.slice(-1)[0]);

  console.log('ERRS:', JSON.stringify(errs));
  console.log('FULL LOG:', s.narrator.log.join(','));
  await b.close();
})().catch(e => { console.error('E2E CRASH', e); process.exit(1); });
