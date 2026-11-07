import { currentFoldMode } from '@/utils/personalControlsConfig';
export type BackgroundCrop = {zoom:number; x:number; y:number};
export type BackgroundCropMap = Record<string,BackgroundCrop>;
export const DEFAULT_BACKGROUND_CROP: BackgroundCrop = {zoom:1,x:0,y:0};
export const backgroundCropKey = (textureId:string,mode:'folded'|'unfolded') =>
  mode + ':' + textureId;
export function normalizeBackgroundCrop(raw:unknown):BackgroundCrop {
  const source = raw && typeof raw==='object' ? raw as Partial<BackgroundCrop> : {};
  const zoom = Number.isFinite(source.zoom) ? Math.min(3,Math.max(1,source.zoom!)) : 1;
  const limit = (zoom-1)*50;
  const x = Number.isFinite(source.x) ? Math.min(limit,Math.max(-limit,source.x!)) : 0;
  const y = Number.isFinite(source.y) ? Math.min(limit,Math.max(-limit,source.y!)) : 0;
  return {zoom,x:x || 0,y:y || 0};
}
export function setBackgroundCropVariables(
  textureId:string, crops:BackgroundCropMap|undefined, root:HTMLElement=document.documentElement,
  mode:'folded'|'unfolded'=currentFoldMode(),
){
  const crop=normalizeBackgroundCrop(crops?.[backgroundCropKey(textureId,mode)]);
  root.style.setProperty('--personal-bg-crop-zoom',String(crop.zoom));
  root.style.setProperty('--personal-bg-crop-x',crop.x+'%');
  root.style.setProperty('--personal-bg-crop-y',crop.y+'%');
  root.dataset['personalBackgroundId']=textureId;
}
