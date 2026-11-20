# GBA GJAM — Bot Strategy Experimentation Process

This document defines the **repeatable human workflow** for devising, testing, analyzing, and promoting bot strategies in GBA GJAM (`games/gnome-jam`) to iteratively build a **Champion** bot.

---

## Core Principles

1. **Hypothesis First, Code Second.** Never tweak constants blindly. Every experiment starts with a written causal hypothesis linking a specific game mechanic in `src/sim.ts` to a predicted change in both a *mechanism metric* (e.g., 3P%, shove turnovers, fire activations) and *win rate*.
2. **Isolate One Variable.** When testing an offensive change, lock defense constant. When testing a defensive change, lock offense constant. Use parameterized bots (like `createArcArchitectBot({ strictApex, contestDiscipline })`) or clean A/B variants so results are attributable.
3. **Eliminate Environmental Bias.**
   - **Side-swapping:** Every series alternates Home/Away every game so tip-off order (Home Q1/Q3/OT, Away Q2/Q4) and court direction cancel out.
   - **Deterministic seeds:** Use `withSeededRandom(seed)` so any experiment can be re-run bit-for-bit identically.
   - **Roster control:** Run primary A/B comparisons on **mirrored balanced rosters** (`rosterMode: 'balanced'`) to measure pure strategy, then validate generalization across **specialized** (`shooter`, `dunker`) and **pro-team** (`pro-teams`) rosters.
4. **Measure Beyond Win Rate.** Win/Loss alone hides *why* a bot won or lost. Always record and inspect:
   - **Win% with 95% Wilson Confidence Interval** (to distinguish real edges from RNG noise)
   - **Point Differential (`Diff`)** (much lower variance than binary W/L)
   - **Efficiency & Volume:** `FG%`, `3P%`, `3PA`, `Dunks/g`
   - **Possession Generation:** `Steals/g`, `Shove TO/g`, `Blocks/g`, `Rebounds/g`, `Shot Clock Violations/g`
   - **Mechanic Triggers:** `On-Fire/g`, `Alley-Oops/g`
5. **Version & Archive Everything.** Every run writes machine-readable JSON + human-readable Markdown into `games/gnome-jam/ai/results/experiments/expN-<slug>/`. Never overwrite old experiment logs; add new numbered experiments so you have a full lab notebook.

---

## The 6-Step Experiment Loop

```text
  1. OBSERVE & HYPOTHESIZE
        │  Read sim.ts mechanics or prior match telemetry -> form falsifiable claim
        ▼
  2. DESIGN EXPERIMENT CARD
        │  Pick control vs treatment, roster mode, sample size (N), success criteria
        ▼
  3. IMPLEMENT ISOLATED VARIANT
        │  Add config flag or new BotController in src/ai/bots/
        ▼
  4. RUN DETERMINISTIC HARNESS
        │  npm run eval:experiments -w games/gnome-jam
        ▼
  5. DIAGNOSE DATA (W/L + MECHANISM METRICS)
        │  Did the mechanism metric move as predicted? Is the 95% CI clear of 50%?
        ▼
  6. DECIDE: PROMOTE / ITERATE / REJECT
           If Champion criteria met -> promote to champion-v(N+1) & update Elo ladder
```

### Step-by-Step Guide

#### Step 1: Observe & Hypothesize
- Inspect the latest leaderboard, head-to-head matrix, and `src/sim.ts`.
- Identify either:
  - An **under-exploited mechanic** (e.g., passes cannot be intercepted -> anti-shove pass-out), or
  - A **weakness in the current Champion** (e.g., loses to a specific archetype or on shooter-heavy rosters).
- Write a 1-sentence hypothesis: *"Doing X will change mechanism metric Y by Z, increasing win rate against control from A% to B%."*

#### Step 2: Design the Experiment Card
Fill out the standard Experiment Card (template below) before coding:
- **Sample size (`N`) guidelines:**
  - Quick directional screen: `N = 10` games/matchup (~0.2s)
  - Standard A/B or factorial test: `N = 20–30` games/matchup (~0.5–1s; 95% CI half-width ≈ ±18% at N=20, ±14% at N=30)
  - Champion promotion gauntlet: `N = 10` games vs every bot in the roster (80–100+ total matches, ~2s) + cross-roster validation (`balanced`, `shooter`, `dunker`, `pro-teams`).
- Always use an **even** number of games per pair so Home and Away counts are equal.

#### Step 3: Implement
- Keep bot logic pure and stateless (or cleanly resettable in `reset()`), implementing `BotController`.
- Prefer adding typed option flags to existing bots for ablations (e.g., `strictApex?: boolean`) rather than copy-pasting files.

#### Step 4: Run & Capture
- Run via `npm run eval:experiments -w games/gnome-jam` (or add a new experiment entry in `ai/experiments.ts`).
- Verify `npm test -w games/gnome-jam` and `npm run build -w games/gnome-jam` stay green.

#### Step 5: Diagnose
Ask three questions of the saved `REPORT.md` / `results.json`:
1. **Did the mechanism work?** (e.g., did 3PA or Shove TO actually change in the intended direction?)
2. **Did it translate to Point Diff and Win%?** (Sometimes a mechanic works locally—like more blocks—but costs tempo or gives up steals.)
3. **Does it generalize across rosters and opponents?** (Check for rock-paper-scissors cycles or roster overfitting.)

#### Step 6: Promote, Iterate, or Reject
**Champion Promotion Criteria:**
A candidate `champion-v(N+1)` replaces the current Champion only if ALL of the following hold:
1. **Gauntlet Elo:** Ranks #1 in the full round-robin / gauntlet Elo ladder on balanced rosters.
2. **Head-to-Head vs Prior Champion:** Beats the prior Champion (`> 55%` win rate and positive point differential over `N >= 20` side-swapped games).
3. **Cross-Roster Robustness:** Maintains `> 60%` aggregate win rate across `pro-teams` rosters (not overfit to one stat line).
4. **Zero Regressions:** Passes `npm test -w games/gnome-jam` and `npm run build -w games/gnome-jam`.

---

## Experiment Card Template

Copy this block when designing any new experiment:

```markdown
### Experiment N: <Short Title>
- **Date / Author:** YYYY-MM-DD
- **Question:** What strategic or mechanical question are we answering?
- **Hypothesis:** If we change <X>, then <mechanism metric> will <increase/decrease>, resulting in <predicted Win% / Diff>.
- **Control:** `<bot-id>` (describe exact behavior)
- **Treatment(s):** `<variant-1>`, `<variant-2>`, ...
- **Controlled Variables:** 4×45s quarters, 60Hz (`dt = 1/60`), difficulty `pro`, side-swapped Home/Away, deterministic seed base `<seed>`, roster mode `<balanced|shooter|dunker|pro-teams>`, `N = <even number>` games per pair.
- **Success Criteria:** <e.g., Treatment beats Control with >65% win rate and >+10 PPG diff>
- **Result Summary:** *(Filled after running)*
- **Decision:** `PROMOTE` / `ITERATE` / `REJECT` — and next hypothesis unlocked.
```

---

## Quick Commands

```bash
# Run full 9-bot baseline round-robin (288 matches)
npm run eval:baseline -w games/gnome-jam

# Run all 5 designed experiments and save results
npm run eval:experiments -w games/gnome-jam

# Verify unit tests & production build
npm test -w games/gnome-jam && npm run build -w games/gnome-jam
```
