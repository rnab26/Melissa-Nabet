/* Import d'un GROS lot de photos d'un coup (Réalisations et Boutique).

   Constat du 25 nov. 2026 (Raphaël) : « j'ai tenté d'envoyer 67 photos, il n'y en a que
   5-6 qui ont été envoyées ». Mesuré dans le stockage réel : le 18 nov. à 13:43, sept photos
   pleine définition et six vignettes, en 18 secondes, puis plus rien — l'import s'est arrêté
   ENTRE l'envoi d'une photo et celui de sa vignette, sans erreur enregistrée. Aucun plafond de
   nombre n'existe dans le code : c'est le lot qui s'arrêtait, pas une limite.

   Ce test exige :
   - 100 photos de la taille d'un téléphone (4032 × 3024) entrent d'un seul envoi ;
   - un envoi qui ne répond jamais ne fige plus le lot (délai, nouvel essai, puis refus dit) ;
   - chaque photo entrée est enregistrée aussitôt (une page qui meurt garde ce qui est passé) ;
   - relancer le même lot reprend sans doublon ;
   - l'écran est gardé allumé pendant l'envoi, puis relâché ;
   - la Boutique passe par le même moteur.

   Lancer (serveur sur la racine du dépôt, port 8899) :
     python3 -m http.server 8899 &   puis   node tests/import-gros-lot.test.mjs
*/
import { chromium } from 'playwright';

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (name, pass, detail = '') => {
  (pass ? ok : ko).push(name);
  console.log((pass ? '  OK   ' : '  ECHEC') + ' ' + name + (detail ? ' — ' + detail : ''));
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// --- Faux Supabase : stockage en mémoire, avec des envois qu'on peut faire « pendre ».
await page.evaluate(() => {
  const files = new Map();
  window.__files = files;
  /* Clés dont l'envoi ne répond JAMAIS (toujours), ou seulement au premier essai. */
  window.__pendToujours = new Set();
  window.__pendUneFois = new Set();
  const chain = () => ({ upsert: async () => ({ error: null }), delete: () => chain(), in: async () => ({ error: null }), select: () => chain(), eq: () => chain(), then: r => r({ error: null }) });
  sb = {
    storage: {
      from: () => ({
        upload: (path, blob) => {
          const cle = path.split('/').pop();
          if (window.__pendToujours.has(cle)) return new Promise(() => {});
          if (window.__pendUneFois.has(cle)) { window.__pendUneFois.delete(cle); return new Promise(() => {}); }
          files.set(path, blob);
          return Promise.resolve({ error: null });
        },
        download: async (path) => files.has(path) ? { data: files.get(path), error: null } : { data: null, error: { message: 'Object not found' } },
        remove: async (paths) => { paths.forEach(p => files.delete(p)); return { error: null }; },
        list: async () => ({ data: [], error: null }),
      }),
    },
    from: chain,
  };
  sb.auth = { getSession: async () => ({ data: { session: { access_token: 'jeton-de-test' } } }) };
  sbUser = { id: 'test-user', email: 'test@test' };
  ownerId = 'test-user';
  /* Écran gardé allumé : on compte les demandes et les libérations. */
  window.__ecran = { demandes: 0, liberes: 0 };
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: async () => { window.__ecran.demandes++; return { release: async () => { window.__ecran.liberes++; } }; } },
  });
  /* Chaque enregistrement des réalisations PENDANT un import : combien de photos il porte. */
  window.__sauvegardes = [];
  const setOrig = store.set.bind(store);
  store.set = (k, v) => {
    if (k === K_REAL && _rzImport) window.__sauvegardes.push(v[0] ? v[0].photos.length : 0);
    return setOrig(k, v);
  };
  document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none');
  const o = document.getElementById('login-screen'); if (o) o.style.display = 'none';
});

await page.evaluate(() => { showView('realisations'); newRealisation(); });
await page.waitForTimeout(300);

/* Une photo de téléphone : 4032 × 3024, JPEG. Le même contenu sert à tout le lot (le décodage,
   lui, est refait pour chaque fichier, comme en vrai) ; seuls les noms diffèrent. */
await page.evaluate(async () => {
  const W = 4032, H = 3024;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#b59a7a'); g.addColorStop(1, '#e8ddcc');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { x.fillStyle = `hsl(${i * 6},30%,${40 + i % 30}%)`; x.fillRect((i * 97) % W, (i * 61) % H, 300, 200); }
  window.__jpeg = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
  cv.width = cv.height = 0;
  window.__lot = (prefixe, n) => Array.from({ length: n }, (_, i) => new File([window.__jpeg], `${prefixe}-${String(i + 1).padStart(3, '0')}.jpeg`, { type: 'image/jpeg' }));
});

// ── 1. CENT PHOTOS D'UN COUP ──────────────────────────────────────────────────
const t0 = Date.now();
await page.evaluate(async () => { await addPhotosToRealisation(realisations[0], window.__lot('remez', 100)); });
const duree = Math.round((Date.now() - t0) / 1000);
const etat1 = await page.evaluate(() => ({
  photos: realisations[0].photos.length,
  fichiers: [...window.__files.keys()].length,
  bilan: _rzImportReport,
  enCours: !!_rzImport,
  avecPoids: realisations[0].photos.every(p => p.size === window.__jpeg.size),
}));
check('100 photos importées d’un seul envoi', etat1.photos === 100, etat1.photos + ' photo(s), ' + duree + ' s');
check('200 fichiers envoyés (pleine définition + vignette)', etat1.fichiers === 200, String(etat1.fichiers));
check('aucun refus, import terminé', etat1.bilan === null && !etat1.enCours, JSON.stringify(etat1.bilan));
check('le poids d’origine est noté sur chaque photo (pour reprendre un lot)', etat1.avecPoids);
const sauv = await page.evaluate(() => window.__sauvegardes.slice());
check('chaque photo entrée est enregistrée aussitôt, pas seulement à la fin',
  sauv.length >= 100 && sauv[0] === 1 && sauv[49] === 50,
  sauv.length + ' enregistrement(s) pendant l’import, premiers : ' + sauv.slice(0, 4).join(','));
const ecran = await page.evaluate(() => window.__ecran);
check('l’écran est gardé allumé pendant l’envoi, puis relâché', ecran.demandes === 1 && ecran.liberes === 1, JSON.stringify(ecran));

// ── 2. REPRENDRE LE MÊME LOT : pas de doublon ────────────────────────────────
await page.evaluate(async () => {
  window.__toasts = [];
  const t = window.toast; window.toast = (m) => { window.__toasts.push(m); return t(m); };
  await addPhotosToRealisation(realisations[0], [...window.__lot('remez', 100), ...window.__lot('remez-suite', 5)]);
});
const etat2 = await page.evaluate(() => ({ photos: realisations[0].photos.length, toasts: window.__toasts.slice() }));
check('relancer le même lot n’importe que les nouvelles', etat2.photos === 105, etat2.photos + ' photo(s)');
check('et le dit', etat2.toasts.some(m => /5 photo\(s\) ajoutée\(s\) · 100 déjà présente\(s\)/.test(m)), etat2.toasts.join(' | '));

// ── 3. UN ENVOI QUI NE RÉPOND JAMAIS NE FIGE PLUS LE LOT ─────────────────────
const etat3 = await page.evaluate(async () => {
  photoStore.delaiMs = 400; photoStore.essais = 2;
  const avant = realisations[0].photos.length;
  /* La 2e photo pend une seule fois (le nouvel essai passe) ; la 3e pend toujours. */
  const ids = [];
  const uidOrig = window.uid;
  let n = 0;
  window.uid = () => { const id = uidOrig(); n++; ids.push(id);
    if (n === 2) window.__pendUneFois.add('rp_' + id);
    if (n === 3) window.__pendToujours.add('rp_' + id);
    return id; };
  const lot = window.__lot('pendu', 4);
  const t = Date.now();
  await addPhotosToRealisation(realisations[0], lot);
  window.uid = uidOrig;
  const bloque = 'rp_' + ids[2];
  return {
    ajoutees: realisations[0].photos.length - avant,
    refus: (_rzImportReport && _rzImportReport.refus) || [],
    ms: Date.now() - t,
    restesDuRefus: [...window.__files.keys()].filter(k => k.endsWith(ids[2])).length,
    bloque,
  };
});
check('un envoi qui ne répond pas est retenté, puis le lot continue', etat3.ajoutees === 3, etat3.ajoutees + ' photo(s) sur 4, ' + etat3.ms + ' ms');
check('la photo bloquée est refusée avec sa raison', etat3.refus.length === 1 && /connexion perdue|réseau/.test(etat3.refus[0].why), JSON.stringify(etat3.refus));
check('elle ne laisse aucun fichier orphelin', etat3.restesDuRefus === 0, String(etat3.restesDuRefus));

// ── 4. PENDANT L'ENVOI, L'ÉCRAN LE DIT ───────────────────────────────────────
await page.evaluate(() => { photoStore.delaiMs = 90000; photoStore.essais = 3; window.__pendToujours.clear(); });
const pendant = await page.evaluate(async () => {
  const lot = window.__lot('vue', 3);
  const p = addPhotosToRealisation(realisations[0], lot);
  await new Promise(r => setTimeout(r, 60));
  const box = document.getElementById('rz-import');
  const txt = box ? box.innerText : '';
  await p;
  return txt;
});
check('le bandeau de progression demande de garder la page ouverte', /Laisse cette page ouverte/.test(pendant), pendant.replace(/\s+/g, ' ').slice(0, 120));

// ── 5. LA BOUTIQUE PASSE PAR LE MÊME MOTEUR ──────────────────────────────────
const boutique = await page.evaluate(async () => {
  showView('boutique'); newProduit();
  const p = produits[produits.length - 1];
  await addPhotosToProduit(p, window.__lot('produit', 3));
  return p.photos.length;
});
check('Boutique : 3 photos importées par le même moteur', boutique === 3, String(boutique));

check('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
