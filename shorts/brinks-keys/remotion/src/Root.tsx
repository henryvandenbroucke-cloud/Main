import React from "react";
import { Composition, Still } from "remotion";
import { PlateStill } from "./videos/brinks/Plate";
import { BrinksShort, BRINKS_FRAMES } from "./videos/brinks/Short";
import { AtlasStill, ATLAS } from "./videos/brinks/Atlas";
import { PW, PH, STRIP_W } from "./videos/brinks/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Still id="BrinksAtlas" component={AtlasStill} width={ATLAS} height={ATLAS} />
  <Composition id="BrinksShort" component={BrinksShort} durationInFrames={BRINKS_FRAMES} fps={30} width={1080} height={1920} />
</>);
