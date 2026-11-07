import React,{useRef,useState} from 'react';
export function PersonalSortableBook({id,scope,enabled,onMove,children}:{
 id:string;scope:string;enabled:boolean;onMove:(source:string,target:string)=>void;children:React.ReactNode;
}) {
 const [dragging,setDragging]=useState(false);
 const drag=useRef<{pointer:number;x:number;y:number;frame:number}|null>(null);
 const host=useRef<HTMLDivElement>(null);
 const hit=(x:number,y:number)=>{
  const node=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-personal-sort-key]');
  return node?.dataset['personalSortScope']===scope?node.dataset['personalSortKey']:undefined;
 };
 const stop=()=>{if(drag.current)cancelAnimationFrame(drag.current.frame);drag.current=null;setDragging(false);};
 React.useEffect(()=>()=>{if(drag.current)cancelAnimationFrame(drag.current.frame);},[]);
 const scroll=()=>{
  const state=drag.current;if(!state)return;
  let node=host.current?.parentElement;
  while(node && !(node.scrollHeight>node.clientHeight+2 && /auto|scroll/.test(getComputedStyle(node).overflowY)))node=node.parentElement;
  if(node){const box=node.getBoundingClientRect();const dy=state.y<box.top+56?-12:state.y>box.bottom-56?12:0;if(dy)node.scrollBy(0,dy);}
  state.frame=requestAnimationFrame(scroll);
 };
 return <div ref={host} className={'relative min-w-0 '+(dragging?'ring-primary rounded-md ring-2 opacity-70':'')}
   data-personal-sort-key={id} data-personal-sort-scope={scope}>
   {children}
   {enabled&&<button type='button' aria-label='책 순서 이동' title='끌어서 책 순서 이동'
     className='btn btn-sm btn-circle bg-base-100/95 absolute start-1 top-1 z-20 min-h-10 h-10 w-10 shadow-md'
     style={{touchAction:'none'}}
     onContextMenu={e=>e.preventDefault()} onClick={e=>{e.preventDefault();e.stopPropagation();}}
     onPointerDown={e=>{
      if(e.button!==0)return;e.preventDefault();e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);
      drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,frame:0};scroll();
     }}
     onPointerMove={e=>{if(!drag.current || drag.current.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();drag.current.x=e.clientX;drag.current.y=e.clientY;}}
     onPointerUp={e=>{
      if(!drag.current || drag.current.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();
      const target=hit(e.clientX,e.clientY);stop();
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
      if(target && target!==id)onMove(id,target);
     }}
     onPointerCancel={stop} onLostPointerCapture={stop}>↕</button>}
 </div>;
}
