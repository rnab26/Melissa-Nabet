/* Traduction anglaise : AUCUN texte écrit en dur dans le code ne peut manquer au dictionnaire.

   Cause du bug du 16 oct. 2026 : le dictionnaire (UI_EN, i18n.js) ne contenait qu'une partie des
   textes. En anglais, « Signature enregistrée », « Estimation supprimée »… restaient en français,
   et rien ne le signalait, puisque le moteur laisse en français ce qu'il ne connaît pas.

   Ce test lit assets/crm.js (analyse syntaxique, pas de navigateur), relève chaque texte français
   qui peut s'afficher — messages (toast), confirmations, erreurs, états vides, libellés, gabarits
   HTML — et exige qu'il ait sa traduction. Il échoue en listant les textes manquants.
   Un trou « {1} » dans un texte est une valeur insérée par le code (nom, nombre) : le test la
   remplace par un exemple avant de chercher la traduction.

   Un texte qui ne s'affiche JAMAIS à l'écran (nom de classe, message de console, contenu d'un
   fichier) se range dans tests/i18n-hors-ecran.json, avec la raison — exception explicite et
   relue, jamais un texte oublié.

   Lancer :  node tests/traduction-complete.test.mjs          (aucun serveur, aucun navigateur)
   Lister les manquants sous forme prête à ranger :  node tests/traduction-complete.test.mjs --lister
*/
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');
const req = createRequire(import.meta.url);
let acorn;
for (const base of [undefined, '/opt/node-tools/node_modules/', '/usr/lib/node_modules/', '/opt/node22/lib/node_modules/']) {
  try { acorn = base ? createRequire(base)('acorn') : req('acorn'); break; } catch (e) {}
}
if (!acorn) { console.error('Il faut le paquet « acorn » (npm i -g acorn) pour lire le code.'); process.exit(2); }
const I18N = req(path.join(racine, 'i18n.js'));

const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

/* ---------- 1. Tous les textes du code ---------- */
function textesDuCode(fichier) {
  const src = fs.readFileSync(fichier, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true });
  const sortie = [];
  /* Aplatit « 'a '+x+' b' » et `a ${x} b` en morceaux ; null = valeur inconnue (un trou). */
  function aplatir(n, parts) {
    if (n.type === 'Literal' && typeof n.value === 'string') { parts.push(n.value); return true; }
    if (n.type === 'TemplateLiteral') {
      n.quasis.forEach((q, i) => { parts.push(q.value.cooked); if (i < n.expressions.length) parts.push(null); });
      return true;
    }
    if (n.type === 'BinaryExpression' && n.operator === '+') {
      const a = [], b = [];
      const l = aplatir(n.left, a), r = aplatir(n.right, b);
      if (!l && !r) return false;
      if (l) parts.push(...a); else parts.push(null);
      if (r) parts.push(...b); else parts.push(null);
      return true;
    }
    return false;
  }
  function visiter(n, parent) {
    if (!n || typeof n.type !== 'string') return;
    const texte = (n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral'
      || (n.type === 'BinaryExpression' && n.operator === '+');
    if (texte && !(parent && parent.type === 'BinaryExpression' && parent.operator === '+')) {
      const parts = [];
      if (aplatir(n, parts)) {
        const appelant = parent && parent.type === 'CallExpression' && parent.callee ? src.slice(parent.callee.start, parent.callee.end) : '';
        sortie.push({ ligne: n.loc.start.line, parts, appelant });
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && visiter(c, n));
      else if (v && typeof v.type === 'string') visiter(v, n);
    }
  }
  visiter(ast, null);
  return sortie;
}

/* Un texte est « français » s'il a une lettre accentuée ou un mot courant du français. */
const FR = /[àâäçéèêëîïôöùûüÿœæÀÉÈÊÎÔÙÛ]|\b(le|la|les|un|une|des|du|de|ce|cette|pour|avec|sans|dans|sur|est|pas|ou|et|ton|tes|ta|mon|vos|votre|aucun|aucune|nouveau|nouvelle|ajouter|supprimer|enregistr\w*|choisis|touche|devis|client\w*|erreur|impossible|trop|tous|toutes|plus|moins|déjà|été)\b/i;
/* Un mot isolé sans accent (« Total », « Prix », « Rappel ») n'a rien de français à l'œil nu : on
   le tient pour un texte d'écran dès qu'il commence par une majuscule ou contient une espace,
   sauf s'il ressemble à du code (classe CSS, sélecteur, en-tête HTTP, police…). */
function ressembleAUnTexteDEcran(t) {
  const s = t.replace(/\{\d+\}/g, '');
  if (!(/^[A-ZÀ-Ý«“(•✨🌐]/.test(t) || / /.test(t))) return false;
  return !(/^[A-Za-z0-9_\-#.:\[\]="',\/ ()%;{}+*!&@?<>|]*$/.test(s) && /[_#.\[\]=;{}<>|]/.test(s));
}
/* Fonctions dont l'argument est affiché tel quel : on exige leur traduction même sans mot français repérable. */
const AFFICHAGE = /^(toast|askConfirm|bkDire|bkProgres|dire|setBtn)$/;

/* Découpe en morceaux de texte tels que l'écran les montre (un morceau par nœud de texte). */
const PARTIE_HTML = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/gi;
function morceaux(parts, appelant) {
  let i = 0;
  const s = parts.map(p => p === null ? '{' + (++i) + '}' : p).join('');
  const out = [];
  const ajouter = (t, source, affiche) => {
    t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (!t || !/[A-Za-zÀ-ÿ]{2}/.test(t.replace(/\{\d+\}/g, ''))) return;
    out.push({ t, source, force: affiche || AFFICHAGE.test(appelant) });
  };
  if (/<[a-zA-Z\/!]/.test(s)) {
    for (const m of s.matchAll(PARTIE_HTML)) {
      const partie = m[0];
      if (/^<!--|^<(?:script|style)\b/i.test(partie)) continue;
      if (partie[0] === '<') {
        for (const a of partie.matchAll(/\b(?:placeholder|title|aria-label|alt)=(?:"([^"]*)"|'([^']*)')/g)) ajouter(a[1] ?? a[2], 'attribut');
      } else {
        /* le texte entre deux balises s'affiche forcément : on l'exige même en un seul mot en minuscules */
        ajouter(partie, 'html', true);
      }
    }
  } else ajouter(s, appelant || 'texte');
  return out;
}

const horsEcran = JSON.parse(fs.readFileSync(path.join(ici, 'i18n-hors-ecran.json'), 'utf8'));
const ignores = new Set(horsEcran.textes.map(x => x.texte));
const fichierJs = path.join(racine, 'assets', 'crm.js');
const vus = new Map();
for (const r of textesDuCode(fichierJs)) {
  for (const m of morceaux(r.parts, r.appelant)) {
    if (!(FR.test(m.t) || m.force || ressembleAUnTexteDEcran(m.t))) continue;
    if (!vus.has(m.t)) vus.set(m.t, { ...m, ligne: r.ligne });
  }
}
/* Le texte écrit directement dans index.html (écran de connexion, titres, intro des onglets) */
{
  const html = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  for (const m of morceaux([html], '')) {
    if (!vus.has(m.t)) vus.set(m.t, { ...m, ligne: 'index.html' });
  }
}
const manquants = [];
for (const [t, m] of vus) {
  if (ignores.has(t)) continue;
  /* « {1} » -> une valeur d'exemple, comme à l'écran */
  const exemple = t.replace(/\{\d+\}/g, '12');
  if (I18N.uiTr(exemple) == null) manquants.push({ ...m, t });
}

if (process.argv.includes('--lister')) {
  fs.writeSync(1, manquants.map(m => JSON.stringify({ texte: m.t, raison: '' }) + ',  // ligne ' + m.ligne).join('\n') + '\n');
  process.exit(0);
}

console.log('\n' + vus.size + ' textes français repérés dans assets/crm.js ; ' + ignores.size + ' déclarés hors écran.');
check('Chaque texte en dur du code (messages, confirmations, erreurs, états vides, libellés) a sa traduction anglaise',
  manquants.length === 0,
  manquants.length + ' manquant(s) — ajouter une ligne « français : anglais » dans UI_EN (i18n.js) pour chacun :\n    '
  + manquants.slice(0, 40).map(m => 'ligne ' + m.ligne + ' · ' + m.t.slice(0, 110)).join('\n    ')
  + (manquants.length > 40 ? '\n    … et ' + (manquants.length - 40) + ' autres' : ''));

/* ---------- 2. Le dictionnaire lui-même ---------- */
const trous = s => (s.match(/\{\d+\}/g) || []);
const incoherents = [], vides = [], resteFrancais = [];
for (const [fr, en] of Object.entries(I18N.UI_EN)) {
  if (!String(en).trim()) vides.push(fr);
  const permis = new Set(trous(fr));
  if (trous(en).some(x => !permis.has(x))) incoherents.push(fr);
}
check('Aucune traduction vide', vides.length === 0, vides.slice(0, 5).join(' || '));
check('Une traduction n’invente jamais de « {n} » absent du texte français', incoherents.length === 0, incoherents.slice(0, 5).join(' || '));

/* ---------- 3. Le moteur : trous, pluriels, protection des données de l'utilisateur ---------- */
const eq = (a, b) => a === b;
check('Motif à trou : « Supprimer Dupont ? » -> anglais, nom conservé', eq(I18N.uiTr('Supprimer Dupont ?'), 'Delete Dupont?'), I18N.uiTr('Supprimer Dupont ?'));
check('Motif à trou : pluriel collé (« 3 tâches »)', eq(I18N.uiTr('3 tâches'), '3 tasks'), I18N.uiTr('3 tâches'));
check('Un nom de client ressemblant à un début de phrase n’est pas traduit', I18N.uiTr('Clientèle Dupont') == null && I18N.uiTr('Dupont SARL') == null);
check('Les textes standard du devis sont aussi traduits dans l’éditeur', eq(I18N.uiTr('Suivi des travaux'), 'Works supervision'));

/* ---------- bilan ---------- */
console.log('\n' + ok.length + ' OK, ' + ko.length + ' échec(s)');
process.exit(ko.length ? 1 : 0);
