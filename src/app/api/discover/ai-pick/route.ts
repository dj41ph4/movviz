import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { buildHeroSlides } from "@/lib/dashboard/suggestionEngine";
import { loadAiConfig } from "@/lib/ai/store";
import { callAi } from "@/lib/ai/providers";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

export const dynamic = "force-dynamic";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai-pick-of-the-day.json");

interface AiPick {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  posterPath: string | null;
  year: number | null;
  rating: number;
  genres: string[];
  reason: string;
}

type Store = Record<string, { day: string; pick: AiPick | null }>;

function dayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): Store {
  return readJsonCached<Store>(FILE, {});
}

/**
 * "Recommandation IA du jour" — un vrai appel au fournisseur IA configuré
 * (voir /api/ai/*), jamais un texte statique. Un seul choix par utilisateur
 * et par jour (mis en cache), sinon changer d'onglet regénérerait un appel
 * IA à chaque fois. Le candidat lui-même vient du même moteur de suggestion
 * que le hero (buildHeroSlides) — seule la phrase d'accroche est générée
 * par l'IA ; le titre/genre/note restent des données réelles TMDb/bibliothèque.
 * Échoue ouvert : si l'IA est indisponible, la route renvoie `pick: null`
 * plutôt qu'une erreur — le widget se masque simplement côté client.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = dayBucket();
  const store = load();
  const cached = store[user.id];
  if (cached && cached.day === today) {
    return NextResponse.json({ pick: cached.pick });
  }

  try {
    const locale = req.nextUrl.searchParams.get("locale") ?? undefined;
    // Only content the user actually owns — the sketch's "Voir maintenant"
    // ("watch now") only makes sense for something playable today.
    const slides = await buildHeroSlides(user.id, locale, 1, { includeOwned: true, includeUnowned: false });
    const slide = slides[0];
    if (!slide) {
      store[user.id] = { day: today, pick: null };
      writeJsonCached(FILE, store);
      return NextResponse.json({ pick: null });
    }

    const config = loadAiConfig();
    const system = "Tu es l'assistant de recommandation de Movviz. Réponds en une seule phrase courte (moins de 25 mots), en français, chaleureuse et précise, expliquant pourquoi ce titre mérite d'être regardé ce soir. Pas de guillemets, pas de préambule, juste la phrase.";
    const userPrompt = `Titre : ${slide.detail.title} (${slide.detail.year ?? "?"})\nGenres : ${slide.detail.genres.join(", ")}\nSynopsis : ${slide.detail.overview.slice(0, 400)}`;
    const { text } = await callAi(config, system, [{ role: "user", content: userPrompt }]);
    const reason = text.trim().replace(/^"|"$/g, "").slice(0, 220);

    const pick: AiPick = {
      tmdbId: slide.detail.tmdbId,
      type: slide.detail.type,
      title: slide.detail.title,
      posterPath: slide.detail.posterPath,
      year: slide.detail.year,
      rating: slide.detail.rating,
      genres: slide.detail.genres,
      reason,
    };
    store[user.id] = { day: today, pick };
    writeJsonCached(FILE, store);
    return NextResponse.json({ pick });
  } catch {
    // Fournisseur IA indisponible (quota, réseau...) — pas d'entrée en
    // cache pour la journée : un prochain chargement pourra réessayer
    // plutôt que de rester bloqué sur `null` jusqu'à demain.
    return NextResponse.json({ pick: null });
  }
}
