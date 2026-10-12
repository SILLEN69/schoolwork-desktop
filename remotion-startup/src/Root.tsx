import { MyComposition } from "./Composition";
import {ShowcaseCompositions} from './showcase/Showcase';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <ShowcaseCompositions/>
    </>
  );
};
