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
/* Deux échecs qui n'en sont qu'un seul en apparence, et qu'il faut éprouver séparément :
   - « vide »  : le manifeste est là, il n'annonce aucune réalisation — rien n'est encore
                 publié, le site le dit sans faire croire à une panne ;
   - « panne » : le manifeste est introuvable — la lecture échoue vraiment, et le visiteur
                 doit pouvoir réessayer au lieu de repartir en croyant qu'il n'y a rien. */
const vide = local.replace("var OWNER = 'u';", "var OWNER = 'rien-publie';");
const panne = local.replace("var OWNER = 'u';", "var OWNER = 'pas-de-manifeste';");
/* Et le manifeste RÉELLEMENT en ligne aujourd'hui, qui ne connaît ni langues ni journal :
   la page doit le lire sans broncher, sinon on casse le site en production. */
const ancien = local.replace("var OWNER = 'u';", "var OWNER = 'v';");
/* La direction « Index » telle qu'elle ARRIVERA vraiment : portée par le manifeste, pas
   posée à la main par le test. C'est la seule façon d'éprouver le chemin réel. */
const enIndex = local.replace("var OWNER = 'u';", "var OWNER = 'i';");

mkdirSync(join(DIR, 'galerie/u/r1'), { recursive: true });
mkdirSync(join(DIR, 'galerie/rien-publie'), { recursive: true });
writeFileSync(join(DIR, 'index.html'), local);
writeFileSync(join(DIR, 'vide.html'), vide);
writeFileSync(join(DIR, 'panne.html'), panne);
writeFileSync(join(DIR, 'galerie/rien-publie/manifest.json'), JSON.stringify({
  version: 1, updatedAt: new Date().toISOString(), site: { title: 'Melissa Nabet' }, realisations: [],
}, null, 1));
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
  /* Trois langues, dont deux volontairement à moitié traduites : c'est l'état réel du
     site tant que Melissa n'a pas écrit ses textes, et c'est ce qui doit retomber sur le
     français sans laisser de blanc. */
  site: { title: 'Melissa Nabet', subtitle: 'Architecture d’intérieur',
          apropos: 'Texte de présentation du banc d’essai.',
          email: 'essai@example.com', tel: '052 000 00 00', instagram: '@essai',
          /* L'ordre des sections vient du CRM. Ici il est VOLONTAIREMENT contraire à
             l'alphabet : c'est ce qui prouve que le site suit la liste et non un tri. */
          categories: ['Bureau', 'Appartement'],
          categoriesProduits: ['Revêtement mural', 'Panneau décoratif'],
          langues: ['fr', 'en', 'he'],
          i18n: { en: { subtitle: 'Interior architecture' } },
          journal: [
            { id: 'j1', date: 'Septembre 2026', titre: 'Livraison du bureau Sébastien',
              texte: 'Trois mois de chantier, une bibliothèque sur mesure.',
              i18n: { en: { titre: 'Sébastien’s office delivered' } } },
            { id: 'j2', date: 'Juin 2026', titre: 'Atelier photographie', texte: '' },
          ] },
  /* La boutique : trois produits, deux rayons, un prix rempli et deux vides (« sur
     demande »), un épuisé (pas de bouton d'achat), et une traduction hébreu partielle —
     c'est la langue des clients du magasin de revêtement mural. */
  produits: [{
    id: 'pr1', nom: 'Panneau chêne rainuré', matiere: 'Chêne massif, huilé',
    prix: '180 ₪ / m²', dispo: 'oui', categorie: 'Revêtement mural',
    description: 'Lames verticales de 12 mm, posées sur tasseaux.',
    i18n: { he: { nom: 'לוח אלון מחורץ' } },
    photos: [{ full: 'u/r1/p0.jpg', thumb: 'u/r1/t0.jpg', w: 1600, h: 1067, cover: true }],
  }, {
    id: 'pr2', nom: 'Béton ciré mural', matiere: 'Enduit minéral', prix: '', dispo: 'commande',
    categorie: 'Revêtement mural',
    photos: [{ full: 'u/r1/p1.jpg', thumb: 'u/r1/t1.jpg', w: 1600, h: 1067, cover: true }],
  }, {
    id: 'pr3', nom: 'Panneau acoustique feutre', matiere: 'Feutre recyclé', prix: '', dispo: 'rupture',
    categorie: 'Panneau décoratif',
    photos: [{ full: 'u/r1/p2.jpg', thumb: 'u/r1/t2.jpg', w: 1067, h: 1600, cover: true }],
  }],
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

mkdirSync(join(DIR, 'galerie/i'), { recursive: true });
writeFileSync(join(DIR, 'index-theme.html'), enIndex);
/* Mêmes photos que le banc principal : c'est l'habillage qu'on éprouve, pas les images. */
writeFileSync(join(DIR, 'galerie/i/manifest.json'), JSON.stringify({
  version: 1, updatedAt: new Date().toISOString(),
  site: { title: 'Melissa Nabet', subtitle: 'Architecture d’intérieur',
          theme: 'index', mouvement: 'discret',
          apropos: 'Texte de présentation du banc d’essai.', email: 'essai@example.com' },
  realisations: [
    { id: 'r1', title: 'Bureau Sébastien', date: '2026', lieu: 'Tel Aviv',
      mission: 'Rénovation complète', categorie: 'Bureau',
      publishedAt: new Date().toISOString(),
      photos: [{ full: 'u/r1/p0.jpg', thumb: 'u/r1/t0.jpg', w: 1600, h: 1067, cover: true }] },
    { id: 'r2', title: 'Duplex Ben Yehuda', date: '2025', lieu: 'Tel Aviv', categorie: 'Appartement',
      publishedAt: new Date().toISOString(),
      photos: [{ full: 'u/r1/p1.jpg', thumb: 'u/r1/t1.jpg', w: 1600, h: 1067, cover: true }] },
    { id: 'r3', title: 'Trois pièces Florentin', date: '2025', categorie: 'Appartement',
      publishedAt: new Date().toISOString(),
      photos: [{ full: 'u/r1/p2.jpg', thumb: 'u/r1/t2.jpg', w: 1067, h: 1600, cover: true }] },
  ],
}, null, 1));

mkdirSync(join(DIR, 'galerie/v/r1'), { recursive: true });
writeFileSync(join(DIR, 'ancien.html'), ancien);
writeFileSync(join(DIR, 'galerie/v/manifest.json'), JSON.stringify({
  version: 1, updatedAt: new Date().toISOString(),
  site: { title: 'Melissa Nabet', subtitle: 'Architecture d’intérieur' },
  realisations: [{ id: 'r1', title: 'Bureau Sébastien', date: '2026',
    publishedAt: new Date().toISOString(),
    photos: [{ full: 'v/r1/p0.jpg', thumb: 'v/r1/t0.jpg', w: 1600, h: 1067, cover: true }] }],
}, null, 1));

console.log('Banc d’essai du site construit dans ' + DIR);
console.log('Servez-le : python3 -m http.server 8902 -d ' + DIR);
