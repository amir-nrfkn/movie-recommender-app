/**
 * Filmmoo — Main swipe interface page.
 *
 * This is a Client Component because it handles interactive gestures (drag/swipe),
 * animation state, and user input. All AI calls are delegated to Server Actions
 * in actions/movies.ts so the Gemini API key never reaches the browser.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, useMotionValueEvent, AnimatePresence } from 'motion/react';
import { EyeOff, Eye, Heart, ThumbsDown, Sparkles, Loader2, Film, RotateCcw } from 'lucide-react';
import { fetchMovies, getMovieRecommendation } from '@/actions/movies';
import type { Movie, SwipeAction, SwipedMovie, Recommendation } from '@/types/movie';

const LOADING_MESSAGES = [
  // The Classics
  "Popping the popcorn...",
  "Waking up the projectionist...",
  "Splicing film reels...",
  "Dimming the lights...",
  "Finding the perfect seat...",
  "Rolling the credits...",

  // The Theater Experience
  "Shushing the people in the back row...",
  "Sweeping up the virtual spilled popcorn...",
  "Silencing all cell phones...",
  "Checking the floor for sticky spots...",
  "Buying a $14 small soda...",
  "Scrolling past the 20 minutes of trailers...",

  // The Production Room
  "Developing the negatives...",
  "Color grading the highlights...",
  "Syncing the foley tracks...",
  "Waiting for the Director’s Cut...",
  "Rendering the CGI explosions...",
  "Casting the lead roles...",

  // The Cinephile
  "Consulting the Rotten Tomatoes...",
  "Polishing the Academy Awards...",
  "Bribing the critics for a 5-star review...",
  "Analyzing your cinematic DNA...",
  "Debating the ending of Inception...",
  "Practicing our Oscar acceptance speech...",

  // The Genre Beats
  "Cueing the jump scare...",
  "Fueling up the getaway car...",
  "Enhancing the security footage...",
  "Loading the dramatic plot twist...",
  "Training the montage sequence...",
  "Locking the basement door...",
  "Waiting for the rain to start for the big kiss..."
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

function SwipeCard({ movie, onSwipe, isTop, index, onUndo, canUndo }: { movie: Movie, onSwipe: (action: SwipeAction, movie: Movie) => void, isTop: boolean, index: number, onUndo: () => void, canUndo: boolean }) {
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
      className="absolute w-full h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/10 origin-bottom"
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
      {/* Draggable hit area covering the entire card */}
      <div className="absolute inset-0 cursor-grab active:cursor-grabbing z-10" />

      {/* Undo Button */}
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

export default function Filmmoo() {
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
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        gradient: getRandomGradient(),
      }));
      setMovies((prev) => [...prev, ...newMovies]);
    } catch (error) {
      console.error('[Filmmoo] Failed to fetch movies:', error);
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

  const handleUndo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setSwipedMovies(prev => prev.slice(0, -1));
    }
  };

  /**
   * Requests a personalized movie recommendation via the Server Action.
   * Sends the full swipe history so the AI can analyze preferences.
   */
  const getRecommendation = async (forceSwipedMovies?: SwipedMovie[]): Promise<void> => {
    const payload = forceSwipedMovies || swipedMovies;
    setIsRecommending(true);
    setLoadingMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => {
        let next = Math.floor(Math.random() * LOADING_MESSAGES.length);
        while (next === prev) {
          next = Math.floor(Math.random() * LOADING_MESSAGES.length);
        }
        return next;
      });
    }, 2000);
    try {
      const result = await getMovieRecommendation(payload);
      if (result) {
        setRecommendation(result);
      }
    } catch (error) {
      console.error('[Filmmoo] Failed to get recommendation:', error);
    } finally {
      clearInterval(interval);
      setIsRecommending(false);
    }
  };

  const handleAlreadySeen = async (action: SwipeAction): Promise<void> => {
    if (!recommendation) return;

    // Convert recommendation to a generic movie payload to feed into swiped list
    const fakeMovie: Movie = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      title: recommendation.title,
      year: recommendation.year,
      director: recommendation.director,
      genre: recommendation.genre,
      synopsis: recommendation.synopsis,
      gradient: getRandomGradient(),
    };

    const newSwipedMovies = [...swipedMovies, { ...fakeMovie, action }];
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
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden">
        {/* Full screen blurred background if poster exists */}
        {recommendation.posterUrl && (
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
            {/* Fixed Poster Background */}
            <div className="absolute inset-0 z-0 bg-white/5">
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
              {/* Fixed Gradient to ensure the bottom text is always readable initially */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />
            </div>

            {/* Scrollable Area */}
            <div className="absolute inset-0 overflow-y-auto scrollbar-hide z-10">
              {/* First part matching swipe card */}
              <div className="h-full flex flex-col justify-end p-8 pb-6 relative z-20 pointer-events-none">
                <div className="pointer-events-auto">
                  <h2 className="text-4xl font-bold text-white mb-2 font-serif leading-tight">{recommendation.title}</h2>
                  <div className="flex items-center gap-3 text-white/80 text-sm mb-4 font-mono">
                    <span className="px-2 py-1 rounded bg-white/20 backdrop-blur-sm">{recommendation.year}</span>
                    <span>•</span>
                    <span>{recommendation.genre}</span>
                  </div>
                  <p className="text-white/90 text-sm leading-relaxed drop-shadow-md">
                    {recommendation.synopsis}
                  </p>
                </div>
              </div>

              {/* "Rest of the text" with black background fading at the top */}
              <div className="bg-[#0a0a0a] p-8 pt-6 relative z-10">
                {/* Fade at the top behind the first part */}
                <div className="absolute bottom-full left-0 right-0 h-72 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none" />

                <h3 className="text-[10px] font-bold tracking-widest text-pink-400/60 uppercase mb-2">Why you'll love it</h3>
                <p className="text-pink-100/90 leading-relaxed text-sm italic mb-6">
                  {recommendation.reason}
                </p>

                <div className="pt-4 border-t border-white/10 pb-2">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Dir. {recommendation.director}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Controls below the card */}
          <div className="mt-8 flex flex-col items-center w-full max-w-sm gap-4 z-10">
            <div className="text-center text-xs text-white/60 font-mono">
              Already seen? Get another recommendation
            </div>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleAlreadySeen('disliked')}
                className="w-14 h-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500/20 transition-colors border border-green-500/30"
              >
                <ThumbsDown size={24} />
              </button>
              <button
                onClick={() => handleAlreadySeen('loved')}
                className="w-14 h-14 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center hover:bg-pink-500/20 transition-colors border border-pink-500/30"
              >
                <Heart size={24} />
              </button>
              <button
                onClick={() => handleAlreadySeen('watched')}
                className="w-14 h-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500/20 transition-colors border border-green-500/30"
              >
                <Eye size={24} />
              </button>
            </div>
            <button
              onClick={() => setRecommendation(null)}
              className="w-full py-4 mt-2 rounded-2xl bg-white text-black font-bold tracking-wide hover:bg-white/90 transition-colors text-sm uppercase"
            >
              Keep Swiping
            </button>
          </div>
        </main>
      </div>
    );
  }

  const visibleMovies = movies.slice(currentIndex, currentIndex + 3);
  const reversedVisible = [...visibleMovies].reverse();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden font-sans">
      <header className="p-6 flex items-center justify-between z-10">
        <h1 className="text-2xl font-serif font-bold tracking-tight">Filmmoo</h1>
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
                    onUndo={handleUndo}
                    canUndo={currentIndex > 0}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <Controls 
          onAction={(action) => {
            if (visibleMovies.length > 0) {
              handleSwipe(action, visibleMovies[0]);
            }
          }} 
        />
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
