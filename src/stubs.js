'use strict';
/* Temporary placeholders for systems that are filled in later in the build. Each one is replaced by its own file. */
const Sound = { play() {}, step() {}, blockBreak() {}, blockHit() {}, blockPlace() {}, tick() {} };
const Particles = { blockBreak() {}, blockHit() {}, crit() {}, magicCrit() {}, sweep() {}, smoke() {}, totem() {}, tick() {} };
const Stats = { add() {} };
const Advancements = { check() {} };
const Chat = { system(t) { console.log(t); } };
const DeathMessages = { text(p, s) { return 'Player died (' + s + ')'; } };
const Beds = { wake() {}, use() { return false; }, respawnPoint(p) { return { dim: 'overworld', x: Game.spawn[0], y: Game.spawn[1], z: Game.spawn[2] }; } };
const Portals = { onBreak() {}, onEndFrameBreak() {}, tryLight() {}, checkFrame() {}, changeDim() {}, tick() {} };
const Weather = { rainingAt() { return false; }, tick() {} };
const Redstone = { connects() { return false; }, update() {}, onPlaced() {}, neighbor() {}, isComponent() { return false; }, scheduled() {}, plateTick() {}, updateAttached() {}, playNote() {} };
const Fire = { tick() {}, flammableAround() { return false; } };
const Rails = { shapeFor() { return 0; } };
const Leaves = { check() {} };
const Sponge = { absorb() {} };
const Golems = { check() {} };
const Chorus = { grow() {} };
const DragonEgg = { teleport() {} };
const Mobs = { spawn() {}, tick() {} };
const BlockUse = { use() { return false; } };
const ItemUse = {
  onBlock(p, s, hit, off) { if (ITEMS[s.id].block >= 0) return Place.tryPlace(p, s, hit, off); return false; },
  inAir() { return false; }, tickUse() {}, release(p) { p.using = null; },
};
const Save = { decodeChunk(d) { return d; }, storeChunk() {}, loadPlayer() {} };
