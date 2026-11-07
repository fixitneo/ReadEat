#!/usr/bin/env node
// Readest Personal: applies after backup and AI feature scripts.
import fs from 'node:fs';
import path from 'node:path';
const app=path.resolve(process.argv[2]??'upstream','apps/readest-app');
fs.copyFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),'personalProfileBudget.ts'),path.join(app,'src/utils/personalProfileBudget.ts'));
function edit(relative,fn){
 const p=path.join(app,relative),before=fs.readFileSync(p,'utf8'),after=fn(before);
 if(before===after)throw Error('Personal settings enhancement no-op: '+relative);
 fs.writeFileSync(p,after);
}
function once(s,from,to,label){
 if(s.split(from).length!==2)throw Error('Personal settings anchor '+label+': '+from.slice(0,80));
 return s.replace(from,to);
}
edit('src/types/settings.ts',s=>once(s,
 'export interface SystemSettings {',
 "export interface SystemSettings {\n  personalProfile?: {\n    pageSounds?: import('@/components/settings/PersonalPageTurnSound').PageSoundConfig;\n    aiTemplates?: import('@/utils/personalAIQuick').PersonalAITemplate[];\n  };",
 'profile type'));
edit('src/services/sync/adapters/settings.ts',s=>{
 const fields=[
  'aiSettings.enabled','aiSettings.provider',
  'aiSettings.ollamaBaseUrl','aiSettings.ollamaModel','aiSettings.ollamaEmbeddingModel',
  'aiSettings.aiGatewayModel','aiSettings.aiGatewayCustomModel','aiSettings.aiGatewayEmbeddingModel',
  'aiSettings.openrouterBaseUrl','aiSettings.openrouterModel','aiSettings.openrouterEmbeddingModel',
  'aiSettings.spoilerProtection','aiSettings.maxContextChunks','aiSettings.indexingMode',
  // Keys travel only through the existing encrypted/passphrase-protected path.
  'aiSettings.aiGatewayApiKey','aiSettings.openrouterApiKey',
 ];
 s=once(s,'export const SETTINGS_WHITELIST = [',
   'export const SETTINGS_WHITELIST = [\n  '+['personalProfile',...fields].map(x=>"'"+x+"'").join(',\n  ')+',',
   'cloud sync allowlist');
 s=once(s,'export const SETTINGS_ENCRYPTED_FIELDS = [',
   "export const SETTINGS_ENCRYPTED_FIELDS = [\n  'aiSettings.aiGatewayApiKey',\n  'aiSettings.openrouterApiKey',",
   'encrypted AI API keys');
 return s;
});
edit('src/utils/settingsSync.ts',s=>{
 s=once(s,
  "  personalControls?: SystemSettings['personalControls'];",
  "  personalControls?: SystemSettings['personalControls'];\n  personalProfile?: SystemSettings['personalProfile'];",
  'window sync payload');
 s=once(s,
  "'bookshelves' | 'personalControls'",
  "'bookshelves' | 'personalControls' | 'personalProfile'",
  'window sync picker');
 s=once(s,
  '    personalControls: payload.personalControls ?? local.personalControls,',
  '    personalControls: payload.personalControls ?? local.personalControls,\n    personalProfile: payload.personalProfile ?? local.personalProfile,',
  'window sync merge');
 s=once(s,
  '      personalControls: settings.personalControls,',
  '      personalControls: settings.personalControls,\n      personalProfile: settings.personalProfile,',
  'window sync broadcast');
 return s;
});
edit('src/components/settings/SettingsDialog.tsx',s=>{
 const ai="    {\n      tab: 'AI',\n      icon: PiRobot,\n      label: _('AI Assistant'),\n      disabled: process.env.NODE_ENV === 'production',\n    },\n";
 const backup="    {tab: 'Backup',icon: RiArchiveLine,label: '백업 · 복원'},";
 s=once(s,ai,'','production tab hidden');
 s=once(s,backup,"    {tab: 'AI', icon: PiRobot, label: 'AI 설정'},\n"+backup,'tab ordering');
 const marker='  // sync localStorage and fontPanelView when activePanel changes';
 const swipe=[
 '  // Horizontal gestures switch panels, without stealing vertical scroll or input gestures.',
 '  useEffect(() => {',
 '    const panel = panelRef.current;',
 '    if (!panel || !appService?.isMobile) return;',
 '    let start: {x:number;y:number;time:number}|null = null;',
 '    const onStart=(event:TouchEvent)=>{',
 '      start=null;',
 '      if(event.touches.length!==1)return;',
 '      const target=event.target;',
 '      if(!(target instanceof Element))return;',
 '      if(target.closest(\'input,textarea,select,button,a,[contenteditable],[role="slider"],[data-no-settings-swipe]\'))return;',
 '      const t=event.touches[0]!;',
 '      start={x:t.clientX,y:t.clientY,time:Date.now()};',
 '    };',
 '    const onEnd=(event:TouchEvent)=>{',
 '      const prior=start;start=null;',
 '      if(!prior||event.changedTouches.length!==1)return;',
 '      const t=event.changedTouches[0]!;',
 '      const dx=t.clientX-prior.x,dy=t.clientY-prior.y;',
 '      if(Math.abs(dx)<68||Math.abs(dx)<Math.abs(dy)*1.4||Date.now()-prior.time>1100)return;',
 '      const visible=tabConfig.filter(tab=>!tab.disabled);',
 '      const index=visible.findIndex(tab=>tab.tab===activePanel);',
 '      const next=visible[index+(dx<0?1:-1)];',
 '      if(next)handleSetActivePanel(next.tab);',
 '    };',
 '    const cancel=()=>{start=null;};',
 '    panel.addEventListener(\'touchstart\',onStart,{passive:true});',
 '    panel.addEventListener(\'touchend\',onEnd,{passive:true});',
 '    panel.addEventListener(\'touchcancel\',cancel,{passive:true});',
 '    return()=>{',
 '      panel.removeEventListener(\'touchstart\',onStart);',
 '      panel.removeEventListener(\'touchend\',onEnd);',
 '      panel.removeEventListener(\'touchcancel\',cancel);',
 '    };',
 '  },[activePanel,appService?.isMobile]);',
 '',
 ].join('\n');
 return once(s,marker,swipe+marker,'touch swipe');
});
console.log('Readest Personal: visible AI tab after Custom, horizontal settings navigation, synced personal profile');
