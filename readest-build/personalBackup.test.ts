import { describe, expect, it, beforeEach } from 'vitest';
import type { BookConfig, BookNote } from '@/types/book';
import type { SystemSettings } from '@/types/settings';
import {
  DEFAULT_PERSONAL_BACKUP, PERSONAL_BACKUP_MANIFEST, PERSONAL_BACKUP_STORAGE,
  normalizeBackupSelection, makePersonalManifest, readPersonalManifest,
  filterPersonalBookConfig, filterPersonalSettings, mergePersonalBookConfig,
  exportPersonalLocalStorage, importPersonalLocalStorage,
} from '@/utils/personalBackupSelection';

const booknote=(id:string,type:BookNote['type'],updatedAt=5):BookNote=>({
  id,type,cfi:'epubcfi(/6/2)',note:'memo',createdAt:1,updatedAt,
});
const choice=(updates:Partial<typeof DEFAULT_PERSONAL_BACKUP>={})=>({...DEFAULT_PERSONAL_BACKUP,...updates});
describe('Readest Personal portable backup and partial restore',()=>{
  beforeEach(()=>localStorage.clear());
  it('writes an explicit versioned manifest; rejects unknown versions and missing flags',()=>{
    expect(PERSONAL_BACKUP_MANIFEST).toBe('readest-personal-manifest.json');
    expect(PERSONAL_BACKUP_STORAGE).toBe('readest-personal-storage.json');
    expect(readPersonalManifest(JSON.parse(makePersonalManifest(choice())))).toEqual(choice());
    expect(()=>readPersonalManifest({kind:'readest-personal-backup',version:100,selection:choice()})).toThrow();
    expect(()=>normalizeBackupSelection({bookFiles:true})).toThrow();
    expect(()=>normalizeBackupSelection({ ...choice(),bookFiles:'yes'})).toThrow();
  });
  it('filters independent note classes without damaging unrelated data',()=>{
    const raw:Partial<BookConfig>={updatedAt:1,progress:[8,100],location:'loc',
      booknotes:[booknote('b','bookmark'),booknote('a','annotation'),booknote('ink','ink'),booknote('n','notebook'),booknote('e','excerpt')],
      viewSettings:{userStylesheet:'body{color:red}'}};
    const filtered=filterPersonalBookConfig(raw,choice({
      bookmarks:false,annotations:false,notes:true,readingPositions:false,css:false,layouts:false,
    }));
    expect(filtered.booknotes?.map(n=>n.id)).toEqual(['n','e']);
    expect(filtered.progress).toBeUndefined();
    expect(filtered.location).toBeUndefined();
    expect(filtered.viewSettings).toBeUndefined();
    expect(raw.booknotes).toHaveLength(5);
  });
  it('merges only selected groups and leaves skipped progress and bookmarks untouched',()=>{
    const older:Partial<BookConfig>={updatedAt:5,progress:[99,100],location:'existing',
      booknotes:[booknote('b','bookmark',15),booknote('n','notebook',10)],
      viewSettings:{userStylesheet:'old'}};
    const imported:Partial<BookConfig>={updatedAt:20,progress:[1,100],location:'backed',
      booknotes:[booknote('b2','bookmark',30),booknote('n','notebook',30)],
      viewSettings:{userStylesheet:'new'}};
    const merged=mergePersonalBookConfig(older,imported,choice({
      bookFiles:false,readingPositions:false,bookmarks:false,annotations:false,
      notes:true,css:false,layouts:false,
    }));
    expect(merged.progress).toEqual([99,100]);
    expect(merged.location).toBe('existing');
    expect(merged.booknotes?.find(n=>n.id==='b')).toBeTruthy();
    expect(merged.booknotes?.find(n=>n.id==='b2')).toBeUndefined();
    expect(merged.booknotes?.find(n=>n.id==='n')?.updatedAt).toBe(30);
    expect(merged.viewSettings?.userStylesheet).toBe('old');
  });
  it('separates server connections, view style and credentials from other settings',()=>{
    const source={
      webdav:{enabled:true,serverUrl:'https://example.test',password:'secret'},
      absServers:[{name:'server',accessToken:'abc'}],
      globalViewSettings:{defaultFontSize:18,userStylesheet:'.x{}',userUIStylesheet:'.y{}'},
      personalControls:{foldProfiles:{folded:{},unfolded:{}}},
      libraryColumns:5,
      pinCodeHash:'hash',pinCodeSalt:'salt',
      keepLogin:true,
    } as unknown as SystemSettings;
    const filtered=filterPersonalSettings(source,choice({serverSettings:false,css:false,credentials:false}));
    expect(filtered.webdav).toBeUndefined();
    expect(filtered.absServers).toBeUndefined();
    expect(filtered.globalViewSettings?.userStylesheet).toBeUndefined();
    expect(filtered.globalViewSettings?.defaultFontSize).toBe(18);
    expect(filtered.pinCodeHash).toBeUndefined();
    expect(filtered.pinCodeSalt).toBeUndefined();
    expect(filtered.keepLogin).toBe(true);
    const standalone=filterPersonalSettings(source,choice({appSettings:false,layouts:false,css:true,serverSettings:false}));
    expect(standalone.keepLogin).toBeUndefined();
    expect(standalone.globalViewSettings?.userStylesheet).toBe('.x{}');
    expect(standalone.globalViewSettings?.defaultFontSize).toBeUndefined();
  });
  it('exports and restores only allowlisted device-local CSS and sound records',()=>{
    localStorage.setItem('readest-personal-css-profiles-book',JSON.stringify({items:[]}));
    localStorage.setItem('readest-personal-page-sounds-v1',JSON.stringify({enabled:true}));
    localStorage.setItem('user-auth-private','SECRET');
    const result=exportPersonalLocalStorage(choice({appSettings:false}));
    expect(Object.keys(result)).toEqual(['readest-personal-css-profiles-book']);
    localStorage.clear();
    importPersonalLocalStorage({...result,'user-auth-private':'ATTACK'},choice({appSettings:false}));
    expect(localStorage.getItem('readest-personal-css-profiles-book')).not.toBeNull();
    expect(localStorage.getItem('user-auth-private')).toBeNull();
    importPersonalLocalStorage({'readest-personal-page-sounds-v1':'not json'},choice());
    expect(localStorage.getItem('readest-personal-page-sounds-v1')).toBeNull();
  });
});
