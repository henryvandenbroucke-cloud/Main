import React from "react";
import { Composition, Still } from "remotion";
import { TapperShort, TAPPER_FRAMES } from "./videos/tapper/Short";
import { PlateStill } from "./videos/tea/Plate";
import { AtlasStill, ATLAS } from "./videos/tea/Atlas";
import { TeaShort, TEA_FRAMES } from "./videos/tea/Short";
import { GoyaShort, GOYA_FRAMES } from "./videos/goya/Short";
import { RedFlagShort, REDFLAG_FRAMES } from "./videos/redflag/Short";
import { PW, PH, STRIP_W } from "./videos/tea/story";
export const Root: React.FC = () => (<>
  <Still id="Plate" component={PlateStill} width={PW} height={PH} />
  <Still id="PlateWide" component={PlateStill} width={STRIP_W} height={PH} />
  <Composition id="TapperShort" component={TapperShort} durationInFrames={TAPPER_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="RedFlagShort" component={RedFlagShort} durationInFrames={REDFLAG_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="GoyaShort" component={GoyaShort} durationInFrames={GOYA_FRAMES} fps={30} width={1080} height={1920} />
  <Still id="TeaAtlas" component={AtlasStill} width={ATLAS} height={ATLAS} />
  <Composition id="TeaShort" component={TeaShort} durationInFrames={TEA_FRAMES} fps={30} width={1080} height={1920} />
</>);
