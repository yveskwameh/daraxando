# Phone features: install, portrait, sound, haptics, limits

Status: approved and built. Leaving the app mid-match pauses it (`worker/match.ts`, `src/lib/useMatch.ts`); the other player wins after 60 seconds away. Install pop-up and Settings entry (`src/components/InstallPop.tsx`, `src/lib/install.ts`), portrait card (`index.html`), sound engine (`src/lib/sound.ts`), haptics (`src/lib/haptics.ts`), service worker and manifest (`vite.config.ts`).

## Install as an app (PWA)

Who we are building for (StatCounter, Nigeria mobile, September 2026): Chrome 68%, Opera 18%, Safari 11% (about 15.5% of mobile visitors are on iPhone), Samsung Internet 1%.

**Manifest** (`public/manifest.webmanifest`):
- `id: "/"`, `start_url: "/"`, `scope: "/"`. Set `id` once and never change it.
- `display: "standalone"`. No address bar, but the phone's status bar stays, so players can still see their network and battery.
- `orientation: "portrait"`. Android honours it for the installed app. iOS ignores it.
- `theme_color` and `background_color`: `#0b0a2a`.
- Icons: 192 and 512 px "any", plus a separate 512 px "maskable" with the artwork inside the centre 80%. These wait for the logo.
- Two portrait screenshots (1080 × 1920) and a description under 300 characters, for Android's richer install sheet.

**Service worker:** `vite-plugin-pwa` 1.3.x with `generateSW` and `registerType: "prompt"`, so an update never reloads the page in the middle of a match. (Version 2.0 came out on 3 October 2026, too new to trust yet.) Precache only the app shell. API calls and WebSockets always go to the network. Add a Cloudflare `_headers` rule so `/assets/*` is cached for a year, which saves players data on every visit.

**How an installed app gets a new version** (16 October 2026, `src/lib/pwa.ts`). Yves found his installed app kept the old version until he pulled down to refresh: bringing an app back from the background doesn't reload it, so the browser never looked for a new version, and a downloaded update waited until every window of the app was fully closed, which Android rarely does.
- **Looking:** when the app opens, every time it comes back to the front (at most once a minute), and every 30 minutes while it's open. A look fetches only `sw.js`, a static file (free, and `no-cache` in `_headers`).
- **Downloading:** in the background, while the old version keeps running.
- **Switching:** Home shows **Reload** at the top. Without a tap, the app switches by itself the moment the player leaves it (switches apps or locks the phone), so it's the new version when they come back. Never during a match or a friend room, on a sign-in link, mid Google sign-in, or with a sheet open. Opened fresh with a new version already waiting, it switches straight away.

**The install pop-up:** it is never part of the Home layout. It slides down from the top, over the screen, and only now and then:
- Only in a browser tab, never once the game is installed (`display-mode: standalone`, or `navigator.standalone` on iPhone, or after `appinstalled`).
- Once per visit at most: a few seconds after Home opens, or when the player comes back to Home after finishing a match.
- It hides itself after 12 seconds. The × snoozes it for 14 days.
- "Install the app" stays in You, then Settings, permanently.
- Chrome, Opera and Samsung Internet on Android fire `beforeinstallprompt`. We keep the event, and Install opens the browser's own one-tap install.
- iPhone has no install event. Install opens a sheet with the steps for iOS 26:
  1. Tap ••• next to the address bar, or the Share icon at the bottom.
  2. Tap Share.
  3. Tap Add to Home Screen. If you can't see it, tap View More first.
  4. Leave Open as Web App on.
  5. Tap Add.
- Opera Mini's data-saving mode renders pages on Opera's servers and cannot run a live game. Detect it and show "Open in Chrome to play".

## Notifications

Built 16 October 2026 (milestone 5). Rules, copy and the server side are in `docs/BACKEND.md`, "Notifications".

- **Which phones:** Chrome, Opera and Samsung Internet on Android show them in a browser tab and in the installed app. iPhone shows them only in the installed app (Add to Home Screen, iOS 16.4 or later), never in a Safari tab, so on iPhone the asks stay away and Settings says to install the app first. Opera Mini can't show them.
- **Asking:** the game's own pop-up comes first, at a moment the notification is useful (a streak worth keeping, a friend room waiting). The phone's permission box only appears after **Turn on**, straight from that tap, because iPhone refuses to ask any other way and a "Block" can't be undone by the game. The player then fixes it in the phone's settings, which Settings in the game explains.
- **What it looks like:** the app icon, a title (Baba Ayo for the streak reminder, Dara X&O for the rest) and one line. Android's status bar shows a small white X&O sticker (`public/icons/badge-96.png`, drawn by `node scripts/icons.cjs badge`), because Android paints the status bar icon in one colour from its shape. A newer message of the same kind replaces an older one instead of stacking.
- **Tapping one** opens the game where it points (Home for the streak, the room for a friend), in the window already open if there is one (`public/push-sw.js`, loaded into the service worker).
- **Data and battery:** each message is a few hundred bytes, delivered by the phone's own push service (Google's on Android, Apple's on iPhone), which the phone keeps open anyway. The game doesn't need to be running.
- **Data saver and battery saver** on Android can hold messages back until the phone wakes up. Push services drop a friend's "joined your room" after 10 minutes and the streak reminder at midnight, so a late one never shows.

## Portrait only

- Phones held sideways see a full-screen "Turn your phone upright" card. The rule targets phones only:
  `@media (orientation: landscape) and (max-height: 500px) and (min-aspect-ratio: 13/9) and (pointer: coarse)`
- The card hides while someone is typing, because an open keyboard can make a portrait screen look landscape.
- Computers and tablets are never blocked. They get the game as a centred phone-width column with the print as a backdrop. About 24% of Nigerian web traffic is desktop, so blocking it would lose a quarter of players.
- No `screen.orientation.lock()`: it only works in fullscreen on Android and not at all on iPhone.
- Accessibility note: WCAG asks for both orientations unless one is essential. Portrait-only phones is a reasonable choice for a game, and desktops are unaffected.

## Sound

- **Music:** a looping talking drum, agogo bell, shekere and highlife guitar pattern, synthesised live with the Web Audio API. Nothing downloads, so it costs players no data. It starts on the player's first tap (browsers block sound before that), pauses when the app goes to the background, and has its own on and off switch in the header and in Settings. It dips under win and loss sounds.
- **Effects:** also synthesised. Your move is a rising talking-drum note, the opponent's is a falling one, the result is a stamp thud.
- **iPhone silent switch:** we set `navigator.audioSession.type = "ambient"`, so the game respects the silent switch and does not stop the player's own Boomplay or Spotify music.
- **A real recorded track later (optional):** commission a Nigerian producer for a 60 to 90 second loop, roughly ₦50,000 to ₦200,000, with a written licence that covers use inside a game. Ship it as a 30 to 45 second Web Audio loop (Opus for Chrome, AAC for Safari, about 200 to 350 KB), downloaded only when music is on. Pixabay tracks are allowed in games but many are registered with YouTube Content ID, which causes trouble for players who stream. Avoid BeatStars leases and Uppbeat for in-game use.

## Haptics

- **Android:** `navigator.vibrate`, after the player's first tap. Patterns: tap 10 ms, move 15 ms, wrong tap [20, 40, 20], win [30, 60, 40, 60, 80], loss [60], draw [20, 80, 20].
- **iPhone:** Safari has no vibration API. Since iOS 18, toggling a hidden `<input type="checkbox" switch>` gives a light tap, but only inside the player's own tap. So iPhone players feel their own taps, not the opponent's moves. It is a workaround Apple could remove.
- **Settings:** a Vibration switch, separate from Reduce Motion.
- Vibration may not work inside a preview frame. It will in the real app.

## Play limits

There is no session limit. Players can play as long as they like.

**One thing to fix before launch:** the server allows 5 new guest accounts per minute per IP address. MTN and Airtel put thousands of phones behind one shared address, and Cloudflare's 2025 research found shared addresses are rate limited three times as often as others even though they carry no more bots. A campus or hostel Wi-Fi would also hit this limit.
- Give each device a random ID in a signed cookie, also kept in local storage. A returning device reuses its guest account.
- Limit new guest accounts per device ID: 3 per minute.
- Keep a high per-IP ceiling (about 60 per minute). Going over shows a Cloudflare Turnstile check instead of blocking.
- Keep move, chat and matchmaking limits per account inside the game's Durable Objects.

## Sources

- https://gs.statcounter.com/browser-market-share/mobile/nigeria
- https://web.dev/articles/install-criteria
- https://web.dev/articles/promote-install
- https://web.dev/patterns/web-apps/richer-install-ui
- https://web.dev/articles/maskable-icon
- https://developer.chrome.com/docs/capabilities/pwa-manifest-id
- https://webkit.org/?p=16993
- https://community.glideapps.com/t/ios-26-add-to-home-screen-workflow-change/84599
- https://forums.opera.com/topic/18290/opera-mini-allows-few-sites-for-javascript-to-run-on-its-client-in-extreme-mode/5
- https://vite-pwa-org.netlify.app/guide/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/orientation
- https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock
- https://www.w3.org/WAI/WCAG22/Understanding/orientation.html
- https://developer.chrome.com/blog/autoplay
- https://bugs.webkit.org/show_bug.cgi?id=237322
- https://www.w3.org/TR/audio-session/
- https://pixabay.com/service/terms/
- https://www.hypebot.com/the-problem-with-using-leased-beats-and-royalty-free-sounds-for-sync/
- https://developer.apple.com/documentation/safari-release-notes/safari-18-release-notes.md
- https://bugs.webkit.org/show_bug.cgi?id=285120
- https://developer.android.com/develop/ui/views/haptics/haptics-principles
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://blog.cloudflare.com/detecting-cgn-to-reduce-collateral-damage/
- https://developers.cloudflare.com/turnstile/plans/
