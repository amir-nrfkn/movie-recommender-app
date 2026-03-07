/**
 * Server Actions for fetching movie data from the Gemini AI model.
 *
 * These actions run exclusively on the server, keeping the GEMINI_API_KEY
 * secret and never exposing it to the browser. The client component
 * (app/page.tsx) calls these functions to get movie data and recommendations.
 *
 * Uses the @google/genai SDK with structured JSON output (responseSchema)
 * to guarantee type-safe responses from the model.
 */
'use server';

import { GoogleGenAI, Type } from '@google/genai';
import type { Movie, SwipedMovie, Recommendation } from '@/types/movie';

/** Number of movies to request from the AI per batch. */
const MOVIES_PER_BATCH = 15;

/**
 * Maximum number of previously-seen movie titles to send in the exclusion
 * prompt. Keeps the prompt from growing unboundedly in long sessions.
 */
const MAX_EXCLUSION_LIST_SIZE = 100;

/**
 * Fetches a batch of movie suggestions from the TMDB API.
 *
 * @param exclude - Titles of movies the user has already seen in this session,
 *   used to avoid duplicates. Only the most recent entries are sent to the model
 *   to keep the prompt within reasonable limits.
 * @returns An array of Movie objects (without `id` or `gradient` — those are
 *   added client-side) on success, or an empty array on failure.
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

        // Fetch a random page of popular English-language, US-origin movies
        const randomPage = Math.floor(Math.random() * 20) + 1;
        const popularRes = await fetch(
            `https://api.themoviedb.org/3/movie/top_rated?api_key=${apiKey}&include_adult=false&include_video=false&language=en-US&page=${randomPage}&sort_by=popularity.desc&with_origin_country=US&with_original_language=en`
        );

        if (!popularRes.ok) {
            console.error('[fetchMovies] Failed to fetch popular movies from TMDB:', popularRes.status);
            return [];
        }

        const popularData = await popularRes.json();
        const results = popularData.results || [];

        // Filter out movies that the user has already seen
        const excludedSet = new Set(exclude.map(t => t.toLowerCase()));
        const filteredResults = results.filter((m: any) => !excludedSet.has(m.title.toLowerCase()));

        // We only want MOVIES_PER_BATCH movies
        const selectedMovies = filteredResults.slice(0, MOVIES_PER_BATCH);

        // Fetch additional details (credits for director) for each selected movie
        const moviePromises = selectedMovies.map(async (m: any) => {
            const detailRes = await fetch(
                `https://api.themoviedb.org/3/movie/${m.id}?api_key=${apiKey}&append_to_response=credits`
            );
            if (!detailRes.ok) return null;

            const detailData = await detailRes.json();

            // Find the director in the crew
            const crew = detailData.credits?.crew || [];
            const director = crew.find((member: any) => member.job === 'Director')?.name || 'Unknown Director';

            // Map genres to a comma-separated string
            const genres = detailData.genres?.map((g: any) => g.name).join(', ') || 'Unknown Genre';

            // Extract year from release_date (e.g., "2023-10-12")
            const year = detailData.release_date ? parseInt(detailData.release_date.split('-')[0]) : 0;

            const posterUrl = detailData.poster_path ? `https://image.tmdb.org/t/p/w500${detailData.poster_path}` : undefined;

            return {
                title: detailData.title,
                year,
                director,
                genre: genres,
                synopsis: detailData.overview,
                posterUrl,
            };
        });

        const resolvedMovies = await Promise.all(moviePromises);
        return resolvedMovies.filter(Boolean) as Omit<Movie, 'id' | 'gradient'>[];

    } catch (error) {
        console.error('[fetchMovies] Failed to fetch movies from TMDB:', error);
        return [];
    }
}

/**
 * Generates a single personalized movie recommendation based on the user's
 * swipe history.
 *
 * @param swipedMovies - All movies the user has swiped on, each tagged with
 *   their action (loved, watched, disliked, unwatched). The function groups
 *   these into preference categories before sending to the model.
 * @returns A Recommendation object on success, or null on failure.
 */
export async function getMovieRecommendation(
    swipedMovies: SwipedMovie[]
): Promise<Recommendation | null> {
    try {
        // Group swiped movies into preference categories for the prompt
        const loved = swipedMovies
            .filter((m) => m.action === 'loved')
            .map((m) => m.title);
        const watched = swipedMovies
            .filter((m) => m.action === 'watched')
            .map((m) => m.title);
        const disliked = swipedMovies
            .filter((m) => m.action === 'disliked')
            .map((m) => m.title);
        const unwatched = swipedMovies
            .filter((m) => m.action === 'unwatched')
            .map((m) => m.title);

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Based on the user's movie preferences:
        Loved: ${loved.join(', ') || 'None'}
        Watched (neutral): ${watched.join(', ') || 'None'}
        Disliked: ${disliked.join(', ') || 'None'}
        Haven't watched: ${unwatched.join(', ') || 'None'}

        Recommend ONE movie the user would love that is NOT in any of the lists above.
        Return ONLY valid JSON matching this schema: {title, year, director, genre, synopsis, reason}`,
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
                    required: [
                        'title',
                        'year',
                        'director',
                        'genre',
                        'synopsis',
                        'reason',
                    ],
                },
            },
        });

        const text = response.text;
        if (!text) {
            console.error('[getMovieRecommendation] Gemini returned empty response');
            return null;
        }

        const parsed: Recommendation = JSON.parse(text);

        // Fetch the poster for this recommendation using TMDB
        const apiKey = process.env.TMDB_API_KEY;
        if (apiKey && parsed.title) {
            try {
                // Search TMDB for the recommended movie by title and year
                const searchRes = await fetch(
                    `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(parsed.title)}&year=${parsed.year}&language=en-US`
                );
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.results && searchData.results.length > 0) {
                        const posterPath = searchData.results[0].poster_path;
                        if (posterPath) {
                            parsed.posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
                        }
                    }
                }
            } catch (err) {
                console.error('[getMovieRecommendation] Failed to fetch poster from TMDB:', err);
                // Non-fatal, we just won't have a poster
            }
        }

        return parsed;
    } catch (error) {
        console.error(
            '[getMovieRecommendation] Failed to get recommendation from Gemini:',
            error
        );
        return null;
    }
}
