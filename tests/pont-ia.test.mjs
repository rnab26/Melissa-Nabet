/* Test du pont `photo-ia` — la partie qui décide de la FORME de la requête envoyée au
   fournisseur. Elle ne peut pas être vérifiée depuis le navigateur : le test du CRM
   intercepte le pont, il ne l'exécute pas.

   Ce qui est vérifié ici est exactement ce qui a cassé en vrai : chez fal, certains modèles
   attendent l'image sous `image_urls` (tableau), d'autres sous `image_url` (chaîne). Le pont
   envoyait toujours `image_urls` — deux des trois modèles proposés d'origine échouaient donc
   avec « champ requis manquant », sans que rien ne le dise.

   Les schémas ci-dessous sont RELEVÉS SUR L'API RÉELLE de fal (openapi.json de chaque
   modèle), pas inventés. Aucun crédit n'est dépensé : buildPayload est une fonction pure.

   Lancer : bun tests/pont-ia.test.mjs   (bun sait exécuter le TypeScript du pont) */

globalThis.Deno = { serve: () => {}, env: { get: () => 'x' } };
const { buildPayload } = await import('../supabase/functions/photo-ia/index.ts');

const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };
const IMG = 'data:image/jpeg;base64,AAAA';

// Relevés sur https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=…
const NANO = { properties: { prompt: {}, image_urls: {}, sync_mode: {}, resolution: {}, num_images: {} }, required: ['prompt', 'image_urls'] };
const KONTEXT = { properties: { prompt: {}, image_url: {}, sync_mode: {}, guidance_scale: {} }, required: ['prompt', 'image_url'] };
const UPSCALER = { properties: { image_url: {}, sync_mode: {}, enable_safety_checker: {} }, required: ['image_url'] };
const TEXTE_SEUL = { properties: { prompt: {}, image_size: {} }, required: ['prompt'] };

const a = buildPayload(NANO, { prompt: 'équilibre la lumière', resolution: '2K' }, IMG);
check('Modèle en `image_urls` : l’image part dans un tableau',
  Array.isArray(a.image_urls) && a.image_urls[0] === IMG && !('image_url' in a), JSON.stringify(Object.keys(a)));
check('Modèle en `image_urls` : la consigne et les réglages suivent',
  a.prompt === 'équilibre la lumière' && a.resolution === '2K' && a.sync_mode === true);

const b = buildPayload(KONTEXT, { prompt: 'adoucis la dominante jaune' }, IMG);
check('Modèle en `image_url` : l’image part en chaîne, PAS en tableau',
  b.image_url === IMG && !('image_urls' in b), JSON.stringify(Object.keys(b)));

const c = buildPayload(UPSCALER, { prompt: 'ignorée' }, IMG);
check('Modèle sans consigne : la consigne est retirée au lieu de faire échouer l’appel',
  !('prompt' in c) && c.image_url === IMG, JSON.stringify(Object.keys(c)));

const d = buildPayload(NANO, { prompt: 'x', guidance_scale: 3.5, inconnu: 'zzz' }, IMG);
check('Réglage inconnu du modèle retiré (un réglage gardé d’un autre modèle ne casse plus l’appel)',
  !('guidance_scale' in d) && !('inconnu' in d), JSON.stringify(Object.keys(d)));

let err = '';
try { buildPayload(TEXTE_SEUL, { prompt: 'x' }, IMG); } catch (e) { err = e.message; }
check('Modèle qui ne prend pas d’image : refus explicite', /n'accepte pas d'image/.test(err), err);

err = '';
try { buildPayload(NANO, { prompt: '   ' }, IMG); } catch (e) { err = e.message; }
check('Consigne obligatoire mais vide : refus avant de facturer l’appel', /exige une consigne/.test(err), err);

err = '';
try { buildPayload(UPSCALER, {}, IMG); } catch (e) { err = e.message; }
check('Modèle sans consigne : aucun refus, l’appel peut partir', err === '', err);

console.log('\n===== PONT IA : ' + ok.length + ' OK, ' + ko.length + ' ECHEC =====');
process.exit(ko.length ? 1 : 0);
