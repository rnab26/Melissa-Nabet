// Proxy sécurisé vers l'API Anthropic pour le bouton "Embellir avec l'IA".
// La clé Anthropic reste côté serveur (secret Supabase), jamais exposée au navigateur.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
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
    const prompt = `Tu écris pour les devis d'une architecte d'intérieur (Melissa Nabet). Rédige ${len.instruction} élégante(s), concrète(s) et chaleureuse(s) (français, sans superlatifs creux, sans guillemets) décrivant la prestation ci-dessous, pour valoriser le travail auprès du client. Contexte projet : ${proj || "projet"} (${surf || ""} m²). Prestation : "${title}". ${desc ? `Texte existant à améliorer : "${desc}".` : ""} Réponds uniquement par le texte, sans préambule.`;

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
