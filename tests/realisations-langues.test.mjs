/* Traductions d'une réalisation, côté CRM (chantier « Anglais et hébreu sur le site public »).
   Vérifie que ce qui est écrit dans la fiche — nom, lieu, mission, texte, légende d'une photo —
   arrive dans le manifeste que lit le site, et que les champs non traduits n'y partent PAS (le
   site retombe sur le français, une chaîne vide publiée l'en empêcherait).

   Aucune donnée réelle : Supabase est remplacé par un stockage en mémoire.

   Lancer :
     python3 -m http.server 8899        # depuis la racine du dépôt
     node tests/realisations-langues.test.mjs
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

await page.evaluate(() => {
  document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none');
  showView('realisations');
  library.site = null;
  siteSettings();
  /* Une seule langue au départ : le bloc de traduction ne doit pas exister. */
  const r = normalizeRealisation({ id: 'trad1', title: 'Bureau Tech', date: '2026', lieu: 'Netanya',
    mission: 'Rénovation complète', texte: 'Un bureau brut de béton.' });
  r.photos = [Object.assign({ id: 'ph1', name: 'a.jpg', caption: 'Salon', w: 100, h: 100 }, {})];
  realisations.push(r);
  _rzOpenId = r.id; renderRealisations();
});
await page.waitForTimeout(400);
check('Une seule langue active : aucun bloc de traduction dans la fiche',
  (await page.locator('.rz-trad').count()) === 0);
const sansLangue = await page.evaluate(() => ficheTexteChamps(realisations.find(x => x.id === 'trad1')));
check('Une seule langue : aucune traduction ne part dans la fiche publiée', !('i18n' in sansLangue), JSON.stringify(sansLangue));

// --- Anglais + hébreu activés
await page.evaluate(() => { siteSettings().langues = ['fr', 'en', 'he']; renderRealisations(); });
await page.waitForTimeout(400);
check('Le bloc de traduction apparaît avec les deux langues',
  (await page.locator('.rz-trad .site-onglet').allTextContents()).join('|') === 'English|עברית',
  (await page.locator('.rz-trad .site-onglet').allTextContents()).join('|'));
check('Un champ non traduit dit que le français s’affichera',
  (await page.locator('.rz-trad .site-repli').count()) >= 3);
const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('La fiche tient dans un écran de 390 px', debord <= 1, debord + 'px');

await page.fill('.rz-trad [data-t="title"]', 'Tech Office');
await page.waitForTimeout(200);
await page.locator('.rz-trad .site-onglet', { hasText: 'עברית' }).click();
await page.waitForTimeout(400);
check('Passer à l’hébreu ne montre pas l’anglais', (await page.inputValue('.rz-trad [data-t="title"]')) === '');
check('Le champ hébreu s’écrit de droite à gauche',
  (await page.getAttribute('.rz-trad [data-t="title"]', 'dir')) === 'rtl');
await page.fill('.rz-trad [data-t="title"]', 'משרד הייטק');
await page.fill('.rz-trad [data-t="texte"]', 'משרד מבטון חשוף.');
await page.waitForTimeout(300);

const fiche = await page.evaluate(() => ficheTexteChamps(realisations.find(x => x.id === 'trad1')));
check('La fiche publiée porte les traductions remplies',
  fiche.i18n && fiche.i18n.en.title === 'Tech Office' && fiche.i18n.he.title === 'משרד הייטק' && fiche.i18n.he.texte === 'משרד מבטון חשוף.',
  JSON.stringify(fiche.i18n));
check('Un champ laissé vide ne part pas (le site retombe sur le français)',
  !('lieu' in fiche.i18n.en) && !('texte' in fiche.i18n.en) && !('mission' in fiche.i18n.he), JSON.stringify(fiche.i18n));
check('Le français reste dans les champs d’origine', fiche.title === 'Bureau Tech' && fiche.lieu === 'Netanya', fiche.title);

// --- La modification d'une traduction doit faire dire « à republier »
const sig = await page.evaluate(() => {
  const r = realisations.find(x => x.id === 'trad1');
  const avant = realisationFicheSig(r);
  realSetTexte(r, 'lieu', 'he', 'נתניה');
  return avant !== realisationFicheSig(r);
});
check('Changer une traduction change la signature de la fiche (badge « à republier »)', sig);

// --- Légende d'une photo
await page.evaluate(() => { openPhotoTextDialog(realisations.find(x => x.id === 'trad1'), realisations.find(x => x.id === 'trad1').photos[0]); });
await page.waitForTimeout(400);
check('Le dialogue de légende propose une légende par langue',
  (await page.locator('#modal [data-capl]').count()) === 2);
await page.fill('#modal [data-capl="he"]', 'סלון');
await page.click('#ph-txt-ok');
await page.waitForTimeout(400);
const leg = await page.evaluate(() => {
  const p = realisations.find(x => x.id === 'trad1').photos[0];
  return { tr: photoLegendesPubliables(p), sig: photoCapSig(p), fr: p.caption };
});
check('La légende hébreu est enregistrée, la française est intacte',
  leg.tr.he && leg.tr.he.caption === 'סלון' && !leg.tr.en && leg.fr === 'Salon', JSON.stringify(leg));

check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n===== TRADUCTIONS RÉALISATIONS : ${ok.length} OK, ${ko.length} ECHEC =====`);
if (ko.length) { ko.forEach(k => console.log('  - ' + k)); process.exit(1); }
