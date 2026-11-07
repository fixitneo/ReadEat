#!/usr/bin/env node
// Personal usability follow-up on v0.12.16. Apply last, after all existing patch scripts.
import fs from 'node:fs';
import path from 'node:path';
const app=path.resolve(process.argv[2]??'upstream','apps/readest-app');
const local=path.dirname(new URL(import.meta.url).pathname);
function once(relative,oldText,newText) {
  const file=path.join(app,relative),src=fs.readFileSync(file,'utf8');
  if(src.split(oldText).length!==2)throw new Error('Usability patch anchor mismatch: '+relative+' '+oldText.slice(0,100));
  fs.writeFileSync(file,src.replace(oldText,newText));
}
for(const [source,target] of [
  ['PersonalShelfHelp.tsx','src/app/library/components/PersonalShelfHelp.tsx'],
  ['personalBackgroundCrop.ts','src/utils/personalBackgroundCrop.ts'],
  ['PersonalBackgroundCrop.tsx','src/components/settings/PersonalBackgroundCrop.tsx'],
  ['personalBackgroundCrop.test.ts','src/__tests__/personalBackgroundCrop.test.ts'],
]) fs.copyFileSync(path.join(local,source),path.join(app,target));

// Trailing controls: Help, View, Settings (left to right).
once('src/app/library/components/LibraryHeader.tsx',
  "import React, { useRef } from 'react';",
  "import React, { useRef, useState } from 'react';");
once('src/app/library/components/LibraryHeader.tsx',
  "import { MdOutlineMenu } from 'react-icons/md';",
  "import { MdOutlineMenu, MdHelpOutline } from 'react-icons/md';");
once('src/app/library/components/LibraryHeader.tsx',
  "import SettingsMenu from './SettingsMenu';",
  "import SettingsMenu from './SettingsMenu';\nimport PersonalShelfHelp from './PersonalShelfHelp';");
once('src/app/library/components/LibraryHeader.tsx',
  "  const headerRef = useRef<HTMLDivElement>(null);",
  "  const [personalHelpOpen,setPersonalHelpOpen] = useState(false);\n  const headerRef = useRef<HTMLDivElement>(null);");
once('src/app/library/components/LibraryHeader.tsx',
  "            <Dropdown\n              label='정렬 및 필터'",
  "            <button type='button' aria-label='도움말' title='도움말'\n              className='exclude-title-bar-mousedown btn btn-ghost h-8 min-h-8 w-8 rounded-full p-0'\n              onClick={()=>setPersonalHelpOpen(true)}>\n              <MdHelpOutline role='none' size={iconSize18+4} />\n            </button>\n            <PersonalShelfHelp open={personalHelpOpen} onClose={()=>setPersonalHelpOpen(false)} />\n            <Dropdown\n              label='정렬 및 필터'");

// Wallpaper crop profiles use the existing settings.json and backup/sync path.
once('src/types/settings.ts',
  "    aiTemplates?: import('@/utils/personalAIQuick').PersonalAITemplate[];",
  "    aiTemplates?: import('@/utils/personalAIQuick').PersonalAITemplate[];\n    backgroundCrops?: import('@/utils/personalBackgroundCrop').BackgroundCropMap;");
// Screenshot-framing editor follows Readest's existing image chooser/size controls.
once('src/components/settings/ThemePanel.tsx',
  "import BackgroundTextureSelector from './theme/BackgroundTextureSelector';",
  "import BackgroundTextureSelector from './theme/BackgroundTextureSelector';\nimport PersonalBackgroundCrop from './PersonalBackgroundCrop';");
once('src/components/settings/ThemePanel.tsx',
  "            data-setting-id='settings.color.backgroundTexture'\n          />",
  "            data-setting-id='settings.color.backgroundTexture'\n          />\n          {selectedTextureId !== 'none' && (()=>{\n            const background=[...PREDEFINED_TEXTURES,...customTextures].find(t=>t.id===selectedTextureId);\n            const src=background?.blobUrl || background?.url || '';\n            return src ? <PersonalBackgroundCrop textureId={selectedTextureId} imageSrc={src}/> : null;\n          })()}");

// Apply crop to the actual background pseudo-element, not only to the editor.
once('src/styles/textures.ts',
  "      background-size: var(--bg-texture-size, cover);",
  "      background-size: var(--bg-texture-size, cover);\n      background-position: center center;\n      transform-origin: center center;\n      transform: translate(var(--personal-bg-crop-x, 0%), var(--personal-bg-crop-y, 0%)) scale(var(--personal-bg-crop-zoom, 1));");
once('src/hooks/useBackgroundTexture.ts',
  "import { useCallback } from 'react';",
  "import { useCallback, useEffect } from 'react';\nimport { setBackgroundCropVariables } from '@/utils/personalBackgroundCrop';");
once('src/hooks/useBackgroundTexture.ts',
  "        const settings = useSettingsStore.getState().settings;",
  "        const settings = useSettingsStore.getState().settings;\n        setBackgroundCropVariables(textureId,settings.personalProfile?.backgroundCrops);");
once('src/hooks/useBackgroundTexture.ts',
  "  return { applyBackgroundTexture };",
  "  useEffect(()=>{\n    const onResize=()=>{\n      const id=document.documentElement.dataset['personalBackgroundId'];\n      if(id)setBackgroundCropVariables(id,useSettingsStore.getState().settings.personalProfile?.backgroundCrops);\n    };\n    window.addEventListener('resize',onResize);\n    return()=>window.removeEventListener('resize',onResize);\n  },[]);\n  return { applyBackgroundTexture };");

// Keep PDF rendering, spread, gestures and colors at the pre-usability implementation.
// Resize-driven spread mutation can trigger repeated PDF layout and canvas repaint.
console.log('Readest Personal: leftmost bookshelf help and screen-specific photo framing applied; PDF usability overrides disabled');
