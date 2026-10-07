'use strict';
// ---- the player's body, shared by the inventory portrait and the third-person view
const hexOf = c => parseInt(String(c).slice(1), 16);
function armorPlate(id) { const d = itemDef(id), c = hexOf(d.c[0]); return SK(c, { n: 0.06, rim: { c: (c >> 1) & 0x7f7f7f, px: 1 }, top: 1.12 }); }
function buildPlayerModel(m, armor, key) {
  const [helm, chest, legs, boots] = armor;
  const skin = SK(0xd9a37c, { n: 0.04 }), shirt = SK(0x3f5f9a, { n: 0.06, stripe: { c: 0x34507e, axis: 'y', p: 0.25, w: 0.12 } }), pants = SK(0x2c3a5a, { n: 0.06, foot: { c: 0x3a2a1e, px: 2 } });
  return buildCreature('player:' + armor.join(','), m, (a, mm) => biped(a, mm, {
    legH: 0.75, legW: 0.25, hipX: 0.125, torso: [0.5, 0.75, 0.25], arm: [0.25, 0.75],
    sk: { leg: pants, torso: shirt, arm: Object.assign({}, shirt, { zones: [[0xd9a37c, (x, y) => y < 1.15]] }) },
    head(a, h, P) {
      const hs = Object.assign({}, skin, { zones: [[0x4a2e1a, (x, y, z) => y > 1.93 || (z < -0.1 && y > 1.62)]] });
      a.box(h, 0.5, 0.5, 0.5, 0, 0.25, 0, hs, { eyes: [EYE(1, 4, 2, 1, 0xffffff, { p: 0x3a5a9a })], ov: [['F', 3, 6, 2, 1, 0x9a5a48]] });
      if (helm) { const ps = armorPlate(helm); a.box(h, 0.58, 0.22, 0.58, 0, 0.46, 0, ps); a.box(h, 0.58, 0.3, 0.06, 0, 0.27, -0.27, ps); for (const sx of [-1, 1]) a.box(h, 0.06, 0.28, 0.58, sx * 0.27, 0.28, 0, ps); }
    },
    extra(a, P) {
      if (chest) { const ps = armorPlate(chest); a.box(P.body, 0.58, 0.8, 0.33, 0, 0.38, 0, ps); for (const ar of P.arms) a.box(ar.u, 0.31, 0.32, 0.31, 0, -0.06, 0, ps); }
      if (legs) { const ps = armorPlate(legs); a.box(P.body, 0.56, 0.14, 0.31, 0, 0.06, 0, ps); for (const L of P.legs) a.box(L.u, 0.29, 0.48, 0.29, 0, -0.25, 0, ps); }
      if (boots) { const ps = armorPlate(boots); for (const L of P.legs) a.box(L.u, 0.3, 0.24, 0.32, 0, -0.64, 0.01, ps); }
    },
  }));
}
// ---- third-person view (F5 or V): behind you, then facing you, then back to first person
const ThirdPerson = (() => {
  let root = null, key = '', heldMesh = null, heldId = -1, phase = 0;
  const m = {};
  function sync(P) {
    const k = Inv.armor.map(s => s ? s.id : 0).join(',');
    if (k !== key || !root) { if (root) { scene.remove(root); for (const mt of m.mats || []) mt.dispose(); } key = k; root = buildPlayerModel(m, Inv.armor.map(s => s ? s.id : 0)); root.traverse(o => o.layers.enable(1)); scene.add(root); heldId = -1; }
    const s = heldItem(), id = s ? s.id : 0;
    if (id !== heldId) { if (heldMesh) m.P.arms[1].u.remove(heldMesh); heldMesh = id ? itemMesh(id) : null; if (heldMesh) { heldMesh.scale.setScalar(0.42); heldMesh.position.set(0, -0.62, 0.16); heldMesh.rotation.set(-1.0, Math.PI / 2, 0); m.P.arms[1].u.add(heldMesh); } heldId = id; }
  }
  function update(dt, P, swing) {
    const on = Game.view > 0 && Game.state === 'play' && P.alive;
    if (!on) { if (root) root.visible = false; return; }
    sync(P); root.visible = !Game.tpClose;
    const sp = Math.hypot(P.vx, P.vz); phase += dt * sp * 2.6;
    const w = Math.min(1, sp / 4), s = Math.sin(phase);
    root.position.set(P.x, P.y - (P.sneak ? 0.15 : 0), P.z); root.rotation.y = P.yaw + Math.PI;
    const R = m.P;
    for (const L of R.legs) rot(L.u, (L.sx > 0 ? s : -s) * 0.75 * w, 0, 0);
    for (const a of R.arms) rot(a.u, (a.sx > 0 ? -s : s) * 0.6 * w + (a.sx > 0 && swing < 0.35 ? -1.8 + swing * 5 : 0), 0, a.sx * 0.05);
    rot(R.body, P.sneak ? 0.35 : 0, 0, 0);
    rot(R.head, -P.pitch * 0.9, 0, 0);
    const lv = lightAt(P.x, P.y + 1.2, P.z); for (const mt of m.mats) if (mt.userData.entity) mt.uniforms.uEnv.value.set(lv[0] / 15, lv[1] / 15); else if (!mt.userData.emissive) { const v = Math.max(lv[0] / 15 * U.uDay.value, lv[1] / 15) * 0.85 + 0.15; mt.color.setScalar(v); }
  }
  return { update };
})();
/* Character preview in the inventory: your character in their armor and with the held item,
   turning its head and body to follow the mouse (like the real game's inventory portrait). */
const CharView = (() => {
  let rend = null, scene, cam, root = null, key = '', mx = 0, my = 0, t = 0;
  const m = {};
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  function init() {
    const cv = $('charCanvas');
    rend = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    rend.setPixelRatio(1);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a2c22, 0.95));
    const d = new THREE.DirectionalLight(0xffffff, 0.75); d.position.set(0.6, 1.2, 1.4); scene.add(d);
    cam = new THREE.PerspectiveCamera(28, cv.width / cv.height, 0.1, 50);
    cam.position.set(0, 1.0, 5.4); cam.lookAt(0, 0.98, 0);
  }
  function build() {
    if (root) { scene.remove(root); for (const mt of m.mats || []) mt.dispose(); }
    const held = heldItem();
    m.plain = true; root = buildPlayerModel(m, Inv.armor.map(s => s ? s.id : 0), key);
    if (held) { const im = itemMesh(held.id); im.scale.setScalar(0.42); im.position.set(0, -0.62, 0.16); im.rotation.set(-1.0, Math.PI / 2, 0); m.P.arms[1].u.add(im); }
    scene.add(root);
  }
  function render(dt) {
    if (!rend) init();
    const cv = $('charCanvas'), w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== w * 2 || cv.height !== h * 2) { rend.setSize(w * 2, h * 2, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    const s = heldItem(), k = Inv.armor.map(a => a ? a.id : 0).join(',') + '|' + (s ? s.id : 0);
    if (k !== key || !root) { key = k; build(); }
    t += dt;
    // look at the mouse: the head turns fully, the body follows part of the way
    const r = cv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.22;
    const yaw = Math.max(-1, Math.min(1, Math.atan2(mx - cx, 260))), pitch = Math.atan2(my - cy, 220);
    const P = m.P;
    root.rotation.y += (yaw * 0.45 - root.rotation.y) * Math.min(1, dt * 10);
    rot(P.head, Math.max(-0.6, Math.min(0.6, pitch * 0.9)), yaw * 0.5, 0);
    for (const a of P.arms) rot(a.u, Math.sin(t * 1.4 + a.sx) * 0.05, 0, a.sx * (0.06 + Math.sin(t * 1.1) * 0.025));
    P.body.scale.y = 1 + Math.sin(t * 2.2) * 0.008;
    rend.render(scene, cam);
  }
  return { render };
})();
