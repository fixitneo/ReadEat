import {describe,it,expect,vi,afterEach} from 'vitest';
import React from 'react';
import {render,fireEvent,cleanup,waitFor} from '@testing-library/react';
import type {Book} from '@/types/book';
import type {SystemSettings} from '@/types/settings';
import {booksLinkedToWatchedFolder,pathIsWithinWatchedFolder,removeWatchedFolderPreferences} from '@/utils/personalWatchedFolders';
import WatchedFoldersPane from '@/app/library/components/WatchedFoldersPane';
afterEach(cleanup);
const book=(hash:string,filePath?:string,altFilePaths?:string[])=>({hash,filePath,altFilePaths} as Book);
describe('watched folder catalog removal',()=>{
 it('matches path boundaries and Windows separators without matching siblings',()=>{
  expect(pathIsWithinWatchedFolder('/Books/A/book.epub','/Books/A/')).toBe(true);
  expect(pathIsWithinWatchedFolder('/Books/AB/book.epub','/Books/A')).toBe(false);
  expect(pathIsWithinWatchedFolder('C:\\BOOKS\\A\\book.epub','c:/books/a')).toBe(true);
 });
 it('removes a book linked through any alternate path, including another watched folder',()=>{
  const books=[book('a','/B/book.epub',['/A/book.epub']),book('b','/A/sub/book.epub'),book('c','/AB/book.epub'),book('d')];
  expect(booksLinkedToWatchedFolder(books,'/A').map(b=>b.hash)).toEqual(['a','b']);
  expect(books[0]?.filePath).toBe('/B/book.epub'); // Selection never deletes or rewrites source paths.
 });
 it('ignores already removed books and remote sources',()=>{
  expect(booksLinkedToWatchedFolder([{...book('a','/A/a'),deletedAt:1},book('b','https://example.com/A/b')],'/A')).toEqual([]);
 });
 it('unregisters watching/in-place and removes only affected manual-order keys',()=>{
  const old={autoImportFolders:['/A','/B'],autoImportFlattenFolders:['/A'],externalLibraryFolders:['/A','/B'],personalProfile:{manualBookOrders:{s:['book:a','book:b','group:g']}}} as unknown as SystemSettings;
  const next=removeWatchedFolderPreferences(old,'/A',['a']);
  expect(next.autoImportFolders).toEqual(['/B']);expect(next.externalLibraryFolders).toEqual(['/B']);expect(next.autoImportFlattenFolders).toEqual([]);
  expect(next.personalProfile?.manualBookOrders?.['s']).toEqual(['book:b','group:g']);expect(old.autoImportFolders).toEqual(['/A','/B']);
 });
});
describe('watched folder management',()=>{
 it('requires explicit removal action and supports changing paths',async()=>{
  const remove=vi.fn(),edit=vi.fn();const r=render(<WatchedFoldersPane folders={[{path:'/A',flatten:false}]} onBack={()=>{}} onUnwatch={remove} onReplace={edit} onSetFlatten={()=>{}}/>);
  fireEvent.click(r.getByText('폴더 변경'));await waitFor(()=>expect(edit).toHaveBeenCalledWith('/A'));
  fireEvent.click(r.getByRole('button',{name:'감시 폴더 삭제'}));expect(remove).not.toHaveBeenCalled();
  fireEvent.click(r.getByText('폴더 및 연결된 책 제거'));await waitFor(()=>expect(remove).toHaveBeenCalledWith('/A'));
 });
 it('surfaces persistence errors',async()=>{
  const r=render(<WatchedFoldersPane folders={[{path:'/A',flatten:false}]} onBack={()=>{}} onUnwatch={async()=>{throw Error('save failed');}} onSetFlatten={()=>{}}/>);
  fireEvent.click(r.getByRole('button',{name:'감시 폴더 삭제'}));fireEvent.click(r.getByText('폴더 및 연결된 책 제거'));
  await waitFor(()=>expect(r.getByText('save failed')).toBeTruthy());
 });
});
