/* « Estimation » n'est plus un onglet à son propre niveau : c'est une sous-catégorie de
   Devis, renommée « Estimation du Projet » partout où elle apparaît (menu, titre de la
   page). L'écran lui-même (`chantier-view`) ne change pas — seul son point d'entrée
   bouge, du niveau principal de navigation vers le menu Devis.

   Lancer :  python3 -m http.server 8899   puis   node tests/estimation-sous-devis.test.mjs
*/
import { chromium } from 'playwright';

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/* ================= ORDINATEUR ================= */
const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errDesk = [];
desk.on('pageerror', e => errDesk.push(e.message));
await desk.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await desk.waitForTimeout(1200);

const niveauPrincipal = await desk.evaluate(() => ({
  chantierBoutonExiste: !!document.getElementById('vn-chantier'),
  libellesNav: [...document.querySelectorAll('.viewnav > .vnav')].map(b => b.textContent.trim()),
}));
check('« Estimation » n’a plus de bouton à son propre niveau de navigation',
  !niveauPrincipal.chantierBoutonExiste, JSON.stringify(niveauPrincipal.libellesNav));
check('Le niveau principal ne porte plus le mot « Estimation »',
  !niveauPrincipal.libellesNav.some(t => /^Estimation/.test(t)), niveauPrincipal.libellesNav.join(' | '));

const menuDevis = await desk.evaluate(() => {
  toggleDevisMenu();
  const entrees = [...document.querySelectorAll('#vn-devis-menu button')].map(b => b.textContent.trim());
  return { ouvert: document.getElementById('vn-devis-menu').classList.contains('open'), entrees };
});
check('Le menu Devis propose « Estimation du Projet », en sous-catégorie',
  menuDevis.entrees.some(t => /Estimation du Projet/.test(t)), menuDevis.entrees.join(' | '));

const apresClic = await desk.evaluate(() => {
  [...document.querySelectorAll('#vn-devis-menu button')].find(b => /Estimation du Projet/.test(b.textContent)).click();
  return {
    titre: (document.querySelector('#chantier-view h2') || {}).textContent || '',
    visible: getComputedStyle(document.getElementById('chantier-view')).display !== 'none',
    hash: location.hash,
    devisActif: document.getElementById('vn-devis').classList.contains('active'),
    menuFerme: !document.getElementById('vn-devis-menu').classList.contains('open'),
  };
});
check('Cliquer « Estimation du Projet » ouvre le même écran qu’avant, titré pareil',
  apresClic.visible && apresClic.titre === 'Estimation du Projet', JSON.stringify(apresClic));
check('La route dans l’URL reste #/chantier (aucun lien existant ne casse)',
  apresClic.hash === '#/chantier', apresClic.hash);
check('C’est « Devis » qui s’allume dans la navigation, puisque c’est sa sous-catégorie',
  apresClic.devisActif, String(apresClic.devisActif));
check('Le menu Devis se referme après le choix', apresClic.menuFerme, String(apresClic.menuFerme));

// Un ancien lien direct vers #/chantier (posé avant ce chantier) doit encore ouvrir
// l'écran, pas une page blanche.
await desk.goto('about:blank');
await desk.goto(URL_APP + '#/chantier', { waitUntil: 'domcontentloaded' });
await desk.waitForTimeout(900);
const lienAncien = await desk.evaluate(() => ({
  visible: getComputedStyle(document.getElementById('chantier-view')).display !== 'none',
  titre: (document.querySelector('#chantier-view h2') || {}).textContent || '',
}));
check('Un ancien lien direct vers #/chantier ouvre encore l’écran, sans page blanche',
  lienAncien.visible && lienAncien.titre === 'Estimation du Projet', JSON.stringify(lienAncien));

const vraisDesk = errDesk.filter(e => !/fonts\.|ERR_CONNECTION|404|favicon/i.test(e));
check('Ordinateur : aucune erreur JavaScript', vraisDesk.length === 0, vraisDesk.slice(0, 2).join(' | '));
await desk.close();

/* ================= TÉLÉPHONE (390 px) ================= */
const tel = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errTel = [];
tel.on('pageerror', e => errTel.push(e.message));
await tel.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await tel.waitForTimeout(1200);

const barreBasse = await tel.evaluate(() => [...document.querySelectorAll('#navbas button[data-vue]')].map(b => b.dataset.vue));
check('La barre du bas ne porte plus d’onglet « chantier » à part',
  !barreBasse.includes('chantier'), barreBasse.join(' | '));

const menuMobile = await tel.evaluate(() => {
  document.querySelector('#navbas button[data-vue="devis"]').click();
  return [...document.querySelectorAll('#modal .ph-menu .mini')].map(b => b.textContent.trim());
});
check('Sur téléphone, le menu Devis propose aussi « Estimation du Projet »',
  menuMobile.some(t => /Estimation du Projet/.test(t)), menuMobile.join(' | '));

const apresClicMobile = await tel.evaluate(() => {
  [...document.querySelectorAll('#modal .ph-menu .mini')].find(b => /Estimation du Projet/.test(b.textContent)).click();
  return {
    visible: getComputedStyle(document.getElementById('chantier-view')).display !== 'none',
    devisActifBas: document.querySelector('#navbas button[data-vue="devis"]').classList.contains('active'),
    debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
check('Sur téléphone, le choix ouvre l’écran et allume « Devis » en bas',
  apresClicMobile.visible && apresClicMobile.devisActifBas, JSON.stringify(apresClicMobile));
check('Aucun débordement horizontal à 390 px', apresClicMobile.debord <= 1, apresClicMobile.debord + 'px');

const vraisTel = errTel.filter(e => !/fonts\.|ERR_CONNECTION|404|favicon/i.test(e));
check('Téléphone : aucune erreur JavaScript', vraisTel.length === 0, vraisTel.slice(0, 2).join(' | '));
await tel.close();

console.log('\n===== ESTIMATION SOUS DEVIS : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
