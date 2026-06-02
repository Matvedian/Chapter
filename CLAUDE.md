# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

Chapter is a dating app that matches users based on shared book and reading preferences (genres, favourite books). The MVP covers auth, onboarding, swipe-based discovery, matches list, real-time chat, and profile.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # tsc + vite build (output → dist/)
npm run lint         # ESLint
npx cap sync         # Copy dist/ to native iOS/Android projects
npx cap run ios      # Build and run on iOS simulator/device
npx cap run android  # Build and run on Android
```

> Always use `npm install --legacy-peer-deps` when adding packages — `react-tinder-card` has a peer dep conflict with React 19.

## Architecture

**Frontend:** React 19 + TypeScript + Vite. Tailwind CSS v4 via `@tailwindcss/vite` plugin — configured entirely in `vite.config.ts`, no `tailwind.config.js`.

**Mobile:** Capacitor wraps the Vite web build. `capacitor.config.ts` points `webDir` at `dist/`. Run `npx cap sync` after every build before opening native IDEs.

**Backend:** Supabase (project `mpzgtfnmhwthzwnnegpt`, region `eu-west-1`). Provides Postgres, Auth, Storage (profile photos in `photos` bucket), and Realtime (chat). Client: `src/lib/supabase.ts`, credentials in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

**State:** Zustand stores in `src/store/` — `auth.ts` (session/user), `profile.ts` (own profile), `notifications.ts` (toast queue + unread badge count).

**Book search:** Open Library API — free, no key. Wrapper in `src/lib/openLibrary.ts` exports `searchBooks(query)` and `coverUrl(coverId, size)`.

## Database schema (live on Supabase)

All tables have RLS enabled.

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`. Columns: `name`, `birth_date`, `photos text[]`, `gender`, `looking_for text[]`, `onboarding_complete` |
| `genres` | Lookup table, 20 genres, public read |
| `user_genres` | User ↔ genre join table |
| `books` | Cached from Open Library. `open_library_id` is unique. |
| `user_books` | User ↔ book with `shelf` enum (`reading`, `read`, `want_to_read`, `favorite`) and optional `rating` |
| `swipes` | `swiper_id`, `swiped_id`, `direction` (`like`\|`pass`). Unique on `(swiper_id, swiped_id)`. |
| `matches` | Auto-created by trigger `on_mutual_like` on mutual like. |
| `messages` | `match_id`, `sender_id`, `content`. Used for Realtime chat. |

**Matching RPC:** `get_candidates(p_user_id uuid)` — returns `TABLE(profile_id uuid, score integer)`. Score = `(shared_books × 3) + (shared_genres × 1)`. Call via:
```ts
supabase.rpc('get_candidates', { p_user_id: user.id })
```

## Key non-obvious patterns

**Auth → Profile loading chain:** `AuthGuard` fetches the profile only after the auth session resolves. The spinner condition is `authLoading || (session && profileLoading)`. If the profile fetch fails (profile stays null), AuthGuard still renders children — this is acceptable for MVP.

**`profileStore.clear()` sets `loading: true`** (not false). This prevents a flash where session=true but profile=null and loading=false causes AuthGuard to skip the spinner on logout/re-login.

**Onboarding books upsert:** The `books` table needs an UPDATE RLS policy to allow upsert on conflict (`open_library_id`). This migration was applied as `books_rls_update_policy`.

**Swipe double-fire guard:** `Discover.tsx` uses a `swiping` ref (set true in `triggerSwipe`, reset in `handleCardLeft`) to prevent double swipes from button presses during animation. `onCardLeftScreen` is guarded to only fire for the top card.

**Chat message dedup:** The Realtime subscription and the initial load can race. Messages are merged by ID using a `Map` in `setMessages` to avoid duplicates or lost messages.

## Implementation status

- **Phase 1:** Complete — scaffold, deps, Capacitor, Supabase connected, DB migrated.
- **Phase 2:** Complete — Supabase email/password auth, `AuthGuard`, Zustand session persistence.
- **Phase 3:** Complete — 4-step onboarding (`src/pages/onboarding/`): Info (name/dob/gender/looking_for), Photos upload, Genres (min 3), Books via Open Library (min 1). Under-18 users are blocked at the Info step with an error message.
- **Phase 4:** Complete — `Discover.tsx` swipe stack with `react-tinder-card`, swipes recorded, mutual match detection + modal.
- **Phase 5:** Complete — `Matches.tsx` (last-message preview, unread dot, sorted by activity), `Chat.tsx` (Realtime, auto-scroll, send on Enter), `Profile.tsx` (own profile + sign out), `BottomNav` across Discover/Matches/Profile.
- **Phase 6:** Complete — profile editing (`ProfileEdit.tsx`): photos, info, genres, books all editable post-onboarding.
- **Notifications:** Complete — `NotificationListener` (global Realtime subscriber for new matches/messages), `ToastBanner` (slide-in toast, 4s auto-dismiss, tappable to chat), `BottomNav` unread badge. Toasts suppressed when already in target chat; match toasts suppressed on Discover (has its own modal).
- **Discover filters:** Complete — filter sheet (age range sliders + gender toggles) with draft/apply pattern. Candidates fetched once, filtered client-side. Active filter dot on header icon; empty state with reset shortcut.
- **Genres:** "Children's" replaced with "Erotica" directly in the `genres` table (id 15). 20 genres total.
- **Capacitor/iOS:** `base: './'` added to `vite.config.ts` for correct asset paths. `@react-spring/web` installed (peer dep of `react-tinder-card`).
