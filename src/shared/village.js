'use strict';
/* Villages in the five styles of the game (plains, desert, savanna, taiga, snowy): a meeting point with the
   bell, streets that follow the ground, houses facing the streets with beds for their villagers, one building
   per job site (with the matching chest loot), farms, animal pens, lamp posts, an iron golem and cats. */
SHARED.push(function villageModule(G) {
  const { BID: B, BLOCKS, Rand } = G;
  const S = G.Structures, { Plan, biomeAt, heightAt } = S, SEA = 63;
  const STYLE = {
    plains: { wall: B.oak_planks, frame: B.oak_log, base: B.cobblestone, roof: B.oak_stairs, roofSlab: B.oak_slab, roofFull: B.oak_planks, door: B.oak_door, fence: B.oak_fence, gate: B.oak_fence_gate, path: B.dirt_path, floor: B.oak_planks, glass: B.glass_pane, bed: B.red_bed, accent: B.white_wool, trap: B.oak_trapdoor, flowers: [B.poppy, B.dandelion, B.oxeye_daisy, B.azure_bluet], animals: ['cow', 'sheep', 'pig'], vtype: 'plains', log: B.oak_log, crops: ['wheat', 'carrots', 'potatoes', 'beetroots'] },
    desert: { wall: B.sandstone, frame: B.cut_sandstone, base: B.sandstone, roof: B.sandstone_stairs, roofSlab: B.smooth_sandstone_slab, roofFull: B.smooth_sandstone, door: B.jungle_door, fence: B.sandstone_wall, gate: B.jungle_fence_gate, path: B.smooth_sandstone, floor: B.smooth_sandstone, glass: B.glass_pane, bed: B.green_bed, accent: B.terracotta, trap: B.jungle_trapdoor, flowers: [B.dead_bush, B.cactus], animals: ['camel', 'goat', 'rabbit'], vtype: 'desert', flat: true, log: B.cut_sandstone, crops: ['wheat', 'carrots', 'potatoes'] },
    savanna: { wall: B.acacia_planks, frame: B.acacia_log, base: B.cobblestone, roof: B.acacia_stairs, roofSlab: B.acacia_slab, roofFull: B.acacia_planks, door: B.acacia_door, fence: B.acacia_fence, gate: B.acacia_fence_gate, path: B.dirt_path, floor: B.acacia_planks, glass: B.glass_pane, bed: B.orange_bed, accent: B.orange_terracotta, trap: B.acacia_trapdoor, flowers: [B.poppy, B.dandelion], animals: ['sheep', 'cow', 'horse'], vtype: 'savanna', log: B.acacia_log, crops: ['wheat', 'carrots', 'potatoes', 'beetroots'] },
    taiga: { wall: B.spruce_planks, frame: B.spruce_log, base: B.cobblestone, roof: B.spruce_stairs, roofSlab: B.spruce_slab, roofFull: B.spruce_planks, door: B.spruce_door, fence: B.spruce_fence, gate: B.spruce_fence_gate, path: B.dirt_path, floor: B.spruce_planks, glass: B.glass_pane, bed: B.brown_bed, accent: B.mossy_cobblestone, trap: B.spruce_trapdoor, flowers: [B.fern, B.sweet_berry_bush, B.pumpkin], animals: ['sheep', 'cow', 'pig'], vtype: 'taiga', log: B.spruce_log, crops: ['wheat', 'carrots', 'potatoes', 'beetroots'] },
    snowy: { wall: B.spruce_planks, frame: B.stripped_spruce_log, base: B.cobblestone, roof: B.spruce_stairs, roofSlab: B.spruce_slab, roofFull: B.spruce_planks, door: B.spruce_door, fence: B.spruce_fence, gate: B.spruce_fence_gate, path: B.dirt_path, floor: B.spruce_planks, glass: B.glass_pane, bed: B.light_blue_bed, accent: B.packed_ice, trap: B.spruce_trapdoor, flowers: [B.blue_orchid], animals: ['sheep', 'pig', 'rabbit'], vtype: 'snow', log: B.stripped_spruce_log, crops: ['wheat', 'carrots', 'potatoes', 'beetroots'] },
  };
  const STYLE_OF = { plains: 'plains', meadow: 'plains', sunflower_plains: 'plains', desert: 'desert', savanna: 'savanna', savanna_plateau: 'savanna', taiga: 'taiga', snowy_plains: 'snowy' };
  const JOBS = [['armorer', 'blast_furnace', 'chests/village/village_armorer'], ['butcher', 'smoker', 'chests/village/village_butcher'], ['cartographer', 'cartography_table', 'chests/village/village_cartographer'],
    ['cleric', 'brewing_stand', 'chests/village/village_temple'], ['fisherman', 'barrel', 'chests/village/village_fisher'], ['fletcher', 'fletching_table', 'chests/village/village_fletcher'],
    ['leatherworker', 'cauldron', 'chests/village/village_tannery'], ['librarian', 'lectern', null], ['mason', 'stonecutter', 'chests/village/village_mason'], ['shepherd', 'loom', 'chests/village/village_shepherd'],
    ['toolsmith', 'smithing_table', 'chests/village/village_toolsmith'], ['weaponsmith', 'grindstone', 'chests/village/village_weaponsmith']];
  const HOUSE_LOOT = { plains: 'chests/village/village_plains_house', desert: 'chests/village/village_desert_house', savanna: 'chests/village/village_savanna_house', taiga: 'chests/village/village_taiga_house', snowy: 'chests/village/village_snowy_house' };

  // ---------------------------------------------------------------- one building: a box with a pitched (or flat) roof, front door at z = 0
  function building(p, st, r, w, d, h, o) {
    o = o || {};
    // clear the space and lay the foundation
    p.fill(-1, 1, -1, w, h + 6, d, 0);
    p.fill(0, 0, 0, w - 1, 0, d - 1, st.base, 0, 2);
    p.fill(1, 0, 1, w - 2, 0, d - 2, st.floor);
    // walls with log (or cut sandstone) corners
    for (let y = 1; y <= h; y++) for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
      if (x > 0 && x < w - 1 && z > 0 && z < d - 1) continue;
      const corner = (x === 0 || x === w - 1) && (z === 0 || z === d - 1);
      p.set(x, y, z, corner ? st.frame : (y === 1 && st.base !== st.wall && !st.flat ? st.base : st.wall), corner && !st.flat ? 0 : 0);
    }
    // windows on the sides and the back
    for (let z = 2; z < d - 2; z += 3) { p.set(0, 2, z, st.glass); p.set(w - 1, 2, z, st.glass); }
    for (let x = 2; x < w - 2; x += 3) if (x !== (w >> 1)) p.set(x, 2, d - 1, st.glass);
    // the door in the middle of the front, a step and a light over it
    const dx = w >> 1;
    p.set(dx, 1, 0, st.door, 3); p.set(dx, 2, 0, st.door, 3 | 8);
    p.set(dx, 3, -1, B.wall_torch, 2);
    // the roof
    if (st.flat) {
      p.fill(0, h + 1, 0, w - 1, h + 1, d - 1, st.roofFull);
      for (let x = 0; x < w; x++) { p.set(x, h + 2, 0, st.roofSlab); p.set(x, h + 2, d - 1, st.roofSlab); }
      for (let z = 0; z < d; z++) { p.set(0, h + 2, z, st.roofSlab); p.set(w - 1, h + 2, z, st.roofSlab); }
    } else {
      // gable roof: ridge along x, slopes over the front and back, gables filled with wall
      for (let i = 0; ; i++) {
        const fz = i - 1, bz = d - i, y = h + 1 + i;
        if (fz > bz) break;
        for (let x = -1; x <= w; x++) {
          if (fz === bz) { p.set(x, y, fz, st.roofSlab); continue; }
          p.set(x, y, fz, st.roof, 3); p.set(x, y, bz, st.roof, 2);
          if ((x === 0 || x === w - 1) && i > 0) for (let z = Math.max(0, fz + 1); z <= Math.min(d - 1, bz - 1); z++) p.set(x, y, z, st.wall);
        }
      }
    }
    // inside: a light
    p.set(1, h, 1, B.wall_torch, 5);
    if (o.beds) for (let i = 0; i < o.beds; i++) { const bx = 1 + i * 2; if (bx >= w - 1) break; p.set(bx, 1, d - 2, st.bed, 3 | 8); p.set(bx, 1, d - 3, st.bed, 3); }
  }
  // ---------------------------------------------------------------- the pieces
  const PIECES = {
    small(p, st, r, ctx) { building(p, st, r, 5, 5, 3, { beds: 1 }); p.set(3, 1, 1, B.crafting_table); ctx.villagers(p, 2, 1, 2, 1); return [5, 5]; },
    medium(p, st, r, ctx) { building(p, st, r, 7, 6, 3, { beds: 2 }); p.set(5, 1, 1, B.crafting_table); p.chest(1, 1, 1, 5, HOUSE_LOOT[ctx.style], r.int(1e9)); p.set(5, 1, 2, B.flower_pot, S.Models_POT('poppy')); ctx.villagers(p, 3, 1, 3, 2); return [7, 6]; },
    big(p, st, r, ctx) {
      building(p, st, r, 9, 7, 4, { beds: 3 });
      p.fill(1, 1, 3, 3, 1, 3, st.fence); p.set(7, 1, 1, B.furnace, 4); p.chest(1, 1, 1, 5, HOUSE_LOOT[ctx.style], r.int(1e9)); p.set(7, 1, 2, B.crafting_table);
      ctx.villagers(p, 4, 1, 3, 3); return [9, 7];
    },
    job(p, st, r, ctx) {
      const job = ctx.nextJob(); if (!job) return PIECES.small(p, st, r, ctx);
      const [name, block, loot] = job;
      if (name === 'farmer') return PIECES.farm(p, st, r, ctx, true);
      if (name === 'cleric') {
        // the temple: a taller building with a stained-glass window
        building(p, st, r, 5, 7, 6, {});
        p.set(2, 4, 6, B.yellow_stained_glass_pane || st.glass); p.set(2, 5, 6, B.yellow_stained_glass_pane || st.glass);
        p.set(2, 1, 5, B[block], 0); p.chest(1, 1, 5, 5, loot, r.int(1e9));
        ctx.villagers(p, 2, 1, 3, 1); return [5, 7];
      }
      if (name === 'librarian') {
        building(p, st, r, 7, 7, 4, {});
        for (let x = 1; x <= 5; x++) for (let y = 1; y <= 3; y++) if (x !== 3) p.set(x, y, 5, B.bookshelf);
        p.set(3, 1, 4, B.lectern, 2); ctx.villagers(p, 3, 1, 2, 1); return [7, 7];
      }
      building(p, st, r, 7, 6, 3, {});
      const st2 = name === 'armorer' || name === 'smoker' ? 2 : 2;
      p.set(3, 1, 4, B[block], st2);
      if (loot) p.chest(5, 1, 4, 4, loot, r.int(1e9));
      if (name === 'fisherman') { p.fill(1, 1, 2, 2, 1, 3, B.water); }
      if (name === 'butcher') { p.set(1, 1, 4, B.oak_slab || st.roofSlab); p.set(1, 2, 4, B.hay_block); }
      if (name === 'weaponsmith' || name === 'armorer' || name === 'toolsmith') { p.set(1, 1, 2, B.anvil, 3); p.set(1, 1, 4, B.cauldron, 1 << 2); }
      ctx.villagers(p, 3, 1, 2, 1);
      return [7, 6];
    },
    // a farm: crops in rows either side of a water channel, framed by logs, with the farmer's composter
    farm(p, st, r, ctx, composter) {
      const w = 7, d = 9;
      p.fill(-1, 1, -1, w, 4, d, 0);
      p.fill(0, -1, 0, w - 1, -1, d - 1, st.base === B.sandstone ? B.sandstone : B.dirt, 0, 2);
      for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
        const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (edge) { p.set(x, 0, z, st.log, (x === 0 || x === w - 1) ? 2 : 1); continue; }
        if (x === 3) { p.set(x, 0, z, B.water); continue; }
        p.set(x, 0, z, B.farmland, 7);
        const crop = B[r.pick(st.crops)], age = r.int(8);
        p.set(x, 1, z, crop, crop === B.beetroots ? Math.min(3, age) : age);
      }
      if (composter) p.set(-1, 1, 4, B.composter, 0);
      return [w, d];
    },
    pen(p, st, r, ctx) {
      const w = 7, d = 7;
      p.fill(-1, 1, -1, w, 3, d, 0);
      for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) if (x === 0 || z === 0 || x === w - 1 || z === d - 1) p.set(x, 1, z, x === 3 && z === 0 ? st.gate : st.fence, x === 3 && z === 0 ? 2 : 0);
      p.set(5, 1, 5, B.hay_block); p.set(1, 1, 5, B.cauldron, 3);
      for (let i = 0; i < 2 + r.int(3); i++) p.ent(2 + r.int(3), 1, 2 + r.int(3), { type: r.pick(st.animals), persistent: true });
      return [w, d];
    },
  };
  // the meeting point: a well (with water) under a roof that holds the bell
  function meetingPoint(p, st, r) {
    p.fill(-3, 1, -3, 3, 6, 3, 0);
    p.fill(-2, 0, -2, 2, 0, 2, st.base, 0, 2);
    p.fill(-1, -1, -1, 1, 0, 1, B.water); p.fill(-1, -2, -1, 1, -2, 1, st.base);
    for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) p.fill(a, 1, b, a, 3, b, st.fence);
    p.fill(-2, 4, -2, 2, 4, 2, st.roofSlab); p.set(0, 4, 0, st.roofFull);
    p.set(0, 3, 0, B.bell, 2);
    for (const [a, b] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) p.set(a, 1, b, st.base === B.sandstone ? B.sandstone_wall : B.cobblestone_wall);
  }
  function lampPost(p, st) { p.fill(0, 1, 0, 0, 2, 0, st.fence); p.set(0, 3, 0, st.base === B.sandstone ? B.cut_sandstone : B.white_wool); p.set(0, 4, 0, B.torch); }

  // ---------------------------------------------------------------- the village
  function buildVillage(gen, r, x, z) {
    const styleName = STYLE_OF[biomeAt(gen, x, z)]; if (!styleName) return null;
    const st = STYLE[styleName], h0 = heightAt(gen, x, z);
    if (h0 < SEA && !gen.flat) return null;
    const p = new Plan(x, 0, z, 0);
    const occupied = [];
    const free = (x0, z0, x1, z1) => occupied.every(o => x1 < o[0] || x0 > o[2] || z1 < o[1] || z0 > o[3]);
    const take = (x0, z0, x1, z1) => occupied.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
    const groundOk = (x0, z0, x1, z1) => { let lo = 1e9, hi = -1e9; for (const [a, b] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) >> 1, (z0 + z1) >> 1]]) { const c = gen.column(a, b, {}); if ((c.h < SEA && !gen.flat) || /ocean|river/.test(G.BIOMES[c.biome].name)) return null; lo = Math.min(lo, c.h); hi = Math.max(hi, c.h); } return hi - lo <= 4 ? { lo, hi } : null; };
    // jobs: a shuffled list, each once
    const jobs = JOBS.slice(); for (let i = jobs.length - 1; i > 0; i--) { const j = r.int(i + 1); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; }
    jobs.unshift(['farmer', 'composter', null]);
    let houses = 0;
    const ctx = {
      style: styleName, nextJob: () => jobs.shift(),
      villagers(pp, lx, ly, lz, n) { for (let i = 0; i < n; i++) pp.ent(lx + (i % 2 ? 0.3 : -0.3), ly, lz, { type: 'villager', vtype: st.vtype, persistent: true }); houses++; },
    };
    // the meeting point
    meetingPoint(p.sub(0, h0, 0, 0), st, r); take(x - 4, z - 4, x + 4, z + 4);
    // streets: 3 wide, following the ground; houses on both sides facing the street
    const street = (sx, sz, dir, len, depth) => {
      const DX = [0, 1, 0, -1][dir], DZ = [-1, 0, 1, 0][dir];
      let built = 0;
      for (let i = 0; i < len; i++) {
        const cx = sx + DX * i, cz = sz + DZ * i, c = gen.column(cx, cz, {});
        if ((c.h < SEA && !gen.flat) || /ocean|river/.test(G.BIOMES[c.biome].name)) break;
        for (let k = -1; k <= 1; k++) {
          const px = cx + (DZ !== 0 ? k : 0), pz = cz + (DX !== 0 ? k : 0), ph = heightAt(gen, px, pz);
          p.put(px, ph, pz, st.path, 0, 0); p.put(px, ph + 1, pz, 0, 0, 0); p.put(px, ph + 2, pz, 0, 0, 0);
        }
        take(cx - 1, cz - 1, cx + 1, cz + 1); built++;
        // lots on either side every few blocks
        if (i > 3 && i % 9 === 4) for (const side of [-1, 1]) {
          const kind = r.chance(0.5) ? 'job' : r.pick(['small', 'medium', 'big', 'small', 'farm', 'pen']);
          const [w, d] = kind === 'big' ? [9, 7] : kind === 'medium' ? [7, 6] : kind === 'farm' ? [7, 9] : kind === 'pen' ? [7, 7] : kind === 'job' ? [7, 7] : [5, 5];
          // the lot's front edge is two blocks from the street centre, the building faces the street
          const nx = DZ !== 0 ? side * -DZ : 0, nz = DX !== 0 ? side * DX : 0; // the side direction
          const fx = cx + nx * 3, fz = cz + nz * 3; // front middle of the lot
          // rotation so local north (front) points back at the street: the front faces -side
          const faceDir = nx === 1 ? 3 : nx === -1 ? 1 : nz === 1 ? 0 : 2; // k turns: local -z maps to the street side
          const k = [0, 1, 2, 3][faceDir];
          // local origin: front-left corner
          const corners = [];
          const tmp = new Plan(fx, 0, fz, k); const o = tmp.tx(-(w >> 1), 0); const far = tmp.tx(w - 1 - (w >> 1), d - 1);
          corners.push(o, far);
          const x0 = Math.min(o[0], far[0]), x1 = Math.max(o[0], far[0]), z0 = Math.min(o[1], far[1]), z1 = Math.max(o[1], far[1]);
          if (!free(x0 - 1, z0 - 1, x1 + 1, z1 + 1)) continue;
          const g = groundOk(x0, z0, x1, z1); if (!g) continue;
          take(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
          const floorY = kind === 'farm' || kind === 'pen' ? g.lo : g.lo + (g.hi - g.lo > 1 ? 1 : 0);
          const sub = p.sub(0, 0, 0, 0); sub.ox = o[0]; sub.oz = o[1]; sub.oy = floorY - (kind === 'farm' ? 0 : 0); sub.k = k;
          PIECES[kind](sub, st, r, ctx);
          // a short path from the door to the street
          const door = tmp.tx(0, -1), ph = heightAt(gen, door[0], door[1]);
          p.put(door[0], ph, door[1], st.path, 0, 0); p.put(door[0], ph + 1, door[1], 0, 0, 0);
        }
        if (i > 0 && i % 12 === 0 && r.chance(0.7)) { const lx = cx + (DZ !== 0 ? 2 : 0), lz = cz + (DX !== 0 ? 2 : 0); if (free(lx, lz, lx, lz)) { const lp = p.sub(0, 0, 0, 0); lp.ox = lx; lp.oz = lz; lp.oy = heightAt(gen, lx, lz); lampPost(lp, st); take(lx, lz, lx, lz); } }
        // side streets
        if (depth < 1 && i > 6 && i % 13 === 6 && r.chance(0.8)) street(cx + DZ * 2 * (r.chance(0.5) ? 1 : -1), cz + DX * 2, r.chance(0.5) ? (dir + 1) % 4 : (dir + 3) % 4, 10 + r.int(14), depth + 1);
      }
      return built;
    };
    for (let dir = 0; dir < 4; dir++) if (dir === 0 || r.chance(0.75)) street(x + [0, 4, 0, -4][dir], z + [-4, 0, 4, 0][dir], dir, 16 + r.int(16), 0);
    if (houses < 2) return null;
    p.treeless = occupied;
    // an iron golem and a cat or two near the middle
    p.ent(3, h0 + 1, 3, { type: 'iron_golem', persistent: true, playerMade: false });
    if (styleName !== 'desert' && r.chance(0.6)) p.ent(-3, h0 + 1, 3, { type: 'cat', persistent: true });
    p.box(-48, h0 - 10, -48, 48, h0 + 20, 48, 'village');
    return p;
  }
  S.reg({ name: 'village', dim: 'overworld', spacing: 34, sep: 8, salt: 10387312, reach: 4, flatOk: true,
    check: (gen, x, z) => !!STYLE_OF[biomeAt(gen, x, z)],
    build: buildVillage });
  G.VillageStyles = STYLE;
});
