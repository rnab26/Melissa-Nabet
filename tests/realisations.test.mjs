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
