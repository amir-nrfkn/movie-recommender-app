/**
 * SceneIt — Main swipe interface page.
 *
 * This is a Client Component because it handles interactive gestures (drag/swipe),
 * animation state, and user input. All AI calls are delegated to Server Actions
 * in actions/movies.ts so the Gemini API key never reaches the browser.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, useMotionValueEvent, AnimatePresence } from 'motion/react';
import { EyeOff, Eye, Heart, ThumbsDown, Sparkles, Loader2, Film } from 'lucide-react';
import { fetchMovies, getMovieRecommendation } from '@/actions/movies';
import type { Movie, SwipeAction, SwipedMovie, Recommendation } from '@/types/movie';

const LOADING_MESSAGES = [
  "Popping the popcorn...",
  "Waking up the projectionist...",
  "Splicing film reels...",
  "Dimming the lights...",
  "Finding the perfect seat...",
  "Rolling the credits...",
];

function getRandomGradient() {
  const colors = [
    ['#141E30', '#243B55'],
    ['#0F2027', '#203A43', '#2C5364'],
    ['#2C3E50', '#3498DB'],
    ['#4B79A1', '#283E51'],
    ['#1D2B64', '#F8CDDA'],
    ['#1A2980', '#26D0CE'],
    ['#3A1C71', '#D76D77', '#FFAF7B'],
    ['#000000', '#434343'],
    ['#333333', '#dd1818'],
    ['#0f0c29', '#302b63', '#24243e'],
  ];
  const selected = colors[Math.floor(Math.random() * colors.length)];
  if (selected.length === 2) return `linear-gradient(to bottom right, ${selected[0]}, ${selected[1]})`;
  return `linear-gradient(to bottom right, ${selected[0]}, ${selected[1]}, ${selected[2]})`;
}

function SwipeCard({ movie, onSwipe, isTop, index }: { movie: Movie, onSwipe: (action: SwipeAction, movie: Movie) => void, isTop: boolean, index: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const scale = isTop ? 1 : 0.95 - (index * 0.05);
  const yOffset = isTop ? 0 : index * 15;

  const controls = useAnimation();
  const [label, setLabel] = useState<{ text: string; color: string } | null>(null);

  useMotionValueEvent(x, "change", (latestX) => updateLabel(latestX, y.get()));
  useMotionValueEvent(y, "change", (latestY) => updateLabel(x.get(), latestY));

  function updateLabel(currentX: number, currentY: number) {
    const absX = Math.abs(currentX);
    const absY = Math.abs(currentY);
    if (Math.max(absX, absY) < 60) {
      setLabel(null);
      return;
    }
    if (absX > absY) {
      setLabel(currentX > 0
        ? { text: 'WATCHED', color: 'bg-green-500 text-white border-green-400' }
        : { text: 'UNWATCHED', color: 'bg-blue-500 text-white border-blue-400' }
      );
    } else {
      setLabel(currentY < 0
        ? { text: 'LOVED', color: 'bg-pink-500 text-white border-pink-400' }
        : { text: 'DISLIKED', color: 'bg-orange-500 text-white border-orange-400' }
      );
    }
  }

  const handleDragEnd = async (event: any, info: any) => {
    const { offset } = info;
    const swipeThreshold = 100;
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);

    if (Math.max(absX, absY) > swipeThreshold) {
      let direction: SwipeAction;
      if (absX > absY) {
        direction = offset.x > 0 ? 'watched' : 'unwatched';
        await controls.start({ x: offset.x > 0 ? 500 : -500, opacity: 0, transition: { duration: 0.2 } });
      } else {
        direction = offset.y < 0 ? 'loved' : 'disliked';
        await controls.start({ y: offset.y < 0 ? -500 : 500, opacity: 0, transition: { duration: 0.2 } });
      }
      onSwipe(direction, movie);
    } else {
      controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  return (
    <motion.div
      className="absolute w-full h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col cursor-grab active:cursor-grabbing border border-white/10 origin-bottom"
      style={{
        background: movie.gradient,
        x,
        y,
        rotate,
        scale,
        top: yOffset,
        zIndex: 100 - index,
      }}
      drag={isTop}
      dragDirectionLock={false}
      onDragEnd={handleDragEnd}
      animate={controls}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
    >
      {/* Movie Poster Background */}
      {movie.posterUrl && (
        <img 
          src={movie.posterUrl} 
          alt={`${movie.title} poster`}
          className="absolute inset-0 w-full h-full object-cover z-0"
          draggable={false}
        />
      )}

      {/* Gradient Overlay for Text Readability */}
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
        <p className="text-white/90 text-sm leading-relaxed mb-4 line-clamp-4">
          {movie.synopsis}
        </p>
        <p className="text-white/60 text-xs font-mono">
          Dir. {movie.director}
        </p>
      </div>
    </motion.div>
  );
}

function Controls({ onAction }: { onAction: (action: SwipeAction) => void }) {
  return (
    <div className="flex items-center justify-center gap-4 mt-8 z-10">
      <button onClick={() => onAction('unwatched')} className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20 transition-colors border border-blue-500/30">
        <EyeOff size={24} />
      </button>
      <button onClick={() => onAction('disliked')} className="w-14 h-14 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center hover:bg-orange-500/20 transition-colors border border-orange-500/30">
        <ThumbsDown size={24} />
      </button>
      <button onClick={() => onAction('loved')} className="w-16 h-16 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center hover:bg-pink-500/20 transition-colors border border-pink-500/30">
        <Heart size={32} />
      </button>
      <button onClick={() => onAction('watched')} className="w-14 h-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500/20 transition-colors border border-green-500/30">
        <Eye size={24} />
      </button>
    </div>
  );
}

export default function SceneIt() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipedMovies, setSwipedMovies] = useState<SwipedMovie[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  /**
   * Fetches a new batch of movies via the Server Action and adds them
   * to the local stack. Each movie gets a client-side ID and gradient
   * since those are purely presentational.
   */
  const fetchMoreMovies = async (exclude: string[]): Promise<void> => {
    setIsFetching(true);
    try {
      const rawMovies = await fetchMovies(exclude);
      const newMovies: Movie[] = rawMovies.map((m) => ({
        ...m,
        id: crypto.randomUUID(),
        gradient: getRandomGradient(),
      }));
      setMovies((prev) => [...prev, ...newMovies]);
    } catch (error) {
      console.error('[SceneIt] Failed to fetch movies:', error);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchMoreMovies([]);
  }, []);

  useEffect(() => {
    if (movies.length > 0 && currentIndex >= movies.length - 5 && !isFetching) {
      fetchMoreMovies(movies.map(m => m.title));
    }
  }, [currentIndex, movies.length, isFetching]);

  const handleSwipe = (action: SwipeAction, movie: Movie) => {
    setSwipedMovies(prev => [...prev, { ...movie, action }]);
    setCurrentIndex(prev => prev + 1);
  };

  /**
   * Requests a personalized movie recommendation via the Server Action.
   * Sends the full swipe history so the AI can analyze preferences.
   */
  const getRecommendation = async (forceSwipedMovies?: SwipedMovie[]): Promise<void> => {
    const payload = forceSwipedMovies || swipedMovies;
    setIsRecommending(true);
    setLoadingMessageIndex(0);
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    try {
      const result = await getMovieRecommendation(payload);
      if (result) {
        setRecommendation(result);
      }
    } catch (error) {
      console.error('[SceneIt] Failed to get recommendation:', error);
    } finally {
      clearInterval(interval);
      setIsRecommending(false);
    }
  };

  const handleAlreadySeen = async (): Promise<void> => {
    if (!recommendation) return;
    
    // Convert recommendation to a generic movie payload to feed into swiped list
    const fakeMovie: Movie = {
      id: crypto.randomUUID(),
      title: recommendation.title,
      year: recommendation.year,
      director: recommendation.director,
      genre: recommendation.genre,
      synopsis: recommendation.synopsis,
      gradient: getRandomGradient(),
    };
    
    const newSwipedMovies = [...swipedMovies, { ...fakeMovie, action: 'watched' as SwipeAction }];
    setSwipedMovies(newSwipedMovies);
    setRecommendation(null);
    getRecommendation(newSwipedMovies);
  };

  if (isRecommending && !recommendation) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="relative mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="text-pink-500"
            >
              <Film size={64} />
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-white/50"
              />
            </div>
          </div>
          <h2 className="text-2xl font-serif font-bold tracking-wide mb-2">Director's Cut</h2>
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingMessageIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-white/60 font-mono text-sm"
            >
              {LOADING_MESSAGES[loadingMessageIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  if (recommendation && !isRecommending) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Full screen blurred background if poster exists */}
        {recommendation.posterUrl && (
          <div 
            className="absolute inset-0 z-0 opacity-20 bg-cover bg-center blur-xl scale-110"
            style={{ backgroundImage: `url(${recommendation.posterUrl})` }}
          />
        )}
        
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm border border-white/10 rounded-3xl overflow-hidden relative z-10 flex flex-col max-h-[85vh] shadow-[0_0_40px_rgba(0,0,0,0.8)]"
        >
          <div className="relative pt-[120%] flex-shrink-0 bg-white/5">
            {recommendation.posterUrl ? (
              <img 
                src={recommendation.posterUrl} 
                alt={recommendation.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Film size={48} className="text-white/20" />
              </div>
            )}
            
            {/* Gradient to smooth transition to text area */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/70 to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-6 pb-2 text-center pointer-events-none">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-pink-500/20 text-pink-500 mb-3 mx-auto backdrop-blur-sm">
                <Sparkles size={20} />
              </div>
              <h2 className="text-3xl font-serif font-bold mb-1 leading-tight drop-shadow-md">{recommendation.title}</h2>
              <div className="flex items-center justify-center gap-3 text-white/70 text-sm font-mono drop-shadow-md">
                <span>{recommendation.year}</span>
                <span>•</span>
                <span>{recommendation.genre}</span>
              </div>
            </div>
          </div>

          {/* Scrollable text content */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0a] space-y-6 scrollbar-hide">
            <div>
              <h3 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-2">Synopsis</h3>
              <p className="text-white/80 leading-relaxed text-sm">{recommendation.synopsis}</p>
            </div>
            <div>
              <h3 className="text-[10px] font-bold tracking-widest text-pink-400/60 uppercase mb-2">Why you'll love it</h3>
              <p className="text-pink-100/90 leading-relaxed text-sm italic">{recommendation.reason}</p>
            </div>
            <div className="pt-2 border-t border-white/10">
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono text-center">Dir. {recommendation.director}</p>
            </div>
          </div>

          {/* Buttons pinned to bottom */}
          <div className="p-4 bg-[#0a0a0a] border-t border-white/5 flex gap-3">
            <button
              onClick={handleAlreadySeen}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold tracking-wide hover:bg-white/20 transition-colors text-xs uppercase"
            >
              Already Seen
            </button>
            <button
              onClick={() => setRecommendation(null)}
              className="flex-1 py-3 rounded-xl bg-white text-black font-bold tracking-wide hover:bg-white/90 transition-colors text-xs uppercase"
            >
              Keep Swiping
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const visibleMovies = movies.slice(currentIndex, currentIndex + 3);
  const reversedVisible = [...visibleMovies].reverse();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden font-sans">
      <header className="p-6 flex items-center justify-between z-10">
        <h1 className="text-2xl font-serif font-bold tracking-tight">SceneIt</h1>
        <button
          onClick={() => getRecommendation()}
          disabled={isRecommending || swipedMovies.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isRecommending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          <span>Recommend</span>
        </button>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center p-6">
        <div className="relative w-full max-w-sm aspect-[2/3]">
          {movies.length === 0 && isFetching ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p className="font-mono text-sm">Finding movies...</p>
            </div>
          ) : (
            <AnimatePresence>
              {reversedVisible.map((movie, i) => {
                const isTop = movie.id === visibleMovies[0].id;
                const index = visibleMovies.findIndex(m => m.id === movie.id);
                return (
                  <SwipeCard
                    key={movie.id}
                    movie={movie}
                    index={index}
                    isTop={isTop}
                    onSwipe={handleSwipe}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <Controls onAction={(action) => {
          if (visibleMovies.length > 0) {
            handleSwipe(action, visibleMovies[0]);
          }
        }} />
      </main>

      <div className="p-6 text-center text-white/30 text-xs font-mono z-10 flex flex-col gap-2">
        <div className="flex justify-center gap-4">
          <span>← Unwatched</span>
          <span>→ Watched</span>
        </div>
        <div className="flex justify-center gap-4">
          <span>↑ Loved</span>
          <span>↓ Disliked</span>
        </div>
      </div>
    </div>
  );
}
