# Filmmoo

Filmmoo is a Tinder-style movie recommendation app. Users swipe on movie posters to indicate watch history and preferences. Based on these interactions, the app uses AI to generate highly personalized movie recommendations. Authentication and persistence are powered by Supabase.

## 🌟 Features

- **Swipe Interface:** Swipe left (Unwatched), right (Watched), up (Loved), or down (Disliked) on movie cards.
- **AI-Powered Recommendations:** Get a single, highly personalized movie recommendation powered by the Gemini AI SDK, including a specific "Why you'll love it" reason.
- **Infinite Scrolling/Swiping:** Continuously fetches new batches of movies using AI, ensuring you never run out of cards to swipe.
- **Authenticated Experience:** Login/signup (email/password + Google OAuth) to persist swipe history and watchlists.

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **AI Integration:** `@google/genai` (Gemini SDK)
- **Icons:** Lucide React

## 🚀 Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` or `.env.local` file and add the required environment variables:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   APP_URL="http://localhost:3000"
   TMDB_API_KEY="your_tmdb_api_key_here"
   NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
   SUPABASE_SECRET_KEY="sb_secret_..."
   ```
3. Run Supabase migrations:
   ```bash
   npx supabase db push
   ```
4. Run the app:
   ```bash
   npm run dev
   ```
