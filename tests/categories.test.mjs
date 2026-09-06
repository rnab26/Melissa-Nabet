/* Les catégories : une LISTE choisie dans un menu, gérée depuis le CRM — plus un champ
   libre où deux orthographes fabriquaient deux sections. Et créer une réalisation doit
   sauter aux yeux.

   Lancer :  python3 -m http.server 8899   puis   node tests/categories.test.mjs
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
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const files = new Map();
  window.__files = files;
  sb = { storage: { from: () => ({
    upload: async (p, b) => { files.set(p, b); return { error: null }; },
    download: async (p) => files.has(p) ? { data: files.get(p), error: null }
      : { data: null, error: { message: 'Object not found', statusCode: '404' } },
    remove: async () => ({ error: null }), list: async () => ({ data: [], error: null }),
  }) }, from: () => ({ upsert: async () => ({ error: null }) }) };
  sbUser = { id: 'test-user' }; ownerId = 'test-user';
  document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none');
  library.site = null; siteSettings();
  realisations = [];
  showView('realisations');
});
await page.waitForTimeout(400);

// --- 3. Créer une réalisation doit être évident
const btnNeuf = page.locator('#realisations-view .rz-top button', { hasText: 'Nouvelle réalisation' });
check('Un bouton « Nouvelle réalisation » en tête de l’onglet', await btnNeuf.count() === 1);
const hautDeLEcran = await btnNeuf.evaluate(b => b.getBoundingClientRect().top < innerHeight);
check('Il est visible sans faire défiler la page', hautDeLEcran);
await btnNeuf.click();
await page.waitForTimeout(600);
check('Il crée bien une réalisation et l’ouvre',
  await page.evaluate(() => realisations.length === 1 && _rzOpenId === realisations[0].id));

// --- 2. La catégorie est un MENU, avec ses quatre sections
const menu = await page.evaluate(() => {
  const s = document.querySelector('#rz-body [data-f="categorie"]');
  return { balise: s && s.tagName, options: s ? [...s.options].map(o => o.textContent) : [] };
});
check('La catégorie est un menu déroulant, plus un champ libre', menu.balise === 'SELECT', String(menu.balise));
check('Ses quatre sections sont proposées, dans son ordre',
  menu.options.slice(1, 5).join(' | ') === 'Commercial | Habitation | Bureaux | Réalisation sur mesure',
  menu.options.join(' | '));
check('On peut ne pas ranger un projet, et le menu le dit',
  /aucune/.test(menu.options[0]), menu.options[0]);
check('Le menu mène aux réglages pour en ajouter une',
  /Gérer les catégories/.test(menu.options[menu.options.length - 1]), menu.options[menu.options.length - 1]);

await page.selectOption('#rz-body [data-f="categorie"]', 'Bureaux');
await page.waitForTimeout(400);
check('Le choix est enregistré sur la réalisation',
  await page.evaluate(() => realisations[0].categorie === 'Bureaux'),
  await page.evaluate(() => realisations[0].categorie));

// « Gérer les catégories… » n'est pas une valeur : elle ne doit jamais être écrite.
await page.selectOption('#rz-body [data-f="categorie"]', '__gerer');
await page.waitForTimeout(500);
check('« Gérer les catégories… » ouvre les réglages sans s’écrire dans la fiche',
  await page.evaluate(() => realisations[0].categorie === 'Bureaux' && !!document.querySelector('#site-cats')),
  await page.evaluate(() => realisations[0].categorie));

// --- La liste se modifie depuis le CRM
const lignes = await page.locator('#site-cats [data-cat]').count();
check('Les catégories sont éditables dans le panneau', lignes === 4, lignes + ' ligne(s)');
check('Chacune montre combien de projets la portent',
  (await page.locator('#site-cats [data-cat]').nth(2).locator('.site-cat-n').textContent()) === '1');

await page.locator('#site-cat-add').click();
await page.waitForTimeout(500);
check('On peut ajouter une catégorie', await page.locator('#site-cats [data-cat]').count() === 5);
await page.locator('#site-cats [data-cat]').last().locator('[data-cat-nom]').fill('Hôtellerie');
await page.locator('#site-cats [data-cat]').last().locator('[data-cat-nom]').press('Tab');
await page.waitForTimeout(500);
check('Le nom saisi est conservé',
  (await page.evaluate(() => siteCategories())).includes('Hôtellerie'),
  (await page.evaluate(() => siteCategories())).join(' | '));

// Renommer doit suivre sur les projets, sinon le rangement se perd en silence.
const ligneBureaux = page.locator('#site-cats [data-cat]').nth(2);
await ligneBureaux.locator('[data-cat-nom]').fill('Bureaux & commerces');
await ligneBureaux.locator('[data-cat-nom]').press('Tab');
await page.waitForTimeout(600);
check('Renommer une catégorie suit sur les réalisations qui la portent',
  await page.evaluate(() => realisations[0].categorie === 'Bureaux & commerces'),
  await page.evaluate(() => realisations[0].categorie));

await page.evaluate(() => openSitePanel());
await page.waitForTimeout(300);
const doublon = await page.evaluate(async () => {
  const l = document.querySelectorAll('#site-cats [data-cat] [data-cat-nom]');
  l[0].value = 'Habitation';
  l[0].dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 300));
  return siteCategories().filter(c => c === 'Habitation').length;
});
check('Deux catégories ne peuvent pas porter le même nom', doublon === 1, doublon + ' fois « Habitation »');

// --- L'ordre part dans le manifeste : le site suit cet ordre, pas l'alphabet
const man = await page.evaluate(async () => {
  await pushSiteInfos(null);
  return JSON.parse(await window.__files.get('test-user/manifest.json').text());
});
check('L’ordre des catégories part en ligne',
  (man.site.categories || []).slice(0, 3).join(' | ') === 'Commercial | Habitation | Bureaux & commerces',
  (man.site.categories || []).join(' | '));

const debord = await page.evaluate(() => {
  const m = document.getElementById('modal');
  return m.scrollWidth - m.clientWidth;
});
check('Le panneau tient dans un écran de 390 px', debord <= 1, debord + 'px');
await page.screenshot({ path: '/tmp/crm-categories.png', fullPage: true });

const vrais = errors.filter(e => !/fonts\.|ERR_CONNECTION|404|favicon/i.test(e));
check('Aucune erreur JavaScript', vrais.length === 0, vrais.slice(0, 2).join(' | '));

console.log('\n===== CATÉGORIES : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
