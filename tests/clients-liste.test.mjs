// Non-régression (5 oct. 2026) : un client mal typé dans l'appareil (date numérique, nom absent)
// vidait toute la liste — il ne restait que l'en-tête du tableau — et loadAll avalait l'erreur.
import { chromium } from 'playwright';
const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const out = {};
  const bons = [1, 2, 3].map(i => normalizeClient({ id: 'ok' + i, name: 'Client ' + i, debut: '2026-09-0' + i }));
  const mal = normalizeClient({ id: 'mal', name: 123, debut: 20260915, fin: 5 });
  out.typesNormalises = [typeof mal.name, typeof mal.debut, typeof mal.fin].join(',');
  // Même un client NON normalisé (copie brute) ne doit pas vider la liste : sa fiche est
  // signalée « illisible » (1 ligne d'erreur), les 4 autres s'affichent.
  const brut = { id: 'brut', name: undefined, debut: 20260915, statut: 'en_cours', paiements: [], commissions: [], docs: [] };
  for (const sk of ['name', 'debut', 'statut', 'montant']) {
    clients = [...bons, mal, brut]; clientFilters.sortKey = sk; clientFilters.sortDir = 'asc'; clientFilters.q = '';
    renderClients();
    out['tri_' + sk] = document.querySelectorAll('#cl-table .cl-group').length;
    out['err_' + sk] = document.querySelectorAll('#cl-table .empty').length;
  }
  clients = [...bons, brut]; clientFilters.q = 'client'; renderClients();
  out.recherche = document.querySelectorAll('#cl-table .cl-group').length;
  return out;
});
console.log(JSON.stringify(r));
const ok = r.typesNormalises === 'string,string,string' && ['name','debut','statut','montant'].every(k => r['tri_' + k] === 4 && r['err_' + k] === 1) && r.recherche >= 3;
console.log(ok ? 'OK' : 'ECHEC');
await b.close();
process.exit(ok ? 0 : 1);
