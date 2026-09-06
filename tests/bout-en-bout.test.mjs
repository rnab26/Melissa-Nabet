/* Test de bout en bout : ce que le CRM PUBLIE est-il exactement ce que le site LIT ?
 *
 * Les deux suites existantes vérifient chacune un côté, avec un manifeste écrit à la main
 * au milieu. Rien ne garantissait donc que les deux parlent de la même chose : il suffisait
 * qu'un champ soit renommé d'un côté (categorie → category, texte → description) pour que le
 * site cesse de l'afficher sans qu'aucun test ne bronche.
 *
 * Ici, on fait publier une vraie réalisation par le CRM, on récupère le manifeste et les
 * images RÉELLEMENT écrits dans le stockage, on les sert tels quels, et on ouvre le site
 * dessus. Aucun fichier n'est écrit à la main.
 *
 * Lancer :
 *   python3 -m http.server 8899 &        # depuis la racine du dépôt
 *   node tests/bout-en-bout.test.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = '/tmp/mn-e2e';
const PORT = 8903;
const URL_CRM = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';

const ok = [], ko = [];
const check = (n, p, d = '') => {
  (p ? ok : ko).push(n + (d ? ' — ' + d : ''));
  console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : ''));
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// ---------------------------------------------------------------- 1. le CRM publie
const crm = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const erreursCrm = [];
crm.on('pageerror', e => erreursCrm.push(e.message));
await crm.goto(URL_CRM, { waitUntil: 'domcontentloaded' });
await crm.waitForTimeout(1500);

const publication = await crm.evaluate(async () => {
  const files = new Map();
  const chain = () => ({ upsert: async () => ({ error: null }), delete: () => chain(), in: async () => ({ error: null }), select: () => chain(), eq: () => chain(), then: r => r({ error: null }) });
  sb = {
    storage: {
      from: () => ({
        upload: async (p, b) => { files.set(p, b); return { error: null }; },
        download: async (p) => files.has(p) ? { data: files.get(p), error: null } : { data: null, error: { message: 'Object not found', statusCode: '404' } },
        remove: async (ps) => { ps.forEach(x => files.delete(x)); return { error: null }; },
        list: async () => ({ data: [], error: null }),
      }),
    },
    from: chain,
  };
  sb.auth = { getSession: async () => ({ data: { session: { access_token: 'jeton' } } }) };
  sbUser = { id: 'u', email: 'test@test' };
  ownerId = 'u';
  showView('realisations');

  const mk = async (nom, w, h, couleur) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.fillStyle = couleur; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2f2a24'; x.fillRect(w * 0.1, h * 0.2, w * 0.3, h * 0.6);
    const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    return new File([b], nom, { type: 'image/jpeg' });
  };

  realisations = [];
  newRealisation();
  const r = realisations[0];
  r.title = 'Duplex Rothschild';
  r.date = '2026';
  r.lieu = 'Tel Aviv';
  r.surface = '120 m²';
  r.mission = 'Rénovation complète';
  r.categorie = 'Appartement';
  r.texte = 'Deux niveaux réunis par un escalier suspendu, et une cuisine ouverte sur le séjour.';
  // une horizontale et une verticale : c'est ce qui décide de la mise en page du site
  await addPhotosToRealisation(r, [await mk('sejour.jpg', 1200, 800, '#b9ada0'), await mk('escalier.jpg', 800, 1200, '#9fb0a6')]);
  r.photos[0].caption = 'Séjour traversant, parquet point de Hongrie.';
  r.cover = r.photos[0].id;
  // ce que le site doit dire du studio
  library.site = Object.assign({}, library.site, { sousTitre: 'Architecture d’intérieur', apropos: 'Texte de présentation.', email: 'essai@example.com' });
  saveRealisations();
  await publishRealisation(r);

  const geler = async () => {
    const etat = { fichiers: {}, manifest: null };
    for (const [chemin, blob] of files) {
      if (chemin.endsWith('manifest.json')) { etat.manifest = JSON.parse(await blob.text()); continue; }
      const buf = new Uint8Array(await blob.arrayBuffer());
      let brut = '';
      for (let i = 0; i < buf.length; i += 8192) brut += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      etat.fichiers[chemin] = btoa(brut);
    }
    return etat;
  };
  const sortie = await geler();
  sortie.erreur = _pubLastError;
  sortie.publiee = r.published;

  // --- Puis on RETOUCHE la première photo, et on republie.
  // La retouche est posée exactement comme le fait `iaStoreResult`, mais sans appeler le
  // modèle : aucun crédit n'est dépensé. La couleur est franchement différente — c'est ce
  // qu'on ira mesurer sur le site public.
  const p = r.photos[0];
  const vid = 'vretouche', key = 'ra_' + p.id + '_' + vid;
  const retouchee = await mk('retouche.jpg', 1200, 800, '#1e6fd9');
  await photoStore.save(key, retouchee);
  if (!p.edits) p.edits = {};
  p.edits[photoActiveId(p)] = JSON.parse(JSON.stringify(p.edit || blankEdit()));
  photoVersions(p).push({ id: vid, key, model: 'test', prompt: 'essai', params: {}, from: 'orig', createdAt: Date.now(), label: 'Retouche 1' });
  p.edits[vid] = blankEdit(); p.active = vid; p.edit = blankEdit();
  photoTouch(p, 'ia', 'Retouche 1');

  const plan = realisationPublishPlan(r);
  const avantChemin = p.pub.full;
  await publishRealisation(r);
  const apres = await geler();
  apres.erreur = _pubLastError;
  sortie.retouche = {
    avantChemin, apresChemin: p.pub.full, vlabel: p.pub.vlabel,
    planChange: plan.change, pourquoi: (plan.photos.find(x => x.p.id === p.id) || {}).pourquoi || '',
    etat2: apres,
  };
  // et le retour en arrière, une fois le site à jour
  sortie.retouche.peutRevenir = !!(r.pubPrev && r.pubPrev.fiche);
  return sortie;
});
await crm.close();

check('Le CRM publie sans erreur', publication.publiee === true && !publication.erreur, publication.erreur || '');
check('Le CRM a bien écrit un manifeste', !!publication.manifest, publication.manifest ? Object.keys(publication.manifest).join(',') : 'aucun');

// ---------------------------------------------------------------- 2. on sert CE stockage
const servir = (etat) => {
  rmSync(join(DIR, 'galerie'), { recursive: true, force: true });
  mkdirSync(join(DIR, 'galerie'), { recursive: true });
  for (const [chemin, b64] of Object.entries(etat.fichiers)) {
    const dest = join(DIR, 'galerie', chemin);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(b64, 'base64'));
  }
  mkdirSync(join(DIR, 'galerie', 'u'), { recursive: true });
  writeFileSync(join(DIR, 'galerie', 'u', 'manifest.json'), JSON.stringify(etat.manifest));
};
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
servir(publication);

// la page publique, avec pour seule modification l'adresse du stockage
const source = readFileSync(join(RACINE, 'site-vitrine/index.html'), 'utf8');
writeFileSync(join(DIR, 'index.html'),
  source.replace(/var STORAGE = '[^']+';/, "var STORAGE = 'http://127.0.0.1:" + PORT + "/galerie/';")
        .replace(/var OWNER = '[^']+';/, "var OWNER = 'u';"));

const serveur = spawn('python3', ['-m', 'http.server', String(PORT), '-d', DIR], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

// ---------------------------------------------------------------- 3. le site lit
const site = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const erreursSite = [];
site.on('pageerror', e => erreursSite.push(e.message));
await site.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'networkidle' });
await site.waitForTimeout(900);

const vu = await site.evaluate(() => ({
  cartes: [...document.querySelectorAll('.project-name')].map(t => t.textContent),
  meta: [...document.querySelectorAll('.project-meta')].map(t => t.textContent),
  vignettes: [...document.querySelectorAll('.project-img img')].filter(i => i.naturalWidth > 0).length,
}));
check('Le site montre la réalisation publiée', vu.cartes.join('') === 'Duplex Rothschild', vu.cartes.join(' | '));
check('La vignette de couverture écrite par le CRM se charge vraiment', vu.vignettes === 1, vu.vignettes + ' chargée(s)');
check('Les informations du projet arrivent sur la carte',
  /2026/.test(vu.meta[0]) && /Tel Aviv/.test(vu.meta[0]), vu.meta[0]);

await site.locator('.project').first().click();
await site.waitForTimeout(800);
await site.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await site.waitForTimeout(800);

const projet = await site.evaluate(() => ({
  titre: (document.getElementById('d-title').textContent || '').trim(),
  meta: (document.getElementById('d-meta').textContent || '').trim(),
  texte: (document.getElementById('d-text').textContent || '').trim(),
  legendes: [...document.querySelectorAll('.shot-cap')].map(c => c.textContent.trim()),
  photos: [...document.querySelectorAll('.shot img')].filter(i => i.naturalWidth > 0).length,
  portraits: document.querySelectorAll('.shot.portrait').length,
  apropos: (document.getElementById('apropos-txt').textContent || '').trim(),
  contact: [...document.querySelectorAll('#contact a')].map(a => a.getAttribute('href')),
}));
check('Le titre, le lieu, la surface et la mission traversent le manifeste',
  projet.titre === 'Duplex Rothschild' && /Tel Aviv/.test(projet.meta) && /120 m²/.test(projet.meta)
  && /Rénovation complète/.test(projet.meta) && /Appartement/.test(projet.meta), projet.meta);
check('Le texte de présentation écrit dans le CRM s’affiche sur le site',
  /escalier suspendu/.test(projet.texte), projet.texte.slice(0, 70));
check('La légende écrite dans le CRM s’affiche sous la bonne photo',
  projet.legendes.length === 1 && /point de Hongrie/.test(projet.legendes[0]), projet.legendes.join(' | '));
check('Les deux photos publiées se chargent réellement', projet.photos === 2, projet.photos + ' photo(s)');
check('L’orientation publiée décide de la mise en page (une verticale sur deux)',
  projet.portraits === 1, projet.portraits + ' verticale(s)');
check('Ce que le CRM dit du studio arrive aussi : à propos et contact',
  /Texte de présentation/.test(projet.apropos) && projet.contact.some(h => h === 'mailto:essai@example.com'),
  projet.apropos + ' | ' + projet.contact.join(' '));

const bruit = e => /favicon|net::ERR|Failed to load resource|fonts\.googleapis|fonts\.gstatic/i.test(e);
check('Aucune erreur JavaScript des deux côtés',
  erreursCrm.filter(e => !bruit(e)).length === 0 && erreursSite.filter(e => !bruit(e)).length === 0,
  [...erreursCrm, ...erreursSite].filter(e => !bruit(e)).slice(0, 2).join(' | '));

// ================================================================================
//  LA QUESTION QUI A FAIT PERDRE DES HEURES : je retouche, je republie — le visiteur
//  voit-il la retouche, ou l'ancienne photo ?
//  On ne le déduit pas : on MESURE la couleur des pixels réellement affichés par la page
//  publique. L'originale est un gris chaud (#b9ada0), la retouche un bleu franc (#1e6fd9).
// ================================================================================
const teinteDe = async (pg) => pg.evaluate(async () => {
  const im = [...document.querySelectorAll('.shot img')].find(i => i.naturalWidth > 0);
  if (!im) return null;
  const cv = document.createElement('canvas');
  cv.width = 40; cv.height = 30;
  cv.getContext('2d').drawImage(im, 0, 0, 40, 30);
  const d = cv.getContext('2d').getImageData(0, 0, 40, 30).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), src: im.getAttribute('src') };
});
const ouvrirProjet = async (pg) => {
  await pg.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(700);
  await pg.locator('.project').first().click();
  await pg.waitForTimeout(900);
};

check('La retouche change l’ADRESSE publique de la photo',
  publication.retouche.avantChemin !== publication.retouche.apresChemin,
  publication.retouche.avantChemin + ' → ' + publication.retouche.apresChemin);
check('Le CRM annonce la retouche avant de publier, en la nommant',
  publication.retouche.planChange === 1 && /Retouche 1/.test(publication.retouche.pourquoi),
  publication.retouche.pourquoi);

// (a) le visiteur qui avait DÉJÀ ouvert le site avant la republication — c'est lui que le
//     cache pénalisait, et c'est le cas que Raphaël vit depuis son téléphone.
const dejaVenu = await browser.newPage({ viewport: { width: 390, height: 844 } });
await ouvrirProjet(dejaVenu);
const avant = await teinteDe(dejaVenu);
check('Avant republication, le site montre bien la photo d’origine (gris chaud)',
  !!avant && avant.r > avant.b, JSON.stringify(avant));

servir(publication.retouche.etat2);          // le CRM vient de republier
await ouvrirProjet(dejaVenu);                 // même navigateur, même cache
const apresChaud = await teinteDe(dejaVenu);
await dejaVenu.screenshot({ path: '/tmp/mn-site-apres-retouche-390.png' });
check('APRÈS republication, un visiteur déjà venu voit la RETOUCHE, pas l’ancienne photo',
  !!apresChaud && apresChaud.b > apresChaud.r + 40, JSON.stringify(apresChaud));
check('Et il la voit parce que l’adresse a changé, pas par chance',
  !!apresChaud && !!avant && apresChaud.src !== avant.src, (avant && avant.src) + ' → ' + (apresChaud && apresChaud.src));
await dejaVenu.close();

// (b) un navigateur entièrement neuf, sans le moindre cache
const neuf = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageNeuve = await neuf.newPage();
await ouvrirProjet(pageNeuve);
const vueNeuve = await teinteDe(pageNeuve);
check('Dans un navigateur neuf aussi, c’est la retouche qui s’affiche',
  !!vueNeuve && vueNeuve.b > vueNeuve.r + 40, JSON.stringify(vueNeuve));
await neuf.close();

check('Le retour à la publication précédente est possible après cette republication',
  publication.retouche.peutRevenir === true);
// L'image d'avant n'a pas été effacée : c'est ce qui rend le retour immédiat et gratuit.
check('L’image d’avant est toujours servie par le stockage',
  Object.keys(publication.retouche.etat2.fichiers).some(k => k === 'u/' + publication.retouche.avantChemin),
  publication.retouche.avantChemin);

serveur.kill();
await browser.close();
console.log('\n===== BOUT EN BOUT : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
process.exit(ko.length ? 1 : 0);
