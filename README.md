<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SceneIt

SceneIt is a frictionless, Tinder-style movie recommendation app. Users swipe on movie posters to indicate their watch history and preferences. Based on these interactions, the app uses AI to generate highly personalized movie recommendations. No account creation is required to get a recommendation, allowing users to jump straight into the experience.

View your app in AI Studio: https://ai.studio/apps/71215400-5a36-4f29-81c2-be207e812f33

## 🌟 Features

- **Swipe Interface:** Swipe left (Unwatched), right (Watched), up (Loved), or down (Disliked) on movie cards.
- **AI-Powered Recommendations:** Get a single, highly personalized movie recommendation powered by the Gemini AI SDK, including a specific "Why you'll love it" reason.
- **Infinite Scrolling/Swiping:** Continuously fetches new batches of movies using AI, ensuring you never run out of cards to swipe.
- **Frictionless Onboarding:** Jump right in! No login, signup, or account creation is required to start getting recommendations.

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
   ```
3. Run the app:
   ```bash
   npm run dev
   ```
