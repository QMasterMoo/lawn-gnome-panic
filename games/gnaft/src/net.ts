// Co-op networking: joins a shared raft over the matchmaking server (room code) and keeps the world in sync.
// The first player in a room hosts (runs the world); later players are guests. See docs/roadmaps/gnaft/epic5-01-net.md.
import * as THREE from 'three';
import {
  CHARACTERS, COOP, RAFT_TOP, TILE_SIZE, TOOLS,
  type Ctx, type CoopPlayer, type CoopState, type GnomeModel, type MowerModel, type PlayerState, type System, type Tile, type ToolId,
} from './config';
import { createGnomeModel } from './gnome';
import { createMowerModel } from './mowerModels';
import { drawLine, HAND_HEIGHT, LINE_POINTS } from './fishing';
import { RIDING_SEAT_Y } from './player';
import { startAudio } from './audio';
import { applyNetAction, applyWorld, netHook, nightAmount, notify, snapshotWorld, type NetAction, type WorldSnap } from './rules';
import { createNetClient, serverUrl, type NetClient } from '@lawn/mp/client';
import type { PlayerInfo, ServerMsg } from '@lawn/mp/protocol';

/** Relay payloads between the players of one raft. */
type CoopMsg =
  | { k: 'snap'; w: WorldSnap; acks: Record<string, number> } // host -> all, COOP.snapHz; acks[playerId] = last action seq applied
  // everyone -> all, COOP.meHz: my gnome, equipped tool, fishing hook ([x, y, z] or 0) and the debris ids on it
  | { k: 'me'; x: number; y: number; z: number; f: number; sw: 0 | 1; tl: ToolId; h: [number, number, number] | 0; sn: number[] }
  | { k: 'act'; seq: number; a: NetAction };                   // guest -> host, one per action

/** How fast a puppet catches up with its latest 'me' target (1/s, exponential). */
const PUPPET_RATE = 12;
/** Speed below which a puppet counts as standing still (m/s), so the walk cycle stops. */
const STILL_SPEED = 0.15;
/** Name label height above the feet (m). */
const LABEL_HEIGHT = 2.0;

interface Puppet {
  model: GnomeModel;
  sprite: THREE.Sprite;
  tex: THREE.CanvasTexture;
  mat: THREE.SpriteMaterial;
  fake: PlayerState;
  /** Latest 'me' target; null until the first 'me' arrives (the puppet stays hidden until then). */
  target: THREE.Vector3 | null;
  targetFacing: number;
  targetSwim: boolean;
  /** Their equipped tool and its model (null for hands). */
  tool: ToolId;
  mower: MowerModel | null;
  /** Their fishing hook: latest target (null when not out), the eased position, bobber and line. */
  hookTarget: THREE.Vector3 | null;
  hookPos: THREE.Vector3;
  bobber: THREE.Mesh;
  line: THREE.Line;
  linePos: THREE.BufferAttribute;
  /** Debris ids on their hook. */
  snags: number[];
}

const bobberGeo = new THREE.SphereGeometry(0.12, 10, 8);
const bobberMat = new THREE.MeshStandardMaterial({ color: 0xd93636, roughness: 0.5 });
const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Shortest signed angle, wrapped to [-PI, PI]. */
function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Multiplies each RGB channel of a 0xRRGGBB colour by k. */
function shade(c: number, k: number): number {
  const r = Math.round(((c >> 16) & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round((c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

/** A name over a dark translucent rounded box, drawn in the player's colour. */
function makeLabel(name: string, color: number): { sprite: THREE.Sprite; tex: THREE.CanvasTexture; mat: THREE.SpriteMaterial } {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    const x = 8, y = 16, w = 496, h = 96, r = 28;
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
    g.fillStyle = 'rgba(10, 14, 20, 0.6)';
    g.fill();
    g.font = 'bold 52px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    g.fillText(name.slice(0, 16), 256, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  return { sprite, tex, mat };
}

export function createNet(ctx: Ctx): System {
  const { scene, state } = ctx;

  /** The live connection, or null. Callbacks ignore any client that is no longer `link`. */
  let link: NetClient<CoopMsg> | null = null;
  /** True once the queue request was sent on the current connection. */
  let queued = false;
  /** My player id in the current match, or -1. */
  let me = -1;
  let hostId = -1;
  /** Everyone in the raft, me included, as the server reported it. */
  let roster: PlayerInfo[] = [];
  /** Guest: number of my last action. Host: acks[playerId] = last action seq applied. */
  let seq = 0;
  let lastActAt = 0;
  let acks: Record<string, number> = {};
  /** Guest: the first snapshot has put my gnome on the raft. */
  let placed = false;
  let meAcc = 0;
  let snapAcc = 0;
  const puppets = new Map<number, Puppet>();
  const scratch = new THREE.Vector3();

  function setStatus(status: CoopState['status'], message: string): void {
    state.coop.status = status;
    state.coop.message = message;
  }

  // ------------------------------------------------------------ puppets

  function addPuppet(p: PlayerInfo): void {
    if (puppets.has(p.id)) return;
    const model = createGnomeModel({ ...CHARACTERS.gnorman.look, hat: p.color, shirt: shade(p.color, 0.6) });
    model.object.visible = false;
    scene.add(model.object);
    const { sprite, tex, mat } = makeLabel(p.name, p.color);
    sprite.visible = false;
    scene.add(sprite);
    const bobber = new THREE.Mesh(bobberGeo, bobberMat);
    bobber.visible = false;
    scene.add(bobber);
    const linePos = new THREE.BufferAttribute(new Float32Array(LINE_POINTS * 3), 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', linePos);
    const line = new THREE.Line(lineGeo, lineMat);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    puppets.set(p.id, {
      tool: 'hands',
      mower: null,
      hookTarget: null,
      hookPos: new THREE.Vector3(),
      bobber,
      line,
      linePos,
      snags: [],
      model, sprite, tex, mat,
      fake: {
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        facing: 0,
        grounded: true,
        jumpsUsed: 0,
        swimming: false,
      },
      target: null,
      targetFacing: 0,
      targetSwim: false,
    });
  }

  function removePuppet(id: number): void {
    const pu = puppets.get(id);
    if (!pu) return;
    scene.remove(pu.model.object, pu.sprite, pu.bobber, pu.line);
    if (pu.mower) scene.remove(pu.mower.group);
    pu.line.geometry.dispose();
    pu.tex.dispose();
    pu.mat.dispose();
    puppets.delete(id);
  }

  /** Makes the puppets match the roster (everyone except me). */
  function syncPuppets(): void {
    const keep = new Set(roster.filter((p) => p.id !== me).map((p) => p.id));
    for (const id of [...puppets.keys()]) if (!keep.has(id)) removePuppet(id);
    for (const p of roster) if (p.id !== me) addPuppet(p);
  }

  /** Rebuilds state.coop.players from the roster and re-syncs the puppets. */
  function refresh(): void {
    state.coop.players = roster.map((p): CoopPlayer => ({
      id: p.id, name: p.name, color: p.color, host: p.id === hostId, me: p.id === me,
    }));
    syncPuppets();
  }

  function movePuppets(dt: number): void {
    if (dt <= 0) return;
    const k = 1 - Math.exp(-PUPPET_RATE * dt);
    for (const pu of puppets.values()) {
      if (!pu.target) continue;
      const p = pu.fake;
      scratch.copy(p.position);
      p.position.lerp(pu.target, k);
      p.velocity.subVectors(p.position, scratch).divideScalar(dt);
      if (Math.hypot(p.velocity.x, p.velocity.z) < STILL_SPEED) p.velocity.set(0, 0, 0);
      p.grounded = true;
      p.jumpsUsed = 0;
      p.swimming = pu.targetSwim;
      p.facing += wrapAngle(pu.targetFacing - p.facing) * k;
      pu.model.update(p, dt);
      if (pu.tool === 'riding' && !p.swimming) pu.model.object.position.y += RIDING_SEAT_Y;
      pu.sprite.position.set(p.position.x, p.position.y + LABEL_HEIGHT, p.position.z);
      poseMower(pu, dt);
      poseHook(pu, k);
    }
  }

  /** Shows their equipped mower in front of them (or under them, for the riding mower), like mowing.ts does for me. */
  function poseMower(pu: Puppet, dt: number): void {
    const def = TOOLS[pu.tool];
    if (def.model === null) {
      if (pu.mower) {
        scene.remove(pu.mower.group);
        pu.mower = null;
      }
      return;
    }
    if (!pu.mower || pu.mower.group.userData.tool !== pu.tool) {
      if (pu.mower) scene.remove(pu.mower.group);
      pu.mower = createMowerModel(def.model);
      pu.mower.group.scale.setScalar(def.modelScale);
      pu.mower.group.userData.tool = pu.tool;
      scene.add(pu.mower.group);
    }
    const p = pu.fake;
    const m = pu.mower;
    m.group.visible = pu.model.object.visible && !p.swimming;
    if (!m.group.visible) return;
    const off = pu.tool === 'riding' ? 0 : 0.9 * def.modelScale;
    m.group.position.set(p.position.x + Math.sin(p.facing) * off, p.position.y, p.position.z + Math.cos(p.facing) * off);
    m.group.rotation.y = p.facing;
    m.setNight(nightAmount(state));
    m.animate(dt, Math.hypot(p.velocity.x, p.velocity.z));
  }

  /** Their bobber and line, eased toward the latest hook position they sent. */
  function poseHook(pu: Puppet, k: number): void {
    const show = pu.hookTarget !== null && pu.model.object.visible;
    pu.bobber.visible = show;
    pu.line.visible = show;
    if (!show || !pu.hookTarget) return;
    pu.hookPos.lerp(pu.hookTarget, k);
    pu.bobber.position.copy(pu.hookPos);
    const p = pu.fake.position;
    drawLine(pu.linePos, p.x, p.y + HAND_HEIGHT, p.z, pu.hookPos);
  }

  /** Debris on someone else's hook hangs from their bobber and is off limits to everyone else. */
  function pinHeldDebris(): void {
    for (const d of state.debris) d.held = false;
    if (puppets.size === 0) return;
    const byId = new Map(state.debris.map((d) => [d.id, d]));
    for (const pu of puppets.values()) {
      if (!pu.hookTarget) continue;
      for (const id of pu.snags) {
        const d = byId.get(id);
        if (!d) continue;
        d.held = true;
        d.x = pu.hookPos.x;
        d.z = pu.hookPos.z;
      }
    }
  }

  // ------------------------------------------------------------ roles and world

  /** Sets netRole and the action forwarding from the current host. */
  function syncRole(): void {
    if (hostId === me) {
      state.netRole = 'host';
      netHook.forward = null;
    } else {
      state.netRole = 'guest';
      netHook.forward = (a: NetAction) => {
        const c = link;
        if (!c) return;
        seq += 1;
        lastActAt = performance.now();
        c.send(hostId, { k: 'act', seq, a });
      };
    }
  }

  /** Puts a guest's gnome on the raft tile nearest the origin. */
  function placeOnRaft(): void {
    let best: Tile | null = null;
    for (const t of state.tiles.values()) {
      if (!best || t.i * t.i + t.j * t.j < best.i * best.i + best.j * best.j) best = t;
    }
    const p = state.player;
    p.position.set(best ? best.i * TILE_SIZE : 0, RAFT_TOP, best ? best.j * TILE_SIZE : 0);
    p.velocity.set(0, 0, 0);
    p.swimming = false;
    p.grounded = true;
  }

  function sendMe(c: NetClient<CoopMsg>): void {
    const p = state.player;
    c.send(null, {
      k: 'me',
      x: round2(p.position.x),
      y: round2(p.position.y),
      z: round2(p.position.z),
      f: round2(p.facing),
      sw: p.swimming ? 1 : 0,
      tl: state.equipped,
      h: state.hook ? [round2(state.hook.x), round2(state.hook.y), round2(state.hook.z)] : 0,
      sn: state.hookSnags,
    });
  }

  function onRelay(from: number, d: CoopMsg): void {
    switch (d.k) {
      case 'snap': {
        if (state.netRole !== 'guest' || from !== hostId) return;
        // Skip snapshots that predate my own unacknowledged actions, for at most COOP.ackWaitS.
        const ackedMine = acks[String(me)] ?? 0;
        if (ackedMine < seq && performance.now() - lastActAt < COOP.ackWaitS * 1000) return;
        applyWorld(state, d.w);
        if (!placed) {
          placed = true;
          placeOnRaft();
          if (state.mode === 'title') state.mode = 'play';
          startAudio();
        }
        break;
      }
      case 'act': {
        if (state.netRole !== 'host') return;
        applyNetAction(state, d.a);
        const key = String(from);
        acks[key] = Math.max(acks[key] ?? 0, d.seq);
        break;
      }
      case 'me': {
        const pu = puppets.get(from);
        if (!pu) return;
        const first = pu.target === null;
        if (!pu.target) pu.target = new THREE.Vector3();
        pu.target.set(d.x, d.y, d.z);
        pu.targetFacing = d.f;
        pu.targetSwim = d.sw === 1;
        pu.tool = d.tl in TOOLS ? d.tl : 'hands';
        pu.snags = Array.isArray(d.sn) ? d.sn : [];
        if (Array.isArray(d.h)) {
          if (!pu.hookTarget) {
            pu.hookTarget = new THREE.Vector3();
            pu.hookPos.set(d.h[0], d.h[1], d.h[2]); // a fresh cast starts where it is, not where the last one was
          }
          pu.hookTarget.set(d.h[0], d.h[1], d.h[2]);
        } else pu.hookTarget = null;
        if (first) {
          pu.fake.position.copy(pu.target);
          pu.fake.facing = d.f;
          pu.model.object.visible = true;
          pu.sprite.visible = true;
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------ connection lifecycle

  /** Clears everything about the current raft. Does not touch the connection or netRole. */
  function resetRaft(): void {
    for (const id of [...puppets.keys()]) removePuppet(id);
    roster = [];
    me = -1;
    hostId = -1;
    acks = {};
    seq = 0;
    placed = false;
    meAcc = 0;
    snapAcc = 0;
    netHook.forward = null;
    state.coop.players = [];
    state.coop.code = '';
  }

  /** Leaving rules for a raft you were in. A host keeps playing alone; a guest reloads to its own saved raft. */
  function leaveRaft(msg: string): void {
    const wasGuest = state.netRole === 'guest';
    resetRaft();
    notify(state, msg);
    if (wasGuest) {
      setStatus('error', msg);
      setTimeout(() => location.reload(), 2500);
    } else {
      state.netRole = 'solo';
      setStatus('off', msg);
    }
  }

  function leave(): void {
    const old = link;
    link = null;
    if (old) {
      old.leave();
      old.drop();
    }
    if (state.coop.status === 'in') {
      leaveRaft('You left the raft.');
    } else {
      resetRaft();
      setStatus('off', '');
    }
  }

  function onServer(client: NetClient<CoopMsg>, m: ServerMsg<CoopMsg>): void {
    switch (m.t) {
      case 'match': {
        me = m.you;
        hostId = m.hostId;
        roster = m.players.map((p) => ({ ...p }));
        acks = {};
        seq = 0;
        placed = false;
        setStatus('in', '');
        refresh();
        syncRole();
        if (hostId === me) {
          if (state.mode === 'title') state.mode = 'play';
          startAudio();
        }
        break;
      }
      case 'joined': {
        if (roster.some((p) => p.id === m.player.id)) break;
        roster = [...roster, { ...m.player }];
        refresh();
        notify(state, `${m.player.name} climbed aboard!`);
        if (state.netRole === 'host') client.send(m.player.id, { k: 'snap', w: snapshotWorld(state), acks });
        break;
      }
      case 'left': {
        const gone = roster.find((p) => p.id === m.id);
        roster = roster.filter((p) => p.id !== m.id);
        delete acks[String(m.id)];
        refresh();
        if (gone) notify(state, `${gone.name} left the raft.`);
        break;
      }
      case 'host': {
        hostId = m.hostId;
        refresh();
        syncRole();
        if (hostId === me) {
          acks = {};
          notify(state, 'The host left. You are now hosting the raft.');
        }
        break;
      }
      case 'error': {
        if (state.coop.status !== 'in') setStatus('error', m.message);
        break;
      }
      case 'ended': {
        if (link === client) link = null;
        client.drop();
        if (state.coop.status === 'in') leaveRaft(m.reason);
        else setStatus('error', m.reason);
        break;
      }
      case 'relay': {
        onRelay(m.from, m.d);
        break;
      }
      default:
        break;
    }
  }

  function join(name: string, code: string): void {
    const url = serverUrl();
    if (url === '') {
      setStatus('error', 'Online play is not set up for this build.');
      return;
    }
    if (state.coop.status === 'in') {
      setStatus('error', 'Leave the raft first.');
      return;
    }
    if (link) {
      const old = link;
      link = null;
      old.drop();
    }
    const client = createNetClient<CoopMsg>(url, 'gnaft', { name, character: 'gnorman' });
    link = client;
    queued = false;
    resetRaft();
    state.coop.code = code;
    setStatus('connecting', '');

    client.onMessage((m) => {
      if (link === client) onServer(client, m);
    });
    client.onClose(() => {
      if (link !== client) return;
      if (state.coop.status === 'in') {
        link = null;
        leaveRaft('Lost the connection to the raft.');
      } else if (queued) {
        link = null;
        setStatus('error', 'Lost the connection to the matchmaking server.');
      }
      // Otherwise connect() is still pending; its rejection reports the error.
    });
    client.connect().then(() => {
      if (link !== client) return;
      if (!client.connected) {
        link = null;
        setStatus('error', 'Lost the connection to the matchmaking server.');
        return;
      }
      queued = true;
      client.queue(code, 'gnorman', name);
    }, (err: unknown) => {
      if (link !== client) return;
      link = null;
      setStatus('error', err instanceof Error ? err.message : 'Could not join the raft.');
    });
  }

  // ------------------------------------------------------------ per-frame

  return {
    update(dt: number) {
      const req = state.coop.request;
      if (req !== null) {
        state.coop.request = null;
        if (req === 'leave') leave();
        else join(req.name, req.code);
      }

      const c = link;
      if (c && state.coop.status === 'in') {
        meAcc += dt;
        if (meAcc >= 1 / COOP.meHz) {
          meAcc = 0;
          sendMe(c);
        }
        if (state.netRole === 'host') {
          snapAcc += dt;
          if (snapAcc >= 1 / COOP.snapHz) {
            snapAcc = 0;
            c.send(null, { k: 'snap', w: snapshotWorld(state), acks });
          }
        }
      }

      movePuppets(dt);
      pinHeldDebris();
    },
  };
}
