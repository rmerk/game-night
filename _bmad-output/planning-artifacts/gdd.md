---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments:
  - game-brief.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
workflowType: 'gdd'
lastStep: 0
project_name: 'mahjong-game'
user_name: 'Rchoi'
date: '2026-03-25'
game_type: 'card-game'
game_name: 'Mahjong Night'
---

# Mahjong Night - Game Design Document

**Author:** Rchoi
**Game Type:** Card Game (Tile-Based)
**Target Platform(s):** Web Browser (Desktop & Mobile)

---

## Executive Summary

### Game Name

Mahjong Night

### Core Concept

Mahjong Night is a browser-based, real-time multiplayer American Mahjong game built around social connection. Four players create or join a private room via a shared link and play together with full NMJL rules — no downloads, no account required. The game integrates text chat, quick reactions, voice, and video communication as first-class features, recreating the warmth and energy of an in-person game night.

The game faithfully implements American Mahjong mechanics: tile drawing and discarding, calling (Pung, Kong, Quint, Mahjong), Joker management, the Charleston pre-game passing sequence, and hand building toward patterns on the current NMJL card. An updatable card system ensures the game stays current with each year's official card without requiring code changes.

Mahjong Night targets two audiences: experienced American Mahjong players (primarily women 40-70+) who want a faithful digital recreation of their game, and newcomers who want an approachable way to learn by playing with friends. The interface is playful, colorful, and intuitive — designed to feel inviting rather than intimidating, with hybrid click and drag-and-drop interaction that works on both desktop and mobile browsers.

### Game Type

**Type:** Card Game (Tile-Based)
**Framework:** This GDD uses the card-game template with type-specific sections adapted for tile mechanics, hand building, turn structure, and social multiplayer.

### Target Audience

Primary: Experienced American Mahjong players, predominantly women aged 40-70+, who play regularly at home or in clubs. Secondary: Newcomers — friends and family of existing players, and players of other Mahjong variants curious about the American version.

### Unique Selling Points (USPs)

1. **Nobody Gets Left Out of Game Night** — Distance, scheduling, travel, health — none of these should mean missing game night. Share a link, and everyone's at the table.
2. **American Mahjong Done Right** — Full NMJL rules with an updatable yearly card system. The real game, implemented faithfully.
3. **Social-First Design** — Integrated voice, video, text chat, and quick reactions as first-class features.
4. **Zero-Friction Access** — No downloads, no accounts. Share a link, click it, play.
5. **It Just Works** — Rock-solid reliability for an audience with zero tolerance for technical friction.
6. **Gorgeous, Elevated Design** — A visually rich interface that matches the aesthetic standards of the Mahjong community.

---

## Target Platform(s)

### Primary Platform

Web Browser (Desktop & Mobile) — a single responsive web application that adapts to both desktop and mobile form factors. No native app for MVP. Players access the game via URL in any modern browser.

### Platform Considerations

- **Browser Support:** Chrome, Firefox, Safari, Edge (latest two versions)
- **Mobile:** Responsive design with touch-friendly tap targets, tested on iOS Safari and Android Chrome
- **Performance:** Lightweight CSS/SVG rendering — no heavy game engine. Target 60fps for animations on mid-range devices
- **Networking:** WebSocket infrastructure for real-time game state sync; WebRTC (via third-party SDK) for voice/video
- **Constraints:** The server holds authoritative game state in memory for the duration of an active session (required for reconnection and anti-cheat), but there is no durable persistence — if the server process restarts, active games are lost. Durable game state persistence is post-MVP. Browser permission handling for mic/camera varies across mobile browsers
- **Distribution:** Zero-friction — share a link, click it, play. No app store, no downloads, no accounts required to join

### Control Scheme

- **Desktop:** Hybrid click and drag-and-drop for tile interaction. Mouse hover states for tile selection, call prompts, and rack arrangement
- **Mobile:** Touch-based tap-to-select and drag-and-drop with appropriately sized tap targets. Gesture-friendly tile management on smaller screens

---

## Target Audience

### Demographics

Primary: Experienced American Mahjong players, predominantly women aged 40-70+, who play regularly at home or in clubs. Secondary: Newcomers — friends and family of existing players, and players of other Mahjong variants curious about the American version.

### Gaming Experience

Casual to non-gamer — many in the primary audience do not identify as "gamers." The product must be frictionless and forgiving of technical unfamiliarity. No assumption of gaming literacy beyond basic web browsing.

### Genre Familiarity

Primary audience has deep familiarity with American Mahjong rules and conventions. They expect rule accuracy and will notice mistakes. Secondary audience has little to no familiarity and will learn through play with experienced friends, not through tutorials (in MVP).

### Session Length

60-90 minutes typical — matching the length of an in-person American Mahjong game. Players expect to sit down for a full game session, not drop-in/drop-out play.

### Player Motivations

- **Social connection:** Playing with friends is the primary draw. The game is a vehicle for hanging out, not a solo competitive pursuit.
- **Convenience:** Play when the group can't meet in person — distance, weather, scheduling conflicts.
- **Authenticity:** A faithful recreation of the game they already love, not a simplified or "gamified" version.
- **Accessibility:** An easy way to introduce friends and family to the game.

---

## Goals and Context

### Project Goals

1. **Effortless Play Experience** — Players can create a room, share a link, and be playing within 60 seconds. Every interaction — joining, drawing tiles, making calls, chatting — should feel intuitive and require zero technical literacy beyond basic web browsing.
   - *Success criteria:* A new player can join and complete their first turn within 90 seconds of clicking the link.

2. **Elevated, Tasteful Interface** — A visually rich UI that reflects the aesthetic sensibility of the Mahjong community. These players appreciate beautiful tile sets, stylish accessories, and curated design — the digital experience should match that standard. Think rich textures, elegant tile rendering, thoughtful color palettes, and polished animations. Not minimalist, not gamified — *classy*.
   - *Success criteria:* Primary audience testers describe the interface as "beautiful" or "gorgeous," not just "easy to use." The visual quality should be something players are proud to show friends.

3. **Seamless Communication** — Text chat, quick reactions, voice, and video are integrated naturally into the game experience. Players should feel like they're at the same table.
   - *Success criteria:* Voice/video connection establishes within 5 seconds in 95% of sessions. No player reports needing a separate app to communicate.

4. **Faithful American Mahjong** — Correct NMJL rules with an updatable yearly card system. Experienced players should trust the game to enforce rules accurately.
   - *Success criteria:* Zero rule-accuracy bugs reported by experienced playtesters across 10+ complete games.

### Background and Rationale

Mahjong Night was born from a personal need: the developer's wife and her community of friends are passionate American Mahjong players who regularly play in person. When someone can't physically be there — due to distance, scheduling, travel, or health — they miss out on the game and the social connection that comes with it. **Nobody should get left out of game night.** That's the core motivation.

The digital American Mahjong market is underserved. Most online Mahjong games focus on Chinese or Japanese variants, or offer single-player solitaire that has nothing to do with real Mahjong. The few American Mahjong apps that exist have dated interfaces, weak multiplayer, and lack proper NMJL card support. But the biggest competitor isn't another app — it's doing nothing. Most groups simply skip digital play entirely or resort to Zoom calls with a physical set. Mahjong Night needs to be so easy and so pleasant that it's better than the workaround.

**Post-MVP Vision:** Expand to a native iOS mobile app (Apple Developer account available). The game state management and API layer should be designed with this separation in mind from day one to avoid a browser-only architecture.

---

## Unique Selling Points (USPs)

1. **Nobody Gets Left Out of Game Night** — The emotional core of the product. Distance, scheduling, travel, health — none of these should mean missing game night. Share a link, and everyone's at the table.

2. **American Mahjong Done Right** — Full NMJL rules with an updatable yearly card system. Not a variant, not an approximation — the real game, implemented faithfully. Experienced players will feel at home immediately.

3. **Social-First Design** — Integrated voice, video, text chat, and quick reactions. The communication layer is a first-class feature, not an afterthought. Playing Mahjong Night should feel like being at the table together.

4. **Zero-Friction Access** — No downloads, no accounts required to join. Share a link, click it, play. This is critical for the target audience — every barrier removed is a player gained.

5. **It Just Works** — Reliability is a feature. For this audience, one dropped voice call or lost game state means they go back to playing in person. The game must be rock-solid and forgiving of network hiccups.

6. **Gorgeous, Elevated Design** — A visually rich interface that matches the aesthetic standards of the Mahjong community. Players who appreciate artisan tile sets and curated accessories will find a digital experience that feels equally considered — not a basic web app, but something beautiful enough to be proud of.

### Competitive Positioning

| Competitor | Weakness Mahjong Night Addresses |
|---|---|
| **Zoom + physical set (DIY)** | Clunky workaround — no shared game state, manual rule enforcement, no digital convenience |
| Real Mah Jongg (app) | Dated UI, mobile-only, limited social features |
| Mahjong Soul / Tenhou | Japanese Riichi rules — completely different game |
| Board Game Arena | Utilitarian UX, limited Mahjong offerings |
| ilovemahj.com & similar | Minimal social features, outdated design |

Mahjong Night sits in a unique position: the only modern, social-first, browser-based American Mahjong game with full NMJL support, integrated communication tools, and the reliability that this audience demands.

---

## Core Gameplay

### Game Pillars

1. **Faithful Play** — American Mahjong played correctly, period. NMJL rules, proper Charleston, correct calling priority, accurate scoring. Experienced players must trust the game. If it's not right, nothing else matters.

2. **Social Connection** — The game exists to bring people together. Every feature decision should ask: "Does this make players feel more connected to each other?" Communication tools, shared moments, and the warmth of the experience all serve this pillar.

3. **Effortless Elegance** — Zero friction AND beautiful. The game should be as easy to use as it is gorgeous to look at. Every interaction feels natural and looks refined.

4. **Inclusive by Design** — Nobody gets left out. Accessible to non-gamers, welcoming to newcomers, reliable across devices and network conditions, forgiving of technical unfamiliarity.

**Pillar Prioritization:** When pillars conflict, prioritize in this order:
1. Faithful Play > 2. Social Connection > 3. Effortless Elegance > 4. Inclusive by Design

*Note: The Game Brief listed Social Connection as the lead pillar. During GDD development, Faithful Play was promoted to #1 because rule accuracy is the foundation that everything else depends on — if the game isn't correct, the social experience doesn't matter. Social Connection remains the emotional core and the primary reason the product exists.*

### Dealing and Seating

**Seat Assignment:** Random seat assignment at game start. Each player is assigned a wind (East, South, West, North). East is the first dealer.

**Dealing:**
- **Default (instant):** 152 tiles are shuffled digitally. East receives 14 tiles, all others receive 13. Deal is instant with a brief tile-flip animation.
- **Animated traditional (optional setting):** Visual wall building, dice roll to determine break point, tiles dealt in groups — faithful to the physical ritual. Configurable in host settings.
- **Dealer rotation:** East (dealer) rotates clockwise after each game within a session.

### Tile Set Composition

The American Mahjong tile set consists of **152 tiles**:

| Category | Tiles | Count | Total |
|---|---|---|---|
| **Suited tiles** | Bam 1-9, Crack 1-9, Dot 1-9 | 4 each | 108 |
| **Winds** | North, East, West, South | 4 each | 16 |
| **Dragons** | Red, Green, White (Soap) | 4 each | 12 |
| **Flowers** | Flower A, Flower B | 4 each | 8 |
| **Jokers** | Joker | 8 | 8 |
| | | **Total** | **152** |

**Important — Flower tiles:** In American Mahjong, Flowers are regular tiles used in hand patterns on the NMJL card. They are NOT auto-revealed or set aside as in Chinese or Hong Kong Mahjong variants. Flowers are drawn, held, passed in Charleston, and used in groups like any other tile.

### Play Direction and Turn Order

- **Play proceeds counterclockwise** (to the right of the current player) around the table: East -> South -> West -> North -> East
- **After a call:** When a player calls a discard, play continues counterclockwise from the *caller's* seat. The caller exposes the group, discards a tile, and then the player to the caller's right draws next. Players between the discarder and the caller are skipped.
- **Dealer rotation:** After each game, the deal passes to the right (the next player counterclockwise). East deals first, then South becomes East for the next game, and so on.

### East's First Turn

East receives 14 tiles at the deal (all other players receive 13). East does NOT draw a tile on their first turn — they simply evaluate their hand and discard one of their 14 tiles to begin play. After East's opening discard, play proceeds normally (next player draws from the wall).

### Calling Restrictions

- **No Chi/Chow:** American Mahjong does NOT use sequence/run calls (Chi/Chow). Players cannot call a discard to form a sequential group (e.g., 1-2-3). All called groups must match patterns defined on the NMJL card (typically sets of identical tiles, or special groups like NEWS).
- **No calling for pairs:** A discard CANNOT be called to form a pair. Pairs must be completed by drawing from the wall. The only exception is calling for **Mahjong** — if the discard completes your entire hand (including a pair as the final piece), you may call Mahjong.
- **Call validation:** When a player calls a discard, the system validates that the resulting group is valid (correct tile count, correct composition per NMJL card patterns). Intermediate calls do NOT validate against a specific target hand — only that the exposed group itself is a legal group.

### Concealed vs. Exposed Hands

NMJL card hands are marked as **Concealed (C)** or **Exposed (X)**:

- **Concealed (C) hands:** The player cannot call ANY discards during the game (except for Mahjong on the final tile to complete the hand). All groups must be formed by drawing from the wall. If a player pursuing a concealed hand accidentally calls a discard, that hand pattern is no longer achievable — the player must pivot to a different hand or risk a dead hand.
- **Exposed (X) hands:** The player may call discards to form groups normally.
- **Mixed hands:** Some NMJL card hands have a mix of concealed and exposed requirements per group. The card data schema must encode concealed/exposed requirements at the group level, not just the hand level.
- **Validation:** When Mahjong is declared, the system validates that concealed groups were not formed via calls. This is tracked automatically since all calls result in exposed groups.
- **Hand pivot:** Players are free to change their target hand at any time — this is a core part of American Mahjong strategy. However, already-exposed groups constrain future options. The hand guidance system (when enabled) automatically filters achievable hands based on current exposed groups, naturally steering players away from impossible targets. The system does not warn or prevent pivots — it simply reflects reality. A player who has exposed groups can only complete hands compatible with those exposures.

### Group Definitions

Groups in American Mahjong are defined by the NMJL card, not by fixed categories:

| Group | Size | Description |
|---|---|---|
| **Pair** | 2 | Two identical tiles. Jokers CANNOT substitute in pairs. |
| **Pung** | 3 | Three identical tiles. Jokers can substitute. |
| **Kong** | 4 | Four identical tiles. Jokers can substitute. |
| **Quint** | 5 | Five identical tiles (requires Jokers since only 4 of each tile exist). |
| **Sextet** | 6 | Six identical tiles (requires Jokers). Rare but may appear on some NMJL cards. |
| **Single** | 1 | A single tile in a pattern. Jokers CANNOT substitute for singles. |
| **NEWS** | 4 | One each of North, East, West, South. This is a special group — NOT four identical tiles. Jokers can substitute. |
| **Dragon set** | 3 | One each of Red, Green, White. Special group. Jokers can substitute. |

**Pattern-defined groups:** The NMJL card may define groups that don't fit traditional Pung/Kong categories (like NEWS or Dragon sets). The calling system must support calling a discard that completes any valid group defined on the card, not just same-tile groups. The call buttons should reflect the available call types based on the player's tiles and the discard.

### Room Management

- **Room capacity:** Exactly 4 players required to start a game. Host sees a "Waiting for players..." lobby until all seats are filled.
- **5th player handling:** If a 5th person clicks the room link, they see a friendly branded page: "This table is full." They can enter spectator mode — read-only view of the table (no racks visible). Spectators are identified by their session-level display name (same as players — no account required). There is no waitlist for MVP. If a seat opens (player departs and group votes to allow a replacement), the host can share the room link again and a new visitor takes the open seat on a first-come basis.
- **Room settings changes:** Host can modify game settings (timer, card year, Joker rules, dealing style) between games but not mid-game. When the host changes any setting, all players see a brief notification: "Host changed [setting] to [value]." Current game settings are visible in a collapsible panel accessible to all players at any time.

### Core Gameplay Loop

**Turn-Level Loop (30-60 seconds):**
A relaxed, thoughtful rhythm that mirrors in-person play. Each turn gives players breathing room to think, chat, and strategize.

```
Draw tile -> Evaluate hand against NMJL card -> Decide keep/discard
    -> Discard tile -> Call window opens (hybrid timer)
        -> All players pass or call within window
            -> If Mahjong call: Mahjong takes priority, hand validated
            -> If non-Mahjong call(s): seat position priority (closest counterclockwise from discarder)
            -> If called: caller exposes group, discards -> next turn
            -> If no call: next player draws -> loop repeats
    -> OR: Player draws winning tile from wall -> self-drawn Mahjong
```

**Social Layer (continuous):**
Running alongside every turn — text chat, voice/video conversation, quick reactions to big moments. The social layer is always active, not gated by turn state.

**Game-Level Loop (60-90 minutes per session):**

```
Room setup (host creates, shares link, players join)
    -> Game configuration (timer, card year, settings)
        -> Charleston (first-class social + strategic interaction)
            -> Play rounds (turn-level loop repeats)
                -> Mahjong declared OR wall game (draw)
                    -> Celebration sequence / hand reveal
                        -> Optional "show hands" moment
                            -> Scoreboard & social wind-down
                                -> Rematch or end session
```

**Emotional Arc of a Session:**
The UI should subtly support the natural energy flow of a game:
- **Opening energy** — Excitement of joining, seeing friends, settling in. Charleston is buzzy and social.
- **Mid-game tension** — Focus increases. The wall is shrinking. People get quieter, more strategic. Someone makes a big call and the energy spikes.
- **Climax** — Mahjong! Celebration, laughter, groaning from whoever was close.
- **Cool-down** — Scoreboard, rehashing, "show hands," deciding whether to play again.

**Loop Timing:** Individual turns are unhurried — configurable timer (15-30 sec default) with a relaxed/no-timer option. The game should never feel rushed. A full game runs 60-90 minutes, matching in-person pacing.

**Loop Variation:** Each game feels different because of:
- The yearly NMJL card offers dozens of possible hands to pursue
- Charleston creates a unique starting position every game
- Social dynamics shift — who's chatty, who's focused, who just made a big call
- Strategic tension builds as the wall shrinks and hands develop

### Calling System

**Call Window (Hybrid Model):**
After each discard, a hybrid call window opens for all players:
- A short timer runs (3-5 seconds, configurable by host)
- Players can click "Pass" to speed things up — window closes early if all players pass
- If no one acts and the timer expires, the discard is uncallable and the next player draws
- Visual countdown indicator shows remaining time

**Call Priority:**
- **Mahjong always wins.** A Mahjong call takes priority over any other call, regardless of timing or seat position.
- **Multiple Mahjong calls:** If two or more players call Mahjong on the same discard, priority goes to the next player in turn order (counterclockwise from the discarder).
- **Non-Mahjong calls:** Priority is determined by seat position — the player closest in turn order (counterclockwise from the discarder) wins. The server resolves all calls received within the call window at window close, using seat position as the sole tiebreaker. There is no "fastest click" advantage.

**Call Confirmation:**
- After clicking a call button, the player must confirm by exposing the required tiles from their rack within 5 seconds
- If the player cannot produce a valid group (misclick or mistake), the call is automatically retracted and the call window reopens for remaining time
- Retracted calls do not result in a dead hand — this is a UI safety net, not a rule violation
- **Retraction boundary:** A call is retractable only during the confirmation phase (before the player confirms tile selection). Once the player confirms and tiles are placed into the exposed area, the call is **irretractable**. If the exposed group is later found invalid (e.g., due to a card data edge case), it becomes a dead hand per the Dead Hand Triggers. The confirmation step is the point of no return.

**Self-Drawn Mahjong:**
- When a player draws a tile from the wall that completes a valid hand, they may declare Mahjong immediately (before discarding)
- Follows the same Mahjong Declaration Flow (auto-validation, cancel option, celebration)
- Scoring note: self-drawn Mahjong results in all 3 losers paying double (see Scoring section)

### Charleston as First-Class Interaction

The Charleston is one of the most social and strategic moments in American Mahjong. It deserves dedicated UI design, not just rules enforcement.

**Full NMJL Charleston Structure:**
1. **First Charleston (mandatory):** Right, Across, Left — all players must participate
2. **Second Charleston (optional):** Left, Across, Right (reversed direction from first). After the first Charleston, a unanimous vote prompt appears: "Do a second Charleston?" All 4 players must agree; if anyone declines, skip to Courtesy pass.
3. **Courtesy pass (optional):** The player across from you may exchange 0-3 tiles. Each player independently selects how many tiles (0-3) they want to pass. Both players must pass the same number — if they disagree, the lower number is used (e.g., if one picks 2 and the other picks 3, both pass 2). Tiles are swapped simultaneously.

**Blind Passing Rule:**
- During the third pass of each Charleston (Left pass in the first Charleston, Right pass in the second), players must select their 3 tiles to pass *before* seeing the tiles they receive from the Across pass. This prevents players from strategically passing received tiles. The UI enforces this by requiring tile selection before the Across tiles are revealed.

**Charleston Joker Rule:**
- Jokers CAN be passed during the Charleston. This is legal per NMJL rules. The auto-pass on disconnect uses non-Joker tiles as a courtesy to the disconnected player, not because passing Jokers is prohibited.

**Charleston Interaction Design:**
- **Tile selection:** Clear interaction for selecting 3 tiles to pass (tap-to-select or drag to a passing zone)
- **Direction indicator:** Visual display showing which direction tiles are being passed this round
- **Social time:** Chat, voice, and reactions remain fully active during Charleston. This is prime social time — players groan, strategize out loud, and laugh about what they're passing
- **Pacing:** No rush. Give players time to evaluate their hand and choose carefully

**Charleston Edge Cases:**
- **Disconnect during Charleston:** Grace period (~30 seconds) for reconnection. If the player doesn't return, auto-pass 3 random non-Joker tiles from their rack to keep the game moving.
- **Timeout during Charleston (timed games):** Same behavior as disconnect — gentle nudge, then auto-pass after a generous timeout (longer than turn timer, ~60 seconds)

### NMJL Card Integration

The NMJL card is the central reference throughout every game. Players constantly check it while building their hand:

- **Card display — desktop:** Always visible as a sidebar or panel. In person, the card sits on the table next to your rack — the digital equivalent should be equally accessible. Players should never have to hunt for it.
- **Card display — mobile:** Quick-toggle **partial-height sheet** overlay (scrollable reference content, backdrop, rack/context still visible) due to screen space constraints. One tap to open, one tap to close. Prominent toggle button always visible.
- **Card data structure:** Machine-readable pattern definitions (not just images) to enable real-time hand validation and scoring
- **Hand guidance (toggleable):** An optional hint system that subtly highlights which hands on the card are still achievable given the player's current tiles. Serves the Inclusive by Design pillar without dumbing down the experience for veterans. **On by default for a player's first 3 completed games** (a game counts as "completed" when it ends via Mahjong declaration or wall game — disconnects, spectated games, and abandoned sessions do not count), then auto-disables with a "You can re-enable hints in settings" message. Host can also toggle hints for all players in room settings. *Tracking note:* Game count is stored in localStorage. If cleared, hints simply re-enable — a safe default for this audience. Count is per-browser/per-device by design; no cross-device sync for guests.
- **Yearly updates:** Card data is structured to be swappable without code changes. New card data is loaded at the start of each NMJL card year

### Joker Rules

Jokers are a defining feature of American Mahjong. The host selects the Joker rule variant in room settings before the game starts:

**Standard NMJL Joker Rules (default):**
- **8 Joker tiles** in the 152-tile set
- **Substitution:** Jokers can substitute for any tile in a group of 3 or more (Pung, Kong, Quint). Jokers CANNOT be used in pairs or singles.
- **Discard restriction:** A Joker in your rack cannot be discarded. Once picked up (drawn or received in Charleston), it stays.
- **Dead if discarded:** If a Joker is somehow discarded (e.g., from an initial deal edge case), it is a dead tile — no player can call it.
- **Joker exchange:** On your turn (before discarding), you may exchange a natural tile from your rack for a Joker in any player's *exposed* group. You must have the exact tile the Joker is substituting for. This is a key strategic mechanic.
- **Exchange timing:** Joker exchanges happen only on the exchanging player's turn, before they discard. Multiple exchanges in a single turn are allowed.
- **Group identity is fixed at exposure:** When a group is exposed, its identity is permanently recorded (e.g., "Kong of 3-Bam"). Jokers in the group are substituting for that specific tile. Exchanging a Joker out does not change the group's identity — the group always remains what it was when exposed. This ensures exchange validation is unambiguous.

**Simplified Joker Rules (host option):**
- Same substitution and discard rules as standard
- **No Joker exchange** from exposed groups — simplifies gameplay for groups with beginners
- Recommended for mixed-experience groups or players learning the game

### Exposure Rules

When a player calls a discard (Pung, Kong, Quint), they must expose the called group:

- **Exposed tiles** are placed face-up in front of the player, visible to all players for the rest of the game
- **Exposed groups cannot be rearranged** or broken apart once placed
- **Jokers in exposed groups** are visible and available for exchange (in standard Joker rules)
- **Concealed vs. exposed:** Some NMJL card hands require concealed groups (not called from discards). The UI should clearly distinguish between concealed tiles (on the rack) and exposed groups

### Wall Counter

A visual indicator showing how many tiles remain in the wall, creating organic tension as the game progresses. In person, players can see the physical wall shrinking — this digital equivalent provides the same natural pacing signal:

- Visible to all players throughout the game
- Creates urgency without an artificial timer
- Supports the emotional arc: early game feels open, late game feels tight

### Win/Loss Conditions

#### Mahjong Declaration Flow

When a player believes they have Mahjong:

1. Player clicks "Mahjong" button
2. **Game auto-validates** the hand against the NMJL card data *before* revealing to other players
3. **If invalid:** Player is notified privately with a "Cancel" option — giving them a chance to back out before it becomes a dead hand. Serves Inclusive by Design by being forgiving of honest mistakes. **If the player dismisses the warning and confirms the declaration anyway, dead hand is enforced immediately** per NMJL rules. The cancel option is a courtesy, not infinite protection.
4. **If valid:** Proceed to the full celebration sequence
5. **Challenge button:** Available for edge cases — if a player believes the validation is incorrect, they can trigger a group review of the hand against the card. (Safety valve for potential card data bugs.)

#### Victory Conditions

- **Mahjong:** A player completes a valid hand matching a pattern on the current NMJL card and declares Mahjong. This triggers a **full celebration sequence**: the winning hand fans out beautifully for all players to admire (like showing your tiles in person), a signature sound plays, and the winner's name gets a spotlight moment. This is THE moment — let the winner savor it.
- **Session scoring:** Cumulative scoring across games in a session, tracked on a persistent scoreboard.

#### Scoring and Payment Rules

Standard NMJL payment rules apply:

- **Mahjong from a discard:** All 3 losers pay the winner the hand's point value. The player who discarded the winning tile pays **double** (2x the hand value; others pay 1x). This creates meaningful discard strategy — players must weigh the risk of throwing a tile someone needs.
- **Self-drawn Mahjong (from the wall):** All 3 losers pay the winner **double** the hand value. Self-drawn wins are rare and rewarding.
- **Wall game (draw):** No payments. Scores remain unchanged.
- **Hand values:** Determined by the NMJL card — each hand pattern has an assigned point value (typically 25-50 points).
- **Session scoreboard:** Running total of payments across all games in the session. Displayed prominently between games and at session end.

#### Failure Conditions

- **Round loss:** Not completing your hand before another player declares Mahjong. Normal, expected outcome — no punishment, just "next game."
- **Wall game (draw):** The wall runs out of tiles with no winner. Treated as a neutral outcome — "good game, let's go again." *Metric: track wall game frequency. If exceeding 15-20% of games, investigate hand accessibility on the current card.*
- **Dead hand:** A dead hand results from rule violations per NMJL rules. The player can no longer win that round but continues to draw and discard. **Dead hands cannot be reversed by social override** — this is too fundamental a rule to forgive.

**Dead Hand Triggers:**
- Confirming an incorrect Mahjong declaration (after dismissing the cancel warning)
- Incorrect exposure (calling a tile and exposing an invalid group that cannot be retracted)
- Wrong number of tiles on the rack (detected automatically)
- Naming a specific tile you need when making a call (e.g., saying "I need 3 Bam" — this is a verbal rule enforced via the **Table Talk Report** system, not social override; see below)

**Dead Hand Behavior:**
- Dead hand player continues to draw from the wall and discard normally
- Dead hand player **cannot** call any discards
- Other players **can** call dead hand player's discards (per NMJL rules)
- Dead hand player's exposed tiles remain visible to all players

**Table Talk Report (Verbal Rule Enforcement):**
- "Naming a specific tile you need" is a verbal rule that cannot be auto-detected by the game. It is enforced through a dedicated **Table Talk Report** button — separate from the Social Override system.
- Any player can click "Report Table Talk" during the game. A prompt asks for a brief description. The report is sent to all other players as a majority vote (2 of 3 non-reported players must agree).
- If upheld: the reported player receives a dead hand for the current game.
- If denied: no action taken; play continues.
- **Abuse prevention:** Each player can submit a maximum of 2 Table Talk Reports per game. A denied report counts toward this limit. This prevents griefing through repeated frivolous reports.
- This system is distinct from Social Override, which handles accidental misplays and cannot trigger dead hands.

#### Turn Timeout Behavior

For timed games, a forgiving approach that respects this audience:

1. **First timeout:** Gentle nudge notification ("It's your turn!") with a time extension
2. **Second timeout:** Auto-discard of the most recently drawn tile (the most forgiving automatic action — returns the player to their pre-draw state)
3. **Third+ consecutive timeout (AFK escalation):** After 3 consecutive timeouts by the same player, the other 3 players receive a vote prompt: "Convert [player] to a dead seat?" Requires majority (2 of 3) to pass. If approved, the AFK player becomes a dead seat (see Player Departure). If denied, auto-discard continues.
4. **No-timer mode:** No timeouts at all. The group self-regulates pacing through social cues

#### Player Departure Mid-Game

If a player permanently leaves (not a disconnection, but a quit):

- **Notification:** Other players are informed that the player has left
- **Host decision:** Remaining players see a prompt: "Continue with [player] as a dead seat, or end game?" Majority vote decides.
- **Dead seat behavior:** The departed player's hand is locked, they auto-pass all turns, and no one can claim their discards. Their exposed tiles remain visible. Wall tiles that would be their draw are skipped (next player draws instead). *Balance note:* This gives remaining players access to more wall tiles than a normal 4-player game, making hands slightly easier to complete and wall games rarer. This is an accepted trade-off — the alternative (dead seat still drawing and discarding randomly) would feel worse and introduce randomness. The game is already in a degraded social state; a slight balance shift is preferable to a worse experience.
- **No AI fill-in for MVP:** Keeping it simple. The social dynamic of a 3-player finish is preferable to an artificial player.
- **Multi-departure threshold:** If 2 or more players leave, the game auto-ends immediately. A 2-player American Mahjong game is not viable. Final scoreboard is shown with scores through the last completed game.

**Host Departure:**
- If the host leaves, remaining players see a prompt: "Host left. Continue with [next player in seat order] as new host, or end game?"
- If players choose to continue, the new host inherits all host capabilities (room settings, game decisions)
- If the host disconnects (not quit), normal reconnection grace period applies before triggering the host migration prompt

#### Social Override System

A group forgiveness mechanic that mirrors how friends self-govern in person:

- **Scope:** Applies to accidental discards, mistaken calls, and Charleston passing errors only. Does NOT apply to scoring disputes, dead hand declarations, or Mahjong challenges.
- **Undo window:** A correction can only be requested before the next irreversible game state change — specifically, before the next draw from the wall or the next resolved call. Viewing tiles, hovering, and chat are not actions that close the window.
- **Approval:** Requires unanimous consent from all other players (3 of 3). A quick thumbs up/down prompt appears and auto-dismisses after 10 seconds. **Silence = deny** — if the vote auto-dismisses without all responses, the override is denied. Players must actively approve an undo. This prevents overrides from slipping through when players miss the prompt, which is especially important for the primary demographic.
- **Undo during call window:** If a call has been initiated but tiles have not yet been exposed (confirmation phase), an undo can still apply. Once tiles are exposed on the table, the call is irreversible and the undo window closes.
- **Transparency:** All overrides are logged and visible to the host for review. Prevents misuse while keeping the tone friendly.
- **No limits per game:** Trust the social dynamics — if one player is overusing corrections, the group will self-regulate through the vote mechanism.

#### Scoreboard & Social Wind-Down

The post-game sequence is designed as a **social space**, not a transition screen:

- **Celebration:** Winner's hand displayed prominently with scoring breakdown and a spotlight moment
- **Optional "show hands":** After Mahjong is declared, all players can optionally reveal their racks — "I was ONE tile away!" This extends the social moment and is part of the fun of in-person play
- **Session scores:** Cumulative scoreboard across games in the session
- **Linger time:** Give players space to chat, tease, and rehash the game. Rematch button available but not pushy — let the moment breathe

### Wall End and Last Tile

- **Wall game trigger:** When the last tile is drawn from the wall and the drawing player discards without declaring Mahjong, and no other player calls that final discard, the game ends as a draw. No payments are made.
- **Last tile — self-drawn Mahjong:** If the player who draws the last tile from the wall completes a valid hand, they may declare self-drawn Mahjong normally (all losers pay double).
- **Last discard — Mahjong call:** If the last discard completes another player's hand, they may call Mahjong normally.
- **Last tile rules:** Per standard NMJL rules, there is no "hot wall" restriction. The last discarded tile can be called for any valid purpose (Pung, Kong, Quint, or Mahjong), not just Mahjong. However, this is a common house rule variant — the host settings may include a "hot wall" toggle in a post-MVP update.

### Reconnection

Players may briefly drop during 60-90 minute sessions (phone call, browser refresh, network hiccup):

- **For other players:** A gentle "Sarah is reconnecting..." indicator appears — no jarring error messages
- **For the reconnecting player:** Full game state restores instantly — board, rack, scores, chat history. No loading screens, no confusion about whose turn it is
- **During reconnection:** Game continues if it's not the disconnected player's turn. If it IS their turn, a brief grace period (configurable, ~30 seconds) before the turn is auto-passed or the group is notified
- **Seamless rejoin:** The relaxed pacing provides a natural buffer for reconnection without disrupting the social flow

**Phase-Specific Reconnection:**
- **During Charleston:** Grace period applies. If the player doesn't return within ~30 seconds, auto-pass 3 random non-Joker tiles to keep the Charleston moving. Player's selected tiles (if any were chosen before disconnect) are preserved.
- **During call window:** Disconnected player's call window is forfeited after the grace period. The call resolves with remaining players' responses.
- **During their turn:** Grace period, then auto-discard of most recently drawn tile (same as timeout behavior).

**Simultaneous Disconnections:**
- **2+ players disconnect:** Game pauses entirely. A "Waiting for players to reconnect..." screen appears for connected players.
- **Reconnection timeout:** If not all disconnected players return within 2 minutes, the game auto-ends. Current session scores are preserved through the last completed game.
- **Voice/video on reconnect:** WebRTC streams auto-reconnect on rejoin. A "Reconnecting audio/video..." indicator appears. If A/V fails to re-establish within 10 seconds, the player falls back to text-only. A persistent "Reconnect A/V" button appears in the voice/video controls area. Clicking it triggers one retry attempt with a 10-second timeout and a spinner. If that retry also fails, the button remains available with a brief "Connection failed — try again?" message. No modal, no loop — the player stays in the game with text chat and can retry at their leisure. The game is fully playable without A/V.

---

## Game Mechanics

### Primary Mechanics

**1. Tile Management** (constant)
- **Actions:** Draw from wall, arrange tiles on rack, evaluate hand against NMJL card
- **Skill tested:** Pattern recognition, strategic planning
- **Feel:** Contemplative and tactile. Drawing a tile should feel satisfying (subtle animation + sound). Arranging tiles on the rack should feel like fidgeting with physical tiles — smooth drag-and-drop with snap-to-position.
- **Key implementation note:** `[SIMPLE]` Standard UI — rack component with drag-and-drop tile reordering.
- **Pillar alignment:** Faithful Play, Effortless Elegance

**2. Table Reading** (constant, passive)
- **Actions:** Observe discards, study exposed groups, track what tiles have been played
- **Skill tested:** Deduction, pattern recognition, opponent reading
- **Feel:** The quiet meta-game running in the background. Not a button you press — a skill the UI *supports*.
- **Key implementation note:** `[SIMPLE]` *Table Reading is a design lens, not an implementation target.* There is no "Table Reading system" to build. It emerges from good UI: a visible discard pool component and well-styled exposed group display. **Discard pool layout:** Each player's discards are displayed in front of their seat in chronological rows (matching physical play), so other players can track who discarded what. This per-player layout is essential for strategic table reading.
- **Pillar alignment:** Faithful Play, Inclusive by Design

**3. Discarding** (every turn)
- **Actions:** Select a tile from rack, confirm discard
- **Skill tested:** Risk assessment, defensive play, hand reading
- **Feel:** Deliberate and slightly tense. The discard-pays-double scoring means every discard carries real consequence, especially late-game.
- **Key implementation note:** `[MODERATE]` Two-step default: select tile (lifts), confirm button appears *above* the selected tile with viewport boundary detection (never clips off-screen on mobile edges). Tile animates to discard zone after confirm. Drag-and-drop is opt-in via settings.
- **Pillar alignment:** Faithful Play

**4. Calling** (situational)
- **Actions:** Claim a discard (Pung/Kong/Quint/NEWS/Dragon set/Mahjong), expose tiles, exchange Jokers from exposed groups
- **Skill tested:** Timing, hand evaluation, strategic exposure decisions
- **Feel:** Quick and decisive. The call window is brief. Exposing tiles should feel like a bold move.
- **Key implementation note:** `[COMPLEX]` The calling system must support both same-tile groups (Pung/Kong/Quint) AND pattern-defined groups from the NMJL card (NEWS, Dragon sets). Call buttons dynamically reflect valid call options based on the discard tile and the player's rack. Joker Exchange validation: exposed groups have a fixed identity at time of exposure (e.g., "Pung of 3-Bam"), so the Joker's substitution target is known — no need to infer across multiple hands. Call window *freezes* for all players once any call is clicked, until confirmed or retracted. Confirmation time is not additive — it runs within the frozen window. Call priority resolved by seat position (see Calling System), not click speed.
- **Pillar alignment:** Faithful Play, Inclusive by Design

**5. Charleston** (once per game, pre-play)
- **Actions:** Select 3 tiles to pass, receive 3 tiles, negotiate courtesy pass
- **Skill tested:** Hand evaluation, strategic passing
- **Feel:** Buzzy and social. The warm-up — excitement, chatter, groaning. The blind pass rule on the Left adds a gambling element.
- **Key implementation note:** `[MODERATE]` Blind pass enforcement (Left pass selection locked before Across tiles revealed). Full two-pass structure with unanimous vote for optional second Charleston.
- **Pillar alignment:** Faithful Play, Social Connection

**6. Communication** (continuous)
- **Actions:** Text chat, send quick reactions, voice chat, video chat
- **Skill tested:** Social awareness
- **Feel:** Ambient and natural. Never feels like a separate activity. Quick reactions are one-tap and expressive.
- **Key implementation note:** `[MODERATE]` WebRTC integration via third-party SDK for voice/video. Text chat and reactions are `[SIMPLE]`.
- **Pillar alignment:** Social Connection, Inclusive by Design

**7. Declaration** (rare, climactic)
- **Actions:** Declare Mahjong, confirm/cancel after validation, reveal winning hand
- **Skill tested:** Hand completion awareness, confidence
- **Feel:** THE moment. Triumphant button press, then the celebration sequence.
- **Key implementation note:** `[MODERATE]` Mahjong button is always visible, always clickable — no smart visibility. Auto-validation runs against NMJL card data. Scoring follows rules defined in the Scoring and Payment section (see Core Gameplay).
- **Pillar alignment:** Faithful Play, Social Connection, Effortless Elegance

### Mechanic Interactions

```
Tile Management <-> Discarding: Evaluate hand, then choose what to release
Discarding -> Calling: Every discard creates a claiming opportunity for others
Discarding -> Table Reading: Every discard feeds opponents' deduction
Calling -> Tile Management: Called tiles expose groups, reshaping your rack
Calling -> Table Reading: Exposed groups reveal hand direction to opponents
Charleston -> Tile Management: Pre-game passes shape your starting strategy
Communication <-> All: Social layer runs continuously alongside all mechanics
Declaration <- Tile Management + Calling: Hand completion triggers the climax
Scoring <- Discarding: Discarder-pays-double links defensive play to every discard
Joker Exchange <- Calling: Exposed groups with Jokers create exchange opportunities
Table Reading <- Discarding + Calling: Passive mechanic fed by all visible actions
```

### Mechanic Progression

American Mahjong does not have unlock-based progression. Instead, mechanics deepen through *player mastery*:

- **Newcomer:** Focus on Tile Management — learning to read the NMJL card and build toward a hand. Hand guidance hints are on (auto-disables after 3 completed games; localStorage-based, re-enables if cleared — a safe default).
- **Developing:** Discarding becomes strategic — Table Reading kicks in as players learn to track discards and avoid feeding opponents. Charleston passes become deliberate, not random.
- **Experienced:** Calling decisions weigh exposure risk vs. hand completion speed. Joker exchange timing becomes a weapon. Defensive discarding ("playing safe") becomes second nature. Players read opponents' exposed tiles and discard patterns to deduce their hands.

---

### Controls and Input

#### Control Scheme (Web Browser — Desktop)

| Action | Input | Priority | Notes |
|---|---|---|---|
| Select tile | Click or Enter | P1 | Tile lifts to indicate selection |
| Discard tile | Select + click confirm (appears above tile) | P1 | Two-step default; drag opt-in via settings |
| Navigate rack | Arrow keys or mouse | P1 | Arrows move between tiles |
| Call (Pung/Kong/Quint) | Click call button or Enter | P1 | Appears during call window |
| Call (Mahjong) | Click Mahjong button | P1 | Always visible, always clickable |
| Expose tiles for call | Click/Enter tiles on rack | P1 | Confirm within frozen call window |
| Charleston pass | Select 3 tiles, then click "Pass" | P1 | Direction indicator always visible |
| Chat | Type in chat panel | P1 | Always accessible |
| Arrange rack | Drag and drop | P2 | Tiles snap to grid positions |
| Joker exchange | Click Joker in group, click matching tile on rack | P2 | Your turn only, before discarding |
| Courtesy pass | Accept/Decline buttons | P2 | Simple two-button choice |
| View NMJL card | Always visible in sidebar | P2 | No action needed |
| Cycle game zones | Tab | P2 | Rack -> discard -> card -> chat -> controls. Tab always cycles zones. |
| Exit chat focus | Escape | P2 | Returns focus to game zones |
| Quick reaction | Click reaction button | P2 | One-click emoji/reaction |
| Toggle voice/video | Click mic/camera icons | P2 | Persistent toggle in UI |
| Sort rack | Click "Sort" button | P3 | Single mode: by suit, then number |

#### Control Scheme (Web Browser — Mobile)

| Action | Input | Priority | Notes |
|---|---|---|---|
| Select tile | Tap | P1 | Tile lifts slightly |
| Discard tile | Tap selected + tap confirm (appears above tile) | P1 | Viewport-aware positioning |
| Arrange rack | Drag and drop | P2 | Horizontal scroll if needed |
| Sort rack | Tap "Sort" button | P3 | By suit, then number |
| View NMJL card | Tap toggle button | P1 | Full-screen overlay |
| All other actions | Same as desktop with touch-adapted targets | — | Minimum 44px tap targets per WCAG |

#### Input Feel

- **Tile interactions:** Snappy with subtle haptic feedback (on supported mobile devices). Tiles should feel like they have physical weight — slight inertia on drag, satisfying snap on drop.
- **Call prompts:** Appear instantly, dismiss cleanly. No animation delay on time-sensitive actions. Call window freezes for all players when any call is clicked.
- **Discard (two-step):** Select lifts the tile, confirm button appears *above* it (viewport-aware — shifts if near screen edge). Tap confirms and tile animates to discard zone with a satisfying clack.
- **Rack arrangement:** Fluid and forgiving. Single "Sort" button (by suit, then number). One button, one behavior.
- **Keyboard navigation:** Responsive and predictable. Focus indicators are clearly visible. Tab always cycles game zones; Escape exits chat focus.

#### Accessibility Controls

- **Font size:** Adjustable in settings (default optimized for primary demographic — larger than typical game UI)
- **High contrast mode:** Enhanced contrast for tile suits and numbers
- **Color-blind support:** Tile suits distinguished by shape/pattern in addition to color
- **Reduced motion:** Respect the browser's `prefers-reduced-motion` CSS media query. No custom toggle — players who want reduced motion already have it set at the OS level.
- **Keyboard navigation (desktop):** First-class input method — Tab cycles game zones, arrow keys navigate within zones, Enter confirms. A primary input mode, not an accessibility afterthought.
- **ARIA labels:** All interactive elements have proper ARIA labels from day one. Screen reader *testing and optimization* is post-MVP, but the semantic foundation ships in MVP.

---

## Tile-Based Game Specific Design

### Tile Types and Visual Design

**Base Tile Style:** Clean & Minimal — white tile base with colored art and subtle drop shadow for depth. Inspired by the modern American Mahjong aesthetic seen in brands like The Mahjong Line and Oh My Mahjong. The digital tiles should feel like premium acrylic tiles: crisp, clean, and visually elevated.

**Tile Face Art Direction:** Modernized traditional — based on classic Mahjong symbols but with cleaned-up line weight, consistent styling, and modern sensibility. Recognizable to experienced players but refreshed for a digital context.

| Tile Category | Art Direction |
|---|---|
| **Craks (1-9)** | Simplified Chinese numerals with clean, consistent stroke weight. Arabic numeral in the corner (like a playing card index) for accessibility — many American players recognize Crak characters by habit, not by reading Chinese. The corner numeral ensures legibility at mobile scale and for newcomers. |
| **Bams (1-9)** | Stylized bamboo illustrations with modern line work. 1 Bam features the traditional bird motif, modernized. Corner Arabic numeral. |
| **Dots (1-9)** | Geometric circle patterns — clean, symmetric, satisfying. Corner Arabic numeral. |
| **Winds (N/E/W/S)** | English letters with a distinctive typographic treatment. Each wind gets a unique color accent. |
| **Dragons (Red/Green/White)** | Color-coded symbols — Red: 中 (simplified), Green: 發 (simplified), White/Soap: clean bordered rectangle. |
| **Flowers** | Distinct floral illustrations for each Flower type (A and B). Elegant, recognizable at small sizes. |
| **Jokers** | Bold, distinctive design that's instantly recognizable at any size. The Joker should feel special — playful and slightly mischievous. |

**Legibility Requirements:**
- All tile faces must be clearly readable at mobile scale (~32px wide)
- Arabic numeral corner index on all suited tiles (Craks, Bams, Dots) for accessibility
- Suit identity distinguishable by shape/pattern in addition to color (color-blind safe)
- High contrast between tile art and white tile background
- Number/value readable without squinting — optimized for the primary demographic (40-70+)

**Tile Rendering:** SVG-based with CSS custom properties for theming. Tiles are resolution-independent and lightweight. Subtle CSS drop shadow and border-radius for the "acrylic tile" feel. Animations (draw, discard, call) use CSS transitions.

**Themeable Architecture:** The default theme ships as the only theme for MVP — no theme selector, no toggle, no light/dark mode. The default should be beautiful enough that nobody asks for alternatives on day one. However, tile art is structured as SVG components with color values driven by CSS custom properties (suit colors, background, shadow, accent). This allows future tile themes (color palettes, seasonal variants) to be added by swapping a CSS file without changing tile geometry or logic. Think of it like The Mahjong Line's "lines" — same tile shapes, different color stories. Adding a theme selector later is trivial; the architecture just needs to be ready.

### NMJL Card Data Schema (Requirements)

The NMJL card is the central reference for hand validation, scoring, and player guidance. The card data schema must support:

**Hand Pattern Encoding:**
- ~50+ hand patterns per yearly card, organized by category (2468, Quints, Consecutive Run, 13579, Winds-Dragons, 369, Singles and Pairs, etc.)
- Each hand is an ordered sequence of groups
- Each group defines: tile requirement, group size (single/pair/pung/kong/quint/sextet), and concealed/exposed requirement
- Tile requirements support: exact tile (e.g., "3 Bam"), any-suit wildcards ("any one suit," "any three suits"), specific-category wildcards ("any Wind," "any Dragon"), and mixed-tile groups (NEWS, Dragon sets)
- Joker eligibility per group position (Jokers allowed in groups of 3+, never in pairs or singles)
- Point value per hand (typically 25 or 30 points, some special hands higher)

**Systems Powered by This Schema:**
1. **Mahjong validation** — confirms a declared hand matches a card pattern exactly
2. **Hand guidance hints** — highlights which hands are still achievable given current tiles (toggleable, auto-disables after 3 games)
3. **Joker exchange validation** — confirms a natural tile can legally replace a Joker in an exposed group
4. **Scoring** — retrieves the point value for a completed hand

**Shared Hand Evaluation Engine:** These four systems share a single pattern-matching engine. This is the most complex system in the game and should be designed, tested, and validated as a standalone module before integration.

**Hand Guidance UX:**
- Computation runs best-effort on each draw/discard during the natural thinking pause. A sub-100ms delay is invisible to the player.
- Hands are ranked by closeness (tiles away from completion). This turns the NMJL card from a wall of text into a strategic compass.
- Hints display directly on the NMJL card sidebar (desktop) or overlay (mobile) — where the player's eyes already go. Bright = close to completion, faded = far, hidden = impossible.
- No glow or highlighting on rack tiles — that's too noisy and could feel patronizing to experienced players. The hints live on the card, not the rack.
- Toggleable in settings. On by default for a player's first 3 games, then auto-disables with a "Re-enable in settings" message. Host can also toggle hints for all players in room settings.

**Yearly Update Process:**
- Card data stored in a single JSON file loaded at runtime — no code changes required for yearly updates
- Developer (Rchoi) manually encodes the new NMJL card each April when it's released
- A dedicated test suite validates card data integrity: all hands parseable, no duplicate patterns, point values present, group sizes valid, Joker eligibility consistent
- **Ambiguous pattern resolution:** The NMJL card occasionally contains hand descriptions that experienced players interpret differently. The developer (Rchoi) makes the final encoding decision for each ambiguous pattern, documented in a changelog alongside the card data file. The in-game "Challenge" button (see Mahjong Declaration Flow) serves as a safety valve — if a player disputes a validation result, the group can review. Persistent disputes are tracked and resolved in the next card data patch.
- **MVP ships with current year's card only.** No card year selector. The architecture supports loading any card file, so adding previous years later is just data entry + a dropdown. Keep the previous year's data file for internal testing of the yearly update process, but don't expose it to users.

### Game Modes

**MVP Mode:**
- **Standard Play** — Private room, 4 players, full NMJL rules, host-configurable pacing (timed with 15-30 second turns, or relaxed/no timer). This is the only mode at launch.

**Post-MVP Modes (documented for future reference, not in scope):**
- **Practice/Solo** — Play against simple AI opponents to learn mechanics and test hands against the NMJL card
- **Tournament** — Structured multi-round play with bracket management and aggregate scoring
- **Simplified Rules** — A beginner-friendly variant with reduced hand complexity (subset of NMJL card hands, training wheels for new players)
- **Spectator Rooms** — Dedicated view-only rooms for watching games (distinct from the 5th-player spectator overflow in standard play)

---

## Progression and Balance

### Player Progression

Mahjong Night uses **skill-based progression** — there are no unlocks, XP, power-ups, or leveling systems. Players improve through mastery of the game itself: pattern recognition, table reading, defensive discarding, Charleston strategy, and Joker exchange timing.

The hand guidance system (auto-enabled for first 3 games) provides scaffolding for newcomers, then steps back as players develop their own card-reading skills.

#### Player Profiles

**Optional lightweight accounts** — players CAN create an account (email or Google OAuth) to persist their profile across devices and sessions. But joining a game NEVER requires an account. Guests play with a self-chosen display name and a temporary session profile. This preserves the zero-friction USP: share a link, click it, play.

**Account benefits (incentive to sign up, not a gate):**
- Persistent stats across devices and browser clears
- Session history with playback/review
- Social stats (friend tracking, streaks)
- Display name + avatar persisted

**Guest experience:**
- Choose a display name on room join
- Stats tracked in localStorage for the current browser only
- If the guest later creates an account, localStorage stats can be migrated

#### Stats Tracking

**Win/Loss Record:**
- Games played, games won, win rate (percentage)
- Wall games (draws) tracked separately
- Dead hands per game (hopefully rare)

**Session History:**
- Date and time of each session
- Players in the session (names, linked profiles if available)
- Per-game scores and cumulative session score
- Session duration
- Which NMJL card year was used

**Hand Stats:**
- Which NMJL card hands completed (lifetime collection — "I've won with 37 of 50 hands this year")
- Most common winning hand
- Self-drawn Mahjong count (bragging rights — these are rare)
- Concealed hand wins vs. exposed hand wins
- Average tiles-from-wall vs. tiles-from-calls ratio

**Social Stats:**
- Most played-with friends (ranked by session count)
- Total sessions hosted vs. joined
- Longest game night streak (consecutive weeks with at least one session)
- Total hours played

**Privacy:** All stats are visible only to the player by default. No public leaderboards for MVP. Players can optionally share a session summary (screenshot-friendly format) after a game night.

### Difficulty Curve

American Mahjong has a **flat difficulty curve** — the game's inherent challenge is constant every round. The NMJL card doesn't get harder; the *player* gets better at reading it.

Difficulty is **socially governed:**
- Playing with experienced friends is harder (they discard defensively, read the table, compete for the same hands)
- Playing with newcomers is more relaxed
- The game itself does not scale difficulty artificially

**Difficulty support for newcomers:**
- Hand guidance hints (first 3 games, re-enableable)
- Relaxed/no-timer mode for learning groups
- Simplified Joker rules (host option) removes Joker exchange complexity
- The social layer itself is a learning tool — voice chat lets experienced players coach newcomers in real time

### Economy and Resources

_This game does not feature an in-game economy or resource system._ The scoring/payment system (documented in Core Gameplay) is a game mechanic that resets each session, not a persistent economy. No currency, no consumables, no microtransactions.

---

## Level Design Framework

### Structure Type

**Arena/Match** — Mahjong Night is a session-based multiplayer game. Each game is a self-contained match played in a private room. There are no levels, stages, worlds, or content gates.

### Content Structure

The game's content structure is defined by the **session flow** documented in Core Gameplay:

1. Room creation and player join
2. Game configuration (host settings)
3. Charleston
4. Play rounds (turn loop until Mahjong or wall game)
5. Scoreboard and social wind-down
6. Rematch or end session

Each game within a session is a fresh match with a new wall shuffle. Variety comes from the NMJL card (dozens of possible hands to pursue), Charleston (unique starting position every game), and the social dynamics of the group.

### Tutorial Integration

No formal tutorial for MVP. The primary learning path is social — newcomers learn by playing with experienced friends over voice chat. Supporting systems:
- Hand guidance hints (first 3 games)
- Simplified Joker rules (host option)
- Relaxed/no-timer mode

Post-MVP: A practice/solo mode against simple AI (documented in Game Modes) could serve as a tutorial experience.

---

## Art and Audio Direction

### Art Style

**Warm Modern Elegance** — the digital equivalent of a beautifully set game night table. Sophisticated and inviting, never sterile or cluttered. The visual identity balances warmth with refinement, creating an atmosphere that feels like walking into a well-lit living room where friends are already gathered.

**Rendering approach:** CSS/SVG-first. All tiles, UI elements, and illustrations are resolution-independent vectors with CSS-driven theming. No raster art dependencies for core gameplay. Animations via CSS transitions with lightweight JS orchestration where needed.

#### Visual References

- The social warmth of a Jackbox Games lobby — inviting energy, communal feeling — but with more sophistication and polish
- The material quality and tactile feel of Apple's built-in game interfaces (Cards, Chess) — things feel like they have weight and substance
- The color sophistication and curated aesthetic of brands like Rifle Paper Co. and The Mahjong Line's product photography — elevated without being exclusive

#### Color Palette

**Warm, muted, sophisticated with selective vibrancy:**

- **Table/background:** Deep teal felt with subtle texture grain and a fine noise/grain overlay for material authenticity. Teal reads as intentional and designed rather than default poker green, provides excellent contrast for white tile bases and warm UI chrome, and evokes "game night" without cliché. The surface should read as a physical material, not a flat color — think the difference between looking at felt and looking at a colored rectangle. The felt only appears during active gameplay — lobby and scoreboard phases use the same palette with different emphasis (see Three Moods section).
- **UI chrome:** Soft warm neutrals — cream, soft gray, warm white — with brushed matte gold accents for interactive elements and highlights. The gold tone should evoke jewelry box hardware or quality stationery, never metallic shine or casino flash.
- **UI chrome (dark mode):** Dark warm gray/charcoal replaces cream and warm white. Gold accents remain. Felt table and tile rendering are unchanged — tiles actually pop more against darker chrome. See Dark Mode section below.
- **Tile faces:** Clean and crisp against white tile bases — the tiles are the stars, so suit colors (Bam green, Crak red, Dot blue) are the primary source of vibrancy
- **Text and icons:** High-contrast warm dark tones for readability, optimized for the 40-70+ demographic
- **Accent palette:** Celebration gold, subtle success green, gentle alert coral — never harsh or neon

#### Three Moods for Three Phases

The game experience has three distinct emotional phases, and the visual environment should subtly shift to match — same palette, different emphasis. Think of it as designing three rooms in the same home.

**1. Arriving (Lobby/Waiting Room):**
- Warmer, lighter tones — soft cream and warm gold dominate
- No felt table visible yet — a softer, more open space
- The mood is anticipation and social greeting — "come in, sit down"
- Player presence (video/avatars) is the visual focus, front and center
- Feels like an entryway or living room before the table is set

**2. Playing (Active Game):**
- Deep teal felt commands the space — this is the table
- UI chrome recedes to the edges, tiles and interactions take center stage
- The mood is focused engagement with social warmth underneath
- Feels like being seated at a beautiful game table with friends

**3. Lingering (Scoreboard/Wind-Down):**
- Felt recedes, softer warm tones return — but deeper and more relaxed than the lobby
- Scoreboard has generous spacing, unhurried layout
- The mood is satisfaction and social reflection — "that was a great game"
- Feels like settling into the couch after the table is cleared
- Rematch button present but not pushy — let the moment breathe

**Transitions between moods** are gentle crossfades (1-2 seconds), not hard cuts. The shift should feel organic, like the lighting in a room changing as the evening progresses.

#### Camera and Perspective

**Top-down table view** — the player's perspective looking down at their seat at the table. Other players' racks are arranged around the edges (top, left, right) with the shared table center (wall counter, discard pools) in the middle. The player's own rack is at the bottom, largest and most interactive. This mirrors the physical experience of sitting at a Mahjong table.

**UI Layout:**
- **Desktop:** NMJL card sidebar always visible. Chat panel docked to one side. Generous spacing throughout.
- **Mobile:** Full table view with NMJL card as a quick-toggle overlay. Chat accessible via slide-up panel. Tile and button sizes optimized for touch (minimum 44px tap targets).

#### Animation Philosophy

**Tactile by default, Expressive for key moments.**

The animation personality serves the "Effortless Elegance" pillar — things feel real and physical without being distracting. This audience doesn't want constant bouncing, but they DO want interactions to feel substantial.

**Tactile (default for all interactions):**
- Tiles have slight weight — they settle with micro-easing, slide with gentle deceleration
- Drag-and-drop has subtle inertia and satisfying snap-to-position
- Buttons have gentle press states, panels ease in/out smoothly
- Everything feels crisp and efficient — no unnecessary flourishes

**Expressive (reserved for key moments):**
- **Mahjong declaration:** Winning hand fans out to center stage with warm spotlight (see Celebration section)
- **Charleston passes:** Tiles glide across the table with directional motion matching the pass direction
- **Calling a discard:** The called tile animates from the discard pool to the caller's exposed area with a confident trajectory
- **Game start dealing:** Tiles flip from face-down with a satisfying cascading reveal

**Reduced motion:** `prefers-reduced-motion` media query collapses all animations to instant snaps with no easing. No custom toggle — respects the OS-level setting. This includes suppressing the celebration fan-out animation (hand appears fully revealed without the fan), Charleston glide (tiles swap instantly), and all transition easing. Clean and respectful.

#### Player Presence

**Video thumbnails at seat positions with avatar fallback.**

Each player has a presence indicator anchored at their seat position around the table:

- **Camera on:** Small-to-medium video frame — just big enough to feel like looking across a table at your friend. Rounded corners, subtle border matching the UI chrome.
- **Camera off:** A warm circle with the player's initials in friendly typography. A subtle animated ring or glow pulses when their mic detects speech — the "talking" indicator that tells you who's speaking.
- **Camera off + reduced motion:** The talking indicator switches from a pulsing ring to a **static solid colored border** that appears when speaking and disappears when silent. No animation, same information.
- **Minimum (no A/V):** Name label + online/away status dot.

**Responsive behavior:**
- **Desktop:** Video frames are comfortably sized at each seat. Always visible during play.
- **Mobile:** Video frames shrink to small corner thumbnails during active play to preserve table space. Tap any thumbnail to momentarily expand. During non-turn moments (waiting for others), frames can expand slightly.

**Design constraint:** Player presence must never encroach on the game table, rack, or discard pool. The table space is sacred. Social presence lives at the margins.

#### Celebration — Mahjong Declaration Visual

**Understated elegance with cinematic pacing — the hand IS the celebration.**

When Mahjong is declared and validated:

1. **Dim:** Other players' table areas (racks, discard pools) dim slightly (20-30% opacity reduction). **Excluded from dimming:** player video thumbnails/presence indicators (players want to see each other's reactions during this moment), interactive buttons ("show hands," chat), and the winner's entire seat area. All visible text in dimmed areas (player names, scores) must still meet WCAG AA contrast minimums — test dimmed states against both light and dark mode chrome.
2. **The held beat:** A half-second pause. Everyone knows it's coming but hasn't seen it yet. This anticipatory breath is the difference between showing the hand and *presenting* it.
3. **Hand reveal:** The winning hand fans out from the winner's seat position toward center stage — tracing the journey from "my secret hand" to "look what I built." Tiles spread in an elegant arc, face up, at a size large enough to admire individual tiles.
4. **Winner identity:** A warm "Mahjong!" text treatment with the winner's name, styled in the brushed gold accent
5. **Scoring overlay:** Hand value and payment breakdown appear below the fanned hand
6. **Signature motif plays** (see Audio section)
7. **Social layer erupts:** The voice chat, reactions, and text chat provide the real fireworks — the UI just sets the stage

**Reduced motion variant:** Skip the fan-out animation and held beat. Hand appears fully revealed at center stage immediately. Dim and spotlight still apply (these are opacity changes, not motion).

No confetti. No particles. No screen flash. The elegance IS the celebration. This audience wants to *admire* the winning hand — it's inherently impressive to experienced players. The restraint signals taste and confidence.

**Duration:** The celebration holds for 5-8 seconds before transitioning to the scoreboard/lingering phase. Not rushed, not lingering — enough time for the table to react.

#### First-Visit Visual Entrance

On the very first load, a graceful 2-second entrance sets the aesthetic tone before anything else:

- The felt texture fades in from a warm neutral
- Tiles materialize subtly — a hint of what's to come
- No logo splash, no loading bar — just the environment coming alive

This is the player's first impression of the game's visual quality. It should immediately communicate "oh, this is *nice*" before they think about Mahjong mechanics. Subsequent visits skip this entrance — it's a one-time moment. Under `prefers-reduced-motion`, the entrance is skipped entirely; the table appears instantly.

#### Dark Mode

**System-preference auto-switch with manual override.**

A `prefers-color-scheme: dark` CSS media query automatically shifts the UI chrome to dark warm tones for evening play. A manual override in settings offers three options: **Auto** (follow system, the default), **Light**, and **Dark**. The manual override exists for edge cases — screen-sharing where the viewer expects a bright screen, personal preference that differs from system setting — without adding any friction for the default experience.

**What changes:**
- UI chrome shifts from cream/warm-white to dark warm gray/charcoal
- Text inverts to light-on-dark with maintained WCAG AA contrast ratios
- Gold accents remain unchanged — they warm up beautifully against dark backgrounds
- Panel borders and shadows adjust for dark context
- Three Moods phase transitions adapt (Arriving, Playing, Lingering all have dark variants)

**What stays the same:**
- Felt table texture and color (deep teal) — unchanged
- Tile rendering — white tile bases with colored faces, unchanged
- Player presence frames — unchanged
- All interactive element behavior — unchanged

**Implementation:** Trivial with CSS custom properties already planned for the theming architecture. All color values driven by custom properties that swap under the media query or manual class override. Settings toggle stored in localStorage.

### Audio and Music

**Design principle:** Sound serves as tactile feedback, not entertainment. Every sound makes an interaction feel more physical and satisfying. Audio coexists with voice chat — never competes.

#### Music Style

**Minimal by default.** Background music is off by default since most sessions will have active voice/video chat. An optional ambient lo-fi/jazz track is available in settings for players who want atmosphere during text-only games — warm, unobtrusive, and loopable. Volume independent from sound effects.

#### Sound Design

**Tactile and satisfying — like premium acrylic tiles on felt:**

The target timbre for all tile sounds is **real acrylic or Bakelite tiles on a felt surface**. When sourcing or designing sounds, use recordings of physical Mahjong tiles as the reference — the specific weight, resonance, and texture of real tiles is distinctive and cannot be replicated with generic UI click sounds. This authenticity is what makes the sound design feel like Mahjong, not just "a game."

- **Tile draw:** A soft, satisfying click — the sound of picking up a tile from the wall
- **Tile discard:** A crisp clack against the table — slightly more assertive than the draw. This sound is part of the game's rhythm and should be clearly audible — it signals "the game is alive" and helps players track the pace of play.
- **Rack arrangement:** Gentle sliding sounds when dragging tiles — subtle, not every pixel of movement
- **Call (Pung/Kong/Quint):** A confident snap when exposing a group — the "I'm taking that" moment
- **Mahjong declaration:** A signature **3-4 note musical motif** — warm, celebratory, and instantly recognizable. Think the Netflix "ta-dum" but softer and more joyful. This brief melodic phrase becomes Mahjong Night's audio identity — players should hear it in their head when they think about the game. Followed by a satisfying cascade as the winning hand fans out.
- **Charleston pass:** A soft whoosh as tiles slide across the table
- **Turn notification:** A clear, pleasant ping tuned to cut through active voice conversation — audible enough that a player chatting with friends won't miss their turn, but not jarring or alarming. This is a critical usability sound for the primary audience.
- **Call window alert:** A brief, distinct tone that creates urgency without anxiety
- **Chat/reaction:** Subtle pop for incoming messages; quick, expressive sounds for reactions
- **Timer warning:** A gentle escalating tone in the final seconds — informative, not stressful
- **Error/invalid action:** A soft, forgiving "nope" sound — never punishing

**Audio priority:** Gameplay feedback sounds > notification sounds > ambient/music. All categories independently adjustable in settings. Master mute toggle always accessible.

#### First-Launch Audio Preview

On a player's first game join, a brief audio showcase plays during the loading/lobby moment: a tile draw click, a discard clack, and the Mahjong signature motif — a 3-second preview that says "this game has sound, and it's worth keeping on." A subtle toast appears: "Sound is on. Adjust in settings." This ensures players discover the sound design rather than playing in permanent silence because they never knew audio existed.

#### Voice/Dialogue

**None** — the players are the voices. No narrator, no character VO, no tutorial voice. The communication layer (voice, video, text, reactions) IS the dialogue system.

### Aesthetic Goals

**How art and audio support the game pillars:**

| Pillar | Art Support | Audio Support |
|---|---|---|
| **Faithful Play** | Tile art is instantly recognizable to experienced players. Clear, readable suit markings with corner indices. Top-down layout mirrors physical table. | Tile sounds sourced from real acrylic-on-felt reference — draw, discard, and call sounds evoke the physical game. |
| **Social Connection** | Warm teal felt, cozy atmosphere, and player video presence at each seat make the space feel like a gathering. Three visual moods (arriving, playing, lingering) mirror the emotional arc of a game night. Celebration moments set the stage for social eruption. | Audio stays out of the way of voice chat. Turn notifications tuned to cut through conversation. Reaction sounds add shared expression. |
| **Effortless Elegance** | Tactile animations with weight and settle. Brushed gold accents. Understated Mahjong celebration with cinematic pacing — the held beat, the fan from seat to center. Auto dark mode for evening play. First-visit visual entrance sets the tone. | Every interaction has satisfying audio feedback. The 3-4 note Mahjong motif gives the game a memorable audio identity. First-launch preview ensures players experience the soundscape. |
| **Inclusive by Design** | High contrast, large readable text, color-blind-safe tile suits, comprehensive reduced motion support (including static talking indicators and celebration variants), system dark mode with manual override. WCAG compliance maintained in all visual states including celebration dim. Video frames shrink on mobile to preserve table space. | All audio is toggleable. Visual equivalents exist for all audio cues. No audio-only information. Notification sounds tuned for audibility during conversation. |

---

## Technical Specifications

### Performance Requirements

Mahjong Night is a lightweight web application rendering SVG tiles with CSS transitions — not a GPU-intensive game. Performance targets reflect this simplicity and the need for reliability across the primary audience's devices.

#### Frame Rate Target

- **Target:** 60fps for all animations (tile draw, discard, rack arrangement, Charleston passes)
- **Acceptable floor:** 30fps on low-end mobile devices during simultaneous WebRTC video + game animations
- **Below 30fps is a bug** — file and fix as a P1 issue

#### Resolution Support

- **Minimum viewport width:** 375px (iPhone SE — the practical floor)
- **Design target:** 390px+ (modern full-size phones)
- **No maximum:** SVG rendering is resolution-independent. Scales cleanly to ultrawide/4K desktop monitors
- **Responsive breakpoints:** Mobile (<768px), Tablet (768-1024px), Desktop (>1024px)

#### Load Times

- **Initial load:** Under 3 seconds on broadband, under 5 seconds on 3G
- **Subsequent visits:** Near-instant with cached assets
- **Room join to first interaction:** Under 2 seconds after page load
- **First-visit entrance animation** (defined in Art & Audio) covers the initial load naturally

#### Build Size

- **Core application bundle:** Under 5MB (HTML, CSS, JS, SVG tile assets, NMJL card JSON)
- **WebRTC SDK:** Loaded separately, size determined by chosen vendor (LiveKit, Daily, etc.)
- **SVG tile set:** Estimated under 200KB for all 152 tile faces — a major advantage of vector rendering

### Platform-Specific Details

#### Web Browser Requirements

- **Supported browsers:** Chrome, Firefox, Safari, Edge (latest two versions)
- **Required browser APIs:** WebSocket, WebRTC (getUserMedia, RTCPeerConnection), Drag and Drop API, CSS Custom Properties, SVG rendering
- **Mobile browsers:** iOS Safari 16+, Android Chrome — tested on real devices, not just emulators
- **No polyfills for legacy browsers** — the supported browser matrix covers 95%+ of the target audience

#### Desktop-Specific

- **Keyboard navigation:** First-class input method (Tab, Arrow keys, Enter, Escape)
- **Hover states:** Visual feedback on tile hover, call button hover
- **Multi-monitor:** No special handling needed — standard responsive web behavior

#### Mobile-Specific

- **Touch targets:** Minimum 44px per WCAG guidelines
- **Orientation:** Landscape recommended, portrait supported with adapted layout
- **Browser chrome:** Account for mobile browser address bars and navigation (safe area insets)
- **Permissions:** Graceful handling of mic/camera permission prompts — guide the user, don't assume

#### Network Requirements

- **Latency tolerance:** 200ms round-trip is acceptable for turn-based play (15-30 second turns provide ample buffer)
- **Call window:** 3-5 second window has sufficient buffer for network variance
- **Bandwidth:** Game state over WebSocket is minimal (small JSON payloads). Voice/video is the primary bandwidth consumer — managed by the WebRTC SDK
- **Graceful degradation:** If voice/video connection fails, fall back to text-only without losing game state. Network issues should never crash the game

### Asset Requirements

#### Art Assets

- **Tile faces:** SVG components (152 unique faces across suits, winds, dragons, flowers, jokers). CSS custom properties for color theming. Estimated under 200KB total
- **UI elements:** SVG icons for buttons, indicators, and status displays. CSS-rendered panels, modals, and overlays
- **Table surface:** CSS-generated felt texture with noise/grain overlay — no raster image dependency
- **Player presence:** Browser-native video elements for WebRTC. CSS-styled avatar fallbacks (initials in circles)
- **No raster art dependencies** for core gameplay — everything is vector or CSS

#### Audio Assets

- **Sound effects:** 10-12 distinct effects (tile draw, discard, call snap, Charleston whoosh, turn notification, call alert, chat pop, timer warning, error tone, Mahjong motif, dealing cascade)
- **Source:** Royalty-free libraries or custom recordings of real acrylic Mahjong tiles on felt
- **Format:** Web-optimized (MP3/OGG), short duration (under 2 seconds each except Mahjong motif at 3-4 seconds)
- **Optional ambient track:** One lo-fi/jazz loop for text-only sessions. Separate from sound effects
- **Total audio footprint:** Estimated under 500KB

#### External Assets

- **WebRTC SDK:** Third-party service (LiveKit, Daily.co, or Twilio) — evaluated in Architecture workflow
- **Fonts:** 1-2 web fonts for UI typography, loaded via standard font-loading strategies
- **No asset store purchases, no licensed art** — CSS/SVG-first approach keeps the project self-contained

### Technical Constraints

- **Server-side state:** Authoritative game state held in server memory for the duration of active sessions (required for reconnection and anti-cheat). No durable persistence — server restart loses active games. Durable persistence is post-MVP
- **WebRTC dependency:** Voice/video quality is constrained by the chosen third-party SDK and TURN/STUN server infrastructure. Budget for TURN server costs
- **NMJL card data:** Manually encoded yearly by developer. Card data JSON loaded at runtime — no code changes for yearly updates
- **No native app for MVP:** Browser-only. Architecture should support future native client (shared game logic layer) but MVP does not build one
- **Technology selection (framework, state management, server runtime) deferred to Architecture workflow**

---

## Development Epics

### Epic Overview

| # | Epic | Phase | Dependencies | Est. Stories |
|---|------|-------|-------------|-------------|
| 1 | Game Engine + Visual Prototype | Foundation | None | 8-10 |
| 2 | NMJL Card System | Foundation | 1 | 6-8 |
| 3A | Turn Flow & Calling | Playable Game | 1, 2 | 8-10 |
| 4A | Core Multiplayer | Playable Game | 1 | 8-10 |
| 5A | Core Game UI | Playable Game | 3A, 4A | 10-12 |
| 3B | Charleston | Complete Rules | 3A, 5A | 5-7 |
| 3C | Advanced Rules | Complete Rules | 3A, 5A | 6-8 |
| 6A | Text Chat & Reactions | Complete Rules | 4A | 4-5 |
| 4B | Multiplayer Resilience | Polish & Social | 4A, 5A | 6-8 |
| 5B | Remaining UI | Polish & Social | 5A, 3B | 8-10 |
| 6B | Voice & Video (WebRTC) | Polish & Social | 4A, 5A | 8-10 |
| 7 | Visual Polish & Audio | Polish & Social | 5A | 8-10 |
| 8 | Profiles, Stats & Remaining Accessibility | Polish & Social | 5A | 6-8 |

### Phased Development Plan

**Phase 1 — Foundation (Weeks 1-4)**
Build the game's brain and its central data system. A minimal visual harness provides early feedback and developer motivation.

**Phase 2 — Playable Game (Weeks 5-10)**
Stand up multiplayer and core UI. First real 4-player playtest with humans by week 10.

**Phase 3 — Complete Rules (Weeks 11-16)**
Layer in Charleston, advanced rules, and lightweight social features. The game becomes fully rule-complete.

**Phase 4 — Polish & Social (Weeks 17-22)**
Resilience, remaining UI, voice/video, visual polish, profiles, and accessibility hardening. Epics in this phase are parallelizable and individually cuttable.

### Recommended Sequence

```
Phase 1:  [Epic 1] ──> [Epic 2]
Phase 2:  [Epic 3A] + [Epic 4A] ──> [Epic 5A]
          >>> MILESTONE: First 4-player playtest <<<
Phase 3:  [Epic 3B] + [Epic 3C] + [Epic 6A]
Phase 4:  [Epic 4B] + [Epic 5B] + [Epic 6B] + [Epic 7] + [Epic 8]
                                   ^^^ CUT LINE
```

**Cut line:** If the timeline is tight, Epic 6B (Voice/Video) is the explicit cut target. The game ships with text chat and reactions; WebRTC voice/video is added as a fast-follow. The game brief's own risk mitigation plan endorses this approach.

### Vertical Slice

**The first playable milestone is after Epic 5A (end of Phase 2).** Four players can join a room via shared link, see tiles on screen, draw, discard, call Pungs/Kongs/Quints, declare Mahjong, and see scores — in a real browser with real UI. No Charleston yet, no Joker exchange, no voice/video, but the core game loop is proven with humans.

### Cross-Cutting Concerns

**Accessibility:** Structural accessibility (semantic HTML, ARIA labels, keyboard navigation, 44px tap targets, `prefers-reduced-motion`) is embedded in every UI epic (5A, 5B, 7), not deferred. Epic 8 covers screen reader testing, high contrast mode, color-blind tile patterns, and font size settings.

**Server Authority:** Epic 1's state machine uses a command/action pattern (player submits action, engine validates, returns new state) from day one. This prevents rework when the server becomes authoritative in Epic 4A.

**Infrastructure:** Deployment and hosting (WebSocket server, static assets, TURN/STUN for WebRTC) are addressed as stories within Epic 4A.

---

## Success Metrics

### Technical Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Frame rate | 60fps sustained, never below 30fps | Browser performance profiling, automated lighthouse audits |
| Initial load time | <3s broadband, <5s 3G | Real User Monitoring (RUM), synthetic testing |
| Bundle size | <5MB (excluding WebRTC SDK) | Build pipeline size check |
| WebSocket uptime | 99.9% during active sessions | Server-side monitoring, uptime tracking |
| Game state sync latency | <200ms p95 | Server-side action timestamp logging |
| WebRTC connection success | >90% on first attempt | WebRTC SDK analytics, client error logging |
| Reconnection success rate | >95% within 30s grace period | Server-side reconnection event logging |
| Crash rate | <0.1% of sessions | Error tracking (Sentry or similar) |
| Client error rate | <1% of actions produce unhandled error | Error tracking with action context |

### Gameplay Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Time from link click to first turn | <90 seconds | Client-side event timestamps |
| Average session length | 60-90 minutes | Session start/end tracking |
| Games per session | 2-4 | Server-side game completion events |
| Rematch rate | >70% of completed games | Server-side rematch tracking |
| Wall game frequency | 10-20% of games | Game outcome logging (balance indicator) |
| Dead hand frequency | <5% of player-games | Dead hand event logging (UX indicator) |
| Social override usage | Track frequency, no target | Override event logging |
| Hand guidance disable rate | >50% disable after 3 games | Client-side settings tracking |
| Feature discovery (chat) | >80% use chat in first session | Chat event logging |
| Charleston completion time | Track average, no target | Phase timing events |

### Qualitative Success Criteria

- **"It feels like game night."** Players on voice chat are laughing, groaning, teasing — the social energy matches in-person play. If sessions are quiet, the social layer isn't working.
- **"This is real Mahjong."** Experienced players trust the rules immediately. No one says "that's not how it works" after the first few games. Zero rule disputes is the target.
- **"It's beautiful."** Primary audience testers use words like "gorgeous," "elegant," or "love the tiles" — not just "easy to use." The visual design is something they'd show friends.
- **"My mom could use this."** A newcomer can join via link and play their first game with voice-chat coaching from friends without getting stuck on the UI.
- **"We switched from Zoom."** At least one existing game group adopts Mahjong Night as their regular platform instead of their current workaround.
- **"When's the next game?"** Players proactively schedule sessions. The game becomes a recurring social event, not a one-time novelty.

### Metric Review Cadence

- **During development:** Track technical metrics from Epic 4A onward (first multiplayer). Review weekly.
- **Playtesting (post-Epic 5A):** Collect all gameplay metrics and qualitative feedback after each playtest session. Debrief with testers immediately after.
- **Soft launch:** Review all metrics weekly for the first month. Prioritize fixes based on metric gaps.
- **Ongoing:** Monthly review of engagement metrics. Annual review when new NMJL card is released (check wall game frequency, hand guidance usage patterns with new card).

---

## Out of Scope

The following are explicitly **not** part of the MVP:

- Native mobile app (iOS/Android)
- Public matchmaking or random opponents
- AI/bot opponents for solo play
- Tournament mode
- In-app purchases or monetization
- Multiple NMJL card years selectable by users
- Spectator-only rooms (distinct from 5th-player overflow)
- Formal tutorial or guided onboarding
- Public leaderboards
- Internationalization/localization

---

## Assumptions and Dependencies

### Assumptions

- Players have a stable internet connection (broadband or strong mobile data)
- Players use a modern browser (Chrome, Firefox, Safari, Edge — latest two versions)
- The NMJL publishes a new card annually and the format remains structurally similar year to year
- A third-party WebRTC SDK (LiveKit, Daily, or Twilio) provides acceptable voice/video quality without building from scratch
- The primary audience (40-70+) is comfortable with basic browser interactions (clicking links, granting mic/camera permissions with guidance)
- NMJL card data can be manually encoded by the developer each year within a reasonable timeframe (1-2 days)
- 4-player games are the only supported player count (no 2-player or 3-player variants)

### Dependencies

- **NMJL card copyright:** Legal research needed on encoding card hand data. May require a "bring your own card" input model
- **WebRTC SDK selection:** Must be evaluated during Architecture workflow — cost, reliability, and browser support are selection criteria
- **TURN/STUN server infrastructure:** Ongoing hosting cost for WebRTC relay. Required for reliable voice/video across NAT/firewalls
- **Hosting infrastructure:** WebSocket server requires always-on hosting (not serverless). Server costs scale with concurrent rooms

---

## Document Information

**Document:** Mahjong Night - Game Design Document
**Version:** 1.0
**Created:** 2026-03-25
**Author:** Rchoi
**Status:** Complete

### Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-25 | Initial GDD complete |
