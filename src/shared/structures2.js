'use strict';
/* The large structures: strongholds (with the End portal room), mineshafts, Nether fortresses, bastion
   remnants, End cities with their ships, ocean monuments and woodland mansions. Laid out in code following
   the shapes and materials of the game's structures. */
SHARED.push(function structures2Module(G) {
  const { BID: B, BLOCKS, Rand, hashInt } = G;
  const S = G.Structures, { Plan, biomeAt, heightAt } = S, SEA = 63;
  const shuffle = (r, a) => { for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------------------------------------------------------------- strongholds: three in the first ring 1280-2816 blocks out, six in the next, ...
  let rings = null, ringSeed = null;
  function strongholdStarts(seed) {
    if (rings && ringSeed === seed) return rings;
    const r = new Rand(hashInt(seed, 99, 99, 4242)), out = [];
    const counts = [3, 6, 10, 15, 21, 28, 36, 9];
    let ring = 0, inRing = 0, angle = r.next() * Math.PI * 2;
    for (let i = 0; i < 128; i++) {
      const dist = (4 * 32 + 32 * ring * 6) + (r.next() - 0.5) * 32 * 2.5; // in chunks
      out.push([Math.round(Math.cos(angle) * dist), Math.round(Math.sin(angle) * dist)]);
      angle += Math.PI * 2 / counts[ring];
      if (++inRing === counts[ring]) { ring++; inRing = 0; angle += r.next() * Math.PI * 2; if (ring >= counts.length) break; }
    }
    rings = out; ringSeed = seed; return out;
  }
  const brick = r => { const v = r.next(); return v < 0.2 ? B.cracked_stone_bricks : v < 0.5 ? B.mossy_stone_bricks : v < 0.55 ? B.infested_stone_bricks : B.stone_bricks; };
  function corridor(p, r, x0, z0, x1, z1, y) {
    // a 5 x 5 tunnel of stone bricks with a 3 x 3 inside, from (x0,z0) to (x1,z1) (straight, along x or z)
    const along = x0 !== x1, a = Math.min(along ? x0 : z0, along ? x1 : z1), b = Math.max(along ? x0 : z0, along ? x1 : z1), c = along ? z0 : x0;
    for (let i = a; i <= b; i++) for (let dy = 0; dy <= 4; dy++) for (let s = -2; s <= 2; s++) {
      const edge = dy === 0 || dy === 4 || Math.abs(s) === 2;
      const x = along ? i : c + s, z = along ? c + s : i;
      p.set(x, y + dy, z, edge ? brick(r) : 0);
    }
    if (r.chance(0.15)) { const i = a + 1 + r.int(Math.max(1, b - a - 1)); const x = along ? i : c + 1, z = along ? c + 1 : i; p.chest(x, y + 1, z, along ? 2 : 4, 'chests/stronghold_corridor', r.int(1e9)); }
    for (let i = a + 3; i < b; i += 7) { const x = along ? i : c - 1, z = along ? c - 1 : i; p.set(x, y + 3, z, B.wall_torch, along ? 3 : 5); }
  }
  function room(p, r, kind, x, y, z, ctx) {
    // rooms are 11 x 11 (the portal room 11 x 16) centred on (x, z), floor at y
    if (kind === 'portal') {
      const w = 5, l = 8;
      p.shell(x - w, y, z - l, x + w, y + 7, z + l, () => brick(r), 0);
      for (const sx of [x - 4, x + 4]) p.fill(sx - 1, y + 1, z - 6, sx + 1, y + 1, z + 1, B.lava);
      for (const sx of [x - 4, x + 4]) p.fill(sx - 1, y + 1, z - 6, sx + 1, y + 1, z - 6, B.stone_bricks);
      // the stairs up to the platform and the silverfish spawner
      for (let i = 0; i < 3; i++) p.fill(x - 1, y + 1 + i, z - 3 + i, x + 1, y + 1 + i, z - 3 + i, B.stone_brick_stairs, 3);
      p.fill(x - 3, y + 1, z, x + 3, y + 3, z + 6, B.stone_bricks); p.fill(x - 2, y + 4, z + 1, x + 2, y + 4, z + 5, 0);
      p.spawner(x, y + 4, z - 1, 'silverfish');
      // twelve frames round a 3 x 3 hole, facing in; each has an eye one time in ten
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const ring = Math.abs(dx) === 2 || Math.abs(dz) === 2, corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        if (!ring || corner) { p.set(x + dx, y + 4, z + 3 + dz, ring ? B.stone_bricks : 0); if (!ring) p.set(x + dx, y + 3, z + 3 + dz, B.lava); continue; }
        const f = dx === -2 ? 5 : dx === 2 ? 4 : dz === -2 ? 3 : 2;
        p.set(x + dx, y + 4, z + 3 + dz, B.end_portal_frame, f | (r.chance(0.1) ? 8 : 0));
      }
      for (let dz = -6; dz <= 6; dz += 4) { p.set(x - w, y + 4, z + dz, B.iron_bars); p.set(x + w, y + 4, z + dz, B.iron_bars); }
      p.box(x - w, y, z - l, x + w, y + 7, z + l, 'portal_room');
      return { doors: [[x, z - l], [x - w, z], [x + w, z]] };
    }
    p.shell(x - 5, y, z - 5, x + 5, y + (kind === 'library' ? 10 : 6), z + 5, () => brick(r), 0);
    if (kind === 'library') {
      const top = y + 10;
      for (let i = -4; i <= 4; i++) for (let dy = 1; dy <= 9; dy++) { if (dy === 5) continue; p.set(x - 4, y + dy, z + i, B.bookshelf); p.set(x + 4, y + dy, z + i, B.bookshelf); }
      p.fill(x - 3, y + 5, z - 4, x + 3, y + 5, z + 4, B.oak_planks); p.fill(x - 2, y + 5, z - 2, x + 2, y + 5, z + 2, 0);
      p.fill(x - 2, y + 6, z - 2, x - 2, y + 6, z + 2, B.oak_fence); p.fill(x + 2, y + 6, z - 2, x + 2, y + 6, z + 2, B.oak_fence);
      for (let dy = 1; dy <= 5; dy++) p.set(x + 3, y + dy, z + 4, B.ladder, 2);
      for (let k = 0; k < 6; k++) p.set(x - 3 + r.int(7), y + 1 + r.int(9), z - 3 + r.int(7), B.cobweb, 0, 1);
      p.chest(x - 3, y + 1, z + 3, 5, 'chests/stronghold_library', r.int(1e9));
      p.chest(x + 3, y + 6, z - 3, 4, 'chests/stronghold_library', r.int(1e9));
      p.set(x, top - 1, z, B.chandelier || B.glowstone);
    } else if (kind === 'prison') {
      for (const s of [-1, 1]) for (let i = -3; i <= 3; i += 3) { p.fill(x + s * 2, y + 1, z + i - 1, x + s * 4, y + 3, z + i + 1, B.iron_bars); p.fill(x + s * 3, y + 1, z + i, x + s * 4, y + 2, z + i, 0); p.set(x + s * 2, y + 1, z + i, B.iron_door, s < 0 ? 4 : 5); p.set(x + s * 2, y + 2, z + i, B.iron_door, (s < 0 ? 4 : 5) | 8); }
    } else if (kind === 'fountain') {
      p.fill(x - 1, y + 1, z - 1, x + 1, y + 1, z + 1, B.stone_bricks); p.set(x, y + 1, z, B.water); p.fill(x, y + 2, z, x, y + 4, z, B.stone_bricks); p.set(x, y + 5, z, B.water);
    } else if (kind === 'crossing') {
      p.fill(x - 4, y + 3, z - 4, x + 4, y + 3, z + 4, B.oak_planks); p.fill(x - 2, y + 3, z - 2, x + 2, y + 3, z + 2, 0);
      p.chest(x + 4, y + 4, z - 4, 4, 'chests/stronghold_crossing', r.int(1e9)); p.set(x, y + 5, z, B.torch);
      for (let dy = 1; dy <= 3; dy++) p.set(x - 4, y + dy, z + 4, B.ladder, 5);
    } else if (kind === 'stairs') {
      // a spiral stair up toward the surface (the stronghold start)
      for (let i = 0; i < 24; i++) { const a = i % 8, dx = [-3, -3, -3, 0, 3, 3, 3, 0][a], dz = [-3, 0, 3, 3, 3, 0, -3, -3][a]; p.set(x + dx, y + 1 + Math.floor(i / 2), z + dz, B.stone_brick_slab, i % 2 ? 1 << 3 : 0); }
      p.fill(x - 1, y + 1, z - 1, x + 1, y + 12, z + 1, B.stone_bricks);
      p.shell(x - 5, y, z - 5, x + 5, y + 14, z + 5, () => brick(r), null);
      p.fill(x - 4, y + 7, z - 4, x + 4, y + 13, z + 4, 0); p.fill(x - 1, y + 7, z - 1, x + 1, y + 12, z + 1, B.stone_bricks);
    } else {
      p.set(x, y + 4, z, B.torch);
    }
    return { doors: [[x, z - 5], [x, z + 5], [x - 5, z], [x + 5, z]] };
  }
  S.reg({ name: 'stronghold', dim: 'overworld', salt: 0, flatOk: true,
    custom(gen, cx, cz) { return strongholdStarts(gen.seed).filter(s => Math.abs(s[0] - cx) <= 6 && Math.abs(s[1] - cz) <= 6); },
    locate(gen, x, z) {
      let best = null, bd = 1e18;
      for (const s of strongholdStarts(gen.seed)) { const d = (s[0] * 16 + 8 - x) ** 2 + (s[1] * 16 + 8 - z) ** 2; if (d < bd) { bd = d; best = s; } }
      return best ? { x: best[0] * 16 + 8, z: best[1] * 16 + 8, y: 0 } : null;
    },
    build(gen, r, x, z) {
      const surf = gen.flat ? -61 : heightAt(gen, x, z);
      const y = gen.flat ? -55 : Math.max(-40, Math.min(surf - 30, 30));
      const p = new Plan(0, 0, 0, 0);
      // rooms on a grid of 16-block cells; a random tree joins them, the portal room is the farthest cell
      const N = 4, cells = [];
      for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) if (Math.abs(i) + Math.abs(j) <= N && r.chance(0.6) || (i === 0 && j === 0)) cells.push([i, j]);
      const key = c => c[0] + ',' + c[1], have = new Set(cells.map(key)), seen = new Set(['0,0']), order = [[0, 0]], edges = [];
      for (let k = 0; k < order.length; k++) {
        const c = order[k];
        for (const [di, dj] of shuffle(r, [[1, 0], [-1, 0], [0, 1], [0, -1]])) { const n = [c[0] + di, c[1] + dj]; if (!have.has(key(n)) || seen.has(key(n))) continue; seen.add(key(n)); order.push(n); edges.push([c, n]); }
      }
      const far = order[order.length - 1];
      const kinds = ['library', 'prison', 'fountain', 'crossing', 'room', 'library', 'room', 'crossing'];
      let ki = 0;
      const pos = c => [x + c[0] * 16, z + c[1] * 16];
      for (const [a, b] of edges) { const [ax, az] = pos(a), [bx, bz] = pos(b); corridor(p, r, ax, az, bx, bz, y); }
      for (const c of order) {
        const [cxw, czw] = pos(c);
        const kind = c === far ? 'portal' : c[0] === 0 && c[1] === 0 ? 'stairs' : kinds[ki++ % kinds.length];
        room(p, r, kind, cxw, y, czw);
      }
      // the corridor openings into rooms
      for (const [a, b] of edges) { const [ax, az] = pos(a), [bx, bz] = pos(b); const mx = (ax + bx) / 2, mz = (az + bz) / 2; void mx; void mz; }
      for (const [a, b] of edges) for (const c of [a, b]) { const [cxw, czw] = pos(c), o = c === a ? b : a, dx = Math.sign(o[0] - c[0]), dz = Math.sign(o[1] - c[1]); const ex = cxw + dx * 5, ez = czw + dz * 5; for (let dy = 1; dy <= 3; dy++) for (let s = -1; s <= 1; s++) p.put(ex + (dz ? s : 0), y + dy, ez + (dx ? s : 0), 0); if (r.chance(0.3)) { p.put(ex, y + 1, ez, B.oak_door, dx ? (dx > 0 ? 5 : 4) : (dz > 0 ? 3 : 2)); p.put(ex, y + 2, ez, B.oak_door, (dx ? (dx > 0 ? 5 : 4) : (dz > 0 ? 3 : 2)) | 8); } }
      p.box(x - N * 16 - 10, y - 2, z - N * 16 - 10, x + N * 16 + 10, y + 16, z + N * 16 + 10, 'stronghold');
      p.portal = pos(far);
      return p;
    } });

  // ---------------------------------------------------------------- mineshafts: 0.4% of chunks; corridors with supports, rails, cobwebs, cave spiders
  S.reg({ name: 'mineshaft', dim: 'overworld', salt: 9, freq: 0.004, flatOk: false,
    custom(gen, cx, cz) { const out = []; for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) out.push([cx + dx, cz + dz]); return out; },
    build(gen, r, x, z) {
      const mesa = /badlands/.test(biomeAt(gen, x, z)), surf = heightAt(gen, x, z);
      const y0 = mesa ? Math.min(surf - 10, 60) : Math.min(surf - 15, 10 + r.int(30));
      const W = mesa ? B.dark_oak_planks : B.oak_planks, F = mesa ? B.dark_oak_fence : B.oak_fence;
      const p = new Plan(0, 0, 0, 0);
      // the central dirt room
      p.fill(x - 6, y0, z - 6, x + 6, y0 + 4, z + 6, 0); p.fill(x - 6, y0 - 1, z - 6, x + 6, y0 - 1, z + 6, B.dirt, 0, 3);
      let pieces = 0;
      const tunnel = (sx, sy, sz, dir, depth) => {
        if (depth > 6 || pieces > 40) return;
        pieces++;
        const len = 5 * (2 + r.int(4)), dx = [0, 1, 0, -1][dir], dz = [-1, 0, 1, 0][dir];
        const spider = r.chance(0.05);
        for (let i = 0; i < len; i++) {
          const cx = sx + dx * i, cz = sz + dz * i;
          for (let s = -1; s <= 1; s++) for (let dy = 0; dy <= 2; dy++) p.put(cx + dz * s, sy + dy, cz + dx * s, 0, 0, 4);
          // a floor of planks where the tunnel crosses a cave (a bridge)
          for (let s = -1; s <= 1; s++) p.put(cx + dz * s, sy - 1, cz + dx * s, W, 0, 1);
          if (i % 5 === 2) { for (const s of [-1, 1]) { p.put(cx + dz * s, sy, cz + dx * s, F, 0); p.put(cx + dz * s, sy + 1, cz + dx * s, F, 0); } for (let s = -1; s <= 1; s++) p.put(cx + dz * s, sy + 2, cz + dx * s, W, 0); if (r.chance(0.3)) p.put(cx, sy + 1, cz + (dx ? 0 : 0) + 0, 0, 0); }
          else if (r.chance(0.7)) p.put(cx, sy, cz, B.rail, dx ? 1 : 0, 1);
          if (spider || r.chance(0.03)) for (let k = 0; k < 2; k++) p.put(cx + dz * (r.int(3) - 1), sy + r.int(3), cz + dx * (r.int(3) - 1), B.cobweb, 0, 1);
          if (r.chance(0.01)) { p.put(cx + dz, sy, cz + dx, B.chest, dx ? 2 : 4); p.bucket(cx + dz, cz + dx).bes.push({ x: cx + dz, y: sy, z: cz + dx, type: 'container', items: new Array(27).fill(null), loot: 'chests/abandoned_mineshaft', seed: r.int(1e9) }); }
          if (i % 9 === 4 && r.chance(0.5)) p.put(cx + dz * 1, sy + 2, cz + dx * 1, B.wall_torch, 0, 1);
        }
        if (spider) { const mx = sx + dx * (len >> 1), mz = sz + dz * (len >> 1); p.put(mx, sy, mz, B.spawner, 0); p.bucket(mx, mz).bes.push({ x: mx, y: sy, z: mz, type: 'spawner', mob: 'cave_spider', delay: 20 }); }
        const ex = sx + dx * len, ez = sz + dz * len;
        // a crossing, then up to three new tunnels (sometimes one level lower or higher)
        for (let s = -1; s <= 1; s++) for (let t = -1; t <= 1; t++) for (let dy = 0; dy <= 2; dy++) p.put(ex + s, sy + dy, ez + t, 0, 0, 4);
        for (const nd of [dir, (dir + 1) % 4, (dir + 3) % 4]) if (r.chance(nd === dir ? 0.75 : 0.45)) tunnel(ex + [0, 2, 0, -2][nd], sy + (r.chance(0.15) ? (r.chance(0.5) ? 4 : -4) : 0), ez + [-2, 0, 2, 0][nd], nd, depth + 1);
      };
      for (let dir = 0; dir < 4; dir++) if (r.chance(0.8)) tunnel(x + [0, 7, 0, -7][dir], y0, z + [-7, 0, 7, 0][dir], dir, 0);
      return p;
    } });

  // ---------------------------------------------------------------- Nether fortress: bridges, corridors, a blaze spawner, nether wart, chests
  function fortress(gen, r, x, z) {
    const y = 64, p = new Plan(0, 0, 0, 0), NB = B.nether_bricks, FN = B.nether_brick_fence;
    const bridge = (x0, z0, len, dir) => {
      const dx = [0, 1, 0, -1][dir], dz = [-1, 0, 1, 0][dir];
      for (let i = 0; i < len; i++) {
        const cx = x0 + dx * i, cz = z0 + dz * i;
        for (let s = -2; s <= 2; s++) {
          const bx = cx + dz * s, bz = cz + dx * s;
          p.put(bx, y, bz, NB); for (let dy = 1; dy <= 4; dy++) p.put(bx, y + dy, bz, 0);
          if (Math.abs(s) === 2) { p.put(bx, y + 1, bz, NB); p.put(bx, y + 2, bz, FN); }
          p.put(bx, y - 1, bz, NB);
        }
        // supports down to the ground every 8 blocks
        if (i % 8 === 4) for (let s = -2; s <= 2; s += 4) { const bx = cx + dz * s, bz = cz + dx * s; p.put(bx, y - 2, bz, NB, 0, 2); }
      }
    };
    const crossing = (cx, cz) => {
      p.box && 0;
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { p.put(cx + dx, y, cz + dz, NB); p.put(cx + dx, y - 1, cz + dz, NB); for (let dy = 1; dy <= 5; dy++) p.put(cx + dx, y + dy, cz + dz, 0); }
      for (const [a, b] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { p.put(cx + a, y - 2, cz + b, NB, 0, 2); for (let dy = 1; dy <= 4; dy++) p.put(cx + a, y + dy, cz + b, NB); }
    };
    const room = (cx, cz, kind) => {
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -1; dy <= 7; dy++) {
        const edge = Math.abs(dx) === 6 || Math.abs(dz) === 6;
        const id = dy <= 0 ? NB : edge ? (dy === 3 || dy === 4) && (dx + dz) % 2 === 0 ? FN : NB : dy === 7 ? NB : 0;
        p.put(cx + dx, y + dy, cz + dz, id);
      }
      for (const [a, b] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) for (let s = -1; s <= 1; s++) for (let dy = 1; dy <= 3; dy++) p.put(cx + (a ? a : s), y + dy, cz + (b ? b : s), 0);
      for (const [a, b] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) p.put(cx + a, y - 2, cz + b, NB, 0, 2);
      if (kind === 'blaze') {
        // the raised spawner platform reached by stairs
        p.put(cx, y + 3, cz, B.spawner); p.bucket(cx, cz).bes.push({ x: cx, y: y + 3, z: cz, type: 'spawner', mob: 'blaze', delay: 20 });
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) p.put(cx + dx, y + 2, cz + dz, NB);
        p.put(cx, y + 2, cz, NB);
        for (let i = 0; i < 2; i++) p.put(cx, y + 1 + i, cz - 3 + i, B.nether_brick_stairs, 3);
        for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let dy = 1; dy <= 3; dy++) p.put(cx + a, y + dy, cz + b, FN);
      } else if (kind === 'wart') {
        for (let dx = -4; dx <= 4; dx++) for (const dz of [-4, 4]) { p.put(cx + dx, y, cz + dz, B.soul_sand); p.put(cx + dx, y + 1, cz + dz, B.nether_wart, r.int(4)); }
        for (let i = -2; i <= 2; i++) p.put(cx + i, y + 1, cz, B.nether_brick_stairs, 2);
        p.bucket(cx, cz); p.put(cx + 5, y + 1, cz - 5, B.chest, 4); p.bucket(cx + 5, cz - 5).bes.push({ x: cx + 5, y: y + 1, z: cz - 5, type: 'container', items: new Array(27).fill(null), loot: 'chests/nether_bridge', seed: r.int(1e9) });
      } else {
        p.put(cx - 5, y + 1, cz + 5, B.chest, 5); p.bucket(cx - 5, cz + 5).bes.push({ x: cx - 5, y: y + 1, z: cz + 5, type: 'container', items: new Array(27).fill(null), loot: 'chests/nether_bridge', seed: r.int(1e9) });
      }
    };
    crossing(x, z);
    const ends = [];
    for (let dir = 0; dir < 4; dir++) {
      if (dir > 1 && !r.chance(0.8)) continue;
      const len = 19 + r.int(3) * 6, dx = [0, 1, 0, -1][dir], dz = [-1, 0, 1, 0][dir];
      bridge(x + dx * 5, z + dz * 5, len, dir);
      const ex = x + dx * (5 + len + 6), ez = z + dz * (5 + len + 6);
      ends.push([ex, ez, dir]);
    }
    const kinds = shuffle(r, ['blaze', 'wart', 'chest', 'blaze']);
    ends.forEach(([ex, ez, dir], i) => {
      room(ex, ez, kinds[i % kinds.length]);
      // and another bridge on from some rooms to a second crossing
      if (r.chance(0.5)) { const nd = (dir + (r.chance(0.5) ? 1 : 3)) % 4, dx = [0, 1, 0, -1][nd], dz = [-1, 0, 1, 0][nd]; bridge(ex + dx * 7, ez + dz * 7, 13, nd); crossing(ex + dx * 24, ez + dz * 24); }
    });
    p.boxes.push([p.bb[0], y - 30, p.bb[2], p.bb[3], y + 12, p.bb[5], 'fortress']);
    return p;
  }
  // ---------------------------------------------------------------- bastion remnant: a blackstone fortress of the piglins
  function bastion(gen, r, x, z) {
    const y = 33 + r.int(30), p = new Plan(x, y, z, r.int(4));
    const PB = B.polished_blackstone_bricks, BS = B.blackstone, GB = B.gilded_blackstone, CB = B.cracked_polished_blackstone_bricks, BA = B.basalt;
    const mat = () => { const v = r.next(); return v < 0.1 ? CB : v < 0.14 ? GB : v < 0.5 ? BS : PB; };
    const variant = r.pick(['housing', 'treasure', 'hoglin', 'bridge']);
    // the outer walls, three floors high, with ramparts
    const R = 16;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) for (let dy = -2; dy <= 20; dy++) {
      const edge = Math.abs(dx) === R || Math.abs(dz) === R, floor = dy === -1 || dy === 7 || dy === 14;
      if (edge) p.set(dx, dy, dz, (dy + dx) % 6 === 0 ? BA : mat());
      else if (floor && (Math.abs(dx) > 5 || Math.abs(dz) > 5 || dy === -1)) p.set(dx, dy, dz, mat());
      else p.set(dx, dy, dz, 0);
    }
    for (let dx = -R; dx <= R; dx += 2) { p.set(dx, 21, -R, PB); p.set(dx, 21, R, PB); p.set(-R, 21, dx, PB); p.set(R, 21, dx, PB); }
    for (const [a, b] of [[-R, -R], [R, -R], [-R, R], [R, R]]) p.fill(a - 1, -4, b - 1, a + 1, 23, b + 1, BA, 0, 2);
    p.fill(-2, 0, -R, 2, 4, -R, 0);
    // ramps between floors and lava falls through the middle
    for (let i = 0; i < 7; i++) { p.set(-R + 1 + i, i, -R + 3, B.polished_blackstone_brick_stairs || PB, 5); p.set(R - 1 - i, 7 + i, R - 3, B.polished_blackstone_brick_stairs || PB, 4); }
    if (variant === 'treasure') {
      // the treasure room: a core of magma and gold, the treasure chest
      p.fill(-4, -1, -4, 4, -1, 4, B.magma_block); p.fill(-1, 0, -1, 1, 2, 1, B.gold_block); p.set(0, 3, 0, GB);
      p.chest(0, 0, -3, 2, 'chests/bastion_treasure', r.int(1e9)); p.chest(-3, 0, 0, 4, 'chests/bastion_other', r.int(1e9));
      for (let k = 0; k < 2; k++) p.ent(-6 + k * 12, 0, 6, { type: 'piglin_brute', persistent: true });
    } else if (variant === 'hoglin') {
      for (const s of [-1, 1]) { p.fill(s * 6, 0, -8, s * 12, 2, 8, B.blackstone_wall || PB); p.fill(s * 7, 0, -7, s * 11, 2, 7, 0); for (let k = 0; k < 2; k++) p.ent(s * 9, 0, -4 + k * 6, { type: 'hoglin', persistent: true }); }
      p.chest(0, 0, 8, 2, 'chests/bastion_hoglin_stable', r.int(1e9));
    } else if (variant === 'bridge') {
      p.fill(-2, 7, -R - 20, 2, 7, -R, PB); p.fill(-2, 8, -R - 20, -2, 8, -R, B.polished_blackstone_wall || PB); p.fill(2, 8, -R - 20, 2, 8, -R, B.polished_blackstone_wall || PB);
      p.chest(0, 8, -R - 18, 3, 'chests/bastion_bridge', r.int(1e9));
    } else {
      for (let k = 0; k < 4; k++) { const ax = -12 + r.int(24), az = -12 + r.int(24), fy = r.pick([0, 8, 15]); p.fill(ax - 2, fy, az - 2, ax + 2, fy + 3, az + 2, 0); p.chest(ax, fy, az, 2, 'chests/bastion_other', r.int(1e9)); }
    }
    for (let k = 0; k < 6; k++) { const fy = r.pick([0, 8, 15]); p.set(-12 + r.int(24), fy, -12 + r.int(24), GB); }
    // piglins live here
    for (let k = 0; k < 6 + r.int(4); k++) p.ent(-12 + r.int(24), r.pick([0, 8, 15]), -12 + r.int(24), { type: r.chance(0.15) ? 'piglin_brute' : 'piglin', persistent: true });
    p.box(-R, -2, -R, R, 22, R, 'bastion_remnant');
    return p;
  }
  // nether fortresses and bastions share one placement grid (27 / 4): two fifths fortresses, three fifths bastions
  S.reg({ name: 'fortress', dim: 'nether', spacing: 27, sep: 4, salt: 30084232, reach: 7,
    build(gen, r, x, z) { if (r.int(5) >= 2) return null; return fortress(gen, r, x, z); } });
  S.reg({ name: 'bastion_remnant', dim: 'nether', spacing: 27, sep: 4, salt: 30084232, reach: 3,
    build(gen, r, x, z) { if (r.int(5) < 2) return null; const b = G.BIOMES[gen.column(x, z, {}).biome].name; if (b === 'basalt_deltas') return null; return bastion(gen, r, x, z); } });

  // ---------------------------------------------------------------- End cities (and their ships with an elytra)
  function endCity(gen, r, x, z) {
    let h = 0; for (let k = 0; k < 4; k++) { const v = gen.density(x + [-6, 6, -6, 6][k], z + [-6, -6, 6, 6][k]); if (v <= 30) return null; }
    const top = 56 + Math.min(14, Math.floor(gen.density(x, z) / 8)); h = top + 1;
    const p = new Plan(x, h, z, r.int(4)), PU = B.purpur_block, PP = B.purpur_pillar, ES = B.end_stone_bricks, GL = B.magenta_stained_glass;
    const tower = (ox, oy, oz, floors) => {
      for (let f = 0; f < floors; f++) {
        const y0 = oy + f * 4;
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let dy = 0; dy <= 3; dy++) {
          const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3, corner = Math.abs(dx) === 3 && Math.abs(dz) === 3;
          let id = 0;
          if (dy === 0) id = f === 0 ? ES : PU;
          else if (corner) id = PP;
          else if (edge) id = dy === 2 && (dx === 0 || dz === 0) ? GL : PU;
          p.set(ox + dx, y0 + dy, oz + dz, id, corner ? 0 : 0);
        }
        // a ladder of stairs inside
        p.set(ox + 2, y0 + 1, oz + 2, B.ladder, 4); p.set(ox + 2, y0 + 2, oz + 2, B.ladder, 4); p.set(ox + 2, y0 + 3, oz + 2, B.ladder, 4); p.set(ox + 2, y0 + 4, oz + 2, B.ladder, 4); p.set(ox + 2, y0 + 4, oz + 2, B.ladder, 4);
        if (f > 0) p.set(ox + 2, y0, oz + 2, 0);
        if (r.chance(0.3)) p.ent(ox - 2, y0 + 1, oz, { type: 'shulker', persistent: true });
      }
      const ty = oy + floors * 4;
      // the roof: purpur slabs and end rods at the corners
      p.fill(ox - 3, ty, oz - 3, ox + 3, ty, oz + 3, B.purpur_slab); p.set(ox + 2, ty, oz + 2, 0);
      for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) p.set(ox + a, ty + 1, oz + b, B.end_rod, 1);
      return ty;
    };
    // the base house, a tall tower, a bridge and the fat tower with the loot
    p.fill(-5, -1, -5, 5, -1, 5, ES, 0, 2);
    const t1 = tower(0, 0, 0, 3 + r.int(3));
    const bx = 12;
    for (let i = 4; i <= bx - 4; i++) { p.fill(i, t1 - 4, -1, i, t1 - 4, 1, ES); p.set(i, t1 - 3, -1, B.purpur_slab); p.set(i, t1 - 3, 1, B.purpur_slab); }
    p.fill(4, t1 - 3, 0, 4, t1 - 2, 0, 0);
    const t2 = tower(bx, t1 - 4, 0, 2 + r.int(2));
    // the fat tower top: a bigger room with two chests and shulkers
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) for (let dy = 0; dy <= 5; dy++) {
      const edge = Math.abs(dx) === 5 || Math.abs(dz) === 5;
      p.set(bx + dx, t2 + dy, dz, dy === 0 || dy === 5 ? PU : edge ? ((dx + dz) % 3 === 0 ? GL : PU) : 0);
    }
    p.chest(bx - 3, t2 + 1, -3, 3, 'chests/end_city_treasure', r.int(1e9)); p.chest(bx + 3, t2 + 1, 3, 2, 'chests/end_city_treasure', r.int(1e9));
    for (let k = 0; k < 3; k++) p.ent(bx - 3 + r.int(7), t2 + 1, -3 + r.int(7), { type: 'shulker', persistent: true });
    // the ship (half the time), floating beside the city with the elytra in an item frame and a dragon head at the bow
    if (r.chance(0.5)) {
      const sx = -20, sy = t1 - 6, len = 20;
      for (let i = 0; i < len; i++) {
        const half = i < 3 ? 1 : i > len - 4 ? 1 : 3;
        for (let s = -half; s <= half; s++) p.set(sx + s, sy, i - 10, PU);
        p.set(sx - half - 1, sy + 1, i - 10, B.purpur_stairs, 5); p.set(sx + half + 1, sy + 1, i - 10, B.purpur_stairs, 4);
        p.set(sx - half, sy - 1, i - 10, PU); p.set(sx + half, sy - 1, i - 10, PU);
      }
      p.fill(sx, sy + 1, -4, sx, sy + 10, -4, PP); p.fill(sx - 3, sy + 8, -4, sx + 3, sy + 8, -4, B.magenta_wool || PU);
      p.fill(sx - 2, sy - 3, -6, sx + 2, sy - 1, 2, PU); p.fill(sx - 1, sy - 2, -5, sx + 1, sy - 1, 1, 0);
      p.chest(sx - 1, sy - 2, -5, 3, 'chests/end_city_treasure', r.int(1e9)); p.chest(sx + 1, sy - 2, -5, 3, 'chests/end_city_treasure', r.int(1e9));
      p.ent(sx, sy - 2, 1, { type: 'item_frame', facing: 2, item: { $s: 1, id: 'elytra', count: 1, dmg: 0 } });
      p.set(sx, sy + 1, len - 11, B.dragon_wall_head || B.dragon_head || PU, 3);
      p.ent(sx, sy + 1, 0, { type: 'shulker', persistent: true });
    }
    p.box(-26, -2, -14, bx + 6, t2 + 7, 14, 'end_city');
    return p;
  }
  S.reg({ name: 'end_city', dim: 'end', spacing: 20, sep: 11, salt: 10387313, tri: true, reach: 3,
    build(gen, r, x, z) { if (Math.hypot(x, z) < 1000) return null; return endCity(gen, r, x, z); } });

  // ---------------------------------------------------------------- ocean monuments: prismarine, guardians, the gold core
  S.reg({ name: 'ocean_monument', dim: 'overworld', spacing: 32, sep: 5, salt: 10387313, tri: true, reach: 3, flatOk: false,
    check: (gen, x, z) => /deep_/.test(biomeAt(gen, x, z)),
    build(gen, r, x, z) {
      if (!/deep_/.test(biomeAt(gen, x, z))) return null;
      const y = Math.max(30, heightAt(gen, x, z) + 1), p = new Plan(x - 29, y, z - 29, 0);
      const PR = B.prismarine, PB2 = B.prismarine_bricks, DP = B.dark_prismarine, SL = B.sea_lantern, W = B.water;
      // the base: a 58 x 58 slab with pillars to the sea floor
      for (let a = 0; a < 58; a++) for (let b = 0; b < 58; b++) { p.set(a, 0, b, PR); if ((a % 8 === 0 && b % 8 === 0)) p.set(a, -1, b, PR, 0, 2); }
      // the main hall: a stepped shell of bricks full of water, with wings either side and the dome on top
      const shell = (x0, y0, z0, x1, y1, z1) => { for (let a = x0; a <= x1; a++) for (let yy = y0; yy <= y1; yy++) for (let b = z0; b <= z1; b++) { const edge = a === x0 || a === x1 || yy === y1 || b === z0 || b === z1; p.set(a, yy, b, edge ? ((a + b + yy) % 7 === 0 ? SL : (yy % 4 === 0 ? DP : PB2)) : W); } };
      shell(4, 1, 4, 53, 8, 53);
      shell(14, 9, 14, 43, 16, 43);
      shell(22, 17, 22, 35, 22, 35);
      // the entrance in front and windows
      p.fill(25, 1, 4, 32, 6, 4, W); p.fill(27, 9, 14, 30, 13, 14, W);
      // the gold core: eight blocks of gold under dark prismarine in the middle
      p.fill(27, 2, 27, 30, 5, 30, DP); p.fill(28, 3, 28, 29, 4, 29, B.gold_block);
      // sponges in a room of a wing
      for (let k = 0; k < 6; k++) p.set(8 + r.int(6), 2 + r.int(4), 8 + r.int(6), B.wet_sponge || B.sponge);
      // three elder guardians: one in each wing and one at the top
      p.ent(10, 3, 29, { type: 'elder_guardian', persistent: true }); p.ent(47, 3, 29, { type: 'elder_guardian', persistent: true }); p.ent(29, 18, 29, { type: 'elder_guardian', persistent: true });
      for (let k = 0; k < 4; k++) p.ent(10 + r.int(38), 2 + r.int(5), 10 + r.int(38), { type: 'guardian', persistent: true });
      p.box(0, -1, 0, 57, 23, 57, 'ocean_monument');
      return p;
    } });

  // ---------------------------------------------------------------- woodland mansions: a great dark oak house in a dark forest
  S.reg({ name: 'woodland_mansion', dim: 'overworld', spacing: 80, sep: 20, salt: 10387319, tri: true, reach: 3, flatOk: false,
    check: (gen, x, z) => biomeAt(gen, x, z) === 'dark_forest',
    build(gen, r, x, z) {
      if (biomeAt(gen, x, z) !== 'dark_forest') return null;
      const g = S.ground(gen, x - 20, z - 16, x + 20, z + 16); if (g.lo < SEA) return null;
      const p = new Plan(x - 20, g.lo + 1, z - 16, r.int(4));
      const DO = B.dark_oak_planks, LG = B.dark_oak_log, CB = B.cobblestone, BP = B.birch_planks, WG = B.glass_pane;
      const W = 40, D = 32, FL = 6;
      p.fill(-2, 0, -2, W + 1, FL * 2 + 14, D + 1, 0);
      p.fill(0, -1, 0, W - 1, -1, D - 1, CB, 0, 2);
      for (let f = 0; f < 2; f++) {
        const y0 = f * FL;
        p.fill(0, y0, 0, W - 1, y0, D - 1, f ? DO : BP);
        for (let a = 0; a < W; a++) for (let b = 0; b < D; b++) for (let dy = 1; dy < FL; dy++) {
          const edge = a === 0 || b === 0 || a === W - 1 || b === D - 1, post = edge && (a % 6 === 0 || b % 6 === 0);
          if (edge) p.set(a, y0 + dy, b, post ? LG : (dy === 2 || dy === 3) && (a + b) % 3 === 1 ? WG : (f ? DO : CB));
          else if ((a % 10 === 0 || b % 8 === 0) && !(a % 10 === 5 || b % 8 === 4) && dy < 4) p.set(a, y0 + dy, b, B.white_wool);
          else if (dy === 1 && (a + b) % 9 === 0) p.set(a, y0 + dy, b, B[r.pick(['red_carpet', 'white_carpet', 'gray_carpet'])]);
        }
        // rooms: chests, a few vindicators and an evoker
        for (let k = 0; k < 3; k++) p.chest(3 + r.int(W - 6), y0 + 1, 3 + r.int(D - 6), 3, 'chests/woodland_mansion', r.int(1e9));
        for (let k = 0; k < 2; k++) p.ent(4 + r.int(W - 8), y0 + 1, 4 + r.int(D - 8), { type: 'vindicator', persistent: true });
      }
      p.ent(W >> 1, FL + 1, D >> 1, { type: 'evoker', persistent: true });
      // the stairs and the door
      for (let i = 0; i < FL; i++) p.set(W - 3, 1 + i, 4 + i, B.dark_oak_stairs, 3);
      p.fill(W - 3, FL, 4, W - 3, FL, 4 + FL, 0);
      p.set(W >> 1, 1, 0, B.dark_oak_door, 3); p.set(W >> 1, 2, 0, B.dark_oak_door, 3 | 8); p.set((W >> 1) + 1, 1, 0, B.dark_oak_door, 3 | 32); p.set((W >> 1) + 1, 2, 0, B.dark_oak_door, 3 | 8 | 32);
      // the roof: dark oak steps inward
      for (let i = 0; i < 8; i++) for (let a = -1 + i; a <= W - i; a++) { p.set(a, FL * 2 + i, -1 + i, B.dark_oak_stairs, 3); p.set(a, FL * 2 + i, D - i, B.dark_oak_stairs, 2); }
      p.fill(7, FL * 2 + 7, 7, W - 8, FL * 2 + 7, D - 8, DO);
      p.fill(0, FL * 2, 0, W - 1, FL * 2, D - 1, DO);
      p.box(-2, -1, -2, W + 1, FL * 2 + 9, D + 1, 'woodland_mansion');
      return p;
    } });
});
