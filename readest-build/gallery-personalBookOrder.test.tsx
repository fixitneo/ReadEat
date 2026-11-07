import {describe,it,expect,vi,afterEach} from 'vitest';
import React from 'react';
import {render,fireEvent,cleanup} from '@testing-library/react';
import {applyPersonalOrder,movePersonalOrder,movePersonalOrderMany,personalSortScope} from '@/utils/personalBookOrder';
import {PersonalSortableBook,cancelPersonalBookDrag} from '@/app/library/components/PersonalSortableBook';
afterEach(()=>{cancelPersonalBookDrag();cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('saved book order',()=>{
 it('places new imports after saved books',()=>expect(applyPersonalOrder([{hash:'a'},{hash:'b'},{hash:'c'}],['book:b','book:a']).map(x=>x.hash)).toEqual(['b','a','c']));
 it('retains baseline single-book ordering',()=>{
  expect(movePersonalOrder(['a','b','c'],[],'a','c')).toEqual(['b','c','a']);
  expect(movePersonalOrder(['a','b','c'],[],'c','a')).toEqual(['c','a','b']);
 });
 it('moves a multi-selection as a block in displayed order',()=>{
  expect(movePersonalOrderMany(['a','b','c','d','e'],[],['d','b'],'e','after')).toEqual(['a','c','e','b','d']);
  expect(movePersonalOrderMany(['a','b','c','d'],[],['c','d'],'a','before')).toEqual(['c','d','a','b']);
 });
 it('preserves hidden books when moving a selected block',()=>expect(movePersonalOrderMany(['a','c','d'],['a','hidden','c','d'],['a','c'],'d','after')).toEqual(['d','hidden','a','c']));
 it('ignores dropping on the selection or outside the current view',()=>{
  expect(movePersonalOrderMany(['a','b'],['a','b'],['a','b'],'a','after')).toEqual(['a','b']);
  expect(movePersonalOrderMany(['a','b'],['a','b'],['x'],'a','before')).toEqual(['a','b']);
 });
 it('persists order and separates shelf/group scopes',()=>{
  const next=movePersonalOrder(['book:a','book:c'],['book:a','book:b','book:c'],'book:c','book:a');
  expect(applyPersonalOrder([{hash:'a'},{hash:'b'},{hash:'c'}],JSON.parse(JSON.stringify(next))).map(x=>x.hash)).toEqual(['c','b','a']);
  expect(personalSortScope('a','b')).not.toBe(personalSortScope('a:b',''));
 });
});
describe('gallery touch drag',()=>{
 const setup=(enabled=true,selection:string[]=[])=>{
  vi.stubGlobal('PointerEvent',MouseEvent);
  const callbacks:FrameRequestCallback[]=[];
  vi.spyOn(globalThis,'requestAnimationFrame').mockImplementation(cb=>{callbacks.push(cb);return callbacks.length;});
  vi.spyOn(globalThis,'cancelAnimationFrame').mockImplementation(()=>{});
  const move=vi.fn();
  const result=render(<><PersonalSortableBook id='a' scope='s' enabled={enabled} selectedIds={selection} onMove={move}><span>A</span></PersonalSortableBook>
   <div data-personal-sort-key='b' data-personal-sort-scope='s'>B</div>
   <div data-personal-sort-key='c' data-personal-sort-scope='s'>C</div></>);
  const target=result.getByText('B');
  Object.defineProperty(document,'elementFromPoint',{value:vi.fn(()=>target),configurable:true});
  const handle=result.queryByRole('button',{name:'책 순서 이동'});
  return {move,result,target,handle,callbacks};
 };
 it('tracks the finger with a ghost and drops on the actual target',()=>{
  const {move,handle,callbacks}=setup();
  fireEvent.pointerDown(handle!,{button:0,clientX:10,clientY:20});
  const ghost=document.querySelector<HTMLElement>('[data-personal-drag-ghost]')!;expect(ghost).toBeTruthy();
  const before=ghost.style.transform;
  fireEvent.pointerMove(document,{clientX:75,clientY:100});callbacks.at(-1)!(0);
  expect(ghost.style.transform).not.toBe(before);
  fireEvent.pointerUp(document,{button:0,clientX:75,clientY:100});
  expect(move).toHaveBeenCalledWith(['a'],'b','after');expect(document.querySelector('[data-personal-drag-ghost]')).toBeNull();
 });
 it('shows a stack/count and moves the whole selection',()=>{
  const {move,handle}=setup(true,['a','c']);fireEvent.pointerDown(handle!,{button:0});
  expect(document.querySelector('[data-personal-drag-ghost]')?.textContent).toContain('2권');
  fireEvent.pointerUp(document,{button:0,clientX:30,clientY:30});expect(move).toHaveBeenCalledWith(['a','c'],'b','after');
 });
 it('never reorders under ordinary sorting',()=>{
  const {handle,move}=setup(false);expect(handle).toBeNull();fireEvent.pointerDown(document,{button:0});fireEvent.pointerUp(document,{button:0});expect(move).not.toHaveBeenCalled();
 });
 it('rejects other shelf targets and cancels interrupted drags',()=>{
  const {move,handle,target}=setup();target.dataset['personalSortScope']='other';fireEvent.pointerDown(handle!,{button:0});fireEvent.pointerUp(document,{button:0});expect(move).not.toHaveBeenCalled();
  fireEvent.pointerDown(handle!,{button:0});fireEvent.pointerCancel(document);expect(document.querySelector('[data-personal-drag-ghost]')).toBeNull();
 });
});
