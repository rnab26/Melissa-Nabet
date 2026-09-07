// Proxy sécurisé vers l'API Anthropic pour deux textes : les lignes de devis
// ("Embellir avec l'IA") et la présentation d'une réalisation sur le site vitrine.
// Le champ `kind` décide ; absent, c'est le devis — le comportement d'origine, inchangé.
// La clé Anthropic reste côté serveur (secret Supabase), jamais exposée au navigateur.
//
// La fonction exige un utilisateur RÉELLEMENT CONNECTÉ. Auparavant elle acceptait la clé
// publiable de l'application comme jeton — or cette clé est lisible dans le code de la page,
// qui est publique : n'importe qui pouvait appeler la fonction et consommer les crédits
// Anthropic du compte. Ne jamais revenir en arrière là-dessus.
//
// verify_jwt est désactivé au déploiement, volontairement : la clé publiable est
// elle-même un JWT valide, la vérification générique de Supabase laisserait donc passer
// n'importe qui. Le vrai contrôle est fait par requireUser ci-dessous.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LENGTH_CONFIG: Record<string, { instruction: string; maxTokens: number }> = {
  court: { instruction: "UNE phrase brève", maxTokens: 70 },
  moyen: { instruction: "UNE à DEUX phrases", maxTokens: 150 },
  long: { instruction: "DEUX à TROIS phrases", maxTokens: 260 },
};

/* Le modèle est nommé ici et nulle part ailleurs, et son tarif l'accompagne : c'est ce qui
   permet à l'application de chiffrer un appel sans le deviner. Tarifs Claude Haiku 4.5,
   en dollars par million de jetons. À corriger ICI si le modèle change — un tarif recopié
   dans l'application dériverait en silence le jour où on change de modèle. */
const MODELE = "claude-haiku-4-5-20251001";
const TARIF = { entree: 1.0, sortie: 5.0 };

/** Un seul chemin vers Anthropic : les deux textes partagent modèle, erreurs et réponse. */
async function appelAnthropic(apiKey: string, prompt: string, maxTokens: number): Promise<Response> {
  const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!anthRes.ok) {
    const errText = await anthRes.text();
    /* Le crédit épuisé n'est pas une panne comme une autre : c'est la seule erreur que
       l'utilisateur peut lever lui-même, et elle mérite d'être nommée plutôt que noyée dans
       le JSON du fournisseur. L'application s'en sert pour afficher quoi faire. */
    let code = "";
    try {
      const j = JSON.parse(errText);
      const m = String(j?.error?.message || "");
      if (/credit balance is too low/i.test(m)) code = "credits_epuises";
      else if (j?.error?.type === "rate_limit_error") code = "trop_de_demandes";
    } catch (_e) { /* réponse non JSON : on garde le texte brut */ }
    return new Response(JSON.stringify({ error: `Erreur API Anthropic : ${errText}`, code }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const data = await anthRes.json();
  const text = (data.content || []).map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("").trim();

  /* Les jetons RÉELLEMENT facturés, et le coût qui en découle, renvoyés avec le texte :
     l'application peut ainsi tenir un cumul exact au lieu d'un forfait moyen inventé.
     Anthropic n'expose aucun solde de crédits restant — ni ici, ni dans son API
     d'administration, qui ne donne que la consommation passée. Ce cumul est donc la seule
     mesure disponible côté application. */
  const u = data.usage || {};
  const entree = Number(u.input_tokens || 0) + Number(u.cache_read_input_tokens || 0) + Number(u.cache_creation_input_tokens || 0);
  const sortie = Number(u.output_tokens || 0);
  const cout = (entree / 1e6) * TARIF.entree + (sortie / 1e6) * TARIF.sortie;

  return new Response(JSON.stringify({
    text,
    usage: { modele: MODELE, entree, sortie, cout: Math.round(cout * 1e6) / 1e6 },
  }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

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
  if (!user || !user.id || user.role !== "authenticated") throw new Error("session invalide");
  return user.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    await requireUser(req);
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const { kind, title, desc, proj, surf, length, mission, annee, lieu, legendes } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title manquant" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée côté serveur" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const len = LENGTH_CONFIG[length] || LENGTH_CONFIG.moyen;

    // Un projet de portfolio ne se décrit pas comme une ligne de devis : on ne vend rien à
    // un client, on raconte un chantier à un visiteur. D'où un prompt distinct.
    if (kind === "realisation") {
      const contexte = [
        lieu || proj ? `Lieu : ${lieu || proj}.` : "",
        surf ? `Surface : ${surf} m².` : "",
        mission ? `Type de mission : ${mission}.` : "",
        annee ? `Année : ${annee}.` : "",
      ].filter(Boolean).join(" ");
      const vues = Array.isArray(legendes) && legendes.length
        ? ` Ce que montrent les photos : ${legendes.slice(0, 6).map((l: string) => String(l)).join(" ; ")}.`
        : "";
      const promptReal = `Tu rédiges la présentation d'un projet pour le portfolio en ligne d'une architecte d'intérieur. Rédige ${len.instruction} en français : ce que le lieu demandait, ce qui a été fait, un parti pris concret. Sobre et précis, sans superlatifs creux, sans guillemets, sans point d'exclamation. N'invente aucun détail qui ne serait pas dans les informations données. Ne mentionne aucun nom propre (ni celui de l'architecte, ni celui du client), aucun prix, aucun délai. N'écris pas à la première personne. Projet : "${title}". ${contexte}${vues} ${desc ? `Texte existant à reprendre et améliorer : "${desc}".` : ""} Réponds uniquement par le texte, sans préambule.`;
      const res = await appelAnthropic(apiKey, promptReal, len.maxTokens);
      return res;
    }

    const prompt = `Tu écris pour les devis d'une architecte d'intérieur. Rédige ${len.instruction} élégante(s), concrète(s) et chaleureuse(s) (français, sans superlatifs creux, sans guillemets) décrivant la prestation ci-dessous, pour valoriser le travail auprès du client. Ne mentionne aucun nom propre (ni "Melissa Nabet", ni "l'architecte") — décris uniquement la prestation elle-même. Contexte projet : ${proj || "projet"} (${surf || ""} m²). Prestation : "${title}". ${desc ? `Texte existant à améliorer : "${desc}".` : ""} Réponds uniquement par le texte, sans préambule.`;

    return await appelAnthropic(apiKey, prompt, len.maxTokens);
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
