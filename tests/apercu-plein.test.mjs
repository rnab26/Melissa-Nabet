/* Aperçu du devis en grand (21 nov. 2026). Raphaël, sur tablette : toucher l'aperçu « ne fait
   rien » (il passait seulement à 100 % dans la colonne de droite). Maintenant :
   - tablette / ordinateur : un toucher ouvre la page en grand, plein écran, avec « Imprimer PDF »
     et ✕ (Échap referme) ;
   - téléphone, onglet Aperçu : « Imprimer PDF » au-dessus de « Composer » ; le toucher sur la
     page bascule toujours page entière / taille réelle.

   Lancer :  python3 -m http.server 8899   puis   node tests/apercu-plein.test.mjs
*/
import { chromium } from 'playwright';
const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
async function ouvrir(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL_APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none'); store.set = async () => {};
    window.__imprime = 0; window.print = () => { window.__imprime++; }; showView('devis'); });
  await p.waitForTimeout(400); return p;
}
const larg = (p, s) => p.evaluate(s => Math.round(document.querySelector(s).getBoundingClientRect().width), s);

// --- Tablette paysage
{
  const p = await ouvrir(1280, 800);
  const avant = await larg(p, '#devis');
  const b = await p.locator('#devis').boundingBox();
  await p.touchscreen.tap(b.x + b.width / 2, b.y + 220); await p.waitForTimeout(500);
  const plein = await p.evaluate(() => document.body.classList.contains('apercu-plein'));
  check('Tablette : toucher l\'aperçu l\'ouvre en grand', plein);
  const pw = await larg(p, '.preview-wrap'), apres = await larg(p, '#devis');
  check('Tablette : l\'aperçu couvre tout l\'écran', pw >= 1270, pw + ' px');
  check('Tablette : la page est nettement plus grande', apres > avant * 1.4, avant + ' → ' + apres + ' px');
  const btn = p.locator('#apercu-barre .btn-primary'), fermer = p.locator('#apercu-barre .apercu-fermer');
  check('Tablette : « Imprimer PDF » et ✕ sont visibles', await btn.isVisible() && await fermer.isVisible());
  const bb = await btn.boundingBox();
  check('Tablette : boutons assez grands pour le doigt (44 px)', bb.height >= 44, Math.round(bb.height) + ' px');
  await btn.tap(); await p.waitForTimeout(300);
  check('Tablette : « Imprimer PDF » lance l\'impression', await p.evaluate(() => window.__imprime) === 1);
  await p.evaluate(() => { document.body.classList.remove('impression-zone'); });
  await fermer.tap(); await p.waitForTimeout(300);
  check('Tablette : ✕ referme l\'aperçu en grand', !(await p.evaluate(() => document.body.classList.contains('apercu-plein'))) && !(await btn.isVisible()));
  check('Tablette : la page reprend sa taille dans la colonne', Math.abs(await larg(p, '#devis') - avant) < 3, avant + ' / ' + await larg(p, '#devis'));
  await p.touchscreen.tap(b.x + b.width / 2, b.y + 220); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check('Tablette : Échap referme aussi', !(await p.evaluate(() => document.body.classList.contains('apercu-plein'))));
  await p.close();
}
// --- Téléphone
{
  const p = await ouvrir(390, 844);
  await p.evaluate(() => showTab('preview')); await p.waitForTimeout(500);
  const btn = p.locator('#apercu-barre .btn-primary');
  check('Téléphone : « Imprimer PDF » visible dans l\'aperçu', await btn.isVisible());
  check('Téléphone : pas de ✕ (le bouton « Composer » sert au retour)', !(await p.locator('#apercu-barre .apercu-fermer').isVisible()));
  const bi = await btn.boundingBox(), bf = await p.locator('#devis-tab-fab').boundingBox();
  check('Téléphone : « Imprimer PDF » au-dessus de « Composer », sans chevauchement', bi.y + bi.height <= bf.y, `imprimer bas ${Math.round(bi.y + bi.height)} / composer haut ${Math.round(bf.y)}`);
  await btn.tap(); await p.waitForTimeout(300);
  check('Téléphone : « Imprimer PDF » lance l\'impression', await p.evaluate(() => window.__imprime) === 1);
  await p.evaluate(() => document.body.classList.remove('impression-zone'));
  const z0 = await p.evaluate(() => getComputedStyle(document.querySelector('.preview-wrap')).getPropertyValue('--dv-zoom'));
  const b = await p.locator('#devis').boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + 150); await p.waitForTimeout(300);
  const z1 = await p.evaluate(() => getComputedStyle(document.querySelector('.preview-wrap')).getPropertyValue('--dv-zoom'));
  check('Téléphone : le toucher sur la page bascule toujours en taille réelle (pas de plein écran)', z1 === '1.0000' && z0 !== z1 && !(await p.evaluate(() => document.body.classList.contains('apercu-plein'))), z0 + ' → ' + z1);
  await p.evaluate(() => showTab('editor')); await p.waitForTimeout(200);
  check('Téléphone : pas de bouton Imprimer sur l\'écran du formulaire', !(await btn.isVisible()));
  await p.close();
}
check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
