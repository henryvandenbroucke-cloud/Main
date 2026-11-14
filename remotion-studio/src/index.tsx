import React from "react";
import { Composition, registerRoot } from "remotion";
import { PointingShort, POINTING_FRAMES } from "./videos/pointing/Pointing";

const Root: React.FC = () => (
  <Composition id="PointingShort" component={PointingShort} durationInFrames={POINTING_FRAMES} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
