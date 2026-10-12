import { MyComposition } from "./Composition";
import {ShowcaseCompositions} from './showcase/Showcase';
import {LaunchAdCompositions} from './launch-ad/LaunchAd';
import {SwedishLaunchAdCompositions} from './launch-ad-sv/LaunchAd';
import {Bumpers} from './bumpers/Bumpers';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <ShowcaseCompositions/>
      <LaunchAdCompositions/>
      <SwedishLaunchAdCompositions/>
      <Bumpers/>
    </>
  );
};
