// A sprite atlas rendered from real 3D models (toon-shaded, ink outlines, key + rim light), so the particles and hero
// props of the tea short look made in a 3D package rather than drawn flat. 8 x 8 cells of 256 px on a transparent
// 2048 px sheet; Short.tsx animates them (position, spin, scale, motion smear). Cell map (row: content):
//   0-1 dried tea leaves (16 shapes/poses) | 2 green ash leaves | 3 steam puffs | 4 water drops / spray
//   5 the caddy, lid 0..105 deg | 6 the key turning 0..315 deg | 7 sack, cup, spoon, coin, boat, barrel, quill, scissors
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";

export const ATLAS = 4096, CELL = 512;
const rnd = (s: number) => { const v = Math.sin(s * 127.1) * 43758.5453; return v - Math.floor(v); };
const grad = (() => { const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (c: string, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...extra });
const INKM = new THREE.MeshBasicMaterial({ color: "#241726", side: THREE.BackSide });
/** inverted-hull outline: the mesh plus a slightly inflated back-face copy in ink */
const inked = (geo: THREE.BufferGeometry, mat: THREE.Material, w = 0.035) => {
  const g = new THREE.Group(); const m = new THREE.Mesh(geo, mat); g.add(m);
  const o = geo.clone(); o.computeVertexNormals(); const p = o.attributes.position, n = o.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  g.add(new THREE.Mesh(o, INKM)); return g;
};
/** a curled leaf: pointed oval, midrib fold, curl along its length, a twist */
const leafGeo = (s: number, curl: number, twist: number) => {
  const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.quadraticCurveTo(-0.1, 0.32, 0.5, 0); sh.quadraticCurveTo(-0.1, -0.32, -0.5, 0);
  const g = new THREE.ShapeGeometry(sh, 16); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, curl * x * x * 1.6 + Math.abs(y) * 0.5 + twist * x * y); }
  g.scale(s, s, s); g.computeVertexNormals(); return g;
};
const puffGeo = (seed: number) => {
  const geos: THREE.BufferGeometry[] = [];
  const n = 4 + Math.floor(rnd(seed) * 3);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd(seed + i), r = 0.25 + rnd(seed * 3 + i) * 0.2; geos.push(new THREE.SphereGeometry(0.28 + rnd(seed + i * 7) * 0.18, 20, 14).translate(Math.cos(a) * r, Math.sin(a) * r * 0.7 + 0.05 * i, 0)); }
  geos.push(new THREE.SphereGeometry(0.42, 20, 14));
  return geos;
};

const build = (root: THREE.Group) => {
  const cell = (c: number, r: number, obj: THREE.Object3D, scale = 1) => { obj.position.set(-7 + c * 2, 7 - r * 2, 0); obj.scale.multiplyScalar(scale); root.add(obj); };
  // rows 0-1: dried tea leaves (dark, varied), row 2: green ash leaves
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    const k = r * 8 + c;
    const col = r < 2 ? ["#3b2e22", "#4a3926", "#2f3222", "#55402a"][k % 4] : ["#5d8a3a", "#6b9a42", "#4f7a32"][k % 3];
    const g = inked(leafGeo(1.25, (rnd(k) - 0.3) * 0.9, (rnd(k + 9) - 0.5) * 1.4), toon(col, { side: THREE.DoubleSide }), 0.022);
    g.rotation.set(rnd(k * 2) * 2.4 - 1.2, rnd(k * 3) * 2.4 - 1.2, rnd(k * 5) * Math.PI * 2);
    cell(c, r, g);
  }
  // row 3: steam / smoke puffs (white, toon two-tone)
  for (let c = 0; c < 8; c++) { const g = new THREE.Group(); for (const geo of puffGeo(c + 1)) g.add(inked(geo, toon(c < 6 ? "#f4f4f8" : "#cfc9c0"), 0.03)); g.rotation.z = rnd(c) * 6; cell(c, 3, g, 1.25); }
  // row 4: water drops and spray
  for (let c = 0; c < 8; c++) {
    const g = new THREE.Group(), n = c < 4 ? 1 : 3 + c;
    for (let i = 0; i < n; i++) { const s = c < 4 ? 0.45 : 0.12 + rnd(c * 10 + i) * 0.14; const geo = new THREE.SphereGeometry(s, 20, 14).scale(1, c < 4 ? 1.35 : 1, 1); if (c < 4) geo.translate(0, 0, 0); const m = inked(geo, new THREE.MeshPhongMaterial({ color: "#7fc0e8", shininess: 120, specular: "#ffffff" }), 0.02); if (c >= 4) m.position.set((rnd(c + i * 3) - 0.5) * 1.2, (rnd(c * 7 + i) - 0.5) * 1.2, 0); g.add(m); }
    g.rotation.z = c < 4 ? c * 0.4 : 0; cell(c, 4, g);
  }
  // row 5: the mahogany tea caddy, lid 0..105 deg (3/4 view)
  for (let c = 0; c < 8; c++) {
    const g = new THREE.Group(), wood = toon("#7a3e1e"), brass = new THREE.MeshPhongMaterial({ color: "#d6a63c", shininess: 90, specular: "#fff1c0" });
    g.add(inked(new THREE.BoxGeometry(1.1, 0.62, 0.72), wood, 0.03));
    g.add(inked(new THREE.BoxGeometry(0.16, 0.2, 0.02).translate(0, 0.05, 0.37), brass, 0.012));
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.02).translate(0, 0.04, 0.385), new THREE.MeshBasicMaterial({ color: "#241726" })); g.add(hole);
    for (const [x, z] of [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]]) g.add(inked(new THREE.SphereGeometry(0.07, 12, 8).translate(x, -0.34, z), brass, 0.01));
    const lid = new THREE.Group(); lid.position.set(0, 0.31, -0.36);
    lid.add(inked(new THREE.BoxGeometry(1.16, 0.14, 0.78).translate(0, 0.07, 0.39), toon("#8a4722"), 0.03));
    lid.add(inked(new THREE.TorusGeometry(0.1, 0.025, 10, 20, Math.PI).translate(0, 0.15, 0.39), brass, 0.01));
    lid.rotation.x = -(c / 7) * 1.83; g.add(lid);
    if (c >= 3) g.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.62).translate(0, 0.27, 0), toon("#3b2e22"))); // the tea inside
    g.rotation.set(0.42, -0.55, 0); cell(c, 5, g, 1.05);
  }
  // row 6: the brass key turning
  for (let c = 0; c < 8; c++) {
    const g = new THREE.Group(), inner = new THREE.Group(), brass = new THREE.MeshPhongMaterial({ color: "#d6a63c", shininess: 90, specular: "#fff6d0" });
    inner.add(inked(new THREE.TorusGeometry(0.24, 0.06, 12, 28).rotateY(Math.PI / 2).translate(-0.6, 0, 0), brass, 0.015));
    inner.add(inked(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 12).rotateZ(Math.PI / 2).translate(0.05, 0, 0), brass, 0.012));
    inner.add(inked(new THREE.BoxGeometry(0.06, 0.2, 0.05).translate(0.45, -0.1, 0), brass, 0.012));
    inner.add(inked(new THREE.BoxGeometry(0.06, 0.12, 0.05).translate(0.34, -0.07, 0), brass, 0.012));
    inner.rotation.x = (c / 8) * Math.PI * 2; g.add(inner); g.rotation.set(0.3, 0.5, 0.15); cell(c, 6, g, 1.1);
  }
  // row 7: props
  const props: (() => THREE.Object3D)[] = [
    () => { const g = new THREE.Group(); const geo = new THREE.SphereGeometry(0.55, 24, 16).scale(0.9, 1.15, 0.8); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - Math.max(0, y - 0.3) * 0.9)); p.setZ(i, p.getZ(i) * (1 - Math.max(0, y - 0.3) * 0.9)); } geo.computeVertexNormals(); g.add(inked(geo, toon("#6b5a3a"), 0.03)); g.add(inked(new THREE.TorusGeometry(0.12, 0.04, 8, 16).rotateX(Math.PI / 2).translate(0, 0.52, 0), toon("#3a2a20"), 0.01)); return g; },
    () => { const g = new THREE.Group(); const cup = new THREE.LatheGeometry([new THREE.Vector2(0.0, -0.25), new THREE.Vector2(0.22, -0.25), new THREE.Vector2(0.36, 0.05), new THREE.Vector2(0.4, 0.22), new THREE.Vector2(0.37, 0.22)], 32); g.add(inked(cup, toon("#f7f3ea", { side: THREE.DoubleSide }), 0.02)); g.add(inked(new THREE.TorusGeometry(0.11, 0.03, 8, 16).translate(0.42, 0.0, 0), toon("#f7f3ea"), 0.01)); g.add(new THREE.Mesh(new THREE.CircleGeometry(0.36, 32).rotateX(-Math.PI / 2).translate(0, 0.15, 0), toon("#9a5a2a"))); g.add(inked(new THREE.CylinderGeometry(0.6, 0.5, 0.05, 32).translate(0, -0.27, 0), toon("#f7f3ea"), 0.015)); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.012, 6, 32).rotateX(Math.PI / 2).translate(0, 0.2, 0), new THREE.MeshPhongMaterial({ color: "#d6a63c" }))); g.rotation.x = 0.45; return g; },
    () => { const g = new THREE.Group(); const silver = new THREE.MeshPhongMaterial({ color: "#c9ccd2", shininess: 100, specular: "#ffffff" }); g.add(inked(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 10).rotateZ(Math.PI / 2).translate(0.2, 0, 0), silver, 0.01)); g.add(inked(new THREE.SphereGeometry(0.2, 18, 12).scale(1.2, 0.35, 0.9).translate(-0.4, 0.02, 0), silver, 0.012)); for (let i = 0; i < 6; i++) g.add(new THREE.Mesh(leafGeo(0.18, 0.3, 0.2).rotateZ(i).translate(-0.42 + (i % 3) * 0.06, 0.09, (i - 3) * 0.04), toon("#3b2e22", { side: THREE.DoubleSide }))); g.rotation.set(0.6, 0.3, 0.2); return g; },
    () => { const g = new THREE.Group(); g.add(inked(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 36).rotateX(Math.PI / 2), new THREE.MeshPhongMaterial({ color: "#e8b830", shininess: 110, specular: "#fff6d0" }), 0.015)); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.015, 6, 36).translate(0, 0, 0.045), new THREE.MeshPhongMaterial({ color: "#b8862a" }))); g.rotation.y = 0.5; return g; },
    () => { const g = new THREE.Group(); const hull = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.95, 0.38, 0.4); g.add(inked(hull, toon("#7a4a2a", { side: THREE.DoubleSide }), 0.025)); g.add(inked(new THREE.BoxGeometry(1.7, 0.05, 0.74).translate(0, 0.0, 0), toon("#a8724a"), 0.015)); g.add(inked(new THREE.BoxGeometry(0.08, 0.06, 0.7).translate(0.1, 0.05, 0), toon("#5a3b2a"), 0.01)); for (const z of [-0.45, 0.45]) g.add(inked(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8).rotateZ(1.2).translate(0.1, 0.1, z), toon("#c9a26a"), 0.008)); g.add(inked(new THREE.SphereGeometry(0.22, 16, 12).scale(0.9, 0.8, 0.8).translate(-0.4, 0.12, 0), toon("#6b5a3a"), 0.012)); g.rotation.set(0.35, -0.4, 0); return g; },
    () => { const g = new THREE.Group(); g.add(inked(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 28).scale(1, 1, 1), toon("#8a5a2a"), 0.025)); for (const y of [-0.32, 0.32]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.07, 28).translate(0, y, 0), new THREE.MeshPhongMaterial({ color: "#5d6068" }))); g.rotation.x = 0.35; return g; },
    () => { const g = new THREE.Group(); const sh = new THREE.Shape(); sh.moveTo(0, -0.6); sh.quadraticCurveTo(0.22, 0.0, 0.05, 0.6); sh.quadraticCurveTo(-0.12, 0.0, 0, -0.6); g.add(inked(new THREE.ShapeGeometry(sh, 12), toon("#f7f3ea", { side: THREE.DoubleSide }), 0.015)); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 6).translate(0.02, 0, 0.01), toon("#c9a26a"))); g.rotation.z = -0.5; return g; },
    () => { const g = new THREE.Group(); const steel = new THREE.MeshPhongMaterial({ color: "#c9ccd2", shininess: 100, specular: "#ffffff" }); for (const s of [-1, 1]) { const b = new THREE.Group(); b.add(inked(new THREE.BoxGeometry(0.9, 0.08, 0.03).translate(0.4, 0, 0), steel, 0.012)); b.add(inked(new THREE.TorusGeometry(0.14, 0.04, 8, 18).translate(-0.18, s * 0.1, 0), toon("#2b2830"), 0.01)); b.rotation.z = s * 0.28; g.add(b); } return g; },
  ];
  props.forEach((mk, c) => cell(c, 7, mk(), c === 4 ? 0.95 : 1.1));
};

const Scene: React.FC = () => {
  const { camera, scene } = useThree();
  const root = useMemo(() => { const g = new THREE.Group(); build(g); return g; }, []);
  useMemo(() => {
    const cam = camera as THREE.OrthographicCamera; cam.left = -8; cam.right = 8; cam.top = 8; cam.bottom = -8; cam.near = 0.1; cam.far = 100; cam.position.set(0, 0, 20); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    scene.background = null;
  }, [camera, scene]);
  return (
    <>
      <primitive object={root} dispose={null} />
      <hemisphereLight args={["#e9f1ff", "#8a7a6a", 1.1]} />
      <directionalLight position={[-4, 6, 8]} intensity={2.4} color="#fff2dc" />
      <directionalLight position={[5, 3, -6]} intensity={1.4} color="#cfe0ff" />
    </>
  );
};

export const AtlasStill: React.FC = () => (
  <AbsoluteFill style={{ background: "transparent" }}>
    <ThreeCanvas orthographic width={ATLAS} height={ATLAS} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} camera={{ zoom: 1, position: [0, 0, 20] }}>
      <Scene />
    </ThreeCanvas>
  </AbsoluteFill>
);
