import { cookies } from 'next/headers';

/**
 * Gets or creates an anonymous session ID for tracking unauthenticated users.
 */
export async function getSessionId(): Promise<string> {
    const cookieStore = await cookies();
    const existing = cookieStore.get('session_id');
    if (existing) return existing.value;
    
    const newSessionId = crypto.randomUUID();
    // Wait for set to complete
    cookieStore.set('session_id', newSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return newSessionId;
}
