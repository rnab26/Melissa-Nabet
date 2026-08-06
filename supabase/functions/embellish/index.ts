// Proxy sécurisé vers l'API Anthropic pour le bouton "Embellir avec l'IA".
// La clé Anthropic reste côté serveur (secret Supabase), jamais exposée au navigateur.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { title, desc, proj, surf } = await req.json();
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

    const prompt = `Tu écris pour les devis d'une architecte d'intérieur (Melissa Nabet). Rédige UNE à DEUX phrases élégantes, concrètes et chaleureuses (français, sans superlatifs creux, sans guillemets) décrivant la prestation ci-dessous, pour valoriser le travail auprès du client. Contexte projet : ${proj || "projet"} (${surf || ""} m²). Prestation : "${title}". ${desc ? `Texte existant à améliorer : "${desc}".` : ""} Réponds uniquement par le texte, sans préambule.`;

    const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
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
