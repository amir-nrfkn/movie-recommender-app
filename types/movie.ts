/**
 * Shared type definitions for movie data used across the Filmmoo app.
 *
 * These types are used by both the client-side swipe UI (app/page.tsx)
 * and the server-side AI calls (actions/movies.ts). Keeping them in a
 * shared file ensures consistency between what the server returns and
 * what the client expects.
 */

/** A movie card displayed in the swipe stack. */
export type Movie = {
    /** Unique identifier generated client-side for React keys and deduplication. */
    id: string;
    title: string;
    year: number;
    director: string;
    genre: string;
    synopsis: string;
    /** CSS gradient string used as the card's background. */
    gradient: string;
    /** Optional TMDB movie poster URL to display on the card. */
    posterUrl?: string;
};

/** The four possible user actions when interacting with a movie card. */
export type SwipeAction = 'unwatched' | 'watched' | 'loved' | 'disliked';

/** A movie that the user has already swiped on, tagged with their action. */
export type SwipedMovie = Movie & {
    action: SwipeAction;
};

/** The AI-generated movie recommendation returned by the Gemini model. */
export type Recommendation = {
    title: string;
    year: number;
    director: string;
    genre: string;
    synopsis: string;
    /** A personalized explanation of why the user would enjoy this movie. */
    reason: string;
    /** Optional TMDB movie poster URL to display on the recommendation card. */
    posterUrl?: string;
};
