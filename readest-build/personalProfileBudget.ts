// Readest's settings singleton replica has MAX_JSON_BYTES=64*1024 for ALL
// whitelisted preferences combined. Keep Personal extras at <=24KiB to leave
// room for CSS, server preferences and encrypted provider fields.
export const MAX_PERSONAL_PROFILE_BYTES = 24 * 1024;
export function personalProfileBytes(profile:unknown):number{
 return new TextEncoder().encode(JSON.stringify(profile??{})).byteLength;
}
export function validatePersonalProfileBudget(profile:unknown):void{
 const bytes=personalProfileBytes(profile);
 if(bytes>MAX_PERSONAL_PROFILE_BYTES)
  throw new Error('서버 설정 동기화 용량 제한: AI 템플릿이나 사용자 음원을 줄여 주세요 (최대 24KB, 현재 '+Math.ceil(bytes/1024)+'KB).');
}
