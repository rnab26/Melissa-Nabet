// Pont vers un agrégateur de modèles d'image (fal.ai par défaut).
//
// POURQUOI UN PONT ET PAS UN APPEL DIRECT :
// 1. La clé du fournisseur reste un secret serveur. Mise dans le navigateur, elle serait
//    lisible par n'importe qui — le CRM est une page publique — et les crédits seraient
//    vidés en quelques minutes.
// 2. Le CRM ne dépend d'aucun fournisseur en particulier : il envoie un identifiant de
//    modèle, le pont sait le router. Changer de fournisseur ne touche pas l'interface.
//
// CETTE FONCTION N'EST PAS OUVERTE AU PUBLIC, ET NE DOIT JAMAIS L'ÊTRE.
// Chaque appel coûte de l'argent réel. L'appelant doit présenter le jeton de session d'un
// compte connecté — pas la clé publiable de l'application, qui est lisible dans le code de
// la page et n'identifie personne.

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

/** Vérifie que l'appelant est un utilisateur réellement connecté. */
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
  // La clé publiable est un jeton valide mais ne porte pas d'utilisateur : elle échoue ici.
  if (!user || !user.id || user.role !== "authenticated") throw new Error("session invalide");
  return user.id as string;
}

/** Ramène toute image (URL distante ou data URI) à un data URI utilisable par le navigateur. */
async function toDataUri(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error("image de sortie illisible (HTTP " + res.status + ")");
  const type = res.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return "data:" + type + ";base64," + btoa(bin);
}

/** fal.ai — forme HTTP vérifiée : POST https://fal.run/<modèle>, en-tête « Authorization: Key … ».
 *  Les modèles d'édition prennent `prompt` + `image_urls` (data URI accepté).
 *  `sync_mode: true` fait revenir le résultat directement au lieu d'une URL temporaire. */
async function callFal(model: string, prompt: string, imageDataUri: string) {
  const key = Deno.env.get("FAL_KEY");
  if (!key) throw new Error("FAL_KEY non configurée côté serveur");
  const res = await fetch("https://fal.run/" + model, {
    method: "POST",
    headers: { Authorization: "Key " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      image_urls: [imageDataUri],
      sync_mode: true,
      output_format: "jpeg",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("fal.ai a refusé (HTTP " + res.status + ") : " + text.slice(0, 400));
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("réponse illisible du fournisseur");
  }
  const images = (data.images || data.image || []) as Array<{ url?: string }> | { url?: string };
  const first = Array.isArray(images) ? images[0] : images;
  if (!first || !first.url) {
    throw new Error("le modèle n'a renvoyé aucune image : " + text.slice(0, 300));
  }
  return await toDataUri(first.url);
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

    if (action === "ping") {
      // Ne consomme aucun crédit : dit seulement si une clé est configurée.
      return json({ ok: true, fal: !!Deno.env.get("FAL_KEY") });
    }

    const { model, prompt, imageDataUri, provider } = body;
    if (!model) return json({ error: "modèle manquant" }, 400);
    if (!prompt || !String(prompt).trim()) return json({ error: "consigne manquante" }, 400);
    if (!imageDataUri || !String(imageDataUri).startsWith("data:")) {
      return json({ error: "image manquante" }, 400);
    }
    if ((provider || "fal") !== "fal") {
      return json({ error: "fournisseur inconnu : " + provider }, 400);
    }

    const out = await callFal(String(model), String(prompt), String(imageDataUri));
    return json({ imageDataUri: out, model, provider: "fal" });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
