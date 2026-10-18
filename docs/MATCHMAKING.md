# Matchmaking: near you first, then everyone

Status: built in `worker/matchmaker.ts` and `shared/matching.ts` (state, then zone, then all of Nigeria, then anyone, widening every 4 seconds, one queue per mode and stake). Yves asked for a faster search, so the steps are 4 seconds, not 10, Baba Ayo is offered as soon as nobody else is at the table, and a busier table is suggested with a "Join them" button that pairs instantly and Ranks by state in `worker/db.ts` and `src/screens/Ranks.tsx`. Since 15 October 2026 the first screen shows a best guess at the state on the "You play as" card, and tapping Play now accepts it (Change picks another). The server only suggests a state from the network and never stores anything finer.

## What we want

1. Players who are close to each other meet more often. Two players in Port Harcourt should usually meet each other before either of them meets someone in Kaduna.
2. Nobody waits long. Closeness is a preference, never a wall.
3. The opponent is picked at random from the best options, so the same two people do not keep meeting.
4. Only players who are online and ready are ever picked.

## What the research found

**The network cannot tell us where a player is inside Nigeria.**
MTN and Airtel put many phones behind shared addresses (called CGNAT), and their traffic leaves through gateways in Lagos. Spot checks of MTN and Airtel address ranges all point to Lagos. A May 2026 study of the big IP location databases found that in Africa, 66 to 72% of lookups were more than 100 km off, the worst of any continent. The country is almost always right (wrong less than 1% of the time), but the city is not. Port Harcourt is about 450 km from Lagos, so IP location cannot tell them apart.

**Cloudflare's servers do not help either.**
Lagos is Cloudflare's only data centre in Nigeria, so a player in Port Harcourt and a player in Kaduna both arrive through Lagos.

**Being close does not make the game faster.**
Durable Objects (where matches run) are not hosted in Africa. A match created from Lagos lands in London, Lisbon or Madrid, about 104 to 111 ms from Lagos. Every Nigerian player takes that same path, so matching nearby players does not reduce lag. Near-you matching is a social feature: it makes the game feel local ("Rivers vs Kaduna"), and it is still worth doing for that reason.

**Exact location is more than we need.**
The browser's location API needs a permission prompt and gives GPS-level precision. Nigeria's Data Protection Act 2023 counts location as personal data and requires clear consent. A state the player picks is the least invasive option and gives us everything this feature needs.

**What other games do.**
Lichess pairs players in waves every few seconds and picks the cheapest set of pairs, where cost is the rating gap minus a bonus for time waited. Chess.com starts at plus or minus 25 rating points and widens. Clash Royale widens its range every 5 seconds. PUBG merged regions in 2024 because splitting players by region made queues too long. Microsoft's TrueMatch starts the search already widened when few players are online, which halved wait times.

## The plan

### 1. Players pick their state

- The state shows on the first screen's "You play as" card, pre-filled from the network. Change opens the 36 states and the FCT, plus "Outside Nigeria" and "Prefer not to say". It can be changed later in Profile.
- We pre-select a guess from Cloudflare's `request.cf.regionCode`, but only when the player is not on a mobile network (`asOrganization` is not MTN, Airtel, Globacom or 9mobile). On mobile data the guess would almost always say Lagos, so we leave the picker empty instead.
- Players outside Nigeria (the country is reliable) get "Outside Nigeria" pre-selected, so the diaspora can play too.
- We store only the state code. Never coordinates, never the raw IP address.
- "Prefer not to say" simply skips the first two tiers below.

### 2. The search widens in tiers

| Time searching | Who you can meet | Example |
| --- | --- | --- |
| 0 to 10 s | Same state | Port Harcourt meets Port Harcourt |
| 10 to 20 s | Same geopolitical zone | Rivers meets Delta, Bayelsa or Cross River |
| 20 to 30 s | Anyone in Nigeria | Port Harcourt meets Kaduna |
| 30 s and after | Anyone, anywhere | Includes players outside Nigeria |
| From 20 s | A "Play Baba Ayo" card appears | Optional. The search keeps going, and Baba Ayo never starts on his own |

When very few people are searching (fewer than about 20), everyone starts at the "anyone in Nigeria" tier, because waiting 20 seconds for a same-state match that cannot happen is pointless. When it gets busy, the tiers tighten again on their own.

The search screen shows the route left to right: a danfo drives from your state to your zone to all of Nigeria, then to Baba Ayo. Above it, your avatar faces a spinning "Who's next?" slot. The VS screen shows both players' states.

### 3. How the opponent is picked

Being in the queue means holding a connection open to the matchmaker (this is how it already works). Closing the screen, losing signal or switching apps closes the connection, which removes the player at once. So everyone the matchmaker sees is online and ready.

Every 2 seconds, while anyone is searching, the matchmaker runs a "wave":

1. List every possible pair of waiting players who are allowed to meet: same mode and board, within both players' current tier, and within the rating range.
2. Give each pair a cost:
   - distance: 0 for the same state, 1 for the same zone, 2 for the same country, 3 otherwise
   - plus the rating gap divided by 100
   - plus 2 if they played each other in the last 10 minutes (this fades as they wait, so it never blocks a match)
   - minus a small bonus for every second waited
3. Shuffle the pairs, then sort by cost. Pairs with equal cost stay in random order, which is how the pick stays random among the best options.
4. Take pairs from the top, skipping anyone already taken. Start those matches.

The rating range starts at plus or minus 150 and widens by 50 per second, as it does today.

The waves are driven by the searching players' own ticks, which the app already sends every few seconds. The matchmaker needs no timer, so it can sleep (and cost nothing) when nobody is searching.

### 4. "Players near you"

The search screen can show how many people are searching in your state and zone, from the matchmaker's own counts. Small numbers are rounded ("a few", "10+") so no individual can be picked out.

### 5. Ranks by state

Ranks gets two tabs: your state and All Nigeria. Being top in Rivers is a goal most players can actually reach, and it gives the state you picked a reason to matter after the match.

### 6. Scale

One matchmaker object handles hundreds of new searches a second, far more than we need at launch. If that ever runs out, split by mode first (one matchmaker for Classic, one for Pro), not by region, so the player pool in each queue stays large.

### 7. Privacy

- Store the state code only.
- Add one line to the privacy notice: "We save the state you choose so we can match you with players near you. You can change it or remove it in Profile."
- No location permission prompt, no GPS, no IP history.

## What changes in the code

| File | Change |
| --- | --- |
| `shared/places.ts` (new) | The 36 states and FCT with their codes and zones, plus "Outside Nigeria" |
| `migrations/0002_state.sql` (new) | `ALTER TABLE players ADD COLUMN state TEXT` |
| `shared/protocol.ts` | `PublicPlayer` gets `state`, and lobby messages report the current tier |
| `worker/index.ts` | The session response includes a state guess, with the mobile-network rule above |
| `worker/matchmaker.ts` | Tickets carry state, zone, mode and recent opponents. Pairing follows section 3 |
| `src/screens/Onboarding.tsx` | The first screen's state guess and its Change sheet |
| `src/screens/Profile.tsx` | Change or remove the state |
| `src/screens/Search.tsx` | Left-to-right route, nearby counts, optional Baba Ayo card from 20 s |
| `src/components/VsSplash.tsx` | Both players' states |
| `tests/` | Zone lookup, tier widening, no self-match, random tie-breaks, recent-opponent penalty |

## Quick match joins live games (15 October 2026)

Yves split the two ways into a quick match:

- **Start your own game:** tap **Quick match**, then **Start my own game** (your last game and stake) or **Change game or stake** to pick both first, and wait on the search screen (everything above still applies). Both buttons show whether or not games are waiting (17 October 2026). The game can also be changed from the chip on Home's game picture.
- **Join one that's waiting:** tap **Quick match**. The Matchmaker lists everyone waiting (`live()`), the server drops the tables you can't sit at (`tableLock`), and sorts the rest: your state, then your zone, then the longest wait. The sheet shows one at a time with **Join** and "Show another". A join is a search that targets one player, so it pairs with them at once or hears they're gone.

Stakes never conflict: the person who started the game set it, and the joiner sees it before tapping Join. With nobody waiting, Quick match never starts a game by itself (changed 15 October 2026: the 3-second countdown was too fast). It keeps watching and shows how many other people are looking at Quick match right now, so two people tapping at the same moment see each other and one starts a game for the other to join. The player chooses: Start my own game (their last game and stake), Change game or stake, or Play Baba Ayo. The button on Home shows how many games are live. Both get the list over one live connection that the matchmaker pushes changes down (15 October 2026, for Cloudflare's free plan: asking every 2 seconds used most of a day's requests).

## The six geopolitical zones

| Zone | States |
| --- | --- |
| North Central | Benue, Kogi, Kwara, Nasarawa, Niger, Plateau, FCT |
| North East | Adamawa, Bauchi, Borno, Gombe, Taraba, Yobe |
| North West | Jigawa, Kaduna, Kano, Katsina, Kebbi, Sokoto, Zamfara |
| South East | Abia, Anambra, Ebonyi, Enugu, Imo |
| South South | Akwa Ibom, Bayelsa, Cross River, Delta, Edo, Rivers |
| South West | Ekiti, Lagos, Ogun, Ondo, Osun, Oyo |

## Sources

- Cloudflare request fields: https://developers.cloudflare.com/workers/runtime-apis/request/
- Cloudflare on IP location accuracy: https://developers.cloudflare.com/network/ip-geolocation/
- "Lost in the Prefix", IP location accuracy study, May 2026: https://arxiv.org/pdf/2605.21937
- Mobile IP location and CGNAT: https://pulse.internetsociety.org/en/blog/why-ip-geolocation-cant-be-trusted-for-mobile-networks-and-the-global-south/
- MTN and Airtel CGNAT in Nigeria: https://technext24.com/yz8v
- Cloudflare network map: https://www.cloudflare.com/network/
- Cloudflare Lagos data centre: https://blog.cloudflare.com/lagos
- Durable Object placement: https://developers.cloudflare.com/durable-objects/reference/data-location/
- Where Durable Objects land: https://where.durableobjects.live/colo/all
- Lagos to London latency: https://wondernetwork.com/pings/Lagos/London
- Lichess pairing code: https://github.com/lichess-org/lila/blob/master/modules/pool/src/main/MatchMaking.scala
- Chess.com matchmaking: https://support.chess.com/en/articles/8639319-how-does-matchmaking-work-in-live-chess
- Clash Royale matchmaking: https://supercell.com/en/games/clashroyale/blog/news/matchmaking-changes/
- PUBG region merge: https://pubg.com/en/news/7676
- Microsoft TrueMatch: https://www.microsoft.com/en-us/research/project/truematch/
- Nigeria Data Protection Act explained: https://fpf.org/blog/nigerias-new-data-protection-act-explained/
- Nigerian traffic by device: https://gs.statcounter.com/platform-market-share/desktop-mobile-tablet/nigeria
