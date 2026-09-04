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

/** Solde du compte fal.ai, pour l'afficher dans le CRM sans aller sur leur site. */
async function getBalance() {
  const res = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", {
    headers: { Authorization: "Key " + falKey() },
  });
  const text = await res.text();
  if (!res.ok) throw new Error("solde indisponible (HTTP " + res.status + ") : " + text.slice(0, 300));
  const d = JSON.parse(text);
  return {
    username: d.username ?? null,
    balance: d.credits?.current_balance ?? null,
    currency: d.credits?.currency ?? "USD",
  };
}

/** Schéma d'entrée du modèle. Public : on le relaie pour éviter toute question de CORS
 *  et garder un seul chemin d'appel côté navigateur. */
async function getSchema(model: string) {
  const res = await fetch(
    "https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=" + encodeURIComponent(model),
  );
  if (!res.ok) throw new Error("modèle inconnu ou schéma indisponible (HTTP " + res.status + ")");
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

/** Exécution. `input` est transmis tel quel : tout paramètre du modèle est donc utilisable
 *  depuis le CRM, y compris ceux ajoutés par fal après l'écriture de ce code. */
async function runModel(model: string, input: Record<string, unknown>) {
  const res = await fetch("https://fal.run/" + model, {
    method: "POST",
    headers: { Authorization: "Key " + falKey(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("fal.ai a refusé (HTTP " + res.status + ") : " + text.slice(0, 500));
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    await requireUser(req);
  } catch (e) {
    return json({ error: String((e as Error).message) }, 401);
  }

  try {
    const body = await req.json();
    const action = body.action || "edit";

    if (action === "ping") return json({ ok: true, fal: !!Deno.env.get("FAL_KEY") });
    if (action === "balance") return json(await getBalance());

    if (action === "schema") {
      if (!body.model) return json({ error: "modèle manquant" }, 400);
      return json(await getSchema(String(body.model)));
    }

    if (action === "edit") {
      const { model, input, imageDataUri } = body;
      if (!model) return json({ error: "modèle manquant" }, 400);
      if (!imageDataUri || !String(imageDataUri).startsWith("data:")) {
        return json({ error: "image manquante" }, 400);
      }
      const payload: Record<string, unknown> = { ...(input || {}) };
      // L'image et le mode synchrone sont gérés ici : le CRM n'a pas à les connaître.
      payload.image_urls = [imageDataUri];
      payload.sync_mode = true;
      if (!payload.prompt || !String(payload.prompt).trim()) {
        return json({ error: "consigne manquante" }, 400);
      }
      const out = await runModel(String(model), payload);
      return json({ ...out, model });
    }

    return json({ error: "action inconnue : " + action }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
