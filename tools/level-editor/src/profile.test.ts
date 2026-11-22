import type { MarkerDef } from '@lawn/level';
import { describe, expect, it } from 'vitest';
import type { MutableZone } from './context';
import { gnomomiaAdapter } from './adapters/gnomomia';
import { collection } from './profile';
import { createContext } from './state';
import { createWorld } from './world';

function zoneWith(markers: MarkerDef[]): MutableZone {
  return { markers } as unknown as MutableZone;
}

describe('objects collection', () => {
  it('lists only object markers as flat views with yaw and scale read from data', () => {
    const def = zoneWith([
      { id: 'spawn', kind: 'spawn', x: 0, z: 0 },
      { id: 'a', kind: 'object', x: 3, z: 4, data: { v: 1 } },
      { id: 'b', kind: 'object', x: -2, z: 5, data: { v: 1, rot: { y: 0.5 }, scale: 2 } },
    ]);
    const items = collection('objects').items(def);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(items[0]).toMatchObject({ id: 'a', x: 3, z: 4, yaw: 0, scale: 1 });
    expect(items[1]).toMatchObject({ id: 'b', x: -2, z: 5, yaw: 0.5, scale: 2 });
    expect(collection('objects').fixed).toBe(true);
  });

  it('writes yaw and scale into the marker data and keeps the rest of it', () => {
    const def = zoneWith([{ id: 'a', kind: 'object', x: 3, z: 4, data: { v: 1, rot: { x: 0.3, y: 0.5, z: 0.1 } } }]);
    const view = collection('objects').items(def)[0];
    view.yaw = 1.2;
    view.scale = 2.5;
    expect(def.markers?.[0]).toEqual({ id: 'a', kind: 'object', x: 3, z: 4, data: { v: 1, rot: { x: 0.3, y: 1.2, z: 0.1 }, scale: 2.5 } });
  });

  it('creates v: 1 data when a marker had none, and moves x and z on the marker', () => {
    const def = zoneWith([{ id: 'a', kind: 'object', x: 3, z: 4 }]);
    const view = collection('objects').items(def)[0];
    view.yaw = -0.4;
    view.x = 7;
    view.z = 8;
    expect(def.markers?.[0]).toEqual({ id: 'a', kind: 'object', x: 7, z: 8, data: { v: 1, rot: { y: -0.4 } } });
  });

  it('an edit through the editor context is one undo step that restores the marker', () => {
    const ctx = createContext(createWorld(), gnomomiaAdapter);
    ctx.viewport = { refresh() {} } as never;
    ctx.editZone('Add object', 'mossbottom', (def) => { def.markers = [{ id: 'obj-1', kind: 'object', x: 1, z: 2, data: { v: 1 } }]; });
    ctx.editZone('Edit Object', 'mossbottom', (def) => {
      const view = collection('objects').items(def)[0];
      view.yaw = 0.8;
      view.scale = 1.5;
    });
    expect(ctx.zones.mossbottom.markers?.[0].data).toEqual({ v: 1, rot: { y: 0.8 }, scale: 1.5 });
    ctx.history.undo();
    expect(ctx.zones.mossbottom.markers?.[0].data).toEqual({ v: 1 });
  });
});

describe('leashes collection', () => {
  it('filters markers to kind "leash" and creates valid leash markers', () => {
    const def = zoneWith([
      { id: 'obj-1', kind: 'object', x: 0, z: 0, data: { v: 1 } },
      { id: 'leash-1', kind: 'leash', x: 10, z: -20, r: 16, data: { v: 1, spawn: 'mb-spawn-8' } },
    ]);
    const c = collection('leashes');
    expect(c.fixed).toBeUndefined();
    const raw = c.items(def);
    const visible = raw.filter((it) => !c.accepts || c.accepts(it));
    expect(visible.map((v) => v.id)).toEqual(['leash-1']);
    expect(c.radius(visible[0])).toBe(16);

    const created = c.make(5, 6, 0) as unknown as MarkerDef;
    expect(created.kind).toBe('leash');
    expect(created.r).toBe(16);
    expect(created.data).toEqual({ v: 1 });
  });

  it('reads and writes data.spawn via the spawn field getter/setter and supports undo', () => {
    const ctx = createContext(createWorld(), gnomomiaAdapter);
    ctx.viewport = { refresh() {} } as never;
    const c = collection('leashes');
    const spawnField = c.fields.find((f) => f.key === 'spawn')!;
    expect(spawnField.get).toBeTypeOf('function');
    expect(spawnField.set).toBeTypeOf('function');

    ctx.editZone('Add leash', 'mossbottom', (def) => {
      def.markers = [{ id: 'leash-x', kind: 'leash', x: 1, z: 2, r: 14, data: { v: 1 } }];
    });
    ctx.editZone('Bind spawn', 'mossbottom', (def) => {
      const m = c.items(def)[0];
      spawnField.set!(m, 'mb-spawn-8');
      m.r = 18;
    });
    const m = ctx.zones.mossbottom.markers?.[0];
    expect(m?.r).toBe(18);
    expect(m?.data).toEqual({ v: 1, spawn: 'mb-spawn-8' });
    expect(spawnField.get!(m as never)).toBe('mb-spawn-8');

    ctx.history.undo();
    expect(ctx.zones.mossbottom.markers?.[0].r).toBe(14);
    expect(ctx.zones.mossbottom.markers?.[0].data).toEqual({ v: 1 });
  });
});
