/**
 * Minimal structured logger for server-side code.
 *
 * In development: logs full details (code + context) for easy debugging.
 * In production: logs only a structured error code and minimal context,
 * avoiding exposure of internal API structure, third-party service names,
 * or failure details that could aid an attacker.
 */

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Structured log details. Keys should be short identifiers, values
 * should not contain sensitive information (API keys, user data, etc.).
 */
type LogDetails = Record<string, unknown>;

/**
 * Logs an error with a structured code and optional details.
 *
 * @param code - A short, uppercase error code (e.g. 'TMDB_FETCH_FAILED').
 * @param details - Optional context object. In production, only the code
 *                  and safe numeric fields (like HTTP status) are logged.
 */
function error(code: string, details?: LogDetails): void {
    if (isDev) {
        // Development: full details for debugging
        console.error(`[ERROR] ${code}`, details ?? '');
    } else {
        // Production: structured code only, with safe numeric context
        const safeDetails: LogDetails = {};
        if (details) {
            // Only pass through numeric values (like status codes) to production logs
            for (const [key, value] of Object.entries(details)) {
                if (typeof value === 'number') {
                    safeDetails[key] = value;
                }
            }
        }
        console.error(
            JSON.stringify({ level: 'error', code, ...safeDetails })
        );
    }
}

/**
 * Logs a warning with a structured code and optional details.
 *
 * @param code - A short, uppercase warning code.
 * @param details - Optional context object. Same production filtering as error().
 */
function warn(code: string, details?: LogDetails): void {
    if (isDev) {
        console.warn(`[WARN] ${code}`, details ?? '');
    } else {
        const safeDetails: LogDetails = {};
        if (details) {
            for (const [key, value] of Object.entries(details)) {
                if (typeof value === 'number') {
                    safeDetails[key] = value;
                }
            }
        }
        console.warn(
            JSON.stringify({ level: 'warn', code, ...safeDetails })
        );
    }
}

/** Structured logger instance for server-side use. */
export const logger = { error, warn } as const;
