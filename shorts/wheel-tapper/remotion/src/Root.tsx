import React from "react";
import { Composition, Still } from "remotion";
import { TapperShort, TAPPER_FRAMES } from "./videos/tapper/Short";
import { PlateStill } from "./videos/tapper/Plate";
import { PW, PH, STRIP_W } from "./videos/tapper/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Composition id="TapperShort" component={TapperShort} durationInFrames={TAPPER_FRAMES} fps={30} width={1080} height={1920} />
</>);
