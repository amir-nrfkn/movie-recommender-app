'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, useAnimation, useMotionValue, useMotionValueEvent, useTransform, AnimatePresence } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import type { Movie, SwipeAction } from '@/types/movie';

function isTrustedPosterUrl(url: string | undefined): url is string {
  return typeof url === 'string' && url.startsWith('https://image.tmdb.org/');
}

export function SwipeCard({
  movie,
  onSwipe,
  onSwipeStart,
  isTop,
  index,
  onUndo,
  canUndo,
}: {
  movie: Movie;
  onSwipe: (action: SwipeAction, movie: Movie) => void;
  onSwipeStart?: () => void;
  isTop: boolean;
  index: number;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const [posterError, setPosterError] = useState(false);
  const [label, setLabel] = useState<{ text: string; color: string } | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const controls = useAnimation();
  const scale = isTop ? 1 : 0.95 - (index * 0.05);
  const yOffset = isTop ? 0 : index * 15;

  const updateLabel = (currentX: number, currentY: number) => {
    const absX = Math.abs(currentX);
    const absY = Math.abs(currentY);
    if (Math.max(absX, absY) < 60) {
      setLabel(null);
      return;
    }

    if (absX > absY) {
      setLabel(
        currentX > 0
          ? { text: 'WATCHED', color: 'bg-green-500 text-white border-green-400' }
          : { text: 'UNWATCHED', color: 'bg-blue-500 text-white border-blue-400' }
      );
      return;
    }

    setLabel(
      currentY < 0
        ? { text: 'LOVED', color: 'bg-pink-500 text-white border-pink-400' }
        : { text: 'DISLIKED', color: 'bg-orange-500 text-white border-orange-400' }
    );
  };

  useMotionValueEvent(x, 'change', (latestX) => updateLabel(latestX, y.get()));
  useMotionValueEvent(y, 'change', (latestY) => updateLabel(x.get(), latestY));

  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number } }) => {
    const { offset } = info;
    const swipeThreshold = 100;
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);

    if (Math.max(absX, absY) <= swipeThreshold) {
      await controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
      return;
    }

    if (onSwipeStart) onSwipeStart();

    let direction: SwipeAction;
    if (absX > absY) {
      direction = offset.x > 0 ? 'watched' : 'unwatched';
      await controls.start({ x: offset.x > 0 ? 500 : -500, opacity: 0, transition: { duration: 0.2 } });
    } else {
      direction = offset.y < 0 ? 'loved' : 'disliked';
      await controls.start({ y: offset.y < 0 ? -500 : 500, opacity: 0, transition: { duration: 0.2 } });
    }

    onSwipe(direction, movie);
  };

  return (
    <motion.div
      className="absolute w-full h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/10 origin-bottom"
      style={{ background: movie.gradient, x, y, rotate, scale, top: yOffset, zIndex: 100 - index }}
      drag={isTop}
      dragDirectionLock={false}
      onDragEnd={handleDragEnd}
      animate={controls}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
    >
      <div className="absolute inset-0 cursor-grab active:cursor-grabbing z-10" />

      {isTop && canUndo && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUndo();
          }}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors z-50 border border-white/20"
        >
          <RotateCcw size={18} />
        </button>
      )}

      {isTrustedPosterUrl(movie.posterUrl) && !posterError && (
        <Image
          src={movie.posterUrl}
          alt={`${movie.title} poster`}
          fill
          className="object-cover z-0"
          draggable={false}
          sizes="(max-width: 640px) 100vw, 400px"
          onError={() => setPosterError(true)}
          priority={isTop}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-0 pointer-events-none" />

      <AnimatePresence>
        {label && isTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full border-2 font-bold tracking-widest text-sm z-50 ${label.color}`}
          >
            {label.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 p-8 flex flex-col justify-end z-10 relative">
        <h2 className="text-4xl font-bold text-white mb-2 font-serif leading-tight">{movie.title}</h2>
        <div className="flex items-center gap-3 text-white/80 text-sm mb-4 font-mono">
          <span className="px-2 py-1 rounded bg-white/20 backdrop-blur-sm">{movie.year}</span>
          <span>•</span>
          <span>{movie.genre}</span>
        </div>
        <p className="text-white/90 text-sm leading-relaxed mb-4 line-clamp-4">{movie.synopsis}</p>
        <p className="text-white/60 text-xs font-mono">Dir. {movie.director}</p>
      </div>
    </motion.div>
  );
}
