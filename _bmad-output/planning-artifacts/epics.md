---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/gdd.md
  - _bmad-output/game-architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# Mahjong Night - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Mahjong Night, decomposing the requirements from the GDD, Architecture, and UX Design Specification into implementable stories with full acceptance criteria.

## Requirements Inventory

### Functional Requirements

**Room Management & Access**
- FR1: Create private rooms with shareable links (zero-friction access)
- FR2: Exactly 4 players required to start a game
- FR3: 5th player sees "table is full" page with spectator mode (read-only, no racks visible)
- FR4: Host can modify game settings between games (not mid-game)
- FR5: Setting change notifications displayed to all players
- FR6: Collapsible current game settings panel accessible to all players
- FR7: Guest play with self-chosen display name (no account required to join)

**Dealing & Seating**
- FR8: Random seat assignment with wind designation (East, South, West, North)
- FR9: East is first dealer; receives 14 tiles, others receive 13
- FR10: Default instant dealing with tile-flip animation
- FR11: Optional animated traditional dealing (host setting)
- FR12: Dealer rotation clockwise after each game

**Core Turn Flow**
- FR13: Counterclockwise play direction (East -> South -> West -> North)
- FR14: East's first turn: evaluate 14 tiles and discard (no draw)
- FR15: Draw tile from wall on each subsequent turn
- FR16: Evaluate hand against NMJL card patterns
- FR17: Two-step discard: select tile (lifts), confirm button appears in fixed action zone (viewport-aware)
- FR18: Drag-and-drop discard as opt-in via settings

**Calling System**
- FR19: Hybrid call window after each discard (3-5 sec timer, configurable by host)
- FR20: Players can click "Pass" to close window early (all pass = immediate close)
- FR21: Mahjong call always has priority over all other calls
- FR22: Multiple Mahjong calls: priority by turn order (counterclockwise from discarder)
- FR23: Non-Mahjong calls: priority by seat position (counterclockwise from discarder)
- FR24: Call confirmation: expose required tiles from rack within 5 seconds
- FR25: Invalid call retraction: call auto-retracted, window reopens for remaining time
- FR26: Call window freezes for all players once any call is clicked
- FR27: No Chi/Chow calls (sequences not allowed)
- FR28: No calling for pairs (except for Mahjong on final tile)
- FR29: Call validation against NMJL card patterns (group-level, not hand-level)
- FR30: Dynamic call buttons reflecting valid options based on discard and player's rack
- FR31: Support for pattern-defined groups (NEWS, Dragon sets) in addition to same-tile groups

**Charleston**
- FR32: First Charleston mandatory: Right, Across, Left (all players)
- FR33: Second Charleston optional: requires unanimous vote from all 4 players
- FR34: Courtesy pass: 0-3 tiles with across player (lower count used on disagreement)
- FR35: Blind passing rule: tile selection locked before Across tiles revealed (Left pass in 1st, Right in 2nd)
- FR36: Jokers CAN be passed during Charleston
- FR37: Tile selection UI: tap-to-select or drag to passing zone
- FR38: Direction indicator showing current pass direction

**NMJL Card System**
- FR39: Machine-readable card data in JSON format (~50+ hand patterns per year)
- FR40: Hand pattern encoding: ordered groups with tile requirements, group sizes, concealed/exposed, Joker eligibility, point values
- FR41: Card display as slide-in panel from right on desktop (~280px), always toggle-accessible
- FR42: Card display as full-screen overlay on mobile — one tap open/close
- FR43: Hand guidance system: highlights achievable hands ranked by closeness on the card display
- FR44: Hand guidance on by default for first 3 completed games, then auto-disables with re-enable message
- FR45: Host can toggle hints for all players in room settings
- FR46: Card data loaded at runtime — no code changes for yearly updates
- FR47: Card data test suite (parseable hands, no duplicates, valid point values, consistent Joker eligibility)
- FR48: MVP ships with current year's card only
- FR49: Shared hand evaluation engine for validation, guidance, Joker exchange, and scoring

**Joker Rules**
- FR50: Standard NMJL Joker rules (default): 8 Jokers, substitute in groups of 3+, cannot be in pairs/singles
- FR51: Jokers cannot be discarded from rack
- FR52: Dead Joker if somehow discarded — no player can call it
- FR53: Joker exchange: swap natural tile for Joker in any exposed group (own turn, before discard)
- FR54: Multiple exchanges allowed per turn
- FR55: Group identity fixed at exposure (exchange doesn't change group identity)
- FR56: Simplified Joker rules (host option): no Joker exchange

**Exposure Rules**
- FR57: Called groups displayed face-up, visible to all for rest of game
- FR58: Exposed groups cannot be rearranged or broken apart
- FR59: Clear UI distinction between concealed (rack) and exposed groups

**Concealed vs. Exposed Hands**
- FR60: Support for concealed (C) and exposed (X) hand requirements per NMJL card
- FR61: Mixed hands: concealed/exposed at group level, not just hand level
- FR62: Validation that concealed groups were not formed via calls
- FR63: Hand guidance auto-filters achievable hands based on current exposed groups

**Win/Loss & Declaration**
- FR64: Mahjong button always visible, always clickable — fixed position in action zone
- FR65: Auto-validation against NMJL card data before reveal to other players
- FR66: Invalid Mahjong: private notification with Cancel option
- FR67: Confirmed invalid declaration after dismissing warning = dead hand
- FR68: Challenge button for disputed validations (group review safety valve with 30-second vote, majority rules 3/4)
- FR69: Self-drawn Mahjong: declare before discarding when wall draw completes hand

**Celebration & Post-Game**
- FR70: Full celebration sequence: dim (20-30% opacity on non-winner areas, excluding video thumbnails), held beat (0.5s), hand fan-out from seat to center, winner spotlight with brushed gold "Mahjong!" text, scoring overlay, signature 3-4 note motif
- FR71: Discard Mahjong: discarder pays 2x, other 2 losers pay 1x hand value
- FR72: Self-drawn Mahjong: all 3 losers pay 2x hand value
- FR73: Wall game (draw): no payments
- FR74: Hand values from NMJL card (typically 25-50 points)
- FR75: Session scoreboard: running total of payments across all games

**Dead Hands**
- FR76: Dead hand triggers: incorrect declaration (confirmed), invalid exposure (irretractable), wrong tile count, table talk (upheld report)
- FR77: Dead hand behavior: draw/discard normally, cannot call discards
- FR78: Other players CAN call dead hand player's discards
- FR79: Dead hand player's exposed tiles remain visible

**Table Talk Report**
- FR80: Table Talk Report button (distinct from Social Override)
- FR81: Report sent to all other players as majority vote (2 of 3 must agree)
- FR82: If upheld: reported player gets dead hand for current game
- FR83: Max 2 Table Talk Reports per player per game (denied counts toward limit)

**Social Override**
- FR84: Undo for accidental discards, mistaken calls, Charleston passing errors only
- FR85: Requires unanimous consent (3 of 3 non-requesting players)
- FR86: Undo window: before next irreversible game state change (draw from wall or resolved call)
- FR87: Silence = deny (auto-dismiss after 10 seconds)
- FR88: All overrides logged and visible to host for transparency

**Turn Timeout & AFK**
- FR89: Configurable timer (15-30 sec default)
- FR90: No-timer mode (group self-regulates)
- FR91: First timeout: gentle nudge + time extension
- FR92: Second timeout: auto-discard most recently drawn tile
- FR93: Third+ consecutive: AFK vote (2 of 3) to convert to dead seat

**Player Departure**
- FR94: Departure notification to remaining players
- FR95: Host decision prompt: dead seat or end game (majority vote)
- FR96: Dead seat: locked hand, auto-pass turns, draws skipped
- FR97: Multi-departure (2+): game auto-ends immediately
- FR98: Host departure: host migration to next player in seat order
- FR99: No AI fill-in for MVP

**Wall Management**
- FR100: Wall counter visible to all players throughout game
- FR101: Wall game trigger: last tile drawn/discarded with no Mahjong and no call
- FR102: Last tile self-drawn Mahjong allowed
- FR103: Last discard can be called for any valid purpose (no "hot wall" restriction in MVP)

**Reconnection**
- FR104: Grace period (~30 sec) for reconnection
- FR105: Full game state restore on reconnect (board, rack, scores, chat history)
- FR106: "Player is reconnecting..." indicator for other players
- FR107: Phase-specific reconnection: Charleston auto-pass after grace period, call window forfeited, turn auto-discard
- FR108: Simultaneous disconnection (2+): game pauses entirely
- FR109: 2-minute timeout for multi-disconnect — game auto-ends if unresolved
- FR110: WebRTC auto-reconnect on rejoin with fallback to text-only

**Communication**
- FR111: Text chat always accessible during all game phases
- FR112: Quick reactions (one-tap emoji/reaction, persistent row of 4-6 reactions)
- FR113: Voice chat via WebRTC (third-party SDK)
- FR114: Video chat via WebRTC (third-party SDK)
- FR115: Voice/video toggle controls (mic/camera icons)
- FR116: "Reconnect A/V" button if connection fails

**Controls & Input**
- FR117: Desktop: hybrid click and drag-and-drop tile interaction
- FR118: Mobile: touch-based tap-to-select and drag-and-drop with 44px tap targets
- FR119: Keyboard navigation: Tab cycles zones (Rack -> Actions -> NMJL -> Chat -> Controls), Arrow keys navigate within, Enter confirms, Escape exits chat
- FR120: Rack arrangement via drag-and-drop with snap-to-position
- FR121: Sort rack button (single mode: by suit, then number)
- FR122: Per-player discard pool in chronological rows (matching physical play)

**Player Profiles & Stats**
- FR123: Optional lightweight accounts (email or Google OAuth)
- FR124: Guest play with self-chosen display name and session profile
- FR125: Account benefits: persistent stats, session history, social stats, display name + avatar
- FR126: Guest stats tracked in localStorage (migratable to account)
- FR127: Stats: win/loss record, session history, hand stats, social stats
- FR128: All stats private by default; optional shareable session summary

**Scoreboard & Post-Game**
- FR129: Post-game celebration sequence with winner spotlight
- FR130: Optional "show hands" — all players can reveal racks after game end
- FR131: Cumulative session scoreboard
- FR132: Rematch button (present but not pushy — "let the moment breathe")
- FR133: Linger time for social wind-down (chat, voice remain active)

### NonFunctional Requirements

**Performance**
- NFR1: 60fps target for all animations; 30fps acceptable floor on low-end mobile with WebRTC
- NFR2: Below 30fps is a P1 bug
- NFR3: Initial load <3 seconds on broadband, <5 seconds on 3G
- NFR4: Room join to first interaction <2 seconds after page load
- NFR5: Core application bundle <5MB (HTML, CSS, JS, SVG tiles, NMJL card JSON)
- NFR6: SVG tile set estimated <200KB total
- NFR7: Total audio footprint estimated <500KB
- NFR8: Hand guidance computation sub-100ms per draw/discard

**Platform & Browser**
- NFR9: Browser support: Chrome, Firefox, Safari, Edge (latest two versions)
- NFR10: Mobile: iOS Safari 16+, Android Chrome — tested on real devices
- NFR11: No polyfills for legacy browsers
- NFR12: Minimum viewport width: 375px (iPhone SE)
- NFR13: Design target viewport: 390px+; primary design target: iPad landscape (1024px)
- NFR14: Responsive breakpoints: Phone (<768px), Tablet (768-1023px), Desktop (>=1024px)
- NFR15: SVG rendering — resolution-independent, scales to ultrawide/4K

**Network & Reliability**
- NFR16: Latency tolerance: 200ms round-trip acceptable for turn-based play
- NFR17: WebSocket uptime 99.9% during active sessions
- NFR18: Game state sync latency <200ms p95
- NFR19: WebRTC connection success >90% on first attempt
- NFR20: Reconnection success rate >95% within 30s grace period
- NFR21: Crash rate <0.1% of sessions
- NFR22: Client error rate <1% of actions produce unhandled error
- NFR23: Graceful degradation: voice/video failure falls back to text-only without losing game state
- NFR24: Network issues must never crash the game

**Accessibility**
- NFR25: Font size adjustable in settings (default optimized for 40-70+ demographic)
- NFR26: High contrast mode for tile suits and numbers
- NFR27: Color-blind support: tile suits distinguished by shape/pattern in addition to color
- NFR28: Reduced motion: respect prefers-reduced-motion CSS media query — 0ms for ALL animations, no exceptions
- NFR29: ARIA labels on all interactive elements from day one
- NFR30: Minimum 44px touch targets per WCAG; 8px minimum gap between adjacent interactive elements
- NFR31: Keyboard navigation as first-class input method (Tab zones, Arrow keys, Enter, Escape)
- NFR32: Screen reader testing and optimization is post-MVP (semantic foundation ships in MVP)
- NFR33: WCAG AA contrast minimums (4.5:1 normal text, 3:1 large text and UI components) maintained in all states including celebration dim
- NFR34: No text smaller than 14px anywhere in the application

**Architecture & Design**
- NFR35: Server-side authoritative game state (in memory for session duration)
- NFR36: No durable persistence for MVP — server restart loses active games
- NFR37: Command/action pattern from day one (player submits action, engine validates, returns state)
- NFR38: CSS/SVG-first rendering — no heavy game engine, no raster art dependencies
- NFR39: CSS custom properties for theming (future tile themes via CSS swap)
- NFR40: Architecture supports future native client (shared game logic layer)
- NFR41: Dark mode: system-preference auto-switch with manual override (Auto/Light/Dark)
- NFR42: Technology selection: Vue 3 + TypeScript (client), Node.js + Fastify + ws (server), pnpm monorepo

**Security & Integrity**
- NFR43: Server holds authoritative game state (anti-cheat); opponent racks never transmitted to other clients
- NFR44: No account required to join a game (zero-friction USP)
- NFR45: Voice/video via WebRTC with TURN/STUN server infrastructure
- NFR46: Input sanitization: chat capped at 500 chars, display names at 30 chars, reaction emoji allowlist
- NFR47: Rate limiting: chat 10/10s, reactions 5/5s per player
- NFR48: No v-html in codebase (XSS prevention); all user strings via Vue text interpolation only

**Usability Targets**
- NFR49: New player joins and completes first turn within 90 seconds of clicking link
- NFR50: Voice/video connection establishes within 5 seconds in 95% of sessions
- NFR51: Zero rule-accuracy bugs reported by experienced playtesters across 10+ games

### Additional Requirements

**From Architecture:**
- AR1: pnpm monorepo with three packages: shared/, client/, server/
- AR2: Shared package contains pure TypeScript game engine — no browser or Node.js API dependencies; zero runtime dependencies
- AR3: Validate-then-mutate action handler convention in all game logic (no partial mutations on rejection)
- AR4: JSON over WebSocket protocol with version field in every message from day one
- AR5: Action/State model — no optimistic updates; client renders only server-confirmed state
- AR6: Server-generated UUID session token in sessionStorage for identity/reconnection; one active connection per token
- AR7: HTTP room creation (POST /api/rooms) + WebSocket join for API layer separation; GET /api/rooms/:code/status for capacity check
- AR8: 6-character alphanumeric room codes for human-friendly sharing
- AR9: Color-group suit abstraction in NMJL card schema (A/B/C = same/different suit) with value wildcards
- AR10: Server-timed call window with client freeze broadcast; seat-position priority (not click speed); pass tracking for early close
- AR11: Full-state resend on reconnection (same protocol as initial join); PlayerGameView per-recipient filtering
- AR12: Three-tier error handling: result objects (shared), structured responses (server), friendly UX (client)
- AR13: Pino v9.x logging with child loggers per room; never log rack contents in production
- AR14: Three-tier configuration: constants (shared/constants.ts), host settings (room state), preferences (Pinia -> localStorage)
- AR15: TypeScript strict: true in all three package tsconfigs — no exceptions; no @ts-ignore without justification comment
- AR16: Co-located tests (foo.ts -> foo.test.ts); E2E tests in client/e2e/ with Playwright; pnpm -r test runs all suites
- AR17: Feature-based directory organization within each package
- AR18: Single SVG sprite sheet for all 152 tile faces as <symbol> elements; Tile.vue uses <use href="#tile-id">
- AR19: Debug panel (Ctrl+Shift+D), server debug endpoint (env-gated), multi-seat testing mode — all dev-only
- AR20: No database for MVP; all state in-memory (server) or browser storage (client)
- AR21: Motion for Vue (motion-v) for unified animation API across all interactions; 5KB, native prefers-reduced-motion support
- AR22: Vue DnD Kit for accessible drag-and-drop (keyboard + screen reader support built-in)
- AR23: VueUse composables for WebSocket (useWebSocket), localStorage, media queries, permissions
- AR24: UnoCSS with presetWind4 for utility-first styling with CSS custom properties
- AR25: Deployment provider deferred; requires persistent WebSocket (rules out serverless)
- AR26: useGameState composable for server-pushed game state (not Pinia); Pinia for UI-only state (rack arrangement, preferences, audio, chat, connection, hand guidance)
- AR27: Node.js 22 LTS pinned via .nvmrc; server runs via tsx for native TypeScript
- AR28: Vite 8 build tool; shared/ consumed via source imports (no build step)
- AR29: Vue Router for minimal routing (/room/:id); no SSR, no meta-framework
- AR30: WebSocket maxPayload 64KB; heartbeat ping every 15s with 30s dead-connection detection
- AR31: View filtering test requirement: state-broadcaster.test.ts must verify no rack data leaks to other players
- AR32: Room cleanup: all disconnected 2min, post-game idle 5-10min, abandoned room 30min
- AR33: Concurrency model: Node single-threaded event loop guarantees sequential handleAction per room; no worker threads

### UX Design Requirements

**Design System & Tokens**
- UX-DR1: All colors defined as UnoCSS theme tokens generating CSS custom properties — no raw hex values in .vue files. Tokens include: felt-teal (~#2A6B6B), chrome-surface (~#F5F0E8), chrome-surface-dark (~#2C2A28), gold-accent (~#C4A35A), suit colors (bam green, crak red, dot blue), state colors (turn-active, call-window, success, error, warning), wall counter states (normal, warning <=20, critical <=10), hand guidance (gold/neutral, never suit colors), celebration (gold, dim)
- UX-DR2: Typography system with named semantic role shortcuts in uno.config.ts: text-game-critical (20px, semibold), text-interactive (18px, semibold), text-body (16px, regular), text-card-pattern (16px, monospace/tabular), text-secondary (14px, regular). No text below 14px. No light/thin weights (100-300).
- UX-DR3: Animation tokens as CSS custom properties: tactile (120ms, ease-out), expressive (400ms, cubic-bezier), entrance (200ms, ease-out), exit (150ms, ease-in). All animations override to 0ms under prefers-reduced-motion. No raw CSS transition with hardcoded durations.
- UX-DR4: 4px-based spacing scale (4/8/12/16/24/32/48/64/96). 16px minimum padding for interactive elements. 12px minimum gap between interactive elements. min-tap UnoCSS shortcut for 44px min-h/min-w.
- UX-DR5: Border radius scale: sm (4px), md (8px), lg (12px for tiles), full (avatars). Warm-toned shadows (not pure black): shadow-tile, shadow-panel, shadow-modal.
- UX-DR6: Context-adaptive focus ring: focus-ring-on-chrome (#8C7038, 4.12:1), focus-ring-on-felt (#F5F0E8, 5.42:1), focus-ring-on-dark (#C4A35A, 5.95:1). 2px solid, 2px offset.
- UX-DR7: Mode-adaptive error colors: state-error light (#B8553A, 4.21:1 on chrome), state-error dark (#E8896E, 5.61:1 on dark chrome). Error inline messages use coral background tint with text-primary text.
- UX-DR8: Mood-switching mechanism via CSS class on root element (mood-arriving, mood-playing, mood-lingering) that remaps CSS custom properties. Components use mood-aware tokens automatically.
- UX-DR9: Mood-specific gold temperature shift: warmer/amber during Arriving, cooler/brass during Playing, softer/muted during Lingering — same gold family, different emotional weight via mood token overrides.

**Layout & Responsive**
- UX-DR10: Direction B (Immersive Table) chosen — full-width felt surface, no persistent sidebar. NMJL card and chat via slide-in panels from right. Maximum felt immersion.
- UX-DR11: iPad landscape (1024px) is the primary design target. Layout adapts upward to desktop and downward to phone. Container-based component sizing preferred over purely viewport-based breakpoints.
- UX-DR12: NMJL and chat slide-in panels are mutually exclusive — opening one closes the other. Both ~280px, same animation tokens. Floating reactions hide when any panel is open (play mode vs. reference mode).
- UX-DR13: Fixed-size action zone centered above rack — maintains FIXED height and width regardless of button count. Buttons center within the zone. Zone never resizes or repositions.
- UX-DR14: Phone (<768px) call button layout: 2x2 grid within fixed action zone when 4+ options appear simultaneously (44px + 8px + 20px constraints).
- UX-DR15: Phone rack scrolls horizontally when tiles exceed viewport — tiles never shrink below 30px (tile-min-width). Scrolling is the phone adaptation, not shrinking.
- UX-DR16: Minimum table height: felt center area never less than 40% of viewport height on any device.
- UX-DR17: Charleston NMJL behavior: overlay must preserve rack visibility — never cover rack entirely. Mobile uses split-view (card top, rack bottom).
- UX-DR18: Orientation change: layout adapts fluidly with no game state loss, no modal interruptions, no animation restarts. Panel state and tile selection preserved.
- UX-DR19: Safe area insets: fixed-bottom elements include padding-bottom: env(safe-area-inset-bottom). Discard confirm viewport detection accounts for env(safe-area-inset-top) on notch/Dynamic Island.

**Component Specifications**
- UX-DR20: Tile component: states (default, hover lift 4px, selected lift 8px + gold border, disabled reduced opacity, face-down). Variants: standard (~50px rack), small (~30px exposed/discards), celebration (larger fan-out). 10px drag/tap dead zone threshold. ARIA role="button", aria-label="3 of Bamboo".
- UX-DR21: TileRack component: states (interactive your turn, passive not your turn, selection mode for Charleston/call). Horizontal scroll on phone. Arrow keys navigate, Enter selects. role="list" with listitem children.
- UX-DR22: CallButtons component: only valid call options shown (no grayed-out buttons). Appears instantly in fixed action zone. aria-live="assertive" announces call window. Auto-focus first button for keyboard.
- UX-DR23: PlayerPresence component: video frame or avatar fallback at seat position. States: default, active turn (gold glow), speaking (animated indicator), reconnecting, disconnected/dead seat. Sizes: large ~140x96px desktop, medium ~120x80px iPad, small ~40px phone. Layout works identically with video or avatar — no restructuring on camera toggle.
- UX-DR24: WallCounter component: states normal/warning(<=20)/critical(<=10) with color tokens. aria-live="polite" announces state changes.
- UX-DR25: NMJLCardPanel: slide-in from right on desktop/iPad (~280px), full-screen overlay on phone. Charleston mode preserves rack visibility via split-view.
- UX-DR26: CharlestonZone: direction arrow, tile selection progress ("2 of 3"), blind-locked state, vote prompt for second Charleston, courtesy pass negotiation with count narration.
- UX-DR27: CelebrationOverlay: non-dismissable sequence (dim -> beat -> fan-out -> spotlight -> scoring -> fade to scoreboard). Voice chat stays active. Tapping anywhere does NOT dismiss.
- UX-DR28: SlideInPanel shared architecture for NMJL and chat. Mutually exclusive. Width ~280px. timing-tactile animation.
- UX-DR29: TileSelectionAction shared composable for "select N tiles from rack" pattern used in Charleston (3), call confirmation, and Joker exchange (1). Progress indicator, confirm/cancel.

**Interaction Patterns**
- UX-DR30: Four-tier button hierarchy: Primary (gold fill, dark text — ONE per screen), Urgent (call-window fill, white text — only during call window), Secondary (chrome fill, border), Tertiary (transparent, subtle). Disabled buttons removed from DOM, not grayed out (exception: Mahjong always visible).
- UX-DR31: Immediate acknowledgment pattern: every tap gets instant visual feedback (tile lift, button depress, panel slide) BEFORE server confirms. NOT optimistic updates — just "I heard you." Degraded network: 800ms pulse fallback, 3s escalate to "Reconnecting...".
- UX-DR32: State narration for all game events: call resolution with priority explanation, turn skip-ahead visualization, Charleston direction changes, courtesy pass count narration, scoring breakdown with discarder-pays-double. The system always shows its work.
- UX-DR33: Recent Activity Indicator (ticker) near turn indicator showing last 2-3 game events in compressed form. text-secondary, low opacity, fades after 10s. For players who look away and need to re-orient.
- UX-DR34: Social Override UX: "Request Undo" button appears briefly after discard (before next draw/call). Inline vote prompt for other 3 players. Pending discard pulses. Requires unanimous 3/3. Auto-dismiss 10s.
- UX-DR35: Dead hand indicator: persistent subtle badge near rack ("Dead Hand" in text-secondary with state-error coral border). Call buttons removed. Mahjong tap shows inline message. Other players see NO indicator (behavioral change only). Never broadcast publicly.
- UX-DR36: Notification patterns: three channels never mixed — inline (3s, near action point), toast (3s, bottom/top edge, max 1 phone / 2 tablet), seat-position (persistent). Toasts never overlap rack or action buttons. FIFO replacement, no queue.
- UX-DR37: No modals for any gameplay interaction. Confirmations are inline. Only modal-like elements: celebration overlay (non-dismissable) and NMJL on phone (dismissable).
- UX-DR38: Empty states: waiting room shows avatars at filled seats + empty placeholders (voice/text already active). No chat placeholder. No exposed group placeholder. Loading: instant Arriving mood skeleton, NO spinners during gameplay, reconnection indicator at seat.

**Shared Primitives (extract after first 3-4 feature components)**
- UX-DR39: BaseButton (44px min, press states, focus ring, gold accent), BasePanel (consistent bg/border/shadow/radius), BaseBadge (turn indicator, wall counter, status dot), BaseToast (enter/exit animation, auto-dismiss, positioning), BaseOverlay (backdrop, enter/exit, scroll), BaseInput (border, focus ring, text-interactive, padding), BaseToggle (switch styling), MobileBottomBar (phone-only, fixed bottom, above safe area).
- UX-DR40: Extraction strategy: do NOT build primitives in isolation first. Build first 3-4 feature components (Tile, TileRack, DiscardPool, CallButtons), then extract shared patterns as a dedicated refactoring story before Epic 5A closes.

**Accessibility-Specific UX**
- UX-DR41: Color-blind safe: tile suits use shape/pattern distinguishers in addition to color. Hand guidance uses gold/neutral highlights, never suit colors.
- UX-DR42: Drag/tap dead zone: 10px movement threshold prevents accidental rack rearrangement from imprecise taps (critical for 40-70+ demographic).
- UX-DR43: Keyboard Tab zones with focus-trap regions: Rack -> Action buttons -> NMJL card -> Chat -> Controls. Tab between zones, Arrow within zones, Enter confirms, Escape exits chat. Skip link: "Skip to game table."
- UX-DR44: Audio is additive, never required. Every sound has a visual equivalent: tile clack -> discard animation, call snap -> exposure animation, turn ping -> turn indicator glow, motif -> celebration visual. For hearing-impaired: text chat and reaction system serve as accessible social channel.
- UX-DR45: Tile readability validation at Epic 5A: render all 152 faces at 30px, test with target demographic (40-70+). If corner indices unreadable, bump to 32-34px before building dependent components.

**Player Journey UX**
- UX-DR46: Join flow under 10 seconds: tap link -> type name -> see friends. Friendly A/V permission prompt with guidance ("Allow mic so your friends can hear you"), graceful avatar fallback if denied.
- UX-DR47: First-visit visual entrance: 2-second graceful entrance (felt fade-in, tiles materialize). Skipped on subsequent visits. Skipped entirely under prefers-reduced-motion.
- UX-DR48: First-launch audio preview: brief 3-second showcase (tile draw, discard clack, Mahjong motif) during first game join. Toast: "Sound is on. Adjust in settings."
- UX-DR49: Three Moods transitions as gentle crossfades (1-2 seconds): Arriving (warm cream, gold amber, faces prominent, no felt) -> Playing (teal felt dominates, chrome recedes) -> Lingering (soft warm, felt recedes, generous whitespace, unhurried).
- UX-DR50: Challenge flow UX: inline on game table (not modal), 30-second group review, winning hand + card pattern side-by-side, two large buttons (Valid/Invalid) in action zone. No penalty for challenging. Voice chat active throughout.

### FR Coverage Map

| FR | Epic | Brief |
|---|---|---|
| FR1 | 4A | Private rooms with shareable links |
| FR2 | 4A | 4 players required |
| FR3 | 4B | 5th player / spectator |
| FR4 | 4B | Host settings between games |
| FR5 | 4B | Setting change notifications |
| FR6 | 4B | Collapsible settings panel |
| FR7 | 4A | Guest play with display name |
| FR8 | 1 + 4A | Seat/wind assignment |
| FR9 | 1 | Dealing 14/13/13/13 |
| FR10 | 1 + 5A + 7 | Dealing animation |
| FR11 | 5B | Animated traditional dealing option |
| FR12 | 4A + 5B | Dealer rotation |
| FR13 | 1 | Counterclockwise play |
| FR14 | 1 | East's first turn |
| FR15 | 1 | Draw from wall |
| FR16 | 2 + 5B | Evaluate hand against card |
| FR17 | 5A | Two-step discard |
| FR18 | 5A + 5B | Drag-and-drop discard opt-in |
| FR19 | 3A | Hybrid call window |
| FR20 | 3A | Pass to close early |
| FR21 | 3A | Mahjong call priority |
| FR22 | 3A | Multiple Mahjong by turn order |
| FR23 | 3A | Non-Mahjong by seat position |
| FR24 | 3A | Call confirmation 5 sec |
| FR25 | 3A | Call retraction |
| FR26 | 3A | Call window freeze |
| FR27 | 3A | No Chi/Chow |
| FR28 | 3A | No pairs except Mahjong |
| FR29 | 3A | Call validation against card |
| FR30 | 5A | Dynamic call buttons |
| FR31 | 3A | Pattern-defined groups |
| FR32 | 3B | First Charleston |
| FR33 | 3B | Second Charleston vote |
| FR34 | 3B | Courtesy pass |
| FR35 | 3B | Blind passing rule |
| FR36 | 3B | Jokers in Charleston |
| FR37 | 3B | Tile selection UI |
| FR38 | 3B | Direction indicator |
| FR39 | 2 | JSON card data |
| FR40 | 2 | Hand pattern encoding |
| FR41 | 5B | Card slide-in panel (desktop) |
| FR42 | 5B | Card overlay (mobile) |
| FR43 | 5B | Hand guidance system |
| FR44 | 5B | Auto-disable after 3 games |
| FR45 | 5B + 4B | Host toggle hints |
| FR46 | 2 | Runtime card loading |
| FR47 | 2 | Card data test suite |
| FR48 | 2 | Current year only |
| FR49 | 2 | Shared hand evaluation engine |
| FR50 | 2 | Standard Joker rules |
| FR51 | 1 | Joker discard restriction |
| FR52 | 1 | Dead Joker if discarded |
| FR53 | 3C | Joker exchange |
| FR54 | 3C | Multiple exchanges per turn |
| FR55 | 3A | Group identity fixed at exposure |
| FR56 | 3C | Simplified Joker rules |
| FR57 | 3A | Groups face-up visible |
| FR58 | 3A | Groups cannot be rearranged |
| FR59 | 5A | UI distinction concealed/exposed |
| FR60 | 2 | C/X hand requirements |
| FR61 | 2 | Mixed hands at group level |
| FR62 | 3C | Concealed validation at Mahjong |
| FR63 | 3C + 5B | Guidance filters by exposed |
| FR64 | 5A | Mahjong button always visible |
| FR65 | 3A | Auto-validation before reveal |
| FR66 | 3A | Invalid Mahjong warning |
| FR67 | 3A | Confirmed invalid = dead hand |
| FR68 | 3A | Challenge button |
| FR69 | 3A | Self-drawn Mahjong |
| FR70 | 7 | Celebration sequence |
| FR71 | 2 | Discard Mahjong payment rules |
| FR72 | 2 | Self-drawn payment rules |
| FR73 | 1 | Wall game no payments |
| FR74 | 2 | Hand values from card |
| FR75 | 5A + 5B | Scoreboard |
| FR76 | 3C | Dead hand triggers |
| FR77 | 3C | Dead hand behavior |
| FR78 | 3C | Others call dead hand discards |
| FR79 | 3C | Dead hand tiles visible |
| FR80 | 3C | Table Talk Report button |
| FR81 | 3C | Majority vote (2/3) |
| FR82 | 3C | Upheld = dead hand |
| FR83 | 3C | Max 2 reports per game |
| FR84 | 3C | Social override scope |
| FR85 | 3C | Unanimous consent (3/3) |
| FR86 | 3C | Undo window timing |
| FR87 | 3C | Silence = deny |
| FR88 | 3C | Override logging visible to host |
| FR89 | 4B | Configurable timer |
| FR90 | 4B | No-timer mode |
| FR91 | 4B | First timeout nudge |
| FR92 | 4B | Second timeout auto-discard |
| FR93 | 4B | AFK vote |
| FR94 | 4B | Departure notification |
| FR95 | 4B | Dead seat or end game vote |
| FR96 | 4B | Dead seat behavior |
| FR97 | 4B | Multi-departure auto-end |
| FR98 | 4B | Host migration |
| FR99 | 4B | No AI fill-in |
| FR100 | 5B | Wall counter |
| FR101 | 1 + 3C | Wall game trigger |
| FR102 | 3C | Last tile self-drawn Mahjong |
| FR103 | 3C | Last discard callable |
| FR104 | 4B | Grace period |
| FR105 | 4B | Full state restore |
| FR106 | 4B | Reconnecting indicator |
| FR107 | 4B | Phase-specific reconnection |
| FR108 | 4B | Simultaneous disconnect pause |
| FR109 | 4B | 2-minute timeout |
| FR110 | 6B | WebRTC auto-reconnect |
| FR111 | 6A | Text chat |
| FR112 | 6A | Quick reactions |
| FR113 | 6B | Voice chat |
| FR114 | 6B | Video chat |
| FR115 | 6B | Voice/video toggles |
| FR116 | 6B | Reconnect A/V button |
| FR117 | 5A | Desktop click/drag |
| FR118 | 5A | Mobile touch |
| FR119 | 5A | Keyboard navigation |
| FR120 | 5A | Rack drag-and-drop |
| FR121 | 5A | Sort rack button |
| FR122 | 5A | Per-player discard pool |
| FR123 | 8 | Optional accounts |
| FR124 | 8 | Guest experience |
| FR125 | 8 | Account benefits |
| FR126 | 8 | localStorage guest stats |
| FR127 | 8 | Stats tracking |
| FR128 | 8 | Shareable session summary |
| FR129 | 7 | Celebration sequence |
| FR130 | 5B | Show hands |
| FR131 | 5B | Session scoreboard |
| FR132 | 5B | Rematch button |
| FR133 | 5B | Linger time / wind-down |

## Epic List

### Epic 1: Project Foundation & Game Engine
A complete game state machine that runs a full 4-seat draw-discard game locally with a minimal visual test harness. Includes monorepo setup, tooling, test infrastructure, and debug tools.
**Phase:** 1 — Foundation
**Dependencies:** None
**FRs covered:** FR8, FR9, FR10 (basic), FR13, FR14, FR15, FR51, FR52, FR73, FR101 (basic)
**ARs covered:** AR1, AR2, AR3, AR15, AR16, AR17, AR19, AR27, AR28, AR33
**Est. stories:** 6-8
**Implementation notes:** Project setup is Story 1.1. Test infrastructure early. Command/action pattern from day one per architecture hard requirement.

### Epic 2: Card Rules & Validation
A standalone, exhaustively tested module that validates hands against the NMJL card, calculates scoring, and determines payment distribution. Powers all four subsystems: validation, guidance, Joker exchange, scoring.
**Phase:** 1 — Foundation
**Dependencies:** Epic 1
**FRs covered:** FR39, FR40, FR46, FR47, FR48, FR49, FR50, FR60, FR61, FR71, FR72, FR74
**ARs covered:** AR9
**Est. stories:** 6-8
**Implementation notes:** Per GLaDOS — test suite design story BEFORE pattern matcher implementation (red-green-refactor). This is the highest-risk, most complex system in the game. Exhaustive test coverage is an architectural requirement.

### Epic 3A: Turn Flow & Calling
Full calling system with priority resolution, call window freeze, exposure rules, Mahjong declaration with auto-validation, and challenge mechanism.
**Phase:** 2 — Playable Game
**Dependencies:** Epic 1, Epic 2
**FRs covered:** FR19-FR31, FR55, FR57, FR58, FR65-FR69
**Est. stories:** 8-10
**Implementation notes:** Per Cloud Dragonborn — turn flow stories (draw/discard loop) can begin in parallel with Epic 2 work since they don't need the pattern matcher. Only call validation and Mahjong declaration stories require Epic 2.

### Epic 4A: Core Multiplayer
Four players join a room via shared link and play a synchronized game in real time. Server-authoritative state, WebSocket protocol, session identity, room lifecycle.
**Phase:** 2 — Playable Game
**Dependencies:** Epic 1
**FRs covered:** FR1, FR2, FR7, FR8, FR12
**ARs covered:** AR4-AR8, AR10, AR11, AR12, AR13, AR14, AR20, AR25, AR26, AR29, AR30, AR31, AR32
**Est. stories:** 8-10
**Implementation notes:** Per GLaDOS — view filtering security test (AR31: state-broadcaster.test.ts verifying no rack data leaks) must be an explicit story, not buried in a WebSocket integration story. Include Playwright multi-client integration test for call window fairness.

### Epic 5A: Core Game UI
A real, usable browser UI — the vertical slice. Players see tiles, draw, discard, call, declare Mahjong, and see scores in a responsive layout. First real 4-player playtest with humans. Includes basic audio (tile clack + Mahjong motif) for playtest personality.
**Phase:** 2 — Playable Game
**Dependencies:** Epic 3A, Epic 4A
**FRs covered:** FR10, FR17, FR18, FR30, FR59, FR64, FR75 (game-level), FR117-FR122
**ARs covered:** AR18, AR21, AR22, AR23, AR24
**UX-DRs covered:** UX-DR1-9 (design system), UX-DR10-11 (layout), UX-DR13 (action zone), UX-DR15 (phone rack scroll), UX-DR20-22 (Tile, TileRack, CallButtons), UX-DR30-31 (button hierarchy, acknowledgment), UX-DR39-40 (primitive extraction), UX-DR42 (dead zone), UX-DR43 (keyboard zones), UX-DR45 (tile readability validation)
**Est. stories:** 10-14
**Implementation notes:** Per Max — this is the biggest epic. Sequence stories for early visual feedback: Tile + TileRack rendering first, then game table layout, then interaction wiring. Primitive extraction as a dedicated refactoring story before epic closes. Per Samus Shepard — basic audio (2 sounds: tile discard clack + Mahjong motif) included for playtest feel.
**>>> MILESTONE: First 4-player playtest <<<**

### Epic 3B: Charleston
Full Charleston pre-game passing ritual with blind pass enforcement, optional second Charleston vote, courtesy pass negotiation. All with social interaction fully active.
**Phase:** 3 — Complete Rules
**Dependencies:** Epic 3A, Epic 5A
**FRs covered:** FR32-FR38
**UX-DRs covered:** UX-DR17 (Charleston NMJL), UX-DR26 (CharlestonZone), UX-DR29 (TileSelectionAction)
**Est. stories:** 5-7

### Epic 3C: Advanced Rules
Complete rules engine — Joker exchange, dead hands, social governance (Social Override + Table Talk Report), wall end scenarios, concealed hand validation.
**Phase:** 3 — Complete Rules
**Dependencies:** Epic 3A, Epic 5A
**FRs covered:** FR53, FR54, FR56, FR62, FR63, FR76-FR88, FR102, FR103
**UX-DRs covered:** UX-DR34 (social override UX), UX-DR35 (dead hand indicator)
**Est. stories:** 6-8
**Implementation notes:** Order stories so voting UI pattern (Social Override) is built first, reused for Table Talk Report.

### Epic 6A: Text Chat & Reactions
Lightweight social features over the existing WebSocket connection. Text chat and one-tap reactions during all game phases.
**Phase:** 3 — Complete Rules (consider pulling to Phase 2 for playtest)
**Dependencies:** Epic 4A
**FRs covered:** FR111, FR112
**UX-DRs covered:** UX-DR12 (slide-in panel), UX-DR28 (SlideInPanel), UX-DR36 (notification patterns)
**Est. stories:** 4-5
**Implementation notes:** Per Samus Shepard — consider pulling into Phase 2 alongside Epic 5A for better playtest experience. Rides on existing WebSocket connection from 4A. Without chat, the first playtest tests rules but not the social experience that differentiates the product.

### Epic 4B: Multiplayer Resilience
Handle real-world scenarios gracefully — disconnections with full state restore, player departures with dead seats, turn timeouts, 5th player handling, host settings and migration.
**Phase:** 4 — Polish & Social
**Dependencies:** Epic 4A, Epic 5A
**FRs covered:** FR3-FR6, FR89-FR99, FR104-FR109
**UX-DRs covered:** UX-DR23 (reconnecting/dead seat states), UX-DR38 (reconnection indicator)
**Est. stories:** 6-8
**Implementation notes:** Per GLaDOS — reconnection during each game phase (Charleston, frozen call window, active turn, simultaneous disconnect) needs its own Playwright E2E test. Budget 6-8 E2E tests for reconnection paths alone.

### Epic 5B: Remaining UI
Complete UI experience — NMJL card display with hand guidance, wall counter with tension states, session scoreboard, rematch flow, show hands, settings panel.
**Phase:** 4 — Polish & Social
**Dependencies:** Epic 5A, Epic 3B
**FRs covered:** FR11, FR16, FR18 (settings), FR41-FR45, FR63, FR75 (session), FR100, FR130-FR133
**UX-DRs covered:** UX-DR14 (phone call buttons), UX-DR16 (min table height), UX-DR24 (WallCounter), UX-DR25 (NMJLCardPanel), UX-DR33 (recent activity ticker), UX-DR37 (no modals)
**Est. stories:** 8-10

### Epic 6B: Voice & Video (WebRTC) — CUT LINE
Integrated voice and video chat via LiveKit SDK. Players see each other's faces and hear each other's voices.
**Phase:** 4 — Polish & Social
**Dependencies:** Epic 4A, Epic 5A
**FRs covered:** FR110, FR113-FR116
**UX-DRs covered:** UX-DR23 (video modes), UX-DR46 (A/V permission flow)
**Est. stories:** 8-10
**Implementation notes:** Explicit cut target if timeline is tight. Game ships with text chat and reactions; WebRTC voice/video added as fast-follow.

### Epic 7: Visual Polish & Audio
Make the game beautiful and tactile — Three Moods atmosphere, felt texture, celebration cinematics, complete sound design (all 10-12 effects), dark mode, first-visit entrance, first-launch audio preview.
**Phase:** 4 — Polish & Social
**Dependencies:** Epic 5A
**FRs covered:** FR10 (animation polish), FR70, FR129
**NFRs addressed:** NFR1, NFR28, NFR38, NFR39, NFR41
**UX-DRs covered:** UX-DR3 (animation tokens), UX-DR8-9 (mood switching, gold temperature), UX-DR27 (CelebrationOverlay), UX-DR44 (audio/visual equivalence), UX-DR47 (first-visit entrance), UX-DR48 (audio preview), UX-DR49 (Three Moods)
**Est. stories:** 8-10

### Epic 8: Profiles, Stats & Remaining Accessibility
Optional accounts with persistent stats, session history, social tracking. Accessibility hardening: screen reader testing, high contrast, color-blind tile patterns, font size settings.
**Phase:** 4 — Polish & Social
**Dependencies:** Epic 5A
**FRs covered:** FR123-FR128
**NFRs addressed:** NFR25-NFR27, NFR29, NFR32-NFR34
**UX-DRs covered:** UX-DR41 (color-blind safe)
**Est. stories:** 6-8

### Phased Sequence

```
Phase 1 - Foundation:
  [Epic 1] ──> [Epic 2]

Phase 2 - Playable Game:
  [Epic 3A] + [Epic 4A] ──> [Epic 5A]
  Note: Epic 3A turn-flow stories can start parallel with Epic 2
  Note: Consider pulling Epic 6A here for playtest social testing
  >>> MILESTONE: First 4-player playtest <<<

Phase 3 - Complete Rules:
  [Epic 3B] + [Epic 3C] + [Epic 6A]

Phase 4 - Polish & Social:
  [Epic 4B] + [Epic 5B] + [Epic 6B] + [Epic 7] + [Epic 8]
                           ^^^ CUT LINE
```

**Total estimated stories: 85-115**

---

## Epic 1: Project Foundation & Game Engine

A complete game state machine that runs a full 4-seat draw-discard game locally with a minimal visual test harness. Includes monorepo setup, tooling, test infrastructure, and debug tools.

**Note on FR52 (Dead Joker):** Story 1.5 enforces that Jokers cannot be discarded (FR51). The complementary rule — that a discarded Joker is a dead tile no one can call (FR52) — requires the calling system to enforce. The calling-side enforcement of FR52 belongs in Epic 3A when call validation is implemented. Story 1.5 lays the state foundation (marking any hypothetically discarded Joker as uncallable) but the behavioral enforcement depends on 3A.

**Note on FR12 (Dealer Rotation):** Epic 1 covers a single game only. Dealer rotation across multiple games in a session is covered by Epic 4A (room lifecycle) and Epic 5B (rematch flow).

### Story 1.1: Monorepo Setup & Development Tooling

As a **developer**,
I want **a fully configured pnpm monorepo with shared/, client/, and server/ packages, TypeScript strict mode, Vitest, and basic dev tooling**,
So that **all subsequent stories have a solid, tested project foundation to build on**.

**Acceptance Criteria:**

**Given** a fresh clone of the repository
**When** `pnpm install` is run
**Then** all three packages (shared, client, server) install successfully with no errors

**Given** the monorepo is set up
**When** `pnpm -r test` is run
**Then** Vitest executes in all three packages (even if only placeholder tests exist)

**Given** TypeScript is configured
**When** `tsc --build` is run from root
**Then** all three packages compile with `strict: true` and project references enforce that shared/ imports nothing from client/ or server/

**Given** the client package
**When** `pnpm dev` is run in client/
**Then** Vite 8 dev server starts and serves a placeholder page

**Given** the server package
**When** `pnpm dev` is run in server/
**Then** tsx starts the Fastify server with a health check endpoint responding 200

**Given** the project root
**When** inspecting configuration files
**Then** `.nvmrc` specifies Node 22 LTS, `pnpm-workspace.yaml` lists all three packages, and `tsconfig.base.json` contains shared strict compiler options

### Story 1.2: Tile Definitions & Wall Creation

As a **developer**,
I want **a complete tile type system and wall creation module that defines all 152 American Mahjong tiles with deterministic IDs and shuffling**,
So that **the game engine has a correct, testable tile set to work with**.

**Acceptance Criteria:**

**Given** the tile definitions in shared/
**When** all tile types are enumerated
**Then** there are exactly 152 tiles: 108 suited (Bam/Crak/Dot 1-9 x4 each), 16 Winds (N/E/W/S x4), 12 Dragons (Red/Green/White x4), 8 Flowers (A/B x4 each), 8 Jokers

**Given** a tile is created
**When** its ID is generated
**Then** the ID follows the `{suit}-{value}-{copy}` convention (e.g., `bam-3-2` for the second copy of 3-Bam, `joker-5` for the fifth Joker)

**Given** the wall creation function is called
**When** a wall is created
**Then** it contains all 152 tiles in shuffled order

**Given** the wall creation function is called twice with different seeds
**When** comparing the two walls
**Then** the tile order differs (shuffle is random)

**Given** a created wall
**When** checking tile counts by category
**Then** counts match the tile set composition table exactly (108 suited, 16 winds, 12 dragons, 8 flowers, 8 jokers)

### Story 1.3: Game State Machine & Dealing

As a **developer**,
I want **a game state machine that initializes a game with 4 seats, assigns winds, deals tiles correctly, and manages game phases**,
So that **a game can be started with correct initial state per NMJL rules**.

**Acceptance Criteria:**

**Given** a new game is created with 4 player IDs
**When** the game state is initialized
**Then** each player is assigned a unique wind (East, South, West, North) and `gamePhase` is set to `play`

**Given** a game is initialized
**When** tiles are dealt
**Then** East receives 14 tiles, and South, West, North each receive 13 tiles

**Given** tiles are dealt
**When** checking the wall
**Then** the wall contains exactly 152 - 14 - 13 - 13 - 13 = 99 remaining tiles

**Given** a game is initialized
**When** checking the initial game state
**Then** `currentTurn` is set to the East player, all discard pools are empty, no exposed groups exist, and scores are initialized to 0

**Given** the game state
**When** inspecting the state shape
**Then** it includes: `gamePhase`, `players` (with wind, rack, exposedGroups, discardPool), `wall`, `wallRemaining`, `currentTurn`, `scores`, and `callWindow: null`

### Story 1.4: Turn Loop & Draw Action

As a **developer**,
I want **a working turn loop with a draw action that advances play counterclockwise (East -> South -> West -> North)**,
So that **the basic rhythm of the game — draw a tile on your turn — functions correctly**.

**Acceptance Criteria:**

**Given** it is a player's turn (not East's first turn)
**When** the player dispatches a `DRAW_TILE` action
**Then** the top tile is removed from the wall, added to the player's rack, and `wallRemaining` decrements by 1

**Given** a player draws a tile
**When** checking the action result
**Then** `{ accepted: true }` is returned with a resolved action of type `DRAW_TILE`

**Given** it is NOT the player's turn
**When** that player dispatches a `DRAW_TILE` action
**Then** `{ accepted: false, reason: 'NOT_YOUR_TURN' }` is returned and no state mutation occurs

**Given** a player has already drawn a tile this turn
**When** that player dispatches another `DRAW_TILE` action
**Then** `{ accepted: false, reason: 'ALREADY_DRAWN' }` is returned

**Given** the turn order is East -> South -> West -> North (counterclockwise)
**When** a full round of turns completes
**Then** the turn passes in correct order: East, South, West, North, East...

### Story 1.5: Discard Action with Joker Restrictions

As a **developer**,
I want **a discard action that removes a tile from the player's rack, adds it to their discard pool, advances the turn, and enforces Joker discard restrictions**,
So that **the core draw-discard loop is complete with basic rule enforcement**.

**Acceptance Criteria:**

**Given** it is a player's turn and they have drawn a tile (or it's East's first turn with 14 tiles)
**When** the player dispatches `DISCARD_TILE` with a valid tile ID from their rack
**Then** the tile is removed from their rack, added to their discard pool, and the turn advances to the next player counterclockwise

**Given** a player attempts to discard
**When** the tile ID is not in their rack
**Then** `{ accepted: false, reason: 'TILE_NOT_IN_RACK' }` is returned with no state mutation

**Given** a player has a Joker in their rack
**When** they attempt to discard the Joker
**Then** `{ accepted: false, reason: 'CANNOT_DISCARD_JOKER' }` is returned (FR51)

**Given** it is East's first turn (14 tiles, no draw)
**When** East dispatches `DISCARD_TILE`
**Then** the discard succeeds without requiring a prior draw action (FR14)

**Given** a player discards a tile
**When** checking the validate-then-mutate pattern
**Then** all validation occurs before any state mutation — a rejected discard leaves state completely unchanged (AR3)

### Story 1.6: Wall Depletion & Game End

As a **developer**,
I want **the game to detect wall depletion and end as a wall game (draw) with no payments when the last tile is drawn and discarded without a Mahjong declaration**,
So that **games can end naturally when the wall runs out**.

**Acceptance Criteria:**

**Given** the wall has 1 tile remaining
**When** a player draws the last tile and then discards
**Then** the game transitions to `gamePhase: 'scoreboard'` with a wall game result (`winnerId: null`, `points: 0`, all payments zero) (FR73, FR101)

**Given** a wall game occurs
**When** checking scores
**Then** no score changes are applied — all payment values are 0

**Given** the wall is empty
**When** the next player in turn order would draw
**Then** the game has already ended — no draw action is possible

**Given** a game is in progress
**When** checking `wallRemaining` throughout the game
**Then** it accurately reflects 99 minus the total number of tiles drawn

### Story 1.7: Minimal Visual Test Harness

As a **developer**,
I want **a minimal browser-based test harness that displays the game state (racks, discard pools, wall count, turn indicator) and allows manual action dispatch**,
So that **I can visually verify the game engine works correctly before building the real UI**.

**Acceptance Criteria:**

**Given** the client dev server is running
**When** the test harness page loads
**Then** a new game is initialized locally (no server needed) and all 4 player racks are displayed with tile IDs

**Given** the test harness is displaying a game
**When** viewing the interface
**Then** the current turn player is indicated, wall remaining count is shown, and each player's discard pool is visible

**Given** the test harness is active
**When** clicking "Draw" for the current turn player
**Then** a tile is drawn and the display updates to show the new tile in the rack and decremented wall count

**Given** the test harness is active
**When** clicking a tile in the current player's rack to discard
**Then** the tile moves to the discard pool, turn advances, and the display reflects the new state

**Given** the game reaches wall depletion
**When** the last tile is drawn and discarded
**Then** the harness displays "Wall Game" result

**Given** the test harness
**When** inspecting it in dev mode only
**Then** it is gated behind `import.meta.env.DEV` and will not appear in production builds (AR19)

---

## Epic 2: Card Rules & Validation

A standalone, exhaustively tested module that validates hands against the NMJL card, calculates scoring, and determines payment distribution. Powers four subsystems: validation, guidance, Joker exchange, scoring. The pattern matching engine is the most complex system in the game — test-first development is mandatory.

**Note on Hand Guidance (FR43-44):** The hand guidance engine (closeness ranking computation) is deferred to Epic 5B where it ships alongside the NMJLCardPanel UI that consumes it. Epic 2 builds the pattern matching foundation that guidance depends on.

### Story 2.1: NMJL Card Data Schema & Loader

As a **developer**,
I want **a JSON schema for NMJL card data using the color-group suit abstraction, and a loader that parses card files at runtime**,
So that **the card data is structured for machine-readable pattern matching and can be updated yearly without code changes**.

**Acceptance Criteria:**

**Given** the card schema types in shared/
**When** reviewing the TypeScript interfaces
**Then** they support: `NMJLCard` with `year` and `categories`, `CardCategory` with `name` and `hands`, `HandPattern` with `id`, `points`, `exposure` (C/X), and `groups`, `GroupPattern` with `type` (single/pair/pung/kong/quint/sextet/news/dragon_set), `tile` requirement, `jokerEligible`, and `concealed` flag

**Given** the color-group abstraction
**When** encoding a hand pattern
**Then** colors A/B/C represent same-suit/different-suit relationships, value wildcards (N, N+1, N+2) represent consecutive values, and specific tiles (winds, dragons, flowers) are encoded by category (AR9)

**Given** a valid card JSON file (2026.json)
**When** `loadCard('2026')` is called
**Then** it returns a fully typed `NMJLCard` object with all categories and hand patterns parsed

**Given** an invalid or missing card file
**When** `loadCard` is called
**Then** it throws a descriptive error identifying what's wrong (missing file, malformed JSON, schema violation)

**Given** the card data directory
**When** checking available card files
**Then** `2026.json` exists as the current year's card and `2025.json` exists for internal testing of the yearly update process (FR48)

### Story 2.2: Card Data Integrity Test Suite

As a **developer**,
I want **an exhaustive test suite that validates the NMJL card data file for correctness, completeness, and consistency before any pattern matching code is written**,
So that **the card data is proven correct and the test suite defines the "done" criteria for the pattern matcher (red-green-refactor)**.

**Acceptance Criteria:**

**Given** the card integrity test suite
**When** run against the 2026 card data
**Then** it validates: all hands are parseable, no duplicate pattern IDs, every hand has a point value, group sizes are valid for their type (pair=2, pung=3, kong=4, quint=5, sextet=6, news=4, dragon_set=3)

**Given** the test suite
**When** checking Joker eligibility consistency
**Then** it verifies: Jokers are eligible only in groups of 3+ (pung, kong, quint, sextet, news, dragon_set), never in pairs or singles (FR50)

**Given** the test suite
**When** checking hand completeness
**Then** it verifies: every hand sums to exactly 14 tiles across all groups, every category on the card has at least one hand, and total hand count matches expected (~50+ hands)

**Given** the test suite
**When** checking concealed/exposed encoding
**Then** it verifies: every hand has an exposure marker (C or X), and concealed hands have appropriate group-level concealed flags (FR60, FR61)

**Given** the test suite for pattern matching (red tests)
**When** run before the pattern matcher is implemented
**Then** tests for hand validation against all 50+ patterns exist and FAIL (red), defining the acceptance criteria the matcher must satisfy

**Given** the test suite
**When** checking edge cases
**Then** it includes tests for: wildcard suit resolution (A/B/C mapping to Bam/Crak/Dot), consecutive value wildcards (N, N+1, N+2 with boundary cases like 8-9), mixed-tile groups (NEWS, Dragon sets), and hands requiring Jokers (quints where only 4 natural copies exist)

### Story 2.3: Pattern Matching Engine

As a **developer**,
I want **a pattern matching engine that validates whether a set of 14 tiles matches any hand pattern on the NMJL card, supporting all pattern types including wildcards, mixed-tile groups, and Joker substitution**,
So that **Mahjong declarations can be auto-validated with zero-tolerance accuracy (FR49, FR65)**.

**Acceptance Criteria:**

**Given** a player's 14 tiles that form a valid hand on the card
**When** `validateHand(tiles, card)` is called
**Then** it returns the matched pattern ID, pattern name, and point value

**Given** 14 tiles that do NOT match any hand on the card
**When** `validateHand(tiles, card)` is called
**Then** it returns `null` (no match)

**Given** a hand using color-group wildcards (e.g., "any one suit")
**When** validating
**Then** the engine correctly resolves A/B/C color groups to actual suits and matches all valid suit assignments

**Given** a hand using consecutive value wildcards (N, N+1, N+2)
**When** validating with boundary values (e.g., N=8 means N+1=9, no N+2 possible)
**Then** the engine correctly handles value boundaries and only matches valid consecutive sequences

**Given** a hand containing mixed-tile groups (NEWS = one of each wind, Dragon set = one of each dragon)
**When** validating
**Then** the engine matches these special group types correctly, not treating them as same-tile groups

**Given** tiles with Joker substitutions in eligible positions (groups of 3+)
**When** validating
**Then** the engine accepts Jokers as valid substitutes and correctly identifies the matched pattern

**Given** the exhaustive test suite from Story 2.2
**When** the pattern matcher is complete
**Then** ALL hand validation tests pass (green) — all 50+ patterns validate correctly using the specific tile arrangements defined in Story 2.2's test suite (the test suite IS the specification; the matcher's job is to make those tests green)

**Given** the pattern matcher
**When** measuring performance
**Then** validation completes in under 100ms for any tile set (NFR8) to support real-time hand guidance in the future

### Story 2.4: Joker Eligibility & Substitution Validation

As a **developer**,
I want **a Joker eligibility system that enforces where Jokers can and cannot substitute, and validates Joker exchanges against exposed groups**,
So that **Joker rules are correctly enforced for hand validation and future Joker exchange mechanics (FR50, FR53, FR55)**.

**Acceptance Criteria:**

**Given** a group of size 3 or more (pung, kong, quint, sextet, news, dragon_set)
**When** checking Joker eligibility
**Then** Jokers can substitute for any tile in the group

**Given** a pair or single tile group
**When** checking Joker eligibility
**Then** Jokers CANNOT substitute — the group must contain only natural tiles (FR50)

**Given** an exposed group with a fixed identity (e.g., "Kong of 3-Bam")
**When** a player wants to exchange a natural tile for a Joker
**Then** the system validates that the offered natural tile matches the group's identity exactly (FR55)

**Given** an exposed group containing no Jokers
**When** a Joker exchange is attempted
**Then** the exchange is rejected — there's no Joker to retrieve

**Given** multiple Jokers in a single exposed group (e.g., a Quint with 2 Jokers)
**When** validating an exchange
**Then** any single Joker can be exchanged if the natural tile matches the group identity

### Story 2.5: Concealed/Exposed Hand Validation

As a **developer**,
I want **validation that checks whether a declared hand's concealed and exposed groups match the NMJL card requirements**,
So that **concealed hands cannot be won by calling discards and mixed C/X requirements are enforced at the group level (FR60, FR61, FR62)**.

**Acceptance Criteria:**

**Given** a hand marked as Concealed (C) on the card
**When** a player declares Mahjong
**Then** validation confirms that ALL groups were formed by drawing from the wall — no groups were formed via calls (FR62)

**Given** a hand marked as Exposed (X) on the card
**When** a player declares Mahjong
**Then** validation allows groups formed via calls (exposed) or from the wall (concealed) — both are valid

**Given** a hand with mixed concealed/exposed requirements at the group level
**When** validating
**Then** each group is checked individually against its specific concealed/exposed requirement on the card (FR61)

**Given** a player pursuing a concealed hand who called a discard (resulting in an exposed group)
**When** validating against concealed-only patterns
**Then** validation correctly rejects the hand — the exposed group disqualifies all concealed-only patterns

**Given** the exposed groups tracking in game state
**When** a group is formed via a call
**Then** it is permanently marked as `exposed: true` and this flag is used during Mahjong validation

### Story 2.6: Scoring & Payment Calculation

As a **developer**,
I want **a scoring module that retrieves point values from validated hands and calculates correct payment distribution for both discard and self-drawn Mahjong**,
So that **session scores are accurate per NMJL payment rules (FR71, FR72, FR73, FR74)**.

**Acceptance Criteria:**

**Given** a validated Mahjong hand from a discard
**When** calculating payments
**Then** the discarder pays 2x the hand's point value, and the other 2 losers each pay 1x the hand's point value (FR71)

**Given** a self-drawn Mahjong (from the wall)
**When** calculating payments
**Then** all 3 losers pay 2x the hand's point value (FR72)

**Given** a wall game (draw, no winner)
**When** calculating payments
**Then** all payments are 0 — no score changes (FR73)

**Given** a validated hand
**When** looking up the point value
**Then** the value matches the NMJL card's assigned points for that pattern (FR74, typically 25-50 points)

**Given** multiple games in a session
**When** cumulating scores
**Then** the scoring module returns per-game payments that can be summed for session totals (supporting FR75)

**Given** the payment calculation
**When** verifying the math
**Then** the sum of all payments in a game is zero-sum — the winner's gain equals the total of all losers' payments

---

## Epic 3A: Turn Flow & Calling

Full calling system with priority resolution, call window freeze, exposure rules, Mahjong declaration with auto-validation, and challenge mechanism. This epic transforms the basic draw-discard loop into real American Mahjong.

**Note on parallelism:** Per Cloud Dragonborn — Stories 3A.1-3A.6 (calling mechanics) can begin in parallel with Epic 2 since they don't need the pattern matcher. Only Stories 3A.7-3A.8 (Mahjong declaration/validation) require Epic 2's pattern matching engine.

**Note on TypeScript unions:** Each story in this epic extends the `GameAction` and `ResolvedAction` discriminated unions in `shared/types/actions.ts` and `shared/types/protocol.ts` with new action and resolved action types. This applies to all epics that add game actions (3A, 3B, 3C, 4B, 5B).

### Story 3A.1: Call Window — Open, Timer, Pass & Early Close

As a **developer**,
I want **a call window that opens after each discard with a configurable timer, allows players to pass, and closes early when all players have passed**,
So that **other players have a fair, timed opportunity to claim each discarded tile (FR19, FR20)**.

**Acceptance Criteria:**

**Given** a player discards a tile
**When** the discard action resolves
**Then** a call window opens with state `callWindow: { discardedTileId, discarderId, status: 'open', remainingTime }` and the discarder is auto-marked as passed

**Given** an open call window
**When** the configurable timer (3-5 seconds, from host settings) expires with no calls
**Then** the call window closes, no call is resolved, and the next player in turn order draws from the wall

**Given** an open call window with 3 non-discarder players
**When** all 3 players dispatch `PASS_CALL`
**Then** the call window closes immediately without waiting for the timer (FR20)

**Given** a player who is the discarder
**When** they attempt to dispatch `PASS_CALL` or any call action
**Then** `{ accepted: false, reason: 'DISCARDER_CANNOT_CALL' }` is returned

**Given** a player who already passed
**When** they attempt to call or pass again
**Then** `{ accepted: false, reason: 'ALREADY_PASSED' }` is returned

**Given** no call window is open
**When** a player dispatches `PASS_CALL` or any call action
**Then** `{ accepted: false, reason: 'NO_CALL_WINDOW' }` is returned

### Story 3A.2: Call Actions — Pung, Kong, Quint with Validation

As a **developer**,
I want **players to call discarded tiles for Pung (3), Kong (4), and Quint (5) groups, with validation that the player has the required matching tiles in their rack**,
So that **the core calling mechanic works for same-tile groups (FR24, FR29)**.

**Acceptance Criteria:**

**Given** an open call window and a player has 2 tiles matching the discarded tile
**When** the player dispatches `CALL_PUNG` with matching tile IDs
**Then** the call is recorded in the call buffer with type `pung` and the caller's player ID

**Given** a player has 3 tiles matching the discarded tile
**When** the player dispatches `CALL_KONG` with matching tile IDs
**Then** the call is recorded with type `kong`

**Given** a player has 4 tiles matching the discarded tile (including Jokers as valid substitutes in groups of 3+)
**When** the player dispatches `CALL_QUINT` with tile IDs
**Then** the call is recorded with type `quint`

**Given** a player attempts to call Pung but has fewer than 2 matching tiles
**When** dispatching the call action
**Then** `{ accepted: false, reason: 'INSUFFICIENT_TILES' }` is returned

**Given** a player attempts to call with tile IDs not in their rack
**When** dispatching the call action
**Then** `{ accepted: false, reason: 'TILE_NOT_IN_RACK' }` is returned

**Given** a call action for a pair (2 tiles total including the discard)
**When** dispatching the call
**Then** `{ accepted: false, reason: 'CANNOT_CALL_FOR_PAIR' }` — pairs cannot be called except for Mahjong (FR28)

### Story 3A.3: Pattern-Defined Group Calls (NEWS, Dragon Sets)

As a **developer**,
I want **the calling system to support pattern-defined groups from the NMJL card (NEWS = one of each wind, Dragon sets = one of each dragon) in addition to same-tile groups**,
So that **all valid call types on the NMJL card are supported (FR31)**.

**Acceptance Criteria:**

**Given** a Wind tile is discarded (e.g., North)
**When** a player has the other 3 Wind tiles (East, West, South) in their rack
**Then** they can call to form a NEWS group — the call is validated as a legal group

**Given** a Dragon tile is discarded (e.g., Red)
**When** a player has the other 2 Dragon tiles (Green, White) in their rack
**Then** they can call to form a Dragon set — the call is validated as a legal group

**Given** a NEWS or Dragon set call
**When** validating the group
**Then** Jokers can substitute for any tile in the group (groups of 3+), and the group identity is recorded for future Joker exchange validation (FR55)

**Given** a player attempts to call a pattern-defined group with incorrect tiles
**When** dispatching the call
**Then** `{ accepted: false, reason: 'INVALID_GROUP' }` is returned

**Given** the call buttons system
**When** determining valid call options for a discarded tile
**Then** both same-tile calls (Pung/Kong/Quint) AND pattern-defined group calls (NEWS/Dragon set) are included based on the player's rack contents (FR30)

### Story 3A.4: Call Window Freeze & Priority Resolution

As a **developer**,
I want **the call window to freeze when any player clicks a call, and for the server to resolve all buffered calls by priority (Mahjong > seat position) at resolution time**,
So that **call resolution is fair and deterministic with no fastest-click advantage (FR21, FR22, FR23, FR26)**.

**Acceptance Criteria:**

**Given** an open call window
**When** any player dispatches a call action
**Then** the call window status changes to `frozen`, a `CALL_WINDOW_FROZEN` resolved action is emitted with the caller ID, and no further call buttons are available to other players

**Given** a frozen call window
**When** additional call actions arrive from other players (sent before they received the freeze)
**Then** those calls are still accepted into the call buffer — in-flight calls are not rejected

**Given** multiple non-Mahjong calls in the buffer
**When** resolving calls
**Then** the call closest counterclockwise from the discarder wins (seat position priority, FR23)

**Given** a Mahjong call and a non-Mahjong call in the buffer
**When** resolving calls
**Then** the Mahjong call always wins regardless of seat position (FR21)

**Given** multiple Mahjong calls in the buffer
**When** resolving calls
**Then** the Mahjong call closest counterclockwise from the discarder wins (FR22)

**Given** call resolution
**When** the winning call is determined
**Then** losing callers' calls are silently discarded — no penalty, no notification to the losing caller

### Story 3A.5: Call Confirmation, Exposure & Retraction

As a **developer**,
I want **the winning caller to confirm their call by selecting tiles to expose within 5 seconds, with the ability to retract if the group is invalid or they made a mistake**,
So that **calls are confirmed with a safety net for misclicks (FR24, FR25, FR57, FR58)**.

**Acceptance Criteria:**

**Given** a player wins call priority
**When** they enter the confirmation phase
**Then** they have 5 seconds to dispatch `CONFIRM_CALL` with the tile IDs to expose from their rack

**Given** a valid `CONFIRM_CALL` with correct tiles
**When** the confirmation is processed
**Then** the called tile + the player's selected tiles form an exposed group, the group is placed face-up in the player's exposed area, the called tile is removed from the discard pool, and the exposed group has a fixed identity recorded (FR55, FR57)

**Given** exposed groups
**When** attempting to modify them
**Then** they cannot be rearranged or broken apart — exposure is permanent (FR58)

**Given** a `CONFIRM_CALL` with tiles that don't form a valid group
**When** the confirmation is processed
**Then** the call is auto-retracted — no dead hand, no penalty (FR25)

**Given** a player dispatches `RETRACT_CALL` during the confirmation phase
**When** the retraction is processed
**Then** if other calls remain in the buffer, the next highest-priority caller enters the confirmation phase; if no calls remain, the call window reopens for remaining time

**Given** the 5-second confirmation timer expires with no `CONFIRM_CALL` or `RETRACT_CALL`
**When** the timeout fires
**Then** the server auto-retracts the call on the player's behalf (same logic as `RETRACT_CALL`)

### Story 3A.6: Turn Advancement After Calls (Skip-Ahead)

As a **developer**,
I want **play to continue counterclockwise from the caller's seat after a successful call, skipping any players between the discarder and the caller**,
So that **turn order follows NMJL rules after a call (FR13 post-call behavior)**.

**Acceptance Criteria:**

**Given** a player successfully calls and confirms a group (not Mahjong)
**When** the call resolves
**Then** the caller must now discard a tile, and `currentTurn` is set to the caller

**Given** the caller discards after a call
**When** the turn advances
**Then** the next player counterclockwise from the CALLER draws — not from the original discarder

**Given** East discards, and West calls
**When** the call resolves
**Then** South is skipped; West discards, then North draws next

**Given** a call where the caller is the next player in turn order (no skip)
**When** the call resolves
**Then** no players are skipped — play continues normally from the caller

**Given** the resolved call action
**When** emitting the state update
**Then** the `resolvedAction` includes `fromPlayerId` (the discarder) so clients can animate the skip-ahead transition

### Story 3A.7: Mahjong Declaration & Auto-Validation

As a **developer**,
I want **players to declare Mahjong either from a discard (during call window) or from a self-drawn tile (before discarding), with auto-validation against the NMJL card before revealing to other players**,
So that **the climactic moment of the game is correctly validated and both win paths work (FR64, FR65, FR69)**.

**Acceptance Criteria:**

**Given** an open call window
**When** a player dispatches `CALL_MAHJONG`
**Then** the call is recorded with type `mahjong` and takes priority over all other calls in the buffer (FR21)

**Given** it is a player's turn and they have drawn a tile that completes their hand
**When** the player dispatches `DECLARE_MAHJONG` before discarding
**Then** auto-validation runs against the NMJL card data using the pattern matcher from Epic 2

**Given** the player's 14 tiles match a valid hand pattern on the card
**When** auto-validation succeeds
**Then** the game transitions to `gamePhase: 'scoreboard'`, the winning hand and pattern are recorded in `mahjongResult`, scoring is calculated per Story 2.6, and a `MAHJONG_DECLARED` resolved action is emitted with winner ID, pattern name, points, selfDrawn flag, and discarder ID (if applicable)

**Given** a discard Mahjong (from calling another player's discard)
**When** scoring is calculated
**Then** the discarder pays 2x, other losers pay 1x (FR71)

**Given** a self-drawn Mahjong (from the wall)
**When** scoring is calculated
**Then** all 3 losers pay 2x (FR72)

**Given** the Mahjong button
**When** checking its availability
**Then** it is always available to the player — never disabled or hidden (FR64). The server validates; the client always allows the attempt.

### Story 3A.8: Invalid Mahjong Handling & Challenge Mechanism

As a **developer**,
I want **invalid Mahjong declarations to be handled with a private warning and cancel option, and a challenge mechanism for disputing validated results**,
So that **honest mistakes are forgivable but confirmed invalid declarations enforce dead hands (FR66, FR67, FR68)**.

**Acceptance Criteria:**

**Given** a player declares Mahjong but their tiles don't match any card pattern
**When** auto-validation fails
**Then** only the declaring player receives a private notification: "This hand doesn't match a card pattern" with a Cancel option (FR66)

**Given** the player receives an invalid Mahjong warning
**When** the player dispatches `CANCEL_MAHJONG`
**Then** the declaration is withdrawn with no penalty — play continues as if nothing happened (call window may reopen or turn continues)

**Given** the player receives an invalid Mahjong warning
**When** the player dispatches `CONFIRM_MAHJONG` anyway (dismissing the warning)
**Then** a dead hand is enforced immediately — the player can no longer win or call discards for the rest of the game (FR67)

**Given** a Mahjong is auto-validated as valid
**When** other players dispute the result
**Then** a Challenge button is available during the celebration phase; any non-winning player can tap it within 10 seconds (FR68)

**Given** a challenge is initiated
**When** the challenge vote opens
**Then** all 4 players see the winning hand alongside the matched NMJL card pattern for group review; each player votes Valid or Invalid within 30 seconds

**Given** a challenge vote
**When** 3 or more players vote Invalid
**Then** the Mahjong is overturned — winner receives a dead hand, scoring is reversed

**Given** a challenge vote
**When** 2 or more players vote Valid (or a player doesn't vote within 30 seconds, defaulting to Valid)
**Then** the Mahjong stands and the celebration resumes

**Given** the challenge mechanism
**When** checking scope
**Then** challenges apply ONLY to Mahjong declarations — not to calls, scoring, or other game events

---

## Epic 4A: Core Multiplayer

Four players join a room via shared link and play a synchronized game in real time. Server-authoritative state, WebSocket protocol, session identity, and room lifecycle.

**Note on call window sync:** Epic 3A builds the calling logic in the shared/ engine (local). This epic wires all game actions — including call window open/freeze/resolve — over the network via the Action/State protocol. Story 4A.5 explicitly covers call window message types and networked synchronization (AR10).

### Story 4A.1: HTTP Room Creation & Room Codes

As a **host player**,
I want **to create a game room via an HTTP endpoint and receive a short, human-friendly room code I can share with friends**,
So that **I can invite friends by sharing a link or code over text/voice (FR1, AR7, AR8)**.

**Acceptance Criteria:**

**Given** the server is running
**When** `POST /api/rooms` is called with `{ hostName: "Rchoi" }`
**Then** a room is created and the response includes `{ roomId, roomCode, roomUrl, hostToken }` where `roomCode` is 6 alphanumeric characters (e.g., `MHJG7K`)

**Given** a room is created
**When** `GET /api/rooms/:code/status` is called with the room code
**Then** the response includes `{ full: false, playerCount: 0, phase: 'lobby' }`

**Given** an unknown room code
**When** `GET /api/rooms/:code/status` is called
**Then** a 404 response is returned with `{ error: 'ROOM_NOT_FOUND' }`

**Given** room codes are generated
**When** checking for collisions against active rooms
**Then** the generator retries until a unique code is produced — no two active rooms share a code

**Given** Fastify is configured
**When** the server starts
**Then** Pino logging is enabled with child loggers per room (AR13), and the health check endpoint at `GET /health` returns 200

### Story 4A.2: WebSocket Server & Connection Management

As a **developer**,
I want **a WebSocket server running alongside Fastify that manages connections, enforces message size limits, and detects dead connections via heartbeat**,
So that **real-time communication infrastructure is ready for game state sync (AR4, AR30)**.

**Acceptance Criteria:**

**Given** the server is running
**When** a WebSocket client connects
**Then** the connection is accepted and tracked by the connection manager

**Given** the WebSocket server configuration
**When** checking settings
**Then** `maxPayload` is set to 64KB, and messages exceeding this are dropped before reaching the handler (AR30)

**Given** a connected client
**When** 15 seconds pass
**Then** the server sends a WebSocket `ping` frame; if no `pong` is received within 30 seconds (2 missed pings), the connection is considered dead and closed (AR30)

**Given** a malformed WebSocket message (not valid JSON, missing `version` field)
**When** the server receives it
**Then** it logs at WARN level and drops the message silently — no crash, no response (AR12)

**Given** a message with an unrecognized `version` value
**When** the server receives it
**Then** it responds with `{ type: 'ERROR', code: 'UNSUPPORTED_VERSION' }` and does not process the message (AR4)

### Story 4A.3: Room Join via WebSocket & Seat Assignment

As a **player**,
I want **to join a game room by connecting via WebSocket with the room code and my display name, and be assigned a seat**,
So that **I arrive at the table ready to play with my friends (FR2, FR7)**.

**Acceptance Criteria:**

**Given** a room exists with fewer than 4 players
**When** a player connects via WebSocket with `{ roomCode, displayName }`
**Then** the player is assigned the next available seat (player-0 through player-3), assigned a wind, and receives the initial lobby state via `STATE_UPDATE`

**Given** a room already has 4 connected players
**When** a 5th player attempts to connect
**Then** the connection is rejected with an error message (5th player handling deferred to Epic 4B)

**Given** a player joins
**When** other players are in the room
**Then** all existing players receive a `STATE_UPDATE` with `resolvedAction: { type: 'PLAYER_JOINED', playerId, playerName }`

**Given** a player joins
**When** checking the `PlayerPublicInfo` in the state
**Then** it includes the player's `displayName`, `playerId`, `wind`, `isHost`, and connection status

**Given** player IDs
**When** assigned by the server
**Then** they are stable for the room's lifetime — `player-0` through `player-3` in seat assignment order (AR6)

### Story 4A.4: Session Identity & Token Management

As a **player**,
I want **a server-generated session token stored in my browser's sessionStorage that identifies me across reconnections**,
So that **I can refresh my browser or recover from a network hiccup without losing my seat (AR6)**.

**Acceptance Criteria:**

**Given** a player joins a room for the first time (no token)
**When** the server sends the first `STATE_UPDATE`
**Then** it includes a UUID session token that the client stores in sessionStorage

**Given** a player reconnects with a valid token
**When** connecting via WebSocket with `{ roomCode, token }`
**Then** the server maps the token to the player's existing seat and sends full game state

**Given** a player opens a second tab with the same sessionStorage token
**When** the second connection arrives
**Then** the first connection receives `{ type: 'SESSION_SUPERSEDED' }` and is disconnected — one active connection per token

**Given** a player closes their browser tab
**When** sessionStorage is cleared
**Then** the token is gone — a new tab would join as a new player (if a seat is available)

**Given** a player refreshes the page
**When** the page reloads
**Then** sessionStorage preserves the token, and the player seamlessly reconnects to their seat

**Given** a tokenless client connects to a room where a seat is in grace period
**When** the `displayName + roomCode` matches exactly one disconnected seat
**Then** the server reissues a token and restores the player to their seat (token delivery failure recovery)

### Story 4A.5: Action/State Protocol & Message Handling

As a **player**,
I want **my game actions to be sent to the server, validated, and the resulting state broadcast to all players with per-recipient filtering**,
So that **the game runs with server authority and no client can cheat or see hidden information (AR5, AR10, AR11)**.

**Acceptance Criteria:**

**Given** a player dispatches a game action (e.g., `DISCARD_TILE`)
**When** the server receives the `ActionMessage`
**Then** the server overwrites `playerId` with the session-authenticated player ID (never trusting client-provided IDs), passes the action to the game engine's `handleAction`, and broadcasts the resulting state

**Given** a valid action
**When** the engine returns `{ accepted: true }`
**Then** the server broadcasts `STATE_UPDATE` with the new `PlayerGameView` to each player (filtered per recipient) and includes the `resolvedAction` for animation context

**Given** an invalid action
**When** the engine returns `{ accepted: false, reason }`
**Then** the server sends `ServerError` only to the offending client — no broadcast to others (AR12)

**Given** the Action/State protocol
**When** checking client rendering behavior
**Then** the client renders game state ONLY from `STATE_UPDATE` messages — no optimistic updates, no local prediction (AR5)

**Given** a discard triggers a call window
**When** the server broadcasts state
**Then** all clients receive `callWindow` state including `status: 'open'`, timer info, and the discarded tile — enabling call button display

**Given** a player clicks a call and the window freezes
**When** the server processes the call
**Then** it broadcasts `CALL_WINDOW_FROZEN` to all clients, continues accepting in-flight calls into the buffer, and resolves all calls by seat position priority at confirmation or timeout (AR10)

**Given** every WebSocket message
**When** checking the version field
**Then** all messages include `version: 1` — the shared TypeScript types ARE the protocol spec (AR4)

### Story 4A.6: Per-Player View Filtering & Security Test

As a **developer**,
I want **the state broadcaster to build per-recipient views that include only the player's own rack and publicly visible information, with an explicit test verifying no rack data leaks**,
So that **the information boundary is airtight — no cheating by inspecting WebSocket traffic (AR31, NFR43)**.

**Acceptance Criteria:**

**Given** the state broadcaster function `buildPlayerView(state, playerId)`
**When** building a view for player-0
**Then** the view includes player-0's rack tiles in `myRack` and does NOT include any other player's rack tiles anywhere in the response

**Given** the state broadcaster
**When** building views for all 4 players
**Then** each view contains: `roomId`, `roomCode`, `gamePhase`, `players` (public info only), `myPlayerId`, `myRack` (only their own), `exposedGroups` (all players — public), `discardPools` (all — public), `wallRemaining`, `currentTurn`, `callWindow`, `scores`

**Given** `state-broadcaster.test.ts`
**When** running the test suite
**Then** there are explicit assertions that for EACH player, no other player's rack tiles appear anywhere in their `PlayerGameView` — this is a hard requirement, not an assumption (AR31)

**Given** a spectator view (post-MVP preparation)
**When** `buildSpectatorView(state)` is called
**Then** no player's rack is included — public information only

**Given** the `SHOW_HAND` action during scoreboard phase
**When** a player sends `SHOW_HAND`
**Then** their full rack is broadcast to all clients — this is the ONLY scenario where rack data is shared, and only during scoreboard phase

### Story 4A.7: Game Start & Host Controls

As a **host player**,
I want **to start the game when all 4 seats are filled, with the server validating preconditions**,
So that **only the host can initiate the game and only when the room is ready (FR2)**.

**Acceptance Criteria:**

**Given** exactly 4 players are connected and the game phase is `lobby`
**When** the host dispatches `START_GAME`
**Then** the game initializes (dealing, seat/wind assignment), `gamePhase` transitions from `lobby` to `play`, and all players receive the initial game state with their dealt tiles

**Given** fewer than 4 players are connected
**When** the host dispatches `START_GAME`
**Then** `{ accepted: false, reason: 'NOT_ENOUGH_PLAYERS' }` is returned

**Given** a non-host player
**When** they dispatch `START_GAME`
**Then** `{ accepted: false, reason: 'NOT_HOST' }` is returned

**Given** the game is already in progress (phase is not `lobby`)
**When** `START_GAME` is dispatched
**Then** `{ accepted: false, reason: 'WRONG_PHASE' }` is returned

**Given** the host starts the game
**When** the initial state is broadcast
**Then** each player's `STATE_UPDATE` includes their own dealt tiles (via view filtering) and a `resolvedAction: { type: 'GAME_STARTED' }`

### Story 4A.8: Room Cleanup & Lifecycle Management

As a **developer**,
I want **rooms to be automatically cleaned up when abandoned, idle, or when all players disconnect**,
So that **server memory is reclaimed and stale rooms don't accumulate (AR32)**.

**Acceptance Criteria:**

**Given** all players in a room disconnect
**When** no player reconnects within 2 minutes
**Then** the room is cleaned up — removed from active rooms map, all associated tokens invalidated, memory freed

**Given** a game ends (scoreboard phase)
**When** no player dispatches `REMATCH` within 5-10 minutes
**Then** the room is cleaned up as idle

**Given** a host creates a room but no one joins
**When** 30 minutes pass with only the host (or zero players)
**Then** the room is cleaned up as abandoned

**Given** a room is cleaned up
**When** checking server state
**Then** the room code is released for reuse, all WebSocket connections for that room are closed, and room-level child loggers are disposed

**Given** room cleanup occurs
**When** a player tries to reconnect with a token from the cleaned-up room
**Then** the connection is rejected with `{ error: 'ROOM_NOT_FOUND' }` — the token is no longer valid

**Given** multiple rooms are active simultaneously
**When** one room is cleaned up
**Then** other rooms are completely unaffected — room isolation is maintained

---

## Epic 5A: Core Game UI

A real, usable browser UI — the vertical slice. Players see tiles, draw, discard, call, declare Mahjong, and see scores in a responsive layout. First real 4-player playtest with humans. This epic establishes the design system, builds all core game components, and includes basic audio for playtest personality.

**>>> MILESTONE: First 4-player playtest after this epic <<<**

### Story 5A.1: Design System Foundation

As a **developer**,
I want **the UnoCSS design system configured with all color tokens, typography roles, spacing scale, animation tokens, and accessibility utilities**,
So that **every subsequent UI component is built on a consistent, token-driven foundation with no raw values (UX-DR1 through UX-DR9)**.

**Acceptance Criteria:**

**Given** the `uno.config.ts` file
**When** reviewing the theme configuration
**Then** all color tokens are defined: `felt-teal`, `chrome-surface`, `chrome-surface-dark`, `gold-accent`, `gold-accent-hover`, suit colors (`suit-bam`, `suit-crak`, `suit-dot`), state colors (`state-turn-active`, `state-call-window`, `state-success`, `state-error`, `state-warning`), wall counter states, hand guidance colors, and celebration colors (UX-DR1)

**Given** the typography system
**When** using named role shortcuts
**Then** `text-game-critical` (20px semibold), `text-interactive` (18px semibold), `text-body` (16px regular), `text-card-pattern` (16px monospace/tabular), and `text-secondary` (14px regular) are all available as UnoCSS shortcuts (UX-DR2)

**Given** the animation tokens
**When** checking CSS custom properties
**Then** `--timing-tactile` (120ms), `--timing-expressive` (400ms), `--timing-entrance` (200ms), `--timing-exit` (150ms) are defined with corresponding easing values, and all override to 0ms under `prefers-reduced-motion` (UX-DR3)

**Given** the spacing and sizing utilities
**When** building interactive elements
**Then** the 4px-based spacing scale is available, `min-tap` shortcut produces 44px min-h/min-w, and border radius scale (sm/md/lg/full) and warm-toned shadow scale (shadow-tile/shadow-panel/shadow-modal) are defined (UX-DR4, UX-DR5)

**Given** focus ring tokens
**When** applied to interactive elements
**Then** three context-adaptive variants are available: `focus-ring-on-chrome`, `focus-ring-on-felt`, `focus-ring-on-dark` — all meeting WCAG 3:1 UI component contrast (UX-DR6)

**Given** the mood-switching mechanism
**When** a CSS class (`mood-arriving`, `mood-playing`, `mood-lingering`) is applied to the root element
**Then** mood-aware tokens remap automatically — components built now are mood-ready without modification when Epic 7 adds transitions (UX-DR8)

**Given** the `theme.css` file
**When** reviewing dark mode support
**Then** `prefers-color-scheme: dark` remaps chrome-layer tokens (cream -> charcoal) while felt and gold tokens remain constant (UX-DR1, NFR41)

### Story 5A.2: Tile Component & SVG Sprite Sheet

As a **player**,
I want **to see beautifully rendered, clearly readable Mahjong tiles that look like premium acrylic tiles**,
So that **I can identify every tile at a glance on both desktop and mobile (UX-DR20)**.

**Acceptance Criteria:**

**Given** the SVG sprite sheet
**When** checking its contents
**Then** all 152 tile faces are defined as `<symbol>` elements with IDs matching the tile ID convention (e.g., `#bam-3`, `#wind-north`, `#joker`, `#flower-a`) (AR18)

**Given** the Tile.vue component
**When** rendering a tile
**Then** it uses `<use href="#tile-id">` to reference the sprite sheet, displays the tile face on a white base with subtle drop shadow and border-radius for the acrylic feel

**Given** tile states
**When** interacting with tiles
**Then** the component supports: default, hover (lifts 4px on desktop), selected (lifts 8px + gold border), disabled (reduced opacity), and face-down (back pattern) (UX-DR20)

**Given** tile variants
**When** rendering in different contexts
**Then** three size variants work: standard (~50px for rack), small (~30px for exposed groups/discards at `tile-min-width`), and celebration (larger for fan-out)

**Given** accessibility requirements
**When** inspecting tile markup
**Then** each tile has `role="button"` and `aria-label` describing the tile (e.g., "3 of Bamboo"), and suit is conveyed via shape/pattern in addition to color (UX-DR41)

**Given** all suited tiles (Craks, Bams, Dots)
**When** rendered at any size
**Then** Arabic numeral corner indices are visible for accessibility — experienced players can read Chinese characters, newcomers need the number

### Story 5A.3: TileRack with Drag-and-Drop & Sort

As a **player**,
I want **to see my hand of 13-14 tiles in a horizontal row that I can rearrange by dragging and sort with one tap**,
So that **I can organize my tiles the way I think about my hand (FR120, FR121, UX-DR21)**.

**Acceptance Criteria:**

**Given** the TileRack component
**When** rendering a player's hand
**Then** all tiles display in a horizontal row at standard size (~50px), with the rack anchored at the bottom of the game table

**Given** a player drags a tile
**When** the drag exceeds the 10px dead zone threshold
**Then** the tile enters drag mode with Vue DnD Kit, shows visual feedback during drag, and snaps to the new position on drop (UX-DR42, AR22)

**Given** a player taps a tile (movement under 10px threshold)
**When** the tap is detected
**Then** it registers as a selection (tile lifts), not a drag — preventing accidental rack rearrangement (UX-DR42)

**Given** the Sort button
**When** tapped
**Then** tiles reorder by suit (Bam, Crak, Dot) then by number within suit, with winds, dragons, flowers, and jokers grouped at the end (FR121)

**Given** a phone viewport where 13-14 tiles would shrink below 30px
**When** rendering the rack
**Then** tiles maintain minimum 30px width and the rack scrolls horizontally instead of shrinking (UX-DR15)

**Given** keyboard navigation
**When** the rack has focus
**Then** Arrow keys move between tiles, Enter selects/deselects a tile, and the rack is a `role="list"` with tile children as `role="listitem"` (UX-DR21, UX-DR43)

**Given** rack state
**When** it is NOT the player's turn
**Then** tiles are visible but not selectable (passive state) — no lift on tap, no drag enabled

### Story 5A.4: Game Table Layout (Immersive Table)

As a **player**,
I want **a full-width felt game table with my rack at the bottom, opponents at cardinal positions, and a central area for discards and wall counter**,
So that **it feels like sitting at a real Mahjong table with friends (UX-DR10, UX-DR11)**.

**Acceptance Criteria:**

**Given** the GameTable layout on iPad landscape (1024px, primary target)
**When** rendering the game view
**Then** the felt surface is full-width (no persistent sidebar), the player's rack anchors the bottom, opponent areas are at top/left/right positions, and the central area contains discard pools and wall counter (UX-DR10)

**Given** opponent areas
**When** rendering player presence
**Then** each opponent position shows: avatar circle with player initial and name, connection status dot, and their exposed groups below — using the same space whether video is present or not (UX-DR23)

**Given** a desktop viewport (>1024px)
**When** rendering
**Then** the layout uses extra space for larger video frame placeholders and more generous spacing — not a stretched tablet layout

**Given** a phone viewport (<768px)
**When** rendering
**Then** opponent areas compress to small avatars (~40px), discard pools compress, and a bottom bar appears for future NMJL/chat/A/V toggles

**Given** the felt table center area
**When** checking minimum height
**Then** it occupies at least 40% of viewport height on all devices (UX-DR16)

**Given** device orientation change
**When** rotating the device mid-game
**Then** the layout adapts fluidly with no game state loss, no modal interruptions, and panel state preserved (UX-DR18)

**Given** mobile safe areas
**When** rendering fixed-bottom elements (rack, bottom bar)
**Then** `padding-bottom: env(safe-area-inset-bottom)` is applied to avoid overlap with iPhone home indicator (UX-DR19)

**Given** the action zone above the rack
**When** defining the layout region
**Then** a fixed-size container component ("ActionZone") is created that houses call buttons, discard confirm, and Mahjong button — it maintains fixed dimensions regardless of content, never resizes or repositions, and buttons center within it (UX-DR13). This is the single location for all player action buttons across all game states.

**Given** game table regions (opponent areas, discard pools, action zone)
**When** building the layout in this story
**Then** regions are implemented as placeholder containers with correct sizing and positioning — subsequent stories (5A.5 discard pool, 5A.6 call buttons, 5A.8 turn indicator) populate these regions with real components. The layout scaffold ships first; components plug in after.

### Story 5A.5: Discard Pool & Two-Step Discard Interaction

As a **player**,
I want **to discard tiles with a clear two-step interaction (select then confirm) and see all players' discards arranged in chronological rows at each seat**,
So that **discarding feels rhythmic and safe, and I can read the table to track what's been played (FR17, FR122, UX-DR13)**.

**Acceptance Criteria:**

**Given** it is my turn and I have drawn a tile
**When** I tap a tile in my rack
**Then** the tile lifts (selected state, 8px + gold border) and a "Discard" confirm button appears in the fixed action zone above my rack (UX-DR13)

**Given** the confirm button
**When** checking its position
**Then** it appears in the fixed action zone — the same zone where call buttons will appear — and the zone maintains fixed size regardless of content (UX-DR13)

**Given** I tap the "Discard" confirm button
**When** the discard action is sent to the server and confirmed
**Then** the tile animates from my rack to my discard pool with the tactile timing token (120ms), a tile clack sound plays, and the turn indicator moves to the next player

**Given** I have selected a tile but tap a different tile instead
**When** the second tap registers
**Then** the first tile deselects (lowers) and the second tile selects (lifts) — only one tile selected at a time

**Given** each player's discard pool
**When** tiles are discarded throughout the game
**Then** discards display in front of the respective player's seat in chronological rows matching physical play layout (FR122)

**Given** the most recently discarded tile
**When** it lands in the discard pool
**Then** it gets a brief gold pulse animation to draw attention (latest-discard state)

**Given** immediate acknowledgment
**When** I tap a tile
**Then** the lift animation starts instantly (120ms, timing-tactile) BEFORE the server confirms — this is acknowledgment, not optimistic update (UX-DR31)

### Story 5A.6: Action Zone & Call Buttons

As a **player**,
I want **call buttons to appear instantly in a fixed position during the call window, showing only my valid call options**,
So that **I can react quickly during the 3-5 second window without hunting for buttons (FR30, UX-DR22, UX-DR30)**.

**Acceptance Criteria:**

**Given** a tile is discarded by another player and a call window opens
**When** I have valid call options
**Then** only the valid call buttons appear (e.g., "Pung" if I can Pung, "Mahjong" if applicable) — no grayed-out buttons for invalid calls. A "Pass" button is always shown. (UX-DR22, UX-DR30)

**Given** I have no valid calls
**When** the call window opens
**Then** only the "Pass" button appears in the action zone

**Given** the action zone
**When** checking its behavior across states
**Then** it maintains a FIXED height and width regardless of how many buttons are displayed — buttons center within the zone, the zone never resizes or repositions (UX-DR13)

**Given** call buttons
**When** checking styling
**Then** call buttons (Pung, Kong, Quint) use the Urgent tier (call-window fill, white text, text-game-critical sizing) and Pass uses Secondary tier (chrome fill, border) (UX-DR30)

**Given** phone viewport (<768px) with 4+ call options simultaneously
**When** rendering call buttons
**Then** buttons stack in a 2x2 grid within the fixed action zone (UX-DR14)

**Given** the call window opens
**When** checking accessibility
**Then** `aria-live="assertive"` announces the call window, auto-focus moves to the first call button for keyboard users, and all buttons meet 44px minimum height (UX-DR22)

**Given** the call window closes (all pass, timer expires, or call resolved)
**When** buttons disappear
**Then** they exit with the exit animation token (150ms, ease-in) and the action zone returns to showing only the Mahjong button

### Story 5A.7: Mahjong Button & Declaration UI

As a **player**,
I want **a persistent Mahjong button in a fixed position that I can always tap, triggering auto-validation with clear feedback**,
So that **declaring Mahjong is confident and unmissable — the climactic moment of the game (FR64, UX-DR30)**.

**Acceptance Criteria:**

**Given** any game state (my turn, not my turn, call window open or closed)
**When** viewing the action zone
**Then** the Mahjong button is always visible in its fixed position — never hidden, never disabled (FR64)

**Given** the Mahjong button styling
**When** checking its appearance
**Then** it uses Primary tier (gold accent fill, dark text, text-game-critical sizing) and is the ONE primary button on screen during normal play (UX-DR30)

**Given** I tap the Mahjong button during a call window
**When** checking call behavior
**Then** a `CALL_MAHJONG` action is dispatched and takes priority over all other calls

**Given** I tap the Mahjong button on my turn (before discarding)
**When** I've drawn a tile that completes my hand
**Then** a `DECLARE_MAHJONG` action is dispatched for self-drawn Mahjong

**Given** a valid Mahjong declaration
**When** the server confirms
**Then** the game transitions to scoreboard phase, the scoring breakdown is displayed, and the Mahjong signature motif sound plays

**Given** an invalid Mahjong declaration
**When** the server returns the private warning
**Then** only I see an inline notification with a "Cancel" option — other players see nothing (FR66, UX-DR35's private-first principle)

**Given** keyboard navigation
**When** the Mahjong button has focus
**Then** Enter or Space activates it, and it has `aria-label="Declare Mahjong"`

### Story 5A.8: Turn Indicator, Wall Counter & Game Scoreboard

As a **player**,
I want **to always know whose turn it is, how many tiles remain in the wall, and the current game score**,
So that **I can read the game state at a glance from across the room on a propped-up iPad (UX-DR24)**.

**Acceptance Criteria:**

**Given** the current turn
**When** viewing the game table
**Then** the active player's seat area has a `state-turn-active` warm glow that is visible from across the room on iPad, and a turn indicator badge shows the player's name

**Given** the wall counter
**When** viewing the game table
**Then** "Wall: NN" is displayed at the top center of the felt area, visible to all players throughout the game (FR100)

**Given** the wall counter state
**When** tiles remain above 20
**Then** it displays in `wall-normal` neutral styling

**Given** the wall counter
**When** tiles drop to 20 or fewer
**Then** it transitions to `wall-warning` amber styling, and `aria-live="polite"` announces the state change (UX-DR24)

**Given** the wall counter
**When** tiles drop to 10 or fewer
**Then** it transitions to `wall-critical` stronger urgency styling with another polite announcement

**Given** the game-level scoreboard
**When** viewing during play
**Then** each player's current session score is visible (compact display) near their seat area or in a summary bar

**Given** a game ends (Mahjong or wall game)
**When** transitioning to scoreboard phase
**Then** the full scoring breakdown is displayed — winner's hand value, payment amounts per player, and updated session totals (FR75)

**Given** a call resolves and play skips ahead (e.g., East discards, West calls, South is skipped)
**When** the turn indicator transitions
**Then** the indicator visually narrates the skip — briefly passing over skipped seats before landing on the caller's seat, so all players understand why the turn jumped (UX-DR32 skip-ahead visualization). Uses `timing-expressive` (400ms) for the transition.

### Story 5A.9: Keyboard Navigation & Accessibility Foundation

As a **player using keyboard or assistive technology**,
I want **full keyboard navigation with Tab zones, arrow key movement, and visible focus indicators on every interactive element**,
So that **the game is playable without a mouse and the accessibility foundation is solid from day one (FR119, UX-DR43, NFR31)**.

**Acceptance Criteria:**

**Given** the game table is loaded
**When** pressing Tab
**Then** focus cycles through zones in order: Rack -> Action buttons -> Chat (placeholder) -> Controls, with a visible gold focus ring (2px solid, 2px offset) on the focused element (UX-DR6, UX-DR43)

**Given** focus is in the Rack zone
**When** pressing Arrow keys
**Then** focus moves between individual tiles; Enter selects/deselects the focused tile

**Given** focus is in the Action zone
**When** pressing Arrow keys
**Then** focus moves between available buttons (call buttons, Mahjong, Pass); Enter activates the focused button

**Given** focus is in the chat input (placeholder for Epic 6A)
**When** pressing Escape
**Then** focus exits the chat area and returns to the game zones (FR119)

**Given** the page loads
**When** pressing Tab before interacting
**Then** a "Skip to game table" link appears (visible only on Tab focus) that jumps past chrome to the rack/action area

**Given** all interactive elements
**When** inspecting markup
**Then** every button has semantic HTML (`<button>`), appropriate `aria-label`, and the focus ring uses the context-adaptive token (on-chrome, on-felt, or on-dark depending on background)

**Given** `prefers-reduced-motion` is active
**When** interacting with any element
**Then** all animations resolve to 0ms — no motion anywhere in the application (UX-DR3, NFR28)

### Story 5A.10: Shared Primitive Extraction & Tile Readability Validation

As a **developer**,
I want **to extract shared UI primitives from the components built in this epic and validate tile readability at minimum size with the target demographic**,
So that **the component library is DRY and tiles are proven readable before dependent epics build on them (UX-DR39, UX-DR40, UX-DR45)**.

**Acceptance Criteria:**

**Given** the components built in Stories 5A.2-5A.9
**When** reviewing for shared patterns
**Then** the following primitives are extracted: BaseButton (44px min, press states, focus ring, tier styling), BasePanel (consistent bg/border/shadow/radius), BaseBadge (turn indicator, wall counter, status dot), BaseToast (enter/exit animation, auto-dismiss, positioning) (UX-DR39)

**Given** extracted primitives
**When** refactoring existing components to use them
**Then** all components from this epic use the shared primitives — no duplicate button/panel/badge implementations remain

**Given** tile readability validation
**When** all 152 tile faces are rendered at 30px width (`tile-min-width`)
**Then** suit symbols, Arabic corner numerals, and tile identity are clearly distinguishable — validated by at least one person from the target demographic (40-70+) or by the developer's honest assessment at arm's length on an iPad (UX-DR45)

**Given** tile readability fails at 30px
**When** corner indices or suit symbols are not clearly readable
**Then** `tile-min-width` is bumped to 32px or 34px and all dependent components (DiscardPool, ExposedGroups, celebration fan-out) are updated before this epic closes

**Given** the primitive extraction
**When** checking for components NOT yet needed
**Then** BaseOverlay, BaseInput, BaseToggle, BaseSelect, BaseNumberStepper, and MobileBottomBar are NOT extracted yet — they'll be extracted when their consumer epics (3B, 5B, 6A) build the first component that needs them (UX-DR40)

---

## Epic 3B: Charleston

Full Charleston pre-game passing ritual — the peak social moment of American Mahjong. Three-pass sequence with blind pass enforcement, optional second Charleston, courtesy pass negotiation, and disconnect handling. The TileSelectionAction composable built here is reusable by call confirmation and Joker exchange.

**Note on TypeScript unions:** Stories in this epic extend `GameAction` and `ResolvedAction` unions with Charleston-specific types. See Epic 3A note.

**Note on TileSelectionAction reuse:** The TileSelectionAction composable built in Story 3B.4 should be retroactively applied to Epic 3A.5's call confirmation tile selection when this epic ships — refactor the 3A.5 implementation to use the shared composable.

### Story 3B.1: First Charleston with Blind Pass Enforcement

As a **player**,
I want **to participate in the mandatory first Charleston (Right, Across, Left) where the third pass enforces blind selection before revealing received tiles**,
So that **the pre-game ritual plays correctly with the strategic blind pass rule intact (FR32, FR35)**.

**Acceptance Criteria:**

**Given** the game starts and tiles are dealt
**When** the Charleston phase begins
**Then** `gamePhase` transitions to `charleston` with the first pass direction set to `right` and all 4 players are active simultaneously

**Given** the Right pass (first pass)
**When** all 4 players select 3 tiles and dispatch `CHARLESTON_PASS` with tile IDs
**Then** each player's 3 selected tiles are removed from their rack and replaced with the 3 tiles received from the player to their left; a `CHARLESTON_PHASE_COMPLETE` resolved action is emitted for direction `right`

**Given** the Across pass (second pass)
**When** all 4 players select and pass 3 tiles
**Then** tiles are exchanged with the player sitting across; resolved action emitted for direction `across`

**Given** the Left pass (third pass) — blind pass enforced
**When** entering the Left pass
**Then** players MUST select their 3 tiles to pass BEFORE seeing the tiles they received from the Across pass — the engine gates tile revelation on pass selection (FR35)

**Given** a player attempts to view Across-received tiles before selecting Left pass tiles
**When** checking state
**Then** the received Across tiles are held in a pending state and not yet added to the rack until the player's Left pass selection is locked

**Given** all 3 passes complete
**When** the first Charleston ends
**Then** all tile transfers are resolved, racks are updated, and the game state advances to the second Charleston vote prompt

**Given** a player dispatches `CHARLESTON_PASS` with fewer or more than 3 tiles
**When** validating
**Then** `{ accepted: false, reason: 'MUST_PASS_THREE_TILES' }` is returned

**Given** a player dispatches `CHARLESTON_PASS` with tile IDs not in their rack
**When** validating
**Then** `{ accepted: false, reason: 'TILE_NOT_IN_RACK' }` is returned

### Story 3B.2: Second Charleston Vote & Reversed Passes

As a **player**,
I want **the group to vote on an optional second Charleston (reversed direction: Left, Across, Right) that requires unanimous agreement**,
So that **the group controls the pacing and the second Charleston follows correct NMJL rules (FR33)**.

**Acceptance Criteria:**

**Given** the first Charleston completes
**When** the vote prompt appears
**Then** all 4 players see a prompt: "Do a second Charleston?" and must dispatch `CHARLESTON_VOTE` with `{ accept: true/false }`

**Given** all 4 players vote `accept: true`
**When** all votes are received
**Then** the second Charleston begins with reversed direction: Left (first), Across (second), Right (third with blind pass enforcement)

**Given** any player votes `accept: false`
**When** that vote is received
**Then** the second Charleston is skipped immediately — game advances to the courtesy pass (FR33)

**Given** the second Charleston
**When** processing the Right pass (third pass, reversed)
**Then** blind pass enforcement applies — players must select tiles before seeing Across-received tiles, same as the Left pass in the first Charleston (FR35)

**Given** the second Charleston completes
**When** all 3 passes resolve
**Then** the game advances to the courtesy pass

### Story 3B.3: Courtesy Pass Negotiation

As a **player**,
I want **to optionally exchange 0-3 tiles with the player sitting across, where both players independently choose their count and the lower count is used**,
So that **the final fine-tuning pass happens fairly with transparent negotiation (FR34)**.

**Acceptance Criteria:**

**Given** the courtesy pass phase begins
**When** each player across from each other selects their tile count (0-3) and tiles
**Then** each player dispatches `COURTESY_PASS` with `{ count, tileIds }`

**Given** both players select the same count (e.g., both pick 2)
**When** counts are compared
**Then** that count is used — both players swap exactly 2 tiles simultaneously

**Given** players select different counts (e.g., one picks 3, other picks 2)
**When** counts are compared
**Then** the lower count is used (2), and both players swap 2 tiles; the player who picked 3 has only the first 2 of their selected tiles passed

**Given** either player selects 0
**When** the courtesy pass resolves
**Then** no tiles are exchanged — the courtesy pass is skipped for this pair

**Given** the courtesy pass resolves (or is skipped with count 0)
**When** the Charleston phase ends
**Then** `gamePhase` transitions from `charleston` to `play`, and East's first turn begins (14 tiles, discard only — no draw)

**Given** a resolved courtesy pass with mismatched counts
**When** the state update is broadcast
**Then** the `resolvedAction` includes both players' requested counts and the actual count used, enabling the UI to narrate the negotiation (e.g., "Linda wanted 3, Sarah wanted 2 — passing 2 each")

### Story 3B.4: Charleston UI — Direction Indicator, TileSelectionAction & Pass Interaction

As a **player**,
I want **a clear Charleston interface showing pass direction, tile selection progress, and a Pass button, with the shared TileSelectionAction composable for selecting tiles from my rack**,
So that **the Charleston feels alive and social, not like filling out a form (UX-DR26, UX-DR29)**.

**Acceptance Criteria:**

**Given** the Charleston phase is active
**When** viewing the game table
**Then** a CharlestonZone component displays: a bold direction arrow (Right/Across/Left), a progress indicator ("2 of 3 selected"), and a "Pass" button (UX-DR26)

**Given** the TileSelectionAction composable
**When** used during Charleston
**Then** it manages selection state for N tiles (3 for regular passes), shows progress ("2 of 3 selected"), and provides confirm/cancel actions — reusable by call confirmation and Joker exchange in future epics (UX-DR29)

**Given** the player selects 3 tiles
**When** all 3 are selected
**Then** the "Pass" button becomes active (Primary tier — gold fill), and tapping it dispatches `CHARLESTON_PASS`

**Given** the blind pass (Left in first Charleston, Right in second)
**When** entering the blind pass
**Then** the UI displays a clear "Select tiles before seeing received tiles" indicator, and received Across tiles are visually hidden/locked until selection is made (UX-DR26 blind-locked state)

**Given** tiles are passed and received
**When** the pass animation plays
**Then** tiles glide in the direction of the pass (expressive timing, 400ms) matching the direction indicator, and received tiles appear in the rack

**Given** the second Charleston vote
**When** the prompt appears
**Then** it displays as inline buttons ("Yes" / "No") in the action zone — not a modal (UX-DR37)

**Given** the courtesy pass
**When** selecting tile count
**Then** the UI shows a 0-3 selector and the TileSelectionAction composable handles tile selection for the chosen count

**Given** the Charleston phase
**When** checking social features
**Then** voice chat, text chat (if available), and reactions remain fully active — the social layer is never blocked by Charleston (UX-DR26)

### Story 3B.5: Charleston Disconnect Handling

As a **player**,
I want **the game to handle disconnections during Charleston gracefully by auto-passing random non-Joker tiles after a grace period**,
So that **one player's network issue doesn't freeze the entire Charleston for everyone (FR107)**.

**Acceptance Criteria:**

**Given** a player disconnects during a Charleston pass
**When** the grace period (~30 seconds) expires without reconnection
**Then** the server auto-passes 3 random non-Joker tiles from the disconnected player's rack (FR107)

**Given** auto-pass tile selection
**When** choosing tiles to pass for the disconnected player
**Then** Jokers are excluded from the selection as a courtesy to the disconnected player (even though passing Jokers is legal per FR36)

**Given** a player had partially selected tiles before disconnecting
**When** the grace period expires
**Then** the partial selection is discarded and 3 random non-Joker tiles are passed instead — partial state is not trusted

**Given** a player disconnects and reconnects within the grace period
**When** they rejoin
**Then** they resume the Charleston with their full rack intact and must select their tiles normally — no auto-pass occurs

**Given** the courtesy pass phase
**When** a player disconnects
**Then** the same grace period applies; if expired, an auto-selection of 0 tiles is used (skipping the courtesy pass for that pair)

**Given** the second Charleston vote
**When** a player disconnects during the vote
**Then** their vote defaults to "No" after the grace period — declining the optional second Charleston is the safer default

---

## Epic 3C: Advanced Rules

Complete rules engine — Joker exchange, dead hands, social governance (Social Override + Table Talk Report), wall end scenarios, and concealed hand validation. This epic makes the game fully rule-complete per NMJL standards.

**Note on voting pattern reuse:** Story 3C.4 (Social Override) builds the unanimous voting pattern first. Story 3C.5 (Table Talk Report) reuses the same UI pattern with majority (2/3) threshold.

**Note on TypeScript unions:** Stories in this epic extend `GameAction` and `ResolvedAction` unions with Joker exchange, dead hand, social override, and table talk types. See Epic 3A note.

**Note on Story 3C.4 scope:** This story builds BOTH the voting interaction pattern AND the state reversal logic (undo a discard: remove from discard pool, return to rack, revert turn). The reversal logic is unique to Social Override and does not depend on 3C.3 (Dead Hand).

### Story 3C.1: Joker Exchange Mechanic

As a **player**,
I want **to exchange a natural tile from my rack for a Joker in any player's exposed group on my turn (before discarding)**,
So that **I can strategically acquire Jokers to complete my hand (FR53, FR54, FR55)**.

**Acceptance Criteria:**

**Given** it is my turn and I have drawn a tile (or it's East's first turn)
**When** I dispatch `JOKER_EXCHANGE` with `{ jokerGroupId, naturalTileId }`
**Then** the Joker is moved from the exposed group to my rack, and my natural tile replaces it in the exposed group

**Given** an exposed group with identity "Kong of 3-Bam" containing a Joker
**When** I attempt to exchange with a 3-Bam from my rack
**Then** the exchange succeeds — the natural tile matches the group's fixed identity (FR55)

**Given** an exposed group with identity "Kong of 3-Bam" containing a Joker
**When** I attempt to exchange with a 5-Dot from my rack
**Then** `{ accepted: false, reason: 'TILE_DOES_NOT_MATCH_GROUP' }` — the natural tile must match the group's identity exactly

**Given** an exposed group with no Jokers
**When** I attempt a Joker exchange
**Then** `{ accepted: false, reason: 'NO_JOKER_IN_GROUP' }` is returned

**Given** it is my turn
**When** I perform a Joker exchange
**Then** I can perform additional exchanges before discarding — multiple exchanges per turn are allowed (FR54)

**Given** it is NOT my turn
**When** I attempt a Joker exchange
**Then** `{ accepted: false, reason: 'NOT_YOUR_TURN' }` is returned

**Given** I have already discarded this turn
**When** I attempt a Joker exchange
**Then** `{ accepted: false, reason: 'ALREADY_DISCARDED' }` — exchanges must happen before discarding

**Given** a Joker exchange succeeds
**When** the state update is broadcast
**Then** the `resolvedAction` includes the player ID, group ID, and natural tile ID so all clients can animate the swap

### Story 3C.2: Simplified Joker Rules (Host Option)

As a **host player**,
I want **to enable simplified Joker rules that disable Joker exchange from exposed groups**,
So that **mixed-experience groups can play without the complexity of Joker exchange strategy (FR56)**.

**Acceptance Criteria:**

**Given** the host sets Joker rules to "simplified" in room settings
**When** a player attempts `JOKER_EXCHANGE` during a game
**Then** `{ accepted: false, reason: 'JOKER_EXCHANGE_DISABLED' }` is returned

**Given** simplified Joker rules are active
**When** checking other Joker behaviors
**Then** all standard rules still apply: Jokers substitute in groups of 3+, cannot be in pairs/singles, cannot be discarded — only exchange is disabled

**Given** the host changes Joker rules between games
**When** the setting is changed
**Then** the new rules apply to the next game; the current game (if in progress) is unaffected

**Given** the room settings
**When** checking the Joker rule option
**Then** two options are available: "Standard" (default, exchange enabled) and "Simplified" (exchange disabled)

### Story 3C.3: Dead Hand Detection & Enforcement

As a **player**,
I want **automatic dead hand detection and enforcement when rule violations occur, with the dead hand player continuing to draw and discard but unable to win or call**,
So that **rule integrity is maintained without ending the game prematurely (FR76, FR77, FR78, FR79)**.

**Acceptance Criteria:**

**Given** a player confirms an invalid Mahjong declaration (after dismissing the cancel warning)
**When** dead hand is triggered
**Then** the player is marked as `deadHand: true` in game state (FR76)

**Given** an exposed group is confirmed but later found invalid (irretractable — past the confirmation phase)
**When** dead hand is triggered
**Then** the player is marked as `deadHand: true`

**Given** the server detects a player with the wrong number of tiles in their rack
**When** the count mismatch is detected
**Then** dead hand is enforced automatically

**Given** a player has `deadHand: true`
**When** it is their turn
**Then** they draw from the wall and discard normally — the game loop is not interrupted (FR77)

**Given** a player has `deadHand: true`
**When** a call window opens
**Then** their call options are suppressed — they cannot call any discards (FR77)

**Given** a player has `deadHand: true`
**When** other players check their options
**Then** other players CAN call the dead hand player's discards normally (FR78)

**Given** a dead hand player's exposed tiles
**When** viewing the table
**Then** their exposed groups remain visible to all players (FR79)

**Given** the dead hand indicator (UI)
**When** viewed by the affected player
**Then** a persistent subtle badge ("Dead Hand") appears near their rack in `text-secondary` with `state-error` coral border (UX-DR35)

**Given** the dead hand indicator
**When** viewed by OTHER players
**Then** no dead hand indicator is shown — other players observe the behavioral change (no calling) but the system never publicly broadcasts the dead hand (UX-DR35)

### Story 3C.4: Social Override System (Unanimous Vote Undo)

As a **player**,
I want **to request an undo for accidental discards or mistaken calls, requiring unanimous approval from the other 3 players**,
So that **friends can forgive honest mistakes the way they would in person (FR84, FR85, FR86, FR87, FR88, UX-DR34)**.

**Acceptance Criteria:**

**Given** a player just discarded a tile
**When** the next irreversible game state change has NOT occurred (no draw from wall, no resolved call)
**Then** a "Request Undo" option is available to the player who discarded (FR86)

**Given** a player dispatches `SOCIAL_OVERRIDE_REQUEST` with a description
**When** the request is received
**Then** all other 3 players see an inline vote prompt: "[Player] requests undo — approve/deny" (UX-DR34)

**Given** the vote prompt
**When** all 3 non-requesting players vote approve
**Then** the undo is applied — the discard is reversed (tile returns to rack, discard pool reverts, turn state reverts), and all players are notified (FR85)

**Given** the vote prompt
**When** any player votes deny
**Then** the undo is rejected immediately — no reversal, play continues

**Given** the vote prompt
**When** 10 seconds pass without all 3 responses
**Then** silence = deny — the override is rejected (FR87)

**Given** the undo is approved
**When** checking the pending discard during the vote
**Then** the tile subtly pulses in the discard pool signaling "this action is in question" and game state is frozen until resolution (UX-DR34)

**Given** all social overrides
**When** checking the log
**Then** every override request and result is logged and visible to the host for transparency (FR88)

**Given** the scope of Social Override
**When** checking what can be undone
**Then** it applies ONLY to accidental discards, mistaken calls, and Charleston passing errors — NOT scoring disputes, dead hands, or Mahjong challenges (FR84)

### Story 3C.5: Table Talk Report (Majority Vote Dead Hand)

As a **player**,
I want **to report table talk violations (naming a specific needed tile) with a majority vote that enforces a dead hand if upheld**,
So that **verbal rules are enforceable through the game system, distinct from the Social Override system (FR80, FR81, FR82, FR83)**.

**Acceptance Criteria:**

**Given** a player suspects table talk (another player named a specific tile they need)
**When** they dispatch `TABLE_TALK_REPORT` with a brief description
**Then** the report is sent to the other 3 players (excluding the reporter) as a vote prompt

**Given** a Table Talk Report vote
**When** 2 of 3 non-reported players vote to uphold
**Then** the reported player receives a dead hand for the current game (FR82) — uses the same dead hand enforcement from Story 3C.3

**Given** a Table Talk Report vote
**When** fewer than 2 of 3 vote to uphold
**Then** the report is denied — no action taken, play continues

**Given** denied reports
**When** checking the reporter's limit
**Then** denied reports still count toward the 2-report-per-game limit (FR83)

**Given** a player has already submitted 2 Table Talk Reports in the current game
**When** they attempt a third report
**Then** `{ accepted: false, reason: 'REPORT_LIMIT_REACHED' }` — maximum 2 per player per game (FR83)

**Given** the voting UI
**When** presenting the Table Talk Report vote
**Then** it reuses the same voting interaction pattern built in Story 3C.4 (inline prompt, approve/deny buttons) but with a majority threshold (2/3) instead of unanimous (3/3)

### Story 3C.6: Wall End & Last Tile Rules

As a **player**,
I want **the last tile in the wall to follow proper NMJL rules — self-drawn Mahjong is allowed, and the last discard can be called for any valid purpose**,
So that **end-game scenarios play correctly and create natural tension (FR102, FR103)**.

**Acceptance Criteria:**

**Given** the wall has 1 tile remaining
**When** the current player draws the last tile and it completes their hand
**Then** they can declare self-drawn Mahjong normally — all 3 losers pay double (FR102)

**Given** the last tile is drawn and the player discards it
**When** the call window opens for the last discard
**Then** all standard call rules apply — the last discard can be called for Pung, Kong, Quint, or Mahjong, not restricted to Mahjong only (FR103)

**Given** the last discard and no player calls it
**When** the call window closes (all pass or timer expires)
**Then** the game ends as a wall game — `gamePhase` transitions to `scoreboard` with `winnerId: null`, no payments

**Given** the last discard and a player calls Mahjong
**When** the call is validated
**Then** standard Mahjong declaration flow applies — discarder pays double, others pay single

**Given** the last discard and a player calls Pung/Kong (not Mahjong)
**When** the call resolves
**Then** the caller exposes the group but has no tiles to draw — they must discard immediately. A final call window opens on that discard (another player could call Mahjong on it). If no Mahjong call, the game ends as a wall game. No further draws are possible with an empty wall — but call windows on discards still function normally until the game ends.

### Story 3C.7: Concealed Hand Validation at Mahjong

As a **player**,
I want **Mahjong validation to check that concealed hand requirements are satisfied — groups in concealed (C) hands must have been formed from the wall, not from calls**,
So that **concealed hand wins are legitimate and the card's C/X markings are enforced (FR62)**.

**Acceptance Criteria:**

**Given** a player declares Mahjong with a hand matching a Concealed (C) pattern on the card
**When** validation checks the hand
**Then** it verifies that ALL groups were formed by drawing from the wall — no groups were formed via calls (exposed)

**Given** a player pursued a concealed hand but called a discard during the game (creating an exposed group)
**When** declaring Mahjong against a concealed-only pattern
**Then** validation fails — the exposed group disqualifies the concealed pattern, and the invalid Mahjong flow from Story 3A.8 applies (private warning, cancel option)

**Given** a hand with mixed concealed/exposed requirements at the group level
**When** validating
**Then** each group is checked individually — concealed-required groups must not have been formed via calls, while exposed-allowed groups can be either (FR62, extending Story 2.5)

**Given** the hand guidance system (built in Epic 5B)
**When** a player has exposed groups
**Then** the guidance automatically filters out concealed-only patterns that are no longer achievable — this is noted as a dependency for Epic 5B, not built here (FR63)

**Given** the game state
**When** tracking group origin
**Then** every exposed group has metadata recording whether it was formed via a call (exposed) or from the wall (concealed) — this tracking is the foundation for concealed validation

---

## Epic 6A: Text Chat & Reactions

Lightweight social features over the existing WebSocket connection. Text chat and one-tap reactions during all game phases. The SlideInPanel component built here establishes the shared panel architecture reused by the NMJL card panel in Epic 5B.

### Story 6A.1: Chat Message Protocol & Server Handling

As a **developer**,
I want **chat and reaction messages handled by the server with sanitization, rate limiting, and broadcast to all room participants**,
So that **the social communication layer is secure and reliable (FR111, FR112, NFR46, NFR47, NFR48)**.

**Acceptance Criteria:**

**Given** a player sends a `CHAT` message with text
**When** the server receives it
**Then** the text is sanitized (capped at 500 characters, control characters stripped), and broadcast as a `ChatBroadcast` to all connected players with `playerId`, `playerName`, `text`, and `timestamp` (NFR46)

**Given** a player sends a `REACTION` message with an emoji
**When** the server receives it
**Then** the emoji is validated against a predefined allowlist, and broadcast as a `ReactionBroadcast` to all connected players (NFR46)

**Given** a reaction with an emoji not on the allowlist
**When** the server receives it
**Then** the message is rejected silently — no broadcast, no error response

**Given** a player sends chat messages rapidly
**When** exceeding 10 messages per 10 seconds
**Then** excess messages are dropped silently — no error sent, no crash (NFR47)

**Given** a player sends reactions rapidly
**When** exceeding 5 per 5 seconds
**Then** excess reactions are dropped silently (NFR47)

**Given** the chat message store on the server
**When** messages accumulate
**Then** the server retains the last 100 messages per room in a ring buffer (AR30 payload budget)

**Given** all chat and reaction messages
**When** checking rendering safety
**Then** messages are broadcast as plain strings — the client renders them via Vue text interpolation (`{{ }}`) only, never `v-html` (NFR48)

### Story 6A.2: Chat Panel UI (SlideInPanel)

As a **player**,
I want **a chat panel that slides in from the right on desktop/iPad and slides up from the bottom on mobile, showing messages and a text input**,
So that **I can text chat with friends during all game phases without leaving the game view (FR111, UX-DR12, UX-DR28)**.

**Acceptance Criteria:**

**Given** the SlideInPanel component
**When** used for the chat panel
**Then** it slides in from the right edge on desktop/iPad (~280px wide) and slides up from the bottom on mobile as a partial-height panel with the rack still visible (UX-DR28)

**Given** the SlideInPanel architecture
**When** multiple panel instances exist (chat now, NMJL card in Epic 5B)
**Then** only one panel can be open at a time — opening one closes the other. The component manages mutual exclusivity via a shared panel state (UX-DR12)

**Given** the chat panel is open
**When** checking floating reactions
**Then** reactions are hidden while any SlideInPanel is open (play mode vs. reference mode) (UX-DR12)

**Given** the chat panel
**When** viewing messages
**Then** messages display with player name, text, and timestamp in a scrollable list. New messages auto-scroll to bottom unless the user has scrolled up.

**Given** the chat input
**When** typing and pressing Enter or tapping Send
**Then** the message is dispatched as a `CHAT` client message and the input clears

**Given** keyboard navigation
**When** focus enters the chat input
**Then** Escape exits chat focus and returns to game zones (FR119, UX-DR43)

**Given** the panel open/close animation
**When** toggling the panel
**Then** it uses `timing-tactile` (120ms) and `ease-tactile` tokens (UX-DR28)

**Given** the chat toggle
**When** on desktop/iPad
**Then** a tertiary-styled toggle button is positioned at the right edge of the game table

**Given** the chat toggle on mobile
**When** on phone viewports
**Then** the toggle lives in the bottom bar alongside future NMJL and A/V toggles

### Story 6A.3: Quick Reactions System

As a **player**,
I want **a persistent row of 4-6 one-tap reaction buttons that send expressive emoji to the whole table**,
So that **I can react to game moments without interrupting voice chat or typing (FR112)**.

**Acceptance Criteria:**

**Given** the reaction bar
**When** viewing the game table during play
**Then** a row of 4-6 reaction emoji buttons is always visible (e.g., thumbs up, laughing, groaning, surprised, celebrating, crying)

**Given** a reaction button
**When** tapped
**Then** a `REACTION` message is dispatched immediately — one tap, no confirmation, no menu

**Given** a reaction is received from another player
**When** the broadcast arrives
**Then** a brief animated reaction bubble appears near the sending player's seat position, auto-dismissing after 2-3 seconds

**Given** a reaction bubble
**When** multiple reactions arrive quickly
**Then** bubbles stack or replace gracefully — no layout thrashing, no overlapping text

**Given** the reaction bar positioning
**When** on desktop/iPad
**Then** reactions display as a floating vertical stack near the right edge

**Given** the reaction bar positioning on mobile
**When** on phone viewports
**Then** reactions display as a horizontal row above the rack

**Given** any SlideInPanel is open (chat or future NMJL)
**When** checking reaction visibility
**Then** the reaction bar hides — play mode (reactions visible) vs. reference mode (panel open) are mutually exclusive (UX-DR12)

**Given** reactions on reconnect
**When** a player reconnects
**Then** they see new reactions going forward only — no reaction history is replayed (fire-and-forget)

### Story 6A.4: Chat History on Connect/Reconnect

As a **player**,
I want **to see recent chat messages when I join a room or reconnect after a network hiccup**,
So that **I don't miss the conversation and can catch up on what friends were saying (FR105)**.

**Acceptance Criteria:**

**Given** a player connects to a room (initial join or reconnect)
**When** the WebSocket connection is established
**Then** the server sends a `CHAT_HISTORY` message containing up to 100 recent messages for the room

**Given** the `CHAT_HISTORY` message
**When** checking payload size
**Then** if the serialized message would exceed the WebSocket `maxPayload` (64KB), the server truncates from the oldest end until it fits (AR30)

**Given** the client receives `CHAT_HISTORY`
**When** rendering the chat panel
**Then** messages populate in chronological order with the most recent at the bottom — the same view as if the player had been connected the whole time

**Given** a room with no chat messages yet
**When** a player connects
**Then** `CHAT_HISTORY` is sent with an empty messages array — no error, the chat panel is simply empty

**Given** chat messages arriving after `CHAT_HISTORY`
**When** new `ChatBroadcast` messages arrive
**Then** they append to the existing chat store — no duplication, no gap between history and live messages

---

## Epic 4B: Multiplayer Resilience

Handle real-world scenarios gracefully — disconnections with full state restore, phase-specific fallbacks, player departures with dead seats, turn timeouts, 5th player handling, host settings, and host migration. This epic makes the game reliable for 60-90 minute sessions.

**Note on TypeScript unions:** Stories in this epic extend `GameAction` and `ResolvedAction` unions with timeout, departure, host migration, and settings types. See Epic 3A note.

### Story 4B.1: Reconnection with Full State Restore

As a **player**,
I want **to refresh my browser or recover from a network hiccup and seamlessly return to my seat with full game state restored**,
So that **a brief drop doesn't ruin game night (FR104, FR105, FR106, AR11)**.

**Acceptance Criteria:**

**Given** a player's WebSocket connection drops
**When** the server detects the disconnect (via heartbeat timeout or close event)
**Then** the player is marked as `disconnecting`, a ~30-second grace period starts, and all other clients receive a `PLAYER_RECONNECTING` resolved action (FR104, FR106)

**Given** the other players' view
**When** a player is reconnecting
**Then** a "Sarah is reconnecting..." indicator appears at the disconnected player's seat position — gentle, informational, no spinner (UX-DR38)

**Given** the player's browser refreshes or connection restores
**When** the client reads the session token from sessionStorage and connects with `{ roomCode, token }`
**Then** the server recognizes the token, maps to the existing seat, cancels the grace period timer, sends full game state + chat history, and broadcasts `PLAYER_RECONNECTED` to all clients (AR11)

**Given** the reconnecting player receives full state
**When** their client renders
**Then** board, rack, scores, discard pools, exposed groups, current turn, and game phase are all restored — no loading screen, no confusion about whose turn it is (FR105)

**Given** the reconnecting player's client-only state (rack arrangement, preferences)
**When** checking after reconnect
**Then** rack tile arrangement is lost (client-only state doesn't survive reconnect) — the Sort button provides quick recovery

**Given** the grace period expires without reconnection
**When** 30 seconds pass
**Then** phase-specific fallback actions are triggered (see Story 4B.2)

**Given** a Playwright E2E test
**When** testing basic reconnection
**Then** the test simulates: player connects, game starts, player disconnects, player reconnects with same token, and verifies full state restoration including rack contents and turn state

### Story 4B.2: Phase-Specific Reconnection Fallbacks

As a **player**,
I want **the game to handle my disconnection gracefully regardless of what phase the game is in, with appropriate automatic actions after the grace period**,
So that **one player's network issue doesn't freeze the game for everyone (FR107)**.

**Acceptance Criteria:**

**Given** a player disconnects during their turn
**When** the grace period expires
**Then** auto-discard of the most recently drawn tile — returning the player to their pre-draw state (FR107)

**Given** a player disconnects during the call window
**When** the grace period expires
**Then** the disconnected player's call opportunity is forfeited (auto-pass); the call resolves with remaining players' responses

**Given** a player disconnects during Charleston
**When** the grace period expires
**Then** auto-pass 3 random non-Joker tiles from their rack to keep the Charleston moving (FR107) — same logic as Story 3B.5

**Given** a player disconnects when it is NOT their turn
**When** the grace period expires
**Then** no immediate action needed — the game already continues; fallback triggers when it becomes their turn

**Given** a player disconnects during the scoreboard/lingering phase
**When** the grace period expires
**Then** no game action needed — the player simply appears as disconnected; rematch can proceed if 3 remaining players are connected

**Given** a Playwright E2E test suite for phase-specific reconnection
**When** testing each scenario
**Then** dedicated tests cover: disconnect during own turn (verify auto-discard), disconnect during call window (verify auto-pass), disconnect during Charleston (verify auto-pass of 3 non-Joker tiles), and disconnect during opponent's turn (verify no disruption)

### Story 4B.3: Simultaneous Disconnection & Game Pause

As a **player**,
I want **the game to pause entirely if 2 or more players disconnect simultaneously, and auto-end if they don't reconnect within 2 minutes**,
So that **the game doesn't continue in a broken state (FR108, FR109)**.

**Acceptance Criteria:**

**Given** 2 or more players lose their WebSocket connection at the same time
**When** the server detects simultaneous disconnections
**Then** the game pauses entirely — no turns advance, no timers run, connected players see "Waiting for players to reconnect..." (FR108)

**Given** the game is paused due to simultaneous disconnection
**When** all disconnected players reconnect within 2 minutes
**Then** the game resumes from exactly where it paused — full state restoration for all returning players

**Given** the game is paused
**When** 2 minutes pass without all disconnected players returning
**Then** the game auto-ends, transitions to scoreboard phase with session scores through the last completed game (FR109)

**Given** the simultaneous disconnect threshold
**When** checking what counts
**Then** 2 or more seats without an active WebSocket connection at the same time triggers the pause — this includes one player disconnecting while another is already in grace period

**Given** a paused game
**When** one of the disconnected players reconnects but the other doesn't
**Then** the game remains paused until the 2-minute timeout — partial recovery doesn't resume play

### Story 4B.4: Turn Timeout & AFK Escalation

As a **player**,
I want **a forgiving timeout system that nudges me when it's my turn, auto-discards if I'm away, and lets the group vote to convert a persistently AFK player to a dead seat**,
So that **one distracted player doesn't freeze the game for everyone (FR89, FR90, FR91, FR92, FR93)**.

**Acceptance Criteria:**

**Given** a timed game with configurable timer (15-30 seconds)
**When** the current player's turn timer expires for the first time
**Then** a gentle nudge notification appears ("It's your turn!") with a time extension (FR91)

**Given** the same player's turn timer expires a second time
**When** the second timeout fires
**Then** auto-discard of the most recently drawn tile — the most forgiving automatic action (FR92)

**Given** the same player times out 3+ consecutive turns
**When** the third consecutive timeout occurs
**Then** the other 3 players receive a vote prompt: "Convert [player] to a dead seat?" requiring majority (2 of 3) to pass (FR93)

**Given** the AFK vote passes
**When** 2 of 3 players approve
**Then** the AFK player becomes a dead seat (see Story 4B.5 dead seat behavior)

**Given** the AFK vote fails
**When** fewer than 2 approve
**Then** auto-discard continues for subsequent timeouts — no limit on auto-discards

**Given** no-timer mode is selected by the host
**When** playing
**Then** no timeouts occur at all — the group self-regulates pacing through social cues (FR90)

**Given** the timeout counter
**When** the player takes a voluntary action (draws, discards, or calls)
**Then** the consecutive timeout counter resets to 0

### Story 4B.5: Player Departure & Dead Seat

As a **player**,
I want **the game to handle a player permanently leaving with a dead seat that auto-passes all turns, and to auto-end if 2+ players leave**,
So that **the remaining 3 players can finish their game (FR94, FR95, FR96, FR97, FR99)**.

**Acceptance Criteria:**

**Given** a player permanently leaves (quit, not a disconnect)
**When** the departure is detected
**Then** all other players are notified: "[Player] has left the game" (FR94)

**Given** a player departs
**When** the remaining players see the prompt
**Then** "Continue with [player] as a dead seat, or end game?" appears — majority vote (2 of 3) decides (FR95)

**Given** a dead seat is created
**When** it would be the dead seat's turn
**Then** their turn is skipped — the next player in order draws instead. The dead seat's hand is locked, they auto-pass all call windows, and their exposed tiles remain visible. (FR96)

**Given** a dead seat
**When** checking wall interaction
**Then** wall tiles that would be the dead seat's draw are skipped — the next player draws instead, giving remaining players access to more wall tiles (accepted balance trade-off per GDD)

**Given** 2 or more players leave the game
**When** the second departure occurs
**Then** the game auto-ends immediately — final scoreboard shows scores through the last completed game (FR97)

**Given** a dead seat
**When** other players discard
**Then** the dead seat's auto-pass in call windows means their discards are never called by the dead seat, but other players CAN call each other's discards normally

**Given** AI fill-in
**When** checking options
**Then** no AI fill-in exists for MVP — dead seat is the only option (FR99)

### Story 4B.6: Host Migration

As a **player**,
I want **host privileges to automatically transfer to the next player if the host disconnects permanently**,
So that **the room remains functional and someone can start rematches and change settings (FR98, UX-DR host disconnect pattern)**.

**Acceptance Criteria:**

**Given** the host disconnects
**When** the grace period (~30 seconds) expires without reconnection
**Then** host privileges transfer to the next connected player in counterclockwise seat order

**Given** host migration occurs
**When** the new host is promoted
**Then** all players receive a `HOST_PROMOTED` resolved action, and a brief toast displays: "[New host] is now the host"

**Given** the new host
**When** checking their capabilities
**Then** they can: start/rematch games, change room settings between games, and end the session — same as the original host

**Given** the original host reconnects after migration
**When** they rejoin
**Then** they rejoin as a regular player — host role does NOT automatically return (prevents role-bouncing on flaky connections)

**Given** host migration during different game states
**When** checking behavior
**Then** during lobby: new host can start the game; during mid-game: migration is silent (host is just a player during gameplay); during scoreboard: new host can tap "Play Again" or change settings

**Given** all four players disconnect
**When** any player reconnects within 5 minutes
**Then** they become host and can wait for others; after 5 minutes with zero connections, the room is cleaned up

### Story 4B.7: Host Settings & 5th Player Handling

As a **host player**,
I want **to configure game settings (timer, Joker rules, dealing style) between games with changes visible to all players, and for a 5th visitor to see a friendly "table is full" page**,
So that **I can customize the game for my group and extra visitors aren't confused (FR3, FR4, FR5, FR6)**.

**Acceptance Criteria:**

**Given** the host
**When** between games (lobby or scoreboard phase)
**Then** a settings panel is accessible with options: timer mode (15-30 sec or no timer), Joker rules (standard or simplified), dealing style (instant or animated traditional) (FR4)

**Given** the host changes a setting
**When** the change is saved
**Then** all players see a brief toast notification: "Host changed [setting] to [value]" (FR5)

**Given** a game is in progress
**When** the host attempts to change settings
**Then** the settings are not changeable mid-game — changes only apply between games (FR4)

**Given** current game settings
**When** any player wants to view them
**Then** a collapsible settings panel shows all current settings (FR6)

**Given** 4 players are already in the room
**When** a 5th person clicks the room link
**Then** the client calls `GET /api/rooms/:code/status`, receives `{ full: true }`, and shows a friendly branded "This table is full" page without attempting a WebSocket connection (FR3)

**Given** the "table is full" page
**When** viewing options
**Then** a spectator mode option is available — read-only view of the table with no racks visible (FR3)

**Given** REMATCH preconditions
**When** the host taps "Play Again"
**Then** the server validates: sender is host, all 4 seats have connected players, phase is scoreboard. If players left between games, the room returns to lobby phase to wait for a 4th. Dealer rotates counterclockwise for the new game (FR12).

---

## Epic 5B: Remaining UI

Complete UI experience — NMJL card display with hand guidance, wall counter tension states, session scoreboard, rematch flow, show hands, settings panel, and recent activity indicator. This epic delivers the full "reference mode" and post-game experience.

**Note on TypeScript unions:** Stories in this epic may extend `ResolvedAction` union with new UI-relevant resolved actions (e.g., `SHOW_HAND`, wall counter state changes). See Epic 3A note.

### Story 5B.1: NMJL Card Panel (SlideInPanel + Full-Screen Overlay)

As a **player**,
I want **to view the NMJL card hand patterns via a slide-in panel on desktop/iPad or a full-screen overlay on mobile, with quick toggle access**,
So that **I can reference the card during play the way I'd glance at the physical card on the table (FR41, FR42, UX-DR25)**.

**Acceptance Criteria:**

**Given** the NMJL card panel on desktop/iPad (>=1024px)
**When** the player taps the card toggle
**Then** a SlideInPanel slides in from the right (~280px), reusing the SlideInPanel architecture from Epic 6A, overlaying the felt surface (UX-DR25)

**Given** the NMJL card panel on mobile (<768px)
**When** the player taps the card toggle in the bottom bar
**Then** a full-screen overlay displays the card content with a close button, back gesture, or tap-outside to dismiss (UX-DR25)

**Given** the NMJL card panel and the chat panel
**When** opening one
**Then** the other closes — mutual exclusivity enforced via the shared SlideInPanel state from Epic 6A (UX-DR12)

**Given** the card content
**When** viewing hand patterns
**Then** all ~50+ hand patterns display organized by category (2468, Quints, Consecutive Run, etc.) with notation, point values, and concealed/exposed markers (C/X)

**Given** a hand pattern on the card
**When** tapping it
**Then** an enlarged detail view shows the pattern with clear group breakdowns

**Given** the Charleston phase on mobile
**When** the NMJL card overlay is opened
**Then** it uses a split-view layout: card in the top portion, rack visible in the bottom — never covering the rack entirely (UX-DR17)

**Given** the NMJL card sidebar on desktop
**When** checking behavior
**Then** it is collapsible even on desktop as an escape valve for more table space

### Story 5B.2: Hand Guidance Engine & Card Highlighting

As a **player**,
I want **the NMJL card to subtly highlight which hands are still achievable given my current tiles, ranked by closeness to completion**,
So that **I can focus my strategy without memorizing the entire card (FR43, FR44, FR45, FR63)**.

**Acceptance Criteria:**

**Given** the hand guidance engine in shared/
**When** called with a player's rack tiles and the NMJL card data
**Then** it returns all card hands ranked by closeness (tiles away from completion) — achievable hands with a distance score

**Given** the guidance computation
**When** measuring performance
**Then** it completes in under 100ms per invocation to run during the natural thinking pause on each draw/discard (NFR8)

**Given** the guidance results rendered on the NMJL card panel
**When** viewing the card
**Then** close hands are highlighted with `guidance-achievable` (warm gold/neutral), distant hands are faded with `guidance-distant`, and impossible hands are hidden — highlights use gold/neutral, NEVER suit colors (UX-DR1 hand guidance tokens)

**Given** a player's first 3 completed games (tracked in localStorage)
**When** checking hand guidance default
**Then** guidance is ON by default; after 3 completed games, it auto-disables with a message "You can re-enable hints in settings" (FR44)

**Given** a player with exposed groups
**When** guidance computes achievable hands
**Then** concealed-only patterns that are no longer achievable due to exposed groups are automatically filtered out (FR63)

**Given** the host
**When** checking room settings
**Then** the host can toggle hints on/off for all players in room settings (FR45)

**Given** the guidance toggle
**When** a player manually toggles guidance in their preferences
**Then** the setting persists in localStorage via the Pinia preferences store

### Story 5B.3: Wall Counter States & Tension Styling

As a **player**,
I want **the wall counter to visually shift from neutral to warning to critical as tiles run out**,
So that **I feel the natural tension of the shrinking wall without an artificial timer (FR100, UX-DR24)**.

**Acceptance Criteria:**

**Given** the wall counter component (basic version from Story 5A.8)
**When** tiles remaining are above 20
**Then** the counter displays in `wall-normal` neutral styling

**Given** tiles remaining drop to 20 or fewer
**When** the counter updates
**Then** it transitions to `wall-warning` amber styling with a subtle animation using `timing-expressive` (400ms)

**Given** tiles remaining drop to 10 or fewer
**When** the counter updates
**Then** it transitions to `wall-critical` stronger urgency styling

**Given** each state transition
**When** the styling changes
**Then** `aria-live="polite"` announces the state change for screen readers (UX-DR24)

**Given** the exact warning/critical thresholds
**When** tuning during gameplay
**Then** the thresholds are configurable constants (not hardcoded in the component) for gameplay tuning

### Story 5B.4: Session Scoreboard & Rematch Flow

As a **player**,
I want **a cumulative session scoreboard that tracks scores across multiple games and a one-tap rematch to keep playing**,
So that **game night flows naturally from one game to the next with a running score (FR75, FR131, FR132)**.

**Acceptance Criteria:**

**Given** a game ends (Mahjong or wall game)
**When** the scoreboard displays
**Then** it shows: per-game scoring breakdown (hand value, who pays what), cumulative session totals for all players, and the current game's result prominently

**Given** the session scoreboard
**When** multiple games have been played
**Then** each game's result is listed with running totals — players can see the arc of the session

**Given** the rematch button
**When** displayed on the scoreboard
**Then** it uses Primary tier styling (gold fill) but is "present, not pushy" — positioned clearly but not dominating the social wind-down space (FR132)

**Given** the host taps "Play Again"
**When** all 4 seats have connected players
**Then** dealer rotates counterclockwise, a new game begins with dealing animation, and the Charleston starts — no room recreation, no re-sharing links

**Given** the Lingering mood
**When** the scoreboard is displayed
**Then** the visual atmosphere shifts: softer warm tones return, felt recedes, generous whitespace — the mood class transitions to `mood-lingering` (UX-DR49, implemented visually in Epic 7)

**Given** the session ends
**When** the host taps "End Session"
**Then** final session scores are displayed with a summary view

### Story 5B.5: Show Hands & Post-Game Social

As a **player**,
I want **to optionally reveal my rack after a game ends so friends can see what I was building and we can rehash the game**,
So that **the post-game social moment mirrors the in-person tradition of showing hands (FR130, FR133)**.

**Acceptance Criteria:**

**Given** a game ends (scoreboard phase)
**When** the "Show Hand" option appears
**Then** each player independently sees a "Show My Hand" button — it's optional, not automatic

**Given** a player taps "Show My Hand"
**When** the action is dispatched
**Then** the server broadcasts their full rack to all clients via `STATE_UPDATE` with `resolvedAction: { type: 'SHOW_HAND', playerId }` — their tiles become visible at their seat position

**Given** multiple players show their hands
**When** viewing the table
**Then** each revealed hand displays at the respective player's seat area — visible to all, laid out clearly

**Given** the post-game phase
**When** checking social features
**Then** voice chat, text chat, and reactions remain fully active — the Lingering phase is social time (FR133)

**Given** the `SHOW_HAND` action
**When** checking phase restrictions
**Then** it is only valid during the `scoreboard` phase — attempts during other phases are rejected

### Story 5B.6: Settings Panel & Dealing Style Options

As a **host player**,
I want **a settings panel accessible between games where I can configure timer, Joker rules, dealing style, and hand guidance**,
So that **I can customize the game for my group's preferences (FR4, FR11)**.

**Acceptance Criteria:**

**Given** the settings panel
**When** the host opens it between games
**Then** it displays configurable options: timer mode (15/20/25/30 seconds or no timer), Joker rules (standard or simplified), dealing style (instant or animated traditional), and hand guidance toggle (on/off for all players)

**Given** the animated traditional dealing option (FR11)
**When** selected and a new game starts
**Then** a visual wall-building animation, dice roll to determine break point, and tiles dealt in groups plays before racks populate — faithful to the physical ritual

**Given** any player (not just the host)
**When** wanting to view current settings
**Then** a collapsible settings summary is accessible showing all active game settings (FR6)

**Given** the settings panel component
**When** building UI elements
**Then** BaseToggle and BaseNumberStepper primitives are extracted if not already available — these are the first consumers requiring toggle and stepper components

### Story 5B.7: Recent Activity Indicator (Ticker)

As a **player**,
I want **a subtle game-state ticker showing the last 2-3 events near the turn indicator**,
So that **when I look away briefly (sip of coffee, answer a question), I can re-orient at a glance (UX-DR33)**.

**Acceptance Criteria:**

**Given** the recent activity indicator
**When** game events occur (discards, calls, turn changes)
**Then** the last 2-3 events display in compressed form near the turn indicator: e.g., "Linda discarded 8-Dot -> Sarah called Pung -> Sarah discarded North" (UX-DR33)

**Given** the ticker
**When** no new events occur for 10 seconds
**Then** the ticker fades out — it's transient, not permanent

**Given** the ticker styling
**When** checking visual weight
**Then** it uses `text-secondary` sizing, low opacity, and is positioned to not compete with primary game elements (rack, action zone, turn indicator)

**Given** the ticker data source
**When** checking implementation
**Then** it reads from the same `resolvedAction` stream that updates the board, discard pools, and exposed groups — no separate system or additional WebSocket messages

**Given** the ticker on phone viewports
**When** checking space constraints
**Then** it either displays in a single compressed line or is hidden entirely on the smallest viewports — never competes with the action zone or rack

---

## Epic 6B: Voice & Video (WebRTC) — CUT LINE

Integrated voice and video chat via LiveKit SDK. Players see each other's faces and hear each other's voices — the core social experience. This is the explicit cut target if the timeline is tight. The game ships fully playable with text chat and reactions; WebRTC is added as a fast-follow.

### Story 6B.1: LiveKit SDK Integration & Connection Setup

As a **developer**,
I want **the LiveKit client SDK integrated and connecting players to a voice/video room when they join a game room**,
So that **the WebRTC infrastructure is ready for audio and video streams (FR113, FR114)**.

**Acceptance Criteria:**

**Given** a player joins a game room
**When** the WebSocket connection is established and A/V permissions are granted
**Then** the LiveKit client connects to a LiveKit room mapped to the game room, establishing WebRTC peer connections

**Given** the LiveKit SDK
**When** integrated into the client
**Then** it is loaded separately from the core bundle (not counted toward the 5MB bundle target), and connection is initialized via a `useLiveKit` composable wrapping `livekit-client` (no Vue-specific SDK exists)

**Given** a LiveKit room
**When** checking room mapping
**Then** each game room has a corresponding LiveKit room; the server generates a LiveKit access token when a player joins, sent to the client for authentication

**Given** the LiveKit connection
**When** checking fallback behavior
**Then** if LiveKit connection fails, the game continues with text chat only — WebRTC failure never affects game state or playability (NFR23)

**Given** the LiveKit server infrastructure
**When** checking deployment requirements
**Then** TURN/STUN server configuration is documented for production deployment (NFR45)

### Story 6B.2: Video Thumbnails at Seat Positions

As a **player**,
I want **to see my friends' video feeds at their seat positions around the table, sized appropriately for each device**,
So that **it feels like sitting at a table together — faces arranged around the game (FR114, UX-DR23)**.

**Acceptance Criteria:**

**Given** a player has their camera enabled
**When** viewing the game table
**Then** their video feed displays in a rounded-corner frame at their seat position with a subtle border matching UI chrome

**Given** video frame sizing
**When** on desktop (>1024px)
**Then** frames are ~140x96px — large enough to recognize expressions (UX-DR23)

**Given** video frame sizing on iPad landscape (~1024px)
**When** rendering
**Then** frames are ~120x80px at cardinal seat positions (UX-DR23)

**Given** video frame sizing on phone (<768px)
**When** rendering
**Then** frames shrink to small thumbnails (~40px) with speaking indicators — tap to momentarily expand (UX-DR23)

**Given** a player toggles their camera off
**When** the video stream stops
**Then** an avatar circle with the player's initial replaces the video frame — same size, same position, no layout shift (UX-DR23)

**Given** the layout
**When** a camera toggles on or off
**Then** surrounding game elements (discard pools, rack, action zone) do NOT reposition — video frames and avatar fallbacks occupy identical space

### Story 6B.3: Audio/Video Controls & Permission Handling

As a **player**,
I want **simple mic and camera toggle buttons with friendly guidance for browser permission prompts**,
So that **even non-technical players can enable voice and video without confusion (FR115, UX-DR46)**.

**Acceptance Criteria:**

**Given** a player joins the room
**When** browser mic/camera permissions haven't been granted yet
**Then** a friendly permission prompt appears with guidance: "Allow mic so your friends can hear you" — not the raw browser permission dialog alone (UX-DR46)

**Given** the player grants mic/camera permissions
**When** A/V connects
**Then** voice and video streams begin within 5 seconds in 95% of sessions (NFR50)

**Given** the player denies or dismisses the permission prompt
**When** A/V is unavailable
**Then** the game continues with avatar fallback and text chat — no error modal, no repeated prompting, graceful degradation (UX-DR46)

**Given** mic and camera toggle buttons
**When** viewing the A/V controls
**Then** persistent mic and camera icon buttons are visible in the controls area (desktop) or bottom bar (mobile) — Tertiary tier styling (FR115)

**Given** the mic toggle
**When** tapped
**Then** the mic mutes/unmutes with instant visual feedback (icon change) and no audible pop or click

**Given** the camera toggle
**When** tapped
**Then** the video stream starts/stops with the avatar fallback appearing/disappearing smoothly — no layout shift

### Story 6B.4: Speaking Indicator & Avatar Fallback

As a **player**,
I want **to see who is speaking via a visual indicator at their seat position, whether they have video on or off**,
So that **I can follow the conversation and know who's talking (UX-DR23)**.

**Acceptance Criteria:**

**Given** a player is speaking (mic active, audio detected)
**When** viewing their seat position with camera ON
**Then** a subtle animated ring or glow pulses around their video frame — the "talking" indicator

**Given** a player is speaking with camera OFF
**When** viewing their avatar circle
**Then** the same animated ring pulses around the avatar — speaking is visible regardless of camera state

**Given** `prefers-reduced-motion` is active
**When** a player is speaking
**Then** the talking indicator switches from a pulsing ring to a static solid colored border that appears when speaking and disappears when silent — no animation, same information

**Given** a player with no A/V (text-only)
**When** viewing their seat
**Then** name label + online/away status dot — minimum presence indicator

**Given** the speaking detection
**When** checking sensitivity
**Then** the indicator responds to actual speech, not background noise — LiveKit SDK's voice activity detection is used rather than raw audio level

### Story 6B.5: A/V Reconnection & Graceful Degradation

As a **player**,
I want **voice and video to automatically reconnect when I rejoin after a network hiccup, with a manual retry button if auto-reconnect fails**,
So that **a brief drop doesn't mean losing voice for the rest of the game (FR110, FR116)**.

**Acceptance Criteria:**

**Given** a player reconnects after a disconnect (session token reconnection from Epic 4B)
**When** the WebSocket connection restores
**Then** the LiveKit client automatically attempts to rejoin the voice/video room — a "Reconnecting audio/video..." indicator appears (FR110)

**Given** A/V auto-reconnect succeeds
**When** streams re-establish
**Then** video feeds and audio resume at all seat positions within 10 seconds — the indicator disappears

**Given** A/V auto-reconnect fails
**When** 10 seconds pass without re-establishing
**Then** the player falls back to text-only mode, and a persistent "Reconnect A/V" button appears in the A/V controls area (FR116)

**Given** the "Reconnect A/V" button
**When** tapped
**Then** one retry attempt fires with a 10-second timeout and a spinner on the button. If it fails, the button remains with "Connection failed — try again?" message. No modal, no loop. (FR116)

**Given** A/V failure at any point during the session
**When** checking game impact
**Then** the game is fully playable without A/V — game state, turns, calls, chat, and reactions all function independently of WebRTC status (NFR23)

**Given** the "Reconnect A/V" button
**When** checking availability
**Then** it remains available for the entire session — players can retry at their leisure without time pressure

---

## Epic 7: Visual Polish & Audio

Make the game beautiful and tactile — Three Moods atmosphere, felt texture, celebration cinematics, complete sound design, dark mode, first-visit entrance, and first-launch audio preview. This epic transforms "it works" into "it's gorgeous."

### Story 7.1: Felt Texture & Three Moods Transitions

As a **player**,
I want **a rich felt table texture and gentle visual mood transitions between Arriving (warm lobby), Playing (focused table), and Lingering (relaxed scoreboard)**,
So that **the game feels like a real table and the visual atmosphere matches the emotional arc of game night (UX-DR8, UX-DR9, UX-DR49)**.

**Acceptance Criteria:**

**Given** the felt table surface
**When** viewing during gameplay (Playing mood)
**Then** deep teal felt (`felt-teal`) with CSS grain/noise overlay for material authenticity dominates the view — the surface should read as a physical material, not a flat color

**Given** the Arriving mood (lobby)
**When** players are joining the room
**Then** warmer, lighter tones dominate — soft cream and warm gold, no felt visible, player presence (video/avatars) is the visual focus. Gold accent shifts to warmer/amber. (UX-DR49)

**Given** the Playing mood (active game)
**When** the game starts
**Then** deep teal felt commands the space, UI chrome recedes to edges, tiles and interactions take center stage. Gold accent shifts to cooler/brass. (UX-DR49)

**Given** the Lingering mood (scoreboard)
**When** a game ends
**Then** felt recedes, softer warm tones return but deeper than lobby, generous spacing, unhurried layout. Gold accent shifts to softer/muted. (UX-DR49)

**Given** transitions between moods
**When** the game phase changes
**Then** mood transitions are gentle crossfades (1-2 seconds using `timing-expressive`) orchestrated via Motion for Vue — not hard cuts (UX-DR49)

**Given** the mood-switching mechanism from Story 5A.1
**When** Epic 7 adds the visual polish
**Then** the existing `mood-arriving/mood-playing/mood-lingering` CSS classes already work — this story adds the felt texture, grain overlay, mood-specific gold temperature shifts, and crossfade transitions on top of the existing foundation

**Given** `prefers-reduced-motion`
**When** mood transitions occur
**Then** crossfades collapse to instant switches — no motion, same visual states

### Story 7.2: Celebration Overlay Sequence

As a **player**,
I want **a staged celebration when Mahjong is declared — dim, held beat, hand fan-out, winner spotlight, scoring overlay, and signature motif**,
So that **the climactic moment feels cinematic and shareable (FR70, FR129, UX-DR27)**.

**Acceptance Criteria:**

**Given** a valid Mahjong declaration
**When** the celebration sequence begins
**Then** it proceeds through timed phases: (1) Dim — other players' table areas reduce to 20-30% opacity, excluding video thumbnails and interactive buttons (2) Held beat — 0.5 second anticipatory pause (3) Hand fan-out — winning hand fans from the winner's seat toward center stage in an elegant arc using `timing-expressive` (4) Winner spotlight — warm "Mahjong!" text with winner's name in brushed gold (5) Scoring overlay — hand value and payment breakdown below the fanned hand (6) Signature motif plays (UX-DR27)

**Given** the celebration overlay
**When** a player taps the screen during celebration
**Then** nothing happens — the celebration is NOT dismissable. It plays for all four players. Voice chat remains active throughout. (UX-DR27)

**Given** dimmed areas during celebration
**When** checking contrast
**Then** all visible text in dimmed areas (player names, scores) still meets WCAG AA contrast minimums

**Given** the celebration duration
**When** the sequence completes
**Then** it holds for 5-8 seconds total before transitioning to the scoreboard/Lingering phase. A test asserts the total sequence duration falls within the 5-8 second range.

**Given** `prefers-reduced-motion` celebration
**When** measuring duration
**Then** the sequence is shorter (dim + instant reveal + scoring, no held beat or fan-out animation) — test asserts total time is under 3 seconds

**Given** `prefers-reduced-motion`
**When** Mahjong is declared
**Then** skip the fan-out animation and held beat — hand appears fully revealed at center stage immediately. Dim and spotlight still apply (opacity changes, not motion). (UX-DR27)

**Given** the celebration orchestration
**When** checking the animation system
**Then** Motion for Vue's timeline/sequence API coordinates all phases — no ad-hoc setTimeout chains (AR21)

### Story 7.3: Complete Sound Design (All 10-12 Effects)

As a **player**,
I want **tactile sound effects for every game interaction — tile sounds that feel like real acrylic on felt, and a signature Mahjong motif**,
So that **every interaction feels physical and the game has an audio identity (GDD Audio section)**.

**Acceptance Criteria:**

**Given** the complete sound effect set
**When** checking all required sounds
**Then** the following are implemented: tile draw (soft click), tile discard (crisp clack — already from 5A.5), rack arrangement (gentle slide), call snap (confident snap on exposure), Mahjong motif (3-4 note signature — already from 5A.7), Charleston whoosh (soft glide), turn notification (clear ping that cuts through voice chat), call window alert (brief urgent tone), chat/reaction pop (subtle pop), timer warning (gentle escalating tone), error/invalid (soft forgiving "nope")

**Given** the audio source material
**When** checking timbre
**Then** all tile sounds reference real acrylic or Bakelite tiles on felt — the specific weight and resonance of physical Mahjong tiles, not generic UI clicks

**Given** audio format
**When** checking assets
**Then** all effects are web-optimized (MP3/OGG), under 2 seconds each (except Mahjong motif at 3-4 seconds), total audio footprint under 500KB (NFR7)

**Given** audio settings
**When** checking player controls
**Then** three independent volume channels exist: gameplay effects, notification sounds, ambient/music — each adjustable in settings. Master mute toggle always accessible.

**Given** audio priority
**When** multiple sounds would play simultaneously
**Then** gameplay feedback > notification > ambient. Sound effects never compete with voice chat — they coexist at complementary frequency ranges.

**Given** the optional ambient track
**When** checking availability
**Then** one lo-fi/jazz loop is available in settings for text-only sessions (background music OFF by default)

**Given** the `useAudioStore`
**When** triggering sounds
**Then** game-event sounds (discard, call, Mahjong) are triggered by watching `resolvedAction` on state updates; UI-interaction sounds (button hover, Pass click) are triggered by component event handlers — both use the same store for playback

### Story 7.4: Dark Mode, First-Visit Entrance & Audio Preview

As a **player**,
I want **automatic dark mode that follows my system preference, a graceful first-visit visual entrance, and a brief audio preview on first join**,
So that **evening play is comfortable, first impressions are polished, and players discover the sound design (NFR41, UX-DR47, UX-DR48)**.

**Acceptance Criteria:**

**Given** the player's system is set to dark mode
**When** loading the game
**Then** the UI chrome automatically switches: cream/warm-white -> dark warm gray/charcoal, text inverts to light-on-dark, gold accents remain unchanged, felt table and tile rendering unchanged (NFR41)

**Given** dark mode settings
**When** checking options
**Then** three choices are available: Auto (follow system, default), Light, Dark — stored in localStorage via preferences store

**Given** dark mode
**When** checking all color pairings
**Then** WCAG AA contrast is maintained in dark mode independently — all token pairings pre-validated (UX-DR7 mode-adaptive error colors apply)

**Given** a player's very first visit (no localStorage data)
**When** the page loads
**Then** a graceful 2-second entrance plays: felt texture fades in from warm neutral, tiles materialize subtly — setting the aesthetic tone before anything else (UX-DR47)

**Given** subsequent visits
**When** the page loads
**Then** the first-visit entrance is skipped — it's a one-time moment tracked in localStorage

**Given** `prefers-reduced-motion`
**When** first visit
**Then** the entrance is skipped entirely — the table appears instantly (UX-DR47)

**Given** a player's first game join
**When** entering the room
**Then** a brief 3-second audio showcase plays: tile draw click, discard clack, Mahjong motif — with a subtle toast: "Sound is on. Adjust in settings." (UX-DR48)

**Given** the audio preview
**When** checking subsequent joins
**Then** the preview plays only once (tracked in localStorage) — not on every join

---

## Epic 8: Profiles, Stats & Remaining Accessibility

Optional accounts with persistent stats, session history, and social tracking. Accessibility hardening: screen reader testing, high contrast mode, color-blind tile patterns, and font size settings. This epic adds persistence and polishes the experience for all players.

### Story 8.1: Optional Account Creation (Email + Google OAuth)

As a **player**,
I want **to optionally create an account using email or Google sign-in to persist my profile across devices**,
So that **my stats and display name survive browser clears and device switches — without ever requiring an account to play (FR123, FR124, NFR44)**.

**Acceptance Criteria:**

**Given** the game's zero-friction USP
**When** checking join requirements
**Then** joining a game NEVER requires an account — guests play with a self-chosen display name exactly as before (NFR44)

**Given** a player wants to create an account
**When** navigating to account settings
**Then** two sign-up options are available: email + password, or Google OAuth (FR123)

**Given** an authenticated user
**When** joining a room
**Then** their session token is tied to their account ID instead of being anonymous — same reconnection mechanism, different token origin (AR6 auth upgrade path)

**Given** an authenticated user
**When** checking their experience
**Then** their display name and avatar persist across sessions, devices, and browser clears (FR125)

**Given** the account system
**When** checking the database requirement
**Then** this is the first story requiring persistent storage — a database (selection deferred per architecture) is set up for user accounts and stats

### Story 8.2: Guest-to-Account Migration & Persistent Stats

As a **player**,
I want **to migrate my guest localStorage stats to a new account and have all future stats persist server-side**,
So that **I don't lose my game history when I decide to create an account (FR126)**.

**Acceptance Criteria:**

**Given** a guest player with stats in localStorage
**When** they create an account
**Then** their existing localStorage stats (games played, wins, hand stats) are migrated to the server-side account (FR126)

**Given** an authenticated player
**When** completing a game
**Then** stats are persisted server-side — surviving browser clears, device switches, and app reinstalls

**Given** a guest player (no account)
**When** completing a game
**Then** stats continue to be tracked in localStorage as before — the guest experience is unchanged

**Given** the migration process
**When** checking data integrity
**Then** migrated stats merge with any existing account stats (in case the player played on another device while logged in) — no duplication, no data loss

### Story 8.3: Stats Dashboard (Win/Loss, Hand Stats, Social Stats)

As a **player**,
I want **to view my game statistics including win/loss record, hand completion history, and social stats**,
So that **I can track my progress and see fun metrics like my most common winning hand (FR127, FR128)**.

**Acceptance Criteria:**

**Given** the stats dashboard
**When** viewing win/loss record
**Then** it shows: games played, games won, win rate percentage, wall games (draws), and dead hands per game (FR127)

**Given** the stats dashboard
**When** viewing hand stats
**Then** it shows: which NMJL card hands completed (lifetime collection), most common winning hand, self-drawn Mahjong count, concealed vs. exposed hand wins (FR127)

**Given** the stats dashboard
**When** viewing social stats
**Then** it shows: most played-with friends (by session count), total sessions hosted vs. joined, longest game night streak (consecutive weeks), total hours played (FR127)

**Given** session history
**When** viewing past sessions
**Then** each session shows: date, players, per-game scores, session duration, and NMJL card year used (FR127)

**Given** all stats
**When** checking privacy
**Then** all stats are visible only to the player by default — no public leaderboards for MVP (FR128)

**Given** the optional shareable summary
**When** a player completes a session
**Then** they can generate a screenshot-friendly session summary for sharing with friends (FR128)

### Story 8.4: Screen Reader Testing & Accessibility Hardening

As a **player using assistive technology**,
I want **the game to work with VoiceOver on iPad and other screen readers, with all interactive elements properly announced**,
So that **visually impaired players can participate in game night (NFR29, NFR32)**.

**Acceptance Criteria:**

**Given** the semantic HTML foundation from Epic 5A
**When** testing with VoiceOver on iPad (the most likely screen reader for this audience)
**Then** all interactive elements are announced with meaningful labels: tiles ("3 of Bamboo"), call buttons ("Call Pung"), Mahjong button ("Declare Mahjong"), turn state ("It is Sarah's turn")

**Given** the call window
**When** announced via screen reader
**Then** `aria-live="assertive"` fires immediately with the available call options and remaining time

**Given** game state changes
**When** announced via screen reader
**Then** `aria-live="polite"` announces: turn changes, wall counter state transitions, call resolutions, and game end

**Given** the NMJL card panel
**When** opened via screen reader
**Then** focus moves to the panel, hand patterns are navigable, and closing the panel returns focus to the trigger element

**Given** the celebration sequence
**When** announced via screen reader
**Then** the winning hand, pattern name, and scoring breakdown are announced — the visual celebration has an auditory equivalent

**Given** the accessibility audit
**When** running axe-core or Lighthouse
**Then** no critical or serious accessibility violations are reported across all game views (lobby, playing, scoreboard)

### Story 8.5: Visual Accessibility Settings (High Contrast, Color-Blind, Font Size)

As a **player with visual accessibility needs**,
I want **adjustable font sizes, high contrast mode, and color-blind-safe tile patterns**,
So that **I can customize the visual experience for my needs (NFR25, NFR26, NFR27, NFR34)**.

**Acceptance Criteria:**

**Given** the font size setting
**When** adjusted in settings
**Then** all game text scales proportionally — the default is already optimized for the 40-70+ demographic (larger than typical), and the setting allows further increase (NFR25)

**Given** font size implementation
**When** checking the approach
**Then** text uses `rem` units based on a root font-size that the setting adjusts — all text scales uniformly without layout breakage

**Given** high contrast mode
**When** enabled in settings
**Then** enhanced contrast is applied to tile suits and numbers — suit colors become more saturated, tile borders become more prominent, and background contrast increases (NFR26)

**Given** color-blind tile patterns
**When** enabled in settings
**Then** each suit (Bam, Crak, Dot) gets an additional shape/pattern distinguisher visible on every tile — suits are identifiable by pattern alone without any color information (NFR27)

**Given** all accessibility settings
**When** checking persistence
**Then** settings persist in localStorage via the Pinia preferences store and apply immediately without page reload

**Given** the minimum text size constraint
**When** checking with accessibility settings at default
**Then** no text anywhere in the application is smaller than 14px (NFR34) — this was established in Epic 5A and is verified here across all views added since
