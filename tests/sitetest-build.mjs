/* Banc d'essai du site vitrine.
   Le site lit un manifeste et des images sur le stockage public Supabase. Pour le tester
   sans réseau ni compte, on en fabrique une copie locale : même page, mais l'adresse du
   stockage pointe sur le serveur de test. Rien n'est deviné — c'est le fichier réel du
   dépôt qui est copié, avec cette seule substitution.

   Usage :
     node tests/sitetest-build.mjs            # construit dans /tmp/mn-sitetest
     python3 -m http.server 8902 -d /tmp/mn-sitetest
     node tests/site.test.mjs
*/
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.env.SITE_DIR || '/tmp/mn-sitetest';
const BASE = 'http://127.0.0.1:8902/galerie/';

const source = readFileSync(join(RACINE, 'site-vitrine/index.html'), 'utf8');
const avant = source.match(/var STORAGE = '[^']+';/);
if (!avant) throw new Error('STORAGE introuvable dans site-vitrine/index.html');
const local = source.replace(/var STORAGE = '[^']+';/, "var STORAGE = '" + BASE + "';")
                    .replace(/var OWNER = '[^']+';/, "var OWNER = 'u';");
/* La page « vide » lit un dossier sans manifeste : c'est l'état du site avant la première
   publication, et il doit rester lisible au lieu d'avoir l'air cassé. */
const vide = local.replace("var OWNER = 'u';", "var OWNER = 'pas-encore-publie';");

mkdirSync(join(DIR, 'galerie/u/r1'), { recursive: true });
writeFileSync(join(DIR, 'index.html'), local);
writeFileSync(join(DIR, 'vide.html'), vide);
/* Fichiers servis tels quels : ils sont testés à l'octet près, pas régénérés. */
for (const f of ['robots.txt', 'sitemap.xml']) {
  copyFileSync(join(RACINE, 'site-vitrine', f), join(DIR, f));
}

/* `portrait` ne change que les dimensions DÉCLARÉES : c'est là-dessus que la page décide
   de mettre deux photos côte à côte, et c'est donc ça qu'il faut éprouver. */
const photo = (i, legende, portrait) => {
  const o = { full: 'u/r1/p' + i + '.jpg', thumb: 'u/r1/t' + i + '.jpg',
              w: portrait ? 1067 : 1600, h: portrait ? 1600 : 1067, cover: i === 0 };
  if (legende) o.caption = legende;
  return o;
};
writeFileSync(join(DIR, 'galerie/u/manifest.json'), JSON.stringify({
  version: 1,
  updatedAt: new Date().toISOString(),
  /* Les coordonnées du banc d'essai sont fictives et n'appartiennent à personne : elles
     servent à vérifier la forme des liens, pas à publier quoi que ce soit. */
  site: { title: 'Melissa Nabet', subtitle: 'Architecture d’intérieur',
          apropos: 'Texte de présentation du banc d’essai.',
          email: 'essai@example.com', tel: '052 000 00 00', instagram: '@essai' },
  /* Trois projets et deux catégories : c'est le minimum pour que le filtre du site ait un
     sens et soit vérifiable. Les deux derniers réutilisent les mêmes fichiers d'image —
     le banc d'essai teste la page, pas les photos. */
  realisations: [{
    id: 'r1', title: 'Bureau Sébastien', date: '2026',
    lieu: 'Tel Aviv', surface: '85 m²', mission: 'Rénovation complète', categorie: 'Bureau',
    texte: 'Un plateau de bureaux cloisonné, ramené à un seul volume traversant. Les rangements ont été redessinés sur mesure pour dégager la vue depuis l’entrée.',
    publishedAt: new Date().toISOString(),
    photos: [photo(0, ''), photo(1, 'Cuisine ouverte, plan de travail en chêne massif.'), photo(2, '', true)],
  }, {
    id: 'r2', title: 'Duplex Ben Yehuda', date: '2025',
    lieu: 'Tel Aviv', categorie: 'Appartement',
    publishedAt: new Date().toISOString(),
    photos: [photo(0, ''), photo(1, '')],
  }, {
    id: 'r3', title: 'Trois pièces Florentin', date: '2025',
    categorie: 'Appartement',
    publishedAt: new Date().toISOString(),
    photos: [photo(2, '')],
  }],
}, null, 1));

console.log('Banc d’essai du site construit dans ' + DIR);
console.log('Servez-le : python3 -m http.server 8902 -d ' + DIR);
