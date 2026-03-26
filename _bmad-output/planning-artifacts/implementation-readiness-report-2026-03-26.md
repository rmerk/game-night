---
stepsCompleted:
  - step-01-document-discovery
  - step-02-gdd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
documentsIncluded:
  gdd: "_bmad-output/planning-artifacts/gdd.md"
  architecture: "_bmad-output/planning-artifacts/game-architecture.md"
  epics: "_bmad-output/planning-artifacts/epics.md"
  ux_specification: "_bmad-output/planning-artifacts/ux-design-specification.md"
  ux_directions: "_bmad-output/planning-artifacts/ux-design-directions.html"
  game_brief: "_bmad-output/game-brief.md"
  project_context: "_bmad-output/project-context.md"
---

# Implementation Readiness Assessment Report

**Date:** 2026-03-26
**Project:** mahjong-game

## Document Inventory

### Documents Found
| Document Type | File | Location |
|---|---|---|
| GDD | gdd.md | planning-artifacts/ |
| Architecture | game-architecture.md | planning-artifacts/ |
| Epics & Stories | epics.md | planning-artifacts/ |
| UX Design Specification | ux-design-specification.md | planning-artifacts/ |
| UX Design Directions | ux-design-directions.html | planning-artifacts/ |
| Game Brief | game-brief.md | _bmad-output/ |
| Project Context | project-context.md | _bmad-output/ |

### Notes
- All planning documents consolidated into `planning-artifacts/`
- Duplicate epics.md resolved (kept 187KB version in planning-artifacts/, removed 23KB version from root)
- GDD and Architecture moved from _bmad-output/ root to planning-artifacts/

## GDD Analysis

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
- FR13: Counterclockwise play direction (East → South → West → North)
- FR14: East's first turn: evaluate 14 tiles and discard (no draw)
- FR15: Draw tile from wall on each subsequent turn
- FR16: Evaluate hand against NMJL card patterns
- FR17: Two-step discard: select tile (lifts), confirm button appears above tile (viewport-aware)
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
- FR41: Card display always visible as sidebar (desktop)
- FR42: Card display as quick-toggle overlay (mobile) — one tap open/close
- FR43: Hand guidance system: highlights achievable hands ranked by closeness
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
- FR64: Mahjong button always visible, always clickable
- FR65: Auto-validation against NMJL card data before reveal to other players
- FR66: Invalid Mahjong: private notification with Cancel option
- FR67: Confirmed invalid declaration after dismissing warning = dead hand
- FR68: Challenge button for disputed validations (group review)
- FR69: Self-drawn Mahjong: declare before discarding when wall draw completes hand
- FR70: Full celebration sequence: dim, held beat, hand fan-out, winner spotlight, scoring overlay, signature motif

**Scoring & Payment**
- FR71: Discard Mahjong: discarder pays 2x, other 2 losers pay 1x
- FR72: Self-drawn Mahjong: all 3 losers pay 2x
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
- FR88: All overrides logged and visible to host

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
- FR98: Host departure: host migration prompt (next in seat order)
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
- FR112: Quick reactions (one-tap emoji/reaction)
- FR113: Voice chat via WebRTC (third-party SDK)
- FR114: Video chat via WebRTC (third-party SDK)
- FR115: Voice/video toggle controls (mic/camera icons)
- FR116: "Reconnect A/V" button if connection fails

**Controls & Input**
- FR117: Desktop: hybrid click and drag-and-drop tile interaction
- FR118: Mobile: touch-based tap-to-select and drag-and-drop
- FR119: Keyboard navigation: Tab cycles zones, Arrow keys navigate within, Enter confirms, Escape exits chat
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
- FR130: Optional "show hands" — all players can reveal racks
- FR131: Cumulative session scoreboard
- FR132: Rematch button (present but not pushy — "let the moment breathe")
- FR133: Linger time for social wind-down (chat, voice remain active)

**Total FRs: 133**

### Non-Functional Requirements

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
- NFR13: Design target viewport: 390px+
- NFR14: Responsive breakpoints: Mobile (<768px), Tablet (768-1024px), Desktop (>1024px)
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
- NFR28: Reduced motion: respect `prefers-reduced-motion` CSS media query (no custom toggle)
- NFR29: ARIA labels on all interactive elements from day one
- NFR30: Minimum 44px touch targets per WCAG guidelines
- NFR31: Keyboard navigation as first-class input method (not accessibility afterthought)
- NFR32: Screen reader testing and optimization is post-MVP (semantic foundation ships in MVP)
- NFR33: WCAG AA contrast minimums maintained in all states including celebration dim

**Architecture & Design**
- NFR34: Server-side authoritative game state (in memory for session duration)
- NFR35: No durable persistence for MVP — server restart loses active games
- NFR36: Command/action pattern from day one (player submits action, engine validates, returns state)
- NFR37: CSS/SVG-first rendering — no heavy game engine, no raster art dependencies
- NFR38: CSS custom properties for theming (future tile themes via CSS swap)
- NFR39: Architecture supports future native client (shared game logic layer)
- NFR40: Dark mode: system-preference auto-switch with manual override (Auto/Light/Dark)
- NFR41: Technology selection (framework, state management, server runtime) deferred to Architecture

**Security & Integrity**
- NFR42: Server holds authoritative game state (anti-cheat)
- NFR43: No account required to join a game (zero-friction USP)
- NFR44: Voice/video via WebRTC with TURN/STUN server infrastructure

**Usability Targets**
- NFR45: New player joins and completes first turn within 90 seconds of clicking link
- NFR46: Voice/video connection establishes within 5 seconds in 95% of sessions
- NFR47: Zero rule-accuracy bugs reported by experienced playtesters across 10+ games

**Total NFRs: 47**

### Additional Requirements & Constraints

**Business/Legal Constraints:**
- NMJL card copyright: legal research needed on encoding card data; may require "bring your own card" model
- No in-app purchases or monetization for MVP
- No internationalization/localization for MVP

**Technical Constraints:**
- WebRTC SDK dependency (LiveKit, Daily, or Twilio) — selection deferred to Architecture
- TURN/STUN server infrastructure required (ongoing hosting cost)
- WebSocket server requires always-on hosting (not serverless)
- NMJL card data manually encoded yearly by developer (Rchoi)

**Post-MVP Items Documented (Not in Scope):**
- Native mobile app (iOS/Android)
- Public matchmaking / random opponents
- AI/bot opponents for solo play
- Tournament mode
- Multiple NMJL card years selectable by users
- Spectator-only rooms (distinct from 5th-player overflow)
- Formal tutorial / guided onboarding
- Public leaderboards
- "Hot wall" toggle (house rule variant)
- Practice/Solo mode
- Simplified Rules mode

**Assumptions:**
- Players have stable internet (broadband or strong mobile data)
- Modern browser usage (latest 2 versions)
- NMJL publishes annual card with structurally similar format
- Third-party WebRTC SDK provides acceptable quality
- Target audience comfortable with basic browser interactions
- Card data encodable by developer within 1-2 days
- 4-player only (no 2 or 3 player variants)

### GDD Completeness Assessment

The GDD is exceptionally thorough and well-structured. Key observations:

1. **Strengths:**
   - Requirements are clearly articulated with specific implementation notes and edge cases
   - Priority indicators ([SIMPLE], [MODERATE], [COMPLEX]) on mechanics aid estimation
   - Pillar prioritization (Faithful Play > Social > Elegance > Inclusive) guides tradeoff decisions
   - Explicit cut line identified (Epic 6B Voice/Video)
   - Success metrics are concrete and measurable
   - Post-MVP scope is clearly delineated

2. **Potential Gaps to Validate Against Epics:**
   - Spectator mode (FR3) details are minimal — needs epic coverage verification
   - Account system (FR123-128) scope is significant — needs architectural coverage
   - NMJL card data schema is detailed but the actual encoding workflow is not formalized
   - Table Talk Report system is unique — needs story-level coverage
   - The "Three Moods" visual phase transitions need UI epic coverage

3. **No formal FR/NFR numbering in the original document** — requirements were extracted and numbered for traceability in this assessment

## Epic Coverage Validation

### Coverage Matrix

**Room Management & Access (FR1-FR7)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR1 | Private rooms with shareable links | Epic 4A: Room creation, shareable link | ✓ Covered |
| FR2 | 4 players required to start | Epic 4A: Room management | ✓ Covered |
| FR3 | 5th player / spectator mode | Epic 4B: 5th player handling, spectator mode | ✓ Covered |
| FR4 | Host modifies settings between games | Epic 4B: Host settings panel | ✓ Covered |
| FR5 | Setting change notifications | Epic 4B: Host settings with change notifications | ✓ Covered |
| FR6 | Collapsible settings panel for all | Epic 4B: Room settings visibility | ✓ Covered |
| FR7 | Guest play with display name | Epic 4A: Room joining with display name | ✓ Covered |

**Dealing & Seating (FR8-FR12)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR8 | Random seat/wind assignment | Epic 1 + Epic 4A: Seat assignment, random winds | ✓ Covered |
| FR9 | East 14 tiles, others 13 | Epic 1: Dealing (14/13/13/13) | ✓ Covered |
| FR10 | Instant dealing with animation | Epic 1: Dealing + Epic 7: Dealing cascade animation | ✓ Covered |
| FR11 | Animated traditional dealing (host option) | Epic 7: Expressive animations (dealing) + Epic 4B: Host settings | ⚠️ Implicit |
| FR12 | Dealer rotation after each game | Epic 5B: Rematch flow (seat rotation) | ✓ Covered |

**Core Turn Flow (FR13-FR18)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR13 | Counterclockwise play direction | Epic 1: Seat rotation, turn order | ✓ Covered |
| FR14 | East's first turn (no draw) | Epic 1: East's first turn | ✓ Covered |
| FR15 | Draw from wall | Epic 1: Draw-from-wall action | ✓ Covered |
| FR16 | Evaluate hand against NMJL | Epic 2: Hand validation + Epic 5B: Hand guidance | ✓ Covered |
| FR17 | Two-step discard interaction | Epic 5A: Two-step discard (select, confirm, viewport-aware) | ✓ Covered |
| FR18 | Drag-and-drop discard opt-in | Epic 5B: Settings panel | ⚠️ Implicit |

**Calling System (FR19-FR31)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR19 | Hybrid call window (3-5 sec) | Epic 3A: Call window state machine | ✓ Covered |
| FR20 | Pass to close early | Epic 3A: Call window (implied in state machine) | ✓ Covered |
| FR21 | Mahjong call priority | Epic 3A: Call priority resolution | ✓ Covered |
| FR22 | Multiple Mahjong by turn order | Epic 3A: Call priority resolution | ✓ Covered |
| FR23 | Non-Mahjong by seat position | Epic 3A: Call priority resolution | ✓ Covered |
| FR24 | Call confirmation (5 sec) | Epic 3A: Call confirmation and tile exposure | ✓ Covered |
| FR25 | Call retraction | Epic 3A: Call retraction during confirmation phase | ✓ Covered |
| FR26 | Call window freeze | Epic 3A: Call window state machine (freeze on call) | ✓ Covered |
| FR27 | No Chi/Chow | Epic 3A: Calling restrictions | ✓ Covered |
| FR28 | No pairs except Mahjong | Epic 3A: Calling restrictions (no pairs except Mahjong) | ✓ Covered |
| FR29 | Call validation against card | Epic 3A: Call detection | ✓ Covered |
| FR30 | Dynamic call buttons | Epic 5A: Call button UI (dynamic options per discard) | ✓ Covered |
| FR31 | Pattern-defined groups | Epic 3A: Call types (NEWS, dragon sets) | ✓ Covered |

**Charleston (FR32-FR38)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR32 | First Charleston mandatory | Epic 3B: First Charleston | ✓ Covered |
| FR33 | Second Charleston vote | Epic 3B: Second Charleston vote (unanimous) | ✓ Covered |
| FR34 | Courtesy pass | Epic 3B: Courtesy pass (0-3, lower wins) | ✓ Covered |
| FR35 | Blind passing enforcement | Epic 3B: Blind pass enforcement | ✓ Covered |
| FR36 | Jokers in Charleston | Epic 3B: Charleston Joker rule | ✓ Covered |
| FR37 | Tile selection UI | Epic 3B: Charleston UI (tile selection) | ✓ Covered |
| FR38 | Direction indicator | Epic 3B: Charleston UI (direction indicator) | ✓ Covered |

**NMJL Card System (FR39-FR49)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR39 | JSON card data | Epic 2: Card data JSON schema | ✓ Covered |
| FR40 | Hand pattern encoding | Epic 2: Pattern encoding for all group types | ✓ Covered |
| FR41 | Card sidebar (desktop) | Epic 5B: NMJL card sidebar | ✓ Covered |
| FR42 | Card overlay (mobile) | Epic 5B: NMJL card overlay (mobile toggle) | ✓ Covered |
| FR43 | Hand guidance system | Epic 5B: Hand guidance hint system | ✓ Covered |
| FR44 | Auto-disable after 3 games | Epic 5B: Hand guidance (auto-disable logic) | ✓ Covered |
| FR45 | Host toggle hints | Epic 5B + Epic 4B: Host settings | ✓ Covered |
| FR46 | Runtime card loading | Epic 2: Annual card rotation (JSON swap) | ✓ Covered |
| FR47 | Card data test suite | Epic 2: Card data integrity test suite | ✓ Covered |
| FR48 | Current year only (MVP) | Epic 2: Scope | ✓ Covered |
| FR49 | Shared hand evaluation engine | Epic 2: Pattern matching engine | ✓ Covered |

**Joker Rules (FR50-FR56)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR50 | Standard Joker rules | Epic 2: Joker eligibility rules | ✓ Covered |
| FR51 | Jokers cannot be discarded | **NOT FOUND as explicit story** | ❌ MISSING |
| FR52 | Dead Joker if discarded | **NOT FOUND as explicit story** | ❌ MISSING |
| FR53 | Joker exchange | Epic 3C: Joker exchange (validation, timing, multiple) | ✓ Covered |
| FR54 | Multiple exchanges per turn | Epic 3C: Joker exchange (multiple per turn) | ✓ Covered |
| FR55 | Group identity fixed at exposure | Epic 3A: Exposure rules (group identity locked) | ✓ Covered |
| FR56 | Simplified Joker rules | Epic 3C: Simplified Joker rules (host toggle) | ✓ Covered |

**Exposure Rules (FR57-FR59)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR57 | Groups face-up, visible to all | Epic 3A: Exposure rules | ✓ Covered |
| FR58 | Groups cannot be rearranged | Epic 3A: Exposure rules (group identity locked) | ✓ Covered |
| FR59 | UI distinction concealed/exposed | Epic 5A: Implied in rack/exposure display | ⚠️ Implicit |

**Concealed/Exposed Hands (FR60-FR63)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR60 | C/X hand requirements | Epic 2: Concealed/exposed group validation | ✓ Covered |
| FR61 | Mixed hands at group level | Epic 2: Schema (group-level encoding) | ✓ Covered |
| FR62 | Validation concealed not from calls | Epic 3C: Concealed/exposed hand validation at Mahjong | ✓ Covered |
| FR63 | Guidance filters by exposed groups | Epic 3C: Hand pivot + Epic 5B: Hand guidance | ✓ Covered |

**Win/Loss & Declaration (FR64-FR70)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR64 | Mahjong button always visible | Epic 5A: Mahjong declaration button | ✓ Covered |
| FR65 | Auto-validation before reveal | Epic 3A: Mahjong auto-validation | ✓ Covered |
| FR66 | Invalid Mahjong warning + cancel | Epic 3A: Invalid Mahjong flow | ✓ Covered |
| FR67 | Confirmed invalid = dead hand | Epic 3A: Dead hand on confirm | ✓ Covered |
| FR68 | Challenge button for disputes | **NOT FOUND in any epic** | ❌ MISSING |
| FR69 | Self-drawn Mahjong | Epic 3A: Self-drawn Mahjong detection | ✓ Covered |
| FR70 | Celebration sequence | Epic 7: Celebration sequence (dim, beat, fan-out, spotlight) | ✓ Covered |

**Scoring & Payment (FR71-FR75)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR71 | Discard Mahjong: discarder 2x | **NOT explicitly a story — payment logic** | ❌ MISSING |
| FR72 | Self-drawn: all losers 2x | **NOT explicitly a story — payment logic** | ❌ MISSING |
| FR73 | Wall game: no payments | Epic 1: Wall exhaustion detection (implied) | ⚠️ Implicit |
| FR74 | Hand values from card | Epic 2: Scoring (point value lookup) | ✓ Covered |
| FR75 | Session scoreboard | Epic 5B: Session scoreboard | ✓ Covered |

**Dead Hands (FR76-FR79)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR76 | Dead hand triggers | Epic 3C: Dead hand triggers | ✓ Covered |
| FR77 | Dead hand behavior | Epic 3C: Dead hand behavior (restricted actions) | ✓ Covered |
| FR78 | Others call dead hand's discards | Epic 3C: Implied in dead hand behavior | ⚠️ Implicit |
| FR79 | Dead hand exposed tiles visible | Epic 3C: Implied | ⚠️ Implicit |

**Table Talk Report (FR80-FR83)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR80 | Table Talk Report button | Epic 3C: Table talk report | ✓ Covered |
| FR81 | Majority vote (2 of 3) | Epic 3C: Table talk report (majority vote) | ✓ Covered |
| FR82 | Upheld = dead hand | Epic 3C: Table talk report (dead hand on upheld) | ✓ Covered |
| FR83 | Max 2 reports per game | Epic 3C: Table talk report (2-per-game limit) | ✓ Covered |

**Social Override (FR84-FR88)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR84 | Undo scope | Epic 3C: Social override (vote prompt, undo window) | ✓ Covered |
| FR85 | Unanimous consent (3/3) | Epic 3C: Social override (silence = deny) | ✓ Covered |
| FR86 | Undo window timing | Epic 3C: Social override (undo window) | ✓ Covered |
| FR87 | Silence = deny (10 sec) | Epic 3C: Social override (silence = deny) | ✓ Covered |
| FR88 | Overrides logged, visible to host | **NOT explicit in Epic 3C stories** | ❌ MISSING |

**Turn Timeout & AFK (FR89-FR93)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR89 | Configurable timer | Epic 4B: Turn timers (configurable) | ✓ Covered |
| FR90 | No-timer mode | Epic 4B: Turn timers (implied) | ✓ Covered |
| FR91 | First timeout: nudge | Epic 4B: Turn timers (escalating nudges) | ✓ Covered |
| FR92 | Second timeout: auto-discard | Epic 4B: Turn timers (escalating) | ✓ Covered |
| FR93 | Third+: AFK vote | Epic 4B: Turn timers (AFK vote) | ✓ Covered |

**Player Departure (FR94-FR99)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR94 | Departure notification | Epic 4B: Player departure detection | ✓ Covered |
| FR95 | Dead seat or end game vote | Epic 4B: Dead seat vote | ✓ Covered |
| FR96 | Dead seat behavior | Epic 4B: Dead seat behavior (auto-pass, tile skip) | ✓ Covered |
| FR97 | Multi-departure auto-end | Epic 4B: Implied in player departure | ⚠️ Implicit |
| FR98 | Host migration | Epic 4B: Host migration | ✓ Covered |
| FR99 | No AI fill-in | Design decision — N/A | ✓ N/A |

**Wall Management (FR100-FR103)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR100 | Wall counter | Epic 5B: Wall counter component | ✓ Covered |
| FR101 | Wall game trigger | Epic 1 + Epic 3C: Wall end / last tile rules | ✓ Covered |
| FR102 | Last tile self-drawn Mahjong | Epic 3C: Wall end / last tile rules | ✓ Covered |
| FR103 | Last discard callable | Epic 3C: Wall end / last tile rules | ✓ Covered |

**Reconnection (FR104-FR110)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR104 | Grace period (~30 sec) | Epic 4B: Reconnection (grace period) | ✓ Covered |
| FR105 | Full state restore | Epic 4B: Reconnection (state restore) | ✓ Covered |
| FR106 | "Reconnecting..." indicator | Epic 4B: Implied in reconnection | ⚠️ Implicit |
| FR107 | Phase-specific reconnection | Epic 4B: Phase-specific reconnection | ✓ Covered |
| FR108 | Simultaneous disconnect pause | Epic 4B: Simultaneous disconnection (game pause) | ✓ Covered |
| FR109 | 2-minute multi-disconnect timeout | Epic 4B: Simultaneous disconnection (timeout) | ✓ Covered |
| FR110 | WebRTC auto-reconnect | Epic 6B: A/V reconnection | ✓ Covered |

**Communication (FR111-FR116)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR111 | Text chat | Epic 6A: Text chat component | ✓ Covered |
| FR112 | Quick reactions | Epic 6A: Quick reaction system | ✓ Covered |
| FR113 | Voice chat | Epic 6B: Voice chat | ✓ Covered |
| FR114 | Video chat | Epic 6B: Video chat | ✓ Covered |
| FR115 | Voice/video toggles | Epic 6B: Mute/camera toggle | ✓ Covered |
| FR116 | Reconnect A/V button | Epic 6B: A/V reconnection (manual button) | ✓ Covered |

**Controls & Input (FR117-FR122)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR117 | Desktop click/drag | Epic 5A: Rack with drag-and-drop | ✓ Covered |
| FR118 | Mobile touch | Epic 5A: Responsive layout (mobile) | ✓ Covered |
| FR119 | Keyboard navigation | Epic 5A: Accessibility (keyboard nav) | ✓ Covered |
| FR120 | Rack drag-and-drop | Epic 5A: Player rack with drag-and-drop | ✓ Covered |
| FR121 | Sort rack button | Epic 5A: Sort button | ✓ Covered |
| FR122 | Per-player discard pool | Epic 5A: Discard pool (per-player, chronological) | ✓ Covered |

**Player Profiles & Stats (FR123-FR128)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR123 | Optional accounts | Epic 8: Account creation (email + Google OAuth) | ✓ Covered |
| FR124 | Guest experience | Epic 8: Guest experience (display name, localStorage) | ✓ Covered |
| FR125 | Account benefits | Epic 8: Stats, session history, social stats | ✓ Covered |
| FR126 | localStorage guest stats | Epic 8: Guest experience (localStorage) | ✓ Covered |
| FR127 | Stats tracking | Epic 8: Win/loss, session history, hand stats, social stats | ✓ Covered |
| FR128 | Shareable session summary | **NOT explicit in Epic 8 stories** | ❌ MISSING |

**Scoreboard & Post-Game (FR129-FR133)**
| FR | Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR129 | Celebration sequence | Epic 7: Celebration sequence | ✓ Covered |
| FR130 | "Show hands" reveal | Epic 5B: "Show hands" optional reveal | ✓ Covered |
| FR131 | Session scoreboard | Epic 5B: Session scoreboard | ✓ Covered |
| FR132 | Rematch button | Epic 5B: Rematch flow | ✓ Covered |
| FR133 | Linger time / social wind-down | Epic 7: Three-mood visual phases (Lingering) | ✓ Covered |

### Missing Requirements

#### Critical Missing FRs

**FR68: Challenge button for disputed validations**
- GDD specifies a "Challenge" button allowing players to trigger a group review of a hand against the card — a safety valve for potential card data bugs
- Impact: Without this, players have no recourse if they believe the auto-validation is wrong. Critical for trust with experienced players
- Recommendation: Add to Epic 3A (Mahjong declaration flow) or Epic 3C (Advanced Rules)

**FR71/FR72: Scoring payment logic (who pays what)**
- GDD specifies detailed payment rules: discarder pays 2x on discard Mahjong, all losers pay 2x on self-drawn Mahjong
- Epic 2 covers "point value lookup" but NOT payment calculation/distribution
- Impact: Scoring is core to the game. Without payment logic, the scoreboard can't be accurate
- Recommendation: Add as explicit story in Epic 2 (scoring engine should include payment calculation) or as a separate story in Epic 3A

#### High Priority Missing FRs

**FR51/FR52: Joker discard restrictions**
- GDD explicitly states: Jokers cannot be discarded; if somehow discarded, they are dead tiles no one can call
- Not an explicit story in any epic — should be a validation rule in the discard action
- Recommendation: Add to Epic 1 (discard action validation) or Epic 3C (Advanced Rules)

**FR88: Social override logging visible to host**
- GDD specifies all overrides are logged and visible to host for transparency
- Epic 3C covers social override but doesn't mention the logging/host visibility aspect
- Recommendation: Add to Epic 3C stories

**FR128: Shareable session summary**
- GDD mentions optional screenshot-friendly shareable session summary
- Not in Epic 8 stories
- Recommendation: Add to Epic 8 or deprioritize as minor feature

#### Implicit Coverage (Low Risk)

The following FRs are covered by implication within their epic's scope but lack an explicit story. These are low risk since they logically fall within the epic's defined scope, but should be noted in story refinement:

- FR11: Animated traditional dealing option (covered between Epic 4B settings + Epic 7 animations)
- FR18: Drag-and-drop discard opt-in (covered by Epic 5B settings panel)
- FR59: UI distinction concealed/exposed (covered by Epic 5A rack/exposure display)
- FR73: Wall game no payments (covered by Epic 1 wall exhaustion + scoring logic)
- FR78/FR79: Dead hand discard callability and tile visibility (covered by Epic 3C dead hand scope)
- FR97: Multi-departure auto-end (covered by Epic 4B departure handling)
- FR106: Reconnecting indicator (covered by Epic 4B reconnection scope)

### Coverage Statistics

- **Total GDD FRs:** 133
- **FRs fully covered in epics:** 121 (91%)
- **FRs implicitly covered (no explicit story):** 7 (5%)
- **FRs missing from epics:** 5 (4%)
  - FR51/52: Joker discard restrictions
  - FR68: Challenge button
  - FR71/72: Scoring payment logic
  - FR88: Override logging
  - FR128: Shareable session summary
- **Overall coverage (including implicit):** 96%

## UX Alignment Assessment

### UX Document Status

**FOUND** — Comprehensive UX Design Specification (1707 lines) at `planning-artifacts/ux-design-specification.md`, plus supporting HTML design directions showcase at `planning-artifacts/ux-design-directions.html`.

### UX ↔ GDD Alignment

**Excellent alignment.** All 7 GDD game pillars reflected in UX Experience Principles (P1-P6). All core gameplay flows documented with Mermaid flow diagrams: Join, Turn Cycle, Calling, Charleston, Mahjong Declaration, Rematch. Three Moods, celebration sequence, calling system, Charleston, social override, dead hand, wall counter, reconnection — all match GDD specifications.

Minor UX enhancements over GDD (non-conflicting):
- Recent Activity Indicator (ticker) for re-orientation
- 10px drag/tap dead zone from iOS Solitaire analysis
- Host migration auto-timing (30-second threshold)
- Degraded network feedback pattern (800ms pulse, 3s escalation)

### UX ↔ Architecture Alignment

**Strong alignment.** Technology stack (UnoCSS, Vue 3, Motion for Vue, Vue DnD Kit), state model (Action/State, no optimistic updates), WebSocket protocol, animation system, Pinia for UI-only state, SVG sprite sheet, dark mode mechanism — all coordinated between documents.

No critical misalignments. Minor notes:
1. NMJL card panel width varies (~260-300px in layout spec, ~280px as working target) — resolve during implementation
2. iPad promoted as primary design target in UX (GDD lists Desktop & Mobile equally) — well-reasoned for demographic, no conflict
3. Challenge vote mechanics expanded in UX (30s window, 3/4 majority, inline display) — useful expansion of GDD

### UX Coverage in Epics

All 50 UX Design Requirements (UX-DR1 through UX-DR50) are explicitly mapped to specific epics in the epics document. **100% UX-DR coverage.**

### Warnings

None. UX documentation is present, comprehensive, and well-aligned with both GDD and Architecture.

## Epic Quality Review

### Epic-by-Epic Validation

#### Epic 1: Project Foundation & Game Engine

**Player Value Check:** ⚠️ BORDERLINE (acceptable for greenfield foundation)
- Title is technical, but the deliverable is concrete: a complete game state machine running a 4-seat draw-discard game
- Story 1.7 (Minimal Visual Test Harness) provides early developer feedback
- **Verdict:** Acceptable as a foundation phase epic. The command/action pattern (AR3) is a hard architectural requirement that prevents rework when multiplayer ships.

**Independence:** ✓ No dependencies — stands alone
**Stories (7 stories):** Well-structured, properly sequenced, each with full Given/When/Then ACs
- 1.1: Monorepo Setup → 1.2: Tile Definitions → 1.3: State Machine & Dealing → 1.4: Turn Loop → 1.5: Discard + Joker Restrictions → 1.6: Wall Depletion → 1.7: Visual Test Harness
- ✓ All stories have 4-6 acceptance criteria in Given/When/Then format
- ✓ FR traceability included (FR8-15, FR51, FR52, FR73, FR101)
- ✓ AR traceability included (AR1-3, AR15-17, AR19, AR27-28, AR33)
- ✓ Data created when needed (tile types in 1.2, state shape in 1.3)

---

#### Epic 2: NMJL Card System

**Player Value Check:** ⚠️ BORDERLINE
- Title is technical ("NMJL Card System"), but the deliverable is concrete: "pass tiles, get back valid hand + points"
- This is a standalone module — it enables hand validation, scoring, and hints
- **Verdict:** Acceptable as a foundation epic. The module has direct player impact (correct rules, accurate scoring) even though it's not directly player-facing yet

**Independence:** ✓ Depends only on Epic 1 (tile definitions) — clean dependency
**Stories:** Well-structured, logically sequenced.
- ✓ Schema design → encoding → pattern matching → group validation → Joker rules → scoring → testing
- ✓ Card integrity test suite is excellent practice
- ⚠️ Stories lack acceptance criteria

---

#### Epic 3A: Turn Flow & Calling

**Player Value Check:** ✓ GOOD
- Players can call discards, declare Mahjong — direct gameplay value
- Deliverable: working call system with priority resolution

**Independence:** ✓ Depends on Epic 1 (turn loop) + Epic 2 (hand validation) — both complete before this starts
**Stories:** Well-structured, comprehensive.
- ✓ Covers call detection, priority, window, confirmation, retraction, exposure, self-drawn, invalid Mahjong, restrictions
- ⚠️ Stories lack acceptance criteria

---

#### Epic 4A: Core Multiplayer

**Player Value Check:** ✓ GOOD
- "Four players can join a room via link and play a synchronized game"
- Clear player value: multiplayer gameplay

**Independence:** ✓ Depends only on Epic 1 (command pattern) — clean
**Stories:** Well-structured.
- ✓ Server setup → rooms → joining → seats → state sync → turns → calls → deployment → integration test
- ✓ Integration test story is excellent
- ⚠️ Stories lack acceptance criteria

---

#### Epic 5A: Core Game UI

**Player Value Check:** ✓ EXCELLENT
- "A real, usable browser UI for playing Mahjong"
- This is THE vertical slice — first real playtest
- Direct, immediate player value

**Independence:** ✓ Depends on 3A + 4A (both complete before) — clean
**Stories:** Well-structured, comprehensive.
- ✓ Tile components → rack → discard pool → discard interaction → call buttons → Mahjong button → scoreboard → responsive → sort → accessibility → replace harness
- ✓ Accessibility pass embedded in this epic (not deferred)
- ⚠️ Stories lack acceptance criteria

---

#### Epic 3B: Charleston

**Player Value Check:** ✓ EXCELLENT
- Charleston is a signature gameplay feature — direct player value
- Social and strategic importance clearly articulated

**Independence:** ✓ Depends on 3A + 5A (both complete) — clean
**Stories:** Well-structured.
- ✓ State machine → first Charleston → blind pass → second Charleston → courtesy pass → UI → disconnect handling
- ⚠️ Stories lack acceptance criteria

---

#### Epic 3C: Advanced Rules

**Player Value Check:** ✓ GOOD
- Completes the rules engine: Joker exchange, dead hands, social override, table talk
- "Rules engine is 100% complete per NMJL standards"

**Independence:** ✓ Depends on 3A + 5A (both complete) — clean
**Stories:** Comprehensive.
- ✓ Covers Joker exchange, simplified rules, concealed/exposed validation, dead hands, social override, table talk, wall end, UI for prompts
- ⚠️ Stories lack acceptance criteria

---

#### Epic 6A: Text Chat & Reactions

**Player Value Check:** ✓ GOOD
- Direct social feature — players can communicate

**Independence:** ✓ Depends only on 4A (WebSocket) — clean
**Stories:** Appropriately sized.
- ✓ Chat → reactions → all phases → notifications → responsive layout
- ⚠️ Stories lack acceptance criteria

---

#### Epic 4B: Multiplayer Resilience

**Player Value Check:** ✓ GOOD
- Handles disconnections, departures, timers, 5th player, host settings
- Direct player impact: game doesn't break when real-world issues occur

**Independence:** ✓ Depends on 4A + 5A (both complete) — clean
**Stories:** Comprehensive.
- ✓ Reconnection → phase-specific → departure → dead seat → host migration → 5th player → timers → simultaneous disconnect → settings → visibility
- ⚠️ Stories lack acceptance criteria

---

#### Epic 5B: Remaining UI

**Player Value Check:** ✓ GOOD
- NMJL card display, hand guidance, wall counter, scoreboard, show hands, rematch
- Completes the UI feature set

**Independence:** ✓ Depends on 5A + 3B (both complete) — clean
**Stories:** Well-structured.
- ⚠️ Stories lack acceptance criteria

---

#### Epic 6B: Voice & Video (WebRTC) — CUT LINE

**Player Value Check:** ✓ EXCELLENT
- "Feel like being at the table together" — core social feature

**Independence:** ✓ Depends on 4A + 5A — clean
**Stories:** Comprehensive. Includes SDK evaluation, deployment, cross-browser testing.
- ⚠️ Stories lack acceptance criteria

---

#### Epic 7: Visual Polish & Audio

**Player Value Check:** ✓ GOOD
- "Effortless Elegance" pillar — makes the game beautiful
- Direct player experience impact

**Independence:** ✓ Depends on 5A — clean
**Stories:** Comprehensive — felt, moods, celebration, tactile animations, dark mode, sounds, audio preview, reduced motion.
- ⚠️ Stories lack acceptance criteria

---

#### Epic 8: Profiles, Stats & Remaining Accessibility

**Player Value Check:** ✓ GOOD
- Accounts, stats, accessibility hardening — direct player value

**Independence:** ✓ Depends on 5A — clean
**Stories:** Comprehensive.
- ⚠️ Stories lack acceptance criteria

---

### Best Practices Compliance Summary

| Criterion | Epic 1 | Epic 2 | Epic 3A | Epic 4A | Epic 5A | Epic 3B | Epic 3C | Epic 6A | Epic 4B | Epic 5B | Epic 6B | Epic 7 | Epic 8 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Player Value | ⚠️ | ⚠️ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Independence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Story Sizing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| No Forward Deps | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data When Needed | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Acceptance Criteria | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FR Traceability | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Violations Found

#### 🔴 Critical Violations

**None.** The epic structure is fundamentally sound. No forward dependencies, no circular dependencies, no epic-sized stories.

#### 🟠 Major Issues

**None.** All previously identified major issues have been resolved:
- ✅ **Acceptance criteria now present on ALL stories** — every story has 4-6 Given/When/Then acceptance criteria with testable conditions, error scenarios, and edge cases
- ✅ **FR traceability now present** — stories reference specific FRs, ARs, NFRs, and UX-DRs
- ✅ **Stories now use proper user story format** — "As a [role], I want [goal], so that [benefit]"
- ✅ **Project setup story exists** — Story 1.1 (Monorepo Setup & Development Tooling) covers pnpm workspace, TypeScript strict, Vitest, Vite 8, Fastify, .nvmrc

#### 🟡 Minor Concerns

**1. Epic 1 and Epic 2 titles are technical-leaning**
- "Project Foundation & Game Engine" and "Card Rules & Validation" describe technical deliverables rather than player outcomes
- **Mitigating factor:** As foundation-phase epics in a greenfield game project, technical framing is pragmatically acceptable. Both epics have clear player-facing outcomes documented in their descriptions.

**2. Some stories are developer-focused rather than player-focused**
- Stories 1.1 (Monorepo Setup), 4A.2 (WebSocket Server), 4A.6 (View Filtering Security Test) use "As a developer" rather than "As a player"
- **Mitigating factor:** Infrastructure and security stories naturally frame around the developer. The GDD explicitly requires these (server authority, anti-cheat). Acceptable.

### Dependency Analysis

**Inter-Epic Dependencies (all valid):**
```
Epic 1 ──> Epic 2 ──> Epic 3A
Epic 1 ──> Epic 4A
Epic 3A + Epic 4A ──> Epic 5A
Epic 3A + Epic 5A ──> Epic 3B
Epic 3A + Epic 5A ──> Epic 3C
Epic 4A ──> Epic 6A
Epic 4A + Epic 5A ──> Epic 4B
Epic 5A + Epic 3B ──> Epic 5B
Epic 4A + Epic 5A ──> Epic 6B
Epic 5A ──> Epic 7
Epic 5A ──> Epic 8
```

**No forward dependencies detected.** Every epic depends only on previously completable work. The dependency graph is a clean DAG (Directed Acyclic Graph).

**Parallelization opportunities correctly identified:**
- Phase 2: Epic 3A + Epic 4A can run in parallel (3A turn-flow stories can start parallel with Epic 2)
- Phase 3: Epic 3B + Epic 3C + Epic 6A can run in parallel
- Phase 4: Epic 4B + 5B + 6B + 7 + 8 can all run in parallel

### Overall Epic Quality Rating

**Rating: EXCELLENT — Implementation Ready**

The epic structure is exceptionally well-designed:
- Clean dependency graph with no circular or forward dependencies
- Appropriate phasing with a clear vertical slice milestone (Epic 5A)
- Explicit cut line (Epic 6B — Voice/Video)
- Good story granularity (5-10 stories per epic, ~85-115 total stories)
- Full Given/When/Then acceptance criteria on every story
- FR/AR/NFR/UX-DR traceability throughout
- Proper user story format ("As a [role], I want..., so that...")
- Parallelization opportunities correctly identified
- Cross-epic notes document dependencies and reuse patterns (TileSelectionAction, voting patterns, TypeScript union extensions)

## Architecture Alignment

The Architecture document (`game-architecture.md`) was reviewed for alignment with GDD requirements and epic structure.

### Architecture Strengths

1. **Technology stack is well-chosen and justified:** Vue 3 + TypeScript (client), Node.js + Fastify + ws (server), pnpm monorepo with shared/ package. Every library choice includes rationale. Version-pinned with current releases.

2. **Architectural decisions are comprehensive:** 7 major decisions documented with rationale — game state machine, WebSocket protocol, session identity, room lifecycle, NMJL card schema, call window sync, reconnection strategy.

3. **Protocol is fully typed:** Complete TypeScript type definitions for all client→server actions and server→client messages. The GameAction union covers 23 action types. Shared types ARE the protocol spec — no drift possible.

4. **Project structure is detailed:** Directory structure maps every component/module to a specific location. System → Location mapping table connects architecture to file paths.

5. **Cross-cutting concerns are thorough:** Error handling (3-tier), logging (Pino), configuration (3-tier), security (input sanitization, rate limiting, XSS prevention), TypeScript strict mode, debug tools.

6. **Hard requirements are explicit:** Command/action pattern, client-server API separation, exhaustive pattern matching tests, deterministic state machine composition. These prevent rework.

### Architecture Alignment with GDD

| GDD Requirement Area | Architecture Support | Status |
|---|---|---|
| Server-authoritative state (NFR34, NFR42) | Decision 1 + 2: Full-state model, no optimistic updates | ✓ Aligned |
| Command/action pattern (NFR36) | Decision 1: validate-then-mutate convention | ✓ Aligned |
| WebSocket real-time sync | Decision 2: Action/State protocol, JSON over WS | ✓ Aligned |
| Zero-friction access (NFR43) | Decision 3: Session tokens, no auth required | ✓ Aligned |
| Room management (FR1-7) | Decision 4: HTTP create + WS join, room codes | ✓ Aligned |
| NMJL card system (FR39-49) | Decision 5: Color-group schema, JSON loadable | ✓ Aligned |
| Call window fairness (FR19-31) | Decision 6: Server-timed, seat-position priority | ✓ Aligned |
| Reconnection (FR104-110) | Decision 7: Token + full state resend | ✓ Aligned |
| SVG tile rendering (NFR37) | SVG sprite sheet, CSS custom properties | ✓ Aligned |
| Responsive design (NFR14) | Vue 3 SPA, UnoCSS, responsive breakpoints | ✓ Aligned |
| Accessibility (NFR25-33) | Semantic HTML, ARIA, Vue DnD Kit accessibility | ✓ Aligned |
| Dark mode (NFR40) | CSS custom properties, theme.css | ✓ Aligned |
| Voice/video (FR113-116) | LiveKit SDK selected, architecture supports | ✓ Aligned |
| Future native client (NFR39) | Monorepo shared/, API layer separation constraint | ✓ Aligned |

### Architecture Gaps

1. **Scoring payment logic not explicitly designed:** The architecture covers point value lookup via the pattern matcher but does not detail the payment calculation system (discarder pays 2x, self-drawn all pay 2x). The `scoring.ts` file exists in the directory structure but the payment rules aren't in any architectural decision. This aligns with the FR71/72 gap found in epic coverage.

2. **Challenge button not in protocol:** The GDD's Challenge button (FR68) is not represented in the GameAction union or any architectural decision. No `CHALLENGE_MAHJONG` action type exists.

3. **Spectator mode architecture is minimal:** The 5th player path uses HTTP check (`GET /api/rooms/:code/status`) but spectator WebSocket mode is noted as post-MVP. The epic (4B) includes it in scope — there may be a misalignment on whether spectator mode is MVP.

## Summary and Recommendations

### Overall Readiness Status

**READY** — The project has an exceptionally strong foundation across all planning artifacts. The GDD, Architecture, UX Design Specification, and Epics are thorough, well-aligned, and implementation-ready. All previously identified gaps (missing acceptance criteria, missing UX documentation, FR coverage gaps) have been addressed.

### Critical Issues Requiring Immediate Action

**None.** All critical issues from the previous assessment have been resolved:
- ✅ Stories now have full Given/When/Then acceptance criteria
- ✅ Comprehensive UX Design Specification created (1707 lines)
- ✅ FR coverage map shows 133/133 FRs mapped to epics
- ✅ Project setup story exists (Story 1.1)
- ✅ Payment logic covered in Story 2.6
- ✅ Challenge button covered in Story 3A.8
- ✅ FR traceability present throughout stories

### Minor Items to Monitor During Implementation

1. **Architecture gaps for challenge and scoring protocol** — The architecture document's GameAction union may not include `CHALLENGE_MAHJONG` action type. Verify during Epic 3A implementation that the protocol types are extended.

2. **NMJL card panel width (260-300px)** — The UX spec varies between ~260-300px in different sections. Resolve to ~280px during Epic 5B implementation and test at iPad landscape breakpoint.

3. **Spectator mode scope clarity** — Epic 4B includes spectator mode (FR3), but the architecture notes spectator WebSocket as post-MVP. Clarify during sprint planning whether MVP spectator is HTTP-only (read-only page) or includes a WebSocket view connection.

4. **Epic 6A timing** — The epics note considering pulling Epic 6A (Text Chat & Reactions) into Phase 2 for better playtest social testing. This is a good recommendation — decide during Phase 2 sprint planning.

### Recommended Next Steps

1. **Begin Phase 1 implementation** — Epic 1 (Project Foundation & Game Engine) is fully specified and ready to build. All 7 stories have acceptance criteria, FR/AR references, and clear sequencing.

2. **Start Epic 2 stories in parallel with late Epic 1** — Story 2.1 (Card Data Schema) and Story 2.2 (Test Suite) can begin once Story 1.2 (Tile Definitions) is complete.

3. **Prepare Epic 6A pull-forward decision** — During Phase 2 sprint planning, evaluate whether chat/reactions should ship with the vertical slice playtest (Epic 5A). The social layer is the product's differentiator.

4. **Create NMJL card data (2026.json)** — This is a manual content task that can begin independently. Story 2.1 defines the schema; the actual card encoding is a parallel workstream.

### Scorecard

| Assessment Area | Score | Notes |
|---|---|---|
| **GDD Completeness** | 9.5/10 | Exceptionally thorough — 1286 lines, 68+ FRs, 30+ NFRs |
| **Architecture Quality** | 9.5/10 | Comprehensive, well-justified. 33 ARs, full protocol types, 7 major design decisions |
| **Epic Structure** | 9.5/10 | Clean DAG, proper phasing, cut line, full ACs, FR traceability |
| **FR Coverage** | 10/10 | 133/133 FRs mapped, 51 NFRs enumerated, 33 ARs, 50 UX-DRs |
| **UX Documentation** | 9/10 | 1707-line UX spec with flows, component specs, design tokens, accessibility. HTML direction showcase. No visual wireframes/mockups (text + ASCII layouts) |
| **Document Alignment** | 9.5/10 | GDD ↔ Architecture ↔ UX ↔ Epics all well-coordinated. No critical misalignments |
| **Implementation Readiness** | 9.5/10 | Ready to build. Stories are dev-ready with ACs. |

### Final Note

This assessment reviewed **4 planning documents** totaling over **6,800 lines** of specification. The project demonstrates exceptional planning quality:

- **133 Functional Requirements** fully traced from GDD → Epics → Stories with acceptance criteria
- **50 UX Design Requirements** mapped to specific epics with component specifications
- **33 Architecture Requirements** with protocol types and directory structure
- **~85-115 stories** across 13 epics, all with Given/When/Then acceptance criteria
- **Clean dependency graph** with no circular or forward dependencies
- **Explicit cut line** (Epic 6B — Voice/Video) with graceful degradation to text chat

The project is **implementation-ready**. Begin Phase 1.

---

**Assessment completed:** 2026-03-26
**Assessed by:** Implementation Readiness Workflow (GDS)
**Report location:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-26.md`
