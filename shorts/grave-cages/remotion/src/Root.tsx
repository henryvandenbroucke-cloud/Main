import React from "react";
import { Composition, Still } from "remotion";
import { PlateStill } from "./videos/grave/Plate";
import { GraveShort, GRAVE_FRAMES } from "./videos/grave/Short";
import { PW, PH } from "./videos/grave/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Composition id="GraveShort" component={GraveShort} durationInFrames={GRAVE_FRAMES} fps={30} width={1080} height={1920} />
</>);
