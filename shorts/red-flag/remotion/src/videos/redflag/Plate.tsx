// One background plate of the brick-tax short: the static world seen from PLATES[plate], through the template's
// post chain (world ink -> lens blur pre + main -> bloom -> NEUTRAL tone map -> grade), MSAA 4.
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { plateOf, PW, PH } from "./story";
export const plateW = () => plateOf((getInputProps() as { plate?: string }).plate ?? "road").w ?? PW;

const makeBloom = () => new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
let WORLD: World | null = null;
const fwd = new THREE.Vector3();

const Inner: React.FC<{ id: string }> = ({ id }) => {
  const { camera, scene } = useThree();
  const world = useMemo(() => (WORLD ??= new World()), []);
  const p = plateOf(id);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES[p.light], GRADE_STRENGTH[p.light]),
  }), [camera, scene, p.light]);
  const cam = camera as THREE.PerspectiveCamera;
  const focus = world.update(p, cam, scene);
  noInkFallback(world.root);
  cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.3, focus.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = p.cInf;
  gradeFor(fx.grade, p.light);
  return (
    <>
      <primitive object={world.root} dispose={null} />
      <EffectComposer multisampling={4}>
        <primitive object={fx.ink} dispose={null} />
        <primitive object={fx.lens.pre} dispose={null} />
        <primitive object={fx.lens.main} dispose={null} />
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
        <primitive object={fx.grade} dispose={null} />
      </EffectComposer>
    </>
  );
};

export const PlateStill: React.FC = () => {
  const id = (getInputProps() as { plate?: string }).plate ?? "town_gob";
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <ThreeCanvas width={plateOf(id).w ?? PW} height={PH} shadows gl={{ antialias: false, stencil: false, toneMappingExposure: 1.0 }} camera={{ fov: 40, near: 0.2, far: 1500 }}>
        <Inner id={id} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
