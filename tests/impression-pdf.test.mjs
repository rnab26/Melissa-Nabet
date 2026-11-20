/* Impression PDF du devis (20 nov. 2026) : plus de « zones de blanc » ni de page en trop.
   - La dernière page d'un bloc s'arrêtait où s'arrêtait le texte : le bas de la feuille restait
     uni, sans le fond. Le bloc .devis imprimé reprend le fond une fois par page A4.
   - Le fond du devis ouvert dans le composeur ne déteint pas sur un devis imprimé sans fond.
   - Un devis court tient sur une page (+ une pour les conditions) : pas de page vide en trop.

   Lancer :  python3 -m http.server 8899   puis   node tests/impression-pdf.test.mjs
*/
import { chromium } from 'playwright';
const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function imprimer({ fondComposeur, fondImprime, conditions }) {
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(({ fondComposeur, fondImprime, conditions, PX }) => {
    document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none'); showView('devis');
    store.set = async () => {}; window.print = () => {};
    library.branding.devisBgImage = fondComposeur ? PX : null;
    seedComposerFromLibrary(); current.services.forEach((sv, i) => sv.on = i === 0);   // un devis vraiment court
    current.raison = 'Test'; current.condOn = conditions; current.fond = null;
    current.branding = { ...library.branding }; render();
    // le devis imprimé : celui du composeur, ou un autre sans fond (comme depuis une fiche client)
    if (fondImprime === fondComposeur) exportDevis();
    else { const S = JSON.parse(JSON.stringify(current)); S.fond = fondImprime ? PX : 'aucun';
           imprimerDevisHTML(`<div class="devis">${buildDevisHTML(S)}</div>`, S.num, 'Test', 'devis', 'fr'); }
  }, { fondComposeur, fondImprime, conditions, PX });
  await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(300);
  const fond = await page.evaluate(() => getComputedStyle(document.querySelector('#zone-impression .devis')).backgroundImage);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  return { fond, pages };
}

const a = await imprimer({ fondComposeur: true, fondImprime: true, conditions: true });
check('Avec un fond : le fond couvre toute la feuille, jusqu\'en bas de chaque page', /url\(/.test(a.fond), a.fond.slice(0, 60));
check('Devis court + conditions : 2 pages, aucune page vide en trop', a.pages === 2, a.pages + ' pages');
const b = await imprimer({ fondComposeur: true, fondImprime: false, conditions: true });
check('Devis imprimé sans fond : le fond du devis ouvert ne déteint pas', !/url\(/.test(b.fond), b.fond.slice(0, 60));
const c = await imprimer({ fondComposeur: false, fondImprime: false, conditions: false });
check('Devis court sans conditions : 1 seule page', c.pages === 1, c.pages + ' pages');
check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
