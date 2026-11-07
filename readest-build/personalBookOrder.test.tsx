import {describe,it,expect,vi,afterEach} from 'vitest';
import React from 'react';
import {render,fireEvent,cleanup} from '@testing-library/react';
import {applyPersonalOrder,movePersonalOrder,personalSortScope} from '@/utils/personalBookOrder';
import {PersonalSortableBook} from '@/app/library/components/PersonalSortableBook';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('saved book order',()=>{
 it('keeps imported books after explicitly positioned books',()=>{
  expect(applyPersonalOrder([{hash:'a'},{hash:'b'},{hash:'c'}],['book:b','book:a']).map(x=>x.hash)).toEqual(['b','a','c']);
 });
 it('moves downward after the drop target and upward before it',()=>{
  expect(movePersonalOrder(['a','b','c'],[], 'a','c')).toEqual(['b','c','a']);
  expect(movePersonalOrder(['a','b','c'],[], 'c','a')).toEqual(['c','a','b']);
 });
 it('preserves filtered-out positions and persisted order on reopen',()=>{
  const next=movePersonalOrder(['book:a','book:c'],['book:a','book:b','book:c'],'book:c','book:a');
  expect(next).toEqual(['book:c','book:b','book:a']);
  expect(applyPersonalOrder([{hash:'a'},{hash:'b'},{hash:'c'}],JSON.parse(JSON.stringify(next))).map(x=>x.hash)).toEqual(['c','b','a']);
 });
 it('ignores invalid drags and separates groups and shelves',()=>{
  expect(movePersonalOrder(['a','b'],['a','b'],'missing','a')).toEqual(['a','b']);
  expect(personalSortScope('default','group')).not.toBe(personalSortScope('default:group',''));
 });
});
describe('mobile book reorder handle',()=>{
 const setup=()=>{
  vi.stubGlobal('PointerEvent',MouseEvent);
  Object.defineProperty(HTMLElement.prototype,'setPointerCapture',{value:vi.fn(),configurable:true});
  Object.defineProperty(HTMLElement.prototype,'hasPointerCapture',{value:()=>false,configurable:true});
  const move=vi.fn();
  const result=render(<><PersonalSortableBook id='a' scope='s' enabled onMove={move}><span>A</span></PersonalSortableBook>
   <div data-personal-sort-key='b' data-personal-sort-scope='s'>B</div></>);
  const handle=result.getByRole('button',{name:'책 순서 이동'});
  const target=result.getByText('B');
  Object.defineProperty(document,'elementFromPoint',{value:vi.fn(()=>target),configurable:true});
  return {move,handle,target};
 };
 it('uses the pointer drop target without opening a book',()=>{
  const {move,handle}=setup();
  fireEvent.pointerDown(handle,{button:0,clientX:1,clientY:1});
  fireEvent.pointerUp(handle,{button:0,clientX:30,clientY:30});
  expect(move).toHaveBeenCalledWith('a','b');
 });
 it('never moves across shelf/group boundaries',()=>{
  const {move,handle,target}=setup();target.dataset['personalSortScope']='another';
  fireEvent.pointerDown(handle,{button:0});fireEvent.pointerUp(handle,{button:0});
  expect(move).not.toHaveBeenCalled();
 });
 it('cancels interrupted pointer drags',()=>{
  const {move,handle}=setup();fireEvent.pointerDown(handle,{button:0});fireEvent.pointerCancel(handle);fireEvent.pointerUp(handle,{button:0});
  expect(move).not.toHaveBeenCalled();
 });
});
