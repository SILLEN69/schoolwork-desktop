/** Keep transport wrappers out of user copy; backend diagnostics retain causes. */
export function cleanError(error: unknown): string {
  let text=error instanceof Error ? error.message : String(error ?? '');
  for(let i=0;i<4;i++){
    const next=text.replace(/^Error invoking remote method ['"][^'"]+['"]:\s*/i,'').replace(/^Error:\s*/i,'');
    if(next===text)break;text=next;
  }
  return text.trim();
}
export function userError(error:unknown,language:'sv'|'en'='sv'):string {
  const text=cleanError(error);
  const rules:[RegExp,string,string][]=[
    [/Notes changed while editing/i,'Anteckningarna uppdaterades medan du redigerade. Ditt utkast är kvar. Öppna de senaste anteckningarna och kopiera in dina ändringar.','The notes changed while you were editing. Your draft is kept. Open the latest notes and copy in your changes.'],
    [/Answer each question before sending/i,'Besvara varje fråga innan du skickar.','Answer each question before sending.'],
    [/no longer active|Form not found/i,'Frågan är inte längre aktiv. Återuppta uppgiften.','This question is no longer active. Resume the task.'],
    [/"code":\s*"(invalid_|too_)|Unexpected.*JSON/i,'Svaret kunde inte läsas. Försök igen; tidigare arbete är sparat.','The response could not be read. Try again; previous work is saved.'],
    [/provided code is invalid|code is invalid or expired/i,'Projektorkoden är fel eller har gått ut. Skriv den aktuella sexsiffriga koden.','The projector code is incorrect or expired. Enter the current six-digit code.'],
    [/six-digit code|six.digit projector code/i,'Skriv projektorns sexsiffriga kod.','Enter the six-digit projector code.'],
    [/No cast is running|No active presentation/i,'Ingen bild delas just nu. Kontrollera att presentationen delas via YeetCast.','No picture is being shared. Check that the presentation is shared through YeetCast.'],
    [/board video is still connecting|no decoded.*video/i,'Bilden ansluter fortfarande. Försök igen om några sekunder.','The picture is still connecting. Try again in a few seconds.'],
    [/Open the board window first/i,'Visa tavlan innan du tar en bild.','Show the board before taking a snapshot.'],
    [/decrypting|decryptString|cannot read.*credential|Saved TeachGPT key cannot be read/i,'Den sparade API-nyckeln kunde inte läsas. Lägg in den igen i Inställningar.','The saved API key could not be read. Enter it again in Settings.'],
    [/Configure your TeachGPT API key|API key.*missing|not configured/i,'Lägg in din TeachGPT-nyckel i Inställningar.','Enter your TeachGPT key in Settings.'],
    [/HTTP 401|HTTP 403|invalid.*(API key|credential)/i,'TeachGPT godkände inte nyckeln. Kontrollera den i Inställningar.','TeachGPT did not accept the key. Check it in Settings.'],
    [/TeachGPT.*(timed out|timeout)|HTTP 504|Gateway Time.out/i,'TeachGPT svarade inte i tid. Arbetet är sparat; försök igen.','TeachGPT did not respond in time. Your work is saved; try again.'],
    [/HTTP 429|rate.limit/i,'TeachGPT är tillfälligt upptaget. Vänta en stund och försök igen.','TeachGPT is temporarily busy. Wait a moment and try again.'],
    [/Failed to fetch|fetch failed|network|Could not reach the projector/i,'Anslutningen misslyckades. Kontrollera internet och försök igen.','The connection failed. Check your internet connection and try again.'],
    [/AbortError|request cancelled|task stopped/i,'Åtgärden har stoppats.','The action was stopped.'],
    [/scripts is disabled|running scripts is disabled/i,'Windows tillåter inte att skriptet körs. Se detaljer i Aktivitet.','Windows blocked the script. See Activity for details.'],
  ];
  const found=rules.find(([pattern])=>pattern.test(text));
  return found?found[language==='sv'?1:2]:text || (language==='sv'?'Något gick fel. Försök igen.':'Something went wrong. Try again.');
}
export function userProgress(text:string,language:'sv'|'en') {
 if(language==='en')return text;
 const copy:Record<string,string>={
  'OpenCode is ready; opening the saved work session…':'Förbereder arbetsuppgiften…',
  'OpenCode work session connected.':'Redo att arbeta.',
  'Working on the next step…':'Arbetar med nästa steg…',
  'Preparing the next action…':'Förbereder nästa åtgärd…',
  'Receiving the answer…':'Tar emot svaret…',
  'The model is working out the next step…':'Planerar nästa steg…',
  'Retrying the saved inference step…':'Försöker igen från det sparade steget…',
  'Recovering an incomplete response; no unfinished action was executed.':'Återhämtar ett ofullständigt svar…',
  'Your answer is saved. Continuing the task.':'Ditt svar är sparat. Arbetet fortsätter.',
 };
 if(copy[text])return copy[text];
 return text.replace(/^Using /,'Använder ').replace(/^Reading /,'Läser ').replace(/^Running /,'Kör ').replace(/^Opening /,'Öppnar ').replace(/^Writing /,'Skriver ').replace(/^Editing /,'Redigerar ').replace(/^Receiving TeachGPT response/,'Tar emot svar från TeachGPT');
}
