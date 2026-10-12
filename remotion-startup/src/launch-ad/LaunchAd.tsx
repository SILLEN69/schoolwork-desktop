import { Audio } from "@remotion/media";
import { Composition, Folder, Series, staticFile } from "remotion";
import { Hook } from "./Hook";
import { Reveal } from "./Reveal";
import { Lesson } from "./Lesson";
import { Calendar } from "./Calendar";
import { Ask } from "./Ask";
import { Email } from "./Email";
import { Work } from "./Work";
import { Close } from "./Close";
const scenes = [
  { id: "Hook", component: Hook, duration: 77 },
  { id: "Reveal", component: Reveal, duration: 116 },
  { id: "Lesson", component: Lesson, duration: 116 },
  { id: "Calendar", component: Calendar, duration: 116 },
  { id: "Ask", component: Ask, duration: 87 },
  { id: "Email", component: Email, duration: 175 },
  { id: "Work", component: Work, duration: 217 },
  { id: "Close", component: Close, duration: 116 },
];
export function LaunchAd() {
  return (
    <>
      <Audio src={staticFile("launch-private/provided-music.wav")} />
      <Audio src={staticFile("launch-private/stock-effects.wav")} />
      <Series>
        <Series.Sequence name="Opening" durationInFrames={77}>
          <Hook />
        </Series.Sequence>
        <Series.Sequence name="Meet SchoolWork" durationInFrames={116}>
          <Reveal />
        </Series.Sequence>
        <Series.Sequence name="Lesson follower" durationInFrames={116}>
          <Lesson />
        </Series.Sequence>
        <Series.Sequence name="Calendar" durationInFrames={116}>
          <Calendar />
        </Series.Sequence>
        <Series.Sequence name="Your request" durationInFrames={87}>
          <Ask />
        </Series.Sequence>
        <Series.Sequence name="Email" durationInFrames={175}>
          <Email />
        </Series.Sequence>
        <Series.Sequence name="Work mode" durationInFrames={217}>
          <Work />
        </Series.Sequence>
        <Series.Sequence name="Closing" durationInFrames={116}>
          <Close />
        </Series.Sequence>
      </Series>
    </>
  );
}
export function LaunchAdCompositions() {
  return (
    <>
      <Composition
        id="SchoolWorkLaunchAd"
        component={LaunchAd}
        durationInFrames={1020}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="LaunchAd-Scenes">
        {scenes.map(({ id, component, duration }) => (
          <Composition
            key={id}
            id={`LaunchAd-${id}`}
            component={component}
            durationInFrames={duration}
            fps={30}
            width={1920}
            height={1080}
          />
        ))}
      </Folder>
    </>
  );
}
