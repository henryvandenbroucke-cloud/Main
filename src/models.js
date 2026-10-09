'use strict';
/* Block models as lists of boxes ("elements", in 1/16ths like the game's block models) and the collision /
   selection shapes. Models are built facing north and turned for the block's facing. Connections (fences,
   panes, walls, redstone, stairs corners, chests) are read from the neighbours when the model is built. */
const Models = (() => {
  const B = BID, D = BLOCKS;
  const FACES = ['down', 'up', 'north', 'south', 'west', 'east'];
  // element: { a: [x0,y0,z0], b: [x1,y1,z1] (0..16), t: [6 texture names or null], uv: [6 explicit uv or null], rot: [6 uv rotations],
  //            tint: bool or [6], shade: bool, r: { axis, angle, origin }, noCull: bool }
  function box(x0, y0, z0, x1, y1, z1, tex, o) {
    o = o || {};
    const t = new Array(6);
    if (typeof tex === 'string') t.fill(tex);
    else for (let f = 0; f < 6; f++) { const n = FACES[f]; t[f] = tex[n] !== undefined ? tex[n] : (f < 2 ? (tex.end !== undefined ? tex.end : tex.all) : (tex.side !== undefined ? tex.side : tex.all)); if (t[f] === undefined) t[f] = null; }
    return { a: [x0, y0, z0], b: [x1, y1, z1], t, uv: o.uv || null, rot: o.rot || null, tint: o.tint || false, shade: o.shade !== false, r: o.r || null, noCull: !!o.noCull, light: o.light || 0 };
  }
  // rotate a model around the block centre by k quarter turns clockwise (seen from above): north -> east -> south -> west
  const ROT_FACE = [[0, 1, 2, 3, 4, 5], [0, 1, 5, 4, 2, 3], [0, 1, 3, 2, 5, 4], [0, 1, 4, 5, 3, 2]];
  function rotY(els, k, lock) {
    k = ((k % 4) + 4) % 4; if (!k) return els;
    return els.map(e => {
      let [x0, y0, z0] = e.a, [x1, y1, z1] = e.b;
      for (let i = 0; i < k; i++) { const nx0 = 16 - z1, nx1 = 16 - z0, nz0 = x0, nz1 = x1; x0 = nx0; x1 = nx1; z0 = nz0; z1 = nz1; }
      const t = new Array(6), uv = e.uv ? new Array(6) : null, rr = new Array(6).fill(0), tint = Array.isArray(e.tint) ? new Array(6) : e.tint;
      for (let f = 0; f < 6; f++) { const nf = ROT_FACE[k][f]; t[nf] = e.t[f]; if (uv) uv[nf] = e.uv[f]; if (e.rot) rr[nf] = e.rot[f] || 0; if (Array.isArray(e.tint)) tint[nf] = e.tint[f]; }
      // the top and bottom textures turn with the block unless the texture is locked to the world (stairs)
      if (!lock) { rr[1] = (rr[1] + k * 90) % 360; rr[0] = (rr[0] + (4 - k) * 90) % 360; }
      return Object.assign({}, e, { a: [x0, y0, z0], b: [x1, y1, z1], t, uv, rot: rr, tint, r: e.r ? rotR(e.r, k) : null });
    });
  }
  function rotR(r, k) {
    let o = r.origin.slice(), axis = r.axis, angle = r.angle;
    for (let i = 0; i < k; i++) { o = [16 - o[2], o[1], o[0]]; if (axis === 'x') { axis = 'z'; } else if (axis === 'z') { axis = 'x'; angle = -angle; } }
    return { axis, angle, origin: o };
  }
  // flip upside down (for top slabs, upside-down stairs, ceiling switches)
  function flipY(els) { return els.map(e => { const t = e.t.slice(); const tt = t[0]; t[0] = t[1]; t[1] = tt; return Object.assign({}, e, { a: [e.a[0], 16 - e.b[1], e.a[2]], b: [e.b[0], 16 - e.a[1], e.b[2]], t }); }); }
  // horizontal facing (2..5) -> quarter turns from north
  const TURNS = { 2: 0, 5: 1, 3: 2, 4: 3 };
  const turnsOf = st => TURNS[st & 7] || 0;

  const cache = new Map();
  function get(id, state, ctx, x, y, z) {
    const d = D[id];
    const conn = CONNECT[d.model] ? CONNECT[d.model](d, state, ctx, x, y, z) : 0;
    const key = (id * 256 + state) * 65536 + conn;
    let m = cache.get(key);
    if (!m) { m = (MODEL[d.model] || MODEL.cube)(d, state, conn); cache.set(key, m); }
    return m;
  }

  // ---------------------------------------------------------------- neighbour connections
  const isFull = id => OPAQUE[id] === 1;
  const fenceLike = id => { const m = D[id].model; return m === 'fence'; };
  const CONNECT = {
    fence: (d, s, c, x, y, z) => { let m = 0; for (let f = 2; f < 6; f++) { const n = c(x + DX[f], y, z + DZ[f]); const nd = D[n]; if (isFull(n) || (nd.model === 'fence' && (d.name === 'nether_brick_fence') === (nd.name === 'nether_brick_fence')) || nd.model === 'gate') m |= 1 << f; } return m; },
    pane: (d, s, c, x, y, z) => { let m = 0; for (let f = 2; f < 6; f++) { const n = c(x + DX[f], y, z + DZ[f]); const nd = D[n]; if (isFull(n) || nd.model === 'pane' || nd.model === 'wall') m |= 1 << f; } return m; },
    wall: (d, s, c, x, y, z) => { let m = 0; for (let f = 2; f < 6; f++) { const n = c(x + DX[f], y, z + DZ[f]); const nd = D[n]; if (isFull(n) || nd.model === 'wall' || nd.model === 'pane' || nd.model === 'gate') m |= 1 << f; } const up = c(x, y + 1, z); if (up && D[up].model !== 'none' && !D[up].replaceable) m |= 64; if (D[up].model === 'wall') m |= 64; return m; },
    stairs: (d, s, c, x, y, z) => {
      // vanilla stair shapes: straight, inner or outer corner, from the stairs in front and behind
      const f = s & 7, top = s & 8;
      const L = { 2: 4, 3: 5, 4: 3, 5: 2 }, R = { 2: 5, 3: 4, 4: 2, 5: 3 };
      const back = c(x + DX[f], y, z + DZ[f]), bs = c.state(x + DX[f], y, z + DZ[f]);
      if (D[back].model === 'stairs' && (bs & 8) === top) { const bf = bs & 7; if (bf === L[f] && !sameStair(c, x, y, z, OPP_H(bf), s)) return 3; if (bf === R[f] && !sameStair(c, x, y, z, OPP_H(bf), s)) return 4; }
      const front = c(x - DX[f], y, z - DZ[f]), fs = c.state(x - DX[f], y, z - DZ[f]);
      if (D[front].model === 'stairs' && (fs & 8) === top) { const ff = fs & 7; if (ff === L[f] && !sameStair(c, x, y, z, ff, s)) return 1; if (ff === R[f] && !sameStair(c, x, y, z, ff, s)) return 2; }
      return 0;
    },
    wire: (d, s, c, x, y, z) => {
      let m = 0;
      const upBlocked = isFull(c(x, y + 1, z));
      for (let f = 2; f < 6; f++) {
        const nx = x + DX[f], nz = z + DZ[f], n = c(nx, y, nz);
        if (Redstone.connects(n, c.state(nx, y, nz), f)) m |= 1 << f;
        else if (!isFull(n) && D[c(nx, y - 1, nz)].name === 'redstone_wire') m |= 1 << f;
        else if (!upBlocked && isFull(n) && D[c(nx, y + 1, nz)].name === 'redstone_wire') m |= (1 << f) | (1 << (f + 6));
      }
      return m;
    },
    chorus: (d, s, c, x, y, z) => { if (d.name === 'chorus_flower') return 0; let m = 0; for (let f = 0; f < 6; f++) { const n = c(x + DX[f], y + DY[f], z + DZ[f]); if (n === B.chorus_plant || n === B.chorus_flower || (f === 0 && n === B.end_stone)) m |= 1 << f; } return m; },
    gate: (d, s, c, x, y, z) => { const f = s & 7; const a = f === 2 || f === 3 ? [4, 5] : [2, 3]; let w = 0; for (const k of a) if (D[c(x + DX[k], y, z + DZ[k])].model === 'wall') w = 1; return w; },
    grass: (d, s, c, x, y, z) => 0,
    tripwire: (d, s, c, x, y, z) => { let m = 0; for (let f = 2; f < 6; f++) { const n = c(x + DX[f], y, z + DZ[f]); if (n === B.tripwire || n === B.tripwire_hook) m |= 1 << f; } return m; },
    scaffolding: (d, s, c, x, y, z) => c(x, y - 1, z) === B.scaffolding ? 0 : 1,
    pointed: () => 0,
  };
  const OPP_H = f => OPP[f];
  function sameStair(c, x, y, z, f, s) { const n = c(x + DX[f], y, z + DZ[f]), ns = c.state(x + DX[f], y, z + DZ[f]); return D[n].model === 'stairs' && (ns & 15) === (s & 15); }

  // ---------------------------------------------------------------- models
  const T = (d, k) => d.tex[k];
  const sides = d => ({ up: d.tex.up, down: d.tex.down, north: d.tex.north, south: d.tex.south, west: d.tex.west, east: d.tex.east });
  const MODEL = {
    cube: (d, s) => {
      const t = sides(d), tint = !!d.tint;
      const n = d.name;
      if (d.stateTex) return [box(0, 0, 0, 16, 16, 16, d.stateTex(s))];
      if (d.place === 'axis') {
        const ax = s & 3, e = d.tex.up, sd = d.tex.side;
        if (ax === 1) return [box(0, 0, 0, 16, 16, 16, { west: e, east: e, up: sd, down: sd, north: sd, south: sd }, { rot: [90, 90, 90, 90, 0, 0] })];
        if (ax === 2) return [box(0, 0, 0, 16, 16, 16, { north: e, south: e, up: sd, down: sd, west: sd, east: sd }, { rot: [0, 0, 0, 0, 90, 90] })];
        return [box(0, 0, 0, 16, 16, 16, t)];
      }
      if (n === 'grass_block' || n === 'podzol' || n === 'mycelium') {
        if (s & 1) return [box(0, 0, 0, 16, 16, 16, { up: n === 'grass_block' ? 'snow' : t.up, down: t.down, side: 'grass_block_snow' }, { tint: false })];
        return [box(0, 0, 0, 16, 16, 16, t, { tint })];
      }
      if (n === 'farmland') return [box(0, 0, 0, 16, 15, 16, { up: (s & 7) === 7 ? 'farmland_moist' : 'farmland', down: 'dirt', side: 'dirt' })];
      if (n === 'redstone_lamp' && (s & 1)) return [box(0, 0, 0, 16, 16, 16, 'redstone_lamp_on')];
      if (n === 'respawn_anchor') return [box(0, 0, 0, 16, 16, 16, { up: (s & 7) ? 'respawn_anchor_top' : 'respawn_anchor_top_off', down: 'respawn_anchor_bottom', side: 'respawn_anchor_side' + Math.min(4, s & 7) })];
      if (n === 'jukebox' && (s & 1)) return [box(0, 0, 0, 16, 16, 16, t)];
      if (d.place === 'facing_h' || d.place === 'facing_h_opp' || d.place === 'facing6' || d.place === 'facing6_opp') {
        const f = s & 7;
        let front = d.tex.front;
        if ((n === 'furnace' || n === 'smoker' || n === 'blast_furnace') && (s & 8)) front = n + '_front_on';
        if (n === 'observer') { const back = (s & 8) ? 'observer_back_on' : 'observer_back'; return facingCube({ front: 'observer_front', back, side: 'observer_side', top: 'observer_top' }, f, true); }
        if (n === 'barrel') return facingCube({ front: (s & 8) ? 'barrel_top_open' : 'barrel_top', back: 'barrel_bottom', side: 'barrel_side', top: 'barrel_side' }, f, true);
        if (n.endsWith('shulker_box')) return facingCube({ front: d.tex.up, back: d.tex.down, side: d.tex.side, top: d.tex.side }, f, true);
        if ((n === 'dispenser' || n === 'dropper') && f < 2) return [box(0, 0, 0, 16, 16, 16, { up: f === 1 ? n + '_front_vertical' : 'furnace_top', down: f === 0 ? n + '_front_vertical' : 'furnace_top', side: 'furnace_top' })];
        if (f < 2) return [box(0, 0, 0, 16, 16, 16, t, { tint })];
        return rotY([box(0, 0, 0, 16, 16, 16, { up: t.up, down: t.down, north: front, south: t.south === front ? t.side : t.south, west: t.west === front ? t.side : t.west, east: t.east === front ? t.side : t.east }, { tint })], turnsOf(s));
      }
      return [box(0, 0, 0, 16, 16, 16, t, { tint })];
    },
    none: () => [],
    slab: (d, s) => { const t = (s >> 3) & 3; const tex = { up: d.tex.up, down: d.tex.down, side: d.tex.side }; if (t === 2) return [box(0, 0, 0, 16, 16, 16, tex)]; return t === 1 ? [box(0, 8, 0, 16, 16, 16, tex)] : [box(0, 0, 0, 16, 8, 16, tex)]; },
    stairs: (d, s, conn) => {
      const tex = { up: d.tex.up, down: d.tex.down, side: d.tex.side };
      let els = [box(0, 0, 0, 16, 8, 16, tex)];
      // facing north means the high side is to the north
      if (conn === 0) els.push(box(0, 8, 0, 16, 16, 8, tex));
      else if (conn === 1) { els.push(box(0, 8, 0, 16, 16, 8, tex)); els.push(box(0, 8, 8, 8, 16, 16, tex)); } // inner left
      else if (conn === 2) { els.push(box(0, 8, 0, 16, 16, 8, tex)); els.push(box(8, 8, 8, 16, 16, 16, tex)); } // inner right
      else if (conn === 3) els.push(box(0, 8, 0, 8, 16, 8, tex)); // outer left
      else els.push(box(8, 8, 0, 16, 16, 8, tex)); // outer right
      els = rotY(els, turnsOf(s), true);
      return s & 8 ? flipY(els) : els;
    },
    fence: (d, s, conn) => {
      const t = d.tex.side, els = [box(6, 0, 6, 10, 16, 10, t)];
      const arm = (f) => { for (const [y0, y1] of [[12, 15], [6, 9]]) { if (f === 2) els.push(box(7, y0, 0, 9, y1, 6, t)); if (f === 3) els.push(box(7, y0, 10, 9, y1, 16, t)); if (f === 4) els.push(box(0, y0, 7, 6, y1, 9, t)); if (f === 5) els.push(box(10, y0, 7, 16, y1, 9, t)); } };
      for (let f = 2; f < 6; f++) if (conn & (1 << f)) arm(f);
      return els;
    },
    pane: (d, s, conn) => {
      const t = d.tex.side, e = d.tex.up, els = [];
      const tex = { up: e, down: e, north: t, south: t, west: t, east: t };
      if (!(conn & 60)) { els.push(box(7, 0, 7, 9, 16, 9, tex)); els.push(box(7, 0, 0, 9, 16, 7, tex)); els.push(box(7, 0, 9, 9, 16, 16, tex)); els.push(box(0, 0, 7, 7, 16, 9, tex)); els.push(box(9, 0, 7, 16, 16, 9, tex)); return els; }
      els.push(box(7, 0, 7, 9, 16, 9, tex));
      if (conn & 4) els.push(box(7, 0, 0, 9, 16, 7, tex)); if (conn & 8) els.push(box(7, 0, 9, 9, 16, 16, tex));
      if (conn & 16) els.push(box(0, 0, 7, 7, 16, 9, tex)); if (conn & 32) els.push(box(9, 0, 7, 16, 16, 9, tex));
      return els;
    },
    wall: (d, s, conn) => {
      const tex = { up: d.tex.up, down: d.tex.down, side: d.tex.side }, els = [];
      const ns = (conn & 12) === 12 && !(conn & 48), ew = (conn & 48) === 48 && !(conn & 12);
      const post = (conn & 64) || !(ns || ew);
      if (post) els.push(box(4, 0, 4, 12, 16, 12, tex));
      const h = 14;
      if (conn & 4) els.push(box(5, 0, 0, 11, h, post ? 4 : 8, tex)); if (conn & 8) els.push(box(5, 0, post ? 12 : 8, 11, h, 16, tex));
      if (conn & 16) els.push(box(0, 0, 5, post ? 4 : 8, h, 11, tex)); if (conn & 32) els.push(box(post ? 12 : 8, 0, 5, 16, h, 11, tex));
      return els;
    },
    gate: (d, s, inWall) => {
      const t = d.tex.side, open = s & 16, dy = inWall ? -3 : 0, els = [];
      els.push(box(0, 5 + dy, 7, 2, 16 + dy, 9, t)); els.push(box(14, 5 + dy, 7, 16, 16 + dy, 9, t));
      if (!open) { for (const [y0, y1] of [[6, 9], [12, 15]]) { els.push(box(2, y0 + dy, 7, 6, y1 + dy, 9, t)); els.push(box(10, y0 + dy, 7, 14, y1 + dy, 9, t)); } els.push(box(6, 6 + dy, 7, 8, 15 + dy, 9, t)); els.push(box(8, 6 + dy, 7, 10, 15 + dy, 9, t)); }
      else { for (const [y0, y1] of [[6, 9], [12, 15]]) { els.push(box(0, y0 + dy, 9, 2, y1 + dy, 13, t)); els.push(box(14, y0 + dy, 9, 16, y1 + dy, 13, t)); } els.push(box(0, 6 + dy, 13, 2, 15 + dy, 15, t)); els.push(box(14, 6 + dy, 13, 16, 15 + dy, 15, t)); }
      return rotY(els, turnsOf(s));
    },
    door: (d, s) => {
      const upper = s & 8, open = s & 16, hingeR = s & 32;
      const t = upper ? d.tex.up : d.tex.down;
      // closed: a 3-thick slab on the south side of the block (facing north means you walk north through it)
      let els = [box(0, 0, 13, 16, 16, 16, { north: t, south: t, west: t, east: t, up: t, down: t })];
      let k = turnsOf(s);
      if (open) k += hingeR ? 3 : 1;
      return rotY(els, k);
    },
    trapdoor: (d, s) => {
      const t = d.tex.side, open = s & 16, top = s & 8;
      if (!open) return [top ? box(0, 13, 0, 16, 16, 16, t) : box(0, 0, 0, 16, 3, 16, t)];
      return rotY([box(0, 0, 13, 16, 16, 16, t)], turnsOf(s));
    },
    torch: (d, s) => {
      const t = (s & 8) && d.name === 'redstone_torch' ? 'redstone_torch_off' : d.tex.side;
      return [box(7, 0, 7, 9, 10, 9, { up: t, down: t, side: t }, { uv: [[7, 13, 9, 15], [7, 6, 9, 8], [7, 6, 9, 16], [7, 6, 9, 16], [7, 6, 9, 16], [7, 6, 9, 16]], noCull: true })];
    },
    wall_torch: (d, s) => {
      const t = (s & 8) && d.name === 'redstone_wall_torch' ? 'redstone_torch_off' : d.tex.side;
      // leaning 22.5 degrees away from the wall it hangs on; facing = direction away from the wall
      const els = [box(-1, 3.5, 7, 1, 13.5, 9, { up: t, down: t, side: t }, { uv: [[7, 13, 9, 15], [7, 6, 9, 8], [7, 6, 9, 16], [7, 6, 9, 16], [7, 6, 9, 16], [7, 6, 9, 16]], noCull: true, r: { axis: 'z', angle: -22.5, origin: [0, 3.5, 8] } })];
      // built leaning east (away from a wall on the west): turn so it faces the stored direction
      const k = { 5: 0, 3: 1, 4: 2, 2: 3 }[s & 7] || 0;
      return rotYk(els, k);
    },
    ladder: (d, s) => rotY([box(0, 0, 15.2, 16, 16, 15.2, { north: d.tex.side, south: d.tex.side }, { noCull: true })], turnsOf(s)),
    vine: (d, s) => {
      const t = d.tex.side, els = [], o = 0.8;
      if (s & 1) els.push(box(0, 0, o, 16, 16, o, { north: t, south: t }, { tint: true, noCull: true }));
      if (s & 2) els.push(box(0, 0, 16 - o, 16, 16, 16 - o, { north: t, south: t }, { tint: true, noCull: true }));
      if (s & 4) els.push(box(o, 0, 0, o, 16, 16, { west: t, east: t }, { tint: true, noCull: true }));
      if (s & 8) els.push(box(16 - o, 0, 0, 16 - o, 16, 16, { west: t, east: t }, { tint: true, noCull: true }));
      if (s & 16 || !s) els.push(box(0, 16 - o, 0, 16, 16 - o, 16, { up: t, down: t }, { tint: true, noCull: true }));
      return els;
    },
    carpet: d => [box(0, 0, 0, 16, 1, 16, d.tex.side)],
    layer: (d, s) => [box(0, 0, 0, 16, ((s & 7) + 1) * 2, 16, d.tex.side)],
    path: d => [box(0, 0, 0, 16, 15, 16, { up: d.tex.up, down: d.tex.down, side: d.tex.side })],
    cactus: d => [box(0, 0, 0, 16, 16, 16, { up: d.tex.up, down: d.tex.down }), box(1, 0, 0, 15, 16, 16, { west: d.tex.side, east: d.tex.side }, { noCull: true }), box(0, 0, 1, 16, 16, 15, { north: d.tex.side, south: d.tex.side }, { noCull: true })],
    honey: d => [box(1, 1, 1, 15, 15, 15, { up: d.tex.up, down: d.tex.down, side: d.tex.side }), box(0, 0, 0, 16, 16, 16, { up: d.tex.up, down: d.tex.down, side: d.tex.side })],
    chest: (d, s) => {
      const t = d.tex.side, type = (s >> 3) & 3;
      let x0 = 1, x1 = 15;
      if (type === 1) x1 = 16; else if (type === 2) x0 = 0; // left / right half of a double chest (seen from the front)
      const els = [box(x0, 0, 1, x1, 10, 15, { up: t + '_top', down: t + '_top', north: t + '_front', south: t + '_side', west: t + '_side', east: t + '_side' }),
        box(x0, 10, 1, x1, 14, 15, { up: t + '_top', down: t + '_top', north: t + '_front_lid', south: t + '_side_lid', west: t + '_side_lid', east: t + '_side_lid' })];
      if (type === 0) els.push(box(7, 7, 0, 9, 11, 1, 'chest_latch'));
      else if (type === 1) els.push(box(15, 7, 0, 16, 11, 1, 'chest_latch')); else els.push(box(0, 7, 0, 1, 11, 1, 'chest_latch'));
      return rotY(els, turnsOf(s));
    },
    bed: (d, s) => {
      const head = s & 8, c = d.tex.side, els = [];
      els.push(box(0, 3, 0, 16, 9, 16, { up: head ? c.replace('_wool', '_bed_head') : c.replace('_wool', '_bed_foot'), side: c.replace('_wool', '_bed_side'), down: 'oak_planks' }));
      // legs
      if (head) { els.push(box(0, 0, 0, 3, 3, 3, 'bed_leg')); els.push(box(13, 0, 0, 16, 3, 3, 'bed_leg')); }
      else { els.push(box(0, 0, 13, 3, 3, 16, 'bed_leg')); els.push(box(13, 0, 13, 16, 3, 3 + 13, 'bed_leg')); }
      return rotY(els, turnsOf(s));
    },
    cake: (d, s) => { const bites = s & 7, x0 = 1 + bites * 2; return [box(x0, 0, 1, 15, 8, 15, { up: d.tex.up, down: d.tex.down, side: d.tex.side, west: bites ? d.tex.extra : d.tex.side })]; },
    cauldron: (d, s) => {
      const t = { up: d.tex.up, down: d.tex.down, side: d.tex.side }, inner = d.tex.extra, els = [];
      els.push(box(0, 3, 0, 2, 16, 16, t)); els.push(box(14, 3, 0, 16, 16, 16, t)); els.push(box(2, 3, 0, 14, 16, 2, t)); els.push(box(2, 3, 14, 14, 16, 16, t));
      els.push(box(2, 3, 2, 14, 4, 14, { up: inner, down: d.tex.down, side: inner }));
      for (const [x0, z0] of [[0, 0], [12, 0], [0, 12], [12, 12]]) els.push(box(x0, 0, z0, x0 + 4, 3, z0 + 4, t));
      const lvl = s & 3, kind = (s >> 2) & 3;
      if (lvl || kind === 1) { const h = kind === 1 ? 15 : 4 + lvl * 3 + (lvl === 3 ? 0 : 0); els.push(box(2, 4, 2, 14, kind === 1 ? 15 : [0, 9, 12, 15][lvl], 14, { up: kind === 1 ? 'lava_still' : kind === 2 ? 'powder_snow' : 'water_still' }, { tint: kind === 0, light: kind === 1 ? 15 : 0 })); }
      return els;
    },
    composter: (d, s) => {
      const t = { up: d.tex.up, down: d.tex.down, side: d.tex.side }, els = [box(0, 0, 0, 16, 2, 16, t), box(0, 2, 0, 2, 16, 16, t), box(14, 2, 0, 16, 16, 16, t), box(2, 2, 0, 14, 16, 2, t), box(2, 2, 14, 14, 16, 16, t)];
      const lvl = s & 15; if (lvl) els.push(box(2, 2, 2, 14, Math.min(15, 2 + lvl * 2), 14, { up: lvl >= 8 ? 'composter_ready' : 'composter_compost' }));
      return els;
    },
    hopper: (d, s) => {
      const o = d.tex.side, top = d.tex.up, inside = d.tex.extra, els = [];
      els.push(box(0, 10, 0, 16, 11, 16, { up: inside, down: o, side: o })); els.push(box(0, 11, 0, 2, 16, 16, { up: top, down: o, side: o })); els.push(box(14, 11, 0, 16, 16, 16, { up: top, down: o, side: o }));
      els.push(box(2, 11, 0, 14, 16, 2, { up: top, down: o, side: o })); els.push(box(2, 11, 14, 14, 16, 16, { up: top, down: o, side: o }));
      els.push(box(4, 4, 4, 12, 10, 12, o));
      const f = s & 7;
      if (f === 0) els.push(box(6, 0, 6, 10, 4, 10, o));
      else { const sp = [null, null, [6, 4, 0, 10, 8, 4], [6, 4, 12, 10, 8, 16], [0, 4, 6, 4, 8, 10], [12, 4, 6, 16, 8, 10]][f]; els.push(box(sp[0], sp[1], sp[2], sp[3], sp[4], sp[5], o)); }
      return els;
    },
    anvil: (d, s) => {
      const t = d.tex.side, top = d.tex.up;
      const els = [box(2, 0, 2, 14, 4, 14, t), box(4, 4, 3, 12, 5, 13, t), box(6, 5, 4, 10, 10, 12, t), box(3, 10, 0, 13, 16, 16, { up: top, down: t, side: t })];
      return rotY(els, turnsOf(s) + 1);
    },
    grindstone: (d, s) => {
      const els = [box(4, 4, 2, 12, 16, 14, { side: d.tex.side, up: d.tex.up, down: d.tex.up, west: d.tex.side, east: d.tex.side, north: d.tex.up, south: d.tex.up }),
        box(2, 0, 6, 4, 7, 10, 'dark_oak_log'), box(12, 0, 6, 14, 7, 10, 'dark_oak_log'), box(2, 7, 5, 4, 13, 11, d.tex.front), box(12, 7, 5, 14, 13, 11, d.tex.front)];
      return rotY(els, turnsOf(s));
    },
    ench: d => [box(0, 0, 0, 16, 12, 16, { up: d.tex.up, down: d.tex.down, side: d.tex.side })],
    brewing: d => {
      const els = [box(7, 0, 7, 9, 14, 9, 'brewing_stand', { uv: [[7, 7, 9, 9], [7, 7, 9, 9], [7, 2, 9, 16], [7, 2, 9, 16], [7, 2, 9, 16], [7, 2, 9, 16]] })];
      for (const [x0, z0, x1, z1] of [[9, 5, 15, 11], [2, 1, 8, 7], [2, 9, 8, 15]]) els.push(box(x0, 0, z0, x1, 2, z1, d.tex.side));
      els.push(box(0, 0, 8, 16, 16, 8, { north: 'brewing_stand', south: 'brewing_stand' }, { noCull: true, uv: [null, null, [0, 0, 16, 16], [0, 0, 16, 16], null, null] }));
      return els;
    },
    lantern: (d, s) => {
      const t = d.tex.side, hang = s & 8, y0 = hang ? 1 : 0;
      const els = [box(5, y0, 5, 11, y0 + 7, 11, t, { uv: [[0, 9, 6, 15], [0, 9, 6, 15], [0, 2, 6, 9], [0, 2, 6, 9], [0, 2, 6, 9], [0, 2, 6, 9]] }), box(6, y0 + 7, 6, 10, y0 + 9, 10, t, { uv: [[1, 10, 5, 14], [1, 10, 5, 14], [1, 0, 5, 2], [1, 0, 5, 2], [1, 0, 5, 2], [1, 0, 5, 2]] })];
      if (hang) els.push(box(8, 10, 6.5, 8, 16, 9.5, { west: t, east: t }, { noCull: true, uv: [null, null, null, null, [11, 1, 14, 7], [11, 1, 14, 7]] }));
      return els;
    },
    chain: (d, s) => { const t = d.tex.side; const els = [box(6.5, 0, 8, 9.5, 16, 8, { north: t, south: t }, { noCull: true, uv: [null, null, [0, 0, 3, 16], [0, 0, 3, 16], null, null] }), box(8, 0, 6.5, 8, 16, 9.5, { west: t, east: t }, { noCull: true, uv: [null, null, null, null, [3, 0, 6, 16], [3, 0, 6, 16]] })]; const ax = s & 3; return ax === 0 ? els : rotAxis(els, ax); },
    rod: (d, s) => { const t = d.tex.side; const els = [box(7, 0, 7, 9, 15, 9, t, { uv: [[2, 2, 4, 4], [2, 0, 4, 2], [0, 0, 2, 15], [0, 0, 2, 15], [0, 0, 2, 15], [0, 0, 2, 15]] }), box(6, 0, 6, 10, 1, 10, t, { uv: [[2, 2, 6, 6], [2, 2, 6, 6], [2, 6, 6, 7], [2, 6, 6, 7], [2, 6, 6, 7], [2, 6, 6, 7]] })]; return facing6(els, s & 7); },
    repeater: (d, s) => {
      const on = s & 32, delay = (s >> 3) & 3;
      const els = [box(0, 0, 0, 16, 2, 16, { up: on ? 'repeater_on' : 'repeater', down: 'smooth_stone', side: 'smooth_stone' })];
      const tt = on ? 'redstone_torch' : 'redstone_torch_off';
      els.push(box(7, 2, 2, 9, 7, 4, tt, { uv: [null, [7, 6, 9, 8], [7, 6, 9, 11], [7, 6, 9, 11], [7, 6, 9, 11], [7, 6, 9, 11]] }));
      if (s & 64) els.push(box(2, 2, 6 + delay * 2, 14, 4, 8 + delay * 2, 'bedrock'));
      else els.push(box(7, 2, 6 + delay * 2, 9, 7, 8 + delay * 2, tt, { uv: [null, [7, 6, 9, 8], [7, 6, 9, 11], [7, 6, 9, 11], [7, 6, 9, 11], [7, 6, 9, 11]] }));
      return rotY(els, turnsOf(s));
    },
    comparator: (d, s) => {
      const on = s & 16, sub = s & 8;
      const els = [box(0, 0, 0, 16, 2, 16, { up: on ? 'comparator_on' : 'comparator', down: 'smooth_stone', side: 'smooth_stone' })];
      const tt = on ? 'redstone_torch' : 'redstone_torch_off', ft = sub ? 'redstone_torch' : 'redstone_torch_off';
      for (const x of [4, 10]) els.push(box(x, 2, 11, x + 2, 7, 13, tt, { uv: [null, [7, 6, 9, 8], [7, 6, 9, 11], [7, 6, 9, 11], [7, 6, 9, 11], [7, 6, 9, 11]] }));
      els.push(box(7, 2, 2, 9, sub ? 5 : 4, 4, ft, { uv: [null, [7, 6, 9, 8], [7, 6, 9, 11], [7, 6, 9, 11], [7, 6, 9, 11], [7, 6, 9, 11]] }));
      return rotY(els, turnsOf(s));
    },
    daylight: (d, s) => [box(0, 0, 0, 16, 6, 16, { up: s & 16 ? 'daylight_detector_inverted_top' : d.tex.up, down: d.tex.side, side: d.tex.side })],
    lever: (d, s) => {
      const on = s & 32;
      const els = [box(5, 0, 4, 11, 3, 12, 'cobblestone'), box(7, 1, 7, 9, 11, 9, d.tex.up, { uv: [null, [7, 6, 9, 8], [7, 6, 9, 16], [7, 6, 9, 16], [7, 6, 9, 16], [7, 6, 9, 16]], r: { axis: 'x', angle: on ? -45 : 45, origin: [8, 1, 8] } })];
      return switchPlace(els, s);
    },
    button: (d, s) => switchPlace([box(5, 0, 6, 11, s & 32 ? 1 : 2, 10, d.tex.side)], s),
    plate: (d, s) => [box(1, 0, 1, 15, (s & 15) ? 0.5 : 1, 15, d.tex.side)],
    wire: (d, s, conn) => {
      const els = [], p = s & 15;
      const dot = 'redstone_dust_dot', line = 'redstone_dust_line0';
      // dust with no connections is a cross, or a dot after it was clicked (bit 4)
      const lone = !(conn & 60), cross = lone && !(s & 16);
      const n = !!(conn & 4) || cross, so = !!(conn & 8) || cross, w = !!(conn & 16) || cross, e = !!(conn & 32) || cross;
      const cnt = n + so + w + e;
      const flat = (x0, z0, x1, z1, tex, rot) => els.push(box(x0, 0.25, z0, x1, 0.25, z1, { up: tex, down: null }, { tint: true, noCull: true, rot: [0, rot || 0, 0, 0, 0, 0], uv: [null, [x0, z0, x1, z1], null, null, null, null] }));
      if (cnt === 0) { flat(0, 0, 16, 16, dot); }
      else {
        if ((n || so) && !(w || e)) { els.push(box(0, 0.25, 0, 16, 0.25, 16, { up: line }, { tint: true, noCull: true, rot: [0, 0, 0, 0, 0, 0] })); }
        else if ((w || e) && !(n || so)) { els.push(box(0, 0.25, 0, 16, 0.25, 16, { up: line }, { tint: true, noCull: true, rot: [0, 90, 0, 0, 0, 0] })); }
        else {
          flat(5, 5, 11, 11, dot);
          const l0 = 'redstone_dust_line0', l1 = 'redstone_dust_line1';
          if (n) flat(5, 0, 11, 5, l0); if (so) flat(5, 11, 11, 16, l0); if (w) flat(0, 5, 5, 11, l1); if (e) flat(11, 5, 16, 11, l1);
        }
      }
      // climbing up the side of a block
      for (let f = 2; f < 6; f++) if (conn & (1 << (f + 6))) {
        const r = { 2: [0, 0, 0.25, 16, 16, 0.25], 3: [0, 0, 15.75, 16, 16, 15.75], 4: [0.25, 0, 0, 0.25, 16, 16], 5: [15.75, 0, 0, 15.75, 16, 16] }[f];
        const fn = f === 2 ? 'south' : f === 3 ? 'north' : f === 4 ? 'east' : 'west';
        els.push(box(r[0], r[1], r[2], r[3], r[4], r[5], { [fn]: line }, { tint: true, noCull: true }));
      }
      els.power = p;
      return els;
    },
    rail: (d, s) => {
      const shape = s & 15, on = s & 16;
      const curved = shape >= 6 && d.name === 'rail';
      const tex = curved ? 'rail_corner' : d.name + (on && d.name !== 'rail' ? '_on' : '');
      if (shape >= 2 && shape <= 5) { // ascending: a ramp built rising toward the south, then turned
        const ramp = box(0, 1, 0, 16, 1, 22.627, { up: tex, down: tex }, { noCull: true, uv: [[0, 0, 16, 16], [0, 0, 16, 16], null, null, null, null], r: { axis: 'x', angle: -45, origin: [8, 1, 0] } });
        return rotY([ramp], { 5: 0, 3: 1, 4: 2, 2: 3 }[shape]);
      }
      const rot = shape === 1 ? 1 : shape === 7 ? 1 : shape === 8 ? 2 : shape === 9 ? 3 : 0;
      return rotY([box(0, 1, 0, 16, 1, 16, { up: tex, down: tex }, { noCull: true })], rot);
    },
    cross: (d, s) => {
      let t = d.tex.side;
      if (d.name === 'sweet_berry_bush') t = 'sweet_berry_bush_stage' + Math.min(3, s & 3);
      if ((d.name.endsWith('_sapling') && d.name !== 'bamboo_sapling') || d.name === 'mangrove_propagule') t = d.name;
      return crossEls(t, !!d.tint);
    },
    tall: (d, s) => { const up = s & 8; const t = d.name + (up ? '_top' : '_bottom'); const els = crossEls(t, !!d.tint); if (d.name === 'sunflower' && up) els.push(box(9.6, -1, 0, 9.6, 15, 16, { west: 'sunflower_front', east: 'sunflower_back' }, { noCull: true, r: { axis: 'z', angle: 22.5, origin: [8, 0, 8] } })); return els; },
    crop: (d, s) => {
      const age = s & 7;
      let t;
      switch (d.name) {
        case 'wheat': t = 'wheat_stage' + age; break;
        case 'carrots': t = 'carrots_stage' + [0, 0, 1, 1, 2, 2, 2, 3][age]; break;
        case 'potatoes': t = 'potatoes_stage' + [0, 0, 1, 1, 2, 2, 2, 3][age]; break;
        case 'beetroots': t = 'beetroots_stage' + Math.min(3, age); break;
        case 'nether_wart': t = 'nether_wart_stage' + [0, 1, 1, 2][Math.min(3, age)]; break;
        case 'torchflower_crop': t = 'torchflower_crop_stage' + Math.min(1, age); break;
        case 'pitcher_crop': t = (s & 8) ? 'pitcher_crop_top_stage_' + Math.max(3, Math.min(4, age)) : 'pitcher_crop_bottom_stage_' + Math.min(4, age); break;
        case 'pumpkin_stem': case 'melon_stem': { const h = (age + 1) * 2; return [box(0, -1, 8, 16, h - 1, 8, { north: 'stem', south: 'stem' }, { noCull: true, tint: true, uv: [null, null, [0, 16 - h, 16, 16], [0, 16 - h, 16, 16], null, null], r: { axis: 'y', angle: 45, origin: [8, 8, 8] } }), box(8, -1, 0, 8, h - 1, 16, { west: 'stem', east: 'stem' }, { noCull: true, tint: true, uv: [null, null, null, null, [0, 16 - h, 16, 16], [0, 16 - h, 16, 16]], r: { axis: 'y', angle: 45, origin: [8, 8, 8] } })]; }
      }
      const els = [];
      for (const p of [4, 12]) { els.push(box(0, -1, p, 16, 15, p, { north: t, south: t }, { noCull: true })); els.push(box(p, -1, 0, p, 15, 16, { west: t, east: t }, { noCull: true })); }
      return els;
    },
    stem_attached: (d, s) => rotY([box(0, -1, 8, 16, 9, 8, { north: 'attached_stem', south: 'attached_stem' }, { noCull: true, tint: true, uv: [null, null, [0, 6, 16, 16], [16, 6, 0, 16], null, null] })], turnsOf(s) + 3),
    cocoa: (d, s) => {
      const age = (s >> 3) & 3, w = 4 + age * 2, h = 5 + age * 2, t = 'cocoa_stage' + age, x0 = 8 - w / 2;
      const els = [box(x0, 12 - h, 15 - w, x0 + w, 12, 15, t, { uv: [[0, 0, w, w], [0, 0, w, w], [11 - w, 4, 11, 4 + h], [11 - w, 4, 11, 4 + h], [11 - w, 4, 11, 4 + h], [11 - w, 4, 11, 4 + h]] }), box(8, 12, 12, 8, 16, 16, { west: t, east: t }, { noCull: true, uv: [null, null, null, null, [12, 0, 16, 4], [12, 0, 16, 4]] })];
      // facing points at the log: built for a log to the south
      return rotY(els, { 3: 0, 4: 1, 2: 2, 5: 3 }[s & 7] || 0);
    },
    lily: d => [box(0, 0.25, 0, 16, 0.25, 16, { up: 'lily_pad', down: 'lily_pad' }, { tint: true, noCull: true })],
    pickle: (d, s) => {
      const n = (s & 3) + 1, t = 'sea_pickle', els = [];
      const P = [[6, 6], [3, 3], [9, 9], [3, 9]];
      for (let i = 0; i < n; i++) { const [x, z] = n === 1 ? [6, 6] : P[i]; els.push(box(x, 0, z, x + 4, 6, z + 4, t, { uv: [[8, 1, 12, 5], [4, 1, 8, 5], [0, 5, 4, 11], [0, 5, 4, 11], [0, 5, 4, 11], [0, 5, 4, 11]] })); }
      return els;
    },
    bamboo: (d, s) => {
      const t = 'bamboo_stalk', thick = 3, x = 6.5, els = [box(x, 0, x, x + thick, 16, x + thick, t, { uv: [[13, 0, 16, 3], [13, 0, 16, 3], [0, 0, 3, 16], [3, 0, 6, 16], [0, 0, 3, 16], [3, 0, 6, 16]] })];
      const leaves = (s >> 1) & 3;
      if (leaves) els.push(...crossEls(leaves === 2 ? 'bamboo_large_leaves' : 'bamboo_small_leaves', false));
      return els;
    },
    chorus: (d, s, conn) => {
      if (d.name === 'chorus_flower') return [box(2, 2, 2, 14, 14, 14, (s & 7) >= 5 ? 'chorus_flower_dead' : 'chorus_flower'), box(0, 2, 2, 16, 14, 14, (s & 7) >= 5 ? 'chorus_flower_dead' : 'chorus_flower', { noCull: true }), box(2, 2, 0, 14, 14, 16, (s & 7) >= 5 ? 'chorus_flower_dead' : 'chorus_flower'), box(2, 0, 2, 14, 16, 14, (s & 7) >= 5 ? 'chorus_flower_dead' : 'chorus_flower')];
      const t = 'chorus_plant', els = [box(4, 4, 4, 12, 12, 12, t)];
      if (conn & 1) els.push(box(4, 0, 4, 12, 4, 12, t)); if (conn & 2) els.push(box(4, 12, 4, 12, 16, 12, t));
      if (conn & 4) els.push(box(4, 4, 0, 12, 12, 4, t)); if (conn & 8) els.push(box(4, 4, 12, 12, 12, 16, t));
      if (conn & 16) els.push(box(0, 4, 4, 4, 12, 12, t)); if (conn & 32) els.push(box(12, 4, 4, 16, 12, 12, t));
      return els;
    },
    egg: () => { const t = 'dragon_egg', els = []; for (const [r, y0, y1] of [[3, 0, 1], [5, 1, 2], [6, 2, 3], [7, 3, 5], [6, 5, 8], [5, 8, 11], [4, 11, 13], [3, 13, 14], [2, 14, 15], [1, 15, 16]]) els.push(box(8 - r, y0, 8 - r, 8 + r, y1, 8 + r, t)); return els; },
    frame: (d, s) => { const els = [box(0, 0, 0, 16, 13, 16, { up: 'end_portal_frame_top', down: 'end_stone', side: 'end_portal_frame_side' })]; if (s & 8) els.push(box(4, 13, 4, 12, 16, 12, 'end_portal_frame_eye')); return els; },
    end_portal: d => [box(0, 12, 0, 16, 12, 16, { up: 'end_portal', down: 'end_portal' }, { noCull: true, light: 15 })],
    portal: (d, s) => s & 1 ? [box(6, 0, 0, 10, 16, 16, { west: 'nether_portal', east: 'nether_portal' }, { light: 11 })] : [box(0, 0, 6, 16, 16, 10, { north: 'nether_portal', south: 'nether_portal' }, { light: 11 })],
    fire: d => {
      const t = d.tex.side, els = [];
      for (const [x, axis] of [[8.8, 'z'], [7.2, 'z']]) els.push(box(0, 0, x, 16, 22.4, x, { north: t, south: t }, { noCull: true, light: 15, r: { axis: 'x', angle: x > 8 ? -22.5 : 22.5, origin: [8, 8, x] } }));
      for (const x of [8.8, 7.2]) els.push(box(x, 0, 0, x, 22.4, 16, { west: t, east: t }, { noCull: true, light: 15, r: { axis: 'z', angle: x > 8 ? 22.5 : -22.5, origin: [x, 8, 8] } }));
      return els;
    },
    campfire: (d, s) => {
      const lit = !(s & 8), log = d.tex.side, llit = lit ? d.tex.up : log, els = [];
      els.push(box(1, 0, 0, 5, 4, 16, { up: llit, down: log, side: log }));
      els.push(box(11, 0, 0, 15, 4, 16, { up: llit, down: log, side: log }));
      els.push(box(0, 3, 1, 16, 7, 5, { up: llit, down: log, side: log }));
      els.push(box(0, 3, 11, 16, 7, 15, { up: llit, down: log, side: log }));
      els.push(box(5, 0, 0, 11, 1, 16, 'campfire_log'));
      if (lit) els.push(...crossEls(d.tex.extra, false).map(e => Object.assign(e, { light: 15 })));
      return rotY(els, turnsOf(s));
    },
    pot: (d, s) => {
      const t = 'flower_pot', els = [box(5, 0, 5, 6, 6, 11, t), box(10, 0, 5, 11, 6, 11, t), box(6, 0, 5, 10, 6, 6, t), box(6, 0, 10, 10, 6, 11, t), box(6, 0, 6, 10, 4, 10, { up: 'dirt', down: t, side: t })];
      const plant = POT_PLANTS[s & 31];
      if (plant) { const pd = D[B[plant]]; if (pd.model === 'cactus') els.push(box(6, 4, 6, 10, 16, 10, { up: 'cactus_top', side: 'cactus_side' })); else els.push(...crossEls(plant === 'bamboo' ? 'bamboo_stalk' : pd.tex.side, !!pd.tint, 4)); }
      return els;
    },
    lectern: (d, s) => rotY([box(0, 0, 0, 16, 2, 16, { up: 'lectern_base', down: 'oak_planks', side: 'lectern_base' }), box(4, 2, 4, 12, 15, 12, { side: d.tex.side, north: d.tex.front, up: 'oak_planks', down: 'oak_planks' }),
      box(0, 12, 3, 16, 16, 16, { up: d.tex.up, down: 'oak_planks', side: d.tex.side }, { r: { axis: 'x', angle: -22.5, origin: [8, 12, 16] } })], turnsOf(s)),
    stonecutter: (d, s) => rotY([box(0, 0, 0, 16, 9, 16, { up: d.tex.up, down: d.tex.down, side: d.tex.side }), box(1, 9, 8, 15, 16, 8, { north: d.tex.front, south: d.tex.front }, { noCull: true, uv: [null, null, [1, 9, 15, 16], [1, 9, 15, 16], null, null] })], turnsOf(s)),
    bell: (d, s) => rotY([box(5, 6, 5, 11, 13, 11, 'bell_body'), box(4, 4, 4, 12, 6, 12, 'bell_body'), box(2, 13, 7, 14, 15, 9, 'dark_oak_planks'), box(0, 0, 6, 2, 16, 10, 'stone'), box(14, 0, 6, 16, 16, 10, 'stone')], turnsOf(s)),
    skull: (d, s) => [box(4, 0, 4, 12, 8, 12, d.tex.side)],
    // the game's sign: a 16 x 8 board, 4/3 thick, on a post (the 24 x 12 model drawn at 2/3 size)
    sign: (d, s) => { const t = d.tex.side; const els = [box(0, 9.333, 7.333, 16, 17.333, 8.667, t), box(7.333, 0, 7.333, 8.667, 9.333, 8.667, t.replace('_planks', '_log').replace('crimson_log', 'crimson_stem').replace('warped_log', 'warped_stem').replace('bamboo_log', 'bamboo_block'))]; return rotYdeg(els, (s & 15) * 22.5); },
    wall_sign: (d, s) => rotY([box(0, 4.333, 14.333, 16, 12.333, 15.667, d.tex.side)], turnsOf(s)),
    // banners: the pole and bar (the game's model at 2/3 size); the flag itself is drawn by Banners with its patterns
    wall_banner: (d, s) => rotY([box(1.333, 12.333, 14.333, 14.667, 13.667, 15.333, 'oak_planks')], turnsOf(s)),
    banner: (d, s) => { return rotYdeg([box(7.333, 0, 7.333, 8.667, 28, 8.667, 'oak_planks'), box(1.333, 28, 7.333, 14.667, 29.333, 8.667, 'oak_planks')], (s & 15) * 22.5); },
    glazed: (d, s) => { const k = turnsOf(s); const t = d.tex.side; return [box(0, 0, 0, 16, 16, 16, t, { rot: [k * 90, k * 90, 0, 0, 0, 0] })]; },
    piston: (d, s) => {
      const ext = s & 8, inner = d.tex.extra;
      const els = ext ? [box(0, 0, 4, 16, 16, 16, { north: inner, south: d.tex.down, side: d.tex.side, up: d.tex.side, down: d.tex.side }, { rot: [180, 0, 0, 0, 90, 270] })]
        : [box(0, 0, 0, 16, 16, 16, { north: d.tex.up, south: d.tex.down, side: d.tex.side, up: d.tex.side, down: d.tex.side }, { rot: [180, 0, 0, 0, 90, 270] })];
      return facing6(els, s & 7, true);
    },
    piston_head: (d, s) => {
      const face = s & 8 ? 'piston_top_sticky' : 'piston_top', short = s & 16;
      const els = [box(0, 0, 0, 16, 16, 4, { north: face, south: face, side: 'piston_side', up: 'piston_side', down: 'piston_side' }, { rot: [180, 0, 0, 0, 90, 270] }), box(6, 6, 4, 10, 10, short ? 16 : 20, 'piston_side', { rot: [180, 0, 0, 0, 90, 270] })];
      return facing6(els, s & 7, true);
    },
    end_rod: null,
    azalea: d => [box(0, 0, 0, 16, 16, 16, { up: d.tex.up, side: d.tex.side, down: null }, { noCull: true }), box(0, 0, 0.1, 16, 16, 0.1, { north: d.tex.side, south: d.tex.side }, { noCull: true }), ...crossEls('azalea_plant', false)],
    dripleaf: (d, s) => rotY([box(0, 15, 0, 16, 15, 16, { up: d.tex.up, down: d.tex.up }, { noCull: true }), ...crossEls('big_dripleaf_stem', false)], turnsOf(s)),
    scaffolding: (d, s, conn) => { const t = d.tex; const els = [box(0, 14, 0, 16, 16, 16, { up: t.up, down: t.bottom || t.down, side: t.side }, { noCull: true }), box(0, 0, 0, 2, 16, 2, t.side), box(14, 0, 0, 16, 16, 2, t.side), box(0, 0, 14, 2, 16, 16, t.side), box(14, 0, 14, 16, 16, 16, t.side)]; return els; },
    conduit: () => [box(5, 5, 5, 11, 11, 11, 'conduit')],
    beacon: () => [box(0, 0, 0, 16, 16, 16, 'glass', { noCull: false }), box(2, 0.1, 2, 14, 3, 14, 'obsidian'), box(3, 3, 3, 13, 14, 13, 'beacon')],
    carpet_cross: d => [box(0, 0.5, 0, 16, 0.5, 16, { up: d.tex.side, down: d.tex.side }, { noCull: true }), ...crossEls('pink_petals_stem', false, 6)],
    tripwire_hook: (d, s) => rotY([box(6.2, 3.8, 14, 9.8, 4.6, 16, 'oak_planks'), box(5, 1, 14, 11, 13, 16, 'tripwire_hook')], turnsOf(s)),
    tripwire: (d, s, conn) => { const els = []; if (conn & 12 || !conn) els.push(box(7.75, 1.5, 0, 8.25, 1.5, 16, { up: 'tripwire', down: 'tripwire' }, { noCull: true })); if (conn & 48) els.push(box(0, 1.5, 7.75, 16, 1.5, 8.25, { up: 'tripwire', down: 'tripwire' }, { noCull: true })); return els; },
    liquid: () => [],
  };
  MODEL.end_rod = MODEL.rod;
  // ---------------------------------------------------------------- blocks of 1.20 and 1.21
  const chainPair = (x, y0, y1, z) => {
    // the chain texture holds two link planes side by side (columns 0-2 and 3-5)
    const a = [0, 0, 3, y1 - y0], b = [3, 0, 6, y1 - y0];
    return [box(x - 1.5, y0, z, x + 1.5, y1, z, { north: 'chain', south: 'chain' }, { noCull: true, uv: [null, null, a, a, null, null], r: { axis: 'y', angle: 45, origin: [x, 8, z] } }),
      box(x - 1.5, y0, z, x + 1.5, y1, z, { north: 'chain', south: 'chain' }, { noCull: true, uv: [null, null, b, b, null, null], r: { axis: 'y', angle: -45, origin: [x, 8, z] } })];
  };
  // candles: positions [x, z, height] for 1-4 candles
  const CANDLES = [[[7, 7, 6]], [[5, 7, 6], [9, 6, 5]], [[7, 9, 6], [5, 6, 5], [9, 6, 3]], [[5, 5, 6], [9, 5, 5], [5, 9, 4], [9, 9, 3]]];
  function candleEls(t, list) {
    const els = [];
    for (const [x, z, h] of list) {
      const side = [0, 8, 2, 8 + h];
      els.push(box(x, 0, z, x + 2, h, z + 2, t, { uv: [[0, 6, 2, 8], [0, 6, 2, 8], side, side, side, side] }));
      els.push(box(x + 0.5, h, z + 1, x + 1.5, h + 1, z + 1, { north: t, south: t }, { noCull: true, uv: [null, null, [0, 5, 1, 6], [0, 5, 1, 6], null, null] }));
      els.push(box(x + 1, h, z + 0.5, x + 1, h + 1, z + 1.5, { west: t, east: t }, { noCull: true, uv: [null, null, null, null, [0, 5, 1, 6], [0, 5, 1, 6]] }));
    }
    return els;
  }
  Object.assign(MODEL, {
    // hanging signs: bits 0-3 rotation (sixteenths), bit 4 attached to the block above by one chain
    hanging_sign: (d, s) => {
      const t = d.tex.side, els = [box(1, 0, 7, 15, 10, 9, t)];
      if (s & 16) els.push(...chainPair(8, 10, 16, 8)); else els.push(...chainPair(3, 10, 16, 8), ...chainPair(13, 10, 16, 8));
      return rotYdeg(els, (s & 15) * 22.5);
    },
    wall_hanging_sign: (d, s) => rotY([box(0, 14, 6, 16, 16, 10, t2(d)), box(1, 0, 7, 15, 10, 9, d.tex.side), ...chainPair(3, 10, 14, 8), ...chainPair(13, 10, 14, 8)], turnsOf(s)),
    candle: (d, s) => candleEls((s & 4) ? d.tex.side + '_lit' : d.tex.side, CANDLES[s & 3]),
    candle_cake: (d, s) => [box(1, 0, 1, 15, 8, 15, { up: 'cake_top', down: 'cake_bottom', side: 'cake_side' }), ...candleEls((s & 4) ? d.tex.extra + '_lit' : d.tex.extra, [[7, 7, 6]]).map(e => Object.assign({}, e, { a: [e.a[0], e.a[1] + 8, e.a[2]], b: [e.b[0], e.b[1] + 8, e.b[2]] }))],
    // coral fans on a wall: two planes leaning out from the wall behind (built for a wall to the south)
    wall_fan: (d, s) => {
      const t = d.tex.side, o = { noCull: true, uv: [[0, 0, 16, 16], [0, 0, 16, 16], null, null, null, null] };
      return rotY([box(0, 8, 5, 16, 8, 16, { up: t, down: t }, Object.assign({ r: { axis: 'x', angle: 22.5, origin: [8, 8, 16] } }, o)),
        box(0, 8, 5, 16, 8, 16, { up: t, down: t }, Object.assign({ r: { axis: 'x', angle: -22.5, origin: [8, 8, 16] } }, o))], turnsOf(s));
    },
    // turtle eggs: bits 0-1 eggs-1, bits 2-3 cracks
    turtle_egg: (d, s) => {
      const t = ['turtle_egg', 'turtle_egg_slightly_cracked', 'turtle_egg_very_cracked'][Math.min(2, (s >> 2) & 3)];
      const P = [[5, 4, 4, 7], [1, 8, 3, 5], [10, 10, 3, 5], [9, 3, 2, 4]], els = [];
      for (let i = 0; i <= (s & 3); i++) { const [x, z, w, h] = P[i]; const uvS = [0, 0, w, h], uvT = [0, 0, w, w]; els.push(box(x, 0, z, x + w, h, z + w, t, { uv: [uvT, uvT, uvS, uvS, uvS, uvS] })); }
      return els;
    },
    sniffer_egg: (d, s) => {
      const st = ['not_cracked', 'slightly_cracked', 'very_cracked'][Math.min(2, s & 3)], p = 'sniffer_egg_' + st + '_';
      return [box(1, 0, 2, 15, 16, 14, { up: p + 'top', down: p + 'bottom', north: p + 'north', south: p + 'south', west: p + 'west', east: p + 'east' })];
    },
    shrieker: d => [box(0, 0, 0, 16, 8, 16, { up: d.tex.up, down: d.tex.down, side: d.tex.side }, { uv: [null, null, [0, 8, 16, 16], [0, 8, 16, 16], [0, 8, 16, 16], [0, 8, 16, 16]] }),
      box(1, 8, 1, 15, 15, 15, { up: 'sculk_shrieker_inner_top', side: 'sculk_shrieker_can' }, { uv: [null, [1, 1, 15, 15], [1, 1, 15, 8], [1, 1, 15, 8], [1, 1, 15, 8], [1, 1, 15, 8]] })],
    // sculk sensors: a half block with four tendrils (bits 0-1 phase: 0 inactive, 1 active, 2 cooldown)
    sensor: (d, s) => {
      const tend = (s & 3) === 1 ? 'sculk_sensor_tendril_active' : 'sculk_sensor_tendril_inactive';
      const els = [box(0, 0, 0, 16, 8, 16, { up: d.tex.up, down: d.tex.down, side: d.tex.side }, { uv: [null, null, [0, 8, 16, 16], [0, 8, 16, 16], [0, 8, 16, 16], [0, 8, 16, 16]] })];
      const a = { noCull: true, uv: [null, null, [0, 0, 16, 8], [0, 0, 16, 8], [0, 0, 16, 8], [0, 0, 16, 8]], r: { axis: 'y', angle: 45, origin: [8, 8, 8] } };
      els.push(box(0, 8, 8, 16, 16, 8, { north: tend, south: tend }, a), box(8, 8, 0, 8, 16, 16, { west: tend, east: tend }, a));
      if (d.name === 'calibrated_sculk_sensor') {
        const am = 'calibrated_sculk_sensor_amethyst', b = { noCull: true, uv: [null, null, [4, 2, 12, 16], [4, 2, 12, 16], [4, 2, 12, 16], [4, 2, 12, 16]] };
        els.push(...rotY([box(4, 8, 8, 12, 16, 8, { north: am, south: am }, b), box(8, 8, 4, 8, 16, 12, { west: am, east: am }, b)], turnsOf(s >> 2)));
      }
      return els;
    },
    decorated_pot: (d, s) => rotY([box(1, 0, 1, 15, 16, 15, { up: 'decorated_pot_base', down: 'decorated_pot_base', side: d.tex.side }),
      box(5, 16, 5, 11, 17, 11, d.tex.side, { uv: [[5, 5, 11, 11], [5, 5, 11, 11], [5, 2, 11, 3], [5, 2, 11, 3], [5, 2, 11, 3], [5, 2, 11, 3]] }),
      box(4, 17, 4, 12, 20, 12, d.tex.side, { uv: [[4, 4, 12, 12], [4, 4, 12, 12], [4, 0, 12, 3], [4, 0, 12, 3], [4, 0, 12, 3], [4, 0, 12, 3]] })], turnsOf(s)),
    heavy_core: d => [box(4, 0, 4, 12, 8, 12, { up: d.tex.up, down: d.tex.down, side: d.tex.side }, { uv: [[4, 4, 12, 12], [4, 4, 12, 12], [4, 4, 12, 12], [4, 4, 12, 12], [4, 4, 12, 12], [4, 4, 12, 12]] })],
  });
  function t2(d) { return d.tex.side; }
  const POT_PLANTS = [null, 'poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose',
    'oak_sapling', 'spruce_sapling', 'birch_sapling', 'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling', 'cherry_sapling', 'mangrove_propagule', 'red_mushroom', 'brown_mushroom', 'fern', 'dead_bush', 'cactus', 'bamboo', 'crimson_fungus', 'warped_fungus', 'crimson_roots', 'warped_roots'];
  function crossEls(t, tint, size) {
    const s = size || 16, o = (16 - s) / 2;
    const a = { noCull: true, tint, r: { axis: 'y', angle: 45, origin: [8, 8, 8] } };
    return [box(o, 0, 8, 16 - o, s, 8, { north: t, south: t }, a), box(8, 0, o, 8, s, 16 - o, { west: t, east: t }, a)];
  }
  function rotYk(els, k) { return rotY(els, k); }
  // a cube whose "front" texture looks along direction f (0..5), with a back texture opposite (observers, barrels)
  function facingCube(t, f, sixWay) {
    if (f === 1) return [box(0, 0, 0, 16, 16, 16, { up: t.front, down: t.back, side: t.side }, { rot: [0, 0, 0, 0, 0, 0] })];
    if (f === 0) return [box(0, 0, 0, 16, 16, 16, { up: t.back, down: t.front, side: t.side }, { rot: [0, 0, 180, 180, 180, 180] })];
    return rotY([box(0, 0, 0, 16, 16, 16, { north: t.front, south: t.back, up: t.top, down: t.top, west: t.side, east: t.side })], TURNS[f]);
  }
  function rotYdeg(els, deg) { return els.map(e => Object.assign({}, e, { r: { axis: 'y', angle: -deg, origin: [8, 8, 8] } })); }
  // chains and other axis blocks: 0 y, 1 x, 2 z
  function rotAxis(els, ax) { return els.map(e => Object.assign({}, e, { r: ax === 1 ? { axis: 'z', angle: 90, origin: [8, 8, 8] } : { axis: 'x', angle: 90, origin: [8, 8, 8] } })); }
  // up-pointing model -> facing direction (0 down .. 5 east)
  function facing6(els, f, northModel) {
    if (northModel) { // built facing north
      if (f >= 2) return rotY(els, TURNS[f]);
      return els.map(e => Object.assign({}, e, { r: { axis: 'x', angle: f === 1 ? 90 : -90, origin: [8, 8, 8] } }));
    }
    if (f === 1) return els;
    if (f === 0) return els.map(e => Object.assign({}, e, { r: { axis: 'x', angle: 180, origin: [8, 8, 8] } }));
    const k = TURNS[f];
    return rotY(els.map(e => Object.assign({}, e, { r: { axis: 'x', angle: -90, origin: [8, 8, 8] } })), k);
  }
  // levers and buttons: bits 3-4 face (0 floor, 1 wall, 2 ceiling), bits 0-2 facing
  function switchPlace(els, s) {
    const face = (s >> 3) & 3, k = turnsOf(s);
    if (face === 0) return rotY(els, k);
    if (face === 2) return rotY(flipY(els), k);
    // on a wall: stand the floor model up against the wall behind it (facing = away from the wall)
    return rotY(els.map(e => { const [x0, y0, z0] = e.a, [x1, y1, z1] = e.b; return Object.assign({}, e, { a: [x0, z0, 16 - y1], b: [x1, z1, 16 - y0], r: e.r ? { axis: 'x', angle: e.r.angle, origin: [e.r.origin[0], e.r.origin[2], 16 - e.r.origin[1]] } : null }); }), k + 2);
  }

  // ---------------------------------------------------------------- collision and selection shapes (in blocks)
  const FULL = [[0, 0, 0, 1, 1, 1]];
  const shapeCache = new Map();
  function shape(id, state, x, y, z, forCollision) {
    const d = D[id];
    if (d.model === 'cube' || d.model === 'glazed') return d.solid || !forCollision ? FULL : null;
    if (forCollision && !d.solid) return null;
    switch (d.model) {
      case 'none': case 'liquid': return null;
      case 'fence': case 'pane': case 'wall': case 'chorus': {
        const c = CONNECT[d.model](d, state, Models.ctx, x, y, z);
        const k = d.model + c + (forCollision ? 'c' : 's');
        let s = shapeCache.get(k);
        if (!s) {
          const t = d.model === 'pane' ? 1 / 16 : d.model === 'wall' ? (c & 64 ? 4 / 16 : 3 / 16) : 2 / 16, h = forCollision && d.model !== 'pane' && d.model !== 'chorus' ? 1.5 : (d.model === 'wall' ? 1 : 1);
          const lo = 0.5 - t, hi = 0.5 + t;
          if (d.model === 'chorus') { s = [[0.25, 0.25, 0.25, 0.75, 0.75, 0.75]]; if (c & 1) s.push([0.25, 0, 0.25, 0.75, 0.25, 0.75]); if (c & 2) s.push([0.25, 0.75, 0.25, 0.75, 1, 0.75]); if (c & 4) s.push([0.25, 0.25, 0, 0.75, 0.75, 0.25]); if (c & 8) s.push([0.25, 0.25, 0.75, 0.75, 0.75, 1]); if (c & 16) s.push([0, 0.25, 0.25, 0.25, 0.75, 0.75]); if (c & 32) s.push([0.75, 0.25, 0.25, 1, 0.75, 0.75]); }
          else { s = [[lo, 0, lo, hi, h, hi]]; if (c & 4) s.push([lo, 0, 0, hi, h, lo]); if (c & 8) s.push([lo, 0, hi, hi, h, 1]); if (c & 16) s.push([0, 0, lo, lo, h, hi]); if (c & 32) s.push([hi, 0, lo, 1, h, hi]); }
          shapeCache.set(k, s);
        }
        return s;
      }
    }
    const k = id * 256 + state + (forCollision ? 0.5 : 0);
    let s = shapeCache.get(k);
    if (s) return s;
    s = shapeOf(d, state, forCollision);
    shapeCache.set(k, s);
    return s;
  }
  function shapeOf(d, st, col) {
    const f = st & 7, k = turnsOf(st);
    const rot = (bx) => { let [x0, y0, z0, x1, y1, z1] = bx; for (let i = 0; i < k; i++) { const a = 1 - z1, b = 1 - z0; z0 = x0; z1 = x1; x0 = a; x1 = b; } return [x0, y0, z0, x1, y1, z1]; };
    switch (d.model) {
      case 'slab': { const t = (st >> 3) & 3; return t === 2 ? FULL : t === 1 ? [[0, 0.5, 0, 1, 1, 1]] : [[0, 0, 0, 1, 0.5, 1]]; }
      case 'stairs': { const els = MODEL.stairs(d, st, 0); return els.map(e => [e.a[0] / 16, e.a[1] / 16, e.a[2] / 16, e.b[0] / 16, e.b[1] / 16, e.b[2] / 16]); }
      case 'path': return [[0, 0, 0, 1, 15 / 16, 1]];
      case 'carpet': case 'carpet_cross': return col ? [[0, 0, 0, 1, 1 / 16, 1]] : [[0, 0, 0, 1, 1 / 16, 1]];
      case 'layer': { const l = (st & 7); return col ? (l === 0 ? null : [[0, 0, 0, 1, l * 2 / 16, 1]]) : [[0, 0, 0, 1, (l + 1) * 2 / 16, 1]]; }
      case 'cactus': return col ? [[1 / 16, 0, 1 / 16, 15 / 16, 15 / 16, 15 / 16]] : FULL;
      case 'chest': return [[1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16]];
      case 'bed': return [[0, 0, 0, 1, 9 / 16, 1]];
      case 'cake': return [[(1 + (st & 7) * 2) / 16, 0, 1 / 16, 15 / 16, 0.5, 15 / 16]];
      case 'ench': return [[0, 0, 0, 1, 0.75, 1]];
      case 'daylight': return [[0, 0, 0, 1, 6 / 16, 1]];
      case 'repeater': case 'comparator': return [[0, 0, 0, 1, 2 / 16, 1]];
      case 'lily': return [[1 / 16, 0, 1 / 16, 15 / 16, 1.5 / 16, 15 / 16]];
      case 'door': { const open = st & 16, hr = st & 32; let kk = k; if (open) kk += hr ? 3 : 1; let b = [0, 0, 13 / 16, 1, 1, 1]; for (let i = 0; i < ((kk % 4) + 4) % 4; i++) { const [x0, y0, z0, x1, y1, z1] = b; b = [1 - z1, y0, x0, 1 - z0, y1, x1]; } return [b]; }
      case 'trapdoor': { if (!(st & 16)) return st & 8 ? [[0, 13 / 16, 0, 1, 1, 1]] : [[0, 0, 0, 1, 3 / 16, 1]]; return [rot([0, 0, 13 / 16, 1, 1, 1])]; }
      case 'gate': { if (col && (st & 16)) return null; const ns = f === 2 || f === 3; const h = col ? 1.5 : 1; return ns ? [[0, 0, 6 / 16, 1, h, 10 / 16]] : [[6 / 16, 0, 0, 10 / 16, h, 1]]; }
      case 'ladder': return [rot([0, 0, 13 / 16, 1, 1, 1])];
      case 'anvil': { const ns = ((k + 1) % 2) === 0; return ns ? [[0, 0, 2 / 16, 1, 1, 14 / 16]] : [[2 / 16, 0, 0, 14 / 16, 1, 1]]; }
      case 'cauldron': case 'composter': case 'hopper': return col ? [[0, 0, 0, 1, 1, 1]] : FULL;
      case 'lantern': return st & 8 ? [[5 / 16, 1 / 16, 5 / 16, 11 / 16, 10 / 16, 11 / 16]] : [[5 / 16, 0, 5 / 16, 11 / 16, 9 / 16, 11 / 16]];
      case 'chain': { const a = st & 3; return a === 0 ? [[6.5 / 16, 0, 6.5 / 16, 9.5 / 16, 1, 9.5 / 16]] : a === 1 ? [[0, 6.5 / 16, 6.5 / 16, 1, 9.5 / 16, 9.5 / 16]] : [[6.5 / 16, 6.5 / 16, 0, 9.5 / 16, 9.5 / 16, 1]]; }
      case 'rod': { const ff = st & 7; return ff < 2 ? [[6 / 16, 0, 6 / 16, 10 / 16, 1, 10 / 16]] : ff < 4 ? [[6 / 16, 6 / 16, 0, 10 / 16, 10 / 16, 1]] : [[0, 6 / 16, 6 / 16, 1, 10 / 16, 10 / 16]]; }
      case 'egg': return [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
      case 'frame': return [[0, 0, 0, 1, 13 / 16, 1]];
      case 'campfire': return [[0, 0, 0, 1, 7 / 16, 1]];
      case 'pot': return [[5 / 16, 0, 5 / 16, 11 / 16, 6 / 16, 11 / 16]];
      case 'lectern': return [[0, 0, 0, 1, 14 / 16, 1]];
      case 'stonecutter': return [[0, 0, 0, 1, 9 / 16, 1]];
      case 'skull': return [[4 / 16, 0, 4 / 16, 12 / 16, 0.5, 12 / 16]];
      case 'pickle': return [[2 / 16, 0, 2 / 16, 14 / 16, 6 / 16, 14 / 16]];
      case 'bamboo': return [[6.5 / 16, 0, 6.5 / 16, 9.5 / 16, 1, 9.5 / 16]];
      case 'cocoa': return [[4 / 16, 3 / 16, 4 / 16, 12 / 16, 12 / 16, 12 / 16]];
      case 'grindstone': case 'bell': return [[2 / 16, 0, 2 / 16, 14 / 16, 1, 14 / 16]];
      case 'piston': { if (!(st & 8)) return FULL; const ff = st & 7; const b = [[0, 0, 0, 1, 12 / 16, 1], [0, 4 / 16, 0, 1, 1, 1], [0, 0, 4 / 16, 1, 1, 1], [0, 0, 0, 1, 1, 12 / 16], [4 / 16, 0, 0, 1, 1, 1], [0, 0, 0, 12 / 16, 1, 1]][ff]; return [b]; }
      case 'piston_head': { const ff = st & 7; return [[[0, 0, 0, 1, 4 / 16, 1], [0, 12 / 16, 0, 1, 1, 1], [0, 0, 0, 1, 1, 4 / 16], [0, 0, 12 / 16, 1, 1, 1], [0, 0, 0, 4 / 16, 1, 1], [12 / 16, 0, 0, 1, 1, 1]][ff]]; }
      case 'scaffolding': return col ? [[0, 14 / 16, 0, 1, 1, 1]] : FULL;
      case 'honey': return col ? [[1 / 16, 0, 1 / 16, 15 / 16, 15 / 16, 15 / 16]] : FULL;
      case 'azalea': return FULL;
      case 'dripleaf': return [[0, 11 / 16, 0, 1, 15 / 16, 1]];
      case 'sign': return col ? null : [[0.25, 0, 0.25, 0.75, 1, 0.75]];
      case 'wall_sign': return col ? null : [rot([0, 4.5 / 16, 14 / 16, 1, 12.5 / 16, 1])];
      case 'beacon': case 'conduit': return FULL;
      case 'candle': { const L = CANDLES[st & 3]; let x0 = 1, z0 = 1, x1 = 0, z1 = 0, h = 0; for (const [x, z, hh] of L) { x0 = Math.min(x0, x / 16); z0 = Math.min(z0, z / 16); x1 = Math.max(x1, (x + 2) / 16); z1 = Math.max(z1, (z + 2) / 16); h = Math.max(h, hh / 16); } return [[x0, 0, z0, x1, h, z1]]; }
      case 'candle_cake': return [[1 / 16, 0, 1 / 16, 15 / 16, 0.5, 15 / 16], [7 / 16, 0.5, 7 / 16, 9 / 16, 14 / 16, 9 / 16]];
      case 'turtle_egg': return (st & 3) ? [[1 / 16, 0, 1 / 16, 15 / 16, 7 / 16, 15 / 16]] : [[3 / 16, 0, 3 / 16, 12 / 16, 7 / 16, 12 / 16]];
      case 'sniffer_egg': return [[1 / 16, 0, 2 / 16, 15 / 16, 1, 14 / 16]];
      case 'shrieker': case 'sensor': return [[0, 0, 0, 1, 0.5, 1]];
      case 'decorated_pot': return [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
      case 'heavy_core': return [[4 / 16, 0, 4 / 16, 12 / 16, 0.5, 12 / 16]];
      case 'hanging_sign': return col ? null : [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
      case 'wall_hanging_sign': return col ? null : [rot([0, 14 / 16, 6 / 16, 1, 1, 10 / 16]), rot([1 / 16, 0, 7 / 16, 15 / 16, 10 / 16, 9 / 16])];
    }
    if (col) return d.solid ? FULL : null;
    // thin selection boxes for non-solid things
    switch (d.model) {
      case 'cross': case 'tall': return [[2 / 16, 0, 2 / 16, 14 / 16, 13 / 16, 14 / 16]];
      case 'crop': return [[0, 0, 0, 1, Math.max(2, ((st & 7) + 1) * 2) / 16, 1]];
      case 'torch': return [[6 / 16, 0, 6 / 16, 10 / 16, 10 / 16, 10 / 16]];
      case 'wall_torch': { const b = { 5: [0, 3 / 16, 5.5 / 16, 5 / 16, 13 / 16, 10.5 / 16], 4: [11 / 16, 3 / 16, 5.5 / 16, 1, 13 / 16, 10.5 / 16], 3: [5.5 / 16, 3 / 16, 0, 10.5 / 16, 13 / 16, 5 / 16], 2: [5.5 / 16, 3 / 16, 11 / 16, 10.5 / 16, 13 / 16, 1] }[f]; return [b || [0.4, 0, 0.4, 0.6, 0.6, 0.6]]; }
      case 'wire': case 'rail': case 'tripwire': return [[0, 0, 0, 1, 1 / 16, 1]];
      case 'plate': return [[1 / 16, 0, 1 / 16, 15 / 16, 1 / 16, 15 / 16]];
      case 'lever': case 'button': { const els = d.model === 'lever' ? MODEL.lever(d, st & ~32) : MODEL.button(d, st); const e = els[0]; return [[e.a[0] / 16, e.a[1] / 16, e.a[2] / 16, e.b[0] / 16, e.b[1] / 16, e.b[2] / 16]]; }
      case 'vine': return [[0, 0, 0, 1, 1, 1]];
      case 'fire': return [[0, 0, 0, 1, 1 / 16, 1]];
      case 'portal': return st & 1 ? [[6 / 16, 0, 0, 10 / 16, 1, 1]] : [[0, 0, 6 / 16, 1, 1, 10 / 16]];
      case 'end_portal': return [[0, 0, 0, 1, 12 / 16, 1]];
      case 'banner': return [[0.25, 0, 0.25, 0.75, 1, 0.75]];
      case 'wall_banner': return col ? null : [rot([0, 0, 14 / 16, 1, 12.5 / 16, 1])];
      case 'tripwire_hook': return [rot([5 / 16, 0, 10 / 16, 11 / 16, 10 / 16, 1])];
      case 'wall_fan': return [rot([0, 4 / 16, 5 / 16, 1, 12 / 16, 1])];
    }
    return FULL;
  }
  // neighbour reader used by connection rules (set by the mesher or the world)
  const ctx = (x, y, z) => World.getBlock(x, y, z);
  ctx.state = (x, y, z) => World.getState(x, y, z);
  return { get, shape, box, crossEls, ctx, POT_PLANTS, CONNECT, MODEL, rotY };
})();
