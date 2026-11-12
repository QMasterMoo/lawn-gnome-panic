// Wire protocol for online battle royale. Shared by the browser client and the Node server
// (games/sample-3d/server), so this file imports nothing.
//
// Shape: the server does matchmaking and relays messages; it does not simulate the game.
// One player's browser per match is the HOST and runs the world (mowers, bots, zone clock).
// Everyone runs their own gnome and weapons and reports hits on mowers to the host.
// All messages are JSON text frames.

export const PROTOCOL_VERSION = 1;

/** Gnomes per match; empty slots are filled with bots by the host. */
export const MAX_PLAYERS = 20;
/** A public match starts this long after its first player queued, or as soon as it is full. */
export const PUBLIC_FILL_WAIT_S = 15;
/** A private (room code) match waits longer, so friends have time to type the code. */
export const PRIVATE_FILL_WAIT_S = 45;
/** How often clients send 'me' and the host sends 'snap'. */
export const NET_SEND_HZ = 15;
/** Room codes: 4-8 characters of A-Z and 0-9 (the client upper-cases input). */
export const ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;

export interface PlayerInfo {
  id: number;        // assigned by the server, unique while it runs
  name: string;      // gamertag, at most 18 characters
  character: string; // CharacterId ('gnorman' | 'gnancy'); unknown values render as gnorman
}

// ---------------------------------------------------------------- client -> server
export type ClientMsg =
  | { t: 'hello'; v: number; name: string; character: string }
  /** Join matchmaking. code null = public queue; else a private room code matching ROOM_CODE_RE. character replaces hello's. */
  | { t: 'queue'; code: string | null; character: string }
  /** Leave the queue or the current match. */
  | { t: 'leave' }
  /** Forward d to one player of my match (to = their id) or to every other player (to = null). */
  | { t: 'relay'; to: number | null; d: GameMsg };

// ---------------------------------------------------------------- server -> client
export type ServerMsg =
  | { t: 'welcome'; id: number }
  /** Sent on queue and whenever the waiting group changes, and once a second while waiting. */
  | { t: 'queued'; code: string | null; players: number; startsInS: number }
  /** The match starts now. players includes you; hostId is one of them. */
  | { t: 'match'; matchId: string; seed: number; hostId: number; you: number; players: PlayerInfo[] }
  | { t: 'relay'; from: number; d: GameMsg }
  /** A player left the match (closed the tab or sent leave). */
  | { t: 'left'; id: number }
  /** Your match or queue is over: the host left, or the server is restarting for an update. */
  | { t: 'ended'; reason: string }
  | { t: 'error'; message: string };

// ---------------------------------------------------------------- game messages (opaque to the server)
/** [id, tier, x, y, z, heading, hp, maxHp]. Numbers rounded to 2 decimals. tier is a MowerTier string. */
export type MowerSnap = [number, string, number, number, number, number, number, number];
/** [botId, name, x, y, z, alive 1|0]. Bots only; humans send their own 'me'. */
export type BotSnap = [number, string, number, number, number, 0 | 1];
/** [x, z, tier, by]: a mower died. by = id of the player whose hit killed it, -1 for a bot or unknown. */
export type KillSnap = [number, number, string, number];

export type GameMsg =
  /** Host -> all, NET_SEND_HZ. t = match clock (s). kills and feed hold only what happened since the last snap. */
  | {
      k: 'snap'; t: number; mowers: MowerSnap[]; bots: BotSnap[]; kills: KillSnap[];
      feed: { victim: string; cause: string }[]; alive: number; total: number;
    }
  /** Every player -> all, NET_SEND_HZ: where my gnome is. */
  | { k: 'me'; x: number; y: number; z: number; facing: number; alive: boolean }
  /** Client -> host, at most NET_SEND_HZ: my weapons' hits since the last send. Each is [mowerId, damage, slowFactor, slowSeconds]; slowSeconds 0 = no slow. */
  | { k: 'hits'; list: [number, number, number, number][] }
  /** Client -> host: I died. cause is a KillEvent cause string. */
  | { k: 'died'; cause: string }
  /** Host -> all: the match is over. winner = player id, or -1 when a bot won. */
  | { k: 'over'; winner: number; winnerName: string };
