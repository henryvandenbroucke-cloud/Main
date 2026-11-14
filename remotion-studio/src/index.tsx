import React from "react";
import { Composition, registerRoot } from "remotion";
import { PointingShort, POINTING_FRAMES } from "./videos/pointing/Pointing";
import { WaterShort, WATER_FRAMES } from "./videos/water/Water";

const Root: React.FC = () => (
  <>
    <Composition id="PointingShort" component={PointingShort} durationInFrames={POINTING_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="WaterShort" component={WaterShort} durationInFrames={WATER_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
registerRoot(Root);
