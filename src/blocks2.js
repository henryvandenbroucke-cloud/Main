'use strict';
/* Behaviour of the blocks added in 1.17-1.21 that the main block code does not cover: copper that ages and
   can be waxed or scraped, turtle and sniffer eggs that hatch, frosted ice that melts, the torchflower and
   pitcher crops, and candles (lit with flint and steel, put out by hand, placed on cakes). */
const BlockExtras = (() => {
  const B = BID;
  const rand = Math.random, rnd = n => Math.floor(Math.random() * n);

  // ---------------------------------------------------------------- copper
  const OXS = ['', 'exposed_', 'weathered_', 'oxidized_'];
  const CORES = new Set(['copper_block', 'cut_copper', 'cut_copper_stairs', 'cut_copper_slab', 'chiseled_copper', 'copper_grate', 'copper_bulb', 'copper_door', 'copper_trapdoor']);
  function copperInfo(name) {
    let waxed = false, n = name, stage = 0;
    if (n.startsWith('waxed_')) { waxed = true; n = n.slice(6); }
    for (let i = 1; i < 4; i++) if (n.startsWith(OXS[i])) { stage = i; n = n.slice(OXS[i].length); break; }
    if (n === 'copper' && stage) n = 'copper_block';
    if (!CORES.has(n)) return null;
    return { waxed, stage, core: n };
  }
  function copperId(core, stage, waxed) {
    let n = core === 'copper_block' && stage ? 'copper' : core;
    n = OXS[stage] + n; if (waxed) n = 'waxed_' + n;
    return B[n];
  }
  const INFO = BLOCKS.map(d => copperInfo(d.name));
  // the game's ageing: a 64/1125 chance per random tick, held back by less aged copper within 4 blocks and
  // sped up by more aged copper
  function age(x, y, z, id, st) {
    const me = INFO[id];
    if (!me || me.waxed || me.stage >= 3 || rand() >= 0.05688889) return;
    if (me.core === 'copper_door' && (st & 8)) return; // the lower half changes the door
    let same = 0, more = 0;
    for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
      const r = 4 - Math.abs(dx) - Math.abs(dy);
      if (r < 0) continue;
      for (let dz = -r; dz <= r; dz++) {
        if (!dx && !dy && !dz) continue;
        const o = INFO[World.getBlock(x + dx, y + dy, z + dz)];
        if (!o || o.waxed) continue;
        if (o.stage < me.stage) return;
        if (o.stage > me.stage) more++; else same++;
      }
    }
    const f = (more + 1) / (more + same + 1), chance = f * f * (me.stage === 0 ? 0.75 : 1);
    if (rand() < chance) setCopper(x, y, z, copperId(me.core, me.stage + 1, false), st);
  }
  function setCopper(x, y, z, nid, st) {
    World.setBlock(x, y, z, nid, st);
    if (BLOCKS[nid].model === 'door') { const oy = st & 8 ? y - 1 : y + 1; World.setBlock(x, oy, z, nid, World.getState(x, oy, z)); }
  }
  // honeycomb: wax; axe: scrape one stage of ageing off, or take the wax off
  function wax(p, x, y, z, id, st) {
    const me = INFO[id]; if (!me || me.waxed) return false;
    setCopper(x, y, z, copperId(me.core, me.stage, true), st);
    Sound.play('honeycomb_wax_on', null, { x, y, z }); Particles.wax && Particles.wax(x, y, z, true);
    return true;
  }
  function axe(p, x, y, z, id, st) {
    const me = INFO[id]; if (!me) return false;
    if (!me.waxed && me.stage > 0) { setCopper(x, y, z, copperId(me.core, me.stage - 1, false), st); Sound.play('axe_scrape', null, { x, y, z }); Particles.scrape && Particles.scrape(x, y, z); }
    else if (me.waxed) { setCopper(x, y, z, copperId(me.core, me.stage, false), st); Sound.play('axe_wax_off', null, { x, y, z }); Particles.wax && Particles.wax(x, y, z, false); }
    else return false;
    p.swingArm(); p.inv.damageHeld(1, p);
    return true;
  }
  // lightning takes the ageing off copper near where it strikes (on the block hit, and in a few random walks)
  function lightning(x, y, z) {
    const me = INFO[World.getBlock(x, y, z)];
    if (!me) return;
    const clear = (a, b, c) => { const id = World.getBlock(a, b, c), o = INFO[id]; if (o && !o.waxed && o.stage) setCopper(a, b, c, copperId(o.core, 0, false), World.getState(a, b, c)); };
    clear(x, y, z);
    for (let k = 0; k < 3 + rnd(3); k++) { let a = x, b = y, c = z; for (let i = 0; i < 1 + rnd(5); i++) { a += rnd(3) - 1; b += rnd(3) - 1; c += rnd(3) - 1; if (INFO[World.getBlock(a, b, c)]) { const o = INFO[World.getBlock(a, b, c)]; if (o && !o.waxed && o.stage) setCopper(a, b, c, copperId(o.core, o.stage - 1, false), World.getState(a, b, c)); } } }
  }

  // ---------------------------------------------------------------- eggs
  function turtleEgg(x, y, z, id, st) {
    const below = World.getBlock(x, y - 1, z);
    if (below !== B.sand && below !== B.red_sand && below !== B.suspicious_sand) return;
    const f = Sky.celestial;
    if (!(f < 0.69 && f > 0.65) && rnd(500) !== 0) return;
    const hatch = (st >> 2) & 3;
    if (hatch < 2) { Sound.play('turtle_egg_crack', null, { x, y, z }); World.setBlock(x, y, z, id, (st & ~12) | ((hatch + 1) << 2)); return; }
    Sound.play('turtle_egg_hatch', null, { x, y, z });
    World.setBlock(x, y, z, 0, 0);
    for (let j = 0; j <= (st & 3); j++) {
      Particles.blockBreak(x, y, z, id, st);
      const t = Mobs.create('turtle', x + 0.3 + j * 0.2, y, z + 0.3); if (!t) continue;
      t.setBaby(); t.home = { x, y, z }; Entities.add(t);
    }
  }
  // a turtle egg is broken by things that walk (1 in 100 ticks) or fall (1 in 3) on it, but not by turtles,
  // bats or sneaking players; mobs only break them when mob griefing is on
  function trample(e, x, y, z, fall) {
    const id = World.getBlock(x, y, z); if (id !== B.turtle_egg || e.type === 'turtle' || e.type === 'bat') return;
    if (e.sneaking && !fall) return;
    if (rnd(fall ? 3 : 100) !== 0) return;
    if (!e.isPlayer && !Game.rules.mobGriefing) return;
    const st = World.getState(x, y, z);
    Sound.play('turtle_egg_break', null, { x, y, z }); Particles.blockBreak(x, y, z, id, st);
    if ((st & 3) === 0) World.setBlock(x, y, z, 0, 0); else World.setBlock(x, y, z, id, st - 1);
  }
  // sniffer eggs crack three times, a third of a day apart (half that on moss), then hatch a snifflet
  function snifferDelay(x, y, z) { return (World.getBlock(x, y - 1, z) === B.moss_block ? 12000 : 24000) / 3 + rnd(300); }
  function snifferEgg(x, y, z, id, st) {
    const hatch = st & 3;
    if (hatch < 2) { Sound.play('sniffer_egg_crack', null, { x, y, z }); World.setBlock(x, y, z, id, hatch + 1); Ticks.schedule(x, y, z, snifferDelay(x, y, z)); return; }
    Sound.play('sniffer_egg_hatch', null, { x, y, z });
    Particles.blockBreak(x, y, z, id, st);
    World.setBlock(x, y, z, 0, 0);
    const s = Mobs.create('sniffer', x + 0.5, y, z + 0.5); if (s) { s.setBaby(); Entities.add(s); }
  }

  // ---------------------------------------------------------------- frosted ice (made by Frost Walker)
  function frostedNeighbours(x, y, z) { let n = 0; for (let f = 0; f < 6; f++) if (World.getBlock(x + DX[f], y + DY[f], z + DZ[f]) === B.frosted_ice) n++; return n; }
  function meltStep(x, y, z) {
    const st = World.getState(x, y, z);
    if ((st & 3) < 3) { World.setBlock(x, y, z, B.frosted_ice, st + 1); return false; }
    World.setBlock(x, y, z, World.dim === 'nether' ? 0 : B.water, 0); Ticks.schedule(x, y, z, 5);
    return true;
  }
  function frostedIce(x, y, z, id, st) {
    if ((rnd(3) === 0 || frostedNeighbours(x, y, z) < 4) && World.lightLevel(x, y, z) > 11 - (st & 3) - 1 && meltStep(x, y, z)) {
      for (let f = 0; f < 6; f++) { const a = x + DX[f], b = y + DY[f], c = z + DZ[f]; if (World.getBlock(a, b, c) === B.frosted_ice && !meltStep(a, b, c)) Ticks.schedule(a, b, c, 20 + rnd(21)); }
    } else if (World.getBlock(x, y, z) === B.frosted_ice) Ticks.schedule(x, y, z, 20 + rnd(21));
  }

  // ---------------------------------------------------------------- the torchflower and pitcher crops
  function torchflower(x, y, z, id, st, grow) {
    if (!grow) { if (rnd(3) === 0) return; if (World.lightLevel(x, y + 1, z) < 9 || rand() >= Blocks.growthChance(x, y, z, id)) return; }
    const age = (st & 7) + 1;
    if (age >= 2) World.setBlock(x, y, z, B.torchflower, 0); else World.setBlock(x, y, z, id, age);
  }
  // pitcher crops: ages 0-4; from age 3 the plant is two blocks tall (bit 3 marks the upper half)
  function pitcherGrow(x, y, z, by, n) {
    const st = World.getState(x, by, z), age = st & 7;
    if (age >= 4) return false;
    const next = Math.min(4, age + n);
    if (next >= 3) { const up = World.getBlock(x, by + 1, z); if (up !== B.pitcher_crop && up !== 0 && !BLOCKS[up].replaceable) return false; }
    World.setBlock(x, by, z, B.pitcher_crop, next);
    if (next >= 3) World.setBlock(x, by + 1, z, B.pitcher_crop, next | 8);
    return true;
  }
  function pitcher(x, y, z, id, st) {
    if (st & 8) return;
    if (World.lightLevel(x, y + 1, z) < 8) return;
    if (rand() >= Blocks.growthChance(x, y, z, id)) return; // the game's 1 / (25 / growth speed + 1)
    pitcherGrow(x, y, z, y, 1);
  }
  function boneMeal(x, y, z) {
    const id = World.getBlock(x, y, z), st = World.getState(x, y, z);
    if (id === B.torchflower_crop) { torchflower(x, y, z, id, st, true); return true; }
    if (id === B.pitcher_crop) { const by = st & 8 ? y - 1 : y; return pitcherGrow(x, y, z, by, 1); }
    if (id === B.pitcher_plant || id === B.torchflower) { if (id === B.pitcher_plant) Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, stack('pitcher_plant')); return id === B.pitcher_plant; }
    return false;
  }

  // ---------------------------------------------------------------- candles
  const isCandle = id => BLOCKS[id].model === 'candle', isCandleCake = id => BLOCKS[id].model === 'candle_cake';
  function light(x, y, z, id, st) {
    if ((isCandle(id) || isCandleCake(id)) && !(st & 4) && !(st & 128)) { World.setBlock(x, y, z, id, st | 4); return true; }
    return false;
  }
  function use(p, hit, id, st, held) {
    const { x, y, z } = hit;
    if ((isCandle(id) || isCandleCake(id)) && (st & 4) && !held) {
      World.setBlock(x, y, z, id, st & ~4); Sound.play('candle_extinguish', null, { x, y, z });
      Particles.smoke({ x: x + 0.5, y: y + 0.5, z: z + 0.5, h: 0 }, 4);
      return true;
    }
    if (isCandleCake(id) && !(held && (ITEMS[held.id].name === 'flint_and_steel' || ITEMS[held.id].name === 'fire_charge'))) {
      // eating from a candle cake drops the candle and leaves a cake with one slice gone
      if (p.food >= 20 && !p.creative) return false;
      const candle = BLOCKS[id].name.replace('_cake', '');
      Drops.spawnItem(x + 0.5, y + 1, z + 0.5, stack(candle));
      p.eat(2, 0.1); Sound.play('eat', p);
      World.setBlock(x, y, z, B.cake, 1);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- hooks used by the main block code
  function randomTick(x, y, z, id, st) {
    if (INFO[id]) { age(x, y, z, id, st); return true; }
    switch (id) {
      case B.turtle_egg: turtleEgg(x, y, z, id, st); return true;
      case B.frosted_ice: frostedIce(x, y, z, id, st); return true;
      case B.torchflower_crop: torchflower(x, y, z, id, st, false); return true;
      case B.pitcher_crop: pitcher(x, y, z, id, st); return true;
    }
    return false;
  }
  function scheduledTick(x, y, z, id, st) {
    if (id === B.sniffer_egg) { snifferEgg(x, y, z, id, st); return true; }
    if (id === B.frosted_ice) { frostedIce(x, y, z, id, st); return true; }
    return false;
  }
  function onPlaced(x, y, z, id) {
    if (id === B.sniffer_egg) { Ticks.schedule(x, y, z, snifferDelay(x, y, z)); if (World.getBlock(x, y - 1, z) === B.moss_block) Particles.boneMeal(x, y, z, 10); }
  }
  function neighborChanged(x, y, z, id) {
    if (id === B.frosted_ice && frostedNeighbours(x, y, z) < 2) meltStep(x, y, z);
    // a pitcher crop or plant loses its other half
    if (id === B.pitcher_crop) { const st = World.getState(x, y, z); if (st & 8 ? World.getBlock(x, y - 1, z) !== id : ((st & 7) >= 3 && World.getBlock(x, y + 1, z) !== id)) { World.setBlock(x, y, z, 0, 0); } }
  }
  return { randomTick, scheduledTick, onPlaced, neighborChanged, use, wax, axe, light, boneMeal, trample, lightning, copperInfo, INFO };
})();
