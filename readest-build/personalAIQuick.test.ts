import {describe,it,expect} from 'vitest';
import type {Book} from '@/types/book';
import {
 DEFAULT_PERSONAL_AI_TEMPLATES,
 normalizeAITemplates,
 onlyMetadata,
 fillPersonalAIPrompt,
} from '@/utils/personalAIQuick';
const item=(values:Partial<Book>={}):Book=>({
 hash:'hash',title:'책 제목',author:'작가',format:'EPUB',
 createdAt:1,updatedAt:2,
 metadata:{title:'책 제목',author:'작가',language:'ko',publisher:'출판사'},
 ...values,
} as Book);
describe('Readest Personal AI: safe metadata and selected quote prompts',()=>{
 it('has templates for book and selected text',()=>{
  expect(DEFAULT_PERSONAL_AI_TEMPLATES.some(t=>t.scope==='book')).toBe(true);
  expect(DEFAULT_PERSONAL_AI_TEMPLATES.some(t=>t.scope==='quote')).toBe(true);
 });
 it('uses metadata and never book content or private file paths',()=>{
  const b=item({filePath:'/private/secret.epub',tags:['Secret token'], progress:[42,100]});
  const text=onlyMetadata([b]);
  expect(text).toContain('책 제목');expect(text).toContain('작가');
  expect(text).toContain('출판사');
  expect(text).not.toContain('secret.epub');expect(text).not.toContain('Secret token');
  expect(text).not.toContain('42');
 });
 it('formats author-title-publisher and selected excerpt without adding other content',()=>{
  const prompt=fillPersonalAIPrompt('{author} - {title} ({publisher}): "{text}"',[item()],'중요한 인용');
  expect(prompt).toBe('작가 - 책 제목 (출판사): "중요한 인용"');
 });
 it('limits quote length and preserves model independence',()=>{
  expect(fillPersonalAIPrompt('{text}',[item()],'x'.repeat(14000)).length).toBe(12000);
  expect(onlyMetadata([item(),item()]).split('\n')).toHaveLength(1);
 });
 it('rejects malformed templates to avoid oversized or malformed persisted prompts',()=>{
  const templates=normalizeAITemplates([{id:'ok',name:'테스트',scope:'quote',body:'{text}'},{id:'bad',name:'',scope:'wrong',body:'a'}]);
  expect(templates).toHaveLength(1);
  expect(templates[0]?.id).toBe('ok');
  expect(normalizeAITemplates({not:'an array'})).toHaveLength(DEFAULT_PERSONAL_AI_TEMPLATES.length);
 });
});
