'use strict';
/* Monster spawners (the game's BaseSpawner: with a player within 16 blocks, every 10-40 seconds up to 4 mobs
   appear within 4 blocks, at most 6 of that kind around, monsters only where the light is 11 or lower; the
   small mob spins inside faster as the next spawn nears), books (writing, signing, reading, copying),
   lecterns (hold a book, turning a page gives a redstone pulse and a comparator reads the page), chiseled
   bookshelves (six book slots, picked by where you click) and decorated pots (hold one stack). */
const Spawners = (() => {
  const near = (x, y, z) => { const p = Game.player; return p && !p.spectator && !p.dead && (p.x - x - 0.5) ** 2 + (p.y - y - 0.5) ** 2 + (p.z - z - 0.5) ** 2 < 256; };
  // monsters that only spawn in the dark (blazes, silverfish, magma cubes and slimes don't care about light)
  const ANY_LIGHT = new Set(['blaze', 'silverfish', 'magma_cube', 'slime', 'endermite', 'breeze', 'ghast']);
  function delay(be) { be.delay = 200 + rnd(600); }
  // each kind's size, from the mob itself
  const DIMS = {};
  function dims(type) { if (!DIMS[type]) { const m = Mobs.create(type, 0, 0, 0); DIMS[type] = m ? [m.w, m.h] : [0.6, 1.8]; } return DIMS[type]; }
  function tick(be) {
    const { x, y, z } = be;
    if (World.getBlock(x, y, z) !== BID.spawner) return;
    if (!near(x, y, z)) { be.ospin = be.spin || 0; return; }
    // the spinning mob and the smoke and flames
    Particles.smokeAt(x + Math.random(), y + Math.random(), z + Math.random(), 0, 0, 0); Particles.flameAt(x + Math.random(), y + Math.random(), z + Math.random(), 0, 0, 0);
    be.ospin = be.spin || 0; be.spin = (be.ospin + 1000 / ((be.delay > 0 ? be.delay : 0) + 200)) % 360;
    if (be.delay === undefined || be.delay === -1) delay(be);
    if (be.delay > 0) { be.delay--; return; }
    const type = be.mob || 'pig', [w, h] = dims(type);
    const monster = (MOB_STATS[type] || [])[4] === 'monster';
    let spawned = false;
    for (let i = 0; i < 4; i++) {
      const sx = x + (Math.random() - Math.random()) * 4 + 0.5, sy = y + rnd(3) - 1, sz = z + (Math.random() - Math.random()) * 4 + 0.5;
      if (!Phys.boxFree(sx - w / 2, sy, sz - w / 2, sx + w / 2, sy + h, sz + w / 2)) continue;
      if (monster && Game.difficulty === 'peaceful') continue;
      if (monster && !ANY_LIGHT.has(type) && World.lightLevel(Math.floor(sx), Math.floor(sy), Math.floor(sz)) > 11) continue;
      // no more than 6 of the kind in the 9x9x9 box around the spawner
      const box = [x - 4, y - 4, z - 4, x + 5, y + 5, z + 5];
      if (Entities.list.filter(e => e.type === type && !e.removed && !e.dead && e.intersects(box)).length >= 6) { delay(be); return; }
      const m = Mobs.spawnEntity(type, sx, sy, sz, {});
      if (!m) continue;
      Particles.poof(m);
      spawned = true;
    }
    if (spawned) delay(be);
  }
  // the small mob turning inside each nearby spawner: lifted 0.2, spun, tipped back 30 degrees and shrunk
  // to fit (0.53125 of its size, less for mobs bigger than a block)
  const shown = new Map();
  function frame(a) {
    const p = Game.player; if (!p || !EntityRender) return;
    const seen = new Set();
    for (const c of World.chunks.values()) {
      if (!c.be.size || Math.abs(c.cx * 16 + 8 - p.x) > 40 || Math.abs(c.cz * 16 + 8 - p.z) > 40) continue;
      for (const be of c.be.values()) {
        if (be.type !== 'spawner' || !be.mob || (be.x - p.x) ** 2 + (be.y - p.y) ** 2 + (be.z - p.z) ** 2 > 1024) continue;
        const k = be.x + ',' + be.y + ',' + be.z;
        let v = shown.get(k);
        if (v && v.mob !== be.mob) { v.vis.dispose(); shown.delete(k); v = null; }
        if (!v) {
          const fake = Mobs.create(be.mob, be.x + 0.5, be.y, be.z + 0.5); if (!fake || !EntityModels.DEFS[fake.model || fake.type]) continue;
          v = { vis: new EntityRender.MobVisual(fake, fake.model || fake.type), fake, mob: be.mob }; shown.set(k, v);
        }
        seen.add(k);
        const f = v.fake, spin = (be.ospin || 0) + ((((be.spin || 0) - (be.ospin || 0)) % 360 + 360) % 360) * a;
        f.x = f.px = be.x + 0.5; f.y = f.py = be.y; f.z = f.pz = be.z + 0.5; f.bodyYaw = f.pbodyYaw = f.yaw = f.pyaw = 0;
        v.vis.update(a, { ls: 0, la: 0, t: Game.gameTime + a, headYaw: 0, pitch: 0, swing: 0, e: f });
        const o = v.vis.obj, size = Math.max(f.w || 0.6, f.h || 1.8), sc = 0.53125 / Math.max(1, size);
        o.position.set(be.x + 0.5, be.y + 0.2, be.z + 0.5);
        o.rotation.set(-30 * Math.PI / 180, spin * 10 * Math.PI / 180, 0, 'YXZ');
        o.scale.setScalar(sc);
      }
    }
    for (const [k, v] of shown) if (!seen.has(k)) { v.vis.dispose(); shown.delete(k); }
  }
  function clear() { for (const v of shown.values()) v.vis.dispose(); shown.clear(); }
  return { tick, frame, clear };
})();
/* ---------------------------------------------------------------- books */
const Books = (() => {
  // the game's limits: 100 pages of 1024 characters, a title of 32
  function open(p, s, lectern) { Screens.open(new BookScreen(p, s, lectern || null)); }
  // a lectern: put a book on it, read it, take it off; turning a page sends a redstone pulse
  function lectern(p, x, y, z, st, held) {
    let be = World.getBE(x, y, z); if (!be) { be = { type: 'lectern', book: null }; World.setBE(x, y, z, be); }
    const hn = held ? ITEMS[held.id].name : '';
    if (!be.book) {
      if (hn !== 'writable_book' && hn !== 'written_book') return false;
      be.book = Object.assign({}, held, { count: 1 }); be.page = 0; be.pages = Math.max(1, ((held.tag && held.tag.pages) || ['']).length);
      if (!p.creative) { held.count--; if (!held.count) p.inv.held = null; p.inv.changed(); }
      World.setBlock(x, y, z, BID.lectern, st | 8, 4); Sound.play('book_put', null, { x, y, z }); Redstone.analogChanged(x, y, z);
      return true;
    }
    open(p, be.book, { x, y, z, be });
    return true;
  }
  function pageChanged(lec) {
    const { x, y, z, be } = lec;
    if (World.getBlock(x, y, z) !== BID.lectern) return;
    // the pulse: on now, off again two ticks later
    World.setBlock(x, y, z, BID.lectern, World.getState(x, y, z) | 16, 4); Redstone.update(x, y, z); Ticks.schedule(x, y, z, 2, BID.lectern);
    Redstone.analogChanged(x, y, z); void be;
  }
  function takeFromLectern(lec, p) {
    const { x, y, z, be } = lec;
    if (!be.book) return;
    const left = p.inv.add(be.book); if (left) ItemUse.drop(p, left);
    be.book = null; World.setBlock(x, y, z, BID.lectern, World.getState(x, y, z) & ~8, 4); Redstone.analogChanged(x, y, z); Sound.play('book_put', null, { x, y, z });
  }
  // copying: a written book and up to 8 book and quills (copies of copies can't be copied)
  function copyRecipe(items, grid) {
    const w = items.filter(s => ITEMS[s.id].name === 'written_book'), q = items.filter(s => ITEMS[s.id].name === 'writable_book');
    if (w.length !== 1 || !q.length || w.length + q.length !== items.length) return null;
    const gen = (w[0].tag && w[0].tag.generation) || 0; if (gen >= 2) return null;
    return { result: stack('written_book', q.length, { tag: Object.assign({}, w[0].tag, { generation: gen + 1 }) }), recipe: { special: 'book_cloning', keep: grid.indexOf(w[0]) } };
  }
  const GEN = ['Original', 'Copy of original', 'Copy of a copy', 'Tattered'];
  function tooltip(s) { if (ITEMS[s.id].name !== 'written_book' || !s.tag) return ''; return `<div style="color:#aaa">by ${escapeHTML(s.tag.author || '?')}</div><div style="color:#aaa">${GEN[s.tag.generation || 0]}</div>`; }
  return { open, lectern, pageChanged, takeFromLectern, copyRecipe, tooltip };
})();
class BookScreen extends Screens.Screen {
  constructor(p, s, lectern) {
    super('Book', 192, 216);
    this.p = p; this.s = s; this.lectern = lectern; this.noBg = true;
    this.written = ITEMS[s.id].name === 'written_book' || !!lectern;
    this.pages = ((s.tag && s.tag.pages) || ['']).slice(); if (!this.pages.length) this.pages = [''];
    this.page = lectern ? lectern.be.page || 0 : 0; this.signing = false;
    this.root = document.createElement('div'); this.root.className = 'book';
    this.parts.push({ kind: 'el', node: this.root });
    this.draw();
  }
  save() { if (this.written) return; this.s.tag = Object.assign({}, this.s.tag || {}, { pages: this.pages.slice() }); this.p.inv.changed(); }
  turn(d) {
    const n = this.page + d;
    if (n < 0) return;
    if (n >= this.pages.length) { if (this.written || this.pages.length >= 100) return; this.pages.push(''); }
    this.page = n; Sound.play('book_page_turn');
    if (this.lectern) { this.lectern.be.page = n; Books.pageChanged(this.lectern); }
    this.draw();
  }
  draw() {
    const r = this.root; r.innerHTML = '';
    const head = document.createElement('div'); head.className = 'bookhead';
    if (this.signing) {
      head.textContent = 'Enter Book Title:'; head.classList.add('center');
      const t = document.createElement('input'); t.className = 'booktitle'; t.maxLength = 32; t.value = this.title || '';
      t.addEventListener('input', () => { this.title = t.value; }); t.addEventListener('keydown', e => e.stopPropagation());
      const by = document.createElement('div'); by.className = 'bookby'; by.textContent = 'by Player';
      const warn = document.createElement('div'); warn.className = 'bookwarn'; warn.textContent = 'Note! When you sign the book, it will no longer be editable.';
      r.append(head, t, by, warn);
      this.button('Sign and Close', () => { if (!this.title || !this.title.trim()) return; const s = this.s; s.id = IID.written_book; s.tag = { title: this.title.trim(), author: 'Player', pages: this.pages.slice(), generation: 0 }; this.written = true; this.p.inv.changed(); Screens.close(); }, 'left');
      this.button('Cancel', () => { this.signing = false; this.draw(); }, 'right');
      setTimeout(() => t.focus(), 0);
      return;
    }
    head.textContent = `Page ${this.page + 1} of ${this.pages.length}`;
    r.appendChild(head);
    if (this.written) { const pg = document.createElement('div'); pg.className = 'bookpage'; pg.textContent = this.pages[this.page] || ''; r.appendChild(pg); }
    else {
      const ta = document.createElement('textarea'); ta.className = 'bookpage'; ta.maxLength = 1024; ta.value = this.pages[this.page] || '';
      ta.addEventListener('input', () => { this.pages[this.page] = ta.value; this.save(); });
      ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') Screens.close(); });
      r.appendChild(ta); setTimeout(() => ta.focus(), 0);
    }
    const nav = document.createElement('div'); nav.className = 'booknav';
    const prev = document.createElement('div'); prev.className = 'bookarrow prev'; prev.textContent = '◀'; prev.onclick = () => this.turn(-1);
    const next = document.createElement('div'); next.className = 'bookarrow next'; next.textContent = '▶'; next.onclick = () => this.turn(1);
    if (this.page > 0) nav.appendChild(prev); if (!this.written || this.page < this.pages.length - 1) nav.appendChild(next);
    r.appendChild(nav);
    // the game's buttons under the book
    if (this.lectern) { this.button('Done', () => Screens.close(), this.p.spectator ? 'full' : 'left'); if (!this.p.spectator) this.button('Take Book', () => { Books.takeFromLectern(this.lectern, this.p); Screens.close(); }, 'right'); }
    else if (this.written) this.button('Done', () => Screens.close(), 'full');
    else { this.button('Sign', () => { this.save(); this.signing = true; this.draw(); }, 'left'); this.button('Done', () => { this.save(); Screens.close(); }, 'right'); }
  }
  button(label, fn, at) { const b = document.createElement('div'); b.className = 'mbtn bookbtn ' + at; b.textContent = label; b.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); Sound.play('ui'); fn(); }); this.root.appendChild(b); }
  onClose() { this.save(); }
}

/* ---------------------------------------------------------------- decorated pots
   Four sides, each plain brick or a pottery sherd's picture (the crafting grid's top, left, right and bottom
   slots become the back, left, right and front). Broken with a tool from #breaks_decorated_pots (without silk
   touch) or hit by a projectile the pot shatters into its four pieces; otherwise it drops whole. Putting an
   item in makes it wobble (7 ticks), an empty hand shakes it (10 ticks), the game's DecoratedPotRenderer. */
const Pots = (() => {
  // each distinct set of sides gets a number the block model can use
  const DESIGNS = [null], index = new Map();
  const isPiece = n => n === 'brick' || /_pottery_sherd$/.test(n);
  function designOf(sherds) {
    if (!sherds || sherds.every(n => !n || n === 'brick')) return 0;
    const k = sherds.map(n => n || 'brick').join(',');
    let i = index.get(k); if (i === undefined) { i = DESIGNS.length; DESIGNS.push(k.split(',')); index.set(k, i); }
    return i;
  }
  const wobbling = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  // what the block model draws here: 0xffff while it wobbles (the moving copy is drawn instead)
  function design(x, y, z) {
    if (wobbling.has(key(x, y, z))) return 0xffff;
    const be = World.getBE(x, y, z);
    return be ? designOf(be.sherds) : 0;
  }
  function sideTex(name) { return !name || name === 'brick' ? 'decorated_pot_side' : name.replace('_pottery_sherd', '') + '_pottery_pattern'; }
  function wobble(x, y, z, neg) {
    const k = key(x, y, z), old = wobbling.get(k);
    if (old) { scene.remove(old.obj); old.obj.material.dispose(); }
    const id = World.getBlock(x, y, z), st = World.getState(x, y, z), be = World.getBE(x, y, z);
    const m = ItemMesh.blockMesh(id, st, be ? designOf(be.sherds) : 0); if (!m) return;
    m.position.set(-0.5, 0, -0.5);
    const obj = new THREE.Group(); obj.add(m); obj.position.set(x + 0.5, y, z + 0.5); obj.material = m.material; scene.add(obj);
    wobbling.set(k, { obj, start: Game.gameTime, neg, x, y, z });
    const [sl, bl] = EntityRender.lightAt(x + 0.5, y + 0.5, z + 0.5); m.material.uniforms.uEnv.value.set(sl, bl);
    if (!old) World.markDirty(x, y, z);
  }
  function frame(a) {
    for (const [k, w] of wobbling) {
      const f = (Game.gameTime - w.start + a) / (w.neg ? 10 : 7);
      if (f > 1 || World.getBlock(w.x, w.y, w.z) !== BID.decorated_pot) { scene.remove(w.obj); w.obj.material.dispose(); wobbling.delete(k); World.markDirty(w.x, w.y, w.z); continue; }
      if (w.neg) { const g = Math.sin(-f * 3 * Math.PI) * 0.125; w.obj.rotation.set(0, g * (1 - f), 0); }
      else { const h = f * Math.PI * 2, i = -1.5 * (Math.cos(h) + 0.5) * Math.sin(h / 2), j = Math.sin(h); w.obj.rotation.set(i * 0.015625, 0, j * 0.015625, 'XYZ'); }
    }
  }
  function clear() { for (const w of wobbling.values()) { scene.remove(w.obj); w.obj.material.dispose(); } wobbling.clear(); }
  // the crafting recipe: bricks or sherds in the four middle-edge slots of a crafting table
  function recipe(grid, w) {
    if (w !== 3 || grid.length !== 9) return null;
    for (let i = 0; i < 9; i++) { const s = grid[i], edge = i === 1 || i === 3 || i === 5 || i === 7; if (edge ? !(s && isPiece(ITEMS[s.id].name)) : s) return null; }
    const sherds = [1, 3, 5, 7].map(i => ITEMS[grid[i].id].name);
    return { result: stack('decorated_pot', 1, sherds.every(n => n === 'brick') ? {} : { tag: { sherds } }), recipe: { special: 'decorated_pot' } };
  }
  // the pot keeps its sides when placed and when picked up whole
  function placed(x, y, z, s) { const be = World.getBE(x, y, z); if (be && s && s.tag && s.tag.sherds) { be.sherds = s.tag.sherds.slice(); World.markDirty(x, y, z); } }
  const shatters = held => held && (MCDATA.itemTags.breaks_decorated_pots || []).includes(ITEMS[held.id].name) && !enchLevel(held, 'silk_touch');
  function drops(be, cracked, x, y, z) {
    const sherds = (be && be.sherds) || ['brick', 'brick', 'brick', 'brick'];
    if (cracked) { for (const n of sherds) Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, stack(n || 'brick')); Sound.play('decorated_pot_shatter', null, { x, y, z }); }
    else Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, stack('decorated_pot', 1, be && be.sherds ? { tag: { sherds: be.sherds.slice() } } : {}));
  }
  // hit by an arrow, trident or other projectile: it breaks into pieces, spilling what it held
  // a pot from a structure holds a loot table, rolled the first time it is touched
  function unpack(be) { if (!be || !be.loot) return; const r = be.seed ? new Rand(be.seed) : null; const list = LootTables.roll(be.loot, { r: r ? () => r.next() : Math.random }); be.items = [list[0] || null]; be.loot = null; }
  function hitByProjectile(x, y, z) {
    const be = World.getBE(x, y, z); unpack(be);
    if (be && be.items) for (const s of be.items) if (s) Drops.spawnItem(x + 0.5, y + 0.5, z + 0.5, s, true);
    Particles.blockBreak(x, y, z, BID.decorated_pot, World.getState(x, y, z));
    Blocks.remove(x, y, z, null, true);
    drops(be, true, x, y, z);
  }
  function tooltip(s) {
    if (ITEMS[s.id].name !== 'decorated_pot' || !s.tag || !s.tag.sherds) return '';
    return s.tag.sherds.map(n => `<div style="color:#aaa">${escapeHTML(ITEMS[IID[n || 'brick']].display)}</div>`).join('');
  }
  return { DESIGNS, design, sideTex, wobble, frame, clear, recipe, placed, shatters, drops, hitByProjectile, tooltip, unpack };
})();

/* ---------------------------------------------------------------- chiseled bookshelves */
const Shelves = (() => {
  const BOOKS = new Set(['book', 'writable_book', 'written_book', 'enchanted_book', 'knowledge_book']);
  // the slot under the click: three columns (cut at 6/16 and 11/16), two rows
  function slotAt(hit, st) {
    const f = (st & 3) + 2;
    const fx = hit.px - hit.x, fy = hit.py - hit.y, fz = hit.pz - hit.z;
    const u = { 2: 1 - fx, 3: fx, 4: fz, 5: 1 - fz }[f];
    const col = u < 0.375 ? 0 : u < 0.6875 ? 1 : 2;
    return col + (fy >= 0.5 ? 0 : 3);
  }
  // the block's state shows which slots hold a book; the comparator reads the last slot used
  function sync(x, y, z, be) {
    const st = World.getState(x, y, z), old = st >> 2;
    let mask = 0; be.items.forEach((s, k) => { if (s) mask |= 1 << k; });
    if (mask === old) return;
    const diff = mask ^ old; for (let k = 0; k < 6; k++) if (diff & (1 << k)) { be.last = k; break; }
    World.setBlock(x, y, z, BID.chiseled_bookshelf, (st & 3) | (mask << 2), 4);
  }
  function use(p, hit, held) {
    const { x, y, z } = hit, st = World.getState(x, y, z);
    if (hit.face !== (st & 3) + 2) return false;
    let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE('chiseled_bookshelf'); World.setBE(x, y, z, be); }
    const i = slotAt(hit, st), cur = be.items[i];
    if (cur) {
      // taking a book out (with any item in hand)
      be.items[i] = null; be.last = i;
      const left = p.inv.add(cur); if (left) ItemUse.drop(p, left);
      Sound.play(ITEMS[cur.id].name === 'enchanted_book' ? 'chiseled_bookshelf_pickup_enchanted' : 'chiseled_bookshelf_pickup', null, { x, y, z });
    } else {
      // an empty slot takes a book; anything else does nothing here
      if (!held || !BOOKS.has(ITEMS[held.id].name)) return true;
      be.items[i] = Object.assign({}, held, { count: 1 }); be.last = i;
      if (!p.creative) { held.count--; if (!held.count) p.inv.held = null; p.inv.changed(); }
      Sound.play(ITEMS[held.id].name === 'enchanted_book' ? 'chiseled_bookshelf_insert_enchanted' : 'chiseled_bookshelf_insert', null, { x, y, z });
    }
    sync(x, y, z, be);
    const c = World.chunkAt(x, z); if (c) c.modified = true;
    Redstone.analogChanged(x, y, z);
    return true;
  }
  // a decorated pot holds one stack: items go in one at a time (the sound rising as it fills) and it wobbles;
  // with nothing to put in it shakes the other way
  function pot(p, x, y, z, held) {
    let be = World.getBE(x, y, z); if (!be) { be = Blocks.newBE('decorated_pot'); World.setBE(x, y, z, be); }
    Pots.unpack(be);
    const cur = be.items[0];
    if (held && (!cur || (sameItem(cur, held) && cur.count < maxStack(cur)))) {
      if (cur) cur.count++; else be.items[0] = Object.assign({}, held, { count: 1 });
      if (!p.creative) { held.count--; if (!held.count) p.inv.held = null; p.inv.changed(); }
      const f = be.items[0].count / maxStack(be.items[0]);
      Sound.play('decorated_pot_insert', null, { x, y, z, pitch: 0.7 + 0.5 * f });
      for (let k = 0; k < 7; k++) Particles.generic(x + 0.5, y + 1.2, z + 0.5, (Math.random() - 0.5) * 0.04, 0.02 + Math.random() * 0.03, (Math.random() - 0.5) * 0.04, { size: 0.08, life: 20, grav: 0, drag: 0.96, color: [0.73, 0.69, 0.62] });
      Pots.wobble(x, y, z, false);
      const c = World.chunkAt(x, z); if (c) c.modified = true;
      Redstone.analogChanged(x, y, z);
      return true;
    }
    Sound.play('decorated_pot_insert_fail', null, { x, y, z });
    Pots.wobble(x, y, z, true);
    return true;
  }
  return { use, pot, slotAt, sync, BOOKS };
})();

// the pot's side with each sherd's picture pressed into it (the game's <sherd>_pottery_pattern textures)
(() => {
  const { def, H } = Tex;
  const MOTIF = {
    angler: ['....', '..#.', '.##.', '#..#'], archer: ['#...', '.##.', '.##.', '...#'], arms_up: ['#..#', '.##.', '.##.', '.#.#'], blade: ['...#', '..#.', '.#..', '#...'],
    brewer: ['.##.', '.##.', '####', '.##.'], burn: ['.#..', '.##.', '###.', '####'], danger: ['.##.', '####', '.##.', '#..#'], explorer: ['####', '#.##', '##.#', '####'],
    flow: ['.##.', '#...', '.##.', '...#'], friend: ['.##.', '####', '####', '.##.'], guster: ['.##.', '####', '.#..', '..#.'], heart: ['#.#.', '####', '.##.', '..#.'],
    heartbreak: ['#.#.', '#.##', '.#..', '..#.'], howl: ['#..#', '.##.', '####', '.##.'], miner: ['###.', '..#.', '.#..', '#...'], mourner: ['.##.', '####', '#..#', '#..#'],
    plenty: ['####', '#..#', '#..#', '####'], prize: ['..#.', '.###', '..#.', '....'], scrape: ['####', '.#..', '.#..', '.#..'], sheaf: ['#.#.', '.#.#', '#.#.', '.#.#'],
    shelter: ['.#..', '###.', '#.#.', '#.#.'], skull: ['.##.', '#..#', '.##.', '.##.'], snort: ['####', '#..#', '#.##', '####'],
  };
  for (const n in MOTIF) def(n + '_pottery_pattern', c => {
    c.copy('decorated_pot_side');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (MOTIF[n][y][x] === '#') c.rect(2 + x * 3, 2 + y * 3, 4 + x * 3, 4 + y * 3, H(0x4a2418));
  });
  def('lectern_book', c => { c.rect(0, 0, 15, 15, H(0xf2ead2)); c.rect(7, 0, 8, 15, H(0xb8a888)); for (let y = 2; y < 14; y += 2) { c.rect(1, y, 6, y, H(0x8a8070)); c.rect(9, y, 14, y, H(0x8a8070)); } });
  def('lectern_book_cover', c => { c.rect(0, 0, 15, 15, H(0x6a3a1a)); c.rect(7, 0, 8, 15, H(0x4a2410)); });
  def('lectern_book_edge', c => { c.rect(0, 0, 15, 15, H(0xe8dcc0)); c.rect(0, 15, 15, 15, H(0x6a3a1a)); });
})();

// the bookshelf's front for each set of filled slots
(() => {
  const { def, H } = Tex;
  const SPINES = [0x8a2a2a, 0x2a4a8a, 0x2a6a2a, 0x7a5a2a, 0x6a2a6a, 0x2a6a6a];
  const cols = [[1, 4], [6, 9], [11, 14]], rows = [[1, 6], [9, 14]];
  for (let mask = 1; mask < 64; mask++) def('chiseled_bookshelf_' + mask, c => {
    c.copy('chiseled_bookshelf_empty');
    for (let i = 0; i < 6; i++) {
      if (!(mask & (1 << i))) continue;
      const [x0, x1] = cols[i % 3], [y0, y1] = rows[Math.floor(i / 3)];
      for (let x = x0; x <= x1; x++) { const col = SPINES[(x + i * 2) % SPINES.length], top = y0 + ((x * 7 + i) % 3 === 0 ? 1 : 0); for (let y = top; y <= y1; y++) c.px(x, y, H(y === top + 1 ? 0xd8b44a : col)); }
    }
  });
})();
