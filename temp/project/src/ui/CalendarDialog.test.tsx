import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarDialog } from './LessonWorkspace';
import type { CalendarStatus } from '../lesson';
const render=(status:Partial<CalendarStatus>)=>renderToStaticMarkup(<CalendarDialog swedish={false}
  status={{configured:true,connected:false,connecting:false,calendarId:'primary',configurationSource:'schoolwork',...status}}
  onStatus={()=>{}} onClose={()=>{}} onError={()=>{}}/>);
it('defaults to Google sign-in rather than making users configure a Cloud project',()=>{
  const html=render({});expect(html).toContain('Sign in with Google');expect(html).not.toContain('OAuth client ID');
  expect(html).not.toContain('Enable Google Calendar API');expect(html).toContain('role="dialog"');
  expect(html).toContain('selected TeachGPT server');expect(html).toContain('Privacy and Google data');
});
it('honestly reports unprovisioned builds and disables sign-in',()=>{
  const html=render({configured:false,configurationSource:'unavailable'});
  expect(html).toContain('publisher has not enabled');expect(html).toContain('disabled=""');expect(html).not.toContain('OAuth client ID');
});
it('shows the browser handoff, cancellation and connected states',()=>{
  const pending=render({connecting:true});expect(pending).toContain('Finish signing in in your browser');expect(pending).toContain('Cancel sign-in');
  const connected=render({connected:true});expect(connected).toContain('Google account connected');expect(connected).toContain('Disconnect account');
});
