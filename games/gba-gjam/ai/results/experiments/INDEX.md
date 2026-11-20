# GBA GJAM — Bot Strategy Experiments Index

Executed **5 experiments** (**710 total full 4-quarter matches**) in **13.29s** using the deterministic 60Hz evaluation harness (`npm run eval:experiments -w games/gba-gjam`).

| # | Experiment | Matches | Summary | Report |
|---|---|---:|---|---|
| **EXP1** | 3-Point Volume vs. Rim Dunking Across Rosters | 108 | Winner by roster — Shooter: hybrid-ace (95.8%), Dunker: hybrid-ace (79.2%), Balanced: hybrid-ace (91.7%). | [REPORT.md](./exp1-offense-vs-roster/REPORT.md) |
| **EXP2** | Defense Policy Sweep (Passive vs Steal vs Shove) | 72 | Winner: Relentless Shove (Turbo>=22) (86.1%, Elo 2076, 91.4 shove TO/g). | [REPORT.md](./exp2-defense-meta/REPORT.md) |
| **EXP3** | 2×2 Ablation: Apex Timing × Contest Discipline | 72 | Winner: Apex OFF + Contest Discipline ON (72.2%, 95.2% 3P%). Apex timing lifted 3P% by +1.4pp. | [REPORT.md](./exp3-shot-micro-ablation/REPORT.md) |
| **EXP4** | Hot-Hand / ON FIRE Funnel A/B Test | 116 | Direct H2H: Funnel ON 10-10 (50.0%, 1.1 vs 1.5 fire/g). Gauntlet: 16/48 vs 35/48. | [REPORT.md](./exp4-on-fire-funnel/REPORT.md) |
| **EXP5** | Champion v1 Synthesis & Promotion Gauntlet | 342 | Rank #2/10 (Elo 2020, 85.2% RR). vs shove-hound: 1-19 balanced, 0-20 pro-teams. Pro gauntlet: 17/32 (53.1%). Verdict: ITERATE. | [REPORT.md](./exp5-champion-v1-gauntlet/REPORT.md) |
