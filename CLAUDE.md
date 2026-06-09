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

**Mobile:** Capacitor wraps the Vite web build. `capacitor.config.ts` points `webDir` at `dist/`. Run `npx cap sync` after every build before opening native IDEs. Bundle ID: `com.chapter.app`. For manual simulator installs: `xcrun simctl bootstatus <UDID> -b` to wait for boot, then `xcrun simctl install` + `xcrun simctl launch com.chapter.app`.

**Backend:** Supabase (project `mpzgtfnmhwthzwnnegpt`, region `eu-west-1`). Provides Postgres, Auth, Storage (profile photos in `photos` bucket), and Realtime (chat). Client: `src/lib/supabase.ts`, credentials in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

**State:** Zustand stores in `src/store/` — `auth.ts` (session/user), `profile.ts` (own profile), `notifications.ts` (toast queue + unread badge count).

**Book search:** Google Books API (primary) with Open Library as fallback. Unified wrapper in `src/lib/bookSearch.ts` exports `searchBooks(query)` → `BookResult[]`. `src/lib/googleBooks.ts` hits the Google Books API (requires `VITE_GOOGLE_BOOKS_API_KEY`). `src/lib/openLibrary.ts` is the fallback. `BookResult` shape: `{ source, external_id, title, author, cover_url }`.

## Database schema (live on Supabase)

All tables have RLS enabled.

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`. Columns: `name`, `birth_date`, `photos text[]`, `gender`, `looking_for text[]`, `onboarding_complete`, `bio text`, `push_token text`, `identity_verified boolean` (default false), `stripe_verification_session_id text`, `paused boolean` (default false) |
| `genres` | Lookup table, 20 genres, public read |
| `user_genres` | User ↔ genre join table |
| `books` | Cached from Google Books / Open Library. `(source, external_id)` is unique. `source` defaults to `'open_library'`. |
| `user_books` | User ↔ book with `shelf` enum (`reading`, `read`, `want_to_read`, `favorite`) and optional `rating`. Unique on `(user_id, book_id)`. |
| `swipes` | `swiper_id`, `swiped_id`, `direction` (`like`\|`pass`). Unique on `(swiper_id, swiped_id)`. |
| `matches` | Auto-created by trigger `on_mutual_like` on mutual like. |
| `messages` | `match_id`, `sender_id`, `content`. Used for Realtime chat. |
| `blocks` | `blocker_id`, `blocked_id`. Unique on `(blocker_id, blocked_id)`. RLS: blocker can insert/delete/read own rows. |
| `reports` | `reporter_id`, `reported_id`, `reason text`. RLS: reporter can insert only. |
| `platform_connections` | `user_id`, `platform text`, `access_token text`, `refresh_token text`, `expires_at timestamptz`, `connected_at timestamptz`. Unique on `(user_id, platform)`. RLS: users manage own rows only. |

**Matching RPC:** `get_candidates(p_user_id uuid)` — returns `TABLE(profile_id uuid, score integer)`. Score = `(shared_books × 3) + (shared_genres × 1)`. Excludes: users already swiped liked on, passes < 30 days old, blocked users (both directions), and paused profiles. Call via:
```ts
supabase.rpc('get_candidates', { p_user_id: user.id })
```

## Key non-obvious patterns

**Auth → Profile loading chain:** `AuthGuard` fetches the profile only after the auth session resolves. The spinner condition is `authLoading || (session && profileLoading)`. If the profile fetch fails (profile stays null), AuthGuard still renders children — this is acceptable for MVP.

**`profileStore.clear()` sets `loading: true`** (not false). This prevents a flash where session=true but profile=null and loading=false causes AuthGuard to skip the spinner on logout/re-login.

**Onboarding books upsert:** The `books` table needs an UPDATE RLS policy to allow upsert on conflict. Conflict key is now `(source, external_id)`. The original migration was `books_rls_update_policy`; the schema rename migration is `google_books_source_schema`.

**Swipe double-fire guard:** `Discover.tsx` uses a `swiping` ref (set true in `triggerSwipe`, reset in `handleCardLeft`) to prevent double swipes from button presses during animation. `onCardLeftScreen` is guarded to only fire for the top card.

**Chat message dedup:** The Realtime subscription and the initial load can race. Messages are merged by ID using a `Map` in `setMessages` to avoid duplicates or lost messages.

**Chat `loadInitial` parallelism:** Match and messages are fetched in parallel via `Promise.all`. The profile fetch fires after (needs `otherId` from match) but does not block the loading state — it resolves asynchronously and updates the header.

**Typing indicator channel:** The chat Realtime channel is stored in `channelRef` so `track()` can be called from the textarea `onChange` handler outside the `useEffect`. The `typingTimeout` ref debounces the clear. Presence is keyed by `user.id` so self-presence is filtered out in the sync handler.

**Block parallelism:** `blocks.insert` and `matches.delete` in `block()` run via `Promise.all` — they're independent. Both errors are checked before navigating.

**Identity verification gate:** `AuthGuard` redirects to `/verify` when `onboarding_complete && !identity_verified`. `Verify.tsx` calls the `create-verification-session` Edge Function (JWT-authenticated) to get a Stripe hosted URL, opens it via `@capacitor/browser`, then polls `profiles.identity_verified` every 3s. Polling starts on `browserPageLoaded` (background) and restarts on `browserFinished`. After 20 poll attempts it shows a "processing" state with a manual retry. The `stripe-webhook` Edge Function (no JWT, verifies Stripe signature) sets `identity_verified = true` via service role after confirming DOB ≥ 18. The `return_url` for the Stripe session is `chapter://verify-complete` — `Verify.tsx` listens for this via `App.addListener('appUrlOpen')` and calls `Browser.close()`, which fires `browserFinished` and triggers the completion poll.

**ProfileEdit books save — diff-based to preserve ratings:** `saveBooks` does NOT delete all favorites. It computes a diff: deletes only the removed books (by `user_book.id`, stored in `originalBooks` state as `{ userBookId, external_id }[]`), and upserts only newly added books. Existing favorites (and their star ratings) are untouched. After save, re-fetches `user_books` to refresh `originalBooks` with the new row IDs.

**Photo reordering — dnd-kit sensor config:** `PointerSensor` uses an 8px activation distance so accidental drags don't fire on taps. `TouchSensor` uses 200ms delay + 5px tolerance so iOS scroll still works. Both action buttons (✕ remove, ★ set-as-main) call `onPointerDown` `stopPropagation` to prevent the drag sensor from swallowing those taps. The `SortablePhoto` component uses `touch-none` on the wrapper to hand pointer events entirely to dnd-kit during a drag.

**Book author search — merge order matters:** `searchGoogleBooks` runs two parallel fetches: `q=${query}` (general) and `inauthor:${query}` (author-specific). Results are merged with `byAuthor` first so that books by the searched author appear before books about them. Deduplication is by `external_id`.

**BookDetailModal — description fetch and truncation:** `src/components/BookDetailModal.tsx` fetches description lazily on open. Google Books: `GET /volumes/{id}?key={key}`. Open Library: `GET /works/{key}.json` (description may be a string or `{value: string}`). `stripHtml()` uses `DOMParser` to remove HTML tags. `truncate()` cuts at the last sentence-ending punctuation (`. ! ?`) within 380 chars; falls back to word boundary. The backdrop uses `bg-black/50` — fully transparent fixed overlays don't reliably receive touch events in iOS WebView. Sheet sizes to content (no internal scroll). Wired to: Library grid (cover tap), Library search results (cover tap), Discover profile modal (book row tap — query extended to include `source`/`external_id`), ProfileEdit search + selected books (cover tap), StepBooks onboarding (cover tap).

**Matches Realtime subscription stability:** The subscription is gated on a `loaded` boolean state (flips once on first successful fetch) rather than `loading`. This prevents the channel from being torn down and recreated on every retry, which would leave a brief gap with no subscription.

**Spotify PKCE flow:** Code verifier is generated in `spotify.ts` and stored in `sessionStorage` before opening the browser. `useSpotifyCallback.ts` listens to `App.addListener('appUrlOpen')` for the `chapter://oauth/callback` deep link, exchanges the code, upserts tokens into `platform_connections`, then imports all saved audiobooks into `user_books`. Token refresh happens on re-import if `expires_at` is past.

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
- **Book search migration:** Google Books is now the primary search (requires `VITE_GOOGLE_BOOKS_API_KEY`), Open Library is the fallback. `books` table uses `(source, external_id)` unique constraint instead of `open_library_id`. `src/lib/bookSearch.ts` is the unified entry point — all callers import from there.
- **Library tab:** `src/pages/Library.tsx` — personal reading library with four shelf tabs (Favourites / Reading / Read / Want to Read), 3-column book grid, add-book search panel, and a bottom-sheet move/remove action modal. `/library` route added; BottomNav now has four tabs: Discover, Matches, Library, Profile.
- **Spotify OAuth (standby):** `platform_connections` table stores OAuth tokens. `src/lib/spotify.ts` implements PKCE helpers + `getSavedAudiobooks()`. `useSpotifyCallback.ts` handles the deep-link callback. All Spotify logic in `Profile.tsx` is commented out with `// SPOTIFY STANDBY` markers (no Client ID available yet). To re-enable: uncomment the marked blocks and set `VITE_SPOTIFY_CLIENT_ID` in `.env`. `VITE_SPOTIFY_REDIRECT_URI=chapter://oauth/callback` is already set. Redirect URI to register in Spotify dashboard: `chapter://oauth/callback`.
- **Identity verification:** Stripe Identity gate between onboarding and the main app. `src/pages/Verify.tsx` manages idle → creating → open → checking → processing → failed states. Two Edge Functions deployed: `create-verification-session` (JWT-authenticated, creates VerificationSession + stores ID on profile) and `stripe-webhook` (verifies Stripe signature, sets `identity_verified = true` if DOB ≥ 18). AuthGuard redirects to `/verify` when `onboarding_complete && !identity_verified`. `return_url` is `chapter://verify-complete`; app catches it via `appUrlOpen` to close the browser cleanly.
- **Book ratings:** `user_books.rating` (1–5, already in schema) now surfaced in UI. Library.tsx: star row in action sheet (tap same star to clear), filled/dim stars on grid cards. Discover.tsx profile modal: shows star ratings next to favourite books.
- **Match search:** Search bar in Matches header. Filters `items` array client-side by name or last message; "no results" empty state. Realtime updates land on `items`; filter applied at render time.
- **Pause profile:** `profiles.paused boolean` (migration `add_paused_to_profiles`). `get_candidates` excludes paused profiles. Profile.tsx: toggle with confirmation modal; amber banner while paused.
- **Account deletion:** `supabase/functions/delete-account/` Edge Function — verifies JWT, calls `admin.deleteUser()` via service role (cascades all data). Profile.tsx: "Delete account" button → confirmation modal → invoke → `signOut`.
- **Bug fixes (2026-06-05):** ProfileEdit `saveBooks` now diff-based (preserves ratings); StepInfo bio field moved inside `space-y-6`; Chat typing timeout cleared on unmount; Discover candidate build uses profileMap (O(1) vs O(n²)); Matches Realtime subscription no longer re-created on retry.
- **Photo reordering + set-as-profile-photo (2026-06-09):** `@dnd-kit/core` + `@dnd-kit/sortable` added. Photo grid in `ProfileEdit.tsx` is now drag-to-reorder. `SortablePhoto` component handles each filled slot. Non-first photos show a ★ button (bottom-left) that calls `arrayMove(prev, i, 0)` to set that photo as the profile photo; first photo shows a "Profile" badge instead. Order is persisted on "Save photos".
- **Author search (2026-06-09):** `searchGoogleBooks` runs two parallel fetches and merges `byAuthor` results first so searching an author name surfaces their books at the top.
- **Book description popup (2026-06-09):** `BookDetailModal` component — tap any book cover anywhere to see a short description fetched from Google Books / Open Library. HTML stripped, truncated to last complete sentence within 380 chars. No DB column needed — fetched on demand.
