/* Descriptions fixes des prestations (19 nov. 2026) : ce qui est écrit dans la bibliothèque est
   repris tel quel dans chaque nouveau devis (jamais généré par l'IA sans qu'on le demande),
   modifiable à la main, enregistrable depuis le devis (📌), et applicable aux devis en cours
   (devis ouvert + brouillons) SANS toucher un devis validé.

   Lancer :  python3 -m http.server 8899   puis   node tests/descriptions-fixes.test.mjs
*/
import { chromium } from 'playwright';
const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // l'écran de Raphaël
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none'));

const TEXTE = 'Suivi mensuel — 2 000 ₪ / mois : un point régulier sur le chantier, sans surprise.';

// 1. Une prestation « Suivi mensuel » dans la bibliothèque, décrite depuis le panneau (vrais champs).
await page.evaluate(() => {
  library.sections[0].items.push({ id: 'lib-suivi', title: 'Suivi mensuel', desc: '', mode: 'none', price: 0, qty: 1, pu: 0, defaultOn: false });
  openLibraryPanel();
});
const ta = page.locator('.lib-item:has(input[value="Suivi mensuel"]) .lib-item-desc textarea');
check('Le panneau Bibliothèque a un champ « description fixe » par prestation', await ta.count() === 1);
await ta.fill(TEXTE);
await page.locator('.lib-item:has(input[value="Suivi mensuel"]) .lib-item-opts input[type=checkbox]').check();
const lib1 = await page.evaluate(() => { const it = library.sections[0].items.find(i => i.id === 'lib-suivi'); return { desc: it.desc, on: it.defaultOn }; });
check('La description et « coché d\'office » sont enregistrés dans la bibliothèque', lib1.desc === TEXTE && lib1.on === true);
// (Le panneau déborde de 11 px à 390 px depuis avant ce chantier : on ne contrôle que les éléments ajoutés ici.)
const noOverflow = await page.evaluate(() => { const m = document.getElementById('modal').getBoundingClientRect();
  return [...document.querySelectorAll('.lib-item-desc, .lib-item-desc *')].every(e => e.getBoundingClientRect().right <= m.right + 1); });
check('Écran 390 px : le champ description et ses options tiennent dans la fenêtre', noOverflow);

// 2. Nouveau devis : la ligne arrive cochée, avec la description fixe, liée à la prestation.
const nouveau = await page.evaluate(() => { seedComposerFromLibrary(); const sv = current.services.find(s => s.title === 'Suivi mensuel'); return sv && { desc: sv.desc, on: sv.on, libId: sv.libId }; });
check('Un nouveau devis reprend la description fixe, cochée d\'office', nouveau && nouveau.desc === TEXTE && nouveau.on === true && nouveau.libId === 'lib-suivi');

// 3. Mise à jour des devis en cours : devis ouvert + brouillon changent, le validé non.
await page.evaluate(() => {
  const ligne = d => ({ id: 'x' + Math.random(), libId: 'lib-suivi', cat: library.sections[0].name, on: true, title: 'Suivi mensuel', desc: d, mode: 'none', price: 0, qty: 1, pu: 0 });
  seedComposerFromLibrary(); current.services.find(s => s.title === 'Suivi mensuel').desc = 'ANCIEN ouvert';
  devisList = [
    { id: 'brouillon', status: 'brouillon', snapshot: { services: [ligne('ANCIEN brouillon')] } },
    { id: 'valide', status: 'valide', snapshot: { services: [ligne('ANCIEN valide')] } },
    { id: 'sans-lien', status: 'brouillon', snapshot: { services: [{ ...ligne('ANCIEN sans lien'), libId: undefined }] } },
  ];
  currentDevisId = null;
  store.set = async () => {}; // pas de cloud dans ce test
});
await page.evaluate(() => libApplyDesc(0, library.sections[0].items.findIndex(i => i.id === 'lib-suivi')));
check('Une confirmation précise le nombre de lignes avant de remplacer', /3 lignes/.test(await page.locator('#modal .msub').innerText()));
await page.click('#confirm-yes');
await page.waitForTimeout(300);
const apres = await page.evaluate(() => ({
  ouvert: current.services.find(s => s.title === 'Suivi mensuel').desc,
  brouillon: devisList[0].snapshot.services[0].desc,
  valide: devisList[1].snapshot.services[0].desc,
  sansLien: devisList[2].snapshot.services[0].desc,
}));
check('Le devis ouvert est mis à jour', apres.ouvert === TEXTE);
check('Le brouillon est mis à jour', apres.brouillon === TEXTE);
check('Un devis ancien sans lien (retrouvé par section + intitulé) est mis à jour', apres.sansLien === TEXTE);
check('Le devis VALIDÉ ne bouge pas', apres.valide === 'ANCIEN valide');

// 4. Depuis le devis : 📌 enregistre le texte comme description fixe ; une ligne ajoutée entre dans la bibliothèque.
await page.evaluate(() => { seedComposerFromLibrary(); buildPrest(); current.open[library.sections[0].name] = true; buildPrest(); });
await page.evaluate(() => { const sv = current.services.find(s => s.title === 'Suivi mensuel'); sv.desc = 'Texte révisé depuis le devis'; });
await page.evaluate(async () => { await libPinDesc(current.services.find(s => s.title === 'Suivi mensuel')); });
check('📌 enregistre le texte du devis dans la bibliothèque', await page.evaluate(() => library.sections[0].items.find(i => i.id === 'lib-suivi').desc) === 'Texte révisé depuis le devis');
await page.evaluate(async () => { const sv = { id: 'n', cat: library.sections[0].name, on: true, title: 'Ligne ajoutée', desc: 'Texte neuf', mode: 'fixed', price: 5, qty: 1, pu: 0, custom: true }; current.services.push(sv); await libPinDesc(sv); });
check('📌 sur une ligne ajoutée à la main la range dans la bibliothèque', await page.evaluate(() => library.sections[0].items.some(i => i.title === 'Ligne ajoutée' && i.desc === 'Texte neuf')));
const pinVisible = await page.evaluate(() => { buildPrest(); return document.querySelectorAll('#prest .pin-btn').length > 0; });
check('Le bouton 📌 est présent sur les lignes du composeur', pinVisible);
check('Titre vide : refus visible (pas d\'enregistrement silencieux)', await page.evaluate(async () => { await libPinDesc({ cat: 'x', title: '  ', desc: 'a' }); return /intitulé/.test(document.getElementById('toast').textContent); }));

check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
console.log(`\n===== DESCRIPTIONS FIXES : ${ok.length} OK, ${ko.length} ECHEC =====`);
await browser.close();
process.exit(ko.length ? 1 : 0);
