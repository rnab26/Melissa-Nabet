/* Langues et journal du site, côté CRM.
   Vérifie que ce qui est écrit dans « ⚙ Le site public » arrive bien dans le manifeste que
   lit le site — et surtout que les champs non traduits n'y partent PAS : le site sait
   retomber sur le français, une chaîne vide publiée l'en empêcherait.

   Aucune donnée réelle : Supabase est remplacé par un stockage en mémoire.

   Lancer :
     python3 -m http.server 8899        # depuis la racine du dépôt
     node tests/site-langues.test.mjs
*/
import { chromium } from 'playwright';

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
// 390 px : c'est depuis un téléphone que ce panneau sert le plus.
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const files = new Map();
  window.__files = files;
  sb = {
    storage: {
      from: () => ({
        upload: async (path, blob) => { files.set(path, blob); return { error: null }; },
        download: async (path) => files.has(path) ? { data: files.get(path), error: null }
          : { data: null, error: { message: 'Object not found', statusCode: '404' } },
        remove: async () => ({ error: null }),
        list: async () => ({ data: [], error: null }),
      }),
    },
    from: () => ({ upsert: async () => ({ error: null }) }),
  };
  sbUser = { id: 'test-user', email: 'test@test' };
  ownerId = 'test-user';
  document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none');
  showView('realisations');
  /* On repart d'un réglage propre : ce test ne doit pas dépendre de ce qu'une autre suite
     a laissé dans la bibliothèque. */
  library.site = null;
  siteSettings();
  openSitePanel();
});
await page.waitForTimeout(400);

check('Le panneau propose les trois langues',
  (await page.locator('#site-langues input[data-langue]').count()) === 3);
check('Le français ne peut pas être décoché',
  await page.locator('#site-langues input[data-langue="fr"]').isDisabled());
const debord = await page.evaluate(() => {
  const m = document.getElementById('modal');
  return m.scrollWidth - m.clientWidth;
});
check('Le panneau tient dans un écran de 390 px', debord <= 1, debord + 'px de débordement');

// --- Une seule langue au départ : ni onglets ni sélecteur inutile
check('Une seule langue active : aucun onglet de traduction',
  (await page.locator('#site-onglets').count()) === 0);

await page.locator('#site-langues input[data-langue="en"]').check();
await page.waitForTimeout(400);
await page.locator('#site-langues input[data-langue="he"]').check();
await page.waitForTimeout(400);
check('Les onglets de langue apparaissent dès la deuxième langue',
  (await page.locator('#site-onglet, #site-onglets .site-onglet').count()) === 3,
  (await page.locator('#site-onglets .site-onglet').allTextContents()).join(' | '));

// --- Écrire le français, puis une traduction partielle
await page.fill('#site-sub', 'Architecture d’intérieur');
await page.fill('#site-apropos', 'Deux phrases en français.');
await page.waitForTimeout(300);
await page.locator('#site-onglets .site-onglet', { hasText: 'English' }).click();
await page.waitForTimeout(400);
const videEn = await page.inputValue('#site-sub');
check('En anglais, le champ est vide et attend son texte', videEn === '', '« ' + videEn + ' »');
check('Le panneau annonce que le français s’affichera',
  (await page.locator('.site-repli').count()) >= 1);
await page.fill('#site-sub', 'Interior architecture');
await page.waitForTimeout(300);
await page.locator('#site-onglets .site-onglet', { hasText: 'Français' }).click();
await page.waitForTimeout(400);
check('Revenir au français ne montre pas l’anglais',
  (await page.inputValue('#site-sub')) === 'Architecture d’intérieur',
  await page.inputValue('#site-sub'));

// --- Journal
await page.locator('#site-journal-add').click();
await page.waitForTimeout(400);
await page.locator('.site-entree [data-j="date"]').fill('Septembre 2026');
await page.locator('.site-entree [data-j="titre"]').fill('Livraison du bureau');
await page.locator('.site-entree [data-j="texte"]').fill('Trois mois de chantier.');
await page.waitForTimeout(400);
await page.locator('#site-journal-add').click();
await page.waitForTimeout(400);
await page.locator('.site-entree').nth(1).locator('[data-j="titre"]').fill('Deuxième entrée');
await page.waitForTimeout(300);
check('Deux entrées de journal enregistrées',
  (await page.evaluate(() => siteJournal().length)) === 2);
await page.locator('.site-entree').nth(1).locator('[data-jmove="-1"]').click();
await page.waitForTimeout(400);
check('Une entrée peut remonter dans la liste',
  (await page.evaluate(() => siteJournal()[0].titre)) === 'Deuxième entrée',
  await page.evaluate(() => siteJournal().map(j => j.titre).join(' | ')));
const dateEnAnglais = await page.evaluate(() => {
  document.querySelectorAll('#site-onglets .site-onglet').forEach(b => { if (b.textContent === 'English') b.click(); });
  return true;
});
await page.waitForTimeout(400);
check('La date reste commune aux langues, elle ne se traduit pas',
  dateEnAnglais && await page.locator('.site-entree [data-j="date"]').first().isDisabled());
await page.locator('#site-onglets .site-onglet', { hasText: 'Français' }).click();
await page.waitForTimeout(400);

// --- Ce qui part réellement en ligne
const man = await page.evaluate(async () => {
  await pushSiteInfos(null);
  return JSON.parse(await window.__files.get('test-user/manifest.json').text());
});
check('Les trois langues sont annoncées au site', (man.site.langues || []).join(',') === 'fr,en,he',
  JSON.stringify(man.site.langues));
check('Le français reste dans les champs d’origine, non déplacé',
  man.site.subtitle === 'Architecture d’intérieur' && man.site.apropos === 'Deux phrases en français.',
  man.site.subtitle + ' | ' + man.site.apropos);
check('La traduction écrite part à côté, sans toucher au français',
  man.site.i18n && man.site.i18n.en && man.site.i18n.en.subtitle === 'Interior architecture',
  JSON.stringify(man.site.i18n));
check('Un champ non traduit ne part PAS vide en ligne',
  !(man.site.i18n.en || {}).apropos && !man.site.i18n.he,
  JSON.stringify(man.site.i18n));
check('Le journal part dans l’ordre du panneau',
  (man.site.journal || []).length === 2 && man.site.journal[0].titre === 'Deuxième entrée',
  (man.site.journal || []).map(j => j.titre).join(' | '));
check('Le panneau confirme la mise à jour à l’écran',
  /Mis à jour/.test(await page.textContent('#site-msg')), await page.textContent('#site-msg'));

// --- Retirer une langue la retire du site
await page.evaluate(() => openSitePanel());
await page.waitForTimeout(300);
await page.locator('#site-langues input[data-langue="he"]').uncheck();
await page.waitForTimeout(400);
const man2 = await page.evaluate(async () => {
  await pushSiteInfos(null);
  return JSON.parse(await window.__files.get('test-user/manifest.json').text());
});
check('Une langue décochée disparaît du site', (man2.site.langues || []).join(',') === 'fr,en',
  JSON.stringify(man2.site.langues));

// --- Supprimer une entrée du journal, avec confirmation
await page.evaluate(() => openSitePanel());
await page.waitForTimeout(300);
await page.locator('.site-entree [data-jdel]').first().click();
await page.waitForTimeout(300);
await page.locator('#modal button, .modal button').filter({ hasText: /Supprimer|Confirmer|Oui/ }).last().click().catch(() => {});
await page.waitForTimeout(500);
check('Une entrée supprimée après confirmation',
  (await page.evaluate(() => siteJournal().length)) === 1,
  await page.evaluate(() => siteJournal().map(j => j.titre).join(' | ')));

const vrais = errors.filter(e => !/fonts\.googleapis|fonts\.gstatic|ERR_CONNECTION|404|favicon/i.test(e));
check('Aucune erreur JavaScript', vrais.length === 0, vrais.slice(0, 3).join(' | '));

console.log('\n===== LANGUES ET JOURNAL : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
