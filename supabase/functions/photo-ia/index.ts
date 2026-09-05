// Pont vers fal.ai — agrégateur de modèles d'image.
//
// POURQUOI UN PONT ET PAS UN APPEL DIRECT :
// 1. La clé du fournisseur reste un secret serveur. Mise dans le navigateur, elle serait
//    lisible par n'importe qui — le CRM est une page publique — et les crédits seraient
//    vidés en quelques minutes.
// 2. Le CRM ne dépend d'aucun modèle en particulier : il envoie un identifiant et un objet
//    d'entrée, le pont transmet. Ajouter un modèle ne touche pas une ligne de code.
//
// CETTE FONCTION N'EST PAS OUVERTE AU PUBLIC, ET NE DOIT JAMAIS L'ÊTRE.
// Chaque appel coûte de l'argent réel. L'appelant doit présenter le jeton de session d'un
// compte connecté — pas la clé publiable de l'application, qui est lisible dans le code de
// la page et n'identifie personne. verify_jwt est désactivé au déploiement, volontairement :
// la clé publiable est elle-même un JWT valide, la vérification générique de Supabase
// laisserait donc passer n'importe qui. Le vrai contrôle est requireUser ci-dessous.
//
// FORMES HTTP VÉRIFIÉES CONTRE L'API RÉELLE (septembre 2026) :
//   exécution : POST https://fal.run/<modèle>          en-tête « Authorization: Key … »
//   solde     : GET  https://api.fal.ai/v1/account/billing?expand=credits
//               en-tête « Authorization: Key … », réponse {username, credits:{current_balance,currency}}
//   schéma    : GET  https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<modèle>
//               public, sans clé — c'est ce qui permet de générer le formulaire de réglages
//               exactement comme le fait le site de fal.ai.
//
// FILE D'ATTENTE (le mode d'appel normal depuis septembre 2026) :
//   déposer    : POST https://queue.fal.run/<modèle>
//                → {request_id, status_url, response_url, cancel_url, queue_position}
//   où ça en est : GET https://queue.fal.run/<modèle>/requests/<id>/status[?logs=1]
//                → {status: IN_QUEUE | IN_PROGRESS | COMPLETED, queue_position, logs, metrics}
//   récupérer  : GET https://queue.fal.run/<modèle>/requests/<id>
//   annuler    : PUT https://queue.fal.run/<modèle>/requests/<id>/cancel
//                → 202 {status:"CANCELLATION_REQUESTED"} | 400 ALREADY_COMPLETED | 404 NOT_FOUND
//
// Ces chemins ne sont PAS devinés : ils sont relevés dans le `openapi.json` que fal publie
// pour chaque modèle (`servers: [{url:"https://queue.fal.run"}]`, quatre chemins par
// modèle), vérifié sur `fal-ai/nano-banana-pro/edit`, `fal-ai/flux/dev` et
// `fal-ai/flux-pro/kontext`. À noter : la page de documentation rédigée de fal montre une
// URL de résultat en `/requests/<id>/response`, alors que le schéma réellement publié dit
// `/requests/<id>`. On suit donc EN PRIORITÉ les URL que fal nous a lui-même renvoyées à la
// soumission, et le chemin du schéma seulement en repli.
//
// POURQUOI LA FILE PLUTÔT QUE L'APPEL SYNCHRONE :
// `fal.run/<modèle>` tient la connexion ouverte pendant toute la génération. Sur une image
// lourde ou une file chargée, la fonction serveur expire AVANT la réponse : le résultat est
// perdu, mais l'appel est facturé — le modèle a tourné. Avec la file, chaque appel du pont
// est court (déposer, demander, récupérer), plus rien ne dépend de la durée du modèle, et la
// demande porte un identifiant : elle reste récupérable même si la page a été fermée.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

async function requireUser(req: Request): Promise<string> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("authentification requise");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new Error("environnement Supabase incomplet côté serveur");
  const res = await fetch(url + "/auth/v1/user", {
    headers: { apikey: anon, Authorization: "Bearer " + token },
  });
  if (!res.ok) throw new Error("session invalide ou expirée");
  const user = await res.json();
  if (!user || !user.id || user.role !== "authenticated") throw new Error("session invalide");
  return user.id as string;
}

function falKey(): string {
  const key = Deno.env.get("FAL_KEY");
  if (!key) throw new Error("FAL_KEY non configurée côté serveur");
  return key;
}

/** Clé de lecture de la facturation. fal sépare deux portées : API (faire tourner les
 *  modèles) et ADMIN (API de plateforme, dont le solde). Elles sont donc lues séparément :
 *  remplacer FAL_KEY par une clé ADMIN pour voir le solde ferait dépendre TOUTE la retouche
 *  d'une clé plus puissante que nécessaire, et une erreur sur cette clé casserait la
 *  retouche pour une commodité d'affichage. FAL_ADMIN_KEY est facultative ; sans elle on
 *  tente avec FAL_KEY, ce qui échouera proprement en 403. */
function falAdminKey(): { key: string; dediee: boolean } {
  const admin = Deno.env.get("FAL_ADMIN_KEY");
  if (admin) return { key: admin, dediee: true };
  return { key: falKey(), dediee: false };
}

/** Ramène toute image (URL distante ou data URI) à un data URI utilisable par le navigateur. */
async function toDataUri(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error("image de sortie illisible (HTTP " + res.status + ")");
  const type = res.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return "data:" + type + ";base64," + btoa(bin);
}

/** Solde du compte fal.ai, pour l'afficher dans le CRM sans aller sur leur site.
 *  ATTENTION — ce point d'entrée n'a pas les mêmes exigences que l'exécution d'un modèle :
 *  fal distingue deux portées de clé, API (consommer les modèles) et ADMIN (API de
 *  plateforme, dont la facturation). Une clé de portée API fait tourner les modèles mais se
 *  fait refuser ici. Un échec de solde ne dit donc RIEN sur la retouche : c'est une
 *  commodité d'affichage, jamais un pré-requis. */
async function getBalance() {
  const { key, dediee } = falAdminKey();
  const res = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", {
    headers: { Authorization: "Key " + key },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("balance: HTTP " + res.status + " " + text.slice(0, 300));
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        dediee
          ? "la clé FAL_ADMIN_KEY est refusée sur la facturation (HTTP " + res.status +
            "). Vérifier qu'elle est bien de portée ADMIN et non expirée. La retouche n'est pas concernée."
          : "aucune clé de portée ADMIN n'est configurée : la clé de retouche n'a pas le droit de lire la facturation (HTTP " +
            res.status + "). Déposer une clé ADMIN dans FAL_ADMIN_KEY pour afficher le solde ; la retouche, elle, fonctionne déjà.",
      );
    }
    throw new Error("solde indisponible (HTTP " + res.status + ") : " + text.slice(0, 300));
  }
  const d = JSON.parse(text);
  return {
    username: d.username ?? null,
    balance: d.credits?.current_balance ?? null,
    currency: d.credits?.currency ?? "USD",
  };
}

/** Schéma d'entrée du modèle. Public : on le relaie pour éviter toute question de CORS
 *  et garder un seul chemin d'appel côté navigateur. Il sert AUSSI à l'exécution (voir
 *  buildPayload), d'où le cache : sans lui, chaque retouche paierait un aller-retour de plus. */
const SCHEMA_CACHE = new Map<string, { model: string; title: string; properties: Record<string, unknown>; required: string[] }>();
async function getSchemaCached(model: string) {
  const hit = SCHEMA_CACHE.get(model);
  if (hit) return hit;
  const sc = await getSchema(model);
  SCHEMA_CACHE.set(model, sc);
  return sc;
}

async function getSchema(model: string) {
  const res = await fetch(
    "https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=" + encodeURIComponent(model),
  );
  if (!res.ok) {
    console.error("schema " + model + ": HTTP " + res.status);
    throw new Error("modèle inconnu ou schéma indisponible (HTTP " + res.status + ")");
  }
  const spec = await res.json();
  const schemas = spec?.components?.schemas || {};
  const inputName = Object.keys(schemas).find((n) => /Input$/.test(n));
  if (!inputName) throw new Error("ce modèle n'expose pas de schéma d'entrée");
  const input = schemas[inputName];
  return {
    model,
    title: spec?.info?.title || model,
    properties: input.properties || {},
    required: input.required || [],
  };
}

/** Exécution SYNCHRONE — chemin hérité, conservé pour les pages déjà ouvertes qui appellent
 *  encore `action:'edit'`. Le CRM passe désormais par la file (voir plus bas) : c'est ce
 *  chemin-ci qui expirait sur une image lourde, en facturant un résultat perdu. */
async function runModel(model: string, input: Record<string, unknown>) {
  const res = await fetch("https://fal.run/" + model, {
    method: "POST",
    headers: { Authorization: "Key " + falKey(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("run " + model + ": HTTP " + res.status + " " + text.slice(0, 500));
    throw new Error("fal.ai a refusé (HTTP " + res.status + ") : " + text.slice(0, 500));
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("réponse illisible du fournisseur");
  }
  const images = (data.images || data.image || []) as Array<{ url?: string }> | { url?: string };
  const first = Array.isArray(images) ? images[0] : images;
  if (!first || !first.url) throw new Error("le modèle n'a renvoyé aucune image : " + text.slice(0, 300));
  return { imageDataUri: await toDataUri(first.url), raw: { seed: (data as { seed?: unknown }).seed ?? null } };
}

/* ============================ FILE D'ATTENTE DE fal ============================ */

const QUEUE = "https://queue.fal.run/";

/** Un identifiant de modèle chez fal ressemble à `fal-ai/nano-banana-pro/edit`. On le valide
 *  avant d'en faire une URL : ce qui suit part dans un `fetch` émis par le serveur, avec la
 *  clé du compte dans l'en-tête. */
export function queueBase(model: string): string { // exportée pour tests/pont-ia.test.mjs
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9._-]+)*$/.test(model)) {
    throw new Error("identifiant de modèle invalide");
  }
  return QUEUE + model;
}

export function requestPath(model: string, requestId: string): string { // exportée pour tests/pont-ia.test.mjs
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(requestId)) throw new Error("identifiant de demande invalide");
  return queueBase(model) + "/requests/" + requestId;
}

/** Le CRM nous rend les URL que fal lui a données à la soumission (`status_url`…). On ne les
 *  suit QUE si elles pointent vraiment sur la file de fal — sinon le pont deviendrait un
 *  relais capable d'aller chercher n'importe quelle adresse en présentant la clé du compte.
 *  Hors de ce cas, on retombe sur le chemin du schéma. */
export function safeQueueUrl(given: unknown, fallback: string): string { // exportée pour tests/pont-ia.test.mjs
  if (typeof given !== "string" || !given) return fallback;
  try {
    const u = new URL(given);
    if (u.protocol === "https:" && u.hostname === "queue.fal.run") return u.toString();
  } catch { /* URL illisible : on garde le repli */ }
  return fallback;
}

/** Dépose la demande dans la file. Retour immédiat : rien n'attend la génération. */
async function submitModel(model: string, input: Record<string, unknown>) {
  const res = await fetch(queueBase(model), {
    method: "POST",
    headers: { Authorization: "Key " + falKey(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("submit " + model + ": HTTP " + res.status + " " + text.slice(0, 500));
    throw new Error("fal.ai a refusé la demande (HTTP " + res.status + ") : " + text.slice(0, 500));
  }
  let d: Record<string, unknown>;
  try { d = JSON.parse(text); } catch { throw new Error("réponse illisible du fournisseur à la soumission"); }
  const requestId = d.request_id;
  if (!requestId || typeof requestId !== "string") {
    throw new Error("fal.ai n'a pas renvoyé d'identifiant de demande : " + text.slice(0, 300));
  }
  return {
    requestId,
    statusUrl: typeof d.status_url === "string" ? d.status_url : "",
    responseUrl: typeof d.response_url === "string" ? d.response_url : "",
    cancelUrl: typeof d.cancel_url === "string" ? d.cancel_url : "",
    queuePosition: typeof d.queue_position === "number" ? d.queue_position : null,
    model,
  };
}

/** Où en est la demande. Un 404 n'est PAS une panne : c'est une demande expirée, annulée ou
 *  inconnue — le CRM doit pouvoir le dire à l'utilisateur au lieu de sonder dans le vide. */
async function statusModel(model: string, requestId: string, statusUrl: unknown) {
  const url = safeQueueUrl(statusUrl, requestPath(model, requestId) + "/status");
  const res = await fetch(url, { headers: { Authorization: "Key " + falKey() } });
  const text = await res.text();
  if (res.status === 404) return { status: "NOT_FOUND", requestId, queuePosition: null, error: null };
  if (!res.ok) {
    console.error("status " + model + ": HTTP " + res.status + " " + text.slice(0, 300));
    throw new Error("suivi impossible (HTTP " + res.status + ") : " + text.slice(0, 300));
  }
  let d: Record<string, unknown>;
  try { d = JSON.parse(text); } catch { throw new Error("réponse de suivi illisible"); }
  return {
    status: typeof d.status === "string" ? d.status : "IN_PROGRESS",
    requestId,
    queuePosition: typeof d.queue_position === "number" ? d.queue_position : null,
    error: typeof d.error === "string" ? d.error : null,
  };
}

/** Récupère le résultat d'une demande terminée et le ramène en data URI, comme le chemin
 *  synchrone : le reste du CRM ne voit aucune différence entre les deux. */
async function resultModel(model: string, requestId: string, responseUrl: unknown) {
  const url = safeQueueUrl(responseUrl, requestPath(model, requestId));
  const res = await fetch(url, { headers: { Authorization: "Key " + falKey() } });
  const text = await res.text();
  if (res.status === 404) throw new Error("demande introuvable chez fal.ai : elle a expiré ou a été annulée");
  if (!res.ok) {
    console.error("result " + model + ": HTTP " + res.status + " " + text.slice(0, 500));
    throw new Error("le modèle a échoué (HTTP " + res.status + ") : " + text.slice(0, 500));
  }
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch { throw new Error("réponse illisible du fournisseur"); }
  const images = (data.images || data.image || []) as Array<{ url?: string }> | { url?: string };
  const first = Array.isArray(images) ? images[0] : images;
  if (!first || !first.url) throw new Error("le modèle n'a renvoyé aucune image : " + text.slice(0, 300));
  return { imageDataUri: await toDataUri(first.url), raw: { seed: (data as { seed?: unknown }).seed ?? null } };
}

/** Annulation. Ne lève PAS sur 400/404 : « trop tard » et « inconnue » sont des réponses
 *  utiles, que le CRM doit pouvoir afficher telles quelles — c'est ce qui décide si l'appel
 *  sera facturé ou non. */
async function cancelModel(model: string, requestId: string, cancelUrl: unknown) {
  const url = safeQueueUrl(cancelUrl, requestPath(model, requestId) + "/cancel");
  const res = await fetch(url, { method: "PUT", headers: { Authorization: "Key " + falKey() } });
  const text = await res.text();
  let d: Record<string, unknown> = {};
  try { d = JSON.parse(text); } catch { /* certaines réponses sont vides */ }
  const status = typeof d.status === "string" ? d.status
    : (res.status === 202 ? "CANCELLATION_REQUESTED" : res.status === 404 ? "NOT_FOUND" : "ALREADY_COMPLETED");
  return { status, http: res.status };
}

/** Construit la requête du modèle À PARTIR DE SON SCHÉMA, jamais d'une convention supposée.
 *
 *  C'est le cœur du pont, et ce n'est pas un détail de forme : chez fal, certains modèles
 *  attendent l'image sous `image_urls` (un tableau — Nano Banana, FLUX.2, Seedream), d'autres
 *  sous `image_url` (une chaîne — FLUX.1 Kontext, Qwen, les agrandisseurs). Envoyer toujours
 *  `image_urls` faisait échouer la moitié du catalogue avec « champ requis manquant », y
 *  compris deux des trois modèles proposés d'origine.
 *
 *  De même : la consigne n'est exigée que si le modèle la déclare requise (un agrandisseur
 *  n'en prend pas), et tout paramètre inconnu du modèle est retiré — sinon un réglage
 *  mémorisé pour un modèle ferait planter le suivant. */
export function buildPayload( // exportée pour être testable hors ligne (tests/pont-ia.test.mjs)
  sc: { properties: Record<string, unknown>; required: string[] },
  input: Record<string, unknown>,
  imageDataUri: string,
  opts?: { sync?: boolean },
): Record<string, unknown> {
  const props = sc.properties || {};
  const required = sc.required || [];
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k in props && v !== null && v !== undefined && v !== "") payload[k] = v;
  }

  if ("image_urls" in props) payload.image_urls = [imageDataUri];
  else if ("image_url" in props) payload.image_url = imageDataUri;
  else throw new Error("ce modèle n'accepte pas d'image en entrée : il ne sert pas à retoucher une photo");

  /* `sync_mode` fait renvoyer l'image DANS la réponse, en base64. C'est ce qu'il faut pour
     l'appel synchrone, et exactement ce qu'il ne faut pas dans la file : le résultat y est
     stocké puis relu, et une image en base64 dans le corps stocké n'apporte rien qu'un
     poids de plus. En file, le modèle dépose l'image sur son stockage et le pont la ramène
     lui-même (toDataUri). */
  const sync = !opts || opts.sync !== false;
  if (sync) { if ("sync_mode" in props) payload.sync_mode = true; }
  else delete payload.sync_mode;

  if (!("prompt" in props)) delete payload.prompt;
  else if (required.includes("prompt") && !String(payload.prompt || "").trim()) {
    throw new Error("ce modèle exige une consigne écrite");
  }

  const manquants = required.filter((k) => !(k in payload));
  if (manquants.length) throw new Error("réglage(s) obligatoire(s) du modèle non renseigné(s) : " + manquants.join(", "));
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    await requireUser(req);
  } catch (e) {
    console.error("photo-ia auth:", (e as Error).message);
    return json({ error: String((e as Error).message) }, 401);
  }

  try {
    const body = await req.json();
    const action = body.action || "edit";

    if (action === "ping") {
      return json({ ok: true, fal: !!Deno.env.get("FAL_KEY"), falAdmin: !!Deno.env.get("FAL_ADMIN_KEY") });
    }
    if (action === "balance") {
      /* Deux échecs très différents. « Aucune clé ADMIN configurée » n'est PAS une panne :
         c'est un choix, et l'interface doit pouvoir se taire au lieu d'afficher une alerte
         permanente. « Clé ADMIN refusée » est une vraie panne, à dire. Le drapeau distingue
         les deux sans faire analyser une phrase française au navigateur. */
      try {
        return json(await getBalance());
      } catch (e) {
        const msg = String((e as Error).message);
        const adminManquante = !Deno.env.get("FAL_ADMIN_KEY") && /ADMIN/.test(msg);
        return json({ error: msg, adminManquante }, 502);
      }
    }

    if (action === "schema") {
      if (!body.model) return json({ error: "modèle manquant" }, 400);
      return json(await getSchemaCached(String(body.model)));
    }

    /* Chemin hérité : appel synchrone. Conservé pour une page restée ouverte sur une
       version antérieure du CRM — la version courante passe par la file. */
    if (action === "edit") {
      const { model, input, imageDataUri } = body;
      if (!model) return json({ error: "modèle manquant" }, 400);
      if (!imageDataUri || !String(imageDataUri).startsWith("data:")) {
        return json({ error: "image manquante" }, 400);
      }
      const sc = await getSchemaCached(String(model));
      const payload = buildPayload(sc, input || {}, String(imageDataUri));
      const out = await runModel(String(model), payload);
      return json({ ...out, model });
    }

    /* ---- Les trois temps de la file. Chacun est court : aucun ne dépend de la durée du
       modèle, donc aucun ne peut faire expirer la fonction serveur. ---- */
    if (action === "submit") {
      const { model, input, imageDataUri } = body;
      if (!model) return json({ error: "modèle manquant" }, 400);
      if (!imageDataUri || !String(imageDataUri).startsWith("data:")) {
        return json({ error: "image manquante" }, 400);
      }
      const sc = await getSchemaCached(String(model));
      const payload = buildPayload(sc, input || {}, String(imageDataUri), { sync: false });
      return json(await submitModel(String(model), payload));
    }

    if (action === "status") {
      if (!body.model || !body.requestId) return json({ error: "modèle ou demande manquant" }, 400);
      return json(await statusModel(String(body.model), String(body.requestId), body.statusUrl));
    }

    if (action === "result") {
      if (!body.model || !body.requestId) return json({ error: "modèle ou demande manquant" }, 400);
      const out = await resultModel(String(body.model), String(body.requestId), body.responseUrl);
      return json({ ...out, model: body.model });
    }

    if (action === "cancel") {
      if (!body.model || !body.requestId) return json({ error: "modèle ou demande manquant" }, 400);
      return json(await cancelModel(String(body.model), String(body.requestId), body.cancelUrl));
    }

    return json({ error: "action inconnue : " + action }, 400);
  } catch (e) {
    console.error("photo-ia:", (e as Error).message || e);
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
