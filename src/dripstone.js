'use strict';
/* Pointed dripstone (Java Edition 1.17+). State: bits 0-2 thickness (0 tip, 1 tip merge, 2 frustum, 3 middle,
   4 base), bit 3 pointing down (a stalactite), bit 7 waterlogged.
   - placed pointing away from where you look (up when looking down), flipped if that side has no support;
     tips meeting merge unless you sneak; every piece works out its thickness from its neighbours
   - a stalactite that loses its support falls, the whole column below the break; the tip hurts what it lands
     on: max(length, 6) per block fallen after the first, up to 40 (a helmet takes a quarter off); a
     stalagmite that loses its support breaks
   - landing on a stalagmite's tip hurts double, as if from 2.5 blocks higher
   - water or lava resting on the block a stalactite hangs from drips from its tip: drips fill a cauldron
     below (water 17.6% and lava 5.9% of random ticks, arriving 50 + distance ticks later), and mud there
     dries to clay; with water over a dripstone block a stalactite grows (1.1% of random ticks) down, or
     grows a stalagmite under it */
const Dripstone = (() => {
  const TIP = 0, MERGE = 1, FRUSTUM = 2, MIDDLE = 3, BASE = 4, NAMES = ['tip', 'tip_merge', 'frustum', 'middle', 'base'];
  const id = () => BID.pointed_dripstone;
  const down = st => !!(st & 8);
  const isDrip = (x, y, z) => World.getBlock(x, y, z) === id();
  // a dripstone at (x, y, z) pointing the given way (dy -1 down, +1 up)?
  const withDir = (x, y, z, dy) => isDrip(x, y, z) && (down(World.getState(x, y, z)) ? -1 : 1) === dy;
  const sturdy = (x, y, z) => { const d = BLOCKS[World.getBlock(x, y, z)]; return d.opaque || d.model === 'glazed' || (d.model === 'slab' && ((World.getState(x, y, z) >> 3) & 3) === 2); };
  // the game's calculateDripstoneThickness
  function thickness(x, y, z, dy, merge) {
    const fy = y + dy;
    if (withDir(x, fy, z, -dy)) return !merge && (World.getState(x, fy, z) & 7) !== MERGE ? TIP : MERGE;
    if (!withDir(x, fy, z, dy)) return TIP;
    const t = World.getState(x, fy, z) & 7;
    if (t !== TIP && t !== MERGE) return withDir(x, y - dy, z, dy) ? MIDDLE : BASE;
    return FRUSTUM;
  }
  // held up from behind (the block it points away from)
  const supported = (x, y, z, dy) => sturdy(x, y - dy, z) || withDir(x, y - dy, z, dy);
  function placeState(p, x, y, z) {
    let dy = p.pitch > 0 ? 1 : -1;
    if (!supported(x, y, z, dy)) { dy = -dy; if (!supported(x, y, z, dy)) return -1; }
    const water = BLOCKS[World.getBlock(x, y, z)].fluid === 'water' && (World.getState(x, y, z) & 7) === 0;
    return thickness(x, y, z, dy, !p.sneaking) | (dy < 0 ? 8 : 0) | (water ? 128 : 0);
  }
  // a neighbour changed: re-shape, or fall / break when nothing holds it up
  function neighbor(x, y, z, st) {
    const dy = down(st) ? -1 : 1;
    if (!supported(x, y, z, dy)) { Ticks.schedule(x, y, z, dy < 0 ? 2 : 1); return; }
    const t = thickness(x, y, z, dy, (st & 7) === MERGE);
    if (t !== (st & 7)) { World.setBlock(x, y, z, id(), (st & ~7) | t); Blocks.updateAround(x, y, z); }
  }
  function scheduled(x, y, z, st) {
    const dy = down(st) ? -1 : 1;
    if (supported(x, y, z, dy)) return;
    if (dy > 0) { Drops.dropBlock(id(), st, null, x, y, z); Blocks.remove(x, y, z, null, true); return; }
    // the column falls from here down to its tip; the tip carries the damage
    for (let yy = y; yy > MINY && withDir(x, yy, z, -1); yy--) {
      const s = World.getState(x, yy, z), tip = (s & 7) === TIP || (s & 7) === MERGE;
      World.setBlock(x, yy, z, (s & 128) ? BID.water : 0, 0); Blocks.updateAround(x, yy, z);
      const f = new FallingBlock(x + 0.5, yy, z + 0.5, id(), s & ~128);
      if (tip) { const n = Math.max(1 + y - yy, 6); f.hurtPer = n; f.hurtMax = 40; }
      Entities.add(f);
      if (tip) break;
    }
  }
  // what a falling stalactite does when it lands: hurts what's under it and breaks into an item
  function landed(f, bx, by, bz) {
    if (f.hurtPer) {
      const n = Math.ceil(f.fallDist - 1); if (n >= 0) {
        const dmg = Math.min(Math.floor(n * f.hurtPer), f.hurtMax);
        const bb = [f.x - 0.49, f.y, f.z - 0.49, f.x + 0.49, f.y + 0.98, f.z + 0.49];
        for (const e of Entities.list.concat([Game.player])) if (e && e.living !== false && (e.isPlayer || e.living) && !e.dead && e.intersects && e.intersects(bb)) e.hurt(dmg, 'fallingStalactite');
      }
    }
    Sound.play('pointed_dripstone_land', null, { x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
    Drops.spawnItem(bx + 0.5, by + 0.5, bz + 0.5, stack('pointed_dripstone'));
  }
  // landing on a stalagmite's tip
  function fallMultiplier(land, x, y, z) {
    if (land !== id()) return null;
    const st = World.getState(x, y, z);
    return !down(st) && (st & 7) === TIP ? { extra: 2.5, mult: 2 } : null;
  }
  // ---------------------------------------------------------------- fluids and growth
  // the block a stalactite hangs from (searching up through its pieces), within 11
  function rootSupport(x, y, z) { let yy = y; for (let i = 0; i < 11 && withDir(x, yy, z, -1); i++) yy++; return withDir(x, yy, z, -1) ? null : yy; }
  function fluidAbove(x, y, z) {
    const sy = rootSupport(x, y, z); if (sy === null) return null;
    const a = World.getBlock(x, sy + 1, z);
    if (a === BID.mud && World.dim !== 'nether') return { fluid: 'water', mud: true, y: sy + 1 };
    const d = BLOCKS[a]; if (!d.fluid || (World.getState(x, sy + 1, z) & 7) !== 0) return { fluid: null, y: sy + 1 };
    return { fluid: d.fluid, y: sy + 1 };
  }
  function tipOf(x, y, z, max) { let yy = y; for (let i = 0; i < (max || 11); i++) { const s = World.getState(x, yy, z); if ((s & 7) === TIP || (s & 7) === MERGE) return yy; if (!withDir(x, yy - 1, z, -1)) return null; yy--; } return null; }
  const dripThrough = (x, y, z) => { const b = World.getBlock(x, y, z); return b === 0 || (!SOLID[b] && !BLOCKS[b].fluid); };
  function cauldronBelow(x, ty, z, fluid) {
    for (let y = ty - 1; y >= ty - 11; y--) {
      const b = World.getBlock(x, y, z);
      if (b === BID.cauldron) { const s = World.getState(x, y, z), kind = (s >> 2) & 3, lvl = s & 3; if (fluid === 'water' ? (kind === 0 && lvl < 3) : (kind === 0 && lvl === 0)) return y; return null; }
      if (!dripThrough(x, y, z)) return null;
    }
    return null;
  }
  function randomTick(x, y, z, st) {
    if (!down(st) || withDir(x, y + 1, z, -1)) return; // only the top piece of a stalactite
    const k = Math.random(), f = fluidAbove(x, y, z);
    if (f && f.fluid && k < (f.fluid === 'water' ? 0.17578125 : 0.05859375)) {
      const ty = tipOf(x, y, z);
      if (ty !== null) {
        if (f.mud) { World.setBlock(x, f.y, z, BID.clay, 0); Sound.play('pointed_dripstone_drip_water', null, { x: x + 0.5, y: ty, z: z + 0.5 }); }
        else { const cy = cauldronBelow(x, ty, z, f.fluid); if (cy !== null) { Sound.play(f.fluid === 'lava' ? 'pointed_dripstone_drip_lava' : 'pointed_dripstone_drip_water', null, { x: x + 0.5, y: ty, z: z + 0.5 }); pending.push({ x, y: cy, z, fluid: f.fluid, at: Game.gameTime + 50 + (ty - cy) }); } }
      }
    }
    if (Math.random() < 0.011) grow(x, y, z);
  }
  // drips on their way down to cauldrons
  const pending = [];
  function tick() {
    for (let i = pending.length - 1; i >= 0; i--) {
      const d = pending[i]; if (Game.gameTime < d.at) continue; pending.splice(i, 1);
      if (World.getBlock(d.x, d.y, d.z) !== BID.cauldron) continue;
      const s = World.getState(d.x, d.y, d.z), kind = (s >> 2) & 3, lvl = s & 3;
      if (d.fluid === 'water' && kind === 0 && lvl < 3) World.setBlock(d.x, d.y, d.z, BID.cauldron, lvl + 1);
      else if (d.fluid === 'lava' && kind === 0 && lvl === 0) World.setBlock(d.x, d.y, d.z, BID.cauldron, 1 << 2);
      else continue;
      GameEvents.emit && GameEvents.emit('block_change', d.x + 0.5, d.y + 0.5, d.z + 0.5, null);
    }
  }
  function canTipGrow(x, y, z, dy) { const nb = World.getBlock(x, y + dy, z); if (BLOCKS[nb].fluid) return false; return nb === 0 || (withDir(x, y + dy, z, -dy) && (World.getState(x, y + dy, z) & 7) === TIP); }
  function create(x, y, z, dy, t) { const water = World.getBlock(x, y, z) === BID.water; World.setBlock(x, y, z, id(), t | (dy < 0 ? 8 : 0) | (water ? 128 : 0)); Blocks.updateAround(x, y, z); }
  function growTo(x, y, z, dy) {
    const ty = y + dy, b = World.getBlock(x, ty, z);
    if (withDir(x, ty, z, -dy) && (World.getState(x, ty, z) & 7) === TIP) { const up = dy < 0 ? y : ty, dn = up - 1; create(x, up, z, -1, MERGE); create(x, dn, z, 1, MERGE); }
    else if (b === 0 || (b === BID.water && (World.getState(x, ty, z) & 7) === 0)) create(x, ty, z, dy, TIP);
  }
  function grow(x, y, z) {
    if (World.getBlock(x, y + 1, z) !== BID.dripstone_block) return;
    const a = World.getBlock(x, y + 2, z); if (a !== BID.water || (World.getState(x, y + 2, z) & 7) !== 0) return;
    const ty = tipOf(x, y, z, 7); if (ty === null) return;
    const ts = World.getState(x, ty, z); if ((ts & 7) !== TIP || (ts & 128) || !canTipGrow(x, ty, z, -1)) return;
    if (Math.random() < 0.5) { growTo(x, ty, z, -1); return; }
    // or a stalagmite grows up from the floor below the tip
    for (let yy = ty - 1; yy > ty - 11; yy--) {
      const b = World.getBlock(x, yy, z); if (BLOCKS[b].fluid) return;
      if (withDir(x, yy, z, 1) && (World.getState(x, yy, z) & 7) === TIP && canTipGrow(x, yy, z, 1)) { growTo(x, yy, z, 1); return; }
      if (sturdy(x, yy - 1, z) && b === 0 && World.getBlock(x, yy - 1, z) !== BID.water) { create(x, yy, z, 1, TIP); return; }
      if (!dripThrough(x, yy, z)) return;
    }
  }
  // drips from stalactite tips (12% of animate ticks with a fluid above, 2% without)
  function animate(x, y, z, st) {
    if (!down(st) || (st & 128) || (st & 7) !== TIP) return;
    const k = Math.random(); if (k > 0.12) return;
    let yy = y; while (withDir(x, yy + 1, z, -1) && yy < y + 11) yy++;
    const f = fluidAbove(x, yy, z); const fl = f && f.fluid;
    if (!(k < 0.02 || fl)) return;
    Particles.drip(x + 0.5 + (Math.random() - 0.5) * 0.1, y + 1 / 16, z + 0.5 + (Math.random() - 0.5) * 0.1, fl === 'lava');
  }
  // ---------------------------------------------------------------- textures: up and down, five thicknesses
  {
    const { def, H } = Tex;
    const PAL = [0x5b4537, 0x6b5446, 0x7a6152, 0x86695b, 0x957768, 0xa38576];
    // pixel widths of each row from the point (row 0) to the root (row 15); each piece's root matches the next one's point
    const W = {
      tip: [0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4],
      tip_merge: [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4],
      frustum: [4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6],
      middle: [6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8],
      base: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 11, 11, 12],
    };
    for (const dir of ['up', 'down']) for (const t of NAMES) def(`pointed_dripstone_${dir}_${t}`, c => {
      c.clear();
      for (let row = 0; row < 16; row++) {
        const y = dir === 'up' ? row : 15 - row, w = W[t][row], x0 = 8 - Math.ceil(w / 2);
        for (let x = x0; x < x0 + w; x++) {
          const edge = x === x0 || x === x0 + w - 1, n = c.n(x, row, 31) * 0.5 + c.v(x, row, 2, 6, 31) * 0.5;
          c.px(x, y, H(PAL[Math.min(5, Math.max(0, Math.floor(n * 5) + (edge && w > 2 ? -1 : 1)))]));
        }
      }
    });
    def('pointed_dripstone', c => c.copy('pointed_dripstone_up_tip'));
  }
  return { thickness, placeState, neighbor, scheduled, landed, fallMultiplier, randomTick, tick, animate, NAMES, clear: () => { pending.length = 0; } };
})();
