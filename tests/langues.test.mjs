/* Traduction anglaise : la langue de l'INTERFACE et la langue du DEVIS sont indépendantes.
   - interface : ce que Melissa lit à l'écran (réglée par appareil, mémorisée) ;
   - devis : ce que le client lit (réglée devis par devis, enregistrée avec le devis).
   Lancer :  python3 -m http.server 8899   puis   node tests/langues.test.mjs
*/
import { chromium } from 'playwright';

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

const devisTexte = () => page.evaluate(() => document.getElementById('devis').innerText);
const navTexte = () => page.evaluate(() => [...document.querySelectorAll('.viewnav .vnav')].map(b => b.textContent.trim().replace(/\s*▾/, '')));

/* --- départ : tout en français --- */
check('Par défaut, l’interface est en français', (await navTexte())[0] === 'Tableau de bord', (await navTexte()).join('|'));
await page.evaluate(() => { showView('devis'); showTab('editor'); });
check('Par défaut, le devis est en français', /Destiné à/.test(await devisTexte()) && /Hors prestation|Conditions générales/.test(await devisTexte()));

/* --- devis en anglais, interface inchangée --- */
await page.evaluate(() => {
  document.getElementById('f-raison').value = 'Acme Ltd';
  document.getElementById('f-raison').dispatchEvent(new Event('input'));
  document.getElementById('f-gamount').value = '12345';
  document.getElementById('f-gamount').dispatchEvent(new Event('input'));
  const l = document.getElementById('f-lang'); l.value = 'en'; l.dispatchEvent(new Event('change'));
});
await page.waitForTimeout(400);
const dvEn = await devisTexte();
check('Devis en anglais : « Prepared for » et « Quote No. »', /Prepared for/.test(dvEn) && /Quote No\./.test(dvEn), dvEn.slice(0, 160).replace(/\n/g, ' / '));
const restesFr = dvEn.match(/Destiné à|Montant total|Signature client|Déroulement|Hors prestation|Conditions générales|\bTVA\b/g);
check('Devis en anglais : plus aucun libellé français fixe', !restesFr, String(restesFr));
check('Devis en anglais : totaux « excl. VAT » / « incl. VAT » et milliers à l’anglaise',
  /Fees — fixed package \(excl\. VAT\)/.test(dvEn) && /Total incl\. VAT/.test(dvEn) && /12,345/.test(dvEn), String(dvEn.match(/12.345[^\n]*/g)));
check('Devis en anglais : conditions générales d’origine traduites', /General terms and conditions/.test(dvEn) && /Purpose of the contract/.test(dvEn));
check('Devis en anglais : l’interface reste en français (indépendance)', (await navTexte())[0] === 'Tableau de bord');

/* --- interface en anglais, devis inchangé --- */
await page.evaluate(() => { const l = document.getElementById('f-lang'); l.value = 'fr'; l.dispatchEvent(new Event('change')); });
await page.evaluate(() => setUiLang('en'));
await page.waitForTimeout(300);
const nav = await navTexte();
check('Interface en anglais : navigation traduite', nav[0] === 'Dashboard' && nav.includes('Quotes') && nav.includes('Portfolio'), nav.join('|'));
const editeur = await page.evaluate(() => ({
  boutons: [...document.querySelectorAll('.editor .btn')].map(b => b.textContent.trim()),
  lbl: [...document.querySelectorAll('.editor .lbl')].map(b => b.textContent.trim()),
}));
check('Interface en anglais : éditeur de devis traduit (boutons)', editeur.boutons.includes('🆕 New quote') && editeur.boutons.includes('💾 Save quote'), editeur.boutons.join('|'));
check('Interface en anglais : champs traduits', editeur.lbl.includes('Quote language') && editeur.lbl.includes('Project title'), editeur.lbl.slice(0, 8).join('|'));
check('Interface en anglais : le devis, lui, reste en français (indépendance)', /Destiné à/.test(await devisTexte()) && !/Prepared for/.test(await devisTexte()));
check('Interface en anglais : le sélecteur « Langue du devis » garde « Français / English »',
  await page.evaluate(() => [...document.getElementById('f-lang').options].map(o => o.textContent).join('|')) === 'Français|English');

/* contenu rendu après coup (menu) traduit aussi */
await page.evaluate(() => toggleDevisMenu());
check('Menu Devis (créé à la demande) traduit', await page.evaluate(() => [...document.querySelectorAll('#vn-devis-menu button')].map(b => b.textContent.trim()).join('|')) === '📝 Compose|📂 My quotes|📐 Project estimate');
await page.evaluate(() => toggleDevisMenu());

/* réglages : les deux langues y sont, en anglais aussi */
await page.evaluate(() => openSettingsPanel());
const reg = await page.evaluate(() => ({
  titre: document.querySelector('#modal h3').textContent,
  ui: document.getElementById('set-ui-lang').value,
  dv: document.getElementById('set-devis-lang').value,
}));
check('Réglages (en anglais) : titre et deux sélecteurs de langue', reg.titre === 'Settings' && reg.ui === 'en' && reg.dv === 'fr', JSON.stringify(reg));
await page.evaluate(() => { const s = document.getElementById('set-devis-lang'); s.value = 'en'; s.dispatchEvent(new Event('change')); });
await page.evaluate(() => closeModal());
await page.evaluate(() => newDevis());
check('Nouveau devis : prend la langue par défaut des réglages (anglais)',
  await page.evaluate(() => current.lang) === 'en' && await page.evaluate(() => document.getElementById('f-lang').value) === 'en');

/* langue du devis enregistrée AVEC le devis, et rechargée */
await page.evaluate(() => { current.raison = 'Acme Ltd'; current.proj = 'Loft'; openSavePanel(); saveSel = null; doSaveDevis(); });
await page.waitForTimeout(500);
const rechargement = await page.evaluate(() => {
  const d = devisList[devisList.length - 1];
  const sauve = d && d.snapshot && d.snapshot.lang;
  current.lang = 'fr';
  loadDevis(d.id);
  return { sauve, apres: current.lang, champ: document.getElementById('f-lang').value };
});
check('La langue du devis est enregistrée dans le devis et revient à la réouverture', rechargement.sauve === 'en' && rechargement.apres === 'en' && rechargement.champ === 'en', JSON.stringify(rechargement));
const ancien = await page.evaluate(() => {
  const d = devisList[devisList.length - 1]; delete d.snapshot.lang; current.lang = 'en'; loadDevis(d.id); return current.lang;
});
check('Un ancien devis (sans langue enregistrée) s’ouvre en français', ancien === 'fr', ancien);

/* messages envoyés au client : dans la langue du devis */
const mails = await page.evaluate(() => {
  current.lang = 'en'; current.num = '0078'; current.contact = 'Dan'; current.proj = 'Loft';
  const en = devisMessageTexte('mail').corps;
  current.lang = 'fr';
  const fr = devisMessageTexte('mail').corps;
  return { en, fr };
});
check('E-mail d’un devis anglais : en anglais', /Hello Dan/.test(mails.en) && /Please find attached the quote No\.0078/.test(mails.en) && /Kind regards/.test(mails.en), mails.en.slice(0, 90));
check('E-mail d’un devis français : inchangé', /Bonjour Dan,/.test(mails.fr) && /Veuillez trouver ci-joint le devis N°0078 pour le projet « Loft »/.test(mails.fr) && /Cordialement,/.test(mails.fr));

/* tout le contenu standard du devis a sa traduction */
const manquants = await page.evaluate(() => {
  const lib = defaultLibrary(); const src = [];
  lib.sections.forEach(s => { src.push(s.name); s.items.forEach(i => { src.push(i.title); if (i.desc) src.push(i.desc); }); });
  DEFAULT_EXCLUS.forEach(t => src.push(t)); DEFAULT_CGV.forEach(c => { src.push(c.title); src.push(c.body); });
  const cles = Object.keys(I18N.DV_EN).map(I18N.norm);
  return src.filter(t => !cles.includes(I18N.norm(t)));
});
check('Chaque prestation, catégorie, exclusion et clause standard a sa traduction', manquants.length === 0, manquants.join(' || '));
check('Un texte écrit à la main reste tel quel dans un devis anglais', await page.evaluate(() => I18N.dvTr({ lang: 'en' }, 'Mon texte perso') === 'Mon texte perso'));

/* Messages d'action en anglais — les trois cas signalés le 16 oct. 2026 (« Signature enregistrée »,
   « Estimation supprimée », « Catégories enregistrées » restaient en français), jouées par les vraies
   fonctions de l'application. Ce que l'utilisateur écrit (nom de l'estimation) reste intact. */
await page.evaluate(() => setUiLang('en'));
const gestes = await page.evaluate(async () => {
  const att = (ms = 250) => new Promise(r => setTimeout(r, ms));
  const toastTxt = () => document.getElementById('toast').textContent;
  const modalTxt = () => document.getElementById('modal').innerText.replace(/\s+/g, ' ').trim();
  const out = {};
  /* signature : tracer un trait, valider */
  openClientSignaturePad(); await att();
  const cv = document.getElementById('sig-canvas'); const c = cv.getContext('2d');
  c.beginPath(); c.moveTo(20, 20); c.lineTo(200, 90); c.stroke();
  saveSignaturePad(); await att();
  out.signature = toastTxt();
  /* effacer la signature : confirmation puis message */
  clearSignature(); await att();
  out.confirmSignature = modalTxt();
  document.getElementById('confirm-yes').click(); await att();
  out.signatureEffacee = toastTxt();
  /* estimation : suppression d'une estimation au nom saisi à la main */
  chantierList = [{ id: 'e1', title: 'Villa Lévy — étage', updatedAt: 1, cats: [] }];
  openChantierListPanel(); await att();
  out.listeEstimations = modalTxt();
  deleteChantierRecord('e1'); await att();
  out.confirmEstimation = modalTxt();
  document.getElementById('confirm-yes').click(); await att();
  out.estimationSupprimee = toastTxt();
  /* catégories : enregistrer */
  openChantierCatsPanel(); await att();
  await chCatLibSave(); await att();
  out.categories = toastTxt();
  return out;
});
check('Interface en anglais : « Signature enregistrée » -> Signature saved', gestes.signature === 'Signature saved', gestes.signature);
check('Interface en anglais : confirmation d’effacement de la signature traduite', /Clear the client's signature\?/.test(gestes.confirmSignature) && /Confirm/.test(gestes.confirmSignature) && /Cancel/.test(gestes.confirmSignature), gestes.confirmSignature);
check('Interface en anglais : « Signature effacée » -> Signature cleared', gestes.signatureEffacee === 'Signature cleared', gestes.signatureEffacee);
check('Interface en anglais : confirmation de suppression d’une estimation traduite', /Delete this estimate\?/.test(gestes.confirmEstimation), gestes.confirmEstimation);
check('Interface en anglais : « Estimation supprimée » -> Estimate deleted', gestes.estimationSupprimee === 'Estimate deleted', gestes.estimationSupprimee);
check('Interface en anglais : « Catégories enregistrées » -> Categories saved', gestes.categories === 'Categories saved', gestes.categories);
check('Ce que l’utilisateur a écrit (nom d’une estimation) reste intact en anglais', /Villa Lévy — étage/.test(gestes.listeEstimations), gestes.listeEstimations);
await page.evaluate(() => closeModal());

/* aucun texte français ne reste à l'écran sur les écrans principaux (en anglais), hors données de l'utilisateur */
const restes = await page.evaluate(async () => {
  const att = (ms = 200) => new Promise(r => setTimeout(r, ms));
  const tout = new Set();
  const ecrans = [
    () => showView('dashboard'), () => { showView('devis'); showTab('editor'); }, () => { showView('devis'); showTab('list'); },
    () => showView('clients'), () => showView('realisations'), () => showView('boutique'),
    () => openSettingsPanel(), () => { closeModal(); openLibraryPanel(); }, () => { closeModal(); openCgvPanel(); },
    () => { closeModal(); openBackupPanel(); }, () => { closeModal(); openSyncPanel(); }, () => { closeModal(); openRecherche(); },
    () => { closeModal(); openClientStatusesPanel(); }, () => { closeModal(); openTaskModal(); }, () => { closeModal(); openTaskCategoriesPanel(); },
    () => { closeModal(); openChantierCatsPanel(); }, () => { closeModal(); openSitePanel(); }, () => { closeModal(); openIaSettingsPanel(); },
    () => { closeModal(); openIaModelsPanel(); }, () => { closeModal(); openTxtUsagePanel(); }, () => { closeModal(); openShootingMemo(); },
  ];
  for (const f of ecrans) { try { f(); } catch (e) {} await att(); __trManquants().forEach(t => tout.add(t)); }
  closeModal();
  /* marque de l'entreprise et numéro de version : identiques dans toutes les langues */
  return [...tout].filter(t => !/^(MELISSA NABET|Aa|v14 · .*|fal\.ai\/models)$/.test(t));
});
check('Interface en anglais : aucun texte français ne reste sur les écrans principaux', restes.length === 0, restes.slice(0, 15).join(' || '));

/* mémorisation de l'interface après rechargement, puis retour au français */
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
check('La langue de l’interface survit au rechargement', (await navTexte())[0] === 'Dashboard', (await navTexte()).join('|'));
await page.evaluate(() => toggleUiLang());
const fr = await page.evaluate(() => ({
  nav: [...document.querySelectorAll('.viewnav .vnav')].map(b => b.textContent.trim().replace(/\s*▾/, '')),
  btn: document.getElementById('ui-lang-btn').textContent,
  lang: document.documentElement.lang,
}));
check('Retour au français : tout est restitué à l’identique', fr.nav.join('|') === 'Tableau de bord|Devis|Clients|Réalisations|Boutique' && fr.btn === '🌐 EN' && fr.lang === 'fr', JSON.stringify(fr));

/* --- téléphone --- */
const tel = await browser.newPage({ viewport: { width: 390, height: 780 } });
const errTel = [];
tel.on('pageerror', e => errTel.push(e.message));
await tel.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await tel.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await tel.reload({ waitUntil: 'domcontentloaded' });
await tel.waitForTimeout(1200);
await tel.evaluate(() => openSettingsPanel());
const regTel = await tel.evaluate(() => {
  const s = document.getElementById('set-ui-lang'); const r = s.getBoundingClientRect();
  return { visible: r.width > 0, horsEcran: r.right > innerWidth + 1, scrollX: document.documentElement.scrollWidth > innerWidth + 1 };
});
check('Téléphone : le choix de la langue est visible dans les Réglages, sans défilement horizontal', regTel.visible && !regTel.horsEcran && !regTel.scrollX, JSON.stringify(regTel));
await tel.evaluate(() => { const s = document.getElementById('set-ui-lang'); s.value = 'en'; s.dispatchEvent(new Event('change')); });
await tel.waitForTimeout(200);
const navTel = await tel.evaluate(() => [...document.querySelectorAll('#navbas button')].map(b => b.textContent.trim()));
check('Téléphone : barre du bas traduite', navTel.join('|').replace(/[^\w|]/g, '') === 'Dashboard|Quotes|Clients|Portfolio|Shop', navTel.join('|'));
if (process.env.CAPTURE) await tel.screenshot({ path: process.env.CAPTURE });

check('Aucune erreur JavaScript (ordinateur)', errs.length === 0, errs.join(' | '));
check('Aucune erreur JavaScript (téléphone)', errTel.length === 0, errTel.join(' | '));

await browser.close();
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`);
process.exit(ko.length ? 1 : 0);
