'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Loader2, Film } from 'lucide-react';
import { signup } from '@/actions/auth';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await signup(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/`;
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setIsGoogleLoading(false);
      return;
    }
    if (data?.url) {
      window.location.assign(data.url);
      return;
    }
    setError('Google sign-in failed. Please try again.');
    setIsGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-white font-sans relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Film className="text-white" size={20} />
            </div>
            <span className="text-2xl font-bold tracking-tight">Filmmoo</span>
          </Link>
          <h1 className="text-2xl font-semibold mb-2">Create an account</h1>
          <p className="text-gray-400 text-sm">Join to personalize your recommendations and save movies to your watchlist.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl">
                {error}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300 ml-1">Name (optional)</label>
              <input 
                name="name"
                type="text"
                className="w-full h-12 bg-black/40 border border-white/10 rounded-2xl px-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="Jane Doe"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300 ml-1">Email</label>
              <input 
                name="email"
                type="email"
                required
                className="w-full h-12 bg-black/40 border border-white/10 rounded-2xl px-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
              <input 
                name="password"
                type="password"
                required
                minLength={6}
                className="w-full h-12 bg-black/40 border border-white/10 rounded-2xl px-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              disabled={isLoading}
              type="submit"
              className="w-full h-12 mt-4 bg-white text-black font-semibold rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Sign Up'}
            </button>

            <button
              disabled={isGoogleLoading}
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full h-12 mt-2 bg-transparent border border-white/20 text-white font-semibold rounded-2xl flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGoogleLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Continue with Google'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-white font-medium hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
