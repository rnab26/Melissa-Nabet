/* Texte plus lisible sur un fond (20 nov. 2026) : quand un devis a une image de fond, le texte
   courant passe en couleur d'encre sur un voile clair, SANS devenir plus gras que les intitulés.
   Réglable (« Texte plus lisible sur un fond ») ; sans fond, rien ne change.

   Lancer :  python3 -m http.server 8899   puis   node tests/lisibilite-fond.test.mjs
*/
import { chromium } from 'playwright';
const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1250, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
const etat = (fond, boost) => page.evaluate(({ fond, boost }) => {
  document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none'); showView('devis');
  store.set = async () => {};
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  library.branding.devisBgImage = fond ? px : null; library.branding.devisBgTextBoost = boost;
  seedComposerFromLibrary(); current.fond = null; current.branding = { ...library.branding };
  const sv = current.services[0]; sv.on = true; sv.desc = 'Une description assez longue pour être lue sur le fond.';
  current.pricingMode = 'global'; current.gAmount = 20000;   // pour que le bloc des totaux s'affiche
  render();
  const d = document.querySelector('#devis .it-d'), t = document.querySelector('#devis .it-t');
  const a = getComputedStyle(d), c = getComputedStyle(t);
  const fondDe = q => { const e = document.querySelector('#devis ' + q); return e ? getComputedStyle(e).backgroundColor : 'absent'; };
  return { poidsDesc: +a.fontWeight, poidsTitre: +c.fontWeight, voile: fondDe('.dv-group'), halo: a.textShadow, couleur: a.color,
           blocs: ['.dv-head .col', '.dv-group', '.dv-excl', '.dv-totals', '.dv-sign', '.dv-foot'].map(q => q + '=' + fondDe(q)) };
}, { fond, boost });
const avec = await etat(true, true);
check('Avec un fond : un voile clair derrière les prestations', avec.voile !== 'rgba(0, 0, 0, 0)', avec.voile);
check('Avec un fond : un voile derrière TOUS les blocs de texte (en-tête, totaux, signatures, pied)', avec.blocs.every(b => !/rgba\(0, 0, 0, 0\)|absent/.test(b)), avec.blocs.join(' | '));
check('Avec un fond : un halo derrière les lettres', avec.halo !== 'none', avec.halo.slice(0, 50));
check('La description reste plus fine que les intitulés en gras', avec.poidsDesc < avec.poidsTitre, avec.poidsDesc + ' < ' + avec.poidsTitre);
const coupe = await etat(true, false);
check('Réglage coupé : aucun voile ni halo', coupe.voile === 'rgba(0, 0, 0, 0)' && coupe.halo === 'none', JSON.stringify(coupe));
const sans = await etat(false, true);
check('Sans fond : le texte ne change pas', sans.voile === 'rgba(0, 0, 0, 0)' && sans.halo === 'none', JSON.stringify(sans));
const reglage = await page.evaluate(() => { openSettingsPanel(); const l = [...document.querySelectorAll('#modal .toggle-line')].find(x => /lisible sur un fond/.test(x.textContent)); const r = !!l; closeModal(); return r; });
check('Le réglage est dans « Réglages »', reglage);
check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
