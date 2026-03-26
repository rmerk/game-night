---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
documentCounts:
  brainstorming: 1
  research: 0
  notes: 0
workflowType: 'game-brief'
lastStep: 5
project_name: 'mahjong-game'
user_name: 'Rchoi'
date: '2026-03-25'
game_name: 'Mahjong Night'
---

# Game Brief: Mahjong Night

**Date:** 2026-03-25
**Author:** Rchoi
**Status:** Draft for GDD Development

---

## Executive Summary

Mahjong Night is a web-based, real-time multiplayer American Mahjong game designed to recreate the warmth and social energy of an in-person game night. Players create private rooms, share a link, and play with friends — no downloads, no accounts, no friction. The game supports full NMJL rules with an updatable card system, and includes integrated text chat, reactions, voice, and video communication. It targets both experienced American Mahjong players looking for a digital home and newcomers who want an approachable way to learn the game.

---

## Game Vision

### Core Concept

A browser-based American Mahjong game that prioritizes social connection. Four players join a private room via a shared link and play in real time with full communication tools — text, reactions, voice, and video. The game faithfully implements American Mahjong rules with an updatable NMJL card system, while keeping the interface intuitive enough for newcomers to pick up through play.

### Elevator Pitch

Play American Mahjong with your friends from anywhere. Create a room, share a link, and you're at the table — no downloads, no accounts, no fuss. Real NMJL rules, real-time play, and the social energy of game night, right in your browser.

### Vision Statement

To be the definitive digital home for American Mahjong — a place where the game's community can gather regardless of distance, where experienced players find a faithful recreation of the game they love, and where new players discover why millions of people are hooked.

---

## Target Market

### Primary Audience

Existing American Mahjong players (skewing 40-70+, predominantly women) who play regularly at home or in clubs and want a way to continue playing when the group can't meet in person. They know the rules, own a physical set, and care about rule accuracy and a clean, easy-to-use interface. Many are not hardcore gamers — the product must be frictionless.

### Secondary Audience

Newcomers curious about American Mahjong — friends/family of existing players, people who've seen it in media, or players of other Mahjong variants who want to try the American version. They need the game to be approachable without a steep learning curve, and will likely learn by playing with experienced friends rather than through a formal tutorial (in MVP).

### Market Context

The digital American Mahjong space is underserved. Most online Mahjong games focus on Chinese (Mahjong Soul, Tenhou) or Japanese (Riichi) variants, or offer single-player solitaire-style games that have nothing to do with real Mahjong. The few American Mahjong apps that exist tend to have dated interfaces, poor multiplayer, or lack the yearly NMJL card. There is a clear gap for a modern, social-first, browser-based American Mahjong experience.

---

## Game Fundamentals

### Core Gameplay Pillars

1. **Social connection** — The game is a vehicle for spending time with friends. Communication tools (text, reactions, voice, video) are first-class features, not afterthoughts.

2. **Faithful rules** — American Mahjong played correctly, with proper NMJL card support that can be updated yearly. Experienced players should feel at home immediately.

3. **Zero friction** — No app to download, no account required to join a game. Share a link, click it, play. Every barrier removed is a player gained.

4. **Approachable design** — A playful, colorful interface that doesn't intimidate newcomers while still being clear and efficient for experienced players.

### Primary Mechanics

- **Room creation and joining:** Host creates a room, gets a shareable link/code. Up to 4 players join. Host configures game settings (timer, card year, etc.).
- **Tile drawing and discarding:** Standard American Mahjong flow — draw from the wall or claim a discard. Hybrid click/tap and drag-and-drop interaction model.
- **Calling tiles:** Pung, Kong, Quint, and Mahjong calls with clear UI prompts and priority handling per NMJL rules. (Note: American Mahjong does not use Chi/Chow.)
- **Jokers:** 8 Joker tiles in the set that can substitute for tiles in groups of 3 or more (per NMJL rules). Joker management — swapping, trading, and restrictions — is a core part of gameplay.
- **Charleston:** Pre-game tile passing sequence (Right, Across, Left, plus optional Courtesy pass) that adds a strategic layer before play begins.
- **Hand building:** Players arrange tiles on their rack, working toward hands on the current NMJL card.
- **Scoring:** Automatic scoring based on the declared hand and NMJL card values.
- **Turn management:** Host-configurable pacing — timed turns (15-30 sec default), relaxed (no timer), or custom.

### Player Experience Goals

- **For experienced players:** "This feels like my real game, just online. I don't have to teach the computer how American Mahjong works."
- **For newcomers:** "I can see what's happening, my friend can walk me through it over voice, and the interface helps me understand what's valid."
- **For everyone:** "I feel like I'm actually hanging out with my friends, not just staring at a game board."

---

## Scope and Constraints

### Target Platforms

Web browser (desktop and mobile). Responsive design that works well on both form factors. No native app for MVP — the browser is the platform.

### Development Timeline

3-6 months for full MVP including voice and video communication. Phased internally:

- **Month 1-2:** Core game engine (tile management, NMJL card system, game state, turn flow), room creation/joining, basic multiplayer networking.
- **Month 2-3:** Game UI (table, tiles, rack, discard area), hybrid interaction model (click + drag), text chat + reactions.
- **Month 3-4:** Voice and video chat (WebRTC), host configuration panel, game settings.
- **Month 4-5:** Polish, responsive mobile layout, edge case handling, playtesting.
- **Month 5-6:** Bug fixing, performance optimization, soft launch with friends/testers.

### Budget Considerations

Solo developer project — primary costs are hosting/infrastructure (WebSocket server, TURN/STUN servers for WebRTC, static hosting) and potentially the NMJL card data entry each year. No art team budget — visual style should be achievable with CSS/SVG and possibly a small icon/asset pack.

### Team Resources

Solo developer (Rchoi) augmented by Claude Code for accelerated development. This means architecture decisions should favor simplicity and maintainability — no over-engineering, no unnecessary abstractions. Choose boring technology where possible.

### Technical Constraints

- Browser-only — must work in modern Chrome, Firefox, Safari, Edge.
- Real-time multiplayer requires WebSocket infrastructure.
- Voice/video requires WebRTC with TURN/STUN servers (cost and complexity factor).
- No server-side game state persistence for MVP (games are ephemeral — if everyone disconnects, the game is lost). Persistence is a post-MVP feature.
- Updatable card system means the NMJL card data needs to be structured and swappable without code changes.
- Mobile browser support means touch-friendly UI with appropriate tap targets and responsive layout.

---

## Reference Framework

### Inspiration Games

The product draws inspiration from the social-first philosophy of party games (the feeling of Jackbox — everyone laughing, engaged, present) but applied to a traditional strategy game rather than a party format. The interaction model and UI clarity should aim for the best of modern web-based board games (clean, responsive, intuitive) without directly emulating any single competitor.

### Competitive Analysis

- **Real Mah Jongg (app):** Offers American Mahjong with NMJL card, but the interface is dated, mobile-only, and lacks robust social features.
- **Mahjong Soul / Tenhou:** Polished but focused on Japanese Riichi Mahjong — completely different ruleset.
- **Board Game Arena:** Functional multiplayer board game platform but Mahjong offerings are limited and the UX is utilitarian.
- **ilovemahj.com and similar:** Basic implementations with minimal social features and often outdated UX.

### Key Differentiators

1. **American Mahjong done right** — Full NMJL rules with yearly card support, not a variant or approximation.
2. **Social-first design** — Integrated voice, video, text, and reactions. The communication layer is as important as the game layer.
3. **Zero-friction access** — Browser-based, no download, no account required to join. Share a link and play.
4. **Modern, playful interface** — Bright, colorful, approachable design that doesn't look like it was built in 2008.

---

## Art and Audio Direction

### Visual Style

Playful and colorful. Bright, saturated colors with rounded shapes and friendly typography. The table should feel inviting, not intimidating — think more "delightful app" than "casino simulator." Tiles should be clearly readable with good contrast. Animations should be smooth and satisfying (tile draws, discards, calls) without being slow or distracting.

### Audio Style

Subtle and satisfying. Tile click/clack sounds on draw and discard. Gentle notification sounds for turns and calls. Optional background ambient sound. All audio should be toggleable — many players will be on voice chat and won't want competing sounds.

### Production Approach

CSS/SVG-first for tiles and UI elements to keep things lightweight and resolution-independent. Minimal raster assets. Animations via CSS transitions and lightweight JS animation (no heavy game engine). Sound effects from royalty-free libraries or generated.

---

## Risk Assessment

### Key Risks

1. **Scope creep** — Voice + video + full game engine + responsive design is a lot for a solo dev. Discipline on scope is critical.
2. **NMJL card licensing** — The NMJL card is copyrighted. Need to determine whether encoding the card data constitutes infringement, or if a "bring your own card" model is needed.
3. **WebRTC reliability** — Voice/video in browsers is notoriously finicky across devices and networks. This could consume disproportionate debugging time.

### Technical Challenges

- Real-time game state synchronization across 4 players with low latency.
- WebRTC NAT traversal — many home networks and corporate firewalls cause connection issues. TURN server fallback is essential but adds cost.
- Mobile browser audio/video permissions and behavior vary significantly across iOS Safari and Android Chrome.
- Hybrid click + drag-and-drop interaction that feels good on both desktop mice and mobile touch.

### Market Risks

- The primary audience (older, non-gamer demographic) may have lower tolerance for technical friction (browser permissions for mic/camera, WebRTC issues).
- Competing apps could modernize their offering.
- Dependency on yearly NMJL card creates ongoing maintenance burden.

### Mitigation Strategies

- **Scope:** Strict phased delivery. If voice/video threatens the timeline, ship core game + text/reactions first and add A/V as a fast-follow.
- **NMJL licensing:** Research the legal landscape early. Consider a "card entry" model where players input their own card data, or partner with NMJL.
- **WebRTC:** Use a proven WebRTC service/SDK (e.g., LiveKit, Daily.co, or Twilio) rather than building from scratch. Worth the cost to save months of debugging.
- **Mobile:** Test on real devices early and often. Don't leave mobile testing for the end.

---

## Success Criteria

### MVP Definition

A working web application where 4 players can:
- Create and join a private room via shared link
- Play a complete game of American Mahjong with correct NMJL rules
- Communicate via text chat, quick reactions, voice, and video
- Use hybrid click/drag tile interaction on desktop and mobile
- Have the host configure game pace (timed/relaxed)

### Success Metrics

- 4 friends can complete a full game without encountering a game-breaking bug.
- A new player can join a room and start playing within 60 seconds of clicking the link.
- Voice and video work reliably across common browser/device combinations.
- At least 5 playtest groups provide positive feedback on the social experience.

### Launch Goals

- Soft launch to personal network and American Mahjong communities (Reddit, Facebook groups).
- Collect feedback on rule accuracy, UX, and social features.
- Iterate based on real usage before any broader marketing push.

---

## Next Steps

### Immediate Actions

1. Research NMJL card licensing/copyright implications.
2. Choose tech stack (frontend framework, WebSocket solution, WebRTC service).
3. Design the NMJL card data schema (must be updatable without code changes).
4. Build the core game state engine (tile set, wall, drawing, discarding, calling, scoring).

### Research Needs

- Legal status of encoding NMJL card hand data in software.
- WebRTC service comparison (LiveKit vs. Daily.co vs. Twilio vs. self-hosted).
- Existing open-source American Mahjong game engines or tile set assets.
- Accessibility requirements for the primary demographic (font sizes, contrast, motor accessibility).

### Open Questions

- Account system: Is truly "no account" feasible, or do we need at least a lightweight session/nickname system?
- Reconnection: What happens if a player disconnects mid-game? Can they rejoin?
- Spectators: Should non-players be able to watch a game?
- Card updates: Who enters the new card data each year? How is it validated?

---

## Appendices

### A. Research Summary

To be completed during technical research phase.

### B. Stakeholder Input

Solo project — primary stakeholder is the developer (Rchoi) and the initial playtest group.

### C. References

- National Mah Jongg League (NMJL): https://www.nationalmahjonggleague.org/
- American Mahjong rules and terminology reference to be compiled during development.

---

_This Game Brief serves as the foundational input for Game Design Document (GDD) creation._

_Next Steps: Use the `workflow gdd` command to create detailed game design documentation._
