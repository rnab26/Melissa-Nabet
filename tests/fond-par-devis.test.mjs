/* « Fond de ce devis » (20 nov. 2026, chantier 7a152e09) : choisir un fond juste pour un devis,
   sans changer celui des réglages. Raphaël : « sur le brouillon, on puisse changer le fond […] de
   façon temporaire, genre juste pour cette fois ».

   Se lance seul (sert les fichiers du dépôt) :  node tests/fond-par-devis.test.mjs
   Contre le site en ligne :  APP_URL=https://rnab26.github.io/Melissa-Nabet/index.html node tests/fond-par-devis.test.mjs
*/
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://crm.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // l'écran de Raphaël
const errors = [];
page.on('pageerror', e => errors.push(e.message));
if (!process.env.APP_URL) await page.route(BASE + '**', r => {
  const f = join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
  if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
  r.fulfill({ status: 200, contentType: TYPES[extname(f)] || 'application/octet-stream', body: readFileSync(f) });
});
await page.goto(process.env.APP_URL || BASE + 'index.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof newDevis === 'function' && typeof library === 'object');

/* Trois textures (JPEG, comme enregistrées désormais) : A = réglages, B = bibliothèque, C = nouveau fond des réglages */
await page.evaluate(() => {
  document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none');
  window.print = () => {};
  const tex = couleur => { const c = document.createElement('canvas'); c.width = 66; c.height = 93; const x = c.getContext('2d'); x.fillStyle = couleur; x.fillRect(0, 0, 66, 93); return c.toDataURL('image/jpeg', .8); };
  window.__A = tex('#c8b9a0'); window.__B = tex('#7d8f9a'); window.__C = tex('#a07d7d');
  library.branding.devisBgImage = library.branding.devisBgImageBase = __A;
  library.bgLibrary = [{ id: 'fB', dataUri: __B, addedAt: 1 }];
  showView('devis'); newDevis(); showTab('editor');
});
const fondPage = () => page.evaluate(() => { const b = getComputedStyle(document.querySelector('#devis .devis-page')).backgroundImage; return b.includes(__A) ? 'A' : b.includes(__B) ? 'B' : b.includes(__C) ? 'C' : b.includes('data:image') ? 'autre' : 'aucun'; });

check('Nouveau devis : fond des réglages', await fondPage() === 'A');
const rubrique = await page.evaluate(() => { const b = document.getElementById('fond-devis'); return b && b.textContent; });
check('Le composeur a une rubrique « Fond de ce devis » avec son bouton', /Fond des réglages/.test(rubrique) && /Changer le fond de ce devis/.test(rubrique), rubrique);

/* Choisir B pour ce devis, depuis la vraie rubrique et la vraie fenêtre */
await page.locator('#fond-devis button', { hasText: 'Changer le fond de ce devis' }).click();
const tuiles = await page.locator('#modal .fond-tuile').count();
check('Le choix propose : réglages, la bibliothèque, « Sans fond »', tuiles === 3, tuiles + ' vignettes');
const deborde = await page.evaluate(() => { const m = document.getElementById('modal').getBoundingClientRect(); return [...document.querySelectorAll('#modal .fond-tuile')].some(t => t.getBoundingClientRect().right > m.right + 1) || document.documentElement.scrollWidth > 390; });
check('Écran 390 px : les vignettes tiennent dans la fenêtre', !deborde);
await page.locator('#modal .fond-tuile', { hasText: 'Fond 1' }).click();
await page.waitForTimeout(150);
check('Fond B appliqué à ce devis', await fondPage() === 'B');
check('Le fond des réglages ne change pas', await page.evaluate(() => library.branding.devisBgImage === __A));
check('La rubrique dit « Fond choisi pour ce devis » et propose de revenir', await page.evaluate(() => /Fond choisi pour ce devis/.test($('fond-devis').textContent) && /Revenir au fond des réglages/.test($('fond-devis').textContent)));

/* Enregistré avec le brouillon */
await page.evaluate(() => { current.raison = 'Client test'; currentDevisId = 'brA'; devisList.push({ id: 'brA', status: 'brouillon', snapshot: JSON.parse(JSON.stringify(current)) }); });
check('Le fond choisi est enregistré avec le devis', await page.evaluate(() => devisList.find(d => d.id === 'brA').snapshot.fond === __B));

/* Les réglages passent à C : un brouillon sans choix suit, celui avec un choix garde B */
await page.evaluate(() => {
  library.branding.devisBgImage = library.branding.devisBgImageBase = __C;
  devisList.push({ id: 'brSans', status: 'brouillon', snapshot: { ...JSON.parse(JSON.stringify(current)), fond: null } });
  loadDevis('brSans');
});
check('Un brouillon sans choix prend le nouveau fond des réglages', await fondPage() === 'C');
await page.evaluate(() => loadDevis('brA'));
check('Le brouillon avec un fond choisi le garde', await fondPage() === 'B');
await page.evaluate(() => loadDevis('brSans'));
check('Ouvrir un autre devis ne lui passe pas le fond du précédent', await fondPage() === 'C' && await page.evaluate(() => current.fond === null));

/* Sans fond, puis retour aux réglages */
await page.evaluate(() => openFondDevisPicker());
await page.locator('#modal .fond-tuile', { hasText: 'Sans fond' }).click();
check('« Sans fond » : la page n\'a plus de texture', await fondPage() === 'aucun');
await page.locator('#fond-devis button', { hasText: 'Revenir au fond des réglages' }).click();
check('« Revenir au fond des réglages »', await fondPage() === 'C' && await page.evaluate(() => current.fond === null));

/* Importer une image depuis la fenêtre : JPEG, rangée dans la bibliothèque, appliquée */
const imp = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#556b2f'; x.fillRect(0, 0, 900, 1200);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const avant = library.bgLibrary.length;
  pickImageFile = cb => cb(new File([blob], 'internet.png', { type: 'image/png' }));
  openFondDevisPicker(); importerFondDevis();
  await new Promise(r => { const t = setInterval(() => { if (document.getElementById('crop-img')) { clearInterval(t); r(); } }, 50); });
  applyImageCrop();
  await new Promise(r => setTimeout(r, 200));
  return { jpeg: (current.fond || '').startsWith('data:image/jpeg'), taille: (current.fond || '').length, biblio: library.bgLibrary.length - avant, meme: library.bgLibrary.at(-1).dataUri === current.fond };
});
check('Image importée : en JPEG léger, rangée dans la bibliothèque, appliquée à ce devis', imp.jpeg && imp.taille < 400000 && imp.biblio === 1 && imp.meme, JSON.stringify(imp));

/* Le PDF reprend le fond choisi */
await page.evaluate(() => { setFondDevisBiblio('fB'); exportDevis(); });
check('L\'impression / PDF reprend le fond choisi pour ce devis', await page.evaluate(() => getComputedStyle(document.querySelector('#zone-impression .devis-page')).backgroundImage.includes(__B)));

/* Un devis validé garde son fond choisi, même si les réglages changent */
await page.evaluate(() => { devisList.push({ id: 'val', status: 'valide', snapshot: JSON.parse(JSON.stringify(current)) }); library.branding.devisBgImage = __A; loadDevis('val'); });
check('Devis validé : le fond choisi reste', await fondPage() === 'B');

/* Anglais : la rubrique est traduite */
await page.evaluate(() => setUiLang('en'));
await page.waitForTimeout(300);
const en = await page.evaluate(() => document.querySelector('#fond-devis')?.closest('.ed-section')?.textContent || '');
check('Interface en anglais : rubrique traduite', /Background/.test(en), en.replace(/\s+/g, ' ').slice(0, 90));
check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
