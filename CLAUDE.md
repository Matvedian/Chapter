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
| `profiles` | Extends `auth.users`. Columns: `name`, `birth_date`, `photos text[]`, `gender`, `looking_for text[]`, `onboarding_complete`, `bio text`, `push_token text` |
| `genres` | Lookup table, 20 genres, public read |
| `user_genres` | User ↔ genre join table |
| `books` | Cached from Open Library. `open_library_id` is unique. |
| `user_books` | User ↔ book with `shelf` enum (`reading`, `read`, `want_to_read`, `favorite`) and optional `rating` |
| `swipes` | `swiper_id`, `swiped_id`, `direction` (`like`\|`pass`). Unique on `(swiper_id, swiped_id)`. |
| `matches` | Auto-created by trigger `on_mutual_like` on mutual like. |
| `messages` | `match_id`, `sender_id`, `content`. Used for Realtime chat. |
| `blocks` | `blocker_id`, `blocked_id`. Unique on `(blocker_id, blocked_id)`. RLS: blocker can insert/delete/read own rows. |
| `reports` | `reporter_id`, `reported_id`, `reason text`. RLS: reporter can insert only. |

**Matching RPC:** `get_candidates(p_user_id uuid)` — returns `TABLE(profile_id uuid, score integer)`. Score = `(shared_books × 3) + (shared_genres × 1)`. Excludes: users already swiped liked on, passes < 30 days old, and blocked users (both directions). Call via:
```ts
supabase.rpc('get_candidates', { p_user_id: user.id })
```

## Key non-obvious patterns

**Auth → Profile loading chain:** `AuthGuard` fetches the profile only after the auth session resolves. The spinner condition is `authLoading || (session && profileLoading)`. If the profile fetch fails (profile stays null), AuthGuard still renders children — this is acceptable for MVP.

**`profileStore.clear()` sets `loading: true`** (not false). This prevents a flash where session=true but profile=null and loading=false causes AuthGuard to skip the spinner on logout/re-login.

**Onboarding books upsert:** The `books` table needs an UPDATE RLS policy to allow upsert on conflict (`open_library_id`). This migration was applied as `books_rls_update_policy`.

**Swipe double-fire guard:** `Discover.tsx` uses a `swiping` ref (set true in `triggerSwipe`, reset in `handleCardLeft`) to prevent double swipes from button presses during animation. `onCardLeftScreen` is guarded to only fire for the top card.

**Chat message dedup:** The Realtime subscription and the initial load can race. Messages are merged by ID using a `Map` in `setMessages` to avoid duplicates or lost messages.

**Chat `loadInitial` parallelism:** Match and messages are fetched in parallel via `Promise.all`. The profile fetch fires after (needs `otherId` from match) but does not block the loading state — it resolves asynchronously and updates the header.

**Typing indicator channel:** The chat Realtime channel is stored in `channelRef` so `track()` can be called from the textarea `onChange` handler outside the `useEffect`. The `typingTimeout` ref debounces the clear. Presence is keyed by `user.id` so self-presence is filtered out in the sync handler.

**Block parallelism:** `blocks.insert` and `matches.delete` in `block()` run via `Promise.all` — they're independent. Both errors are checked before navigating.

## Implementation status

- **Phase 1:** Complete — scaffold, deps, Capacitor, Supabase connected, DB migrated.
- **Phase 2:** Complete — Supabase email/password auth, `AuthGuard`, Zustand session persistence.
- **Phase 3:** Complete — 4-step onboarding (`src/pages/onboarding/`): Info (name/dob/gender/looking_for), Photos upload, Genres (min 3, skippable), Books via Open Library (min 1, skippable). Under-18 users are blocked at the Info step with an error message.
- **Phase 4:** Complete — `Discover.tsx` swipe stack with `react-tinder-card`, swipes recorded, mutual match detection + modal.
- **Phase 5:** Complete — `Matches.tsx` (last-message preview, unread dot, sorted by activity), `Chat.tsx` (Realtime, auto-scroll, send on Enter), `Profile.tsx` (own profile + sign out), `BottomNav` across Discover/Matches/Profile.
- **Phase 6:** Complete — profile editing (`ProfileEdit.tsx`): photos, info, genres, books all editable post-onboarding.
- **Notifications:** Complete — `NotificationListener` (global Realtime subscriber for new matches/messages), `ToastBanner` (slide-in toast, 4s auto-dismiss, tappable to chat), `BottomNav` unread badge. Toasts suppressed when already in target chat; match toasts suppressed on Discover (has its own modal).
- **Discover filters:** Complete — filter sheet (dual-thumb age range slider + gender toggles) with draft/apply pattern. Candidates fetched once, filtered client-side. Active filter dot on header icon; empty state with reset shortcut.
- **Polish pass:** Complete — haptic feedback on swipe (light=pass, medium=like, success=match); skeleton loaders on Discover (full card layout) and Matches (shimmer rows); photo shimmer on swipe cards; Matches list updates in real-time via Realtime subscription; Chat uses `h-dvh` so input stays above iOS keyboard; iOS safe areas applied to all headers and BottomNav.
- **Genres:** "Children's" replaced with "Erotica" directly in the `genres` table (id 15). 20 genres total.
- **Phase 7:** Complete — multiple photos on swipe cards (dot indicators + tap left/right edge to navigate); full profile modal (tap ℹ button → photo carousel, bio, genres, favourite books fetched lazily); bio/about-me field in onboarding, profile edit, and own profile page; unmatch in Chat (three-dot menu → confirmation modal → DELETE match → back to /matches).
- **Capacitor/iOS:** `base: './'` added to `vite.config.ts` for correct asset paths. `@react-spring/web` installed (peer dep of `react-tinder-card`).
- **Re-surface passed candidates:** `get_candidates` excludes pass swipes older than 30 days so profiles re-enter the deck. Likes are always excluded.
- **Report / block:** `blocks` and `reports` tables with RLS. Chat three-dot menu has Report (reason picker → insert into reports) and Block (parallel insert+delete → /matches). `get_candidates` excludes blocked users in both directions.
- **Typing indicator:** Supabase Realtime presence on the chat channel (keyed by `user.id`). `channelRef` holds the channel for `track()` calls. Typing clears after 1.5s debounce or on send. Three-dot bounce bubble shown when partner is typing.
- **Offline / error handling:** `useNetworkStatus` hook (`navigator.onLine` + window events). `OfflineBanner` component — 3-state (hidden/offline/reconnected), auto-hides 2s after reconnect, respects `safe-area-inset-top`. Discover and Matches show `fetchError` state with retry button on Supabase errors. Chat shows `loadError` state on messages fetch failure.
- **Push notifications (partial):** `@capacitor/push-notifications` installed. `push_token text` column on `profiles`. Frontend token registration and Edge Function not yet implemented — pending APNs key.
