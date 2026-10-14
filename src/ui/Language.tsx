import {createContext,useContext} from 'react';
export const LanguageContext=createContext<'sv'|'en'>('sv');
export function useLanguage(){const language=useContext(LanguageContext);return {language,t:(en:string,sv:string)=>language==='sv'?sv:en};}
