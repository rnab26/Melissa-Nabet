/* « Hors prestation » (20 nov. 2026) : une ligne tapée à la main dans un devis n'existait que
   dans CE devis (Raphaël : « dans mes anciens devis il y avait beaucoup plus de mentions »).
   Le 📌 la garde pour les prochains devis : elle entre dans library.exclus, sans doublon,
   et un nouveau devis la reprend. On clique comme Raphaël, sur un écran de téléphone.

   Lancer :  python3 -m http.server 8899   puis   node tests/hors-prestation-pin.test.mjs
*/
import { chromium } from 'playwright';
const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none'));
await page.evaluate(() => { store.set = async () => {}; showView && showView('devis'); }).catch(() => {});

const LIGNE = 'Le transport et les frais de livraison.';
const nbLib0 = await page.evaluate(() => (library.exclus || DEFAULT_EXCLUS).length);

// 1. Un devis, la liste « Hors prestation » ouverte, une ligne ajoutée et tapée à la main.
await page.evaluate(() => { seedComposerFromLibrary(); current.open.__hors__ = true; buildExclu(); });
await page.click('#excl .add-btn');
const derniere = page.locator('#excl .it').last();
await derniere.locator('.it-title').fill(LIGNE);
const pin = derniere.locator('.it-pin');
check('La ligne ajoutée a un bouton 📌', await pin.count() === 1);
check('Les lignes venues de la bibliothèque n\'en ont pas', await page.locator('#excl .it').first().locator('.it-pin').count() === 0);
const box = await pin.boundingBox();
check('Écran 390 px : le 📌 est visible dans la colonne', box && box.x + box.width <= 390, box && JSON.stringify(box));

// 2. Toucher 📌 : la ligne entre dans la bibliothèque, une seule fois, et un message le dit.
await pin.click();
await page.waitForTimeout(200);
const apres = await page.evaluate(L => ({ n: library.exclus.length, has: library.exclus.filter(t => t === L).length,
  custom: current.exclus.find(e => e.title === L).custom, toast: document.getElementById('toast').textContent }), LIGNE);
check('La ligne est gardée dans la bibliothèque', apres.has === 1 && apres.n === nbLib0 + 1, JSON.stringify(apres));
check('Un message confirme l\'enregistrement', /prochains devis/.test(apres.toast), apres.toast);
check('Le 📌 disparaît : la ligne fait partie du modèle', apres.custom === false && await page.locator('#excl .it-pin').count() === 0);

// 3. Le même texte ajouté une deuxième fois n'entre pas en double.
await page.evaluate(async L => { const ex = { id: 'x', on: true, title: '  ' + L + ' ', custom: true }; current.exclus.push(ex); await libPinExclu(ex); }, LIGNE);
check('Pas de doublon dans la bibliothèque', await page.evaluate(L => library.exclus.filter(t => t === L).length, LIGNE) === 1);

// 4. Texte vide : refus visible, rien d'enregistré.
const vide = await page.evaluate(async () => { const n = library.exclus.length; await libPinExclu({ title: '   ', custom: true }); return { n2: library.exclus.length, n, toast: document.getElementById('toast').textContent }; });
check('Ligne vide : refus visible, rien ajouté', vide.n2 === vide.n && /texte/.test(vide.toast), vide.toast);

// 5. Un nouveau devis reprend la ligne gardée.
check('Un nouveau devis reprend la ligne', await page.evaluate(L => { seedComposerFromLibrary(); return current.exclus.some(e => e.title === L && e.on); }, LIGNE));

// 6. La croix supprime toujours la ligne (le 📌 ne l'a pas remplacée).
await page.evaluate(() => { current.open.__hors__ = true; buildExclu(); });
await page.click('#excl .add-btn');
const n0 = await page.evaluate(() => current.exclus.length);
await page.locator('#excl .it').last().locator('.it-rm:not(.it-pin)').click();
check('La croix × supprime toujours une ligne ajoutée', await page.evaluate(() => current.exclus.length) === n0 - 1);

check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
