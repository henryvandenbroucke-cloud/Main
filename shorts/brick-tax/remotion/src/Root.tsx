import React from "react";
import { Composition, Still } from "remotion";
import { PlateStill } from "./videos/brick/Plate";
import { BrickShort, BRICK_FRAMES } from "./videos/brick/Short";
import { PW, PH } from "./videos/brick/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Composition id="BrickShort" component={BrickShort} durationInFrames={BRICK_FRAMES} fps={30} width={1080} height={1920} />
</>);
