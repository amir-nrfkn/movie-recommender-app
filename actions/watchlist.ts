'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Server action to set watchlist state idempotently.
 * Returns the resulting state.
 */
export async function setWatchlistItem(
  movie: { tmdbId: number; title: string; posterUrl?: string; year?: number },
  shouldBeInWatchlist: boolean
): Promise<boolean> {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(authError.message);
    }
    if (!user) {
      throw new Error('Unauthorized');
    }

    if (!movie.tmdbId || movie.tmdbId <= 0) {
      throw new Error('Invalid TMDB movie ID');
    }

    if (shouldBeInWatchlist) {
      const { error } = await supabase.from('watchlists').upsert(
        {
          user_id: user.id,
          tmdb_movie_id: movie.tmdbId,
          movie_title: movie.title,
          movie_year: movie.year ?? null,
          poster_url: movie.posterUrl ?? null,
        },
        { onConflict: 'user_id,tmdb_movie_id' }
      );

      if (error) {
        throw new Error(error.message);
      }
      return true;
    }

    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('user_id', user.id)
      .eq('tmdb_movie_id', movie.tmdbId);

    if (error) {
      throw new Error(error.message);
    }
    return false;
}

export async function isMovieInWatchlist(tmdbId: number): Promise<boolean> {
  if (!tmdbId || tmdbId <= 0) return false;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }
  if (!user) return false;

  const { data, error } = await supabase
    .from('watchlists')
    .select('id')
    .eq('user_id', user.id)
    .eq('tmdb_movie_id', tmdbId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
