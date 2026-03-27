'use server';

import { createClient } from '@/lib/supabase/server';
import type { MovieDetail, WatchlistItem } from '@/types/library';
import type { Database } from '@/types/supabase';

function mapWatchlistRow(row: Database['public']['Tables']['watchlists']['Row']): WatchlistItem {
  return {
    id: row.id,
    tmdbId: row.tmdb_movie_id,
    title: row.movie_title ?? 'Unknown Title',
    year: row.movie_year ?? 0,
    director: row.movie_director ?? 'Unknown Director',
    genre: row.movie_genre ?? 'Unknown Genre',
    synopsis: row.movie_synopsis ?? '',
    posterUrl: row.poster_url ?? undefined,
    recommendationReason: row.recommendation_reason ?? null,
    source: row.source as WatchlistItem['source'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Server action to set watchlist state idempotently.
 * Returns the resulting state.
 */
export async function setWatchlistItem(
  movie: MovieDetail,
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
        movie_director: movie.director ?? null,
        movie_genre: movie.genre ?? null,
        movie_synopsis: movie.synopsis ?? null,
        poster_url: movie.posterUrl ?? null,
        recommendation_reason: movie.recommendationReason ?? null,
        source: movie.source ?? 'manual',
        recommended_at: movie.recommendationReason ? new Date().toISOString() : null,
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

export async function getWatchlistItems(): Promise<WatchlistItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('watchlists')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapWatchlistRow);
}
