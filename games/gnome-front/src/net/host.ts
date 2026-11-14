// src/net/host.ts: the host side of online play. The host's browser runs the whole match. This file gives each
// human a soldier slot, applies the guests' messages to their soldiers, smooths the remote humans' movement, and
// sends a snapshot with the latest events to everyone SNAP_HZ times a second.
import * as THREE from 'three';
import { weaponOf, type Game, type Soldier } from '../config';
import { damageSoldier } from '../soldiers';
import { damageVehicle, enterVehicle, exitVehicle, simulatedHere } from '../vehicles';
import { spawnGrenade } from '../combat';
import { angleDelta, applyHumans, freeSlot, lobby, netLink, netState, r2, SMOOTH_RATE, SNAP_DIST } from './state';
import {
  BIT_ADS, BIT_GROUNDED, BIT_SPRINT, CAUSES, CLASS_IDS, encodeEvent, SNAP_HZ, WEAPON_IDS,
  type GuestMsg, type NetEvent, type SnapMsg, type SoldierSnap, type VehicleSnap, type FlagSnap,
} from './protocol';

export interface HostSync {
  /** Makes netState.humans match netLink.roster (keeps existing slots, frees slots of players who left, gives new players a slot), then applyHumans. */
  reconcile(): void;
  /** A guest's message. */
  onRelay(from: number, d: GuestMsg): void;
  /** Every frame while hosting: smooth remote humans and their vehicles, send snapshots at SNAP_HZ. */
  update(dt: number): void;
  /** Forget everything about the match (left or lost it). */
  reset(): void;
}

interface SoldierTarget { x: number; y: number; z: number; yaw: number; pitch: number; bits: number }
interface VehicleTarget { x: number; z: number; yaw: number; speed: number }

/** Events kept for the next snapshot; past this many, the oldest 'shot' events are dropped. */
const MAX_PENDING = 600;

export function createHostSync(game: Game): HostSync {
  /** Events since the last snapshot. */
  let pending: NetEvent[] = [];
  /** Latest 'me' target per remote soldier, keyed by soldier id. */
  const targets = new Map<number, SoldierTarget>();
  /** Latest vehicle target per vehicle driven by a remote human, keyed by vehicle id. */
  const vTargets = new Map<number, VehicleTarget>();
  let snapAcc = 0;

  game.on((e) => {
    if (netState.role !== 'host' || lobby.status !== 'in') return;
    if (e.type === 'spawn') {
      netState.lives.set(e.soldier.id, (netState.lives.get(e.soldier.id) ?? 0) + 1);
    }
    const n = encodeEvent(e, (id) => netState.lives.get(id) ?? 0);
    if (!n) return;
    pending.push(n);
    const excess = pending.length - MAX_PENDING;
    if (excess > 0) {
      let toDrop = excess;
      pending = pending.filter((ev) => {
        if (toDrop > 0 && ev[0] === 'shot') {
          toDrop--;
          return false;
        }
        return true;
      });
    }
  });

  function buildSnap(): SnapMsg {
    return {
      k: 'snap',
      t: r2(game.time),
      tk: [Math.ceil(game.tickets[0]), Math.ceil(game.tickets[1])],
      over: game.over ? 1 : 0,
      win: game.winner === null ? -1 : game.winner,
      hu: netState.humans.map((h): [number, number, string] => [h.soldierId, h.playerId, h.name]),
      s: game.soldiers.map((s): SoldierSnap => [
        r2(s.pos.x), r2(s.pos.y), r2(s.pos.z), r2(s.yaw), r2(s.pitch), Math.round(s.hp),
        s.alive ? 1 : 0, s.vehicle ? s.vehicle.id : -1, CLASS_IDS.indexOf(s.classId), s.kills, s.deaths,
        (s.sprinting ? BIT_SPRINT : 0) | (s.grounded ? BIT_GROUNDED : 0) | (s.ads ? BIT_ADS : 0),
      ]),
      v: game.vehicles.map((v): VehicleSnap => [
        r2(v.pos.x), r2(v.pos.z), r2(v.yaw), r2(v.speed), Math.round(v.hp), v.alive ? 1 : 0,
        v.driver ? v.driver.id : -1, v.team,
      ]),
      f: game.flags.map((f): FlagSnap => [r2(f.progress), f.owner === null ? -1 : f.owner, f.contested ? 1 : 0]),
      ev: pending,
    };
  }

  function reconcile(): void {
    const roster = netLink.roster;
    const me = netLink.me;

    // 2. Keep only slots whose player is still in the match.
    netState.humans = netState.humans.filter((h) => roster.some((p) => p.id === h.playerId));

    // 3. Give me my own slot (the soldier this browser controls).
    if (!netState.humans.some((h) => h.playerId === me)) {
      const mine = roster.find((p) => p.id === me);
      netState.humans.push({ soldierId: game.player.id, playerId: me, name: mine ? mine.name : 'YOU' });
    }
    applyHumans(game, me);

    // 5. Give every other player in join order a free bot slot.
    for (const p of roster) {
      if (netState.humans.some((h) => h.playerId === p.id)) continue;
      const s = freeSlot(game);
      if (!s) break;
      if (s.vehicle) exitVehicle(game, s);
      netState.humans.push({ soldierId: s.id, playerId: p.id, name: p.name });
      applyHumans(game, me);
    }

    // 6. Forget targets of soldiers and vehicles that are no longer remote-driven.
    for (const id of [...targets.keys()]) {
      if (!game.soldiers[id]?.remote) targets.delete(id);
    }
    for (const id of [...vTargets.keys()]) {
      const v = game.vehicles[id];
      if (!v || !v.alive || !v.driver || !v.driver.remote) vTargets.delete(id);
    }
  }

  function onRelay(from: number, d: GuestMsg): void {
    const slot = netState.humans.find((h) => h.playerId === from);
    if (!slot) return;
    const s = game.soldiers[slot.soldierId];
    if (!s) return;

    switch (d.k) {
      case 'me': {
        if (CLASS_IDS[d.cls]) s.nextClassId = CLASS_IDS[d.cls];
        // Ignore the rest unless the guest thinks it is alive, the soldier is alive, and the life matches.
        if (d.a !== 1 || !s.alive || d.life !== (netState.lives.get(s.id) ?? 0)) return;

        const hadTarget = targets.has(s.id);
        targets.set(s.id, { x: d.p[0], y: d.p[1], z: d.p[2], yaw: d.p[3], pitch: d.p[4], bits: d.p[5] });
        if (!hadTarget) {
          s.pos.set(d.p[0], d.p[1], d.p[2]);
          s.yaw = d.p[3];
          s.pitch = d.p[4];
        }

        if (d.veh >= 0 && d.vp && s.vehicle && s.vehicle.id === d.veh) {
          vTargets.set(d.veh, { x: d.vp[0], z: d.vp[1], yaw: d.vp[2], speed: d.vp[3] });
        }

        for (let i = 0; i + 5 < d.sh.length; i += 6) {
          game.emit({
            type: 'shot',
            shooter: s,
            weapon: weaponOf(s).id,
            from: new THREE.Vector3(d.sh[i], d.sh[i + 1], d.sh[i + 2]),
            to: new THREE.Vector3(d.sh[i + 3], d.sh[i + 4], d.sh[i + 5]),
          });
        }
        return;
      }
      case 'dmg': {
        const victim = game.soldiers[d.v];
        if (!victim) return;
        const amount = Math.min(Math.max(d.d, 0), 1000);
        damageSoldier(
          game, victim, amount, s, CAUSES[d.c] ?? 'gun', d.h === 1,
          d.w >= 0 ? (WEAPON_IDS[d.w] ?? null) : null,
        );
        return;
      }
      case 'vdmg': {
        const v = game.vehicles[d.v];
        if (v) damageVehicle(game, v, Math.min(Math.max(d.d, 0), 2000), s);
        return;
      }
      case 'enter': {
        const v = game.vehicles[d.v];
        if (v && v.alive && !v.driver && s.alive && !s.vehicle) enterVehicle(game, s, v);
        return;
      }
      case 'exit': {
        if (s.vehicle) exitVehicle(game, s);
        return;
      }
      case 'gren': {
        if (s.alive) {
          spawnGrenade(game, s, new THREE.Vector3(d.p[0], d.p[1], d.p[2]), new THREE.Vector3(d.vel[0], d.vel[1], d.vel[2]));
        }
        return;
      }
    }
  }

  function update(dt: number): void {
    if (netState.role !== 'host') return;

    // 1. Smooth remote humans towards their latest targets.
    const k = 1 - Math.exp(-SMOOTH_RATE * dt);
    for (const s of game.soldiers) {
      if (!s.remote || !s.alive) continue;
      const t = targets.get(s.id);
      if (!t) continue;
      if (s.vehicle) {
        // Seated soldiers: updateSoldiers puts them on the vehicle, so only the look direction comes from the target.
        s.yaw += angleDelta(s.yaw, t.yaw) * k;
        s.pitch += (t.pitch - s.pitch) * k;
        continue;
      }
      const dx = t.x - s.pos.x;
      const dy = t.y - s.pos.y;
      const dz = t.z - s.pos.z;
      if (Math.hypot(dx, dy, dz) > SNAP_DIST) {
        s.pos.set(t.x, t.y, t.z);
      } else if (dt > 0) {
        const ox = s.pos.x;
        const oy = s.pos.y;
        const oz = s.pos.z;
        s.pos.x += dx * k;
        s.pos.y += dy * k;
        s.pos.z += dz * k;
        s.vel.set((s.pos.x - ox) / dt, (s.pos.y - oy) / dt, (s.pos.z - oz) / dt);
      }
      s.yaw += angleDelta(s.yaw, t.yaw) * k;
      s.pitch += (t.pitch - s.pitch) * k;
      s.sprinting = (t.bits & BIT_SPRINT) !== 0;
      s.grounded = (t.bits & BIT_GROUNDED) !== 0;
      s.ads = (t.bits & BIT_ADS) !== 0;
    }

    // 2. Smooth vehicles driven by remote humans (their driver's browser moves them; this side only follows).
    for (const v of game.vehicles) {
      if (!v.alive || simulatedHere(game, v)) continue;
      const t = vTargets.get(v.id);
      if (!t) continue;
      const dx = t.x - v.pos.x;
      const dz = t.z - v.pos.z;
      if (Math.hypot(dx, dz) > SNAP_DIST) {
        v.pos.x = t.x;
        v.pos.z = t.z;
      } else {
        v.pos.x += dx * k;
        v.pos.z += dz * k;
      }
      v.yaw += angleDelta(v.yaw, t.yaw) * k;
      v.speed = t.speed;
      // v.pos.y is left alone: updateVehicles sets it from the terrain.
    }

    // 3. Send a snapshot SNAP_HZ times a second.
    snapAcc += dt;
    if (snapAcc >= 1 / SNAP_HZ) {
      snapAcc = 0;
      netLink.send(null, buildSnap());
      pending = [];
    }
  }

  function reset(): void {
    pending = [];
    targets.clear();
    vTargets.clear();
    snapAcc = 0;
  }

  return { reconcile, onRelay, update, reset };
}
