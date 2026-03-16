/**
 * In-memory sliding-window rate limiter for Server Actions.
 *
 * Tracks request timestamps per IP+action key and enforces configurable
 * limits (e.g. 30 req/60s for fetchMovies, 10 req/60s for recommendations).
 *
 * ⚠️  SERVERLESS CAVEAT: On Vercel or similar platforms, each cold start
 * creates a fresh Map — so the rate limiter only protects within a single
 * instance's lifetime. For production-grade limiting across instances,
 * use a shared store like Redis / Upstash. This in-memory approach is
 * appropriate for single-instance deployments and provides baseline
 * protection against naive abuse scripts.
 */

/** Per-action rate limit configuration. */
interface RateLimitConfig {
    /** Maximum number of requests allowed within the window. */
    maxRequests: number;
    /** Window duration in milliseconds. */
    windowMs: number;
}

/** Result returned by checkRateLimit. */
export interface RateLimitResult {
    /** Whether the request is allowed to proceed. */
    allowed: boolean;
    /** Seconds until the client can retry, only set when allowed is false. */
    retryAfter?: number;
}

/**
 * Rate limit configurations per action name.
 * Add new actions here as needed.
 */
const ACTION_LIMITS: Record<string, RateLimitConfig> = {
    fetchMovies: { maxRequests: 30, windowMs: 60_000 },
    getMovieRecommendation: { maxRequests: 10, windowMs: 60_000 },
};

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

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

/**
 * Checks whether a request from the given IP for the given action
 * should be allowed under the configured rate limit.
 *
 * @param ip - The client's IP address (from Next.js headers).
 * @param action - The action name, must match a key in ACTION_LIMITS.
 * @returns An object indicating whether the request is allowed, and
 *          how many seconds until the client can retry if not.
 */
export async function checkRateLimit(ip: string, action: string): Promise<RateLimitResult> {
    const config = ACTION_LIMITS[action];
    if (!config) {
        // Unknown action — allow by default (fail-open for unconfigured actions)
        return { allowed: true };
    }

    const key = `${ip}:${action}`;
    const supabase = getAdminClient();
    if (!supabase) {
        console.warn('[RateLimit] Missing Supabase environment variables. Bypassing rate limit.');
        return { allowed: true };
    }

    // Use string type for intervals in PostgreSQL (e.g., "60000 milliseconds")
    const intervalStr = `${config.windowMs} milliseconds`;

    const { data, error } = await supabase.rpc('check_rate_limit', {
        ip_action_key: key,
        max_reqs: config.maxRequests,
        window_interval: intervalStr,
    } as any);

    if (error) {
        console.error('[RateLimit] Supabase RPC error:', error);
        // Fail-open if the DB is unreachable to prevent breaking the app,
        // or fail-closed depending on security posture. Fail-open is standard for this.
        return { allowed: true };
    }

    // Parse the JSON result returned by the RPC
    const result = data as any;
    
    // In case string came back instead of parsed json (due to typed RPC mismatches)
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;

    if (parsed && parsed.allowed === false) {
        return {
            allowed: false,
            retryAfter: parsed.retryAfter || Math.ceil(config.windowMs / 1000),
        };
    }

    return { allowed: true };
}
