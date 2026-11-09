import React from "react";
import { Composition, Still } from "remotion";
import { PlateStill } from "./videos/monte/Plate";
import { MonteShort, MONTE_FRAMES } from "./videos/monte/Short";
import { AtlasStill, ATLAS } from "./videos/monte/Atlas";
import { PW, PH, STRIP_W } from "./videos/monte/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Still id="CasinoAtlas" component={AtlasStill} width={ATLAS} height={ATLAS} />
  <Composition id="MonteShort" component={MonteShort} durationInFrames={MONTE_FRAMES} fps={30} width={1080} height={1920} />
</>);
