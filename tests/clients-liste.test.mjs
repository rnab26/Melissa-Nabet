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
// Cas réel du 5 oct. 2026 : une entrée nulle dans les devis/tâches de l'appareil faisait
// échouer TOUTES les fiches (« reading 'clientId' »). Passe par le vrai chemin loadAll.
const r2 = await p.evaluate(async () => {
  const bons = [1, 2, 3].map(i => ({ id: 'c' + i, name: 'Client ' + i, debut: '2026-09-0' + i, statut: 'en_cours' }));
  const lignes = [...bons.map(c => ({ id: c.id, kind: 'client', data: c })), { id: 'dnull', kind: 'devis', data: null },
    { id: 'tk', kind: 'tasks', data: [null, { id: 't1', title: 'x', clientId: 'c1' }] }];
  const chain = res => { const o = { select: () => o, eq: () => o, in: () => o, upsert: async () => ({ error: null }), delete: () => o, then: f => f(res) }; return o; };
  sb = { from: () => chain({ data: lignes, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}, auth: { getSession: async () => ({ data: {} }), onAuthStateChange() {} } };
  sbUser = { id: 'u' }; ownerId = 'u'; clients = []; clientFilters.sortKey = 'name'; clientFilters.q = '';
  devisList = [null]; tasks = [null];            // état local déjà pollué
  await loadAll(); renderClients();
  return { groupes: document.querySelectorAll('#cl-table .cl-group').length, erreurs: document.querySelectorAll('#cl-table .empty').length,
           devisNuls: devisList.filter(x => !x).length, tachesNulles: tasks.filter(x => !x).length, objets: JSON.stringify(objets([null, 1, { a: 1 }, 'x'])) };
});
console.log(JSON.stringify(r2));
const ok2 = r2.groupes === 3 && r2.erreurs === 0 && r2.devisNuls === 0 && r2.tachesNulles === 0 && r2.objets === '[{"a":1}]';
console.log(JSON.stringify(r));
const ok = r.typesNormalises === 'string,string,string' && ['name','debut','statut','montant'].every(k => r['tri_' + k] === 4 && r['err_' + k] === 1) && r.recherche >= 3;
console.log(ok && ok2 ? 'OK' : 'ECHEC');
await b.close();
process.exit(ok && ok2 ? 0 : 1);
