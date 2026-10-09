'use strict';
/* The Trails & Tales and Tricky Trials structures (Java Edition 1.20 and 1.21), with the game's placement
   (structure sets: spacing / separation / salt), biomes, heights and loot tables, drawn in code:
   - trail ruins: buried 15 blocks under taiga, old growth birch forest and jungle floors; a terracotta and mud
     brick tower whose top may break the surface, roads and ruined houses, all packed with gravel and dirt, and
     suspicious gravel (2 common per tower top and road, 6 common and 3 rare per house)
   - ancient cities: in the deep dark at y -52; a cavern with the great deepslate portal framed in
     reinforced deepslate, ruined houses and towers of deepslate, soul fire, candles, skulls, ice boxes,
     chests, and sculk with sensors and shriekers that can summon the warden; nothing spawns inside
   - trial chambers: between y -40 and -20 in every overworld biome but the deep dark; tuff and copper
     rooms joined by corridors, combat chambers with trial spawners (one melee, small melee and ranged mob
     chosen per structure), a breeze atrium, vaults and ominous vaults, supply rooms, barrels, pots and
     dispensers with their loot; nothing spawns in its rooms */
SHARED.push(function structures3Module(G) {
  const S = G.StructureGen, { Plan } = S, B = G.BID, SEA = 63;
  const pick = (r, a) => a[r.int(a.length)];
  const shuffle = (r, a) => { for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------------------------------------------------------------- trail ruins
  const TRAIL = new Set(['taiga', 'snowy_taiga', 'old_growth_pine_taiga', 'old_growth_spruce_taiga', 'old_growth_birch_forest', 'jungle']);
  S.reg({ name: 'trail_ruins', dim: 'overworld', spacing: 34, sep: 8, salt: 83469867, reach: 3, flatOk: false,
    check: (gen, x, z) => TRAIL.has(S.biomeAt(gen, x, z)),
    build(gen, r, x, z) {
      if (!TRAIL.has(S.biomeAt(gen, x, z))) return null;
      const h = S.heightAt(gen, x, z); if (h < SEA) return null;
      const y0 = h - 15, k = r.int(4), p = new Plan(x, y0, z, k);
      const TERR = [B.terracotta, B.light_blue_terracotta, B.yellow_terracotta, B.blue_terracotta, B.red_terracotta, B.brown_terracotta, B.cyan_terracotta, B.orange_terracotta];
      const GLASS = [B.light_blue_stained_glass_pane, B.magenta_stained_glass_pane, B.purple_stained_glass_pane, B.red_stained_glass_pane, B.brown_stained_glass_pane, B.yellow_stained_glass_pane];
      const GLAZED = [B.blue_glazed_terracotta, B.light_blue_glazed_terracotta, B.red_glazed_terracotta];
      const palette = () => { const a = pick(r, TERR), b = pick(r, [B.mud_bricks, B.bricks, B.packed_mud, pick(r, TERR)]); return () => { const t = r.next(); return t < 0.55 ? a : t < 0.85 ? b : pick(r, [B.mud_bricks, B.packed_mud, B.cobblestone, B.mossy_cobblestone]); }; };
      // the ruins are buried in gravel; the game's processors turn a fifth of it to dirt and a tenth to coarse dirt
      const rubble = () => { const t = r.next(); return t < 0.2 ? B.dirt : t < 0.3 ? B.coarse_dirt : B.gravel; };
      const surf = (lx, lz) => { const [wx, wz] = p.tx(lx, lz); return S.heightAt(gen, wx, wz); };
      const sus = (lx, ly, lz, rare) => p.sus(lx, ly, lz, B.suspicious_gravel, rare ? 'trail_ruins_rare' : 'trail_ruins_common', r.int(1e9) + 1);
      // the tower; its top may stick out of the ground, crumbling
      const T = 4, th = 13 + r.int(5), wall = palette();
      for (let ly = 0; ly < th; ly++) for (let lx = -T; lx <= T; lx++) for (let lz = -T; lz <= T; lz++) {
        const edge = Math.abs(lx) === T || Math.abs(lz) === T, above = y0 + ly >= h - 1;
        if (above && r.chance(0.4 + (y0 + ly - h + 1) * 0.2)) continue;
        if (edge) p.set(lx, ly, lz, ly % 4 === 2 && (lx === 0 || lz === 0) && !above ? pick(r, GLASS) : ly % 5 === 4 && r.chance(0.15) ? pick(r, GLAZED) : wall());
        else if (ly === 0) p.set(lx, ly, lz, r.chance(0.3) ? B.mud_bricks : B.packed_mud);
        else if (!above) p.set(lx, ly, lz, rubble());
      }
      const topY = Math.min(th - 2, h - 2 - y0);
      for (let i = 0; i < 2; i++) sus(-T + 1 + r.int(2 * T - 1), Math.max(1, topY - r.int(4)), -T + 1 + r.int(2 * T - 1));
      // roads out of the tower, a house at the end of each and sometimes one beside it
      const houses = [];
      const house = (cx, cz, a) => {
        const hw = 2 + r.int(2), hd = 2 + r.int(2), hh = 3 + r.int(3), wl = palette();
        if (surf(cx, cz) < y0 + hh + 1) return;
        for (const q of houses) if (Math.abs(q[0] - cx) < q[2] + hw + 2 && Math.abs(q[1] - cz) < q[3] + hd + 2) return;
        houses.push([cx, cz, hw, hd]);
        const floor = pick(r, [B.mud_bricks, B.packed_mud, pick(r, TERR), B.bricks]);
        for (let lx = -hw; lx <= hw; lx++) for (let lz = -hd; lz <= hd; lz++) for (let ly = 0; ly <= hh; ly++) {
          const edge = Math.abs(lx) === hw || Math.abs(lz) === hd;
          if (ly === 0) { p.set(cx + lx, ly, cz + lz, floor); continue; }
          if (edge) { if (r.chance(0.12 * ly)) p.set(cx + lx, ly, cz + lz, rubble()); else p.set(cx + lx, ly, cz + lz, ly === 2 && r.chance(0.15) ? pick(r, GLASS) : wl()); }
          else p.set(cx + lx, ly, cz + lz, rubble());
        }
        for (let i = 0; i < 9; i++) sus(cx - hw + 1 + r.int(2 * hw - 1), 1 + r.int(Math.min(2, hh - 1)), cz - hd + 1 + r.int(2 * hd - 1), i >= 6);
        void a;
      };
      const dirs = shuffle(r, [[1, 0], [-1, 0], [0, 1], [0, -1]]).slice(0, 2 + r.int(3));
      for (const [dx, dz] of dirs) {
        const len = 10 + r.int(16); let off = 0, ok = 0;
        for (let i = 1; i <= len; i++) {
          if (i > 3 && r.chance(0.12)) off += r.chance(0.5) ? 1 : -1;
          const bx = dx * (T + i) + (dz ? off : 0), bz = dz * (T + i) + (dx ? off : 0);
          if (surf(bx, bz) < y0 + 3) break;
          for (let s = -1; s <= 1; s++) {
            const ax = bx + (dz ? s : 0), az = bz + (dx ? s : 0);
            p.set(ax, 0, az, pick(r, [B.gravel, B.mud_bricks, B.packed_mud, B.cobblestone, B.coarse_dirt, B.mud_bricks]));
            p.set(ax, 1, az, rubble());
          }
          ok = i;
          if (i === Math.floor(len / 2) && r.chance(0.5)) { const side = r.chance(0.5) ? 1 : -1; house(bx + dz * side * 6, bz + dx * side * 6); }
        }
        if (ok > 3) {
          for (let i = 0; i < 2; i++) { const j = 1 + r.int(ok); sus(dx * (T + j) + (dz ? r.int(3) - 1 : 0), r.int(2), dz * (T + j) + (dx ? r.int(3) - 1 : 0)); }
          if (ok === len) house(dx * (T + len + 4) + (dz ? off : 0), dz * (T + len + 4) + (dx ? off : 0));
        }
      }
      p.box(-40, -2, -40, 40, th + 2, 40, 'trail_ruins');
      return p;
    } });

  // ---------------------------------------------------------------- ancient cities
  const deepAt = (gen, x, z) => G.Caves && G.Caves.biomeAt(gen.column(x, z, {}), -27) === 'deep_dark';
  S.reg({ name: 'ancient_city', dim: 'overworld', spacing: 24, sep: 8, salt: 20083232, reach: 5, flatOk: false,
    check: deepAt,
    build(gen, r, x, z) {
      if (!deepAt(gen, x, z)) return null;
      const p = new Plan(x, -52, z, r.int(4)), L = 50, D = 34;
      const DS = [B.deepslate_bricks, B.deepslate_bricks, B.cracked_deepslate_bricks, B.deepslate_tiles, B.cracked_deepslate_tiles, B.polished_deepslate];
      const ds = () => pick(r, DS);
      // the cavern: a foundation, a tiled floor and the air of the halls (taller around the portal and in places)
      // water and lava round the cavern are sealed off first, so carving it doesn't flood the city
      p.lregion(-L - 2, -4, -D - 2, L + 2, 31, D + 2, B.deepslate, 0, 6);
      p.lregion(-L, -4, -D, L, -1, D, B.cobbled_deepslate);
      p.lregion(-L, 1, -D, L, 12, D, 0, 0, 5);
      p.lregion(-24, 13, -15, 24, 28, 15, 0, 0, 5);
      for (let i = 0; i < 8; i++) { const cx = -L + 8 + r.int(2 * L - 16), cz = -D + 6 + r.int(2 * D - 12), w = 5 + r.int(8), d = 4 + r.int(6); p.lregion(cx - w, 13, cz - d, cx + w, 13 + 2 + r.int(6), cz + d, 0, 0, 5); }
      p.lregion(-L, 0, -D, L, 0, D, B.deepslate_tiles);
      p.lregion(-L, 0, -3, L, 0, 3, B.deepslate_bricks); p.lregion(-L, 0, -1, L, 0, 1, B.polished_deepslate);
      for (const sx of [-32, 32]) p.lregion(sx - 2, 0, -D, sx + 2, 0, D, B.deepslate_bricks);
      for (let i = 0; i < 300; i++) p.set(-L + r.int(2 * L + 1), 0, -D + r.int(2 * D + 1), pick(r, [B.cracked_deepslate_tiles, B.cracked_deepslate_bricks, B.gray_wool, B.soul_sand]));
      // the portal: a deepslate frame shaped like the warden's head, lined with reinforced deepslate
      // a stepped platform under it, stairs up each long side
      for (let i = 0; i <= 3; i++) {
        p.lregion(-17 + i, i, -7 + i, 17 - i, i, 7 - i, i === 3 ? B.polished_deepslate : B.deepslate_bricks);
        if (i > 0) for (const s of [-1, 1]) for (let lx = -17 + i; lx <= 17 - i; lx++) p.set(lx, i, s * (7 - i), B.deepslate_tile_stairs, s > 0 ? 2 : 3);
      }
      const frame = (lx, ly) => {
        const ax = Math.abs(lx);
        if (ly < 4 || ly > 26) return null;
        if (ax <= 7 && ly >= 5 && ly <= 18) return ax === 7 || ly === 18 || ly === 5 ? B.reinforced_deepslate : 0; // the opening
        if (ax <= 15 && ly <= 19) return ax >= 13 ? (ly % 3 === 0 ? B.polished_deepslate : B.deepslate_bricks) : ax >= 8 ? B.deepslate_tiles : ly < 5 ? B.deepslate_bricks : null;
        if (ly >= 20 && ly <= 22 && ax <= 15 - (ly - 19) * 2) return ly === 22 ? B.polished_deepslate : B.deepslate_bricks;
        if (ly >= 20 && ly <= 26 && ax >= 11 && ax <= 13 - ((ly - 20) >> 1) + 2 && ax >= 11 + ((ly - 20) >> 1)) return B.deepslate_tiles; // horns
        return null;
      };
      for (let ly = 4; ly <= 26; ly++) for (let lx = -16; lx <= 16; lx++) { const b = frame(lx, ly); if (b === null) continue; for (let lz = -2; lz <= 2; lz++) { if (b === 0) { p.set(lx, ly, lz, 0); continue; } if (b === B.reinforced_deepslate && Math.abs(lz) === 2) { p.set(lx, ly, lz, B.deepslate_tiles); continue; } p.set(lx, ly, lz, b); } }
      // buildings on lots around the portal
      const lots = [];
      for (const lx of [-42, -28, -14, 14, 28, 42]) for (const lz of [-24, -12, 12, 24]) { if (Math.abs(lx) < 20 && Math.abs(lz) < 13) continue; lots.push([lx + r.int(3) - 1, lz + r.int(3) - 1]); }
      shuffle(r, lots);
      let ice = 0, n = 0;
      for (const [cx, cz] of lots) {
        const t = r.next(); n++;
        if (t < 0.38) cityHouse(p, r, cx, cz, ds);
        else if (t < 0.6) cityRuin(p, r, cx, cz, ds);
        else if (t < 0.75) cityTower(p, r, cx, cz);
        else if (t < 0.87 || ice >= 2) cityCampfire(p, r, cx, cz);
        else { ice++; cityIceBox(p, r, cx, cz); }
      }
      // sculk grows over the city: patches of sculk with veins, sensors, shriekers that can summon, a few catalysts
      let shriek = 0, cats = 0;
      for (let i = 0; i < 30; i++) {
        const cx = -L + 3 + r.int(2 * L - 5), cz = -D + 3 + r.int(2 * D - 5), rad = 2 + r.int(4);
        for (let lx = -rad; lx <= rad; lx++) for (let lz = -rad; lz <= rad; lz++) {
          if (lx * lx + lz * lz > rad * rad + 1 || !r.chance(0.75)) continue;
          const ax = cx + lx, az = cz + lz;
          if (Math.abs(ax) <= 17 && Math.abs(az) <= 7) continue;
          p.set(ax, 0, az, B.sculk);
          const t = r.next();
          if (t < 0.03) { p.set(ax, 1, az, B.sculk_sensor, 0, 1); p.be(ax, 1, az, { type: 'sensor', power: 0, freq: 0 }); }
          else if (t < 0.045 && shriek < 12) { p.set(ax, 1, az, B.sculk_shrieker, 2, 1); p.be(ax, 1, az, { type: 'shrieker', warning: 0 }); shriek++; }
          else if (t < 0.05 && cats < 3) { p.set(ax, 0, az, B.sculk_catalyst); p.be(ax, 0, az, { type: 'catalyst', cursors: [] }); cats++; }
          else if (t < 0.2) p.set(ax, 1, az, B.sculk_vein, 32, 1);
        }
      }
      p.box(-L, -4, -D, L, 30, D, 'ancient_city');
      return p;
    } });
  const SKULL = () => B.skeleton_skull;
  function candle(p, r, lx, ly, lz) { p.set(lx, ly, lz, r.chance(0.5) ? B.candle : B.white_candle, r.int(4), 1); }
  function cityHouse(p, r, cx, cz, ds) {
    const hw = 3 + r.int(2), hd = 3 + r.int(2), hh = 4 + r.int(3), door = r.int(4);
    for (let lx = -hw; lx <= hw; lx++) for (let lz = -hd; lz <= hd; lz++) {
      p.set(cx + lx, 0, cz + lz, r.chance(0.5) ? B.dark_oak_planks : B.gray_wool);
      const edge = Math.abs(lx) === hw || Math.abs(lz) === hd;
      for (let ly = 1; ly <= hh; ly++) {
        if (!edge) { p.set(cx + lx, ly, cz + lz, 0); continue; }
        const onDoor = (door === 0 && lz === -hd || door === 1 && lz === hd || door === 2 && lx === -hw || door === 3 && lx === hw) && Math.abs(door < 2 ? lx : lz) <= 1 && ly <= 3;
        if (onDoor) { p.set(cx + lx, ly, cz + lz, 0); continue; }
        if (ly === hh && r.chance(0.3)) continue; // ruined top
        p.set(cx + lx, ly, cz + lz, (Math.abs(lx) === hw && Math.abs(lz) === hd) ? B.polished_deepslate : ly === 2 && r.chance(0.2) ? B.deepslate_brick_wall : ds());
      }
      if (!edge && r.chance(0.7)) p.set(cx + lx, hh + 1, cz + lz, r.chance(0.5) ? B.deepslate_tile_slab : B.dark_oak_slab);
    }
    p.chest(cx - hw + 1 + r.int(2 * hw - 1), 1, cz + (door === 0 ? hd - 1 : -hd + 1), door === 0 ? 2 : 3, 'chests/ancient_city', r.int(1e9) + 1);
    if (r.chance(0.3)) p.chest(cx + (door === 2 ? hw - 1 : -hw + 1), 1, cz, door === 2 ? 4 : 5, 'chests/ancient_city', r.int(1e9) + 1);
    for (let i = 0; i < 3; i++) candle(p, r, cx - hw + 1 + r.int(2 * hw - 1), 1, cz - hd + 1 + r.int(2 * hd - 1));
    if (r.chance(0.5)) p.set(cx - hw + 1, 1, cz + hd - 1, SKULL(), r.int(16));
  }
  function cityRuin(p, r, cx, cz, ds) {
    // broken L-shaped walls with candles and skulls on them
    const len = 4 + r.int(4), h = 2 + r.int(4);
    for (let i = -len; i <= len; i++) for (let ly = 1; ly <= h - (Math.abs(i) > len - 2 ? r.int(3) : 0); ly++) { p.set(cx + i, ly, cz, ds()); if (i === -len) for (let j = 1; j <= 3; j++) p.set(cx + i, ly, cz + j, ds()); }
    for (let i = 0; i < 3; i++) { const a = cx - len + r.int(2 * len + 1); candle(p, r, a, h + 1, cz); }
    if (r.chance(0.4)) p.set(cx + r.int(3), h + 1, cz, SKULL(), r.int(16), 1);
    if (r.chance(0.5)) p.chest(cx + 1, 1, cz + 1, 3, 'chests/ancient_city', r.int(1e9) + 1);
    p.set(cx, 1, cz + 2, B.deepslate_tile_slab, 0, 1);
  }
  function cityTower(p, r, cx, cz) {
    // a hollow basalt-cornered tower with soul lanterns hanging from chains inside
    const h = 10 + r.int(6);
    for (let ly = 1; ly <= h; ly++) for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) {
      const corner = Math.abs(lx) === 2 && Math.abs(lz) === 2, edge = Math.abs(lx) === 2 || Math.abs(lz) === 2;
      if (corner) p.set(cx + lx, ly, cz + lz, B.polished_basalt);
      else if (edge) p.set(cx + lx, ly, cz + lz, ly <= 3 && (lx === 0 || lz === 0) ? 0 : ly % 4 === 0 ? B.polished_deepslate : B.deepslate_bricks);
      else p.set(cx + lx, ly, cz + lz, 0);
    }
    for (let ly = h - 3; ly < h; ly++) p.set(cx, ly, cz, B.chain, 0);
    p.set(cx, h - 4, cz, B.soul_lantern, 8);
    p.set(cx, h + 1, cz, B.deepslate_tile_slab);
    if (r.chance(0.4)) p.chest(cx + 1, 1, cz + 1, 2, 'chests/ancient_city', r.int(1e9) + 1);
  }
  function cityCampfire(p, r, cx, cz) {
    p.set(cx, 0, cz, B.soul_sand); p.set(cx, 1, cz, B.soul_campfire, 2); p.be(cx, 1, cz, { type: 'campfire', items: [null, null, null, null], times: [0, 0, 0, 0] });
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(cx + a, 1, cz + b, B.polished_deepslate_stairs, a > 0 ? 4 : a < 0 ? 5 : b > 0 ? 2 : 3);
    for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { p.set(cx + a, 1, cz + b, B.deepslate_brick_wall); candle(p, r, cx + a, 2, cz + b); }
  }
  function cityIceBox(p, r, cx, cz) {
    // the ice box: packed ice inside deepslate walls, a chest of the ice box's loot
    for (let lx = -3; lx <= 3; lx++) for (let lz = -3; lz <= 3; lz++) for (let ly = 0; ly <= 5; ly++) {
      const edge = Math.abs(lx) === 3 || Math.abs(lz) === 3 || ly === 0 || ly === 5;
      p.set(cx + lx, ly, cz + lz, edge ? (lz === -3 && Math.abs(lx) <= 1 && ly >= 1 && ly <= 3 ? 0 : B.deepslate_tiles) : (Math.abs(lx) === 2 || Math.abs(lz) === 2) && ly <= 3 && r.chance(0.6) ? B.packed_ice : 0);
    }
    p.chest(cx, 1, cz + 1, 2, 'chests/ancient_city_ice_box', r.int(1e9) + 1);
    p.set(cx + 1, 1, cz, B.snow_block || B.packed_ice);
  }

  // ---------------------------------------------------------------- trial chambers
  const notDeep = (gen, x, z) => !G.Caves || G.Caves.biomeAt(gen.column(x, z, {}), -30) !== 'deep_dark';
  S.reg({ name: 'trial_chambers', dim: 'overworld', spacing: 34, sep: 12, salt: 94251327, reach: 5, flatOk: false,
    check: notDeep,
    build(gen, r, x, z) {
      const y0 = -40 + r.int(21); if (!notDeep(gen, x, z)) return null;
      const col = gen.column(x, z, {}); if (G.Caves && G.Caves.biomeAt(col, y0) === 'deep_dark') return null;
      const p = new Plan(x, y0, z, r.int(4));
      p.pieceOnly = true;
      // which mobs this one has (the structure's pool aliases)
      const melee = pick(r, ['melee_zombie', 'melee_husk', 'melee_spider']);
      const small = pick(r, ['small_melee_slime', 'small_melee_cave_spider', 'small_melee_silverfish', 'small_melee_baby_zombie']);
      const ranged = pick(r, ['skeleton', 'stray', 'poison_skeleton']);
      const kinds = [melee, small, 'ranged_' + ranged, 'slow_ranged_' + ranged];
      // a tree of cells on a grid, grown from the middle
      const N = 7, SP = 19, cells = new Map(), edges = [], key = (i, j) => i + ',' + j;
      cells.set(key(3, 3), { i: 3, j: 3, deg: 0, doors: new Set() });
      const want = 13 + r.int(6);
      while (cells.size < want) {
        const list = [...cells.values()], c = pick(r, list), [di, dj] = pick(r, [[1, 0], [-1, 0], [0, 1], [0, -1]]), ni = c.i + di, nj = c.j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N || cells.has(key(ni, nj))) continue;
        const nc = { i: ni, j: nj, deg: 1, doors: new Set() }; c.deg++; cells.set(key(ni, nj), nc); edges.push([c, nc]);
        // the sides with doorways (facings: 2 north -z, 3 south +z, 4 west -x, 5 east +x)
        c.doors.add(di > 0 ? 5 : di < 0 ? 4 : dj > 0 ? 3 : 2); nc.doors.add(di > 0 ? 4 : di < 0 ? 5 : dj > 0 ? 2 : 3);
      }
      const pos = c => [(c.i - 3) * SP, (c.j - 3) * SP];
      // what each cell is: leaves are rooms; the start is the entrance hall; busy cells are intersections
      let atrium = false;
      for (const c of cells.values()) {
        if (c.i === 3 && c.j === 3) c.kind = 'entrance';
        else if (c.deg === 1) { const t = r.next(); c.kind = !atrium && t < 0.25 ? (atrium = true, 'atrium') : t < 0.72 ? 'chamber' : 'supply'; }
        else c.kind = c.deg >= 3 ? 'intersection' : 'corridor';
      }
      if (!atrium) { const leaf = [...cells.values()].find(c => c.kind === 'chamber'); if (leaf) leaf.kind = 'atrium'; }
      const SIZE = { entrance: [5, 7], atrium: [7, 14], chamber: [6, 8], supply: [4, 5], intersection: [4, 6], corridor: [2, 5] };
      const boxes = [];
      for (const c of cells.values()) { const [cx, cz] = pos(c), [hs, hh] = SIZE[c.kind]; boxes.push([cx - hs, cz - hs, cx + hs, cz + hs, hh, c]); }
      for (const [a, b] of edges) { const [ax, az] = pos(a), [bx, bz] = pos(b); boxes.push([Math.min(ax, bx) - 2, Math.min(az, bz) - 2, Math.max(ax, bx) + 2, Math.max(az, bz) + 2, 5, null]); }
      // shells first, then the insides, then the floors (later regions win)
      for (const [x0, z0, x1, z1, hh] of boxes) p.lregion(x0 - 1, -1, z0 - 1, x1 + 1, hh + 1, z1 + 1, B.tuff_bricks);
      for (const [x0, z0, x1, z1, hh] of boxes) p.lregion(x0, 1, z0, x1, hh, z1, 0);
      for (const [x0, z0, x1, z1] of boxes) p.lregion(x0, 0, z0, x1, 0, z1, B.polished_tuff);
      for (const [x0, z0, x1, z1, hh] of boxes) { p.box(x0 - 1, -1, z0 - 1, x1 + 1, hh + 1, z1 + 1, 'trial_chambers'); }
      // corridors: chiseled tuff bands, copper bulbs in the ceiling, copper grate strips, pots and the odd dispenser
      for (const [a, b] of edges) {
        const [ax, az] = pos(a), [bx, bz] = pos(b), alongX = az === bz, len = Math.abs(alongX ? bx - ax : bz - az), sx = Math.sign(bx - ax), sz = Math.sign(bz - az);
        const i0 = SIZE[a.kind][0] + 2, i1 = len - SIZE[b.kind][0] - 2;
        for (let i = i0; i <= i1; i++) {
          const lx = ax + sx * i, lz = az + sz * i;
          if (i % 6 === 3) p.set(lx, 6, lz, B.waxed_copper_bulb, 1);
          else if (i % 2 === 0) p.set(lx, 6, lz, B.waxed_oxidized_copper_grate);
          for (const s of [-3, 3]) { const wx = alongX ? lx : lx + s, wz = alongX ? lz + s : lz; p.set(wx, 1, wz, B.chiseled_tuff_bricks); if (i % 4 === 0) p.set(wx, 3, wz, B.waxed_cut_copper); }
          if (r.chance(0.06)) { const s = r.chance(0.5) ? 2 : -2; potAt(p, r, alongX ? lx : lx + s, 1, alongX ? lz + s : lz); }
          if (i > i0 && i < i1 && r.chance(0.02)) { const s = r.chance(0.5) ? 3 : -3, f = alongX ? (s > 0 ? 2 : 3) : (s > 0 ? 4 : 5); disp(p, r, alongX ? lx : lx + s, 2, alongX ? lz + s : lz, f, 'dispensers/trial_chambers/corridor'); }
        }
        if (r.chance(0.15) && i1 > i0) { const i = i0 + r.int(i1 - i0 + 1); p.chest(ax + sx * i + (alongX ? 0 : 2), 1, az + sz * i + (alongX ? 2 : 0), alongX ? 2 : 4, 'chests/trial_chambers/corridor', r.int(1e9) + 1); }
      }
      for (const c of cells.values()) room(p, r, c, pos(c), SIZE[c.kind], kinds);
      return p;
    } });
  const OPPF = { 2: 3, 3: 2, 4: 5, 5: 4 }; // a vault facing north stands on the south wall
  function potAt(p, r, lx, ly, lz) { p.set(lx, ly, lz, B.decorated_pot, 2, 1); p.be(lx, ly, lz, { type: 'pot', items: [null], loot: 'pots/trial_chambers/corridor', seed: r.int(1e9) + 1 }); }
  function disp(p, r, lx, ly, lz, f, loot) { p.set(lx, ly, lz, B.dispenser, f); p.be(lx, ly, lz, { type: 'container', items: new Array(9).fill(null), loot, seed: r.int(1e9) + 1 }); }
  function spawner(p, lx, ly, lz, kind) { p.set(lx, ly, lz, B.trial_spawner, 0); p.be(lx, ly, lz, { type: 'trial_spawner', kind, mobs: [], spawned: 0, nextAt: 0, cooldownEnd: 0, players: 0, ejectAt: 0, ejectLoot: null, nextItemAt: 0 }); }
  function vault(p, lx, ly, lz, f, ominous) { p.set(lx, ly, lz, B.vault, f | (ominous ? 32 : 0)); p.be(lx, ly, lz, { type: 'vault', rewarded: false, items: [], total: 0, resume: 0, display: null, nextDisplay: 0 }); }
  function room(p, r, c, [cx, cz], [hs, hh], kinds) {
    const lamp = (lx, lz) => p.set(lx, hh + 1, lz, B.waxed_copper_bulb, 1);
    // a band round the walls (leaving the doorways, which are always in the middle of a side)
    const ring = (y, id, door) => { for (let i = -hs; i <= hs; i++) { if (door && Math.abs(i) <= 2) continue; for (const s of [-hs - 1, hs + 1]) { p.set(cx + i, y, cz + s, id); p.set(cx + s, y, cz + i, id); } } };
    if (c.kind === 'corridor') { lamp(cx, cz); return; }
    ring(1, B.chiseled_tuff_bricks, true); if (hh >= 7) ring(hh - 1, B.waxed_cut_copper);
    // a chiseled floor pattern and lights in the ceiling
    for (let i = -hs; i <= hs; i++) for (let j = -hs; j <= hs; j++) if ((Math.abs(i) === Math.abs(j) || i === 0 || j === 0) && (i + j) % 2 === 0 && hs > 3) p.set(cx + i, 0, cz + j, B.chiseled_tuff);
    for (let i = -hs + 2; i <= hs - 2; i += 4) for (let j = -hs + 2; j <= hs - 2; j += 4) lamp(cx + i, cz + j);
    if (c.kind === 'entrance') {
      p.chest(cx - hs + 1, 1, cz - hs + 1, 3, 'chests/trial_chambers/entrance', r.int(1e9) + 1);
      for (const s of [-1, 1]) { p.set(cx + s * (hs - 1), 1, cz + hs - 1, B.waxed_copper_block); potAt(p, r, cx + s * (hs - 1), 2, cz + hs - 1); }
    } else if (c.kind === 'intersection') {
      for (const [a, b] of [[-hs, -hs], [hs, -hs], [-hs, hs], [hs, hs]]) { if (!r.chance(0.6)) continue; p.barrel(cx + a, 1, cz + b, 1, 'chests/trial_chambers/intersection_barrel', r.int(1e9) + 1); }
      if (r.chance(0.5)) p.chest(cx, 1, cz - hs, 3, 'chests/trial_chambers/intersection', r.int(1e9) + 1);
    } else if (c.kind === 'supply') {
      p.chest(cx - hs + 1, 1, cz, 5, 'chests/trial_chambers/supply', r.int(1e9) + 1);
      if (r.chance(0.6)) p.chest(cx + hs - 1, 1, cz, 4, 'chests/trial_chambers/supply', r.int(1e9) + 1);
      for (let i = 0; i < 3; i++) p.set(cx - 1 + i, 1, cz + hs - 1, B.hay_block, 0);
      p.barrel(cx, 1, cz - hs + 1, 1, 'chests/trial_chambers/intersection_barrel', r.int(1e9) + 1);
      potAt(p, r, cx + hs - 1, 1, cz + hs - 1);
    } else if (c.kind === 'chamber') {
      // the fight: two to four spawners round a copper pillar, the vault on a ledge, pots and a supply chest
      for (let ly = 1; ly <= hh; ly++) { p.set(cx, ly, cz, ly % 3 === 0 ? B.waxed_chiseled_copper : B.waxed_copper_block); }
      const spots = shuffle(r, [[-3, -3], [3, -3], [-3, 3], [3, 3]]), n = 2 + r.int(3);
      for (let i = 0; i < n; i++) spawner(p, cx + spots[i][0], 1, cz + spots[i][1], pick(r, kinds));
      const f = pick(r, [2, 3, 4, 5].filter(d => !c.doors.has(OPPF[d]))), [vx, vz] = f === 2 ? [0, hs] : f === 3 ? [0, -hs] : f === 4 ? [hs, 0] : [-hs, 0];
      p.set(cx + vx, 1, cz + vz, B.polished_tuff); vault(p, cx + vx, 2, cz + vz, f, false);
      if (r.chance(0.5)) { const [ox, oz] = vx ? [vx, 2] : [2, vz]; p.set(cx + ox, 1, cz + oz, B.polished_tuff); vault(p, cx + ox, 2, cz + oz, f, true); }
      for (const [a, b] of [[-hs, -hs], [hs, hs]]) potAt(p, r, cx + a, 1, cz + b);
      if (r.chance(0.5)) p.chest(cx - hs, 1, cz + hs, 3, 'chests/trial_chambers/supply', r.int(1e9) + 1);
      if (r.chance(0.3)) disp(p, r, cx + hs + 1, 3, cz, 4, 'dispensers/trial_chambers/chamber');
    } else if (c.kind === 'atrium') {
      // the breeze atrium: a tall hall with a raised breeze spawner in the middle and balconies round the walls
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) p.set(cx + i, 1, cz + j, i || j ? B.tuff_brick_slab : B.chiseled_tuff_bricks);
      spawner(p, cx, 2, cz, 'breeze');
      for (let i = -hs; i <= hs; i++) for (const s of [-hs, -hs + 1, hs - 1, hs]) { p.set(cx + i, 7, cz + s, B.waxed_cut_copper); p.set(cx + s, 7, cz + i, B.waxed_cut_copper); }
      for (let i = -hs + 1; i <= hs - 1; i++) for (const s of [-hs + 1, hs - 1]) { p.set(cx + i, 8, cz + s, B.waxed_copper_grate); p.set(cx + s, 8, cz + i, B.waxed_copper_grate); }
      for (const [a, b] of [[-hs + 1, -hs + 1], [hs - 1, hs - 1]]) spawner(p, cx + a, 1, cz + b, pick(r, kinds));
      const vf = [2, 3, 4, 5].find(d => !c.doors.has(OPPF[d])) || 2, [vx, vz] = vf === 2 ? [0, hs] : vf === 3 ? [0, -hs] : vf === 4 ? [hs, 0] : [-hs, 0];
      vault(p, cx + vx, 1, cz + vz, vf, false);
      for (const [a, b] of [[-hs, hs], [hs, -hs]]) potAt(p, r, cx + a, 1, cz + b);
    }
  }
});
