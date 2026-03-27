'use server';

import { createClient } from '@/lib/supabase/server';
import type { HistoryItem, ProfileDetails } from '@/types/library';
import type { Database } from '@/types/supabase';

function mapHistoryRow(row: Database['public']['Tables']['swipe_events']['Row']): HistoryItem | null {
  if (row.action === 'unwatched') return null;

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
    source: row.source as HistoryItem['source'],
    action: row.action,
    createdAt: row.created_at,
  };
}

export async function getSwipeHistory(): Promise<HistoryItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('swipe_events')
    .select('*')
    .eq('user_id', user.id)
    .in('action', ['watched', 'loved', 'disliked'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapHistoryRow).filter(Boolean) as HistoryItem[];
}

export async function getCurrentUserProfile(): Promise<ProfileDetails> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    email: user.email ?? null,
    name: profile?.name ?? null,
  };
}

export async function updateProfileName(formData: FormData): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const name = String(formData.get('name') ?? '').trim();
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { status: 'error', error: authError.message };
  if (!user) return { status: 'error', error: 'Unauthorized' };

  const { error } = await supabase.from('profiles').upsert({ id: user.id, name: name || null });
  if (error) return { status: 'error', error: error.message };

  return { status: 'success' };
}

export async function updateEmail(formData: FormData): Promise<{ status: 'success'; message: string } | { status: 'error'; error: string }> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { status: 'error', error: 'Email is required' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { status: 'error', error: error.message };

  return { status: 'success', message: 'Email update requested. Check your inbox if confirmation is required.' };
}

export async function updatePassword(formData: FormData): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const password = String(formData.get('password') ?? '');
  if (password.length < 6) return { status: 'error', error: 'Password must be at least 6 characters long' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: 'error', error: error.message };

  return { status: 'success' };
}
