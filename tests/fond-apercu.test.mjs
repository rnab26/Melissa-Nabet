/* Fond du devis qui « s'annulait » et aperçu fidèle au PDF (19 nov. 2026, chantier 34db3c75).

   Raphaël : « quand je change de fond pour les devis et que j'enregistre, ça fonctionne quelques
   secondes et après ça me dit que c'est annulé » ; « quand j'appuie sur l'aperçu, il ne s'affiche
   plus, j'aimerais avoir le vrai aperçu comme le PDF avant de l'imprimer ».

   Cause mesurée en base : réglages = 6,5 Mo (textures PNG de 1,6 Mo, recopiées), délai d'écriture
   de 8 s → « canceling statement due to statement timeout » ; puis « Réessayer » rechargeait la
   copie du serveur par-dessus le nouveau fond.

   Se lance seul (sert les fichiers du dépôt lui-même, aucun serveur à démarrer) :
     node tests/fond-apercu.test.mjs
*/
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://crm.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function ouvrir(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.route(BASE + '**', r => {
    const f = join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[extname(f)] || 'application/octet-stream', body: readFileSync(f) });
  });
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof newDevis === 'function' && typeof library === 'object');
  await page.evaluate(() => {
    document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none');
    window.__impressions = 0; window.print = () => { window.__impressions++; };
  });
  return page;
}
/* Une vraie texture (dégradé + grain) en PNG, comme celles enregistrées aujourd'hui. */
const texturePng = () => {
  const c = document.createElement('canvas'); c.width = 660; c.height = 933; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 660, 933); g.addColorStop(0, '#d9d2c5'); g.addColorStop(1, '#a89c8a');
  x.fillStyle = g; x.fillRect(0, 0, 660, 933);
  const d = x.getImageData(0, 0, 660, 933);
  for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - .5) * 40; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png');
};

/* ================= 1. Fond : JPEG, et conversion des textures déjà enregistrées ================= */
{
  const page = await ouvrir(390, 844);
  const r = await page.evaluate(async (src) => {
    const png = (new Function('return ' + src))()();
    const logo = library.branding.logoDataUri;
    library.branding.devisBgImage = library.branding.devisBgImageBase = png;
    library.bgLibrary = [{ id: 'f1', dataUri: png, addedAt: 1 }];
    devisList = [{ id: 'v1', status: 'valide', snapshot: { branding: { devisBgImage: png, devisBgImageBase: png } } }];
    current.branding = { ...library.branding };
    await allegerTextures();
    const b = library.branding;
    return {
      avant: png.length, apres: b.devisBgImage.length,
      jpeg: [b.devisBgImage, b.devisBgImageBase, library.bgLibrary[0].dataUri, devisList[0].snapshot.branding.devisBgImage, current.branding.devisBgImage].every(u => u.startsWith('data:image/jpeg')),
      memeChaine: b.devisBgImage === b.devisBgImageBase,
      logoIntact: b.logoDataUri === logo,
      taille: JSON.stringify(library).length,
    };
  }, texturePng.toString());
  check('Textures PNG déjà enregistrées → JPEG (réglages, bibliothèque de fonds, devis, devis ouvert)', r.jpeg, JSON.stringify(r));
  check('La texture est au moins 4 fois plus légère', r.apres * 4 < r.avant, `${r.avant} → ${r.apres} car.`);
  check('Le logo (transparence) n\'est pas touché', r.logoIntact);
  check('Réglages complets sous 1 Mo (6,5 Mo en production avant)', r.taille < 1e6, r.taille + ' car.');

  /* Une nouvelle texture choisie passe directement en JPEG (recadrage) — vrai fichier, vrai bouton « Valider ». */
  const recadre = await page.evaluate(async (src) => {
    const png = (new Function('return ' + src))()();
    const blob = await (await fetch(png)).blob();
    const file = new File([blob], 'marbre.png', { type: 'image/png' });
    return new Promise(res => {
      openImageCropper(file, uri => res(uri), { vpW: 220, vpH: 311, title: 'Cadrer la texture de fond', jpeg: true });
      const t = setInterval(() => { if (document.getElementById('crop-img')) { clearInterval(t); applyImageCrop(); } }, 50);
    });
  }, texturePng.toString());
  check('Une texture recadrée est enregistrée en JPEG', recadre.startsWith('data:image/jpeg'), recadre.slice(0, 30) + ' · ' + recadre.length + ' car.');
  const logoPng = await page.evaluate(async (src) => {
    const blob = await (await fetch((new Function('return ' + src))()())).blob();
    return new Promise(res => {
      openImageCropper(new File([blob], 'logo.png', { type: 'image/png' }), uri => res(uri));
      const t = setInterval(() => { if (document.getElementById('crop-img')) { clearInterval(t); applyImageCrop(); } }, 50);
    });
  }, texturePng.toString());
  check('Un logo recadré reste en PNG (transparence)', logoPng.startsWith('data:image/png'));
  /* Inverser une texture JPEG ne la repasse pas en PNG. */
  const inverse = await page.evaluate(() => new Promise(res => {
    library.branding.devisBgFlipX = false;
    const orig = applyBrandingLive; applyBrandingLive = () => { applyBrandingLive = orig; res(library.branding.devisBgImage); };
    toggleDevisBgFlipX();
  }));
  check('Texture inversée : toujours en JPEG', inverse.startsWith('data:image/jpeg'));
  check('Aucune erreur JavaScript (fond)', page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}

/* ================= 2. Synchro : le cas exact signalé ================= */
{
  const page = await ouvrir(390, 844);
  const r = await page.evaluate(async () => {
    const serveur = { library: null };
    const envois = []; let enVol = 0, maxEnVol = 0, echouer = true;
    sb = {
      from: () => ({
        select: async () => ({ data: [{ id: 'library', kind: 'library', data: JSON.parse(JSON.stringify(serveur.library)) }], error: null }),
        upsert: async rows => {
          enVol++; maxEnVol = Math.max(maxEnVol, enVol);
          await new Promise(r => setTimeout(r, 150));
          enVol--;
          if (echouer) return { error: { message: 'canceling statement due to statement timeout' } };
          rows.forEach(x => { if (x.id === 'library') serveur.library = JSON.parse(JSON.stringify(x.data)); });
          envois.push(rows.map(x => x.id)); return { error: null };
        },
        delete: () => ({ in: async () => ({ error: null }) }),
      }),
      storage: { from: () => ({}) },
    };
    sbUser = { id: 'u1', email: 't@t' }; ownerId = 'u1';
    serveur.library = JSON.parse(JSON.stringify(library)); serveur.library.branding.devisBgImage = 'data:image/jpeg;base64,ANCIEN';
    await loadAll();                                     // premier chargement : le serveur fait foi
    const lu = library.branding.devisBgImage;
    library.branding.devisBgImage = 'data:image/jpeg;base64,NOUVEAU';   // Raphaël change le fond
    await store.set(K_LIB, library);
    await cloudPush();                                   // l'envoi échoue (délai dépassé)
    const erreur = lastSyncError;
    retrySync();                                         // il touche « Réessayer »
    await new Promise(r => setTimeout(r, 600));
    const apresReessai = library.branding.devisBgImage;
    await loadAll();                                     // retour dans l'appli
    const apresRetour = library.branding.devisBgImage;
    /* Écho temps réel de l'ancienne version pendant que la nouvelle n'est pas partie */
    handleRealtime({ eventType: 'UPDATE', new: { id: 'library', kind: 'library', data: JSON.parse(JSON.stringify(serveur.library)) } });
    const apresEcho = library.branding.devisBgImage;
    echouer = false;                                     // le réseau revient
    await cloudPush();
    const serveurFinal = serveur.library.branding.devisBgImage;
    /* Un seul envoi à la fois, et le dernier contenu gagne */
    library.branding.companyName = 'A'; const p1 = cloudPush();
    library.branding.companyName = 'B'; const p2 = cloudPush();
    await p1; await p2; await new Promise(r => setTimeout(r, 400));
    /* Rien en attente : une modification venue d'un autre appareil arrive bien */
    const autre = JSON.parse(JSON.stringify(serveur.library)); autre.branding.companyName = 'Autre appareil'; serveur.library = autre;
    await loadAll();
    return { lu, erreur, apresReessai, apresRetour, apresEcho, serveurFinal, maxEnVol, nomServeur: autre.branding.companyName, nomLocal: library.branding.companyName, envoiB: envois.length };
  });
  check('Premier chargement : la copie du serveur fait foi', r.lu === 'data:image/jpeg;base64,ANCIEN', r.lu);
  check('L\'envoi raté affiche la vraie erreur', /statement timeout/.test(r.erreur), r.erreur);
  check('Après « Réessayer » : le nouveau fond est toujours là (avant : remis à l\'ancien)', r.apresReessai === 'data:image/jpeg;base64,NOUVEAU', r.apresReessai);
  check('Après un retour dans l\'appli : le nouveau fond est toujours là', r.apresRetour === 'data:image/jpeg;base64,NOUVEAU', r.apresRetour);
  check('Un écho de l\'ancienne version n\'écrase pas le fond pas encore envoyé', r.apresEcho === 'data:image/jpeg;base64,NOUVEAU', r.apresEcho);
  check('Le réseau revient : le serveur reçoit le nouveau fond', r.serveurFinal === 'data:image/jpeg;base64,NOUVEAU', r.serveurFinal);
  check('Jamais deux envois en même temps', r.maxEnVol === 1, 'max en vol : ' + r.maxEnVol);
  check('Rien en attente : la modification d\'un autre appareil arrive', r.nomLocal === 'Autre appareil', r.nomLocal);
  check('Aucune erreur JavaScript (synchro)', page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}

/* ================= 3. Aperçu sur téléphone (l'écran de Raphaël) ================= */
{
  const page = await ouvrir(390, 844);
  await page.evaluate(() => { showView('devis'); newDevis(); showTab('editor'); document.querySelectorAll('.acc').forEach(a => a.classList.add('open')); });
  await page.mouse.wheel(0, 20000); await page.waitForTimeout(400);
  const avant = await page.evaluate(() => scrollY);
  await page.click('#devis-tab-fab'); await page.waitForTimeout(400);
  const a = await page.evaluate(() => {
    const d = document.getElementById('devis'), r = d.getBoundingClientRect(), p = d.querySelector('.devis-page');
    return { scrollY, top: r.top, left: r.left, right: r.right, largeurA4: d.offsetWidth, zoom: parseFloat(getComputedStyle(document.querySelector('.preview-wrap')).getPropertyValue('--dv-zoom')), marge: parseFloat(getComputedStyle(p).paddingLeft), titre: document.getElementById('devis-tab-fab').textContent };
  });
  check('Composeur défilé tout en bas, puis « Aperçu » : on arrive en haut du devis', avant > 1000 && a.scrollY === 0 && a.top < 120, `avant ${avant}, après ${a.scrollY}, haut du devis à ${Math.round(a.top)} px`);
  check('L\'aperçu est la page A4 du PDF (210 mm de large, marges de 16 mm)', Math.abs(a.largeurA4 - 793.7) < 2 && Math.abs(a.marge - 60.47) < 1, `${a.largeurA4} px, marge ${a.marge}`);
  check('La page entière tient dans l\'écran', a.zoom < 1 && a.left >= 0 && a.right <= 390, `zoom ${a.zoom}, ${Math.round(a.left)}–${Math.round(a.right)} px`);
  await page.screenshot({ path: '/tmp/apercu-telephone.png' });
  await page.click('#devis .dv-title, #devis .devis-page', { position: { x: 100, y: 100 } }); await page.waitForTimeout(200);
  const reel = await page.evaluate(() => { const pw = document.querySelector('.preview-wrap'); pw.scrollLeft = 0; const r = document.getElementById('devis').getBoundingClientRect(); return { zoom: getComputedStyle(pw).getPropertyValue('--dv-zoom').trim(), defile: pw.scrollWidth > pw.clientWidth, gauche: r.left }; });
  check('Un toucher sur la page : taille réelle, on peut la faire défiler, bord gauche visible', reel.zoom === '1.0000' && reel.defile && reel.gauche >= 0, JSON.stringify(reel));
  await page.click('#devis .devis-page', { position: { x: 100, y: 100 } }); await page.waitForTimeout(200);
  check('Un second toucher : retour à la page entière', await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.preview-wrap')).getPropertyValue('--dv-zoom')) < 1));
  await page.click('#devis-tab-fab'); await page.waitForTimeout(300);
  check('« Composer » ramène là où on en était', Math.abs(await page.evaluate(() => scrollY) - avant) < 5);
  check('Aucune erreur JavaScript (aperçu téléphone)', page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}

/* ================= 4. Aperçu sur ordinateur : mêmes retours à la ligne que le PDF ================= */
{
  const page = await ouvrir(1280, 900);
  await page.evaluate(() => { showView('devis'); newDevis(); current.intro = 'Un texte d\'introduction assez long pour passer sur plusieurs lignes et vérifier que la page a la largeur du PDF, pas celle de la colonne.'; render(); });
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => ({ w: document.getElementById('devis').offsetWidth, z: parseFloat(getComputedStyle(document.querySelector('.preview-wrap')).getPropertyValue('--dv-zoom')), pw: document.querySelector('.preview-wrap').clientWidth }));
  check('Ordinateur : la page garde 210 mm, réduite pour tenir dans la colonne', Math.abs(d.w - 793.7) < 2 && d.z > 0.5 && d.z <= 1, JSON.stringify(d));
  const lignesEcran = await page.evaluate(() => { const e = document.querySelector('#devis .dv-intro'); return Math.round(e.offsetHeight / parseFloat(getComputedStyle(e).lineHeight)); });
  await page.emulateMedia({ media: 'print' });
  const lignesPdf = await page.evaluate(() => { const e = document.querySelector('#devis .dv-intro'); return Math.round(e.offsetHeight / parseFloat(getComputedStyle(e).lineHeight)); });
  await page.emulateMedia({ media: 'screen' });
  check('Même nombre de lignes à l\'écran et à l\'impression', lignesEcran === lignesPdf, `${lignesEcran} / ${lignesPdf}`);
  check('Aucune erreur JavaScript (aperçu ordinateur)', page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}

/* ================= 5. « Imprimer PDF » et « Voir » : dans la page, plus de fenêtre ================= */
{
  const page = await ouvrir(390, 844);
  let fenetres = 0; page.on('popup', () => fenetres++);
  await page.evaluate(src => {
    showView('devis'); newDevis();
    library.branding.devisBgImage = (new Function('return ' + src))()(); current.branding = { ...library.branding }; current.num = '0077'; render();
  }, texturePng.toString());
  await page.evaluate(() => exportDevis());
  const z = await page.evaluate(() => ({ impressions: window.__impressions, classe: document.body.classList.contains('impression-zone'), pages: document.querySelectorAll('#zone-impression .devis-page').length, titre: document.title, fond: getComputedStyle(document.querySelector('#zone-impression .devis-page')).backgroundImage.includes('data:image') }));
  check('« Imprimer PDF » ouvre l\'impression dans la page, sans fenêtre à part', z.impressions === 1 && fenetres === 0 && z.classe && z.pages >= 1, JSON.stringify({ ...z, fenetres }));
  check('Le PDF porte le nom du devis', /^Devis 0077 — /.test(z.titre), z.titre);
  check('La texture est dans le PDF', z.fond);
  await page.emulateMedia({ media: 'print' });
  const vis = await page.evaluate(() => ({ zone: getComputedStyle(document.getElementById('zone-impression')).display, reste: [...document.body.children].filter(e => e.id !== 'zone-impression' && getComputedStyle(e).display !== 'none').map(e => e.id || e.className) }));
  check('À l\'impression, seule la zone du devis est visible', vis.zone === 'block' && vis.reste.length === 0, JSON.stringify(vis));
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  const nbPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('Le PDF produit a ses 2 pages A4 (devis + conditions), sans page blanche en trop', nbPages === 2, nbPages + ' pages');
  await page.emulateMedia({ media: 'screen' });
  /* Nettoyage au premier geste après l'impression */
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.mouse.click(5, 300);
  const net = await page.evaluate(() => ({ classe: document.body.classList.contains('impression-zone'), vide: document.getElementById('zone-impression').innerHTML === '', titre: document.title }));
  check('Après l\'impression : l\'appli revient telle quelle', !net.classe && net.vide && !/^Devis 0077/.test(net.titre), JSON.stringify(net));

  /* « Voir » un devis validé SANS texture, depuis une fiche client, pendant qu'un brouillon avec texture est ouvert */
  await page.evaluate(() => {
    const snap = JSON.parse(JSON.stringify(current)); snap.branding = { ...snap.branding, devisBgImage: null, devisBgImageBase: null, palette: 'actuel' }; snap.num = '0042';
    devisList.push({ id: 'val42', status: 'valide', num: '0042', snapshot: snap });
    viewDevisSnapshot('val42');
  });
  const v = await page.evaluate(() => ({ impressions: window.__impressions, titre: document.title, fondZone: getComputedStyle(document.querySelector('#zone-impression .devis-page')).backgroundImage, fondComposeur: getComputedStyle(document.querySelector('#devis .devis-page')).backgroundImage.includes('data:image') }));
  check('« Voir » un devis validé : impression dans la page, à son numéro', v.impressions === 2 && /0042/.test(v.titre) && fenetres === 0, v.titre);
  check('Le devis validé sans texture s\'imprime sans la texture du brouillon ouvert', !v.fondZone.includes('data:image'), v.fondZone.slice(0, 60));
  check('Le brouillon ouvert garde sa texture à l\'écran', v.fondComposeur);
  check('Aucune erreur JavaScript (impression)', page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}

await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
