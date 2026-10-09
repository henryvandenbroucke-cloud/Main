'use strict';
/* Biomes of the three dimensions: temperature, rainfall, colours and which mobs spawn. Shared with the worker. */
SHARED.push(function biomesModule(G) {
  const BIOMES = [], BIOME = {};
  // [name, temperature, downfall, grass, foliage, water, precipitation (r rain, s snow, n none), dimension]
  const LIST = [
    ['plains', 0.8, 0.4, 0x91bd59, 0x77ab2f, 0x3f76e4, 'r'], ['sunflower_plains', 0.8, 0.4, 0x91bd59, 0x77ab2f, 0x3f76e4, 'r'],
    ['snowy_plains', 0.0, 0.5, 0x80b497, 0x60a17b, 0x3f76e4, 's'], ['ice_spikes', 0.0, 0.5, 0x80b497, 0x60a17b, 0x3f76e4, 's'],
    ['desert', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n'], ['swamp', 0.8, 0.9, 0x6a7039, 0x6a7039, 0x617b64, 'r'], ['mangrove_swamp', 0.8, 0.9, 0x6a7039, 0x8db127, 0x3a7a6a, 'r'],
    ['forest', 0.7, 0.8, 0x79c05a, 0x59ae30, 0x3f76e4, 'r'], ['flower_forest', 0.7, 0.8, 0x79c05a, 0x59ae30, 0x3f76e4, 'r'],
    ['birch_forest', 0.6, 0.6, 0x88bb67, 0x6ba941, 0x3f76e4, 'r'], ['old_growth_birch_forest', 0.6, 0.6, 0x88bb67, 0x6ba941, 0x3f76e4, 'r'],
    ['dark_forest', 0.7, 0.8, 0x507a32, 0x59ae30, 0x3f76e4, 'r'],
    ['taiga', 0.25, 0.8, 0x86b783, 0x68a464, 0x3f76e4, 'r'], ['old_growth_pine_taiga', 0.3, 0.8, 0x86b87f, 0x68a55f, 0x3f76e4, 'r'], ['old_growth_spruce_taiga', 0.25, 0.8, 0x86b783, 0x68a464, 0x3f76e4, 'r'],
    ['snowy_taiga', -0.5, 0.4, 0x80b497, 0x60a17b, 0x3d57d6, 's'],
    ['savanna', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n'], ['savanna_plateau', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n'], ['windswept_savanna', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n'],
    ['windswept_hills', 0.2, 0.3, 0x8ab689, 0x6da36b, 0x3f76e4, 'r'], ['windswept_gravelly_hills', 0.2, 0.3, 0x8ab689, 0x6da36b, 0x3f76e4, 'r'], ['windswept_forest', 0.2, 0.3, 0x8ab689, 0x6da36b, 0x3f76e4, 'r'],
    ['jungle', 0.95, 0.9, 0x59c93c, 0x30bb0b, 0x3f76e4, 'r'], ['sparse_jungle', 0.95, 0.8, 0x64c73f, 0x3eb80f, 0x3f76e4, 'r'], ['bamboo_jungle', 0.95, 0.9, 0x59c93c, 0x30bb0b, 0x3f76e4, 'r'],
    ['badlands', 2.0, 0.0, 0x90814d, 0x9e814d, 0x3f76e4, 'n'], ['eroded_badlands', 2.0, 0.0, 0x90814d, 0x9e814d, 0x3f76e4, 'n'], ['wooded_badlands', 2.0, 0.0, 0x90814d, 0x9e814d, 0x3f76e4, 'n'],
    ['meadow', 0.5, 0.8, 0x83bb6d, 0x63a948, 0x0e4ecf, 'r'], ['cherry_grove', 0.5, 0.8, 0xb6db61, 0xb6db61, 0x5db7ef, 'r'],
    ['grove', -0.2, 0.8, 0x80b497, 0x60a17b, 0x3f76e4, 's'], ['snowy_slopes', -0.3, 0.9, 0x80b497, 0x60a17b, 0x3f76e4, 's'],
    ['frozen_peaks', -0.7, 0.9, 0x80b497, 0x60a17b, 0x3f76e4, 's'], ['jagged_peaks', -0.7, 0.9, 0x80b497, 0x60a17b, 0x3f76e4, 's'], ['stony_peaks', 1.0, 0.3, 0x9abe4b, 0x82ac1e, 0x3f76e4, 'r'],
    ['river', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'r'], ['frozen_river', 0.0, 0.5, 0x80b497, 0x60a17b, 0x3938c9, 's'],
    ['beach', 0.8, 0.4, 0x91bd59, 0x77ab2f, 0x3f76e4, 'r'], ['snowy_beach', 0.05, 0.3, 0x80b497, 0x60a17b, 0x3d57d6, 's'], ['stony_shore', 0.2, 0.3, 0x8ab689, 0x6da36b, 0x3f76e4, 'r'],
    ['warm_ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x43d5ee, 'r'], ['lukewarm_ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x45adf2, 'r'], ['deep_lukewarm_ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x45adf2, 'r'],
    ['ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'r'], ['deep_ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'r'],
    ['cold_ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3d57d6, 'r'], ['deep_cold_ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3d57d6, 'r'],
    ['frozen_ocean', 0.0, 0.5, 0x80b497, 0x60a17b, 0x3938c9, 's'], ['deep_frozen_ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3938c9, 'r'],
    ['mushroom_fields', 0.9, 1.0, 0x55c93f, 0x2bbb0f, 0x3f76e4, 'r'],
    ['dripstone_caves', 0.8, 0.4, 0x91bd59, 0x77ab2f, 0x3f76e4, 'r'], ['lush_caves', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'r'], ['deep_dark', 0.8, 0.4, 0x91bd59, 0x77ab2f, 0x3f76e4, 'r'],
    ['nether_wastes', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n', 'nether'], ['soul_sand_valley', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n', 'nether'],
    ['crimson_forest', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n', 'nether'], ['warped_forest', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n', 'nether'],
    ['basalt_deltas', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x3f76e4, 'n', 'nether'],
    ['the_end', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'n', 'end'], ['end_highlands', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'n', 'end'],
    ['end_midlands', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'n', 'end'], ['end_barrens', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'n', 'end'],
    ['small_end_islands', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3f76e4, 'n', 'end'],
  ];
  // mob spawns by biome group: [mob, weight, min group, max group]
  const PASSIVE = [['sheep', 12, 4, 4], ['pig', 10, 4, 4], ['chicken', 10, 4, 4], ['cow', 8, 4, 4]];
  const HOSTILE = [['spider', 100, 4, 4], ['zombie', 95, 4, 4], ['zombie_villager', 5, 1, 1], ['skeleton', 100, 4, 4], ['creeper', 100, 4, 4], ['slime', 100, 4, 4], ['enderman', 10, 1, 4], ['witch', 5, 1, 1]];
  const SPAWNS = {
    plains: { passive: PASSIVE.concat([['horse', 5, 2, 6], ['donkey', 1, 1, 3]]) }, sunflower_plains: { passive: PASSIVE.concat([['horse', 5, 2, 6], ['donkey', 1, 1, 3]]) },
    snowy_plains: { passive: [['rabbit', 10, 2, 3], ['polar_bear', 1, 1, 2]], hostile: HOSTILE.filter(m => m[0] !== 'skeleton').concat([['skeleton', 20, 4, 4], ['stray', 80, 4, 4]]) },
    ice_spikes: { passive: [['rabbit', 10, 2, 3], ['polar_bear', 1, 1, 2]], hostile: HOSTILE.filter(m => m[0] !== 'skeleton').concat([['skeleton', 20, 4, 4], ['stray', 80, 4, 4]]) },
    desert: { passive: [['rabbit', 4, 2, 3], ['camel', 1, 1, 1]], hostile: HOSTILE.filter(m => m[0] !== 'zombie' && m[0] !== 'zombie_villager').concat([['zombie', 19, 4, 4], ['zombie_villager', 1, 1, 1], ['husk', 80, 4, 4]]) },
    swamp: { passive: PASSIVE.concat([['frog', 10, 2, 5]]), hostile: HOSTILE.concat([['slime', 1, 1, 1]]) }, mangrove_swamp: { passive: [['frog', 10, 2, 5]], hostile: HOSTILE.concat([['slime', 1, 1, 1]]) },
    forest: { passive: PASSIVE.concat([['wolf', 5, 4, 4]]) }, flower_forest: { passive: PASSIVE.concat([['rabbit', 4, 2, 3], ['bee', 2, 2, 3]]) },
    birch_forest: { passive: PASSIVE.concat([['bee', 1, 2, 3]]) }, old_growth_birch_forest: { passive: PASSIVE }, dark_forest: { passive: PASSIVE },
    taiga: { passive: PASSIVE.concat([['wolf', 8, 4, 4], ['rabbit', 4, 2, 3], ['fox', 8, 2, 4]]) }, old_growth_pine_taiga: { passive: PASSIVE.concat([['wolf', 8, 4, 4], ['rabbit', 4, 2, 3], ['fox', 8, 2, 4]]) },
    old_growth_spruce_taiga: { passive: PASSIVE.concat([['wolf', 8, 4, 4], ['rabbit', 4, 2, 3], ['fox', 8, 2, 4]]) },
    snowy_taiga: { passive: PASSIVE.concat([['wolf', 8, 4, 4], ['rabbit', 4, 2, 3], ['fox', 8, 2, 4]]), hostile: HOSTILE.filter(m => m[0] !== 'skeleton').concat([['skeleton', 20, 4, 4], ['stray', 80, 4, 4]]) },
    savanna: { passive: PASSIVE.concat([['horse', 1, 2, 6], ['donkey', 1, 1, 1], ['llama', 8, 4, 4], ['armadillo', 10, 2, 3]]) }, savanna_plateau: { passive: PASSIVE.concat([['horse', 1, 2, 6], ['llama', 8, 4, 4], ['armadillo', 10, 2, 3]]) },
    windswept_savanna: { passive: PASSIVE.concat([['llama', 8, 4, 4]]) },
    windswept_hills: { passive: PASSIVE.concat([['llama', 5, 4, 6]]) }, windswept_gravelly_hills: { passive: PASSIVE.concat([['llama', 5, 4, 6]]) }, windswept_forest: { passive: PASSIVE.concat([['llama', 5, 4, 6]]) },
    jungle: { passive: PASSIVE.concat([['parrot', 40, 1, 2], ['panda', 1, 1, 2], ['chicken', 10, 4, 4], ['ocelot', 2, 1, 3]]) }, sparse_jungle: { passive: PASSIVE.concat([['parrot', 40, 1, 2], ['ocelot', 2, 1, 3]]) },
    bamboo_jungle: { passive: PASSIVE.concat([['parrot', 40, 1, 2], ['panda', 80, 1, 2], ['ocelot', 2, 1, 1]]) },
    badlands: { passive: [['armadillo', 6, 1, 2]] }, eroded_badlands: { passive: [['armadillo', 6, 1, 2]] }, wooded_badlands: { passive: [['armadillo', 6, 1, 2]] },
    meadow: { passive: [['donkey', 1, 1, 2], ['rabbit', 2, 2, 6], ['sheep', 2, 2, 4]] }, cherry_grove: { passive: [['pig', 1, 1, 2], ['rabbit', 2, 2, 6], ['sheep', 2, 2, 4], ['bee', 2, 2, 3]] },
    grove: { passive: [['wolf', 8, 4, 4], ['rabbit', 4, 2, 3], ['fox', 8, 2, 4]] }, snowy_slopes: { passive: [['rabbit', 4, 2, 3], ['goat', 5, 1, 3]] },
    frozen_peaks: { passive: [['goat', 5, 1, 3]] }, jagged_peaks: { passive: [['goat', 5, 1, 3]] }, stony_peaks: { passive: [] },
    river: { passive: [], hostile: HOSTILE.concat([['drowned', 100, 1, 1]]), water: [['squid', 2, 1, 4], ['salmon', 5, 1, 5]] }, frozen_river: { passive: [], hostile: HOSTILE.concat([['drowned', 1, 1, 1]]), water: [['squid', 2, 1, 4], ['salmon', 5, 1, 5]] },
    beach: { passive: [['turtle', 5, 2, 5]] }, snowy_beach: { passive: [] }, stony_shore: { passive: [] },
    warm_ocean: { passive: [], water: [['pufferfish', 15, 1, 3], ['tropical_fish', 25, 8, 8], ['dolphin', 2, 1, 2]] },
    lukewarm_ocean: { passive: [], water: [['squid', 10, 1, 2], ['cod', 15, 3, 6], ['pufferfish', 5, 1, 3], ['tropical_fish', 25, 8, 8], ['dolphin', 2, 1, 2]] },
    deep_lukewarm_ocean: { passive: [], water: [['squid', 8, 1, 4], ['cod', 8, 3, 6], ['pufferfish', 5, 1, 3], ['tropical_fish', 25, 8, 8], ['dolphin', 2, 1, 2]] },
    ocean: { passive: [], water: [['squid', 1, 1, 4], ['cod', 10, 3, 6], ['dolphin', 1, 1, 2]] }, deep_ocean: { passive: [], water: [['squid', 1, 1, 4], ['cod', 10, 3, 6], ['dolphin', 1, 1, 2]] },
    cold_ocean: { passive: [], water: [['squid', 3, 1, 4], ['cod', 15, 3, 6], ['salmon', 15, 1, 5]] }, deep_cold_ocean: { passive: [], water: [['squid', 3, 1, 4], ['cod', 15, 3, 6], ['salmon', 15, 1, 5]] },
    frozen_ocean: { passive: [['polar_bear', 1, 1, 2]], water: [['squid', 1, 1, 4], ['salmon', 15, 1, 5]] }, deep_frozen_ocean: { passive: [['polar_bear', 1, 1, 2]], water: [['squid', 1, 1, 4], ['salmon', 15, 1, 5]] },
    mushroom_fields: { passive: [['mooshroom', 8, 4, 8]], hostile: [] },
    nether_wastes: { passive: [], hostile: [['ghast', 50, 4, 4], ['zombified_piglin', 100, 4, 4], ['magma_cube', 2, 4, 4], ['enderman', 1, 4, 4], ['piglin', 15, 4, 4]], strider: true },
    soul_sand_valley: { passive: [], hostile: [['skeleton', 20, 5, 5], ['ghast', 50, 4, 4], ['enderman', 1, 4, 4]], strider: true },
    crimson_forest: { passive: [], hostile: [['zombified_piglin', 1, 2, 4], ['hoglin', 9, 3, 4], ['piglin', 5, 3, 4]], strider: true },
    warped_forest: { passive: [], hostile: [['enderman', 1, 4, 4]], strider: true },
    basalt_deltas: { passive: [], hostile: [['ghast', 40, 1, 1], ['magma_cube', 100, 2, 5]], strider: true },
    the_end: { passive: [], hostile: [['enderman', 10, 4, 4]] }, end_highlands: { passive: [], hostile: [['enderman', 10, 4, 4]] }, end_midlands: { passive: [], hostile: [['enderman', 10, 4, 4]] },
    end_barrens: { passive: [], hostile: [['enderman', 10, 4, 4]] }, small_end_islands: { passive: [], hostile: [['enderman', 10, 4, 4]] },
    // cave biomes: tropical fish in lush cave pools, drowned in dripstone caves, nothing at all in the deep dark
    lush_caves: { passive: [], water: [['tropical_fish', 25, 8, 8]] }, dripstone_caves: { passive: [], hostile: HOSTILE.concat([['drowned', 95, 4, 4]]), water: [] },
    deep_dark: { passive: [], hostile: [], water: [], ambient: [] },
  };
  for (const [name, temp, down, grass, foliage, water, precip, dim] of LIST) {
    const id = BIOMES.length;
    // vanilla sky colour comes from the temperature
    const t = Math.max(-1, Math.min(1, temp / 3));
    const sky = hsv(0.62222 - t * 0.05, 0.5 + t * 0.1, 1);
    const sp = SPAWNS[name] || { passive: PASSIVE };
    const b = {
      id, name, temp, down, grass, foliage, water, precip, dim: dim || 'overworld', sky,
      display: name.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
      passive: sp.passive || PASSIVE, hostile: sp.hostile || (name.includes('ocean') ? HOSTILE.concat([['drowned', 5, 1, 1]]) : HOSTILE), waterMobs: sp.water || [['squid', 1, 1, 2]], ambient: sp.ambient || [['bat', 10, 8, 8]],
      ocean: name.includes('ocean'), snowy: precip === 's',
    };
    if (name === 'dark_forest') b.foliageDark = true;
    BIOMES.push(b); BIOME[name] = id;
  }
  function hsv(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (((i % 6) + 6) % 6) { case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break; case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break; case 4: r = t; g = p; b = v; break; default: r = v; g = p; b = q; }
    return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
  }
  // snow falls instead of rain where the temperature (cooled by height) is below 0.15
  function tempAt(biomeId, y) { const b = BIOMES[biomeId]; let t = b.temp; if (y > 80) t -= (y - 80) * 0.00166667; return t; }
  Object.assign(G, { BIOMES, BIOME, tempAt });
});
