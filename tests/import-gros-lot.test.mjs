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

/* Des photos de téléphone : 4032 × 3024, JPEG, TOUTES DIFFÉRENTES (une scène tirée au
   hasard par photo, graine = numéro). Le même contenu sous cent noms serait aujourd'hui
   refusé à juste titre : ce sont des copies du même fichier. */
await page.evaluate(async () => {
  const W = 4032, H = 3024;
  window.__scene = (graine) => {
    let s = graine * 9301 + 49297; const alea = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, W * alea(), H); g.addColorStop(0, `hsl(${alea() * 360},25%,${55 + alea() * 30}%)`); g.addColorStop(1, `hsl(${alea() * 360},20%,${25 + alea() * 30}%)`);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) { x.fillStyle = `hsl(${alea() * 360},${20 + alea() * 40}%,${15 + alea() * 70}%)`; x.fillRect(alea() * W, alea() * H, (0.1 + alea() * 0.4) * W, (0.1 + alea() * 0.4) * H); }
    return cv;
  };
  window.__fichier = async (cv, nom, echelle = 1, q = 0.9) => {
    let c = cv;
    if (echelle !== 1) { c = document.createElement('canvas'); c.width = Math.round(cv.width * echelle); c.height = Math.round(cv.height * echelle); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height); }
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    if (c !== cv) c.width = c.height = 0;
    return new File([b], nom, { type: 'image/jpeg' });
  };
  window.__lot = async (prefixe, n, depart = 0) => {
    const out = [];
    for (let i = 0; i < n; i++) { const cv = window.__scene(depart + i + 1); out.push(await window.__fichier(cv, `${prefixe}-${String(i + 1).padStart(3, '0')}.jpeg`)); cv.width = cv.height = 0; }
    return out;
  };
  window.__lot100 = await window.__lot('remez', 100);
});

// ── 1. CENT PHOTOS D'UN COUP ──────────────────────────────────────────────────
const t0 = Date.now();
await page.evaluate(async () => { await addPhotosToRealisation(realisations[0], window.__lot100); });
const duree = Math.round((Date.now() - t0) / 1000);
const etat1 = await page.evaluate(() => ({
  photos: realisations[0].photos.length,
  fichiers: [...window.__files.keys()].length,
  bilan: _rzImportReport,
  enCours: !!_rzImport,
  avecPoids: realisations[0].photos.every((p, i) => p.size === window.__lot100[i].size),
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
  await addPhotosToRealisation(realisations[0], [...window.__lot100, ...(await window.__lot('remez-suite', 5, 500))]);
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
  const lot = await window.__lot('pendu', 4, 600);
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
  const lot = await window.__lot('vue', 3, 700);
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
  await addPhotosToProduit(p, await window.__lot('produit', 3, 800));
  return p.photos.length;
});
check('Boutique : 3 photos importées par le même moteur', boutique === 3, String(boutique));

// ── 6. LES DOUBLONS (26 nov. 2026) ──────────────────────────────────────────
// « Je ne sais plus lesquelles sont les mêmes » : une copie exacte est refusée d'office ;
// une photo qui RESSEMBLE (même image réexportée) entre, mais elle est signalée, et
// « Voir les doublons » la présélectionne pour qu'il décide.
const doub = await page.evaluate(async () => {
  showView('realisations');
  newRealisation();
  const r = realisations[realisations.length - 1]; _rzOpenId = r.id;
  const salon = window.__scene(901), cuisine = window.__scene(902);
  const fSalon = await window.__fichier(salon, 'IMG_1001.jpeg');
  const fCuisine = await window.__fichier(cuisine, 'IMG_1002.jpeg');
  const copieExacte = new File([fSalon], 'IMG_1001 copie.jpeg', { type: 'image/jpeg' });   // mêmes octets, autre nom
  await addPhotosToRealisation(r, [fSalon, fCuisine, copieExacte]);
  const apres1 = { n: r.photos.length, bilan: JSON.parse(JSON.stringify({ d: _rzImportReport && _rzImportReport.doublons, r: _rzImportReport && _rzImportReport.ressemblantes })) };
  /* Les photos d'avant le 26 nov. n'ont pas d'empreinte : on en efface une pour vérifier
     qu'elle est recalculée depuis sa vignette avant de comparer. */
  delete r.photos[0].empreinte;
  const reexport = await window.__fichier(salon, 'IMG_1001-export.jpeg', 0.4, 0.6);   // même image, autres octets
  await addPhotosToRealisation(r, [reexport]);
  renderRealisations();
  const voir = [...document.querySelectorAll('#realisations-view button')].find(b => b.textContent === 'Voir les doublons');
  const apres2 = { n: r.photos.length, ress: (_rzImportReport && _rzImportReport.ressemblantes || []).map(x => x.comme), bouton: !!voir, recalculee: !!r.photos[0].empreinte };
  if (voir) voir.click();
  await new Promise(res => setTimeout(res, 300));
  const nouvelle = r.photos[r.photos.length - 1];
  const sel = { mode: _rzSelMode, ids: [..._rzSel], attendu: nouvelle.id, gardeeLaPremiere: !_rzSel.has(r.photos[0].id) };
  rzToggleSelectMode(false);
  return { apres1, apres2, sel };
});
check('une copie exacte du même fichier est refusée d’office, même sous un autre nom',
  doub.apres1.n === 2 && doub.apres1.bilan.d && doub.apres1.bilan.d.length === 1 && doub.apres1.bilan.d[0].comme === 'IMG_1001.jpeg',
  JSON.stringify(doub.apres1));
check('deux photos différentes ne sont pas signalées', !doub.apres1.bilan.r || doub.apres1.bilan.r.length === 0, JSON.stringify(doub.apres1.bilan.r));
check('une ancienne photo sans empreinte reçoit la sienne avant la comparaison', doub.apres2.recalculee);
check('la même image réexportée entre, mais elle est signalée comme ressemblante',
  doub.apres2.n === 3 && doub.apres2.ress.length === 1 && doub.apres2.ress[0] === 'IMG_1001.jpeg', JSON.stringify(doub.apres2));
check('le bilan propose « Voir les doublons »', doub.apres2.bouton);
check('« Voir les doublons » présélectionne la copie, pas l’originale',
  doub.sel.mode && doub.sel.ids.length === 1 && doub.sel.ids[0] === doub.sel.attendu && doub.sel.gardeeLaPremiere, JSON.stringify(doub.sel));

// Le bouton « ⧉ Doublons » de la fiche : rien en double -> il le dit ; sinon il présélectionne.
const bouton = await page.evaluate(async () => {
  const r = realisations[realisations.length - 1];
  window.__toasts = [];
  await rzChercherDoublons(realisations[0]);
  const sansDoublon = window.__toasts.slice();
  rzToggleSelectMode(false);
  renderRealisations();
  const b = [...document.querySelectorAll('#realisations-view button')].find(x => /Doublons/.test(x.textContent));
  if (b) b.click();
  await new Promise(res => setTimeout(res, 400));
  const res = { bouton: !!b, sansDoublon, mode: _rzSelMode, n: _rzSel.size };
  rzToggleSelectMode(false);
  return res;
});
check('« Doublons » sur un projet sans doublon le dit', bouton.sansDoublon.some(m => /Aucune photo en double/.test(m)), bouton.sansDoublon.join(' | '));
check('le bouton « ⧉ Doublons » existe et présélectionne la copie', bouton.bouton && bouton.mode && bouton.n === 1, JSON.stringify(bouton));

check('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
