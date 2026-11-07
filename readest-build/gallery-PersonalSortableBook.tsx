import React from 'react';
type Placement='before'|'after';
type Move=(sources:string[],target:string,placement:Placement)=>void;
let cancelActiveDrag:(()=>void)|null=null;
export const cancelPersonalBookDrag=()=>{cancelActiveDrag?.();};
// One document-level session keeps the ghost attached when virtualized rows unmount.
function beginDrag(event:React.PointerEvent<HTMLButtonElement>,id:string,scope:string,selectedIds:string[],onMove:Move){
 cancelPersonalBookDrag();
 const source=event.currentTarget.closest<HTMLElement>('[data-personal-sort-key]');if(!source)return;
 const candidates=Array.from(document.querySelectorAll<HTMLElement>('[data-personal-sort-key]'))
   .filter(node=>node.dataset['personalSortScope']===scope);
 const keys=selectedIds.includes(id)?Array.from(new Set(selectedIds)):[id];
 const keySet=new Set(keys),box=source.getBoundingClientRect();
 const ghost=document.createElement('div');ghost.dataset['personalDragGhost']='true';ghost.setAttribute('aria-hidden','true');
 Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',width:box.width+'px',height:box.height+'px',zIndex:'10000',pointerEvents:'none',willChange:'transform',filter:'drop-shadow(0 12px 18px rgba(0,0,0,.35))'});
 const previews=[source,...candidates.filter(node=>node!==source && keySet.has(node.dataset['personalSortKey']!))].slice(0,3);
 previews.slice(0,3).reverse().forEach((node,index,array)=>{
  const clone=node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button').forEach(button=>button.remove());
  clone.removeAttribute('data-personal-sort-key');clone.removeAttribute('data-personal-sort-scope');
  clone.querySelectorAll('[id]').forEach(child=>child.removeAttribute('id'));
  const depth=array.length-1-index;
  Object.assign(clone.style,{position:'absolute',inset:'0',width:'100%',height:'100%',margin:'0',background:'var(--color-base-100, #fff)',borderRadius:'8px',overflow:'hidden',transform:`translate(${depth*8}px,${-depth*7}px) rotate(${depth*4}deg)`,boxShadow:'0 0 0 1px rgba(127,127,127,.25)'});
  ghost.appendChild(clone);
 });
 const badge=document.createElement('div');badge.textContent=keys.length+'권';
 Object.assign(badge.style,{position:'absolute',right:'-8px',top:'-12px',padding:'5px 10px',borderRadius:'999px',background:'#2563eb',color:'#fff',fontWeight:'700',fontSize:'14px',boxShadow:'0 2px 8px #0005'});ghost.appendChild(badge);
 const status=document.createElement('div');status.className='sr-only';status.setAttribute('role','status');status.textContent=keys.length+'권 이동 중';
 document.body.append(ghost,status);
 const faded=candidates.filter(node=>keySet.has(node.dataset['personalSortKey']!)).map(node=>({node,opacity:node.style.opacity}));
 faded.forEach(({node})=>node.style.opacity='.25');
 let x=event.clientX,y=event.clientY,frame=0,finished=false;
 const offsetX=x-box.left,offsetY=y-box.top,pointer=event.pointerId;
 let highlight:HTMLElement|null=null,oldShadow='';
 const clearHighlight=()=>{if(highlight){highlight.style.boxShadow=oldShadow;delete highlight.dataset['personalDropTarget'];highlight=null;}};
 const hit=()=>{
  const node=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-personal-sort-key]');
  if(!node || node.dataset['personalSortScope']!==scope || keySet.has(node.dataset['personalSortKey']!))return null;
  const rect=node.getBoundingClientRect();
  const placement:Placement=rect.width>window.innerWidth*.7?(y<rect.top+rect.height/2?'before':'after'):(x<rect.left+rect.width/2?'before':'after');
  return {node,key:node.dataset['personalSortKey']!,placement};
 };
 const paint=()=>{
  if(finished)return;
  ghost.style.transform=`translate3d(${x-offsetX}px,${y-offsetY}px,0) scale(1.04)`;
  const target=hit();
  if(target?.node!==highlight){clearHighlight();if(target){highlight=target.node;oldShadow=highlight.style.boxShadow;}}
  if(highlight&&target){highlight.dataset['personalDropTarget']=target.placement;highlight.style.boxShadow=target.placement==='before'?'inset 4px 0 #2563eb':'inset -4px 0 #2563eb';}
  // Resolve the current virtual scroller from the pointer, not the old source row.
  let node=(target?.node??document.elementFromPoint(x,y))?.parentElement;
  while(node && !(node.scrollHeight>node.clientHeight+2 && /auto|scroll/.test(getComputedStyle(node).overflowY)))node=node.parentElement;
  if(node){const rect=node.getBoundingClientRect();const delta=y<rect.top+60?-14:y>rect.bottom-60?14:0;if(delta)node.scrollBy(0,delta);}
  frame=requestAnimationFrame(paint);
 };
 const cleanup=()=>{
  if(finished)return;finished=true;cancelAnimationFrame(frame);clearHighlight();
  document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel);
  faded.forEach(({node,opacity})=>node.style.opacity=opacity);ghost.remove();status.remove();if(cancelActiveDrag===cleanup)cancelActiveDrag=null;
 };
 const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;e.preventDefault();e.stopPropagation();x=e.clientX;y=e.clientY;};
 const up=(e:PointerEvent)=>{
  if(e.pointerId!==pointer)return;e.preventDefault();e.stopPropagation();x=e.clientX;y=e.clientY;const target=hit();
  cleanup();if(target)onMove(keys,target.key,target.placement);
 };
 const cancel=()=>cleanup();cancelActiveDrag=cleanup;
 document.addEventListener('pointermove',move,{capture:true,passive:false});document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);
 paint();
}
export function PersonalSortableBook({id,scope,enabled,selectedIds=[],onMove,children}:{
 id:string;scope:string;enabled:boolean;selectedIds?:string[];onMove:Move;children:React.ReactNode;
}){
 React.useEffect(()=>{if(!enabled)cancelPersonalBookDrag();},[enabled]);
 return <div className='relative min-w-0' data-personal-sort-key={id} data-personal-sort-scope={scope}>
  {children}
  {enabled&&<button type='button' aria-label='책 순서 이동' title='끌어서 책 순서 이동'
   className='btn btn-sm btn-circle bg-base-100/95 absolute start-1 top-1 z-20 min-h-10 h-10 w-10 shadow-md'
   style={{touchAction:'none'}} onContextMenu={e=>e.preventDefault()}
   onClick={e=>{e.preventDefault();e.stopPropagation();}}
   onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();beginDrag(e,id,scope,selectedIds,onMove);}}>↕</button>}
 </div>;
}
