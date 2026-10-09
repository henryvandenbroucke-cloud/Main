'use strict';
/* Archaeology (Java Edition 1.20+): suspicious sand and gravel hide one item from an archaeology loot table.
   - holding use with a brush on any block sweeps it: a stroke every 10 ticks (dust flies off the face)
   - each stroke on a suspicious block counts; it shows as the dusted stage (after 1, 3 and 6 strokes) and
     the item works its way out of the face being brushed; the 10th stroke frees it (about 5 seconds), drops
     it in front of that face and leaves plain sand or gravel, costing the brush 1 durability
   - stop for 2 seconds and the block fills back in, 2 strokes every 4 ticks
   - a suspicious block that falls breaks, item and all; mining one gives nothing */
const Archaeology = (() => {
  const TURNS = { suspicious_sand: 'sand', suspicious_gravel: 'gravel' };
  const isSus = id => !!TURNS[BLOCKS[id].name];
  function newBE(loot, seed) { return { type: 'brushable', loot: loot || null, seed: seed || 0, item: null, count: 0, resetAt: 0, coolEnd: 0, dir: -1 }; }
  // dusted stage from the stroke count
  const stage = n => n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : 3;
  function setStage(be, k) { const id = World.getBlock(be.x, be.y, be.z); if (isSus(id)) World.setBlock(be.x, be.y, be.z, id, (World.getState(be.x, be.y, be.z) & ~3) | k, 4); }
  // the loot is rolled on the first stroke (with the brusher's luck)
  function unpack(be, p) {
    if (!be.loot) return;
    const r = be.seed ? new Rand(be.seed) : null;
    const list = LootTables.roll(be.loot, { r: r ? () => r.next() : Math.random, luck: p.luck || 0, entity: p });
    be.item = list[0] || null; be.loot = null;
  }
  // one stroke; true when the block is done
  function brush(be, p, face) {
    const t = Game.gameTime;
    if (be.dir < 0) be.dir = face;
    be.resetAt = t + 40;
    if (t < be.coolEnd) return false;
    be.coolEnd = t + 10;
    unpack(be, p);
    const before = stage(be.count);
    if (++be.count >= 10) { complete(be); return true; }
    const after = stage(be.count); if (after !== before) setStage(be, after);
    return false;
  }
  function complete(be) {
    const id = World.getBlock(be.x, be.y, be.z), name = BLOCKS[id].name;
    // the item comes out in the middle of the block in front of the brushed face, standing still
    if (be.item) {
      const d = be.dir < 0 ? 1 : be.dir, s = Object.assign({}, be.item, { count: Math.min(be.item.count, 10 + Math.floor(Math.random() * 21)) });
      const e = Drops.spawnItem(be.x + DX[d] + 0.5, be.y + DY[d] + 0.625, be.z + DZ[d] + 0.5, s);
      if (e) { e.vx = e.vy = e.vz = 0; }
    }
    be.item = null;
    Particles.blockBreak(be.x, be.y, be.z, id, World.getState(be.x, be.y, be.z));
    Sound.play(name === 'suspicious_gravel' ? 'brush_gravel_completed' : 'brush_sand_completed', null, { x: be.x + 0.5, y: be.y + 0.5, z: be.z + 0.5 });
    World.setBlock(be.x, be.y, be.z, BID[TURNS[name]], 0);
  }
  // left alone, the block fills back in
  function tick(be) {
    if (!be.count) return;
    if (Game.gameTime >= be.resetAt) {
      const before = stage(be.count);
      be.count = Math.max(0, be.count - 2);
      const after = stage(be.count); if (after !== before) setStage(be, after);
      be.resetAt = Game.gameTime + 4;
    }
    if (be.count === 0) { be.dir = -1; be.resetAt = 0; be.coolEnd = 0; }
  }
  // ---------------------------------------------------------------- the brush (held use, 200 ticks at a time)
  function startBrush(p, s, hit, offhand) { return !!hit; }
  function brushTick(p, s) {
    const hit = Interact.target;
    if (!hit) { p.using = null; return; }
    if (p.useTicks % 10 !== 5) return;
    const id = World.getBlock(hit.x, hit.y, hit.z), d = BLOCKS[id];
    dust(p, hit, id);
    Sound.play(d.name === 'suspicious_sand' ? 'brush_sand' : d.name === 'suspicious_gravel' ? 'brush_gravel' : 'brush_generic', null, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    const be = World.getBE(hit.x, hit.y, hit.z);
    if (be && be.type === 'brushable' && isSus(id) && brush(be, p, hit.face)) {
      if (p.creative) return;
      if (p.useOff) damageItem(s, 1, p, () => { p.inv.set(40, null); Sound.play('break_item', p); });
      else p.inv.damageHeld(1, p);
      p.inv.changed();
    }
  }
  // the game's brush dust: 7 to 11 bits of the block thrown sideways along the face
  function dust(p, hit, id) {
    if (!id || BLOCKS[id].model === 'none') return;
    const f = hit.face, lv = p.lookVec();
    const dl = f <= 1 ? [lv[2], -lv[0]] : f === 2 ? [1, -0.1] : f === 3 ? [-1, 0.1] : f === 4 ? [-0.1, -1] : [0.1, 1];
    const n = 7 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const a = 3 * Math.random(), vx = dl[0] * a + (Math.random() * 2 - 1) * 0.4, vz = dl[1] * a + (Math.random() * 2 - 1) * 0.4, vy = (Math.random() * 2 - 1) * 0.4;
      const len = Math.hypot(vx, vy, vz) || 1, sp = (Math.random() + Math.random() + 1) * 0.15 * 0.4;
      const q = Particles.blockBits(hit.px, hit.py, hit.pz, vx / len * sp, vy / len * sp + 0.1 * Math.random(), vz / len * sp, id, World.getState(hit.x, hit.y, hit.z), f);
      if (q) q.size *= 0.7;
    }
  }
  // ---------------------------------------------------------------- the item working its way out
  const shown = new Map();
  function frame(a) {
    const p = Game.player; if (!p || typeof ItemMesh === 'undefined') return;
    const seen = new Set();
    for (const ch of World.chunks.values()) {
      if (!ch.be.size || Math.abs(ch.cx * 16 + 8 - p.x) > 40 || Math.abs(ch.cz * 16 + 8 - p.z) > 40) continue;
      for (const be of ch.be.values()) {
        if (be.type !== 'brushable' || !be.item || be.dir < 0) continue;
        const k = stage(be.count); if (!k) continue;
        const key = be.x + ',' + be.y + ',' + be.z, id = be.item.id;
        let v = shown.get(key); if (v && v.what !== id) { v.dispose(); shown.delete(key); v = null; }
        if (!v) { const m = ItemMesh.mesh(id); if (!m) continue; m.matrixAutoUpdate = true; m.position.set(-0.5, -0.5, -0.5); const g = new THREE.Group(); g.add(m); scene.add(g); v = { what: id, g, m, dispose: () => { scene.remove(g); m.material.dispose && m.material.dispose(); } }; shown.set(key, v); }
        seen.add(key);
        // the game's BrushableBlockRenderer offsets: deeper in the block at stage 1, at the face by stage 3
        const t = [0.5, 0, 0.5], o = k / 10 * 0.75;
        switch (be.dir) { case 5: t[0] = 0.73 + o; break; case 4: t[0] = 0.25 - o; break; case 1: t[1] = 0.25 + o; break; case 0: t[1] = -0.23 - o; break; case 2: t[2] = 0.25 - o; break; case 3: t[2] = 0.73 + o; break; }
        v.g.position.set(be.x + t[0], be.y + 0.5 + t[1], be.z + t[2]);
        v.g.rotation.set(0, (75 + (be.dir === 4 || be.dir === 5 ? 90 : 0) + 11) * Math.PI / 180, 0);
        v.g.scale.setScalar(0.5);
        const d = be.dir, [sl, bl] = EntityRender.lightAt(be.x + DX[d] + 0.5, be.y + DY[d] + 0.5, be.z + DZ[d] + 0.5);
        const mm = v.m.material; if (mm && mm.uniforms && mm.uniforms.uEnv) mm.uniforms.uEnv.value.set(sl, bl);
      }
    }
    for (const [k, v] of shown) if (!seen.has(k)) { v.dispose(); shown.delete(k); }
  }
  function clear() { for (const v of shown.values()) v.dispose(); shown.clear(); }

  // ---------------------------------------------------------------- textures: four dusted stages
  {
    const { def, H } = Tex;
    // grooves brushed into the face, longer at each stage; stage 0 only has a few odd grains
    const GROOVES = [[1, 3, 0, 9], [4, 7, 1, 12], [2, 11, 0, 10], [6, 14, 1, 14], [9, 5, 0, 13]];
    for (const [kind, dark, deep, grain] of [['sand', 0xb9a776, 0x9d8a5c, 0xeee4c0], ['gravel', 0x5e5650, 0x45403b, 0xa39a92]]) {
      for (let k = 0; k < 4; k++) def(`suspicious_${kind}_${k}`, c => {
        c.copy(kind);
        c.each((x, y) => { if (c.n(x, y, 91) < 0.05) c.px(x, y, H(grain)); });
        if (!k) return;
        for (const [x0, y0, horiz, len] of GROOVES) {
          const n = Math.round(len * k / 3);
          for (let i = 0; i < n; i++) {
            const x = horiz ? x0 + i : x0 + Math.round(Math.sin(i * 0.7) * 0.8), y = horiz ? y0 + Math.round(Math.sin(i * 0.6) * 0.8) : y0 + i;
            c.px(x & 15, y & 15, H(i % 3 === 1 && k === 3 ? deep : dark));
          }
        }
      });
      def(`suspicious_${kind}`, c => c.copy(`suspicious_${kind}_0`));
      BLOCKS[BID['suspicious_' + kind]].stateTex = s => `suspicious_${kind}_${s & 3}`;
    }
  }
  return { newBE, brush, tick, brushTick, startBrush, frame, clear, isSus, stage };
})();
