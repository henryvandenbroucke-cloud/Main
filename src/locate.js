'use strict';
/* The page's side of structures: finding the nearest one (/locate, eyes of ender, explorer maps) and asking
   which structure a position is in (special mob spawning in fortresses, monuments, swamp huts, outposts). */
const Structures = (() => {
  const SG = () => self.StructureGen;
  let gens = null, key = '';
  function gen(dim) {
    const k = Game.seed + '|' + Game.worldType;
    if (!gens || key !== k) { key = k; gens = { overworld: new Overworld(Game.seed, { type: Game.worldType, structures: Game.structures }), nether: new Nether(Game.seed), end: new End(Game.seed) }; }
    return gens[dim || World.dim];
  }
  const ALIAS = { fortress: 'fortress', nether_fortress: 'fortress', bastion: 'bastion_remnant', bastion_remnant: 'bastion_remnant', monument: 'ocean_monument', mansion: 'woodland_mansion', temple: 'desert_pyramid', pyramid: 'desert_pyramid', witch_hut: 'swamp_hut', outpost: 'pillager_outpost', endcity: 'end_city', end_city: 'end_city' };
  function dimOf(name) { const t = SG() && SG().TYPES.find(s => s.name === name); return t ? t.dim : World.dim; }
  // the nearest structure of a kind: [x, z] (or null)
  function locate(what, x, z) {
    const name = ALIAS[what] || what; if (!SG()) return null;
    if (dimOf(name) !== World.dim) return null;
    const r = SG().locate(name, gen(World.dim), x, z, 1200);
    return r ? [r.x, r.z, r.y] : null;
  }
  function nearestStronghold(x, z) { const r = locate('stronghold', x, z); return r ? [r[0], r[1]] : null; }
  // the names of the structures whose boxes hold a position
  function at(x, y, z, names) { if (!SG() || !Game.structures) return []; return SG().at(World.dim, gen(World.dim), Math.floor(x), Math.floor(y), Math.floor(z), names).map(p => p.name); }
  return { locate, nearestStronghold, at, gen };
})();
