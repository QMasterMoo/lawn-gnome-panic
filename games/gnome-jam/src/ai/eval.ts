import { JamSimulation, type SimCallbacks } from '../sim';
import { PRO_TEAMS } from '../teams';
import type { Difficulty, GnomePlayerProfile, MatchConfig, MatchResult, PlayerBoxScore } from '../types';
import { normalizeBotInput } from './snapshot';
import type { BotController, BotDecisionContext, BotInput, GameStateSnapshot } from './types';

/** Deterministic Mulberry32 PRNG for reproducible headless evaluations. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs fn with Math.random deterministically seeded, restoring it in finally. */
export function withSeededRandom<T>(seed: number, fn: () => T): T {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

/**
 * Evaluates a standalone JS bot script (from src/ai/scripts/*.js) synchronously
 * in Node/headless mode without needing browser Web Workers.
 */
export function createSyncScriptBot(code: string, id: string, name: string): BotController {
  const factory = new Function(
    'module',
    'exports',
    `"use strict";
${code}
if (typeof decide === 'function') return decide;
if (typeof module.exports === 'function') return module.exports;
if (module.exports && typeof module.exports.decide === 'function') return module.exports.decide;
throw new Error('Script must define function decide(state, ctx)');`,
  );
  const mod = { exports: {} as Record<string, unknown> };
  const decideFn = factory(mod, mod.exports) as (
    state: GameStateSnapshot,
    ctx: BotDecisionContext,
  ) => BotInput;

  return {
    id,
    name,
    decide(state, ctx) {
      return decideFn(state, ctx) || {};
    },
  };
}

export interface TeamTelemetry {
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  dunks: number;
  steals: number;
  blocks: number;
  rebounds: number;
  fireActivations: number;
  shotClockViolations: number;
  alleyOops: number;
  shoveTurnovers: number;
}

export interface MatchTelemetry {
  seed: number;
  homeBotId: string;
  awayBotId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  winner: 0 | 1;
  overtime: boolean;
  ticks: number;
  home: TeamTelemetry;
  away: TeamTelemetry;
}

export interface BotFactory {
  id: string;
  name: string;
  create: () => BotController;
}

export interface MatchOptions {
  homeBot: BotFactory;
  awayBot: BotFactory;
  homeRoster?: [GnomePlayerProfile, GnomePlayerProfile];
  awayRoster?: [GnomePlayerProfile, GnomePlayerProfile];
  homeTeamId?: string;
  awayTeamId?: string;
  difficulty?: Difficulty;
  quarterSeconds?: number;
  dt?: number;
  seed?: number;
}

/** Standardized mirrored balanced roster (70/70/70/70 + 80/80/60/60) for fair strategy comparisons. */
export function makeBalancedRoster(prefix = 'bal'): [GnomePlayerProfile, GnomePlayerProfile] {
  const baseA = PRO_TEAMS[0].roster[2]; // 70/70/70/70
  const baseB = PRO_TEAMS[0].roster[1]; // 90/80/50/60
  return [
    { ...baseA, id: `${prefix}-a`, name: `${prefix.toUpperCase()} All-Rounder`, stats: { speed: 75, threePt: 75, dunk: 75, defense: 75 } },
    { ...baseB, id: `${prefix}-b`, name: `${prefix.toUpperCase()} Wing`, stats: { speed: 80, threePt: 80, dunk: 70, defense: 70 } },
  ];
}

/** Roster specialized in 3-point shooting (90 threePt, 50 dunk). */
export function makeShooterRoster(prefix = 'sht'): [GnomePlayerProfile, GnomePlayerProfile] {
  const baseA = PRO_TEAMS[1].roster[0];
  const baseB = PRO_TEAMS[4].roster[0];
  return [
    { ...baseA, id: `${prefix}-a`, name: `${prefix.toUpperCase()} Sniper 1`, stats: { speed: 80, threePt: 90, dunk: 50, defense: 60 } },
    { ...baseB, id: `${prefix}-b`, name: `${prefix.toUpperCase()} Sniper 2`, stats: { speed: 80, threePt: 90, dunk: 50, defense: 60 } },
  ];
}

/** Roster specialized in dunking & defense (90 dunk, 45 threePt). */
export function makeDunkerRoster(prefix = 'dnk'): [GnomePlayerProfile, GnomePlayerProfile] {
  const baseA = PRO_TEAMS[0].roster[0];
  const baseB = PRO_TEAMS[1].roster[1];
  return [
    { ...baseA, id: `${prefix}-a`, name: `${prefix.toUpperCase()} Slasher 1`, stats: { speed: 75, threePt: 45, dunk: 90, defense: 80 } },
    { ...baseB, id: `${prefix}-b`, name: `${prefix.toUpperCase()} Slasher 2`, stats: { speed: 75, threePt: 45, dunk: 90, defense: 80 } },
  ];
}

function sumTeamBox(
  box: PlayerBoxScore[],
  team: 0 | 1,
  extras: {
    fireActivations: number;
    shotClockViolations: number;
    alleyOops: number;
    shoveTurnovers: number;
  },
): TeamTelemetry {
  const t: TeamTelemetry = {
    pts: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    dunks: 0,
    steals: 0,
    blocks: 0,
    rebounds: 0,
    ...extras,
  };
  for (const b of box) {
    if (b.team !== team) continue;
    t.pts += b.pts;
    t.fgm += b.fgm;
    t.fga += b.fga;
    t.tpm += b.tpm;
    t.tpa += b.tpa;
    t.dunks += b.dunks;
    t.steals += b.steals;
    t.blocks += b.blocks;
    t.rebounds += b.rebounds;
  }
  return t;
}

/** Runs a single complete 4-quarter (+OT) headless match at 60Hz. */
export function simulateMatch(opts: MatchOptions): MatchTelemetry {
  const seed = opts.seed ?? 1337;
  const dt = opts.dt ?? 1 / 60;
  const quarterSeconds = opts.quarterSeconds ?? 45;
  const difficulty = opts.difficulty ?? 'pro';
  const homeRoster = opts.homeRoster ?? makeBalancedRoster('home');
  const awayRoster = opts.awayRoster ?? makeBalancedRoster('away');

  return withSeededRandom(seed, () => {
    const fireActivations: [number, number] = [0, 0];
    const shotClockViolations: [number, number] = [0, 0];
    const alleyOops: [number, number] = [0, 0];
    const shoveTurnovers: [number, number] = [0, 0];
    let matchResult: MatchResult | null = null;
    let simRef: JamSimulation | null = null;

    const cb: SimCallbacks = {
      onAnnounce: (ev) => {
        if (!simRef) return;
        const lastTeam = simRef.ball.lastTouchTeam;
        if (ev.text === "HE'S ON FIRE!!") {
          // Scorer's team is the opposite of inboundTeam (or lastTouchTeam)
          const scorerTeam = simRef.players.find((p) => p.onFire && ev.subtext?.includes(p.profile.name))?.team ?? lastTeam;
          fireActivations[scorerTeam]++;
        } else if (ev.text === 'SHOT CLOCK VIOLATION!') {
          shotClockViolations[lastTeam]++;
        } else if (ev.text === 'ALLEY-OOP!') {
          alleyOops[lastTeam]++;
        } else if (ev.text === 'CRUNCHING SHOVE!') {
          // Ball was just given to the shover, so lastTouchTeam is the shover's team
          shoveTurnovers[lastTeam]++;
        }
      },
      onSound: () => {},
      onRimShake: () => {},
      onCameraPunch: () => {},
      onBurst: () => {},
      onAchievement: () => {},
      onMatchEnd: (res) => {
        matchResult = res;
      },
    };

    const config: MatchConfig = {
      homeTeamId: opts.homeTeamId ?? 'mossbottom',
      awayTeamId: opts.awayTeamId ?? 'redcap',
      homeRoster,
      awayRoster,
      opponentMode: 'botvsbot',
      difficulty,
      quarterSeconds,
    };

    const sim = new JamSimulation(config, cb);
    simRef = sim;
    sim.setBot(0, opts.homeBot.create());
    sim.setBot(1, opts.homeBot.create());
    sim.setBot(2, opts.awayBot.create());
    sim.setBot(3, opts.awayBot.create());

    const idle = normalizeBotInput(null);
    const maxTicks = Math.ceil((quarterSeconds * 4 + 180) / dt); // safety cap including multi-OT
    let ticks = 0;
    while (sim.phase !== 'finished' && ticks < maxTicks) {
      sim.step(dt, idle, idle);
      ticks++;
    }

    const box = matchResult ? (matchResult as MatchResult).boxScore : sim.players.map((p) => ({ ...p.box }));
    const homeScore = sim.score[0];
    const awayScore = sim.score[1];
    const winner: 0 | 1 = homeScore >= awayScore ? 0 : 1;

    const telemetry: MatchTelemetry = {
      seed,
      homeBotId: opts.homeBot.id,
      awayBotId: opts.awayBot.id,
      homeTeamId: config.homeTeamId,
      awayTeamId: config.awayTeamId,
      homeScore,
      awayScore,
      winner,
      overtime: sim.quarter > 4,
      ticks,
      home: sumTeamBox(box, 0, {
        fireActivations: fireActivations[0],
        shotClockViolations: shotClockViolations[0],
        alleyOops: alleyOops[0],
        shoveTurnovers: shoveTurnovers[0],
      }),
      away: sumTeamBox(box, 1, {
        fireActivations: fireActivations[1],
        shotClockViolations: shotClockViolations[1],
        alleyOops: alleyOops[1],
        shoveTurnovers: shoveTurnovers[1],
      }),
    };

    sim.dispose();
    return telemetry;
  });
}

export interface AggregateBotStats {
  botId: string;
  botName: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  winRateCI95: [number, number];
  avgPts: number;
  avgOppPts: number;
  avgDiff: number;
  fgPct: number;
  tpPct: number;
  avgFga: number;
  avgTpa: number;
  avgDunks: number;
  avgSteals: number;
  avgBlocks: number;
  avgRebounds: number;
  avgFire: number;
  avgAlleyOops: number;
  avgShoveTurnovers: number;
  avgShotClockViolations: number;
}

/** 95% Wilson score interval for a binomial proportion. */
export function wilsonCI95(wins: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export interface SeriesOptions {
  games?: number;
  baseSeed?: number;
  quarterSeconds?: number;
  difficulty?: Difficulty;
  rosterMode?: 'balanced' | 'shooter' | 'dunker' | 'pro-teams';
}

export interface SeriesResult {
  botA: AggregateBotStats;
  botB: AggregateBotStats;
  games: number;
  matches: MatchTelemetry[];
}

function pickRoster(mode: SeriesOptions['rosterMode'], gameIdx: number, side: 'home' | 'away'): [GnomePlayerProfile, GnomePlayerProfile] {
  if (mode === 'shooter') return makeShooterRoster(side);
  if (mode === 'dunker') return makeDunkerRoster(side);
  if (mode === 'pro-teams') {
    const teamA = PRO_TEAMS[gameIdx % PRO_TEAMS.length];
    const teamB = PRO_TEAMS[(gameIdx + 3) % PRO_TEAMS.length];
    const t = side === 'home' ? teamA : teamB;
    return [t.roster[0], t.roster[1]];
  }
  return makeBalancedRoster(side);
}

function aggregateForBot(
  botId: string,
  botName: string,
  matches: MatchTelemetry[],
): AggregateBotStats {
  let games = 0;
  let wins = 0;
  let pts = 0;
  let oppPts = 0;
  let fgm = 0;
  let fga = 0;
  let tpm = 0;
  let tpa = 0;
  let dunks = 0;
  let steals = 0;
  let blocks = 0;
  let rebounds = 0;
  let fire = 0;
  let oops = 0;
  let shoves = 0;
  let scv = 0;

  for (const m of matches) {
    const isHome = m.homeBotId === botId;
    const isAway = m.awayBotId === botId;
    if (!isHome && !isAway) continue;
    // Handle mirror match (if ever called) by skipping double-count
    const mine = isHome ? m.home : m.away;
    const theirs = isHome ? m.away : m.home;
    games++;
    if ((isHome && m.winner === 0) || (!isHome && m.winner === 1)) wins++;
    pts += mine.pts;
    oppPts += theirs.pts;
    fgm += mine.fgm;
    fga += mine.fga;
    tpm += mine.tpm;
    tpa += mine.tpa;
    dunks += mine.dunks;
    steals += mine.steals;
    blocks += mine.blocks;
    rebounds += mine.rebounds;
    fire += mine.fireActivations;
    oops += mine.alleyOops;
    shoves += mine.shoveTurnovers;
    scv += mine.shotClockViolations;
  }

  const g = Math.max(1, games);
  return {
    botId,
    botName,
    games,
    wins,
    losses: games - wins,
    winRate: games > 0 ? wins / games : 0,
    winRateCI95: wilsonCI95(wins, games),
    avgPts: pts / g,
    avgOppPts: oppPts / g,
    avgDiff: (pts - oppPts) / g,
    fgPct: fga > 0 ? fgm / fga : 0,
    tpPct: tpa > 0 ? tpm / tpa : 0,
    avgFga: fga / g,
    avgTpa: tpa / g,
    avgDunks: dunks / g,
    avgSteals: steals / g,
    avgBlocks: blocks / g,
    avgRebounds: rebounds / g,
    avgFire: fire / g,
    avgAlleyOops: oops / g,
    avgShoveTurnovers: shoves / g,
    avgShotClockViolations: scv / g,
  };
}

/** Runs a side-swapped head-to-head series between botA and botB. */
export function runSeries(
  botA: BotFactory,
  botB: BotFactory,
  opts: SeriesOptions = {},
): SeriesResult {
  const games = opts.games ?? 10;
  const baseSeed = opts.baseSeed ?? 1000;
  const quarterSeconds = opts.quarterSeconds ?? 45;
  const difficulty = opts.difficulty ?? 'pro';
  const rosterMode = opts.rosterMode ?? 'balanced';

  const matches: MatchTelemetry[] = [];
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1;
    const homeBot = swap ? botB : botA;
    const awayBot = swap ? botA : botB;
    const pairIdx = Math.floor(i / 2);
    const r0 = pickRoster(rosterMode, pairIdx, 'home');
    const r1 = pickRoster(rosterMode, pairIdx, 'away');
    const homeRoster = swap ? r1 : r0;
    const awayRoster = swap ? r0 : r1;

    matches.push(
      simulateMatch({
        homeBot,
        awayBot,
        homeRoster,
        awayRoster,
        difficulty,
        quarterSeconds,
        seed: baseSeed + i * 97,
      }),
    );
  }

  return {
    botA: aggregateForBot(botA.id, botA.name, matches),
    botB: aggregateForBot(botB.id, botB.name, matches),
    games,
    matches,
  };
}

export interface LeaderboardEntry extends AggregateBotStats {
  elo: number;
}

export interface RoundRobinResult {
  leaderboard: LeaderboardEntry[];
  matrix: Record<string, Record<string, { wins: number; games: number; avgDiff: number }>>;
  totalMatches: number;
  matches: MatchTelemetry[];
}

/** Runs a full side-swapped round-robin tournament and computes converged Elo ratings. */
export function runRoundRobin(
  bots: BotFactory[],
  opts: SeriesOptions = {},
): RoundRobinResult {
  const gamesPerPair = opts.games ?? 6;
  const baseSeed = opts.baseSeed ?? 2000;
  const allMatches: MatchTelemetry[] = [];
  const matrix: RoundRobinResult['matrix'] = {};

  for (const b of bots) {
    matrix[b.id] = {};
  }

  let pairCounter = 0;
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const a = bots[i];
      const b = bots[j];
      const res = runSeries(a, b, {
        ...opts,
        games: gamesPerPair,
        baseSeed: baseSeed + pairCounter * 1009,
      });
      pairCounter++;
      allMatches.push(...res.matches);

      matrix[a.id][b.id] = {
        wins: res.botA.wins,
        games: res.games,
        avgDiff: res.botA.avgDiff,
      };
      matrix[b.id][a.id] = {
        wins: res.botB.wins,
        games: res.games,
        avgDiff: res.botB.avgDiff,
      };
    }
  }

  // Compute converged Elo ratings (50 passes over all matches so order doesn't bias ratings)
  const elo: Record<string, number> = {};
  for (const b of bots) elo[b.id] = 1500;
  const K = 16;
  for (let pass = 0; pass < 50; pass++) {
    for (const m of allMatches) {
      const rH = elo[m.homeBotId];
      const rA = elo[m.awayBotId];
      const expH = 1 / (1 + Math.pow(10, (rA - rH) / 400));
      const scoreH = m.winner === 0 ? 1 : 0;
      elo[m.homeBotId] = rH + K * (scoreH - expH);
      elo[m.awayBotId] = rA + K * ((1 - scoreH) - (1 - expH));
    }
  }

  const leaderboard: LeaderboardEntry[] = bots
    .map((b) => ({
      ...aggregateForBot(b.id, b.name, allMatches),
      elo: Math.round(elo[b.id]),
    }))
    .sort((x, y) => y.elo - x.elo || y.winRate - x.winRate || y.avgDiff - x.avgDiff);

  return {
    leaderboard,
    matrix,
    totalMatches: allMatches.length,
    matches: allMatches,
  };
}
