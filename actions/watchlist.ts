'use server';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getSessionId } from '@/lib/session';

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

/**
 * Server action to toggle a movie in the user's watchlist.
 * Returns true if added, false if removed.
 */
export async function toggleWatchlist(movie: { id: string, title: string, posterUrl?: string }, addingOptimistic: boolean): Promise<boolean> {
    const supabase = getAdminClient();
    if (!supabase) {
        // Fallback for dev without supabase — return the expected optimistic state
        return addingOptimistic; 
    }

    const sessionId = await getSessionId();

    // Check if it already exists
    const { data: existing } = await supabase
        .from('watchlists')
        .select('id')
        .eq('session_id', sessionId)
        .eq('movie_id', movie.id)
        .single();

    if (existing) {
        // Remove it
        await supabase
            .from('watchlists')
            .delete()
            .eq('id', (existing as any).id);
        return false;
    } else {
        // Add it
        await supabase
            .from('watchlists')
            .insert({
                session_id: sessionId,
                movie_id: movie.id,
                movie_title: movie.title,
                poster_url: movie.posterUrl || null,
            } as any);
        return true;
    }
}
