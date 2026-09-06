import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { REALISATIONS } from './sitetest-build.mjs';

/* Le banc d'essai (page locale + manifeste + dossier d'images) est construit par
   `node tests/sitetest-build.mjs`, puis servi sur le port 8902. */
const DIR = process.env.SITE_DIR || '/tmp/mn-sitetest';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const gen = await browser.newPage();
await gen.goto('about:blank');
// Images de test réalistes (pièce claire, mur sombre) pour juger la mise en page.
for (const r of REALISATIONS) {
  for (let i = 0; i < r.photos.length; i++) {
    for (const [name, w, h] of [[`p${i}.jpg`, 1600, 1067], [`t${i}.jpg`, 700, 467]]) {
      const b64 = await gen.evaluate(async ([w, h, i]) => {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const x = cv.getContext('2d');
        const tones = [['#e6ded1', '#5d6672'], ['#dcd2c2', '#6f6255'], ['#e9e3d8', '#4d5560']][i % 3];
        x.fillStyle = tones[0]; x.fillRect(0, 0, w, h);
        x.fillStyle = tones[1]; x.fillRect(w * 0.06, h * 0.12, w * 0.32, h * 0.76);
        x.fillStyle = '#fff'; x.fillRect(w * 0.55, h * 0.18, w * 0.33, h * 0.5);
        x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, h * 0.86, w, h * 0.14);
        return cv.toDataURL('image/jpeg', 0.85).split(',')[1];
      }, [w, h, i]);
      writeFileSync(`${DIR}/galerie/u/${r.id}/${name}`, Buffer.from(b64, 'base64'));
    }
  }
}
await gen.close();

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
// Le bac à sable n'a pas d'accès réseau sortant : les polices Google et le manifeste
// volontairement absent de la page "vide" produisent des erreurs de chargement qui ne
// sont pas des bugs du site.
const envNoise = e => /fonts\.googleapis|fonts\.gstatic|ERR_CONNECTION_RESET|404|ERR_NAME_NOT_RESOLVED|favicon/i.test(e);
const aller = async (u = 'index.html') => {
  await page.goto('http://127.0.0.1:8902/' + u, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.removeItem('mn-lang'); } catch (e) {} });
};
await aller();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);

check('Titre du site repris du manifeste', (await page.textContent('#site-name')).trim() === 'Melissa Nabet');
/* Le squelette de chargement doit disparaître une fois le manifeste arrivé : masqué en
   JavaScript, il restait affiché sous l'index parce que son `display:grid` l'emportait. */
const squelette = await page.evaluate(() => {
  const s = document.getElementById('skeleton');
  return { attr: s.hidden, vu: getComputedStyle(s).display !== 'none' };
});
check('Le squelette de chargement disparaît une fois les projets affichés',
  squelette.attr && !squelette.vu, JSON.stringify(squelette));
const cards = await page.locator('.project').count();
check('Une carte par réalisation publiée', cards === REALISATIONS.length, cards + ' carte(s)');
const covers = await page.evaluate(() => [...document.querySelectorAll('.project-img img')].filter(i => i.naturalWidth > 0).length);
check('Vignettes de couverture réellement chargées', covers === REALISATIONS.length, covers + ' chargée(s)');

// --- Identité « index » : le nom du projet est AU-DESSUS de sa vignette
const ordre = await page.evaluate(() => {
  const p = document.querySelector('.project');
  return { nom: p.querySelector('.project-name').getBoundingClientRect().top,
           img: p.querySelector('.project-img').getBoundingClientRect().top };
});
check('Le nom du projet passe avant sa vignette (identité « index »)', ordre.nom < ordre.img,
  'nom ' + Math.round(ordre.nom) + 'px / image ' + Math.round(ordre.img) + 'px');
const polices = await page.evaluate(() => ({
  nom: getComputedStyle(document.querySelector('.project-name')).fontFamily,
  meta: getComputedStyle(document.querySelector('.project-meta')).fontFamily,
}));
check('EB Garamond sur les noms, Jost sur l’appareil de lecture',
  /EB Garamond/.test(polices.nom) && /Jost/.test(polices.meta), polices.nom + ' | ' + polices.meta);

// --- Rubriques : elles viennent du manifeste, dans son ordre, sans rien en dur
const rubriques = await page.evaluate(() =>
  [...document.querySelectorAll('.cat')].map(c => ({
    nom: (c.querySelector('.cat-name') || {}).textContent?.replace(/^\s*\d+\s*/, '').trim() || '',
    projets: [...c.querySelectorAll('.project-name')].map(p => p.textContent.trim()),
  })));
check('Les rubriques du manifeste font les sections, dans leur ordre',
  rubriques.map(r => r.nom).join(' | ') === 'Commercial | Habitation | Bureaux | Autres réalisations',
  rubriques.map(r => r.nom).join(' | '));
check('Chaque projet est rangé dans sa rubrique',
  rubriques[0].projets.join() === 'Boutique Dizengoff' &&
  rubriques[2].projets.join() === 'Bureau Sébastien', JSON.stringify(rubriques.map(r => r.projets)));
check('Une rubrique sans projet publié ne s’affiche pas',
  !rubriques.some(r => /sans projet/i.test(r.nom)));
check('Un projet sans rubrique reste visible, rangé en fin d’index',
  rubriques[rubriques.length - 1].projets.join() === 'Bibliothèque sur mesure',
  rubriques[rubriques.length - 1].projets.join());

// --- Sections éditoriales, masquées quand elles sont vides
const sections = await page.evaluate(() => ({
  nav: [...document.querySelectorAll('#nav a')].map(a => a.textContent.trim()),
  studio: !document.getElementById('sec-studio').hidden,
  journal: !document.getElementById('sec-journal').hidden,
  contact: !document.getElementById('sec-contact').hidden,
  studioP: document.querySelectorAll('#studio-text p').length,
  entrees: document.querySelectorAll('.entry').length,
  contactVals: [...document.querySelectorAll('#contact-list li')].map(l => l.lastChild.textContent.trim()),
}));
check('Navigation : les 4 sections choisies, dans l’ordre',
  sections.nav.join(' · ') === 'Réalisations · Studio · Journal · Contact', sections.nav.join(' · '));
check('Studio affiché, découpé en paragraphes', sections.studio && sections.studioP === 2, sections.studioP + ' paragraphe(s)');
check('Journal : seules les entrées ayant du texte', sections.journal && sections.entrees === 2, sections.entrees + ' entrée(s)');
check('Contact : e-mail, téléphone, ville, Instagram',
  sections.contact && sections.contactVals.length === 4 && sections.contactVals[0] === 'contact@melissanabet.com',
  sections.contactVals.join(' | '));
const mailto = await page.getAttribute('#contact-list a', 'href');
check('L’e-mail est cliquable', mailto === 'mailto:contact@melissanabet.com', mailto);

// --- Trois langues : l'interface change, le texte de Melissa retombe sur le français
const boutons = await page.locator('#langs button').allTextContents();
check('Sélecteur de langue : FR / EN / עב', boutons.join('') === 'FRENעב', boutons.join(' '));
await page.locator('#langs button', { hasText: 'EN' }).click();
await page.waitForTimeout(400);
const en = await page.evaluate(() => ({
  nav: [...document.querySelectorAll('#nav a')].map(a => a.textContent.trim()),
  lang: document.documentElement.lang, dir: document.documentElement.dir,
  studio: document.querySelector('#studio-text p').textContent.trim(),
  meta: document.querySelector('.project-meta').textContent,
}));
check('Interface traduite en anglais', en.nav[0] === 'Works' && /photograph/.test(en.meta), en.nav.join(' · ') + ' / ' + en.meta);
check('Texte non traduit : le français s’affiche, rien n’est inventé',
  /Melissa Nabet dessine/.test(en.studio), en.studio.slice(0, 40));

await page.locator('#langs button', { hasText: 'עב' }).click();
await page.waitForTimeout(400);
const he = await page.evaluate(() => ({
  lang: document.documentElement.lang, dir: document.documentElement.dir,
  nav: [...document.querySelectorAll('#nav a')].map(a => a.textContent.trim()),
  // La mise en page est-elle RÉELLEMENT en miroir ? On mesure : en lecture de droite à
  // gauche, le sélecteur de langue passe à gauche de la navigation.
  navX: document.getElementById('nav').getBoundingClientRect().left,
  langX: document.getElementById('langs').getBoundingClientRect().left,
  sens: getComputedStyle(document.querySelector('.project')).direction,
}));
check('Hébreu : la page passe en lecture de droite à gauche', he.lang === 'he' && he.dir === 'rtl', he.lang + '/' + he.dir);
check('Interface traduite en hébreu', he.nav[0] === 'עבודות', he.nav.join(' · '));
check('La mise en page est réellement en miroir', he.sens === 'rtl' && he.langX < he.navX,
  he.sens + ' · langues ' + Math.round(he.langX) + 'px / nav ' + Math.round(he.navX) + 'px');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check('La langue choisie est retenue d’une visite à l’autre',
  (await page.evaluate(() => document.documentElement.lang)) === 'he');
await page.locator('#langs button', { hasText: 'FR' }).click();
await page.waitForTimeout(300);

// --- Vue projet
await page.locator('.project', { hasText: 'Bureau Sébastien' }).click();
await page.waitForTimeout(600);
check('Ouverture du projet', await page.locator('.detail').isVisible());
check('Titre du projet affiché', (await page.textContent('#d-title')).trim() === 'Bureau Sébastien');
check('La rubrique du projet est rappelée', /Bureaux/.test(await page.textContent('#d-meta')), await page.textContent('#d-meta'));
const shots = await page.evaluate(() => [...document.querySelectorAll('.shot img')].filter(i => i.naturalWidth > 0).length);
check('Les 3 photos du projet se chargent', shots === 3, shots + ' photo(s)');
check('URL partageable (ancre du projet)', (await page.evaluate(() => location.hash)) === '#p-r1');

// --- Légendes écrites depuis le CRM
const legendes = await page.evaluate(() => ({
  visibles: [...document.querySelectorAll('.shot-cap')].map(c => c.textContent.trim()),
  total: document.querySelectorAll('.shot').length,
}));
check('Légende affichée sous la photo qui en a une',
  legendes.visibles.length === 1 && /chêne massif/.test(legendes.visibles[0]), legendes.visibles.join(' | '));
check('Aucune légende inventée sous les autres photos', legendes.total === 3 && legendes.visibles.length === 1);

await page.locator('.shot').nth(1).click();
await page.waitForTimeout(400);
const capPlein = await page.evaluate(() => ({
  texte: (document.getElementById('lb-cap').textContent || '').trim(),
  masque: document.getElementById('lb-cap').hidden,
  alt: document.getElementById('lb-img').alt,
}));
check('Légende reprise en plein écran', !capPlein.masque && /chêne massif/.test(capPlein.texte), capPlein.texte);
check('La légende sert aussi de texte alternatif', /chêne massif/.test(capPlein.alt), capPlein.alt);
await page.click('#lb-next'); await page.waitForTimeout(300);
const capSuivante = await page.evaluate(() => document.getElementById('lb-cap').hidden);
check('Photo sans légende : rien ne reste affiché de la précédente', capSuivante === true);
await page.keyboard.press('Escape'); await page.waitForTimeout(250);

await page.locator('.shot').first().click();
await page.waitForTimeout(400);
check('Plein écran s’ouvre', await page.locator('#lightbox.open').count() === 1);
await page.click('#lb-next'); await page.waitForTimeout(300);
const lbSrc = await page.getAttribute('#lb-img', 'src');
check('Navigation entre photos en plein écran', lbSrc.includes('p1.jpg'), lbSrc);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check('Échap ferme le plein écran', await page.locator('#lightbox.open').count() === 0);
await page.click('#back'); await page.waitForTimeout(300);
check('Retour à la liste', await page.locator('#index-view').isVisible());

// Aucun secret dans la page servie
const html = await page.content();
const suspects = ['eyJ', 'service_role', 'sb_secret', 'apikey', 'Authorization'];
const found = suspects.filter(s => html.includes(s));
check('Aucune clé ni jeton dans la page publique', found.length === 0, found.join(', '));

// Lien direct vers un projet
await page.goto('http://127.0.0.1:8902/index.html#p-r2', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
check('Un lien direct ouvre le bon projet', (await page.textContent('#d-title')).trim() === 'Boutique Dizengoff');

// Responsive — c'est depuis un téléphone que Melissa et Raphaël regardent le site
for (const w of [390, 768]) {
  await page.setViewportSize({ width: w, height: 800 });
  await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const of = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('Aucun débordement horizontal à ' + w + 'px', of <= 1, of + 'px');
}
/* Les blocs apparaissent à l'entrée dans l'écran : sans parcourir la page, une capture
   pleine hauteur montrerait des trous. On la parcourt comme le ferait un lecteur. */
const parcourir = async () => {
  await page.evaluate(async () => {
    const pas = innerHeight * 0.8;
    const bas = () => document.documentElement.scrollHeight - innerHeight;
    /* `behavior: instant` est indispensable : la page est en défilement doux, et des sauts
       enchaînés s'interrompent l'un l'autre — on n'atteignait jamais vraiment le bas. */
    const va = y => window.scrollTo({ top: y, behavior: 'instant' });
    for (let y = 0; y < bas(); y += pas) { va(y); await new Promise(r => setTimeout(r, 120)); }
    va(bas());
    await new Promise(r => setTimeout(r, 400));
    va(0);
    await new Promise(r => setTimeout(r, 300));
  });
};
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await parcourir();
const caches = await page.evaluate(() =>
  [...document.querySelectorAll('.rise')].filter(e => getComputedStyle(e).opacity === '0').length);
check('Après un défilement complet, plus rien ne reste invisible', caches === 0, caches + ' bloc(s)');
const mob = await page.evaluate(() => {
  const p = document.querySelector('.project');
  const r = p.getBoundingClientRect();
  const nav = document.getElementById('nav').getBoundingClientRect();
  return { largeur: r.width, ecran: innerWidth, navBas: nav.bottom, titre: parseFloat(getComputedStyle(document.querySelector('.name')).fontSize) };
});
check('Sur téléphone, une colonne pleine largeur', mob.largeur > mob.ecran * 0.7, Math.round(mob.largeur) + '/' + mob.ecran + 'px');
check('Le nom du site tient sans écraser la page', mob.titre >= 24 && mob.titre <= 46, mob.titre + 'px');
await page.screenshot({ path: '/tmp/site-mobile.png', fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await parcourir();
await page.screenshot({ path: '/tmp/site-desktop.png', fullPage: true });
await page.evaluate(() => { try { localStorage.setItem('mn-lang', 'he'); } catch (e) {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/site-hebreu.png' });
await page.evaluate(() => { try { localStorage.removeItem('mn-lang'); } catch (e) {} });

// État vide : rien de publié encore, la page ne doit pas avoir l'air cassée
await page.goto('http://127.0.0.1:8902/vide.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const stateTxt = (await page.textContent('#state')) || '';
check('État « rien de publié » lisible, pas une page cassée', stateTxt.includes('Bientôt en ligne'), stateTxt.trim().slice(0, 50));
check('Aucune section vide affichée quand il n’y a pas de manifeste',
  await page.evaluate(() => document.getElementById('sec-studio').hidden && document.getElementById('sec-journal').hidden));

const realErrs = errs.filter(e => !envNoise(e));
check('Aucune erreur JavaScript du site', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

console.log('\n===== SITE : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
