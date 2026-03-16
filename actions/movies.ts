/**
 * Server Actions for fetching movie data from TMDB and generating
 * recommendations via Gemini AI.
 *
 * Security measures applied:
 * - Rate limiting: Both actions check request rate per IP before proceeding.
 * - Prompt sanitisation: All client-supplied strings are sanitised before
 *   interpolation into the Gemini prompt to prevent prompt injection.
 * - Structured logging: Internal details are only logged verbosely in
 *   development; production logs use structured error codes only.
 * - Response validation: AI responses are validated via isValidRecommendation
 *   type guard before being sent to the client.
 */
'use server';

import { GoogleGenAI, Type } from '@google/genai';
import { headers } from 'next/headers';
import type { Movie, SwipeAction, SwipedMovie, Recommendation } from '@/types/movie';
import { isValidRecommendation } from '@/types/movie';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitiseForPrompt } from '@/lib/sanitise';
import { logger } from '@/lib/logger';

const MOVIES_PER_BATCH = 20;
const MAX_EXCLUSION_LIST_SIZE = 500;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Reads the client IP from Next.js request headers.
 * Falls back to '127.0.0.1' if no forwarding header is present (local dev).
 */
async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-vercel-forwarded-for') ??
        '127.0.0.1'
    );
}

/**
 * Builds a rich metadata string for a swiped movie to give Gemini
 * context beyond just the title (genre, director, year).
 * All string fields are sanitised to prevent prompt injection.
 */
function movieLabel(m: SwipedMovie): string {
    const parts = [sanitiseForPrompt(m.title)];
    if (m.year) parts.push(`(${m.year})`);
    if (m.director && m.director !== 'Unknown Director') {
        parts.push(`dir. ${sanitiseForPrompt(m.director)}`);
    }
    if (m.genre) parts.push(`[${sanitiseForPrompt(m.genre)}]`);
    return parts.join(' ');
}

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { cookies } from 'next/headers';

import { getSessionId } from '@/lib/session';

// Helper to get an admin client (bypasses RLS)
function getAdminClient() {
    const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !roleKey) {
        return null;
    }
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        roleKey,
        { auth: { persistSession: false } }
    );
}

// ─── Session Management ──────────────────────────────────────────────────────

/**
 * Stores a swipe action in the database against the current session.
 */
export async function saveSwipe(movieId: string, action: SwipeAction): Promise<void> {
    try {
        const sessionId = await getSessionId();
        const supabase = getAdminClient();
        if (!supabase) return;
        
        await supabase.from('swipe_history').insert({
            session_id: sessionId,
            movie_id: movieId,
            action: action,
        } as any);
    } catch (err) {
        logger.warn('SAVE_SWIPE_FAILED', { error: String(err) });
        // Non-blocking, so we swallow the error rather than breaking the UI
    }
}

// ─── fetchMovies ─────────────────────────────────────────────────────────────

/**
 * Fetches a batch of well-known movies from TMDB using the `discover`
 * endpoint with quality floors, rather than `top_rated` paged randomly.
 *
 * Rate limited to 30 requests per 60 seconds per IP.
 * Excludes movies the user has already swiped in their session, plus any locally visible ones.
 */
export async function fetchMovies(
    visibleIds: string[] = []
): Promise<Omit<Movie, 'gradient'>[]> {
    // ── Rate limiting ──
    const ip = await getClientIp();
    const rateCheck = await checkRateLimit(ip, 'fetchMovies');
    if (!rateCheck.allowed) {
        throw new Error(
            `Rate limit exceeded. Please try again in ${rateCheck.retryAfter} seconds.`
        );
    }

    try {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey) {
            logger.error('TMDB_KEY_MISSING');
            return [];
        }

        const sessionId = await getSessionId();
        const supabase = getAdminClient();
        let dbExcludedIds: string[] = [];

        if (supabase) {
            // Fetch historically seen movies for this session
            const { data: history } = await supabase
                .from('swipe_history')
                .select('movie_id')
                .eq('session_id', sessionId);
                
            dbExcludedIds = (history as any[])?.map(h => h.movie_id) || [];
        }

        // Build a complete set of IDs to exclude (past history + current stack)
        const excludedSet = new Set([
            ...visibleIds.map(String),
            ...dbExcludedIds.map(String)
        ]);

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
            logger.error('TMDB_DISCOVER_FAILED', { status: discoverRes.status });
            return [];
        }

        const discoverData = await discoverRes.json();
        const results: any[] = discoverData.results || [];

        const filtered = results.filter(
            (m) => !excludedSet.has(String(m.id))
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
                    id: String(d.id),
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
        return resolved.filter(Boolean) as Omit<Movie, 'gradient'>[];
    } catch (error) {
        // Re-throw rate limit errors so the client can display them
        if (error instanceof Error && error.message.includes('Rate limit')) {
            throw error;
        }
        logger.error('FETCH_MOVIES_UNEXPECTED', { error: String(error) });
        return [];
    }
}

// ─── getMovieRecommendation ───────────────────────────────────────────────────

/**
 * Generates a personalised movie recommendation using Gemini.
 *
 * Rate limited to 10 requests per 60 seconds per IP.
 * All client-supplied strings are sanitised before prompt interpolation
 * to prevent prompt injection attacks.
 */
export async function getMovieRecommendation(
    swipedMovies: SwipedMovie[]
): Promise<Recommendation | null> {
    // ── Rate limiting ──
    const ip = await getClientIp();
    const rateCheck = await checkRateLimit(ip, 'getMovieRecommendation');
    if (!rateCheck.allowed) {
        throw new Error(
            `Rate limit exceeded. Please try again in ${rateCheck.retryAfter} seconds.`
        );
    }

    try {
        const loved = swipedMovies.filter((m) => m.action === 'loved');
        const watched = swipedMovies.filter((m) => m.action === 'watched');
        const disliked = swipedMovies.filter((m) => m.action === 'disliked');
        const unwatched = swipedMovies.filter((m) => m.action === 'unwatched');

        // Sanitise all titles before injecting into the prompt
        const allSeenTitles = swipedMovies.map((m) => sanitiseForPrompt(m.title));

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
            model: 'gemini-2.5-flash',
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
            logger.error('GEMINI_EMPTY_RESPONSE');
            return null;
        }

        const parsed: unknown = JSON.parse(text);

        if (!isValidRecommendation(parsed)) {
            logger.error('GEMINI_INVALID_SHAPE', {
                // Only log a truncated preview in dev; prod gets just the code
                preview: String(JSON.stringify(parsed)).slice(0, 200),
            });
            return null;
        }

        // After validation, assign to a mutable typed variable so we can attach the poster
        const recommendation: Recommendation = { ...parsed };

        // Fetch poster for the recommended film from TMDB
        const apiKey = process.env.TMDB_API_KEY;
        if (apiKey && recommendation.title) {
            try {
                const searchRes = await fetch(
                    `https://api.themoviedb.org/3/search/movie` +
                    `?api_key=${apiKey}` +
                    `&query=${encodeURIComponent(recommendation.title)}` +
                    `&year=${recommendation.year}` +
                    `&language=en-US`
                );
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    const posterPath = searchData.results?.[0]?.poster_path;
                    if (posterPath) {
                        recommendation.posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
                    }
                }
            } catch (err) {
                logger.warn('POSTER_FETCH_FAILED', { error: String(err) });
            }
        }

        return recommendation;
    } catch (error) {
        // Re-throw rate limit errors so the client can display them
        if (error instanceof Error && error.message.includes('Rate limit')) {
            throw error;
        }
        logger.error('RECOMMENDATION_FAILED', { error: String(error) });
        return null;
    }
}