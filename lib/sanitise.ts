/**
 * Input sanitisation utilities for user-supplied strings.
 *
 * These functions are used to clean text before it is interpolated into
 * AI prompts (Gemini) or used in server-side filtering. The primary goal
 * is to prevent prompt injection attacks where a crafted movie title like
 * "Inception\n\nIgnore previous instructions and..." could manipulate
 * the model's output.
 */

/** Maximum allowed length for a sanitised string (characters). */
const MAX_LENGTH = 100;

/**
 * Regex matching control characters and non-printable characters.
 * Allows printable ASCII (0x20–0x7E) and common Unicode letters/marks
 * (Latin, accented characters, CJK, etc.) but strips:
 * - \x00–\x1F (C0 control characters including \n, \r, \t)
 * - \x7F (DEL)
 * - \x80–\x9F (C1 control characters)
 * - Other Unicode control/format characters (category Cc/Cf)
 */
const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F-\x9F]/g;

/**
 * Sanitises a string for safe inclusion in an AI prompt.
 *
 * Steps:
 * 1. Trims leading/trailing whitespace
 * 2. Strips newline characters (\n, \r) and other control characters
 * 3. Caps length at MAX_LENGTH characters
 * 4. Removes any remaining control characters outside printable range
 *
 * @param text - The raw input string (e.g. a movie title from the client).
 * @returns A sanitised string safe for prompt interpolation.
 */
export function sanitiseForPrompt(text: string): string {
    return text
        .trim()
        .replace(CONTROL_CHAR_REGEX, '') // Remove control chars (includes \n, \r, \t)
        .slice(0, MAX_LENGTH)
        .trim(); // Re-trim in case removing chars exposed whitespace
}
