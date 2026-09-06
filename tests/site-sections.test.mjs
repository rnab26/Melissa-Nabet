/* « Pourquoi le site n'affiche pas mes sections ? »
   Le panneau « Le site public » doit répondre à cette question tout seul, avec les chiffres
   réels, au lieu de laisser deviner. Trois situations à couvrir : aucune catégorie, une
   seule (le site n'affiche toujours rien), deux ou plus (les sections existent).

   Lancer :  python3 -m http.server 8899   puis   node tests/site-sections.test.mjs
*/
import { chromium } from 'playwright';

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const etat = async (cats) => page.evaluate((cats) => {
  realisations = cats.map((c, i) => ({
    id: 'r' + i, title: 'Projet ' + i, categorie: c, published: true,
    photos: [{ id: 'p' + i }], createdAt: Date.now(), updatedAt: Date.now(),
  }));
  openSitePanel();
  const b = document.querySelector('.site-sections');
  return { texte: (b.textContent || '').replace(/\s+/g, ' ').trim(), ok: b.classList.contains('ok') };
}, cats);

await page.evaluate(() => {
  document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none');
  showView('realisations');
});

const rien = await etat([]);
check('Aucune réalisation publiée : le panneau le dit',
  /Aucune réalisation publiée/.test(rien.texte) && !rien.ok, rien.texte.slice(0, 70));

// Le cas réel de Raphaël aujourd'hui : une réalisation publiée, sans catégorie.
const sansCat = await etat(['']);
check('Publié sans catégorie : la raison est nommée, et le geste à faire aussi',
  /aucune catégorie renseignée/i.test(sansCat.texte) && /Catégorie/.test(sansCat.texte) && !sansCat.ok,
  sansCat.texte.slice(0, 110));

const uneCat = await etat(['Bureaux']);
check('Une seule catégorie : le panneau dit qu’il en faut au moins deux',
  /au moins deux/i.test(uneCat.texte) && /Bureaux/.test(uneCat.texte) && !uneCat.ok, uneCat.texte.slice(0, 90));

const deux = await etat(['Bureaux', 'Habitation']);
check('Deux catégories : le panneau confirme les sections en ligne',
  /affiche 2 sections/.test(deux.texte) && /Bureaux/.test(deux.texte) && /Habitation/.test(deux.texte) && deux.ok,
  deux.texte.slice(0, 90));

const melange = await etat(['Bureaux', 'Habitation', '']);
check('Une réalisation sans catégorie est signalée, pas passée sous silence',
  /n’ont pas de catégorie/.test(melange.texte) && melange.ok, melange.texte.slice(0, 130));

const debord = await page.evaluate(() => {
  const m = document.getElementById('modal');
  return m.scrollWidth - m.clientWidth;
});
check('Le panneau tient toujours dans un écran de 390 px', debord <= 1, debord + 'px');
await page.screenshot({ path: '/tmp/crm-sections.png', fullPage: true });

const vrais = errors.filter(e => !/fonts\.|ERR_CONNECTION|404|favicon/i.test(e));
check('Aucune erreur JavaScript', vrais.length === 0, vrais.slice(0, 2).join(' | '));

console.log('\n===== SECTIONS : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
