/* Service worker du CRM — volontairement MINIMAL.

   Son rôle : (1) rendre le CRM installable comme une application — Chrome veut un service
   worker qui écoute `fetch` — et (2) afficher une page claire quand le CRM ne peut pas s'ouvrir
   faute de réseau. Il ne GARDE RIEN : aucun cache, aucune copie de données, aucune réponse de
   Supabase ni d'un autre site.

   Ce qu'il fait, ce qu'il ne fait pas, et pourquoi :

   - Il ne traite que l'OUVERTURE D'UNE PAGE (requête « navigate »). Tout le reste passe sans qu'il y
     touche : appels Supabase et temps réel, bibliothèque Supabase et polices (autres sites),
     requête HEAD de checkForUpdate() dans index.html, images, fichiers. Le CRM marche donc comme
     s'il n'existait pas : sa détection de nouvelle version et sa synchro temps réel ne voient
     aucune différence.

   - Réseau d'abord, en REVALIDANT (`cache: 'no-cache'`). GitHub Pages sert index.html avec
     `cache-control: max-age=600` : sans cela, juste après une mise en ligne, le navigateur pouvait
     rouvrir la page d'il y a 10 minutes (6e trou de synchro de PROJECT_LOG.md). Avec `no-cache`, il
     demande au serveur « a-t-elle changé ? » à chaque ouverture : une page inchangée coûte une
     réponse « 304 » de quelques octets, pas les 840 Ko. Un rechargement « à fond » (Ctrl+Maj+R)
     contourne le service worker (Chrome ne le consulte pas pour ce rechargement, constaté dans
     Chromium 141) : il redemande donc toujours tout au serveur, sans que le service worker n'y touche.

   - Hors ligne, il affiche UNE PAGE SIMPLE « Pas de connexion », PAS une copie du CRM. Raison,
     constatée par essai dans un vrai navigateur le 14 oct. 2026 : le CRM charge la bibliothèque
     Supabase depuis un autre site ; sans réseau elle manque, et initSupabase() n'affiche alors NI
     l'écran de connexion NI d'erreur : l'appli s'ouvre en mode « local » (pastille « · local »).
     Une modification faite là n'est jamais envoyée, et à la connexion suivante loadAll() remet la
     fiche du serveur par-dessus : la modification disparaît. C'est la perte de données du
     20/08/2026, que PROJECT_LOG.md (« Authentification & synchronisation cloud ») interdit de
     rouvrir. Garder une copie de la page n'aurait d'ailleurs pas tenu : le service worker du
     cockpit, sur le même domaine (rnab26.github.io), supprime à chaque mise à jour tous les caches
     qu'il ne connaît pas. Pour changer ce choix, voir PROJECT_LOG.md, « Application installable ».

   VERSION : à changer quand ce fichier change, pour que le navigateur remplace l'ancien service
   worker. Le nouveau prend la main tout de suite (skipWaiting + claim) : il ne garde rien, il n'y a
   donc rien à migrer.
*/
const VERSION = 'crm-sw-1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  // Une ouverture de page, rien d'autre : tout le reste continue sans lui (pas de respondWith).
  if (requete.mode !== 'navigate' || requete.method !== 'GET') return;
  event.respondWith(ouvrirLaPage(requete));
});

async function ouvrirLaPage(requete) {
  try {
    return await fetch(requete, { cache: 'no-cache' });
  } catch (erreur) {
    // Seul un réseau qui ne répond pas du tout arrive ici. Une réponse du serveur, même une erreur
    // (404, 500), est rendue telle quelle : ce n'est pas à lui de la déguiser.
    return new Response(PAGE_HORS_LIGNE, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

// Même décor que l'écran de connexion du CRM (dégradé papier, carte claire, bouton « oxblood »).
const PAGE_HORS_LIGNE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#3d3934">
<meta name="service-worker" content="${VERSION}">
<title>Pas de connexion — CRM Melissa Nabet</title>
<style>
  html,body{height:100%;margin:0;}
  body{display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:24px;
    background:linear-gradient(180deg,#f4efe6,#e4ded4);color:#3d3934;
    font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%;}
  main{width:100%;max-width:340px;box-sizing:border-box;padding:32px 26px 28px;text-align:center;
    background:#fbf9f5;border:1px solid #e5ded2;border-radius:10px;box-shadow:0 10px 40px rgba(61,57,52,.12);}
  .marque{margin:0;font-family:"Cormorant Garamond",Georgia,"Times New Roman",serif;font-size:27px;
    font-weight:600;letter-spacing:.14em;padding-left:.14em;}
  h1{margin:18px 0 8px;font-size:17px;font-weight:600;}
  p{margin:0 0 22px;font-size:14.5px;line-height:1.55;color:#6f665b;}
  button{font:inherit;font-size:14px;font-weight:500;color:#fff;background:#9a8574;border:0;
    border-radius:3px;padding:12px 26px;cursor:pointer;}
  button:active{filter:brightness(.9);}
</style>
</head>
<body>
<main>
  <p class="marque">MELISSA NABET</p>
  <h1>Pas de connexion internet</h1>
  <p>Le CRM a besoin d'internet pour s'ouvrir et enregistrer ton travail. Vérifie le Wi-Fi ou les données mobiles, puis réessaie.</p>
  <button id="reessayer" type="button">Réessayer</button>
</main>
<script>
  document.getElementById('reessayer').addEventListener('click', function () { location.reload(); });
  window.addEventListener('online', function () { location.reload(); });
</script>
</body>
</html>`;
