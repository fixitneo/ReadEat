import type {Book} from '@/types/book';
import type {SystemSettings} from '@/types/settings';
export const normalizeWatchedPath=(value:string)=>value.replace(/\\/g,'/').replace(/\/+$/,'');
export function pathIsWithinWatchedFolder(value:string,folder:string):boolean{
 const path=normalizeWatchedPath(value),root=normalizeWatchedPath(folder);
 if(!root || /^https?:\/\//i.test(path))return false;
 const windows=/^[a-z]:\//i.test(root);
 const p=windows?path.toLowerCase():path,r=windows?root.toLowerCase():root;
 return p===r || p.startsWith(r+'/');
}
export function booksLinkedToWatchedFolder(books:readonly Book[],folder:string):Book[]{
 return books.filter(book=>!book.deletedAt && [book.filePath,...(book.altFilePaths??[])].some(path=>path && pathIsWithinWatchedFolder(path,folder)));
}
export function removeWatchedFolderPreferences(settings:SystemSettings,folder:string,hashes:readonly string[]=[]):SystemSettings{
 const root=normalizeWatchedPath(folder),without=(paths:string[]|undefined)=>(paths??[]).filter(path=>normalizeWatchedPath(path)!==root);
 const removed=new Set(hashes.map(hash=>'book:'+hash));
 const orders=settings.personalProfile?.manualBookOrders;
 return {...settings,autoImportFolders:without(settings.autoImportFolders),
  autoImportFlattenFolders:without(settings.autoImportFlattenFolders),externalLibraryFolders:without(settings.externalLibraryFolders),
  personalProfile:orders?{...settings.personalProfile,manualBookOrders:Object.fromEntries(Object.entries(orders).map(([scope,keys])=>[scope,keys.filter(key=>!removed.has(key))]))}:settings.personalProfile};
}
