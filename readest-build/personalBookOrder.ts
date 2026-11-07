export type SortItem = { hash: string } | { id: string };
export const personalSortKey = (item: SortItem) => 'hash' in item ? 'book:' + item.hash : 'group:' + item.id;
export const personalSortScope = (shelf: string, group: string) => JSON.stringify([shelf,group]);
export function applyPersonalOrder<T extends SortItem>(items: readonly T[], saved: readonly string[] = []): T[] {
  const ranks=new Map(saved.map((key,index)=>[key,index]));
  return items.map((item,index)=>({item,index,rank:ranks.get(personalSortKey(item)) ?? Number.MAX_SAFE_INTEGER}))
    .sort((a,b)=>a.rank-b.rank || a.index-b.index).map(x=>x.item);
}
export function movePersonalOrder(visible: readonly string[], saved: readonly string[], source: string, target: string): string[] {
  const keys=Array.from(new Set(visible));
  const from=keys.indexOf(source),to=keys.indexOf(target);
  if(from<0 || to<0 || from===to)return [...saved];
  keys.splice(from,1); keys.splice(to,0,source);
  const visibleSet=new Set(visible);
  // Fill visible slots while retaining hidden books when filtering a shelf.
  const all=Array.from(new Set([...saved,...visible]));
  let index=0;
  return all.map(key=>visibleSet.has(key)?keys[index++]!:key);
}
