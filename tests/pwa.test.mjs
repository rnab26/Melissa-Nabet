/* Le CRM s'installe comme une application (Chrome, Android, ordinateur ; Safari sur iPhone).
   Demande de Raphaël : « rendre le site du CRM comme une application Chrome installable, car ça ne
   fonctionne pas actuellement ». Chrome ne proposait que « Ajouter un raccourci » : aucune fiche
   d'application (manifeste), aucune icône d'application, aucun service worker.

   Ce que ce fichier PROUVE, dans l'ordre :
     1. les fichiers : manifeste valide, icônes aux bonnes tailles, balises du <head>, chemins
        RELATIFS (le CRM est servi sous /Melissa-Nabet/ en ligne, à la racine en local) ;
     2. Chromium LUI-MÊME dit que la page est installable : `Page.getInstallabilityErrors` rend une
        liste VIDE (avant ce chantier, sur main : « no-manifest »), à la racine ET sous un sous-chemin ;
     3. le service worker ne gêne rien : il ne touche qu'à l'ouverture d'une page (jamais Supabase,
        jamais la requête HEAD de checkForUpdate()), ne garde AUCUN cache, et la détection de nouvelle
        version du CRM marche toujours (bannière si on tape, rechargement sinon) ;
     4. une page jamais périmée : GitHub Pages sert index.html avec `max-age=600` ; le serveur de ce
        test fait pareil, et la nouvelle version s'affiche à la réouverture (un témoin SANS service
        worker montre que, sinon, l'ancienne page ressortirait du cache) ;
     5. hors ligne : une page « Pas de connexion », jamais le CRM lui-même (sans la bibliothèque
        Supabase, le CRM s'ouvre en mode « local » et une modification y serait perdue) ;
     6. le bloc « Application » des Réglages : bouton avec l'invite RÉELLE de Chrome, refus visible,
        installation acceptée, échec visible, déjà installé, mode d'emploi iPhone, navigateur sans
        installation, et des Réglages qui s'ouvrent même si ce bloc plante.

   Se lance SEUL : il démarre ses propres serveurs (ports libres, jamais 8899/8902) et lance Chromium
   avec un profil jetable NON privé — un contexte ordinaire de Playwright est « navigation privée » pour
   Chrome (erreur `in-incognito`) et fausserait la mesure d'installabilité.

   Lancer :  node tests/pwa.test.mjs        (une dizaine de secondes)
*/
import { chromium } from 'playwright';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CHROMIUM = '/opt/pw-browsers/chromium';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };
const info = (n, d = '') => console.log('  INFO  ' + n + (d ? ' — ' + d : ''));
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const lire = (chemin) => readFileSync(join(RACINE, chemin));
const garde = setTimeout(() => { console.log('\nTEMPS DÉPASSÉ (4 min) : test arrêté'); process.exit(2); }, 240000);

/* ------------------------------------------------------------------------------------------------
   1. LES FICHIERS
   ------------------------------------------------------------------------------------------------ */
console.log('\n--- 1. Les fichiers ---');
const HEX = /^#[0-9a-fA-F]{6}$/;
const html = lire('index.html').toString('utf8');
const tete = html.slice(0, html.indexOf('<style>'));          // le <head> avant la feuille de style
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

let manifeste = null;
try { manifeste = JSON.parse(lire('manifest.webmanifest').toString('utf8')); check('manifest.webmanifest est un JSON valide', true); }
catch (e) { check('manifest.webmanifest est un JSON valide', false, e.message); console.log('\n===== APPLICATION INSTALLABLE : arrêt, pas de manifeste lisible ====='); process.exit(1); }

check('Manifeste : un nom, et un nom court de 12 caractères au plus (libellé sous l’icône)',
  typeof manifeste.name === 'string' && manifeste.name.length > 0 && typeof manifeste.short_name === 'string' && manifeste.short_name.length > 0 && manifeste.short_name.length <= 12,
  manifeste.name + ' / ' + manifeste.short_name + ' (' + (manifeste.short_name || '').length + ' car.)');
check('Manifeste : id = "/Melissa-Nabet/" (chemin du CRM en ligne = ce que Chrome recommande ; 16 oct. 2026 : « melissa-nabet-crm » tombait sur /melissa-nabet-crm, HORS du CRM, et l\'icône créée sur Android ne s\'ouvrait pas)',
  manifeste.id === '/Melissa-Nabet/', manifeste.id);
check('Manifeste : start_url et scope sont RELATIFS ("./") — le CRM vit sous /Melissa-Nabet/ en ligne',
  manifeste.start_url === './' && manifeste.scope === './', manifeste.start_url + ' / ' + manifeste.scope);
check('Manifeste : display « standalone » (fenêtre à part, sans barre d’adresse), langue fr',
  manifeste.display === 'standalone' && manifeste.lang === 'fr');
check('Manifeste : couleurs de thème et de fond valides', HEX.test(manifeste.theme_color) && HEX.test(manifeste.background_color),
  manifeste.theme_color + ' / ' + manifeste.background_color);

const lireTaillePng = (chemin) => {
  const b = lire(chemin);
  const signature = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { signature, w: b.readUInt32BE(16), h: b.readUInt32BE(20), typeCouleur: b[25] };
};
const icones = Array.isArray(manifeste.icons) ? manifeste.icons : [];
const a = (taille, but) => icones.find((i) => i.sizes === taille && (i.purpose || 'any') === but);
check('Manifeste : icônes 192 et 512 (purpose any) + une 512 maskable, séparées (jamais "any maskable")',
  !!a('192x192', 'any') && !!a('512x512', 'any') && !!a('512x512', 'maskable') && !icones.some((i) => /any\s+maskable|maskable\s+any/.test(i.purpose || '')));
check('Manifeste : chaque icône est RELATIVE (pas de / initial, pas d’adresse complète)', icones.length > 0 && icones.every((i) => !/^(\/|[a-z]+:)/i.test(i.src)),
  icones.map((i) => i.src).join(', '));
for (const i of icones) {
  let t = null;
  try { t = lireTaillePng(i.src); } catch (e) { /* fichier absent */ }
  const [w, h] = (i.sizes || '0x0').split('x').map(Number);
  check('Icône ' + i.src + ' : un vrai PNG de ' + i.sizes + ', pleine (sans transparence)',
    !!t && t.signature && t.w === w && t.h === h && t.typeCouleur === 2, t ? (t.w + 'x' + t.h + ', type de couleur ' + t.typeCouleur) : 'fichier absent');
}
let tAp = null; try { tAp = lireTaillePng('icons/apple-touch-icon.png'); } catch (e) { /* absent */ }
check('Icône iPhone icons/apple-touch-icon.png : PNG 180x180 pleine', !!tAp && tAp.signature && tAp.w === 180 && tAp.h === 180 && tAp.typeCouleur === 2);

check('index.html : <link rel="manifest" href="manifest.webmanifest"> (relatif)', /<link rel="manifest" href="manifest\.webmanifest">/.test(tete));
check('index.html : theme-color = celui du manifeste', new RegExp('<meta name="theme-color" content="' + manifeste.theme_color + '">', 'i').test(tete), manifeste.theme_color);
check('index.html : apple-touch-icon pointe sur l’icône 180 (relatif)', /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/.test(tete));
check('index.html : métadonnées « apple-mobile-web-app » (+ mobile-web-app-capable)',
  /<meta name="apple-mobile-web-app-capable" content="yes">/.test(tete) && /<meta name="apple-mobile-web-app-title" content="[^"]+">/.test(tete)
  && /<meta name="apple-mobile-web-app-status-bar-style" content="[^"]+">/.test(tete) && /<meta name="mobile-web-app-capable" content="yes">/.test(tete));
check('index.html : la balise viewport d’origine est intacte', tete.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'));
check('index.html : l’enregistrement du service worker est relatif, protégé (try/catch, https ou localhost seulement)',
  /navigator\.serviceWorker\.register\('sw\.js'/.test(tete) && /isSecureContext/.test(tete) && /try\{[\s\S]*register\('sw\.js'[\s\S]*\}catch\(e\)\{\}/.test(tete));
check('index.html : l’invite d’installation est écoutée AVANT la bibliothèque Supabase (sinon elle serait perdue)',
  tete.indexOf("addEventListener('beforeinstallprompt'") > 0 && tete.indexOf("addEventListener('beforeinstallprompt'") < tete.indexOf('cdn.jsdelivr.net'));

const sw = lire('sw.js').toString('utf8');
const swCode = sansCommentaires(sw);
check('sw.js : un numéro de version, pour que le navigateur remplace l’ancien', /const VERSION = '[^']+';/.test(sw));
check('sw.js : écoute « fetch » (Chrome l’exige pour proposer l’installation) et ne traite que l’ouverture d’une page',
  /addEventListener\('fetch'/.test(swCode) && /mode !== 'navigate'/.test(swCode));
check('sw.js : AUCUN cache (ni CacheStorage, ni copie de données) — le service worker du cockpit partage ce domaine et en efface les caches',
  !/\bcaches\b/.test(swCode) && !/\.(addAll|put)\(/.test(swCode));
check('sw.js : ne cite ni Supabase ni aucune adresse d’un autre site', !/supabase/i.test(swCode) && !/https?:\/\//.test(swCode));

/* ------------------------------------------------------------------------------------------------
   Serveur de test : sert le dépôt comme GitHub Pages (cache-control max-age=600, ETag, 304, HEAD),
   sous un préfixe ('/' en local, '/Melissa-Nabet/' en ligne). Sans le dossier du site vitrine, sans
   .git, sans node_modules : seulement ce que le CRM sert vraiment.
   ------------------------------------------------------------------------------------------------ */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
/* Comme le workflow de GitHub Pages : tout le dépôt est servi, sauf le site vitrine (retiré de ce qui est publié)
   et ce qui n'est jamais en ligne (.git, .github, .claude, node_modules). Une liste fermée de fichiers cassait ce
   test dès que le CRM en réclamait un de plus (i18n.js, le 14 oct. 2026). */
const JAMAIS_SERVI = /^(\.git|\.github|\.claude|node_modules|site-vitrine)(\/|$)/;
const SERVIS = (chemin) => {
  const absolu = resolve(RACINE, chemin);
  return absolu.startsWith(RACINE + sep) && !JAMAIS_SERVI.test(chemin) && existsSync(absolu) && statSync(absolu).isFile();
};

function creerServeur(prefixe) {
  const etat = { version: 1, sansBibliotheque: true };    // `version` : marque inscrite dans la page ; `sansBibliotheque` : retire l'adresse du CDN (hermétique : pas d'internet)
  const journal = [];
  const serveur = http.createServer((req, rep) => {
    const chemin = decodeURIComponent(req.url.split('?')[0]);
    const relatif = chemin.startsWith(prefixe) ? chemin.slice(prefixe.length) || 'index.html' : null;
    const cible = relatif === '' ? 'index.html' : relatif;
    journal.push({ methode: req.method, chemin: cible || chemin, conditionnelle: !!req.headers['if-none-match'] });
    if (cible === null || !SERVIS(cible)) { rep.writeHead(404, { 'content-type': 'text/plain' }); rep.end('introuvable'); return; }
    let corps = readFileSync(join(RACINE, cible));
    if (cible === 'index.html') {
      let h = corps.toString('utf8')
        .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
        .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, '');
      if (etat.sansBibliotheque) h = h.replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^>]*><\/script>\n?/, '');
      corps = Buffer.from(h.replace('<head>', '<head>\n<meta name="test-version" content="' + etat.version + '">'), 'utf8');
    }
    const etag = '"' + createHash('sha1').update(corps).digest('hex').slice(0, 16) + '"';
    const entetes = { 'content-type': TYPES[extname(cible)] || 'application/octet-stream', 'cache-control': 'max-age=600', etag, 'last-modified': statSync(join(RACINE, cible)).mtime.toUTCString() };
    if (req.headers['if-none-match'] === etag) { rep.writeHead(304, entetes); rep.end(); return; }
    rep.writeHead(200, { ...entetes, 'content-length': corps.length });
    rep.end(req.method === 'HEAD' ? undefined : corps);
  });
  let port = 0;
  const sortie = {
    etat, journal,
    get url() { return 'http://127.0.0.1:' + port + prefixe; },
    get origine() { return 'http://127.0.0.1:' + port; },
    demarrer: () => new Promise((r) => serveur.listen(port, '127.0.0.1', () => { port = serveur.address().port; r(); })),
    arreter: () => new Promise((r) => { serveur.close(() => r()); serveur.closeAllConnections(); }),
  };
  return sortie;
}

const PROFILS = [];
const OUVERTS = [];
async function ouvrir(options = {}) {
  const profil = mkdtempSync(join(tmpdir(), 'mn-pwa-'));
  PROFILS.push(profil);
  const ctx = await chromium.launchPersistentContext(profil, { executablePath: CHROMIUM, viewport: { width: 390, height: 844 }, ...options });
  OUVERTS.push(ctx);
  const page = ctx.pages()[0] || await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push('pageerror : ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console : ' + m.text()); });
  return { ctx, page, erreurs };
}

// Fausse bibliothèque Supabase (le « serveur » vit dans le localStorage), pour voir la synchro démarrer.
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const FAUSSE_BIBLIOTHEQUE = `
window.supabase = { createClient: function () {
  var lire = function () { return JSON.parse(localStorage.getItem('__faux_serveur') || '[]'); };
  var session = { access_token: 't', user: { id: 'u1', email: 'melissa@test' } };
  var ch = { on: function () { return ch; }, subscribe: function (cb) { setTimeout(function () { cb && cb('SUBSCRIBED'); }, 0); return ch; } };
  return {
    auth: { getSession: async function () { return { data: { session: session } }; }, onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; }, signOut: async function () { return {}; }, signInWithPassword: async function () { return {}; } },
    from: function () { return { select: function () { return Promise.resolve({ data: lire(), error: null }); }, upsert: function () { return Promise.resolve({ error: null }); }, delete: function () { return { in: function () { return Promise.resolve({ error: null }); }, eq: function () { return Promise.resolve({ error: null }); } }; } }; },
    channel: function () { return ch; }, removeChannel: function () {},
    storage: { from: function () { return { upload: async function () { return { error: null }; }, download: async function () { return { data: null, error: { message: 'Object not found', statusCode: '404' } }; }, remove: async function () { return { error: null }; }, list: async function () { return { data: [], error: null }; } }; } },
  };
} };`;

const rgbDe = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexDe = (rgba) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgba || ''); return m ? '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('') : null; };
async function erreursInstallabilite(cdp, delai = 10000) {
  const fin = Date.now() + delai; let liste;
  do {
    liste = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map((e) => e.errorId);
    if (!liste.length) break;
    await attendre(400);
  } while (Date.now() < fin);
  return liste;
}
async function serviceWorkerPret(page) {
  return page.evaluate(async () => {
    const pret = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
    if (!pret) return null;
    for (let t = 0; t < 40 && !navigator.serviceWorker.controller; t++) await new Promise((r) => setTimeout(r, 100));
    return { scope: pret.scope, etat: pret.active && pret.active.state, script: pret.active && pret.active.scriptURL, controle: !!navigator.serviceWorker.controller };
  });
}
const versionVue = (page) => page.evaluate(() => { const m = document.querySelector('meta[name="test-version"]'); return m ? m.content : null; });

/* ------------------------------------------------------------------------------------------------
   2 à 6. DANS CHROMIUM, à la racine puis sous /Melissa-Nabet/
   ------------------------------------------------------------------------------------------------ */
const racine = creerServeur('/');
const sousChemin = creerServeur('/Melissa-Nabet/');
await racine.demarrer();
await sousChemin.demarrer();

let A = null, cdpA = null, B = null;
/* Chaque partie est rejouée à part : si l'une plante, les autres sont quand même vérifiées et le rapport dit laquelle. */
async function tenter(nom, corps) {
  try { await corps(); }
  catch (e) { check(nom + ' : le parcours a pu aller au bout', false, e && e.message ? e.message.split('\n')[0].slice(0, 200) : String(e)); }
}

try {
  await tenter('Installabilité et icônes, à la racine', async () => {
    /* ============ A. À la racine (comme en local) : installabilité, service worker, icônes ============ */
    console.log('\n--- 2. Chromium dit que la page est installable (à la racine) ---');
    A = await ouvrir();
    cdpA = await A.ctx.newCDPSession(A.page);
    await A.page.goto(racine.url, { waitUntil: 'load' });
    const swA = await serviceWorkerPret(A.page);
    check('Le service worker s’enregistre, s’active et prend la main sur la page', !!swA && swA.etat === 'activated' && swA.controle, JSON.stringify(swA));
    check('Son périmètre est TOUT le CRM (adresse de la page, pas un sous-dossier)', !!swA && swA.scope === racine.url && swA.script === racine.url + 'sw.js', swA && swA.scope);

    const listeA = await erreursInstallabilite(cdpA);
    check('Chromium ne signale AUCUNE erreur d’installabilité (Page.getInstallabilityErrors = [])', listeA.length === 0, '[' + listeA.join(', ') + '] — avant ce chantier, sur main : [no-manifest]');
    const mA = await cdpA.send('Page.getAppManifest');
    check('Chromium lit le manifeste sans le moindre avertissement', Array.isArray(mA.errors) && mA.errors.length === 0 && mA.url === racine.url + 'manifest.webmanifest', JSON.stringify(mA.errors));
    const mf = mA.manifest || {};
    check('Adresses résolues par Chromium : démarrage et périmètre = la page elle-même',
      mf.startUrl === racine.url && mf.scope === racine.url, mf.startUrl + ' / ' + mf.scope);
    check('Chromium voit « standalone » et les couleurs du manifeste',
      /standalone/i.test(mf.display || '') && hexDe(mf.themeColor) === manifeste.theme_color.toLowerCase() && hexDe(mf.backgroundColor) === manifeste.background_color.toLowerCase(),
      mf.display + ' ' + hexDe(mf.themeColor) + ' ' + hexDe(mf.backgroundColor));
    check('Chromium voit les trois icônes, à des adresses qui existent', Array.isArray(mf.icons) && mf.icons.length === 3, JSON.stringify((mf.icons || []).map((i) => i.url.replace(racine.url, ''))));
    const idA = await cdpA.send('Page.getAppId').catch(() => ({}));
    check('Identité de l’application : le chemin du CRM en ligne, distincte des autres sites de ce domaine (cockpit…)',
      mf.id === racine.origine + '/Melissa-Nabet/' && idA.appId === mf.id, mf.id);

    // Icônes : lues par le navigateur, pixel par pixel.
    const fond = rgbDe(manifeste.background_color);
    for (const i of icones) {
      const m = await A.page.evaluate(async ({ src, fond }) => {
        const blob = await (await fetch(src)).blob();
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        const { data, width: w, height: h } = g.getImageData(0, 0, c.width, c.height);
        const proche = (k) => Math.abs(data[k] - fond[0]) + Math.abs(data[k + 1] - fond[1]) + Math.abs(data[k + 2] - fond[2]) < 24;
        const bords = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [w >> 1, h - 1], [0, h >> 1], [w - 1, h >> 1]].map(([x, y]) => proche((y * w + x) * 4));
        let encre = 0, rayon = 0, transparents = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const k = (y * w + x) * 4;
          if (data[k + 3] < 255) transparents++;
          if (!proche(k)) { encre++; rayon = Math.max(rayon, Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2)); }
        }
        return { w, h, bordsAuFond: bords.every(Boolean), encre: encre / (w * h), rayon: rayon / w, transparents };
      }, { src: new URL(i.src, racine.url).href, fond });
      const maskable = i.purpose === 'maskable';
      check('Icône ' + i.src + ' : fond = background_color du manifeste jusque dans les coins, monogramme présent' + (maskable ? ', tout le dessin dans la zone sûre (cercle de 40 % de la largeur)' : ''),
        m.bordsAuFond && m.transparents === 0 && m.encre > 0.01 && m.encre < 0.4 && (!maskable || m.rayon <= 0.40),
        'dessin = ' + (m.encre * 100).toFixed(1) + ' % de l’icône, point le plus éloigné du centre = ' + (m.rayon * 100).toFixed(1) + ' % de la largeur');
    }
  });

  await tenter('Le service worker ne gêne rien', async () => {
    if (!A) throw new Error('la page de la section précédente manque');
    /* ============ 3. Le service worker ne gêne rien ============ */
    console.log('\n--- 3. Le service worker ne gêne rien ---');
    const reponses = [];
    A.page.on('response', (r) => reponses.push({ url: r.url(), sw: r.fromServiceWorker(), type: r.request().resourceType(), methode: r.request().method(), statut: r.status() }));
    racine.journal.length = 0;
    await A.page.reload({ waitUntil: 'load' });
    await A.page.evaluate(() => fetch(location.pathname, { method: 'HEAD', cache: 'no-store' }));   // ce que fait checkForUpdate()
    await A.page.evaluate(() => new Promise((fin) => { const im = new Image(); im.onload = im.onerror = fin; im.src = 'favicon.png?essai=' + Date.now(); }));
    await A.page.evaluate(() => fetch('manifest.webmanifest', { cache: 'no-store' }).then((r) => r.text()));
    await A.page.route('https://njaamykxnvohoesrtpvv.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[{"ok":true}]' }));
    const autreSite = await A.page.evaluate(() => fetch('https://njaamykxnvohoesrtpvv.supabase.co/rest/v1/app_data').then((r) => r.json()).catch((e) => 'ECHEC ' + e));
    const parSw = reponses.filter((r) => r.sw);
    check('Seule l’ouverture de la page passe par le service worker (aucun script, image, appel Supabase, HEAD de checkForUpdate)',
      parSw.length >= 1 && parSw.every((r) => r.type === 'document') && reponses.some((r) => r.methode === 'HEAD' && !r.sw) && reponses.some((r) => r.type === 'image' && !r.sw),
      parSw.length + ' réponse(s) par le service worker : ' + parSw.map((r) => r.type).join(', ') + ' ; ' + reponses.filter((r) => !r.sw).length + ' autres, directes');
    check('Un appel vers un autre site (Supabase) arrive intact, sans le service worker', JSON.stringify(autreSite) === '[{"ok":true}]' && reponses.some((r) => /supabase\.co/.test(r.url) && !r.sw), JSON.stringify(autreSite));
    check('La requête HEAD de la détection de version atteint bien le serveur', racine.journal.some((j) => j.methode === 'HEAD' && j.chemin === 'index.html'));
    check('Aucun cache : le service worker ne garde ni page, ni image, ni donnée', (await A.page.evaluate(() => caches.keys())).length === 0);

    // La synchro du CRM démarre comme avant (fausse bibliothèque Supabase, serveur = « Dupont »).
    racine.etat.sansBibliotheque = false;
    await A.page.route(CDN, (r) => r.fulfill({ contentType: 'application/javascript', body: FAUSSE_BIBLIOTHEQUE }));
    await A.page.evaluate(() => localStorage.setItem('__faux_serveur', JSON.stringify([{ id: 'c1', kind: 'client', data: { id: 'c1', name: 'Dupont', statut: 'en_cours' } }])));
    await A.page.reload({ waitUntil: 'load' });
    await A.page.waitForFunction(() => typeof cloudReady !== 'undefined' && cloudReady === true, null, { timeout: 8000 }).catch(() => {});
    const synchro = await A.page.evaluate(() => ({ prete: cloudReady, badge: (document.getElementById('sync-badge') || {}).textContent, clients: clients.map((c) => c.name), controle: !!navigator.serviceWorker.controller }));
    check('Avec le service worker actif, la synchro du CRM démarre comme avant (« synchronisé », fiches du serveur chargées)',
      synchro.controle && synchro.prete && /synchronisé/.test(synchro.badge) && synchro.clients.join() === 'Dupont', JSON.stringify(synchro));
    racine.etat.sansBibliotheque = true;
    await A.page.unrouteAll({ behavior: 'ignoreErrors' });
    await A.page.evaluate(() => localStorage.removeItem('__faux_serveur'));
  });

  await tenter('Le bloc Application des Réglages', async () => {
    if (!A) throw new Error('la page de la section précédente manque');
    /* ============ 6. Le bloc « Application » des Réglages ============ */
    console.log('\n--- 6. Le bloc « Application » des Réglages ---');
    const bloc = () => A.page.evaluate(() => { const b = document.getElementById('inst-bloc'); return b ? { etat: b.dataset.etat, texte: b.innerText.replace(/\s+/g, ' ').trim(), bouton: !!b.querySelector('button'), desactive: !!(b.querySelector('button') || {}).disabled } : null; });
    const ouvrirReglages = async () => { await A.page.evaluate(() => { closeModal(); openSettingsPanel(); }); await A.page.waitForSelector('#inst-bloc', { timeout: 3000 }).catch(() => {}); };

    // Une invite RÉELLE de Chrome (pas une imitation) : sur une page installable, Chrome l'envoie tout seul.
    await A.page.goto(racine.url, { waitUntil: 'load' });
    await A.page.waitForFunction(() => !!(window.mnInstall && window.mnInstall.invite), null, { timeout: 15000 }).catch(() => {});
    check('L’invite d’installation RÉELLE de Chrome est captée dès son arrivée', await A.page.evaluate(() => !!window.mnInstall.invite));
    await ouvrirReglages();
    let b = await bloc();
    check('Réglages › Application : la section existe, entre « Raccourcis » et les boutons du bas',
      !!b && await A.page.evaluate(() => { const t = document.getElementById('modal').innerHTML; return t.indexOf('Raccourcis') < t.indexOf('id="inst-bloc"') && t.indexOf('id="inst-bloc"') < t.indexOf('Tout réinitialiser'); }));
    check('Avec l’invite de Chrome : un bouton « Installer l’application »', !!b && b.etat === 'invite' && b.bouton && /Installer l’application/.test(b.texte), b && b.texte);
    const textes = [b && b.texte];
    await A.page.locator('#inst-bloc button').click();
    await A.page.waitForFunction(() => !window.mnInstall.enCours, null, { timeout: 8000 }).catch(() => {});
    await A.page.waitForFunction(() => !!window.mnInstall.invite, null, { timeout: 4000 }).catch(() => {});   // Chrome renvoie une invite juste après un refus
    b = await bloc();
    check('Le refus (ici Chrome sans écran répond « refusé ») est VISIBLE : « Installation annulée. », et le bouton (ou le mode d’emploi du menu) reste là',
      !!b && /Installation annulée\./.test(b.texte) && ((b.etat === 'invite' && b.bouton && !b.desactive) || b.etat === 'menu'), b && b.texte);

    await ouvrirReglages();
    b = await bloc();
    check('Rouvrir les Réglages efface l’ancienne réponse (« Installation annulée. » ne reste pas affichée)', !!b && !/Installation annulée/.test(b.texte), b && b.texte);

    // Chrome n'est pas maître de l'issue : on imite ensuite ses réponses pour les autres cas.
    const imiterInvite = (issue) => A.page.evaluate((issue) => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      window.__appels = 0;
      e.prompt = async () => { window.__appels++; if (issue === 'echec') throw new Error('boum'); };
      e.userChoice = Promise.resolve({ outcome: issue === 'accepte' ? 'accepted' : 'dismissed', platform: issue === 'accepte' ? 'web' : '' });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    }, issue);
    check('La mini-bannière automatique de Chrome est retenue (preventDefault), l’invite sert au bouton', await imiterInvite('refuse'));
    b = await bloc();
    check('Une nouvelle invite fait revenir le bouton tout de suite, sans fermer les Réglages', !!b && b.etat === 'invite' && b.bouton);
    await imiterInvite('echec');
    await A.page.locator('#inst-bloc button').click();
    await A.page.waitForFunction(() => !window.mnInstall.enCours, null, { timeout: 4000 }).catch(() => {});
    b = await bloc();
    check('Un échec de l’installation est VISIBLE, en rouge, avec la marche à suivre — sans erreur dans la page',
      !!b && /Installation impossible \(boum\)/.test(b.texte) && /menu du navigateur/.test(b.texte)
      && await A.page.evaluate(() => !!document.querySelector('#inst-bloc .inst-msg.err')) && !A.erreurs.some((e) => /boum/.test(e)), b && b.texte);
    await imiterInvite('accepte');
    await A.page.locator('#inst-bloc button').click();
    await A.page.waitForFunction(() => !window.mnInstall.enCours, null, { timeout: 4000 }).catch(() => {});
    b = await bloc();
    check('Installation acceptée : « Application installée ✓ », plus de bouton, et un message à l’écran',
      !!b && b.etat === 'installee' && !b.bouton && /Application installée ✓/.test(b.texte) && /Ouvre-la depuis son icône/.test(b.texte)
      && /Application installée ✓/.test(await A.page.evaluate(() => document.getElementById('toast').textContent))
      && (await A.page.evaluate(() => window.__appels)) === 1, b && b.texte);    // l'invite n'a servi qu'une fois

    // Cas décidés par le navigateur : table (la décision est une fonction pure).
    const table = await A.page.evaluate(() => {
      const e = (o) => etatInstallation(Object.assign({ application: false, installee: false, invite: false, ios: false, chrome: false }, o));
      return { application: e({ application: true, invite: true, ios: true, chrome: true }), evenement: e({ installee: true, invite: true }), invite: e({ invite: true, chrome: true, ios: true }), ios: e({ ios: true, chrome: true }), menu: e({ chrome: true }), rien: e({}) };
    });
    check('Un navigateur Chrome sans invite → mode d’emploi du menu ; Safari iPhone → Partager ; Firefox → il ne sait pas ; déjà installé → rien à faire',
      JSON.stringify(table) === JSON.stringify({ application: 'installee', evenement: 'installee', invite: 'invite', ios: 'ios', menu: 'menu', rien: 'indisponible' }), JSON.stringify(table));

    // Chaque cas, VU dans les Réglages (on rejoue l'environnement du navigateur).
    const voir = async (preparer) => {
      await A.page.evaluate(preparer);
      await ouvrirReglages();
      return bloc();
    };
    b = await voir(() => { window.mnInstall.installee = false; window.mnInstall.invite = null; });
    textes.push(b && b.texte);
    check('Chrome sans invite (déjà refusée, ou pas encore envoyée) : les deux gestes du menu, sans bouton',
      !!b && b.etat === 'menu' && !b.bouton && /Installer l’application/.test(b.texte) && /Ajouter à l’écran d’accueil/.test(b.texte) && /icône d’installation/.test(b.texte), b && b.texte);
    b = await voir(() => { Object.defineProperty(navigator, 'standalone', { value: false, configurable: true }); });
    textes.push(b && b.texte);
    check('Safari sur iPhone/iPad : « Partager » puis « Sur l’écran d’accueil », sans bouton', !!b && b.etat === 'ios' && !b.bouton && /Partager/.test(b.texte) && /Sur l’écran d’accueil/.test(b.texte), b && b.texte);
    b = await voir(() => { Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }); });
    textes.push(b && b.texte);
    check('CRM ouvert depuis l’écran d’accueil (iPhone) : « Application installée ✓ », rien d’autre à faire', !!b && b.etat === 'installee' && !b.bouton && /Tu utilises déjà le CRM en mode application/.test(b.texte), b && b.texte);
    b = await voir(() => { delete navigator.standalone; const mm = window.matchMedia.bind(window); window.__mm = mm; window.matchMedia = (q) => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q); });
    textes.push(b && b.texte);
    check('CRM ouvert comme application installée (display-mode: standalone) : « Application installée ✓ »', !!b && b.etat === 'installee' && !b.bouton && /Tu utilises déjà/.test(b.texte), b && b.texte);
    await A.page.evaluate(() => { window.matchMedia = window.__mm; });

    // Même chose, interface réglée en ANGLAIS sur l'appareil (moteur de langue de i18n.js) : chaque phrase du bloc a sa traduction.
    await A.page.evaluate(() => setUiLang('en'));
    b = await voir(() => { window.mnInstall.installee = false; window.mnInstall.invite = null; });
    check('En anglais — Chrome sans invite : « Install app », « Add to Home screen », icône d’installation',
      !!b && b.etat === 'menu' && /Install app/.test(b.texte) && /Add to Home screen/.test(b.texte) && /install icon/.test(b.texte), b && b.texte);
    b = await voir(() => { Object.defineProperty(navigator, 'standalone', { value: false, configurable: true }); });
    check('En anglais — Safari sur iPhone/iPad : « Share » puis « Add to Home Screen »', !!b && b.etat === 'ios' && /Share icon/.test(b.texte) && /Add to Home Screen/.test(b.texte), b && b.texte);
    b = await voir(() => { Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }); });
    check('En anglais — déjà installé : « App installed ✓ »', !!b && b.etat === 'installee' && /App installed ✓/.test(b.texte) && /You are already using the CRM as an app/.test(b.texte), b && b.texte);
    await A.page.evaluate(() => { delete navigator.standalone; });
    await imiterInvite('refuse');
    await ouvrirReglages();
    b = await bloc();
    check('En anglais — avec l’invite : le bouton « Install the app »', !!b && b.etat === 'invite' && /Install the app/.test(b.texte), b && b.texte);
    await A.page.locator('#inst-bloc button').click();
    await A.page.waitForFunction(() => !window.mnInstall.enCours, null, { timeout: 4000 }).catch(() => {});
    b = await bloc();
    check('En anglais — le refus est visible : « Installation cancelled. »', !!b && /Installation cancelled\./.test(b.texte), b && b.texte);
    await imiterInvite('echec');
    await A.page.locator('#inst-bloc button').click();
    await A.page.waitForFunction(() => !window.mnInstall.enCours, null, { timeout: 4000 }).catch(() => {});
    b = await bloc();
    check('En anglais — l’échec est visible, avec le message d’erreur du navigateur au milieu de la phrase', !!b && /Installation failed \(boum\)\. Try from the browser menu\./.test(b.texte), b && b.texte);
    const restes = await A.page.evaluate(() => { const bt = document.getElementById('inst-bloc').innerText.replace(/\s+/g, ' '); return window.__trManquants().filter((t) => bt.includes(t)); });
    check('En anglais — aucun texte français ne reste dans le bloc (__trManquants, l’outil de i18n.js)', restes.length === 0, JSON.stringify(restes));
    await A.page.evaluate(() => { setUiLang('fr'); window.mnInstall.msg = null; window.mnInstall.invite = null; });
    // Navigateur qui ne sait pas installer : on lui retire ce qui prouve qu'il le sait (propriété d'instance).
    const sansInstall = await A.page.evaluate(() => {
      const avait = Object.getOwnPropertyDescriptor(window, 'onbeforeinstallprompt');
      if (avait) delete window.onbeforeinstallprompt;
      window.mnInstall.installee = false; window.mnInstall.invite = null;
      return { avait: !!avait, encore: 'onbeforeinstallprompt' in window };
    });
    if (!sansInstall.encore) {
      await ouvrirReglages(); b = await bloc(); textes.push(b && b.texte);
      check('Navigateur qui ne sait pas installer (Firefox…) : une phrase claire, et où aller', !!b && b.etat === 'indisponible' && !b.bouton && /ne sait pas installer/.test(b.texte) && /Chrome/.test(b.texte) && /Safari/.test(b.texte), b && b.texte);
    } else {
      info('Cas « navigateur sans installation » : la propriété du navigateur ne se retire pas ici ; couvert par la table ci-dessus');
    }
    check('Mots simples : aucun jargon dans les phrases lues par Melissa (PWA, service worker, manifeste, cache…)',
      textes.length >= 4 && textes.every((t) => t && !/\bPWA\b|service worker|manifest|beforeinstallprompt|WebAPK|\bcache\b|standalone|\bprompt\b/i.test(t)), textes.length + ' phrases lues');

    // Les Réglages s'ouvrent même si le bloc plante.
    const secours = await A.page.evaluate(() => {
      const avant = window.lireEnvInstallation;
      window.lireEnvInstallation = () => { throw new Error('panne simulée'); };
      let ouvert = false, texte = '';
      try { closeModal(); openSettingsPanel(); texte = document.getElementById('modal').innerText; ouvert = true; } catch (e) { texte = String(e); }
      window.lireEnvInstallation = avant;
      return { ouvert, enregistrer: /Enregistrer/.test(texte), identite: /identité/i.test(texte), bloc: !!document.getElementById('inst-bloc') };
    });
    check('Si le bloc « Application » plante, les Réglages s’ouvrent quand même (sans lui)', secours.ouvert && secours.enregistrer && secours.identite && !secours.bloc, JSON.stringify(secours));
    const attendues = A.erreurs.filter((e) => /Bloc Application|panne simulée/.test(e));
    const autres = A.erreurs.filter((e) => !/Bloc Application|panne simulée/.test(e));
    check('Aucune erreur JavaScript, aucune erreur de console pendant tout ce parcours (hors la panne simulée ci-dessus)', autres.length === 0 && attendues.length >= 1, autres.length ? autres.slice(0, 3).join(' | ') : attendues.length + ' attendue(s)');
  });

  if (A) await A.ctx.close().catch(() => {});

  await tenter('Installabilité sous /Melissa-Nabet/', async () => {
    /* ============ B. Sous /Melissa-Nabet/ (comme GitHub Pages) : tout doit rester RELATIF ============ */
    console.log('\n--- 2 bis. Même chose sous /Melissa-Nabet/, comme GitHub Pages ---');
    B = await ouvrir();
    const cdpB = await B.ctx.newCDPSession(B.page);
    await B.page.goto(sousChemin.url, { waitUntil: 'load' });
    const swB = await serviceWorkerPret(B.page);
    check('Sous /Melissa-Nabet/ : le service worker prend la main, avec pour périmètre /Melissa-Nabet/ seulement', !!swB && swB.controle && swB.scope === sousChemin.url, JSON.stringify(swB));
    const listeB = await erreursInstallabilite(cdpB);
    check('Sous /Melissa-Nabet/ : Chromium ne signale AUCUNE erreur d’installabilité', listeB.length === 0, '[' + listeB.join(', ') + ']');
    const mB = await cdpB.send('Page.getAppManifest');
    const mfB = mB.manifest || {};
    check('Sous /Melissa-Nabet/ : démarrage et périmètre résolus sur /Melissa-Nabet/, manifeste sans avertissement',
      mfB.startUrl === sousChemin.url && mfB.scope === sousChemin.url && mB.errors.length === 0, mfB.startUrl + ' / ' + mfB.scope);
    const idB = await cdpB.send('Page.getAppId').catch(() => ({}));
    check('Sous /Melissa-Nabet/ : l’identité de l’application est /Melissa-Nabet/ (= scope = start_url = id recommandé par Chrome)',
      mfB.id === sousChemin.url && idB.appId === sousChemin.url && idB.recommendedId === '/Melissa-Nabet/' && mfB.id.startsWith(mfB.scope), mfB.id + ' / recommandé ' + idB.recommendedId);
    const icoB = await B.page.evaluate(async (urls) => Promise.all(urls.map(async (u) => (await fetch(u)).status)), (mfB.icons || []).map((i) => i.url));
    check('Sous /Melissa-Nabet/ : les trois icônes et l’icône iPhone se chargent (aucun chemin absolu caché)',
      icoB.length === 3 && icoB.every((s) => s === 200) && await B.page.evaluate(async () => (await fetch(document.querySelector('link[rel="apple-touch-icon"]').href)).status) === 200, JSON.stringify(icoB));
    check('Sous /Melissa-Nabet/ : rien n’a été demandé à la racine du domaine (le CRM n’y est pas)', !sousChemin.journal.some((j) => j.chemin.startsWith('/')) && sousChemin.journal.length > 4,
      sousChemin.journal.length + ' requêtes, toutes sous /Melissa-Nabet/');
  });

  if (B) await B.ctx.close().catch(() => {});

  await tenter('Une page jamais périmée', async () => {
    /* ============ 4. Une page jamais périmée ============ */
    console.log('\n--- 4. Une page jamais périmée (GitHub Pages : max-age=600) ---');
    racine.etat.sansBibliotheque = true;          // pas de route (elle coupe le cache HTTP du navigateur) : la page ne cite plus le CDN
    async function reouvrir(options) {
      racine.etat.version = 1;
      const X = await ouvrir(options);
      await X.page.goto(racine.url, { waitUntil: 'load' });
      if (!options.serviceWorkers) await serviceWorkerPret(X.page);
      const v1 = await versionVue(X.page);
      racine.etat.version = 2;                    // « mise en ligne » : la page a changé, mais le cache du navigateur la croit bonne 10 minutes
      await X.page.goto('about:blank');           // on QUITTE l'appli, puis on la rouvre (une réouverture, pas un rechargement)
      racine.journal.length = 0;
      await X.page.goto(racine.url, { waitUntil: 'load' });
      const v2 = await versionVue(X.page);
      const demandees = racine.journal.filter((j) => j.methode === 'GET' && j.chemin === 'index.html');
      await X.ctx.close();
      return { v1, v2, demandees };
    }
    const temoin = await reouvrir({ serviceWorkers: 'block' });
    check('Banc d’essai : SANS service worker, le navigateur ressert bien l’ancienne page (sinon ce test ne prouverait rien)', temoin.v1 === '1' && temoin.v2 === '1' && temoin.demandees.length === 0, 'version vue après mise en ligne de la 2 : ' + temoin.v2 + ', requêtes au serveur : ' + temoin.demandees.length);
    const avecSw = await reouvrir({});
    check('AVEC le service worker, la nouvelle version s’affiche dès la réouverture', avecSw.v1 === '1' && avecSw.v2 === '2', 'version vue : ' + avecSw.v2);
    racine.journal.length = 0;
    racine.etat.version = 5;
    const R = await ouvrir();
    await R.page.goto(racine.url, { waitUntil: 'load' });
    await serviceWorkerPret(R.page);
    await R.page.goto('about:blank');
    racine.journal.length = 0;
    await R.page.goto(racine.url, { waitUntil: 'load' });
    const reval = racine.journal.filter((j) => j.methode === 'GET' && j.chemin === 'index.html');
    check('Page inchangée : le navigateur la redemande à chaque ouverture, mais en REVALIDANT (réponse « 304 » de quelques octets, pas 840 Ko)',
      reval.length === 1 && reval[0].conditionnelle === true, JSON.stringify(reval));
    // Ctrl+Maj+R : « recharge sans aucun cache ». Chrome contourne alors le service worker (constaté) : la page doit être redemandée en entier.
    racine.journal.length = 0;
    const cdpR = await R.ctx.newCDPSession(R.page);
    const rechargee = R.page.waitForEvent('load');
    await cdpR.send('Page.reload', { ignoreCache: true });
    await rechargee;
    const dur = racine.journal.filter((j) => j.methode === 'GET' && j.chemin === 'index.html');
    check('Un rechargement « à fond » (Ctrl+Maj+R) redemande la page en entier, sans condition', dur.length >= 1 && dur.every((j) => !j.conditionnelle), JSON.stringify(dur));
    await R.ctx.close();
  });

  await tenter('Détection de nouvelle version', async () => {
    /* ============ 3 bis. La détection de nouvelle version du CRM marche toujours ============ */
    console.log('\n--- 3 bis. La détection de nouvelle version du CRM marche toujours avec le service worker ---');
    const U = await ouvrir();
    racine.etat.version = 6;
    await U.page.goto(racine.url, { waitUntil: 'load' });
    await serviceWorkerPret(U.page);
    await U.page.evaluate(() => checkForUpdate());                        // fixe la version de référence (HEAD)
    racine.etat.version = 7;                                              // une nouvelle version est mise en ligne
    await U.page.evaluate(() => { window.__avant = 'toujours là'; const champ = document.createElement('input'); champ.id = 'champ-essai'; document.body.appendChild(champ); champ.focus(); });
    await U.page.evaluate(() => checkForUpdate());
    await U.page.waitForSelector('#update-bar.show', { timeout: 5000 }).catch(() => {});
    const pendantSaisie = await U.page.evaluate(() => ({ banniere: !!document.querySelector('#update-bar.show'), texte: (document.getElementById('update-bar') || {}).textContent || '', pasRecharge: window.__avant === 'toujours là' }));
    check('Pendant qu’on tape, une nouvelle version affiche la bannière « Recharger maintenant » et ne recharge PAS la page', pendantSaisie.banniere && pendantSaisie.pasRecharge && /Recharger maintenant/.test(pendantSaisie.texte), JSON.stringify(pendantSaisie));
    await U.page.goto('about:blank');
    racine.etat.version = 8;
    await U.page.goto(racine.url, { waitUntil: 'load' });
    await U.page.evaluate(() => checkForUpdate());
    racine.etat.version = 9;
    await U.page.evaluate(() => { checkForUpdate(); });
    await U.page.waitForURL(/_r=\d+/, { timeout: 8000 }).catch(() => {});
    await U.page.waitForLoadState('load');
    const apresRecharge = { v: await versionVue(U.page), adresse: U.page.url() };
    check('Sans saisie en cours, une nouvelle version recharge toute seule, et la page rechargée est la dernière', apresRecharge.v === '9' && /_r=\d+/.test(apresRecharge.adresse), JSON.stringify(apresRecharge));
    const erreursU = U.erreurs.filter((e) => !/Failed to load resource|net::ERR/.test(e));
    check('Aucune erreur JavaScript pendant la détection de nouvelle version', erreursU.length === 0, erreursU.slice(0, 3).join(' | '));
    await U.ctx.close();
  });

  await tenter('Hors ligne', async () => {
    /* ============ 5. Hors ligne ============ */
    console.log('\n--- 5. Hors ligne ---');
    racine.etat.sansBibliotheque = true;
    const H = await ouvrir();
    await H.page.goto(racine.url, { waitUntil: 'load' });
    await serviceWorkerPret(H.page);
    await racine.arreter();                                                // plus aucun serveur : le réseau ne répond pas du tout
    const repHors = await H.page.goto(racine.url, { waitUntil: 'load' });
    const hors = await H.page.evaluate(() => ({ texte: document.body.innerText.replace(/\s+/g, ' ').trim(), titre: document.title, bouton: !!document.getElementById('reessayer'), crm: typeof openSettingsPanel !== 'undefined' || !!document.getElementById('toolbar-brand') || !!document.getElementById('login-overlay'), sw: (document.querySelector('meta[name="service-worker"]') || {}).content }));
    check('Hors ligne : une page « Pas de connexion internet » s’affiche (pas l’écran d’erreur de Chrome), avec un bouton « Réessayer »',
      !!repHors && repHors.status() === 200 && repHors.fromServiceWorker() && /Pas de connexion internet/.test(hors.texte) && hors.bouton && /Réessayer/.test(hors.texte), hors.texte);
    check('Hors ligne : ce n’est PAS le CRM (en mode « local », une modification faite sans connexion serait perdue à la connexion suivante)', hors.crm === false && /^crm-sw-/.test(hors.sw || ''), 'service worker ' + hors.sw);
    check('Hors ligne : toujours aucun cache gardé', (await H.page.evaluate(() => caches.keys())).length === 0);
    await H.page.evaluate(() => localStorage.setItem('mn_ui_lang', 'en'));   // l'interface du CRM est réglée en anglais sur cet appareil
    await H.page.goto(racine.url, { waitUntil: 'load' });
    const horsEn = await H.page.evaluate(() => ({ texte: document.body.innerText.replace(/\s+/g, ' ').trim(), titre: document.title, langue: document.documentElement.lang }));
    check('Hors ligne, interface en anglais : « No internet connection » et « Try again »', /No internet connection/.test(horsEn.texte) && /Try again/.test(horsEn.texte) && horsEn.langue === 'en' && /No connection/.test(horsEn.titre), horsEn.texte);
    await H.page.evaluate(() => localStorage.removeItem('mn_ui_lang'));
    await racine.demarrer();                                               // le réseau revient (même adresse)
    await H.page.locator('#reessayer').click();
    await H.page.waitForFunction(() => typeof openSettingsPanel === 'function', null, { timeout: 8000 }).catch(() => {});
    check('Le réseau revient : « Réessayer » rouvre le CRM', /Générateur de devis/.test(await H.page.title()) && await H.page.evaluate(() => typeof openSettingsPanel === 'function'), await H.page.title());
    const erreursC = H.erreurs.filter((e) => !/Failed to load resource|net::ERR/.test(e));
    check('Aucune erreur JavaScript pendant le parcours hors ligne et le retour du réseau', erreursC.length === 0, erreursC.slice(0, 3).join(' | '));
    await H.ctx.close();
  });

} catch (e) {
  check('Le test a pu aller au bout', false, e && e.stack ? e.stack.split('\n').slice(0, 4).join(' / ') : String(e));
} finally {
  clearTimeout(garde);
  for (const c of OUVERTS) await c.close().catch(() => {});
  await racine.arreter().catch(() => {});
  await sousChemin.arreter().catch(() => {});
  for (const p of PROFILS) { try { rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignoré */ } }
}

console.log('\n===== APPLICATION INSTALLABLE : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach((k) => console.log('  - ' + k));
process.exit(ko.length ? 1 : 0);
