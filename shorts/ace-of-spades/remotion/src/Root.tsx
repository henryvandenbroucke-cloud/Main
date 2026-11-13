import React from "react";
import { Composition, Still } from "remotion";
import { PlateStill } from "./videos/ace/Plate";
import { AceShort, ACE_FRAMES } from "./videos/ace/Short";
import { AtlasStill, ATLAS } from "./videos/ace/Atlas";
import { PW, PH, STRIP_W } from "./videos/ace/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Still id="AceAtlas" component={AtlasStill} width={ATLAS} height={ATLAS} />
  <Composition id="AceShort" component={AceShort} durationInFrames={ACE_FRAMES} fps={30} width={1080} height={1920} />
</>);
