import React from "react";
import { Composition, Still } from "remotion";
import { PlateStill } from "./videos/penny/Plate";
import { PennyShort, PENNY_FRAMES } from "./videos/penny/Short";
import { AtlasStill, ATLAS } from "./videos/penny/Atlas";
import { PW, PH, STRIP_W } from "./videos/penny/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Still id="PennyAtlas" component={AtlasStill} width={ATLAS} height={ATLAS} />
  <Composition id="PennyShort" component={PennyShort} durationInFrames={PENNY_FRAMES} fps={30} width={1080} height={1920} />
</>);
