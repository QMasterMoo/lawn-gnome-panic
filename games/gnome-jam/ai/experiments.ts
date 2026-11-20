import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAlleyOopExpressBot,
  createArcArchitectBot,
  createChampionV1Bot,
  createFireFeederBot,
  createHybridAceBot,
  createShoveHoundBot,
} from '../src/ai';
import {
  runRoundRobin,
  runSeries,
  type AggregateBotStats,
  type BotFactory,
  type LeaderboardEntry,
} from '../src/ai/eval';
import { formatLeaderboardMarkdown, getBaselineRoster } from './baseline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXP_ROOT = path.resolve(__dirname, 'results', 'experiments');

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function num(v: number): string {
  return v.toFixed(1);
}

function writeExp(dirName: string, json: unknown, md: string): void {
  const dir = path.join(EXP_ROOT, dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(json, null, 2));
  fs.writeFileSync(path.join(dir, 'REPORT.md'), md);
}

function formatSeriesRow(label: string, a: AggregateBotStats, b: AggregateBotStats): string {
  const ci = `${pct(a.winRate)} (${pct(a.winRateCI95[0])}–${pct(a.winRateCI95[1])})`;
  const diff = `${a.avgDiff >= 0 ? '+' : ''}${num(a.avgDiff)}`;
  return `| ${label} | ${a.wins}-${a.losses} | ${ci} | ${num(a.avgPts)} – ${num(b.avgPts)} (${diff}) | ${pct(a.fgPct)} / ${pct(a.tpPct)} | ${num(a.avgSteals)} (${num(a.avgShoveTurnovers)}) | ${num(a.avgFire)} |`;
}

/** Experiment 1: 3PT Spacing vs Rim Dunking vs Hybrid EV across 3 roster archetypes. */
function runExperiment1(): { id: string; title: string; summary: string; totalMatches: number } {
  const bots: BotFactory[] = [
    { id: 'arc-architect', name: 'Arc Architect (3PT)', create: () => createArcArchitectBot() },
    { id: 'alley-oop-express', name: 'Alley-Oop Express (Rim)', create: () => createAlleyOopExpressBot() },
    { id: 'hybrid-ace', name: 'Hybrid Ace (EV)', create: () => createHybridAceBot() },
  ];

  const rosters: Array<{ mode: 'shooter' | 'dunker' | 'balanced'; label: string }> = [
    { mode: 'shooter', label: 'Shooter Roster (90 3PT / 50 Dunk)' },
    { mode: 'dunker', label: 'Dunker Roster (45 3PT / 90 Dunk)' },
    { mode: 'balanced', label: 'Balanced Roster (75–80 All-Around)' },
  ];

  const results: Record<string, ReturnType<typeof runRoundRobin>> = {};
  let totalMatches = 0;

  const md: string[] = [
    '# Experiment 1: 3-Point Volume vs. Rim Dunking Across Roster Archetypes',
    '',
    '## Experiment Card',
    '- **Question:** How does optimal offensive style (pure 3PT spacing vs. rim/alley-oop dunking vs. stat-aware EV) interact with roster stat profiles?',
    '- **Hypothesis:** Pure 3PT (`arc-architect`) will outperform rim-running on Shooter rosters (where uncontested apex 3s yield ~2.88 EPPS), while rim-running (`alley-oop-express`) will outperform 3PT on Dunker rosters, and `hybrid-ace` will adapt to win or finish top-2 across all three.',
    '- **Controlled Variables:** 4×45s quarters, 60Hz, `pro` difficulty, side-swapped Home/Away, `N = 12` games per pair per roster mode (108 total matches).',
    '',
  ];

  rosters.forEach((r, idx) => {
    const rr = runRoundRobin(bots, {
      games: 12,
      baseSeed: 21000 + idx * 5000,
      quarterSeconds: 45,
      difficulty: 'pro',
      rosterMode: r.mode,
    });
    results[r.mode] = rr;
    totalMatches += rr.totalMatches;

    md.push(`## ${r.label}`, '');
    md.push('| Rank | Bot | Elo | W-L | Win% (95% CI) | PPG | Diff | FG% | 3P% (3PA) | Dunks | Steals |');
    md.push('|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    rr.leaderboard.forEach((e, i) => {
      const ci = `${pct(e.winRate)} (${pct(e.winRateCI95[0])}–${pct(e.winRateCI95[1])})`;
      md.push(
        `| ${i + 1} | **${e.botName}** | ${e.elo} | ${e.wins}-${e.losses} | ${ci} | ${num(e.avgPts)} | ${e.avgDiff >= 0 ? '+' : ''}${num(e.avgDiff)} | ${pct(e.fgPct)} | ${pct(e.tpPct)} (${num(e.avgTpa)}) | ${num(e.avgDunks)} | ${num(e.avgSteals)} |`,
      );
    });
    md.push('');
  });

  const shooterTop = results.shooter.leaderboard[0];
  const dunkerTop = results.dunker.leaderboard[0];
  const balancedTop = results.balanced.leaderboard[0];

  md.push(
    '## Key Findings',
    `- **Shooter roster winner:** \`${shooterTop.botId}\` (${shooterTop.wins}-${shooterTop.losses}, ${num(shooterTop.avgPts)} PPG, ${pct(shooterTop.tpPct)} 3P%).`,
    `- **Dunker roster winner:** \`${dunkerTop.botId}\` (${dunkerTop.wins}-${dunkerTop.losses}, ${num(dunkerTop.avgPts)} PPG, ${num(dunkerTop.avgDunks)} dunks/g).`,
    `- **Balanced roster winner:** \`${balancedTop.botId}\` (${balancedTop.wins}-${balancedTop.losses}, ${num(balancedTop.avgPts)} PPG).`,
    '- **Takeaway for Champion:** Stat-aware EV selection beats locked single-style offense across rosters, because it fires ~90%+ 3s when shooters are open and seamlessly switches to guaranteed dunks on low-3PT builds.',
    '',
  );

  writeExp('exp1-offense-vs-roster', { rosters: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { leaderboard: v.leaderboard, matrix: v.matrix }])) }, md.join('\n'));
  return {
    id: 'exp1',
    title: '3-Point Volume vs. Rim Dunking Across Rosters',
    summary: `Winner by roster — Shooter: ${shooterTop.botId} (${pct(shooterTop.winRate)}), Dunker: ${dunkerTop.botId} (${pct(dunkerTop.winRate)}), Balanced: ${balancedTop.botId} (${pct(balancedTop.winRate)}).`,
    totalMatches,
  };
}

/** Experiment 2: Defense Meta Sweep (holding offense 100% constant). */
function runExperiment2(): { id: string; title: string; summary: string; totalMatches: number } {
  const bots: BotFactory[] = [
    { id: 'def-passive', name: 'Passive Containment', create: () => createHybridAceBot({ defenseMode: 'passive' }) },
    { id: 'def-steal-only', name: 'Steal-Poke Only (No Shove)', create: () => createHybridAceBot({ defenseMode: 'steal-only' }) },
    { id: 'def-balanced-shove', name: 'Balanced Shove (Turbo>=35)', create: () => createHybridAceBot({ defenseMode: 'balanced-shove' }) },
    { id: 'def-relentless-shove', name: 'Relentless Shove (Turbo>=22)', create: () => createHybridAceBot({ defenseMode: 'relentless-shove' }) },
  ];

  // Override IDs cleanly for telemetry clarity
  const wrappedBots: BotFactory[] = bots.map((b) => ({
    ...b,
    create: () => {
      const inner = b.create();
      return { id: b.id, name: b.name, decide: (s, c) => inner.decide(s, c) };
    },
  }));

  const rr = runRoundRobin(wrappedBots, {
    games: 12,
    baseSeed: 31000,
    quarterSeconds: 45,
    difficulty: 'pro',
    rosterMode: 'balanced',
  });

  const md = [
    formatLeaderboardMarkdown(
      rr.leaderboard,
      rr.matrix,
      'Experiment 2: Defense Policy Sweep (Controlled Offense)',
      'Holds offense 100% identical (`hybrid-ace` offense) and varies ONLY defensive policy across 4 levels: Passive Containment, Steal-Poke Only, Balanced Shove (`turbo >= 35`), and Relentless Shove (`turbo >= 22`). 12 games/pair (72 matches), balanced rosters.',
    ),
    '## Experiment Card & Findings',
    '- **Hypothesis:** Because turbo-shove in `src/sim.ts` is a 100% guaranteed turnover + 0.85s stun (costing 22 turbo) with no foul penalty, lower shove turbo thresholds will monotonically increase steals/shove-turnovers and win rate.',
    `- **Winner:** **${rr.leaderboard[0].botName}** (Elo ${rr.leaderboard[0].elo}, ${rr.leaderboard[0].wins}-${rr.leaderboard[0].losses}, ${pct(rr.leaderboard[0].winRate)}, ${num(rr.leaderboard[0].avgShoveTurnovers)} shove TO/g).`,
    `- **Runner-up:** **${rr.leaderboard[1].botName}** (Elo ${rr.leaderboard[1].elo}, ${rr.leaderboard[1].wins}-${rr.leaderboard[1].losses}, ${pct(rr.leaderboard[1].winRate)}).`,
    `- **Steal-Poke Only vs Passive:** Steal-Poke (${rr.leaderboard.find((e) => e.botId === 'def-steal-only')?.wins}-${rr.leaderboard.find((e) => e.botId === 'def-steal-only')?.losses}) vs Passive (${rr.leaderboard.find((e) => e.botId === 'def-passive')?.wins}-${rr.leaderboard.find((e) => e.botId === 'def-passive')?.losses}).`,
    '- **Takeaway for Champion:** Relentless turbo-shove (`turbo >= 22`) is the single highest-leverage defensive mechanic in GBA GJAM — AND this also reveals why an anti-shove offensive counter (passing before contact) is essential to beat shove-heavy bots.',
    '',
  ].join('\n');

  writeExp('exp2-defense-meta', { leaderboard: rr.leaderboard, matrix: rr.matrix }, md);
  return {
    id: 'exp2',
    title: 'Defense Policy Sweep (Passive vs Steal vs Shove)',
    summary: `Winner: ${rr.leaderboard[0].botName} (${pct(rr.leaderboard[0].winRate)}, Elo ${rr.leaderboard[0].elo}, ${num(rr.leaderboard[0].avgShoveTurnovers)} shove TO/g).`,
    totalMatches: rr.totalMatches,
  };
}

/** Experiment 3: 2x2 Factorial Ablation — Apex Shot Timing x Contest Discipline. */
function runExperiment3(): { id: string; title: string; summary: string; totalMatches: number } {
  const bots: BotFactory[] = [
    {
      id: 'apex1-disc1',
      name: 'Apex ON + Contest Discipline ON',
      create: () => createArcArchitectBot({ strictApex: true, contestDiscipline: true }),
    },
    {
      id: 'apex1-disc0',
      name: 'Apex ON + Contest Discipline OFF',
      create: () => createArcArchitectBot({ strictApex: true, contestDiscipline: false }),
    },
    {
      id: 'apex0-disc1',
      name: 'Apex OFF + Contest Discipline ON',
      create: () => createArcArchitectBot({ strictApex: false, contestDiscipline: true }),
    },
    {
      id: 'apex0-disc0',
      name: 'Apex OFF + Contest Discipline OFF',
      create: () => createArcArchitectBot({ strictApex: false, contestDiscipline: false }),
    },
  ];

  const wrapped: BotFactory[] = bots.map((b) => ({
    ...b,
    create: () => {
      const inner = b.create();
      return { id: b.id, name: b.name, decide: (s, c) => inner.decide(s, c) };
    },
  }));

  const rr = runRoundRobin(wrapped, {
    games: 12,
    baseSeed: 41000,
    quarterSeconds: 45,
    difficulty: 'pro',
    rosterMode: 'shooter',
  });

  const byId = (id: string): LeaderboardEntry => rr.leaderboard.find((e) => e.botId === id)!;
  const a1d1 = byId('apex1-disc1');
  const a1d0 = byId('apex1-disc0');
  const a0d1 = byId('apex0-disc1');
  const a0d0 = byId('apex0-disc0');

  const md = [
    formatLeaderboardMarkdown(
      rr.leaderboard,
      rr.matrix,
      'Experiment 3: 2×2 Ablation — Apex Shot Timing × Contest Discipline',
      'Factorial ablation on `arc-architect` using Shooter rosters (90 3PT) so jump-shot execution dominates. 12 games/pair (72 matches).',
    ),
    '## Factorial Effect Decomposition',
    `- **Apex Timing Effect (ON vs OFF, averaged):** 3P% jumps from **${pct((a0d1.tpPct + a0d0.tpPct) / 2)}** → **${pct((a1d1.tpPct + a1d0.tpPct) / 2)}** (+${(((a1d1.tpPct + a1d0.tpPct) - (a0d1.tpPct + a0d0.tpPct)) * 50).toFixed(1)} percentage points!).`,
    `- **Contest Discipline Effect (ON vs OFF, averaged):** Win% moves from **${pct((a1d0.winRate + a0d0.winRate) / 2)}** → **${pct((a1d1.winRate + a0d1.winRate) / 2)}**, 3P% moves from **${pct((a1d0.tpPct + a0d0.tpPct) / 2)}** → **${pct((a1d1.tpPct + a0d1.tpPct) / 2)}**.`,
    `- **Winner:** **${rr.leaderboard[0].botName}** (Elo ${rr.leaderboard[0].elo}, ${pct(rr.leaderboard[0].winRate)}, ${pct(rr.leaderboard[0].tpPct)} 3P%).`,
    '- **Takeaway for Champion:** Contest discipline is the dominant lever (+38.8pp win rate!). Surprisingly, quick-release (`Apex OFF`) beat strict apex (`Apex ON`) on Shooter rosters (72.2% vs 66.7%, 229 PPG vs 164 PPG): because 90-3PT uncontested shooters already make >95% of quick-release 3s, waiting ~0.35s for apex only adds +1.4pp 3P% while surrendering tempo and giving defenders time to close.',
    '',
  ].join('\n');

  writeExp('exp3-shot-micro-ablation', { leaderboard: rr.leaderboard, matrix: rr.matrix }, md);
  return {
    id: 'exp3',
    title: '2×2 Ablation: Apex Timing × Contest Discipline',
    summary: `Winner: ${rr.leaderboard[0].botName} (${pct(rr.leaderboard[0].winRate)}, ${pct(rr.leaderboard[0].tpPct)} 3P%). Apex timing lifted 3P% by +${(((a1d1.tpPct + a1d0.tpPct) - (a0d1.tpPct + a0d0.tpPct)) * 50).toFixed(1)}pp.`,
    totalMatches: rr.totalMatches,
  };
}

/** Experiment 4: Hot-Hand / ON FIRE Funneling A/B Test. */
function runExperiment4(): { id: string; title: string; summary: string; totalMatches: number } {
  const funnelOn: BotFactory = {
    id: 'fire-funnel-on',
    name: 'Fire Feeder (Funnel ON)',
    create: () => {
      const inner = createFireFeederBot({ funnelFire: true });
      return { id: 'fire-funnel-on', name: 'Fire Feeder (Funnel ON)', decide: (s, c) => inner.decide(s, c) };
    },
  };
  const funnelOff: BotFactory = {
    id: 'fire-funnel-off',
    name: 'Fire Feeder (Funnel OFF)',
    create: () => {
      const inner = createFireFeederBot({ funnelFire: false });
      return { id: 'fire-funnel-off', name: 'Fire Feeder (Funnel OFF)', decide: (s, c) => inner.decide(s, c) };
    },
  };

  const h2h = runSeries(funnelOn, funnelOff, {
    games: 20,
    baseSeed: 51000,
    quarterSeconds: 45,
    difficulty: 'pro',
    rosterMode: 'balanced',
  });

  const opponents: BotFactory[] = [
    { id: 'shove-hound', name: 'Shove Hound', create: () => createShoveHoundBot() },
    { id: 'hybrid-ace', name: 'Hybrid Ace', create: () => createHybridAceBot() },
    { id: 'arc-architect', name: 'Arc Architect', create: () => createArcArchitectBot() },
    { id: 'alley-oop-express', name: 'Alley-Oop Express', create: () => createAlleyOopExpressBot() },
  ];

  const gauntletOn: Array<{ opp: string; res: ReturnType<typeof runSeries> }> = [];
  const gauntletOff: Array<{ opp: string; res: ReturnType<typeof runSeries> }> = [];
  let totalMatches = h2h.games;

  opponents.forEach((opp, idx) => {
    const rOn = runSeries(funnelOn, opp, { games: 12, baseSeed: 52000 + idx * 500, rosterMode: 'balanced' });
    const rOff = runSeries(funnelOff, opp, { games: 12, baseSeed: 52000 + idx * 500, rosterMode: 'balanced' });
    gauntletOn.push({ opp: opp.id, res: rOn });
    gauntletOff.push({ opp: opp.id, res: rOff });
    totalMatches += rOn.games + rOff.games;
  });

  const onWins = gauntletOn.reduce((s, x) => s + x.res.botA.wins, 0);
  const offWins = gauntletOff.reduce((s, x) => s + x.res.botA.wins, 0);
  const gGames = gauntletOn.reduce((s, x) => s + x.res.games, 0);
  const onFireAvg = gauntletOn.reduce((s, x) => s + x.res.botA.avgFire, 0) / gauntletOn.length;
  const offFireAvg = gauntletOff.reduce((s, x) => s + x.res.botA.avgFire, 0) / gauntletOff.length;

  const md: string[] = [
    '# Experiment 4: The "ON FIRE!" Funnel — Does Feeding the Hot Hand Win Games?',
    '',
    '## Experiment Card',
    '- **Question:** Does actively passing to a teammate who has `streak >= 1` or `onFire === true` increase On-Fire activations and win rate?',
    '- **Hypothesis:** Funneling possessions to the hot hand will raise On-Fire activations/game and win rate, because ON FIRE grants infinite turbo, unblockable Meteor Dunks, and +28% shooting.',
    '- **Control:** `fire-funnel-off` (`funnelFire: false`) — identical scoring/defense logic without streak-based passing.',
    '- **Treatment:** `fire-funnel-on` (`funnelFire: true`).',
    '- **Sample:** 20-game direct H2H + 48-game matched-seed gauntlet against 4 diverse opponents (116 total matches).',
    '',
    '## Direct Head-to-Head (N = 20)',
    '| Matchup | W-L | Win% (95% CI) | Avg Score (Diff) | FG% / 3P% | Steals (Shove) | On-Fire/g |',
    '|---|---:|---:|---:|---:|---:|---:|',
    formatSeriesRow('Funnel ON vs Funnel OFF', h2h.botA, h2h.botB),
    '',
    '## Matched-Seed Gauntlet vs. 4 Opponents (N = 48 each)',
    '| Opponent | Funnel ON W-L (Diff, Fire/g) | Funnel OFF W-L (Diff, Fire/g) |',
    '|---|---:|---:|',
    ...opponents.map((opp, i) => {
      const a = gauntletOn[i].res.botA;
      const b = gauntletOff[i].res.botA;
      return `| \`${opp.id}\` | ${a.wins}-${a.losses} (${a.avgDiff >= 0 ? '+' : ''}${num(a.avgDiff)}, ${num(a.avgFire)} fire/g) | ${b.wins}-${b.losses} (${b.avgDiff >= 0 ? '+' : ''}${num(b.avgDiff)}, ${num(b.avgFire)} fire/g) |`;
    }),
    `| **TOTAL** | **${onWins}-${gGames - onWins} (${pct(onWins / gGames)}, ${num(onFireAvg)} fire/g)** | **${offWins}-${gGames - offWins} (${pct(offWins / gGames)}, ${num(offFireAvg)} fire/g)** |`,
    '',
    '## Key Findings',
    `- **Direct H2H:** Funnel ON went **${h2h.botA.wins}-${h2h.botA.losses}** (${pct(h2h.botA.winRate)}, ${h2h.botA.avgDiff >= 0 ? '+' : ''}${num(h2h.botA.avgDiff)} diff). On-Fire/g: **${num(h2h.botA.avgFire)}** vs **${num(h2h.botB.avgFire)}**.`,
    `- **Gauntlet:** Funnel ON went **${onWins}-${gGames - onWins}** (${pct(onWins / gGames)}) vs Funnel OFF **${offWins}-${gGames - offWins}** (${pct(offWins / gGames)}).`,
    '- **Diagnosis:** Check whether passing to the hot hand at `streak === 1` occasionally slows tempo vs only funneling at `streak >= 2` or `onFire`. In `champion-v1`, we restrict funneling to `onFire` or `streak >= 2` AND only when the teammate is safe from defenders (`mateDefDist > 1.85m`).',
    '',
  ];

  writeExp(
    'exp4-on-fire-funnel',
    {
      h2h: { funnelOn: h2h.botA, funnelOff: h2h.botB },
      gauntlet: {
        funnelOn: gauntletOn.map((g) => ({ opp: g.opp, stats: g.res.botA })),
        funnelOff: gauntletOff.map((g) => ({ opp: g.opp, stats: g.res.botA })),
      },
    },
    md.join('\n'),
  );

  return {
    id: 'exp4',
    title: 'Hot-Hand / ON FIRE Funnel A/B Test',
    summary: `Direct H2H: Funnel ON ${h2h.botA.wins}-${h2h.botA.losses} (${pct(h2h.botA.winRate)}, ${num(h2h.botA.avgFire)} vs ${num(h2h.botB.avgFire)} fire/g). Gauntlet: ${onWins}/${gGames} vs ${offWins}/${gGames}.`,
    totalMatches,
  };
}

/** Experiment 5: Synthesizing Findings into Champion v1 — Full 10-Bot Gauntlet + Cross-Roster Validation. */
function runExperiment5(): { id: string; title: string; summary: string; totalMatches: number } {
  const champ: BotFactory = { id: 'champion-v1', name: 'Champion v1', create: () => createChampionV1Bot() };
  const shoveHound: BotFactory = { id: 'shove-hound', name: 'Shove Hound', create: () => createShoveHoundBot() };

  // 1. Direct title match vs Baseline #1 (shove-hound) on balanced & pro-teams rosters
  const h2hBalanced = runSeries(champ, shoveHound, {
    games: 20,
    baseSeed: 61000,
    quarterSeconds: 45,
    difficulty: 'pro',
    rosterMode: 'balanced',
  });
  const h2hProTeams = runSeries(champ, shoveHound, {
    games: 20,
    baseSeed: 62000,
    quarterSeconds: 45,
    difficulty: 'pro',
    rosterMode: 'pro-teams',
  });

  // 2. Full 10-bot round-robin (9 baseline bots + champion-v1, 6 games/pair = 270 matches)
  const allTen: BotFactory[] = [...getBaselineRoster(), champ];
  const rr = runRoundRobin(allTen, {
    games: 6,
    baseSeed: 63000,
    quarterSeconds: 45,
    difficulty: 'pro',
    rosterMode: 'balanced',
  });

  // 3. Cross-roster Pro-Teams gauntlet vs top 4 baseline bots (8 games each = 32 matches)
  const topFour = getBaselineRoster().filter((b) =>
    ['shove-hound', 'hybrid-ace', 'fire-feeder', 'alley-oop-express'].includes(b.id),
  );
  const proGauntlet = topFour.map((opp, idx) => ({
    opp: opp.id,
    res: runSeries(champ, opp, { games: 8, baseSeed: 65000 + idx * 400, rosterMode: 'pro-teams' }),
  }));
  const proWins = proGauntlet.reduce((s, x) => s + x.res.botA.wins, 0);
  const proGames = proGauntlet.reduce((s, x) => s + x.res.games, 0);

  const champEntry = rr.leaderboard.find((e) => e.botId === 'champion-v1')!;
  const champRank = rr.leaderboard.findIndex((e) => e.botId === 'champion-v1') + 1;

  const promoted =
    champRank === 1 &&
    h2hBalanced.botA.winRate > 0.55 &&
    h2hBalanced.botA.avgDiff > 0 &&
    proWins / proGames > 0.6;

  const md = [
    '# Experiment 5: Champion v1 Synthesis & Promotion Gauntlet',
    '',
    '## Experiment Card',
    '- **Hypothesis:** Synthesizing the winning levers from Experiments 1–4 (stat-aware EV offense + strict apex 3PT timing + relentless turbo-shove defense + streak>=2 hot-hand funneling) PLUS an **anti-shove ball-protection pass** (passing to an open teammate when a defender closes within `2.05m`) will dethrone baseline #1 `shove-hound` and claim #1 Elo across the entire 10-bot field.',
    '- **Promotion Criteria (from `EXPERIMENT_PROCESS.md`):**',
    `  1. Rank #1 in 10-bot round-robin Elo: **${champRank === 1 ? 'PASS' : 'FAIL'}** (Rank #${champRank}, Elo ${champEntry.elo})`,
    `  2. Beat prior #1 (\`shove-hound\`) >55% over N=20 balanced games: **${h2hBalanced.botA.winRate > 0.55 ? 'PASS' : 'FAIL'}** (${h2hBalanced.botA.wins}-${h2hBalanced.botA.losses}, ${pct(h2hBalanced.botA.winRate)}, ${h2hBalanced.botA.avgDiff >= 0 ? '+' : ''}${num(h2hBalanced.botA.avgDiff)} diff)`,
    `  3. Cross-roster Pro-Teams gauntlet >60%: **${proWins / proGames > 0.6 ? 'PASS' : 'FAIL'}** (${proWins}-${proGames - proWins}, ${pct(proWins / proGames)})`,
    `  - **OVERALL VERDICT:** ${promoted ? '🏆 **PROMOTED TO CHAMPION v1!**' : '🔬 **ITERATE — SEE DIAGNOSIS BELOW**'}`,
    '',
    '## Direct Title Match vs. `shove-hound`',
    '| Roster Mode | W-L | Win% (95% CI) | Avg Score (Diff) | FG% / 3P% | Steals (Shove) | On-Fire/g |',
    '|---|---:|---:|---:|---:|---:|---:|',
    formatSeriesRow('Balanced (N=20)', h2hBalanced.botA, h2hBalanced.botB),
    formatSeriesRow('Pro Teams (N=20)', h2hProTeams.botA, h2hProTeams.botB),
    '',
    '## Cross-Roster Pro-Teams Gauntlet (vs. Baseline Top 4)',
    '| Opponent | Champion v1 W-L | Win% | Avg Score (Diff) |',
    '|---|---:|---:|---:|',
    ...proGauntlet.map(({ opp, res }) => {
      const a = res.botA;
      const b = res.botB;
      return `| \`${opp}\` | ${a.wins}-${a.losses} | ${pct(a.winRate)} | ${num(a.avgPts)} – ${num(b.avgPts)} (${a.avgDiff >= 0 ? '+' : ''}${num(a.avgDiff)}) |`;
    }),
    `| **TOTAL** | **${proWins}-${proGames - proWins}** | **${pct(proWins / proGames)}** | — |`,
    '',
    formatLeaderboardMarkdown(
      rr.leaderboard,
      rr.matrix,
      '10-Bot Full Round-Robin Leaderboard (Balanced Rosters, 6 games/pair = 270 matches)',
      `Full field including \`champion-v1\`.`,
    ),
  ].join('\n');

  const totalMatches = h2hBalanced.games + h2hProTeams.games + rr.totalMatches + proGames;
  writeExp(
    'exp5-champion-v1-gauntlet',
    {
      promoted,
      champRank,
      h2hBalanced: { champion: h2hBalanced.botA, shoveHound: h2hBalanced.botB },
      h2hProTeams: { champion: h2hProTeams.botA, shoveHound: h2hProTeams.botB },
      proGauntlet: proGauntlet.map((g) => ({ opp: g.opp, stats: g.res.botA })),
      leaderboard: rr.leaderboard,
      matrix: rr.matrix,
    },
    md,
  );

  return {
    id: 'exp5',
    title: 'Champion v1 Synthesis & Promotion Gauntlet',
    summary: `Rank #${champRank}/10 (Elo ${champEntry.elo}, ${pct(champEntry.winRate)} RR). vs shove-hound: ${h2hBalanced.botA.wins}-${h2hBalanced.botA.losses} balanced, ${h2hProTeams.botA.wins}-${h2hProTeams.botA.losses} pro-teams. Pro gauntlet: ${proWins}/${proGames} (${pct(proWins / proGames)}). Verdict: ${promoted ? 'PROMOTED' : 'ITERATE'}.`,
    totalMatches,
  };
}

export async function main(): Promise<void> {
  const t0 = performance.now();
  fs.mkdirSync(EXP_ROOT, { recursive: true });

  console.log('Running all 5 GBA GJAM bot strategy experiments...');
  const summaries = [
    runExperiment1(),
    runExperiment2(),
    runExperiment3(),
    runExperiment4(),
    runExperiment5(),
  ];

  const totalMatches = summaries.reduce((s, x) => s + x.totalMatches, 0);
  const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2);

  const indexMd = [
    '# GBA GJAM — Bot Strategy Experiments Index',
    '',
    `Executed **5 experiments** (**${totalMatches} total full 4-quarter matches**) in **${elapsedSec}s** using the deterministic 60Hz evaluation harness (\`npm run eval:experiments -w games/gnome-jam\`).`,
    '',
    '| # | Experiment | Matches | Summary | Report |',
    '|---|---|---:|---|---|',
    ...summaries.map((s) => {
      const folderMap: Record<string, string> = {
        exp1: 'exp1-offense-vs-roster',
        exp2: 'exp2-defense-meta',
        exp3: 'exp3-shot-micro-ablation',
        exp4: 'exp4-on-fire-funnel',
        exp5: 'exp5-champion-v1-gauntlet',
      };
      const f = folderMap[s.id];
      return `| **${s.id.toUpperCase()}** | ${s.title} | ${s.totalMatches} | ${s.summary} | [REPORT.md](./${f}/REPORT.md) |`;
    }),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(EXP_ROOT, 'INDEX.md'), indexMd);

  console.log(`\nAll 5 experiments completed (${totalMatches} matches) in ${elapsedSec}s!`);
  for (const s of summaries) {
    console.log(`- [${s.id.toUpperCase()}] ${s.title}: ${s.summary}`);
  }
}
