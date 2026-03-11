/**
 * Server Actions for fetching movie data from TMDB and generating
 * recommendations via Gemini AI.
 *
 * Changes from v1:
 * - fetchMovies: Switched from `top_rated` (obscure high-rated films) to
 *   `discover` with hard floors on vote_count and popularity, ensuring
 *   cards are recognisable to mainstream audiences. Removed US-origin
 *   restriction so global crowd-pleasers (e.g. The Dark Knight) appear.
 * - getMovieRecommendation: Enriched prompt with genre/director metadata
 *   so Gemini reasons about *taste*, not just titles. Added explicit
 *   instructions for diversity and surprise. Fixed model string.
 */
'use server';

import { GoogleGenAI, Type } from '@google/genai';
import type { Movie, SwipedMovie, Recommendation } from '@/types/movie';

const MOVIES_PER_BATCH = 15;
const MAX_EXCLUSION_LIST_SIZE = 100;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Builds a rich metadata string for a swiped movie to give Gemini
 * context beyond just the title (genre, director, year).
 */
function movieLabel(m: SwipedMovie): string {
    const parts = [m.title];
    if (m.year) parts.push(`(${m.year})`);
    if (m.director && m.director !== 'Unknown Director') parts.push(`dir. ${m.director}`);
    if (m.genre) parts.push(`[${m.genre}]`);
    return parts.join(' ');
}

// ─── fetchMovies ─────────────────────────────────────────────────────────────

/**
 * Fetches a batch of well-known movies from TMDB using the `discover`
 * endpoint with quality floors, rather than `top_rated` paged randomly.
 *
 * Key changes:
 *  - `sort_by=popularity.desc` on the `discover` endpoint is respected.
 *  - `vote_count.gte=1000` filters out niche/obscure films.
 *  - `vote_average.gte=6.0` keeps quality reasonable.
 *  - Removed `with_origin_country=US` — too restrictive.
 *  - Random page capped at 8 (pages 9+ of popularity-sorted discover
 *    get noticeably less mainstream).
 */
export async function fetchMovies(
    exclude: string[]
): Promise<Omit<Movie, 'id' | 'gradient'>[]> {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey) {
            console.error('[fetchMovies] TMDB_API_KEY is not configured');
            return [];
        }

        // Pages 1-8 of popularity-sorted discover are solidly mainstream
        const randomPage = Math.floor(Math.random() * 8) + 1;

        const discoverRes = await fetch(
            `https://api.themoviedb.org/3/discover/movie` +
            `?api_key=${apiKey}` +
            `&include_adult=false` +
            `&include_video=false` +
            `&language=en-US` +
            `&page=${randomPage}` +
            `&sort_by=popularity.desc` +
            `&vote_count.gte=1000` +    // ensures the film is widely seen
            `&vote_average.gte=6.0` +   // baseline quality filter
            `&with_original_language=en` // English-language films for NA audiences
        );

        if (!discoverRes.ok) {
            console.error('[fetchMovies] TMDB discover failed:', discoverRes.status);
            return [];
        }

        const discoverData = await discoverRes.json();
        const results: any[] = discoverData.results || [];

        // Deduplicate against already-seen titles
        const excludedSet = new Set(
            exclude.slice(-MAX_EXCLUSION_LIST_SIZE).map((t) => t.toLowerCase())
        );
        const filtered = results.filter(
            (m) => !excludedSet.has((m.title as string).toLowerCase())
        );

        const selected = filtered.slice(0, MOVIES_PER_BATCH);

        // Enrich each movie with director + full genre list
        const moviePromises = selected.map(async (m: any) => {
            try {
                const detailRes = await fetch(
                    `https://api.themoviedb.org/3/movie/${m.id}` +
                    `?api_key=${apiKey}&append_to_response=credits`
                );
                if (!detailRes.ok) return null;

                const d = await detailRes.json();

                const director =
                    (d.credits?.crew ?? []).find((c: any) => c.job === 'Director')
                        ?.name ?? 'Unknown Director';

                const genre =
                    (d.genres ?? []).map((g: any) => g.name).join(', ') ||
                    'Unknown Genre';

                const year = d.release_date
                    ? parseInt(d.release_date.split('-')[0])
                    : 0;

                const posterUrl = d.poster_path
                    ? `https://image.tmdb.org/t/p/w500${d.poster_path}`
                    : undefined;

                return {
                    title: d.title as string,
                    year,
                    director,
                    genre,
                    synopsis: d.overview as string,
                    posterUrl,
                };
            } catch {
                return null;
            }
        });

        const resolved = await Promise.all(moviePromises);
        return resolved.filter(Boolean) as Omit<Movie, 'id' | 'gradient'>[];
    } catch (error) {
        console.error('[fetchMovies] Unexpected error:', error);
        return [];
    }
}

// ─── getMovieRecommendation ───────────────────────────────────────────────────

/**
 * Generates a personalised movie recommendation using Gemini.
 *
 * Key changes vs v1:
 *  - Each movie in the prompt now includes year, director, and genre so
 *    Gemini can reason about taste patterns (not just title recognition).
 *  - Prompt explicitly asks Gemini to identify taste signals before
 *    recommending, and to avoid the most obvious/predictable pick.
 *  - Fixed model string: `gemini-2.0-flash` (was `gemini-3-flash-preview`
 *    which is not a valid model and likely caused silent failures).
 */
export async function getMovieRecommendation(
    swipedMovies: SwipedMovie[]
): Promise<Recommendation | null> {
    try {
        const loved = swipedMovies.filter((m) => m.action === 'loved');
        const watched = swipedMovies.filter((m) => m.action === 'watched');
        const disliked = swipedMovies.filter((m) => m.action === 'disliked');
        const unwatched = swipedMovies.filter((m) => m.action === 'unwatched');

        // All titles the user has already encountered — Gemini must not repeat these
        const allSeenTitles = swipedMovies.map((m) => m.title);

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `
You are a cinephile recommendation engine. Analyse the user's taste profile
below, then recommend ONE film they are very likely to love.

## User taste profile

LOVED (highly rated by user):
${loved.length ? loved.map(movieLabel).join('\n') : 'None yet'}

WATCHED AND LIKED (neutral positive):
${watched.length ? watched.map(movieLabel).join('\n') : 'None yet'}

DISLIKED:
${disliked.length ? disliked.map(movieLabel).join('\n') : 'None yet'}

HAVEN'T WATCHED (swiped past):
${unwatched.length ? unwatched.map(movieLabel).join('\n') : 'None yet'}

## Instructions

1. First, silently identify 2-3 patterns in the loved list (genres, directors,
   themes, tone, era). Use these patterns to drive your pick.
2. Recommend ONE film that is NOT in any of the lists above. Do not recommend:
   ${allSeenTitles.slice(-60).join(', ')}
3. Avoid defaulting to the single most famous film in a genre
   (e.g. if they love sci-fi, don't just say Interstellar). Be specific and
   slightly surprising — a hidden gem or a less-obvious great film is better
   than the safest pick.
4. The "reason" field should explain specifically *why* this matches their
   taste (reference their loved films by name).

Return ONLY valid JSON — no markdown, no preamble.
`.trim();

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // fixed from invalid 'gemini-3-flash-preview'
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        year: { type: Type.INTEGER },
                        director: { type: Type.STRING },
                        genre: { type: Type.STRING },
                        synopsis: { type: Type.STRING },
                        reason: { type: Type.STRING },
                    },
                    required: ['title', 'year', 'director', 'genre', 'synopsis', 'reason'],
                },
            },
        });

        const text = response.text;
        if (!text) {
            console.error('[getMovieRecommendation] Gemini returned empty response');
            return null;
        }

        const parsed: Recommendation = JSON.parse(text);

        // Fetch poster for the recommended film from TMDB
        const apiKey = process.env.TMDB_API_KEY;
        if (apiKey && parsed.title) {
            try {
                const searchRes = await fetch(
                    `https://api.themoviedb.org/3/search/movie` +
                    `?api_key=${apiKey}` +
                    `&query=${encodeURIComponent(parsed.title)}` +
                    `&year=${parsed.year}` +
                    `&language=en-US`
                );
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    const posterPath = searchData.results?.[0]?.poster_path;
                    if (posterPath) {
                        parsed.posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
                    }
                }
            } catch (err) {
                console.error('[getMovieRecommendation] Poster fetch failed (non-fatal):', err);
            }
        }

        return parsed;
    } catch (error) {
        console.error('[getMovieRecommendation] Failed:', error);
        return null;
    }
}