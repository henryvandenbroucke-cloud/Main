'use strict';
/* Placing blocks: where a block goes, which way it faces, and whether it can stay there (the game's placement
   rules for logs, slabs, stairs, doors, beds, torches, ladders, signs, rails, plants...). */
const Place = (() => {
  const H4 = [2, 5, 3, 4]; // north, east, south, west
  // the horizontal direction the player looks (2 north, 3 south, 4 west, 5 east)
  function lookDir(p) { const a = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360; return [2, 5, 3, 4][Math.floor((a + 45) / 90) % 4]; }
  function look6(p) { if (p.pitch > 0.8) return 0; if (p.pitch < -0.8) return 1; return lookDir(p); }
  const solidTop = (x, y, z) => { const id = World.getBlock(x, y, z), d = BLOCKS[id]; if (d.opaque) return true; const sh = Models.shape(id, World.getState(x, y, z), x, y, z, true); return !!sh && sh.some(b => b[4] >= 1 && b[0] <= 0.25 && b[3] >= 0.75 && b[2] <= 0.25 && b[5] >= 0.75) || d.model === 'slab' && ((World.getState(x, y, z) >> 3) & 3) >= 1 || d.model === 'stairs' && (World.getState(x, y, z) & 8); };
  const sturdyFace = (x, y, z) => { const d = BLOCKS[World.getBlock(x, y, z)]; return d.opaque || d.model === 'glazed' || (d.model === 'slab' && ((World.getState(x, y, z) >> 3) & 3) === 2); };
  const soil = id => [BID.grass_block, BID.dirt, BID.coarse_dirt, BID.podzol, BID.rooted_dirt, BID.farmland, BID.moss_block, BID.mud, BID.muddy_mangrove_roots, BID.mycelium].includes(id);
  // may block id stand at (x,y,z)?
  function canSurvive(id, st, x, y, z) {
    const d = BLOCKS[id], n = d.name, below = World.getBlock(x, y - 1, z), bd = BLOCKS[below];
    switch (d.place) {
      case 'plant': if (n === 'flower_pot' || n === 'cake' || d.model === 'azalea') return n === 'cake' ? SOLID[below] === 1 : SOLID[below] === 1 || soil(below); if (n === 'pink_petals') return soil(below); return soil(below) || (n === 'wither_rose' && (below === BID.soul_sand || below === BID.soul_soil || below === BID.netherrack));
      case 'sapling': return soil(below) || (n === 'mangrove_propagule' && (below === BID.clay || below === BID.mud));
      case 'tall_plant': return (st & 8) ? World.getBlock(x, y - 1, z) === id : soil(below);
      case 'mushroom': return SOLID[below] && (World.lightLevel(x, y, z) < 13 || below === BID.mycelium || below === BID.podzol);
      case 'dead_bush': return [BID.sand, BID.red_sand, BID.terracotta, BID.dirt, BID.coarse_dirt, BID.podzol, BID.grass_block].includes(below) || bd.name.endsWith('_terracotta');
      case 'nether_plant': return [BID.crimson_nylium, BID.warped_nylium, BID.soul_soil, BID.grass_block, BID.dirt, BID.podzol, BID.mycelium, BID.moss_block, BID.netherrack].includes(below) || soil(below);
      case 'sugar_cane': { if (below === id) return true; if (![BID.grass_block, BID.dirt, BID.sand, BID.red_sand, BID.coarse_dirt, BID.podzol, BID.mud, BID.moss_block, BID.rooted_dirt].includes(below)) return false; for (let f = 2; f < 6; f++) { const w = World.getBlock(x + DX[f], y - 1, z + DZ[f]); if (BLOCKS[w].fluid === 'water' || w === BID.ice || w === BID.frosted_ice) return true; } return false; }
      case 'cactus': { if (below !== id && below !== BID.sand && below !== BID.red_sand) return false; for (let f = 2; f < 6; f++) if (SOLID[World.getBlock(x + DX[f], y, z + DZ[f])] || BLOCKS[World.getBlock(x + DX[f], y, z + DZ[f])].fluid === 'lava') return false; return true; }
      case 'bamboo': return below === id || soil(below) || below === BID.sand || below === BID.red_sand || below === BID.gravel || below === BID.bamboo;
      case 'torch': case 'floor': return solidTop(x, y - 1, z) || (d.place === 'torch' && (bd.model === 'fence' || bd.model === 'wall' || bd.model === 'pane'));
      case 'wall': { const f = st & 7; return sturdyFace(x - DX[f], y, z - DZ[f]); }
      case 'switch': { const face = (st >> 3) & 3; if (face === 0) return solidTop(x, y - 1, z); if (face === 2) return SOLID[World.getBlock(x, y + 1, z)] === 1; const f = st & 7; return sturdyFace(x - DX[f], y, z - DZ[f]); }
      case 'rail': return solidTop(x, y - 1, z);
      case 'door': return (st & 8) ? World.getBlock(x, y - 1, z) === id : solidTop(x, y - 1, z);
      case 'lily': return bd.fluid === 'water' || below === BID.ice;
      case 'water_plant': return BLOCKS[below].opaque || below === id || below === BID.kelp_plant;
      case 'vine': return st !== 0;
      case 'ceiling': return SOLID[World.getBlock(x, y + 1, z)] === 1;
      case 'hanging': return SOLID[World.getBlock(x, y + 1, z)] === 1 || World.getBlock(x, y + 1, z) === BID.weeping_vines_plant || World.getBlock(x, y + 1, z) === id;
      case 'twisting': return SOLID[below] === 1 || below === BID.twisting_vines_plant || below === id;
      case 'lantern': return (st & 8) ? World.getBlock(x, y + 1, z) !== 0 : SOLID[below] === 1 || bd.model === 'fence' || bd.model === 'wall';
      case 'chorus_flower': return below === BID.end_stone || below === BID.chorus_plant;
      case 'pickle': return bd.opaque;
      case 'sign': case 'banner': return SOLID[below] === 1 || bd.model === 'fence' || bd.model === 'wall';
      case 'hanging_sign': { const a = World.getBlock(x, y + 1, z); return a !== 0 && !BLOCKS[a].replaceable; }
      case 'water_plant_any': return solidTop(x, y - 1, z);
      case 'candle': return solidTop(x, y - 1, z) || bd.model === 'fence' || bd.model === 'wall';
      case 'dripstone': return true;
    }
    if (n === 'wheat' || n === 'carrots' || n === 'potatoes' || n === 'beetroots' || n === 'pumpkin_stem' || n === 'melon_stem' || n === 'attached_pumpkin_stem' || n === 'attached_melon_stem') return below === BID.farmland;
    if (n === 'nether_wart') return below === BID.soul_sand;
    if (n === 'torchflower_crop' || (n === 'pitcher_crop' && !(st & 8))) return below === BID.farmland;
    if (n === 'pitcher_crop') return World.getBlock(x, y - 1, z) === id;
    if (d.model === 'wall_fan') { const f = st & 7; return sturdyFace(x - DX[f], y, z - DZ[f]); }
    if (d.model === 'wall_hanging_sign') { const f = st & 7, sx = f === 2 || f === 3 ? 1 : 0, sz = 1 - sx; return SOLID[World.getBlock(x + sx, y, z + sz)] === 1 || SOLID[World.getBlock(x - sx, y, z - sz)] === 1 || World.getBlock(x, y + 1, z) !== 0; }
    if (n === 'turtle_egg') return below === BID.sand || below === BID.red_sand || SOLID[below] === 1;
    if (n === 'sniffer_egg' || d.model === 'shrieker' || d.model === 'sensor' || n === 'heavy_core' || n === 'decorated_pot') return true;
    if (n === 'sweet_berry_bush') return soil(below);
    if (n === 'cocoa') { const f = st & 7; const l = World.getBlock(x + DX[f], y, z + DZ[f]); return l === BID.jungle_log || l === BID.jungle_wood || l === BID.stripped_jungle_log || l === BID.stripped_jungle_wood; }
    if (n === 'kelp_plant' || n === 'tall_seagrass') return true;
    if (d.model === 'wall_torch' || d.model === 'wall_sign' || d.model === 'wall_banner') { const f = st & 7; return SOLID[World.getBlock(x - DX[f], y, z - DZ[f])] === 1; }
    if (d.model === 'carpet' || d.model === 'plate' || d.model === 'wire' || d.model === 'repeater' || d.model === 'comparator') return SOLID[below] === 1 || (d.model === 'carpet' && below !== 0);
    if (d.model === 'bed') return true;
    if (n === 'snow') return SOLID[below] && below !== BID.ice && below !== BID.packed_ice && below !== BID.barrier || below === BID.snow && (World.getState(x, y - 1, z) & 7) === 7 || bd.name.endsWith('_leaves');
    if (n === 'fire') return SOLID[below] === 1 || Fire.flammableAround(x, y, z);
    if (n === 'soul_fire') return below === BID.soul_sand || below === BID.soul_soil;
    return true;
  }
  // place the block of item stack s against the hit; returns true when something was placed
  function tryPlace(p, s, hit, offhand) {
    const it = ITEMS[s.id];
    let id = it.block; if (id < 0) return false;
    if (p.gamemode === 'adventure') return false;
    const hd = BLOCKS[hit.id];
    let x = hit.x, y = hit.y, z = hit.z, face = hit.face;
    const fx = hit.px - x, fy = hit.py - y, fz = hit.pz - z;
    // slabs merge into a double slab; snow layers and sea pickles stack; candles... (not here)
    if (hd.model === 'slab' && hit.id === id && ((hit.state >> 3) & 3) < 2) {
      const t = (hit.state >> 3) & 3;
      if ((t === 0 && face === 1) || (t === 1 && face === 0)) return commit(p, s, x, y, z, id, (2 << 3) | (hit.state & 128 ? 0 : 0), offhand);
    }
    if (hit.id === id && BLOCKS[id].name === 'snow' && (hit.state & 7) < 7) return commit(p, s, x, y, z, id, (hit.state & 7) + 1, offhand);
    if (hit.id === id && BLOCKS[id].name === 'sea_pickle' && (hit.state & 3) < 3) return commit(p, s, x, y, z, id, (hit.state & ~3) | ((hit.state & 3) + 1), offhand);
    // candles and turtle eggs stack up to four; a candle on an untouched cake makes a candle cake
    if (hit.id === id && (BLOCKS[id].model === 'candle' || BLOCKS[id].model === 'turtle_egg') && (hit.state & 3) < 3) return commit(p, s, x, y, z, id, hit.state + 1, offhand, true);
    if (BLOCKS[id].model === 'candle' && hit.id === BID.cake && (hit.state & 7) === 0 && face === 1) return commit(p, s, x, y, z, BID[BLOCKS[id].name + '_cake'], 0, offhand, true);
    if (!hd.replaceable || (hd.fluid && hit.id !== 0 && false)) { x += DX[face]; y += DY[face]; z += DZ[face]; }
    else face = 1;
    // a slab placed into the free half of a slab in the neighbouring block
    const cur = World.getBlock(x, y, z), cd = BLOCKS[cur];
    if (cd.model === 'slab' && cur === id && ((World.getState(x, y, z) >> 3) & 3) < 2) return commit(p, s, x, y, z, id, 2 << 3, offhand);
    if (!cd.replaceable) return false;
    if (y < MINY || y > MAXY) return false;
    let st = 0;
    const d = BLOCKS[id], L = lookDir(p);
    const waterHere = cd.fluid === 'water' && (World.getState(x, y, z) & 7) === 0;
    switch (d.place) {
      case 'axis': st = face < 2 ? 0 : face < 4 ? 2 : 1; break;
      case 'facing_h': st = d.model === 'glazed' ? OPP[L] : L; if (d.name === 'chiseled_bookshelf') st = L - 2; if (d.model === 'repeater' || d.model === 'comparator') st = L; if (d.name === 'campfire' || d.name === 'soul_campfire' || d.name === 'bell') st = OPP[L]; if (d.name === 'calibrated_sculk_sensor') st = OPP[L] << 2; break;
      case 'facing_h_opp': st = OPP[L]; if (d.model === 'repeater' || d.model === 'comparator') st = L; break;
      case 'facing_h_rot': st = { 2: 5, 5: 3, 3: 4, 4: 2 }[L]; if (d.name === 'grindstone') st = OPP[L]; break;
      case 'facing6': st = face; if (d.name === 'observer') st = look6(p); break;
      case 'facing6_opp': st = OPP[look6(p)]; if (d.name === 'barrel' || d.name.endsWith('shulker_box')) st = face; break;
      case 'leaves': st = 8; break;
      case 'slab': st = (face === 0 || (face > 1 && fy > 0.5)) ? 1 << 3 : 0; break;
      case 'stairs': st = L | ((face === 0 || (face > 1 && fy > 0.5)) ? 8 : 0); break;
      case 'gate': st = L; break;
      case 'trapdoor': st = face > 1 ? face : OPP[L]; if (face === 0 || (face > 1 && fy > 0.5)) st |= 8; break;
      case 'torch':
        if (face === 0) return false;
        if (face > 1) { id = it.wall; st = face; if (!canSurvive(id, st, x, y, z)) { if (canSurvive(it.block, 0, x, y, z)) { id = it.block; st = 0; } else return false; } }
        break;
      case 'wall': if (face < 2) return false; st = face; break;
      case 'switch': if (face === 1) st = (0 << 3) | L; else if (face === 0) st = (2 << 3) | L; else st = (1 << 3) | face; if (d.model === 'lever' && face < 2) st = (st & ~7) | OPP[L]; break;
      case 'lantern': st = face === 0 ? 8 : 0; if (!canSurvive(id, st, x, y, z)) st ^= 8; break;
      case 'sign': case 'banner':
        if (face === 0) return false;
        if (face > 1 && it.wall !== undefined) { id = it.wall; st = face; }
        else if (face > 1) return false;
        else st = Math.round((((-p.yaw * 180 / Math.PI) + 180) % 360 + 360) % 360 / 22.5) & 15;
        break;
      case 'skull': st = face > 1 ? face : 0; break;
      case 'hopper': st = face === 1 || face === 0 ? 0 : OPP[face]; break;
      case 'vine': {
        // glow lichen and sculk veins cling to any face (floors and ceilings too); vines hang from sides and tops
        if (d.name === 'glow_lichen' || d.name === 'sculk_vein') { st = [16, 32, 2, 1, 8, 4][face] | (waterHere ? 128 : 0); break; }
        if (face === 0) return false; st = face === 1 ? 16 : [0, 0, 2, 1, 8, 4][face]; break;
      }
      case 'pickle': st = waterHere ? 128 : 0; break;
      case 'rail': st = Rails.shapeFor(x, y, z, L); break;
      case 'chest': {
        st = OPP[L];
        if (!p.sneaking) {
          // join a single chest of the same kind next to it that faces the same way
          const side = { 2: [5, 4], 3: [4, 5], 4: [2, 3], 5: [3, 2] }[st];
          for (const [k, sf] of [[0, side[0]], [1, side[1]]]) {
            const nx = x + DX[sf], nz = z + DZ[sf];
            if (World.getBlock(nx, y, nz) === id && (World.getState(nx, y, nz) & 7) === st && ((World.getState(nx, y, nz) >> 3) & 3) === 0) {
              // k 0: the other chest is on our east-relative side
              st |= (k === 0 ? 1 : 2) << 3;
              World.setBlock(nx, y, nz, id, (World.getState(nx, y, nz) & 7) | ((k === 0 ? 2 : 1) << 3), 4);
              break;
            }
          }
        }
        break;
      }
      case 'dripstone': st = face === 0 ? 8 : 0; break;
      case 'water_plant': case 'water_plant_any':
        if (d.place === 'water_plant' && !waterHere) return false;
        if (face === 0) return false;
        // coral fans go on the side of a block as wall fans
        if (face > 1 && it.wall !== undefined) { id = it.wall; st = face; if (!sturdyFace(x - DX[face], y, z - DZ[face])) return false; if (BLOCKS[id].waterlog && waterHere) st |= 128; return commit(p, s, x, y, z, id, st, offhand); }
        break;
      case 'hanging_sign':
        if (face === 1) return false;
        if (face > 1) { id = it.wall; st = face === 4 || face === 5 ? (L === 2 || L === 3 ? L : 2) : (L === 4 || L === 5 ? L : 5); break; }
        {
          // a hanging sign under a full block hangs from two chains and turns in quarter turns; under anything
          // narrower (or when sneaking) it hangs from one chain and can face any of the sixteen directions
          const above = World.getBlock(x, y + 1, z), attached = p.sneaking || !BLOCKS[above].opaque;
          const r = Math.round((((-p.yaw * 180 / Math.PI) + 180) % 360 + 360) % 360 / 22.5) & 15;
          st = attached ? (r | 16) : (Math.round(r / 4) * 4) & 15;
        }
        break;
      case 'candle': st = 0; break;
      case 'lily': if (hit && BLOCKS[hit.id].fluid === 'water') { x = hit.x; y = hit.y + 1; z = hit.z; } break;
      case 'bed': {
        const hx = x + DX[L], hz = z + DZ[L];
        if (!BLOCKS[World.getBlock(hx, y, hz)].replaceable || !solidTop(x, y - 1, z) || !solidTop(hx, y - 1, hz)) return false;
        if (!Phys.boxFree(hx, y, hz, hx + 1, y + 0.56, hz + 1)) return false;
        if (!commit(p, s, x, y, z, id, L, offhand, true)) return false;
        World.setBlock(hx, y, hz, id, L | 8);
        return true;
      }
      case 'door': {
        if (!BLOCKS[World.getBlock(x, y + 1, z)].replaceable || !solidTop(x, y - 1, z)) return false;
        // the hinge goes on the side away from neighbouring doors / toward the click
        const left = { 2: 4, 3: 5, 4: 3, 5: 2 }[L], right = OPP[left];
        let hinge = 0;
        const lx = x + DX[left], lz = z + DZ[left], rx = x + DX[right], rz = z + DZ[right];
        if (BLOCKS[World.getBlock(lx, y, lz)].model === 'door') hinge = 1;
        else if (BLOCKS[World.getBlock(rx, y, rz)].model !== 'door') { const off = { 2: fx, 3: 1 - fx, 4: 1 - fz, 5: fz }[L]; if (off > 0.5) hinge = 1; }
        st = L | (hinge ? 32 : 0);
        if (!commit(p, s, x, y, z, id, st, offhand, true)) return false;
        World.setBlock(x, y + 1, z, id, st | 8);
        Redstone.update(x, y, z);
        return true;
      }
      case 'tall_plant': {
        if (!BLOCKS[World.getBlock(x, y + 1, z)].replaceable || !canSurvive(id, 0, x, y, z)) return false;
        if (!commit(p, s, x, y, z, id, 0, offhand, true)) return false;
        World.setBlock(x, y + 1, z, id, 8);
        return true;
      }
    }
    if (d.waterlog && waterHere) st |= 128;
    if (!canSurvive(id, st, x, y, z)) return false;
    return commit(p, s, x, y, z, id, st, offhand);
  }
  function commit(p, s, x, y, z, id, st, offhand, noCheck) {
    // don't place a solid block inside a mob or player
    if (SOLID[id]) {
      const shapes = Models.shape(id, st, x, y, z, true);
      if (shapes) for (const e of Entities.list.concat([Game.player])) {
        if (!e || e.removed || e.type === 'item' || e.type === 'xp_orb' || e.noClip || e.dead) continue;
        for (const b of shapes) if (e.intersects([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]])) return false;
      }
    }
    World.setBlock(x, y, z, id, st);
    Blocks.onPlaced(x, y, z, id, st, p, s);
    Sound.blockPlace(id, x, y, z);
    p.swingArm();
    if (!p.creative) { s.count--; if (s.count <= 0) { if (offhand) p.inv.set(40, null); else p.inv.held = null; } p.inv.changed(); }
    Stats.add('placed', BLOCKS[id].name);
    return true;
  }
  return { tryPlace, canSurvive, lookDir, look6, solidTop, sturdyFace, soil };
})();
