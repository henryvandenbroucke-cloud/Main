import React from "react";
import { Composition, Still } from "remotion";
import { PlateStill } from "./videos/edge/Plate";
import { EdgeShort, EDGE_FRAMES } from "./videos/edge/Short";
import { AtlasStill, ATLAS } from "./videos/edge/Atlas";
import { PW, PH, STRIP_W } from "./videos/edge/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Still id="CasinoAtlas" component={AtlasStill} width={ATLAS} height={ATLAS} />
  <Composition id="EdgeShort" component={EdgeShort} durationInFrames={EDGE_FRAMES} fps={30} width={1080} height={1920} />
</>);
