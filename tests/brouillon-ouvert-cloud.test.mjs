/* Brouillon resté ouvert sur un appareil (20 nov. 2026) : le brouillon « Morgane » avait reçu
   16 lignes « hors prestation » ; au rechargement du téléphone, le composeur restauré depuis
   l'autosave local (3 lignes) a été renvoyé par-dessus, deux fois. Ici on rejoue ce cas exact
   par le vrai chemin loadAll, puis on vérifie qu'une modif locale plus récente n'est pas perdue
   et que le temps réel recharge toujours le devis ouvert.

   Lancer :  python3 -m http.server 8899   puis   node tests/brouillon-ouvert-cloud.test.mjs
*/
import { chromium } from 'playwright';
const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(() => { document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none'); showView('devis'); });

/* Prépare l'appareil : le composeur montre le brouillon m avec `nbLocal` lignes, la copie locale
   date de `localAt` ; le cloud a `nbCloud` lignes datées de `cloudAt`. Renvoie ce que l'appareil
   montre et ce qu'il a renvoyé au serveur une fois l'autosave passé. */
async function rejouer(nbLocal, localAt, nbCloud, cloudAt) {
  return page.evaluate(async ({ nbLocal, localAt, nbCloud, cloudAt }) => {
    const lignes = n => Array.from({ length: n }, (_, i) => ({ id: 'e' + i, on: true, title: 'Mention ' + i, custom: false }));
    seedComposerFromLibrary();
    current.raison = 'Morgane'; current.exclus = lignes(nbLocal); currentDevisId = 'm';
    const snapLocal = JSON.parse(JSON.stringify(current));
    devisList = [{ id: 'm', num: current.num, title: 'Morgane', clientId: null, status: 'brouillon', updatedAt: localAt, snapshot: snapLocal }];
    const snapCloud = { ...JSON.parse(JSON.stringify(snapLocal)), exclus: lignes(nbCloud) };
    const envoyes = [];
    sb = {
      from: () => ({
        select: async () => ({ data: [{ id: 'm', kind: 'devis', data: { id: 'm', num: snapCloud.num, title: 'Morgane', clientId: null, status: 'brouillon', updatedAt: cloudAt, snapshot: snapCloud } }], error: null }),
        upsert: async rows => { rows.forEach(r => { if (r.kind === 'devis') envoyes.push(r.data.snapshot.exclus.length); }); return { error: null }; },
        delete: () => ({ in: async () => ({ error: null }) }),
      }),
      storage: { from: () => ({}) },
    };
    sbUser = { id: 'u1', email: 't@t' }; ownerId = 'u1';
    Object.keys(remoteDevis).forEach(k => delete remoteDevis[k]);   // comme après un rechargement
    buildExclu(); render();
    await loadAll();
    await new Promise(r => setTimeout(r, 1200));                   // autosave (600 ms) + envoi
    await cloudPush();
    return { ecran: current.exclus.length, liste: devisList.find(d => d.id === 'm').snapshot.exclus.length,
             accordeon: document.querySelectorAll('#excl .it').length, envoyes };
  }, { nbLocal, localAt, nbCloud, cloudAt });
}

// 1. Le cas exact : copie locale ancienne (3 lignes), cloud plus récent (16 lignes).
const a = await rejouer(3, 1000, 16, 2000);
check('Le composeur montre la version du cloud (16 lignes)', a.ecran === 16 && a.accordeon === 16, JSON.stringify(a));
check('Le devis enregistré garde ses 16 lignes', a.liste === 16, JSON.stringify(a));
check('L\'appareil ne renvoie jamais l\'ancienne version (3 lignes)', !a.envoyes.includes(3), JSON.stringify(a.envoyes));

// 2. Une modif locale plus récente que le cloud n'est pas écrasée (saisie hors ligne).
const b = await rejouer(5, 3000, 16, 2000);
check('Une modif locale plus récente garde la main', b.ecran === 5 && b.liste === 5, JSON.stringify(b));

// 3. Même date des deux côtés : rien ne bouge.
const c = await rejouer(16, 2000, 16, 2000);
check('Même version des deux côtés : rien ne change', c.ecran === 16 && c.envoyes.length === 0, JSON.stringify(c));

// 4. Le temps réel recharge toujours le devis ouvert (code mis en commun).
const d = await page.evaluate(() => {
  const snap = { ...JSON.parse(JSON.stringify(current)), exclus: [{ id: 'z', on: true, title: 'Venue du temps réel', custom: false }] };
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  handleRealtime({ eventType: 'UPDATE', new: { id: 'm', kind: 'devis', data: { id: 'm', num: snap.num, title: 'Morgane', status: 'brouillon', updatedAt: 9000, snapshot: snap } } });
  return { n: current.exclus.length, t: current.exclus[0].title, ecran: document.querySelector('#excl .it-title').value };
});
check('Temps réel : le devis ouvert se met à jour à l\'écran', d.n === 1 && d.ecran === 'Venue du temps réel', JSON.stringify(d));

check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} échec(s)`);
process.exit(ko.length ? 1 : 0);
