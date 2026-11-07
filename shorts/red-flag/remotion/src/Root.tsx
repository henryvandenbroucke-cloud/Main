import React from "react";
import { Composition, Still } from "remotion";
import { TapperShort, TAPPER_FRAMES } from "./videos/tapper/Short";
import { PlateStill } from "./videos/redflag/Plate";
import { RedFlagShort, REDFLAG_FRAMES } from "./videos/redflag/Short";
import { PW, PH, STRIP_W } from "./videos/redflag/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Composition id="TapperShort" component={TapperShort} durationInFrames={TAPPER_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="RedFlagShort" component={RedFlagShort} durationInFrames={REDFLAG_FRAMES} fps={30} width={1080} height={1920} />
</>);
