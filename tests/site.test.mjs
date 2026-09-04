import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const DIR = '/tmp/claude-0/-home-user-Melissa-Nabet/f549cd4b-ca78-5130-8003-14ff5b55232f/scratchpad/sitetest';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const gen = await browser.newPage();
await gen.goto('about:blank');
// Images de test réalistes (pièce claire, mur sombre) pour juger la mise en page.
for (let i = 0; i < 3; i++) {
  for (const [name, w, h] of [[`p${i}.jpg`, 1600, 1067], [`t${i}.jpg`, 700, 467]]) {
    const b64 = await gen.evaluate(async ([w, h, i]) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d');
      const tones = [['#e6ded1', '#5d6672'], ['#dcd2c2', '#6f6255'], ['#e9e3d8', '#4d5560']][i];
      x.fillStyle = tones[0]; x.fillRect(0, 0, w, h);
      x.fillStyle = tones[1]; x.fillRect(w * 0.06, h * 0.12, w * 0.32, h * 0.76);
      x.fillStyle = '#fff'; x.fillRect(w * 0.55, h * 0.18, w * 0.33, h * 0.5);
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, h * 0.86, w, h * 0.14);
      return cv.toDataURL('image/jpeg', 0.85).split(',')[1];
    }, [w, h, i]);
    writeFileSync(`${DIR}/galerie/u/r1/${name}`, Buffer.from(b64, 'base64'));
  }
}
await gen.close();

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
// Le bac à sable n'a pas d'accès réseau sortant : les polices Google et le manifeste
// volontairement absent de la page "vide" produisent des erreurs de chargement qui ne
// sont pas des bugs du site.
const envNoise = e => /fonts\.googleapis|fonts\.gstatic|ERR_CONNECTION_RESET|404|ERR_NAME_NOT_RESOLVED|favicon/i.test(e);
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

check('Titre du site repris du manifeste', (await page.textContent('#site-name')).trim() === 'Melissa Nabet');
const cards = await page.locator('.project').count();
check('Une carte par réalisation publiée', cards === 1, cards + ' carte(s)');
const coverLoaded = await page.evaluate(() => [...document.querySelectorAll('.project-img img')].filter(i => i.naturalWidth > 0).length);
check('Vignette de couverture réellement chargée', coverLoaded === 1, coverLoaded + ' chargée(s)');

await page.locator('.project').first().click();
await page.waitForTimeout(600);
check('Ouverture du projet', await page.locator('.detail').isVisible());
check('Titre du projet affiché', (await page.textContent('#d-title')).trim() === 'Bureau Sébastien');
const shots = await page.evaluate(() => [...document.querySelectorAll('.shot img')].filter(i => i.naturalWidth > 0).length);
check('Les 3 photos du projet se chargent', shots === 3, shots + ' photo(s)');
check('URL partageable (ancre du projet)', (await page.evaluate(() => location.hash)) === '#p-r1');

await page.locator('.shot').first().click();
await page.waitForTimeout(400);
check('Plein écran s’ouvre', await page.locator('#lightbox.open').count() === 1);
await page.click('#lb-next'); await page.waitForTimeout(300);
const lbSrc = await page.getAttribute('#lb-img', 'src');
check('Navigation entre photos en plein écran', lbSrc.includes('p1.jpg'), lbSrc);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check('Échap ferme le plein écran', await page.locator('#lightbox.open').count() === 0);
await page.click('#back'); await page.waitForTimeout(300);
check('Retour à la liste', await page.locator('.projects').isVisible());

// Aucun secret dans la page servie
const html = await page.content();
const suspects = ['eyJ', 'service_role', 'sb_secret', 'apikey', 'Authorization'];
const found = suspects.filter(s => html.includes(s));
check('Aucune clé ni jeton dans la page publique', found.length === 0, found.join(', '));

// Lien direct vers un projet
await page.goto('http://127.0.0.1:8902/index.html#p-r1', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
check('Un lien direct ouvre le bon projet', (await page.textContent('#d-title')).trim() === 'Bureau Sébastien');

// Responsive
for (const w of [390, 768]) {
  await page.setViewportSize({ width: w, height: 800 });
  await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const of = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('Aucun débordement horizontal à ' + w + 'px', of <= 1, of + 'px');
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/site-mobile.png', fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/site-desktop.png' });

// État vide : rien de publié encore, la page ne doit pas avoir l'air cassée
await page.goto('http://127.0.0.1:8902/vide.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const stateTxt = (await page.textContent('#state')) || '';
check('État « rien de publié » lisible, pas une page cassée', stateTxt.includes('Bientôt en ligne'), stateTxt.trim().slice(0, 50));

const realErrs = errs.filter(e => !envNoise(e));
check('Aucune erreur JavaScript du site', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

console.log('\n===== SITE : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
