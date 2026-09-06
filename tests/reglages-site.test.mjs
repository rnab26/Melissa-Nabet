/* Réglages du site vitrine, côté CRM.
   Vérifie la chaîne complète de la modularité demandée : une rubrique créée ici doit
   devenir choisissable sur une réalisation, puis se retrouver telle quelle dans le
   manifeste que lit le site public — sans qu'une ligne de code soit touchée.

   Aucune donnée réelle n'est utilisée : Supabase est remplacé par un stockage en mémoire.

   Lancer :
     python3 -m http.server 8899        # depuis la racine du dépôt
     node tests/reglages-site.test.mjs
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
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// --- Faux Supabase : le manifeste est écrit dans une Map, on le relira tel quel.
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
    from: () => ({ upsert: async () => ({ error: null }), select: () => ({ eq: () => ({}) }) }),
  };
  sbUser = { id: 'test-user', email: 'test@test' };
  ownerId = 'test-user';
  document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none');
  showView('realisations');
});
await page.waitForTimeout(400);

check('Le bouton « Réglages du site » existe dans l’onglet Réalisations',
  await page.locator('button', { hasText: 'Réglages du site' }).count() === 1);

// --- Les rubriques par défaut sont celles que Raphaël a demandées
const parDefaut = await page.evaluate(() => { ensureSiteSettings(); return library.site.categories.map(c => c.label.fr); });
check('Rubriques par défaut : commercial, habitation, bureaux, sur mesure',
  parDefaut.join(' | ') === 'Commercial | Habitation | Bureaux | Réalisations sur mesure', parDefaut.join(' | '));

await page.locator('button', { hasText: 'Réglages du site' }).click();
await page.waitForTimeout(400);
check('Le panneau s’ouvre', await page.locator('#modal h3', { hasText: 'Réglages du site vitrine' }).count() === 1);
const debord = await page.evaluate(() => {
  const m = document.getElementById('modal');
  return m.scrollWidth - m.clientWidth;
});
check('Le panneau tient dans un écran de 390 px', debord <= 1, debord + 'px de débordement');
await page.screenshot({ path: '/tmp/crm-reglages-site.png', fullPage: true });

// --- Ajouter une rubrique depuis le panneau
await page.locator('#modal .add-btn', { hasText: 'Ajouter une rubrique' }).click();
await page.waitForTimeout(300);
await page.locator('#modal .lib-item input[type="text"]').last().fill('Hôtellerie');
await page.waitForTimeout(300);
const apresAjout = await page.evaluate(() => library.site.categories.map(c => c.label.fr));
check('Une rubrique ajoutée est enregistrée', apresAjout[apresAjout.length - 1] === 'Hôtellerie', apresAjout.join(' | '));

// --- Onglets de langue : les champs suivent la langue affichée
await page.locator('#modal .site-tab', { hasText: 'English' }).click();
await page.waitForTimeout(300);
const champVideEn = await page.evaluate(() =>
  [...document.querySelectorAll('#modal .lib-item input[type="text"]')].pop().value);
check('En anglais, la rubrique est vide et attend son texte', champVideEn === '', '« ' + champVideEn + ' »');
const repli = await page.locator('#modal .site-fallback').count();
check('Le panneau signale ce qui n’est pas traduit', repli >= 1, repli + ' mention(s)');
await page.locator('#modal .site-tab', { hasText: 'Français' }).click();
await page.waitForTimeout(300);

// --- La rubrique devient choisissable sur une réalisation
await page.evaluate(() => {
  closeModal();
  realisations = [];
  newRealisation();
});
await page.waitForTimeout(500);
await page.evaluate(() => { const r = realisations[0]; r.title = 'Hôtel Rothschild'; renderRealisations(); });
await page.waitForTimeout(400);
const options = await page.locator('#rz-body select[data-f="category"] option').allTextContents();
check('La nouvelle rubrique est proposée sur la réalisation',
  options.includes('Hôtellerie') && options[0] === '— sans rubrique —', options.join(' | '));

await page.selectOption('#rz-body select[data-f="category"]', { label: 'Hôtellerie' });
await page.waitForTimeout(300);
const choisie = await page.evaluate(() => {
  const c = library.site.categories.find(x => x.label.fr === 'Hôtellerie');
  return realisations[0].category === c.id;
});
check('Le choix est enregistré sur la réalisation', choisie);

// --- Le manifeste écrit pour le site reprend tout, sans rien inventer
const manifeste = await page.evaluate(async () => {
  const r = realisations[0];
  library.site.studio.fr = 'Un texte de studio.';
  library.site.contact.email = 'bonjour@exemple.fr';
  library.site.journal.push({ id: 'j1', date: 'Septembre 2026',
    titre: { fr: 'Une entrée', en: '', he: '' }, texte: { fr: 'Du texte.', en: '', he: '' } });
  /* On simule une réalisation DÉJÀ en ligne, puis on ne met à jour que les réglages :
     changer une rubrique ne doit pas obliger à republier les photos. */
  await writeManifest({ version: 1, updatedAt: '', site: {}, realisations: [
    { id: r.id, title: 'Ancien nom', date: '', photos: [{ full: 'a.jpg', thumb: 'b.jpg' }] }] });
  await publishSiteSettings();
  return JSON.parse(await window.__files.get('test-user/manifest.json').text());
});
check('Le manifeste porte les rubriques, dans l’ordre du panneau',
  manifeste.site.categories.map(c => c.label.fr).join(' | ') === 'Commercial | Habitation | Bureaux | Réalisations sur mesure | Hôtellerie',
  manifeste.site.categories.map(c => c.label.fr).join(' | '));
check('Le manifeste porte les sections éditoriales',
  manifeste.site.studio.fr === 'Un texte de studio.' && manifeste.site.contact.email === 'bonjour@exemple.fr'
  && manifeste.site.journal.length === 1);
check('Les langues sans texte ne partent pas en ligne vides',
  !('en' in manifeste.site.studio) && !('en' in manifeste.site.journal[0].titre),
  JSON.stringify(manifeste.site.studio));
check('Les trois langues sont annoncées au site', manifeste.site.langues.join(',') === 'fr,en,he', manifeste.site.langues.join(','));
check('Une réalisation déjà en ligne reprend son nom et sa rubrique sans republier ses photos',
  manifeste.realisations[0].title === 'Hôtel Rothschild'
  && !!manifeste.realisations[0].category
  && manifeste.realisations[0].photos.length === 1,
  JSON.stringify(manifeste.realisations[0]).slice(0, 120));
check('Le panneau confirme la mise à jour à l’écran',
  await page.locator('#modal .site-msg.ok').count() === 1);

// --- Supprimer une rubrique ne perd aucune réalisation
await page.evaluate(() => {
  const i = library.site.categories.findIndex(c => c.label.fr === 'Hôtellerie');
  siteCatDel(i);
});
await page.waitForTimeout(300);
await page.locator('#modal button', { hasText: /Supprimer|Oui|Confirmer/ }).last().click().catch(() => {});
await page.waitForTimeout(400);
const apresSuppr = await page.evaluate(() => ({
  cats: library.site.categories.map(c => c.label.fr),
  real: realisations.length, cat: realisations[0] ? realisations[0].category : null,
}));
check('Rubrique supprimée après confirmation', !apresSuppr.cats.includes('Hôtellerie'), apresSuppr.cats.join(' | '));
check('Aucune réalisation perdue, elle repasse « sans rubrique »',
  apresSuppr.real === 1 && !apresSuppr.cat, JSON.stringify(apresSuppr));

const vrais = errors.filter(e => !/fonts\.googleapis|fonts\.gstatic|ERR_CONNECTION|404|favicon/i.test(e));
check('Aucune erreur JavaScript', vrais.length === 0, vrais.slice(0, 3).join(' | '));

console.log('\n===== RÉGLAGES DU SITE : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
