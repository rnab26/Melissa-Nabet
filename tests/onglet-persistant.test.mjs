/* L'onglet ouvert survit au rechargement de la page (F5, veille du navigateur). Le
   reproche exact de Raphaël : « lorsqu'on recharge la page du CRM, ça nous remet quoi
   qu'il arrive sur le tableau de bord ». Le Tableau de bord reste la page d'ENTRÉE — le
   tout premier chargement, sans onglet mémorisé — mais dès qu'on navigue ailleurs et
   qu'on recharge à ce moment-là, on doit retomber au même endroit.

   Fichier séparé, à dessein : un vrai `page.reload()`/`page.goto()` efface tout mock
   injecté par `page.evaluate` (la fausse Supabase, `window.__files`…) — le faire dans
   `realisations.test.mjs` casserait tous les contrôles qui suivent, qui en dépendent.
   Ce test n'a besoin d'aucun de ces mocks : le routage par onglet ne touche pas Supabase.

   Lancer :  python3 -m http.server 8899   puis   node tests/onglet-persistant.test.mjs
*/
import { chromium } from 'playwright';

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
// 390 px : c'est l'écran de Mélissa et de Raphaël.
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

// --- Premier chargement, sans route dans l'URL : le Tableau de bord reste la page d'entrée.
const premier = await page.evaluate(() => ({
  hash: location.hash,
  dashActif: document.getElementById('vn-dash').classList.contains('active'),
}));
check('Premier chargement (aucune route mémorisée) : le Tableau de bord ouvre',
  premier.dashActif, JSON.stringify(premier));

// --- Naviguer vers un onglet écrit sa route dans l'URL.
await page.evaluate(() => showView('devis'));
const hashApresNav = await page.evaluate(() => location.hash);
check('Ouvrir un onglet pose sa route dans l’URL', hashApresNav === '#/devis', hashApresNav);

// --- Recharger doit rester sur CET onglet, pas revenir au Tableau de bord.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const apresRecharge = await page.evaluate(() => ({
  hash: location.hash,
  devisActif: document.getElementById('vn-devis').classList.contains('active'),
  dashVisible: getComputedStyle(document.getElementById('dashboard-view')).display !== 'none',
}));
check('Recharger la page (F5) reste sur le même onglet — Devis, pas le Tableau de bord',
  apresRecharge.hash === '#/devis' && apresRecharge.devisActif && !apresRecharge.dashVisible,
  JSON.stringify(apresRecharge));

// --- Un autre onglet, un autre rechargement : ce n'est pas un hasard sur "devis".
await page.evaluate(() => showView('realisations'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const rechargeRealisations = await page.evaluate(() => ({
  hash: location.hash,
  realActif: document.getElementById('vn-real').classList.contains('active'),
}));
check('Recharger reste aussi valable sur Réalisations',
  rechargeRealisations.hash === '#/realisations' && rechargeRealisations.realActif,
  JSON.stringify(rechargeRealisations));

// --- Un lien direct vers un onglet précis doit aussi marcher en entrée (lien partagé).
await page.goto(URL_APP + '#/clients', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const lienDirect = await page.evaluate(() => ({
  clientsActif: document.getElementById('vn-clients').classList.contains('active'),
  clientsVisible: getComputedStyle(document.getElementById('clients-view')).display !== 'none',
}));
check('Un lien direct vers un onglet (#/clients) l’ouvre dès l’arrivée',
  lienDirect.clientsActif && lienDirect.clientsVisible, JSON.stringify(lienDirect));

// --- Une route inconnue dans l'URL ne casse rien : retombe sur le Tableau de bord.
// (Un changement de hash seul, sur la même page, ne recharge pas le document — on force
// donc un VRAI chargement neuf, celui que ferait un lien partagé ouvert pour la première
// fois, en passant par une page vierge entre les deux.)
await page.goto('about:blank');
await page.goto(URL_APP + '#/nimportequoi', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const routeInconnue = await page.evaluate(() => ({
  dashActif: document.getElementById('vn-dash').classList.contains('active'),
}));
check('Une route inconnue dans l’URL retombe sur le Tableau de bord, sans casser',
  routeInconnue.dashActif, JSON.stringify(routeInconnue));

console.log('\n===== ONGLET PERSISTANT : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
