import {Audio} from '@remotion/media';
import {AbsoluteFill,Composition,Folder,Series,staticFile} from 'remotion';
import {Opening} from './Opening';
import {Lesson} from './Lesson';
import {Tasks} from './Tasks';
import {Calendar} from './Calendar';
import {Ask} from './Ask';
import {Email} from './Email';
import {Work} from './Work';
import {Closing} from './Closing';

export function Showcase(){return <AbsoluteFill>
 <Audio src={staticFile('showcase/music.wav')}/><Audio src={staticFile('showcase/effects.wav')}/>
 <Series>
 <Series.Sequence name="Record the lesson" durationInFrames={60}><Opening/></Series.Sequence>
 <Series.Sequence name="Transcript to notes" durationInFrames={90}><Lesson/></Series.Sequence>
 <Series.Sequence name="Assignment" durationInFrames={90}><Tasks/></Series.Sequence>
 <Series.Sequence name="Google Calendar" durationInFrames={120}><Calendar/></Series.Sequence>
 <Series.Sequence name="Ask for an email" durationInFrames={120}><Ask/></Series.Sequence>
 <Series.Sequence name="Computer use Send" durationInFrames={180}><Email/></Series.Sequence>
 <Series.Sequence name="Normal Work mode" durationInFrames={150}><Work/></Series.Sequence>
 <Series.Sequence name="SchoolWork close" durationInFrames={90}><Closing/></Series.Sequence>
 </Series>
 </AbsoluteFill>;}

export function ShowcaseCompositions(){return <>
 <Composition id="SchoolWorkShowcasePortrait" component={Showcase} width={1080} height={1920} fps={30} durationInFrames={900}/>
 <Composition id="SchoolWorkShowcaseLandscape" component={Showcase} width={1920} height={1080} fps={30} durationInFrames={900}/>
 <Folder name="Showcase-scenes">
 <Composition id="Showcase-Record" component={Opening} width={1080} height={1920} fps={30} durationInFrames={60}/>
 <Composition id="Showcase-Notes" component={Lesson} width={1080} height={1920} fps={30} durationInFrames={90}/>
 <Composition id="Showcase-Assignment" component={Tasks} width={1080} height={1920} fps={30} durationInFrames={90}/>
 <Composition id="Showcase-Calendar" component={Calendar} width={1080} height={1920} fps={30} durationInFrames={120}/>
 <Composition id="Showcase-Ask" component={Ask} width={1080} height={1920} fps={30} durationInFrames={120}/>
 <Composition id="Showcase-Email" component={Email} width={1080} height={1920} fps={30} durationInFrames={180}/>
 <Composition id="Showcase-Work" component={Work} width={1080} height={1920} fps={30} durationInFrames={150}/>
 <Composition id="Showcase-Close" component={Closing} width={1080} height={1920} fps={30} durationInFrames={90}/>
 </Folder>
 </>;}
