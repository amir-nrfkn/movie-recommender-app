/**
 * Filmmoo — Main swipe interface page.
 *
 * Thin client orchestrator for swipe state, recommendation flow, and watchlist state.
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Film } from 'lucide-react';
import { fetchMovies, getMovieRecommendation, saveSwipe } from '@/actions/movies';
import { isMovieInWatchlist, setWatchlistItem } from '@/actions/watchlist';
import { ErrorBanner } from '@/components/error-banner';
import { RecommendationView } from '@/components/recommendation-view';
import { SwipeCard } from '@/components/swipe-card';
import { SwipeControls } from '@/components/swipe-controls';
import type { Movie, SwipeAction, SwipedMovie, Recommendation } from '@/types/movie';

const LOADING_MESSAGES = [
  'Popping the popcorn...',
  'Waking up the projectionist...',
  'Splicing film reels...',
  'Dimming the lights...',
  'Finding the perfect seat...',
  'Rolling the credits...',
  'Shushing the people in the back row...',
  'Sweeping up the virtual spilled popcorn...',
  'Silencing all cell phones...',
  'Checking the floor for sticky spots...',
  'Buying a $14 small soda...',
  'Scrolling past the 20 minutes of trailers...',
  'Developing the negatives...',
  'Color grading the highlights...',
  'Syncing the foley tracks...',
  'Waiting for the Director’s Cut...',
  'Rendering the CGI explosions...',
  'Casting the lead roles...',
  'Consulting the Rotten Tomatoes...',
  'Polishing the Academy Awards...',
  'Bribing the critics for a 5-star review...',
  'Analyzing your cinematic DNA...',
  'Debating the ending of Inception...',
  'Practicing our Oscar acceptance speech...',
  'Cueing the jump scare...',
  'Fueling up the getaway car...',
  'Enhancing the security footage...',
  'Loading the dramatic plot twist...',
  'Training the montage sequence...',
  'Locking the basement door...',
  'Waiting for the rain to start for the big kiss...',
  'Coming up with cheesy dialogue...',
  'Doing reshoots...',
  'Editing the trailer...',
  'Adding the final credits...',
  'Adding post credit scenes...',
  'Deciding when to launch on streaming...',
  'Spending too much on marketing...',
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

export default function Filmmoo() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipedMovies, setSwipedMovies] = useState<SwipedMovie[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);

  const watchlistTimerRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnimating = useRef(false);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 5000);
  }, []);

  const fetchMoreMovies = useCallback(async (excludeTmdbIds: number[]) => {
    setIsFetching(true);
    try {
      const rawMovies = await fetchMovies(excludeTmdbIds);
      const newMovies: Movie[] = rawMovies.map((movie) => ({
        ...movie,
        cardId:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15),
        gradient: getRandomGradient(),
      }));
      setMovies((prev) => [...prev, ...newMovies]);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load movies. Please try again.');
    } finally {
      setIsFetching(false);
    }
  }, [showError]);

  useEffect(() => {
    void fetchMoreMovies([]);
  }, [fetchMoreMovies]);

  useEffect(() => {
    if (movies.length > 0 && currentIndex >= movies.length - 5 && !isFetching) {
      const visibleTmdbIds = movies.slice(currentIndex, currentIndex + 5).map((movie) => movie.tmdbId);
      void fetchMoreMovies(visibleTmdbIds);
    }
  }, [currentIndex, movies, isFetching, fetchMoreMovies]);

  useEffect(() => {
    isAnimating.current = false;
  }, [currentIndex]);

  useEffect(() => {
    let isMounted = true;

    async function syncWatchlistState() {
      if (!recommendation?.tmdbId || recommendation.tmdbId <= 0) {
        if (isMounted) setIsInWatchlist(false);
        return;
      }

      try {
        const inWatchlist = await isMovieInWatchlist(recommendation.tmdbId);
        if (isMounted) setIsInWatchlist(inWatchlist);
      } catch {
        if (isMounted) setIsInWatchlist(false);
      }
    }

    void syncWatchlistState();
    return () => {
      isMounted = false;
    };
  }, [recommendation?.tmdbId]);

  useEffect(() => () => {
    if (watchlistTimerRef.current) clearTimeout(watchlistTimerRef.current);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }, []);

  const persistSwipe = useCallback((movie: Movie, action: SwipeAction) => {
    void saveSwipe(
      {
        tmdbId: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        director: movie.director,
        genre: movie.genre,
        posterUrl: movie.posterUrl,
      },
      action
    );
  }, []);

  const handleSwipe = useCallback((action: SwipeAction, movie: Movie) => {
    persistSwipe(movie, action);
    setSwipedMovies((prev) => [...prev, { ...movie, action }]);
    setCurrentIndex((prev) => prev + 1);
  }, [persistSwipe]);

  const handleUndo = useCallback(() => {
    if (currentIndex <= 0) return;
    setCurrentIndex((prev) => prev - 1);
    setSwipedMovies((prev) => prev.slice(0, -1));
  }, [currentIndex]);

  const requestRecommendation = useCallback(async (payloadOverride?: SwipedMovie[]) => {
    const payload = payloadOverride ?? swipedMovies;

    if (payload.length > 0 && !payload.some((movie) => movie.action !== 'unwatched')) {
      showError('Please rate at least one movie (Watched, Loved, or Disliked) to get a recommendation.');
      return;
    }

    setIsRecommending(true);
    setLoadingMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => {
        let next = Math.floor(Math.random() * LOADING_MESSAGES.length);
        while (next === prev) next = Math.floor(Math.random() * LOADING_MESSAGES.length);
        return next;
      });
    }, 2000);

    try {
      const result = await getMovieRecommendation(payload);
      if (result) setRecommendation(result);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to get recommendation. Please try again.');
    } finally {
      clearInterval(interval);
      setIsRecommending(false);
    }
  }, [showError, swipedMovies]);

  const handleAlreadySeen = useCallback(async (action: SwipeAction) => {
    if (!recommendation) return;

    const movie: Movie = {
      cardId:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15),
      tmdbId: recommendation.tmdbId ?? 0,
      title: recommendation.title,
      year: recommendation.year,
      director: recommendation.director,
      genre: recommendation.genre,
      synopsis: recommendation.synopsis,
      gradient: getRandomGradient(),
      posterUrl: recommendation.posterUrl,
    };

    persistSwipe(movie, action);

    const nextSwiped = [...swipedMovies, { ...movie, action }];
    setSwipedMovies(nextSwiped);
    setIsRecommending(true);
    setRecommendation(null);
    setIsInWatchlist(false);
    setWatchlistMessage(null);

    await requestRecommendation(nextSwiped);
  }, [persistSwipe, recommendation, requestRecommendation, swipedMovies]);

  const handleToggleWatchlist = useCallback(async () => {
    if (!recommendation) return;
    if (!recommendation.tmdbId || recommendation.tmdbId <= 0) {
      showError('Could not save this recommendation because TMDB metadata is missing.');
      return;
    }

    const adding = !isInWatchlist;
    setIsInWatchlist(adding);
    setWatchlistMessage(adding ? `${recommendation.title} added to your watchlist` : 'Removed from watchlist');

    if (watchlistTimerRef.current) clearTimeout(watchlistTimerRef.current);
    watchlistTimerRef.current = setTimeout(() => setWatchlistMessage(null), 2000);

    try {
      const actualState = await setWatchlistItem(
        {
          tmdbId: recommendation.tmdbId,
          title: recommendation.title,
          year: recommendation.year,
          posterUrl: recommendation.posterUrl,
        },
        adding
      );
      setIsInWatchlist(actualState);
    } catch (error) {
      setIsInWatchlist(!adding);
      showError(error instanceof Error ? error.message : 'Failed to update watchlist.');
    }
  }, [isInWatchlist, recommendation, showError]);

  if (isRecommending && !recommendation) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center">
        <ErrorBanner message={errorMessage} />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="relative mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
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
          <h2 className="text-2xl font-serif font-bold tracking-wide mb-2">Director&apos;s Cut</h2>
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
      <>
        <ErrorBanner message={errorMessage} />
        <RecommendationView
          recommendation={recommendation}
          errorMessage={errorMessage}
          isInWatchlist={isInWatchlist}
          watchlistMessage={watchlistMessage}
          onToggleWatchlist={handleToggleWatchlist}
          onAlreadySeen={(action) => void handleAlreadySeen(action)}
          onKeepSwiping={() => setRecommendation(null)}
        />
      </>
    );
  }

  const visibleMovies = movies.slice(currentIndex, currentIndex + 3);
  const reversedVisible = [...visibleMovies].reverse();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden font-sans">
      <ErrorBanner message={errorMessage} />
      <header className="p-6 flex items-center justify-between z-10">
        <h1 className="text-2xl font-serif font-bold tracking-tight">Filmmoo</h1>
        <button
          onClick={() => void requestRecommendation()}
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
              {reversedVisible.map((movie) => {
                const isTop = movie.cardId === visibleMovies[0].cardId;
                const index = visibleMovies.findIndex((candidate) => candidate.cardId === movie.cardId);
                return (
                  <SwipeCard
                    key={movie.cardId}
                    movie={movie}
                    index={index}
                    isTop={isTop}
                    onSwipeStart={() => {
                      isAnimating.current = true;
                    }}
                    onSwipe={handleSwipe}
                    onUndo={handleUndo}
                    canUndo={currentIndex > 0}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <SwipeControls
          onAction={(action) => {
            if (isAnimating.current) return;
            if (visibleMovies.length === 0) return;
            isAnimating.current = true;
            handleSwipe(action, visibleMovies[0]);
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
