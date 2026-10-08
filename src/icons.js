'use strict';
/* The icon atlas for every item: block items are rendered once as small 3D blocks (seen from above, like the
   game's inventory icons); other items and flat blocks (plants, torches, doors...) use their 16x16 sprite. */
const Icons = (() => {
  const CELL = 48, COLS = 42, SIZE = CELL * COLS;
  const index = new Int16Array(ITEMS.length).fill(-1);
  let canvas = null, url = '', next = 0;
  const FLAT_MODELS = new Set(['cross', 'tall', 'crop', 'torch', 'wall_torch', 'ladder', 'vine', 'rail', 'wire', 'lever', 'lily', 'pane', 'door', 'sign', 'wall_sign', 'lantern', 'chain', 'bamboo', 'fire', 'portal', 'stem_attached', 'carpet_cross', 'brewing', 'cauldron', 'hopper', 'cake', 'pot', 'repeater', 'comparator', 'campfire', 'bell', 'rod', 'tripwire_hook', 'tripwire', 'dripleaf']);
  // which block state to show in the icon
  function iconState(d) {
    switch (d.model) {
      case 'stairs': return 4; case 'chest': return 3; case 'bed': return 3 | 8; case 'piston': return 1; case 'anvil': return 5;
      case 'gate': return 3; case 'trapdoor': return 0; case 'button': return 0; case 'plate': return 0;
    }
    if (d.place === 'facing_h_opp' || d.place === 'facing_h') return 3;
    if (d.place === 'facing6_opp' || d.place === 'facing6') return d.name === 'observer' ? 2 : 3;
    if (d.name === 'snow') return 0;
    return 0;
  }
  function spriteFor(it) {
    if (ItemTex.has(it.name)) return ItemTex.pixels(it.name);
    if (it.block >= 0) {
      const d = BLOCKS[it.block];
      if (FLAT_MODELS.has(d.model) || d.name.endsWith('_pane') || d.name.endsWith('_bars')) {
        const t = d.model === 'tall' ? d.name + '_top' : d.model === 'crop' ? d.tex.side : d.tex.side;
        if (d.model === 'tall' && Tex.has(d.name + '_top')) { const top = Tex.pixels(d.name + '_top'); if (d.name === 'tall_grass' || d.name === 'large_fern' || d.name === 'sunflower' || d.name === 'lilac' || d.name === 'rose_bush' || d.name === 'peony') return top; }
        return Tex.has(t) ? Tex.pixels(t) : ItemTex.pixels(it.name);
      }
      return null; // 3D
    }
    return ItemTex.pixels(it.name);
  }
  function build() {
    canvas = document.createElement('canvas'); canvas.width = SIZE; canvas.height = SIZE;
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 16; const tg = tmp.getContext('2d');
    const gl3d = [];
    for (const it of ITEMS) {
      const i = next++; index[it.id] = i;
      const px = (i % COLS) * CELL, py = Math.floor(i / COLS) * CELL;
      const sprite = spriteFor(it);
      if (sprite) {
        const img = tg.createImageData(16, 16);
        const tintC = tintForSprite(it);
        for (let k = 0; k < 256; k++) {
          let r = sprite[k * 4], gg = sprite[k * 4 + 1], b = sprite[k * 4 + 2], a = sprite[k * 4 + 3];
          if (tintC && (sprite.mask ? a === 0 && (r || gg || b) : true)) { r = r * tintC[0] / 255; gg = gg * tintC[1] / 255; b = b * tintC[2] / 255; if (sprite.mask) a = 255; }
          if (sprite.mask && !tintC && a === 0 && (r || gg || b)) a = 255;
          img.data[k * 4] = r; img.data[k * 4 + 1] = gg; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = a;
        }
        tg.putImageData(img, 0, 0);
        g.drawImage(tmp, px, py, CELL, CELL);
      } else gl3d.push([it, i]);
    }
    renderBlocks(gl3d, g);
    url = canvas.toDataURL('image/png');
    const st = document.createElement('style');
    st.textContent = `.icon{background-image:url(${url});background-repeat:no-repeat;image-rendering:pixelated;}.icon.glint{-webkit-mask-image:url(${url});mask-image:url(${url});}`;
    document.head.appendChild(st);
  }
  function tintForSprite(it) {
    const d = it.block >= 0 ? BLOCKS[it.block] : null;
    if (!d || !d.tint) return null;
    if (d.tint === 'grass') return [0x91, 0xbd, 0x59];
    if (d.tint === 'foliage') return [0x77, 0xab, 0x2f];
    if (typeof d.tint === 'number') return [(d.tint >> 16) & 255, (d.tint >> 8) & 255, d.tint & 255];
    if (d.tint === 'redstone') return [255, 30, 20];
    return null;
  }
  // block icons: render each block mesh into one big render target, then read it back once
  function renderBlocks(list, g) {
    if (!list.length) return;
    const rt = new THREE.WebGLRenderTarget(SIZE, SIZE);
    const iconScene = new THREE.Scene();
    const s = 0.86;
    const cam = new THREE.OrthographicCamera(-s, s, s, -s, 0.1, 10);
    cam.position.set(2, 2 * 0.8165, 2); cam.lookAt(0, 0, 0);
    const mats = [0, 1, 2].map(mode => new THREE.ShaderMaterial({
      uniforms: { uTex: { value: U.uTex.value }, uMode: { value: mode } }, glslVersion: THREE.GLSL3, transparent: mode === 2, depthWrite: mode !== 2,
      vertexShader: 'in vec4 aUV; in vec4 aLight; in vec4 aColor; out vec3 vUV; out float vS; out vec3 vC; void main(){ vUV = aUV.xyz; vS = aLight.z; vC = aColor.rgb; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'precision highp float; precision highp sampler2DArray; uniform sampler2DArray uTex; uniform float uMode; in vec3 vUV; in float vS; in vec3 vC; out vec4 o; void main(){ vec4 t = texture(uTex, vUV); vec3 c; if (uMode < 0.5) c = mix(t.rgb * vC, t.rgb, t.a); else { if (t.a < 0.1) discard; c = t.rgb * vC; } o = vec4(c * vS, uMode > 1.5 ? t.a : 1.0); }',
    }));
    const old = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
    for (const [it, i] of list) {
      const d = BLOCKS[it.block];
      const bufs = Mesher.meshSingle(it.block, iconState(d));
      const meshes = [];
      for (let L = 0; L < 3; L++) {
        const b = bufs[L]; if (!b.n) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(b.p.slice(0, b.n * 3), 3));
        geo.setAttribute('aUV', new THREE.BufferAttribute(b.uv.slice(0, b.n * 4), 4));
        geo.setAttribute('aLight', new THREE.BufferAttribute(b.li.slice(0, b.n * 4), 4, true));
        geo.setAttribute('aColor', new THREE.BufferAttribute(b.co.slice(0, b.n * 4), 4, true));
        geo.setIndex(new THREE.BufferAttribute(b.ix.slice(0, b.ni), 1));
        const m = new THREE.Mesh(geo, mats[L]); m.position.set(-0.5, -0.5, -0.5); if (L === 2) m.renderOrder = 1;
        iconScene.add(m); meshes.push(m);
      }
      const x = (i % COLS) * CELL, y = SIZE - (Math.floor(i / COLS) + 1) * CELL;
      rt.viewport.set(x, y, CELL, CELL); rt.scissor.set(x, y, CELL, CELL); rt.scissorTest = true;
      renderer.setRenderTarget(rt);
      renderer.render(iconScene, cam);
      for (const m of meshes) { iconScene.remove(m); m.geometry.dispose(); }
    }
    const px = new Uint8Array(SIZE * SIZE * 4);
    rt.scissorTest = false;
    renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
    renderer.setRenderTarget(old);
    const img = g.getImageData(0, 0, SIZE, SIZE);
    for (const [, i] of list) {
      const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL;
      for (let yy = 0; yy < CELL; yy++) for (let xx = 0; xx < CELL; xx++) {
        const src = ((SIZE - 1 - (cy + yy)) * SIZE + cx + xx) * 4, dst = ((cy + yy) * SIZE + cx + xx) * 4;
        img.data[dst] = px[src]; img.data[dst + 1] = px[src + 1]; img.data[dst + 2] = px[src + 2]; img.data[dst + 3] = px[src + 3];
      }
    }
    g.putImageData(img, 0, 0);
    rt.dispose(); mats.forEach(m => m.dispose());
  }
  // CSS for an icon of item id at a given size in pixels
  function style(id, size) {
    const i = index[id]; if (i < 0) return '';
    const k = size / CELL;
    const pos = `${-(i % COLS) * CELL * k}px ${-Math.floor(i / COLS) * CELL * k}px`, sz = `${SIZE * k}px ${SIZE * k}px`;
    return `background-position:${pos};background-size:${sz};-webkit-mask-position:${pos};-webkit-mask-size:${sz};mask-position:${pos};mask-size:${sz};`;
  }
  // draw an item icon on a 2D canvas
  function draw(g, id, x, y, size) { const i = index[id]; if (i < 0 || !canvas) return; g.drawImage(canvas, (i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL, x, y, size, size); }
  return { build, style, draw, get canvas() { return canvas; }, CELL, spriteFor, index };
})();
