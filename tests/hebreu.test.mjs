/* Traduction hébraïque : interface ET devis, sens de lecture de droite à gauche.
   - interface en hébreu : <html dir="rtl" lang="he">, mise en page retournée, retour au français propre ;
   - devis en hébreu : libellés, contenu standard, pages en dir="rtl", fenêtre PDF, e-mail / WhatsApp ;
   - les deux langues restent indépendantes (devis français dans une interface hébraïque : dir="ltr").
   Lancer :  python3 -m http.server 8899   puis   node tests/hebreu.test.mjs
*/
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

/* --- 0. Les dictionnaires (sans navigateur) : tout ce qui est traduit en anglais l'est en hébreu --- */
const I = require('../i18n.js'); require('../i18n-he.js');
const manqueUi = Object.keys(I.UI_EN).filter(k => I.uiTr(k, 'he') == null);
const manqueDv = Object.keys(I.DV_EN).filter(k => I.dvTr({ lang: 'he' }, k) === k);
const manqueLbl = Object.keys(I.DV_LABELS.en).filter(k => I.DV_LABELS.he[k] == null || I.DV_LABELS.he[k] === '');
check('Dictionnaire : chaque texte d’écran traduit en anglais l’est aussi en hébreu', manqueUi.length === 0, manqueUi.slice(0, 5).join(' | '));
check('Dictionnaire : chaque texte standard de devis l’est aussi (prestations, conditions générales)', manqueDv.length === 0, manqueDv.slice(0, 5).join(' | '));
check('Dictionnaire : chaque libellé fixe du devis existe en hébreu', manqueLbl.length === 0, manqueLbl.join(','));
const sansHebreu = Object.entries(I.UI_EN).filter(([k]) => !/[֐-׿]/.test(I.uiTr(k, 'he') || '') && !/^[\W\d\sA-Za-z$€₪()]*$/.test(k));
check('Dictionnaire : aucune « traduction » hébraïque qui ne contienne pas d’hébreu', sansHebreu.length === 0, sansHebreu.slice(0, 3).map(x => x[0]).join(' | '));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none'));

const dirLang = () => page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang }));
const navTexte = () => page.evaluate(() => [...document.querySelectorAll('.viewnav .vnav')].map(b => b.textContent.trim().replace(/\s*▾/, '')));
const devisTexte = () => page.evaluate(() => document.getElementById('devis').innerText);

/* --- 1. Départ : français, de gauche à droite --- */
let dl = await dirLang();
check('Par défaut : français, de gauche à droite', (dl.dir === '' || dl.dir === 'ltr') && dl.lang === 'fr', JSON.stringify(dl));
check('Réglages : la langue d’interface propose Français, English et עברית',
  await page.evaluate(() => { openSettingsPanel(); const r = [...document.getElementById('set-ui-lang').options].map(o => o.textContent).join('|'); const d = [...document.getElementById('set-devis-lang').options].map(o => o.textContent).join('|'); closeModal(); return r + '#' + d; }) === 'Français|English|עברית#Français|English|עברית');
check('Éditeur : la langue du devis propose aussi עברית',
  await page.evaluate(() => [...document.getElementById('f-lang').options].map(o => o.value).join('|')) === 'fr|en|he');

/* --- 2. Menu déroulant de la barre : montre la langue active, choisir change la langue --- */
const cycle = [];
for (const v of ['en', 'he', 'fr']) { await page.selectOption('#ui-lang-select', v); cycle.push(await page.evaluate(() => uiLang() + ':' + document.getElementById('ui-lang-select').value)); }
check('Menu 🌐 : choisir en / he / fr change la langue et affiche la langue active', cycle.join('>') === 'en:en>he:he>fr:fr', cycle.join('>'));
check('Menu 🌐 : trois choix, chacun dans sa langue', await page.evaluate(() => [...document.getElementById('ui-lang-select').options].map(o => o.textContent.replace('🌐 ', '')).join('|')) === 'Français|English|עברית');

/* --- 3. Interface en hébreu --- */
await page.evaluate(() => { showView('devis'); showTab('editor'); });
const posFr = await page.evaluate(() => ({ ed: document.querySelector('.editor').getBoundingClientRect().left, dv: document.getElementById('devis').getBoundingClientRect().left }));
await page.evaluate(() => setUiLang('he'));
await page.waitForTimeout(400);
dl = await dirLang();
check('Interface en hébreu : <html dir="rtl" lang="he">', dl.dir === 'rtl' && dl.lang === 'he', JSON.stringify(dl));
const nav = await navTexte();
check('Interface en hébreu : navigation traduite', nav[0] === 'לוח בקרה' && nav.includes('לקוחות') && nav.includes('פרויקטים') && nav.includes('חנות'), nav.join('|'));
const ed = await page.evaluate(() => ({
  boutons: [...document.querySelectorAll('.editor .btn')].map(b => b.textContent.trim()),
  lbl: [...document.querySelectorAll('.editor .lbl')].map(b => b.textContent.trim()),
}));
check('Interface en hébreu : éditeur de devis traduit', ed.boutons.includes('💾 שמירת הצעה') && ed.lbl.includes('שפת ההצעה') && ed.lbl.includes('שם הפרויקט'), ed.boutons.join('|'));
const posHe = await page.evaluate(() => ({ ed: document.querySelector('.editor').getBoundingClientRect().left, dv: document.getElementById('devis').getBoundingClientRect().left }));
check('Mise en page retournée : l’éditeur passe à droite de l’aperçu (il était à gauche)',
  posFr.ed < posFr.dv && posHe.ed > posHe.dv, JSON.stringify({ posFr, posHe }));
check('Barre du haut : le nom est à droite, les boutons à gauche',
  await page.evaluate(() => document.querySelector('.toolbar .brand').getBoundingClientRect().left > document.getElementById('ui-lang-select').getBoundingClientRect().left));
check('Le texte d’un champ de formulaire s’aligne à droite',
  await page.evaluate(() => getComputedStyle(document.getElementById('f-raison')).direction === 'rtl'));
check('Le devis français reste de gauche à droite dans une interface hébraïque (indépendance)',
  await page.evaluate(() => document.getElementById('devis').dir === 'ltr' && !document.querySelector('#devis .devis-page[dir=rtl]')) && /Destiné à/.test(await devisTexte()));
check('Espacement des lettres supprimé sur l’hébreu (illisible sinon)',
  await page.evaluate(() => [...document.querySelectorAll('.sec-t,.stitle,h2,h3,.lbl')].filter(e => /[֐-׿]/.test(e.textContent)).every(e => getComputedStyle(e).letterSpacing === 'normal')));
check('Hébreu : le menu de la barre affiche la langue active (עברית)', await page.evaluate(() => document.getElementById('ui-lang-select').value) === 'he');
check('Hébreu : le titre de l’onglet du navigateur est traduit', /^מחולל הצעות מחיר — /.test(await page.title()), await page.title());

/* contenu créé après coup */
await page.evaluate(() => toggleDevisMenu());
check('Menu Devis (créé à la demande) traduit en hébreu', await page.evaluate(() => [...document.querySelectorAll('#vn-devis-menu button')].map(b => b.textContent.trim()).join('|')) === '📝 עריכה|📂 ההצעות שלי|📐 אומדן פרויקט');
await page.evaluate(() => toggleDevisMenu());
await page.evaluate(() => openSettingsPanel());
check('Réglages en hébreu : titre et choix de langue', await page.evaluate(() => document.querySelector('#modal h3').textContent) === 'הגדרות' && await page.evaluate(() => document.getElementById('set-ui-lang').value) === 'he');
await page.evaluate(() => closeModal());

/* préférence retenue, sans clignotement, après rechargement */
await page.reload({ waitUntil: 'domcontentloaded' });
const avantJs = await page.evaluate(() => ({ dir: document.documentElement.dir, ls: localStorage.getItem('mn_ui_lang') }));
check('Rechargement : la langue de l’interface est mémorisée (hébreu, rtl)', avantJs.dir === 'rtl' && avantJs.ls === 'he', JSON.stringify(avantJs));
await page.waitForTimeout(1000);
await page.evaluate(() => document.querySelectorAll('.login-wrap,#login-overlay,.login-overlay').forEach(e => e.style.display = 'none'));

/* --- 4. Retour au français : tout redevient exactement comme avant --- */
await page.evaluate(() => setUiLang('fr'));
await page.waitForTimeout(300);
dl = await dirLang();
check('Retour au français : de gauche à droite, lang="fr"', dl.dir === 'ltr' && dl.lang === 'fr', JSON.stringify(dl));
check('Retour au français : navigation française', (await navTexte())[0] === 'Tableau de bord');
check('Retour au français : plus aucun hébreu dans les boutons de l’éditeur',
  await page.evaluate(() => ![...document.querySelectorAll('.editor .btn,.editor .lbl')].some(e => /[֐-׿]/.test(e.textContent))));

/* --- 5. Devis en hébreu (interface en français : indépendance dans l'autre sens) --- */
await page.evaluate(() => {
  showView('devis'); showTab('editor');
  document.getElementById('f-raison').value = 'דנה כהן בע״מ';
  document.getElementById('f-raison').dispatchEvent(new Event('input'));
  document.getElementById('f-gamount').value = '12345';
  document.getElementById('f-gamount').dispatchEvent(new Event('input'));
  const l = document.getElementById('f-lang'); l.value = 'he'; l.dispatchEvent(new Event('change'));
});
await page.waitForTimeout(500);
const dvHe = await devisTexte();
check('Devis en hébreu : libellés fixes en hébreu', /מיועד ל/.test(dvHe) && /הצעת מחיר/.test(dvHe) && /מס׳/.test(dvHe), dvHe.slice(0, 150).replace(/\n/g, ' / '));
const restes = dvHe.match(/Destiné à|Montant total|Signature client|Déroulement|Hors prestation|Conditions générales|\bTVA\b|\bTél\b/g);
check('Devis en hébreu : plus aucun libellé français fixe', !restes, String(restes));
check('Devis en hébreu : totaux « סה״כ כולל מע״מ » et séparateur de milliers', /שכר טרחה — מחיר כולל \(לפני מע״מ\)/.test(dvHe) && /סה״כ כולל מע״מ/.test(dvHe) && /12,345/.test(dvHe), String(dvHe.match(/12.345[^\n]*/g)));
check('Devis en hébreu : conditions générales d’origine traduites', /תנאים כלליים/.test(dvHe) && /מהות החוזה/.test(dvHe));
check('Devis en hébreu : le nom du client (saisi par Melissa) reste tel quel', /דנה כהן בע״מ/.test(dvHe));
const rtlDevis = await page.evaluate(() => ({
  conteneur: document.getElementById('devis').dir,
  pages: [...document.querySelectorAll('#devis .devis-page')].map(p => p.getAttribute('dir')),
  dirCalcule: getComputedStyle(document.querySelector('#devis .devis-page')).direction,
  police: getComputedStyle(document.querySelector('#devis .dv-title')).fontFamily,
}));
check('Devis en hébreu : chaque page est en dir="rtl"', rtlDevis.conteneur === 'rtl' && rtlDevis.pages.length >= 1 && rtlDevis.pages.every(d => d === 'rtl') && rtlDevis.dirCalcule === 'rtl', JSON.stringify(rtlDevis));
check('Devis en hébreu : police à glyphes hébreux (Frank Ruhl Libre / Assistant)', /Frank Ruhl|David/.test(rtlDevis.police), rtlDevis.police);
check('Devis en hébreu : l’interface est restée en français', (await navTexte())[0] === 'Tableau de bord');
check('Devis en hébreu : les deux blocs d’en-tête sont inversés (infos du devis à droite, client à gauche)',
  await page.evaluate(() => { const c = document.querySelectorAll('#devis .dv-head .col'); return c[0].getBoundingClientRect().left > c[1].getBoundingClientRect().left; }));
check('Devis en hébreu : le total est aligné à gauche (côté « fin » en hébreu)',
  await page.evaluate(() => getComputedStyle(document.querySelector('#devis .dv-totals .tr .v')).textAlign === 'left'));

/* fenêtre PDF / impression */
const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 8000 }).catch(() => null), page.evaluate(() => openDevisWindow())]);
if (popup) {
  await popup.waitForLoadState('domcontentloaded');
  const pw = await popup.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, titre: document.title, pages: document.querySelectorAll('.devis-page[dir=rtl]').length }));
  check('Fenêtre PDF du devis hébreu : dir="rtl", lang="he", titre « הצעת מחיר »', pw.dir === 'rtl' && pw.lang === 'he' && /^הצעת מחיר/.test(pw.titre) && pw.pages >= 1, JSON.stringify(pw));
  await popup.close();
} else check('Fenêtre PDF du devis hébreu : ouverte', false, 'aucune fenêtre');

/* messages envoyés au client */
const mails = await page.evaluate(() => {
  current.num = '0078'; current.contact = 'דן'; current.proj = 'לופט';
  return devisMessageTexte('mail').corps + '\n###\n' + devisMessageTexte('wa').corps;
});
check('E-mail et WhatsApp d’un devis hébreu : en hébreu', /שלום דן/.test(mails) && /מצורפת הצעת המחיר מס׳: ?0078|מצורפת הצעת המחיר מס׳0078/.test(mails) && /בברכה/.test(mails) && /וואטסאפ ווב/.test(mails), mails.slice(0, 120));

/* un devis de langue hébraïque est enregistré avec le devis et revient tel quel */
await page.evaluate(() => { current.proj = 'Loft'; openSavePanel(); saveSel = null; doSaveDevis(); });
await page.waitForTimeout(500);
const rech = await page.evaluate(() => {
  const d = devisList[devisList.length - 1];
  const sauve = d && d.snapshot && d.snapshot.lang;
  current.lang = 'fr'; loadDevis(d.id);
  return { sauve, apres: current.lang, champ: document.getElementById('f-lang').value, dir: document.getElementById('devis').dir };
});
check('La langue hébraïque du devis est enregistrée avec le devis et revient à la réouverture', rech.sauve === 'he' && rech.apres === 'he' && rech.champ === 'he' && rech.dir === 'rtl', JSON.stringify(rech));
check('Une langue inconnue dans un ancien devis retombe sur le français', await page.evaluate(() => { const d = devisList[devisList.length - 1]; d.snapshot.lang = 'xx'; loadDevis(d.id); return current.lang; }) === 'fr');

/* langue par défaut des nouveaux devis */
await page.evaluate(() => { openSettingsPanel(); const s = document.getElementById('set-devis-lang'); s.value = 'he'; s.dispatchEvent(new Event('change')); closeModal(); newDevis(); });
check('Nouveau devis : prend la langue par défaut des réglages (hébreu)', await page.evaluate(() => current.lang) === 'he' && await page.evaluate(() => document.getElementById('f-lang').value) === 'he');

/* --- 6. Anglais et hébreu ensemble : passage direct de l'un à l'autre --- */
await page.evaluate(() => setUiLang('en'));
await page.waitForTimeout(200);
check('Anglais : de gauche à droite et navigation anglaise', (await dirLang()).dir === 'ltr' && (await navTexte())[0] === 'Dashboard');
await page.evaluate(() => setUiLang('he'));
await page.waitForTimeout(200);
check('Anglais → hébreu directement : navigation hébraïque', (await dirLang()).dir === 'rtl' && (await navTexte())[0] === 'לוח בקרה');
await page.evaluate(() => setUiLang('en'));
await page.waitForTimeout(200);
check('Hébreu → anglais directement : navigation anglaise (pas de reste d’hébreu)', (await navTexte())[0] === 'Dashboard' && !(await page.evaluate(() => /[֐-׿]/.test(document.querySelector('.viewnav').textContent))));
await page.evaluate(() => setUiLang('he'));

/* --- 7. Écran de téléphone : rien ne déborde, dans aucun écran --- */
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
for (const v of ['dashboard', 'devis', 'clients', 'chantier', 'realisations', 'boutique']) {
  const r = await page.evaluate(vv => { showView(vv); const d = document.documentElement; return { v: vv, sw: d.scrollWidth, cw: d.clientWidth }; }, v);
  await page.waitForTimeout(250);
  const r2 = await page.evaluate(() => { const d = document.documentElement; return { sw: d.scrollWidth, cw: d.clientWidth }; });
  check(`Téléphone, hébreu, écran « ${v} » : pas de défilement horizontal`, r2.sw <= r2.cw + 1, JSON.stringify(r2));
}

check('Aucune erreur JavaScript pendant tout le parcours', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n===== HÉBREU : ${ok.length} OK, ${ko.length} ECHEC =====`);
if (ko.length) { console.log(ko.join('\n')); process.exit(1); }
