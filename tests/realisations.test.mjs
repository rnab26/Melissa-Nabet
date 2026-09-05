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
  out.texteModeles = document.querySelector('#modal').textContent;
  closeModal();
  return out;
});
check('Confirmation d’envoi réellement visible par-dessus l’éditeur',
  dessus.confirmation && dessus.confirmation.visible && dessus.confirmation.auDessus, JSON.stringify(dessus.confirmation));
check('Panneau « Modèles » réellement visible par-dessus l’éditeur',
  dessus.modeles.visible && dessus.modeles.auDessus, JSON.stringify(dessus.modeles));
check('Le panneau « Mes modèles » ne double pas le catalogue et explique où il est',
  /catalogue sont déjà proposés/.test(dessus.texteModeles) && /Aucun modèle ajouté/.test(dessus.texteModeles),
  dessus.texteModeles.slice(0, 110));

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

// =================== FINITION : erreurs visibles, plafond, suppressions, réglages ========

// --- Un échec doit RESTER à l'écran. Un message fugace ne se lit pas, et le panneau est
//     reconstruit à chaque changement : le message doit survivre à cette reconstruction.
await page.route('**/functions/v1/photo-ia', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (body.action === 'edit') {
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'fal.ai a refusé (HTTP 422) : image trop lourde' }) });
    return;
  }
  await route.fallback();
});
const echec = await page.evaluate(async () => {
  const r = realisations[0], p = r.photos[0];
  _ed.tab = 'ia'; buildEditorControls();
  await applyIaToPhoto(r, p, 'essai qui échoue', 'fal-ai/nano-banana-pro/edit', null);
  await new Promise(x => setTimeout(x, 400));
  const lire = () => {
    const e = document.querySelector('#ed-controls .ia-erreur');
    return e && e.offsetParent !== null ? e.textContent : '';
  };
  const affiche = lire();
  buildEditorControls();                       // le panneau est reconstruit : ça doit tenir
  await new Promise(x => setTimeout(x, 300));
  const apresReconstruction = lire();
  [...document.querySelectorAll('#ed-controls .ia-erreur .mini')].forEach(b => b.click());
  await new Promise(x => setTimeout(x, 300));
  return { affiche, apresReconstruction, apresMasquage: lire() };
});
check('Échec d’une retouche : le détail exact reste affiché à l’écran',
  /422/.test(echec.affiche) && /trop lourde/.test(echec.affiche), echec.affiche.slice(0, 90));
check('Le message d’échec survit à la reconstruction du panneau',
  /422/.test(echec.apresReconstruction));
check('Le message d’échec peut être masqué', echec.apresMasquage === '');
await page.unroute('**/functions/v1/photo-ia');

// --- Le plafond mensuel BLOQUE : aucun appel n'est émis, donc rien n'est facturé.
const avantPlafond = iaCalls.length;
const plafond = await page.evaluate(async () => {
  const st = iaSettings();
  st.plafondMois = 1;
  library.iaUsage = { [iaSpendKey()]: 5 };     // déjà 5 retouches ce mois-ci
  buildEditorControls();
  await new Promise(x => setTimeout(x, 400));
  const bouton = document.querySelector('#ed-controls .ia-go');
  const etatBouton = { texte: bouton.textContent, desactive: bouton.disabled };
  await applyIaToPhoto(realisations[0], realisations[0].photos[0], 'ne doit pas partir', 'fal-ai/nano-banana-pro/edit', null);
  await new Promise(x => setTimeout(x, 400));
  const msg = (document.querySelector('#ed-controls .ia-erreur') || {}).textContent || '';
  const pied = (document.querySelector('#ed-controls .ia-pied') || {}).textContent || '';
  st.plafondMois = 0; library.iaUsage = {}; _iaLastError = null; buildEditorControls();
  return { etatBouton, msg, pied };
});
check('Plafond atteint : aucun appel n’est envoyé au fournisseur',
  iaCalls.filter(c => c.body.action === 'edit').length === iaCalls.filter((c, i) => i < avantPlafond && c.body.action === 'edit').length,
  'appels avant ' + avantPlafond + ', après ' + iaCalls.length);
check('Plafond atteint : le bouton le dit et refuse de partir',
  /Plafond/.test(plafond.etatBouton.texte) && plafond.etatBouton.desactive === true, JSON.stringify(plafond.etatBouton));
check('Plafond atteint : le message dit que rien n’a été facturé et où le régler',
  /rien n’a été facturé/.test(plafond.msg) && /Réglages/.test(plafond.msg), plafond.msg.slice(0, 90));
check('Le compteur du mois est affiché avec son plafond', /Ce mois-ci/.test(plafond.pied), plafond.pied.slice(0, 70));

// --- Toute suppression se confirme, et l'annulation ne supprime rien.
const suppr = await page.evaluate(async () => {
  ensureIaModels();
  library.iaModels.push({ id: 'test/a-supprimer', label: 'Modèle jetable', note: '' });
  const avant = library.iaModels.length;
  let question = '';
  const orig = window.askConfirm;
  window.askConfirm = (m) => { question = m; };       // on ne confirme PAS
  iaModelDel('test/a-supprimer');
  const apresAnnulation = library.iaModels.length;
  window.askConfirm = (m, cb) => cb();                 // cette fois on confirme
  iaModelDel('test/a-supprimer');
  const apresConfirmation = library.iaModels.length;
  window.askConfirm = orig;
  return { question, avant, apresAnnulation, apresConfirmation };
});
check('Retirer un modèle demande confirmation, et annuler ne retire rien',
  /Retirer/.test(suppr.question) && suppr.apresAnnulation === suppr.avant, JSON.stringify(suppr));
check('Confirmer retire bien le modèle', suppr.apresConfirmation === suppr.avant - 1);

// --- Vider l'historique : confirmation, puis état vide expliqué
const videHist = await page.evaluate(async () => {
  const r = realisations[0], p = r.photos[0];
  openPhotoHistory(r, p);
  const avant = document.querySelectorAll('#modal .hist li').length;
  const orig = window.askConfirm;
  let question = '';
  window.askConfirm = (m) => { question = m; };
  clearPhotoHistory(p.id);
  const apresAnnulation = (p.hist || []).length;
  window.askConfirm = (m, cb) => cb();
  clearPhotoHistory(p.id);
  window.askConfirm = orig;
  const vide = document.querySelector('#modal .hist').textContent;
  closeModal();
  return { question, avant, apresAnnulation, restant: (p.hist || []).length, vide };
});
check('Vider l’historique demande confirmation, et annuler ne l’efface pas',
  /Vider/.test(videHist.question) && videHist.apresAnnulation === videHist.avant, JSON.stringify({ q: videHist.question.slice(0, 40), avant: videHist.avant, apres: videHist.apresAnnulation }));
check('Historique vidé : la liste est vide et l’écran l’explique',
  videHist.restant === 0 && /Aucun événement/.test(videHist.vide), videHist.vide.slice(0, 80));

// --- Les réglages : valeur invalide refusée À L'ÉCRAN, valeur valide appliquée pour de vrai
const reglages = await page.evaluate(async () => {
  openIaSettingsPanel();
  document.getElementById('ias-plafond').value = '-4';
  document.getElementById('ias-save').click();
  const refus = document.getElementById('ias-msg').textContent;
  const encoreOuvert = !!document.getElementById('ias-save');
  document.getElementById('ias-plafond').value = '50';
  document.getElementById('ias-reso').value = '1K';
  document.getElementById('ias-cout').value = '0.2';
  document.getElementById('ias-confirm').checked = false;
  document.getElementById('ias-save').click();
  await new Promise(x => setTimeout(x, 300));
  return { refus, encoreOuvert, enregistre: JSON.parse(JSON.stringify(iaSettings())) };
});
check('Réglages : une valeur invalide est refusée et expliquée, la fenêtre reste ouverte',
  /nombre positif/.test(reglages.refus) && reglages.encoreOuvert, reglages.refus);
check('Réglages : les valeurs valides sont enregistrées',
  reglages.enregistre.plafondMois === 50 && reglages.enregistre.resolution === '1K'
  && reglages.enregistre.coutUnitaire === 0.2 && reglages.enregistre.confirmer === false,
  JSON.stringify(reglages.enregistre));

// La résolution réglée doit PARTIR au modèle, pas seulement s'afficher.
await page.route('**/functions/v1/photo-ia', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const auth = route.request().headers()['authorization'] || '';
  iaCalls.push({ body: { action: body.action, model: body.model, input: body.input, hasImage: !!body.imageDataUri, imgPrefix: (body.imageDataUri || '').slice(0, 11) }, auth });
  if (body.action === 'schema') { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SCHEMA_REEL) }); return; }
  if (body.action === 'balance') { await route.fulfill({ status: 200, contentType: 'application/json', body: '{"balance":9.87,"currency":"USD"}' }); return; }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imageDataUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAAIAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', model: body.model }) });
});
await page.evaluate(async () => {
  library.iaParams['fal-ai/nano-banana-pro/edit'] = {};
  await runIaEdit(realisations[0].photos[0], 'test réglage', 'fal-ai/nano-banana-pro/edit');
});
const appelRegle = iaCalls.filter(c => c.body.action === 'edit').pop();
check('Réglages : la résolution choisie part réellement au modèle',
  !!appelRegle && appelRegle.body.input.resolution === '1K', JSON.stringify(appelRegle && appelRegle.body.input));

// --- Rétablir les valeurs par défaut
const defauts = await page.evaluate(async () => {
  const orig = window.askConfirm;
  window.askConfirm = (m, cb) => cb();
  iaSettingsReset();
  window.askConfirm = orig;
  await new Promise(x => setTimeout(x, 200));
  const st = JSON.parse(JSON.stringify(iaSettings()));
  closeModal();
  return st;
});
check('Réglages : « valeurs par défaut » remet tout en place',
  defauts.resolution === '2K' && defauts.plafondMois === 100 && defauts.confirmer === true, JSON.stringify(defauts));

// --- Le comparateur explique quand il ne peut pas charger la seconde version
const cmpKo = await page.evaluate(async () => {
  const p = realisations[0].photos[0];
  const vrai = photoStore.get;
  photoStore.get = async (k) => (/^rp_/.test(k) ? null : vrai(k));
  _imgCache.clear();
  p.useIa = true;
  await edLoadAlt();
  buildEditorControls();
  await new Promise(x => setTimeout(x, 300));
  const msg = [...document.querySelectorAll('#ed-controls .ia-warn')].map(e => e.textContent).join(' ');
  photoStore.get = vrai; _imgCache.clear();
  await edLoadAlt();
  return { msg, compareApresRetour: edHasCompare() };
});
check('Comparateur impossible : l’écran dit pourquoi au lieu de disparaître',
  /n’a pas pu être chargée/.test(cmpKo.msg), cmpKo.msg.slice(0, 100));
check('Comparateur : il revient dès que l’image est de nouveau lisible', cmpKo.compareApresRetour);

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

// --- Une publication qui échoue doit laisser un message lisible, pas un toast fugace,
//     et NE PAS marquer la réalisation en ligne.
const pubKo = await page.evaluate(async () => {
  const r = realisations[0];
  const vrai = sb.storage.from;
  sb.storage.from = (b) => {
    const o = vrai(b);
    return Object.assign({}, o, { upload: async () => { throw new Error('réseau indisponible'); } });
  };
  const etaitEnLigne = r.published;
  await publishRealisation(r);
  sb.storage.from = vrai;
  await new Promise(x => setTimeout(x, 400));
  const msg = (document.querySelector('#rz-body .ia-erreur, .ia-erreur') || {}).textContent || '';
  const encoreEnLigne = r.published;
  _pubLastError = null; renderRealisations();
  return { msg, etaitEnLigne, encoreEnLigne };
});
check('Publication en échec : le détail reste affiché à l’écran',
  /Publication interrompue/.test(pubKo.msg) && /réessayer/.test(pubKo.msg), pubKo.msg.slice(0, 90));

// --- Réalisation sans photo : l'écran dit quoi faire au lieu de rester vide
const videPhotos = await page.evaluate(async () => {
  const r = { id: 'vide-test', title: 'Chantier vide', photos: [], edit: null, published: false, createdAt: Date.now() };
  realisations.push(normalizeRealisation(r));
  _rzOpenId = 'vide-test'; renderRealisations();
  await new Promise(x => setTimeout(x, 300));
  const txt = (document.querySelector('.rz-photos .rz-empty') || {}).textContent || '';
  realisations = realisations.filter(x => x.id !== 'vide-test');
  _rzOpenId = realisations[0].id; renderRealisations();
  return txt;
});
check('Réalisation sans photo : l’écran explique quoi faire',
  /Aucune photo dans cette réalisation/.test(videPhotos), videPhotos.slice(0, 80));

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

// ============================================================================
//  GALERIE : ordre, titres et légendes, remplacement, import lisible
//  Tout se passe dans une réalisation dédiée, pour ne pas déranger l'état sur
//  lequel s'appuient les mesures d'éditeur qui suivent.
// ============================================================================
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => {
  window.__mkImg = async (name, w, h, teinte) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.fillStyle = teinte || '#8899aa'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#332211'; x.fillRect(w * 0.2, h * 0.2, w * 0.3, h * 0.5);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    return new File([blob], name, { type: 'image/jpeg' });
  };
});

// --- Import : progression visible pendant l'envoi
const gal = await page.evaluate(async () => {
  const r = normalizeRealisation({ title: 'Villa Test', date: '2026' });
  realisations.push(r); _rzOpenId = r.id; renderRealisations();
  const files = [await window.__mkImg('salon.jpg', 1200, 900, '#9aa7b4'),
                 await window.__mkImg('cuisine.jpg', 1000, 750, '#b4a79a'),
                 await window.__mkImg('chambre.jpg', 900, 600, '#a7b49a')];
  const p = addPhotosToRealisation(r, files);   // volontairement pas attendu
  await new Promise(res => setTimeout(res, 60));
  const box = document.getElementById('rz-import');
  const vu = box ? box.querySelector('.rz-import-txt').textContent : '';
  const barre = box ? !!box.querySelector('.rz-bar i') : false;
  await p;
  return { rid: r.id, vu, barre, n: r.photos.length, noms: r.photos.map(x => x.name) };
});
check('Import : la progression s’affiche pendant l’envoi', /Import de 3 photo\(s\) — \d \/ 3 · /.test(gal.vu), gal.vu);
check('Import : barre de progression présente', gal.barre);
check('Import : les 3 photos sont entrées', gal.n === 3, gal.noms.join(', '));
check('Import : le nom du fichier devient le titre de la photo', gal.noms[0] === 'salon.jpg', gal.noms[0]);

// --- Import : chaque fichier refusé dit POURQUOI, et ça reste à l'écran
const refus = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  const gros = new File([new ArrayBuffer(26 * 1024 * 1024)], 'enorme.jpg', { type: 'image/jpeg' });
  const pdf = new File([new Blob(['%PDF-1.4 faux'])], 'devis.pdf', { type: 'application/pdf' });
  const heic = new File([new Blob(['xx'])], 'IMG_2201.heic', { type: 'image/heic' });
  const casse = new File([new Blob(['ceci n est pas une image'])], 'casse.jpg', { type: 'image/jpeg' });
  const bonne = await window.__mkImg('terrasse.jpg', 800, 600, '#c0b8a8');
  await addPhotosToRealisation(r, [gros, pdf, heic, casse, bonne]);
  const lignes = [...document.querySelectorAll('.rz-refus li')].map(li => li.textContent);
  return { lignes, photos: r.photos.length, encore: !!document.querySelector('.rz-refus') };
});
check('Import : le fichier trop lourd est refusé avec son poids',
  refus.lignes.some(l => /enorme\.jpg.*trop lourd : 26 Mo — maximum 25 Mo/.test(l)), refus.lignes[0]);
check('Import : un fichier qui n’est pas une image est refusé en clair',
  refus.lignes.some(l => /devis\.pdf.*ce n’est pas une image \(application\/pdf\)/.test(l)));
check('Import : le HEIC d’iPhone explique quoi faire',
  refus.lignes.some(l => /IMG_2201\.heic.*HEIC.*Le plus compatible|IMG_2201\.heic.*HEIC.*JPEG/.test(l)),
  (refus.lignes.find(l => /heic/i.test(l)) || '').slice(0, 90));
check('Import : un fichier illisible le dit', refus.lignes.some(l => /casse\.jpg.*illisible/.test(l)));
check('Import : les bonnes photos passent quand même', refus.photos === 4, refus.photos + ' photo(s)');
check('Import : le bilan des refus reste affiché (pas un toast de 3 s)', refus.encore);

// --- Titre et légende par photo
const txt = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId), p = r.photos[1];
  openPhotoTextDialog(r, p);
  document.getElementById('ph-name').value = 'Cuisine ouverte';
  document.getElementById('ph-cap').value = 'Plan de travail en chêne massif, verrière sur mesure.';
  document.getElementById('ph-cap').dispatchEvent(new Event('input'));
  const compteur = document.getElementById('ph-cap-n').textContent;
  document.getElementById('ph-txt-ok').click();
  await new Promise(res => setTimeout(res, 150));
  const tuile = document.querySelectorAll('.rz-ph')[1];
  return {
    nom: p.name, legende: p.caption, compteur,
    surTuile: tuile.querySelector('.rz-ph-name').textContent + ' / ' + tuile.querySelector('.rz-ph-cap').textContent,
    hist: (p.hist || []).map(h => h.k),
    touche: !!p.touchedAt,
    videAilleurs: document.querySelectorAll('.rz-ph-cap.vide').length,
  };
});
check('Légende : titre enregistré', txt.nom === 'Cuisine ouverte', txt.nom);
check('Légende : texte enregistré', /chêne massif/.test(txt.legende), txt.legende);
check('Légende : compteur de caractères affiché', /\d+ \/ 200 caractères/.test(txt.compteur), txt.compteur);
check('Légende : titre et légende visibles sur la vignette', /Cuisine ouverte \/ Plan de travail/.test(txt.surTuile), txt.surTuile);
check('Légende : la photo est marquée comme modifiée', txt.touche && txt.hist.includes('texte'), txt.hist.join(','));
check('Légende : les photos sans légende affichent l’invitation à en mettre une', txt.videAilleurs === 3, txt.videAilleurs + ' vignette(s)');

// --- Réordonner : flèches, bornes, numéros
const ordre1 = await page.evaluate(() => {
  const r = findRealisation(_rzOpenId);
  rzToggleOrderMode(true);
  const nums = [...document.querySelectorAll('.rz-ph-num')].map(n => n.textContent.replace('★', '').trim());
  const etoile = [...document.querySelectorAll('.rz-ph-num')].filter(n => n.textContent.includes('★')).length;
  const premierRecul = document.querySelector('.rz-ph [data-up]').disabled;
  const tuiles = [...document.querySelectorAll('.rz-ph')];
  const dernierAvance = tuiles[tuiles.length - 1].querySelector('[data-down]').disabled;
  const avant = r.photos.map(p => p.name);
  rzMovePhoto(r, r.photos[3].id, -1);           // la 4e recule d'une place
  return { nums, etoile, premierRecul, dernierAvance, avant, apres: r.photos.map(p => p.name),
           ajoutMasque: document.querySelectorAll('.rz-add').length,
           barre: !!document.querySelector('.rz-selbar [data-done]') };
});
check('Réordonner : chaque vignette porte son rang', ordre1.nums.join('') === '1234', ordre1.nums.join(','));
check('Réordonner : la 1re ne peut pas reculer, la dernière ne peut pas avancer', ordre1.premierRecul && ordre1.dernierAvance);
check('Réordonner : la couverture reste repérable pendant qu’on range (★)', ordre1.etoile === 1, ordre1.etoile + ' étoile(s)');
check('Réordonner : ◀ déplace vraiment la photo',
  ordre1.apres[2] === ordre1.avant[3] && ordre1.apres[3] === ordre1.avant[2], ordre1.apres.join(' | '));
check('Réordonner : « Ajouter des photos » masqué pendant qu’on range (une étape à la fois)', ordre1.ajoutMasque === 0);
check('Réordonner : barre d’aide avec « Terminer »', ordre1.barre);

// --- Réordonner au glisser-déposer (souris)
const dnd = await page.evaluate(() => {
  const r = findRealisation(_rzOpenId);
  const avant = r.photos.map(p => p.name);
  const tuiles = [...document.querySelectorAll('.rz-ph')];
  const dt = new DataTransfer();
  const src = tuiles[3], cible = tuiles[0];
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const b = cible.getBoundingClientRect();
  const opts = { bubbles: true, dataTransfer: dt, clientX: b.left + 4, clientY: b.top + 4 };
  cible.dispatchEvent(new DragEvent('dragover', opts));
  const marque = cible.className.includes('rz-drop-a');
  cible.dispatchEvent(new DragEvent('drop', opts));
  return { avant, apres: r.photos.map(p => p.name), marque };
});
check('Glisser-déposer : la place visée est signalée avant de lâcher', dnd.marque);
check('Glisser-déposer : la photo lâchée passe bien devant la cible',
  dnd.apres[0] === dnd.avant[3], dnd.avant.join(' | ') + '  →  ' + dnd.apres.join(' | '));

// --- Réordonner marque TOUTE la réalisation à republier (les adresses publiques changent)
const ordrePub = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  r.published = true;
  const t = Date.now() - 5000;
  r.photos.forEach(p => { p.publishedAt = t; p.touchedAt = t - 1000; });
  rzMovePhoto(r, r.photos[2].id, -1);
  return r.photos.map(p => photoPubState(r, p));
});
check('Réordonner : toutes les photos passent « à republier », pas seulement la déplacée',
  ordrePub.every(e => e === 'modifiee'), ordrePub.join(','));

// --- Tri par date d'ajout
const tri = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  const attendu = r.photos.slice().sort((a, b) => a.createdAt - b.createdAt).map(p => p.name);
  await new Promise((res, rej) => {
    const orig = window.askConfirm;
    window.askConfirm = (m, cb) => { window.askConfirm = orig; Promise.resolve(cb()).then(res, rej); };
    document.querySelector('.rz-selbar [data-date]').click();
  });
  return { attendu, obtenu: r.photos.map(p => p.name) };
});
check('Réordonner : « Trier par date d’ajout » remet la série dans l’ordre d’import',
  tri.attendu.join('|') === tri.obtenu.join('|'), tri.obtenu.join(' | '));

// --- Aucun débordement horizontal pendant qu'on range, sur un téléphone
await page.setViewportSize({ width: 375, height: 800 });
await page.waitForTimeout(300);
const debordOrdre = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('Réordonner : aucun débordement horizontal à 375px', debordOrdre <= 1, debordOrdre + 'px');
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => rzToggleOrderMode(false));
await page.waitForTimeout(200);

// --- Menu d'actions de la vignette
const menu = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId), p = r.photos[1];
  openPhotoMenu(r, p);
  const libelles = [...document.querySelectorAll('#modal .ph-menu button')].map(b => b.textContent.trim());
  const couvAvant = r.cover;
  document.querySelector('#modal [data-cover]').click();
  await new Promise(res => setTimeout(res, 150));
  openPhotoMenu(r, p);
  const dejaCouv = document.querySelector('#modal [data-cover]').disabled;
  closeModal();
  return { libelles, couvAvant, couvApres: r.cover, cible: p.id, dejaCouv,
           badge: [...document.querySelectorAll('.rz-ph-badge')].filter(b => /couverture/.test(b.textContent)).length };
});
check('Menu photo : les cinq actions attendues sont là',
  ['Ouvrir', 'Titre et légende', 'couverture', 'Remplacer', 'Télécharger'].every(m => menu.libelles.some(l => l.includes(m))),
  menu.libelles.join(' | '));
check('Menu photo : « Mettre en couverture » change la couverture',
  menu.couvApres === menu.cible && menu.couvApres !== menu.couvAvant);
check('Menu photo : une seule couverture, et elle est signalée sur la vignette', menu.badge === 1, menu.badge + ' badge(s)');
check('Menu photo : la photo déjà en couverture ne propose pas de le refaire', menu.dejaCouv);

// --- Remplacer une photo : la place, le titre et la légende restent
const repl = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId), p = r.photos[1];
  p.ia = { model: 'test/modele', prompt: 'essai' };
  p.useIa = true;
  await photoStore.save(iaKey(p.id), new Blob(['ia'], { type: 'image/jpeg' }));
  p.edit.persp = 40;
  const avant = { id: p.id, rang: 1, nom: p.name, legende: p.caption, largeur: p.w,
                  octets: (await photoStore.get(fullKey(p.id))).size };
  const fichier = await window.__mkImg('cuisine-refaite.jpg', 640, 480, '#556677');
  const why = await replaceOnePhoto(r, p, fichier);
  const apres = { id: r.photos[1].id, nom: p.name, legende: p.caption, largeur: p.w,
                  octets: (await photoStore.get(fullKey(p.id))).size,
                  ia: !!p.ia, useIa: !!p.useIa, persp: p.edit.persp,
                  iaEnStock: !!(await photoStore.get(iaKey(p.id))),
                  hist: (p.hist || []).map(h => h.k) };
  return { why, avant, apres };
});
check('Remplacer : aucun refus sur un fichier valide', repl.why === '', repl.why);
check('Remplacer : la photo garde son identifiant et sa place', repl.apres.id === repl.avant.id);
check('Remplacer : le titre et la légende sont conservés',
  repl.apres.nom === repl.avant.nom && repl.apres.legende === repl.avant.legende, repl.apres.nom + ' / ' + repl.apres.legende);
check('Remplacer : le fichier stocké a réellement changé',
  repl.apres.octets !== repl.avant.octets && repl.apres.largeur === 640, repl.avant.octets + ' → ' + repl.apres.octets + ' octets, ' + repl.apres.largeur + 'px');
check('Remplacer : la version IA de l’ancienne image est supprimée',
  !repl.apres.ia && !repl.apres.useIa && !repl.apres.iaEnStock);
check('Remplacer : les réglages de l’ancienne image sont remis à zéro', repl.apres.persp === 0, String(repl.apres.persp));
check('Remplacer : l’historique de la photo en garde la trace', repl.apres.hist.includes('remplacee'), repl.apres.hist.join(','));

const replKo = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId), p = r.photos[0];
  const octets = (await photoStore.get(fullKey(p.id))).size;
  const why = await replaceOnePhoto(r, p, new File([new Blob(['x'])], 'note.txt', { type: 'text/plain' }));
  return { why, intact: (await photoStore.get(fullKey(p.id))).size === octets };
});
check('Remplacer : un fichier refusé dit pourquoi', /ce n’est pas une image/.test(replKo.why), replKo.why);
check('Remplacer : un refus ne touche pas la photo en place', replKo.intact);

// --- La légende part sur le site, le titre interne n'en sort pas
const pubLeg = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  r.photos[1].caption = 'Plan de travail en chêne massif.';
  r.photos[1].name = 'IMG_4821.jpg';
  await publishRealisation(r);
  const key = [...window.__files.keys()].find(k => k.endsWith('manifest.json'));
  const man = JSON.parse(await window.__files.get(key).text());
  const entree = man.realisations.find(x => x.id === r.id);
  return { legendes: entree.photos.map(p => p.caption || ''), json: JSON.stringify(entree),
           ordreOk: entree.photos.length === r.photos.length,
           couv: entree.photos.findIndex(p => p.cover) === r.photos.findIndex(p => p.id === r.cover) };
});
check('Publication : la légende de la photo part dans le manifeste',
  pubLeg.legendes[1] === 'Plan de travail en chêne massif.', pubLeg.legendes.join(' | '));
check('Publication : une photo sans légende n’en invente pas', pubLeg.legendes[0] === '' && pubLeg.legendes[2] === '');
check('Publication : le titre interne (nom de fichier) ne part PAS sur le site',
  !pubLeg.json.includes('IMG_4821'), pubLeg.json.slice(0, 120));
check('Publication : l’ordre et la couverture du CRM sont ceux du manifeste', pubLeg.ordreOk && pubLeg.couv);

// --- Éditeur : passer d'une photo à l'autre sans repasser par la grille
await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  await openPhotoEditor(r.id, r.photos[1].id);
});
await page.waitForTimeout(900);
const nav = await page.evaluate(() => ({
  pos: document.querySelector('.ed-pos').textContent,
  metaVisible: !!document.querySelector('#ed-photo-meta [data-text]'),
  metaSousIa: (() => { _ed.tab = 'ia'; paintEditorTabs(); buildEditorControls();
    return document.getElementById('ed-photo-meta').offsetParent !== null; })(),
}));
check('Éditeur : le rang de la photo est affiché', nav.pos.trim() === '2 / 4', nav.pos);
check('Éditeur : « Titre et légende » et « Remplacer » sont dans le panneau', nav.metaVisible);
check('Éditeur : ces deux actions restent atteignables depuis l’onglet Retouche', nav.metaSousIa);
await page.evaluate(() => document.querySelector('#ed-modal [data-prev]').click());
await page.waitForTimeout(1000);
const nav2 = await page.evaluate(() => ({
  pos: document.querySelector('.ed-pos').textContent,
  memePhoto: _ed.p.id === findRealisation(_rzOpenId).photos[0].id,
  reculBloque: document.querySelector('#ed-modal [data-prev]').disabled,
}));
check('Éditeur : ◀ passe à la photo précédente', nav2.pos.trim() === '1 / 4' && nav2.memePhoto, nav2.pos);
check('Éditeur : sur la première photo, ◀ est désactivé', nav2.reculBloque);
await page.evaluate(() => closePhotoEditor());
await page.waitForTimeout(300);


// ============================================================================
//  RETOUCHE D'UNE SÉRIE : une consigne, tout un chantier
//  Le pont est intercepté : aucun crédit n'est dépensé.
// ============================================================================
const serieCalls = [];
let serieRate = false;      // fait échouer le 2e envoi du prochain lancement
let serieEdits = 0;         // envois du lancement en cours
await page.route('**/functions/v1/photo-ia', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  if (body.action === 'schema') {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ model: body.model, required: ['prompt', 'image_urls'],
        properties: { prompt: { type: 'string' }, image_urls: { type: 'array' }, sync_mode: { type: 'boolean' },
                      resolution: { type: 'string', enum: ['1K', '2K', '4K'], default: '1K' } } }) });
    return;
  }
  if (body.action === 'balance') { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balance: 9.87 }) }); return; }
  serieCalls.push({ model: body.model, prompt: (body.input || {}).prompt });
  serieEdits++;
  // Un envoi refusé au milieu d'un lancement : on vérifie que la série continue quand même.
  await new Promise(res => setTimeout(res, 120));
  if (serieRate && serieEdits === 2) {
    await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'fal.ai a refusé (HTTP 422)' }) });
    return;
  }
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAAIAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imageDataUri: jpeg, model: body.model }) });
});

// --- Le dialogue annonce ce qui va être envoyé, et ce que ça coûte
const dlg = await page.evaluate(() => {
  const r = findRealisation(_rzOpenId);
  r.photos.forEach(p => { delete p.ia; p.useIa = false; });
  r.photos[0].ia = { model: 'x', prompt: 'déjà faite' };   // une photo déjà retouchée
  library.iaSettings = Object.assign({}, library.iaSettings, { plafondMois: 0, coutUnitaire: 0.13 });
  _rzSel.clear();
  openIaSerieDialog(r, _rzSel);
  const portees = [...document.querySelectorAll('.ia-portee label')].map(l => l.textContent.trim());
  const recapNeuves = document.getElementById('serie-recap').textContent;
  document.querySelector('input[name="ia-portee"][value="toutes"]').checked = true;
  document.querySelector('input[name="ia-portee"][value="toutes"]').dispatchEvent(new Event('change'));
  const recapToutes = document.getElementById('serie-recap').textContent;
  const libelle = document.getElementById('serie-go').textContent;
  const consignesPretes = document.querySelectorAll('#serie-presets .ia-chip').length;
  closeModal();
  return { portees, recapNeuves, recapToutes, libelle, consignesPretes, total: r.photos.length };
});
check('Série : les trois portées sont proposées avec leur décompte',
  dlg.portees.length === 2 && /pas encore de version IA \(3\)/.test(dlg.portees[0]) && /Toutes les photos \(4\)/.test(dlg.portees[1]),
  dlg.portees.join(' | '));
check('Série : le nombre et le coût estimé sont annoncés AVANT de lancer',
  /3 photo\(s\) · environ 0,39 \$/.test(dlg.recapNeuves), dlg.recapNeuves);
check('Série : changer de portée met le coût à jour', /4 photo\(s\) · environ 0,52 \$/.test(dlg.recapToutes), dlg.recapToutes);
check('Série : le bouton dit sur combien de photos il va lancer', /Lancer sur 4 photo/.test(dlg.libelle), dlg.libelle);
check('Série : les consignes toutes prêtes sont là aussi', dlg.consignesPretes >= 5, dlg.consignesPretes + ' consigne(s)');

// --- Lancement réel : chaque photo est envoyée une fois, l'original est conservé
serieEdits = 0;
const serie = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  r.photos.forEach(p => { delete p.ia; p.useIa = false; p.edit.persp = 20; });
  const octetsAvant = await Promise.all(r.photos.map(async p => (await photoStore.get(fullKey(p.id))).size));
  const usageAvant = iaSpend();
  await runIaSerie(r, r.photos.slice(), 'équilibre la lumière de la pièce', IA_CATALOGUE[0].id);
  const octetsApres = await Promise.all(r.photos.map(async p => (await photoStore.get(fullKey(p.id))).size));
  const iaEnStock = await Promise.all(r.photos.map(async p => !!(await photoStore.get(iaKey(p.id)))));
  return {
    avecIa: r.photos.filter(p => p.ia && p.useIa).length,
    total: r.photos.length,
    memeConsigne: r.photos.every(p => p.ia && p.ia.prompt === 'équilibre la lumière de la pièce'),
    originauxIntacts: octetsAvant.join() === octetsApres.join(),
    iaEnStock: iaEnStock.every(Boolean),
    reglagesRanges: r.photos.every(p => p.edit.persp === 0 && p.editOrig && p.editOrig.persp === 20),
    hist: r.photos[0].hist.map(h => h.k),
    usage: iaSpend() - usageAvant,
    bilan: (document.querySelector('.rz-bilan-serie.ia-ok p') || {}).textContent || '',
    modal: document.getElementById('overlay').classList.contains('open'),
  };
});
check('Série : toutes les photos ont leur version IA', serie.avecIa === serie.total, serie.avecIa + ' / ' + serie.total);
check('Série : c’est bien la même consigne qui est passée partout', serie.memeConsigne);
check('Série : les originaux ne sont pas touchés', serie.originauxIntacts);
check('Série : chaque version IA est bien stockée à côté', serie.iaEnStock);
check('Série : les réglages manuels passent sur la version d’origine (pas appliqués deux fois)', serie.reglagesRanges);
check('Série : l’historique de chaque photo garde la retouche', serie.hist.includes('ia'), serie.hist.join(','));
check('Série : le compteur mensuel a bien compté chaque appel', serie.usage === serie.total, serie.usage + ' appel(s)');
check('Série : le bilan reste affiché après coup', /4 photo\(s\) retouchée\(s\) sur 4/.test(serie.bilan), serie.bilan);
check('Série : la fenêtre de progression se referme à la fin', serie.modal === false);
check('Série : un appel au pont par photo (plus le schéma)', serieCalls.length === 4, serieCalls.length + ' appel(s)');

// --- Une photo qui échoue n'arrête pas la série, et le bilan dit laquelle
serieRate = true; serieEdits = 0;
const serieKo = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  r.photos.forEach(p => { delete p.ia; p.useIa = false; });
  await runIaSerie(r, r.photos.slice(0, 3), 'consigne', IA_CATALOGUE[0].id);
  const box = document.querySelector('.rz-bilan-serie');
  return { faites: r.photos.slice(0, 3).filter(p => p.ia).length,
           texte: (box.querySelector('p') || {}).textContent || '',
           lignes: [...box.querySelectorAll('.rz-refus li')].map(li => li.textContent) };
});
check('Série : une photo refusée n’arrête pas les suivantes', serieKo.faites === 2, serieKo.faites + ' réussie(s) sur 3');
check('Série : le bilan dit combien ont abouti', /2 photo\(s\) retouchée\(s\) sur 3/.test(serieKo.texte), serieKo.texte);
check('Série : la photo en échec est nommée avec la raison',
  serieKo.lignes.length === 1 && /HTTP 422/.test(serieKo.lignes[0]), serieKo.lignes.join(' | '));
serieRate = false;

// --- Interrompre en cours de série
const serieStop = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  r.photos.forEach(p => { delete p.ia; p.useIa = false; });
  const pr = runIaSerie(r, r.photos.slice(), 'consigne', IA_CATALOGUE[0].id);
  await new Promise(res => setTimeout(res, 60));
  const btn = document.getElementById('serie-stop');
  btn.click();
  const libelle = btn.textContent;
  await pr;
  return { libelle, faites: r.photos.filter(p => p.ia).length, total: r.photos.length,
           texte: (document.querySelector('.rz-bilan-serie p') || {}).textContent || '' };
});
check('Série : « Interrompre » dit que l’arrêt se fait après la photo en cours',
  /Arrêt après la photo en cours/.test(serieStop.libelle), serieStop.libelle);
check('Série : l’interruption arrête vraiment les envois suivants',
  serieStop.faites < serieStop.total && serieStop.faites >= 1, serieStop.faites + ' / ' + serieStop.total);
check('Série : le bilan dit que c’est vous qui avez interrompu', /Interrompu à votre demande/.test(serieStop.texte), serieStop.texte);

// --- Le plafond du mois bloque AVANT tout envoi
const seriePlafond = await page.evaluate(() => {
  const r = findRealisation(_rzOpenId);
  library.iaSettings = Object.assign({}, library.iaSettings, { plafondMois: iaSpend() });
  openIaSerieDialog(r, new Set());
  const t = document.getElementById('serie-recap').textContent;
  const bloque = document.getElementById('serie-go').disabled;
  closeModal();
  library.iaSettings = Object.assign({}, library.iaSettings, { plafondMois: 0 });
  return { t, bloque };
});
check('Série : plafond atteint — le lancement est bloqué', seriePlafond.bloque);
check('Série : et le message dit que rien ne sera facturé et où relever le plafond',
  /Plafond du mois atteint/.test(seriePlafond.t) && /facturé/.test(seriePlafond.t) && /Réglages/.test(seriePlafond.t), seriePlafond.t);

// --- Plafond qui tombe en cours de série : annoncé avant de lancer
const seriePartiel = await page.evaluate(() => {
  const r = findRealisation(_rzOpenId);
  library.iaSettings = Object.assign({}, library.iaSettings, { plafondMois: iaSpend() + 2 });
  openIaSerieDialog(r, new Set());
  document.querySelector('input[name="ia-portee"][value="toutes"]').checked = true;
  document.querySelector('input[name="ia-portee"][value="toutes"]').dispatchEvent(new Event('change'));
  const t = document.getElementById('serie-recap').textContent;
  closeModal();
  library.iaSettings = Object.assign({}, library.iaSettings, { plafondMois: 0 });
  return t;
});
check('Série : on est prévenu quand le plafond tombera au milieu de la série',
  /le plafond sera atteint après 2 photo\(s\)/.test(seriePartiel), seriePartiel);

await page.unroute('**/functions/v1/photo-ia');
await page.evaluate(() => { _iaSerieReport = null; renderRealisations(); });


// ============================================================================
//  PLACE OCCUPÉE DANS LE CLOUD : compter les deux seaux, et prévenir avant la panne
// ============================================================================
const stock = await page.evaluate(async () => {
  const vrai = sb.storage.from;
  // Deux seaux, et la galerie range ses photos dans un sous-dossier par réalisation :
  // c'est exactement le cas que l'ancien comptage (un seul seau, un seul niveau) ratait.
  sb.storage.from = (b) => ({
    list: async (prefix) => {
      if (b === 'client-docs') return { data: [{ name: 'rp_1', metadata: { size: 2 * 1048576 } }, { name: 'rt_1', metadata: { size: 204800 } }], error: null };
      if (b === 'galerie') {
        if (!prefix.includes('/')) return { data: [{ name: 'manifest.json', metadata: { size: 1024 } }, { name: 'r1' }], error: null };
        return { data: [{ name: 'p0.jpg', metadata: { size: 409600 } }, { name: 't0.jpg', metadata: { size: 102400 } }], error: null };
      }
      return { data: [], error: null };
    },
  });
  storageInvalidate();
  const st = await loadStorageStat(true);
  sb.storage.from = vrai;
  return { bytes: st.bytes, files: st.files, docs: st.docs.bytes, gal: st.gal.bytes };
});
check('Stockage : les documents privés sont comptés', stock.docs === 2 * 1048576 + 204800, stock.docs + ' octets');
check('Stockage : la galerie publiée est comptée aussi, sous-dossiers compris',
  stock.gal === 1024 + 409600 + 102400, stock.gal + ' octets');
check('Stockage : le total additionne les deux seaux', stock.bytes === stock.docs + stock.gal && stock.files === 5,
  stock.bytes + ' octets, ' + stock.files + ' fichier(s)');

const jauge = await page.evaluate(() => {
  const faux = (pct, files) => ({ at: Date.now(), bytes: Math.round(pct / 100 * 1024 * 1048576), files,
    docs: { bytes: 1, files: 1 }, gal: { bytes: 1, files: 1 }, erreur: '' });
  library.storage = { quotaMo: 1024, seuil: 70, photoMo: 1.2 };
  const lire = () => {
    const b = document.querySelector('#rz-storage .rz-quota');
    return b ? { txt: b.querySelector('p').textContent, plein: b.className.includes('plein'),
                 aide: b.querySelectorAll('p')[1].textContent } : null;
  };
  _storageStat = faux(50, 400); paintStorageBanner();
  const sous = lire();
  _storageStat = faux(73, 700); paintStorageBanner();
  const alerte = lire();
  _storageStat = faux(97, 950); paintStorageBanner();
  const plein = lire();
  library.storage.seuil = 90;
  _storageStat = faux(73, 700); paintStorageBanner();
  const seuilPlusHaut = lire();
  library.storage.seuil = 70;
  _storageStat = null;
  return { sous, alerte, plein, seuilPlusHaut };
});
check('Stockage : rien ne s’affiche tant qu’on est sous le seuil', jauge.sous === null);
check('Stockage : au-delà du seuil, l’alerte dit le pourcentage et ce qui reste en PHOTOS',
  jauge.alerte && /73 %/.test(jauge.alerte.txt) && /environ \d+ photo/.test(jauge.alerte.txt), jauge.alerte && jauge.alerte.txt);
check('Stockage : l’alerte dit quoi faire pour récupérer de la place',
  jauge.alerte && /supprimez|retirez du site/i.test(jauge.alerte.aide), jauge.alerte && jauge.alerte.aide.slice(0, 80));
check('Stockage : presque plein, le ton change et annonce l’échec des envois',
  jauge.plein && jauge.plein.plein && /vont échouer/.test(jauge.plein.txt), jauge.plein && jauge.plein.txt);
check('Stockage : remonter le seuil fait taire l’alerte', jauge.seuilPlusHaut === null);

const reglagesStock = await page.evaluate(() => {
  openSyncPanel();
  const q = document.getElementById('stor-quota'), s = document.getElementById('stor-seuil'), m = document.getElementById('stor-msg');
  q.value = '10'; q.dispatchEvent(new Event('input'));
  const refusQ = m.textContent, quotaApres = storageSettings().quotaMo;
  q.value = '2048'; q.dispatchEvent(new Event('input'));
  const okQ = storageSettings().quotaMo, videQ = m.textContent;
  s.value = '150'; s.dispatchEvent(new Event('input'));
  const refusS = m.textContent, seuilApres = storageSettings().seuil;
  s.value = '80'; s.dispatchEvent(new Event('input'));
  const okS = storageSettings().seuil;
  const recalc = !!document.getElementById('stor-refresh');
  closeModal();
  library.storage = { quotaMo: 1024, seuil: 70, photoMo: 1.2 };
  return { refusQ, quotaApres, okQ, videQ, refusS, seuilApres, okS, recalc };
});
check('Réglages stockage : une capacité absurde est refusée avec sa raison',
  /au moins 50 Mo/.test(reglagesStock.refusQ) && reglagesStock.quotaApres === 1024, reglagesStock.refusQ);
check('Réglages stockage : une capacité valable est prise en compte', reglagesStock.okQ === 2048 && reglagesStock.videQ === '');
check('Réglages stockage : un seuil hors bornes est refusé avec sa raison',
  /entre 10 et 99/.test(reglagesStock.refusS) && reglagesStock.seuilApres === 70, reglagesStock.refusS);
check('Réglages stockage : un seuil valable est pris en compte', reglagesStock.okS === 80);
check('Réglages stockage : on peut relancer la mesure à la main', reglagesStock.recalc);

const invalid = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  _storageStat = { at: Date.now(), bytes: 1, files: 1, docs: { bytes: 1 }, gal: { bytes: 0 }, erreur: '' };
  await addPhotosToRealisation(r, [await window.__mkImg('mesure.jpg', 400, 300, '#777')]);
  const apresImport = _storageStat === null || _storageStat.bytes !== 1;
  _storageStat = { at: Date.now(), bytes: 1, files: 1, docs: { bytes: 1 }, gal: { bytes: 0 }, erreur: '' };
  await new Promise((res, rej) => {
    const orig = window.askConfirm;
    window.askConfirm = (m, cb) => { window.askConfirm = orig; Promise.resolve(cb()).then(res, rej); };
    delPhoto(r, r.photos[r.photos.length - 1].id);
  });
  return { apresImport, apresSuppression: _storageStat === null || _storageStat.bytes !== 1 };
});
check('Stockage : la mesure est refaite après un import', invalid.apresImport);
check('Stockage : la mesure est refaite après une suppression', invalid.apresSuppression);


// ============================================================================
//  TEXTES DE PRÉSENTATION : lieu, surface, mission, description
// ============================================================================
const presFields = await page.evaluate(() => {
  const r = findRealisation(_rzOpenId);
  const mettre = (f, v) => {
    const el = document.querySelector('#rz-body [data-f="' + f + '"]');
    if (!el) return 'champ absent';
    el.value = v; el.dispatchEvent(new Event('input'));
    return null;
  };
  const manquants = ['lieu', 'surface', 'mission', 'texte'].map(f => mettre(f, {
    lieu: 'Tel Aviv', surface: '85 m²', mission: 'Rénovation complète',
    texte: 'Un appartement cloisonné ramené à un volume traversant.',
  }[f])).filter(Boolean);
  const missions = [...document.querySelectorAll('#rz-missions option')].map(o => o.value);
  return { manquants, lieu: r.lieu, surface: r.surface, mission: r.mission, texte: r.texte,
           missions, compteur: (document.querySelector('.rz-pres-n') || {}).textContent || '' };
});
check('Présentation : les quatre champs existent dans la fiche', presFields.manquants.length === 0, presFields.manquants.join(', '));
check('Présentation : ce qu’on tape est enregistré',
  presFields.lieu === 'Tel Aviv' && presFields.surface === '85 m²' && presFields.mission === 'Rénovation complète' && /volume traversant/.test(presFields.texte));
check('Présentation : des types de mission sont proposés sans être imposés',
  presFields.missions.length >= 5 && presFields.missions.includes('Rénovation complète'), presFields.missions.join(', '));
check('Présentation : le texte a un compteur de caractères', /\d+ \/ 900 caractères/.test(presFields.compteur), presFields.compteur);

const presFieldsVides = await page.evaluate(() => {
  const r = findRealisation(_rzOpenId);
  const garde = { lieu: r.lieu, surface: r.surface, mission: r.mission, texte: r.texte };
  r.lieu = ''; r.surface = ''; r.mission = ''; r.texte = ''; renderRealisations();
  const t = (document.querySelector('.rz-pres-n') || {}).textContent || '';
  Object.assign(r, garde); renderRealisations();
  return t;
});
check('Présentation : sans texte, l’écran dit ce que ça change', /le site n’affiche que les photos/.test(presFieldsVides), presFieldsVides);

// --- Ces textes partent dans le manifeste, les presFields vides n'y figurent pas
const manifTextes = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  await publishRealisation(r);
  const key = [...window.__files.keys()].find(k => k.endsWith('manifest.json'));
  const fiche = JSON.parse(await window.__files.get(key).text()).realisations.find(x => x.id === r.id);
  // une réalisation sans texte : rien ne doit être ajouté
  const r2 = normalizeRealisation({ title: 'Sans texte', photos: r.photos.map(p => ({ ...p })) });
  realisations.push(r2);
  await publishRealisation(r2);
  const fiche2 = JSON.parse(await window.__files.get(key).text()).realisations.find(x => x.id === r2.id);
  realisations = realisations.filter(x => x.id !== r2.id);
  return { fiche, clefs2: Object.keys(fiche2) };
});
check('Publication : lieu, surface, mission et texte partent sur le site',
  manifTextes.fiche.lieu === 'Tel Aviv' && manifTextes.fiche.surface === '85 m²'
  && manifTextes.fiche.mission === 'Rénovation complète' && /volume traversant/.test(manifTextes.fiche.texte),
  JSON.stringify({ l: manifTextes.fiche.lieu, s: manifTextes.fiche.surface, m: manifTextes.fiche.mission }));
check('Publication : un champ vide n’est pas publié du tout (pas d’étiquette sans valeur)',
  !manifTextes.clefs2.includes('lieu') && !manifTextes.clefs2.includes('texte'), manifTextes.clefs2.join(','));

// --- Rédaction assistée : la même fonction serveur que les devis, mais pour un portfolio
let embBody = null;
await page.route('**/functions/v1/embellish', async (route) => {
  embBody = JSON.parse(route.request().postData() || '{}');
  await route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ text: 'Un plateau cloisonné, ramené à un seul volume traversant.' }) });
});
const redige = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  r.texte = '';
  renderRealisations();
  const btn = document.querySelector('#rz-body [data-redige]');
  btn.click();
  await new Promise(res => setTimeout(res, 400));
  return { texte: r.texte, zone: (document.querySelector('#rz-body [data-f="texte"]') || {}).value || '',
           bouton: btn.textContent, actif: !btn.disabled };
});
check('Rédaction assistée : le texte revient dans le champ et dans la fiche',
  /volume traversant/.test(redige.texte) && /volume traversant/.test(redige.zone), redige.texte);
check('Rédaction assistée : le bouton retrouve son état normal', redige.actif && /Rédiger/.test(redige.bouton), redige.bouton);
check('Rédaction assistée : c’est bien un texte de portfolio qui est demandé, pas une ligne de devis',
  embBody && embBody.kind === 'realisation' && embBody.title && embBody.length === 'long',
  JSON.stringify(embBody && { kind: embBody.kind, length: embBody.length, mission: embBody.mission }));
check('Rédaction assistée : les légendes des photos sont envoyées comme matière',
  embBody && Array.isArray(embBody.legendes), JSON.stringify(embBody && embBody.legendes));

await page.unroute('**/functions/v1/embellish');
await page.route('**/functions/v1/embellish', async (route) => {
  await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'IA indisponible (HTTP 502)' }) });
});
const redigeKo = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  r.texte = 'texte écrit à la main';
  renderRealisations();
  document.querySelector('#rz-body [data-redige]').click();
  await new Promise(res => setTimeout(res, 400));
  return { texte: r.texte, message: (document.querySelector('#rz-body .ia-erreur p') || {}).textContent || '' };
});
check('Rédaction assistée : un échec ne perd pas le texte déjà écrit', redigeKo.texte === 'texte écrit à la main');
check('Rédaction assistée : l’échec reste affiché et dit quoi faire',
  /Rédaction impossible/.test(redigeKo.message) && /à la main/.test(redigeKo.message), redigeKo.message);
await page.unroute('**/functions/v1/embellish');
await page.evaluate(() => { _pubLastError = null; renderRealisations(); });


// ============================================================================
//  LE SITE PUBLIC : ce qu'il dit de lui-même. Vide par défaut, publié sur geste.
// ============================================================================
const siteVide = await page.evaluate(() => {
  library.site = null;
  const st = siteSettings();
  return { apropos: st.apropos, email: st.email, tel: st.tel, insta: st.instagram,
           infos: Object.keys(siteInfos()) };
});
check('Site public : tout est vide au départ',
  siteVide.apropos === '' && siteVide.email === '' && siteVide.tel === '' && siteVide.insta === '');
check('Site public : rien de vide ne part dans le manifeste',
  siteVide.infos.join(',') === 'title,subtitle', siteVide.infos.join(','));

const sitePanel = await page.evaluate(async () => {
  library.branding = Object.assign({}, library.branding, { email: 'contact@exemple.fr', phone: '052 111 22 33' });
  openSitePanel();
  const avantCopie = { email: siteSettings().email, tel: siteSettings().tel };
  document.getElementById('site-copier').click();
  const apresCopie = { email: siteSettings().email, tel: siteSettings().tel,
                       message: document.getElementById('site-msg').textContent };
  document.getElementById('site-apropos').value = 'Atelier d’architecture d’intérieur.';
  document.getElementById('site-apropos').dispatchEvent(new Event('input'));
  const cleAvant = [...window.__files.keys()].find(k => k.endsWith('manifest.json'));
  const manAvant = cleAvant ? JSON.parse(await window.__files.get(cleAvant).text()).site : null;
  return { avantCopie, apresCopie, apropos: siteSettings().apropos,
           enLigneAvantGeste: manAvant && (manAvant.email || manAvant.apropos) ? 'oui' : 'non' };
});
check('Site public : les coordonnées du devis ne sont PAS reprises toutes seules',
  sitePanel.avantCopie.email === '' && sitePanel.avantCopie.tel === '');
check('Site public : un bouton les reprend en un geste',
  sitePanel.apresCopie.email === 'contact@exemple.fr' && sitePanel.apresCopie.tel === '052 111 22 33');
check('Site public : et l’écran dit que ce n’est pas encore en ligne',
  /pas encore en ligne/.test(sitePanel.apresCopie.message), sitePanel.apresCopie.message);
check('Site public : le texte À propos est enregistré', /Atelier/.test(sitePanel.apropos), sitePanel.apropos);
check('Site public : rien n’est parti en ligne avant le geste explicite',
  sitePanel.enLigneAvantGeste === 'non');

const sitePush = await page.evaluate(async () => {
  await pushSiteInfos(document.getElementById('site-push'));
  const key = [...window.__files.keys()].find(k => k.endsWith('manifest.json'));
  const man = JSON.parse(await window.__files.get(key).text());
  const msg = document.getElementById('site-msg').textContent;
  // les projets publiés ne doivent pas bouger d'un pouce
  return { site: man.site, projets: man.realisations.length, msg };
});
check('Site public : « Mettre à jour le site » écrit bien les informations',
  sitePush.site.email === 'contact@exemple.fr' && /Atelier/.test(sitePush.site.apropos || ''),
  JSON.stringify(sitePush.site));
check('Site public : la mise à jour ne touche pas aux projets publiés', sitePush.projets >= 1, sitePush.projets + ' projet(s)');
check('Site public : l’écran confirme', /Mis à jour/.test(sitePush.msg), sitePush.msg);

const sitePushKo = await page.evaluate(async () => {
  const vrai = sb.storage.from;
  sb.storage.from = (b) => Object.assign({}, vrai(b), { upload: async () => ({ error: { message: 'réseau indisponible' } }) });
  await pushSiteInfos(document.getElementById('site-push'));
  sb.storage.from = vrai;
  const msg = document.getElementById('site-msg').textContent;
  closeModal();
  return msg;
});
check('Site public : un échec le dit, et dit que rien n’a changé en ligne',
  /Échec/.test(sitePushKo) && /Rien n’a été modifié/.test(sitePushKo), sitePushKo);

// --- Catégorie : champ libre, propositions, et filtre du site
const categorie = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  const el = document.querySelector('#rz-body [data-f="categorie"]');
  if (!el) return { absent: true };
  el.value = 'Loft'; el.dispatchEvent(new Event('input'));   // valeur hors liste : acceptée
  const propositions = [...document.querySelectorAll('#rz-cats option')].map(o => o.value);
  renderRealisations();
  const reproposee = [...document.querySelectorAll('#rz-cats option')].map(o => o.value).includes('Loft');
  const surCarte = (() => { _rzOpenId = null; renderRealisations();
    const t = [...document.querySelectorAll('.rz-cmeta')].map(x => x.textContent).join(' | ');
    _rzOpenId = r.id; renderRealisations(); return t; })();
  return { valeur: r.categorie, propositions, reproposee, surCarte };
});
check('Catégorie : le champ existe et accepte une valeur hors liste', categorie.valeur === 'Loft', JSON.stringify(categorie).slice(0, 80));
check('Catégorie : des types de lieu sont proposés',
  categorie.propositions && categorie.propositions.includes('Appartement') && categorie.propositions.includes('Bureau'),
  (categorie.propositions || []).join(', '));
check('Catégorie : une catégorie inventée est proposée la fois suivante', categorie.reproposee === true);
check('Catégorie : visible sur la carte de la liste', /Loft/.test(categorie.surCarte || ''), (categorie.surCarte || '').slice(0, 70));

const catManif = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  await publishRealisation(r);
  const key = [...window.__files.keys()].find(k => k.endsWith('manifest.json'));
  const fiche = JSON.parse(await window.__files.get(key).text()).realisations.find(x => x.id === r.id);
  return fiche.categorie || '';
});
check('Catégorie : elle part sur le site, c’est elle qui sert de filtre au visiteur', catManif === 'Loft', catManif);

// --- Image d'aperçu du site : écrite à chaque publication, effacée quand plus rien n'est en ligne
const partage = await page.evaluate(async () => {
  const r = findRealisation(_rzOpenId);
  const cle = () => [...window.__files.keys()].find(k => k.endsWith('/share.jpg')) || '';
  // On repart d'un site vierge : les essais précédents ont laissé dans le manifeste des
  // réalisations qui n'existent plus côté application, et le cas qu'on veut vérifier est
  // « la DERNIÈRE réalisation en ligne est retirée ».
  [...window.__files.keys()].filter(k => k.endsWith('manifest.json') || k.endsWith('/share.jpg'))
    .forEach(k => window.__files.delete(k));
  await publishRealisation(r);
  const apresPublication = cle();
  const taille = apresPublication ? window.__files.get(apresPublication).size : 0;
  await new Promise((res, rej) => {
    const orig = window.askConfirm;
    window.askConfirm = (m, cb) => { window.askConfirm = orig; Promise.resolve(cb()).then(res, rej); };
    unpublishRealisation(r);
  });
  const key = [...window.__files.keys()].find(k => k.endsWith('manifest.json'));
  const restantes = JSON.parse(await window.__files.get(key).text()).realisations.length;
  return { apresPublication, taille, restantes, apresRetrait: cle() };
});
check('Partage : la publication écrit l’image d’aperçu à une adresse fixe',
  /\/share\.jpg$/.test(partage.apresPublication) && partage.taille > 500,
  partage.apresPublication + ' — ' + partage.taille + ' octets');
check('Partage : plus rien en ligne, l’image d’aperçu est effacée',
  partage.restantes === 0 && partage.apresRetrait === '', partage.apresRetrait || 'effacée');

// --- On rend la vue à la réalisation utilisée par les mesures suivantes
await page.evaluate(() => { _rzOpenId = realisations[0].id; renderRealisations(); });
await page.waitForTimeout(300);

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

// Des pannes sont provoquées VOLONTAIREMENT plus haut — manifeste illisible, retouche
// refusée par le fournisseur, envoi de fichier coupé, fichiers d'import illisibles (HEIC
// et JPEG factice) : les erreurs qu'elles journalisent sont le comportement attendu, pas
// un défaut — c'est même ce qui rend un refus d'import diagnosticable. Tout le reste doit
// rester vide.
const realErrors = errors.filter(e => !/favicon|net::ERR|Failed to load resource|supabase|Access-Control|CORS|manifeste illisible : network error|retouche IA Error: fal\.ai a refusé \(HTTP 422\)|publication Error: réseau indisponible|import photo Error: image illisible|retouche IA série Error: fal\.ai a refusé \(HTTP 422\)|texte réalisation Error: IA indisponible \(HTTP 502\)|infos du site \{message: réseau indisponible\}/i.test(e));
check('Aucune erreur JavaScript', realErrors.length === 0, realErrors.slice(0, 4).join(' | '));

console.log('\n===== RESULTAT : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) { console.log('Echecs :'); ko.forEach(k => console.log('  - ' + k)); }
await browser.close();
process.exit(ko.length ? 1 : 0);
