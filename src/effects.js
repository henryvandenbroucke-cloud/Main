'use strict';
/* Status effects and potions (Java Edition 1.21): every effect's colour and what it does, every potion with
   its effects and durations, splash potions (strength falls off over 4 blocks), lingering potions (a cloud
   with a quarter of the duration), tipped arrows (an eighth), potion names and tooltips, and the brewing
   chart. */
const Potions = (() => {
  // effect: [colour, beneficial (1) / harmful (0) / neutral (2), display name]
  const EFFECTS = {
    speed: [0x33ebff, 1, 'Speed'], slowness: [0x8bafe0, 0, 'Slowness'], haste: [0xd9c043, 1, 'Haste'], mining_fatigue: [0x4a4217, 0, 'Mining Fatigue'],
    strength: [0xffc700, 1, 'Strength'], instant_health: [0xf82423, 1, 'Instant Health'], instant_damage: [0xa9656a, 0, 'Instant Damage'], jump_boost: [0xfdff84, 1, 'Jump Boost'],
    nausea: [0x551d4a, 0, 'Nausea'], regeneration: [0xcd5cab, 1, 'Regeneration'], resistance: [0x9146f0, 1, 'Resistance'], fire_resistance: [0xff9900, 1, 'Fire Resistance'],
    water_breathing: [0x98dac0, 1, 'Water Breathing'], invisibility: [0xf6f6f6, 1, 'Invisibility'], blindness: [0x1f1f23, 0, 'Blindness'], night_vision: [0xc2ff66, 1, 'Night Vision'],
    hunger: [0x587653, 0, 'Hunger'], weakness: [0x484d48, 0, 'Weakness'], poison: [0x87a363, 0, 'Poison'], wither: [0x736156, 0, 'Wither'],
    health_boost: [0xf87d23, 1, 'Health Boost'], absorption: [0x2552a5, 1, 'Absorption'], saturation: [0xf82423, 1, 'Saturation'], glowing: [0x94a061, 2, 'Glowing'],
    levitation: [0xceffff, 0, 'Levitation'], luck: [0x59c106, 1, 'Luck'], unluck: [0xc0a44d, 0, 'Bad Luck'], slow_falling: [0xf3cfb9, 1, 'Slow Falling'],
    conduit_power: [0x1dc2d1, 1, 'Conduit Power'], dolphins_grace: [0x88a3be, 1, "Dolphin's Grace"], bad_omen: [0x0b6138, 2, 'Bad Omen'], hero_of_the_village: [0x44ff44, 1, 'Hero of the Village'],
    darkness: [0x292721, 0, 'Darkness'], trial_omen: [0x16a6a6, 2, 'Trial Omen'], raid_omen: [0xde4058, 2, 'Raid Omen'], wind_charged: [0xbdc9ff, 0, 'Wind Charged'],
    weaving: [0x78695a, 0, 'Weaving'], oozing: [0x60a64f, 0, 'Oozing'], infested: [0x8c9b8c, 0, 'Infested'],
  };
  // potion: [[effect, duration in ticks, amplifier], ...]
  const P = {
    water: [], mundane: [], thick: [], awkward: [],
    night_vision: [['night_vision', 3600]], long_night_vision: [['night_vision', 9600]],
    invisibility: [['invisibility', 3600]], long_invisibility: [['invisibility', 9600]],
    leaping: [['jump_boost', 3600]], long_leaping: [['jump_boost', 9600]], strong_leaping: [['jump_boost', 1800, 1]],
    fire_resistance: [['fire_resistance', 3600]], long_fire_resistance: [['fire_resistance', 9600]],
    swiftness: [['speed', 3600]], long_swiftness: [['speed', 9600]], strong_swiftness: [['speed', 1800, 1]],
    slowness: [['slowness', 1800]], long_slowness: [['slowness', 4800]], strong_slowness: [['slowness', 400, 3]],
    turtle_master: [['slowness', 400, 3], ['resistance', 400, 2]], long_turtle_master: [['slowness', 800, 3], ['resistance', 800, 2]], strong_turtle_master: [['slowness', 400, 5], ['resistance', 400, 3]],
    water_breathing: [['water_breathing', 3600]], long_water_breathing: [['water_breathing', 9600]],
    healing: [['instant_health', 1]], strong_healing: [['instant_health', 1, 1]], harming: [['instant_damage', 1]], strong_harming: [['instant_damage', 1, 1]],
    poison: [['poison', 900]], long_poison: [['poison', 1800]], strong_poison: [['poison', 432, 1]],
    regeneration: [['regeneration', 900]], long_regeneration: [['regeneration', 1800]], strong_regeneration: [['regeneration', 450, 1]],
    strength: [['strength', 3600]], long_strength: [['strength', 9600]], strong_strength: [['strength', 1800, 1]],
    weakness: [['weakness', 1800]], long_weakness: [['weakness', 4800]], luck: [['luck', 6000]],
    slow_falling: [['slow_falling', 1800]], long_slow_falling: [['slow_falling', 4800]],
    wind_charged: [['wind_charged', 3600]], weaving: [['weaving', 3600]], oozing: [['oozing', 3600]], infested: [['infested', 3600]],
  };
  const NAMES = { water: 'Water Bottle', mundane: 'Mundane Potion', thick: 'Thick Potion', awkward: 'Awkward Potion', night_vision: 'Night Vision', invisibility: 'Invisibility', leaping: 'Leaping', fire_resistance: 'Fire Resistance', swiftness: 'Swiftness', slowness: 'Slowness', turtle_master: 'the Turtle Master', water_breathing: 'Water Breathing', healing: 'Healing', harming: 'Harming', poison: 'Poison', regeneration: 'Regeneration', strength: 'Strength', weakness: 'Weakness', luck: 'Luck', slow_falling: 'Slow Falling', wind_charged: 'Wind Charging', weaving: 'Weaving', oozing: 'Oozing', infested: 'Infestation' };
  const base = p => String(p || 'water').replace(/^(long|strong)_/, '');
  function effectsOf(p) { return P[p] || []; }
  // the colour of a potion: the effects' colours mixed, weighted by amplifier + 1 (water is blue)
  function colorOf(p) {
    const es = effectsOf(p); if (!es.length) return p === 'water' || !p ? 0x385dc6 : 0x385dc6;
    let r = 0, g = 0, b = 0, n = 0;
    for (const [e, , amp] of es) { const c = EFFECTS[e][0], w = (amp || 0) + 1; r += (c >> 16 & 255) * w; g += (c >> 8 & 255) * w; b += (c & 255) * w; n += w; }
    return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
  }
  function displayName(s) {
    const it = ITEMS[s.id].name, p = s.tag.potion, b = base(p);
    if (it === 'tipped_arrow') return b === 'water' ? 'Arrow of Splashing' : P[p] && P[p].length ? 'Arrow of ' + (NAMES[b] || b) : 'Tipped Arrow';
    const kind = it === 'splash_potion' ? 'Splash ' : it === 'lingering_potion' ? 'Lingering ' : '';
    if (b === 'water') return kind ? kind + 'Water Bottle' : 'Water Bottle';
    if (['mundane', 'thick', 'awkward'].includes(b)) return kind + NAMES[b];
    return kind + 'Potion of ' + (NAMES[b] || b);
  }
  const fmt = t => { const s = Math.floor(t / 20); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const roman = n => ['', ' II', ' III', ' IV', ' V', ' VI'][n] || ' ' + (n + 1);
  function tooltip(s) {
    const it = ITEMS[s.id].name, k = it === 'lingering_potion' ? 0.25 : it === 'tipped_arrow' ? 0.125 : 1;
    const es = effectsOf(s.tag.potion);
    if (!es.length) return '<div style="color:#aaa">No Effects</div>';
    let h = '';
    for (const [e, d, amp] of es) { const good = EFFECTS[e][1] !== 0; h += `<div style="color:${good ? '#5555ff' : '#ff5555'}">${EFFECTS[e][2]}${roman(amp || 0)}${d > 20 ? ' (' + fmt(Math.floor(d * k)) + ')' : ''}</div>`; }
    // what it does when drunk
    const mods = [];
    for (const [e, , amp] of es) { const a = (amp || 0) + 1; if (e === 'speed') mods.push(`+${20 * a}% Speed`); if (e === 'slowness') mods.push(`-${15 * a}% Speed`); if (e === 'strength') mods.push(`+${3 * a} Attack Damage`); if (e === 'weakness') mods.push(`-${4 * a} Attack Damage`); if (e === 'resistance') mods.push(`+${20 * a}% Damage Resistance`); if (e === 'luck') mods.push('+1 Luck'); }
    if (mods.length) { h += '<br><div style="color:#aa00aa">When Applied:</div>'; for (const m of mods) h += `<div style="color:${m[0] === '+' ? '#5555ff' : '#ff5555'}">${m}</div>`; }
    return h;
  }
  // drink or splash: factor scales the duration (and instant effects)
  function apply(e, p, f, source) {
    if (!e || !e.addEffect) return;
    f = f === undefined ? 1 : f;
    for (const [n, d, amp] of effectsOf(p)) {
      if (n === 'instant_health' || n === 'instant_damage') {
        const heal = n === 'instant_health' !== !!e.undead; // undead mobs are hurt by healing and healed by harming
        const v = Math.floor((4 << (amp || 0)) * (n === 'instant_health' ? 1 : 1.5) * f);
        if (heal) e.heal(Math.floor((4 << (amp || 0)) * f)); else e.hurt(Math.floor(6 * (1 << (amp || 0)) * f), 'magic', source);
        void v; continue;
      }
      const dur = Math.floor(d * f);
      if (dur > 20) e.addEffect(n, dur, amp || 0);
    }
  }
  function applyArrow(e, p) { for (const [n, d, amp] of effectsOf(p)) { if (n === 'instant_health' || n === 'instant_damage') apply(e, p, 1); else e.addEffect(n, Math.max(1, Math.floor(d / 8)), amp || 0); } }
  function list() { return Object.keys(P); }
  function effectNames() { return Object.keys(EFFECTS); }
  // ---------------------------------------------------------------- brewing (the game's chart)
  const MIX = {
    water: { nether_wart: 'awkward', redstone: 'mundane', glowstone_dust: 'thick', fermented_spider_eye: 'weakness', sugar: 'mundane', rabbit_foot: 'mundane', glistering_melon_slice: 'mundane', spider_eye: 'mundane', blaze_powder: 'mundane', magma_cream: 'mundane', ghast_tear: 'mundane', phantom_membrane: 'mundane', breeze_rod: 'mundane' },
    awkward: { golden_carrot: 'night_vision', rabbit_foot: 'leaping', magma_cream: 'fire_resistance', sugar: 'swiftness', pufferfish: 'water_breathing', glistering_melon_slice: 'healing', spider_eye: 'poison', ghast_tear: 'regeneration', blaze_powder: 'strength', turtle_helmet: 'turtle_master', phantom_membrane: 'slow_falling', breeze_rod: 'wind_charged', cobweb: 'weaving', slime_block: 'oozing', stone: 'infested' },
    night_vision: { redstone: 'long_night_vision', fermented_spider_eye: 'invisibility' }, long_night_vision: { fermented_spider_eye: 'long_invisibility' },
    invisibility: { redstone: 'long_invisibility' },
    leaping: { redstone: 'long_leaping', glowstone_dust: 'strong_leaping', fermented_spider_eye: 'slowness' }, long_leaping: { fermented_spider_eye: 'long_slowness' },
    fire_resistance: { redstone: 'long_fire_resistance' },
    swiftness: { redstone: 'long_swiftness', glowstone_dust: 'strong_swiftness', fermented_spider_eye: 'slowness' }, long_swiftness: { fermented_spider_eye: 'long_slowness' },
    slowness: { redstone: 'long_slowness', glowstone_dust: 'strong_slowness' },
    turtle_master: { redstone: 'long_turtle_master', glowstone_dust: 'strong_turtle_master' },
    water_breathing: { redstone: 'long_water_breathing' },
    healing: { glowstone_dust: 'strong_healing', fermented_spider_eye: 'harming' }, strong_healing: { fermented_spider_eye: 'strong_harming' },
    harming: { glowstone_dust: 'strong_harming' },
    poison: { redstone: 'long_poison', glowstone_dust: 'strong_poison', fermented_spider_eye: 'harming' }, long_poison: { fermented_spider_eye: 'harming' }, strong_poison: { fermented_spider_eye: 'strong_harming' },
    regeneration: { redstone: 'long_regeneration', glowstone_dust: 'strong_regeneration' },
    strength: { redstone: 'long_strength', glowstone_dust: 'strong_strength' },
    weakness: { redstone: 'long_weakness' }, slow_falling: { redstone: 'long_slow_falling' },
  };
  // returns the brewed bottle or null
  function brew(bottle, ingredient) {
    if (!bottle || !ingredient) return null;
    const bn = ITEMS[bottle.id].name, ing = ITEMS[ingredient.id].name, p = (bottle.tag && bottle.tag.potion) || 'water';
    if (!['potion', 'splash_potion', 'lingering_potion'].includes(bn)) return null;
    if (ing === 'gunpowder' && bn === 'potion') return Object.assign({}, bottle, { id: IID.splash_potion, tag: Object.assign({}, bottle.tag) });
    if (ing === 'dragon_breath' && bn === 'splash_potion') return Object.assign({}, bottle, { id: IID.lingering_potion, tag: Object.assign({}, bottle.tag) });
    const to = MIX[p] && MIX[p][ing];
    if (!to) return null;
    return Object.assign({}, bottle, { tag: Object.assign({}, bottle.tag, { potion: to }) });
  }
  function isIngredient(s) { if (!s) return false; const n = ITEMS[s.id].name; if (n === 'gunpowder' || n === 'dragon_breath') return true; for (const k in MIX) if (MIX[k][n]) return true; return false; }
  return { EFFECTS, P, color: n => EFFECTS[n] ? EFFECTS[n][0] : 0xffffff, colorOf, displayName, tooltip, apply, applyArrow, list, effectNames, effectsOf, brew, isIngredient, MIX, name: n => EFFECTS[n] ? EFFECTS[n][2] : n, beneficial: n => EFFECTS[n] ? EFFECTS[n][1] : 2 };
})();

// effects that change what happens to living things (the rest are read where they matter)
(function effectHooks() {
  const tick0 = Living.prototype.tickEffects;
  Living.prototype.tickEffects = function () {
    tick0.call(this);
    // swirling particles in the effect colours (fewer for beacon effects)
    if (this.effects.size && (this.age & 1) === 0 && !(this.isPlayer && this.view === 0 && this === Game.player)) {
      let r = 0, g = 0, b = 0, n = 0, amb = true, vis = false;
      for (const [k, e] of this.effects) { if (!e.particles) continue; vis = true; if (!e.ambient) amb = false; const c = Potions.color(k); r += c >> 16 & 255; g += c >> 8 & 255; b += c & 255; n++; }
      if (vis && n && !this.effect('invisibility')) Particles.effects(this, (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n), amb);
    }
    const cp = this.effect('conduit_power'); if (cp && this.air !== undefined && this.eyesInWater) this.air = Math.max(this.air, 300);
  };
  // effects that act when the entity dies or is hurt
  const die0 = Mob.prototype.die;
  Mob.prototype.die = function (src, a) {
    const x = this.x, y = this.y, z = this.z;
    if (this.effect('wind_charged')) Explosions.wind(x, y + this.h / 2, z, this);
    if (this.effect('oozing')) { for (let i = 0; i < 2; i++) { const s = Mobs.spawnEntity('slime', x + Math.random() - 0.5, y, z + Math.random() - 0.5); if (s) s.setSize(2); } }
    if (this.effect('weaving') && Game.rules.mobGriefing) { for (let i = 0; i < 3; i++) { const bx = Math.floor(x) + rnd(3) - 1, bz = Math.floor(z) + rnd(3) - 1, by = Math.floor(y); if (World.getBlock(bx, by, bz) === 0) World.setBlock(bx, by, bz, BID.cobweb, 0); } }
    return die0.call(this, src, a);
  };
  const hurt0 = Mob.prototype.hurt;
  Mob.prototype.hurt = function (n, s, a) { const r = hurt0.call(this, n, s, a); if (r && this.effect('infested') && Math.random() < 0.1) for (let i = 0; i < 1 + rnd(2); i++) Mobs.spawnEntity('silverfish', this.x, this.y + this.h / 2, this.z); return r; };
})();
