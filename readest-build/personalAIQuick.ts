import type {Book} from '@/types/book';
export const PERSONAL_AI_TEMPLATES_KEY = 'readest-personal-ai-templates-v1';
export type AskScope = 'book' | 'quote';
export interface PersonalAITemplate {
 id: string; name: string; scope: AskScope | 'both'; body: string;
}
export const DEFAULT_PERSONAL_AI_TEMPLATES: PersonalAITemplate[] = [
 {id:'book-analysis',name:'책 소개와 분석',scope:'book',
  body:'다음 책의 메타데이터만 참고해 저자, 배경, 핵심 주제와 읽기 전 생각해 볼 질문을 설명해 줘. 원문을 실제로 읽지 않았다면 내용에 대한 추측을 확정적으로 말하지 마.\n{books}'},
 {id:'book-search',name:'서지정보 살펴보기',scope:'book',
  body:'다음 메타데이터의 작품에 대해 알려진 출판 및 저자 정보를 설명해 줘. 확인하지 못한 정보는 사실처럼 단정하지 마.\n{books}'},
 {id:'quote-explain',name:'구절 해설',scope:'quote',
  body:'다음 책의 인용 구절을 문맥이 제한된 상태에서 해설해 줘.\n저자: {author}\n제목: {title}\n출판사: {publisher}\n인용: “{text}”\n관련 개념과 다른 해석 가능성을 구분해 줘.'},
 {id:'quote-critique',name:'비판적 질문',scope:'quote',
  body:'저자 {author}의 『{title}』({publisher})에서 인용한 “{text}”에 대해 전제, 논증의 타당성, 반론 및 추가 질문을 제시해 줘.'},
];
const LIMIT=24;
export function normalizeAITemplates(raw: unknown): PersonalAITemplate[] {
 if(!Array.isArray(raw))return [...DEFAULT_PERSONAL_AI_TEMPLATES];
 const unique=new Set<string>();
 const templates:PersonalAITemplate[]=[];
 for(const item of raw){
  if(!item||typeof item!=='object')continue;
  const data=item as Record<string,unknown>;
  const id=typeof data['id']==='string'?data['id']:'';
  const name=typeof data['name']==='string'?data['name'].trim():'';
  const body=typeof data['body']==='string'?data['body'].trim():'';
  const scope=data['scope'];
  if(!/^[a-z0-9_-]{2,80}$/i.test(id)||unique.has(id)||!name||name.length>60||
    !body||body.length>12000||(scope!=='book'&&scope!=='quote'&&scope!=='both'))continue;
  unique.add(id);templates.push({id,name,body,scope});
  if(templates.length>=LIMIT)break;
 }
 return templates.length?templates:[...DEFAULT_PERSONAL_AI_TEMPLATES];
}
export function loadPersonalAITemplates(): PersonalAITemplate[]{
 try{return normalizeAITemplates(JSON.parse(localStorage.getItem(PERSONAL_AI_TEMPLATES_KEY)??'null'));}
 catch{return [...DEFAULT_PERSONAL_AI_TEMPLATES];}
}
export function savePersonalAITemplates(templates:PersonalAITemplate[]):void{
 localStorage.setItem(PERSONAL_AI_TEMPLATES_KEY,JSON.stringify(normalizeAITemplates(templates)));
 window.dispatchEvent(new Event('readest-personal-ai-templates-updated'));
}
export function onlyMetadata(books:Book[]): string {
 const unique=new Map(books.map(book=>[book.hash,book]));
 return [...unique.values()].slice(0,50).map((book,index)=>{
  const meta=book.metadata;
  const author=book.author||'정보 없음';
  const publisher=meta?.publisher||'정보 없음';
  return (index+1)+'. 저자: '+author+' | 제목: '+book.title+' | 출판사: '+publisher+
    (meta?.published?' | 출판: '+meta.published:'');
 }).join('\n').slice(0,18000);
}
export function fillPersonalAIPrompt(
 template:string, books:Book[], quote?:string,
):string {
 const first=books[0];
 const values: Record<string,string>={
  title:first?.title||'정보 없음',
  author:first?.author||'정보 없음',
  publisher:first?.metadata?.publisher||'정보 없음',
  books:onlyMetadata(books),
  text:(quote||'').trim().slice(0,12000),
 };
 return template.replace(/\{(title|author|publisher|books|text)\}/g, (_,key:string)=>values[key]||'');
}
