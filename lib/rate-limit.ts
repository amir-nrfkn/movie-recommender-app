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

/** Stores request timestamps per "ip:action" key. */
const requestMap = new Map<string, number[]>();

/**
 * Interval (ms) between automatic cleanup passes that remove expired entries
 * from the map to prevent unbounded memory growth.
 */
const CLEANUP_INTERVAL_MS = 120_000;

/** Tracks whether the cleanup timer has been started. */
let cleanupStarted = false;

/**
 * Removes entries from requestMap whose newest timestamp is older than
 * any action's window. Called periodically to avoid memory leaks.
 */
function cleanupExpiredEntries(): void {
    const now = Date.now();
    // Use the largest window across all actions as the expiry threshold
    const maxWindow = Math.max(
        ...Object.values(ACTION_LIMITS).map((c) => c.windowMs)
    );

    for (const [key, timestamps] of requestMap) {
        // If even the newest request is older than the window, drop the key
        if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now - maxWindow) {
            requestMap.delete(key);
        }
    }
}

/**
 * Starts the periodic cleanup timer if it hasn't been started already.
 * Uses unref() so the timer doesn't prevent Node from exiting.
 */
function ensureCleanupStarted(): void {
    if (cleanupStarted) return;
    cleanupStarted = true;

    const timer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
    // Allow the Node process to exit even if this timer is still active
    if (typeof timer === 'object' && 'unref' in timer) {
        timer.unref();
    }
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
export function checkRateLimit(ip: string, action: string): RateLimitResult {
    ensureCleanupStarted();

    const config = ACTION_LIMITS[action];
    if (!config) {
        // Unknown action — allow by default (fail-open for unconfigured actions)
        return { allowed: true };
    }

    const key = `${ip}:${action}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing timestamps and filter to only those within the current window
    const existing = requestMap.get(key) ?? [];
    const recentTimestamps = existing.filter((t) => t > windowStart);

    if (recentTimestamps.length >= config.maxRequests) {
        // Rate limit exceeded — calculate when the oldest request in the window expires
        const oldestInWindow = recentTimestamps[0];
        const retryAfterMs = oldestInWindow + config.windowMs - now;
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

        return {
            allowed: false,
            retryAfter: Math.max(1, retryAfterSeconds),
        };
    }

    // Allow the request and record the timestamp
    recentTimestamps.push(now);
    requestMap.set(key, recentTimestamps);

    return { allowed: true };
}
