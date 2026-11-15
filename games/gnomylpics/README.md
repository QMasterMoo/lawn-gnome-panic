# Gnomylpics

The Gnome Olympics: a party meet of three quick events for up to four gnomes on one keyboard, with CPU gnomes filling the empty lanes. Each event pays 5 / 3 / 2 / 1 points by place; most points after three events wins.

**Proof of concept.** The question it answers: do two-key, everyone-at-once track events feel fun enough to grow into a party game?

## Run

```
npm run dev -w games/gnomylpics     # http://localhost:5191
npm run build -w games/gnomylpics
```

## Controls

Every event uses only your two keys:

| Player | Keys |
|---|---|
| P1 | A / D |
| P2 | ← / → |
| P3 | J / L |
| P4 | Numpad 4 / Numpad 6 |

Title screen: 1-4 picks how many humans, E / N / H sets CPU difficulty, Space starts.

## Events

1. **60m Gnome Dash**: tap left, right, left, right. Hitting the same key twice is a stumble: you lose most of your speed and your taps are ignored for a moment.
2. **Triple Jump**: alternate to sprint. In the last 4 m, tap to take off before the red foul line (closer is better, past it is a foul). Then tap each time you land, hop, skip, jump: a perfect tap keeps your speed, a late or early tap is a flop.
3. **Mower Toss**: alternate to spin the mower up (same key twice = slip). Press both keys together to let go while the angle needle is near 45 degrees. Auto-release after 5 s.

All tuning is in `src/config.ts` (`RUN`, `DASH`, `TRIPLE`, `TOSS`, `CPU_TAP`, `PLACE_POINTS`).

## Code

- `src/config.ts`: scene keys, contracts (`MeetState`, `EventResult`), tuning.
- `src/meet.ts`: creating a meet, ranking, points, scene flow. A new event = a scene that calls `finishEvent` plus a line in `EVENTS`.
- `src/runner.ts`: the alternating-tap model shared by all events, and the CPU tapper.
- `src/input.ts`, `src/lanes.ts`: key routing per player; lane drawing, countdown, messages.

## Not done yet

Online play (the shared `@lawn/mp` server), touch controls, gamepad support, pulling other games in as events, a board-game meta layer.
