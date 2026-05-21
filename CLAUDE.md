# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

Chapter is a dating app that matches users based on shared book and reading preferences (genres, favorite books). The MVP covers auth, onboarding, swipe-based discovery, and chat.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # tsc + vite build (output → dist/)
npm run lint         # ESLint
npx cap sync         # Copy dist/ to native iOS/Android projects
npx cap run ios      # Build and run on iOS simulator/device
npx cap run android  # Build and run on Android
```

> `react-tinder-card` has a peer dep conflict with React 19. Always use `npm install --legacy-peer-deps` when adding packages.

## Architecture

**Frontend:** React 19 + TypeScript + Vite. Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js` — configured entirely in `vite.config.ts`).

**Mobile:** Capacitor wraps the Vite web build. `capacitor.config.ts` points `webDir` at `dist/`. After any build, run `npx cap sync` before opening native IDEs.

**Backend:** Supabase (project `mpzgtfnmhwthzwnnegpt`, region `eu-west-1`). Provides Postgres, Auth, Storage (profile photos), and Realtime (chat). Client is in `src/lib/supabase.ts`, credentials in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

**State:** Zustand stores in `src/store/`.

**Book search:** Open Library API — free, no key. Wrapper lives in `src/lib/openLibrary.ts` (to be created).

## Database schema (live on Supabase)

All tables have RLS enabled. Key tables:

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`. Has `name`, `birth_date`, `photos text[]`, `gender`, `looking_for text[]`, `onboarding_complete` |
| `genres` | Lookup table, seeded with 20 genres. Public read. |
| `user_genres` | User ↔ genre join table |
| `books` | Cached from Open Library. `id` is uuid, `open_library_id` is unique. |
| `user_books` | User ↔ book with `shelf` enum (`reading`, `read`, `want_to_read`, `favorite`) and optional `rating` |
| `swipes` | `swiper_id`, `swiped_id`, `direction` (`like`\|`pass`). Unique on `(swiper_id, swiped_id)`. |
| `matches` | Created automatically by trigger `on_mutual_like` when two users both `like` each other. |
| `messages` | `match_id`, `sender_id`, `content`. Realtime subscription for chat. |

**Matching RPC:** `get_candidates(user_id uuid)` — returns profiles not yet swiped, filtered by gender prefs, scored by `(shared books × 3) + (shared genres × 1)`. Call via `supabase.rpc('get_candidates', { user_id })`.

## Implementation status

- **Phase 1 (Setup):** Complete — scaffold, deps, Capacitor, Supabase connected, DB migrated.
- **Phase 2 (Auth):** Complete — Supabase email/password, auth guard (`src/components/AuthGuard.tsx`), session persistence via Zustand (`src/store/auth.ts`). Login at `src/pages/Login.tsx`, register at `src/pages/Register.tsx`.
- **Phase 3 (Onboarding):** Complete — 4-step flow in `src/pages/onboarding/`: StepPhotos (upload to `photos` Storage bucket), StepInfo (name/dob/gender/looking_for), StepGenres (min 3), StepBooks (Open Library search, min 1). Profile store in `src/store/profile.ts`. AuthGuard redirects to `/onboarding` when `onboarding_complete = false`.
- **Phase 4 (Discover):** Not started — swipe stack via `get_candidates()` RPC + `react-tinder-card`.
- **Phase 5 (Matches + Chat):** Not started — match list, Realtime chat.

## Planned page structure

```
src/pages/
  onboarding/   StepPhotos, StepInfo, StepGenres, StepBooks
  Discover.tsx  Swipe screen
  Matches.tsx   Match list with last-message preview
  Chat.tsx      Conversation with Realtime subscription
  Profile.tsx   Own profile / settings
src/components/ Shared UI (SwipeCard, BookSearch, …)
src/store/      Zustand stores (auth, profile, discover, chat)
src/lib/
  supabase.ts       Supabase client (exists)
  openLibrary.ts    Open Library search wrapper (to create)
```
