'use strict';
/* Mob stats (Java Edition 1.21): health, movement speed attribute, attack damage on Normal difficulty,
   experience dropped and spawn group. Sizes come from the game data. */
const MOB_STATS = {
  // name: [health, speed, damage (normal), xp, group]
  pig: [10, 0.25, 0, '1-3', 'creature'], cow: [10, 0.2, 0, '1-3', 'creature'], sheep: [8, 0.23, 0, '1-3', 'creature'], chicken: [4, 0.25, 0, '1-3', 'creature'],
  mooshroom: [10, 0.2, 0, '1-3', 'creature'], horse: [22, 0.225, 0, '1-3', 'creature'], donkey: [22, 0.175, 0, '1-3', 'creature'], mule: [22, 0.175, 0, '1-3', 'creature'],
  rabbit: [3, 0.3, 0, '1-3', 'creature'], wolf: [8, 0.3, 4, '1-3', 'creature'], cat: [10, 0.3, 3, '1-3', 'creature'], ocelot: [10, 0.3, 0, '1-3', 'creature'],
  fox: [10, 0.3, 2, '1-3', 'creature'], parrot: [6, 0.2, 0, '1-3', 'creature'], bat: [6, 0.1, 0, '0', 'ambient'], squid: [10, 0.7, 0, '1-3', 'water'], glow_squid: [10, 0.7, 0, '1-3', 'water'],
  cod: [3, 0.7, 0, '1-3', 'water'], salmon: [3, 0.7, 0, '1-3', 'water'], tropical_fish: [3, 0.7, 0, '1-3', 'water'], pufferfish: [3, 0.7, 0, '1-3', 'water'], dolphin: [10, 1.2, 3, '1-3', 'water'],
  turtle: [30, 0.25, 0, '1-3', 'creature'], polar_bear: [30, 0.25, 6, '1-3', 'creature'], panda: [20, 0.15, 6, '1-3', 'creature'], bee: [10, 0.3, 2, '1-3', 'creature'],
  goat: [10, 0.2, 2, '1-3', 'creature'], llama: [22, 0.175, 1, '1-3', 'creature'], frog: [10, 1.0, 0, '1-3', 'creature'], axolotl: [14, 1.0, 2, '1-3', 'water'], camel: [32, 0.09, 0, '1-3', 'creature'],
  armadillo: [12, 0.14, 0, '1-3', 'creature'], strider: [20, 0.175, 0, '1-3', 'creature'], villager: [20, 0.5, 0, '0', 'misc'], wandering_trader: [20, 0.5, 0, '0', 'misc'],
  iron_golem: [100, 0.25, 15, '0', 'misc'], snow_golem: [4, 0.2, 0, '0', 'misc'],
  zombie: [20, 0.23, 3, '5', 'monster'], husk: [20, 0.23, 3, '5', 'monster'], drowned: [20, 0.23, 3, '5', 'monster'], zombie_villager: [20, 0.23, 3, '5', 'monster'],
  skeleton: [20, 0.25, 3, '5', 'monster'], stray: [20, 0.25, 3, '5', 'monster'], wither_skeleton: [20, 0.25, 8, '5', 'monster'], creeper: [20, 0.25, 0, '5', 'monster'],
  spider: [16, 0.3, 2, '5', 'monster'], cave_spider: [12, 0.3, 2, '5', 'monster'], enderman: [40, 0.3, 7, '5', 'monster'], endermite: [8, 0.25, 2, '3', 'monster'],
  silverfish: [8, 0.25, 1, '5', 'monster'], slime: [16, 0.3, 4, 'size', 'monster'], magma_cube: [16, 0.2, 6, 'size', 'monster'], witch: [26, 0.25, 0, '5', 'monster'],
  phantom: [20, 0.7, 2, '5', 'monster'], blaze: [20, 0.23, 6, '10', 'monster'], ghast: [10, 0.7, 6, '5', 'monster'], zombified_piglin: [20, 0.23, 8, '5', 'monster'],
  piglin: [16, 0.35, 5, '5', 'monster'], piglin_brute: [50, 0.35, 13, '20', 'monster'], hoglin: [40, 0.3, 6, '5', 'monster'], zoglin: [40, 0.3, 6, '5', 'monster'],
  pillager: [24, 0.35, 4, '5', 'monster'], vindicator: [24, 0.35, 13, '5', 'monster'], evoker: [24, 0.5, 6, '10', 'monster'], vex: [14, 0.7, 9, '0', 'monster'],
  ravager: [100, 0.3, 12, '20', 'monster'], guardian: [30, 0.5, 6, '10', 'monster'], elder_guardian: [80, 0.3, 8, '10', 'monster'], shulker: [30, 0, 4, '5', 'monster'],
  skeleton_horse: [15, 0.2, 0, '1-3', 'creature'], zombie_horse: [15, 0.2, 0, '1-3', 'creature'],
  trader_llama: [22, 0.175, 1, '1-3', 'creature'], sniffer: [14, 0.1, 0, '1-3', 'creature'], allay: [20, 0.1, 2, '0', 'creature'], tadpole: [6, 1.0, 0, '0', 'water'],
  bogged: [16, 0.25, 3, '5', 'monster'], breeze: [30, 0.63, 1, '10', 'monster'], warden: [500, 0.3, 30, '5', 'monster'],
  ender_dragon: [200, 0, 10, 'dragon', 'boss'], wither: [300, 0.6, 8, '50', 'boss'],
};
const MOB_LIST = Object.keys(MOB_STATS);
