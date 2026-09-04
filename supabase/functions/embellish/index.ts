// Proxy sécurisé vers l'API Anthropic pour le bouton "Embellir avec l'IA".
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
    const { title, desc, proj, surf, length } = await req.json();
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
    const prompt = `Tu écris pour les devis d'une architecte d'intérieur. Rédige ${len.instruction} élégante(s), concrète(s) et chaleureuse(s) (français, sans superlatifs creux, sans guillemets) décrivant la prestation ci-dessous, pour valoriser le travail auprès du client. Ne mentionne aucun nom propre (ni "Melissa Nabet", ni "l'architecte") — décris uniquement la prestation elle-même. Contexte projet : ${proj || "projet"} (${surf || ""} m²). Prestation : "${title}". ${desc ? `Texte existant à améliorer : "${desc}".` : ""} Réponds uniquement par le texte, sans préambule.`;

    const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: len.maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthRes.ok) {
      const errText = await anthRes.text();
      return new Response(JSON.stringify({ error: `Erreur API Anthropic : ${errText}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const data = await anthRes.json();
    const text = (data.content || []).map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("").trim();

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
