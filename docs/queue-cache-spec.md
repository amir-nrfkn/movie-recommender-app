# Filmmoo swipe queue + TMDB cache spec

## Goal
Make swipe cards reliably available while reducing duplicate cards, duplicate history rows, and repeated TMDB detail fetches.

## Chosen architecture
1. `movies_cache`: shared TMDB metadata cache
2. `user_movie_queue`: per-user ready-to-swipe queue
3. `swipe_states`: authoritative duplicate guard for rated movies

## Why this architecture
- Reliability: serve cards from DB-backed queue instead of live assembly at render time
- API efficiency: cache TMDB detail metadata and only fetch uncached/stale movies
- Product correctness: prevent duplicate cards and duplicate ratings
- Implementability: incremental migration from current live-fetch path to queue-backed delivery

## Data model

### movies_cache
One row per TMDB movie.

Fields:
- `tmdb_movie_id` unique
- `title`
- `year`
- `director`
- `genre`
- `synopsis`
- `poster_url`
- `top_actors` text[] (top 1-3 billed actors for future features)
- `release_date`
- `popularity`
- `vote_average`
- `vote_count`
- `original_language`
- `source_tier`
- `cached_at`
- `updated_at`

### user_movie_queue
Per-user queue of unseen swipe cards.

Fields:
- `id`
- `user_id`
- `tmdb_movie_id`
- `queue_rank`
- `source_tier`
- `created_at`
- `consumed_at`
- `discarded_at`

Rules:
- active queue rows are those where `consumed_at` and `discarded_at` are null
- unique active queue entry per `(user_id, tmdb_movie_id)`

## Sourcing strategy
Tiered discovery from TMDB:
1. mainstream: popularity-desc, high vote count, recent-ish
2. broader mainstream: lower vote-count threshold, more pages
3. niche fallback: lower popularity and wider year range

## Duplicate prevention
### At queue creation time
Exclude movies already present in:
- `swipe_states`
- active `user_movie_queue`
- optional in-memory visible IDs from current request

### At swipe save time
If `(user_id, tmdb_movie_id)` already exists in `swipe_states`, silently no-op.
The card can still animate away client-side, but no duplicate DB history should be created.

## Queue lifecycle
### On initial load
- try to read next 20 queued cards
- if queue below low watermark, trigger refill

### Refill behavior
- target queue size: 60
- low watermark: 15
- max cards returned per request: 20
- refill should cache metadata first, then enqueue

## Implementation phases
1. schema + RPC updates
2. cache helpers + TMDB hydration helpers
3. queue refill + queue delivery actions
4. switch swipe deck to queue-backed delivery
5. remove old direct live deck path after validation
