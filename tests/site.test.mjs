import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

/* Le banc d'essai (page locale + manifeste + dossier d'images) est construit par
   `node tests/sitetest-build.mjs`, puis servi sur le port 8902. */
const DIR = process.env.SITE_DIR || '/tmp/mn-sitetest';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

/* Le banc d'essai est une COPIE de `site-vitrine/index.html` : le reconstruire ici évite
   d'éprouver une page périmée après une modification du site — c'est une erreur qui ne se
   voit pas, le test passe ou échoue sur du code qui n'est plus celui du dépôt. */
await import('./sitetest-build.mjs');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const gen = await browser.newPage();
await gen.goto('about:blank');
// Images de test réalistes (pièce claire, mur sombre) pour juger la mise en page.
for (let i = 0; i < 3; i++) {
  for (const [name, w, h] of [[`p${i}.jpg`, 1600, 1067], [`t${i}.jpg`, 700, 467]]) {
    const b64 = await gen.evaluate(async ([w, h, i]) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d');
      const tones = [['#e6ded1', '#5d6672'], ['#dcd2c2', '#6f6255'], ['#e9e3d8', '#4d5560']][i];
      x.fillStyle = tones[0]; x.fillRect(0, 0, w, h);
      x.fillStyle = tones[1]; x.fillRect(w * 0.06, h * 0.12, w * 0.32, h * 0.76);
      x.fillStyle = '#fff'; x.fillRect(w * 0.55, h * 0.18, w * 0.33, h * 0.5);
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, h * 0.86, w, h * 0.14);
      return cv.toDataURL('image/jpeg', 0.85).split(',')[1];
    }, [w, h, i]);
    writeFileSync(`${DIR}/galerie/u/r1/${name}`, Buffer.from(b64, 'base64'));
    // Le banc « ancien manifeste » a son propre dossier : il sert le format encore en ligne.
    if (i === 0) writeFileSync(`${DIR}/galerie/v/r1/${name}`, Buffer.from(b64, 'base64'));
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
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

check('Titre du site repris du manifeste', (await page.textContent('#site-name')).trim() === 'Melissa Nabet');
const cards = await page.locator('.project').count();
check('Une carte par réalisation publiée', cards === 3, cards + ' carte(s)');
const coverLoaded = await page.evaluate(() => [...document.querySelectorAll('.project-img img')].filter(i => i.naturalWidth > 0).length);
check('Vignettes de couverture réellement chargées', coverLoaded >= 2, coverLoaded + ' chargée(s) sur ' + cards);

// --- Filtre par catégorie, construit tout seul à partir de ce qui est publié
const filtres = await page.evaluate(() => ({
  visible: !document.getElementById('filtres').hidden,
  boutons: [...document.querySelectorAll('#filtres button')].map(b => b.textContent),
  actif: (document.querySelector('#filtres button[aria-pressed="true"]') || {}).textContent || '',
}));
/* L'ordre est celui du CRM, pas l'alphabet : le manifeste d'essai annonce
   « Bureau » avant « Appartement », et le site doit le respecter. */
check('Filtre : une case par catégorie publiée, dans l’ordre défini dans le CRM',
  filtres.visible && filtres.boutons.join(' | ') === 'Tout (3) | Bureau (1) | Appartement (2)', filtres.boutons.join(' | '));
check('Filtre : « Tout » est actif au départ', /^Tout/.test(filtres.actif), filtres.actif);
const filtre1 = await page.evaluate(async () => {
  [...document.querySelectorAll('#filtres button')].find(b => /Appartement/.test(b.textContent)).click();
  await new Promise(r => setTimeout(r, 200));
  return {
    cartes: [...document.querySelectorAll('.project-name')].map(n => n.textContent),
    actif: (document.querySelector('#filtres button[aria-pressed="true"]') || {}).textContent || '',
  };
});
check('Filtre : ne restent que les projets de la catégorie choisie',
  filtre1.cartes.length === 2 && filtre1.cartes.every(t => /Duplex|Florentin/.test(t)), filtre1.cartes.join(' | '));
check('Filtre : la case choisie est marquée', /Appartement/.test(filtre1.actif), filtre1.actif);
// Ouvrir depuis une liste filtrée doit ouvrir LE bon projet, pas celui du même rang
// dans la liste complète.
await page.locator('.project').first().click();
await page.waitForTimeout(500);
const ouvertFiltre = await page.evaluate(() => ({ titre: (document.getElementById('d-title') || {}).textContent || '', hash: location.hash }));
check('Filtre : ouvrir depuis une liste filtrée ouvre le bon projet',
  /Duplex/.test(ouvertFiltre.titre) && ouvertFiltre.hash === '#p-r2', ouvertFiltre.titre + ' ' + ouvertFiltre.hash);
await page.click('#back'); await page.waitForTimeout(300);
await page.evaluate(async () => {
  [...document.querySelectorAll('#filtres button')].find(b => /^Tout/.test(b.textContent)).click();
  await new Promise(r => setTimeout(r, 200));
});
// Une seule catégorie : un filtre à un bouton n'est pas un filtre, il ne s'affiche pas.
const filtreUn = await page.evaluate(() => {
  const garde = projects.slice();
  projects = projects.filter(p => (p.categorie || '') === 'Appartement');
  renderFiltres(); renderIndex();
  const cache = document.getElementById('filtres').hidden;
  projects = garde; renderFiltres(); renderIndex();
  return cache;
});
check('Filtre : une seule catégorie, aucun filtre affiché', filtreUn === true);

await page.locator('.project').first().click();
await page.waitForTimeout(600);
check('Ouverture du projet', await page.locator('.detail').isVisible());
check('Titre du projet affiché', (await page.textContent('#d-title')).trim() === 'Bureau Sébastien');
// Les photos hors écran sont en chargement paresseux : on parcourt la page comme un
// visiteur avant de compter, sinon on mesure le lazy-loading, pas le site.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(700);
const shots = await page.evaluate(() => [...document.querySelectorAll('.shot img')].filter(i => i.naturalWidth > 0).length);
check('Les 3 photos du projet se chargent', shots === 3, shots + ' photo(s)');
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
check('URL partageable (ancre du projet)', (await page.evaluate(() => location.hash)) === '#p-r1');

// --- Mise en page des photos : les verticales par deux, les horizontales pleine largeur
const miseEnPage = await page.evaluate(() => ({
  total: document.querySelectorAll('.shot').length,
  portraits: document.querySelectorAll('.shot.portrait').length,
  colonnes: getComputedStyle(document.querySelector('.shots')).gridTemplateColumns.split(' ').length,
  srcset: (document.querySelector('.shot img') || {}).srcset || '',
  fondu: [...document.querySelectorAll('.shot img')].filter(i => i.classList.contains('chargee')).length,
}));
check('Photos : les verticales sont repérées comme telles',
  miseEnPage.portraits === 1 && miseEnPage.total === 3, miseEnPage.portraits + ' verticale(s) sur ' + miseEnPage.total);
check('Photos : deux colonnes sur un écran large', miseEnPage.colonnes === 2, miseEnPage.colonnes + ' colonne(s)');
check('Photos : deux tailles proposées au navigateur, aucune image supplémentaire produite',
  /700w/.test(miseEnPage.srcset) && /1600w/.test(miseEnPage.srcset), miseEnPage.srcset.slice(0, 80));
check('Photos : les images chargées apparaissent en fondu (classe posée)', miseEnPage.fondu >= 1, miseEnPage.fondu + ' image(s)');

// --- Projet suivant : on parcourt le portfolio sans remonter à la liste
const suivant = await page.evaluate(async () => {
  const b = document.getElementById('suivant');
  const visible = !b.hidden;
  const nom = (document.getElementById('suivant-nom').textContent || '').trim();
  b.click();
  await new Promise(r => setTimeout(r, 400));
  const apres = (document.getElementById('d-title').textContent || '').trim();
  // flèche du clavier
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  const apresFleche = (document.getElementById('d-title').textContent || '').trim();
  return { visible, nom, apres, apresFleche };
});
check('Projet suivant : le lien est proposé en bas de page', suivant.visible && !!suivant.nom, suivant.nom);
const filtresCaches = await page.evaluate(() => getComputedStyle(document.getElementById('filtres')).display);
check('Projet ouvert : les filtres de la liste ne s’affichent plus', filtresCaches === 'none', filtresCaches);
check('Projet suivant : il ouvre bien le projet annoncé', suivant.apres === suivant.nom, suivant.nom + ' → ' + suivant.apres);
check('Projet suivant : la flèche du clavier fait la même chose',
  suivant.apresFleche !== suivant.apres, suivant.apres + ' → ' + suivant.apresFleche);
await page.evaluate(async () => { closeProject(); await new Promise(r => setTimeout(r, 200)); });
await page.locator('.project').first().click();
await page.waitForTimeout(500);

// --- Textes de présentation écrits depuis le CRM
const presentation = await page.evaluate(() => ({
  meta: (document.getElementById('d-meta').textContent || '').trim(),
  texte: (document.getElementById('d-text').textContent || '').trim(),
  cache: document.getElementById('d-text').hidden,
  carte: (document.querySelector('.project-meta') || {}).textContent || '',
}));
check('Lieu, surface et mission affichés sous le titre du projet',
  /2026/.test(presentation.meta) && /Tel Aviv/.test(presentation.meta) && /85 m²/.test(presentation.meta) && /Rénovation complète/.test(presentation.meta),
  presentation.meta);
check('Texte de présentation affiché', !presentation.cache && /plateau de bureaux/.test(presentation.texte), presentation.texte.slice(0, 60));

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
const rang = await page.evaluate(() => (document.getElementById('lb-rang').textContent || '').trim());
check('Plein écran : le rang de la photo est affiché', rang === '2 / 3', rang);
// Balayage au doigt : c'est le geste attendu sur un téléphone, les flèches sont un secours.
const balayage = await page.evaluate(async () => {
  const lb = document.getElementById('lightbox');
  const av = document.getElementById('lb-rang').textContent;
  const touche = (x, y) => [new Touch({ identifier: 1, target: lb, clientX: x, clientY: y })];
  lb.dispatchEvent(new TouchEvent('touchstart', { touches: touche(300, 400), bubbles: true }));
  lb.dispatchEvent(new TouchEvent('touchend', { changedTouches: touche(120, 410), bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  const ap = document.getElementById('lb-rang').textContent;
  // un glissement vertical ne doit RIEN faire
  lb.dispatchEvent(new TouchEvent('touchstart', { touches: touche(300, 200), bubbles: true }));
  lb.dispatchEvent(new TouchEvent('touchend', { changedTouches: touche(288, 500), bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  return { av, ap, apresVertical: document.getElementById('lb-rang').textContent };
});
check('Plein écran : un balayage horizontal change de photo', balayage.ap === '3 / 3', balayage.av + ' → ' + balayage.ap);
check('Plein écran : un glissement vertical ne change rien', balayage.apresVertical === balayage.ap, balayage.apresVertical);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check('Échap ferme le plein écran', await page.locator('#lightbox.open').count() === 0);

// --- Clavier : le plein écran prend le focus et le rend
const clavierPlein = await page.evaluate(async () => {
  const shot = document.querySelectorAll('.shot')[0];
  shot.focus();
  const avant = document.activeElement === shot;
  shot.click();
  await new Promise(r => setTimeout(r, 300));
  const surFermer = document.activeElement === document.getElementById('lb-close');
  // la tabulation reste dans le plein écran
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  const dansPlein = document.getElementById('lightbox').contains(document.activeElement);
  document.getElementById('lb-close').click();
  await new Promise(r => setTimeout(r, 250));
  return { avant, surFermer, dansPlein, rendu: document.activeElement === shot };
});
check('Plein écran : le focus va sur le bouton fermer', clavierPlein.avant && clavierPlein.surFermer,
  JSON.stringify(clavierPlein));
check('Plein écran : la tabulation ne sort pas de la fenêtre', clavierPlein.dansPlein);
check('Plein écran : refermer rend le focus à la photo d’où l’on venait', clavierPlein.rendu);

// --- Appel à contact en fin de projet, seulement si des coordonnées existent
const contactProjet = await page.evaluate(() => {
  const p = document.getElementById('projet-contact');
  const avec = { cache: p.hidden, texte: (p.textContent || '').trim(), lien: (p.querySelector('a') || {}).href || '' };
  const garde = infosSite;
  infosSite = { title: 'x' };            // aucune coordonnée renseignée
  peindreContactProjet();
  const sans = document.getElementById('projet-contact').hidden;
  infosSite = garde; peindreContactProjet();
  return { avec, sans };
});
check('Projet : une invitation à écrire quand des coordonnées existent',
  !contactProjet.avec.cache && /Un projet de ce genre/.test(contactProjet.avec.texte)
  && /wa\.me|mailto:/.test(contactProjet.avec.lien), contactProjet.avec.texte + ' → ' + contactProjet.avec.lien);
check('Projet : rien du tout tant qu’aucune coordonnée n’est renseignée', contactProjet.sans === true);
await page.click('#back'); await page.waitForTimeout(300);
check('Retour à la liste', await page.locator('.projects').isVisible());

// --- Partage d'un lien et référencement
// Page fraîche : ce sont les balises telles que les lit un robot qui n'exécute pas le
// JavaScript (WhatsApp, Facebook, LinkedIn) qu'on veut vérifier ici.
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const seo = await page.evaluate(() => {
  const m = (sel) => (document.querySelector(sel) || {}).content || '';
  return {
    ogImage: m('meta[property="og:image"]'),
    ogTitre: m('meta[property="og:title"]'),
    ogType: m('meta[property="og:type"]'),
    carte: m('meta[name="twitter:card"]'),
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
    jsonld: (document.querySelector('script[type="application/ld+json"]') || {}).textContent || '',
    titre: document.title,
  };
});
check('Partage : une image d’aperçu est déclarée, à une adresse fixe',
  /\/galerie\/[0-9a-f-]+\/share\.jpg$/.test(seo.ogImage), seo.ogImage);
check('Partage : grande vignette sur les réseaux', seo.carte === 'summary_large_image', seo.carte);
check('Référencement : adresse canonique déclarée', /melissa-nabet-site/.test(seo.canonical), seo.canonical);
check('Partage : le titre déclaré est celui du site', /Melissa Nabet/.test(seo.ogTitre) && seo.ogType === 'website', seo.ogTitre);
let jsonldOk = false, jsonldNom = '';
try { const j = JSON.parse(seo.jsonld); jsonldNom = j.name; jsonldOk = j['@context'] === 'https://schema.org' && !!j.name; } catch (e) {}
check('Référencement : données structurées valides', jsonldOk, jsonldNom || seo.jsonld.slice(0, 60));

const robots = await page.goto('http://127.0.0.1:8902/robots.txt');
const robotsTxt = await robots.text();
check('Référencement : robots.txt servi et ouvert à l’indexation',
  robots.status() === 200 && /Allow: \//.test(robotsTxt) && /Sitemap:/.test(robotsTxt), robotsTxt.split('\n')[1]);
const smap = await page.goto('http://127.0.0.1:8902/sitemap.xml');
const smapTxt = await smap.text();
check('Référencement : sitemap.xml servi, avec le bon espace de noms',
  smap.status() === 200 && smapTxt.includes('http://www.sitemaps.org/schemas/sitemap/0.9') && smapTxt.includes('<loc>'),
  smapTxt.split('\n').find(l => l.includes('xmlns')) || '');
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// Le titre de l'onglet suit le projet ouvert : un lien copié depuis la barre d'adresse
// n'arrive plus avec le titre du site entier.
await page.locator('.project').first().click();
await page.waitForTimeout(500);
const seoProjet = await page.evaluate(() => ({
  titre: document.title,
  desc: (document.querySelector('meta[name="description"]') || {}).content || '',
  url: (document.querySelector('meta[property="og:url"]') || {}).content || '',
}));
check('Partage : le titre de l’onglet suit le projet ouvert',
  /^Bureau Sébastien — /.test(seoProjet.titre), seoProjet.titre);
check('Partage : la description reprend le texte du projet',
  /plateau de bureaux/.test(seoProjet.desc), seoProjet.desc.slice(0, 60));
check('Partage : l’adresse partagée est celle du projet', /#p-r1$/.test(seoProjet.url), seoProjet.url);
await page.click('#back'); await page.waitForTimeout(400);
const seoRetour = await page.evaluate(() => ({
  titre: document.title,
  image: (document.querySelector('meta[property="og:image"]') || {}).content || '',
}));
check('Partage : revenir à la liste rend son titre au site',
  seoRetour.titre === 'Melissa Nabet — Architecture d\'intérieur', seoRetour.titre);
check('Partage : et rend aussi l’image d’aperçu du site (pas celle du projet quitté)',
  /share\.jpg$/.test(seoRetour.image), seoRetour.image);

// --- À propos et contact, écrits depuis le CRM
const contact = await page.evaluate(() => ({
  visible: !document.getElementById('apropos').hidden,
  texte: (document.getElementById('apropos-txt').textContent || '').trim(),
  liens: [...document.querySelectorAll('#contact a')].map(a => a.getAttribute('href')),
  libelles: [...document.querySelectorAll('#contact a')].map(a => a.textContent),
}));
check('Contact : la section s’affiche quand quelque chose est rempli', contact.visible);
check('Contact : le texte À propos est repris', /banc d’essai/.test(contact.texte), contact.texte);
check('Contact : lien e-mail fabriqué', contact.liens.some(h => h === 'mailto:essai@example.com'), contact.liens.join(' | '));
check('Contact : lien WhatsApp au bon format international',
  contact.liens.some(h => h === 'https://wa.me/972520000000'), contact.liens.join(' | '));
check('Contact : lien Instagram', contact.liens.some(h => h === 'https://instagram.com/essai'), contact.liens.join(' | '));
const mailDansHtml = (await page.content()).includes('essai@example.com');
check('Contact : l’adresse e-mail n’est pas écrite en clair dans le HTML servi',
  !(await page.evaluate(() => document.documentElement.outerHTML.split('<script')[0].includes('essai@example.com'))),
  mailDansHtml ? 'présente après rendu (normal)' : 'absente');
const contactVide = await page.evaluate(() => {
  renderApropos({});
  const cache = document.getElementById('apropos').hidden;
  renderApropos({ apropos: 'Texte de présentation du banc d’essai.', email: 'essai@example.com', tel: '052 000 00 00', instagram: '@essai' });
  return cache;
});
check('Contact : rien de rempli, aucune section vide en bas de page', contactVide === true);

// Aucun secret dans la page servie
const html = await page.content();
const suspects = ['eyJ', 'service_role', 'sb_secret', 'apikey', 'Authorization'];
const found = suspects.filter(s => html.includes(s));
check('Aucune clé ni jeton dans la page publique', found.length === 0, found.join(', '));

// Lien direct vers un projet
await page.goto('http://127.0.0.1:8902/index.html#p-r1', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
check('Un lien direct ouvre le bon projet', (await page.textContent('#d-title')).trim() === 'Bureau Sébastien');

// Responsive
for (const w of [390, 768]) {
  await page.setViewportSize({ width: w, height: 800 });
  await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const of = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('Aucun débordement horizontal à ' + w + 'px', of <= 1, of + 'px');
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/site-mobile.png', fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/site-desktop.png' });

// --- L'ALLURE DU SITE. Le thème arrive du manifeste ; changer d'habillage ne doit rien
//     changer aux fonctions, et un thème inconnu ne doit pas vider la page de ses couleurs.
await page.setViewportSize({ width: 1280, height: 900 });
const poser = async (theme, mouvement) => page.evaluate(([t, m]) => {
  document.documentElement.removeAttribute('data-theme');
  appliquerTheme(t, m);
  const cs = getComputedStyle(document.body);
  return {
    attr: document.documentElement.getAttribute('data-theme'),
    fond: cs.backgroundColor, encre: cs.color,
    barre: (document.querySelector('meta[name="theme-color"]') || {}).content,
  };
}, [theme, mouvement]);

const epure = await poser('epure', 'discret');
check('Thème « Épure » appliqué : fond blanc pur',
  epure.attr === 'epure' && epure.fond === 'rgb(255, 255, 255)', JSON.stringify(epure));
const nuit = await poser('nuit', 'discret');
check('Thème « Nuit » appliqué : fond sombre ET texte clair — pas un thème à moitié',
  nuit.fond === 'rgb(15, 15, 15)' && nuit.encre === 'rgb(230, 226, 220)', JSON.stringify(nuit));
check('Le thème change aussi la barre du navigateur sur téléphone',
  nuit.barre === '#0f0f0f', String(nuit.barre));
const inconnu = await poser('theme-qui-nexiste-pas', 'discret');
check('Un thème inconnu laisse l’habillage par défaut, il ne casse rien',
  inconnu.attr === null && inconnu.fond === 'rgb(244, 239, 230)', JSON.stringify(inconnu));

// La mise en page « Index » : un sommaire, pas une grille. Mesuré sur la position réelle.
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const enIndex = await page.evaluate(async () => {
  appliquerTheme('index', 'discret');
  await new Promise(r => setTimeout(r, 250));
  const c = [...document.querySelectorAll('.project')];
  if (c.length < 2) return { assez: false };
  const a = c[0].getBoundingClientRect(), b = c[1].getBoundingClientRect();
  const vign = c[0].querySelector('.project-img').getBoundingClientRect();
  const nom = c[0].querySelector('.project-name').getBoundingClientRect();
  return { assez: true, empiles: b.top >= a.bottom - 1, memeColonne: Math.abs(a.left - b.left) < 1,
           vignPetite: vign.width <= 80, nomADroite: nom.left > vign.right - 1,
           cartes: c.length };
});
check('Index : les projets sont empilés en lignes, pas en grille',
  enIndex.assez && enIndex.empiles && enIndex.memeColonne, JSON.stringify(enIndex));
check('Index : une petite vignette à gauche, le nom à sa droite',
  enIndex.assez && enIndex.vignPetite && enIndex.nomADroite, JSON.stringify(enIndex));

// --- LE PIÈGE DU MOUVEMENT : une image posée à opacity:0 sans personne pour la révéler,
//     c'est une page blanche. Ni le réglage « aucun », ni un navigateur sans observateur,
//     ni « moins d'animation » ne doivent laisser quoi que ce soit d'invisible.
const visibilite = async (mouvement, reduit) => {
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 },
    reducedMotion: reduit ? 'reduce' : 'no-preference' });
  await p2.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
  await p2.evaluate(m => appliquerTheme('atelier', m), mouvement);
  await p2.waitForTimeout(300);
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForTimeout(900);
  const r = await p2.evaluate(() => {
    const c = [...document.querySelectorAll('.project')];
    return { total: c.length,
      invisibles: c.filter(x => parseFloat(getComputedStyle(x).opacity) < 0.05).length };
  });
  await p2.close();
  return r;
};
const vMoins = await visibilite('discret', true);
check('« Moins d’animation » : aucune carte ne reste invisible',
  vMoins.total > 0 && vMoins.invisibles === 0, JSON.stringify(vMoins));

const sansObs = await browser.newPage({ viewport: { width: 390, height: 844 } });
await sansObs.addInitScript(() => { delete window.IntersectionObserver; });
await sansObs.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await sansObs.waitForTimeout(900);
const rSansObs = await sansObs.evaluate(() => {
  const c = [...document.querySelectorAll('.project')];
  return { total: c.length, invisibles: c.filter(x => parseFloat(getComputedStyle(x).opacity) < 0.05).length,
           marquees: document.querySelectorAll('.fondu').length };
});
await sansObs.close();
check('Navigateur sans observateur : rien n’est marqué, donc rien n’est invisible',
  rSansObs.total > 0 && rSansObs.invisibles === 0 && rSansObs.marquees === 0, JSON.stringify(rSansObs));

/* LA SURFACE — saisie librement dans le CRM. Tapée seule (« 110 »), elle s'affichait telle
   quelle entre le lieu et la mission, sans dire de quoi il s'agit : c'est exactement l'état
   du vrai site aujourd'hui. L'unité est ajoutée au nombre nu, et seulement à lui. */
const surf = await page.evaluate(async () => {
  const lire = () => (document.getElementById('d-meta').textContent || '').trim();
  const vues = {};
  for (const id of ['r1', 'r2']) {
    for (let i = 0; i < projects.length; i++) if (projects[i].id === id) { openProject(i, 'remplacer'); break; }
    await new Promise(r => setTimeout(r, 250));
    vues[id] = lire();
  }
  const enHebreu = (() => { const avant = langue; langue = 'he'; const v = surfaceLisible('110'); langue = avant; return v; })();
  closeProject();
  await new Promise(r => setTimeout(r, 250));
  return { vues, enHebreu, dejaEcrite: surfaceLisible('85 m²'), vide: surfaceLisible(''),
           decimal: surfaceLisible('110,5'), espace: surfaceLisible('1 200') };
});
check('Surface : un nombre nu reçoit son unité', /110 m²/.test(surf.vues.r2), surf.vues.r2);
check('Surface : une valeur qui porte déjà son unité n’est pas retouchée',
  surf.dejaEcrite === '85 m²' && /85 m²/.test(surf.vues.r1) && !/85 m² m²/.test(surf.vues.r1), surf.vues.r1);
check('Surface : vide reste vide, aucune unité orpheline', surf.vide === '');
check('Surface : un décimal et un nombre espacé sont reconnus comme des nombres',
  surf.decimal === '110,5 m²' && surf.espace === '1 200 m²', surf.decimal + ' | ' + surf.espace);
check('Surface : l’unité suit la langue', surf.enHebreu === '110 מ″ר', surf.enHebreu);

/* CHARGEMENT — ce que voit un visiteur avant que le manifeste arrive. Les cartes d'attente
   doivent être dans le HTML SERVI (donc peintes sans attendre le script), et avoir
   entièrement disparu une fois les vraies réalisations affichées. */
const brut = await (await fetch('http://127.0.0.1:8902/index.html')).text();
const nbSquelettesServis = (brut.match(/class="project squelette"/g) || []).length;
check('Cartes d’attente présentes dans le HTML servi, avant tout script', nbSquelettesServis === 3, 'trouvées : ' + nbSquelettesServis);

const apresCharge = await page.evaluate(() => ({
  squelettes: document.querySelectorAll('.squelette').length,
  occupe: document.getElementById('projects').hasAttribute('aria-busy'),
  projets: document.querySelectorAll('.project:not(.squelette)').length,
}));
check('Cartes d’attente effacées une fois les réalisations affichées',
  apresCharge.squelettes === 0 && !apresCharge.occupe && apresCharge.projets > 0, JSON.stringify(apresCharge));

// --- La direction « Index » telle qu'elle arrivera vraiment : portée par le manifeste,
//     et regardée sur un écran de téléphone. C'est le chemin réel, pas un thème injecté.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:8902/index-theme.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const idx390 = await page.evaluate(() => {
  const c = [...document.querySelectorAll('.project:not(.squelette)')];
  const v = c[0].querySelector('.project-img').getBoundingClientRect();
  const n = c[0].querySelector('.project-name').getBoundingClientRect();
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    cartes: c.length,
    debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    vignette: Math.round(v.width),
    nomADroite: n.left > v.right - 1,
    images: [...document.querySelectorAll('.project-img img')].filter(i => i.naturalWidth > 0).length,
    invisibles: [...document.querySelectorAll('.fondu')].filter(e => getComputedStyle(e).opacity === '0').length,
    meta: (c[2].querySelector('.project-meta') || {}).textContent || '',
  };
});
check('« Index » posé par le manifeste, pas à la main', idx390.theme === 'index', String(idx390.theme));
check('« Index » sur un écran de 390 px : sommaire lisible, aucun débordement',
  idx390.debord <= 1 && idx390.vignette <= 80 && idx390.nomADroite && idx390.cartes === 3,
  JSON.stringify(idx390));
check('« Index » : toutes les vignettes chargent, rien ne reste invisible',
  idx390.images === 3 && idx390.invisibles === 0, JSON.stringify(idx390));
check('Un seul cliché s’écrit « 1 photo », pas « 1 photos »',
  / 1 photo(?!s)/.test(idx390.meta), idx390.meta);
await page.setViewportSize({ width: 1280, height: 900 });

// --- Les trois langues -----------------------------------------------------------------
// L'interface se traduit ; les textes de Melissa, non traduits, retombent sur le français.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.removeItem('mn-langue'); } catch (e) {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const langBtns = await page.locator('#langs button').allTextContents();
check('Sélecteur de langue : FR / EN / עב', langBtns.join('') === 'FRENעב', langBtns.join(' '));

await page.locator('#langs button', { hasText: 'EN' }).click();
await page.waitForTimeout(400);
const en = await page.evaluate(() => ({
  rubrique: (document.getElementById('t-realisations').textContent || '').trim(),
  apropos: (document.getElementById('t-apropos').textContent || '').trim(),
  sousTitre: (document.getElementById('site-tagline').textContent || '').trim(),
  texteApropos: (document.getElementById('apropos-txt').textContent || '').trim(),
  filtre: (document.querySelector('#filtres button') || {}).textContent || '',
  journalTitre: (document.querySelector('.entree-titre') || {}).textContent || '',
  journalTexte: (document.querySelector('.entree-texte') || {}).textContent || '',
}));
check('Interface traduite en anglais', en.rubrique === 'Works' && en.apropos === 'About' && /^All /.test(en.filtre),
  [en.rubrique, en.apropos, en.filtre].join(' | '));
check('Un texte traduit dans le CRM s’affiche bien traduit',
  en.sousTitre === 'Interior architecture' && /office delivered/.test(en.journalTitre),
  en.sousTitre + ' | ' + en.journalTitre);
check('Un texte NON traduit retombe sur le français, rien n’est inventé',
  /banc d’essai/.test(en.texteApropos) && /bibliothèque sur mesure/.test(en.journalTexte),
  en.texteApropos.slice(0, 30) + ' | ' + en.journalTexte.slice(0, 30));

await page.locator('#langs button', { hasText: 'עב' }).click();
await page.waitForTimeout(400);
const he = await page.evaluate(() => ({
  lang: document.documentElement.lang, dir: document.documentElement.dir,
  rubrique: (document.getElementById('t-realisations').textContent || '').trim(),
  sens: getComputedStyle(document.querySelector('.project')).direction,
}));
check('Hébreu : la page passe en lecture de droite à gauche',
  he.lang === 'he' && he.dir === 'rtl' && he.sens === 'rtl', he.lang + '/' + he.dir + '/' + he.sens);
check('Interface traduite en hébreu', he.rubrique === 'עבודות', he.rubrique);
/* Un texte français non traduit, affiché dans une page hébreu, doit garder sa ponctuation
   à sa place : sans `dir="auto"`, le point final part se coller au début de la ligne. */
const bidi = await page.evaluate(() => ({
  apropos: document.getElementById('apropos-txt').getAttribute('dir'),
  entree: (document.querySelector('.entree') || {}).dir,
  nom: (document.querySelector('.project-name') || {}).dir,
  sensLu: getComputedStyle(document.getElementById('apropos-txt')).direction,
}));
check('Un texte français dans une page hébreu garde son sens de lecture',
  bidi.apropos === 'auto' && bidi.entree === 'auto' && bidi.nom === 'auto' && bidi.sensLu === 'ltr',
  JSON.stringify(bidi));
// Les flèches du plein écran doivent suivre le sens de lecture, pas rester à gauche.
const fleches = await page.evaluate(() => {
  document.getElementById('lightbox').classList.add('open');
  const p = document.getElementById('lb-prev').getBoundingClientRect();
  const n = document.getElementById('lb-next').getBoundingClientRect();
  document.getElementById('lightbox').classList.remove('open');
  return { prev: p.left, next: n.left };
});
check('Plein écran : les flèches suivent le sens de lecture', fleches.prev > fleches.next,
  'préc. ' + Math.round(fleches.prev) + 'px / suiv. ' + Math.round(fleches.next) + 'px');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check('La langue choisie est retenue d’une visite à l’autre',
  (await page.evaluate(() => document.documentElement.lang)) === 'he');
await page.evaluate(() => { try { localStorage.removeItem('mn-langue'); } catch (e) {} });

// --- Journal ---------------------------------------------------------------------------
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const jrn = await page.evaluate(() => ({
  visible: !document.getElementById('journal').hidden,
  entrees: [...document.querySelectorAll('.entree')].map(e => ({
    date: (e.querySelector('.entree-date') || {}).textContent || '',
    titre: (e.querySelector('.entree-titre') || {}).textContent || '',
    texte: (e.querySelector('.entree-texte') || {}).textContent || '',
  })),
}));
check('Journal affiché, dans l’ordre du CRM',
  jrn.visible && jrn.entrees.length === 2 && /Sébastien/.test(jrn.entrees[0].titre), JSON.stringify(jrn.entrees));
check('Une entrée sans texte n’affiche pas de paragraphe vide', jrn.entrees[1].texte === '', '« ' + jrn.entrees[1].texte + ' »');

// --- Manifeste à l'ANCIEN format : c'est celui qui est en ligne aujourd'hui
await page.goto('http://127.0.0.1:8902/ancien.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const ancien = await page.evaluate(() => ({
  sous: (document.getElementById('site-tagline').textContent || '').trim(),
  projets: document.querySelectorAll('.project').length,
  langs: !document.getElementById('langs').hidden,
  journal: !document.getElementById('journal').hidden,
  rubrique: (document.getElementById('t-realisations').textContent || '').trim(),
}));
check('Ancien manifeste : la page reste correcte',
  ancien.sous === 'Architecture d’intérieur' && ancien.projets === 1 && ancien.rubrique === 'Réalisations',
  JSON.stringify(ancien));
check('Ancien manifeste : ni sélecteur de langue ni journal affichés pour rien',
  !ancien.langs && !ancien.journal, JSON.stringify(ancien));

// État vide : rien de publié encore, la page ne doit pas avoir l'air cassée
await page.goto('http://127.0.0.1:8902/vide.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const stateTxt = (await page.textContent('#state')) || '';
check('État « rien de publié » lisible, pas une page cassée', stateTxt.includes('Bientôt en ligne'), stateTxt.trim().slice(0, 50));
check('Rien de publié : aucune carte d’attente ne clignote sous le message',
  (await page.locator('.squelette').count()) === 0);
check('Rien de publié : pas de bouton « Réessayer », il n’y a rien à réessayer',
  (await page.locator('#state button').count()) === 0);

/* PANNE — manifeste introuvable. Avant, ce cas affichait « Bientôt en ligne » : le visiteur
   repartait en croyant le portfolio vide, et personne n'apprenait que le site était muet. */
await page.goto('http://127.0.0.1:8902/panne.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const panneTxt = (await page.textContent('#state')) || '';
check('Lecture impossible : le message dit une panne, pas un portfolio vide',
  /n’ont pas pu être chargées/.test(panneTxt) && !/Bientôt en ligne/.test(panneTxt), panneTxt.trim().slice(0, 60));
check('Lecture impossible : les cartes d’attente ont disparu', (await page.locator('.squelette').count()) === 0);
const btnRetry = page.locator('#state button');
check('Lecture impossible : un bouton « Réessayer » est offert', (await btnRetry.count()) === 1 && /Réessayer/.test(await btnRetry.textContent()));
await btnRetry.click();
check('« Réessayer » remet les cartes d’attente le temps du nouvel essai',
  (await page.locator('.squelette').count()) === 3);
await page.waitForTimeout(900);
check('« Réessayer » qui échoue encore réaffiche la panne, pas une page vide',
  /n’ont pas pu être chargées/.test((await page.textContent('#state')) || '')
  && (await page.locator('#state button').count()) === 1);

/* ------------------------------------------------------------------------------------
   LE BOUTON « RETOUR » DU NAVIGATEUR — c'est le geste le plus utilisé sur téléphone, et
   il ne faisait rien : l'adresse changeait, l'écran non. Ces contrôles se font avec le
   VRAI bouton précédent (page.goBack), pas en appelant les fonctions du site.
------------------------------------------------------------------------------------ */
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
/* On descend dans la liste avant d'ouvrir : le retour doit rendre cette position. Le clic
   est déclenché DANS la page et non par Playwright : `locator.click()` fait d'abord
   défiler jusqu'à l'élément, ce qui changerait la position juste avant l'ouverture et
   ferait passer le contrôle pour de mauvaises raisons. */
await page.evaluate(() => window.scrollTo(0, 120));
await page.waitForTimeout(150);
const posAvant = await page.evaluate(() => window.scrollY);
/* `.click()` sur un bouton lui donne le focus, et le navigateur fait défiler pour l'amener
   à l'écran : la position mesurée juste avant ne serait alors plus celle de l'ouverture.
   Un événement de clic synthétique ne déplace rien. */
await page.evaluate(() => document.querySelectorAll('.project:not(.squelette)')[1]
  .dispatchEvent(new MouseEvent('click', { bubbles: true })));
await page.waitForTimeout(250);
check('Historique : ouvrir un projet pose bien une entrée',
  (await page.evaluate(() => location.hash)) !== '' && (await page.evaluate(() => document.body.classList.contains('viewing'))));
await page.goBack();
await page.waitForTimeout(400);
const apresRetour = await page.evaluate(() => ({
  vue: document.body.classList.contains('viewing'), hash: location.hash, y: window.scrollY,
}));
check('Le bouton « précédent » referme le projet et rend la liste',
  !apresRetour.vue && apresRetour.hash === '', JSON.stringify(apresRetour));
check('Le retour rend la position où on avait laissé la liste',
  posAvant > 0 && Math.abs(apresRetour.y - posAvant) < 30,
  'attendu ' + posAvant + ', obtenu ' + apresRetour.y);
check('Le titre de l’onglet revient à celui du site après un retour',
  !/—/.test(await page.title()) || (await page.title()) === (await page.evaluate(() => TITRE_SITE)));
await page.goForward();
await page.waitForTimeout(400);
check('Le bouton « suivant » rouvre le projet quitté',
  (await page.evaluate(() => document.body.classList.contains('viewing'))) && /#p-/.test(await page.evaluate(() => location.hash)));

// Plein écran : il n'avait aucune entrée d'historique, le geste retour sortait du projet.
await page.locator('.shot').first().click();
await page.waitForTimeout(300);
check('Historique : le plein écran pose son entrée',
  await page.evaluate(() => document.getElementById('lightbox').classList.contains('open')));
await page.goBack();
await page.waitForTimeout(400);
const apresRetourPhoto = await page.evaluate(() => ({
  photo: document.getElementById('lightbox').classList.contains('open'),
  projet: document.body.classList.contains('viewing'),
}));
check('Le bouton « précédent » ferme le plein écran SANS quitter le projet',
  !apresRetourPhoto.photo && apresRetourPhoto.projet, JSON.stringify(apresRetourPhoto));

// Trente photos ne doivent pas devenir trente entrées d'historique.
await page.locator('.shot').first().click();
await page.waitForTimeout(200);
await page.locator('#lb-next').click();
await page.locator('#lb-next').click();
await page.waitForTimeout(250);
await page.goBack();
await page.waitForTimeout(400);
check('Changer de photo ne s’empile pas dans l’historique',
  !(await page.evaluate(() => document.getElementById('lightbox').classList.contains('open')))
  && (await page.evaluate(() => document.body.classList.contains('viewing'))));

// Enchaîner « projet suivant » ne doit pas exiger huit retours pour ressortir — au bouton
// comme à la flèche du clavier, qui empilait alors que le bouton non.
await page.evaluate(() => closeLightbox());
await page.waitForTimeout(250);
await page.locator('#suivant').click();
await page.waitForTimeout(250);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(250);
await page.locator('#suivant').click();
await page.waitForTimeout(250);
await page.goBack();
await page.waitForTimeout(400);
check('« Projet suivant » enchaîné : un seul retour ramène à la liste',
  !(await page.evaluate(() => document.body.classList.contains('viewing')))
  && (await page.evaluate(() => location.hash)) === '');

// Arrivé par un lien direct : rien derrière. Le bouton de la page ne doit pas faire sortir.
await page.goto('http://127.0.0.1:8902/index.html#p-r1', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('#back').click();
await page.waitForTimeout(400);
const apresLienDirect = await page.evaluate(() => ({
  vue: document.body.classList.contains('viewing'), hash: location.hash,
  cartes: document.querySelectorAll('.project:not(.squelette)').length,
}));
check('Lien direct vers un projet : « Toutes les réalisations » ramène à la liste, sans sortir du site',
  !apresLienDirect.vue && apresLienDirect.hash === '' && apresLienDirect.cartes > 0, JSON.stringify(apresLienDirect));

// ============================================================================
//  LE BANDEAU D'ACCUEIL : deux photos qui se suivent, projets au hasard, fondu doux
// ============================================================================
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
/* Le bandeau se met en pause quand le pointeur est dessus (c'est voulu, et vérifié plus
   bas). On écarte donc la souris avant de mesurer le défilement automatique — sinon le
   contrôle dépendrait de l'endroit où un clic précédent l'a laissée. */
await page.mouse.move(4, 4);
await page.waitForTimeout(1200);

/* Le manifeste, relu ici : les contrôles doivent porter sur ce qui est PUBLIÉ, pas sur des
   chemins recopiés à la main dans le test. */
const manif = await page.evaluate(() => fetch('galerie/u/manifest.json').then(r => r.json()));
const fichier = (u) => String(u || '').split('/').slice(-1)[0];

const lireBandeau = () => page.evaluate(() => {
  const b = document.getElementById('bandeau');
  const on = document.querySelector('.bd-couche.on');
  return {
    visible: !b.hidden,
    couche: on ? on.id : '',
    srcs: on ? [...on.querySelectorAll('img')].map(i => i.currentSrc || i.src) : [],
    chargees: on ? [...on.querySelectorAll('img')].filter(i => i.naturalWidth > 0).length : 0,
    nom: (document.getElementById('bd-nom') || {}).textContent || '',
    meta: (document.getElementById('bd-meta') || {}).textContent || '',
    duo: !!(on && on.classList.contains('duo')),
    opaciteAutre: (() => {
      const autre = [...document.querySelectorAll('.bd-couche')].filter(c => c !== on)[0];
      return autre ? getComputedStyle(autre).opacity : '';
    })(),
    transition: on ? getComputedStyle(on).transitionDuration : '',
  };
});

const bd1 = await lireBandeau();
check('Bandeau : une grande image s’affiche en haut de l’accueil',
  bd1.visible && bd1.chargees === bd1.srcs.length && bd1.srcs.length > 0,
  bd1.srcs.length + ' photo(s), ' + bd1.chargees + ' chargée(s)');
check('Bandeau : le nom du projet montré est affiché', !!bd1.nom.trim(), bd1.nom + ' — ' + bd1.meta);

/* Le fondu : deux couches superposées, l'une visible, l'autre à zéro, avec une transition
   d'opacité. Un changement sec passerait tous les autres contrôles. */
check('Bandeau : le changement se fait en fondu, pas en saut',
  parseFloat(bd1.transition) >= 0.6 && bd1.opaciteAutre === '0',
  'transition ' + bd1.transition + ', autre couche à ' + bd1.opaciteAutre);

/* LE point demandé : deux photos DU MÊME projet et QUI SE SUIVENT. On le vérifie contre le
   manifeste — un couple pris dans deux chantiers différents passerait ici.
   L'ordre des projets étant tiré au hasard, on ne peut rien conclure d'UNE vue : un projet
   d'une seule photo donne légitimement une vue solitaire. On en observe donc plusieurs. */
const verifierPaire = (vu) => {
  const p = (manif.realisations || []).filter(x => x.title === vu.nom)[0];
  if (!p) return { ok: false, why: 'projet « ' + vu.nom + ' » introuvable dans le manifeste' };
  /* Deux tailles existent pour chaque photo (1600 px et 700 px) et le navigateur prend la
     plus petite quand elle suffit : les deux nomment la même photo. */
  const rangDe = (f) => {
    for (let i = 0; i < p.photos.length; i++) {
      if (fichier(p.photos[i].full) === f || fichier(p.photos[i].thumb) === f) return i;
    }
    return -1;
  };
  const vus = vu.srcs.map(fichier);
  const rangs = vus.map(rangDe);
  if (rangs.some(r => r < 0)) return { ok: false, why: 'photo étrangère au projet : ' + vus.join(', ') };
  if (rangs.length === 2 && rangs[1] !== rangs[0] + 1) return { ok: false, why: 'photos non consécutives : rangs ' + rangs.join(' et ') };
  return { ok: true, why: vu.nom + ' · rangs ' + rangs.join('+'), n: rangs.length, projet: p };
};
const paire1 = verifierPaire(bd1);
check('Bandeau : la première vue vient bien d’un projet publié, dans l’ordre',
  paire1.ok, paire1.why);

/* On attend le changement au lieu de photographier un instant précis, et on le repère à la
   COUCHE qui s'échange — pas au rang, qui avance dès que l'envoi commence, ni aux adresses
   d'images, que le banc d'essai fait volontairement partager entre projets. */
const attendreVue = async (coucheAvant) => {
  try {
    await page.waitForFunction((c) => {
      const on = document.querySelector('.bd-couche.on');
      return !!on && on.id !== c;
    }, coucheAvant, { timeout: 12000 });
    return await lireBandeau();
  } catch (e) { return null; }
};
const bd2 = await attendreVue(bd1.couche);
check('Bandeau : la vue change toute seule après le temps réglé, et les couches s’échangent',
  !!bd2 && bd2.couche !== bd1.couche && bd2.chargees === bd2.srcs.length,
  bd2 ? (bd1.couche + ' → ' + bd2.couche + ' · ' + bd2.nom) : 'aucun changement en 12 s');

/* Plusieurs vues d'affilée : c'est là que la règle se voit. Chacune doit appartenir à un
   seul projet, ses photos se suivre, et un projet qui a de quoi faire une paire doit en
   montrer une sur un écran large. */
const vues = [bd1, bd2].filter(Boolean);
let derniere = vues[vues.length - 1];
for (let i = 0; i < 4 && derniere; i++) {
  derniere = await attendreVue(derniere.couche);
  if (derniere) vues.push(derniere);
}
const analyses = vues.map(verifierPaire);
check('Bandeau : chaque vue vient d’un seul projet, photos qui se suivent',
  analyses.length >= 4 && analyses.every(a => a.ok),
  analyses.map(a => a.why).join(' | '));
check('Bandeau : sur un écran large, un projet à plusieurs photos en montre DEUX côte à côte',
  vues.some((v, k) => v.duo && analyses[k].ok && analyses[k].n === 2),
  vues.map(v => v.srcs.length + (v.duo ? ' (duo)' : '')).join(' | '));
/* Un projet d'une seule photo ne peut pas faire de paire : sa vue s'affiche seule et prend
   toute la largeur, elle ne doit pas laisser une case vide à côté. */
const solos = vues.filter(v => v.srcs.length === 1);
check('Bandeau : une vue solitaire occupe toute la largeur, sans case vide',
  solos.every(v => !v.duo), solos.length + ' vue(s) solitaire(s)');

// --- DÉFILER À LA MAIN : les flèches, le clavier, le doigt
const parGeste = async (faire) => {
  const avant = await page.evaluate(() => ({
    couche: (document.querySelector('.bd-couche.on') || {}).id || '',
    rang: bdRang, nom: (document.getElementById('bd-nom') || {}).textContent || '',
  }));
  await faire();
  try {
    await page.waitForFunction((c) => {
      const on = document.querySelector('.bd-couche.on');
      return !!on && on.id !== c;
    }, avant.couche, { timeout: 9000 });
  } catch (e) { return { avant, apres: null }; }
  const apres = await lireBandeau();
  const rang = await page.evaluate(() => bdRang);
  return { avant, apres: Object.assign({ rang }, apres) };
};

const bdFleches = await page.evaluate(() => {
  const p = document.getElementById('bd-prec'), s = document.getElementById('bd-suiv');
  return { existent: !!p && !!s, visibles: !p.hidden && !s.hidden,
           dansLeBouton: !!document.querySelector('.bd-ouvrir button'),
           labels: [p.getAttribute('aria-label'), s.getAttribute('aria-label')] };
});
check('Bandeau : deux flèches ‹ › pour défiler à la main',
  bdFleches.existent && bdFleches.visibles && bdFleches.labels.every(Boolean), JSON.stringify(bdFleches));
/* Un bouton dans un bouton n'existe pas en HTML : le clavier et les lecteurs d'écran s'y
   perdent. Les flèches sont donc voisines du bouton d'ouverture, pas ses enfants. */
check('Bandeau : les flèches ne sont pas imbriquées dans le bouton d’ouverture',
  bdFleches.dansLeBouton === false);

const suiv = await parGeste(() => page.locator('#bd-suiv').click());
check('Bandeau : la flèche › passe à la vue suivante',
  !!suiv.apres && suiv.apres.rang === suiv.avant.rang + 1 && suiv.apres.chargees === suiv.apres.srcs.length,
  suiv.apres ? ('rang ' + suiv.avant.rang + ' → ' + suiv.apres.rang) : 'rien ne s’est passé');
/* Reculer doit ramener EXACTEMENT là d'où l'on vient — c'est tout l'intérêt : on a vu une
   photo passer trop vite et on veut la revoir. */
const prec = await parGeste(() => page.locator('#bd-prec').click());
check('Bandeau : la flèche ‹ ramène à la vue précédente, celle qu’on vient de quitter',
  !!prec.apres && prec.apres.rang === suiv.avant.rang && prec.apres.nom === suiv.avant.nom,
  prec.apres ? ('rang ' + prec.avant.rang + ' → ' + prec.apres.rang + ' · ' + prec.apres.nom) : 'rien ne s’est passé');

const clavier = await parGeste(async () => {
  await page.locator('#bd-ouvrir').focus();
  await page.keyboard.press('ArrowRight');
});
check('Bandeau : les touches ← → font défiler au clavier',
  !!clavier.apres && clavier.apres.rang === clavier.avant.rang + 1,
  clavier.apres ? ('rang ' + clavier.avant.rang + ' → ' + clavier.apres.rang) : 'rien ne s’est passé');

/* Le balayage au doigt : un glissement franc change de vue, et n'ouvre PAS le projet —
   un balayage se termine par un `click`, c'est le piège classique. */
const glisse = await parGeste(() => page.evaluate(() => {
  const b = document.getElementById('bandeau');
  const t = (x) => ({ clientX: x, clientY: 300 });
  b.dispatchEvent(Object.assign(new Event('touchstart'), { touches: [t(600)] }));
  b.dispatchEvent(Object.assign(new Event('touchend'), { changedTouches: [t(500)] }));
}));
check('Bandeau : glisser le doigt change de vue',
  !!glisse.apres && glisse.apres.rang === glisse.avant.rang + 1,
  glisse.apres ? ('rang ' + glisse.avant.rang + ' → ' + glisse.apres.rang) : 'rien ne s’est passé');
const ouvertApresGlisse = await page.evaluate(() => {
  document.getElementById('bd-ouvrir').click();
  return document.body.classList.contains('viewing');
});
check('Bandeau : un balayage n’ouvre pas le projet par accident', ouvertApresGlisse === false);

/* Un geste manuel RELANCE le compte à zéro : il ne débranche pas le bandeau. On regarde une
   image de plus, on ne coupe pas le défilement. */
const apresGeste = await parGeste(() => Promise.resolve());
check('Bandeau : après un geste manuel, le défilement automatique reprend',
  !!apresGeste.apres, apresGeste.apres ? 'reprend' : 'ne reprend plus');

/* Une seule photo par vue : le réglage de Melissa, même sur un écran large. */
const solo = await page.evaluate(async () => {
  infosSite.diaporamaPar = 1;
  bdConstruire();
  clearTimeout(bdMinuteur);
  bdAller(1);
  await new Promise(r => setTimeout(r, 1500));
  const on = document.querySelector('.bd-couche.on');
  const r = { par: bdRegle().par, parVue: bdParVue(),
    cases: on ? on.querySelectorAll('img').length : 0,
    solo: !!(on && on.classList.contains('solo')), duo: !!(on && on.classList.contains('duo')),
    largeur: on ? Math.round(on.getBoundingClientRect().width) : 0,
    /* On mesure la CASE, pas l'image : l'image est volontairement agrandie par le
       rapprochement lent, et rognée par la case (`overflow:hidden`). */
    caseLargeur: on && on.querySelector('.bd-case') ? Math.round(on.querySelector('.bd-case').getBoundingClientRect().width) : 0,
    imageDeborde: (() => { const c = on && on.querySelector('.bd-case');
      return c ? getComputedStyle(c).overflow !== 'hidden' : true; })() };
  /* Le tirage étant au hasard, la vue affichée après le retour peut légitimement être
     solitaire (un projet d'une seule photo, ou la dernière d'un nombre impair). Ce qui se
     vérifie sans dépendre du hasard, c'est la LISTE DES VUES construite : à une photo par
     vue, aucune ne doit en porter deux ; à deux, il doit y en avoir. */
  r.vuesA1 = bdVues.map(v => v.photos.length);
  infosSite.diaporamaPar = 2; bdConstruire();
  r.vuesA2 = bdVues.map(v => v.photos.length);
  r.parApres = bdRegle().par;
  clearTimeout(bdMinuteur); bdAller(1);
  await new Promise(r2 => setTimeout(r2, 1500));
  return r;
});
check('Bandeau : réglé sur UNE photo, il n’en montre qu’une, sur toute la largeur',
  solo.par === 1 && solo.cases === 1 && solo.solo && !solo.duo
  && Math.abs(solo.caseLargeur - solo.largeur) < 4 && !solo.imageDeborde,
  JSON.stringify(solo));
check('Bandeau : à UNE photo par vue, aucune vue n’en porte deux',
  solo.vuesA1.length > 0 && solo.vuesA1.every(n => n === 1), solo.vuesA1.join(','));
check('Bandeau : remis sur deux, les vues repassent par paires',
  solo.parApres === 2 && solo.vuesA2.some(n => n === 2), solo.vuesA2.join(','));

/* Le survol suspend le défilement : on ne change pas une image sous les yeux de quelqu'un
   qui la regarde — et surtout pas sous son doigt au moment où il appuie. C'est aussi ce qui
   rend le clic fiable : sans cette pause, on ouvrirait le projet suivant. */
/* On sort d'abord le pointeur du bandeau : les contrôles précédents ont cliqué sur les
   flèches, qui sont dedans. Sans ce retour à zéro, il n'y a pas de « survol » à mesurer —
   on y était déjà. */
await page.mouse.move(4, 4);
await page.waitForTimeout(300);
await page.hover('#bandeau');
const avantPause = Object.assign({ pause: await page.evaluate(() => bdPause) }, await lireBandeau());
await page.waitForTimeout(4500);            // au-delà des 3 s réglées
const apresPause = await lireBandeau();
check('Bandeau : le survol suspend le défilement',
  avantPause.pause === true && apresPause.couche === avantPause.couche && apresPause.nom === avantPause.nom,
  'pause=' + avantPause.pause + ' · ' + avantPause.couche + ' → ' + apresPause.couche);

// Un appui ouvre le projet montré — c'est ce qui en fait autre chose qu'une décoration.
const nomAvantClic = apresPause.nom;
await page.locator('#bandeau').click();
await page.waitForTimeout(700);
const apresClic = await page.evaluate(() => ({
  vue: document.body.classList.contains('viewing'),
  titre: (document.getElementById('d-title') || {}).textContent || '',
  bandeauVu: getComputedStyle(document.getElementById('bandeau')).display,
}));
check('Bandeau : un appui ouvre le projet montré',
  apresClic.vue && apresClic.titre === nomAvantClic, apresClic.titre + ' / attendu ' + nomAvantClic);
check('Bandeau : il disparaît dès qu’un projet est ouvert', apresClic.bandeauVu === 'none', apresClic.bandeauVu);

await page.locator('#back').click();
await page.waitForTimeout(600);
check('Bandeau : il revient quand on retourne à la liste',
  (await page.evaluate(() => getComputedStyle(document.getElementById('bandeau')).display)) !== 'none');

// --- Le réglage, lu du manifeste, avec repli sur une valeur absurde
const reglage = await page.evaluate(() => {
  const lu = bdRegle();
  const sauve = infosSite.diaporamaSec;
  infosSite.diaporamaSec = 0.2;   // valeur absurde : clignoterait
  const absurde = bdRegle();
  infosSite.diaporamaSec = sauve;
  return { lu, absurde, defaut: BD_SEC_DEFAUT };
});
check('Bandeau : la durée d’affichage vient du CRM', reglage.lu.delai === 3000, reglage.lu.delai + ' ms');
check('Bandeau : une durée absurde retombe sur le défaut, elle ne fait pas clignoter le site',
  reglage.absurde.delai === reglage.defaut * 1000, reglage.absurde.delai + ' ms');

// --- Sur téléphone : une photo à la fois, et rien qui déborde
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
const tel = await lireBandeau();
const debordTel = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
await page.screenshot({ path: '/tmp/mn-bandeau-390.png' });
check('Bandeau sur téléphone : une seule photo à la fois, pas deux timbres-poste',
  tel.visible && tel.srcs.length === 1 && !tel.duo, tel.srcs.length + ' photo(s)');
check('Bandeau sur téléphone : la page ne déborde pas', debordTel <= 1, debordTel + 'px');
const paireTel = verifierPaire(tel);
check('Bandeau sur téléphone : la photo appartient bien au projet nommé', paireTel.ok, paireTel.why);
await page.setViewportSize({ width: 1280, height: 900 });

/* Au doigt : un appui suspend, mais le doigt finit toujours par se lever. Sans reprise, un
   simple effleurement figeait le bandeau pour le reste de la visite — et sur un écran
   tactile, aucun `mouseleave` ne vient jamais le réveiller. */
await page.mouse.move(4, 4);
const tactile = await page.evaluate(async () => {
  const b = document.getElementById('bandeau');
  /* Le survol suspend aussi, et le pointeur peut être resté sur le bandeau après les
     contrôles précédents : on repart d'un état franc, sinon ce contrôle mesurerait la
     position de la souris au lieu du geste du doigt. */
  b.dispatchEvent(new Event('mouseleave'));
  const avant = bdPause;
  b.dispatchEvent(new Event('touchstart'));
  const pendant = bdPause;
  b.dispatchEvent(new Event('touchend'));
  await new Promise(r => setTimeout(r, 60));
  return { avant, pendant, apres: bdPause, minuteur: !!bdMinuteur };
});
check('Bandeau au doigt : l’appui suspend, et le doigt levé relance',
  tactile.avant === false && tactile.pendant === true && tactile.apres === false && tactile.minuteur,
  JSON.stringify(tactile));

/* Sans survol possible (téléphone, tablette), une commande qui n'apparaît qu'au survol
   n'existe pas. Les flèches doivent donc être visibles en permanence — vérifié sur un
   contexte réellement tactile, pas déduit de la feuille de style. */
const ctxTactile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const pageTactile = await ctxTactile.newPage();
await pageTactile.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await pageTactile.waitForTimeout(1600);
const tact = await pageTactile.evaluate(() => {
  const p = document.getElementById('bd-prec');
  return { hoverNone: matchMedia('(hover:none)').matches, cachee: p.hidden,
           opacite: parseFloat(getComputedStyle(p).opacity),
           taille: Math.round(p.getBoundingClientRect().width) };
});
await pageTactile.screenshot({ path: '/tmp/mn-bandeau-tactile.png' });
await ctxTactile.close();
check('Bandeau au doigt : les flèches sont visibles en permanence, et assez grandes pour le pouce',
  tact.hoverNone && !tact.cachee && tact.opacite > 0.5 && tact.taille >= 40, JSON.stringify(tact));

// --- « Masqué » : le site commence par la liste, sans bandeau du tout
await page.goto('http://127.0.0.1:8902/index-theme.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
check('Bandeau : réglé sur « masqué », il n’existe pas',
  await page.evaluate(() => document.getElementById('bandeau').hidden),
  await page.evaluate(() => document.getElementById('bandeau').hidden ? 'absent' : 'encore là'));

// --- Aucun projet publié : pas de bandeau vide au-dessus du message
await page.goto('http://127.0.0.1:8902/vide.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
check('Bandeau : rien de publié, pas de cadre vide au-dessus du message',
  await page.evaluate(() => document.getElementById('bandeau').hidden));

// --- Un manifeste ancien, sans le réglage : le bandeau marche quand même, sur son défaut
await page.goto('http://127.0.0.1:8902/ancien.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const ancienBd = await page.evaluate(() => ({
  visible: !document.getElementById('bandeau').hidden,
  delai: bdRegle().delai,
  photos: [...document.querySelectorAll('.bd-couche.on img')].filter(i => i.naturalWidth > 0).length,
}));
check('Bandeau : un manifeste publié avant ce réglage l’affiche quand même, sur son défaut',
  ancienBd.visible && ancienBd.delai === 7000 && ancienBd.photos === 1, JSON.stringify(ancienBd));

await page.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const realErrs = errs.filter(e => !envNoise(e));
check('Aucune erreur JavaScript du site', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

console.log('\n===== SITE : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
