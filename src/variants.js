'use strict';
/* Cat and wolf variants (Java Edition 1.21):
   - cats: tabby, tuxedo (black), red, siamese, british shorthair, calico, persian, ragdoll, white, jellie and
     all black; a cat spawns as any but all black, except under a full moon (any) and in a witch hut (always
     all black); kittens take one parent's coat
   - wolves: by the biome they spawn in (pale in taiga, woods in forest, ashen in snowy taiga, black in old
     growth pine taiga, chestnut in old growth spruce taiga, rusty in sparse jungle, spotted in savanna plateau,
     striped in wooded badlands, snowy in grove), each with wild, tame and angry looks; pups take one parent's
   - tamed wolves and cats wear a collar (red, dyeable) */
const Variants = (() => {
  const { DEFS, def, SK } = EntityModels;
  const CATS = ['tabby', 'black', 'red', 'siamese', 'british_shorthair', 'calico', 'persian', 'ragdoll', 'white', 'jellie', 'all_black'];
  const WOLF_BIOME = { taiga: 'pale', forest: 'woods', snowy_taiga: 'ashen', old_growth_pine_taiga: 'black', old_growth_spruce_taiga: 'chestnut', sparse_jungle: 'rusty', savanna_plateau: 'spotted', wooded_badlands: 'striped', grove: 'snowy' };
  const WOLVES = ['pale', 'woods', 'ashen', 'black', 'chestnut', 'rusty', 'spotted', 'striped', 'snowy'];

  // ---------------------------------------------------------------- cat coats
  const CAT = {
    tabby: { f: 0x8a7a66, d: 0x4c4034, eye: 0x6ab84a },
    black: { f: 0x26262a, d: 0x161618, eye: 0xd8c83a, chest: 0xf0f0f0 },
    red: { f: 0xd8883a, d: 0xa85a24, eye: 0x6ab84a },
    siamese: { f: 0xe8dcc6, d: 0xe0d2ba, eye: 0x4a8ad8, point: 0x4a3426 },
    british_shorthair: { f: 0x8a929c, d: 0x7a828c, eye: 0xd8963a },
    calico: { f: 0xf0ece4, d: 0xf0ece4, eye: 0x6ab84a, patches: [0xd8822a, 0x2a2a2a] },
    persian: { f: 0xe6cfa6, d: 0xd8bf96, eye: 0xb8c83a },
    ragdoll: { f: 0xf2eee6, d: 0xe8e2d8, eye: 0x4a8ad8, point: 0x7a6a58 },
    white: { f: 0xf4f4f4, d: 0xe6e6e6, eye: 0x4a8ad8 },
    jellie: { f: 0xd4d4d6, d: 0xc4c4c6, eye: 0x6ab84a, patches: [0x3a3a3c, 0x3a3a3c] },
    all_black: { f: 0x141416, d: 0x0e0e10, eye: 0x8ac83a },
  };
  const catSkin = c => s => {
    const F = s.box(0, 0, 5, 4, 5, c.f, 0.08); s.px(F.front[0] + 1, F.front[1] + 1, c.eye); s.px(F.front[0] + 3, F.front[1] + 1, c.eye);
    if (c.point) s.fill(F.front[0] + 1, F.front[1] + 2, 3, 2, c.point, 0.05);
    s.box(0, 24, 3, 2, 2, c.chest || (c.point ? c.point : 0xf0e0d0), 0.04); s.box(0, 10, 1, 1, 2, c.point || c.f, 0.05); s.box(6, 10, 1, 1, 2, c.point || c.f, 0.05);
    const B = s.box(20, 0, 4, 16, 6, c.f, 0.08);
    if (c.d !== c.f && !c.point) for (let i = 0; i < 16; i += 3) s.fill(B.top[0], B.top[1] + i, 4, 1, c.d, 0.05);
    if (c.chest) s.fill(B.bottom[0], B.bottom[1], 4, 6, c.chest, 0.04);
    if (c.patches) for (let k = 0; k < 7; k++) { const col = c.patches[k % 2], x = 20 + (k * 7) % 20, y = (k * 5) % 20; s.fill(x, y, 3, 2, col, 0.05); }
    s.box(0, 15, 1, 8, 1, c.point || c.f, 0.05); s.box(4, 15, 1, 8, 1, c.point || c.d, 0.05); s.box(8, 13, 2, 6, 2, c.point || c.f, 0.05); s.box(40, 0, 2, 10, 2, c.chest || c.point || c.f, 0.05);
  };
  const catParts = DEFS.cat.parts, catOpts = { anim: DEFS.cat.anim, scale: DEFS.cat.scale, babyHead: DEFS.cat.babyHead };
  for (const v of CATS) def('cat_' + v, DEFS.cat.tw, DEFS.cat.th, catParts, Object.assign({ skin: catSkin(CAT[v]) }, catOpts));

  // ---------------------------------------------------------------- wolf coats (wild, tame, angry)
  const WOLF = {
    pale: { fur: 0xd8d4cc, dark: 0xb8b2a8 }, woods: { fur: 0x7c6650, dark: 0x4c3c2c }, ashen: { fur: 0xa6a8ae, dark: 0x787a82 },
    black: { fur: 0x2c2c2e, dark: 0x1a1a1c }, chestnut: { fur: 0x8c5c3a, dark: 0x5c3a24 }, rusty: { fur: 0xba6a3a, dark: 0x6c3a1e },
    spotted: { fur: 0xc8aa7a, dark: 0x9a7a52, spots: 0x5a3e22 }, striped: { fur: 0xb89a6a, dark: 0x8a6e48, stripes: 0x4e3a24 }, snowy: { fur: 0xf2f2f2, dark: 0xd8d8dc },
  };
  const wolfSkin = (c, mode) => s => {
    SK.wolf(s, { fur: c.fur, dark: c.dark, angry: mode === 'angry', eye: mode === 'angry' ? 0x8a1a1a : 0x000000 });
    if (c.spots) s.speckle(18, 14, 20, 10, [c.fur, c.fur, c.fur, c.spots]);
    if (c.stripes) for (let i = 0; i < 9; i += 2) s.fill(18, 14 + i, 20, 1, c.stripes, 0.05);
  };
  const wolfParts = DEFS.wolf.parts, wolfOpts = { anim: DEFS.wolf.anim, babyHead: DEFS.wolf.babyHead };
  for (const v of WOLVES) for (const m of ['', '_tame', '_angry']) def('wolf_' + v + m, DEFS.wolf.tw, DEFS.wolf.th, wolfParts, Object.assign({ skin: wolfSkin(WOLF[v], m.slice(1)) }, wolfOpts));

  // ---------------------------------------------------------------- collars: a band at the neck, tinted with the dye
  const band = (parts, name, b) => parts.map(q => Object.assign({}, q, { b: q.n === name ? [b] : [], c: band(q.c || [], name, b) }));
  const white = s => s.fill(0, 0, s.c.width, s.c.height, 0xffffff, 0.03);
  def('wolf_collar', DEFS.wolf.tw, DEFS.wolf.th, band(wolfParts, 'upper_body', [21, 0, -3, -3, -3, 8, 1.5, 7, 0.35]), Object.assign({ skin: white }, wolfOpts));
  def('cat_collar', DEFS.cat.tw, DEFS.cat.th, band(catParts, 'body', [20, 0, -2, 3, -8, 4, 1.5, 6, 0.3]), Object.assign({ skin: white }, catOpts));
  const dyeRGB = n => { const c = Tex.CLR[n] || Tex.CLR.red; return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]; };

  // ---------------------------------------------------------------- the mobs
  const pickCat = () => { const full = typeof Sky !== 'undefined' && Sky.moonPhase === 0; const l = full ? CATS : CATS.filter(v => v !== 'all_black'); return l[Math.floor(Math.random() * l.length)]; };
  function wolfAt(x, y, z) { try { return WOLF_BIOME[BIOMES[World.biomeAt3(Math.floor(x), Math.floor(y), Math.floor(z))].name] || 'pale'; } catch (e) { return 'pale'; } }
  const Cat = MobTypes.cat, Wolf = MobTypes.wolf;
  if (Cat) {
    // the variant is picked when the cat is made (its model, saving, kittens and collar follow from it)
    class VCat extends Cat { constructor(t, x, y, z) { super(t, x, y, z); if (this.type === 'cat') this.variant = pickCat(); } }
    const P = VCat.prototype;
    Object.defineProperty(P, 'model', { get() { return this.type === 'cat' ? 'cat_' + (this.variant || 'tabby') : this.type; }, configurable: true });
    const se = P.saveExtra, le = P.loadExtra, oi = P.onInteract;
    P.saveExtra = function (d) { if (se) se.call(this, d); d.variant = this.variant; };
    P.loadExtra = function (d) { if (le) le.call(this, d); if (d.variant) this.variant = d.variant; };
    P.inherit = function (a, b) { this.variant = Math.random() < 0.5 ? a.variant : b.variant; };
    // a tame cat's collar takes dye like a wolf's
    P.onInteract = function (p, st) { const n = st ? ITEMS[st.id].name : ''; if (this.tame && n.endsWith('_dye') && this.type === 'cat') { this.collar = n.replace('_dye', ''); if (!p.creative) { st.count--; if (!st.count) p.inv.held = null; } return true; } return oi ? oi.call(this, p, st) : false; };
    const pl = P.layers; P.layers = function () { const l = pl ? pl.call(this) || [] : []; return this.type === 'cat' ? l.concat([{ model: 'cat_collar', when: e => e.tame, color: e => dyeRGB(e.collar) }]) : l; };
    MobTypes.cat = VCat;
  }
  if (Wolf) {
    class VWolf extends Wolf { constructor(t, x, y, z) { super(t, x, y, z); this.variant = wolfAt(x, y, z); } }
    const P = VWolf.prototype;
    Object.defineProperty(P, 'model', { get() { return 'wolf_' + (this.variant || 'pale') + (this.angry ? '_angry' : this.tame ? '_tame' : ''); }, configurable: true });
    const se = P.saveExtra, le = P.loadExtra;
    P.saveExtra = function (d) { if (se) se.call(this, d); d.variant = this.variant; };
    P.loadExtra = function (d) { if (le) le.call(this, d); if (d.variant) this.variant = d.variant; };
    P.inherit = function (a, b) { this.variant = Math.random() < 0.5 ? a.variant : b.variant; };
    const pl = P.layers; P.layers = function () { const l = pl ? pl.call(this) || [] : []; return l.concat([{ model: 'wolf_collar', when: e => e.tame, color: e => dyeRGB(e.collar) }]); };
    MobTypes.wolf = VWolf;
  }
  return { CATS, WOLVES, WOLF_BIOME, wolfAt, pickCat };
})();
