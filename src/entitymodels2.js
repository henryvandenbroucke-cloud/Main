'use strict';
/* More mob models in the game's geometry (parts, pivots and box UVs from the game's model layers), with
   their skins painted in code and their animations. */
(function moreModels() {
  const { def, P, A, quadLegs, humanoidParts, villagerParts, SK } = EntityModels;
  const PI = Math.PI, S = Skin;
  const sc = S.scale;
  const look = (m, s, part) => { const h = m.parts[part || 'head']; if (h) { h.ry = s.headYaw; h.rx = s.pitch; } };
  // ---------------------------------------------------------------- animations
  A.rabbit = (m, s) => { look(m, s); const L = m.parts; for (const n of ['left_ear', 'right_ear', 'nose']) { L[n].ry = s.headYaw + (n === 'left_ear' ? PI / 12 : n === 'right_ear' ? -PI / 12 : 0); L[n].rx = s.pitch; } const j = s.jump || 0; L.left_haunch.rx = L.right_haunch.rx = (j * 50 - 21) * PI / 180; L.left_hind_foot.rx = L.right_hind_foot.rx = j * 50 * PI / 180; L.left_front_leg.rx = L.right_front_leg.rx = (j * -40 - 11) * PI / 180; };
  A.fox = (m, s) => { A.quadruped(m, s); const L = m.parts; L.head.rz = s.headTilt || 0; if (s.sitting) { L.body.rx = PI / 6; L.body.y -= 7; L.body.z += 3; L.tail.rx = PI / 4; L.tail.z += 2; L.tail.y -= 2.65; L.head.y -= 6.5; L.head.z += 2.75; L.right_hind_leg.rx = L.left_hind_leg.rx = -PI / 2; L.right_hind_leg.z += 4; L.left_hind_leg.z += 4; L.right_hind_leg.y += 2.5; L.left_hind_leg.y += 2.5; L.right_front_leg.rx = L.left_front_leg.rx = -PI / 12; } if (s.sleeping) { L.body.rz = -PI / 2; L.body.y += 5; L.tail.rx = -PI * 5 / 6; L.head.y += 5; L.head.rz = -PI / 2; } };
  A.horse = (m, s) => {
    const L = m.parts, ls = s.ls, la = s.la;
    L.head_parts.rx = PI / 6 + s.pitch; L.head_parts.ry = s.headYaw;
    if (s.eat) { L.head_parts.rx = PI / 6 + 2.18; L.head_parts.y += 9; }
    if (s.stand) { L.body.rx = -PI / 4 * s.stand; L.head_parts.y -= 6 * s.stand; L.head_parts.z += 4 * s.stand; }
    const f = Math.cos(ls * 0.6662 + PI) * la * 1.4 * 0.8;
    L.left_hind_leg.rx = f; L.right_hind_leg.rx = -f; L.left_front_leg.rx = -f; L.right_front_leg.rx = f;
    L.tail.rx = PI / 6 + la * 0.75; L.tail.y = -1 + la; L.tail.z = 2 + la * 2;
  };
  A.llama = (m, s) => { look(m, s); const L = m.parts, ls = s.ls * 0.6662, la = s.la; L.right_hind_leg.rx = Math.cos(ls) * 1.4 * la; L.left_hind_leg.rx = Math.cos(ls + PI) * 1.4 * la; L.right_front_leg.rx = Math.cos(ls + PI) * 1.4 * la; L.left_front_leg.rx = Math.cos(ls) * 1.4 * la; };
  A.bee = (m, s) => { const L = m.parts; const t = s.t; L.right_wing.ry = 0; L.right_wing.rz = Math.cos(t * 2.1) * PI * 0.15; L.left_wing.rz = -L.right_wing.rz; L.bone.rx = 0; L.bone.y = 19 - Math.cos(t * 0.18) * 0.9; for (const n of ['front_legs', 'middle_legs', 'back_legs']) L[n].rx = PI / 4; };
  A.turtle = (m, s) => { look(m, s); const L = m.parts, ls = s.ls * 0.6662 * 0.6, la = s.la * 0.5; L.right_hind_leg.rx = Math.cos(ls) * la; L.left_hind_leg.rx = Math.cos(ls + PI) * la; L.right_front_leg.rz = Math.cos(ls + PI) * la; L.left_front_leg.rz = Math.cos(ls) * la; };
  A.panda = (m, s) => { A.quadruped(m, s); if (s.sitting) { const L = m.parts; L.body.rx = PI / 2 - 1; L.body.y = 15; L.head.y = 6; L.head.z = -8; } };
  A.squid = (m, s) => { const L = m.parts; for (let i = 0; i < 8; i++) L['tentacle' + i].rx = s.tentacle || 0; L.body.rx = 0; m.body.rotation.x = s.tilt || 0; };
  A.fish = (m, s) => { const L = m.parts; const f = s.inWater ? 1 : 1.5; const t = s.t; if (L.tail_fin) L.tail_fin.ry = -f * 0.45 * Math.sin(0.6 * t); if (L.body_back) L.body_back.ry = -f * 0.25 * Math.sin(0.6 * t); if (L.tail) L.tail.ry = -f * 0.45 * Math.sin(0.6 * t); m.root.rotation.z = s.inWater ? 0 : PI / 2; };
  A.dolphin = (m, s) => { const L = m.parts; L.body.rx = s.pitch; L.body.ry = s.headYaw * 0.5; if (s.moving) { L.body.rx += -0.05 - 0.05 * Math.cos(s.t * 0.3); L.tail.rx = -0.1 * Math.cos(s.t * 0.3); L.tail_fin.rx = -0.2 * Math.cos(s.t * 0.3); } };
  A.parrot = (m, s) => { const L = m.parts; L.head.rx = s.pitch; L.head.ry = s.headYaw; if (s.flying) { L.left_wing.rz = -0.0873 - s.flap; L.right_wing.rz = 0.0873 + s.flap; L.left_leg.rx += PI * 2 / 9; L.right_leg.rx += PI * 2 / 9; } else { const ls = s.ls * 0.6662; L.left_leg.rx = Math.cos(ls) * 1.4 * s.la; L.right_leg.rx = Math.cos(ls + PI) * 1.4 * s.la; } };
  A.bat = (m, s) => { const L = m.parts; if (s.resting) { m.body.rotation.x = PI; L.right_wing.ry = 1.2566371; L.left_wing.ry = -1.2566371; L.right_wing_tip.ry = 1.7278761; L.left_wing_tip.ry = -1.7278761; } else { m.body.rotation.x = 0; L.right_wing.ry = Math.cos(s.t * 74.48451 * PI / 180) * PI * 0.25; L.left_wing.ry = -L.right_wing.ry; L.right_wing_tip.ry = L.right_wing.ry * 0.5; L.left_wing_tip.ry = -L.right_wing.ry * 0.5; L.head.rx = s.pitch; L.head.ry = s.headYaw; } };
  A.ghast = (m, s) => { const L = m.parts; for (let i = 0; i < 9; i++) L['tentacle' + i].rx = 0.2 * Math.sin(s.t * 0.3 + i) + 0.4; };
  A.blaze = (m, s) => {
    const L = m.parts, t = s.t;
    let f = t * PI * -0.1;
    for (let i = 0; i < 4; i++) { const r = L['rod' + i]; r.y = -2 + Math.cos((i * 2 + t) * 0.25); r.x = Math.cos(f) * 9; r.z = Math.sin(f) * 9; f++; }
    f = PI / 4 + t * PI * 0.03;
    for (let i = 4; i < 8; i++) { const r = L['rod' + i]; r.y = 2 + Math.cos((i * 2 + t) * 0.25); r.x = Math.cos(f) * 7; r.z = Math.sin(f) * 7; f++; }
    f = 0.47123894 + t * PI * -0.05;
    for (let i = 8; i < 12; i++) { const r = L['rod' + i]; r.y = 11 + Math.cos((i * 1.5 + t) * 0.5); r.x = Math.cos(f) * 5; r.z = Math.sin(f) * 5; f++; }
    look(m, s);
  };
  A.piglin = (m, s) => { A.humanoid(m, s); const L = m.parts; const f = s.t * 0.1 + s.ls * 0.5, g = 0.08 + s.la * 0.4; L.left_ear.rz = -PI / 6 - Math.cos(f * 1.2) * g; L.right_ear.rz = PI / 6 + Math.cos(f) * g; if (s.aggressive && s.holdRight) { L.right_arm.rx = -PI / 2 + L.head.rx; L.right_arm.ry = L.head.ry - 0.1; } if (s.admiring) { L.head.rx = 0.5; L.head.ry = 0; L.left_arm.ry = -0.5; L.left_arm.rx = -0.9; } };
  A.hoglin = (m, s) => { const L = m.parts; L.head.ry = s.headYaw; const ls = s.ls * 0.6662, la = s.la; L.right_front_leg.rx = Math.cos(ls) * 1.2 * la; L.left_front_leg.rx = Math.cos(ls + PI) * 1.2 * la; L.right_hind_leg.rx = L.left_front_leg.rx; L.left_hind_leg.rx = L.right_front_leg.rx; L.head.rx = 0.8727 + (s.attack ? -Math.sin(s.attack * PI) * 0.7 : 0); };
  A.illager = (m, s) => {
    look(m, s); const L = m.parts, ls = s.ls * 0.6662, la = s.la;
    L.right_leg.rx = Math.cos(ls) * 1.4 * la * 0.5; L.left_leg.rx = Math.cos(ls + PI) * 1.4 * la * 0.5;
    const crossed = !s.aggressive && !s.spell && !s.celebrating;
    L.arms.show = crossed; L.right_arm.show = !crossed; L.left_arm.show = !crossed;
    if (!crossed) {
      L.right_arm.rx = Math.cos(ls + PI) * 2 * la * 0.5; L.left_arm.rx = Math.cos(ls) * 2 * la * 0.5; L.right_arm.rz = L.left_arm.rz = 0;
      if (s.spell) { L.right_arm.z = 0; L.right_arm.x = -5; L.left_arm.z = 0; L.left_arm.x = 5; L.right_arm.rx = Math.cos(s.t * 0.6662) * 0.25; L.left_arm.rx = Math.cos(s.t * 0.6662) * 0.25; L.right_arm.rz = 2.3561945; L.left_arm.rz = -2.3561945; }
      else if (s.bow) { L.right_arm.ry = -0.1 + L.head.ry; L.right_arm.rx = -PI / 2 + L.head.rx; L.left_arm.rx = -0.9424779 + L.head.rx; L.left_arm.ry = L.head.ry - 0.4; L.left_arm.rz = PI / 2; }
      else if (s.crossbow) { L.right_arm.ry = -0.3 + L.head.ry; L.left_arm.ry = 0.6 + L.head.ry; L.right_arm.rx = -PI / 2 + L.head.rx + 0.1; L.left_arm.rx = -1.5 + L.head.rx; }
      else if (s.aggressive) { const f = Math.sin(s.swing * PI); L.right_arm.rx = -PI / 2.25 + f * 1.2; L.left_arm.rx = Math.cos(ls) * 2 * la * 0.5; L.right_arm.ry = 0.1 - f * 0.6; }
      if (s.celebrating) { L.right_arm.z = 0; L.right_arm.x = -5; L.right_arm.rx = Math.cos(s.t * 0.6662) * 0.05; L.right_arm.rz = 2.670354; L.right_arm.ry = 0; L.left_arm.z = 0; L.left_arm.x = 5; L.left_arm.rx = Math.cos(s.t * 0.6662) * 0.05; L.left_arm.rz = -2.3561945; L.left_arm.ry = 0; }
    }
  };
  A.guardian = (m, s) => { look(m, s); const L = m.parts; const t = s.t; for (let i = 0; i < 12; i++) { const sp = L['spike' + i]; if (sp) { const ext = (1 - (s.spikes || 0)) * 0.55; sp.sx = sp.sy = sp.sz = 1; sp.y = sp.by + Math.sin(t * 1.5 + i) * 0.1 - ext * 0; } } L.tail0.ry = Math.sin(t * 0.3) * PI * 0.05; L.tail1.ry = Math.sin(t * 0.3) * PI * 0.1; L.tail2.ry = Math.sin(t * 0.3) * PI * 0.15; };
  A.shulker = (m, s) => { const L = m.parts; const peek = s.peek || 0; L.lid.y = 24 - peek * 8; L.lid.ry = peek * PI * (s.t % 20 > 10 ? 0.25 : 0); L.head.ry = s.headYaw; L.head.rx = s.pitch; L.head.y = 12 - peek * 2; };
  A.phantom = (m, s) => { const L = m.parts, f = (s.t * 7.448451 * PI / 180) + PI / 2 * 0; const flap = Math.cos(f) * 16 * PI / 180; L.left_wing_base.rz = flap; L.left_wing_tip.rz = flap; L.right_wing_base.rz = -flap; L.right_wing_tip.rz = -flap; L.tail_base.rx = -(5 + Math.cos(f * 2) * 5) * PI / 180; L.tail_tip.rx = -(5 + Math.cos(f * 2) * 5) * PI / 180; };
  A.silverfish = (m, s) => { const L = m.parts; for (let i = 0; i < 7; i++) { const p = L['segment' + i]; p.ry = Math.cos(s.t * 0.9 + i * 0.15 * PI) * PI * 0.05 * (1 + Math.abs(i - 2)); p.x = Math.sin(s.t * 0.9 + i * 0.15 * PI) * PI * 0.2 * Math.abs(i - 2); } for (const [k, i] of [['layer0', 2], ['layer1', 4], ['layer2', 1]]) { L[k].ry = L['segment' + i].ry; L[k].x = L['segment' + i].x; } };
  A.endermite = (m, s) => { const L = m.parts; for (let i = 0; i < 4; i++) { const p = L['segment' + i]; p.ry = Math.cos(s.t * 0.9 + i * 0.15 * PI) * PI * 0.01 * (1 + Math.abs(i - 2)); p.x = Math.sin(s.t * 0.9 + i * 0.15 * PI) * PI * 0.1 * Math.abs(i - 2); } };
  A.strider = (m, s) => { const L = m.parts, ls = s.ls * 1.5, la = Math.min(s.la, 0.25); L.body.rz = 0.1 * Math.sin(ls) * 4 * la; L.body.y = 2 - 2 * Math.cos(ls) * 2 * la; L.left_leg.rx = Math.sin(ls * 0.5) * 2 * la; L.right_leg.rx = Math.sin(ls * 0.5 + PI) * 2 * la; L.left_leg.rz = PI / 18 * Math.cos(ls * 0.5) * la; L.right_leg.rz = PI / 18 * Math.cos(ls * 0.5 + PI) * la; L.left_leg.y = 8 + 2 * Math.sin(ls * 0.5 + PI) * 2 * la; L.right_leg.y = 8 + 2 * Math.sin(ls * 0.5) * 2 * la; };
  A.wither = (m, s) => { const L = m.parts; const f = Math.cos(s.t * 0.1); L.ribcage.rx = (0.065 + 0.05 * f) * PI; L.tail.rx = (0.265 + 0.1 * f) * PI; L.center_head.ry = s.headYaw; L.center_head.rx = s.pitch; L.left_head.ry = s.headYaw * 0.8 + 0.3; L.right_head.ry = s.headYaw * 0.8 - 0.3; };
  A.allay = (m, s) => { const L = m.parts; look(m, s); L.right_wing.ry = 0.43633232 + Math.cos(s.t * 20 * PI / 180 * 1.2) * 0.3; L.left_wing.ry = -L.right_wing.ry; L.body.rx = s.la * 0.7; m.body.position.y = 1.501 + Math.cos(s.t * 9 * PI / 180) * 0.025; };
  A.warden = (m, s) => { look(m, s); const L = m.parts, ls = s.ls * 0.6662, la = Math.min(s.la, 0.5); L.right_leg.rx = Math.cos(ls) * 1.4 * la; L.left_leg.rx = Math.cos(ls + PI) * 1.4 * la; L.right_arm.rx = Math.cos(ls + PI) * 0.8 * la; L.left_arm.rx = Math.cos(ls) * 0.8 * la; L.right_tendril.rx = Math.sin(s.t * 0.3) * 0.3; L.left_tendril.rx = -L.right_tendril.rx; };
  A.goat = (m, s) => { A.quadruped(m, s); if (s.ram) m.parts.head.rx = s.ram; };
  A.frog = (m, s) => { look(m, s); const L = m.parts, ls = s.ls * 0.6662, la = s.la; L.left_leg.rx = Math.cos(ls) * 1.4 * la; L.right_leg.rx = Math.cos(ls + PI) * 1.4 * la; L.left_arm.rx = Math.cos(ls + PI) * la; L.right_arm.rx = Math.cos(ls) * la; if (s.croak) L.croak.sx = L.croak.sy = L.croak.sz = 1 + s.croak; else L.croak.show = false; };
  A.axolotl = (m, s) => { const L = m.parts, t = s.t; if (s.inWater) { L.body.rx = s.pitch; L.tail.ry = Math.sin(t * 0.33) * 0.5; L.right_hind_leg.rx = L.left_hind_leg.rx = 1.8849558 - Math.cos(t * 0.33) * 0.3; L.right_front_leg.rx = L.left_front_leg.rx = 2.3561945 - Math.cos(t * 0.33) * 0.3; } else { const ls = s.ls * 0.6662, la = s.la; L.right_hind_leg.rx = Math.cos(ls) * la; L.left_hind_leg.rx = Math.cos(ls + PI) * la; L.right_front_leg.rx = Math.cos(ls + PI) * la; L.left_front_leg.rx = Math.cos(ls) * la; L.tail.ry = Math.cos(t * 0.2) * 0.2; } L.top_gills.rx = Math.cos(t * 0.1) * 0.1; };
  A.camel = (m, s) => { A.quadruped(m, s); if (s.sitting) { const L = m.parts; L.body.y += 10; for (const n of ['right_hind_leg', 'left_hind_leg', 'right_front_leg', 'left_front_leg']) { L[n].rx = -PI / 2; L[n].y += 10; } } };
  A.armadillo = (m, s) => { A.quadruped(m, s); if (s.rolled) { const L = m.parts; for (const n of ['head', 'right_hind_leg', 'left_hind_leg', 'right_front_leg', 'left_front_leg', 'tail']) if (L[n]) L[n].show = false; L.cube && (L.cube.show = true); } else if (m.parts.cube) m.parts.cube.show = false; };
  A.sniffer = (m, s) => { A.quadruped(m, s); const L = m.parts; L.body.ry = 0; };
  A.breeze = (m, s) => { const L = m.parts; L.rods.ry = s.t * 0.3; L.wind_body.ry = s.t * 0.5; L.head.ry = s.headYaw; L.head.rx = s.pitch; m.body.position.y = 1.501 + Math.sin(s.t * 0.1) * 0.05; };
  A.dragon = (m, s) => { const L = m.parts, f = s.t * 0.1; const flap = Math.sin(f * PI * 2) * 0.5; L.left_wing.rz = -flap - 0.125; L.right_wing.rz = flap + 0.125; L.left_wing_tip.rz = -(Math.sin(f * PI * 2 + 1) + 0.5) * 0.75; L.right_wing_tip.rz = -L.left_wing_tip.rz; L.jaw.rx = (Math.sin(f * PI * 2) + 1) * 0.2; };
  A.ravager = (m, s) => { const L = m.parts; L.head.rx = s.pitch; L.neck.ry = s.headYaw * 0.5; const ls = s.ls * 0.6662 * 0.4, la = s.la; L.right_hind_leg.rx = Math.cos(ls) * la; L.left_hind_leg.rx = Math.cos(ls + PI) * la; L.right_front_leg.rx = Math.cos(ls + PI) * la; L.left_front_leg.rx = Math.cos(ls) * la; L.mouth.rx = s.roar ? PI / 4 * s.roar : 0; };
  A.vex = (m, s) => { A.humanoid(m, s); const L = m.parts; L.right_leg.rx = L.left_leg.rx = 0.4; L.right_wing.ry = 0.47123894 + Math.cos(s.t * 45.836624 * PI / 180) * PI * 0.05; L.left_wing.ry = -L.right_wing.ry; L.left_wing.rz = -0.47123894; L.right_wing.rz = 0.47123894; L.left_wing.rx = L.right_wing.rx = 0.47123894; };
  A.tadpole = (m, s) => { m.parts.tail.ry = -0.5 * Math.sin(s.t * 0.6); };
  A.snifflet = A.sniffer;

  // ---------------------------------------------------------------- skin helpers
  const furBox = (s, u, v, w, h, d, col, n, o) => s.box(u, v, w, h, d, col, n === undefined ? 0.09 : n, o);
  const eye2 = (s, F, x1, x2, y, col, white) => { const fx = F.front[0], fy = F.front[1]; if (white) { s.px(fx + x1 - 1, fy + y, white); s.px(fx + x2 + 1, fy + y, white); } s.px(fx + x1, fy + y, col); s.px(fx + x2, fy + y, col); };

  // ---------------------------------------------------------------- rabbit
  def('rabbit', 64, 32, [
    P('left_hind_foot', [3, 17.5, 3.7], 0, [[26, 24, -1, 5.5, -3.7, 2, 1, 7]]), P('right_hind_foot', [-3, 17.5, 3.7], 0, [[8, 24, -1, 5.5, -3.7, 2, 1, 7]]),
    P('left_haunch', [3, 17.5, 3.7], [-0.3490659, 0, 0], [[30, 15, -1, 0, 0, 2, 4, 5]]), P('right_haunch', [-3, 17.5, 3.7], [-0.3490659, 0, 0], [[16, 15, -1, 0, 0, 2, 4, 5]]),
    P('body', [0, 19, 8], [-0.3490659, 0, 0], [[0, 0, -3, -2, -10, 6, 5, 10]]),
    P('left_front_leg', [3, 17, -1], [-0.19198622, 0, 0], [[8, 15, -1, 0, -1, 2, 7, 2]]), P('right_front_leg', [-3, 17, -1], [-0.19198622, 0, 0], [[0, 15, -1, 0, -1, 2, 7, 2]]),
    P('head', [0, 16, -1], 0, [[32, 0, -2.5, -4, -5, 5, 4, 5]]),
    P('right_ear', [0, 16, -1], [0, -0.2617994, 0], [[52, 0, -2.5, -9, -1, 2, 5, 1]]), P('left_ear', [0, 16, -1], [0, 0.2617994, 0], [[58, 0, 0.5, -9, -1, 2, 5, 1]]),
    P('tail', [0, 20, 7], [-0.3490659, 0, 0], [[52, 6, -1.5, -1.5, 0, 3, 3, 2]]), P('nose', [0, 16, -1], 0, [[32, 9, -0.5, -2.5, -5.5, 1, 1, 1]]),
  ], { anim: 'rabbit', scale: 0.6, babyHead: 2, skin: s => {
    const b = 0x8a6a4a, l = 0xb8977a;
    for (const [u, v, w, h, d] of [[26, 24, 2, 1, 7], [8, 24, 2, 1, 7], [30, 15, 2, 4, 5], [16, 15, 2, 4, 5], [0, 0, 6, 5, 10], [8, 15, 2, 7, 2], [0, 15, 2, 7, 2], [52, 0, 2, 5, 1], [58, 0, 2, 5, 1]]) furBox(s, u, v, w, h, d, b);
    const F = furBox(s, 32, 0, 5, 4, 5, b); s.px(F.front[0] + 1, F.front[1] + 1, 0x111111); s.px(F.front[0] + 3, F.front[1] + 1, 0x111111); s.fill(F.front[0] + 1, F.front[1] + 3, 3, 1, l, 0.05);
    furBox(s, 52, 6, 3, 3, 2, 0xe8e0d8, 0.04); furBox(s, 32, 9, 1, 1, 1, 0xe89a9a, 0.02);
  } });
  // ---------------------------------------------------------------- fox
  def('fox', 48, 32, [
    P('head', [-1, 16.5, -3], 0, [[1, 5, -3, -2, -5, 8, 6, 6], [8, 1, -3, -4, -4, 2, 2, 1], [15, 1, 3, -4, -4, 2, 2, 1], [6, 18, -1, 2.01, -8, 4, 2, 3]]),
    P('body', [0, 16, -6], [PI / 2, 0, 0], [[24, 15, -3, 3.999, -3.5, 6, 11, 6]]),
    P('right_hind_leg', [-5, 17.5, 7], 0, [[13, 24, 2, 0.5, -1, 2, 6, 2]]), P('left_hind_leg', [-1, 17.5, 7], 0, [[4, 24, 2, 0.5, -1, 2, 6, 2]]),
    P('right_front_leg', [-5, 17.5, 0], 0, [[13, 24, 2, 0.5, -1, 2, 6, 2]]), P('left_front_leg', [-1, 17.5, 0], 0, [[4, 24, 2, 0.5, -1, 2, 6, 2]]),
    P('tail', [-4, 15, -1], [-0.05235988, 0, 0], [[30, 0, 2, 0, -1, 4, 9, 5]]),
  ], { anim: 'fox', babyHead: 4, skin: s => {
    const o = 0xe07a2a, w = 0xf2ece4, d = 0x3a2a2a;
    const F = furBox(s, 1, 5, 8, 6, 6, o); s.fill(F.front[0], F.front[1] + 3, 8, 3, w, 0.04); s.px(F.front[0] + 2, F.front[1] + 2, d); s.px(F.front[0] + 5, F.front[1] + 2, d);
    furBox(s, 8, 1, 2, 2, 1, d); furBox(s, 15, 1, 2, 2, 1, d); const N = furBox(s, 6, 18, 4, 2, 3, w, 0.04); s.fill(N.front[0] + 1, N.front[1], 2, 1, d, 0);
    const B = furBox(s, 24, 15, 6, 11, 6, o); s.fill(B.front[0], B.front[1], 6, 4, w, 0.04);
    furBox(s, 13, 24, 2, 6, 2, d); furBox(s, 4, 24, 2, 6, 2, d);
    const T = furBox(s, 30, 0, 4, 9, 5, o); for (const k of ['front', 'back', 'left', 'right', 'bottom']) s.fill(T[k][0], T[k][1] + (k === 'bottom' ? 0 : T[k][3] - 2), T[k][2], k === 'bottom' ? T[k][3] : 2, w, 0.04);
  } });
  // ---------------------------------------------------------------- horses, donkeys and mules
  const horseParts = (donkey) => [
    P('body', [0, 11, 5], 0, [[0, 32, -5, -8, -17, 10, 10, 22, 0.05]]),
    P('head_parts', [0, 4, -12], [PI / 6, 0, 0], [[0, 35, -2.05, -6, -2, 4, 12, 7]], [
      P('head', [0, 0, 0], 0, [[0, 13, -3, -11, -2, 6, 5, 7]]), P('mane', [0, 0, 0], 0, [[56, 36, -1, -11, 5.01, 2, 16, 2]]),
      P('upper_mouth', [0, 0, 0], 0, [[0, 25, -2, -11, -7, 4, 5, 5]]),
      P('left_ear', [0, 0, 0], 0, donkey ? [[0, 12, 1.25, -18, 4, 2, 7, 1]] : [[19, 16, 0.55, -13, 4, 2, 3, 1, -0.001]]),
      P('right_ear', [0, 0, 0], 0, donkey ? [[0, 12, -3.25, -18, 4, 2, 7, 1]] : [[19, 16, -2.55, -13, 4, 2, 3, 1, -0.001]]),
    ]),
    P('left_hind_leg', [4, 14, 7], 0, [[48, 21, -3, -1.01, -1, 4, 11, 4, 0, true]]), P('right_hind_leg', [-4, 14, 7], 0, [[48, 21, -1, -1.01, -1, 4, 11, 4]]),
    P('left_front_leg', [4, 14, -12], 0, [[48, 21, -3, -1.01, -1.9, 4, 11, 4, 0, true]]), P('right_front_leg', [-4, 14, -12], 0, [[48, 21, -1, -1.01, -1.9, 4, 11, 4]]),
    P('tail', [0, 4, 11], [PI / 6, 0, 0], [[42, 36, -1.5, 0, 0, 3, 14, 4]]),
  ];
  const horseSkin = (body, mane, o) => s => {
    o = o || {};
    furBox(s, 0, 32, 10, 10, 22, body, 0.07);
    const H = furBox(s, 0, 35, 4, 12, 7, body, 0.07); void H;
    const HD = furBox(s, 0, 13, 6, 5, 7, body, 0.07); s.px(HD.left[0] + 2, HD.left[1] + 2, 0x111111); s.px(HD.right[0] + 4, HD.right[1] + 2, 0x111111);
    furBox(s, 56, 36, 2, 16, 2, mane, 0.1); const M = furBox(s, 0, 25, 4, 5, 5, o.muzzle || sc(body, 0.85), 0.06); s.px(M.front[0] + 0, M.front[1] + 1, 0x222222); s.px(M.front[0] + 3, M.front[1] + 1, 0x222222);
    furBox(s, 19, 16, 2, 3, 1, body, 0.05); furBox(s, 0, 12, 2, 7, 1, body, 0.05);
    const L = furBox(s, 48, 21, 4, 11, 4, body, 0.07); for (const k of ['front', 'back', 'left', 'right']) s.fill(L[k][0], L[k][1] + 8, L[k][2], 3, o.hoof || 0x3a3a3a, 0.05);
    furBox(s, 42, 36, 3, 14, 4, mane, 0.1);
    if (o.markings) o.markings(s);
  };
  def('horse', 64, 64, horseParts(false), { anim: 'horse', scale: 1.1, babyHead: 0, skin: horseSkin(0x8a5a32, 0x3a2414) });
  def('donkey', 64, 64, horseParts(true), { anim: 'horse', scale: 0.87, skin: horseSkin(0x7a6a5a, 0x3a3028, { muzzle: 0xa89a8a }) });
  def('mule', 64, 64, horseParts(true), { anim: 'horse', scale: 0.92, skin: horseSkin(0x5a3a22, 0x2a1a10) });
  def('skeleton_horse', 64, 64, horseParts(false), { anim: 'horse', skin: horseSkin(0xd8d8d0, 0xb8b8b0, { hoof: 0xa0a098 }) });
  def('zombie_horse', 64, 64, horseParts(false), { anim: 'horse', skin: horseSkin(0x4a7a3a, 0x2a4a1a) });
  // ---------------------------------------------------------------- llama
  const llamaParts = () => [
    P('head', [0, 7, -6], 0, [[0, 0, -2, -14, -10, 4, 4, 9], [0, 14, -4, -16, -6, 8, 18, 6], [17, 0, -4, -19, -4, 3, 3, 2], [17, 0, 1, -19, -4, 3, 3, 2]]),
    P('body', [0, 5, 2], [PI / 2, 0, 0], [[29, 0, -6, -10, -7, 12, 18, 10]]),
  ].concat(quadLegs(29, 29, 4, 14, 4, 3.5, 6, -5, 10));
  const llamaSkin = (c) => s => { const F = furBox(s, 0, 0, 4, 4, 9, sc(c, 0.9), 0.06); void F; const N = furBox(s, 0, 14, 8, 18, 6, c, 0.08); s.px(N.front[0] + 1, N.front[1] + 3, 0x111111); s.px(N.front[0] + 6, N.front[1] + 3, 0x111111); furBox(s, 17, 0, 3, 3, 2, c); furBox(s, 29, 0, 12, 18, 10, c, 0.08); furBox(s, 29, 29, 4, 14, 4, c, 0.08); };
  def('llama', 128, 64, llamaParts(), { anim: 'llama', skin: llamaSkin(0xe0d0b0) });
  def('trader_llama', 128, 64, llamaParts(), { anim: 'llama', skin: s => { llamaSkin(0xa07a50)(s); const B = s.faces(29, 0, 12, 18, 10); s.fill(B.top[0], B.top[1] + 4, 12, 10, 0x2a4a9a, 0.06); } });
  // ---------------------------------------------------------------- goat
  def('goat', 64, 64, [
    P('head', [1, 14, 0], 0, [[2, 61, -6, -11, -10, 5, 7, 10], [34, 46, -3.5, -4, -3, 3, 7, 1], [23, 52, -0.5, -3, -14, 0, 7, 5]], [
      P('left_horn', [0, 0, 0], 0, [[12, 55, -0.01, -16, -10, 2, 7, 2]]), P('right_horn', [0, 0, 0], 0, [[12, 55, -2.99, -16, -10, 2, 7, 2]]),
      P('nose', [0, -8, -8], [0.9599, 0, 0], [[34, 46, -3, -4, -8, 5, 7, 10]])]),
    P('body', [0, 24, 0], 0, [[1, 1, -4, -17, -7, 9, 11, 16], [0, 28, -5, -18, -8, 11, 14, 11]]),
  ].concat([P('left_hind_leg', [1, 14, 4], 0, [[36, 29, 0, 4, 0, 3, 6, 3]]), P('right_hind_leg', [-3, 14, 4], 0, [[49, 29, 0, 4, 0, 3, 6, 3]]), P('left_front_leg', [1, 14, -6], 0, [[49, 2, 0, 0, 0, 3, 10, 3]]), P('right_front_leg', [-3, 14, -6], 0, [[35, 2, 0, 0, 0, 3, 10, 3]])]),
  { anim: 'goat', skin: s => { const w = 0xece8e0; furBox(s, 2, 61, 5, 7, 10, w, 0.06); furBox(s, 34, 46, 3, 7, 1, w, 0.06); furBox(s, 34, 46, 5, 7, 10, w, 0.06); const F = s.faces(34, 46, 5, 7, 10); s.px(F.left[0] + 3, F.left[1] + 2, 0x222222); s.px(F.right[0] + 6, F.right[1] + 2, 0x222222); furBox(s, 12, 55, 2, 7, 2, 0xd8cdb5, 0.06); furBox(s, 1, 1, 9, 11, 16, w, 0.07); furBox(s, 0, 28, 11, 14, 11, 0xf6f3ee, 0.08); for (const [u, v, h] of [[36, 29, 6], [49, 29, 6], [49, 2, 10], [35, 2, 10]]) furBox(s, u, v, 3, h, 3, w, 0.06); }, babyHead: 3 });
  // ---------------------------------------------------------------- bee
  def('bee', 64, 64, [
    P('bone', [0, 19, 0], 0, [], [
      P('body', [0, 0, 0], 0, [[0, 0, -3.5, -4, -5, 7, 7, 10]], [P('stinger', [0, 0, 0], 0, [[26, 7, 0, -1, 5, 0, 1, 2]]), P('left_antenna', [0, -2, -5], 0, [[2, 0, 1.5, -2, -3, 1, 2, 3]]), P('right_antenna', [0, -2, -5], 0, [[2, 3, -2.5, -2, -3, 1, 2, 3]])]),
      P('right_wing', [-1.5, -4, -3], [0, -0.2618, 0], [[0, 18, -9, 0, 0, 9, 0, 6]], [], true), P('left_wing', [1.5, -4, -3], [0, 0.2618, 0], [[0, 18, 0, 0, 0, 9, 0, 6, 0, true]], [], true),
      P('front_legs', [1.5, 3, -2], 0, [[26, 1, -5, 0, 0, 7, 2, 0]]), P('middle_legs', [1.5, 3, 0], 0, [[26, 3, -5, 0, 0, 7, 2, 0]]), P('back_legs', [1.5, 3, 2], 0, [[26, 5, -5, 0, 0, 7, 2, 0]]),
    ]),
  ], { anim: 'bee', skin: s => { const y = 0xf0c030, b = 0x3a2a1a; const B = furBox(s, 0, 0, 7, 7, 10, y, 0.05); for (const k of ['top', 'left', 'right', 'bottom']) for (const off of [3, 7]) { const f = B[k]; if (k === 'top' || k === 'bottom') s.fill(f[0], f[1] + off, f[2], 2, b, 0.05); else s.fill(f[0] + off, f[1], 2, f[3], b, 0.05); } s.fill(B.front[0], B.front[1], 7, 7, b, 0.05); s.px(B.front[0] + 1, B.front[1] + 2, 0x111111); s.px(B.front[0] + 5, B.front[1] + 2, 0x111111); s.fill(B.back[0], B.back[1], 7, 7, b, 0.05); s.fill(26, 7, 2, 1, 0x8a8a8a, 0); s.fill(0, 18, 15, 6, 0xcde8ff, 0); s.g.clearRect(0, 18, 15, 6); s.g.fillStyle = 'rgba(220,240,255,0.6)'; s.g.fillRect(6, 18, 9, 6); s.fill(26, 1, 7, 6, b, 0.05); s.fill(2, 0, 4, 6, b, 0); } });
  // ---------------------------------------------------------------- turtle
  def('turtle', 128, 64, [
    P('head', [0, 19, -10], 0, [[3, 0, -3, -1, -3, 6, 5, 6]]),
    P('body', [0, 11, -10], [PI / 2, 0, 0], [[7, 37, -9.5, 3, -10, 19, 20, 6], [31, 1, -5.5, 3, -13, 11, 18, 3]]),
    P('right_hind_leg', [-3.5, 22, 11], 0, [[1, 23, -2, 0, 0, 4, 1, 10]]), P('left_hind_leg', [3.5, 22, 11], 0, [[1, 12, -2, 0, 0, 4, 1, 10]]),
    P('right_front_leg', [-5, 21, -4], 0, [[27, 30, -13, 0, -2, 13, 1, 5]]), P('left_front_leg', [5, 21, -4], 0, [[27, 24, 0, 0, -2, 13, 1, 5]]),
  ], { anim: 'turtle', scale: 1, skin: s => { const g = 0x4ea84a, sh = 0x2a6a3a; const H = furBox(s, 3, 0, 6, 5, 6, g, 0.06); s.px(H.front[0] + 1, H.front[1] + 1, 0x111111); s.px(H.front[0] + 4, H.front[1] + 1, 0x111111); const B = furBox(s, 7, 37, 19, 20, 6, sh, 0.1); s.speckle(B.front[0], B.front[1], 19, 20, [sh, 0x3a7a3a, 0x1f5a2a, 0x6a5a2a]); furBox(s, 31, 1, 11, 18, 3, 0xd8cc8a, 0.06); for (const [u, v, w, h, d] of [[1, 23, 4, 1, 10], [1, 12, 4, 1, 10], [27, 30, 13, 1, 5], [27, 24, 13, 1, 5]]) furBox(s, u, v, w, h, d, g, 0.06); } });
  // ---------------------------------------------------------------- panda
  def('panda', 64, 64, [
    P('head', [0, 11.5, -17], 0, [[0, 6, -6.5, -5, -4, 13, 10, 9], [45, 16, -3.5, 0, -6, 7, 5, 2], [52, 25, -8.5, -8, -1, 5, 4, 1], [52, 25, 3.5, -8, -1, 5, 4, 1]]),
    P('body', [0, 10, 0], [PI / 2, 0, 0], [[0, 25, -9.5, -13, -6.5, 19, 26, 13]]),
  ].concat(quadLegs(40, 0, 6, 9, 6, 5.5, 9, -9, 15)), { anim: 'panda', babyHead: 4, skin: s => { const w = 0xf0f0ec, b = 0x1a1a1a; const H = furBox(s, 0, 6, 13, 10, 9, w, 0.05); const fx = H.front[0], fy = H.front[1]; s.fill(fx + 2, fy + 3, 3, 3, b, 0.03); s.fill(fx + 8, fy + 3, 3, 3, b, 0.03); s.px(fx + 3, fy + 4, 0xf0f0f0); s.px(fx + 9, fy + 4, 0xf0f0f0); const N = furBox(s, 45, 16, 7, 5, 2, w, 0.04); s.fill(N.front[0] + 2, N.front[1], 3, 2, b, 0); furBox(s, 52, 25, 5, 4, 1, b, 0.05); const B = furBox(s, 0, 25, 19, 26, 13, w, 0.06); s.fill(B.top[0], B.top[1] + 6, 19, 6, b, 0.05); s.fill(B.right[0], B.right[1] + 6, 13, 6, b, 0.05); s.fill(B.left[0], B.left[1] + 6, 13, 6, b, 0.05); s.fill(B.bottom[0], B.bottom[1] + 6, 19, 6, b, 0.05); furBox(s, 40, 0, 6, 9, 6, b, 0.05); } });
  // ---------------------------------------------------------------- polar bear
  def('polar_bear', 128, 64, [
    P('head', [0, 10, -16], 0, [[0, 0, -3.5, -3, -3, 7, 7, 7], [0, 44, -2.5, 1, -6, 5, 3, 3], [26, 0, -4.5, -4, -1, 2, 2, 1], [26, 0, 2.5, -4, -1, 2, 2, 1, 0, true]]),
    P('body', [-2, 9, 12], [PI / 2, 0, 0], [[0, 19, -5, -13, -7, 14, 14, 11], [39, 0, -4, -25, -7, 12, 12, 10]]),
    P('right_hind_leg', [-4.5, 14, 6], 0, [[50, 22, -2, 0, -2, 4, 10, 8]]), P('left_hind_leg', [4.5, 14, 6], 0, [[50, 22, -2, 0, -2, 4, 10, 8]]),
    P('right_front_leg', [-3.5, 14, -8], 0, [[50, 40, -2, 0, -2, 4, 10, 6]]), P('left_front_leg', [3.5, 14, -8], 0, [[50, 40, -2, 0, -2, 4, 10, 6]]),
  ], { anim: 'quadruped', babyHead: 4, skin: s => { const w = 0xf4f4f0; const H = furBox(s, 0, 0, 7, 7, 7, w, 0.05); s.px(H.front[0] + 1, H.front[1] + 2, 0x111111); s.px(H.front[0] + 5, H.front[1] + 2, 0x111111); const N = furBox(s, 0, 44, 5, 3, 3, 0xe8e8e0, 0.04); s.fill(N.front[0] + 1, N.front[1], 3, 1, 0x222222, 0); furBox(s, 26, 0, 2, 2, 1, w); furBox(s, 0, 19, 14, 14, 11, w, 0.06); furBox(s, 39, 0, 12, 12, 10, w, 0.06); furBox(s, 50, 22, 4, 10, 8, w); furBox(s, 50, 40, 4, 10, 6, w); } });
  // ---------------------------------------------------------------- squid, fish and dolphins
  const squidParts = () => { const t = []; for (let i = 0; i < 8; i++) { const a = i * PI * 2 / 8; t.push(P('tentacle' + i, [Math.cos(a) * 5, 15, Math.sin(a) * 5], [0, i * PI * -2 / 8 + PI / 2, 0], [[48, 0, -1, 0, -1, 2, 18, 2]])); } return [P('body', [0, 8, 0], 0, [[0, 0, -6, -8, -6, 12, 16, 12]])].concat(t); };
  def('squid', 64, 32, squidParts(), { anim: 'squid', skin: s => { const c = 0x2a3a6a; const B = furBox(s, 0, 0, 12, 16, 12, c, 0.1); s.fill(B.front[0] + 2, B.front[1] + 10, 2, 2, 0xffffff, 0); s.px(B.front[0] + 3, B.front[1] + 11, 0x000000); s.fill(B.front[0] + 8, B.front[1] + 10, 2, 2, 0xffffff, 0); s.px(B.front[0] + 8, B.front[1] + 11, 0x000000); furBox(s, 48, 0, 2, 18, 2, sc(c, 0.9), 0.1); } });
  def('glow_squid', 64, 32, squidParts(), { anim: 'squid', skin: s => { const c = 0x1a8a8a; const B = furBox(s, 0, 0, 12, 16, 12, c, 0.1); s.speckle(B.front[0], B.front[1], 12, 16, [c, c, 0x5af0d0, 0x2ab0a0]); s.fill(B.front[0] + 2, B.front[1] + 10, 2, 2, 0xd8fff8, 0); s.fill(B.front[0] + 8, B.front[1] + 10, 2, 2, 0xd8fff8, 0); furBox(s, 48, 0, 2, 18, 2, 0x2ab0a0, 0.1); } });
  def('cod', 32, 32, [
    P('body', [0, 22, 0], 0, [[0, 0, -1, -2, 0, 2, 4, 7]], [P('tail_fin', [0, 0, 7], 0, [[22, 3, 0, -2, 0, 0, 4, 4]])]),
    P('head', [0, 22, 0], 0, [[11, 0, -1, -2, -3, 2, 4, 3]]), P('nose', [0, 22, -3], 0, [[0, 0, -1, -2, -1, 2, 3, 1]]),
    P('right_fin', [-1, 23, 0], [0, 0, -PI / 4], [[22, 1, -2, 0, -1, 2, 0, 2]]), P('left_fin', [1, 23, 0], [0, 0, PI / 4], [[22, 4, 0, 0, -1, 2, 0, 2]]), P('top_fin', [0, 20, 0], 0, [[20, -6, 0, -1, -1, 0, 1, 6]]),
  ], { anim: 'fish', skin: s => { const c = 0xb89a6a; const B = furBox(s, 0, 0, 2, 4, 7, c, 0.1); s.speckle(B.left[0], B.left[1], 7, 4, [c, c, 0x8a6a4a, 0xd8c09a]); const H = furBox(s, 11, 0, 2, 4, 3, c, 0.08); s.px(H.left[0] + 1, H.left[1] + 1, 0x111111); s.px(H.right[0] + 1, H.right[1] + 1, 0x111111); s.fill(22, 1, 8, 8, 0xd8c09a, 0.06); s.fill(20, 0, 12, 1, 0xd8c09a, 0); s.fill(14, 0, 12, 6, 0xd8c09a, 0.05); } });
  def('salmon', 32, 32, [
    P('body_front', [0, 20, 0], 0, [[0, 0, -1.5, -2.5, 0, 3, 5, 8]]),
    P('body_back', [0, 20, 8], 0, [[0, 13, -1.5, -2.5, 0, 3, 5, 8]], [P('back_fin', [0, 0, 8], 0, [[20, 10, 0, -2.5, 0, 0, 5, 6]])]),
    P('head', [0, 20, 0], 0, [[22, 0, -1, -2, -3, 2, 4, 3]]),
    P('top_front_fin', [0, 17.5, 1], 0, [[4, 2, 0, 0, 0, 0, 2, 3]]), P('top_back_fin', [0, 17.5, 8], 0, [[2, 3, 0, 0, 0, 0, 2, 4]]),
    P('right_fin', [-1.5, 21.5, 0], [0, 0, -PI / 4], [[-4, 0, -2, 0, 0, 2, 0, 2]]), P('left_fin', [1.5, 21.5, 0], [0, 0, PI / 4], [[0, 0, 0, 0, 0, 2, 0, 2]]),
  ], { anim: 'fish', skin: s => { const c = 0xa83a2a; furBox(s, 0, 0, 3, 5, 8, c, 0.08); const B = furBox(s, 0, 13, 3, 5, 8, c, 0.08); s.fill(B.left[0], B.left[1], 8, 1, 0x4a5a3a, 0.05); s.fill(B.right[0], B.right[1], 8, 1, 0x4a5a3a, 0.05); const H = furBox(s, 22, 0, 2, 4, 3, 0x6a5a4a, 0.06); s.px(H.left[0] + 1, H.left[1] + 1, 0x111111); s.px(H.right[0] + 1, H.right[1] + 1, 0x111111); s.fill(20, 10, 12, 12, 0x8a2a1a, 0.06); s.fill(0, 0, 8, 6, 0x8a2a1a, 0.06); } });
  def('tropical_fish', 32, 32, [
    P('body', [0, 22, 0], 0, [[0, 0, -1, -1.5, -3, 2, 3, 6]]), P('tail', [0, 22, 3], 0, [[22, -6, 0, -1.5, 0, 0, 3, 6]]),
    P('right_fin', [-1, 22.5, 0], [0, PI / 4, 0], [[2, 16, -2, -1, 0, 2, 2, 0]]), P('left_fin', [1, 22.5, 0], [0, -PI / 4, 0], [[2, 12, 0, -1, 0, 2, 2, 0]]), P('top_fin', [0, 20.5, -3], 0, [[10, -5, 0, -3, 0, 0, 3, 6]]),
  ], { anim: 'fish', skin: s => { const a = 0xf09030, b = 0xf0f0f0; const B = furBox(s, 0, 0, 2, 3, 6, a, 0.05); for (const k of ['left', 'right']) s.fill(B[k][0] + 2, B[k][1], 2, 3, b, 0); s.px(B.left[0] + 1, B.left[1] + 1, 0x111111); s.px(B.right[0] + 4, B.right[1] + 1, 0x111111); s.fill(16, 0, 16, 6, a, 0.05); s.fill(10, 0, 6, 3, a, 0); s.fill(2, 12, 4, 6, b, 0); } });
  def('pufferfish', 32, 32, [
    P('body', [0, 22, 0], 0, [[12, 22, -2.5, -5, -2.5, 5, 5, 5]]), P('right_fin', [-2.5, 17, -1.5], 0, [[24, 0, -2, 0, 0, 2, 0, 2]]), P('left_fin', [2.5, 17, -1.5], 0, [[24, 3, 0, 0, 0, 2, 0, 2]]),
    P('spikes_front', [0, 22, -2.5], 0, [[15, 16, -2.5, -5, 0, 5, 5, 0]]), P('spikes_back', [0, 22, 2.5], 0, [[15, 20, -2.5, -5, 0, 5, 5, 0]]),
  ], { anim: 'fish', skin: s => { const c = 0xe8c040; const B = furBox(s, 12, 22, 5, 5, 5, c, 0.06); s.px(B.front[0] + 1, B.front[1] + 1, 0x111111); s.px(B.front[0] + 3, B.front[1] + 1, 0x111111); s.speckle(B.top[0], B.top[1], 5, 5, [c, 0x8a7a2a, c]); s.fill(24, 0, 2, 5, 0x5a8a9a, 0); s.pat(15, 16, ['#.#.#', '.....', '#...#', '.....', '#.#.#'], { '#': 0xf0f0f0 }); s.pat(15, 20, ['#.#.#', '.....', '#...#', '.....', '#.#.#'], { '#': 0xf0f0f0 }); } });
  def('dolphin', 64, 64, [
    P('body', [0, 22, -5], 0, [[22, 0, -4, -7, 0, 8, 7, 13]], [
      P('back_fin', [0, 0, 0], [PI / 3, 0, 0], [[51, 0, -0.5, 0, 8, 1, 4, 5]]),
      P('left_fin', [2, -2, 4], [PI / 3, 0, 2 * PI / 3], [[48, 20, -0.5, -4, 0, 1, 4, 7]]), P('right_fin', [-2, -2, 4], [PI / 3, 0, -2 * PI / 3], [[48, 20, -0.5, -4, 0, 1, 4, 7, 0, true]]),
      P('tail', [0, -2.5, 11], [-0.10471976, 0, 0], [[0, 19, -2, -2.5, 0, 4, 5, 11]], [P('tail_fin', [0, 0, 9], 0, [[19, 20, -5, -0.5, 0, 10, 1, 6]])]),
      P('head', [0, -4, -3], 0, [[0, 0, -4, -3, -3, 8, 7, 6], [0, 13, -1, 2, -7, 2, 2, 4]]),
    ]),
  ], { anim: 'dolphin', skin: s => { const g = 0x8a9aa8, l = 0xc8d0d8; const B = furBox(s, 22, 0, 8, 7, 13, g, 0.06); s.fill(B.bottom[0], B.bottom[1], 8, 13, l, 0.04); furBox(s, 51, 0, 1, 4, 5, g); furBox(s, 48, 20, 1, 4, 7, g); furBox(s, 0, 19, 4, 5, 11, g, 0.06); furBox(s, 19, 20, 10, 1, 6, g); const H = furBox(s, 0, 0, 8, 7, 6, g, 0.06); s.px(H.left[0] + 2, H.left[1] + 3, 0x111111); s.px(H.right[0] + 3, H.right[1] + 3, 0x111111); furBox(s, 0, 13, 2, 2, 4, l); } });
  // ---------------------------------------------------------------- parrot and bat
  def('parrot', 32, 32, [
    P('body', [0, 16.5, -3], [0.4937, 0, 0], [[2, 8, -1.5, 0, -1.5, 3, 6, 3]]), P('tail', [0, 21.07, 1.16], [1.015, 0, 0], [[22, 1, -1.5, -1, -1, 3, 4, 1]]),
    P('left_wing', [1.5, 16.94, -2.76], [-0.6981, -PI, 0], [[19, 8, -0.5, 0, -1.5, 1, 5, 3]]), P('right_wing', [-1.5, 16.94, -2.76], [-0.6981, -PI, 0], [[19, 8, -0.5, 0, -1.5, 1, 5, 3]]),
    P('head', [0, 15.69, -2.76], 0, [[2, 2, -1, -1.5, -1, 2, 3, 2]], [P('head2', [0, -2, -1], 0, [[10, 0, -1, -0.5, -2, 2, 1, 4]]), P('beak1', [0, -0.5, -1.5], 0, [[11, 7, -0.5, -1, -0.5, 1, 2, 1]]), P('beak2', [0, -1.75, -2.45], 0, [[16, 7, -0.5, 0, -0.5, 1, 2, 1]]), P('feather', [0, -2.15, 0.15], [-0.2214, 0, 0], [[2, 18, 0, -4, -2, 0, 5, 4]])]),
    P('left_leg', [1, 22, -1.05], [-0.0299, 0, 0], [[14, 18, -0.5, 0, -0.5, 1, 2, 1]]), P('right_leg', [-1, 22, -1.05], [-0.0299, 0, 0], [[14, 18, -0.5, 0, -0.5, 1, 2, 1]]),
  ], { anim: 'parrot', skin: s => { const r = 0xd02a1a, y = 0xf0c030, bl = 0x2a5ad0; furBox(s, 2, 8, 3, 6, 3, r, 0.06); furBox(s, 22, 1, 3, 4, 1, bl, 0.06); const W = furBox(s, 19, 8, 1, 5, 3, r, 0.06); s.fill(W.left[0], W.left[1] + 3, 3, 2, bl, 0); const H = furBox(s, 2, 2, 2, 3, 2, r, 0.05); s.px(H.left[0] + 1, H.left[1] + 1, 0x111111); s.px(H.right[0], H.right[1] + 1, 0x111111); furBox(s, 10, 0, 2, 1, 4, r); furBox(s, 11, 7, 1, 2, 1, 0x3a3a3a, 0); furBox(s, 16, 7, 1, 2, 1, 0x3a3a3a, 0); s.fill(2, 18, 8, 9, r, 0.05); furBox(s, 14, 18, 1, 2, 1, 0x6a6a6a, 0); void y; } });
  def('bat', 64, 64, [
    P('head', [0, 0, 0], 0, [[0, 0, -3, -3, -3, 6, 6, 6], [24, 0, -4, -6, -2, 3, 4, 1], [24, 0, 1, -6, -2, 3, 4, 1, 0, true]]),
    P('body', [0, 0, 0], 0, [[0, 16, -3, 4, -3, 6, 12, 6], [0, 34, -5, 16, 0, 10, 6, 1]]),
    P('right_wing', [0, 0, 0], 0, [[42, 0, -12, 1, 1.5, 10, 16, 1]], [P('right_wing_tip', [-12, 1, 1.5], 0, [[24, 16, -8, 1, 0, 8, 12, 1]])]),
    P('left_wing', [0, 0, 0], 0, [[42, 0, 2, 1, 1.5, 10, 16, 1, 0, true]], [P('left_wing_tip', [12, 1, 1.5], 0, [[24, 16, 0, 1, 0, 8, 12, 1, 0, true]])]),
  ], { anim: 'bat', scale: 0.35, skin: s => { const b = 0x4a3a2a, d = 0x2a2018; const H = furBox(s, 0, 0, 6, 6, 6, b, 0.08); s.px(H.front[0] + 1, H.front[1] + 3, 0x111111); s.px(H.front[0] + 4, H.front[1] + 3, 0x111111); furBox(s, 24, 0, 3, 4, 1, b); furBox(s, 0, 16, 6, 12, 6, b, 0.08); furBox(s, 0, 34, 10, 6, 1, d); furBox(s, 42, 0, 10, 16, 1, d, 0.06); furBox(s, 24, 16, 8, 12, 1, d, 0.06); } });
  // ---------------------------------------------------------------- Nether mobs
  const ghastParts = () => { const t = []; const r = new Rand(1660); for (let i = 0; i < 9; i++) { const x = ((i % 3) - (Math.floor(i / 3) % 2) * 0.5 + 0.25) / 2 * 2 - 1, z = Math.floor(i / 3) / 2 * 2 - 1; t.push(P('tentacle' + i, [x * 5, 24 - 8 + 7 + 1 - 8 + 7.6 + 0.4, z * 5 + 1], 0, [[0, 0, -1, 0, -1, 2, r.int(7) + 8, 2]])); } return [P('body', [0, 17.6, 0], 0, [[0, 0, -8, -8, -8, 16, 16, 16]])].concat(t); };
  def('ghast', 64, 32, ghastParts(), { anim: 'ghast', scale: 4.5, skin: s => { const w = 0xf0f0f0; const B = furBox(s, 0, 0, 16, 16, 16, w, 0.04); const fx = B.front[0], fy = B.front[1]; s.fill(fx + 3, fy + 4, 3, 2, 0x6a6a6a, 0); s.fill(fx + 10, fy + 4, 3, 2, 0x6a6a6a, 0); s.fill(fx + 6, fy + 10, 4, 2, 0x6a6a6a, 0); s.fill(fx + 3, fy + 7, 1, 2, 0xb0b0b0, 0); } });
  def('blaze', 64, 32, [P('head', [0, 0, 0], 0, [[0, 0, -4, -4, -4, 8, 8, 8]])].concat([...Array(12).keys()].map(i => P('rod' + i, [0, 0, 0], 0, [[0, 16, 0, 0, 0, 2, 8, 2]]))), { anim: 'blaze', skin: s => { const H = furBox(s, 0, 0, 8, 8, 8, 0xf0b020, 0.12); s.speckle(H.front[0], H.front[1], 8, 8, [0xf0b020, 0xe89010, 0xffd84a]); s.fill(H.front[0] + 1, H.front[1] + 3, 2, 1, 0x3a1a0a, 0); s.fill(H.front[0] + 5, H.front[1] + 3, 2, 1, 0x3a1a0a, 0); s.fill(H.front[0] + 2, H.front[1] + 6, 4, 1, 0x6a2a0a, 0); furBox(s, 0, 16, 2, 8, 2, 0xf0a020, 0.12); } });
  const piglinParts = () => humanoidParts({ tall64: true }).map(p => {
    if (p.n === 'head') { p.b = [[0, 0, -5, -8, -4, 10, 8, 8], [31, 1, -2, -4, -5, 4, 4, 1], [2, 4, 2, -2, -5, 1, 2, 1], [2, 0, -3, -2, -5, 1, 2, 1]]; p.c = [P('left_ear', [4.5, -6, 0], [0, 0, -PI / 6], [[51, 6, 0, 0, -2, 1, 5, 4]]), P('right_ear', [-4.5, -6, 0], [0, 0, PI / 6], [[39, 6, -1, 0, -2, 1, 5, 4]])]; }
    return p;
  });
  const piglinSkin = (skin, cloth, o) => s => {
    o = o || {};
    const H = furBox(s, 0, 0, 10, 8, 8, skin, 0.07); const fx = H.front[0], fy = H.front[1];
    s.px(fx + 2, fy + 3, 0xffffff); s.px(fx + 3, fy + 3, 0x2a1a10); s.px(fx + 6, fy + 3, 0x2a1a10); s.px(fx + 7, fy + 3, 0xffffff);
    const N = furBox(s, 31, 1, 4, 4, 1, sc(skin, 0.9), 0.04); s.px(N.front[0] + 1, N.front[1] + 2, 0x5a2a20); s.px(N.front[0] + 2, N.front[1] + 2, 0x5a2a20);
    furBox(s, 2, 4, 1, 2, 1, 0xf0e8d8, 0); furBox(s, 2, 0, 1, 2, 1, 0xf0e8d8, 0); furBox(s, 51, 6, 1, 5, 4, skin); furBox(s, 39, 6, 1, 5, 4, skin);
    const B = furBox(s, 16, 16, 8, 12, 4, cloth, 0.08); s.fill(B.front[0], B.front[1] + 10, 8, 2, 0xc8a020, 0.05);
    furBox(s, 40, 16, 4, 12, 4, skin, 0.07); furBox(s, 32, 48, 4, 12, 4, skin, 0.07); furBox(s, 0, 16, 4, 12, 4, o.legs || 0x5a3a20, 0.07); furBox(s, 16, 48, 4, 12, 4, o.legs || 0x5a3a20, 0.07);
    if (o.extra) o.extra(s);
  };
  def('piglin', 64, 64, piglinParts(), { anim: 'piglin', skin: piglinSkin(0xe8a090, 0x7a4a2a) });
  def('piglin_brute', 64, 64, piglinParts(), { anim: 'piglin', skin: piglinSkin(0xd89080, 0x3a3a3a, { legs: 0x2a2a2a }) });
  def('zombified_piglin', 64, 64, piglinParts(), { anim: 'zombie', skin: piglinSkin(0xd8889a, 0x6a4a3a, { extra: s => { const H = s.faces(0, 0, 10, 8, 8); s.fill(H.left[0], H.left[1] + 2, 4, 5, 0x5a9a4a, 0.08); const A2 = s.faces(40, 16, 4, 12, 4); s.fill(A2.front[0], A2.front[1] + 6, 4, 6, 0xe0d8c8, 0.05); } }) });
  const hoglinParts = () => [
    P('body', [0, 7, 0], 0, [[1, 1, -8, -7, -13, 16, 14, 26]], [P('mane', [0, -14, -5], 0, [[90, 33, 0, 0, -9, 0, 10, 19, 0.001]])]),
    P('head', [0, 2, -12], [0.8727, 0, 0], [[61, 1, -7, -3, -19, 14, 6, 19]], [
      P('right_ear', [-6, -2, -3], [0, 0, -0.6981], [[1, 1, -6, -1, -2, 6, 1, 4]]), P('left_ear', [6, -2, -3], [0, 0, 0.6981], [[1, 6, 0, -1, -2, 6, 1, 4]]),
      P('right_horn', [-7, 2, -12], 0, [[10, 13, -1, -11, -1, 2, 11, 2]]), P('left_horn', [7, 2, -12], 0, [[1, 13, -1, -11, -1, 2, 11, 2]])]),
    P('right_front_leg', [-4, 10, -8.5], 0, [[66, 42, -3, 0, -3, 6, 14, 6]]), P('left_front_leg', [4, 10, -8.5], 0, [[41, 42, -3, 0, -3, 6, 14, 6]]),
    P('right_hind_leg', [-5, 13, 10], 0, [[21, 45, -2.5, 0, -2.5, 5, 11, 5]]), P('left_hind_leg', [5, 13, 10], 0, [[0, 45, -2.5, 0, -2.5, 5, 11, 5]]),
  ];
  const hoglinSkin = (c, d) => s => { furBox(s, 1, 1, 16, 14, 26, c, 0.09); s.fill(90, 33, 38, 29, d, 0.1); const H = furBox(s, 61, 1, 14, 6, 19, c, 0.08); s.fill(H.front[0] + 3, H.front[1] + 2, 8, 3, sc(c, 1.15), 0.05); s.px(H.left[0] + 15, H.left[1] + 1, 0x111111); s.px(H.right[0] + 3, H.right[1] + 1, 0x111111); furBox(s, 1, 1, 6, 1, 4, c); furBox(s, 1, 6, 6, 1, 4, c); furBox(s, 10, 13, 2, 11, 2, 0xe8dcc0, 0.04); furBox(s, 1, 13, 2, 11, 2, 0xe8dcc0, 0.04); furBox(s, 66, 42, 6, 14, 6, c); furBox(s, 41, 42, 6, 14, 6, c); furBox(s, 21, 45, 5, 11, 5, c); furBox(s, 0, 45, 5, 11, 5, c); };
  def('hoglin', 128, 64, hoglinParts(), { anim: 'hoglin', skin: hoglinSkin(0xc07a5a, 0x8a4a2a) });
  def('zoglin', 128, 64, hoglinParts(), { anim: 'hoglin', skin: hoglinSkin(0xd89a9a, 0x5a8a4a) });
  def('strider', 64, 128, [
    P('body', [0, 1, 0], 0, [[0, 0, -8, -6, -8, 16, 14, 16]], [
      P('right_bottom_bristle', [-8, 4, -8], [0, 0, 1.2217305], [[16, 65, -12, 0, 0, 12, 0, 16, 0, true]]), P('right_middle_bristle', [-8, -1, -8], [0, 0, 1.134464], [[16, 49, -12, 0, 0, 12, 0, 16, 0, true]]), P('right_top_bristle', [-8, -5, -8], [0, 0, 0.87266463], [[16, 33, -12, 0, 0, 12, 0, 16, 0, true]]),
      P('left_top_bristle', [8, -6, -8], [0, 0, -0.87266463], [[16, 33, 0, 0, 0, 12, 0, 16]]), P('left_middle_bristle', [8, -2, -8], [0, 0, -1.134464], [[16, 49, 0, 0, 0, 12, 0, 16]]), P('left_bottom_bristle', [8, 3, -8], [0, 0, -1.2217305], [[16, 65, 0, 0, 0, 12, 0, 16]])]),
    P('right_leg', [-4, 8, 0], 0, [[0, 32, -2, 0, -2, 4, 16, 4]]), P('left_leg', [4, 8, 0], 0, [[0, 55, -2, 0, -2, 4, 16, 4]]),
  ], { anim: 'strider', skin: s => { const c = 0xa83a3a; const B = furBox(s, 0, 0, 16, 14, 16, c, 0.1); s.fill(B.front[0] + 3, B.front[1] + 5, 3, 2, 0xffffff, 0); s.fill(B.front[0] + 10, B.front[1] + 5, 3, 2, 0xffffff, 0); s.px(B.front[0] + 4, B.front[1] + 6, 0x111111); s.px(B.front[0] + 11, B.front[1] + 6, 0x111111); s.fill(B.front[0] + 4, B.front[1] + 10, 8, 1, 0x3a0a0a, 0); s.fill(16, 33, 32, 48, 0xd08a5a, 0.1); furBox(s, 0, 32, 4, 16, 4, 0x8a8a9a, 0.1); furBox(s, 0, 55, 4, 16, 4, 0x8a8a9a, 0.1); } });
  // ---------------------------------------------------------------- illagers, ravagers and vexes
  const illagerParts = () => villagerParts({ rim: false }).concat([P('right_arm', [-5, 2, 0], 0, [[40, 46, -3, -2, -2, 4, 12, 4]]), P('left_arm', [5, 2, 0], 0, [[40, 46, -1, -2, -2, 4, 12, 4, 0, true]])]);
  const illagerSkin = (robe, o) => s => {
    o = o || {}; const skin = 0x9a9a8a;
    const F = s.box(0, 0, 8, 10, 8, skin, 0.05); const fx = F.front[0], fy = F.front[1];
    s.fill(fx, fy + 3, 8, 1, 0x2a2a2a, 0); s.px(fx + 1, fy + 4, 0xffffff); s.px(fx + 2, fy + 4, 0x2a6a4a); s.px(fx + 5, fy + 4, 0x2a6a4a); s.px(fx + 6, fy + 4, 0xffffff); s.fill(F.top[0], F.top[1], 8, 8, o.hair || 0x2a2a2a, 0.06);
    s.box(24, 0, 2, 4, 2, sc(skin, 0.92), 0.04);
    s.box(16, 20, 8, 12, 6, robe, 0.07); s.box(0, 38, 8, 20, 6, robe, 0.08); const J = s.faces(0, 38, 8, 20, 6); s.fill(J.front[0], J.front[1] + 6, 8, 1, o.belt || 0x3a2a1a, 0);
    s.box(44, 22, 4, 8, 4, robe, 0.07); s.box(40, 38, 8, 4, 4, robe, 0.07); s.box(40, 46, 4, 12, 4, robe, 0.07); const A2 = s.faces(40, 46, 4, 12, 4); for (const k of ['front', 'back', 'left', 'right']) s.fill(A2[k][0], A2[k][1] + 9, A2[k][2], 3, skin, 0.04);
    s.box(0, 22, 4, 12, 4, o.legs || 0x2a2a3a, 0.07);
  };
  def('pillager', 64, 64, illagerParts(), { anim: 'illager', scale: 0.9375, skin: illagerSkin(0x3a4a3a, { legs: 0x3a3a3a }) });
  def('vindicator', 64, 64, illagerParts(), { anim: 'illager', scale: 0.9375, skin: illagerSkin(0x2a3a4a, { belt: 0x6a5a3a }) });
  def('evoker', 64, 64, illagerParts(), { anim: 'illager', scale: 0.9375, skin: illagerSkin(0x1a1a1a, { belt: 0xc8a020, legs: 0x1a1a1a }) });
  def('illusioner', 64, 64, illagerParts(), { anim: 'illager', scale: 0.9375, skin: illagerSkin(0x1a3a8a) });
  def('vex', 32, 32, [
    P('head', [0, 0, 0], 0, [[0, 0, -2.5, -5, -2.5, 5, 5, 5]]), P('body', [0, 0, 0], 0, [[0, 10, -1.5, 0, -1, 3, 4, 2], [0, 16, -1.5, 1, -1, 3, 5, 2, -0.2]]),
    P('right_arm', [-1.75, 0.25, 0], 0, [[23, 0, -1.25, -0.5, -1, 2, 4, 2, -0.1]]), P('left_arm', [1.75, 0.25, 0], 0, [[23, 6, -0.75, -0.5, -1, 2, 4, 2, -0.1]]),
    P('right_leg', [-1, 4, 0], 0, [[0, 0, 0, 0, 0, 0, 0, 0]]), P('left_leg', [1, 4, 0], 0, [[0, 0, 0, 0, 0, 0, 0, 0]]),
    P('left_wing', [0.5, 1, 1], 0, [[16, 14, 0, 0, 0, 0, 5, 8]], [], true), P('right_wing', [-0.5, 1, 1], 0, [[16, 14, 0, 0, 0, 0, 5, 8, 0, true]], [], true),
  ], { anim: 'vex', scale: 0.8, skin: s => { const c = 0x8aa8c8; const H = furBox(s, 0, 0, 5, 5, 5, c, 0.06); s.fill(H.front[0] + 1, H.front[1] + 2, 1, 1, 0xff3a3a, 0); s.fill(H.front[0] + 3, H.front[1] + 2, 1, 1, 0xff3a3a, 0); furBox(s, 0, 10, 3, 4, 2, c); furBox(s, 0, 16, 3, 5, 2, c); furBox(s, 23, 0, 2, 4, 2, c); furBox(s, 23, 6, 2, 4, 2, c); s.fill(16, 14, 16, 13, 0xd8e8f8, 0); } });
  def('ravager', 128, 128, [
    P('neck', [0, -7, 5.5], 0, [[68, 73, -5, -1, -18, 10, 10, 18]], [
      P('head', [0, 16, -17], 0, [[0, 0, -8, -20, -14, 16, 20, 16], [0, 0, -2, -6, -18, 4, 8, 4]], [
        P('right_horn', [-10, -14, -8], [1.0995574, 0, 0], [[74, 55, 0, -14, -2, 2, 14, 4]]), P('left_horn', [8, -14, -8], [1.0995574, 0, 0], [[74, 55, 0, -14, -2, 2, 14, 4, 0, true]]),
        P('mouth', [0, -2, 2], 0, [[0, 36, -8, 0, -16, 16, 3, 16]])])]),
    P('body', [0, 1, 2], [PI / 2, 0, 0], [[0, 55, -7, -10, -7, 14, 16, 20], [0, 91, -6, 6, -7, 12, 13, 18]]),
    P('right_hind_leg', [-8, -13, 18], 0, [[96, 0, -4, 0, -4, 8, 37, 8]]), P('left_hind_leg', [8, -13, 18], 0, [[96, 0, -4, 0, -4, 8, 37, 8, 0, true]]),
    P('right_front_leg', [-8, -13, -5], 0, [[64, 0, -4, 0, -4, 8, 37, 8]]), P('left_front_leg', [8, -13, -5], 0, [[64, 0, -4, 0, -4, 8, 37, 8, 0, true]]),
  ], { anim: 'ravager', skin: s => { const c = 0x5a5a5a, d = 0x3a3a3a; furBox(s, 68, 73, 10, 10, 18, c); const H = furBox(s, 0, 0, 16, 20, 16, c, 0.07); s.fill(H.front[0] + 3, H.front[1] + 6, 3, 2, 0xffffff, 0); s.fill(H.front[0] + 10, H.front[1] + 6, 3, 2, 0xffffff, 0); s.px(H.front[0] + 4, H.front[1] + 7, 0x111111); s.px(H.front[0] + 11, H.front[1] + 7, 0x111111); furBox(s, 74, 55, 2, 14, 4, 0xc8b898, 0.05); furBox(s, 0, 36, 16, 3, 16, d); furBox(s, 0, 55, 14, 16, 20, c, 0.08); furBox(s, 0, 91, 12, 13, 18, d, 0.08); furBox(s, 96, 0, 8, 37, 8, c, 0.08); furBox(s, 64, 0, 8, 37, 8, c, 0.08); } });
  // ---------------------------------------------------------------- guardians, shulkers, phantoms, silverfish, endermites
  const guardianParts = () => {
    const SX = [1.75, 1.75, 1.75, 1.75, 0, 0, 0, 0, 0, 0, -1.75, -1.75], SY = [0, 0, 0, 0, 1.75, 1.75, -1.75, -1.75, 1.75, -1.75, 0, 0], SZ = [1.75, -1.75, -1.75, 1.75, 1.75, -1.75, 1.75, -1.75, 0, 0, 1.75, -1.75];
    const spikes = []; for (let i = 0; i < 12; i++) spikes.push(P('spike' + i, [SX[i] * 4.5 * 1, 16 + SY[i] * 4.5, SZ[i] * 4.5], [[1.75, 1.75, 1.75, 1.75, 0, 0, 0, 0, 0, 0, 1.75, 1.75][i] * 0 + [0.7854, 0.7854, -0.7854, -0.7854, 0, 0, 0, 0, 1.5708, 1.5708, 0.7854, -0.7854][i], 0, [0, 0, 0, 0, 0.7854, -0.7854, 0.7854, -0.7854, 0, 0, 0, 0][i]], [[0, 0, -1, -4.5, -1, 2, 9, 2]]));
    return [P('head', [0, 0, 0], 0, [[0, 0, -6, 10, -8, 12, 12, 16], [0, 28, -8, 10, -6, 2, 12, 12], [0, 28, 6, 10, -6, 2, 12, 12, 0, true], [16, 40, -6, 8, -6, 12, 2, 12], [16, 40, -6, 22, -6, 12, 2, 12]], [P('eye', [0, 0, -8.25], 0, [[8, 0, -1, 15, 0, 2, 2, 1]])].concat(spikes)),
      P('tail0', [0, 0, 0], 0, [[40, 0, -2, 14, 7, 4, 4, 8]], [P('tail1', [-1.5, 0.5, 14], 0, [[0, 54, 0, 14, 0, 3, 3, 7]], [P('tail2', [0.5, 1, 6], 0, [[41, 32, 0, 14, 0, 2, 2, 6], [25, 19, 1, 10.5, 3, 1, 9, 9]])])])];
  };
  const guardianSkin = (c, d) => s => { const H = furBox(s, 0, 0, 12, 12, 16, c, 0.08); s.speckle(H.top[0], H.top[1], 12, 16, [c, d, c, 0xd08a5a]); furBox(s, 0, 28, 2, 12, 12, c); furBox(s, 16, 40, 12, 2, 12, d); furBox(s, 8, 0, 2, 2, 1, 0xf0e0c0, 0); furBox(s, 40, 0, 4, 4, 8, c); furBox(s, 0, 54, 3, 3, 7, c); furBox(s, 41, 32, 2, 2, 6, c); furBox(s, 25, 19, 1, 9, 9, 0xd08a5a, 0.05); s.fill(0, 0, 8, 11, 0xe8d8a8, 0.05); s.fill(0, 0, 2, 2, 0xe8d8a8, 0); };
  def('guardian', 64, 64, guardianParts(), { anim: 'guardian', skin: guardianSkin(0x5a9a8a, 0x3a6a6a) });
  def('elder_guardian', 64, 64, guardianParts(), { anim: 'guardian', scale: 2.35, skin: guardianSkin(0xc8c8b0, 0x8a8a7a) });
  def('shulker', 64, 64, [P('lid', [0, 24, 0], 0, [[0, 0, -8, -16, -8, 16, 12, 16]]), P('base', [0, 24, 0], 0, [[0, 28, -8, -8, -8, 16, 8, 16]]), P('head', [0, 12, 0], 0, [[0, 52, -3, 0, -3, 6, 6, 6]])], { anim: 'shulker', skin: s => { const c = 0x9a6a9a; furBox(s, 0, 0, 16, 12, 16, c, 0.06); furBox(s, 0, 28, 16, 8, 16, sc(c, 0.85), 0.06); const H = furBox(s, 0, 52, 6, 6, 6, 0xd8d0a0, 0.05); s.px(H.front[0] + 1, H.front[1] + 2, 0x111111); s.px(H.front[0] + 4, H.front[1] + 2, 0x111111); } });
  def('phantom', 64, 64, [
    P('body', [0, 0, 0], [-0.1, 0, 0], [[0, 8, -3, -2, -8, 5, 3, 9]], [
      P('tail_base', [0, -2, 1], 0, [[3, 20, -2, 0, 0, 3, 2, 6]], [P('tail_tip', [0, 0.5, 6], 0, [[4, 29, -1, 0, 0, 1, 1, 6]])]),
      P('left_wing_base', [2, -2, -8], [0, 0, 0.1], [[23, 12, 0, 0, 0, 6, 2, 9]], [P('left_wing_tip', [6, 0, 0], [0, 0, 0.1], [[16, 24, 0, 0, 0, 13, 1, 9]])]),
      P('right_wing_base', [-3, -2, -8], [0, 0, -0.1], [[23, 12, -6, 0, 0, 6, 2, 9, 0, true]], [P('right_wing_tip', [-6, 0, 0], [0, 0, -0.1], [[16, 24, -13, 0, 0, 13, 1, 9, 0, true]])]),
      P('head', [0, 1, -7], [0.2, 0, 0], [[0, 0, -4, -2, -5, 7, 3, 5]])]),
  ], { anim: 'phantom', skin: s => { const c = 0x3a4a7a; furBox(s, 0, 8, 5, 3, 9, c, 0.08); furBox(s, 3, 20, 3, 2, 6, c); furBox(s, 4, 29, 1, 1, 6, c); furBox(s, 23, 12, 6, 2, 9, c, 0.08); const W = furBox(s, 16, 24, 13, 1, 9, 0x8a9ab8, 0.08); void W; const H = furBox(s, 0, 0, 7, 3, 5, c, 0.06); s.px(H.front[0] + 1, H.front[1] + 1, 0x40ff40); s.px(H.front[0] + 5, H.front[1] + 1, 0x40ff40); } });
  const segs = (sizes, uv, fur) => sizes.map((sz, i) => { let z = -3.5; for (let k = 0; k < i; k++) z += (sizes[k][2] + sizes[k + 1][2]) * 0.5; return P('segment' + i, [0, 24 - sz[1], z], 0, [[uv[i][0], uv[i][1], -sz[0] * 0.5, 0, -sz[2] * 0.5, sz[0], sz[1], sz[2]]]); }).concat(fur || []);
  const SF = [[3, 2, 2], [4, 3, 2], [6, 4, 3], [3, 3, 3], [2, 2, 3], [2, 1, 2], [1, 1, 2]], SFU = [[0, 0], [0, 4], [0, 9], [0, 16], [0, 22], [11, 0], [13, 4]];
  def('silverfish', 64, 32, segs(SF, SFU, [P('layer0', [0, 16, 0.5], 0, [[20, 0, -5, 0, -1.5, 10, 8, 3]]), P('layer1', [0, 20, 4], 0, [[20, 11, -3, 0, -1.5, 6, 4, 3]]), P('layer2', [0, 19, -1], 0, [[20, 18, -3, 0, -1.5, 6, 5, 2]])]), { anim: 'silverfish', skin: s => { const c = 0x8a8a8a; SF.forEach((sz, i) => furBox(s, SFU[i][0], SFU[i][1], sz[0], sz[1], sz[2], c, 0.1)); furBox(s, 20, 0, 10, 8, 3, 0x6a6a6a, 0.1); furBox(s, 20, 11, 6, 4, 3, 0x6a6a6a, 0.1); furBox(s, 20, 18, 6, 5, 2, 0x6a6a6a, 0.1); } });
  const EM = [[4, 3, 2], [6, 4, 5], [3, 3, 1], [1, 2, 1]], EMU = [[0, 0], [0, 5], [0, 14], [0, 18]];
  def('endermite', 64, 32, segs(EM, EMU), { anim: 'endermite', skin: s => { const c = 0x3a2a4a; EM.forEach((sz, i) => { const F = furBox(s, EMU[i][0], EMU[i][1], sz[0], sz[1], sz[2], c, 0.1); s.speckle(F.top[0], F.top[1], sz[0], sz[2], [c, 0x6a3a8a, c]); }); } });
  // ---------------------------------------------------------------- frog, tadpole, axolotl, allay, camel, armadillo, sniffer, warden, breeze
  def('frog', 48, 48, [
    P('body', [0, 24, 0], 0, [[3, 1, -3.5, -2, -8, 7, 3, 9], [23, 22, -3.5, -1, -8, 7, 0, 9]], [
      P('head', [0, -2, -1], 0, [[23, 13, -3.5, -1, -7, 7, 0, 9], [0, 13, -3.5, -2, -7, 7, 3, 9]], [P('eyes', [-0.5, 0, 2], 0, [[0, 0, -2.5, -3, -5.5, 3, 2, 3], [0, 5, 2.5, -3, -5.5, 3, 2, 3]]), P('croak', [0, -1, -5], 0, [[26, 5, -3.5, -0.1, -2.9, 7, 2, 3, -0.1]])]),
      P('left_arm', [4, -1, -6.5], 0, [[0, 32, -1, 0, -1, 2, 3, 3], [18, 40, -4, 3.01, -5, 8, 0, 8]]), P('right_arm', [-4, -1, -6.5], 0, [[0, 38, -1, 0, -1, 2, 3, 3], [2, 40, -4, 3.01, -5, 8, 0, 8]])]),
    P('left_leg', [3.5, 22, 4], 0, [[14, 25, -1, 0, -2, 3, 3, 4], [2, 32, -2, 2.01, -4, 8, 0, 8]]), P('right_leg', [-3.5, 22, 4], 0, [[0, 25, -2, 0, -2, 3, 3, 4], [18, 32, -6, 2.01, -4, 8, 0, 8]]),
  ], { anim: 'frog', skin: s => { const c = 0xc87a3a; furBox(s, 3, 1, 7, 3, 9, c, 0.08); furBox(s, 0, 13, 7, 3, 9, c, 0.08); s.fill(23, 13, 16, 9, 0xe8c08a, 0.05); s.fill(23, 22, 16, 9, 0xe8c08a, 0.05); const E = furBox(s, 0, 0, 3, 2, 3, c); s.px(E.front[0] + 1, E.front[1], 0x111111); const E2 = furBox(s, 0, 5, 3, 2, 3, c); s.px(E2.front[0] + 1, E2.front[1], 0x111111); furBox(s, 26, 5, 7, 2, 3, 0xe8a8a8, 0.04); furBox(s, 0, 32, 2, 3, 3, c); furBox(s, 0, 38, 2, 3, 3, c); furBox(s, 14, 25, 3, 3, 4, c); furBox(s, 0, 25, 3, 3, 4, c); s.fill(2, 32, 24, 16, sc(c, 0.9), 0.06); } });
  def('tadpole', 16, 16, [P('body', [0, 22, -3], 0, [[0, 0, -1.5, -1, 0, 3, 2, 3]]), P('tail', [0, 22, 0], 0, [[0, 0, 0, -1, 0, 0, 2, 7]])], { anim: 'tadpole', skin: s => { furBox(s, 0, 0, 3, 2, 3, 0x5a4a3a, 0.08); s.fill(0, 0, 16, 9, 0x4a3a2a, 0.08); } });
  def('axolotl', 64, 64, [
    P('body', [0, 20, 5], 0, [[0, 11, -4, -2, -9, 8, 4, 10], [2, 17, 0, -3, -8, 0, 5, 9]], [
      P('head', [0, 0, -9], 0, [[0, 1, -4, -3, -5, 8, 5, 5]], [P('top_gills', [0, -3, -1], 0, [[3, 37, -4, -3, 0, 8, 3, 0]]), P('left_gills', [-4, 0, -1], 0, [[0, 40, -3, -5, 0, 3, 7, 0]]), P('right_gills', [4, 0, -1], 0, [[11, 40, 0, -5, 0, 3, 7, 0]])]),
      P('right_hind_leg', [-3.5, 1, -1], 0, [[2, 13, -1, 0, 0, 3, 5, 0]]), P('left_hind_leg', [3.5, 1, -1], 0, [[2, 13, -2, 0, 0, 3, 5, 0]]),
      P('right_front_leg', [-3.5, 1, -8], 0, [[2, 13, -1, 0, 0, 3, 5, 0]]), P('left_front_leg', [3.5, 1, -8], 0, [[2, 13, -2, 0, 0, 3, 5, 0]]),
      P('tail', [0, 0, 1], 0, [[2, 19, 0, -3, 0, 0, 5, 12]])]),
  ], { anim: 'axolotl', skin: s => { const c = 0xf0a0c0, d = 0xd04a8a; furBox(s, 0, 11, 8, 4, 10, c, 0.06); s.fill(2, 17, 18, 5, d, 0.05); const H = furBox(s, 0, 1, 8, 5, 5, c, 0.05); s.px(H.front[0] + 1, H.front[1] + 1, 0x111111); s.px(H.front[0] + 6, H.front[1] + 1, 0x111111); s.fill(3, 37, 8, 3, d, 0); s.fill(0, 40, 14, 7, d, 0.05); s.fill(2, 13, 6, 5, c, 0.05); s.fill(2, 19, 24, 5, c, 0.05); } });
  def('allay', 32, 32, [
    P('head', [0, 0, 0], 0, [[0, 0, -2.5, -5, -2.5, 5, 5, 5]]), P('body', [0, 0, 0], 0, [[0, 10, -1.5, 0, -1, 3, 4, 2], [0, 16, -1.5, 0, -1, 3, 5, 2, -0.2]]),
    P('right_arm', [-1.75, 0.5, 0], 0, [[23, 0, -0.75, -0.5, -1, 1, 4, 2, -0.01]]), P('left_arm', [1.75, 0.5, 0], 0, [[23, 6, -0.25, -0.5, -1, 1, 4, 2, -0.01]]),
    P('right_wing', [-0.5, 0, 0.6], 0, [[16, 14, 0, 1, 0, 0, 5, 8]], [], true), P('left_wing', [0.5, 0, 0.6], 0, [[16, 14, 0, 1, 0, 0, 5, 8]], [], true),
  ], { anim: 'allay', skin: s => { const c = 0x5ac8f0; const H = furBox(s, 0, 0, 5, 5, 5, c, 0.06); s.px(H.front[0] + 1, H.front[1] + 2, 0x0a2a5a); s.px(H.front[0] + 3, H.front[1] + 2, 0x0a2a5a); furBox(s, 0, 10, 3, 4, 2, c); furBox(s, 0, 16, 3, 5, 2, c); furBox(s, 23, 0, 1, 4, 2, c); furBox(s, 23, 6, 1, 4, 2, c); s.fill(16, 14, 16, 13, 0xd8f8ff, 0); } });
  def('camel', 128, 128, [
    P('body', [0, 4, 9.5], 0, [[0, 25, -7.5, -12, -23.5, 15, 12, 27]], [P('hump', [0, -12, -10], 0, [[74, 0, -4.5, -5, -5.5, 9, 5, 11]]), P('tail', [0, -9, 3.5], 0, [[122, 0, -1.5, 0, 0, 3, 14, 0]]),
      P('head', [0, -3, -19.5], 0, [[60, 24, -3.5, -7, -15, 7, 8, 19], [21, 0, -3.5, -21, -15, 7, 14, 7], [50, 0, -2.5, -21, -21, 5, 5, 6]], [P('left_ear', [2.5, -21, -9.5], 0, [[45, 0, -0.5, 0.5, -1, 3, 1, 2]]), P('right_ear', [-2.5, -21, -9.5], 0, [[67, 0, -2.5, 0.5, -1, 3, 1, 2]])])]),
    P('left_hind_leg', [4.9, 1, 9.5], 0, [[58, 16, -2.5, 2, -2.5, 5, 21, 5]]), P('right_hind_leg', [-4.9, 1, 9.5], 0, [[94, 16, -2.5, 2, -2.5, 5, 21, 5]]),
    P('left_front_leg', [4.9, 1, -10.5], 0, [[0, 0, -2.5, 2, -2.5, 5, 21, 5]]), P('right_front_leg', [-4.9, 1, -10.5], 0, [[0, 26, -2.5, 2, -2.5, 5, 21, 5]]),
  ], { anim: 'camel', skin: s => { const c = 0xd8a868; furBox(s, 0, 25, 15, 12, 27, c, 0.07); furBox(s, 74, 0, 9, 5, 11, sc(c, 0.9), 0.07); s.fill(122, 0, 3, 14, c, 0.05); furBox(s, 60, 24, 7, 8, 19, c, 0.07); const H = furBox(s, 21, 0, 7, 14, 7, c, 0.07); s.px(H.left[0] + 2, H.left[1] + 3, 0x111111); s.px(H.right[0] + 4, H.right[1] + 3, 0x111111); furBox(s, 50, 0, 5, 5, 6, sc(c, 1.1), 0.05); furBox(s, 45, 0, 3, 1, 2, c); furBox(s, 67, 0, 3, 1, 2, c); for (const [u, v] of [[58, 16], [94, 16], [0, 0], [0, 26]]) furBox(s, u, v, 5, 21, 5, c, 0.07); } });
  def('armadillo', 64, 64, [
    P('body', [0, 21, 4], 0, [[0, 20, -4, -7, -10, 8, 8, 12], [0, 40, -4, -7, -10, 8, 8, 12, 0.3]], [P('tail', [0, -3, 1], [0.5061, 0, 0], [[44, 53, -0.5, -0.0865, 0.0933, 1, 6, 1]]), P('head', [0, -2, -11], [-0.3927, 0, 0], [[43, 15, -1.5, -1, -1, 3, 5, 2]], [P('right_ear', [-1, -1, 0], [-0.2617, -0.5236, -0.4363], [[43, 10, -2, -3, 0, 2, 5, 0]]), P('left_ear', [1, -2, 0], [-0.2617, 0.5236, 0.4363], [[47, 10, 0, -3, 0, 2, 5, 0]])])]),
    P('right_hind_leg', [-2, 21, 4], 0, [[51, 31, -1, 0, -1, 2, 3, 2]]), P('left_hind_leg', [2, 21, 4], 0, [[42, 31, -1, 0, -1, 2, 3, 2]]),
    P('right_front_leg', [-2, 21, -4], 0, [[51, 43, -1, 0, -1, 2, 3, 2]]), P('left_front_leg', [2, 21, -4], 0, [[42, 43, -1, 0, -1, 2, 3, 2]]),
    P('cube', [0, 24, 0], 0, [[0, 0, -5, -10, -6, 10, 10, 10]]),
  ], { anim: 'armadillo', skin: s => { const c = 0xb07a6a, sh = 0x8a5a4a; furBox(s, 0, 20, 8, 8, 12, c, 0.08); const B = furBox(s, 0, 40, 8, 8, 12, sh, 0.1); for (let i = 0; i < 12; i += 3) s.fill(B.top[0], B.top[1] + i, 8, 1, sc(sh, 0.8), 0); furBox(s, 44, 53, 1, 6, 1, c); const H = furBox(s, 43, 15, 3, 5, 2, 0xd8a090, 0.05); s.px(H.front[0], H.front[1] + 1, 0x111111); s.px(H.front[0] + 2, H.front[1] + 1, 0x111111); s.fill(43, 10, 6, 5, 0xd8a090, 0); for (const [u, v] of [[51, 31], [42, 31], [51, 43], [42, 43]]) furBox(s, u, v, 2, 3, 2, 0x6a4a3a); furBox(s, 0, 0, 10, 10, 10, sh, 0.1); } });
  def('sniffer', 192, 192, [
    P('body', [0, 5, 0], 0, [[62, 68, -12.5, -14, -20, 25, 29, 40], [62, 0, -12.5, -14, -20, 25, 24, 40, 0.5], [87, 68, -12.5, 12, -20, 25, 0, 40]], [
      P('head', [0, 6.5, -19.48], 0, [[8, 15, -6.5, -7.5, -11.5, 13, 18, 11], [8, 4, -6.5, 7.5, -11.5, 13, 0, 11]], [P('nose', [0, -4.5, -11.5], 0, [[10, 45, -6.5, -2, -9, 13, 2, 9]]), P('lower_beak', [0, 2.5, -11.5], 0, [[10, 57, -6.5, -7, -8, 13, 12, 9]]), P('left_ear', [6.51, -7.5, -4.51], 0, [[2, 0, 0, 0, -3, 1, 19, 7]]), P('right_ear', [-6.51, -7.5, -4.51], 0, [[48, 0, -1, 0, -3, 1, 19, 7]])])]),
    P('right_front_leg', [-7.5, 10, -15], 0, [[32, 87, -3.5, -1, -4, 7, 10, 8]]), P('left_front_leg', [7.5, 10, -15], 0, [[0, 87, -3.5, -1, -4, 7, 10, 8]]),
    P('right_mid_leg', [-7.5, 10, 0], 0, [[32, 105, -3.5, -1, -4, 7, 10, 8]]), P('left_mid_leg', [7.5, 10, 0], 0, [[0, 105, -3.5, -1, -4, 7, 10, 8]]),
    P('right_hind_leg', [-7.5, 10, 15], 0, [[32, 123, -3.5, -1, -4, 7, 10, 8]]), P('left_hind_leg', [7.5, 10, 15], 0, [[0, 123, -3.5, -1, -4, 7, 10, 8]]),
  ], { anim: 'sniffer', skin: s => { const r = 0x9a3a2a, g = 0x3a7a4a; furBox(s, 62, 68, 25, 29, 40, r, 0.08); furBox(s, 62, 0, 25, 24, 40, g, 0.1); const H = furBox(s, 8, 15, 13, 18, 11, r, 0.07); s.px(H.left[0] + 3, H.left[1] + 5, 0x111111); s.px(H.right[0] + 7, H.right[1] + 5, 0x111111); furBox(s, 10, 45, 13, 2, 9, 0xe8c050); furBox(s, 10, 57, 13, 12, 9, 0xd8a840, 0.06); furBox(s, 2, 0, 1, 19, 7, g); furBox(s, 48, 0, 1, 19, 7, g); for (const [u, v] of [[32, 87], [0, 87], [32, 105], [0, 105], [32, 123], [0, 123]]) furBox(s, u, v, 7, 10, 8, r, 0.07); } });
  def('warden', 128, 128, [
    P('body', [0, -21, 0], 0, [[0, 0, -9, -13, -4, 18, 21, 11]], [
      P('right_ribcage', [-7, -2, -4], 0, [[90, 11, -2, -11, -0.1, 9, 21, 0]]), P('left_ribcage', [7, -2, -4], 0, [[90, 11, -7, -11, -0.1, 9, 21, 0, 0, true]]),
      P('head', [0, -13, 0], 0, [[0, 32, -8, -16, -5, 16, 16, 10]], [P('right_tendril', [-8, -12, 0], 0, [[52, 32, -16, -13, 0, 16, 16, 0]]), P('left_tendril', [8, -12, 0], 0, [[58, 0, 0, -13, 0, 16, 16, 0]])]),
      P('right_arm', [-13, -13, 1], 0, [[44, 50, -4, 0, -4, 8, 28, 8]]), P('left_arm', [13, -13, 1], 0, [[0, 58, -4, 0, -4, 8, 28, 8]])]),
    P('right_leg', [-5.9, -11, 0], 0, [[76, 48, -3.1, 0, -3, 6, 13, 6]]), P('left_leg', [5.9, -11, 0], 0, [[76, 76, -2.9, 0, -3, 6, 13, 6]]),
  ], { anim: 'warden', skin: s => { const c = 0x0a3a4a, l = 0x2ad0c0; const B = furBox(s, 0, 0, 18, 21, 11, c, 0.1); s.fill(B.front[0] + 6, B.front[1] + 6, 6, 6, l, 0.15); s.fill(90, 11, 18, 21, 0x8ad0c8, 0.1); const H = furBox(s, 0, 32, 16, 16, 10, c, 0.1); s.fill(H.front[0] + 3, H.front[1] + 6, 10, 1, 0x061a20, 0); s.fill(52, 32, 22, 16, 0x1a6a7a, 0.1); s.fill(58, 0, 16, 16, 0x1a6a7a, 0.1); furBox(s, 44, 50, 8, 28, 8, c, 0.1); furBox(s, 0, 58, 8, 28, 8, c, 0.1); furBox(s, 76, 48, 6, 13, 6, c, 0.1); furBox(s, 76, 76, 6, 13, 6, c, 0.1); } });
  def('breeze', 32, 32, [
    P('rods', [0, 8, 0], 0, [[0, 17, -1, 0, -1, 2, 8, 2], [0, 17, 3, 0, -1, 2, 8, 2], [0, 17, -5, 0, -1, 2, 8, 2]]),
    P('head', [0, 4, 0], 0, [[4, 24, -5, -5, -4.2, 10, 3, 4], [0, 0, -4, -8, -4, 8, 8, 8]]),
    P('wind_body', [0, 16, 0], 0, [[0, 0, -2.5, 0, -2.5, 5, 8, 5]], [], true),
  ], { anim: 'breeze', skin: s => { const c = 0xc8d8f0; const H = furBox(s, 0, 0, 8, 8, 8, c, 0.06); s.fill(H.front[0] + 1, H.front[1] + 3, 2, 2, 0x3a5aa8, 0); s.fill(H.front[0] + 5, H.front[1] + 3, 2, 2, 0x3a5aa8, 0); furBox(s, 4, 24, 10, 3, 4, 0xa8b8e0, 0.06); furBox(s, 0, 17, 2, 8, 2, 0x8aa0d0, 0.06); } });
  // ---------------------------------------------------------------- bosses
  def('wither', 64, 64, [
    P('shoulders', [0, 0, 0], 0, [[0, 16, -10, 3.9, -0.5, 20, 3, 3]]),
    P('ribcage', [-2, 6.9, -0.5], [0.20420352, 0, 0], [[0, 22, 0, 0, 0, 3, 10, 3], [24, 22, -4, 1.5, 0.5, 11, 2, 2], [24, 22, -4, 4, 0.5, 11, 2, 2], [24, 22, -4, 6.5, 0.5, 11, 2, 2]]),
    P('tail', [-2, 16.9, 1.5], [0.83252203, 0, 0], [[12, 22, 0, 0, 0, 3, 6, 3]]),
    P('center_head', [0, 0, 0], 0, [[0, 0, -4, -4, -4, 8, 8, 8]]), P('right_head', [-8, 4, 0], 0, [[32, 0, -4, -4, -4, 6, 6, 6]]), P('left_head', [10, 4, 0], 0, [[32, 0, -4, -4, -4, 6, 6, 6]]),
  ], { anim: 'wither', scale: 2, skin: s => { const c = 0x1f1f1f; for (const [u, v, w, h, d] of [[0, 16, 20, 3, 3], [0, 22, 3, 10, 3], [24, 22, 11, 2, 2], [12, 22, 3, 6, 3]]) furBox(s, u, v, w, h, d, c, 0.08); const H = furBox(s, 0, 0, 8, 8, 8, c, 0.06); s.fill(H.front[0] + 1, H.front[1] + 3, 2, 2, 0xd8f0f0, 0); s.fill(H.front[0] + 5, H.front[1] + 3, 2, 2, 0xd8f0f0, 0); s.fill(H.front[0] + 2, H.front[1] + 6, 4, 1, 0x050505, 0); const H2 = furBox(s, 32, 0, 6, 6, 6, c, 0.06); s.px(H2.front[0] + 1, H2.front[1] + 2, 0xd8f0f0); s.px(H2.front[0] + 4, H2.front[1] + 2, 0xd8f0f0); } });
  def('ender_dragon', 256, 256, [
    P('head', [0, 0, 0], 0, [[176, 44, -6, -1, -24, 12, 5, 16], [112, 30, -8, -8, -10, 16, 16, 16], [0, 0, -5, -12, -4, 2, 4, 6, 0, true], [112, 0, -5, -3, -22, 2, 2, 4, 0, true], [0, 0, 3, -12, -4, 2, 4, 6], [112, 0, 3, -3, -22, 2, 2, 4]], [P('jaw', [0, 4, -8], 0, [[176, 65, -6, 0, -16, 12, 4, 16]])]),
    P('neck', [0, 0, 5], 0, [[192, 104, -5, -5, -5, 10, 10, 10], [48, 0, -1, -9, -3, 2, 4, 6]]),
    P('body', [0, 4, 8], 0, [[0, 0, -12, 0, -16, 24, 24, 64], [220, 53, -1, -6, -10, 2, 6, 12], [220, 53, -1, -6, 10, 2, 6, 12], [220, 53, -1, -6, 30, 2, 6, 12]]),
    P('left_wing', [12, 5, 2], 0, [[112, 88, 0, -4, -4, 56, 8, 8], [-56, 88, 0, 0, 2, 56, 0, 56]], [P('left_wing_tip', [56, 0, 0], 0, [[112, 136, 0, -2, -2, 56, 4, 4], [-56, 144, 0, 0, 2, 56, 0, 56]])]),
    P('right_wing', [-12, 5, 2], 0, [[112, 88, -56, -4, -4, 56, 8, 8, 0, true], [-56, 88, -56, 0, 2, 56, 0, 56, 0, true]], [P('right_wing_tip', [-56, 0, 0], 0, [[112, 136, -56, -2, -2, 56, 4, 4, 0, true], [-56, 144, -56, 0, 2, 56, 0, 56, 0, true]])]),
    P('left_front_leg', [12, 20, 2], [1.3, 0, 0], [[112, 104, -4, -4, -4, 8, 24, 8]]), P('right_front_leg', [-12, 20, 2], [1.3, 0, 0], [[112, 104, -4, -4, -4, 8, 24, 8, 0, true]]),
    P('left_hind_leg', [16, 16, 42], [1, 0, 0], [[0, 0, -8, -4, -8, 16, 32, 16]]), P('right_hind_leg', [-16, 16, 42], [1, 0, 0], [[0, 0, -8, -4, -8, 16, 32, 16, 0, true]]),
  ], { anim: 'dragon', skin: s => { const c = 0x1a1a1a, p = 0x3a2a4a; s.fill(0, 0, 256, 256, c, 0.08); s.speckle(0, 0, 256, 100, [c, c, p, 0x2a2a2a]); const H = s.faces(112, 30, 16, 16, 16); s.fill(H.front[0] + 2, H.front[1] + 6, 3, 1, 0xe079fa, 0); s.fill(H.front[0] + 11, H.front[1] + 6, 3, 1, 0xe079fa, 0); s.fill(0, 88, 112, 112, 0x3a3a4a, 0.1); } , scale: 1 });
  // ---------------------------------------------------------------- golem flower etc. are handled by the mob
})();
