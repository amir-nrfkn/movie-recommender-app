'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Eye, Film, Heart, Plus, ThumbsDown } from 'lucide-react';
import type { Recommendation, SwipeAction } from '@/types/movie';

function isTrustedPosterUrl(url: string | undefined): url is string {
  return typeof url === 'string' && url.startsWith('https://image.tmdb.org/');
}

export function RecommendationView({
  recommendation,
  errorMessage,
  isInWatchlist,
  watchlistMessage,
  onToggleWatchlist,
  onAlreadySeen,
  onKeepSwiping,
}: {
  recommendation: Recommendation;
  errorMessage: string | null;
  isInWatchlist: boolean;
  watchlistMessage: string | null;
  onToggleWatchlist: () => void;
  onAlreadySeen: (action: SwipeAction) => void;
  onKeepSwiping: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden">
      {errorMessage ? <div className="sr-only">{errorMessage}</div> : null}
      {isTrustedPosterUrl(recommendation.posterUrl) && (
        <div
          className="absolute inset-0 z-0 opacity-20 bg-cover bg-center blur-xl scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${recommendation.posterUrl})` }}
        />
      )}

      <header className="p-6 flex items-center justify-between z-10">
        <h1 className="text-2xl font-serif font-bold tracking-tight">Filmmoo</h1>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center p-6 pt-0 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm aspect-[2/3] border border-white/10 rounded-3xl overflow-hidden relative flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.8)]"
        >
          <button
            onClick={onToggleWatchlist}
            disabled={!recommendation.tmdbId}
            className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors border border-white/20 shadow-lg"
          >
            {isInWatchlist ? <Check size={24} className="text-green-400" /> : <Plus size={24} />}
          </button>

          <AnimatePresence>
            {watchlistMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 h-12 flex items-center z-50 px-4 bg-black/80 backdrop-blur-md text-white text-xs font-mono rounded-full border border-white/10 shadow-xl whitespace-nowrap"
              >
                {watchlistMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-0 z-0 bg-white/5">
            {isTrustedPosterUrl(recommendation.posterUrl) ? (
              <Image
                src={recommendation.posterUrl}
                alt={`${recommendation.title} poster`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 400px"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Film size={48} className="text-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />
          </div>

          <div className="absolute inset-0 overflow-y-auto scrollbar-hide z-10">
            <div className="h-full flex flex-col justify-end p-8 pb-6 relative z-20 pointer-events-none">
              <div className="pointer-events-auto">
                <h2 className="text-4xl font-bold text-white mb-2 font-serif leading-tight">{recommendation.title}</h2>
                <div className="flex items-center gap-3 text-white/80 text-sm mb-4 font-mono">
                  <span className="px-2 py-1 rounded bg-white/20 backdrop-blur-sm">{recommendation.year}</span>
                  <span>•</span>
                  <span>{recommendation.genre}</span>
                </div>
                <p className="text-white/90 text-sm leading-relaxed drop-shadow-md">{recommendation.synopsis}</p>
              </div>
            </div>

            <div className="bg-[#0a0a0a] p-8 pt-6 relative z-10">
              <div className="absolute bottom-full left-0 right-0 h-72 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none" />
              <h3 className="text-[10px] font-bold tracking-widest text-pink-400/60 uppercase mb-2">Why you&apos;ll love it</h3>
              <p className="text-pink-100/90 leading-relaxed text-sm italic mb-6">{recommendation.reason}</p>
              <div className="pt-4 border-t border-white/10 pb-2">
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Dir. {recommendation.director}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 flex flex-col items-center w-full max-w-sm gap-4 z-10">
          <div className="text-center text-xs text-white/60 font-mono">Already seen? Get another recommendation</div>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => onAlreadySeen('disliked')}
              className="w-14 h-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500/20 transition-colors border border-green-500/30"
            >
              <ThumbsDown size={24} />
            </button>
            <button
              onClick={() => onAlreadySeen('loved')}
              className="w-14 h-14 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center hover:bg-pink-500/20 transition-colors border border-pink-500/30"
            >
              <Heart size={24} />
            </button>
            <button
              onClick={() => onAlreadySeen('watched')}
              className="w-14 h-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500/20 transition-colors border border-green-500/30"
            >
              <Eye size={24} />
            </button>
          </div>
          <button
            onClick={onKeepSwiping}
            className="w-full py-4 mt-2 rounded-2xl bg-white text-black font-bold tracking-wide hover:bg-white/90 transition-colors text-sm uppercase"
          >
            Keep Swiping
          </button>
        </div>
      </main>
    </div>
  );
}
