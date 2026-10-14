import type {MenuItemConstructorOptions} from 'electron';
/** Native menu labels follow the same persisted preference as the renderer. */
export function appMenu(language:string):MenuItemConstructorOptions[]{
 const sv=language!=='en',t=(en:string,svText:string)=>sv?svText:en;
 const item=(role:MenuItemConstructorOptions['role'],en:string,svText:string):MenuItemConstructorOptions=>({role,label:t(en,svText)});
 return [
  {label:t('File','Arkiv'),submenu:[item('quit','Quit','Avsluta')]},
  {label:t('Edit','Redigera'),submenu:[item('undo','Undo','Ångra'),item('redo','Redo','Gör om'),{type:'separator'},item('cut','Cut','Klipp ut'),item('copy','Copy','Kopiera'),item('paste','Paste','Klistra in'),item('selectAll','Select all','Markera allt')]},
  {label:t('View','Visa'),submenu:[item('reload','Reload','Läs in igen'),item('toggleDevTools','Developer tools','Utvecklarverktyg'),{type:'separator'},item('resetZoom','Actual size','Faktisk storlek'),item('zoomIn','Zoom in','Zooma in'),item('zoomOut','Zoom out','Zooma ut'),item('togglefullscreen','Full screen','Helskärm')]},
  {label:t('Window','Fönster'),submenu:[item('minimize','Minimize','Minimera'),item('close','Close','Stäng')]},
 ];
}
