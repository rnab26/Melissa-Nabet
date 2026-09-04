import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { execFileSync } from 'child_process';

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (name, pass, detail = '') => {
  (pass ? ok : ko).push(name + (detail ? ' — ' + detail : ''));
  console.log((pass ? '  OK   ' : '  ECHEC') + ' ' + name + (detail ? ' — ' + detail : ''));
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// --- WebGL disponible dans ce navigateur de test ?
const glOk = await page.evaluate(() => {
  const c = document.createElement('canvas');
  return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
});
check('WebGL disponible dans le navigateur de test', glOk);
if (!glOk) { console.log('\nWebGL indisponible : le test ne peut pas valider le rendu.'); await browser.close(); process.exit(1); }

// --- Faux Supabase (stockage en mémoire) pour tester sans compte réel
await page.evaluate(() => {
  const files = new Map();
  window.__files = files;
  const chain = () => ({ upsert: async () => ({ error: null }), delete: () => chain(), in: async () => ({ error: null }), select: () => chain(), eq: () => chain(), then: r => r({ error: null }) });
  sb = {
    storage: {
      from: () => ({
        upload: async (path, blob) => { files.set(path, blob); return { error: null }; },
        download: async (path) => files.has(path) ? { data: files.get(path), error: null } : { data: null, error: { message: 'Object not found', statusCode: '404' } },
        remove: async (paths) => { paths.forEach(p => files.delete(p)); return { error: null }; },
        list: async () => ({ data: [], error: null }),
      }),
    },
    from: chain,
  };
  sb.auth = { getSession: async () => ({ data: { session: { access_token: 'jeton-de-test' } } }) };
  sbUser = { id: 'test-user', email: 'test@test' };
  ownerId = 'test-user';
});

// --- Masquer l'overlay de connexion s'il bloque la vue
await page.evaluate(() => {
  document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none');
  const o = document.getElementById('login-screen'); if (o) o.style.display = 'none';
});

// --- La vue existe et s'ouvre
await page.evaluate(() => showView('realisations'));
await page.waitForTimeout(300);
check('Onglet Réalisations présent', await page.locator('#vn-real').count() === 1);
check('Vue Réalisations affichée', await page.locator('#realisations-view').isVisible());
check('Bouton "Nouvelle réalisation" présent', await page.locator('.rz-new').count() === 1);

// --- Photo de test : un "bâtiment" aux verticales fuyantes, teinté orange et sous-exposé.
//     Sert à vérifier que la correction redresse vraiment et que l'auto corrige la couleur.
const mkPhoto = () => page.evaluate(async () => {
  const W = 1200, H = 900;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#6a7480'; x.fillRect(0, 0, W, H);
  // façade en trapèze : large en bas, étroite en haut (téléphone incliné vers le haut)
  x.fillStyle = '#d8cfc0';
  x.beginPath();
  x.moveTo(W * 0.30, 0); x.lineTo(W * 0.70, 0);
  x.lineTo(W * 0.86, H); x.lineTo(W * 0.14, H);
  x.closePath(); x.fill();
  // fenêtres, pour avoir de la structure
  x.fillStyle = '#3b4652';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const t = (r + 0.5) / 4;
    const lx = W * (0.30 + (0.14 - 0.30) * t), rx = W * (0.70 + (0.86 - 0.70) * t);
    const w = (rx - lx) / 5;
    x.fillRect(lx + w * (0.4 + c * 1.4), H * t - H * 0.06, w, H * 0.08);
  }
  // dominante orange + sous-exposition, comme un intérieur en lumière chaude
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = 'rgb(190,150,105)'; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95));
  return new File([blob], 'facade-test.jpg', { type: 'image/jpeg' });
});

// --- Créer une réalisation et y importer 2 photos
await page.evaluate(() => newRealisation());
await page.waitForTimeout(200);
check('Réalisation créée', await page.evaluate(() => realisations.length) === 1);

await page.evaluate(async () => {
  const mk = async (name) => {
    const W = 1200, H = 900;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#6a7480'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#d8cfc0';
    x.beginPath(); x.moveTo(W * 0.30, 0); x.lineTo(W * 0.70, 0); x.lineTo(W * 0.86, H); x.lineTo(W * 0.14, H); x.closePath(); x.fill();
    x.fillStyle = '#3b4652';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const t = (r + 0.5) / 4;
      const lx = W * (0.30 + (0.14 - 0.30) * t), rx = W * (0.70 + (0.86 - 0.70) * t);
      const w = (rx - lx) / 5;
      x.fillRect(lx + w * (0.4 + c * 1.4), H * t - H * 0.06, w, H * 0.08);
    }
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = 'rgb(190,150,105)'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95));
    return new File([blob], name, { type: 'image/jpeg' });
  };
  const r = realisations[0];
  await addPhotosToRealisation(r, [await mk('a.jpg'), await mk('b.jpg')]);
});
await page.waitForTimeout(600);

const photoCount = await page.evaluate(() => realisations[0].photos.length);
check('2 photos importées', photoCount === 2, photoCount + ' photo(s)');
const stored = await page.evaluate(() => [...window.__files.keys()]);
check('Fichiers envoyés au stockage (pleine déf + vignette)', stored.length === 4, stored.join(', '));
const dims = await page.evaluate(() => ({ w: realisations[0].photos[0].w, h: realisations[0].photos[0].h }));
check('Photo gardée en pleine définition (pas de réduction à 1400 px)', dims.w === 1200 && dims.h === 900, dims.w + '×' + dims.h);

// --- Les documents client, eux, doivent RESTER compressés à 1400 px : pas de régression
const docBehaviour = await page.evaluate(async () => {
  const cv = document.createElement('canvas'); cv.width = 3000; cv.height = 2000;
  cv.getContext('2d').fillStyle = '#888'; cv.getContext('2d').fillRect(0, 0, 3000, 2000);
  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
  const f = new File([blob], 'facture.jpg', { type: 'image/jpeg' });
  const doc = await readFileAsDoc(f);
  const img = new Image();
  await new Promise(res => { img.onload = res; img.src = doc.dataUri; });
  return { w: img.width, h: img.height };
});
check('Documents client toujours réduits à 1400 px (circuit inchangé)', docBehaviour.w === 1400, docBehaviour.w + '×' + docBehaviour.h);

// --- Vignettes affichées dans la galerie.
//     On vérifie `naturalWidth > 0`, c'est-à-dire que le navigateur a VRAIMENT décodé
//     l'image. Contrôler seulement que `src` est rempli laisse passer une URL d'objet déjà
//     libérée : la balise affiche alors l'icône « image cassée » avec un src d'apparence
//     valide. C'est exactement le bug qui est passé en production.
await page.waitForTimeout(1200);
const thumbs = await page.evaluate(() => ({
  ok: [...document.querySelectorAll('.rz-ph img')].filter(i => i.naturalWidth > 0).length,
  ko: [...document.querySelectorAll('.rz-ph img')].filter(i => i.src && i.naturalWidth === 0).length,
}));
check('Vignettes réellement affichées dans la galerie', thumbs.ok === 2 && thumbs.ko === 0, thumbs.ok + ' affichée(s), ' + thumbs.ko + ' cassée(s)');

// --- Et la couverture en vue liste (même piège)
const coverOk = await page.evaluate(async () => {
  _rzOpenId = null; renderRealisations();
  await new Promise(r => setTimeout(r, 1000));
  return {
    ok: [...document.querySelectorAll('.rz-cover img')].filter(i => i.naturalWidth > 0).length,
    ko: [...document.querySelectorAll('.rz-cover img')].filter(i => i.src && i.naturalWidth === 0).length,
  };
});
check('Photo de couverture réellement affichée (vue liste)', coverOk.ok === 1 && coverOk.ko === 0, coverOk.ok + ' affichée(s), ' + coverOk.ko + ' cassée(s)');
await page.evaluate(() => { _rzOpenId = realisations[0].id; renderRealisations(); });
await page.waitForTimeout(600);

// --- Une seule photo de couverture, jamais deux
const covers = await page.evaluate(() => [...document.querySelectorAll('.rz-ph-badge')].filter(b => b.textContent.trim() === 'couverture').length);
check('Une seule photo marquée « couverture »', covers === 1, covers + ' badge(s)');

// --- Autant de tuiles que de photos en données (pas de doublon à l'affichage)
const tiles = await page.evaluate(() => ({ tuiles: document.querySelectorAll('.rz-ph').length, photos: realisations[0].photos.length }));
check('Autant de tuiles que de photos', tiles.tuiles === tiles.photos, tiles.tuiles + ' tuiles / ' + tiles.photos + ' photos');

// --- Éditeur : ouverture et rendu
await page.evaluate(() => openPhotoEditor(realisations[0].id, realisations[0].photos[0].id));
await page.waitForTimeout(1200);
check('Éditeur ouvert', await page.locator('#ed-modal').count() === 1);
const canvasSize = await page.evaluate(() => { const c = document.getElementById('ed-canvas'); return { w: c.width, h: c.height }; });
check('Canvas de rendu dimensionné', canvasSize.w > 100 && canvasSize.h > 100, canvasSize.w + '×' + canvasSize.h);

// --- VÉRIFICATION DU REDRESSEMENT : la façade doit devenir verticale.
//     On mesure la largeur de la façade claire en haut et en bas de l'image rendue.
const measure = () => page.evaluate(() => {
  const cv = document.getElementById('ed-canvas');
  const ctx = cv.getContext('2d');
  const rowWidth = (yFrac) => {
    const y = Math.round(cv.height * yFrac);
    const d = ctx.getImageData(0, y, cv.width, 1).data;
    let first = -1, last = -1;
    for (let i = 0; i < cv.width; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      // façade = pixel clair et chaud ; fond = gris-bleu sombre
      const light = (r + g + b) / 3 > 105 && r > b;
      if (light) { if (first < 0) first = i; last = i; }
    }
    return first < 0 ? 0 : (last - first) / cv.width;
  };
  return { top: rowWidth(0.06), bottom: rowWidth(0.94) };
});

const before = await measure();
check('Photo de départ : verticales fuyantes détectées',
  before.top > 0.05 && before.bottom - before.top > 0.10,
  'haut ' + before.top.toFixed(3) + ' / bas ' + before.bottom.toFixed(3));

// on applique la correction et on remesure
await page.evaluate(() => { _ed.p.edit.persp = 100; edPaint(); });
await page.waitForTimeout(500);
const after = await measure();
const convBefore = before.bottom - before.top, convAfter = after.bottom - after.top;
check('Correction « Verticales » : la convergence diminue nettement',
  convAfter < convBefore * 0.45,
  'écart haut/bas ' + convBefore.toFixed(3) + ' → ' + convAfter.toFixed(3));

// --- Réglage auto : doit corriger la dominante orange et remonter l'exposition
await page.evaluate(() => { _ed.p.edit.persp = 0; edPaint(); });
await page.waitForTimeout(300);
const beforeColor = await page.evaluate(() => {
  const cv = document.getElementById('ed-canvas'), ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return { r: r / n, g: g / n, b: b / n, lum: (r * 0.2126 + g * 0.7152 + b * 0.0722) / n };
});
await page.evaluate(() => { Object.assign(_ed.p.edit, autoEdit(_ed.img, _ed.p.edit)); edPaint(); });
await page.waitForTimeout(500);
const afterColor = await page.evaluate(() => {
  const cv = document.getElementById('ed-canvas'), ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return { r: r / n, g: g / n, b: b / n, lum: (r * 0.2126 + g * 0.7152 + b * 0.0722) / n };
});
const castBefore = beforeColor.r - beforeColor.b, castAfter = afterColor.r - afterColor.b;
check('Réglage auto : dominante orange réduite',
  Math.abs(castAfter) < Math.abs(castBefore) * 0.55,
  'écart R-B ' + castBefore.toFixed(1) + ' → ' + castAfter.toFixed(1));
check('Réglage auto : image éclaircie',
  afterColor.lum > beforeColor.lum * 1.10,
  'luminance ' + beforeColor.lum.toFixed(1) + ' → ' + afterColor.lum.toFixed(1));

// --- Comparaison avant/après (appui maintenu)
await page.evaluate(() => { _ed.showOrig = true; edPaint(); });
await page.waitForTimeout(400);
const origLum = await page.evaluate(() => {
  const cv = document.getElementById('ed-canvas'), ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let s = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
  return s / n;
});
check('Comparaison « original » : revient bien à la photo non retouchée',
  Math.abs(origLum - (beforeColor.r + beforeColor.g + beforeColor.b) / 3) < 3,
  origLum.toFixed(1));
await page.evaluate(() => { _ed.showOrig = false; edPaint(); });

// --- Recadrage : le ratio demandé doit être respecté
await page.evaluate(() => { _ed.p.edit.ratio = '16:9'; edPaint(); });
await page.waitForTimeout(400);
const ratio = await page.evaluate(() => { const c = document.getElementById('ed-canvas'); return c.width / c.height; });
check('Recadrage 16:9 respecté', Math.abs(ratio - 16 / 9) < 0.02, ratio.toFixed(3));
await page.evaluate(() => { _ed.p.edit.ratio = 'libre'; edPaint(); });

// --- Appliquer la lumière à toute la série
await page.evaluate(() => {
  const src = _ed.p.edit, others = _ed.r.photos.filter(p => p.id !== _ed.p.id);
  others.forEach(p => ['expo', 'contrast', 'temp', 'tint', 'sat'].forEach(k => { p.edit[k] = src[k]; }));
});
const seriesOk = await page.evaluate(() => {
  const [a, b] = realisations[0].photos;
  return ['expo', 'contrast', 'temp', 'tint', 'sat'].every(k => a.edit[k] === b.edit[k]) && a.edit.persp === 0;
});
check('Lumière appliquée à la série (géométrie non copiée)', seriesOk);

// --- Fermeture de l'éditeur : les réglages sont conservés
await page.evaluate(() => closePhotoEditor());
await page.waitForTimeout(500);
check('Éditeur fermé', await page.locator('#ed-modal').count() === 0);
const persisted = await page.evaluate(async () => {
  const saved = await store.get('mn_realisations');
  return saved && saved[0] && saved[0].photos[0].edit.expo !== 0;
});
check('Réglages persistés dans le stockage', persisted);

// --- Synchronisation : la nouvelle donnée part bien dans le même circuit que les autres
const syncOk = await page.evaluate(() => SYNC_KEYS.has('mn_realisations'));
check('Réalisations incluses dans la synchronisation cloud', syncOk);
const pushRows = await page.evaluate(async () => {
  let captured = null;
  const prev = sb.from;
  sb.from = () => ({ upsert: async (rows) => { captured = rows; return { error: null }; }, delete: () => ({ in: async () => ({ error: null }) }) });
  cloudReady = true; remoteRealJson = '';
  await cloudPush();
  sb.from = prev;
  return (captured || []).map(r => r.kind);
});
check('cloudPush envoie bien la ligne "realisations"', pushRows.includes('realisations'), pushRows.join(', '));

// --- Sauvegarde : export/import couvrent les réalisations
const backupOk = await page.evaluate(async () => {
  const realThumbs = {};
  for (const r of realisations) for (const p of (r.photos || [])) {
    const b = await photoStore.get(thumbKey(p.id)); if (b) realThumbs[thumbKey(p.id)] = await blobToDataUri(b);
  }
  return { photos: realisations[0].photos.length, thumbs: Object.keys(realThumbs).length };
});
check('Sauvegarde : réalisations + vignettes incluses',
  backupOk.thumbs === backupOk.photos, backupOk.thumbs + '/' + backupOk.photos);

// --- Export vers le site : rendu à la taille demandée
const exported = await page.evaluate(async () => {
  const p = realisations[0].photos[0];
  const img = await loadPhotoImage(p.id, { thumb: false });
  const out = glRenderTo(img, p.edit, 1920, 'x_' + p.id);
  const blob = await canvasToBlob(out, 0.9);
  return { w: out.width, h: out.height, bytes: blob.size };
});
check('Export : rendu produit un JPEG', exported.bytes > 5000, exported.w + '×' + exported.h + ', ' + Math.round(exported.bytes / 1024) + ' ko');
check('Export : taille plafonnée à la valeur demandée', Math.max(exported.w, exported.h) <= 1920, exported.w + '×' + exported.h);

// --- Suppression d'une photo : les fichiers partent du stockage
const beforeDel = await page.evaluate(() => window.__files.size);
await page.evaluate(async () => {
  const r = realisations[0], pid = r.photos[1].id;
  await photoStore.del(fullKey(pid)); await photoStore.del(thumbKey(pid));
  r.photos = r.photos.filter(p => p.id !== pid); saveRealisations();
});
const afterDel = await page.evaluate(() => window.__files.size);
check('Suppression : fichiers retirés du stockage', afterDel === beforeDel - 2, beforeDel + ' → ' + afterDel);

// --- Anti-régression : une mise à jour distante ne doit pas orpheliner l'objet en cours
//     d'édition (c'est exactement le bug qui avait corrompu les noms de clients).
const identity = await page.evaluate(() => {
  const r = realisations[0];
  const before = r, beforePhoto = r.photos[0];
  mergeRealisations([JSON.parse(JSON.stringify({ ...r, title: 'Titre venu du cloud' }))]);
  const after = realisations[0];
  return {
    sameObject: after === before,
    samePhoto: after.photos[0] === beforePhoto,
    titleApplied: after.title === 'Titre venu du cloud',
  };
});
check('Fusion distante : objet réalisation conservé (pas d’orphelin)', identity.sameObject);
check('Fusion distante : objet photo conservé', identity.samePhoto);
check('Fusion distante : la valeur distante est bien appliquée', identity.titleApplied);

// --- Pendant une saisie, la mise à jour distante est ignorée (rien n'écrase la frappe)
const guarded = await page.evaluate(() => {
  _rzOpenId = realisations[0].id; renderRealisations();
  const input = document.querySelector('#realisations-view [data-f="title"]');
  if (!input) return { skipped: 'input introuvable' };
  input.focus();
  const editing = isEditingRealisations();
  realisations[0].title = 'frappe en cours';
  remoteRealJson = '';
  handleRealtime({ eventType: 'UPDATE', new: { id: 'realisations', kind: 'realisations', data: [{ ...realisations[0], title: 'ecrasement distant' }] } });
  const kept = realisations[0].title;
  input.blur();
  return { editing, kept, remoteNotMarked: remoteRealJson === '' };
});
check('Saisie protégée : édition détectée', guarded.editing === true, JSON.stringify(guarded));
check('Saisie protégée : la frappe locale n’est pas écrasée', guarded.kept === 'frappe en cours', guarded.kept);
check('Saisie protégée : la version locale repartira en synchro', guarded.remoteNotMarked === true);

// --- Sélection multiple, téléchargement en lot, suppression en lot.
//     C'est le besoin réel : plusieurs personnes alimentent la galerie depuis des
//     téléphones différents et doivent pouvoir récupérer et trier depuis le leur.
await page.evaluate(async () => {
  const mk = async (name) => {
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 600;
    const x = cv.getContext('2d'); x.fillStyle = '#c9bda8'; x.fillRect(0, 0, 900, 600);
    x.fillStyle = '#55606d'; x.fillRect(100, 80, 300, 440);
    const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    return new File([b], name, { type: 'image/jpeg' });
  };
  await addPhotosToRealisation(realisations[0], [await mk('c.jpg'), await mk('d.jpg')]);
});
await page.waitForTimeout(900);
const total = await page.evaluate(() => realisations[0].photos.length);

await page.evaluate(() => rzToggleSelectMode(true));
await page.waitForTimeout(400);
check('Mode sélection : barre d’actions affichée', await page.locator('.rz-selbar').count() === 1);
check('Mode sélection : « Ajouter des photos » masqué (une étape à la fois)', await page.locator('.rz-add').count() === 0);
check('Mode sélection : une case par photo', await page.locator('.rz-check').count() === total, total + ' photo(s)');

await page.locator('.rz-ph').first().click();
await page.waitForTimeout(300);
check('Un appui sélectionne au lieu d’ouvrir l’éditeur',
  (await page.locator('.rz-picked').count()) === 1 && (await page.locator('#ed-modal').count()) === 0);

await page.locator('.rz-selbar [data-all]').click();
await page.waitForTimeout(300);
check('« Tout sélectionner » coche toutes les photos', await page.locator('.rz-picked').count() === total);

// Téléchargement en lot : on intercepte le fichier produit et on le valide vraiment.
const zipB64 = await page.evaluate(async () => {
  let captured = null;
  const orig = window.downloadBlob;
  window.downloadBlob = (blob, name) => { captured = { blob, name }; };
  await rzDownload(realisations[0], rzSelectedPhotos(realisations[0]), { retouchees: false });
  window.downloadBlob = orig;
  if (!captured) return null;
  const buf = new Uint8Array(await captured.blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return { name: captured.name, b64: btoa(bin) };
});
check('Téléchargement en lot : un seul fichier .zip est produit', !!zipB64 && /\.zip$/.test(zipB64.name), zipB64 && zipB64.name);
if (zipB64) {
  // L'archive est écrite par notre propre code : on la fait valider par un vrai
  // décompresseur, pas par relecture du code. Un ZIP mal formé serait silencieux
  // jusqu'à ce que quelqu'un essaie de l'ouvrir.
  writeFileSync('/tmp/lot.zip', Buffer.from(zipB64.b64, 'base64'));
  let zipOk = null, zipDetail = '';
  try {
    execFileSync('unzip', ['-t', '/tmp/lot.zip'], { stdio: 'pipe' });
    const listing = execFileSync('unzip', ['-Z1', '/tmp/lot.zip'], { encoding: 'utf8' }).trim().split('\n');
    zipOk = listing.length === 3 && listing.every(n => n.endsWith('.jpg'));
    zipDetail = listing.join(', ');
  } catch (e) {
    if (e.code === 'ENOENT') zipDetail = 'unzip absent de la machine, contrôle non effectué';
    else { zipOk = false; zipDetail = String(e.message).slice(0, 90); }
  }
  if (zipOk !== null) check('Archive relue par un vrai décompresseur, 3 JPEG intacts', zipOk, zipDetail);
  else console.log('  (ignoré) validation ZIP — ' + zipDetail);
}

// Suppression en lot
const del = await page.evaluate(async () => {
  const r = realisations[0];
  const avant = r.photos.length;
  _rzSel.clear(); _rzSel.add(r.photos[0].id); _rzSel.add(r.photos[1].id);
  const fichiersAvant = window.__files.size;
  await new Promise((res, rej) => {
    const orig = window.askConfirm;
    window.askConfirm = (m, cb) => { window.askConfirm = orig; Promise.resolve(cb()).then(res, rej); };
    rzDeleteSelected(r);
  });
  return { avant, apres: r.photos.length, fichiersAvant, fichiersApres: window.__files.size, modeQuitte: _rzSelMode === false };
});
check('Suppression en lot : deux photos retirées en une confirmation', del.apres === del.avant - 2, del.avant + ' → ' + del.apres);
check('Suppression en lot : les fichiers partent du stockage', del.fichiersApres === del.fichiersAvant - 4, del.fichiersAvant + ' → ' + del.fichiersApres);
check('Suppression en lot : le mode sélection se referme', del.modeQuitte);

// --- Retouche IA : le pont, la sécurité et la non-destruction
const iaCalls = [];
await page.evaluate(() => { window.__iaCalls = []; });
// Le pont expose plusieurs actions : solde, schéma du modèle, exécution. Le faux pont
// reproduit les trois, avec le schéma RÉEL de Nano Banana Pro relevé sur fal.ai — c'est ce
// qui permet de vérifier que le formulaire est bien généré à partir du modèle.
const SCHEMA_REEL = {
  model: 'fal-ai/nano-banana-pro/edit',
  title: 'Queue OpenAPI for fal-ai/nano-banana-pro/edit',
  required: ['prompt', 'image_urls'],
  properties: {
    prompt: { type: 'string', title: 'Prompt' },
    image_urls: { type: 'array', title: 'Image URLs' },
    sync_mode: { type: 'boolean', title: 'Sync Mode' },
    resolution: { type: 'string', enum: ['1K', '2K', '4K'], default: '1K', title: 'Resolution', description: 'The resolution of the image to generate.' },
    aspect_ratio: { anyOf: [{ type: 'string', enum: ['auto', '16:9', '4:3', '1:1'] }, { type: 'null' }], default: 'auto', title: 'Aspect Ratio' },
    seed: { anyOf: [{ type: 'integer' }, { type: 'null' }], title: 'Seed' },
    num_images: { type: 'integer', minimum: 1, maximum: 4, default: 1, title: 'Number of Images' },
    output_format: { type: 'string', enum: ['jpeg', 'png', 'webp'], default: 'png', title: 'Output Format' },
    system_prompt: { type: 'string', maxLength: 50000, default: '', title: 'System Prompt' },
    enable_web_search: { type: 'boolean', default: false, title: 'Enable Web Search' },
    safety_tolerance: { type: 'string', enum: ['1', '2', '3', '4', '5', '6'], default: '4', title: 'Safety Tolerance' },
  },
};
let soldeKo = false; // pour rejouer le cas « le solde ne se lit pas »
await page.route('**/functions/v1/photo-ia', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const auth = route.request().headers()['authorization'] || '';
  iaCalls.push({ body: { action: body.action, model: body.model, input: body.input, hasImage: !!body.imageDataUri, imgPrefix: (body.imageDataUri || '').slice(0, 11) }, auth });
  if (body.action === 'balance') {
    if (soldeKo) {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: "la clé fal.ai en place n'a pas le droit de lire la facturation (HTTP 403). Ce droit demande une clé de portée ADMIN ; la retouche, elle, fonctionne avec la clé actuelle." }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'melissa', balance: 9.87, currency: 'USD' }) });
    return;
  }
  if (body.action === 'schema') {
    // Un agrandisseur réel n'expose pas de `prompt` : on reproduit ce cas pour vérifier que
    // le panneau ne réclame pas une consigne qui serait de toute façon ignorée.
    if (body.model === 'test/agrandisseur') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: body.model, required: ['image_url'], properties: { image_url: { type: 'string' }, sync_mode: { type: 'boolean' }, scale: { type: 'integer', minimum: 1, maximum: 4, default: 2, title: 'Scale' } } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SCHEMA_REEL) });
    return;
  }
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAAIAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imageDataUri: jpeg, model: body.model, raw: { seed: 42 } }) });
});

const iaOnglet = await page.evaluate(async () => {
  await openPhotoEditor(realisations[0].id, realisations[0].photos[0].id);
  await new Promise(r => setTimeout(r, 900));
  const tabs = [...document.querySelectorAll('.ed-tab')];
  return {
    n: tabs.length,
    premier: (tabs[0] || {}).dataset && tabs[0].dataset.tab,
    ouvert: _ed.tab,
    actif: (tabs.find(t => t.classList.contains('active')) || {}).dataset.tab,
    consigneVisible: !!document.querySelector('.ia-prompt'),
  };
});
check('Onglet IA présent dans l’éditeur', iaOnglet.n === 4, iaOnglet.n + ' onglet(s)');
// La retouche est le mode d'entrée : c'est ce qu'on veut voir en ouvrant une photo, pas les
// curseurs. Vérifié à l'ouverture réelle de l'éditeur, pas en forçant l'onglet.
check('La retouche IA est le PREMIER onglet', iaOnglet.premier === 'ia', String(iaOnglet.premier));
check('La retouche IA est l’onglet ouvert par défaut',
  iaOnglet.ouvert === 'ia' && iaOnglet.actif === 'ia' && iaOnglet.consigneVisible, JSON.stringify(iaOnglet));

const panneau = await page.evaluate(() => {
  _ed.tab = 'ia'; paintEditorTabs(); buildEditorControls();
  return {
    consigne: !!document.querySelector('.ia-prompt'),
    modeles: !!document.querySelector('#ed-controls select'),
    bouton: [...document.querySelectorAll('#ed-controls .ia-go')].some(b => b.textContent.includes('Retoucher cette photo')),
    consignesPretes: document.querySelectorAll('#ed-controls .ia-chip').length,
  };
});
check('Panneau IA : champ de consigne, choix du modèle, bouton', panneau.consigne && panneau.modeles && panneau.bouton, JSON.stringify(panneau));
// Taper trois lignes de français sur un téléphone est le vrai frein : les consignes toutes
// prêtes doivent exister ET remplir réellement le champ.
const presets = await page.evaluate(() => {
  const c = document.querySelector('#ed-controls .ia-chip');
  if (!c) return null;
  c.click();
  return { titre: c.textContent.trim(), rempli: (document.querySelector('.ia-prompt').value || '').length };
});
check('Consignes toutes prêtes : un appui remplit le champ',
  !!presets && presets.rempli > 40, presets ? presets.titre + ' → ' + presets.rempli + ' caractères' : 'aucune');

// --- Le solde du fournisseur s'affiche dans le CRM
await page.waitForTimeout(700);
const solde = await page.evaluate(() => (document.querySelector('.ia-solde b') || {}).textContent);
check('Solde du compte fal.ai affiché dans le CRM', /9[.,]87/.test(solde || ''), solde);

// --- Le solde est une COMMODITÉ, pas un pré-requis : quand sa lecture échoue, la raison doit
//     être lisible à l'écran (elle était dans une infobulle, inatteignable sur téléphone) et
//     dire clairement que la retouche, elle, n'est pas concernée.
soldeKo = true;
const soldeEchec = await page.evaluate(async () => {
  _iaBalance = null; buildEditorControls();
  await new Promise(r => setTimeout(r, 700));
  const w = document.querySelector('#ed-controls .ia-warn');
  return { visible: !!w && w.offsetParent !== null, texte: (w ? w.textContent : '') };
});
check('Échec du solde : la raison est lisible à l’écran, pas cachée dans une infobulle',
  soldeEchec.visible && /ADMIN/.test(soldeEchec.texte) && /retouche/i.test(soldeEchec.texte),
  soldeEchec.texte.slice(0, 90));
soldeKo = false;
await page.evaluate(async () => { _iaBalance = null; buildEditorControls(); await new Promise(r => setTimeout(r, 700)); });

// --- LES FENÊTRES OUVERTES DEPUIS L'ÉDITEUR DOIVENT ÊTRE AU-DESSUS DE LUI.
//     Bug constaté en production : l'éditeur est en plein écran à z-index 80, la fenêtre
//     modale était à 40. La confirmation d'envoi et le panneau « Modèles » s'ouvraient donc
//     DERRIÈRE l'éditeur : les deux boutons paraissaient morts alors qu'ils répondaient.
//     On vérifie le rendu réel (elementFromPoint), pas la valeur de z-index.
const dessus = await page.evaluate(async () => {
  const vu = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { existe: false };
    const r = el.getBoundingClientRect();
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(30, r.height / 2));
    return { existe: true, visible: r.width > 0 && r.height > 0, auDessus: !!(dessus && el.contains(dessus)) };
  };
  const out = {};
  // 1. la confirmation d'envoi, ouverte depuis le bouton principal
  const orig = window.askConfirm;
  let vuConfirm = null;
  window.askConfirm = (m, cb) => { orig(m, () => {}); vuConfirm = vu('#modal'); closeModal(); window.askConfirm = orig; };
  document.querySelector('.ia-prompt').value = 'équilibre la lumière';
  document.querySelector('#ed-controls .ia-go').click();
  await new Promise(r => setTimeout(r, 250));
  out.confirmation = vuConfirm;
  // 2. le panneau des modèles, ouvert depuis « ⚙ Gérer »
  openIaModelsPanel();
  await new Promise(r => setTimeout(r, 250));
  out.modeles = vu('#modal');
  out.catalogue = document.querySelectorAll('#modal .ia-cat-row').length;
  closeModal();
  return out;
});
check('Confirmation d’envoi réellement visible par-dessus l’éditeur',
  dessus.confirmation && dessus.confirmation.visible && dessus.confirmation.auDessus, JSON.stringify(dessus.confirmation));
check('Panneau « Modèles » réellement visible par-dessus l’éditeur',
  dessus.modeles.visible && dessus.modeles.auDessus, JSON.stringify(dessus.modeles));
check('Catalogue de modèles proposé dans le panneau', dessus.catalogue >= 10, dessus.catalogue + ' modèle(s)');

// --- Un modèle sans consigne (agrandisseur) ne doit pas exiger de texte
const sansPrompt = await page.evaluate(async () => {
  library.iaModels.push({ id: 'test/agrandisseur', label: 'Agrandisseur de test', note: '' });
  library.iaLastModel = 'test/agrandisseur';
  buildEditorControls();
  await new Promise(r => setTimeout(r, 700));
  const ta = document.querySelector('.ia-prompt');
  const chips = document.querySelector('#ed-controls .ia-chips');
  return { desactive: ta.disabled, chipsMasquees: chips ? getComputedStyle(chips).display === 'none' : null, aide: ta.placeholder };
});
check('Modèle sans consigne : le champ de texte est neutralisé, pas laissé trompeur',
  sansPrompt.desactive && sansPrompt.chipsMasquees === true, JSON.stringify(sansPrompt));
await page.evaluate(async () => {
  library.iaModels = library.iaModels.filter(m => m.id !== 'test/agrandisseur');
  library.iaLastModel = 'fal-ai/nano-banana-pro/edit';
  buildEditorControls();
  await new Promise(r => setTimeout(r, 700));
});

// --- Les réglages sont LUS DANS LE SCHÉMA du modèle, pas codés en dur.
//     C'est ce qui garantit qu'on retrouve ce que fal.ai propose sur son propre site,
//     y compris pour un modèle ajouté plus tard.
await page.evaluate(() => { document.querySelector('.ia-params').open = true; });
await page.waitForTimeout(800);
const champs = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.ia-field').forEach(f => {
    const l = f.querySelector('label'); const i = f.querySelector('.ia-input');
    out.push({ nom: l ? l.textContent : '?', balise: i ? i.tagName.toLowerCase() : null, type: i ? (i.type || '') : null, options: i && i.tagName === 'SELECT' ? [...i.options].map(o => o.value) : null });
  });
  return out;
});
const parNom = n => champs.find(c => c.nom === n);
check('Réglages générés depuis le schéma du modèle', champs.length >= 8, champs.length + ' réglages : ' + champs.map(c => c.nom).join(', '));
check('Résolution rendue en liste de choix (1K / 2K / 4K)',
  parNom('Resolution') && parNom('Resolution').balise === 'select' && JSON.stringify(parNom('Resolution').options) === JSON.stringify(['1K', '2K', '4K']),
  JSON.stringify(parNom('Resolution')));
check('Nombre entier rendu en champ numérique borné', parNom('Number of Images') && parNom('Number of Images').type === 'number', JSON.stringify(parNom('Number of Images')));
check('Booléen rendu en case à cocher', parNom('Enable Web Search') && parNom('Enable Web Search').type === 'checkbox', JSON.stringify(parNom('Enable Web Search')));
check('Type « anyOf » (chaîne ou nul) correctement interprété en liste',
  parNom('Aspect Ratio') && parNom('Aspect Ratio').balise === 'select', JSON.stringify(parNom('Aspect Ratio')));
check('Texte long rendu en zone de saisie multiligne', parNom('System Prompt') && parNom('System Prompt').balise === 'textarea', JSON.stringify(parNom('System Prompt')));
check('Les champs pilotés par le CRM ne sont pas proposés deux fois',
  !parNom('Image URLs') && !parNom('Sync Mode') && !parNom('Prompt'), champs.map(c => c.nom).join(', '));

// --- Un réglage modifié doit repartir dans l'appel
await page.evaluate(() => {
  const f = [...document.querySelectorAll('.ia-field')].find(x => x.querySelector('label').textContent === 'Resolution');
  const s = f.querySelector('select'); s.value = '4K'; s.dispatchEvent(new Event('change'));
});
await page.waitForTimeout(300);
const memorise = await page.evaluate(() => JSON.parse(JSON.stringify(library.iaParams['fal-ai/nano-banana-pro/edit'] || {})));
check('Réglage choisi mémorisé par modèle', memorise.resolution === '4K', JSON.stringify(memorise));

const applique = await page.evaluate(async () => {
  const r = realisations[0], p = r.photos[0];
  const avant = window.__files.size;
  await new Promise((res, rej) => {
    const orig = window.askConfirm;
    window.askConfirm = (m, cb) => { window.askConfirm = orig; Promise.resolve(cb()).then(res, rej); };
    document.querySelector('.ia-prompt').value = 'équilibre la lumière';
    document.querySelector('#ed-controls .ia-go').click();
  });
  await new Promise(r2 => setTimeout(r2, 700));
  return {
    aVersionIa: !!p.ia, useIa: p.useIa === true,
    prompt: p.ia && p.ia.prompt,
    originalIntact: window.__files.has('test-user/' + fullKey(p.id)),
    fichierIa: window.__files.has('test-user/' + iaKey(p.id)),
    nouveauxFichiers: window.__files.size - avant,
  };
});
check('Retouche IA : version enregistrée à côté de l’original', applique.aVersionIa && applique.fichierIa, JSON.stringify(applique));
check('Retouche IA : l’original n’est PAS écrasé', applique.originalIntact && applique.nouveauxFichiers === 1);
check('Retouche IA : la consigne est mémorisée sur la photo', applique.prompt === 'équilibre la lumière', applique.prompt);

const appelEdit = iaCalls.filter(c => c.body.action === 'edit').pop();
check('Pont IA : appelé avec le modèle, la consigne et une image',
  !!appelEdit && appelEdit.body.model === 'fal-ai/nano-banana-pro/edit'
  && appelEdit.body.input && appelEdit.body.input.prompt === 'équilibre la lumière'
  && appelEdit.body.imgPrefix === 'data:image/', JSON.stringify(appelEdit && appelEdit.body));
check('Pont IA : les réglages du modèle partent avec la consigne',
  !!appelEdit && appelEdit.body.input.resolution === '4K', JSON.stringify(appelEdit && appelEdit.body.input));

// --- Sans choix explicite, la sortie doit être demandée en 2K. Les photos sont publiées en
//     1600 px : une sortie 1K (défaut du modèle) y serait agrandie, donc molle.
const pref2k = await page.evaluate(async () => {
  const m = 'fal-ai/nano-banana-pro/edit';
  library.iaParams[m] = {};                       // plus rien de mémorisé
  const sc = await iaSchema(m);
  await runIaEdit(realisations[0].photos[0], 'test préférence', m);   // pont intercepté
  return { affiche: iaValue(m, 'resolution', sc.properties.resolution), defautModele: sc.properties.resolution.default };
});
const appelPref = iaCalls.filter(c => c.body.action === 'edit').pop();
check('Sans choix explicite : 2K affiché dans les réglages (le modèle propose 1K par défaut)',
  pref2k.affiche === '2K' && pref2k.defautModele === '1K', JSON.stringify(pref2k));
check('Sans choix explicite : le 2K part réellement au modèle',
  !!appelPref && appelPref.body.input.resolution === '2K', JSON.stringify(appelPref && appelPref.body.input));

// --- Les corrections envoyées au modèle sont CUITES dans l'image qu'il renvoie : les
//     laisser actives les appliquerait une seconde fois (verticales sur-redressées, lumière
//     poussée deux fois) à l'écran, à l'export ET à la publication.
const doubleCorrection = await page.evaluate(async () => {
  const r = realisations[0], p = r.photos[0];
  // On repart d'une photo SANS version IA mais AVEC des corrections marquées : sans valeurs
  // non nulles, ce test passerait même si le bug était toujours là.
  delete p.ia; delete p.editIa; delete p.editOrig; p.useIa = false;
  Object.assign(p.edit, { persp: 0.35, expo: 0.4 });
  await applyIaToPhoto(r, p, 'consigne de test', 'fal-ai/nano-banana-pro/edit', null);
  const apresIa = { persp: p.edit.persp, expo: p.edit.expo, useIa: p.useIa };
  const memorise = p.editOrig ? { persp: p.editOrig.persp, expo: p.editOrig.expo } : null;
  iaUseVersion(p, false);                      // retour à la photo d'origine
  const retour = { persp: p.edit.persp, expo: p.edit.expo, useIa: p.useIa };
  iaUseVersion(p, true);
  return { apresIa, memorise, retour, apresRetourIa: { persp: p.edit.persp, expo: p.edit.expo } };
});
check('Après retouche IA : les réglages déjà appliqués ne sont PAS réappliqués par-dessus',
  doubleCorrection.apresIa.persp === 0 && doubleCorrection.apresIa.expo === 0,
  JSON.stringify(doubleCorrection.apresIa));
check('Les réglages de la photo d’origine sont conservés et reviennent avec elle',
  doubleCorrection.memorise !== null && doubleCorrection.memorise.persp === 0.35
  && doubleCorrection.retour.persp === 0.35 && doubleCorrection.retour.expo === 0.4,
  JSON.stringify(doubleCorrection));
check('Chaque version garde ses propres réglages d’un aller-retour à l’autre',
  doubleCorrection.apresRetourIa.persp === 0 && doubleCorrection.apresRetourIa.expo === 0,
  JSON.stringify(doubleCorrection.apresRetourIa));

check('Pont IA : le jeton envoyé est celui de la SESSION, pas la clé publique de la page',
  iaCalls.every(c => c.auth === 'Bearer jeton-de-test' && !c.auth.includes('sb_publishable')),
  iaCalls[0] && iaCalls[0].auth);

const bascule = await page.evaluate(async () => {
  const p = realisations[0].photos[0];
  p.useIa = false;
  const orig = await loadPhotoImage(p.id, { thumb: false });
  p.useIa = true;
  const ia = await loadPhotoImage(p.id, { thumb: false });
  const force = await loadPhotoImage(p.id, { thumb: false, original: true });
  return { differentes: orig !== ia, originalForce: force === orig };
});
check('Bascule original / version IA effective', bascule.differentes);
check('« original:true » ramène bien la photo d’origine (pas de réinjection de l’IA dans l’IA)', bascule.originalForce);

// --- COMPARATEUR AVANT / APRÈS. Sans lui, après une retouche il n'y a qu'une image à
//     l'écran et rien ne dit ce qui a changé. Le curseur coupe l'image en deux.
const comparateur = await page.evaluate(async () => {
  const p = realisations[0].photos[0];
  p.useIa = true;
  await reloadEditorImage();
  await new Promise(r => setTimeout(r, 500));
  const cv = document.getElementById('ed-canvas');
  const lit = (fx) => {
    const x = Math.round(cv.width * fx), y = Math.round(cv.height / 2);
    return [...cv.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3).join(',');
  };
  _ed.split = 0.5; edPaint();
  await new Promise(r => setTimeout(r, 400));
  const gauche = lit(0.12), droite = lit(0.88);
  // le curseur déplacé à droite : le point à 60 % doit basculer de l'après vers l'avant
  const avant60 = lit(0.6);
  _ed.split = 0.9; edPaint();
  await new Promise(r => setTimeout(r, 400));
  const apres60 = lit(0.6);
  return { compare: edHasCompare(), gauche, droite, avant60, apres60 };
});
check('Comparateur disponible dès qu’une version IA existe', comparateur.compare, JSON.stringify(comparateur.compare));
check('Comparateur : les deux moitiés de l’image sont bien différentes (avant ≠ après)',
  comparateur.gauche !== comparateur.droite, comparateur.gauche + ' | ' + comparateur.droite);
check('Comparateur : déplacer le curseur change ce qu’on voit',
  comparateur.avant60 !== comparateur.apres60, comparateur.avant60 + ' → ' + comparateur.apres60);

// --- HISTORIQUE : ce qui a été fait sur la photo, avec le modèle et la consigne
const histo = await page.evaluate(() => {
  const p = realisations[0].photos[0];
  openPhotoHistory(realisations[0], p);
  const lignes = [...document.querySelectorAll('#modal .hist li')].map(li => li.textContent);
  const etat = (document.querySelector('#modal .hist-etat') || {}).textContent || '';
  const rect = document.querySelector('#modal').getBoundingClientRect();
  const dessus = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 20);
  closeModal();
  return { n: lignes.length, texte: lignes.join(' ~ '), etat, auDessus: !!(dessus && document.querySelector('#modal').contains(dessus)) };
});
check('Historique : la retouche IA y figure avec son modèle et sa consigne',
  /Retouche IA/.test(histo.texte) && /Nano Banana/.test(histo.texte) && /consigne de test/.test(histo.texte),
  histo.texte.slice(0, 120));
check('Historique : l’import de la photo y figure', /Ajoutée/.test(histo.texte), histo.n + ' événement(s)');
check('Historique : la fenêtre s’ouvre bien par-dessus l’éditeur', histo.auDessus);

// --- La liste des modèles n'est plus limitée : tout le catalogue y est, rangé par usage
const listeModeles = await page.evaluate(() => {
  const sel = document.querySelector('#ed-controls select');
  return {
    groupes: [...sel.querySelectorAll('optgroup')].map(g => g.label),
    n: sel.querySelectorAll('option').length,
    coller: !!sel.querySelector('option[value="__coller"]'),
  };
});
check('Tous les modèles du catalogue sont dans la liste, rangés par usage',
  listeModeles.n >= 15 && listeModeles.groupes.length >= 3, JSON.stringify(listeModeles.groupes) + ' · ' + listeModeles.n + ' entrées');
check('Un identifiant fal.ai quelconque peut être ajouté depuis la liste', listeModeles.coller);

// --- Une seule façon de sortir de l'éditeur (deux boutons faisaient la même chose)
const sortie = await page.evaluate(() => ({
  ferme: document.querySelectorAll('#ed-modal .ed-bar [data-close]').length,
  done: document.querySelectorAll('#ed-modal .ed-bar [data-done]').length,
  hist: document.querySelectorAll('#ed-modal .ed-bar [data-hist]').length,
}));
check('Éditeur : un seul bouton pour sortir, et un accès à l’historique',
  sortie.ferme === 1 && sortie.done === 0 && sortie.hist === 1, JSON.stringify(sortie));

await page.evaluate(() => { _ed.tab = 'geometrie'; closePhotoEditor(); });
await page.waitForTimeout(500);
await page.unroute('**/functions/v1/photo-ia');

// --- Publication vers le site public
const realisationPhotoCount = await page.evaluate(() => realisations[0].photos.length);
const pub = await page.evaluate(async () => {
  // Le manifeste est lu par fetch sur une URL publique : indisponible en test, on part
  // donc d'un manifeste vide, ce qui est justement le cas d'une première publication.
  const r = realisations[0];
  r.title = 'Bureau Sébastien';
  const before = new Set(window.__files.keys());
  await publishRealisation(r);
  const nouveaux = [...window.__files.keys()].filter(k => !before.has(k));
  const manifBlob = window.__files.get('u/manifest.json') || window.__files.get('test-user/manifest.json');
  const manif = manifBlob ? JSON.parse(await manifBlob.text()) : null;
  return { nouveaux, manif, publie: r.published === true };
});
check('Publication : la réalisation est marquée en ligne', pub.publie);

// --- ÉTAT DE PUBLICATION PHOTO PAR PHOTO. « Le projet est en ligne » ne dit pas si LA photo
//     ajoutée après coup y est : c'est exactement ce qui manquait pour savoir quoi republier.
const etatsPhotos = await page.evaluate(async () => {
  const r = realisations[0];
  const lire = () => [...document.querySelectorAll('.rz-ph .rz-tag')].map(t => t.textContent.trim());
  renderRealisations(); await new Promise(x => setTimeout(x, 400));
  const justePubliees = r.photos.map(p => photoPubState(r, p));
  const tags = lire();
  // une photo modifiée après la publication
  photoTouch(r.photos[0], 'reglages');
  const apresRetouche = photoPubState(r, r.photos[0]);
  // une photo ajoutée après la publication n'a jamais été mise en ligne
  const neuve = { id: 'photo-neuve', name: 'neuve.jpg', edit: blankEdit(), createdAt: Date.now() };
  r.photos.push(neuve);
  const etatNeuve = photoPubState(r, neuve);
  r.photos.pop();
  renderRealisations(); await new Promise(x => setTimeout(x, 400));
  return { justePubliees, tags, apresRetouche, etatNeuve, resume: (document.querySelector('.rz-site') || {}).textContent || '' };
});
check('Chaque photo publiée est datée et marquée « en ligne »',
  etatsPhotos.justePubliees.every(e => e === 'enligne') && etatsPhotos.tags.some(t => /en ligne/.test(t)),
  JSON.stringify(etatsPhotos.justePubliees) + ' · ' + etatsPhotos.tags.join(' | '));
check('Une photo modifiée après la publication est signalée « à republier »',
  etatsPhotos.apresRetouche === 'modifiee', etatsPhotos.apresRetouche);
check('Une photo ajoutée après la publication est signalée « pas encore en ligne »',
  etatsPhotos.etatNeuve === 'absente', etatsPhotos.etatNeuve);
check('La fiche annonce combien de photos sont à jour et combien attendent',
  /photo\(s\) à jour en ligne/.test(etatsPhotos.resume) && /en attente/.test(etatsPhotos.resume),
  etatsPhotos.resume.slice(0, 140));
check('Publication : un fichier pleine taille + une vignette par photo',
  pub.nouveaux.filter(k => /\/p\d+\.jpg$/.test(k)).length === realisationPhotoCount &&
  pub.nouveaux.filter(k => /\/t\d+\.jpg$/.test(k)).length === realisationPhotoCount,
  pub.nouveaux.join(', '));
check('Publication : un manifeste est écrit', !!pub.manif && Array.isArray(pub.manif.realisations), JSON.stringify(pub.manif && pub.manif.site));
check('Publication : le manifeste décrit bien la réalisation',
  !!pub.manif && pub.manif.realisations.length === 1 && pub.manif.realisations[0].title === 'Bureau Sébastien'
  && pub.manif.realisations[0].photos.length === realisationPhotoCount);
check('Publication : le manifeste ne contient aucune clé ni jeton',
  !!pub.manif && !/eyJ|sb_secret|service_role|apikey/i.test(JSON.stringify(pub.manif)));
check('Publication : les fichiers publiés sont bien dans le bucket galerie, pas dans les documents',
  pub.nouveaux.every(k => !k.includes('rp_') && !k.includes('rt_')), pub.nouveaux.join(', '));

// --- Retrait du site
const unpub = await page.evaluate(async () => {
  const r = realisations[0];
  await new Promise((res, rej) => {
    const orig = window.askConfirm;
    window.askConfirm = (m, cb) => { window.askConfirm = orig; Promise.resolve(cb()).then(res, rej); };
    unpublishRealisation(r);
  });
  const manifBlob = window.__files.get('u/manifest.json') || window.__files.get('test-user/manifest.json');
  const manif = manifBlob ? JSON.parse(await manifBlob.text()) : null;
  return { publie: r.published === true, restant: manif ? manif.realisations.length : -1 };
});
check('Retrait du site : la réalisation n’est plus marquée en ligne', unpub.publie === false);
check('Retrait du site : elle disparaît du manifeste', unpub.restant === 0, unpub.restant + ' restante(s)');

// --- Garde-fou : une lecture de manifeste qui échoue ne doit JAMAIS écraser le site.
//     Avant correction, une simple coupure réseau (ou un manifeste servi périmé par le
//     CDN) faisait repartir d'un manifeste vide et dépubliait silencieusement tout le reste.
const guard = await page.evaluate(async () => {
  const r = realisations[0];
  r.title = 'Bureau Sébastien';
  await publishRealisation(r);                    // le site contient maintenant une réalisation
  const key = [...window.__files.keys()].find(k => k.endsWith('manifest.json'));
  const avant = JSON.parse(await window.__files.get(key).text()).realisations.length;

  // panne réseau sur la lecture du manifeste
  const realFrom = sb.storage.from;
  sb.storage.from = (b) => {
    const o = realFrom(b);
    return Object.assign({}, o, { download: async () => ({ data: null, error: { message: 'network error', statusCode: '500' } }) });
  };
  const r2 = normalizeRealisation({ title: 'Autre chantier', photos: r.photos.map(p => ({ ...p })) });
  realisations.push(r2);
  await publishRealisation(r2);
  sb.storage.from = realFrom;

  const apres = JSON.parse(await window.__files.get(key).text()).realisations.length;
  return { avant, apres, deuxiemePubliee: r2.published === true };
});
check('Panne de lecture du manifeste : la publication est abandonnée, pas forcée', guard.deuxiemePubliee === false);
check('Panne de lecture du manifeste : le site déjà publié est intact', guard.apres === guard.avant, guard.avant + ' → ' + guard.apres);

// --- Place réellement donnée à la photo dans l'éditeur, selon la forme de l'écran.
//     Un téléphone en « site pour ordinateur » fait ~980 px de large tout en restant en
//     PORTRAIT : ne regarder que la largeur envoyait l'éditeur en deux colonnes et la photo
//     n'occupait plus que 13 % de l'écran, noyée dans 1660 px de noir.
for (const [w, h, nom, minPart, enLigneAttendu] of [
  [980, 2175, 'téléphone en mode ordinateur', 25, false],
  [390, 844, 'téléphone', 25, false],
  [820, 1180, 'tablette portrait', 40, false],
  [1280, 900, 'ordinateur', 45, true],
]) {
  await page.setViewportSize({ width: w, height: h });
  // On mesure sur la photo d'origine : à ce stade du test, la version IA est l'image
  // factice de 1×1 px renvoyée par le faux pont, qui fausserait toute mesure de surface.
  await page.evaluate(() => {
    realisations[0].photos[0].useIa = false;
    if (!document.getElementById('ed-modal')) openPhotoEditor(realisations[0].id, realisations[0].photos[0].id);
  });
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const st = document.querySelector('.ed-stage').getBoundingClientRect();
    const cv = document.getElementById('ed-canvas').getBoundingClientRect();
    return {
      enLigne: getComputedStyle(document.querySelector('.ed-body')).flexDirection === 'row',
      part: 100 * (cv.width * cv.height) / (innerWidth * innerHeight),
      noir: st.height - cv.height,
    };
  });
  check('Éditeur ' + nom + ' (' + w + '×' + h + ') : la photo occupe une vraie place',
    m.part >= minPart, Math.round(m.part) + '% de l’écran, ' + Math.round(m.noir) + 'px de vide');
  check('Éditeur ' + nom + ' : disposition adaptée à la forme de l’écran',
    m.enLigne === enLigneAttendu, m.enLigne ? 'deux colonnes' : 'empilé');
}

// --- Les onglets ne débordent pas sur un téléphone étroit (libellés non coupés)
await page.setViewportSize({ width: 375, height: 800 });
await page.evaluate(() => { if (!document.getElementById('ed-modal')) openPhotoEditor(realisations[0].id, realisations[0].photos[0].id); });
await page.waitForTimeout(800);
const ongletsEtroit = await page.evaluate(() => {
  const t = document.querySelector('.ed-tabs');
  return { debord: t.scrollWidth - t.clientWidth, hauteur: t.getBoundingClientRect().height, panneau: document.querySelector('.ed-panel').scrollWidth - document.querySelector('.ed-panel').clientWidth };
});
check('Onglets de l’éditeur tenus sur une ligne à 375px',
  ongletsEtroit.debord <= 1 && ongletsEtroit.hauteur < 52 && ongletsEtroit.panneau <= 1, JSON.stringify(ongletsEtroit));
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(300);

// --- L'onglet IA ne montre que ce qui concerne l'IA
const boutonsIa = await page.evaluate(() => {
  _ed.tab = 'ia'; paintEditorTabs(); buildEditorControls();
  return [...document.querySelectorAll('.ed-panel .btn, .ed-panel .mini, .ed-panel .ia-go')].filter(b => b.offsetParent !== null).map(b => b.textContent.trim());
});
check('Onglet IA : pas de bouton de réglage photo qui traîne',
  !boutonsIa.some(b => /Réglage auto|Réinitialiser|lumière à toute la série|couverture/i.test(b)),
  boutonsIa.join(' | '));
await page.evaluate(() => { _ed.tab = 'geometrie'; paintEditorTabs(); buildEditorControls(); closePhotoEditor(); });
await page.waitForTimeout(400);
await page.setViewportSize({ width: 1280, height: 900 });

// --- Responsive : pas de débordement horizontal sur mobile
for (const w of [375, 768]) {
  await page.setViewportSize({ width: w, height: 800 });
  await page.evaluate(() => { showView('realisations'); });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('Aucun débordement horizontal à ' + w + 'px', overflow <= 1, 'débordement ' + overflow + 'px');
}
await page.screenshot({ path: '/tmp/mn-shot-mobile.png' });
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => showView('realisations'));
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/mn-shot-desktop.png' });

// --- Les autres vues fonctionnent toujours
for (const v of ['dashboard', 'clients', 'chantier', 'devis']) {
  await page.evaluate(vv => showView(vv), v);
  await page.waitForTimeout(250);
}
await page.evaluate(() => showView('realisations'));
check('Navigation entre toutes les vues sans erreur', true);

// La panne de manifeste ci-dessus est provoquée volontairement : l'erreur qu'elle
// journalise est le comportement attendu, pas un défaut.
const realErrors = errors.filter(e => !/favicon|net::ERR|Failed to load resource|supabase|Access-Control|CORS|manifeste illisible : network error/i.test(e));
check('Aucune erreur JavaScript', realErrors.length === 0, realErrors.slice(0, 4).join(' | '));

console.log('\n===== RESULTAT : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) { console.log('Echecs :'); ko.forEach(k => console.log('  - ' + k)); }
await browser.close();
process.exit(ko.length ? 1 : 0);
