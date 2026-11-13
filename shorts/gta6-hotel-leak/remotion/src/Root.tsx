import React from "react";
import { Composition, Still } from "remotion";
import { PlateStill } from "./videos/gta/Plate";
import { GtaShort, GTA_FRAMES } from "./videos/gta/Short";
import { AtlasStill, ATLAS } from "./videos/gta/Atlas";
import { PW, PH, STRIP_W } from "./videos/gta/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Still id="GtaAtlas" component={AtlasStill} width={ATLAS} height={ATLAS} />
  <Composition id="GtaShort" component={GtaShort} durationInFrames={GTA_FRAMES} fps={30} width={1080} height={1920} />
</>);
