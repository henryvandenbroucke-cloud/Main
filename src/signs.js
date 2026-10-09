'use strict';
/* Sign text: four lines on each side of standing and hanging signs (and the front of wall signs), drawn in the
   game's sizes (90 pixels wide at 1/144 block per pixel on signs, 60 at 0.9/96 on hanging signs) in the dye
   colour, darkened to 40% like the game, or bright with an outline when glowing. Dye, glow ink sacs and ink
   sacs act on the side you are looking at, honeycomb waxes the sign so it can no longer be edited, and
   right-clicking opens the editor for the side you face. */
const Signs = (() => {
  const B = BID;
  const TEXT = { white: 0xffffff, orange: 0xff681f, magenta: 0xff00ff, light_blue: 0x9ac0cd, yellow: 0xffff00, lime: 0xbfff00, pink: 0xff69b4, gray: 0x808080, light_gray: 0xd3d3d3, cyan: 0x00ffff, purple: 0xa020f0, blue: 0x0000ff, brown: 0x8b4513, green: 0x00ff00, red: 0xff0000, black: 0x000000 };
  const SIGN_MODELS = new Set(['sign', 'wall_sign', 'hanging_sign', 'wall_hanging_sign']);
  const isSign = id => SIGN_MODELS.has(BLOCKS[id].model);
  const meshes = new Map();
  const key = (x, y, z) => x + ',' + y + ',' + z;
  // where the board is: its centre, the way its front faces, its half thickness, and the text's size
  function geometry(x, y, z, id, st) {
    const m = BLOCKS[id].model;
    const rot = th => [Math.sin(th), 0, -Math.cos(th)];
    if (m === 'sign') return { c: [x + 0.5, y + 13.333 / 16, z + 0.5], f: rot((st & 15) * Math.PI / 8), half: 0.667 / 16, px: 1 / 144, lineH: 10, maxW: 90, back: true };
    if (m === 'wall_sign') { const f = st & 7; return { c: [x + 0.5 - DX[f] * 7 / 16, y + 8.333 / 16, z + 0.5 - DZ[f] * 7 / 16], f: [DX[f], 0, DZ[f]], half: 0.667 / 16, px: 1 / 144, lineH: 10, maxW: 90, back: false }; }
    if (m === 'hanging_sign') return { c: [x + 0.5, y + 5 / 16, z + 0.5], f: rot((st & 15) * Math.PI / 8), half: 1 / 16, px: 0.9 / 96, lineH: 9, maxW: 60, back: true };
    const f = st & 7; return { c: [x + 0.5, y + 5 / 16, z + 0.5], f: [DX[f], 0, DZ[f]], half: 1 / 16, px: 0.9 / 96, lineH: 9, maxW: 60, back: true };
  }
  const side = (be, back) => back ? (be.back || { lines: ['', '', '', ''] }) : be;
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  function textCanvas(t, g) {
    const S = 4, W = g.maxW, H = g.lineH * 4;
    const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
    const x = c.getContext('2d');
    const base = TEXT[t.color || 'black'], dark = ((base >> 16 & 255) * 0.4 << 16) | ((base >> 8 & 255) * 0.4 << 8) | ((base & 255) * 0.4);
    const fill = t.glow ? (t.color && t.color !== 'black' ? base : 0xf0ebcc) : dark;
    x.font = `600 ${9 * S}px "Pixelify Sans", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
    t.lines.forEach((line, i) => {
      if (!line) return;
      const cy = (i + 0.5) * g.lineH * S;
      if (t.glow) { x.fillStyle = hex(t.color === 'black' || !t.color ? 0x000000 : dark); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) x.fillText(line, W * S / 2 + ox * S, cy + oy * S, W * S); }
      x.fillStyle = hex(fill); x.fillText(line, W * S / 2, cy, W * S);
    });
    return c;
  }
  function remove(k) { const g = meshes.get(k); if (!g) return; scene.remove(g); for (const m of g.children) { m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); } meshes.delete(k); }
  function refresh(x, y, z) {
    const k = key(x, y, z); remove(k);
    const id = World.getBlock(x, y, z), be = World.getBE(x, y, z);
    if (!isSign(id) || !be || be.type !== 'sign') return;
    const g = geometry(x, y, z, id, World.getState(x, y, z)), grp = new THREE.Group();
    for (const back of g.back ? [false, true] : [false]) {
      const t = side(be, back); if (!t.lines || !t.lines.some(l => l)) continue;
      const tex = new THREE.CanvasTexture(textCanvas(t, g)); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const mat = entityMat(tex, { transparent: true });
      const fx = back ? -g.f[0] : g.f[0], fz = back ? -g.f[2] : g.f[2];
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(g.maxW * g.px, g.lineH * 4 * g.px), mat);
      mesh.position.set(g.c[0] + fx * (g.half + 0.003), g.c[1], g.c[2] + fz * (g.half + 0.003));
      mesh.rotation.y = Math.atan2(fx, fz);
      mesh.frustumCulled = false;
      const [sl, bl] = EntityRender.lightAt(mesh.position.x + fx * 0.3, mesh.position.y, mesh.position.z + fz * 0.3);
      mat.uniforms.uEnv.value.set(t.glow ? 1 : sl, t.glow ? 1 : bl);
      grp.add(mesh);
    }
    if (grp.children.length) { scene.add(grp); meshes.set(k, grp); }
  }
  function clear() { for (const k of [...meshes.keys()]) remove(k); }
  World.listeners.chunkLoaded.push(c => { for (const be of c.be.values()) if (be.type === 'sign') refresh(be.x, be.y, be.z); });
  World.listeners.chunkUnloaded.push(c => { for (const k of [...meshes.keys()]) { const [x, , z] = k.split(',').map(Number); if (x >> 4 === c.cx && z >> 4 === c.cz) remove(k); } });
  World.listeners.blockChanged.push((x, y, z, old, id) => { if (meshes.has(key(x, y, z)) && (!isSign(id) || old !== id)) { remove(key(x, y, z)); if (isSign(id)) refresh(x, y, z); } });
  // light changes slowly: relight nearby signs now and then
  let tick = 0;
  function frame() {
    if (++tick % 30 !== 0 || !meshes.size) return;
    for (const [k, grp] of meshes) for (const m of grp.children) { const u = m.material.uniforms.uEnv.value; if (u.x === 1 && u.y === 1) continue; const [sl, bl] = EntityRender.lightAt(m.position.x, m.position.y, m.position.z); u.set(sl, bl); }
  }
  // which side the player is looking at
  function facingBack(p, x, y, z) { const id = World.getBlock(x, y, z), g = geometry(x, y, z, id, World.getState(x, y, z)); return g.back && ((p.x - g.c[0]) * g.f[0] + (p.z - g.c[2]) * g.f[2]) < 0; }
  function use(p, x, y, z, held) {
    const id = World.getBlock(x, y, z);
    let be = World.getBE(x, y, z); if (!be) { be = { type: 'sign', lines: ['', '', '', ''] }; World.setBE(x, y, z, be); }
    const back = facingBack(p, x, y, z), t = back ? (be.back || (be.back = { lines: ['', '', '', ''] })) : be;
    const hn = held ? ITEMS[held.id].name : '';
    const consume = () => { if (!p.creative) { held.count--; if (!held.count) p.inv.held = null; p.inv.changed(); } };
    if (be.waxed) { Sound.play('waxed_sign_fail', null, { x, y, z }); return true; }
    const hasText = t.lines && t.lines.some(l => l);
    if (hn === 'honeycomb') { be.waxed = true; consume(); Sound.play('honeycomb_wax', null, { x, y, z }); Particles.happy && Particles.happy({ x: x + 0.5, y: y + 0.2, z: z + 0.5, w: 0.6, h: 0.6 }, 6); World.markDirty(x, y, z); return true; }
    if (hasText && hn.endsWith('_dye') && t.color !== hn.replace('_dye', '')) { t.color = hn.replace('_dye', ''); consume(); Sound.play('dye_use', null, { x, y, z }); refresh(x, y, z); return true; }
    if (hasText && hn === 'glow_ink_sac' && !t.glow) { t.glow = true; consume(); Sound.play('glow_ink_use', null, { x, y, z }); refresh(x, y, z); return true; }
    if (hasText && hn === 'ink_sac' && t.glow) { t.glow = false; consume(); Sound.play('ink_use', null, { x, y, z }); refresh(x, y, z); return true; }
    if (p.sneaking && held) return false;
    UI.open('sign', { x, y, z, side: back ? 'back' : 'front' });
    return true;
  }
  return { refresh, clear, use, frame, isSign, TEXT };
})();
