// Dépense RÉELLE côté Anthropic, tous usages confondus — pas seulement ce que ce CRM
// consomme. Lit l'API d'administration d'Anthropic (`/v1/organizations/cost_report`) et
// renvoie un total par mois.
//
// CE QUE CETTE API NE DONNE PAS : le solde de crédits restant. Anthropic ne l'expose nulle
// part — ni ici, ni ailleurs. On ne peut donc afficher que ce qui a été DÉPENSÉ. Ne pas
// rouvrir ce point en croyant qu'un paramètre a été manqué.
//
// La clé d'administration (`sk-ant-admin01-…`) reste côté serveur, dans les secrets
// Supabase. Elle donne accès à toute l'organisation : elle ne doit JAMAIS partir vers le
// navigateur, et cette fonction ne renvoie que des montants agrégés.
//
// verify_jwt est désactivé au déploiement, volontairement : la clé publiable de
// l'application est elle-même un JWT valide, la vérification générique de Supabase
// laisserait donc passer n'importe qui. Le vrai contrôle est requireUser ci-dessous.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
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
  if (!user || !user.id || user.role !== "authenticated") throw new Error("session invalide");
  return user.id as string;
}

/** Premier jour du mois, N mois en arrière, à minuit UTC. */
function debutMois(reculMois: number): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - reculMois, 1, 0, 0, 0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    await requireUser(req);
  } catch (e) {
    return json({ error: String((e as Error).message) }, 401);
  }

  const cle = Deno.env.get("ANTHROPIC_ADMIN_KEY");
  if (!cle) {
    // Pas une panne : la clé n'a simplement pas encore été déposée. L'application affiche
    // la marche à suivre plutôt qu'un message d'erreur.
    return json({ disponible: false, code: "cle_absente" });
  }

  let mois = 3;
  try {
    const corps = await req.json().catch(() => ({}));
    const n = Number(corps?.mois);
    if (Number.isFinite(n)) mois = Math.min(12, Math.max(1, Math.round(n)));
  } catch (_e) { /* corps absent : on garde 3 mois */ }

  const depuis = debutMois(mois - 1);
  const parMois: Record<string, number> = {};
  let page: string | null = null;
  let pages = 0;

  try {
    // `limit` plafonne à 31 seaux d'un jour : plusieurs pages sont nécessaires dès qu'on
    // demande plus d'un mois. On borne le nombre de pages pour ne pas boucler sans fin si
    // l'API renvoyait toujours `has_more`.
    do {
      const q = new URLSearchParams({
        starting_at: depuis.toISOString().replace(/\.\d{3}Z$/, "Z"),
        bucket_width: "1d",
        limit: "31",
      });
      if (page) q.set("page", page);

      const res = await fetch("https://api.anthropic.com/v1/organizations/cost_report?" + q.toString(), {
        headers: { "x-api-key": cle, "anthropic-version": "2023-06-01" },
      });

      if (!res.ok) {
        const txt = await res.text();
        // 401/403 : la clé n'est pas une clé d'administration, ou le compte n'est pas un
        // compte d'organisation. C'est le cas le plus probable, et il se répare tout seul
        // une fois la bonne clé déposée — on le nomme au lieu de renvoyer le JSON brut.
        const code = res.status === 401 || res.status === 403 ? "cle_refusee" : "erreur";
        return json({ disponible: false, code, statut: res.status, detail: txt.slice(0, 400) });
      }

      const data = await res.json();
      for (const seau of data.data || []) {
        // `starting_at` est le début du jour ; les sept premiers caractères donnent le mois.
        const mo = String(seau.starting_at || "").slice(0, 7);
        if (!mo) continue;
        if (parMois[mo] === undefined) parMois[mo] = 0;
        for (const r of seau.results || []) {
          // `amount` est une chaîne décimale exprimée dans l'unité la plus BASSE de la
          // devise — des cents. « 123.45 » vaut donc 1,2345 $. Oublier cette division
          // multiplierait la dépense affichée par cent.
          const v = parseFloat(r.amount);
          if (Number.isFinite(v)) parMois[mo] += v / 100;
        }
      }
      page = data.has_more ? (data.next_page || null) : null;
      pages++;
    } while (page && pages < 14);
  } catch (e) {
    return json({ disponible: false, code: "erreur", detail: String((e as Error).message) });
  }

  const liste = Object.keys(parMois).sort().reverse()
    .map((mo) => ({ mois: mo, total: Math.round(parMois[mo] * 1e6) / 1e6 }));
  const total = liste.reduce((s, m) => s + m.total, 0);

  return json({
    disponible: true,
    devise: "USD",
    depuis: depuis.toISOString().slice(0, 10),
    mois: liste,
    total: Math.round(total * 1e6) / 1e6,
    // Dit explicitement ce qui n'est PAS là, pour que personne ne prenne ce total pour un
    // solde restant.
    soldeDisponible: false,
  });
});
