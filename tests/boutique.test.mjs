/* La BOUTIQUE — ce que le magasin vend (revêtements muraux, חיפוי קיר).
   Deux moitiés vérifiées ici : l'écran du CRM (créer un produit, ses rayons, ce qui part en
   ligne) et la section « À la vente » du site public, en français ET en hébreu — c'est la
   langue des clients du magasin, pas une décoration.

   Ce qui n'existe pas et ne doit pas apparaître : panier, compte, frais de port, stock.

   Lancer :
     python3 -m http.server 8899                        # racine du dépôt
     node tests/sitetest-build.mjs
     python3 -m http.server 8902 -d /tmp/mn-sitetest
     node tests/boutique.test.mjs
*/
import { chromium } from 'playwright';

const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/* ================= CÔTÉ CRM ================= */
const crm = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errCrm = [];
crm.on('pageerror', e => errCrm.push(e.message));
await crm.goto(process.env.APP_URL || 'http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
await crm.waitForTimeout(1500);
await crm.evaluate(() => {
  const files = new Map(); window.__files = files;
  sb = { storage: { from: () => ({
    upload: async (p, b) => { files.set(p, b); return { error: null }; },
    download: async (p) => files.has(p) ? { data: files.get(p), error: null }
      : { data: null, error: { message: 'Object not found', statusCode: '404' } },
    remove: async () => ({ error: null }), list: async () => ({ data: [], error: null }),
  }) }, from: () => ({ upsert: async () => ({ error: null }) }) };
  sbUser = { id: 'test-user' }; ownerId = 'test-user';
  document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none');
  library.site = null; siteSettings(); siteSettings().tel = '052 000 00 00';
  produits = []; realisations = [];
});

check('Un onglet « Boutique » existe dans les deux navigations',
  await crm.locator('#vn-boutique').count() === 1 && await crm.locator('#navbas button[data-vue="boutique"]').count() === 1);
await crm.evaluate(() => showView('boutique'));
await crm.waitForTimeout(400);
check('La vue Boutique s’affiche', await crm.locator('#boutique-view').isVisible());
const btNeuf = crm.locator('#boutique-view .rz-top button', { hasText: 'Nouveau produit' });
check('Un bouton « Nouveau produit » en tête, visible sans défiler',
  await btNeuf.count() === 1 && await btNeuf.evaluate(b => b.getBoundingClientRect().top < innerHeight));

await btNeuf.click();
await crm.waitForTimeout(500);
const champs = await crm.evaluate(() => [...document.querySelectorAll('#bt-body [data-p]')].map(e => e.dataset.p));
check('La fiche produit a nom, matière, prix, disponibilité, catégorie et description',
  ['nom', 'matiere', 'prix', 'dispo', 'categorie', 'description'].every(c => champs.includes(c)), champs.join(', '));
const rayons = await crm.evaluate(() => [...document.querySelector('#bt-body [data-p="categorie"]').options].map(o => o.textContent));
check('La catégorie est un menu, avec des rayons par défaut',
  rayons.includes('Revêtement mural') && /aucune/.test(rayons[0]), rayons.join(' | '));
check('Le prix annonce qu’il est facultatif',
  /vide/.test(await crm.locator('#bt-body [data-p="prix"]').evaluate(e => e.closest('label').textContent)),
  await crm.locator('#bt-body [data-p="prix"]').getAttribute('placeholder'));

await crm.fill('#bt-body [data-p="nom"]', 'Panneau chêne rainuré');
await crm.fill('#bt-body [data-p="matiere"]', 'Chêne massif');
await crm.selectOption('#bt-body [data-p="categorie"]', 'Revêtement mural');
await crm.selectOption('#bt-body [data-p="dispo"]', 'commande');
await crm.waitForTimeout(400);
check('Ce qui est saisi est enregistré',
  await crm.evaluate(() => produits[0].nom === 'Panneau chêne rainuré' && produits[0].categorie === 'Revêtement mural' && produits[0].dispo === 'commande'),
  await crm.evaluate(() => JSON.stringify({ n: produits[0].nom, c: produits[0].categorie, d: produits[0].dispo })));

/* Sans photo, un produit ne peut pas partir : il n'afficherait rien sur le site. */
const refus = await crm.evaluate(async () => { await publishProduit(produits[0]); return produits[0].published; });
check('Publier sans photo est refusé, et le produit reste hors ligne', refus === false);

/* L'hébreu se saisit dans la fiche, langue par langue. */
await crm.evaluate(() => { siteSettings().langues = ['fr', 'en', 'he']; renderBoutique(); });
await crm.waitForTimeout(400);
const onglets = await crm.locator('#bt-body .site-onglet').allTextContents();
check('Une langue à la fois dans la fiche produit', onglets.join(' | ') === 'Français | English | עברית', onglets.join(' | '));
await crm.locator('#bt-body .site-onglet', { hasText: 'עברית' }).click();
await crm.waitForTimeout(400);
check('En hébreu, le champ est vide et attend son texte',
  (await crm.inputValue('#bt-body [data-p="nom"]')) === '');
await crm.fill('#bt-body [data-p="nom"]', 'לוח אלון מחורץ');
await crm.waitForTimeout(400);
check('Le nom hébreu se range à part, sans écraser le français',
  await crm.evaluate(() => produits[0].nom === 'Panneau chêne rainuré' && produits[0].i18n.he.nom === 'לוח אלון מחורץ'),
  await crm.evaluate(() => JSON.stringify(produits[0].i18n)));
const sensChamp = await crm.evaluate(() => document.querySelector('#bt-body [data-p="nom"]').getAttribute('dir'));
check('Le champ hébreu s’écrit de droite à gauche', sensChamp === 'rtl', String(sensChamp));
await crm.locator('#bt-body .site-onglet', { hasText: 'Français' }).click();
await crm.waitForTimeout(300);

/* Les rayons se gèrent depuis le CRM, comme les sections des réalisations. */
await crm.evaluate(() => openSitePanel());
await crm.waitForTimeout(400);
check('Les rayons de la boutique sont éditables dans le panneau',
  await crm.locator('#site-cats-prod [data-catprod]').count() >= 4);
await crm.locator('#site-cats-prod [data-catprod]').first().locator('[data-catprod-nom]').fill('Revêtements');
await crm.locator('#site-cats-prod [data-catprod]').first().locator('[data-catprod-nom]').press('Tab');
await crm.waitForTimeout(500);
check('Renommer un rayon suit sur les produits qui y sont rangés',
  await crm.evaluate(() => produits[0].categorie === 'Revêtements'),
  await crm.evaluate(() => produits[0].categorie));
const manif = await crm.evaluate(async () => { await pushSiteInfos(null); return JSON.parse(await window.__files.get('test-user/manifest.json').text()); });
check('L’ordre des rayons part en ligne',
  (manif.site.categoriesProduits || [])[0] === 'Revêtements', (manif.site.categoriesProduits || []).join(' | '));
const debordCrm = await crm.evaluate(() => { const m = document.getElementById('modal'); return m.scrollWidth - m.clientWidth; });
check('Le panneau tient dans un écran de 390 px', debordCrm <= 1, debordCrm + 'px');
await crm.evaluate(() => closeModal());
await crm.screenshot({ path: '/tmp/crm-boutique.png', fullPage: true });
const vraisCrm = errCrm.filter(e => !/fonts\.|ERR_CONNECTION|404|favicon/i.test(e));
check('CRM : aucune erreur JavaScript', vraisCrm.length === 0, vraisCrm.slice(0, 2).join(' | '));
await crm.close();

/* ================= CÔTÉ SITE PUBLIC ================= */
const site = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errSite = [];
site.on('pageerror', e => errSite.push(e.message));
const parcourir = () => site.evaluate(async () => {
  const va = y => window.scrollTo({ top: y, behavior: 'instant' });
  const bas = () => document.documentElement.scrollHeight - innerHeight;
  for (let y = 0; y < bas(); y += innerHeight * 0.8) { va(y); await new Promise(r => setTimeout(r, 110)); }
  va(bas()); await new Promise(r => setTimeout(r, 350)); va(0); await new Promise(r => setTimeout(r, 250));
});
await site.goto('http://127.0.0.1:8902/index.html', { waitUntil: 'networkidle' });
await site.evaluate(() => { try { localStorage.removeItem('mn-langue'); } catch (e) {} });
await site.reload({ waitUntil: 'networkidle' });
await site.waitForTimeout(800);
await parcourir();

const fr = await site.evaluate(() => ({
  visible: !document.getElementById('boutique').hidden,
  titre: (document.getElementById('t-boutique').textContent || '').trim(),
  produits: document.querySelectorAll('.produit').length,
  filtres: [...document.querySelectorAll('#filtres-prod button')].map(b => b.textContent),
  prix: [...document.querySelectorAll('.produit-prix')].map(p => p.textContent),
  dispos: [...document.querySelectorAll('.produit-dispo')].map(p => p.textContent),
  wa: document.querySelectorAll('.produit-wa').length,
  lien: (document.querySelector('.produit-wa') || {}).href || '',
  images: [...document.querySelectorAll('.produit-img img')].filter(i => i.naturalWidth > 0).length,
  debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
check('Section « À la vente » affichée, distincte des réalisations',
  fr.visible && fr.titre === 'À la vente' && fr.produits === 3, JSON.stringify({ t: fr.titre, n: fr.produits }));
check('Les rayons filtrent, dans l’ordre défini dans le CRM',
  fr.filtres.join(' | ') === 'Tout (3) | Revêtement mural (2) | Panneau décoratif (1)', fr.filtres.join(' | '));
check('Un prix vide affiche « sur demande », pas un blanc',
  fr.prix.filter(p => /sur demande/i.test(p)).length === 2 && fr.prix.includes('180 ₪ / m²'), fr.prix.join(' | '));
check('La disponibilité est dite en toutes lettres',
  fr.dispos.join(' | ') === 'Disponible | Sur commande | Épuisé', fr.dispos.join(' | '));
check('Un bouton WhatsApp par produit disponible, aucun sur un produit épuisé', fr.wa === 2, fr.wa + ' bouton(s)');
check('Le message WhatsApp porte déjà le nom du produit',
  /wa\.me\/972520000000/.test(fr.lien) && /Panneau/.test(decodeURIComponent(fr.lien)),
  decodeURIComponent(fr.lien).slice(0, 90));
check('Les photos des produits se chargent', fr.images === 3, fr.images + ' image(s)');
check('Aucun débordement horizontal à 390 px', fr.debord <= 1, fr.debord + 'px');
const pasDeVente = await site.evaluate(() => {
  const t = document.body.textContent.toLowerCase();
  return ['panier', 'ajouter au panier', 'mon compte', 'frais de port', 'stock restant'].filter(m => t.includes(m));
});
check('Ni panier, ni compte, ni frais de port — rien de tout ça n’a été demandé',
  pasDeVente.length === 0, pasDeVente.join(', '));
await site.screenshot({ path: '/tmp/boutique-fr.png', fullPage: true });

// --- Hébreu : la langue des clients du magasin
await site.locator('#langs button', { hasText: 'עב' }).click();
await site.waitForTimeout(600);
await parcourir();
const he = await site.evaluate(() => ({
  titre: (document.getElementById('t-boutique').textContent || '').trim(),
  nom: (document.querySelector('.produit-nom') || {}).textContent,
  dispos: [...document.querySelectorAll('.produit-dispo')].map(p => p.textContent),
  wa: (document.querySelector('.produit-wa') || {}).textContent,
  lien: decodeURIComponent((document.querySelector('.produit-wa') || {}).href || ''),
  dir: document.documentElement.dir,
  prixSens: [...document.querySelectorAll('.produit-prix')].map(p => getComputedStyle(p).direction),
  nomSens: [...document.querySelectorAll('.produit-nom')].map(p => getComputedStyle(p).direction),
  debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
check('Boutique traduite en hébreu', he.titre === 'למכירה' && /וואטסאפ/.test(he.wa), he.titre + ' | ' + he.wa);
check('Un nom traduit s’affiche en hébreu', he.nom === 'לוח אלון מחורץ', he.nom);
check('La disponibilité est traduite', he.dispos.join(' | ') === 'במלאי | בהזמנה | אזל', he.dispos.join(' | '));
check('Le message WhatsApp part en hébreu, avec le nom hébreu du produit',
  /שלום/.test(he.lien) && /לוח אלון/.test(he.lien), he.lien.slice(0, 80));
/* Un prix « 180 ₪ / m² » dans une page hébreu se lisait « m² / ₪ 180 » : chaque texte doit
   porter SA direction, sinon le prix affiché est faux. */
check('Le prix garde son sens de lecture dans une page hébreu',
  he.dir === 'rtl' && he.prixSens[0] === 'ltr' && he.nomSens[0] === 'rtl',
  JSON.stringify({ prix: he.prixSens, nom: he.nomSens }));
check('Aucun débordement horizontal en hébreu à 390 px', he.debord <= 1, he.debord + 'px');
await site.screenshot({ path: '/tmp/boutique-he.png', fullPage: true });
await site.evaluate(() => { try { localStorage.removeItem('mn-langue'); } catch (e) {} });

// Un site sans produit ne doit pas afficher un rayon vide.
const sansProduit = await site.evaluate(() => {
  const garde = produits.slice();
  produits = []; renderBoutique();
  const cache = document.getElementById('boutique').hidden;
  produits = garde; renderBoutique();
  return cache;
});
check('Aucun produit : la section n’existe pas du tout', sansProduit === true);

const vraisSite = errSite.filter(e => !/fonts\.googleapis|fonts\.gstatic|ERR_CONNECTION_RESET|404|ERR_NAME_NOT_RESOLVED|favicon/i.test(e));
check('Site : aucune erreur JavaScript', vraisSite.length === 0, vraisSite.slice(0, 2).join(' | '));

console.log('\n===== BOUTIQUE : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
if (ko.length) ko.forEach(k => console.log('  - ' + k));
await browser.close();
process.exit(ko.length ? 1 : 0);
