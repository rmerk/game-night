# Playtest Plan: Full-session integration (Mahjong Night)

## Overview

- **Build / branch:** _(record at session time)_
- **Playtest type:** Internal, **integration-focused** — validate the full spine from room creation through at least one completed hand and post-game flow.
- **Session date(s):** _(schedule)_
- **Primary objective:** Prove that implemented systems wire together as one continuous game (not isolated features). Surface **progression blockers**, **confusing transitions**, and **desync / reconnect** issues automated tests rarely catch.
- **Secondary objective:** Capture subjective “table feel” (pace, clarity of whose turn it is, call window stress, scoreboard comprehension).

## Participant criteria

- **Count:** **4 human players** at separate browsers/devices when testing the real multiplayer path (recommended for at least one session). For quick smoke, 1–2 testers plus bots/host-only flows are acceptable only if labeled as **partial coverage**.
- **Experience:** Mix if possible — one table familiar with NMJL, one casual, one “first online mahjong” — to stress UI copy and affordances.
- **Tech:** At least one **phone** and one **desktop** session over the plan’s lifecycle (layout, touch targets, orientation).

## Preconditions (preflight)

- [ ] Client and server builds match (commit hash or version in notes).
- [ ] WebSocket game server reachable; env vars documented (`docs/` / `.env.example`).
- [ ] If testing voice/video: LiveKit URL and token path configured per `docs/livekit-deployment.md`.
- [ ] Facilitator has a **stop condition** list (e.g. hard crash, stuck phase with no UI escape).

## Golden path — scripted integration checklist

Use this as a **pass/fail spine**. Deviations get a severity tag (P0–P3).

| # | Phase | Steps | Pass criteria | Notes |
|---|--------|--------|----------------|-------|
| G1 | Room | Host creates room; 3 others join with codes; names visible | All four in lobby; host controls responsive | Record any duplicate-tab / session issues |
| G2 | Start | Host starts game | State moves out of lobby; walls/dealing implied by UI | Capture `gamePhase` if devtools used |
| G3 | Charleston | Complete required passes (all directions) | No dead UI; blind pass rules feel explained or discoverable | Time-to-complete |
| G4 | Play loop | Several full turns: draw, discard | Turn indicator correct; discard appears in correct pool; wall count plausible | Include “not my turn” mis-click |
| G5 | Call window | Trigger at least one **pung/kong/quint** and one **pass** | Window opens/closes predictably; priority feels fair or at least consistent | Note timer UX |
| G6 | Mahjong path | Either **mahjong on discard** or **self-draw** (whichever is feasible in-session) | Transition to **scoreboard**; payments/scores visible; winner clear | If blocked, file P0/P1 |
| G7 | Scoreboard | Review scores; optional **show hand** if implemented | No crash; other players see agreed reveal rules | Tie to `Celebration` / overlays if present |
| G8 | Rematch / next game | Start rematch or return to lobby per product intent | Session scores / history coherent (see `sessionScoresFromPriorGames` in protocol) | Document any reset bugs |
| G9 | Disconnect | One player refreshes mid-**play**; one mid-**call window** (separate runs) | Reconnect restores coherent view; no duplicate actions | Compare to pause/AFK flows if triggered |
| G10 | Orientation | Mid-game rotate phone (portrait ↔ landscape) | No state loss; no stuck celebration/modals per UX spec intent | From UX: celebration should not restart |

## Session structure

### Pre-session (~10 min)

- Welcome; no long rules lecture — observe **discoverability**.
- Goals: “We’re testing whether the online table works end-to-end, not whether you’re good at mahjong.”
- Think-aloud optional; facilitator notes confusion without solving immediately (unless P0).

### Gameplay (~60–90 min for full table)

- **First 30 min:** Run **golden path** G1–G8 with light facilitation only for “how do I…?” after a 2-minute struggle.
- **Remaining time:** Free play, stress calls, chat/reactions/LiveKit if in scope for this build.

**Intervention rules**

- Intervene for: data loss, inability to progress, abusive latency loops, or genuine distress.
- Otherwise: log the stall and timestamp.

### Post-session (~15 min)

- Overall impression (1–10) and “would you play again with friends?”
- “Where were you unsure whose turn it was?”
- “What felt best? What felt broken or cheap?”
- Open floor.

## Observation guide

| Signal | Watch for | Record |
|--------|-----------|--------|
| Confusion | Long pause before first discard after Charleston; hunting for call buttons | Phase, ~duration |
| Frustration | Repeated mis-clicks, sighs at call window, “it ate my click” | Action + viewport |
| Engagement | Laughter, reactions, continued focus through scoreboard | Which features |
| Drop-off | Tab away, give up on join/start | Last known phase |

**Quantitative hints (optional)**

- Time lobby → first discard in play phase.
- Time in call window vs. passes.
- Count of “had to refresh” per session.

## Note-taking template

```
[TIME] [PHASE] [OBSERVATION] [REACTION/SEVERITY]
0:08  lobby   Join code unclear    P2 confusion
0:22  play    Discard pool wrong seat   P0 if reproducible
```

## Data collection

- **Recording:** Screen + audio optional; consent required.
- **Logs:** If available, correlate one session with server timestamps for one P0/P1.
- **Metrics:** Completion of G1–G8 (Y/N per row); blocker list.

## Team roles

| Role | Responsibility |
|------|----------------|
| Facilitator | Pace, questions, intervention calls |
| Note-taker | Timestamped log, quotes |
| Technical | Repro steps, network/env capture |

## Post-playtest analysis

### Severity

- **P0:** Blocks progression or corrupts state for any seat.
- **P1:** Major UX break or frequent confusion on core loop.
- **P2:** Polish / wrong copy / edge-case recovery.
- **P3:** Nice-to-have.

### Report template (per session)

```markdown
## Playtest Report: [date] — [build]

### Summary
- Participants: N (devices: …)
- Golden path: G1–G? completed (list gaps)
- Sentiment: …

### Key findings
1. …
2. …

### Recommendations
| Issue | Severity | Recommendation | Owner |
| ----- | -------- | -------------- | ----- |
| …     | …        | …              | …     |

### Quotes
> "…"

### Next steps
1. File/track issues
2. Re-run golden path after fixes
```

## Follow-up

- After fixes on P0/P1, run **G1–G8 only** (30–45 min) before declaring “integration stable.”
- When Epic 7 celebration/audio lands, add a row: **celebration sequence** does not block G7/G10.

---

_Plan aligned with shared `GamePhase`: `lobby` → `charleston` → `play` → `scoreboard` → `rematch`. Update this doc when the canonical “ship bar” for session flow changes._
