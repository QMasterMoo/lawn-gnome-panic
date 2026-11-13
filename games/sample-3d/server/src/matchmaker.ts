// Matchmaking and relay logic. No sockets and no timers here, so it can be tested directly:
// index.ts owns the sockets and calls tick() once a second.
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, PROTOCOL_VERSION, ROOM_CODE_RE } from '../../src/net/protocol';
import type { GameMsg, PlayerInfo, ServerMsg } from '../../src/net/protocol';
import { checkName } from '../../src/net/textFilter';

export interface Conn { readonly id: number; send(msg: ServerMsg): void; close(): void }
export interface MatchmakerOptions { publicWaitS: number; privateWaitS: number; now: () => number /* ms */; random: () => number }

const MATCH_MAX_MS = 30 * 60 * 1000;

interface Player {
  id: number;
  conn: Conn;
  hello: boolean;
  name: string;
  character: string;
  group: string | null; // key of the waiting group, or null
  match: string | null; // matchId, or null
}

interface Group {
  key: string;          // '' for the public queue, else the room code
  code: string | null;  // null = public
  firstAt: number;      // ms
  members: number[];    // player ids in join order
}

interface Match {
  id: string;
  hostId: number;
  startedAt: number;    // ms
  members: number[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanCharacter(raw: unknown): string {
  return typeof raw === 'string' ? Array.from(raw).slice(0, 16).join('') : 'gnorman';
}

export class Matchmaker {
  private readonly opts: MatchmakerOptions;
  private readonly players = new Map<number, Player>();
  private readonly groups = new Map<string, Group>();
  private readonly matches = new Map<string, Match>();
  private draining = false;

  constructor(opts: MatchmakerOptions) {
    this.opts = opts;
  }

  connect(conn: Conn): void {
    this.players.set(conn.id, {
      id: conn.id, conn, hello: false, name: '', character: 'gnorman', group: null, match: null,
    });
  }

  handle(conn: Conn, msg: unknown): void {
    const p = this.players.get(conn.id);
    if (!p || !isObj(msg) || typeof msg.t !== 'string') return;
    if (!p.hello) {
      if (msg.t === 'hello') this.hello(p, msg);
      return;
    }
    switch (msg.t) {
      case 'queue': this.queue(p, msg); break;
      case 'leave': this.leave(p); break;
      case 'relay': this.relay(p, msg); break;
    }
  }

  disconnect(conn: Conn): void {
    const p = this.players.get(conn.id);
    if (!p) return;
    this.leave(p);
    this.players.delete(conn.id);
  }

  tick(): void {
    const now = this.opts.now();
    for (const g of [...this.groups.values()]) {
      if (g.members.length < MIN_PLAYERS) {
        // A lone player keeps waiting; the countdown restarts when the second player arrives.
        g.firstAt = now;
        this.sendQueued(g);
      } else if (now - g.firstAt >= this.waitS(g) * 1000) this.start(g);
      else this.sendQueued(g);
    }
    for (const m of [...this.matches.values()]) {
      if (now - m.startedAt <= MATCH_MAX_MS) continue;
      for (const id of m.members) {
        const p = this.players.get(id);
        if (p && p.match === m.id) p.match = null;
        this.sendTo(id, { t: 'ended', reason: 'This match ran for 30 minutes. That is enough lawn.' });
      }
      this.matches.delete(m.id);
    }
  }

  drain(): void {
    this.draining = true;
    for (const g of this.groups.values()) {
      for (const id of g.members) {
        const p = this.players.get(id);
        if (p) p.group = null;
        this.sendTo(id, { t: 'ended', reason: 'The server is restarting for an update. Press PLAY again.' });
      }
    }
    this.groups.clear();
  }

  stats(): { players: number; queued: number; matches: number; draining: boolean } {
    let players = 0;
    for (const p of this.players.values()) if (p.hello) players++;
    let queued = 0;
    for (const g of this.groups.values()) queued += g.members.length;
    return { players, queued, matches: this.matches.size, draining: this.draining };
  }

  // ---------------------------------------------------------------- messages

  private hello(p: Player, msg: Record<string, unknown>): void {
    if (msg.v !== PROTOCOL_VERSION) {
      p.conn.send({ t: 'error', message: 'Your game is out of date. Refresh the page.' });
      p.conn.close();
      return;
    }
    p.hello = true;
    const c = checkName(msg.name);
    p.name = c.ok ? c.name : `Gnome${p.id}`;
    p.character = cleanCharacter(msg.character);
    p.conn.send({ t: 'welcome', id: p.id });
  }

  private queue(p: Player, msg: Record<string, unknown>): void {
    p.character = cleanCharacter(msg.character);
    if (this.draining) {
      p.conn.send({ t: 'error', message: 'The server is restarting for an update. Try again in a few seconds.' });
      return;
    }
    let code: string | null;
    if (msg.code === null) code = null;
    else if (typeof msg.code === 'string' && ROOM_CODE_RE.test(msg.code)) code = msg.code;
    else {
      p.conn.send({ t: 'error', message: 'Room codes are 4-8 letters or digits.' });
      return;
    }
    const c = checkName(msg.name);
    if (!c.ok) {
      p.conn.send({ t: 'error', message: c.reason, code: 'bad-name' });
      return;
    }
    p.name = c.name;

    this.leave(p);
    const key = code ?? '';
    let group = this.groups.get(key);
    if (!group) {
      group = { key, code, firstAt: this.opts.now(), members: [] };
      this.groups.set(key, group);
    }
    group.members.push(p.id);
    p.group = key;
    if (group.members.length === MIN_PLAYERS) group.firstAt = this.opts.now();
    if (group.members.length >= MAX_PLAYERS) this.start(group);
    else this.sendQueued(group);
  }

  private relay(p: Player, msg: Record<string, unknown>): void {
    if (p.match === null) return;
    const m = this.matches.get(p.match);
    if (!m) return;
    const to = msg.to;
    if (!(to === null || typeof to === 'number') || !isObj(msg.d)) return;
    const d = msg.d as GameMsg;
    if (to === null) {
      for (const id of m.members) if (id !== p.id) this.sendTo(id, { t: 'relay', from: p.id, d });
    } else if (m.members.includes(to)) {
      this.sendTo(to, { t: 'relay', from: p.id, d });
    }
  }

  // ---------------------------------------------------------------- state changes

  /** Removes p from its queue or match (same as the 'leave' message). */
  private leave(p: Player): void {
    if (p.group !== null) {
      const g = this.groups.get(p.group);
      p.group = null;
      if (g) {
        g.members = g.members.filter((id) => id !== p.id);
        if (g.members.length === 0) this.groups.delete(g.key);
        else this.sendQueued(g);
      }
    }
    if (p.match !== null) {
      const m = this.matches.get(p.match);
      p.match = null;
      if (m) {
        m.members = m.members.filter((id) => id !== p.id);
        if (m.hostId === p.id) {
          for (const id of m.members) {
            const o = this.players.get(id);
            if (o) o.match = null;
            this.sendTo(id, { t: 'ended', reason: 'THE HOST LEFT (rude)' });
          }
          m.members = [];
          this.matches.delete(m.id);
        } else {
          for (const id of m.members) this.sendTo(id, { t: 'left', id: p.id });
          if (m.members.length === 0) this.matches.delete(m.id);
        }
      }
    }
  }

  private start(g: Group): void {
    if (g.members.length < MIN_PLAYERS) return;
    this.groups.delete(g.key);
    const now = this.opts.now();
    const matchId = Array.from({ length: 8 }, () => Math.floor(this.opts.random() * 16).toString(16)).join('');
    const seed = Math.floor(this.opts.random() * 4294967296);
    const hostId = g.members[0];
    // Fisher-Yates shuffle of the palette: each player of the match gets a different colour.
    const palette = [...PLAYER_COLORS];
    for (let i = palette.length - 1; i > 0; i--) {
      const j = Math.floor(this.opts.random() * (i + 1));
      [palette[i], palette[j]] = [palette[j], palette[i]];
    }
    const infos: PlayerInfo[] = [];
    g.members.forEach((id, i) => {
      const p = this.players.get(id);
      if (p) infos.push({ id, name: p.name, character: p.character, color: palette[i % palette.length] });
    });
    this.matches.set(matchId, { id: matchId, hostId, startedAt: now, members: [...g.members] });
    for (const id of g.members) {
      const p = this.players.get(id);
      if (!p) continue;
      p.group = null;
      p.match = matchId;
      p.conn.send({ t: 'match', matchId, seed, hostId, you: id, players: infos });
    }
  }

  // ---------------------------------------------------------------- helpers

  private waitS(g: Group): number {
    return g.code === null ? this.opts.publicWaitS : this.opts.privateWaitS;
  }

  private sendQueued(g: Group): void {
    const elapsedS = (this.opts.now() - g.firstAt) / 1000;
    const startsInS = Math.max(0, Math.ceil(this.waitS(g) - elapsedS));
    for (const id of g.members) {
      this.sendTo(id, { t: 'queued', code: g.code, players: g.members.length, startsInS });
    }
  }

  private sendTo(id: number, msg: ServerMsg): void {
    this.players.get(id)?.conn.send(msg);
  }
}
