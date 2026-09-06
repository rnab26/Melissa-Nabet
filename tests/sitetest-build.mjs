/* Banc d'essai du site vitrine.
   Le site lit un manifeste et des images sur le stockage public Supabase. Pour le tester
   sans réseau ni compte, on en fabrique une copie locale : même page, mais l'adresse du
   stockage pointe sur le serveur de test. Rien n'est deviné — c'est le fichier réel du
   dépôt qui est copié, avec cette seule substitution.

   Le manifeste de test contient ce que le CRM sait maintenant y écrire : des rubriques
   ordonnées, une réalisation SANS rubrique (elle doit rester visible), les sections
   Studio / Journal / Contact, et trois langues dont deux volontairement non traduites —
   c'est l'état réel du site tant que Melissa n'a pas écrit ses textes.

   Usage :
     node tests/sitetest-build.mjs            # construit dans /tmp/mn-sitetest
     python3 -m http.server 8902 -d /tmp/mn-sitetest
     node tests/site.test.mjs
*/
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
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

const photo = (r, i, legende, cover) => {
  const o = { full: `u/${r}/p${i}.jpg`, thumb: `u/${r}/t${i}.jpg`, w: 1600, h: 1067, cover: !!cover };
  if (legende) o.caption = legende;
  return o;
};

export const REALISATIONS = [
  { id: 'r1', title: 'Bureau Sébastien', date: '2026', category: 'bureaux',
    photos: [photo('r1', 0, '', true),
             photo('r1', 1, 'Cuisine ouverte, plan de travail en chêne massif.'),
             photo('r1', 2, '')] },
  { id: 'r2', title: 'Boutique Dizengoff', date: '2025', category: 'commercial',
    photos: [photo('r2', 0, '', true), photo('r2', 1, '')] },
  { id: 'r3', title: 'Duplex Florentin', date: '2025', category: 'habitation',
    photos: [photo('r3', 0, '', true)] },
  /* Sans rubrique : doit rester visible, rangée en fin d'index. C'est le cas qui casse
     silencieusement si un jour on filtre les projets sur leur catégorie. */
  { id: 'r4', title: 'Bibliothèque sur mesure', date: '2024',
    photos: [photo('r4', 0, '', true)] },
];

const manifest = {
  version: 1,
  updatedAt: new Date().toISOString(),
  site: {
    title: 'Melissa Nabet',
    subtitle: { fr: 'Architecture d’intérieur' },
    langues: ['fr', 'en', 'he'],
    /* L'ordre ci-dessous est celui des sections en ligne. « vide » n'a aucun projet
       publié : la section ne doit pas apparaître. */
    categories: [
      { id: 'commercial', label: { fr: 'Commercial' } },
      { id: 'habitation', label: { fr: 'Habitation' } },
      { id: 'bureaux', label: { fr: 'Bureaux' } },
      { id: 'vide', label: { fr: 'Rubrique sans projet' } },
    ],
    studio: { fr: 'Melissa Nabet dessine des lieux qui se vivent avant de se regarder.\n\nChaque chantier commence par une visite, et finit par des photographies.' },
    contact: {
      email: 'contact@melissanabet.com', tel: '+972 50 000 0000',
      ville: 'Tel Aviv', instagram: '@melissanabet',
      texte: { fr: 'Pour un projet, un devis ou une visite.' },
    },
    journal: [
      { id: 'j1', date: 'Septembre 2026', titre: { fr: 'Livraison du bureau Sébastien' },
        texte: { fr: 'Trois mois de chantier, une bibliothèque sur mesure et un plan de travail en chêne.' } },
      { id: 'j2', date: 'Juin 2026', titre: { fr: 'Atelier photographie' }, texte: { fr: '' } },
    ],
  },
  realisations: REALISATIONS.map(r => ({ ...r, publishedAt: new Date().toISOString() })),
};

/* Le manifeste RÉELLEMENT en ligne aujourd'hui est à l'ancien format : sous-titre en
   chaîne de caractères, aucune rubrique, aucune section. La page doit le lire sans broncher
   jusqu'à la première « Mise à jour du site » — sinon on casse le site en production. */
const ancien = local.replace("var OWNER = 'u';", "var OWNER = 'v';");
mkdirSync(join(DIR, 'galerie/v/r1'), { recursive: true });
writeFileSync(join(DIR, 'ancien.html'), ancien);
writeFileSync(join(DIR, 'galerie/v/manifest.json'), JSON.stringify({
  version: 1, updatedAt: new Date().toISOString(),
  site: { title: 'Melissa Nabet', subtitle: 'Architecture d’intérieur' },
  realisations: [{ id: 'r1', title: 'Bureau Sébastien', date: '2026',
    publishedAt: new Date().toISOString(),
    photos: [{ full: 'v/r1/p0.jpg', thumb: 'v/r1/t0.jpg', w: 1600, h: 1067, cover: true }] }],
}, null, 1));

REALISATIONS.forEach(r => mkdirSync(join(DIR, 'galerie/u/' + r.id), { recursive: true }));
writeFileSync(join(DIR, 'index.html'), local);
writeFileSync(join(DIR, 'vide.html'), vide);
writeFileSync(join(DIR, 'galerie/u/manifest.json'), JSON.stringify(manifest, null, 1));

console.log('Banc d’essai du site construit dans ' + DIR);
console.log('Servez-le : python3 -m http.server 8902 -d ' + DIR);
